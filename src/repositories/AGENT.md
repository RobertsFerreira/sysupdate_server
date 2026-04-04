# AGENT - Escopo Repositories

## Responsabilidade

Encapsular acesso a dados e queries orientadas ao dominio:

- receber `DbClient`
- compor selects/inserts/updates
- devolver dados tipados e prontos para uso pela camada superior

Nao lidar com status HTTP nesta camada.
Lancar erros custom para tratamento posterior no global error handler.

## Exemplo principal

Factory de repository com dependencia explicita, transacao e erros custom:

```ts
export function createReleaseRepository(db: DbClient) {
  function insertRelease(release: InsertReleaseDTO) {
    return db.transaction((tx) => {
      const { files, ...releaseData } = release
      const inserted = tx.insert(releases).values(releaseData).returning().get()
      if (!inserted) throw new ReleasePersistenceError('Failed to insert release')

      const mappedFiles = files.map((file) => ({
        release_id: inserted.id,
        ...file,
      }))
      const insertedFiles = tx.insert(releaseFiles).values(mappedFiles).returning().all()
      if (insertedFiles.length !== mappedFiles.length) {
        throw new ReleasePersistenceError('Failed to insert release files')
      }

      return inserted
    })
  }

  return { insertRelease }
}
```

## Anti-patterns

- Usar `db` global quando a factory aceita injecao
- Operacao composta sem transacao no repository
- `throw new Error` generico em falhas de dominio/persistencia
- Retornar estruturas sem validar/formatar para DTO esperado
- Colocar regra de autorizacao ou fluxo HTTP no repository

## Checklist rapido

- Repository recebe dependencia de DB via parametro?
- Operacao composta esta protegida por transacao?
- Falhas de dominio/persistencia usam erro custom?
- Metodos retornam tipos previsiveis (`null` vs `throw`)?
- Erros de dominio criticos estao mapeados?
