import type {
  ImplementationArtifact,
  PlanArtifact,
  ReviewArtifact,
  SpecArtifact,
  ValidationIssue,
  VerificationEvidence,
} from "./types.ts";

export type ContractResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

function issues(...items: ValidationIssue[]): ContractResult<never> {
  return { ok: false, issues: items };
}

function reqString(
  value: unknown,
  path: string,
  issuesOut: ValidationIssue[],
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    issuesOut.push({
      path,
      code: "REQUIRED_STRING",
      message: `${path} deve ser uma string não vazia`,
    });
    return "";
  }
  return value;
}

function reqStringArray(
  value: unknown,
  path: string,
  issuesOut: ValidationIssue[],
  min = 1,
): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    issuesOut.push({
      path,
      code: "REQUIRED_STRING_ARRAY",
      message: `${path} deve ser um array de strings`,
    });
    return [];
  }
  if (value.length < min) {
    issuesOut.push({
      path,
      code: "MIN_ITEMS",
      message: `${path} precisa de pelo menos ${min} item(ns)`,
    });
  }
  return value as string[];
}

export function validateSpec(raw: unknown): ContractResult<SpecArtifact> {
  if (!raw || typeof raw !== "object") {
    return issues({
      path: "$",
      code: "NOT_OBJECT",
      message: "spec precisa ser um objeto",
    });
  }
  const obj = raw as Record<string, unknown>;
  const found: ValidationIssue[] = [];
  if (obj.kind !== "spec") {
    found.push({
      path: "kind",
      code: "KIND",
      message: 'kind deve ser "spec"',
    });
  }
  const goal = reqString(obj.goal, "goal", found);
  const acceptanceCriteria = reqStringArray(
    obj.acceptanceCriteria,
    "acceptanceCriteria",
    found,
    3,
  );
  const outOfScope = reqStringArray(obj.outOfScope, "outOfScope", found, 1);
  const fixturesRef = reqString(obj.fixturesRef, "fixturesRef", found);
  if (fixturesRef && fixturesRef !== "fixtures/products.json") {
    found.push({
      path: "fixturesRef",
      code: "FIXTURES_REF",
      message: "fixturesRef deve apontar para fixtures/products.json",
    });
  }
  if (found.length > 0) return { ok: false, issues: found };
  return {
    ok: true,
    value: {
      kind: "spec",
      goal,
      acceptanceCriteria,
      outOfScope,
      fixturesRef,
    },
  };
}

export function validatePlan(raw: unknown): ContractResult<PlanArtifact> {
  if (!raw || typeof raw !== "object") {
    return issues({
      path: "$",
      code: "NOT_OBJECT",
      message: "plan precisa ser um objeto",
    });
  }
  const obj = raw as Record<string, unknown>;
  const found: ValidationIssue[] = [];
  if (obj.kind !== "plan") {
    found.push({ path: "kind", code: "KIND", message: 'kind deve ser "plan"' });
  }
  const steps = reqStringArray(obj.steps, "steps", found, 3);
  const verificationStrategy = reqString(
    obj.verificationStrategy,
    "verificationStrategy",
    found,
  );
  const rollbackNote = reqString(obj.rollbackNote, "rollbackNote", found);
  if (found.length > 0) return { ok: false, issues: found };
  return {
    ok: true,
    value: { kind: "plan", steps, verificationStrategy, rollbackNote },
  };
}

export function validateImplementation(
  raw: unknown,
): ContractResult<ImplementationArtifact> {
  if (!raw || typeof raw !== "object") {
    return issues({
      path: "$",
      code: "NOT_OBJECT",
      message: "implementation precisa ser um objeto",
    });
  }
  const obj = raw as Record<string, unknown>;
  const found: ValidationIssue[] = [];
  if (obj.kind !== "implementation") {
    found.push({
      path: "kind",
      code: "KIND",
      message: 'kind deve ser "implementation"',
    });
  }
  const sourceRelPath = reqString(obj.sourceRelPath, "sourceRelPath", found);
  if (sourceRelPath && sourceRelPath !== "filters.mjs") {
    found.push({
      path: "sourceRelPath",
      code: "SOURCE_PATH",
      message: "sourceRelPath deve ser filters.mjs",
    });
  }
  const notes = reqString(obj.notes, "notes", found);
  if (found.length > 0) return { ok: false, issues: found };
  return {
    ok: true,
    value: { kind: "implementation", sourceRelPath, notes },
  };
}

