# SysUpdate CLI — Tasks de Desenvolvimento

> Organizado por fase do roadmap. Dentro de cada fase, as tasks são agrupadas por módulo.
> Gerado em: Março / 2026 | Base: PRD_SysUpdate_CLI.md

---

## Legenda

| Campo | Descrição |
|---|---|
| **ID** | Identificador único da task |
| **Módulo** | Camada ou componente ao qual a task pertence |
| **Descrição** | O que deve ser feito e por quê |
| **Critérios de Aceite** | Condições objetivas para considerar a task concluída |

---

## FASE 1 — Alpha · Semanas 1–3

> Setup do projeto, servidor HTTP, FTP adapter, CLI base (pull/push/connect) e Security Layer stub.

---

### Módulo: Setup

---

#### TASK-001 — Inicializar monorepo Bun + TypeScript

**Módulo:** Setup

**Descrição:**
Criar a estrutura base do repositório seguindo a organização definida no PRD. O monorepo deve conter os workspaces `cli/` e `server/` com seus respectivos `package.json`, configuração TypeScript e scripts de desenvolvimento.

**Critérios de Aceite:**

- [X] Repositório criado com a estrutura `sysupdate/cli/` e `sysupdate/server/`
- [X] Cada workspace tem seu próprio `package.json` com nome, versão e dependências iniciais
- [X] `tsconfig.json` configurado em cada workspace (strict mode habilitado)
- [X] `.gitignore` configurado (exclui `node_modules`, `dist`, `data/*.db`, `.env`)
- [X] `bun install` executa sem erros em ambos os workspaces
- [X] Script `dev` funcional em ambos os workspaces via `bun run dev`

---

#### TASK-002 — Configurar estrutura de diretórios do CLI

**Módulo:** Setup

**Descrição:**
Criar os arquivos e diretórios base do CLI conforme a estrutura definida no PRD (seção 9.2): `commands/`, `core/`, `security/` e `main.ts`. Os arquivos podem ser stubs vazios neste momento — o objetivo é ter o esqueleto pronto para as tasks seguintes.

**Critérios de Aceite:**

- [X] Estrutura de diretórios criada: `src/commands/`, `src/core/`, `src/security/`
- [X] Arquivos stub criados: `pull.ts`, `push.ts`, `connect.ts`, `rollback.ts`, `status.ts`, `backup.ts` em `commands/`
- [X] Arquivos stub criados: `engine.ts`, `backup.ts`, `state.ts`, `checksum.ts` em `core/`
- [X] Arquivos stub criados: `interface.ts`, `noop.ts`, `ed25519.ts` em `security/`
- [X] `main.ts` criado no raiz de `src/` (entry point CLI)
- [X] `main.ts` executa sem erros (`bun run src/main.ts`)

---

#### TASK-003 — Configurar estrutura de diretórios do Servidor

**Módulo:** Setup

**Descrição:**
Criar os arquivos e diretórios base do servidor conforme definido no PRD (seção 9.2): `routes/`, `middleware/`, `db/`, `storage/` e `main.ts`. Incluir configuração do arquivo `.env.example` com todas as variáveis necessárias documentadas, conforme seção 6.4 do PRD.

**Critérios de Aceite:**

- [X] Estrutura de diretórios criada: `src/routes/`, `src/middleware/`, `src/db/`, `src/storage/`
- [X] Arquivos stub criados: `manifest.ts`, `bundle.ts`, `publish.ts`, `connect.ts` em `routes/`
- [X] Arquivo stub criado: `auth.ts` em `middleware/` (validação de assinatura Ed25519 + role)
- [X] Arquivos stub criados: `schema.ts`, `releases.ts` em `db/`
- [X] Arquivos stub criados: `ftp.ts`, `s3.ts` em `storage/`
- [X] `main.ts` criado e sobe servidor HTTP na porta configurada
- [X] `.env.example` do servidor documentado com: `SERVER_PORT`, `STORAGE_PROVIDER`, `STORAGE_HOST`, `STORAGE_USER`, `STORAGE_PASSWORD`, `STORAGE_BASE_PATH` (as chaves `SERVER_PRIVATE_KEY` e `SERVER_PUBLIC_KEY` são geradas automaticamente no boot e nunca entram no VCS)
- [X] `.env.example` da CLI (publisher) documentado com: `SERVER_URL` (as chaves `install_id` e `private_key` são geradas no `connect` e nunca configuradas manualmente)
- [X] `GET /health` responde `200 OK` com `{ "status": "ok" }`

---

### Módulo: Server — Banco de Dados

---

#### TASK-004 — Implementar schema SQLite e queries de releases e installations

**Módulo:** Server / DB

**Descrição:**
Criar e inicializar o banco de dados SQLite do servidor com as tabelas `releases`, `release_files` e `installations` conforme o schema da seção 6.2 do PRD. Implementar as queries necessárias para inserção e consulta de releases, e gestão de instalações registradas.

**Critérios de Aceite:**

- [X] Banco criado em `data/sysupdate.db` na primeira inicialização do servidor
- [X] Tabela `releases` criada com colunas: `id`, `version` (UNIQUE), `description`, `min_version`, `bundle_file`, `bundle_checksum`, `release_date`, `published_by` (install_id de quem publicou — audit log), `created_at`
- [X] Tabela `release_files` criada com colunas: `id`, `release_id` (FK → releases), `target`, `checksum`
- [X] Tabela `installations` criada com colunas: `id`, `install_id` (TEXT UNIQUE), `public_key` (Ed25519 pública —**** nunca a privada), `role` (TEXT — `pending | consumer | publisher`), `label`, `registered_at`, `last_seen`, `revoked` (0=ativa, 1=revogada)
- [X] Função `insertRelease(data)` implementada em `repositories/releases.repository.ts`
- [X] Função `getLatestRelease()` implementada — retorna a release com maior versão semver
- [X] Função `getReleaseByVersion(version)` — retorna release específica ou `null`
- [X] Função `insertInstallation(installId, publicKey, label?)` implementada em `repositories/installations.repository.ts` — role inicial sempre `pending`
- [X] Função `findInstallation(installId)` implementada — retorna instalação ativa (não revogada) ou `null`
- [X] Função `updateInstallationLastSeen(installId)` implementada
- [X] Função `setInstallationRole(installId, role)` implementada
- [X] Função `revokeInstallation(installId)` implementada — seta `revoked = 1`
- [X] Service `registerInstallation(input)` implementado em `services/installations.service.ts` para orquestrar registro desacoplado de HTTP
- [X] Banco recriado corretamente se `data/db/sysupdate.sqlite` não existir
- [X] `data/db/sysupdate.sqlite` está no `.gitignore`

