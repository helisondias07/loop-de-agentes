import { useEffect, useMemo, useState } from "react";
import { COPY } from "@app-copy";
import { formatEvidence, formatInBrowserEvidence } from "../core/evidence.ts";
import { IN_BROWSER_RUNNER, STATIC_DEMO_BANNER } from "../core/types.ts";
import { createBrowserClient } from "./browserClient.ts";
import { createHttpClient } from "./httpClient.ts";
import type { LoopClient, LoopView } from "./loopClient.ts";

type PhaseId = "spec" | "plan" | "implementation" | "verification" | "review";

const STATIC = import.meta.env.VITE_STATIC_DEMO === "true";
const client: LoopClient = STATIC ? createBrowserClient() : createHttpClient();

const PHASES: { id: PhaseId; label: string; entry: string }[] = [
  { id: "spec", label: "Spec", entry: COPY.phases.spec },
  { id: "plan", label: "Plan", entry: COPY.phases.plan },
  { id: "implementation", label: "Implementação", entry: COPY.phases.implementation },
  { id: "verification", label: "Verificação", entry: COPY.phases.verification },
  { id: "review", label: "Review", entry: COPY.phases.review },
];

const DEFAULT_BANNER = STATIC
  ? STATIC_DEMO_BANNER
  : "Simulação determinística — sem chamadas a modelos";

