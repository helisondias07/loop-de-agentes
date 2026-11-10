# Adapter Cursor Agent CLI (não executado)

Documentação oficial consultada:

- https://cursor.com/docs/cli/headless
- https://cursor.com/docs/cli/overview
- https://cursor.com/docs/cli/reference/output-format (via docs de output format)

Uso headless suportado pela documentação:

```bash
agent -p --output-format json "…"
agent -p --force --output-format stream-json "…"
```

`--print` / `-p` é o modo não interativo. `json` emite um objeto
`type: "result"` no sucesso. `stream-json` emite NDJSON e termina com
`result`. Falhas: exit não zero e stderr, sem objeto JSON válido no formato
`json`.

Este repositório declara `CursorAgentCliAdapter` com `implemented: false`.
Invocar lança `LIVE_ADAPTER_UNIMPLEMENTED`. Testes, CLI e UI usam apenas
`DeterministicHarness` (zero LLM, zero rede, zero auth).

Não há integração nativa Grok/Cursor, nem skills portáveis de Claude Code.
