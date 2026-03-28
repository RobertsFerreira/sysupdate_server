# SysUpdate CLI — PDR

> Ferramenta de Atualização de Sistemas com Backup e Rollback de Arquivos

| Campo | Valor |
|---|---|
| Versão atual | Alpha — sem assinatura |
| Data | Março / 2026 |
| Stack | Bun · TypeScript · FTP / S3 (MinIO) |
| Distribuição | Binário único (EXE / DLL) — push / pull |
| Escopo Alpha | Fluxo completo com bundle como padrão, sem segurança criptográfica |
| Escopo v1.0 | Alpha + assinatura Ed25519 |
| Escopo v2.0 | v1 + criptografia do manifest (X25519 + AES-256-GCM) |

---

## 1. Visão Geral

O SysUpdate CLI é uma ferramenta de linha de comando desenvolvida em Bun + TypeScript, distribuída como um único binário standalone (EXE / DLL), que automatiza o processo de atualização de sistemas. O objetivo central é eliminar erros manuais em deploys de arquivos, garantir rastreabilidade completa e oferecer rollback seguro.

> ⚠ Banco de dados, migrations e integrações com DB estão fora do escopo de todas as versões planejadas até v2 e serão avaliados separadamente.

### 1.1 Problema a Resolver

- Deploys manuais propensos a erros — arquivos esquecidos, caminhos errados, permissões
- Ausência de backup antes da substituição de arquivos críticos
- Sem histórico rastreável de quais versões foram aplicadas em cada máquina
- Processo diferente e não padronizado entre publisher e cliente

### 1.2 Evolução Planejada de Segurança

A segurança é adicionada de forma incremental após validação do fluxo base:

| Fase | Segurança | Detalhe |
|---|---|---|
| Alpha | Nenhuma | Fluxo completo sem assinatura. Manifest e arquivos em texto claro. Foco em validar o fluxo. |
| v1.0 | Assinatura Ed25519 | Manifest e arquivos assinados. CLI verifica antes de qualquer operação. Chave pública embutida no EXE. |
| v2.0 | Criptografia do manifest | Manifest cifrado com X25519 + AES-256-GCM. Leitura indevida do manifest passa a ser impossível. |

> ℹ O código já prevê o ponto de extensão `verifyManifest()` que na Alpha sempre retorna verdadeiro. Na v1.0 a implementação Ed25519 é plugada sem refatoração.

---

## 2. Arquitetura Geral

A ferramenta é organizada em camadas bem definidas para permitir extensibilidade de provedores de storage e adição futura de camadas de segurança sem impacto no Core Engine.

| Camada | Responsabilidade | Tecnologia |
|---|---|---|
| CLI / Commands | Parsing de argumentos, roteamento de subcomandos | Bun + citty |
| Core Engine | Orquestração: backup, download, checksum, substituição | TypeScript puro |
| Security Layer | `verifyManifest()` e `verifyFile()` — stub na Alpha, real na v1 | WebCrypto (Ed25519) |
| Backup Manager | Cópia versionada dos arquivos antes de sobrescrever | fs nativo + zlib |
| State Manager | Persiste histórico de versões aplicadas em JSON local | fs nativo |
| **Server** | **Proxy HTTP entre cliente e storage — armazena metadados no SQLite, autentica registro via `REGISTER_SECRET` e push via API Key vinculada a IP** | **Bun HTTP** |
| Build | Compilação para EXE standalone e DLL | bun build --compile |

### 2.1 Fluxo: pull (cliente aplica update)

1. Faz `GET /manifest/latest` no servidor (URL embutida no EXE — sem autenticação)
2. Valida a resposta contra o JSON Schema
3. Verifica assinatura via `verifyManifest()` — stub na Alpha, Ed25519 na v1
4. Compara versão retornada com versão registrada no state file — aborta se igual ou menor
5. Faz `GET /bundle/:version` no servidor — recebe stream do `.zip`
6. Valida o checksum SHA-256 do bundle completo — aborta se não bater
7. Extrai o bundle em diretório temporário
8. Para cada arquivo extraído: calcula checksum local via target → se igual, pula → se diferente ou ausente, faz backup → move o novo para o target
9. Atualiza o state file com a nova versão aplicada
10. Remove o diretório temporário
11. Exibe relatório: arquivos atualizados, pulados e backups criados