---

### Módulo: Server — Autenticação

---

#### TASK-005 — Implementar rota POST /connect e middleware de autenticação Ed25519 (stub)

**Módulo:** Server / Auth

**Descrição:**
Implementar o modelo de autenticação por identidade Ed25519 por instalação, conforme as seções 6.1 e 7.1 do PRD. A rota `POST /connect` recebe `install_id` e `client_public_key`, registra a instalação com role `pending` e não requer autenticação prévia. O middleware `auth.ts` na Alpha é implementado como stub que passa as verificações de assinatura mas ainda valida `install_id` e `role`. A verificação criptográfica real é implementada na Fase 4.

**Critérios de Aceite:**

- [ ] `POST /connect` recebe `{ install_id, client_public_key }` e registra a instalação no SQLite com role `pending`
- [ ] `POST /connect` retorna `409` se o `install_id` já estiver registrado
- [ ] `POST /connect` não requer autenticação prévia — rota aberta
- [ ] A chave pública do servidor nunca é exposta via rota HTTP (obtida manualmente via `sysupdate-server pubkey`)
- [ ] Middleware `auth.ts` stub na Alpha: lê `install_id` do header, verifica se existe no banco e não está revogado — retorna `401` se não encontrado ou revogado
- [ ] Middleware stub verifica `role` da instalação — retorna `403` se role insuficiente para a rota
- [ ] Rota `POST /publish` exige role `publisher` (verificado pelo middleware)
- [ ] Rotas `GET /manifest/*`, `GET /bundle/*` e `GET /health` são públicas — sem autenticação

---

### Módulo: Server — Rotas

---

#### TASK-006 — Implementar rota GET /manifest/latest e GET /manifest/:version

**Módulo:** Server / Routes

**Descrição:**
Implementar as rotas de leitura do manifest. O servidor monta o JSON de resposta dinamicamente a partir do SQLite — sem arquivo estático. As rotas são públicas (sem autenticação). A resposta segue o schema da seção 6.3 do PRD, incluindo o campo `bundle.signature`.

**Critérios de Aceite:**

- [ ] `GET /manifest/latest` retorna o manifest da release com maior versão semver
- [ ] `GET /manifest/:version` retorna o manifest da versão especificada
- [ ] `GET /manifest/:version` retorna `404` com mensagem clara se a versão não existir
- [ ] Resposta segue o schema da seção 6.3 do PRD: `version`, `releaseDate`, `description`, `minVersion`, `bundle.file`, `bundle.checksum`, `bundle.signature`, `files[].target`, `files[].checksum`
- [ ] Content-Type da resposta é `application/json`
- [ ] Rotas não exigem autenticação

---

#### TASK-007 — Implementar rota GET /bundle/:version

**Módulo:** Server / Routes

**Descrição:**
Implementar a rota que faz stream do bundle `.zip` a partir do storage FTP. O arquivo `.sig` correspondente é servido via storage e referenciado no manifest. A rota é pública. O servidor faz proxy do stream para o cliente sem armazenar o bundle completo em memória.

**Critérios de Aceite:**

- [ ] `GET /bundle/:version` faz stream do arquivo `.zip` do FTP para o cliente
- [ ] Resposta tem `Content-Type: application/zip`
- [ ] `Content-Disposition` inclui o nome do arquivo (ex: `release-2.4.1.zip`)
- [ ] Retorna `404` com mensagem clara se a versão não existir no banco
- [ ] Retorna `502` com mensagem clara se o FTP estiver inacessível
- [ ] Stream é feito sem carregar o bundle inteiro em memória (pipe direto FTP → response)
- [ ] O arquivo `.sig` correspondente (`release-{version}.zip.sig`) está disponível no storage e referenciado em `bundle.signature` no manifest
- [ ] Rota não exige autenticação

---

#### TASK-008 — Implementar rota POST /publish

**Módulo:** Server / Routes

**Descrição:**
Implementar a rota protegida que recebe o bundle do publisher, valida a assinatura da instalação (stub na Alpha), re-assina o bundle com a chave privada do próprio servidor (stub na Alpha), salva no FTP e registra os metadados no SQLite. Exige role `publisher`. A operação é atômica: falha no FTP impede o registro no SQLite.

**Critérios de Aceite:**

- [ ] `POST /publish` exige role `publisher` — retorna `401` sem `install_id` válido, `403` para roles insuficientes
- [ ] Recebe `multipart/form-data` com os campos: `bundle` (arquivo zip), `version`, `releaseDate`, `description`, `minVersion`, `files` (JSON array com `target` e `checksum`), `bundleChecksum`
- [ ] Valida que todos os campos obrigatórios estão presentes — retorna `400` com o campo faltante identificado
- [ ] Recusa publicação se a versão já existir no SQLite — retorna `409`
- [ ] Recusa publicação se a versão for menor ou igual à última publicada (proteção contra downgrade no servidor)
- [ ] Na Alpha (stub): pula verificação de assinatura do publisher e re-assinatura pelo servidor
- [ ] Salva o bundle no FTP em `STORAGE_BASE_PATH/release-{version}.zip`
- [ ] Salva o arquivo `.sig` no FTP em `STORAGE_BASE_PATH/release-{version}.zip.sig` (vazio na Alpha)
- [ ] Registra a release no SQLite após upload bem-sucedido no FTP, incluindo `published_by` = `install_id` de quem publicou (audit log)
- [ ] Retorna `201` com `{ "version": "2.4.1", "bundleChecksum": "..." }` em caso de sucesso
- [ ] Em caso de falha no FTP, não registra nada no SQLite (operação atômica)

---

### Módulo: Server — Storage

---

#### TASK-009 — Implementar FTP adapter no servidor

**Módulo:** Server / Storage

**Descrição:**
Implementar o adapter FTP em `storage/ftp.ts` usando a lib `basic-ftp`. O adapter deve expor uma interface comum `StorageAdapter` que permita substituição futura por S3/MinIO sem alteração nas rotas.

**Critérios de Aceite:**

- [ ] Interface `StorageAdapter` definida com métodos: `upload(localPath, remotePath)`, `download(remotePath): ReadableStream`, `exists(remotePath): boolean`
- [ ] `ftp.ts` implementa `StorageAdapter` usando `basic-ftp`
- [ ] Conexão FTP configurada via variáveis de ambiente (`STORAGE_HOST`, `STORAGE_USER`, `STORAGE_PASSWORD`, `STORAGE_BASE_PATH`)
- [ ] `upload()` envia arquivo para o FTP e retorna após conclusão
- [ ] `download()` retorna um stream do arquivo sem carregar em memória
- [ ] `exists()` verifica existência do arquivo no FTP
- [ ] Erros de conexão são propagados com mensagens descritivas
- [ ] Conexão FTP é aberta e fechada por operação (sem conexão persistente)

