import { evaluationPassed } from "./verify-eval.ts";
import {
  EXPECTED_TEST_COUNT,
  runCatalogChecks,
  type ApplyFiltersFn,
} from "./catalog.ts";
import type { VerificationEvidence } from "../core/types.ts";

export function instantiateApplyFilters(source: string): ApplyFiltersFn {
  if (/\bimport\b|\brequire\s*\(/.test(source)) {
    throw new Error("UNSAFE_SOURCE: import/require recusados");
  }
  const body = source.replace(/export\s+/g, "");
  const factory = new Function(
    `${body}\nif (typeof applyFilters !== "function") throw new Error("applyFilters ausente");\nreturn applyFilters;`,
  );
  return factory() as ApplyFiltersFn;
}

export function verifyFilterSource(source: string): VerificationEvidence {
  const argv = ["in-browser-catalog-check", "filters.mjs", "catalog.ts"];
  const started = Date.now();
  try {
    const apply = instantiateApplyFilters(source);
    const payload = runCatalogChecks(apply);
    const stdout = `${JSON.stringify(payload, null, 2)}\n`;
    const durationMs = Date.now() - started;
    return {
      kind: "verification",
      exitCode: 0,
      stdout,
      stderr: "",
      argv,
      durationMs,
      passed: evaluationPassed(0, stdout) && payload.tested === EXPECTED_TEST_COUNT,
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    const stderr = error instanceof Error ? `${error.message}\n` : `${String(error)}\n`;
    return {
      kind: "verification",
      exitCode: 1,
      stdout: "",
      stderr,
      argv,
      durationMs,
      passed: false,
    };
  }
}