### 2.2 Fluxo: push (publisher envia update)

1. Lê o `sysupdate.json` local com `localSource` e `target` de cada arquivo
2. Valida que todos os `localSource` existem localmente
3. Verifica se existe API Key salva localmente — se não, chama `POST /auth/register` automaticamente, salva a key retornada
4. Compacta todos os arquivos em um único bundle `.zip`
5. Calcula SHA-256 de cada arquivo e do bundle completo
6. Assina o bundle — stub na Alpha, Ed25519 na v1
7. Faz `POST /publish` no servidor com `X-Api-Key` no header — envia bundle + metadados
8. Servidor salva bundle no storage e metadados no SQLite
9. Exibe confirmação com versão publicada e checksum do bundle

---

## 3. sysupdate.json — Arquivo de Trabalho do Publisher

O `sysupdate.json` é um arquivo local da máquina do publisher — nunca é publicado no servidor. Serve como instrução para a CLI montar e enviar o bundle. O servidor armazena os metadados internamente no SQLite e os serve via API dinamicamente.

> ⚠ O `sysupdate.json` fica no repositório do projeto do publisher junto com o código. Nunca vai para o servidor de updates.

| Campo | Tipo | Descrição |
|---|---|---|
| `version` | string | Versão semver do pacote (ex: 2.4.1) |
| `releaseDate` | string | Data ISO 8601 do pacote |
| `description` | string | Descrição legível do update |
| `minVersion` | string | Versão mínima do CLI necessária para aplicar este pacote |
| `files[].localSource` | string | Caminho local do arquivo na máquina do publisher |
| `files[].target` | string | Caminho absoluto de destino na máquina alvo |

### 3.1 Exemplo

```json
{
  "version":     "2.4.1",
  "releaseDate": "2026-03-21T14:00:00Z",
  "description": "Correção de cálculo de impostos",
  "minVersion":  "1.0.0",
  "files": [
    {
      "localSource": "C:/dev/build/app.exe",
      "target":      "C:/SistemaX/app.exe"
    },
    {
      "localSource": "C:/dev/config/settings.json",
      "target":      "C:/SistemaX/config/settings.json"
    }
  ]
}
```

---

## 4. State File e Lógica de Checksum

O state file é um JSON local (`.sysupdate-state.json`) que registra o histórico de versões aplicadas na máquina. É a fonte de verdade do CLI sobre o que está instalado. O servidor é a fonte de verdade sobre o que deve ser instalado.

### 4.1 Lógica de Checksum no Pull

O pull tem dois níveis de validação — bundle e arquivo individual:

**Nível 1 — bundle completo:**
```
sha256(release-2.4.1.zip) == resposta.bundle.checksum?
  sim → extrai e processa
  não → descarta, aborta (download corrompido ou adulterado)
```

**Nível 2 — por arquivo após extração:**
```
resposta.files[i].target   = 'C:/SistemaX/app.exe'
resposta.files[i].checksum = 'e3b0c44...'

sha256('C:/SistemaX/app.exe') == 'e3b0c44...'?
  sim        → arquivo já está correto, pula
  não        → faz backup → move o arquivo extraído para o target
  não existe → move o arquivo extraído para o target (primeira instalação)
```

| Momento | Comparação | Resultado |
|---|---|---|
| Após baixar o bundle | sha256 do bundle vs checksum retornado pelo servidor | Iguais → extrai. Diferentes → aborta. |
| Após extrair, antes de substituir | sha256 do arquivo local (via target) vs checksum do arquivo | Iguais → pula. Diferentes ou ausente → substitui. |

### 4.2 Proteção contra Rollback Malicioso

O CLI nunca aceita uma resposta do servidor com versão menor ou igual à versão já registrada no state file. Isso impede que alguém publique uma versão antiga no servidor para forçar um downgrade:

```
versão do manifest (2.3.0) <= versão instalada (2.4.1)
  → aborta: 'Manifest desatualizado. Versão instalada (2.4.1)
    é igual ou superior ao manifest'

versão do manifest (2.4.1) > versão instalada (2.3.0)
  → prossegue com o pull normalmente
```

> ⚠ O state file não é editável pelo usuário para fins de segurança — qualquer edição manual que tente rebaixar a versão registrada é detectada e rejeitada. Na v1 o state file será assinado junto com o manifest.