---

### Módulo: CLI — Security Layer Stub

---

#### TASK-010 — Implementar interface e stub da Security Layer (Alpha)

**Módulo:** CLI / Security

**Descrição:**
Definir a interface `SecurityLayer` e implementar o stub `noop.ts` para a fase Alpha. O stub retorna `true` em todas as verificações e buffer vazio nas assinaturas — sem criptografia. O ponto de extensão `verifyBundle()` garante que a v1.0 seja plugada sem refatoração do Core Engine, conforme a seção 7.2 do PRD.

**Critérios de Aceite:**

- [ ] Interface `SecurityLayer` definida em `security/interface.ts` com os métodos: `verifyBundle(bundleBytes, sig)`, `verifyFile(fileBytes, sig)`, `signBundle(bundleBytes)` conforme assinaturas da seção 7.2 do PRD
- [ ] `noop.ts` implementa `SecurityLayer`: `verifyBundle()` e `verifyFile()` sempre retornam `Promise<true>`, `signBundle()` retorna `Promise<new Uint8Array(0)>`
- [ ] Core Engine usa a interface `SecurityLayer` — nunca importa `noop.ts` diretamente (injeção de dependência)
- [ ] Arquivo `ed25519.ts` criado como stub vazio com comentário `// v1.0`
- [ ] Nenhuma lib de criptografia é importada na Alpha

---

### Módulo: CLI — Core

---

#### TASK-011 — Implementar cálculo de checksum SHA-256

**Módulo:** CLI / Core

**Descrição:**
Implementar `core/checksum.ts` com funções para calcular SHA-256 de arquivos e de buffers em memória. Usado tanto no pull (validação em dois níveis) quanto no push (geração de checksums para o manifest).

**Critérios de Aceite:**

- [ ] `checksumFile(filePath: string): Promise<string>` — retorna hex SHA-256 do arquivo
- [ ] `checksumBuffer(buffer: Uint8Array): Promise<string>` — retorna hex SHA-256 de um buffer
- [ ] Usa WebCrypto nativo do Bun (sem dependências externas)
- [ ] `checksumFile` lê o arquivo em stream para não carregar em memória (importante para EXEs grandes)
- [ ] Erro claro se o arquivo não existir
- [ ] Resultado é string hexadecimal lowercase de 64 caracteres
- [ ] Testes unitários: checksum de arquivo conhecido bate com valor de referência; buffer vazio retorna `e3b0c44...`

---

#### TASK-012 — Implementar parse e validação do manifest

**Módulo:** CLI / Core

**Descrição:**
Implementar `manifest.ts` com parse do JSON recebido do servidor e validação contra JSON Schema usando `ajv`. O schema deve cobrir todos os campos da resposta definida na seção 6.3 do PRD.

**Critérios de Aceite:**

- [ ] `parseManifest(raw: string): Manifest` — faz parse do JSON e valida contra o schema com `ajv`
- [ ] Lança erro descritivo com o campo inválido se a validação falhar
- [ ] Lança erro se o JSON for malformado
- [ ] Tipo TypeScript `Manifest` exportado e usado em todo o CLI (sem `any`)
- [ ] Schema cobre todos os campos do PRD seção 6.3: `version`, `releaseDate`, `description`, `minVersion`, `bundle.file`, `bundle.checksum`, `bundle.signature`, `files[].target`, `files[].checksum`
- [ ] Testes unitários: manifest válido passa; manifest sem campo obrigatório falha com mensagem do campo faltante

---

#### TASK-013 — Implementar comando pull (fluxo base)

**Módulo:** CLI / Core + Commands

**Descrição:**
Implementar o fluxo completo do `pull` conforme a seção 2.1 do PRD: buscar manifest, validar versão, baixar bundle, recalcular SHA-256 localmente, verificar assinatura via Security Layer (stub na Alpha), extrair em diretório temporário, aplicar arquivos e exibir relatório. Sem backup nesta task — o backup é integrado na Fase 2.

**Critérios de Aceite:**

- [ ] `sysupdate pull` busca `GET /manifest/latest` no servidor configurado
- [ ] Aborta com mensagem clara se o servidor estiver inacessível (timeout configurável)
- [ ] Valida o manifest contra o JSON Schema antes de prosseguir
- [ ] Compara versão do manifest com versão no state file — aborta se igual ou menor com mensagem: `"Manifest desatualizado. Versão instalada (X) é igual ou superior ao manifest"`
- [ ] Verifica permissão de escrita em todos os targets antes de iniciar qualquer download
- [ ] Baixa bundle via `GET /bundle/:version` em stream para diretório temporário
- [ ] Recalcula SHA-256 do bundle baixado localmente e valida contra `bundle.checksum` do manifest — aborta e descarta temp se não bater
- [ ] Verifica assinatura do bundle via `verifyBundle(bundleBytes, sig)` — stub na Alpha sempre retorna verdadeiro; aborta se retornar falso
- [ ] Extrai bundle no diretório temporário
- [ ] Para cada arquivo: compara checksum local do target com checksum do manifest — se igual, marca como "pulado"; se diferente ou ausente, copia arquivo para o target
- [ ] Atualiza state file com nova versão após todas as substituições — entrada do histórico inclui `files[]` (substituídos) e `skipped[]` (checksum igual)
- [ ] Remove diretório temporário ao final (sucesso ou falha)
- [ ] Exibe relatório final: arquivos atualizados, pulados
- [ ] `sysupdate pull --version 2.3.0` aplica versão específica

---

#### TASK-014 — Implementar comando connect e push

**Módulo:** CLI / Core + Commands

**Descrição:**
Implementar o comando `sysupdate connect <url>` e o fluxo completo do `push` conforme as seções 2.2 e 7.1 do PRD. O `connect` gera o par de identidade local (stub na Alpha) e registra a instalação no servidor via `POST /connect`. O `push` lê `sysupdate.json`, valida arquivos, compacta bundle, calcula checksums, assina (stub na Alpha) e publica via `POST /publish`. Se não houver par de chaves local, o `push` executa `connect` automaticamente.

**Critérios de Aceite:**

