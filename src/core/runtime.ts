import type { PersistedRun, VerificationEvidence, WorkspaceIO } from "./types.ts";
export type { WorkspaceIO };

export interface LoopRuntime {
  load(runId: string): Promise<PersistedRun>;
  save(run: PersistedRun): Promise<void>;
  appendTrace(line: Record<string, unknown>): Promise<void>;
  readTraces(runId: string): Promise<unknown[]>;
  ensureWorkspace(runId: string): Promise<void>;
  workspace(runId: string): WorkspaceIO;
  workspaceLabel(runId: string): string;
  statePath?(runId: string): string;
  getPointer(): Promise<string | null>;
  setPointer(runId: string | null): Promise<void>;
  clearAll(): Promise<void>;
  verify(runId: string): Promise<VerificationEvidence>;
  acquireLock(runId: string, holderId: string, nowMs: number): Promise<void>;
  releaseLock(runId: string, holderId: string): Promise<void>;
  forceUnlock(runId: string): Promise<void>;
}
