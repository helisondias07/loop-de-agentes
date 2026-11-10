import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createController } from "../core/factory.ts";
import { writePointer } from "../core/controller.ts";
import { SIMULATION_BANNER, type ScenarioId } from "../core/types.ts";
import { ControllerError } from "../core/types.ts";
import { CursorAgentCliAdapter } from "../harness/cursor-cli-adapter.ts";
import { assertRunId } from "../core/runId.ts";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function currentRunId(dataDir: string): Promise<string> {
  const fromArg = arg("--run");
  if (fromArg) return assertRunId(fromArg);
  const pointer = JSON.parse(await readFile(join(dataDir, "current.json"), "utf8")) as {
    runId: string;
  };
  return assertRunId(pointer.runId);
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function help(): void {
  process.stdout.write(`loop-de-agentes — ${SIMULATION_BANNER}

Uso:
  npx tsx src/cli/index.ts start --scenario success
  npx tsx src/cli/index.ts step
  npx tsx src/cli/index.ts until-gate
  npx tsx src/cli/index.ts approve --gate spec-approval
  npx tsx src/cli/index.ts reject --gate spec-approval
  npx tsx src/cli/index.ts cancel
  npx tsx src/cli/index.ts interrupt
  npx tsx src/cli/index.ts resume [--force-unlock]
  npx tsx src/cli/index.ts force-unlock
  npx tsx src/cli/index.ts status
  npx tsx src/cli/index.ts traces
  npx tsx src/cli/index.ts scenarios
  npx tsx src/cli/index.ts demo-success
  npx tsx src/cli/index.ts live-adapter-probe

Opções: --data-dir DIR (padrão .loop-runs) --run RUN_ID (UUID)

Crash vs interrupt:
  interrupt / resume  — só status=interrupted (cooperativo entre passos)
  force-unlock        — apaga run.lock órfão; NÃO muda status
  resume --force-unlock — só se já interrupted e o lock ficou órfão;
                          se o status não for interrupted, NÃO apaga o lock

Cancel/interrupt não abortam spawnSync de verificação em curso.

O adapter live do Cursor CLI é só fronteira tipada e não é executado.
`);
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "help";
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    help();
    return;
  }
  const dataDir = arg("--data-dir", ".loop-runs")!;
  await mkdir(dataDir, { recursive: true });
  const controller = createController({ dataDir });

  try {
    if (cmd === "scenarios") {
      printJson({ banner: SIMULATION_BANNER, scenarios: controller.listScenarios() });
      return;
    }
    if (cmd === "live-adapter-probe") {
      const live = new CursorAgentCliAdapter();
      try {
        await live.invoke({
          runId: "none",
          scenarioId: "success",
          phase: "spec",
          attempt: 1,
          workspaceDir: dataDir,
          lastEvidence: null,
        });
      } catch (error) {
        printJson({
          implemented: live.implemented,
          kind: live.kind,
          error: error instanceof ControllerError ? error.code : "ERROR",
          message: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    }
    if (cmd === "start") {
      const scenario = (arg("--scenario", "success") ?? "success") as ScenarioId;
      const summary = await controller.start(scenario);
      await writePointer(dataDir, summary.runId);
      printJson(summary);
      return;
    }
    if (cmd === "demo-success") {
      const started = await controller.start("success");
      await writePointer(dataDir, started.runId);
      let state = await controller.runUntilGate(started.runId);
      if (state.pendingGate) state = await controller.approve(started.runId, state.pendingGate.id);
      state = await controller.runUntilGate(started.runId);
      if (state.pendingGate) state = await controller.approve(started.runId, state.pendingGate.id);
      state = await controller.runUntilGate(started.runId);
      if (state.pendingGate) state = await controller.approve(started.runId, state.pendingGate.id);
      printJson({ banner: SIMULATION_BANNER, final: state });
      return;
    }
    const runId = await currentRunId(dataDir);
    if (cmd === "step") {
      printJson(await controller.step(runId));
      return;
    }
    if (cmd === "until-gate") {
      printJson(await controller.runUntilGate(runId));
      return;
    }
    if (cmd === "approve") {
      const gate = arg("--gate");
      if (!gate) throw new ControllerError("USAGE", "--gate é obrigatório");
      printJson(await controller.approve(runId, gate));
      return;
    }
    if (cmd === "reject") {
      const gate = arg("--gate");
      if (!gate) throw new ControllerError("USAGE", "--gate é obrigatório");
      printJson(await controller.reject(runId, gate));
      return;
    }
    if (cmd === "cancel") {
      printJson(await controller.cancel(runId));
      return;
    }
    if (cmd === "interrupt") {
      printJson(await controller.interrupt(runId));
      return;
    }
    if (cmd === "resume") {
      printJson(await controller.resume(runId, { forceUnlock: hasFlag("--force-unlock") }));
      return;
    }
    if (cmd === "force-unlock") {
      await controller.forceUnlock(runId);
      printJson({ ok: true, runId, action: "force-unlock" });
      return;
    }
    if (cmd === "status") {
      printJson(await controller.current(runId));
      return;
    }
    if (cmd === "traces") {
      printJson(await controller.traces(runId));
      return;
    }
    help();
  } catch (error) {
    const payload =
      error instanceof ControllerError
        ? { error: error.code, message: error.message, banner: SIMULATION_BANNER }
        : { error: "ERROR", message: error instanceof Error ? error.message : String(error) };
    printJson(payload);
    process.exitCode = 1;
  }
}

await main();