- [ ] `sysupdate connect <url>` gera `install_id` (UUID) e salva no `.env` local (stub na Alpha: sem geração real de chaves Ed25519)
- [ ] `connect` envia `POST /connect` com `{ install_id, client_public_key }` para o servidor
- [ ] `connect` exibe o `install_id` gerado para que o admin possa promover a publisher via `sysupdate-server approve`
- [ ] `sysupdate push` lê `sysupdate.json` do diretório atual
- [ ] Aborta com erro claro se `sysupdate.json` não existir ou for inválido
- [ ] Valida que todos os `localSource` existem — lista os arquivos ausentes no erro
- [ ] Verifica se existe par de chaves local — se não, executa `connect` automaticamente antes de prosseguir
- [ ] Compacta todos os arquivos em bundle `.zip` (`release-{version}.zip`)
- [ ] Calcula SHA-256 de cada arquivo individualmente e do bundle completo
- [ ] Chama `signBundle()` da Security Layer (stub na Alpha — retorna buffer vazio)
- [ ] Envia `POST /publish` com `install_id` no header para autenticação pelo middleware
- [ ] Aborta com `401`/`403` claro se a instalação for inválida ou não tiver role `publisher`
- [ ] Aborta com `409` claro se a versão já existir no servidor
- [ ] Exibe confirmação com versão publicada e checksum do bundle em caso de sucesso

---

### Módulo: CLI — State Manager

---

#### TASK-015 — Implementar State Manager básico

**Módulo:** CLI / Core

**Descrição:**
Implementar `core/state.ts` com leitura e escrita do state file `.sysupdate-state.json`. O state file registra a versão instalada e o histórico completo de pulls, conforme a estrutura da seção 4.3 do PRD. A assinatura do state file é adicionada na Fase 5.

**Critérios de Aceite:**

- [ ] `readState(): State | null` — lê e parseia o state file; retorna `null` se não existir (primeira instalação)
- [ ] `writeState(state: State): void` — escreve o state file de forma atômica (write em tmp → rename)
- [ ] Tipo TypeScript `State` exportado com campos: `installedVersion`, `lastApplied`, `history[]` — cada entrada do histórico contém `version`, `appliedAt`, `files[]` e `skipped[]`
- [ ] State file criado em `.sysupdate-state.json` no diretório de trabalho do CLI
- [ ] Escrita atômica: usa arquivo temporário + rename para evitar state file corrompido em caso de crash
- [ ] Erro claro se o state file existir mas estiver corrompido (JSON inválido)

---

---

## FASE 2 — Alpha · Semanas 4–5

> Backup, state file completo, checksum integrado, rollback e rotação de backups.

---

### Módulo: CLI — Backup Manager

---

#### TASK-016 — Implementar criação de snapshots de backup

**Módulo:** CLI / Core / Backup

**Descrição:**
Implementar `core/backup.ts` com a criação de snapshots versionados antes de substituir arquivos. Cada snapshot copia os arquivos alvo para `.sysupdate-backups/v{versão}_{timestamp}/files/` e salva uma cópia do manifest aplicado, conforme a estrutura da seção 5.3 do PRD.

**Critérios de Aceite:**

