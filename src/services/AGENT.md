# AGENT - Escopo Services

## Responsabilidade

Orquestrar regra de negocio entre repositories, storage e validacoes de dominio:

- coordenar fluxo de caso de uso
- centralizar regra de negocio reutilizavel
- expor resultados claros para `routes`

Nao acoplar service diretamente ao transporte HTTP.

## Exemplo principal

Service que orquestra dependencia e retorna resultado previsivel:

```ts
type PublishResult =
  | { ok: true; version: string }
  | { ok: false; code: 'VERSION_CONFLICT' | 'STORAGE_ERROR'; message: string }

export async function publishReleaseService(
  input: PublishInput,
  deps: { repo: ReleaseRepository; storage: StorageAdapter },
): Promise<PublishResult> {
  const existing = deps.repo.getReleaseByVersion(input.version)
  if (existing) {
    return { ok: false, code: 'VERSION_CONFLICT', message: 'Version already exists' }
  }

  // fluxo simplificado de upload + persistencia
  return { ok: true, version: input.version }
}
```

## Anti-patterns

- Service retornando resposta HTTP diretamente
- Service chamando `ctx`/`status` do Elysia
- Misturar parse de request com regra de negocio

## Checklist rapido

- Fluxo de negocio esta desacoplado de HTTP?
- Dependencias estao explicitas no parametro?
- Resultado do service permite mapeamento claro em `routes`?

