import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { VerificationEvidence } from "../core/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
export const VERIFY_RUNNER = join(here, "verify-runner.mjs");
export const PRODUCT_FIXTURES = join(here, "fixtures", "products.json");

export function runVerification(
  filtersAbsPath: string,
  fixturesAbsPath = PRODUCT_FIXTURES,
): VerificationEvidence {
  const argv = [
    process.execPath,
    VERIFY_RUNNER,
    "--filters",
    filtersAbsPath,
    "--fixtures",
    fixturesAbsPath,
  ];
  if (!existsSync(filtersAbsPath)) {
    return {
      kind: "verification",
      exitCode: 2,
      stdout: "",
      stderr: `filters ausente: ${filtersAbsPath}\n`,
      argv,
      durationMs: 0,
      passed: false,
    };
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
  const passed = exitCode === 0 && stdout.includes('"ok": true');
  return {
    kind: "verification",
    exitCode,
    stdout,
    stderr,
    argv,
    durationMs,
    passed,
  };
}
