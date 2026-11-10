import { assertRunId } from "./runId.ts";
import { parsePersistedRun, withChecksum } from "./persist-codec.ts";
import { ControllerError, type PersistedRun } from "./types.ts";
import { verifyFilterSource } from "../task/in-page-verify.ts";
import type { LoopRuntime, WorkspaceIO } from "./runtime.ts";

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

const PREFIX = "loop-de-agentes:v1:";

/**
 * Persistência em mapa/localStorage. Escolha: localStorage no demo estático
 * porque o estado é JSON pequeno (run + traces + filters.mjs), é síncrono,
 * inspecionável no DevTools e sobrevive a reload no mesmo origin. IndexedDB
 * seria melhor para blobs grandes; aqui não há blobs.
 */
export class KeyValueRuntime implements LoopRuntime {
  constructor(private readonly kv: KeyValue) {}

  private k(part: string): string {
    return `${PREFIX}${part}`;
  }

  async load(runId: string): Promise<PersistedRun> {
    assertRunId(runId);
    const raw = this.kv.getItem(this.k(`run:${runId}`));
    if (!raw) {
      throw new ControllerError("MISSING_STATE", `estado não encontrado: ${runId}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ControllerError("CORRUPT_STATE", "JSON de estado ilegível");
    }
    return parsePersistedRun(parsed, runId);
  }

  async save(run: PersistedRun): Promise<void> {
    const stamped = withChecksum({ ...run, checksum: "" });
    this.kv.setItem(this.k(`run:${run.runId}`), JSON.stringify(stamped));
  }

  async appendTrace(line: Record<string, unknown>): Promise<void> {
    const key = this.k(`traces:${line.runId as string}`);
    const prev = this.kv.getItem(key) ?? "";
    this.kv.setItem(key, `${prev}${JSON.stringify(line)}\n`);
  }

  async readTraces(runId: string): Promise<unknown[]> {
    const text = this.kv.getItem(this.k(`traces:${runId}`)) ?? "";
    return text
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as unknown);
  }

  async ensureWorkspace(_runId: string): Promise<void> {
    // no-op: ficheiros virtuais
  }

  workspace(runId: string): WorkspaceIO {
    return {
      write: async (relPath, contents) => {
        this.kv.setItem(this.k(`ws:${runId}:${relPath}`), contents);
      },
      read: async (relPath) => this.kv.getItem(this.k(`ws:${runId}:${relPath}`)),
    };
  }

  workspaceLabel(runId: string): string {
    return `localStorage:${runId}`;
  }

  async getPointer(): Promise<string | null> {
    const value = this.kv.getItem(this.k("pointer"));
    return value && value.length > 0 ? value : null;
  }

  async setPointer(runId: string | null): Promise<void> {
    if (runId) this.kv.setItem(this.k("pointer"), assertRunId(runId));
    else this.kv.removeItem(this.k("pointer"));
  }

  async clearAll(): Promise<void> {
    const keys: string[] = [];
    for (let i = 0; i < this.kv.length; i += 1) {
      const key = this.kv.key(i);
      if (key && key.startsWith(PREFIX)) keys.push(key);
    }
    for (const key of keys) this.kv.removeItem(key);
  }

  async verify(runId: string) {
    const source = await this.workspace(runId).read("filters.mjs");
    if (!source) {
      return {
        kind: "verification" as const,
        exitCode: 2,
        stdout: "",
        stderr: "filters.mjs ausente no armazenamento local\n",
        argv: ["in-browser-catalog-check", "filters.mjs"],
        durationMs: 0,
        passed: false,
      };
    }
    return verifyFilterSource(source);
  }

  async acquireLock(runId: string, holderId: string, nowMs: number): Promise<void> {
    const key = this.k(`lock:${runId}`);
    const existing = this.kv.getItem(key);
    if (existing) {
      throw new ControllerError(
        "CONCURRENT_EXECUTION",
        "execução concorrente no armazenamento local",
      );
    }
    this.kv.setItem(key, JSON.stringify({ holderId, acquiredAtMs: nowMs }));
  }

  async releaseLock(runId: string, holderId: string): Promise<void> {
    const key = this.k(`lock:${runId}`);
    const raw = this.kv.getItem(key);
    if (!raw) return;
    try {
      const rec = JSON.parse(raw) as { holderId: string };
      if (rec.holderId !== holderId) {
        throw new ControllerError("LOCK_HOLDER_MISMATCH", "lock de outro holder");
      }
    } catch (error) {
      if (error instanceof ControllerError) throw error;
    }
    this.kv.removeItem(key);
  }

  async forceUnlock(runId: string): Promise<void> {
    this.kv.removeItem(this.k(`lock:${runId}`));
  }
}

export class MemoryKeyValue implements KeyValue {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  get length(): number {
    return this.map.size;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
}
