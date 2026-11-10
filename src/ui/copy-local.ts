export const LOCAL_COPY = {
  lede: "Controlador com contratos tipados, gates humanos no controlador (texto de modelo nunca aprova), evidência real de testes e harness determinístico de filtros de e-commerce sintético.",
  phases: {
    spec: "fixtures locais; workspace da run",
    plan: "spec + gate spec-approval",
    implementation: "plan + gate plan-approval",
    verification: "filters.mjs no workspace (verify-runner em processo Node)",
    review: "evidência passed=true do verify-runner (processo Node)",
  },
  architecture:
    "O painel usa o mesmo WorkflowController da CLI e dos testes. A UI local fala via /api; a verificação é o verify-runner em processo Node (exitCode de spawnSync).",
  limits: [
    "Zero chamadas a modelos, rede de LLM ou autenticação de vendor.",
    "Modo local: Vite /api + .loop-runs/; verificação = processo Node (spawnSync).",
    "Adapter live do Cursor CLI não é executado nem validado ponta a ponta.",
    "Protocolo de baseline/benchmark não foi executado; sem números inventados.",
    "Catálogo sintético local; nenhum dado de loja ou cliente real.",
    "Cancel/interrupt não abortam o spawnSync da verificação (timeout 8s).",
    "Resume só a partir de status interrupted.",
    "Gates com ids estáticos (sem nonce). Aprovar exige gateId explícito no clique.",
  ],
} as const;

export const COPY = LOCAL_COPY;
