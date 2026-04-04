# AGENT - Escopo Services

## Responsabilidade

Orquestrar regra de negocio entre repositories, storage e validacoes de dominio:

- coordenar fluxo de caso de uso
- centralizar regra de negocio reutilizavel
- expor resultados claros para `routes`

Nao acoplar service diretamente ao transporte HTTP.
Lancar erros custom para o global error handler tratar de forma uniforme.

## Exemplo principal

Service que orquestra dependencia e lanca erros custom:

```ts
export async function publishReleaseService(
  input: PublishInput,
  deps: { repo: ReleaseRepository; storage: StorageAdapter },
): Promise<{ version: string }> {
  const existing = deps.repo.getReleaseByVersion(input.version)
  if (existing) {
    throw new ReleaseVersionConflictError(input.version)
  }

  try {
    await deps.storage.upload(input.localBundlePath, input.remoteBundlePath)
  } catch {
    throw new StorageUnavailableError('Failed to upload bundle')
  }

  return { version: input.version }
}
```

## Anti-patterns

- Service retornando resposta HTTP diretamente
- Service chamando `ctx`/`status` do Elysia
- Service retornando erro estruturado ad-hoc em vez de erro custom
- Misturar parse de request com regra de negocio

## Checklist rapido

- Fluxo de negocio esta desacoplado de HTTP?
- Dependencias estao explicitas no parametro?
- Erros de negocio/infra estao modelados como custom errors?
