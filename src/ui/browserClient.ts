import { createBrowserController } from "../browser/factory.ts";
import { requireExplicitGateId } from "../core/gates.ts";
import { listScenarios } from "../core/scenarios.ts";
import { ControllerError, STATIC_DEMO_BANNER, type ScenarioId } from "../core/types.ts";
import type { LoopClient, LoopView } from "./loopClient.ts";

function failFields(error: unknown): Pick<LoopView, "error" | "message"> {
  const code = error instanceof ControllerError ? error.code : "ERROR";
  const message = error instanceof Error ? error.message : String(error);
  return { error: code, message };
}

export function createBrowserClient(): LoopClient {
  const { controller, runtime } = createBrowserController();

  async function pack(): Promise<LoopView> {
    const runId = await runtime.getPointer();
    if (!runId) {
      return {
        banner: STATIC_DEMO_BANNER,
        run: null,
        traces: [],
        scenarios: listScenarios(),
      };
    }
    const run = await controller.current(runId);
    const traces = await controller.traces(runId);
    return {
      banner: STATIC_DEMO_BANNER,
      run: { ...run, simulationBanner: STATIC_DEMO_BANNER },
      traces,
      scenarios: listScenarios(),
    };
  }

  return {
    async meta() {
      return {
        banner: STATIC_DEMO_BANNER,
        run: null,
        traces: [],
        scenarios: listScenarios(),
      };
    },
    current: () => pack(),
    async start(scenarioId) {
      try {
        const started = await controller.start(scenarioId as ScenarioId);
        await runtime.setPointer(started.runId);
        await controller.runUntilGate(started.runId);
        return await pack();
      } catch (error) {
        return { ...(await pack()), ...failFields(error) };
      }
    },
    async step() {
      try {
        const runId = await runtime.getPointer();
        if (!runId) throw new ControllerError("NO_RUN", "nenhuma run ativa");
        await controller.step(runId);
        return await pack();
      } catch (error) {
        return { ...(await pack()), ...failFields(error) };
      }
    },
    async untilGate() {
      try {
        const runId = await runtime.getPointer();
        if (!runId) throw new ControllerError("NO_RUN", "nenhuma run ativa");
        await controller.runUntilGate(runId);
        return await pack();
      } catch (error) {
        return { ...(await pack()), ...failFields(error) };
      }
    },
    async approve(gateId) {
      try {
        const id = requireExplicitGateId(gateId);
        const runId = await runtime.getPointer();
        if (!runId) throw new ControllerError("NO_RUN", "nenhuma run ativa");
        await controller.approve(runId, id);
        return await pack();
      } catch (error) {
        return { ...(await pack()), ...failFields(error) };
      }
    },
    async reject(gateId) {
      try {
        const id = requireExplicitGateId(gateId);
        const runId = await runtime.getPointer();
        if (!runId) throw new ControllerError("NO_RUN", "nenhuma run ativa");
        await controller.reject(runId, id);
        return await pack();
      } catch (error) {
        return { ...(await pack()), ...failFields(error) };
      }
    },
    async cancel() {
      try {
        const runId = await runtime.getPointer();
        if (!runId) throw new ControllerError("NO_RUN", "nenhuma run ativa");
        await controller.cancel(runId);
        return await pack();
      } catch (error) {
        return { ...(await pack()), ...failFields(error) };
      }
    },
    async interrupt() {
      try {
        const runId = await runtime.getPointer();
        if (!runId) throw new ControllerError("NO_RUN", "nenhuma run ativa");
        await controller.interrupt(runId);
        return await pack();
      } catch (error) {
        return { ...(await pack()), ...failFields(error) };
      }
    },
    async resume() {
      try {
        const runId = await runtime.getPointer();
        if (!runId) throw new ControllerError("NO_RUN", "nenhuma run ativa");
        await controller.resume(runId);
        return await pack();
      } catch (error) {
        return { ...(await pack()), ...failFields(error) };
      }
    },
    async reset() {
      await runtime.clearAll();
      return {
        banner: STATIC_DEMO_BANNER,
        run: null,
        traces: [],
        scenarios: listScenarios(),
      };
    },
  };
}
