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

Ponteiro da UI/CLI: `.loop-runs/current.json`.
