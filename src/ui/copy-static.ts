export const STATIC_COPY = {
  lede: "Controlador com contratos tipados, gates humanos no controlador (texto de modelo nunca aprova), gates com verificação simulada no navegador e harness determinístico de filtros de e-commerce sintético.",
  phases: {
    spec: "fixtures locais; workspace da run",
    plan: "spec + gate spec-approval",
    implementation: "plan + gate plan-approval",
    verification: "filters.mjs no armazenamento local (check in-browser)",
    review: "evidência passed=true do check in-browser (simulado)",
  },
  architecture:
    "O painel usa o mesmo WorkflowController da CLI e dos testes, neste browser, com persistência em localStorage — sem /api. A verificação executa runCatalogChecks sobre o filters.mjs gravado; não há “passed” hardcoded. A evidência leva runner=in-browser e simulatedExitCode, não exitCode de processo.",
  limits: [
    "Zero chamadas a modelos, rede de LLM ou autenticação de vendor.",
    "Demo estático: dados só neste navegador (localStorage); sem /api.",
    "Verificação in-browser usa runner=in-browser e simulatedExitCode — não é um processo OS. O modo local (npm run dev) é que usa spawnSync e exitCode de processo.",
    "Lock estático: lease em localStorage (TTL 15s) partilhado entre tabs do mesmo origin. Não é tão forte quanto wx em ficheiro; um lease expirado pode ser roubado. Escolha: lease testável no mesmo mapa, sem BroadcastChannel.",
    "Cancel/interrupt não abortam uma verificação em curso (neste demo: check síncrono na página; no modo Node: spawnSync até 8s).",
    "Adapter live do Cursor CLI não é executado nem validado ponta a ponta.",
    "Protocolo de baseline/benchmark não foi executado; sem números inventados.",
    "Catálogo sintético local; nenhum dado de loja ou cliente real.",
    "Resume só a partir de status interrupted. Cancel/interrupt cooperativos entre passos.",
    "Gates com ids estáticos (sem nonce). Aprovar exige gateId explícito no clique.",
  ],
} as const;

export const COPY = STATIC_COPY;
