import { systemClock } from "../core/clock.ts";
import { WorkflowController } from "../core/controller.ts";
import { KeyValueRuntime } from "../core/kv-store.ts";
import { DeterministicHarness } from "../harness/deterministic.ts";

export function createBrowserController(): {
  controller: WorkflowController;
  runtime: KeyValueRuntime;
} {
  const runtime = new KeyValueRuntime(window.localStorage);
  const controller = new WorkflowController({
    runtime,
    harness: new DeterministicHarness(),
    clock: systemClock,
  });
  return { controller, runtime };
}
