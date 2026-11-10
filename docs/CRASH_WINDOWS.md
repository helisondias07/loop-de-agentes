# Janelas de crash e retomada

O estado autoritativo é `runs/<runId>/state.json`, gravado por write + rename
atômico no mesmo filesystem (POSIX). Traces em `traces.jsonl` são append-only
e redigidos. **Gravar `state.json` e append de traces não é transacional**:
o último evento de trace pode faltar após crash (janela 2).

## Crash vs interrupt cooperativo

| Situação | status persistido | Comando correto |
| --- | --- | --- |
| `interrupt` humano entre passos | `interrupted` | `resume` (opcional `--force-unlock` se o lock ficou órfão) |
| Processo morto no meio de um `step` | em geral `running` + `run.lock` | `force-unlock` e depois `step` — **não** é resume |
| Verificação `spawnSync` a correr | (ainda no passo) | cancel/interrupt **não** matam o filho; só valem no próximo passo |

`resume` **só** aceita `status=interrupted`. Um `resume --force-unlock` com
status `running` **não apaga o lock** (falha `RESUME_INVALID` sem efeito
colateral). `force-unlock` é o comando que remove `run.lock`.

IDs de gate são estáticos (`spec-approval`, `plan-approval`,
`complete-approval`) — sem nonce. A ação humana tem de nomear o id; o
HTTP não infere o pendente.

## Janelas

1. **Depois do harness gravar `workspace/filters.mjs` e antes do rename de `state.json`**  
   O workspace pode ter arquivos da attempt atual e o estado ainda aponta à
   fase anterior. `step` é idempotente por `(phase, attempt)`: o harness
   determinístico reescreve os mesmos bytes. Fail-closed só se o JSON
   intermediário `.tmp` for promovido de forma parcial — o rename evita isso.

2. **Depois do rename de `state.json` e antes de `appendTrace`**  
   O estado já avançou; o trace pode perder o último evento. A run permanece
   consistente. O próximo `step` (não um `resume` de crash) continua a partir
   da fase persistida.

3. **Lock criado (`run.lock` flag `wx`) e processo morto antes do unlink**  
   O próximo `step` falha fechado com `STALE_LOCK` mesmo se o PID estiver
   morto. Operador humano: `force-unlock` e depois `step`. Não há roubo
   automático de lock. Isto **não** converte a run em `interrupted`.

4. **Dois processos no mesmo `runId`**  
   O segundo recebe `CONCURRENT_EXECUTION` (PID vivo) e não espera na fila.

5. **Checksum, `schemaVersion` ou `runId` (UUID) divergente**  
   `loadRun` lança `CHECKSUM_MISMATCH` / `SCHEMA_MISMATCH` / `CORRUPT_STATE`
   / `INVALID_RUN_ID`. Nenhuma correção automática.

6. **Interrupção cooperada**  
   `interrupt` persiste `status=interrupted` **entre passos**. `resume` volta
   a `running` ou a `awaiting_human` se ainda houver gate. Texto persistido
   do harness nunca altera `pendingGate`.
