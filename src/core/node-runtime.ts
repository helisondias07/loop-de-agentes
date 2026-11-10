import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { acquireRunLock, forceUnlock, releaseRunLock } from "./lock.ts";
import {
  appendTrace,
  loadRun,
  readTraces,
  saveRun,
  statePath,
  workspacePath,
} from "./persist.ts";
import { assertRunId } from "./runId.ts";
import type { LoopRuntime } from "./runtime.ts";
import { PRODUCT_FIXTURES, runVerification } from "../task/verify.ts";
import type { PersistedRun } from "./types.ts";

export function createNodeRuntime(dataDir: string): LoopRuntime {
  return {
    load: (runId) => loadRun(dataDir, runId),
    save: (run: PersistedRun) => saveRun(dataDir, run),
    appendTrace: (line) => appendTrace(dataDir, line),
    readTraces: (runId) => readTraces(dataDir, runId),
    ensureWorkspace: async (runId) => {
      await mkdir(workspacePath(dataDir, runId), { recursive: true });
    },
    workspace: (runId) => ({
      write: async (relPath, contents) => {
        const dir = workspacePath(dataDir, runId);
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, relPath), contents, "utf8");
      },
      read: async (relPath) => {
        const { readFile } = await import("node:fs/promises");
        try {
          return await readFile(join(workspacePath(dataDir, runId), relPath), "utf8");
        } catch {
          return null;
        }
      },
    }),
    workspaceLabel: (runId) => workspacePath(dataDir, runId),
    statePath: (runId) => statePath(dataDir, runId),
    getPointer: async () => {
      const { readFile } = await import("node:fs/promises");
      try {
        const raw = JSON.parse(
          await readFile(join(dataDir, "current.json"), "utf8"),
        ) as { runId?: string | null };
        return typeof raw.runId === "string" ? assertRunId(raw.runId) : null;
      } catch {
        return null;
      }
    },
    setPointer: async (runId) => {
      await mkdir(dataDir, { recursive: true });
      await writeFile(
        join(dataDir, "current.json"),
        `${JSON.stringify({ runId })}\n`,
      );
    },
    clearAll: async () => {
      await mkdir(dataDir, { recursive: true });
      await writeFile(join(dataDir, "current.json"), `${JSON.stringify({ runId: null })}\n`);
    },
    verify: async (runId) => {
      const dir = workspacePath(dataDir, runId);
      return runVerification(join(dir, "filters.mjs"), {
        workspaceDir: dir,
        fixturesAbsPath: PRODUCT_FIXTURES,
      });
    },
    acquireLock: (runId, holderId, nowMs) =>
      acquireRunLock(dataDir, runId, holderId, nowMs).then(() => undefined),
    releaseLock: (runId, holderId) => releaseRunLock(dataDir, runId, holderId),
    forceUnlock: (runId) => forceUnlock(dataDir, runId),
  };
}
