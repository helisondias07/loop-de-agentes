import { describe, expect, it } from "vitest";
import { validateVerificationEvidence } from "../src/core/contracts.ts";
import {
  evidenceTracePayload,
  formatEvidence,
  inBrowserEvidence,
  nodeProcessEvidence,
} from "../src/core/evidence.ts";
import { WorkflowController } from "../src/core/controller.ts";
import { systemClock } from "../src/core/clock.ts";
import {
  acquireKvLock,
  KV_LOCK_TTL_MS,
  kvLockKey,
  releaseKvLock,
} from "../src/core/kv-lock.ts";
import { KeyValueRuntime, MemoryKeyValue } from "../src/core/kv-store.ts";
import { IN_BROWSER_EXIT_NOTE, IN_BROWSER_RUNNER, NODE_PROCESS_RUNNER } from "../src/core/types.ts";
import { DeterministicHarness } from "../src/harness/deterministic.ts";
import { FILTER_SOURCE_BROKEN, FILTER_SOURCE_CORRECT } from "../src/task/filter-sources.ts";
import { verifyFilterSource } from "../src/task/in-page-verify.ts";
import { runVerification } from "../src/task/verify.ts";
import { driveUntilStatus, tempController } from "./helpers.ts";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { workspacePath } from "../src/core/persist.ts";

describe("round 4 — evidência discriminada", () => {
  it("modo Node expõe runner node-process e exitCode real, sem simulatedExitCode", async () => {
    const { controller, dataDir } = await tempController();
    const started = await controller.start("success");
    const done = await driveUntilStatus(controller, started.runId, ["completed"]);
    const ev = done.lastEvidence;
    expect(ev?.runner).toBe(NODE_PROCESS_RUNNER);
    expect(ev && "exitCode" in ev ? ev.exitCode : undefined).toBe(0);
    expect(ev && "simulatedExitCode" in ev ? ev.simulatedExitCode : undefined).toBeUndefined();
    expect(JSON.stringify(ev)).not.toContain("simulatedExitCode");
    const text = formatEvidence(ev!);
    expect(text).toContain("runner=node-process");
    expect(text).toContain("exitCode=0 (processo real, spawnSync)");
    expect(text).not.toContain(IN_BROWSER_EXIT_NOTE);
    const traces = (await controller.traces(started.runId)) as {
      event?: string;
      payload?: Record<string, unknown>;
    }[];
    const payload = traces.find((t) => t.event === "verification_evidence")?.payload;
    expect(payload?.runner).toBe(NODE_PROCESS_RUNNER);
    expect(payload?.exitCode).toBe(0);
    expect(payload?.simulatedExitCode).toBeUndefined();
    expect(payload?.honestyNote).toBeUndefined();
    const filters = join(workspacePath(dataDir, started.runId), "filters.mjs");
    await writeFile(filters, FILTER_SOURCE_CORRECT, "utf8");
    const raw = runVerification(filters, { workspaceDir: workspacePath(dataDir, started.runId) });
    expect(raw.runner).toBe(NODE_PROCESS_RUNNER);
    if (raw.runner === NODE_PROCESS_RUNNER) {
      expect(raw.exitCode).toBe(0);
    }
  });

  it("modo in-browser expõe simulatedExitCode e honestyNote, sem exitCode de processo", async () => {
    const ok = verifyFilterSource(FILTER_SOURCE_CORRECT);
    expect(ok.runner).toBe(IN_BROWSER_RUNNER);
    if (ok.runner === IN_BROWSER_RUNNER) {
      expect(ok.simulatedExitCode).toBe(0);
      expect(ok.honestyNote).toBe(IN_BROWSER_EXIT_NOTE);
    }
    expect("exitCode" in ok).toBe(false);
    expect(JSON.stringify(ok)).not.toMatch(/"exitCode"/);
    const shown = formatEvidence(ok);
    expect(shown).toContain("runner=in-browser");
    expect(shown).toContain("simulatedExitCode=0");
    expect(shown).toContain(IN_BROWSER_EXIT_NOTE);
    expect(shown).not.toMatch(/^exitCode=/m);
    const bad = verifyFilterSource(FILTER_SOURCE_BROKEN);
    expect(bad.runner).toBe(IN_BROWSER_RUNNER);
    if (bad.runner === IN_BROWSER_RUNNER) {
      expect(bad.simulatedExitCode).not.toBe(0);
    }
    expect("exitCode" in bad).toBe(false);
    const runtime = new KeyValueRuntime(new MemoryKeyValue());
    const controller = new WorkflowController({
      runtime,
      harness: new DeterministicHarness(),
      clock: systemClock,
    });
    const started = await controller.start("success");
    const done = await driveUntilStatus(controller, started.runId, ["completed"]);
    expect(done.lastEvidence?.runner).toBe(IN_BROWSER_RUNNER);
    expect(done.lastEvidence && "simulatedExitCode" in done.lastEvidence).toBe(true);
    expect(JSON.stringify(done.lastEvidence)).not.toMatch(/"exitCode"/);
    const traces = (await controller.traces(started.runId)) as {
      event?: string;
      payload?: Record<string, unknown>;
    }[];
    const payload = traces.find((t) => t.event === "verification_evidence")?.payload;
    expect(payload?.runner).toBe(IN_BROWSER_RUNNER);
    expect(payload?.simulatedExitCode).toBe(0);
    expect(payload?.honestyNote).toBe(IN_BROWSER_EXIT_NOTE);
    expect(payload?.exitCode).toBeUndefined();
    expect(JSON.stringify(payload)).not.toMatch(/"exitCode"/);
  });

  it("contrato recusa misturar exitCode de processo com runner in-browser", () => {
    const mixed = validateVerificationEvidence({
      kind: "verification",
      runner: "in-browser",
      exitCode: 0,
      simulatedExitCode: 0,
      stdout: "{}",
      stderr: "",
      argv: ["in-browser-catalog-check"],
      durationMs: 1,
      passed: true,
    });
    expect(mixed.ok).toBe(false);
    const node = validateVerificationEvidence(
      nodeProcessEvidence({
        exitCode: 0,
        stdout: '{"ok":true,"tested":6}\n',
        stderr: "",
        argv: ["node", "verify-runner.mjs"],
        durationMs: 1,
        passed: true,
      }),
    );
    expect(node.ok).toBe(true);
    const browser = validateVerificationEvidence(
      inBrowserEvidence({
        simulatedExitCode: 0,
        stdout: '{"ok":true,"tested":6}\n',
        stderr: "",
        argv: ["in-browser-catalog-check"],
        durationMs: 1,
        passed: true,
      }),
    );
    expect(browser.ok).toBe(true);
    if (browser.ok) {
      expect("exitCode" in browser.value).toBe(false);
      expect(evidenceTracePayload(browser.value).exitCode).toBeUndefined();
    }
  });
});

