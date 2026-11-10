import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { lockPath } from "./persist.ts";
import { ControllerError } from "./types.ts";

export interface LockRecord {
  holderId: string;
  pid: number;
  acquiredAtMs: number;
}

function pidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function acquireRunLock(
  dataDir: string,
  runId: string,
  holderId: string,
  nowMs: number,
): Promise<LockRecord> {
  const file = lockPath(dataDir, runId);
  await mkdir(dirname(file), { recursive: true });
  const record: LockRecord = { holderId, pid: process.pid, acquiredAtMs: nowMs };
  try {
    await writeFile(file, `${JSON.stringify(record)}\n`, { flag: "wx" });
    return record;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") {
      throw new ControllerError("LOCK_IO", "falha ao criar lock");
    }
    let existing: LockRecord | null = null;
    try {
      existing = JSON.parse(await readFile(file, "utf8")) as LockRecord;
    } catch {
      throw new ControllerError(
        "CORRUPT_LOCK",
        "arquivo de lock ilegível — fail-closed",
      );
    }
    if (pidAlive(existing.pid)) {
      throw new ControllerError(
        "CONCURRENT_EXECUTION",
        `run ${runId} já está em execução (pid ${existing.pid})`,
      );
    }
    throw new ControllerError(
      "STALE_LOCK",
      `lock órfão (pid ${existing.pid} morto). Use force-unlock e depois step. Crash ≠ interrupt. Janela: processo morreu após criar o lock e antes de removê-lo.`,
    );
  }
}

export async function releaseRunLock(
  dataDir: string,
  runId: string,
  holderId: string,
): Promise<void> {
  const file = lockPath(dataDir, runId);
  try {
    const existing = JSON.parse(await readFile(file, "utf8")) as LockRecord;
    if (existing.holderId !== holderId) {
      throw new ControllerError(
        "LOCK_HOLDER_MISMATCH",
        "tentativa de liberar lock de outro holder — fail-closed",
      );
    }
  } catch (error) {
    if (error instanceof ControllerError) throw error;
    return;
  }
  await unlink(file);
}

export async function forceUnlock(dataDir: string, runId: string): Promise<void> {
  const file = lockPath(dataDir, runId);
  try {
    await unlink(file);
  } catch {
    // none
  }
}