### 4.2 Estrutura do State File

```json
{
  "installedVersion": "2.4.1",
  "lastApplied":      "2026-03-21T14:32:10Z",
  "history": [
    {
      "version":   "2.4.1",
      "appliedAt": "2026-03-21T14:32:10Z",
      "files":     ["app.exe", "config/settings.json"],
      "skipped":   []
    },
    {
      "version":   "2.3.0",
      "appliedAt": "2026-02-10T09:15:00Z",
      "files":     ["app.exe"],
      "skipped":   ["config/settings.json"]
    }
  ]
}
```

---

## 5. Backup e Rollback

### 5.1 CLI no Bundle

O próprio executável do CLI pode ser incluído no bundle como qualquer outro arquivo. O publisher declara no `sysupdate.json`:

```json
{
  "localSource": "C:/tools/sysupdate.exe",
  "target":      "C:/SistemaX/sysupdate.exe"
}
```

Como o Windows não permite deletar um EXE em execução mas permite renomeá-lo, o pull renomeia o executável atual para `.bak` antes de copiar o novo:

```
pull detecta target == executável em execução
  → renomeia sysupdate.exe → sysupdate.exe.bak   (Windows permite)
  → copia o novo sysupdate.exe para o lugar
  → processo atual continua rodando da versão antiga em memória
  → próxima invocação pelo ERP já usa a versão nova
```

### 5.2 Limpeza do .bak em Background

Na inicialização do CLI, antes de processar qualquer comando, é disparada uma rotina de limpeza em background — sem bloquear a execução principal:

```typescript
// dispara sem await — não bloqueia o comando principal
cleanupSelfBackup().catch(err => log.warn('backup cleanup failed', err))

// processa o comando imediatamente
await runCommand(args)
```

```
cleanupSelfBackup():
  → verifica se existe sysupdate.exe.bak no mesmo diretório
  → existe → move para .sysupdate-backups/v{versão_anterior}/files/
  → não existe → encerra silenciosamente
```

Se a limpeza falhar, só emite um warning — nunca interrompe o comando principal.

### 5.3 Estrutura de Backup

Antes de qualquer substituição, o Backup Manager cria um snapshot versionado com timestamp. Os backups ficam em uma pasta oculta no diretório de trabalho do CLI:

```
.sysupdate-backups/
  ├── v2.4.1_2026-03-21T14-32-10/
  │     ├── manifest.json              (cópia do manifest aplicado)
  │     └── files/
  │           ├── app.exe.bak
  │           └── config__settings.json.bak
  └── v2.3.0_2026-02-10T09-15-00/
        ├── manifest.json
        └── files/
              └── app.exe.bak
```

- Cada snapshot é identificado por versão + timestamp ISO
- Separadores de caminho nos nomes de arquivo viram `__` no nome do `.bak`
- A cópia do `manifest.json` no snapshot permite saber exatamente o que estava instalado
- Snapshots além do limite `keepBackups` são removidos do mais antigo para o mais novo

### 5.4 Rollback

O rollback restaura o sistema para o estado do snapshot imediatamente anterior. É atômico — o state file só é atualizado após todos os arquivos serem restaurados com sucesso.

| # | Etapa | Detalhe |
|---|---|---|
| 1 | Identificar snapshot | Lê state file e localiza o snapshot da versão anterior (ou da versão alvo com `--to`) |
| 2 | Validar snapshot | Confirma que os arquivos `.bak` existem e seus checksums batem com o manifest do snapshot |
| 3 | Restaurar arquivos | Copia cada `.bak` de volta para o caminho original registrado no manifest do snapshot |
| 4 | Atualizar state file | Remove a entrada da versão revertida e atualiza `installedVersion` |
| 5 | Relatório | Lista quais arquivos foram restaurados e para qual versão o sistema voltou |

> ℹ `sysupdate rollback` reverte o último pull. `sysupdate rollback --to 2.3.0` reverte em cascata até a versão alvo, aplicando cada down na ordem inversa.

---

## 6. Servidor HTTP

O servidor é um proxy HTTP em Bun que fica entre o cliente e o storage (FTP/S3). O cliente nunca fala diretamente com o FTP. Os metadados de cada release ficam num SQLite local — sem infraestrutura extra.