- [ ] `createSnapshot(version, manifest, targetFiles[])` cria o diretório do snapshot com formato `v{version}_{timestamp ISO sem ':'}`
- [ ] Cada arquivo alvo é copiado para `files/{caminho_com_separadores_como__}.bak`
- [ ] Separadores de caminho (`/` e `\`) são substituídos por `__` no nome do `.bak`
- [ ] Cópia do manifest (JSON) é salva como `manifest.json` na raiz do snapshot
- [ ] Snapshot só é criado se todos os arquivos a copiar forem copiados com sucesso (atômico)
- [ ] Se um arquivo target não existir (primeira instalação), o snapshot pula esse arquivo sem erro
- [ ] Retorna o caminho do snapshot criado
- [ ] Testes: verificar estrutura do diretório e conteúdo dos arquivos após `createSnapshot`

---

#### TASK-017 — Integrar backup no fluxo do pull

**Módulo:** CLI / Core

**Descrição:**
Integrar o Backup Manager no fluxo do pull (TASK-013). O backup deve ocorrer após extração do bundle e antes de qualquer substituição de arquivo. O relatório final deve incluir o caminho do snapshot criado.

**Critérios de Aceite:**

- [ ] Pull cria snapshot antes de substituir qualquer arquivo
- [ ] Arquivos marcados como "pulados" (checksum igual) não entram no snapshot
- [ ] Se a criação do snapshot falhar, o pull aborta sem substituir nenhum arquivo
- [ ] `--no-backup` pula a criação do snapshot (sem refatoração do fluxo principal)
- [ ] Relatório final exibe: arquivos atualizados, pulados, backups criados e caminho do snapshot
- [ ] State file é atualizado com referência ao snapshot da versão, incluindo listas `files[]` (substituídos) e `skipped[]` (pulados por checksum igual)

---

#### TASK-018 — Implementar rotação automática de backups

**Módulo:** CLI / Core / Backup

**Descrição:**
Após criar um novo snapshot, remover automaticamente os snapshots mais antigos que excedam o limite `keepBackups`. A remoção ocorre do mais antigo para o mais novo. O número de backups retidos é controlado pela flag `--keep-backups` (padrão: 5), conforme seção 6.2 do PRD.

**Critérios de Aceite:**

- [ ] `rotateSnapshots(keepBackups: number)` remove snapshots excedentes do mais antigo para o mais novo
- [ ] Ordenação por timestamp do nome do diretório do snapshot
- [ ] Padrão `keepBackups = 5` se não especificado via `--keep-backups`
- [ ] Rotação ocorre após o snapshot novo ser criado com sucesso
- [ ] Falha na rotação emite warning e não interrompe o fluxo
- [ ] `sysupdate backup:clean` executa rotação manualmente com o `--keep-backups` informado
- [ ] `sysupdate backup:list` lista todos os snapshots com: versão, timestamp, tamanho total em disco

---

#### TASK-019 — Implementar comando rollback

**Módulo:** CLI / Commands

**Descrição:**
Implementar `sysupdate rollback` que restaura o sistema para o snapshot da versão imediatamente anterior, conforme o fluxo da seção 5.4 do PRD. A operação é atômica: o state file só é atualizado após todos os arquivos serem restaurados com sucesso.

**Critérios de Aceite:**

- [ ] `sysupdate rollback` identifica a versão anterior no state file e localiza o snapshot correspondente
- [ ] Valida que os arquivos `.bak` do snapshot existem antes de iniciar a restauração
- [ ] Valida checksum de cada `.bak` contra o manifest salvo no snapshot
- [ ] Copia cada `.bak` de volta para o caminho original (`target`) registrado no manifest do snapshot
- [ ] State file atualizado após todas as restaurações — remove a versão revertida e atualiza `installedVersion`
- [ ] Se qualquer restauração falhar, aborta e não atualiza o state file
- [ ] `sysupdate rollback --to 2.3.0` reverte em cascata: aplica cada rollback na ordem inversa até atingir a versão alvo
- [ ] Aborta com mensagem clara se não houver snapshot disponível para rollback
- [ ] Exibe relatório: versão revertida, arquivos restaurados, nova versão instalada

---

#### TASK-020 — Implementar proteção contra rollback malicioso no state

**Módulo:** CLI / Core

**Descrição:**
Garantir que o CLI nunca aceita um manifest com versão menor ou igual à versão registrada no state file, prevenindo que um manifest antigo no servidor force um downgrade, conforme a seção 4.2 do PRD.

**Critérios de Aceite:**

- [ ] Pull compara `manifest.version` com `state.installedVersion` usando semver
- [ ] Aborta com mensagem exata: `"Manifest desatualizado. Versão instalada ({X}) é igual ou superior ao manifest ({Y})"` se `manifest.version <= installedVersion`
- [ ] Versão `0.0.0` no state file (primeira instalação) aceita qualquer manifest
- [ ] Comparação usa semver correto (ex: `2.10.0 > 2.9.0`, não comparação de string)
- [ ] Testes unitários cobrindo: versão igual, versão menor, versão maior, primeira instalação

---

### Módulo: CLI — Atualização do Self (EXE)

---

#### TASK-021 — Implementar atualização do próprio executável (Windows)

**Módulo:** CLI / Core

**Descrição:**
Tratar o caso em que o bundle inclui o próprio `sysupdate.exe`, conforme a seção 5.1 do PRD. No Windows, o arquivo em execução não pode ser deletado mas pode ser renomeado. O pull deve detectar esse caso e executar a sequência correta.

**Critérios de Aceite:**

- [ ] Pull detecta quando um `target` aponta para o executável em execução (`process.execPath`)
- [ ] Renomeia o executável atual para `sysupdate.exe.bak` antes de copiar o novo
- [ ] Copia o novo executável para o caminho original
- [ ] Processo atual continua rodando normalmente após a substituição
- [ ] A limpeza do `.bak` gerado aqui é delegada à rotina de `cleanupSelfBackup` (TASK-022)
- [ ] Comportamento documentado no relatório final do pull

---

#### TASK-022 — Implementar limpeza do .bak do executável em background

**Módulo:** CLI / Core

**Descrição:**
Na inicialização do CLI, disparar em background (sem `await`) a rotina `cleanupSelfBackup()` que move `sysupdate.exe.bak` para o diretório de backups versionados, conforme a seção 5.2 do PRD. Falha não deve impactar o comando principal.

**Critérios de Aceite:**

- [ ] `cleanupSelfBackup()` é chamada sem `await` no início do `main.ts`, antes de processar qualquer comando
- [ ] Verifica existência de `sysupdate.exe.bak` no mesmo diretório do executável
- [ ] Se existir: move para `.sysupdate-backups/v{versão_anterior}/files/`
- [ ] Se não existir: encerra silenciosamente
- [ ] Falha na limpeza emite apenas `log.warn` — nunca lança exceção nem interrompe o comando
- [ ] Comando principal (`runCommand`) é executado imediatamente após o disparo, sem aguardar

---

---

## FASE 3 — Alpha · Semanas 6–7

> Flags de operação, testes E2E e hardening do fluxo.

---

### Módulo: CLI — Flags e UX

---

#### TASK-023 — Implementar flag --dry-run

**Módulo:** CLI / Commands

**Descrição:**
Implementar suporte à flag global `--dry-run` em todos os subcomandos. No modo dry-run, o CLI simula toda a operação — incluindo download, validações e comparações de checksum — sem alterar nenhum arquivo nem o state file.

**Critérios de Aceite:**

- [ ] `--dry-run` aceito em `pull`, `push`, `rollback`, `backup:clean`
- [ ] Pull em dry-run: baixa e valida o bundle normalmente, compara checksums, mas não substitui nenhum arquivo e não atualiza o state file
- [ ] Push em dry-run: valida arquivos locais e monta o bundle mas não envia para o servidor
- [ ] Rollback em dry-run: valida o snapshot e lista o que seria restaurado, sem restaurar
- [ ] Relatório ao final claramente indica `[DRY-RUN]` em cada ação que seria executada
- [ ] Nenhum diretório temporário persiste após dry-run

---

#### TASK-024 — Implementar flag --verbose

**Módulo:** CLI / Commands

**Descrição:**
Implementar suporte à flag global `--verbose` que habilita log detalhado de cada etapa do fluxo. O verbose deve incluir timestamps, checksums calculados, caminhos absolutos e resultado de cada operação.

**Critérios de Aceite:**

- [ ] `--verbose` aceito em todos os subcomandos
- [ ] Sem `--verbose`, output é conciso: apenas marcos principais e resultado final
- [ ] Com `--verbose`, cada etapa exibe: timestamp, operação, detalhes (checksum, caminho, tamanho)
- [ ] Logs verbose vão para `stderr` para não poluir stdout em pipes
- [ ] Pull verbose exibe: URL consultada, versão do manifest, resultado de cada checksum, resultado da verificação de assinatura, cada arquivo processado
- [ ] Push verbose exibe: cada arquivo empacotado com checksum, tamanho do bundle, resultado do upload

---

#### TASK-025 — Implementar comando status

**Módulo:** CLI / Commands

**Descrição:**
Implementar `sysupdate status` que exibe um resumo do estado atual da instalação: versão instalada, data do último pull, histórico de versões e snapshots de backup disponíveis.

**Critérios de Aceite:**

- [ ] Exibe `installedVersion` e `lastApplied` do state file
- [ ] Exibe histórico das últimas N versões aplicadas (padrão: 5), incluindo `files[]` e `skipped[]` por entrada
- [ ] Lista snapshots disponíveis em `.sysupdate-backups/` com versão, data e tamanho
- [ ] Se state file não existir, exibe `"Nenhuma versão instalada"`
- [ ] Output formatado e legível no terminal (sem dependência de lib de UI)

---

### Módulo: Testes

---

#### TASK-026 — Implementar testes E2E do fluxo connect/pull/push/rollback

**Módulo:** Tests

**Descrição:**
Implementar testes E2E que exercitam o fluxo completo: connect da instalação, push de um bundle pelo publisher, pull pelo cliente, verificação de arquivos aplicados, rollback e verificação de restauração. Os testes usam um servidor local e FTP mock/local.

**Critérios de Aceite:**

- [ ] Teste E2E: connect → push de bundle com 2 arquivos → pull pelo cliente → verificar arquivos no target → verificar state file atualizado (com `files[]` e `skipped[]`)
- [ ] Teste E2E: push sem par de chaves local → connect automático → push concluído
- [ ] Teste E2E: pull com bundle corrompido (checksum inválido) → aborta → nenhum arquivo alterado
- [ ] Teste E2E: pull com assinatura inválida no bundle → aborta → nenhum arquivo alterado (cobrir com mock que retorna `false` no `verifyBundle`)
- [ ] Teste E2E: pull de versão já instalada → aborta com mensagem de versão igual
- [ ] Teste E2E: pull → rollback → verificar arquivos restaurados e state file revertido
- [ ] Teste E2E: pull com arquivo em target inexistente (primeira instalação) → cria arquivo
- [ ] Teste E2E: pull com arquivo já correto (checksum igual) → arquivo pulado, registrado em `skipped[]`
- [ ] Teste E2E: instalação com role `pending` tenta push → retorna `403`
- [ ] Teste E2E: instalação revogada tenta qualquer operação autenticada → retorna `401`
- [ ] Setup de FTP local para isolar testes de infra real
- [ ] Testes rodam com `bun test` sem dependência de FTP real

---

#### TASK-027 — Testes unitários de checksum, state e manifest

**Módulo:** Tests

**Descrição:**
Cobrir com testes unitários os módulos críticos: `checksum.ts`, `state.ts` e `manifest.ts`.

**Critérios de Aceite:**

- [ ] `checksum.ts`: SHA-256 de arquivo conhecido bate com valor de referência; buffer vazio retorna `e3b0c44...`
- [ ] `state.ts`: `readState` retorna `null` para arquivo inexistente; `writeState` → `readState` retorna o mesmo objeto incluindo `skipped[]`; estado corrompido lança erro
- [ ] `manifest.ts`: manifest válido passa validação; manifest sem campo `version` falha com mensagem clara; JSON inválido lança parse error
- [ ] Proteção rollback malicioso: versão manifest < instalada → rejeita; versão manifest > instalada → aceita; versão igual → rejeita
- [ ] Cobertura mínima de 80% nos módulos cobertos

---

---

## FASE 4 — v1.0 · Semanas 8–9

> Security Layer Ed25519 completa: identidade por instalação, comunicação assinada por request, roles, re-assinatura de bundles pelo servidor e chave pública embutida no build.

---

### Módulo: Security — Ed25519

---

#### TASK-028 — Implementar geração de chaves Ed25519 no servidor (primeiro boot)

**Módulo:** Server / Security

**Descrição:**
Na primeira inicialização do servidor, gerar automaticamente o par de chaves Ed25519 e salvar no `.env` do servidor, conforme a seção 7.4 do PRD. A chave pública é obtida manualmente pelo admin via `sysupdate-server pubkey` e embutida no EXE do CLI em tempo de compilação via secret do CI. A chave privada nunca sai do servidor e nunca é exposta via HTTP.

**Critérios de Aceite:**

- [ ] Servidor detecta ausência das chaves no `.env` na inicialização e gera o par automaticamente via WebCrypto
- [ ] Chave privada salva como `SERVER_PRIVATE_KEY` no `.env` (base64) — nunca exposta via rota HTTP
- [ ] Chave pública salva como `SERVER_PUBLIC_KEY` no `.env` (base64)
- [ ] Servidor exibe a chave pública no log de inicialização com instrução para o admin
- [ ] Chaves nunca são geradas novamente se já existirem no `.env`
- [ ] Comando `sysupdate-server pubkey` imprime a chave pública no terminal — admin cola no secret do CI como `ED25519_PUBLIC_KEY`
- [ ] CI injeta a chave pública no build via variável de ambiente (nunca via HTTP em runtime)

---

#### TASK-029 — Implementar geração do par Ed25519 no connect da CLI

**Módulo:** CLI / Security

**Descrição:**
Substituir o stub do `connect` (TASK-014) pela implementação real: gerar par Ed25519 local via WebCrypto, salvar a chave privada localmente e enviar a chave pública ao servidor via `POST /connect`, conforme a seção 7.1 do PRD.

**Critérios de Aceite:**

- [ ] `connect` gera par Ed25519 via WebCrypto nativo do Bun
- [ ] Chave privada salva localmente — nunca enviada ao servidor
- [ ] `POST /connect` envia `{ install_id, client_public_key }` — chave pública em base64
- [ ] `install_id` é um UUID gerado localmente e salvo persistentemente
- [ ] Chave pública do servidor (`ED25519_PUBLIC_KEY`) já está embutida no binário (injetada em tempo de build — nunca buscada via HTTP)
- [ ] Testes: par gerado é válido para sign/verify; `install_id` persiste entre execuções

---

#### TASK-030 — Implementar middleware de autenticação Ed25519 real no servidor

**Módulo:** Server / Middleware

**Descrição:**
Substituir o stub do middleware de auth (TASK-005) pela implementação real: verificar assinatura Ed25519 do request, validar timestamp e nonce contra replay attacks, e checar role da instalação, conforme a seção 7.2 — Camada 2 do PRD.

**Critérios de Aceite:**

- [ ] Middleware lê `install_id`, `timestamp`, `nonce`, `body_hash` e `signature` do header da requisição
- [ ] Busca a chave pública registrada para o `install_id` no SQLite
- [ ] Verifica a assinatura Ed25519 com WebCrypto usando a chave pública da instalação
- [ ] Rejeita com `401` se a assinatura for inválida
- [ ] Rejeita com `401` se o `timestamp` estiver fora da janela de 30 segundos
- [ ] Rejeita com `401` se o `nonce` já tiver sido visto (persiste nonces recentes em memória ou SQLite)
- [ ] Rejeita com `403` se o role da instalação for insuficiente para a rota
- [ ] Atualiza `last_seen` da instalação a cada requisição autenticada
- [ ] Testes: assinatura válida → aceita; timestamp expirado → rejeita; nonce reutilizado → rejeita; role insuficiente → 403

---

#### TASK-031 — Implementar assinatura de bundles no push e re-assinatura no servidor

**Módulo:** CLI / Security + Server / Security

**Descrição:**
Implementar `signBundle()` real em `security/ed25519.ts` no CLI (assina com chave privada da instalação) e implementar a re-assinatura pelo servidor em `POST /publish` (valida assinatura do publisher e re-assina com chave privada do próprio servidor), conforme a seção 7.1 — Camada 4 do PRD. O servidor é o único trust anchor — consumers validam a assinatura do servidor, não a do publisher.

**Critérios de Aceite:**

- [ ] `signBundle(bundleBytes)` em `ed25519.ts` assina o SHA-256 do bundle com a chave privada local via WebCrypto
- [ ] `POST /publish` valida a assinatura do publisher com a chave pública registrada para o `install_id`
- [ ] Servidor rejeita o bundle com `400` se a assinatura do publisher for inválida
- [ ] Servidor rejeita se a versão enviada for menor ou igual à última publicada (sem downgrade)
- [ ] Servidor calcula SHA-256 do bundle e re-assina com a chave privada do próprio servidor
- [ ] Re-assinatura do servidor salva como `release-{version}.zip.sig` no FTP
- [ ] `bundle.signature` no manifest aponta para o arquivo `.sig` re-assinado pelo servidor
- [ ] `published_by` registrado no SQLite com o `install_id` do publisher (audit log)
- [ ] `noop.ts` continua funcionando para testes sem chave configurada

---

#### TASK-032 — Implementar verificação Ed25519 no pull

**Módulo:** CLI / Security

**Descrição:**
Implementar `verifyBundle()` real em `security/ed25519.ts` no CLI. A chave pública do servidor está embutida no EXE em tempo de compilação — nunca buscada via HTTP em runtime, eliminando o vetor DNS spoofing. Pull aborta se a assinatura do servidor for inválida, conforme a seção 7.1 — Camada 4 do PRD.

**Critérios de Aceite:**

- [ ] `verifyBundle(bundleBytes, sig)` verifica a assinatura do servidor usando a chave pública embutida no binário via WebCrypto
- [ ] Chave pública do servidor lida de variável de ambiente `ED25519_PUBLIC_KEY` injetada em tempo de build — nunca buscada via HTTP
- [ ] Pull aborta com erro claro se `verifyBundle()` retornar `false`
- [ ] Plugado sem refatoração no Core Engine — apenas substitui `noop.ts` por `ed25519.ts`
- [ ] Testes unitários: assinatura válida → aceita; assinatura modificada → rejeita; chave errada → rejeita

---

#### TASK-033 — Implementar comunicação assinada por request no push

**Módulo:** CLI / Security

**Descrição:**
No push e em outros requests autenticados, a CLI assina cada request com a chave privada local antes de enviar, incluindo `install_id`, `timestamp`, `nonce` e `body_hash` no header, conforme a seção 7.2 — Camada 2 do PRD.

**Critérios de Aceite:**

- [ ] Função `signRequest(payload, privateKey)` implementada em `security/ed25519.ts`
- [ ] Payload de assinatura inclui: `install_id`, `timestamp` (ISO), `nonce` (UUID único por request), `body_hash` (SHA-256 do body)
- [ ] Assinatura adicionada ao header de todos os requests autenticados enviados pela CLI
- [ ] Testes: request com timestamp de 31s atrás → servidor rejeita; mesmo nonce reenviado → servidor rejeita

---

#### TASK-034 — Implementar gerenciamento de roles via CLI do servidor

**Módulo:** Server / Admin

**Descrição:**
Implementar os comandos administrativos do servidor para listar instalações, promover publishers e revogar instalações, conforme a seção 7.1 — Camada 3 do PRD.

**Critérios de Aceite:**

- [ ] `sysupdate-server list` lista todas as instalações com: `install_id`, `label`, `role`, `registered_at`, `last_seen`, `revoked`
- [ ] `sysupdate-server approve <install_id>` promove a instalação para role `publisher`
- [ ] `sysupdate-server revoke <install_id>` seta `revoked = 1` — instalação perde acesso imediatamente
- [ ] Instalação revogada retorna `401` em qualquer request autenticado
- [ ] Instalação com role `pending` retorna `403` em rotas protegidas
- [ ] Comandos leem diretamente do SQLite local — sem HTTP
- [ ] Instalação recém-registrada via `POST /connect` começa sempre com role `pending` — publish exige aprovação explícita do admin

---

---

## FASE 5 — v1.1 · Semana 10

> State file assinado, FTPS/SFTP, S3/MinIO e code signing do EXE.

---

### Módulo: CLI — State File Assinado

---

#### TASK-035 — Proteger state file com assinatura Ed25519

**Módulo:** CLI / Core + Security

**Descrição:**
A partir da v1.1, o state file é assinado com a chave privada da instalação. O CLI rejeita state files com versão manipulada manualmente, conforme a seção 7.5 do PRD.

**Critérios de Aceite:**

- [ ] `writeState()` assina o conteúdo do state file com a chave privada local (Ed25519) após escrita
- [ ] `readState()` verifica a assinatura antes de retornar o estado — lança erro se inválida
- [ ] State file corrompido ou com assinatura inválida resulta em erro claro: `"State file inválido ou adulterado"`
- [ ] Comportamento backward-compatible: state file sem assinatura (Alpha) é aceito com warning, solicitando pull para assinar
- [ ] Testes: state file assinado → aceito; state file com `installedVersion` modificada manualmente → rejeitado

---

### Módulo: Server — Storage

---

#### TASK-036 — Adicionar suporte a FTPS/SFTP no servidor

**Módulo:** Server / Storage

**Descrição:**
Estender o `ftp.ts` adapter para suportar FTPS (FTP sobre TLS) e adicionar adapter SFTP. Seleção via variável de ambiente `STORAGE_PROTOCOL`.

**Critérios de Aceite:**

- [ ] `STORAGE_PROTOCOL=ftps` usa FTP com TLS explícito
- [ ] `STORAGE_PROTOCOL=sftp` usa SFTP (SSH File Transfer Protocol)
- [ ] `STORAGE_PROTOCOL=ftp` mantém comportamento atual (retrocompatível)
- [ ] Interface `StorageAdapter` não é alterada
- [ ] Erro claro se `STORAGE_PROTOCOL` tiver valor inválido na inicialização

---

#### TASK-037 — Implementar S3/MinIO adapter no servidor

**Módulo:** Server / Storage

**Descrição:**
Implementar `storage/s3.ts` usando `aws-sdk v3` para suporte a S3 e MinIO. Selecionado via `STORAGE_PROVIDER=s3` no `.env`.

**Critérios de Aceite:**

- [ ] `s3.ts` implementa a interface `StorageAdapter`
- [ ] `STORAGE_PROVIDER=s3` ativa o adapter S3/MinIO
- [ ] Variáveis de ambiente adicionadas ao `.env.example`: `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` (para MinIO), `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- [ ] `upload()` faz multipart upload para o bucket configurado
- [ ] `download()` retorna stream do objeto S3
- [ ] `exists()` verifica existência do objeto via `HeadObject`
- [ ] Compatível com MinIO via `S3_ENDPOINT` customizado

---

### Módulo: Build — Code Signing

---

#### TASK-038 — Code signing do EXE Windows (Authenticode)

**Módulo:** Build

**Descrição:**
Assinar o `sysupdate.exe` com certificado Authenticode para que o Windows valide o binário antes de executar. A assinatura ocorre no pipeline CI após o build.

**Critérios de Aceite:**

- [ ] Certificado Authenticode (.pfx) armazenado em secret do CI (nunca no repositório)
- [ ] Pipeline CI executa `signtool.exe sign` após `bun build --compile`
- [ ] EXE assinado passa na verificação `signtool verify /pa sysupdate.exe`
- [ ] Pipeline falha explicitamente se a assinatura não for concluída
- [ ] Documentação do processo de renovação do certificado

---

---

## FASE 6 — v1.x · Semanas 11–12

> Build multi-plataforma, DLL Windows e pipeline CI/CD.

---

### Módulo: Build e Distribuição

---

#### TASK-039 — Build EXE multi-plataforma

**Módulo:** Build

**Descrição:**
Configurar o pipeline de build para compilar o CLI para Windows x64, Linux x64 e macOS arm64 usando `bun build --compile`, conforme os targets da seção 9.1 do PRD. A chave pública Ed25519 do servidor é injetada via variável de ambiente no momento do build — nunca buscada via HTTP em runtime.

**Critérios de Aceite:**

- [ ] Build para `bun-windows-x64` gera `sysupdate.exe`
- [ ] Build para `bun-linux-x64` gera `sysupdate` (Linux)
- [ ] Build para `bun-darwin-arm64` gera `sysupdate` (macOS)
- [ ] `ED25519_PUBLIC_KEY` injetada como variável de ambiente no binário durante o build (obtida via `sysupdate-server pubkey`, nunca via HTTP em runtime)
- [ ] Binários resultantes executam sem runtime Bun instalado na máquina alvo
- [ ] Tamanho dos binários documentado após cada build

---

#### TASK-040 — Implementar DLL Windows com API pública

**Módulo:** Build

**Descrição:**
Criar entry point separado (`dll-main.ts`) que compila para `sysupdate.dll`, expondo uma API pública para integração com sistemas ERP Windows sem necessidade de invocar o CLI via shell.

**Critérios de Aceite:**

- [ ] `dll-main.ts` expõe funções: `pull(options)`, `push(options)`, `rollback(options)`, `status()`
- [ ] Build: `bun build --compile --target=bun-windows-x64 dll-main.ts` gera `sysupdate.dll`
- [ ] API pública documentada com tipos TypeScript e exemplos de uso
- [ ] Funções retornam objetos estruturados (não strings de terminal)
- [ ] Erros retornam objeto `{ success: false, error: string }` — sem exceções não tratadas atravessando a fronteira da DLL

---

#### TASK-041 — Configurar pipeline CI/CD

**Módulo:** Build / CI

**Descrição:**
Configurar pipeline CI/CD (GitHub Actions ou equivalente) que executa testes, builda os binários para todos os targets, injeta a chave pública Ed25519 do servidor, aplica code signing no Windows e publica os artefatos, conforme a seção 7.4 do PRD.

**Critérios de Aceite:**

- [ ] Pipeline executa em push para `main` e em criação de tags `v*`
- [ ] Etapas na ordem: lint → testes unitários → testes E2E → build multi-plataforma → code signing (Windows) → upload de artefatos
- [ ] Falha em qualquer etapa interrompe o pipeline
- [ ] Artefatos publicados: `sysupdate.exe`, `sysupdate` (Linux), `sysupdate` (macOS), `sysupdate.dll`
- [ ] Secrets configurados: `ED25519_PUBLIC_KEY` (obtida via `sysupdate-server pubkey`), `AUTHENTICODE_PFX`, `AUTHENTICODE_PASSWORD`
- [ ] Pipeline documentado no README com instruções para configurar os secrets e o fluxo de setup inicial (seção 7.4 do PRD)

---

---

## FASE 7 — v2.0 · Futuro

> Criptografia do manifest: X25519 + AES-256-GCM.

---

### Módulo: Security — Criptografia

---

#### TASK-042 — Implementar criptografia do manifest (X25519 + AES-256-GCM)

**Módulo:** CLI + Server / Security

**Descrição:**
Cifrar o manifest com AES-256-GCM. A chave AES é gerada por pacote e cifrada com a chave pública X25519 do CLI. Leitura indevida do manifest em trânsito ou no storage passa a ser impossível, conforme a seção 7.5 do PRD.

**Critérios de Aceite:**

- [ ] Par de chaves X25519 gerado no servidor na inicialização (análogo ao Ed25519)
- [ ] Chave pública X25519 embutida no EXE do CLI no momento do build (nunca buscada via HTTP)
- [ ] Para cada publish: chave AES-256 gerada aleatoriamente, manifest cifrado com AES-GCM, chave AES cifrada com X25519 da chave pública do CLI
- [ ] Manifest cifrado e chave AES cifrada publicados no storage junto com o bundle
- [ ] CLI decifra a chave AES com sua chave privada X25519 e decifra o manifest
- [ ] Servidor nunca consegue ler o manifest decifrado (forward secrecy por design)
- [ ] Interface `SecurityLayer` estendida sem quebrar Ed25519 existente
- [ ] Testes: manifest cifrado → decifrado pelo CLI → igual ao original; terceiro sem chave privada não consegue decifrar

---

---

## FASE 8 — v3.0 · Futuro

> Download por chunks para bundles grandes.

---

### Módulo: CLI — Core

---

#### TASK-043 — Download do bundle por chunks (bundles grandes)

**Módulo:** CLI / Core

**Descrição:**
Otimizar o download do bundle para suportar conexões lentas e bundles grandes, dividindo o download em chunks com retry por chunk em caso de falha de rede.

**Critérios de Aceite:**

- [ ] Download feito em chunks de tamanho configurável (padrão: 4MB)
- [ ] Progresso de download exibido em tempo real (bytes baixados / total)
- [ ] Chunk com falha de rede é retentado até N vezes (configurável, padrão: 3) antes de abortar
- [ ] Chunks baixados com sucesso não são rebaixados em caso de retry
- [ ] Validação SHA-256 do bundle completo ocorre após todos os chunks serem montados
- [ ] Servidor suporta `Range` header para servir chunks via `GET /bundle/:version`
- [ ] Retrocompatível: servidor sem suporte a `Range` faz download completo como fallback

---

*Fim do documento — 43 tasks | Última revisão: Março / 2026 — sincronizado com PRD_SysUpdate_CLI.md*
