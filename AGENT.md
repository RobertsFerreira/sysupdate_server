# SysUpdate Server - Agent Rules

Este arquivo define regras para agentes (Codex, Claude, Cursor, etc.) ao
trabalhar no backend (`server/`) do projeto SysUpdate.

## 1) Escopo e precedencia

No contexto atual, este `AGENT.md` e o **AGENT raiz do backend**.
Ainda nao existe `cli/AGENT.md`.

Se houver conflito entre orientacoes, priorize nesta ordem:

1. Criterios de aceite da `TASK-XXX` ativa
2. `AGENT.md` do escopo especifico impactado (ex: `src/db/AGENT.md`)
3. Este `server/AGENT.md`
4. PRD e backlog (`docs/PRD_SysUpdate_CLI.md`, `docs/tasks_sysupdate_cli.md`)
5. Codigo existente

## 2) Politica de leitura minima de AGENTs

- Sempre leia este `server/AGENT.md` antes de alterar codigo.
- Leia apenas os `AGENT.md` dos escopos impactados pela task.
- Evite abrir AGENTs de areas nao relacionadas.
- Em task multi-escopo, leia somente os AGENTs de cada escopo tocado.

Objetivo: reduzir ruido, manter foco e evitar instrucoes irrelevantes.

## 3) Skill oficial para backend Elysia

Para mudancas em rotas, handlers, plugins ou validacao no server, use a skill
`elysiajs` ja instalada no ambiente.

- Aplicar boas praticas da skill:
  - encapsulation
  - method chaining
  - explicit dependencies
  - validacao de entrada/saida
  - tratamento consistente de erros
- Referencia primaria de API/exemplos: `https://elysiajs.com/llms.txt`
- Nao baixar arquivos da skill/documentacao localmente para executar essas
  diretrizes.

## 4) Fonte de verdade

- PRD: `./docs/PRD_SysUpdate_CLI.md`
- Backlog e criterios de aceite: `./docs/tasks_sysupdate_cli.md`
- Estilo e tooling: `./biome.json`, `./tsconfig.json`, `./package.json`

## 5) Estado atual do backend (mapa rapido)

Estado observado para orientar implementacao incremental:

- Implementado:
  - Base Elysia em `main.ts` e plugin base em `src/routes/routes.ts`
  - DB Drizzle/SQLite em `src/db/*`
  - Repository de releases em `src/repositories/releases.repository.ts`
  - DTO de releases em `src/dtos/releases.dto.ts`
  - Testes de repository em `test/repositories/*`
- Stubs/pendencias (nao forcar conclusao fora da task ativa):
  - Rotas `manifest.ts`, `bundle.ts`, `publish.ts`, `auth.ts`
  - Adapters `storage/ftp.ts` e `storage/s3.ts`
  - Camada `services` ainda nao implementada

## 6) Contratos por camada

Use os AGENTs de escopo em `src/*/AGENT.md` para detalhes locais.

- `db`: schema, migrations, transacoes e erros de dominio
- `repositories`: acesso a dados e composicao de queries
- `services`: orquestracao de regras de negocio e integracao entre camadas
- `routes`: contrato HTTP, validacao de entrada/saida e mapeamento de erros
- `storage`: contrato de adaptador e erros de infraestrutura
- `dtos`: schema/parse de entrada e saida tipada

Regra geral: sem acoplamento desnecessario entre camadas.

## 7) Regras de implementacao

- Runtime: Bun + TypeScript ESM
- TypeScript em modo estrito (`strict: true`)
- Preferir imports via alias `@/` quando ja for padrao do modulo
- Evitar dependencias novas sem necessidade clara da task
- Implementar exatamente o escopo da task (sem feature creep)
- Preservar stubs quando a task pedir apenas esqueleto

## 8) Padrao de codigo (Biome)

Aplicar o padrao do projeto:

- Indentacao com tab
- Aspas simples
- Semicolon `asNeeded`
- Largura de linha ~80
- Organizar imports automaticamente

## 9) Regras de dominio (nao quebrar)

- Semver obrigatorio para versoes de release
- `pull` nao aceita manifest com versao <= instalada
- Checksums SHA-256 obrigatorios nos pontos definidos no PRD
- Rollback deve ser atomico (state so atualiza no sucesso completo)
- Backups seguem estrutura versionada em `.sysupdate-backups/`
- Rotas publicas de leitura (`manifest`/`bundle`/`health`) sem auth, conforme
  fase/task

## 10) Seguranca e segredos

- Nunca commitar segredos, chaves privadas ou tokens reais
- Nunca criar fallback inseguro temporario sem registrar claramente no codigo
- Respeitar o modelo de seguranca por fase (Alpha = stub, v1.0+ = Ed25519 real)

## 11) Definition of Done por task

Ao implementar uma `TASK-XXX`:

1. Ler descricao e criterios de aceite no backlog
2. Implementar somente o necessario para fechar os criterios
3. Cobrir casos felizes e erros relevantes da mudanca
4. Executar validacoes obrigatorias
5. Registrar evidencias

Validacoes minimas para mudancas no `server/`:

- `bun test`
- `bunx biome check .`

Se nao for possivel rodar algum comando, registrar motivo no relatorio final.

Formato recomendado de QA report:

- `Status: PASS|FAIL`
- `Blockers`
- `Warnings`
- `Evidence (comandos executados)`
- `Arquivos impactados`

## 12) Diretrizes de colaboracao para agentes

- Preferir mudancas pequenas e revisaveis
- Nao refatorar areas nao relacionadas sem necessidade
- Em caso de ambiguidade, escolher a alternativa mais conservadora em seguranca
  e integridade de dados

---

Se este arquivo ficar desatualizado, alinhe com:

- `./docs/PRD_SysUpdate_CLI.md`
- `./docs/tasks_sysupdate_cli.md`
