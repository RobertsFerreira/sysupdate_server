# AGENT - Escopo Routes

## Responsabilidade

Camada HTTP com Elysia:

- definir rotas e contratos
- validar entrada/saida
- mapear resultado de service para status HTTP

Para mudancas Elysia, aplicar skill `elysiajs`.
Preferir tratamento centralizado no global error handler (`onError`).

## Exemplo principal

Route com validacao, sem `try/catch` local e com erro tratado globalmente:

```ts
import { Elysia, t } from 'elysia'

export const manifestRoutes = new Elysia({ name: 'manifest-routes' })
  .onError(({ error, set }) => mapDomainErrorToHttp(error, set))
  .get(
    '/manifest/:version',
    ({ params }) => getManifestOrThrow(params.version),
    {
      params: t.Object({ version: t.String() }),
      response: {
        200: t.Object({
          version: t.String(),
          bundle_file: t.String(),
        }),
        404: t.Object({ message: t.String() }),
      },
    },
  )
```

## Anti-patterns

- Handler sem validacao de entrada/saida
- Regra de negocio pesada dentro da rota
- `try/catch` local para cada rota com tratamento duplicado de erro
- Dependencia implicita (usar plugin/model sem `.use`)

## Checklist rapido

- Rota tem schema de entrada e resposta?
- Erros de dominio estao mapeados para status HTTP coerente?
- Rota delega tratamento para global error handler?
- Plugin/dependencia usada foi declarada explicitamente?
