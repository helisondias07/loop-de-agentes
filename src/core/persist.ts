import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parsePersistedRun, withChecksum } from "./persist-codec.ts";
import { assertRunId } from "./runId.ts";
import { ControllerError, type PersistedRun } from "./types.ts";

export { parsePersistedRun, withChecksum } from "./persist-codec.ts";

export function runDir(dataDir: string, runId: string): string {
  return join(dataDir, "runs", assertRunId(runId));
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

export async function writePointer(dataDir: string, runId: string): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    join(dataDir, "current.json"),
    `${JSON.stringify({ runId: assertRunId(runId) })}\n`,
  );
}
