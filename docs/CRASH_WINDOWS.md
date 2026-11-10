# Janelas de crash e retomada

O estado autoritativo é `runs/<runId>/state.json`, gravado por write + rename
atômico no mesmo filesystem (POSIX). Traces em `traces.jsonl` são append-only
e redigidos.

## Janelas

1. **Depois do harness gravar `workspace/filters.mjs` e antes do rename de `state.json`**  
   O workspace pode ter arquivos da attempt atual e o estado ainda aponta à
   fase anterior. `step` é idempotente por `(phase, attempt)`: o harness
   determinístico reescreve os mesmos bytes. Fail-closed só se o JSON
   intermediário `.tmp` for promovido de forma parcial — o rename evita isso.

2. **Depois do rename de `state.json` e antes de `appendTrace`**  
   O estado já avançou; o trace pode perder o último evento. A run permanece
   consistente. Resume continua a partir da fase persistida.

3. **Lock criado (`run.lock` flag `wx`) e processo morto antes do unlink**  
   O próximo `step` falha fechado com `STALE_LOCK` mesmo se o PID estiver
   morto. Só um operador humano pode `resume --force-unlock` / `forceUnlock`.
   Não há roubo automático de lock.

4. **Dois processos no mesmo `runId`**  
   O segundo recebe `CONCURRENT_EXECUTION` (PID vivo) e não espera na fila.

5. **Checksum ou `schemaVersion` divergente**  
   `loadRun` lança `CHECKSUM_MISMATCH` / `SCHEMA_MISMATCH` / `CORRUPT_STATE`.
   Nenhuma correção automática.

6. **Interrupção cooperada**  
   `interrupt` persiste `status=interrupted`. `resume` volta a `running` ou a
   `awaiting_human` se ainda houver gate. Texto persistido do harness nunca
   altera `pendingGate`.
