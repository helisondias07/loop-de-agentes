import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  validateImplementation,
  validatePlan,
  validateReview,
  validateSpec,
  validateVerificationEvidence,
} from "./contracts.ts";
import { acquireRunLock, forceUnlock, releaseRunLock } from "./lock.ts";
import {
  appendTrace,
  loadRun,
  readTraces,
  saveRun,
  statePath,
  workspacePath,
} from "./persist.ts";
import { redactRecord } from "./redact.ts";
import { SCENARIOS, listScenarios } from "./scenarios.ts";
import {
  ControllerError,
  SCHEMA_VERSION,
  SIMULATION_BANNER,
  type AgentAdapter,
  type Clock,
  type HumanGate,
  type PersistedRun,
  type RunSummary,
  type ScenarioId,
} from "./types.ts";
import { PRODUCT_FIXTURES, runVerification } from "../task/verify.ts";
import { GATE_IDS } from "./gates.ts";
import { assertRunId } from "./runId.ts";

export interface ControllerOptions {
  dataDir: string;
  harness: AgentAdapter;
  clock: Clock;
}

function summary(run: PersistedRun): RunSummary {
  return {
    runId: run.runId,
    scenarioId: run.scenarioId,
    status: run.status,
    phase: run.phase,
    attempt: run.attempt,
    iteration: run.iteration,
    globalSteps: run.globalSteps,
    callsUsed: run.callsUsed,
    budgets: run.budgets,
    pendingGate: run.pendingGate,
    lastEvidence: run.lastEvidence,
    ignoredModelClaims: run.ignoredModelClaims,
    lastError: run.lastError,
    terminalReason: run.terminalReason,
    completedPhases: run.completedPhases,
    simulationBanner: SIMULATION_BANNER,
  };
}

function isTerminal(run: PersistedRun): boolean {
  return (
    run.status === "completed" ||
    run.status === "cancelled" ||
    run.status === "exhausted" ||
    run.status === "failed_closed"
  );
}

export class WorkflowController {
  private readonly inProcessLocks = new Set<string>();

  constructor(private readonly options: ControllerOptions) {}

  listScenarios() {
    return listScenarios();
  }

  banner() {
    return SIMULATION_BANNER;
  }

  async current(runId: string): Promise<RunSummary> {
    return summary(await loadRun(this.options.dataDir, assertRunId(runId)));
  }

  async traces(runId: string): Promise<unknown[]> {
    return readTraces(this.options.dataDir, assertRunId(runId));
  }

  async start(scenarioId: ScenarioId): Promise<RunSummary> {
    const scenario = SCENARIOS[scenarioId];
    if (!scenario) {
      throw new ControllerError("UNKNOWN_SCENARIO", scenarioId);
    }
    const now = this.options.clock.now();
    const runId = randomUUID();
    const run: PersistedRun = {
      schemaVersion: SCHEMA_VERSION,
      checksum: "",
      runId,
      scenarioId,
      status: "running",
      phase: "spec",
      attempt: 1,
      iteration: 0,
      globalSteps: 0,
      callsUsed: 0,
      startedAtMs: now,
      updatedAtMs: now,
      budgets: scenario.budgets,
      pendingGate: null,
      completedPhases: [],
      artifacts: {},
      lastEvidence: null,
      ignoredModelClaims: [],
      lastError: null,
      terminalReason: null,
    };
    await mkdir(workspacePath(this.options.dataDir, runId), { recursive: true });
    await saveRun(this.options.dataDir, run);
    await this.trace(run, "run_started", { scenarioId });
    return summary(run);
  }

  async step(runId: string): Promise<RunSummary> {
    assertRunId(runId);
    return this.withExclusive(runId, async () => {
      const run = await loadRun(this.options.dataDir, runId);
      return this.stepLocked(run);
    });
  }

  async runUntilGate(runId: string): Promise<RunSummary> {
    let latest = await this.current(runId);
    for (let i = 0; i < 64; i += 1) {
      if (
        latest.status === "awaiting_human" ||
        latest.status === "completed" ||
        latest.status === "cancelled" ||
        latest.status === "exhausted" ||
        latest.status === "failed_closed"
      ) {
        return latest;
      }
      latest = await this.step(runId);
    }
    throw new ControllerError("STEP_LOOP", "loop de passos excedeu o limite interno");
  }

