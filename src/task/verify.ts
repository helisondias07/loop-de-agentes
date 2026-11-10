import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { VerificationEvidence } from "../core/types.ts";
import { ControllerError } from "../core/types.ts";
import { assertRegularFileInside } from "./paths.ts";

const here = dirname(fileURLToPath(import.meta.url));
export const VERIFY_RUNNER = join(here, "verify-runner.mjs");
export const PRODUCT_FIXTURES = join(here, "fixtures", "products.json");
export const EXPECTED_TEST_COUNT = 6;

export function parseLastJsonObject(stdout: string): Record<string, unknown> | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  const tryParse = (text: string): Record<string, unknown> | null => {
    try {
      const value = JSON.parse(text) as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      return value as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  const direct = tryParse(trimmed);
  if (direct) return direct;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return tryParse(trimmed.slice(start, end + 1));
}

export function evaluationPassed(exitCode: number, stdout: string): boolean {
  if (exitCode !== 0) return false;
  const parsed = parseLastJsonObject(stdout);
  return parsed?.ok === true && parsed?.tested === EXPECTED_TEST_COUNT;
}

export function runVerification(
  filtersAbsPath: string,
  opts: { workspaceDir: string; fixturesAbsPath?: string },
): VerificationEvidence {
  const fixturesAbsPath = opts.fixturesAbsPath ?? PRODUCT_FIXTURES;
  const argv = [
    process.execPath,
    VERIFY_RUNNER,
    "--workspace",
    opts.workspaceDir,
    "--filters",
    filtersAbsPath,
    "--fixtures",
    fixturesAbsPath,
  ];
  const fail = (exitCode: number, stderr: string): VerificationEvidence => ({
    kind: "verification",
    exitCode,
    stdout: "",
    stderr,
    argv,
    durationMs: 0,
    passed: false,
  });

  if (!existsSync(filtersAbsPath)) {
    return fail(2, `filters ausente: ${filtersAbsPath}\n`);
  }
  try {
    assertRegularFileInside(filtersAbsPath, opts.workspaceDir);
    assertRegularFileInside(fixturesAbsPath, dirname(PRODUCT_FIXTURES));
    const fixturesReal = assertRegularFileInside(
      fixturesAbsPath,
      dirname(PRODUCT_FIXTURES),
    );
    const packagedReal = assertRegularFileInside(
      PRODUCT_FIXTURES,
      dirname(PRODUCT_FIXTURES),
    );
    if (fixturesReal !== packagedReal) {
      return fail(2, "UNSAFE_PATH: fixtures só o catálogo empacotado\n");
    }
  } catch (error) {
    const message =
      error instanceof ControllerError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    return fail(2, `${message}\n`);
  }

  const started = Date.now();
  const result = spawnSync(argv[0], argv.slice(1), {
    encoding: "utf8",
    timeout: 8_000,
    maxBuffer: 512_000,
    env: { ...process.env, NO_COLOR: "1" },
  });
  const durationMs = Date.now() - started;
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? (result.error ? String(result.error) : "");
  const exitCode = typeof result.status === "number" ? result.status : 1;
  return {
    kind: "verification",
    exitCode,
    stdout,
    stderr,
    argv,
    durationMs,
    passed: evaluationPassed(exitCode, stdout),
  };
}
