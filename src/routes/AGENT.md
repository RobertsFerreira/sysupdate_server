# AGENT - Escopo Routes

## Responsabilidade

Camada HTTP com Elysia:

- definir rotas e contratos
- validar entrada/saida
- mapear resultado de service para status HTTP

Para mudancas Elysia, aplicar skill `elysiajs`.

## Exemplo principal

Route com validacao e resposta tipada:

```ts
import { Elysia, t } from 'elysia'

export const manifestRoutes = new Elysia({ name: 'manifest-routes' }).get(
  '/manifest/:version',
  ({ params, status }) => {
    const manifest = getManifest(params.version)
    if (!manifest) return status(404, { message: 'Version not found' })
    return manifest
  },
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
- Dependencia implicita (usar plugin/model sem `.use`)

## Checklist rapido

- Rota tem schema de entrada e resposta?
- Erros de dominio estao mapeados para status HTTP coerente?
- Plugin/dependencia usada foi declarada explicitamente?