  async approve(runId: string, gateId: string): Promise<RunSummary> {
    return this.withExclusive(runId, async () => {
      const run = await loadRun(this.options.dataDir, runId);
      if (run.status !== "awaiting_human" || !run.pendingGate) {
        throw new ControllerError(
          "NO_PENDING_GATE",
          "não há gate humano pendente",
        );
      }
      if (run.pendingGate.id !== gateId) {
        throw new ControllerError(
          "GATE_MISMATCH",
          `gate esperado ${run.pendingGate.id}, recebido ${gateId}`,
        );
      }
      await this.trace(run, "human_approved", { gateId, source: "controller" });
      if (gateId === GATE_IDS.complete) {
        run.status = "completed";
        run.pendingGate = null;
        run.terminalReason = "human_complete_approval";
        run.updatedAtMs = this.options.clock.now();
        await saveRun(this.options.dataDir, run);
        return summary(run);
      }
      if (gateId === GATE_IDS.spec) {
        run.phase = "plan";
      } else if (gateId === GATE_IDS.plan) {
        run.phase = "implementation";
        run.attempt = 1;
      }
      run.status = "running";
      run.pendingGate = null;
      run.updatedAtMs = this.options.clock.now();
      await saveRun(this.options.dataDir, run);
      return summary(run);
    });
  }

  async reject(runId: string, gateId: string): Promise<RunSummary> {
    return this.withExclusive(runId, async () => {
      const run = await loadRun(this.options.dataDir, runId);
      if (!run.pendingGate || run.pendingGate.id !== gateId) {
        throw new ControllerError("GATE_MISMATCH", "rejeição sem gate correspondente");
      }
      run.status = "failed_closed";
      run.terminalReason = `human_rejected:${gateId}`;
      run.pendingGate = null;
      run.updatedAtMs = this.options.clock.now();
      await this.trace(run, "human_rejected", { gateId });
      await saveRun(this.options.dataDir, run);
      return summary(run);
    });
  }

  async cancel(runId: string): Promise<RunSummary> {
    return this.withExclusive(runId, async () => {
      const run = await loadRun(this.options.dataDir, runId);
      if (isTerminal(run)) {
        throw new ControllerError("ALREADY_TERMINAL", run.status);
      }
      run.status = "cancelled";
      run.terminalReason = "human_cancel";
      run.pendingGate = null;
      run.updatedAtMs = this.options.clock.now();
      await this.trace(run, "cancelled", {});
      await saveRun(this.options.dataDir, run);
      return summary(run);
    });
  }

  async interrupt(runId: string): Promise<RunSummary> {
    return this.withExclusive(runId, async () => {
      const run = await loadRun(this.options.dataDir, runId);
      if (isTerminal(run)) {
        throw new ControllerError("ALREADY_TERMINAL", run.status);
      }
      run.status = "interrupted";
      run.updatedAtMs = this.options.clock.now();
      await this.trace(run, "interrupted", { phase: run.phase });
      await saveRun(this.options.dataDir, run);
      return summary(run);
    });
  }

  async resume(runId: string, opts?: { forceUnlock?: boolean }): Promise<RunSummary> {
    assertRunId(runId);
    const peek = await loadRun(this.options.dataDir, runId);
    if (peek.status !== "interrupted") {
      throw new ControllerError(
        "RESUME_INVALID",
        `resume só retoma interrupt cooperativo (status=${peek.status}). Crash com lock órfão não é interrupt: use force-unlock e depois step.`,
      );
    }
    if (opts?.forceUnlock) {
      await forceUnlock(this.options.dataDir, runId);
    }
    return this.withExclusive(runId, async () => {
      const run = await loadRun(this.options.dataDir, runId);
      if (run.status !== "interrupted") {
        throw new ControllerError(
          "RESUME_INVALID",
          `resume só a partir de interrupted (status=${run.status})`,
        );
      }
      run.status = run.pendingGate ? "awaiting_human" : "running";
      run.updatedAtMs = this.options.clock.now();
      await this.trace(run, "resumed", { phase: run.phase, attempt: run.attempt });
      await saveRun(this.options.dataDir, run);
      return summary(run);
    });
  }

  async forceUnlock(runId: string): Promise<void> {
    await forceUnlock(this.options.dataDir, assertRunId(runId));
  }

  stateFile(runId: string): string {
    return statePath(this.options.dataDir, runId);
  }

