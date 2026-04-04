# AGENT - Escopo DTOs

## Responsabilidade

Definir e validar contratos de dados de entrada/saida:

- schemas (Zod/TypeBox quando aplicavel)
- tipos inferidos para uso no dominio
- funcoes de parse/mapeamento seguras

DTO deve proteger fronteiras da aplicacao.

## Exemplo principal

Schema + tipo + parser:

```ts
import { z } from 'zod'

const ReleaseHeaderDTOSchema = z.object({
  id: z.number(),
  version: z.string(),
  bundle_file: z.string(),
})

export type ReleaseHeaderDTO = z.infer<typeof ReleaseHeaderDTOSchema>

export function toReleaseHeaderDTO(data: unknown): ReleaseHeaderDTO {
  return ReleaseHeaderDTOSchema.parse(data)
}
```

## Anti-patterns

- Aceitar `any` sem validacao
- Duplicar schema semelhante em varios arquivos sem necessidade
- Pular parse na borda e validar apenas no meio do fluxo

## Checklist rapido

- DTO de entrada/saida possui schema e tipo inferido?
- Parser usa `.parse`/`.safeParse` de forma consistente?
- Mensagens de erro sao uteis para debugging?