describe("round 4 — lease KV entre dois runtimes (tabs no mesmo mapa)", () => {
  it("segundo holder é recusado enquanto o lease é válido; após TTL pode tomar", () => {
    const shared = new MemoryKeyValue();
    const runId = "11111111-1111-4111-8111-111111111111";
    const t0 = 1_000_000;
    acquireKvLock(shared, runId, "tab-a", t0);
    try {
      acquireKvLock(shared, runId, "tab-b", t0 + 10);
      throw new Error("esperava CONCURRENT_EXECUTION");
    } catch (error) {
      expect((error as { code: string }).code).toBe("CONCURRENT_EXECUTION");
    }
    acquireKvLock(shared, runId, "tab-b", t0 + KV_LOCK_TTL_MS + 1);
    releaseKvLock(shared, runId, "tab-b");
    expect(shared.getItem(kvLockKey(runId))).toBeNull();
  });

  it("dois KeyValueRuntime no mesmo MemoryKeyValue honram o lease", async () => {
    const shared = new MemoryKeyValue();
    const left = new KeyValueRuntime(shared);
    const right = new KeyValueRuntime(shared);
    const runId = "22222222-2222-4222-8222-222222222222";
    await left.acquireLock(runId, "left", 50);
    await expect(right.acquireLock(runId, "right", 60)).rejects.toMatchObject({
      code: "CONCURRENT_EXECUTION",
    });
    await left.releaseLock(runId, "left");
    await right.acquireLock(runId, "right", 70);
    await right.releaseLock(runId, "right");
  });
});
