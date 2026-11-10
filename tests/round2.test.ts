import { existsSync } from "node:fs";
import { mkdir, symlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { requireExplicitGateId } from "../src/core/gates.ts";
import { lockPath, workspacePath } from "../src/core/persist.ts";
import { ControllerError } from "../src/core/types.ts";
import { evaluationPassed, runVerification } from "../src/task/verify.ts";
import { startScenario, tempController } from "./helpers.ts";

describe("round 2 — B1 crash vs resume", () => {
  it("resume --force-unlock com running + lock órfão não apaga o lock", async () => {
    const { dataDir, controller } = await tempController();
    const started = await controller.start("success");
    await mkdir(join(dataDir, "runs", started.runId), { recursive: true });
    const lock = lockPath(dataDir, started.runId);
    await writeFile(
      lock,
      JSON.stringify({ holderId: "dead", pid: 999_999_999, acquiredAtMs: 1 }),
    );
    await expect(controller.step(started.runId)).rejects.toMatchObject({
      code: "STALE_LOCK",
    });
    expect(existsSync(lock)).toBe(true);
    await expect(
      controller.resume(started.runId, { forceUnlock: true }),
    ).rejects.toMatchObject({ code: "RESUME_INVALID" });
    expect(existsSync(lock)).toBe(true);
    await controller.forceUnlock(started.runId);
    expect(existsSync(lock)).toBe(false);
    const next = await controller.step(started.runId);
    expect(next.status).toBe("awaiting_human");
  });

  it("resume --force-unlock só com interrupted remove lock órfão e retoma", async () => {
    const { dataDir, controller } = await tempController();
    const gated = await startScenario(controller, "success");
    const interrupted = await controller.interrupt(gated.runId);
    expect(interrupted.status).toBe("interrupted");
    await writeFile(
      lockPath(dataDir, gated.runId),
      JSON.stringify({ holderId: "dead", pid: 999_999_999, acquiredAtMs: 1 }),
    );
    const resumed = await controller.resume(gated.runId, { forceUnlock: true });
    expect(resumed.status).toBe("awaiting_human");
  });
});

describe("round 2 — B2 gateId HTTP explícito", () => {
  it("recusa gateId ausente e aceita o pendente quando nomeado", () => {
    expect(() => requireExplicitGateId(undefined)).toThrow(ControllerError);
    try {
      requireExplicitGateId("");
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toMatchObject({ code: "GATE_REQUIRED" });
    }
    expect(requireExplicitGateId("spec-approval")).toBe("spec-approval");
  });

  it("approve HTTP-style sem gateId não avança; mismatch não avança", async () => {
    const { controller } = await tempController();
    const gated = await startScenario(controller, "success");
    expect(gated.pendingGate?.id).toBe("spec-approval");
    expect(() => requireExplicitGateId(({} as { gateId?: string }).gateId)).toThrow(
      ControllerError,
    );
    await expect(controller.approve(gated.runId, "complete-approval")).rejects.toMatchObject({
      code: "GATE_MISMATCH",
    });
    const still = await controller.current(gated.runId);
    expect(still.phase).toBe("spec");
    expect(still.pendingGate?.id).toBe("spec-approval");
    const ok = await controller.approve(gated.runId, requireExplicitGateId("spec-approval"));
    expect(ok.phase).toBe("plan");
  });
});

describe("round 2 — B3 symlink e B4 JSON", () => {
  it("recusa filters.mjs symlink e não importa o alvo", async () => {
    const { dataDir, controller } = await tempController();
    const gated = await startScenario(controller, "success");
    await controller.approve(gated.runId, "spec-approval");
    const plan = await controller.runUntilGate(gated.runId);
    await controller.approve(gated.runId, plan.pendingGate!.id);
    const afterImpl = await controller.step(gated.runId);
    expect(afterImpl.phase).toBe("verification");
    const ws = workspacePath(dataDir, gated.runId);
    const filters = join(ws, "filters.mjs");
    const evil = join(dataDir, "evil-filters.mjs");
    await writeFile(
      evil,
      "export function applyFilters(products) { return products; }\n",
    );
    await unlink(filters);
    await symlink(evil, filters);
    const evidence = runVerification(filters, { workspaceDir: ws });
    expect(evidence.passed).toBe(false);
    expect(evidence.exitCode).not.toBe(0);
    expect(evidence.stderr).toMatch(/UNSAFE_PATH|symlink/i);
    const stepped = await controller.step(gated.runId);
    expect(stepped.lastEvidence?.passed).toBe(false);
    expect(stepped.lastEvidence?.stderr).toMatch(/UNSAFE_PATH|symlink/i);
  });

  it("passed exige JSON final com ok===true e tested===6 e exit 0", () => {
    expect(evaluationPassed(0, '{"ok":true,"tested":6}\n')).toBe(true);
    expect(evaluationPassed(0, 'prefix\n{"ok": true}\n')).toBe(false);
    expect(evaluationPassed(0, '{"ok":true,"tested":5}')).toBe(false);
    expect(evaluationPassed(1, '{"ok":true,"tested":6}')).toBe(false);
    expect(
      evaluationPassed(0, 'look {"ok": true} but then garbage'),
    ).toBe(false);
  });
});

describe("round 2 — B5 runId UUID", () => {
  it("recusa traversal e ids que não são UUID antes do path", async () => {
    const { controller } = await tempController();
    await expect(controller.step("../../etc")).rejects.toMatchObject({
      code: "INVALID_RUN_ID",
    });
    await expect(controller.current("not-a-uuid")).rejects.toMatchObject({
      code: "INVALID_RUN_ID",
    });
    await expect(controller.resume("../etc/passwd")).rejects.toMatchObject({
      code: "INVALID_RUN_ID",
    });
  });
});