  private async stepLocked(run: PersistedRun): Promise<RunSummary> {
    if (isTerminal(run)) {
      throw new ControllerError("ALREADY_TERMINAL", run.status);
    }
    if (run.status === "awaiting_human") {
      throw new ControllerError(
        "HUMAN_GATE",
        `aguardando aprovação humana ${run.pendingGate?.id ?? ""} — texto de modelo não libera este gate`,
      );
    }
    if (run.status === "interrupted") {
      throw new ControllerError("INTERRUPTED", "chame resume antes de step");
    }

    const now = this.options.clock.now();
    if (now - run.startedAtMs >= run.budgets.maxWallClockMs) {
      return this.exhaust(run, "budget_time");
    }
    if (run.globalSteps >= run.budgets.maxGlobalSteps) {
      return this.exhaust(run, "budget_steps");
    }
    if (run.callsUsed >= run.budgets.maxCalls && run.phase !== "verification") {
      return this.exhaust(run, "budget_calls");
    }

    run.globalSteps += 1;
    run.status = "running";
    run.updatedAtMs = now;

    if (run.phase === "verification") {
      return this.runVerificationPhase(run);
    }

    const entryError = this.assertEntry(run);
    if (entryError) {
      run.status = "failed_closed";
      run.terminalReason = entryError;
      run.lastError = entryError;
      await saveRun(this.options.dataDir, run);
      await this.trace(run, "fail_closed_entry", { entryError });
      return summary(run);
    }

    run.callsUsed += 1;
    if (run.callsUsed > run.budgets.maxCalls) {
      return this.exhaust(run, "budget_calls");
    }

    const result = await this.options.harness.invoke({
      runId: run.runId,
      scenarioId: run.scenarioId,
      phase: run.phase,
      attempt: run.attempt,
      workspaceDir: workspacePath(this.options.dataDir, run.runId),
      spec: run.artifacts.spec,
      plan: run.artifacts.plan,
      lastEvidence: run.lastEvidence,
    });

    if (result.claimedHumanApproval) {
      const claim = `ignored_model_approval_claim:phase=${run.phase}:attempt=${run.attempt}`;
      run.ignoredModelClaims.push(claim);
      await this.trace(run, "ignored_model_approval_claim", {
        text: result.text,
      });
    }

    if (run.phase === "spec") {
      const parsed = validateSpec(result.artifacts.spec);
      if (!parsed.ok) {
        return this.failClosed(run, "SPEC_INVALID", parsed.issues);
      }
      run.artifacts.spec = parsed.value;
      run.completedPhases = ["spec"];
      return this.holdGate(run, {
        id: GATE_IDS.spec,
        phase: "spec",
        reason: "Aprovar spec antes do plano (somente controlador).",
        createdAtMs: now,
      });
    }

    if (run.phase === "plan") {
      const parsed = validatePlan(result.artifacts.plan);
      if (!parsed.ok) {
        return this.failClosed(run, "PLAN_INVALID", parsed.issues);
      }
      run.artifacts.plan = parsed.value;
      run.completedPhases = ["spec", "plan"];
      return this.holdGate(run, {
        id: GATE_IDS.plan,
        phase: "plan",
        reason: "Aprovar plano antes da implementação (somente controlador).",
        createdAtMs: now,
      });
    }

    if (run.phase === "implementation") {
      const parsed = validateImplementation(result.artifacts.implementation);
      if (!parsed.ok) {
        return this.failClosed(run, "IMPLEMENTATION_INVALID", parsed.issues);
      }
      run.artifacts.implementation = parsed.value;
      run.phase = "verification";
      run.status = "running";
      await saveRun(this.options.dataDir, run);
      await this.trace(run, "implementation_written", {
        filesWritten: result.filesWritten,
      });
      return summary(run);
    }

    if (run.phase === "review") {
      const parsed = validateReview(result.artifacts.review);
      if (!parsed.ok) {
        return this.failClosed(run, "REVIEW_INVALID", parsed.issues);
      }
      run.artifacts.review = parsed.value;
      run.completedPhases = [
        "spec",
        "plan",
        "implementation",
        "verification",
        "review",
      ];
      return this.holdGate(run, {
        id: GATE_IDS.complete,
        phase: "review",
        reason: "Aprovar conclusão da run (somente controlador).",
        createdAtMs: now,
      });
    }

    return this.failClosed(run, "UNKNOWN_PHASE", [{ path: "phase", code: "UNKNOWN", message: run.phase }]);
  }

