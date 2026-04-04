# AGENT - Escopo DB

## Responsabilidade

Camada de banco para modelagem e persistencia com Drizzle/SQLite:

- schemas e migrations
- bootstrap/preparo de database
- configuracao de client/driver e suporte transacional

Nao implementar regra HTTP aqui.

## Exemplo principal

Definicao de client com schema central:

```ts
export function createDb(databaseUrl: string) {
  const database = new Database(databaseUrl, { create: true })
  return drizzle(database, { schema, casing: 'snake_case' })
}
```

## Anti-patterns

- Schema sem migration correspondente
- Misturar regra de negocio com SQL/schema
- Ignorar erro de integridade (FK, unique) sem mapeamento claro

## Checklist rapido

- Alteracao de schema esta refletida em migration?
- Configuracao de DB/schemas esta consistente com runtime?
- Tipos de retorno estao consistentes com DTO/repository?
