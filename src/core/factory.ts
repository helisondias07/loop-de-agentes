import { systemClock } from "./clock.ts";
import { WorkflowController, type ControllerOptions } from "./controller.ts";
import { DeterministicHarness } from "../harness/deterministic.ts";
import type { AgentAdapter, Clock } from "./types.ts";

export function createController(opts: {
  dataDir: string;
  harness?: AgentAdapter;
  clock?: Clock;
}): WorkflowController {
  const options: ControllerOptions = {
    dataDir: opts.dataDir,
    harness: opts.harness ?? new DeterministicHarness(),
    clock: opts.clock ?? systemClock,
  };
  return new WorkflowController(options);
}
