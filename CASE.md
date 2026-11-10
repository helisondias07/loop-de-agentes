# Caso de portfólio — Loop de agentes

**Simulação determinística — sem chamadas a modelos.**

Slug recomendado: `loop-de-agentes`. Rascunho Origin temporário e privado;
nenhuma publicação, PR de rascunho, deploy ou espelho para produção.

## Problema

Loops de agente de desenvolvimento costumam misturar fase, aprovação e
“o modelo disse que passou nos testes”. Sem contratos de entrada/saída, sem
gate humano no controlador e sem evidência de processo, o fluxo não é
reproduzível nem auditável.

## Contribuição original vs inspiração

Inspiração: [Superpowered Ralph](https://joaoraul.dev/writing/superpowered-ralph/)
de João Raul Furtado Lucas / jrlucas1 (LICENSE MIT verificada no SHA
`29d9df82f6094dcdfd95e6f58541669cc4868fb5`, “Copyright (c) 2026”, titular não
nomeado). O artigo descreve um loop fásico em cima de skills do Claude Code.

Este MVP **não** reutiliza prompts, plugins ou skills. A contribuição é um
controlador TypeScript com:

- contratos tipados de entrada/saída por fase;
- gates humanos que só o controlador concede;
- persistência com checksum, lock e fail-closed;
- verificação por runner de argv fechado (exit code + stdout reais);
- harness determinístico compartilhado por UI, CLI e testes.

## Método

Fases: spec → plan → implementação → verificação → review. Tarefa sintética:
filtros de catálogo de e-commerce (`fixtures/products.json`). O harness grava
`filters.mjs`; o controlador executa `node src/task/verify-runner.mjs`.
Orçamentos limitam retries, iterações, passos, tempo e chamadas. Retorno
controlado de falha de verificação para implementação; caminhos terminais de
esgotamento e cancelamento.

Adapter live do Cursor CLI (`agent -p --output-format json|stream-json`) está
tipado e **não implementado**.

## Resultados reais

Os testes automatizados deste repositório exercitam sucesso, reparo após
falha de verificação, esgotamento de retry, interrupção/resume, cancelamento,
corrupção, aprovação, orçamento e concorrência. Não há números de
produtividade nem baseline comparativo executado — o protocolo de baseline
fica documentado como **não executado**.

## Limites

Demo estático (`dist-static/`) corre o mesmo controlador no browser com
`localStorage`, sem `/api`. Zero LLM. Sem loja real. Sem executor de shell genérico. Sem validação
ponta a ponta de agente live. Sem claims de skill Claude Code. Cancel e
interrupt são cooperativos entre passos (não abortam `spawnSync`). Gates
usam ids estáticos, sem nonce. Traces e `state.json` não são transação
única. Crash com lock órfão não é `resume` — é `force-unlock` + `step`.

## Próximos passos (fora deste rascunho)

Revisão independente do coordenador; só então eventual publicação. Um adapter
live, se existir, deve permanecer opt-in, com os mesmos contratos e a mesma
proibição de o texto do modelo aprovar gates humanos.