export function validateReview(raw: unknown): ContractResult<ReviewArtifact> {
  if (!raw || typeof raw !== "object") {
    return issues({
      path: "$",
      code: "NOT_OBJECT",
      message: "review precisa ser um objeto",
    });
  }
  const obj = raw as Record<string, unknown>;
  const found: ValidationIssue[] = [];
  if (obj.kind !== "review") {
    found.push({
      path: "kind",
      code: "KIND",
      message: 'kind deve ser "review"',
    });
  }
  const findings = reqStringArray(obj.findings, "findings", found, 0);
  const scopeCheck = reqString(obj.scopeCheck, "scopeCheck", found);
  if (found.length > 0) return { ok: false, issues: found };
  return { ok: true, value: { kind: "review", findings, scopeCheck } };
}

export function validateVerificationEvidence(
  raw: unknown,
): ContractResult<VerificationEvidence> {
  if (!raw || typeof raw !== "object") {
    return issues({
      path: "$",
      code: "NOT_OBJECT",
      message: "evidence precisa ser um objeto",
    });
  }
  const obj = raw as Record<string, unknown>;
  const found: ValidationIssue[] = [];
  if (obj.kind !== "verification") {
    found.push({
      path: "kind",
      code: "KIND",
      message: 'kind deve ser "verification"',
    });
  }
  if (typeof obj.exitCode !== "number") {
    found.push({
      path: "exitCode",
      code: "EXIT_CODE",
      message: "exitCode numérico é obrigatório",
    });
  }
  if (typeof obj.stdout !== "string" || typeof obj.stderr !== "string") {
    found.push({
      path: "stdio",
      code: "STDIO",
      message: "stdout e stderr devem ser strings",
    });
  }
  if (!Array.isArray(obj.argv)) {
    found.push({
      path: "argv",
      code: "ARGV",
      message: "argv deve ser um array (processo fixo, sem shell genérico)",
    });
  }
  if (typeof obj.passed !== "boolean") {
    found.push({
      path: "passed",
      code: "PASSED",
      message: "passed booleano é obrigatório",
    });
  }
  if (found.length > 0) return { ok: false, issues: found };
  return {
    ok: true,
    value: {
      kind: "verification",
      exitCode: obj.exitCode as number,
      stdout: obj.stdout as string,
      stderr: obj.stderr as string,
      argv: obj.argv as string[],
      durationMs: typeof obj.durationMs === "number" ? obj.durationMs : 0,
      passed: obj.passed as boolean,
    },
  };
}

export const PHASE_ENTRY = {
  spec: "workspace vazio de artefatos de fase; fixtures locais disponíveis",
  plan: "spec validada e gate humano spec-approval concedido pelo controlador",
  implementation:
    "plan validado e gate humano plan-approval concedido pelo controlador",
  verification:
    "arquivo filters.mjs presente no workspace da run (não basta o modelo afirmar)",
  review:
    "evidência de verificação com exitCode 0 e passed=true produzida pelo runner",
} as const;

export const PHASE_EXIT = {
  spec: "SpecArtifact válido (goal, 3+ critérios, outOfScope, fixturesRef)",
  plan: "PlanArtifact válido (3+ steps, verificationStrategy, rollbackNote)",
  implementation: "ImplementationArtifact + filters.mjs gravado no workspace",
  verification:
    "VerificationEvidence com stdout/stderr/exitCode reais do verify-runner",
  review: "ReviewArtifact válido; conclusão exige gate humano complete-approval",
} as const;
