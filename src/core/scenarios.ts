import type { Budget, ScenarioId } from "./types.ts";

export interface ScenarioDefinition {
  id: ScenarioId;
  title: string;
  description: string;
  budgets: Budget;
}

export const DEFAULT_BUDGETS: Budget = {
  maxRetries: 3,
  maxIterations: 8,
  maxGlobalSteps: 40,
  maxWallClockMs: 60_000,
  maxCalls: 40,
};

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  success: {
    id: "success",
    title: "Caminho feliz",
    description:
      "Implementação correta na primeira tentativa; verificação passa; revisão e aprovação humana encerram.",
    budgets: { ...DEFAULT_BUDGETS },
  },
  "verification-repair": {
    id: "verification-repair",
    title: "Falha de verificação e reparo",
    description:
      "Primeira implementação ignora inStock; o runner falha; o controlador devolve à implementação; o segundo attempt passa.",
    budgets: { ...DEFAULT_BUDGETS, maxRetries: 3 },
  },
  "retry-exhaustion": {
    id: "retry-exhaustion",
    title: "Esgotamento de retries",
    description:
      "Toda implementação permanece incorreta até maxRetries; status terminal exhausted.",
    budgets: { ...DEFAULT_BUDGETS, maxRetries: 2, maxIterations: 4 },
  },
  "budget-steps": {
    id: "budget-steps",
    title: "Orçamento de passos globais",
    description: "maxGlobalSteps baixo; a run encerra em exhausted por passos.",
    budgets: { ...DEFAULT_BUDGETS, maxGlobalSteps: 1 },
  },
  "budget-calls": {
    id: "budget-calls",
    title: "Orçamento de chamadas",
    description: "maxCalls=0; nenhuma invocação de harness é permitida.",
    budgets: { ...DEFAULT_BUDGETS, maxCalls: 0 },
  },
  "budget-time": {
    id: "budget-time",
    title: "Orçamento de tempo",
    description: "maxWallClockMs=0; relógio injetável nos testes.",
    budgets: { ...DEFAULT_BUDGETS, maxWallClockMs: 0 },
  },
  "model-approval-ignored": {
    id: "model-approval-ignored",
    title: "Texto do modelo não aprova",
    description:
      "O harness devolve claimedHumanApproval; o controlador ignora e mantém o gate humano.",
    budgets: { ...DEFAULT_BUDGETS },
  },
  "cancel-mid-run": {
    id: "cancel-mid-run",
    title: "Cancelamento",
    description: "Mesmo comportamento do caminho feliz, para cancelar no meio.",
    budgets: { ...DEFAULT_BUDGETS },
  },
};

export function listScenarios(): ScenarioDefinition[] {
  return Object.values(SCENARIOS);
}
