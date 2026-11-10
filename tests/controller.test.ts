import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mutableClock } from "../src/core/clock.ts";
import { createController } from "../src/core/factory.ts";
import { parsePersistedRun } from "../src/core/persist.ts";
import { ControllerError, SIMULATION_BANNER } from "../src/core/types.ts";
import { CursorAgentCliAdapter } from "../src/harness/cursor-cli-adapter.ts";
import { DeterministicHarness } from "../src/harness/deterministic.ts";
import { driveUntilStatus, startScenario, tempController } from "./helpers.ts";
import { acquireRunLock } from "../src/core/lock.ts";
import { lockPath } from "../src/core/persist.ts";

describe("workflow controller", () => {
  it("completa o caminho feliz com evidência real de verificação", async () => {
    const { controller } = await tempController();
    const started = await controller.start("success");
    expect(started.simulationBanner).toBe(SIMULATION_BANNER);
    const done = await driveUntilStatus(controller, started.runId, ["completed"]);
    expect(done.status).toBe("completed");
    expect(done.lastEvidence?.passed).toBe(true);
    expect(done.lastEvidence?.exitCode).toBe(0);
    expect(done.lastEvidence?.stdout).toContain('"ok": true');
    expect(done.lastEvidence?.argv[1]).toContain("verify-runner.mjs");
    const traces = await controller.traces(started.runId);
    expect(traces.length).toBeGreaterThan(3);
  });

  it("falha verificação, repara e depois passa", async () => {
    const { controller } = await tempController();
    const started = await controller.start("verification-repair");
    const done = await driveUntilStatus(controller, started.runId, ["completed"]);
    expect(done.status).toBe("completed");
    expect(done.attempt).toBeGreaterThan(1);
    expect(done.lastEvidence?.passed).toBe(true);
    const traces = JSON.stringify(await controller.traces(started.runId));
    expect(traces).toContain("verification_return_to_implementation");
  });

  it("esgota retries quando a implementação permanece quebrada", async () => {
    const { controller } = await tempController();
    const started = await controller.start("retry-exhaustion");
    const done = await driveUntilStatus(controller, started.runId, ["exhausted"]);
    expect(done.status).toBe("exhausted");
    expect(done.terminalReason).toBe("retry_exhausted");
    expect(done.lastEvidence?.passed).toBe(false);
    expect(done.lastEvidence?.stderr.length || done.lastEvidence?.stdout.length).toBeGreaterThan(0);
  });

  it("interrompe e retoma de forma idempotente", async () => {
    const { controller } = await tempController();
    const first = await startScenario(controller, "success");
    expect(first.status).toBe("awaiting_human");
    await controller.approve(first.runId, first.pendingGate!.id);
    const afterPlanGate = await controller.runUntilGate(first.runId);
    await controller.approve(afterPlanGate.runId, afterPlanGate.pendingGate!.id);
    const afterImpl = await controller.step(first.runId);
    expect(afterImpl.phase).toBe("verification");
    const interrupted = await controller.interrupt(first.runId);
    expect(interrupted.status).toBe("interrupted");
    const resumed = await controller.resume(first.runId);
    expect(resumed.status).toBe("running");
    expect(resumed.phase).toBe("verification");
    const done = await driveUntilStatus(controller, first.runId, ["completed"]);
    expect(done.status).toBe("completed");
    expect(done.lastEvidence?.passed).toBe(true);
  });

  it("cancela uma run em andamento", async () => {
    const { controller } = await tempController();
    const first = await startScenario(controller, "cancel-mid-run");
    const cancelled = await controller.cancel(first.runId);
    expect(cancelled.status).toBe("cancelled");
    await expect(controller.step(first.runId)).rejects.toMatchObject({
      code: "ALREADY_TERMINAL",
    });
  });

  it("falha fechado em checksum e schema incompatíveis", async () => {
    const { controller } = await tempController();
    const started = await controller.start("success");
    const file = controller.stateFile(started.runId);
    const json = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    json.globalSteps = 99;
    await writeFile(file, JSON.stringify(json));
    await expect(controller.current(started.runId)).rejects.toMatchObject({
      code: "CHECKSUM_MISMATCH",
    });
    json.schemaVersion = 99;
    json.checksum = "a".repeat(64);
    await writeFile(file, JSON.stringify(json));
    await expect(controller.current(started.runId)).rejects.toMatchObject({
      code: "SCHEMA_MISMATCH",
    });
    expect(() => parsePersistedRun({ hello: true })).toThrow(ControllerError);
  });

  it("ignora claimedHumanApproval vindo do harness", async () => {
    const { controller } = await tempController();
    const gated = await startScenario(controller, "model-approval-ignored");
    expect(gated.status).toBe("awaiting_human");
    expect(gated.pendingGate?.id).toBe("spec-approval");
    expect(gated.ignoredModelClaims.length).toBeGreaterThan(0);
    await expect(controller.step(gated.runId)).rejects.toMatchObject({
      code: "HUMAN_GATE",
    });
    const approved = await controller.approve(gated.runId, "spec-approval");
    expect(approved.phase).toBe("plan");
  });

  it("rejeita gate humano e encerra fail-closed", async () => {
    const { controller } = await tempController();
    const gated = await startScenario(controller, "success");
    const rejected = await controller.reject(gated.runId, gated.pendingGate!.id);
    expect(rejected.status).toBe("failed_closed");
    expect(rejected.terminalReason).toContain("human_rejected");
  });

  it("esgota orçamento de passos, chamadas e tempo", async () => {
    const { controller } = await tempController();
    const steps = await startScenario(controller, "budget-steps");
    await controller.approve(steps.runId, steps.pendingGate!.id);
    const after = await controller.step(steps.runId);
    expect(after.status).toBe("exhausted");
    expect(after.terminalReason).toBe("budget_steps");

    const calls = await controller.start("budget-calls");
    const callsDone = await controller.step(calls.runId);
    expect(callsDone.status).toBe("exhausted");
    expect(callsDone.terminalReason).toBe("budget_calls");

    const clock = mutableClock(1_000_000);
    const timed = createController({
      dataDir: (await tempController()).dataDir,
      clock,
    });
    const timeRun = await timed.start("budget-time");
    const timeDone = await timed.step(timeRun.runId);
    expect(timeDone.status).toBe("exhausted");
    expect(timeDone.terminalReason).toBe("budget_time");
  });

  it("bloqueia execução concorrente no processo e via lockfile", async () => {
    const { dataDir } = await tempController();
    const slow = {
      kind: "slow",
      implemented: true,
      async invoke(input: Parameters<DeterministicHarness["invoke"]>[0]) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return new DeterministicHarness().invoke(input);
      },
    };
    const c1 = createController({ dataDir, harness: slow });
    const c2 = createController({ dataDir, harness: slow });
    const started = await c1.start("success");
    const same = await Promise.allSettled([
      c1.step(started.runId),
      c1.step(started.runId),
    ]);
    const rejectedSame = same.filter((item) => item.status === "rejected");
    expect(rejectedSame.length).toBe(1);

    const started2 = await c1.start("success");
    const cross = await Promise.allSettled([
      c1.step(started2.runId),
      c2.step(started2.runId),
    ]);
    const rejectedCross = cross.filter((item) => item.status === "rejected");
    expect(rejectedCross.length).toBe(1);
    const reason = (rejectedCross[0] as PromiseRejectedResult).reason as ControllerError;
    expect(reason.code).toMatch(/CONCURRENT_EXECUTION|STALE_LOCK/);
  });

  it("lock órfão falha fechado até forceUnlock humano", async () => {
    const { dataDir, controller } = await tempController();
    const started = await controller.start("success");
    await mkdir(join(dataDir, "runs", started.runId), { recursive: true });
    await writeFile(
      lockPath(dataDir, started.runId),
      JSON.stringify({ holderId: "dead", pid: 999_999_999, acquiredAtMs: 1 }),
    );
    await expect(controller.step(started.runId)).rejects.toMatchObject({
      code: "STALE_LOCK",
    });
    await controller.forceUnlock(started.runId);
    const next = await controller.step(started.runId);
    expect(next.status).toBe("awaiting_human");
  });

  it("adapter live permanece não implementado", async () => {
    const live = new CursorAgentCliAdapter();
    expect(live.implemented).toBe(false);
    await expect(
      live.invoke({
        runId: "x",
        scenarioId: "success",
        phase: "spec",
        attempt: 1,
        workspaceDir: "/tmp",
        lastEvidence: null,
      }),
    ).rejects.toMatchObject({ code: "LIVE_ADAPTER_UNIMPLEMENTED" });
  });

  it("acquireRunLock detecta titular vivo", async () => {
    const { dataDir } = await tempController();
    const runId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    await acquireRunLock(dataDir, runId, "a", 1);
    await expect(acquireRunLock(dataDir, runId, "b", 2)).rejects.toMatchObject({
      code: "CONCURRENT_EXECUTION",
    });
  });
});
