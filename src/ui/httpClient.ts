import type { LoopClient, LoopView } from "./loopClient.ts";

async function api(path: string, init?: RequestInit): Promise<LoopView> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return (await response.json()) as LoopView;
}

export function createHttpClient(): LoopClient {
  return {
    meta: () => api("/api/meta"),
    current: () => api("/api/current"),
    start: (scenarioId) =>
      api("/api/start", { method: "POST", body: JSON.stringify({ scenarioId }) }),
    step: () => api("/api/step", { method: "POST", body: "{}" }),
    untilGate: () => api("/api/until-gate", { method: "POST", body: "{}" }),
    approve: (gateId) =>
      api("/api/approve", { method: "POST", body: JSON.stringify({ gateId }) }),
    reject: (gateId) =>
      api("/api/reject", { method: "POST", body: JSON.stringify({ gateId }) }),
    cancel: () => api("/api/cancel", { method: "POST", body: "{}" }),
    interrupt: () => api("/api/interrupt", { method: "POST", body: "{}" }),
    resume: () => api("/api/resume", { method: "POST", body: "{}" }),
    reset: () => api("/api/reset", { method: "POST", body: "{}" }),
  };
}
