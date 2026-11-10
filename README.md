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
| `WorkflowController`, contratos, persistência, locks, orçamentos | **Implementado** e usado por UI, CLI e testes |
| `DeterministicHarness` + `verify-runner.mjs` | **Simulação determinística** (zero LLM/rede/auth) |
| `CursorAgentCliAdapter` | **Não implementado** (fronteira tipada; lança `LIVE_ADAPTER_UNIMPLEMENTED`) |
| Baseline/benchmark de produtividade | **Não executado** (sem números inventados) |

## Requisitos

Node.js 22+. Sem chaves de API.

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

UI: http://127.0.0.1:43147

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
- Verificação = stdout/stderr/exitCode do runner fixo, não afirmação textual.
- Fail-closed em estado corrupto, schema divergente ou lock órfão.
- Sem executor de shell genérico.

Janelas de crash: `docs/CRASH_WINDOWS.md`. Adapter Cursor: `docs/CURSOR_CLI_BOUNDARY.md`.
Caso de portfólio (pt-BR): `CASE.md`.
