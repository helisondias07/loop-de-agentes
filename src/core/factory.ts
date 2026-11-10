import { systemClock } from "./clock.ts";
import { WorkflowController } from "./controller.ts";
import { DeterministicHarness } from "../harness/deterministic.ts";
import { createNodeRuntime } from "./node-runtime.ts";
import type { AgentAdapter, Clock } from "./types.ts";
import type { LoopRuntime } from "./runtime.ts";

export function createController(opts: {
  dataDir: string;
  harness?: AgentAdapter;
  clock?: Clock;
  runtime?: LoopRuntime;
}): WorkflowController {
  return new WorkflowController({
    runtime: opts.runtime ?? createNodeRuntime(opts.dataDir),
    harness: opts.harness ?? new DeterministicHarness(),
    clock: opts.clock ?? systemClock,
  });
}
