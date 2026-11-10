import { ControllerError } from "./types.ts";

export interface KvStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const KV_PREFIX = "loop-de-agentes:v1:";
/** Lease curto: crash de tab não deixa lock eterno; não é wx de ficheiro. */
export const KV_LOCK_TTL_MS = 15_000;

export interface KvLockRecord {
  holderId: string;
  acquiredAtMs: number;
  expiresAtMs: number;
}

export function kvLockKey(runId: string): string {
  return `${KV_PREFIX}lock:${runId}`;
}

function readLock(kv: KvStore, key: string): KvLockRecord | null {
  const raw = kv.getItem(key);
  if (!raw) return null;
  try {
    const rec = JSON.parse(raw) as KvLockRecord;
    if (
      typeof rec.holderId !== "string" ||
      typeof rec.acquiredAtMs !== "number" ||
      typeof rec.expiresAtMs !== "number"
    ) {
      throw new ControllerError("CORRUPT_LOCK", "lease localStorage ilegível — fail-closed");
    }
    return rec;
  } catch (error) {
    if (error instanceof ControllerError) throw error;
    throw new ControllerError("CORRUPT_LOCK", "lease localStorage ilegível — fail-closed");
  }
}

export function acquireKvLock(
  kv: KvStore,
  runId: string,
  holderId: string,
  nowMs: number,
  ttlMs: number = KV_LOCK_TTL_MS,
): void {
  const key = kvLockKey(runId);
  const existing = readLock(kv, key);
  if (existing && existing.expiresAtMs > nowMs && existing.holderId !== holderId) {
    throw new ControllerError(
      "CONCURRENT_EXECUTION",
      `lock ativo noutro contexto (lease localStorage até ${existing.expiresAtMs})`,
    );
  }
  const record: KvLockRecord = {
    holderId,
    acquiredAtMs: nowMs,
    expiresAtMs: nowMs + ttlMs,
  };
  kv.setItem(key, JSON.stringify(record));
  const confirm = readLock(kv, key);
  if (!confirm || confirm.holderId !== holderId) {
    throw new ControllerError(
      "CONCURRENT_EXECUTION",
      "perdeu a corrida do lease localStorage",
    );
  }
}

export function releaseKvLock(kv: KvStore, runId: string, holderId: string): void {
  const key = kvLockKey(runId);
  const existing = readLock(kv, key);
  if (!existing) return;
  if (existing.holderId !== holderId) {
    throw new ControllerError(
      "LOCK_HOLDER_MISMATCH",
      "tentativa de liberar lock de outro holder — fail-closed",
    );
  }
  kv.removeItem(key);
}

export function forceUnlockKv(kv: KvStore, runId: string): void {
  kv.removeItem(kvLockKey(runId));
}
