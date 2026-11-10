import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createController } from "../src/core/factory.ts";
import { driveUntilStatus } from "../tests/helpers.ts";

const root = "/opt/cursor/artifacts/json-traces";
await mkdir(root, { recursive: true });

async function save(name: string, dataDir: string, runId: string) {
  const controller = createController({ dataDir });
  const run = await controller.current(runId);
  const traces = await controller.traces(runId);
  await writeFile(join(root, `${name}.json`), `${JSON.stringify({ run, traces }, null, 2)}\n`);
}

const successDir = join(root, "work-success");
const c1 = createController({ dataDir: successDir });
const s1 = await c1.start("success");
const d1 = await driveUntilStatus(c1, s1.runId, ["completed"]);
await save("success", successDir, d1.runId);

const repairDir = join(root, "work-repair");
const c2 = createController({ dataDir: repairDir });
const s2 = await c2.start("verification-repair");
const d2 = await driveUntilStatus(c2, s2.runId, ["completed"]);
await save("verification-repair", repairDir, d2.runId);

const exhDir = join(root, "work-exhaust");
const c3 = createController({ dataDir: exhDir });
const s3 = await c3.start("retry-exhaustion");
const d3 = await driveUntilStatus(c3, s3.runId, ["exhausted"]);
await save("retry-exhaustion", exhDir, d3.runId);

const canDir = join(root, "work-cancel");
const c4 = createController({ dataDir: canDir });
const s4 = await c4.start("cancel-mid-run");
await c4.runUntilGate(s4.runId);
const d4 = await c4.cancel(s4.runId);
await save("cancel", canDir, d4.runId);

process.stdout.write("traces captured\n");
