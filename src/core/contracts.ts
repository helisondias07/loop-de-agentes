import type {
  ImplementationArtifact,
  PlanArtifact,
  ReviewArtifact,
  SpecArtifact,
  ValidationIssue,
  VerificationEvidence,
} from "./types.ts";
import { IN_BROWSER_EXIT_NOTE } from "./types.ts";

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
  if (obj.runner !== "node-process" && obj.runner !== "in-browser") {
    found.push({
      path: "runner",
      code: "RUNNER",
      message: 'runner deve ser "node-process" ou "in-browser"',
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
  if (obj.runner === "in-browser") {
    if ("exitCode" in obj && obj.exitCode !== undefined) {
      found.push({
        path: "exitCode",
        code: "PROCESS_EXIT_FORBIDDEN",
        message: "in-browser não pode expor exitCode de processo",
      });
    }
    if (typeof obj.simulatedExitCode !== "number") {
      found.push({
        path: "simulatedExitCode",
        code: "SIMULATED_EXIT",
        message: "simulatedExitCode numérico é obrigatório no runner in-browser",
      });
    }
  }
  if (obj.runner === "node-process") {
    if (typeof obj.exitCode !== "number") {
      found.push({
        path: "exitCode",
        code: "EXIT_CODE",
        message: "exitCode numérico de processo é obrigatório no runner node-process",
      });
    }
    if ("simulatedExitCode" in obj && obj.simulatedExitCode !== undefined) {
      found.push({
        path: "simulatedExitCode",
        code: "SIMULATED_EXIT_FORBIDDEN",
        message: "node-process não usa simulatedExitCode",
      });
    }
  }
  if (found.length > 0) return { ok: false, issues: found };
  const durationMs = typeof obj.durationMs === "number" ? obj.durationMs : 0;
  const stdout = obj.stdout as string;
  const stderr = obj.stderr as string;
  const argv = obj.argv as string[];
  const passed = obj.passed as boolean;
  if (obj.runner === "in-browser") {
    return {
      ok: true,
      value: {
        kind: "verification",
        runner: "in-browser",
        simulatedExitCode: obj.simulatedExitCode as number,
        honestyNote: IN_BROWSER_EXIT_NOTE,
        stdout,
        stderr,
        argv,
        durationMs,
        passed,
      },
    };
  }
  return {
    ok: true,
    value: {
      kind: "verification",
      runner: "node-process",
      exitCode: obj.exitCode as number,
      stdout,
      stderr,
      argv,
      durationMs,
      passed,
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
    "evidência de verificação passed=true (node-process: exitCode 0; in-browser: simulatedExitCode 0)",
} as const;

export const PHASE_EXIT = {
  spec: "SpecArtifact válido (goal, 3+ critérios, outOfScope, fixturesRef)",
  plan: "PlanArtifact válido (3+ steps, verificationStrategy, rollbackNote)",
  implementation: "ImplementationArtifact + filters.mjs gravado no workspace",
  verification:
    "VerificationEvidence com runner discriminado: node-process (exitCode de spawnSync) ou in-browser (simulatedExitCode)",
  review: "ReviewArtifact válido; conclusão exige gate humano complete-approval",
} as const;
