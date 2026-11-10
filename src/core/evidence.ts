import {
  IN_BROWSER_EXIT_NOTE,
  IN_BROWSER_RUNNER,
  NODE_PROCESS_RUNNER,
  type VerificationEvidence,
} from "./types.ts";

export function nodeProcessEvidence(input: {
  exitCode: number;
  stdout: string;
  stderr: string;
  argv: string[];
  durationMs: number;
  passed: boolean;
}): VerificationEvidence {
  return {
    kind: "verification",
    runner: NODE_PROCESS_RUNNER,
    exitCode: input.exitCode,
    stdout: input.stdout,
    stderr: input.stderr,
    argv: input.argv,
    durationMs: input.durationMs,
    passed: input.passed,
  };
}

export function inBrowserEvidence(input: {
  simulatedExitCode: number;
  stdout: string;
  stderr: string;
  argv: string[];
  durationMs: number;
  passed: boolean;
}): VerificationEvidence {
  return {
    kind: "verification",
    runner: IN_BROWSER_RUNNER,
    simulatedExitCode: input.simulatedExitCode,
    honestyNote: IN_BROWSER_EXIT_NOTE,
    stdout: input.stdout,
    stderr: input.stderr,
    argv: input.argv,
    durationMs: input.durationMs,
    passed: input.passed,
  };
}

export function formatEvidence(ev: VerificationEvidence): string {
  if (ev.runner === IN_BROWSER_RUNNER) {
    return [
      `runner=${ev.runner}`,
      `simulatedExitCode=${ev.simulatedExitCode}`,
      ev.honestyNote,
      `passed=${ev.passed}`,
      `argv=${ev.argv.join(" ")}`,
      "--- stdout ---",
      ev.stdout,
      "--- stderr ---",
      ev.stderr,
    ].join("\n");
  }
  return [
    `runner=${ev.runner}`,
    `exitCode=${ev.exitCode} (processo real, spawnSync)`,
    `passed=${ev.passed}`,
    `argv=${ev.argv.join(" ")}`,
    "--- stdout ---",
    ev.stdout,
    "--- stderr ---",
    ev.stderr,
  ].join("\n");
}

export function evidenceTracePayload(ev: VerificationEvidence): Record<string, unknown> {
  const base = {
    runner: ev.runner,
    passed: ev.passed,
    stdoutHead: ev.stdout.slice(0, 500),
    stderrHead: ev.stderr.slice(0, 500),
  };
  if (ev.runner === IN_BROWSER_RUNNER) {
    return {
      ...base,
      simulatedExitCode: ev.simulatedExitCode,
      honestyNote: ev.honestyNote,
    };
  }
  return { ...base, exitCode: ev.exitCode };
}
