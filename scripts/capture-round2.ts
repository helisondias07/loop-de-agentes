import { existsSync } from "node:fs";
import { mkdir, symlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createController } from "../src/core/factory.ts";
import { requireExplicitGateId } from "../src/core/gates.ts";
import { lockPath, workspacePath } from "../src/core/persist.ts";
import { runVerification } from "../src/task/verify.ts";
import { startScenario } from "../tests/helpers.ts";

const root = "/opt/cursor/artifacts/round2/json-traces";
await mkdir(root, { recursive: true });

async function dump(name: string, payload: unknown) {
  await writeFile(join(root, `${name}.json`), `${JSON.stringify(payload, null, 2)}\n`);
}

{
  const dataDir = join(root, "work-stale");
  const controller = createController({ dataDir });
  const started = await controller.start("success");
  const lock = lockPath(dataDir, started.runId);
  await mkdir(join(dataDir, "runs", started.runId), { recursive: true });
  await writeFile(
    lock,
    JSON.stringify({ holderId: "dead", pid: 999_999_999, acquiredAtMs: 1 }),
  );
  let stepErr: unknown;
  try {
    await controller.step(started.runId);
  } catch (error) {
    stepErr = { code: (error as { code?: string }).code, message: (error as Error).message };
  }
  const lockAfterStep = existsSync(lock);
  let resumeErr: unknown;
  try {
    await controller.resume(started.runId, { forceUnlock: true });
  } catch (error) {
    resumeErr = { code: (error as { code?: string }).code, message: (error as Error).message };
  }
  const lockAfterResume = existsSync(lock);
  await dump("stale-lock", {
    stepErr,
    resumeErr,
    lockAfterStep,
    lockAfterResume,
    note: "resume --force-unlock não apaga lock se status≠interrupted",
  });
}

{
  const dataDir = join(root, "work-approve");
  const controller = createController({ dataDir });
  const gated = await startScenario(controller, "success");
  let missing: unknown;
  try {
    requireExplicitGateId(undefined);
  } catch (error) {
    missing = { code: (error as { code?: string }).code, message: (error as Error).message };
  }
  let mismatch: unknown;
  try {
    await controller.approve(gated.runId, "complete-approval");
  } catch (error) {
    mismatch = { code: (error as { code?: string }).code, message: (error as Error).message };
  }
  const still = await controller.current(gated.runId);
  await dump("approve-without-gate", {
    missing,
    mismatch,
    stillPending: still.pendingGate,
  });
}

{
  const dataDir = join("/tmp", "loop-round2-symlink");
  await mkdir(dataDir, { recursive: true });
  const controller = createController({ dataDir });
  const gated = await startScenario(controller, "success");
  await controller.approve(gated.runId, "spec-approval");
  const plan = await controller.runUntilGate(gated.runId);
  await controller.approve(gated.runId, plan.pendingGate!.id);
  await controller.step(gated.runId);
  const ws = workspacePath(dataDir, gated.runId);
  const filters = join(ws, "filters.mjs");
  const evil = join(dataDir, "evil-filters.mjs");
  await writeFile(evil, "export function applyFilters(p){return p;}\n");
  await unlink(filters);
  await symlink(evil, filters);
  const evidence = runVerification(filters, { workspaceDir: ws });
  await dump("symlink-filters", {
    passed: evidence.passed,
    exitCode: evidence.exitCode,
    stderr: evidence.stderr,
    argv: evidence.argv,
  });
}

process.stdout.write("round2 traces ok\n");
