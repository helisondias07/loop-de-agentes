import { ControllerError } from "./types.ts";

/** IDs estáticos (sem nonce). Limite documentado: replay do mesmo id na mesma run. */
export const GATE_IDS = {
  spec: "spec-approval",
  plan: "plan-approval",
  complete: "complete-approval",
} as const;

export function requireExplicitGateId(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new ControllerError(
      "GATE_REQUIRED",
      "gateId explícito é obrigatório; o servidor não infere o gate pendente",
    );
  }
  return raw.trim();
}
