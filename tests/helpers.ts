import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createController } from "../src/core/factory.ts";
import type { WorkflowController } from "../src/core/controller.ts";
import type { RunSummary, ScenarioId } from "../src/core/types.ts";

export async function tempController() {
  const dataDir = await mkdtemp(join(tmpdir(), "loop-de-agentes-"));
  const controller = createController({ dataDir });
  return { dataDir, controller };
}

export async function driveUntilStatus(
  controller: WorkflowController,
  runId: string,
  statuses: string[],
  max = 40,
): Promise<RunSummary> {
  let state = await controller.current(runId);
  for (let i = 0; i < max; i += 1) {
    if (statuses.includes(state.status)) return state;
    if (state.status === "awaiting_human" && state.pendingGate) {
      state = await controller.approve(runId, state.pendingGate.id);
      continue;
    }
    if (state.status === "running" || state.status === "idle") {
      state = await controller.runUntilGate(runId);
      continue;
    }
    return state;
  }
  throw new Error(`não atingiu ${statuses.join(",")} (último=${state.status})`);
}

export async function startScenario(
  controller: WorkflowController,
  scenario: ScenarioId,
): Promise<RunSummary> {
  const started = await controller.start(scenario);
  return controller.runUntilGate(started.runId);
}