### 6.1 Rotas

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/manifest/latest` | Nenhuma | Retorna os metadados da versão mais recente. |
| `GET` | `/manifest/:version` | Nenhuma | Retorna os metadados de uma versão específica. |
| `GET` | `/bundle/:version` | Nenhuma | Stream do bundle `.zip` da versão solicitada. |
| `GET` | `/health` | Nenhuma | Healthcheck do servidor. |
| `POST` | `/auth/register` | `X-Register-Secret` | Gera uma API Key vinculada ao IP do solicitante. Chamada automaticamente pela CLI no primeiro push. |
| `POST` | `/publish` | `X-Api-Key` | Recebe bundle + metadados, salva no SQLite e no storage. |

### 6.2 Schema SQLite

```sql
CREATE TABLE releases (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  version         TEXT NOT NULL UNIQUE,
  description     TEXT,
  min_version     TEXT,
  bundle_file     TEXT NOT NULL,
  bundle_checksum TEXT NOT NULL,
  release_date    TEXT NOT NULL,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE release_files (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  release_id INTEGER NOT NULL REFERENCES releases(id),
  target     TEXT NOT NULL,
  checksum   TEXT NOT NULL
);

CREATE TABLE api_keys (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash   TEXT NOT NULL UNIQUE,   -- SHA-256 da key — nunca armazenada em texto claro
  label      TEXT,                   -- nome descritivo (ex: "publisher-ci", "dev-local")
  allowed_ip TEXT NOT NULL,          -- IP vinculado na geração
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_used  TEXT,
  revoked    INTEGER DEFAULT 0       -- 0 = ativa, 1 = revogada
);
```

> ℹ O número de backups retidos no cliente é controlado pela flag `--keep-backups` (padrão: 5). Não é responsabilidade do servidor.

### 6.3 Resposta do /manifest/:version

O servidor monta o JSON dinamicamente a partir do SQLite — sem arquivo estático:

```json
{
  "version":     "2.4.1",
  "releaseDate": "2026-03-21T14:00:00Z",
  "description": "Correção de cálculo de impostos",
  "minVersion":  "1.0.0",
  "bundle": {
    "file":     "release-2.4.1.zip",
    "checksum": "f7c3bc1d808e04732adf..."
  },
  "files": [
    {
      "target":   "C:/SistemaX/app.exe",
      "checksum": "e3b0c44298fc1c..."
    },
    {
      "target":   "C:/SistemaX/config/settings.json",
      "checksum": "a1b2c3d4e5f6..."
    }
  ]
}
```

### 6.4 Autenticação: Register Secret + API Key

O modelo usa dois segredos com escopos completamente separados. O `REGISTER_SECRET` fica no `.env` do servidor e no `.env` da CLI — é a prova de que a instância é legítima. A `API_KEY` é gerada no registro, vinculada ao IP, e é o que de fato autoriza o push. A CLI gerencia isso de forma transparente: o publisher nunca precisa chamar nada manualmente.

**Registro (automático no primeiro push):**

```
POST /auth/register
  X-Register-Secret: <REGISTER_SECRET>

  → servidor valida o header X-Register-Secret
  → captura IP da requisição (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress)
  → verifica se já existe key ativa para esse IP — se sim, rejeita com 409
  → gera key: sysupdate_<32 bytes hex>  (ex: sysupdate_a3f7...)
  → armazena SHA-256(key) + IP + label no SQLite (nunca a key em texto claro)
  → retorna { "key": "sysupdate_a3f7...", "ip": "203.0.113.42" }
    ↑ única vez que a key aparece em texto claro — CLI salva localmente e usa dali pra frente
```

**Push (toda invocação):**

```
POST /publish
  X-Api-Key: sysupdate_a3f7...

  → servidor lê X-Api-Key
  → calcula SHA-256(key recebida)
  → busca no SQLite por key_hash + revoked = 0
  → compara IP da requisição com allowed_ip registrado
  → atualiza last_used
  → libera ou rejeita com 401
```

**Fluxo automático da CLI no push:**

```
sysupdate push
  → existe API Key salva localmente?
      não → chama POST /auth/register com X-Register-Secret
           → salva key retornada no .env local
      sim → usa key existente
  → prossegue com POST /publish usando X-Api-Key
```

**Revogação (operação manual no servidor):**

```sql
-- direto no SQLite do servidor
UPDATE api_keys SET revoked = 1 WHERE allowed_ip = '203.0.113.42';
```

> ℹ A revogação é intencionalm­ente manual e local — não há rota HTTP para isso. Qualquer push subsequente com a key revogada retorna 401 imediatamente. Para reregistrar a mesma máquina, o operador remove ou revoga a entrada existente e a CLI faz o registro automaticamente no próximo push.

O `REGISTER_SECRET` controla quem pode se registrar — distribuído junto com a CLI como variável de ambiente, nunca exposto em rota pública. A `API_KEY` controla quem pode publicar — gerada uma vez por máquina, vinculada ao IP, armazenada apenas como hash. O cliente pull nunca precisa de nenhum dos dois — as rotas de leitura são públicas.

### 6.5 Estrutura do Servidor

```
sysupdate-server/
  ├── src/
  │   ├── routes/
  │   │   ├── manifest.ts    # GET /manifest/:version
  │   │   ├── bundle.ts      # GET /bundle/:version
  │   │   ├── publish.ts     # POST /publish
  │   │   └── auth.ts        # POST /auth/register
  │   ├── middleware/
  │   │   └── apikey.ts      # validação X-Api-Key + IP nas rotas protegidas
  │   ├── db/
  │   │   ├── schema.ts      # criação das tabelas SQLite
  │   │   └── releases.ts    # queries de releases e files
  │   ├── storage/
  │   │   ├── ftp.ts         # adapter FTP
  │   │   └── s3.ts          # adapter S3/MinIO (v1.2)
  │   └── main.ts
  ├── data/
  │   └── sysupdate.db       # SQLite (ignorado pelo VCS)
  └── package.json
```

### 6.6 Configuração do Servidor

```
SERVER_PORT=3000
REGISTER_SECRET=xxxx
STORAGE_PROVIDER=ftp
STORAGE_HOST=ftp.interno.com
STORAGE_USER=admin
STORAGE_PASSWORD=****
STORAGE_BASE_PATH=/releases
```

E no `.env` da CLI (publisher):

```
SERVER_URL=https://updates.interno.com
REGISTER_SECRET=xxxx
```

---

## 7. Security Layer

A Security Layer é isolada do Core Engine via interface. Na Alpha, as funções retornam verdadeiro sem verificar nada. Na v1.0 a implementação Ed25519 é plugada sem alterar nenhuma outra camada.

### 7.1 Interface de Segurança

```typescript
interface SecurityLayer {
  // Alpha: sempre retorna true
  // v1.0:  verifica assinatura Ed25519 com chave pública embutida
  verifyManifest (manifestBytes: Uint8Array, sig: Uint8Array): Promise<boolean>
  verifyFile     (fileBytes: Uint8Array,     sig: Uint8Array): Promise<boolean>

  // Alpha: retorna buffer vazio
  // v1.0:  assina com chave privada do publisher (só no push)
  signManifest   (manifestBytes: Uint8Array): Promise<Uint8Array>
  signFile       (fileBytes: Uint8Array):     Promise<Uint8Array>
}
```

### 7.2 Roadmap de Segurança

| Fase | Mecanismo | Detalhe |
|---|---|---|
| Alpha | Nenhum | `verifyManifest()` e `verifyFile()` sempre retornam true. `signManifest()` e `signFile()` retornam buffer vazio. Sem `.sig` no storage. |
| v1.0 | Ed25519 — assinatura | Publisher assina o bundle com chave privada. CLI verifica com chave pública embutida no EXE. Arquivos `.sig` publicados no servidor junto com o bundle. |
| v1.0 | Proteção do state file | State file assinado junto com o manifest. CLI rejeita state file com versão manipulada. |
| v1.1 | Code signing do EXE | `sysupdate.exe` assinado com certificado Authenticode. SO valida antes de executar. |
| v2.0 | X25519 + AES-256-GCM | Manifest cifrado. Chave AES gerada por pacote, cifrada com X25519 (chave pública do CLI embutida). Leitura indevida do manifest passa a ser impossível. |

> ℹ As chaves Ed25519 e X25519 são geradas pelo servidor na primeira inicialização e salvas no `.env`. A chave pública é embutida no EXE do cliente no momento do build via variável de ambiente no CI. A chave privada nunca sai do servidor.

---

## 8. Interface de Linha de Comando

Todos os subcomandos seguem a convenção: `sysupdate <comando> [flags]`. O binário detecta automaticamente o SO para ajustar separadores de caminho e encoding.

| Fase | Subcomando | Descrição |
|---|---|---|
| Alpha | `pull [--version v]` | Baixa e aplica o pacote mais recente. Com `--version`, aplica uma versão específica. |
| Alpha | `push` | Compacta os arquivos, calcula checksums e publica no servidor. |
| Alpha | `rollback [--to v]` | Reverte o último pull. Com `--to`, reverte em cascata até a versão alvo. |
| Alpha | `status` | Exibe versão instalada, histórico de pulls e snapshots de backup disponíveis. |
| Alpha | `backup:list` | Lista todos os snapshots com data, versão e tamanho em disco. |
| Alpha | `backup:clean` | Remove snapshots além do limite `--keep-backups` manualmente. |

### 8.1 Flags Globais

| Flag | Efeito |
|---|---|
| `--keep-backups <n>` | Número de snapshots de backup a manter (padrão: 5) |
| `--dry-run` | Simula a operação sem alterar nenhum arquivo |
| `--verbose` | Exibe log detalhado de cada etapa |
| `--no-backup` | Pula a criação de backup (não recomendado em produção) |

---

## 9. Build e Distribuição

O Bun compila o projeto em um único executável standalone via `bun build --compile`, sem necessidade de runtime instalado na máquina do cliente. A chave pública Ed25519 é injetada no binário como variável de ambiente no momento do build a partir da v1.0.

### 9.1 Targets de Compilação

| Target | Artefato | Comando |
|---|---|---|
| Windows x64 | `sysupdate.exe` | `bun build --compile --target=bun-windows-x64 src/main.ts` |
| Linux x64 | `sysupdate` | `bun build --compile --target=bun-linux-x64 src/main.ts` |
| macOS arm64 | `sysupdate` | `bun build --compile --target=bun-darwin-arm64 src/main.ts` |
| DLL Windows | `sysupdate.dll` | Entry point separado expondo API pública via exports |

### 9.2 Estrutura do Repositório

```
sysupdate/
  ├── cli/                          # binário do cliente
  │   ├── src/
  │   │   ├── commands/
  │   │   │   ├── pull.ts
  │   │   │   ├── push.ts
  │   │   │   ├── rollback.ts
  │   │   │   ├── status.ts
  │   │   │   └── backup.ts
  │   │   ├── core/
  │   │   │   ├── engine.ts         # orquestrador principal
  │   │   │   ├── backup.ts         # criação e rotação de snapshots
  │   │   │   ├── state.ts          # leitura/escrita do state file
  │   │   │   └── checksum.ts       # SHA-256 de arquivos
  │   │   ├── security/
  │   │   │   ├── interface.ts      # SecurityLayer interface
  │   │   │   ├── noop.ts           # Alpha: stub sem verificação
  │   │   │   └── ed25519.ts        # v1.0: implementação real
  │   │   └── main.ts               # entry point CLI
  │   └── package.json
  ├── server/                       # servidor HTTP proxy
  │   ├── src/
  │   │   ├── routes/
  │   │   │   ├── manifest.ts       # GET /manifest/:version
  │   │   │   ├── bundle.ts         # GET /bundle/:version
  │   │   │   ├── publish.ts        # POST /publish
  │   │   │   └── auth.ts           # POST /auth/register
  │   │   ├── middleware/
  │   │   │   └── apikey.ts         # validação X-Api-Key + IP nas rotas protegidas
  │   │   ├── db/
  │   │   │   ├── schema.ts         # criação das tabelas SQLite
  │   │   │   └── releases.ts       # queries de releases e files
  │   │   ├── storage/
  │   │   │   ├── ftp.ts            # adapter FTP
  │   │   │   └── s3.ts             # adapter S3/MinIO (v1.2)
  │   │   └── main.ts
  │   ├── data/
  │   │   └── sysupdate.db          # SQLite (ignorado pelo VCS)
  │   └── package.json
  └── tests/
```

---

## 10. Roadmap de Desenvolvimento

| Fase | Tag | Prazo Est. | Entregas |
|---|---|---|---|
| 1 | Alpha | Semanas 1–3 | Setup Bun + TypeScript, servidor HTTP (rotas manifest/bundle/publish/auth/register), registro via `REGISTER_SECRET` + API Key vinculada a IP, FTP adapter no servidor, CLI base (pull/push com auto-register), Security Layer stub |
| 2 | Alpha | Semanas 4–5 | Backup, state file, checksum SHA-256, rollback, validação de manifest (JSON Schema), rotação de backups |
| 3 | Alpha | Semanas 6–7 | --dry-run, --verbose, testes E2E, proteção contra rollback malicioso no state, limpeza de .bak em background |
| 4 | v1.0 | Semanas 8–9 | Security Layer Ed25519: assinatura no push, verificação no pull, state file assinado |
| 5 | v1.1 | Semana 10 | FTPS/SFTP no servidor, S3/MinIO no servidor, code signing do EXE (Authenticode) |
| 6 | v1.x | Semanas 11–12 | Build EXE multi-plataforma, DLL Windows com API pública, pipeline CI/CD |
| 7 | v2.0 | Futuro | Criptografia do manifest: X25519 + AES-256-GCM. |
| 8 | v3.0 | Futuro | Download por chunks para bundles grandes — otimização para conexões lentas. |

---

## 11. Riscos e Mitigações

| Fase | Risco | Impacto | Mitigação |
|---|---|---|---|
| Alpha | Falha de rede no meio do pull | Alto | Bundle baixado para diretório temporário. Operação atômica: substituições só ocorrem após bundle validado. State file só atualizado após todas as substituições. |
| Alpha | Checksum inválido do bundle baixado | Alto | Valida SHA-256 do bundle antes de extrair. Aborta e descarta o bundle se não bater. |
| Alpha | Arquivo em uso no Windows | Médio | Detecta lock antes de iniciar. Orienta usuário a parar o processo antes do pull. |
| Alpha | Permissão negada ao sobrescrever arquivo | Médio | Verifica permissão de escrita em todos os targets antes de iniciar qualquer download. |
| Alpha | Disco cheio por acúmulo de backups | Baixo | Rotação automática por keepBackups. Alerta de espaço insuficiente antes do pull. |
| Alpha | Servidor fora do ar durante pull | Médio | CLI detecta timeout e aborta com mensagem clara. Nenhum arquivo é alterado. |
| Alpha | API Key do publisher vazada | Alto | Vinculação por IP torna a key inútil fora da máquina de origem. Revogação via SQLite direto no servidor + CLI faz novo registro automaticamente no próximo push. |
| Alpha | `REGISTER_SECRET` vazado | Médio | Permite que um IP desconhecido se registre. Mitigação: trocar o `REGISTER_SECRET` no `.env` do servidor e revogar keys suspeitas no SQLite. A key gerada ainda fica presa ao IP do invasor — não dá acesso às keys de outros publishers. |
| Alpha | Manifest adulterado no servidor | Alto | Resolvido na v1.0 com assinatura Ed25519. Na Alpha: somente publishers registrados têm acesso via `X-Api-Key`, restrita ao IP cadastrado. |
| v1.0 | Vazamento da chave privada Ed25519 | Alto | Chave privada nunca entra no repositório. Fica em secrets do CI e na máquina do publisher apenas. |

---

## 12. Decisões em Aberto

| Decisão | Opções / Notas |
|---|---|
| Parser de argumentos CLI | citty (leve, nativo Bun) vs commander.js (mais maduro). Recomendação: citty |
| Compressão de backups | Sem compressão vs gzip vs zstd. Avaliar pelo tamanho típico dos arquivos do sistema alvo |
| Multi-ambiente (dev/staging/prod) | Um `sysupdate.json` por ambiente vs variável `SYSUPDATE_ENV` selecionando seção do arquivo |
| Notificações pós-pull | Sem notificação vs webhook configurável vs log estruturado JSON. Avaliar necessidade real |
| Deploy do servidor | VPS própria vs serviço cloud vs mesma máquina do FTP. Impacta requisitos de infraestrutura. |
| Banco de dados (futuro) | Migrations e integração com DB fora do escopo até v2+. Reavaliar após validação completa do fluxo de arquivos |

> ℹ Revisar as decisões em aberto ao final da Fase 1 (Alpha), com base no feedback dos primeiros testes em ambiente real.