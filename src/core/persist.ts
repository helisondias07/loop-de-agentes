import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sha256Json } from "./checksum.ts";
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

export function runDir(dataDir: string, runId: string): string {
  return join(dataDir, "runs", runId);
}

export function statePath(dataDir: string, runId: string): string {
  return join(runDir(dataDir, runId), "state.json");
}

export function lockPath(dataDir: string, runId: string): string {
  return join(runDir(dataDir, runId), "run.lock");
}

export function tracesPath(dataDir: string, runId: string): string {
  return join(runDir(dataDir, runId), "traces.jsonl");
}

export function workspacePath(dataDir: string, runId: string): string {
  return join(runDir(dataDir, runId), "workspace");
}

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
  if (typeof obj.runId !== "string" || obj.runId.length < 8) {
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

export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(tmp, payload, "utf8");
  await rename(tmp, filePath);
}

/**
 * Janela de crash: se o processo morrer após writeFile(tmp) e antes de rename,
 * o estado anterior permanece (POSIX rename é atômico no mesmo filesystem).
 * Se morrer após rename e antes de atualizar traces, o estado é a fonte da
 * verdade e o próximo passo reabre o mesmo phase/attempt de forma idempotente.
 */
export async function saveRun(dataDir: string, run: PersistedRun): Promise<void> {
  const stamped = withChecksum({ ...run, checksum: "" });
  await atomicWriteJson(statePath(dataDir, run.runId), stamped);
}

export async function loadRun(
  dataDir: string,
  runId: string,
): Promise<PersistedRun> {
  let text: string;
  try {
    text = await readFile(statePath(dataDir, runId), "utf8");
  } catch {
    throw new ControllerError("MISSING_STATE", `estado não encontrado: ${runId}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ControllerError("CORRUPT_STATE", "JSON de estado ilegível");
  }
  return parsePersistedRun(parsed, runId);
}

export async function appendTrace(
  dataDir: string,
  line: Record<string, unknown>,
): Promise<void> {
  const file = tracesPath(dataDir, line.runId as string);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(line)}\n`, { encoding: "utf8", flag: "a" });
}

export async function readTraces(dataDir: string, runId: string): Promise<unknown[]> {
  try {
    const text = await readFile(tracesPath(dataDir, runId), "utf8");
    return text
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as unknown);
  } catch {
    return [];
  }
}

export async function removeLockFile(dataDir: string, runId: string): Promise<void> {
  try {
    await unlink(lockPath(dataDir, runId));
  } catch {
    // already gone
  }
}
