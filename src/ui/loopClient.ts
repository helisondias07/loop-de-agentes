import type { RunSummary } from "../core/types.ts";
import { listScenarios } from "../core/scenarios.ts";

export interface LoopView {
  banner: string;
  run: RunSummary | null;
  traces: unknown[];
  scenarios?: ReturnType<typeof listScenarios>;
  error?: string;
  message?: string;
}

export interface LoopClient {
  meta(): Promise<LoopView>;
  current(): Promise<LoopView>;
  start(scenarioId: string): Promise<LoopView>;
  step(): Promise<LoopView>;
  untilGate(): Promise<LoopView>;
  approve(gateId: string): Promise<LoopView>;
  reject(gateId: string): Promise<LoopView>;
  cancel(): Promise<LoopView>;
  interrupt(): Promise<LoopView>;
  resume(): Promise<LoopView>;
  reset(): Promise<LoopView>;
}
