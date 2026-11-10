# NOTICE

## Trabalho original

Este repositório (`loop-de-agentes`) é uma implementação original de um
controlador de fluxo de desenvolvimento com harness determinístico. Não copia
prompts, skills, plugins nem código do projeto inspirador.

## Inspiração e crédito

Conceito de loop fásico (spec → plan → implementação → verificação → review)
inspirado em:

- João Raul Furtado Lucas / [jrlucas1](https://github.com/jrlucas1)
- Artigo: https://joaoraul.dev/writing/superpowered-ralph/
- Repositório: https://github.com/jrlucas1/claude-superpowered-ralph

LICENSE verificada em SHA `29d9df82f6094dcdfd95e6f58541669cc4868fb5`:

```
MIT License
Copyright (c) 2026
```

Titular não nomeado no arquivo LICENSE naquele commit. Nenhum arquivo desse
repositório foi copiado para cá; portanto não há trecho substancial a
republicar. O aviso acima é preservado por crédito e verificação.

## Fronteira Cursor Agent CLI

Tipos do adapter live seguem a documentação oficial do Cursor CLI headless
(`agent -p`, `--output-format json` / `stream-json`). O adapter **não é
executado** neste MVP.
