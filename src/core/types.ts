export const SCHEMA_VERSION = 1 as const;

export type PhaseId =
  | "spec"
  | "plan"
  | "implementation"
  | "verification"
  | "review";

export type RunStatus =
  | "idle"
  | "running"
  | "awaiting_human"
  | "completed"
  | "cancelled"
  | "exhausted"
  | "failed_closed"
  | "interrupted";

export type ScenarioId =
  | "success"
  | "verification-repair"
  | "retry-exhaustion"
  | "budget-steps"
  | "budget-calls"
  | "budget-time"
  | "model-approval-ignored"
  | "cancel-mid-run";

export interface Budget {
  maxRetries: number;
  maxIterations: number;
  maxGlobalSteps: number;
  maxWallClockMs: number;
  maxCalls: number;
}

export interface HumanGate {
  id: string;
  phase: PhaseId;
  reason: string;
  createdAtMs: number;
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface SpecArtifact {
  kind: "spec";
  goal: string;
  acceptanceCriteria: string[];
  outOfScope: string[];
  fixturesRef: string;
}

export interface PlanArtifact {
  kind: "plan";
  steps: string[];
  verificationStrategy: string;
  rollbackNote: string;
}

export interface ImplementationArtifact {
  kind: "implementation";
  sourceRelPath: string;
  notes: string;
}

export interface ReviewArtifact {
  kind: "review";
  findings: string[];
  scopeCheck: string;
}

export interface VerificationEvidence {
  kind: "verification";
  exitCode: number;
  stdout: string;
  stderr: string;
  argv: string[];
  durationMs: number;
  passed: boolean;
}

export interface TraceEvent {
  tsMs: number;
  runId: string;
  event: string;
  phase: PhaseId;
  attempt: number;
  payload: Record<string, unknown>;
}

export interface PersistedRun {
  schemaVersion: typeof SCHEMA_VERSION;
  checksum: string;
  runId: string;
  scenarioId: ScenarioId;
  status: RunStatus;
  phase: PhaseId;
  attempt: number;
  iteration: number;
  globalSteps: number;
  callsUsed: number;
  startedAtMs: number;
  updatedAtMs: number;
  budgets: Budget;
  pendingGate: HumanGate | null;
  completedPhases: PhaseId[];
  artifacts: {
    spec?: SpecArtifact;
    plan?: PlanArtifact;
    implementation?: ImplementationArtifact;
    review?: ReviewArtifact;
  };
  lastEvidence: VerificationEvidence | null;
  ignoredModelClaims: string[];
  cancelRequested: boolean;
  lastError: string | null;
  terminalReason: string | null;
  implementationAttemptAtPhase: number;
}

export interface RunSummary {
  runId: string;
  scenarioId: ScenarioId;
  status: RunStatus;
  phase: PhaseId;
  attempt: number;
  iteration: number;
  globalSteps: number;
  callsUsed: number;
  budgets: Budget;
  pendingGate: HumanGate | null;
  lastEvidence: VerificationEvidence | null;
  ignoredModelClaims: string[];
  lastError: string | null;
  terminalReason: string | null;
  completedPhases: PhaseId[];
  simulationBanner: "Simulação determinística — sem chamadas a modelos";
}

export interface Clock {
  now(): number;
}

export interface AgentInvokeInput {
  runId: string;
  scenarioId: ScenarioId;
  phase: PhaseId;
  attempt: number;
  workspaceDir: string;
  spec?: SpecArtifact;
  plan?: PlanArtifact;
  lastEvidence: VerificationEvidence | null;
}

export interface AgentInvokeResult {
  text: string;
  artifacts: PersistedRun["artifacts"];
  filesWritten: string[];
  claimedHumanApproval?: unknown;
}

export interface AgentAdapter {
  readonly kind: string;
  readonly implemented: boolean;
  invoke(input: AgentInvokeInput): Promise<AgentInvokeResult>;
}

export class ControllerError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ControllerError";
    this.code = code;
  }
}

export const SIMULATION_BANNER =
  "Simulação determinística — sem chamadas a modelos" as const;

export const PHASE_ORDER: PhaseId[] = [
  "spec",
  "plan",
  "implementation",
  "verification",
  "review",
];
