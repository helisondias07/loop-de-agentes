import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin } from "vite";
import { createController } from "../core/factory.ts";
import { writePointer } from "../core/persist.ts";
import { SIMULATION_BANNER, type ScenarioId } from "../core/types.ts";
import { ControllerError } from "../core/types.ts";
import { requireExplicitGateId } from "../core/gates.ts";
import { assertRunId } from "../core/runId.ts";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(`${JSON.stringify(body)}\n`);
}

export function loopApiPlugin(dataDir = join(process.cwd(), ".loop-runs")): Plugin {
  const controller = createController({ dataDir });

  async function pointer(): Promise<string | null> {
    try {
      const raw = JSON.parse(await readFile(join(dataDir, "current.json"), "utf8")) as {
        runId?: string | null;
      };
      if (typeof raw.runId !== "string") return null;
      return assertRunId(raw.runId);
    } catch (error) {
      if (error instanceof ControllerError && error.code === "INVALID_RUN_ID") {
        throw error;
      }
      return null;
    }
  }

  return {
    name: "loop-de-agentes-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/api/")) {
          next();
          return;
        }
        try {
          await mkdir(dataDir, { recursive: true });
          if (url === "/api/meta" && req.method === "GET") {
            send(res, 200, {
              banner: SIMULATION_BANNER,
              harness: "deterministic-sim",
              liveAdapter: "unimplemented",
              scenarios: controller.listScenarios(),
            });
            return;
          }
          if (url === "/api/current" && req.method === "GET") {
            const runId = await pointer();
            if (!runId) {
              send(res, 200, { banner: SIMULATION_BANNER, run: null });
              return;
            }
            const run = await controller.current(runId);
            const traces = await controller.traces(runId);
            send(res, 200, { banner: SIMULATION_BANNER, run, traces });
            return;
          }
          if (url === "/api/start" && req.method === "POST") {
            const body = await readBody(req);
            const scenarioId = (body.scenarioId as ScenarioId) || "success";
            const run = await controller.start(scenarioId);
            await writePointer(dataDir, run.runId);
            const until = await controller.runUntilGate(run.runId);
            const traces = await controller.traces(run.runId);
            send(res, 200, { banner: SIMULATION_BANNER, run: until, traces });
            return;
          }
          if (url === "/api/step" && req.method === "POST") {
            const runId = await pointer();
            if (!runId) throw new ControllerError("NO_RUN", "nenhuma run ativa");
            const run = await controller.step(runId);
            const traces = await controller.traces(runId);
            send(res, 200, { banner: SIMULATION_BANNER, run, traces });
            return;
          }
          if (url === "/api/until-gate" && req.method === "POST") {
            const runId = await pointer();
            if (!runId) throw new ControllerError("NO_RUN", "nenhuma run ativa");
            const run = await controller.runUntilGate(runId);
            const traces = await controller.traces(runId);
            send(res, 200, { banner: SIMULATION_BANNER, run, traces });
            return;
          }
          if (url === "/api/approve" && req.method === "POST") {
            const body = await readBody(req);
            const runId = await pointer();
            if (!runId) throw new ControllerError("NO_RUN", "nenhuma run ativa");
            const gateId = requireExplicitGateId(body.gateId);
            const run = await controller.approve(runId, gateId);
            const traces = await controller.traces(runId);
            send(res, 200, { banner: SIMULATION_BANNER, run, traces });
            return;
          }
          if (url === "/api/reject" && req.method === "POST") {
            const body = await readBody(req);
            const runId = await pointer();
            if (!runId) throw new ControllerError("NO_RUN", "nenhuma run ativa");
            const gateId = requireExplicitGateId(body.gateId);
            const run = await controller.reject(runId, gateId);
            const traces = await controller.traces(runId);
            send(res, 200, { banner: SIMULATION_BANNER, run, traces });
            return;
          }
          if (url === "/api/cancel" && req.method === "POST") {
            const runId = await pointer();
            if (!runId) throw new ControllerError("NO_RUN", "nenhuma run ativa");
            const run = await controller.cancel(runId);
            const traces = await controller.traces(runId);
            send(res, 200, { banner: SIMULATION_BANNER, run, traces });
            return;
          }
          if (url === "/api/interrupt" && req.method === "POST") {
            const runId = await pointer();
            if (!runId) throw new ControllerError("NO_RUN", "nenhuma run ativa");
            const run = await controller.interrupt(runId);
            const traces = await controller.traces(runId);
            send(res, 200, { banner: SIMULATION_BANNER, run, traces });
            return;
          }
          if (url === "/api/resume" && req.method === "POST") {
            const runId = await pointer();
            if (!runId) throw new ControllerError("NO_RUN", "nenhuma run ativa");
            const run = await controller.resume(runId);
            const traces = await controller.traces(runId);
            send(res, 200, { banner: SIMULATION_BANNER, run, traces });
            return;
          }
          if (url === "/api/reset" && req.method === "POST") {
            await writeFile(join(dataDir, "current.json"), `${JSON.stringify({ runId: null })}\n`);
            send(res, 200, { banner: SIMULATION_BANNER, run: null, traces: [] });
            return;
          }
          send(res, 404, { error: "NOT_FOUND" });
        } catch (error) {
          const code = error instanceof ControllerError ? error.code : "ERROR";
          const message = error instanceof Error ? error.message : String(error);
          send(res, 400, { error: code, message, banner: SIMULATION_BANNER });
        }
      });
    },
  };
}