  private async runVerificationPhase(run: PersistedRun): Promise<RunSummary> {
    const filters = join(
      workspacePath(this.options.dataDir, run.runId),
      "filters.mjs",
    );
    const workspaceDir = workspacePath(this.options.dataDir, run.runId);
    const evidence = runVerification(filters, {
      workspaceDir,
      fixturesAbsPath: PRODUCT_FIXTURES,
    });
    const parsed = validateVerificationEvidence(evidence);
    if (!parsed.ok) {
      return this.failClosed(run, "EVIDENCE_INVALID", parsed.issues);
    }
    run.lastEvidence = parsed.value;
    await this.trace(run, "verification_evidence", {
      exitCode: evidence.exitCode,
      passed: evidence.passed,
      stdoutHead: evidence.stdout.slice(0, 500),
      stderrHead: evidence.stderr.slice(0, 500),
    });

    if (evidence.passed) {
      run.phase = "review";
      run.status = "running";
      if (!run.completedPhases.includes("implementation")) {
        run.completedPhases.push("implementation");
      }
      if (!run.completedPhases.includes("verification")) {
        run.completedPhases.push("verification");
      }
      run.updatedAtMs = this.options.clock.now();
      await saveRun(this.options.dataDir, run);
      return summary(run);
    }

    run.iteration += 1;
    if (run.attempt >= run.budgets.maxRetries) {
      return this.exhaust(run, "retry_exhausted");
    }
    if (run.iteration >= run.budgets.maxIterations) {
      return this.exhaust(run, "iteration_exhausted");
    }
    run.attempt += 1;
    run.phase = "implementation";
    run.status = "running";
    run.updatedAtMs = this.options.clock.now();
    await this.trace(run, "verification_return_to_implementation", {
      nextAttempt: run.attempt,
    });
    await saveRun(this.options.dataDir, run);
    return summary(run);
  }

  private assertEntry(run: PersistedRun): string | null {
    if (run.phase === "plan" && !run.artifacts.spec) {
      return "entry: spec ausente";
    }
    if (run.phase === "implementation" && !run.artifacts.plan) {
      return "entry: plan ausente";
    }
    if (run.phase === "review" && !run.lastEvidence?.passed) {
      return "entry: review exige verificação aprovada";
    }
    return null;
  }

  private async holdGate(run: PersistedRun, gate: HumanGate): Promise<RunSummary> {
    run.status = "awaiting_human";
    run.pendingGate = gate;
    run.updatedAtMs = this.options.clock.now();
    await saveRun(this.options.dataDir, run);
    await this.trace(run, "human_gate", { gateId: gate.id, phase: gate.phase });
    return summary(run);
  }

  private async exhaust(run: PersistedRun, reason: string): Promise<RunSummary> {
    run.status = "exhausted";
    run.terminalReason = reason;
    run.updatedAtMs = this.options.clock.now();
    await saveRun(this.options.dataDir, run);
    await this.trace(run, "exhausted", { reason });
    return summary(run);
  }

  private async failClosed(
    run: PersistedRun,
    code: string,
    issues: unknown,
  ): Promise<RunSummary> {
    run.status = "failed_closed";
    run.terminalReason = code;
    run.lastError = JSON.stringify(issues);
    run.updatedAtMs = this.options.clock.now();
    await saveRun(this.options.dataDir, run);
    await this.trace(run, "fail_closed", { code, issues });
    return summary(run);
  }

  private async trace(
    run: PersistedRun,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await appendTrace(this.options.dataDir, {
      tsMs: this.options.clock.now(),
      runId: run.runId,
      event,
      phase: run.phase,
      attempt: run.attempt,
      payload: redactRecord(payload),
    });
  }

  private async withExclusive<T>(runId: string, fn: () => Promise<T>): Promise<T> {
    if (this.inProcessLocks.has(runId)) {
      throw new ControllerError(
        "CONCURRENT_EXECUTION",
        "execução concorrente no mesmo processo",
      );
    }
    this.inProcessLocks.add(runId);
    const holderId = randomUUID();
    try {
      await acquireRunLock(
        this.options.dataDir,
        runId,
        holderId,
        this.options.clock.now(),
      );
      return await fn();
    } finally {
      try {
        await releaseRunLock(this.options.dataDir, runId, holderId);
      } catch {
        // release best-effort; fail-closed on next acquire if leftover
      }
      this.inProcessLocks.delete(runId);
    }
  }
}

export async function writePointer(dataDir: string, runId: string): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    join(dataDir, "current.json"),
    `${JSON.stringify({ runId: assertRunId(runId) })}\n`,
  );
}
