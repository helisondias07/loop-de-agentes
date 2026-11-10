# Loop de agentes

**Simulação determinística — sem chamadas a modelos.**

Controlador de fluxo de desenvolvimento (spec → plan → implementação →
verificação → review) com contratos tipados, gates humanos no controlador,
estado persistido, traces redigidos e harness determinístico. A tarefa
sintética filtra um catálogo local de e-commerce. Não há integração live com
modelos.

Slug recomendado: `loop-de-agentes`.

## O que está implementado vs simulado vs não implementado

| Peça | Estado |
| --- | --- |
| `WorkflowController`, contratos, persistência, locks, orçamentos | **Implementado** (Node ficheiros **ou** localStorage) |
| `DeterministicHarness` + verify-runner / check in-browser | **Simulação determinística** (zero LLM/rede/auth) |
| `CursorAgentCliAdapter` | **Não implementado** (fronteira tipada; lança `LIVE_ADAPTER_UNIMPLEMENTED`) |
| Baseline/benchmark de produtividade | **Não executado** (sem números inventados) |

## Requisitos

Node.js 22+. Sem chaves de API.

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build          # dist/ — UI local (o /api só existe em `npm run dev`)
npm run build:static   # dist-static/ — demo só-browser, sem /api
npm run dev            # http://127.0.0.1:43147 (Vite + plugin /api + .loop-runs/)
```

### Demo estático (simulação no browser)

É uma simulação determinística para revisão em hosting estático. **Não** é um
agente live e **não** chama modelos.

```bash
npm run build:static
python3 -m http.server 43148 --directory dist-static
```

Pasta de saída: `dist-static/`. Em hosting estático genérico: comando de build
`npm run build:static`, diretório `dist-static`. Persistência: `localStorage`
(JSON pequeno; inspecionável; sobrevive a reload no mesmo origin). Lock: lease
no `localStorage` (TTL 15s) partilhado entre tabs do mesmo origin — não é
`wx` de ficheiro; um lease expirado pode ser tomado. Cancel/interrupt **não**
abortam verificação em curso (Node `spawnSync`; browser check síncrono).
Evidência in-browser: campo `simulatedExitCode` e `runner: "in-browser"`, nunca
`exitCode` de processo.

CLI:

```bash
npx tsx src/cli/index.ts scenarios
npx tsx src/cli/index.ts demo-success
npx tsx src/cli/index.ts live-adapter-probe
```

## Inspiração

João Raul Furtado Lucas / jrlucas1 —
https://joaoraul.dev/writing/superpowered-ralph/ — LICENSE MIT no SHA
`29d9df82f6094dcdfd95e6f58541669cc4868fb5`. Implementação original; ver
`NOTICE.md`.

## Segurança do fluxo

- Texto do modelo/harness nunca concede aprovação humana.
- Verificação = JSON final (`ok === true` e `tested === 6`) e código 0: `exitCode` só no runner `node-process`; no browser é `simulatedExitCode` (sem processo OS).
- Fail-closed em estado corrupto, schema divergente, `runId` não-UUID ou lock órfão.
- Sem executor de shell genérico. `--filters` não segue symlink; fixtures só o catálogo empacotado.
- HTTP `/api/approve` exige `gateId` explícito igual ao gate pendente.

### Crash vs cancel/interrupt

- `interrupt`/`resume`: só entre passos, status `interrupted`.
- Crash com `running` + `run.lock` órfão: `force-unlock` e depois `step`. `resume --force-unlock` **não** apaga o lock se o status não for `interrupted`.
- `cancel`/`interrupt` **não** abortam verificação em curso (Node: `spawnSync` até 8s; demo estático: check síncrono in-page). São cooperativos no passo seguinte.

Janelas de crash: `docs/CRASH_WINDOWS.md`. Adapter Cursor: `docs/CURSOR_CLI_BOUNDARY.md`.
Caso de portfólio (pt-BR): `CASE.md`.