export default function App() {
  const [tab, setTab] = useState<"painel" | "arquitetura" | "executar" | "limites">(
    "painel",
  );
  const [scenarios, setScenarios] = useState<{ id: string; title: string; description: string }[]>(
    [],
  );
  const [scenarioId, setScenarioId] = useState("success");
  const [banner, setBanner] = useState(DEFAULT_BANNER);
  const [view, setView] = useState<LoopView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = view?.run ?? null;
  const traces = view?.traces ?? [];

  function apply(state: LoopView) {
    if (state.banner) setBanner(state.banner);
    if (state.scenarios) setScenarios(state.scenarios);
    setView(state);
    if (state.error) setError(`${state.error}: ${state.message ?? ""}`);
    else setError(null);
  }

  useEffect(() => {
    void (async () => {
      const meta = await client.meta();
      apply(meta);
      const current = await client.current();
      apply({ ...meta, ...current, scenarios: meta.scenarios ?? current.scenarios });
    })();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return;
      }
      if (event.key === "1") setTab("painel");
      if (event.key === "2") setTab("arquitetura");
      if (event.key === "3") setTab("executar");
      if (event.key === "4") setTab("limites");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function act(fn: () => Promise<LoopView>) {
    setBusy(true);
    try {
      apply(await fn());
    } finally {
      setBusy(false);
    }
  }

  const evidence = useMemo(() => {
    if (!run?.lastEvidence) return "Nenhuma evidência de verificação ainda.";
    if (STATIC) {
      if (run.lastEvidence.runner !== IN_BROWSER_RUNNER) {
        return "Evidência inesperada neste demo estático (runner não é in-browser).";
      }
      return formatInBrowserEvidence(run.lastEvidence);
    }
    return formatEvidence(run.lastEvidence);
  }, [run]);

  return (
    <div className="shell">
      <a className="skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <div className="banner" role="status">
        {banner}
      </div>
      <header className="header">
        <h1>Loop de agentes</h1>
        <p className="lede">{COPY.lede}</p>
      </header>
      <div className="tabs" role="tablist" aria-label="Seções">
        {(
          [
            ["painel", "Painel", "1"],
            ["arquitetura", "Arquitetura", "2"],
            ["executar", "Como executar", "3"],
            ["limites", "Limites", "4"],
          ] as const
        ).map(([id, label, key]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label} <span className="kicker">tecla {key}</span>
          </button>
        ))}
      </div>
      <main id="conteudo">
        {tab === "painel" ? (
          <>
            <div className="controls">
              <label>
                Cenário
                <select
                  aria-label="Cenário de simulação"
                  value={scenarioId}
                  onChange={(event) => setScenarioId(event.target.value)}
                >
                  {(scenarios.length
                    ? scenarios
                    : [{ id: "success", title: "Caminho feliz", description: "" }]
                  ).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary" type="button" disabled={busy} onClick={() => void act(() => client.start(scenarioId))}>
                Iniciar
              </button>
              <button type="button" disabled={busy || !run} onClick={() => void act(() => client.step())}>
                Passo
              </button>
              <button type="button" disabled={busy || !run} onClick={() => void act(() => client.untilGate())}>
                Até o gate
              </button>
              <button
                type="button"
                disabled={busy || !run?.pendingGate}
                onClick={() => void act(() => client.approve(run!.pendingGate!.id))}
              >
                Aprovar gate
              </button>
              <button type="button" disabled={busy || run?.status !== "interrupted"} onClick={() => void act(() => client.resume())}>
                Retomar
              </button>
              <button type="button" disabled={busy || !run || ["completed", "cancelled", "exhausted", "failed_closed"].includes(run.status)} onClick={() => void act(() => client.interrupt())}>
                Interromper
              </button>
              <button type="button" disabled={busy || !run || ["completed", "cancelled", "exhausted", "failed_closed"].includes(run.status)} onClick={() => void act(() => client.cancel())}>
                Cancelar
              </button>
              <button type="button" disabled={busy} onClick={() => void act(() => client.reset())}>
                Reset
              </button>
            </div>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            {!run ? (
              <p>Nenhuma run ativa. Escolha um cenário e inicie a simulação.</p>
            ) : (
              <div className="grid">
                <ol className="phases" aria-label="Fases do fluxo">
                  {PHASES.map((phase) => (
                    <li key={phase.id} aria-current={run.phase === phase.id ? "step" : undefined}>
                      <span className="phase-name">{phase.label}</span>
                      <span className="kicker">{phase.entry}</span>
                    </li>
                  ))}
                </ol>
                <section className="panel" aria-labelledby="estado-atual">
                  <h2 id="estado-atual">Estado atual</h2>
                  <p>
                    <span className={`status-pill ${run.status}`}>{run.status}</span> · fase{" "}
                    <strong>{run.phase}</strong> · run <code>{run.runId.slice(0, 8)}</code>
                  </p>
                  {run.pendingGate ? (
                    <p>
                      Gate humano: <strong>{run.pendingGate.id}</strong> — {run.pendingGate.reason}
                    </p>
                  ) : null}
                  {run.terminalReason ? <p>Término: {run.terminalReason}</p> : null}
                  <div className="stats" aria-label="Contadores de tentativa e orçamento">
                    <div className="stat">
                      <span>Attempt</span>
                      <b>
                        {run.attempt}/{run.budgets.maxRetries}
                      </b>
                    </div>
                    <div className="stat">
                      <span>Iterações</span>
                      <b>
                        {run.iteration}/{run.budgets.maxIterations}
                      </b>
                    </div>
                    <div className="stat">
                      <span>Passos</span>
                      <b>
                        {run.globalSteps}/{run.budgets.maxGlobalSteps}
                      </b>
                    </div>
                    <div className="stat">
                      <span>Chamadas</span>
                      <b>
                        {run.callsUsed}/{run.budgets.maxCalls}
                      </b>
                    </div>
                  </div>
                  {run.ignoredModelClaims.length > 0 ? (
                    <p>Claims de modelo ignoradas: {run.ignoredModelClaims.join("; ")}</p>
                  ) : null}
                  <h3>Evidência de verificação</h3>
                  <pre>{evidence}</pre>
                  <h3>Trace redigido</h3>
                  <pre>{JSON.stringify(traces, null, 2)}</pre>
                </section>
              </div>
            )}
          </>
        ) : null}
        {tab === "arquitetura" ? (
          <article className="docs">
            <h2>Arquitetura</h2>
            <p>{COPY.architecture}</p>
          </article>
        ) : null}
        {tab === "executar" ? (
          <article className="docs">
            <h2>Como executar</h2>
            <pre>{`npm install
npm test
npm run typecheck
npm run build          # dist/ (UI local; /api só com npm run dev)
npm run build:static   # dist-static/ (demo browser-only)
python3 -m http.server 43148 --directory dist-static
npx tsx src/cli/index.ts demo-success`}</pre>
          </article>
        ) : null}
        {tab === "limites" ? (
          <article className="docs">
            <h2>Limites</h2>
            <ul>
              {COPY.limits.map((item) => (
                <li key={item.slice(0, 48)}>{item}</li>
              ))}
            </ul>
          </article>
        ) : null}
      </main>
    </div>
  );
}
