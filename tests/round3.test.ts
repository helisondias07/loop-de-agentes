import { describe, expect, it } from "vitest";
import { systemClock } from "../src/core/clock.ts";
import { WorkflowController } from "../src/core/controller.ts";
import { KeyValueRuntime, MemoryKeyValue } from "../src/core/kv-store.ts";
import { resumeInvalidMessage } from "../src/core/resume.ts";
import { DeterministicHarness } from "../src/harness/deterministic.ts";
import { FILTER_SOURCE_BROKEN, FILTER_SOURCE_CORRECT } from "../src/task/filter-sources.ts";
import { verifyFilterSource } from "../src/task/in-page-verify.ts";
import { driveUntilStatus, tempController } from "./helpers.ts";

describe("round 3 — RESUME_INVALID honesto", () => {
  it("mensagem inclui o status atual e a regra interrupted", async () => {
    const { controller } = await tempController();
    const started = await controller.start("success");
    expect(started.status).toBe("running");
    await expect(controller.resume(started.runId)).rejects.toMatchObject({
      code: "RESUME_INVALID",
      message: resumeInvalidMessage("running"),
    });
    expect(resumeInvalidMessage("running")).toContain('status atual é "running"');
    expect(resumeInvalidMessage("running")).toContain('status "interrupted"');
  });
});

describe("round 3 — runtime em memória (mesmo controlador, verificador in-page)", () => {
  it("completa o caminho feliz com evidência real do catálogo", async () => {
    const runtime = new KeyValueRuntime(new MemoryKeyValue());
    const controller = new WorkflowController({
      runtime,
      harness: new DeterministicHarness(),
      clock: systemClock,
    });
    const started = await controller.start("success");
    const done = await driveUntilStatus(controller, started.runId, ["completed"]);
    expect(done.status).toBe("completed");
    expect(done.lastEvidence?.passed).toBe(true);
    expect(done.lastEvidence?.argv[0]).toBe("in-browser-catalog-check");
    expect(done.lastEvidence?.stdout).toContain('"tested": 6');
  });

  it("verification-repair falha de verdade e depois passa", async () => {
    const runtime = new KeyValueRuntime(new MemoryKeyValue());
    const controller = new WorkflowController({
      runtime,
      harness: new DeterministicHarness(),
      clock: systemClock,
    });
    const started = await controller.start("verification-repair");
    const done = await driveUntilStatus(controller, started.runId, ["completed"]);
    expect(done.status).toBe("completed");
    expect(done.attempt).toBeGreaterThan(1);
    expect(done.lastEvidence?.passed).toBe(true);
  });
});

describe("round 3 — verificador in-page", () => {
  it("source correto passa; source quebrado falha; não há passed hardcoded", () => {
    const ok = verifyFilterSource(FILTER_SOURCE_CORRECT);
    expect(ok.passed).toBe(true);
    expect(ok.exitCode).toBe(0);
    const bad = verifyFilterSource(FILTER_SOURCE_BROKEN);
    expect(bad.passed).toBe(false);
    expect(bad.exitCode).not.toBe(0);
    expect(bad.stderr).toMatch(/in-stock/);
  });
});
