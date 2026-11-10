# Resumo de estado persistido

Arquivo: `.loop-runs/runs/<runId>/state.json`

Campos principais:

| Campo | Papel |
| --- | --- |
| schemaVersion | `1`; mismatch → fail-closed |
| checksum | SHA-256 canônico do restante do objeto |
| status | idle/running/awaiting_human/completed/cancelled/exhausted/failed_closed/interrupted |
| phase | spec, plan, implementation, verification, review |
| attempt / iteration / globalSteps / callsUsed | contadores vs `budgets` |
| pendingGate | só preenchido pelo controlador |
| lastEvidence | stdout/stderr/exitCode/argv do verify-runner |
| ignoredModelClaims | tentativas do harness de “aprovar” |
| pendingGate.id | ids estáticos `spec-approval` / `plan-approval` / `complete-approval` (sem nonce) |

`runId` é UUID. Ponteiro da UI/CLI: `.loop-runs/current.json`.
Campo morto `implementationAttemptAtPhase` / `cancelRequested` foram removidos
(não eram lidos). Traces não são transacionais com `state.json`.
