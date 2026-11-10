import { sha256Json } from "./checksum.ts";
import { assertRunId } from "./runId.ts";
import { ControllerError, SCHEMA_VERSION, type PersistedRun } from "./types.ts";

const ALLOWED_STATUS = new Set([
  "idle",
  "running",
  "awaiting_human",
  "completed",
  "cancelled",
  "exhausted",
  "failed_closed",
  "interrupted",
]);

const ALLOWED_PHASE = new Set([
  "spec",
  "plan",
  "implementation",
  "verification",
  "review",
]);

export function withChecksum(
  run: Omit<PersistedRun, "checksum"> & { checksum?: string },
): PersistedRun {
  const { checksum: _ignored, ...rest } = run;
  const checksum = sha256Json(rest);
  return { ...(rest as Omit<PersistedRun, "checksum">), checksum };
}

export function parsePersistedRun(raw: unknown, expectedRunId?: string): PersistedRun {
  if (!raw || typeof raw !== "object") {
    throw new ControllerError(
      "CORRUPT_STATE",
      "Estado persistido não é um objeto JSON",
    );
  }
  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== SCHEMA_VERSION) {
    throw new ControllerError(
      "SCHEMA_MISMATCH",
      `schemaVersion incompatível: ${String(obj.schemaVersion)}`,
    );
  }
  if (typeof obj.checksum !== "string" || obj.checksum.length !== 64) {
    throw new ControllerError("CORRUPT_STATE", "checksum ausente ou inválido");
  }
  if (typeof obj.runId !== "string") {
    throw new ControllerError("CORRUPT_STATE", "runId inválido");
  }
  try {
    assertRunId(obj.runId);
  } catch {
    throw new ControllerError("CORRUPT_STATE", "runId inválido");
  }
  if (expectedRunId && obj.runId !== expectedRunId) {
    throw new ControllerError(
      "STATE_MISMATCH",
      `runId persistido ${obj.runId} difere do esperado ${expectedRunId}`,
    );
  }
  if (typeof obj.status !== "string" || !ALLOWED_STATUS.has(obj.status)) {
    throw new ControllerError("CORRUPT_STATE", "status inválido");
  }
  if (typeof obj.phase !== "string" || !ALLOWED_PHASE.has(obj.phase)) {
    throw new ControllerError("CORRUPT_STATE", "phase inválida");
  }
  const { checksum, ...rest } = obj;
  const expected = sha256Json(rest);
  if (expected !== checksum) {
    throw new ControllerError(
      "CHECKSUM_MISMATCH",
      "checksum do estado persistido não confere — fail-closed",
    );
  }
  return obj as unknown as PersistedRun;
}
