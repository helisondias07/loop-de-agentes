import { useEffect, useMemo, useState } from "react";

type PhaseId = "spec" | "plan" | "implementation" | "verification" | "review";

interface Scenario {
  id: string;
  title: string;
  description: string;
}

interface RunSummary {
  runId: string;
  scenarioId: string;
  status: string;
  phase: PhaseId;
  attempt: number;
  iteration: number;
  globalSteps: number;
  callsUsed: number;
  budgets: {
    maxRetries: number;
    maxIterations: number;
    maxGlobalSteps: number;
    maxWallClockMs: number;
    maxCalls: number;
  };
  pendingGate: { id: string; reason: string; phase: string } | null;
  lastEvidence: {
    exitCode: number;
    stdout: string;
    stderr: string;
    passed: boolean;
    argv: string[];
  } | null;
  ignoredModelClaims: string[];
  lastError: string | null;
  terminalReason: string | null;
  completedPhases: string[];
  simulationBanner: string;
}

interface ApiState {
  banner: string;
  run: RunSummary | null;
  traces?: unknown[];
  scenarios?: Scenario[];
  error?: string;
  message?: string;
}

const PHASES: { id: PhaseId; label: string; entry: string }[] = [
  { id: "spec", label: "Spec", entry: "fixtures locais; workspace da run" },
  { id: "plan", label: "Plan", entry: "spec + gate spec-approval" },
  { id: "implementation", label: "Implementação", entry: "plan + gate plan-approval" },
  { id: "verification", label: "Verificação", entry: "filters.mjs real no workspace" },
  { id: "review", label: "Review", entry: "evidência passed=true do runner" },
];

async function api(path: string, init?: RequestInit): Promise<ApiState> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return (await response.json()) as ApiState;
}

export default function App() {
  const [tab, setTab] = useState<"painel" | "arquitetura" | "executar" | "limites">(
    "painel",
  );
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState("success");
  const [banner, setBanner] = useState("Simulação determinística — sem chamadas a modelos");
  const [run, setRun] = useState<RunSummary | null>(null);
  const [traces, setTraces] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function apply(state: ApiState) {
    if (state.banner) setBanner(state.banner);
    if (state.scenarios) setScenarios(state.scenarios);
    setRun(state.run ?? null);
    setTraces(state.traces ?? []);
    if (state.error) setError(`${state.error}: ${state.message ?? ""}`);
    else setError(null);
  }

  useEffect(() => {
    void (async () => {
      const meta = await api("/api/meta");
      apply(meta);
      const current = await api("/api/current");
      apply({ ...meta, ...current, scenarios: meta.scenarios });
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

  async function act(path: string, body?: unknown) {
    setBusy(true);
    try {
      const state = await api(path, {
        method: "POST",
        body: body ? JSON.stringify(body) : "{}",
      });
      apply(state);
    } finally {
      setBusy(false);
    }
  }

  const evidence = useMemo(() => {
    if (!run?.lastEvidence) return "Nenhuma evidência de verificação ainda.";
    const ev = run.lastEvidence;
    return `passed=${ev.passed} exitCode=${ev.exitCode}\nargv=${ev.argv.join(" ")}\n--- stdout ---\n${ev.stdout}\n--- stderr ---\n${ev.stderr}`;
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
        <p className="lede">
          Controlador com contratos tipados, gates humanos no controlador (texto de
          modelo nunca aprova), evidência real de testes e harness determinístico
          de filtros de e-commerce sintético.
        </p>
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
              <button className="primary" type="button" disabled={busy} onClick={() => void act("/api/start", { scenarioId })}>
                Iniciar
              </button>
              <button type="button" disabled={busy || !run} onClick={() => void act("/api/step")}>
                Passo
              </button>
              <button type="button" disabled={busy || !run} onClick={() => void act("/api/until-gate")}>
                Até o gate
              </button>
              <button
                type="button"
                disabled={busy || !run?.pendingGate}
                onClick={() => void act("/api/approve", { gateId: run?.pendingGate?.id })}
              >
                Aprovar gate
              </button>
              <button type="button" disabled={busy || run?.status !== "interrupted"} onClick={() => void act("/api/resume")}>
                Retomar
              </button>
              <button type="button" disabled={busy || !run || ["completed", "cancelled", "exhausted", "failed_closed"].includes(run.status)} onClick={() => void act("/api/interrupt")}>
                Interromper
              </button>
              <button type="button" disabled={busy || !run || ["completed", "cancelled", "exhausted", "failed_closed"].includes(run.status)} onClick={() => void act("/api/cancel")}>
                Cancelar
              </button>
              <button type="button" disabled={busy} onClick={() => void act("/api/reset")}>
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
            <p>
              O painel fala com o mesmo <code>WorkflowController</code> da CLI e dos
              testes. O harness usado é <code>deterministic-sim</code>. O adapter{" "}
              <code>cursor-agent-cli</code> existe só como fronteira tipada alinhada a{" "}
              <code>agent -p --output-format json|stream-json</code> e lança{" "}
              <code>LIVE_ADAPTER_UNIMPLEMENTED</code>.
            </p>
            <p>
              Inspiração (não copiada): Superpowered Ralph de João Raul Furtado Lucas
              / jrlucas1, LICENSE MIT em SHA 29d9df82f6094dcdfd95e6f58541669cc4868fb5
              (“Copyright (c) 2026”, titular não nomeado). Este MVP é implementação
              original: contratos, persistência, gates e evidência no controlador.
            </p>
          </article>
        ) : null}
        {tab === "executar" ? (
          <article className="docs">
            <h2>Como executar</h2>
            <pre>{`npm install
npm test
npm run typecheck
npm run build
npm run dev   # UI em http://127.0.0.1:43147
npx tsx src/cli/index.ts demo-success`}</pre>
          </article>
        ) : null}
        {tab === "limites" ? (
          <article className="docs">
            <h2>Limites</h2>
            <ul>
              <li>Zero chamadas a modelos, rede de LLM ou autenticação de vendor.</li>
              <li>Sem executor de shell genérico; só o verify-runner de argv fechado.</li>
              <li>Adapter live do Cursor CLI não é executado nem validado ponta a ponta.</li>
              <li>Protocolo de baseline/benchmark não foi executado; sem números inventados.</li>
              <li>Catálogo sintético local; nenhum dado de loja ou cliente real.</li>
              <li>
                Cancelar/interromper é cooperativo entre passos: não aborta o{" "}
                <code>spawnSync</code> da verificação em curso.
              </li>
              <li>
                Crash com lock órfão ≠ interrupt: use force-unlock e depois passo;
                resume só com status interrupted.
              </li>
              <li>
                Gates têm ids estáticos (sem nonce). Aprovar na API exige{" "}
                <code>gateId</code> explícito.
              </li>
              <li>
                Traces e <code>state.json</code> não são uma transação única (o
                último evento de trace pode faltar após crash).
              </li>
            </ul>
          </article>
        ) : null}
      </main>
    </div>
  );
}
