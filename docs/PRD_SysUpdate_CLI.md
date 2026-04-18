# SysUpdate CLI — PRD

> Ferramenta de Atualização de Sistemas com Backup e Rollback de Arquivos

| Campo | Valor |
|---|---|
| Versão atual | Alpha — sem assinatura |
| Data | Março / 2026 |
| Stack | Bun · TypeScript · FTP / S3 (MinIO) |
| Distribuição | Binário único (EXE / DLL) — push / pull |
| Escopo Alpha | Fluxo completo com bundle como padrão, sem segurança criptográfica |
| Escopo v1.0 | Alpha + identidade Ed25519 por instalação + comunicação assinada |
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

| Fase | Mecanismo | Detalhe |
|---|---|---|
| Alpha | Nenhum | Fluxo completo sem assinatura. Foco em validar o fluxo end-to-end. |
| v1.0 | Ed25519 + Roles | Identidade por instalação. Comunicação assinada por request. Roles pending / consumer / publisher. Servidor re-assina bundles. Chave pública embutida no binário. |
| v1.1 | State file assinado | State file assinado. Code signing Authenticode no EXE. |
| v2.0 | X25519 + AES-256-GCM | Manifest cifrado. Leitura indevida passa a ser impossível. |

> ℹ O código já prevê o ponto de extensão `verifyManifest()` que na Alpha sempre retorna verdadeiro. Na v1.0 a implementação Ed25519 é plugada sem refatoração.

---

## 2. Arquitetura Geral

| Camada | Responsabilidade | Tecnologia |
|---|---|---|
| CLI / Commands | Parsing de argumentos, roteamento de subcomandos | Bun + citty |
| Core Engine | Orquestração: backup, download, checksum, substituição | TypeScript puro |
| Security Layer | `verifyBundle()`, `verifyFile()`, `signBundle()` — stub na Alpha, real na v1 | WebCrypto (Ed25519) |
| Backup Manager | Cópia versionada dos arquivos antes de sobrescrever | fs nativo + zlib |
| State Manager | Persiste histórico de versões aplicadas em JSON local | fs nativo |
| Server | Proxy HTTP — SQLite, identidade Ed25519, roles, re-assinatura de bundles | Bun HTTP |
| Build | Compilação para EXE standalone e DLL | bun build --compile |

### 2.1 Fluxo: pull (cliente aplica update)

1. Faz `GET /manifest/latest` no servidor (URL embutida no EXE — sem autenticação)
2. Valida a resposta contra o JSON Schema
3. Verifica assinatura do bundle via chave pública do servidor embutida no build — stub na Alpha
4. Compara versão retornada com versão registrada no state file — aborta se igual ou menor
5. Faz `GET /bundle/:version` no servidor — recebe stream do `.zip` + assinatura `.sig`
6. Recalcula SHA-256 do bundle localmente e verifica assinatura — aborta se não conferir
7. Extrai o bundle em diretório temporário
8. Para cada arquivo extraído: calcula checksum local via target → se igual, pula → se diferente ou ausente, faz backup → move o novo para o target
9. Atualiza o state file com a nova versão aplicada
10. Remove o diretório temporário
11. Exibe relatório: arquivos atualizados, pulados e backups criados

### 2.2 Fluxo: push (publisher envia update)

1. Lê o `sysupdate.json` local com `localSource` e `target` de cada arquivo
2. Valida que todos os `localSource` existem localmente
3. Verifica se existe par de chaves local — se não, executa `connect` automaticamente
4. Compacta todos os arquivos em um único bundle `.zip`
5. Calcula SHA-256 de cada arquivo e do bundle completo
6. Assina o bundle com a chave privada local da instalação — stub na Alpha
7. Faz `POST /publish` com assinatura Ed25519 no header — envia bundle + metadados
8. Servidor valida assinatura, verifica role `publisher`, re-assina com chave privada própria
9. Servidor salva `bundle.zip` + `bundle.zip.sig` no storage e metadados no SQLite
10. Exibe confirmação com versão publicada e checksum do bundle

---

## 3. sysupdate.json — Arquivo de Trabalho do Publisher

O `sysupdate.json` é um arquivo local da máquina do publisher — nunca é publicado no servidor. Serve como instrução para a CLI montar e enviar o bundle.

> ⚠ O `sysupdate.json` fica no repositório do projeto do publisher junto com o código. Nunca vai para o servidor de updates.

| Campo | Tipo | Descrição |
|---|---|---|
| `version` | string | Versão semver do pacote (ex: `2.4.1`) |
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
sha256(release-2.4.1.zip) == resposta.bundle.checksum  AND  assinatura do servidor válida?
  sim → extrai e processa
  não → descarta, aborta
```

**Nível 2 — por arquivo após extração:**

```
sha256('C:/SistemaX/app.exe') == checksum do manifest?
  sim        → arquivo já está correto, pula
  não        → faz backup → move o arquivo extraído para o target
  não existe → move o arquivo extraído para o target (primeira instalação)
```

| Momento | Comparação | Resultado |
|---|---|---|
| Após baixar o bundle | SHA-256 do bundle vs checksum retornado + verificação de assinatura do servidor | Iguais e assinatura válida → extrai. Divergência → aborta. |
| Após extrair, antes de substituir | SHA-256 do arquivo local (via target) vs checksum do arquivo no manifest | Iguais → pula. Diferentes ou ausente → substitui. |

### 4.2 Proteção contra Rollback Malicioso

O CLI nunca aceita uma resposta do servidor com versão menor ou igual à versão já registrada no state file:

```
versão do manifest (2.3.0) <= versão instalada (2.4.1)
  → aborta: 'Manifest desatualizado. Versão instalada (2.4.1) é igual ou superior'

versão do manifest (2.4.1) > versão instalada (2.3.0)
  → prossegue com o pull normalmente
```

> ⚠ O state file não é editável pelo usuário para fins de segurança. Na v1.1 o state file será assinado.

### 4.3 Estrutura do State File

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

O próprio executável do CLI pode ser incluído no bundle como qualquer outro arquivo. Como o Windows não permite deletar um EXE em execução mas permite renomeá-lo:

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

Se a limpeza falhar, só emite um warning — nunca interrompe o comando principal.

### 5.3 Estrutura de Backup

```
.sysupdate-backups/
  ├── v2.4.1_2026-03-21T14-32-10/
  │     ├── manifest.json
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
| `GET` | `/manifest/latest` | Nenhuma | Retorna os metadados da versão mais recente |
| `GET` | `/manifest/:version` | Nenhuma | Retorna os metadados de uma versão específica |
| `GET` | `/bundle/:version` | Nenhuma | Stream do bundle `.zip` + `.sig` da versão solicitada |
| `GET` | `/health` | Nenhuma | Healthcheck do servidor |
| `POST` | `/register` | HTTPS | Registra nova instalação — recebe `{ install_id, client_public_key }`. Chave do servidor nunca exposta via HTTP. |
| `POST` | `/publish` | Assinatura Ed25519 + role `publisher` | Recebe bundle, valida assinatura, re-assina e publica |

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
  published_by    TEXT NOT NULL,   -- install_id de quem publicou (audit log)
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE release_files (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  release_id INTEGER NOT NULL REFERENCES releases(id),
  target     TEXT NOT NULL,
  checksum   TEXT NOT NULL
);

CREATE TABLE installations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  install_id    TEXT NOT NULL UNIQUE,  -- UUID gerado na CLI
  public_key    TEXT NOT NULL,         -- Ed25519 pública — nunca a privada
  role          TEXT NOT NULL DEFAULT 'pending',  -- pending | consumer | publisher
  label         TEXT,
  registered_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_seen     TEXT,
  revoked       INTEGER DEFAULT 0      -- 0 = ativa, 1 = revogada
);
```

> ℹ O número de backups retidos no cliente é controlado pela flag `--keep-backups` (padrão: 5). Não é responsabilidade do servidor.

### 6.3 Resposta do /manifest/:version

```json
{
  "version":     "2.4.1",
  "releaseDate": "2026-03-21T14:00:00Z",
  "description": "Correção de cálculo de impostos",
  "minVersion":  "1.0.0",
  "bundle": {
    "file":      "release-2.4.1.zip",
    "checksum":  "f7c3bc1d808e04732adf...",
    "signature": "bundle.zip.sig"
  },
  "files": [
    { "target": "C:/SistemaX/app.exe",              "checksum": "e3b0c44298fc1c..." },
    { "target": "C:/SistemaX/config/settings.json", "checksum": "a1b2c3d4e5f6..." }
  ]
}
```

### 6.4 Configuração do Servidor

```env
SERVER_PORT=3000
DATABASE_URL='data\db\sysupdate.sqlite'
STORAGE_PROVIDER=ftp
STORAGE_HOST=ftp.interno.com
STORAGE_USER=admin
STORAGE_PASSWORD=****
STORAGE_BASE_PATH=/releases
# Geradas automaticamente no primeiro boot — nunca entram no VCS:
# SERVER_PRIVATE_KEY=<ed25519 privada>
# SERVER_PUBLIC_KEY=<ed25519 pública — obtida via `sysupdate-server pubkey` e embutida no build da CLI>
```

`.env` da CLI (publisher):

```env
SERVER_URL=https://updates.interno.com
# install_id e private_key gerados no connect — nunca configurados manualmente
```

### 6.5 Estrutura do Servidor

```
sysupdate-server/
  ├── src/
  │   ├── routes/
  │   │   ├── manifest.ts    # GET /manifest/:version
  │   │   ├── bundle.ts      # GET /bundle/:version
  │   │   ├── publish.ts     # POST /publish
  │   │   └── register.ts     # POST /register
  │   ├── middleware/
  │   │   └── auth.ts        # validação assinatura Ed25519 + role
  │   ├── db/
  │   │   ├── schema.ts
  │   │   └── releases.ts
  │   ├── storage/
  │   │   ├── ftp.ts
  │   │   └── s3.ts          # adapter S3/MinIO (v1.2)
  │   └── main.ts
  ├── data/
  │   └── sysupdate.db       # SQLite (ignorado pelo VCS)
  └── package.json
```

---

## 7. Security Layer

A Security Layer isola toda a criptografia do Core Engine via interface. Na Alpha as funções retornam verdadeiro/vazio sem verificar nada. Na v1.0 a implementação Ed25519 é plugada sem alterar nenhuma outra camada.

### 7.1 Modelo de Segurança — Visão Geral

O modelo é baseado em **identidade por instalação**, sem segredos configurados pelo usuário. Toda autenticação é criptográfica e transparente. A única interação humana necessária é o admin aprovar quem pode publicar.

Existem cinco camadas independentes, cada uma fechando um vetor de ataque diferente.

---

#### Camada 1 — Identidade da Instalação

Ao instalar a CLI, um par de chaves **Ed25519** é gerado localmente na máquina do usuário. A chave privada nunca sai dessa máquina. A chave pública é enviada ao servidor junto com um `install_id` (UUID único por instalação) no momento do `connect`.

```
sysupdate connect <SERVER_URL>

→ gera par Ed25519 local (privada nunca sai da máquina)
→ HTTPS POST /register { install_id, client_public_key }
→ servidor registra: role = pending

# chave pública do servidor nunca transita via HTTP
# admin obtém manualmente e injeta no CI como secret:
sysupdate-server pubkey
→ imprime a chave pública no terminal
→ admin cola no CI: SERVER_PUBLIC_KEY=<chave>
→ CI injeta no build via variável de ambiente
```

> ✓ Nenhum segredo precisa ser distribuído, configurado ou digitado pelo usuário.

---

#### Camada 2 — Comunicação Autenticada

Cada request enviado pela CLI é assinado com a chave privada local. O payload da assinatura inclui:

| Campo | Função |
|---|---|
| `install_id` | Identifica quem está enviando |
| `timestamp` | Janela de validade de 30 segundos |
| `nonce` | UUID único por request |
| `body_hash` | SHA-256 do payload |

O servidor verifica a assinatura usando a chave pública registrada para aquele `install_id`. A verificação é stateless — não requer consulta a banco de dados.

> ✓ Replay attacks são impossíveis — timestamp e nonce tornam cada request único e com validade curta.

---

#### Camada 3 — Autorização por Role

Autenticação e autorização são separadas. Toda CLI autenticada pode se comunicar com o servidor, mas publicar bundles exige promoção explícita pelo admin.

| Role | Permissões |
|---|---|
| `pending` | Recém-registrada, sem acesso a nenhuma operação |
| `consumer` | Baixa bundles (`GET /manifest`, `GET /bundle`) |
| `publisher` | Baixa e publica bundles. Exige aprovação explícita do admin. |

**Gerenciamento via CLI do servidor:**

```bash
# listar instalações registradas
sysupdate-server list

# promover a publisher
sysupdate-server approve <install_id>

# revogar (volta para consumer imediatamente)
sysupdate-server revoke <install_id>
```

> ✓ Um atacante que registra uma instalação falsa consegue no máximo role `consumer` — publish está bloqueado sem aprovação explícita do admin.

---

#### Camada 4 — Integridade dos Bundles

Esta é a camada mais crítica. Três chaves envolvidas, cada uma com função específica:

| Chave | Dono | Função |
|---|---|---|
| Privada do publisher | Máquina do publisher | Assina o bundle antes de enviar ao servidor |
| Pública do publisher | Servidor | Valida que o bundle veio de quem diz ser |
| Privada do servidor | Servidor | Re-assina bundles válidos antes de distribuir |
| Pública do servidor | Embutida no build da CLI | Consumers validam bundles recebidos |

**Fluxo no servidor ao receber um bundle (`POST /publish`):**

1. Valida a assinatura do publisher com a chave pública registrada para aquele `install_id`
2. Verifica que a versão é maior que a última publicada (sem downgrade)
3. Calcula o SHA-256 do bundle
4. Assina esse hash com a chave privada do próprio servidor
5. Salva `bundle.zip`, `bundle.zip.sig`, versão e `install_id` de quem publicou no audit log

> ✓ Mesmo que um publisher legítimo seja comprometido, o atacante ainda precisaria que o servidor aceitasse e re-assinasse o bundle malicioso. O servidor é o único trust anchor.

**Fluxo na CLI consumer ao baixar um bundle:**

1. Recebe `bundle.zip` + `bundle.zip.sig`
2. Recalcula o SHA-256 do arquivo recebido localmente
3. Verifica a assinatura usando a **chave pública do servidor embutida no binário**
4. Se a assinatura não conferir: aborta, nunca executa
5. Se conferir: processa o bundle

> ✓ A chave pública do servidor é embutida em tempo de compilação, nunca buscada em runtime — elimina o vetor de ataque via DNS spoofing.

---

#### Camada 5 — Auto-update Seguro

O binário da CLI pode ser atualizado automaticamente via bundle, com mecanismo idêntico ao da Camada 4. A assinatura do servidor embutida no binário atual garante que um servidor falso não consiga distribuir uma versão maliciosa.

---

### 7.2 Interface de Segurança

```typescript
interface SecurityLayer {
  // Alpha: sempre retorna true
  // v1.0:  verifica assinatura Ed25519 com chave pública do servidor embutida
  verifyBundle (bundleBytes: Uint8Array, sig: Uint8Array): Promise<boolean>
  verifyFile   (fileBytes: Uint8Array,   sig: Uint8Array): Promise<boolean>

  // Alpha: retorna buffer vazio
  // v1.0:  assina com chave privada local da instalação (só no push)
  signBundle   (bundleBytes: Uint8Array): Promise<Uint8Array>
}
```

### 7.3 O que Deliberadamente Não Existe

| Abordagem excluída | Motivo |
|---|---|
| API Key fixa no binário | Qualquer pessoa extrai com `strings ./cli` |
| `GET /api/pubkey` em runtime | Abre vetor via DNS spoofing — chave pública do servidor é obtida manualmente pelo admin e embutida no build |
| REGISTER_SECRET compartilhado | Segredo que precisa ser distribuído é um ponto fraco — substituído por identidade criptográfica |
| JWT com refresh token | Complexidade desnecessária sem auth server central |
| mTLS | Inviável em máquinas de usuários sem gestão de certificados |
| Senha ou login de usuário | Não há interface interativa no fluxo |

### 7.4 Setup Inicial de uma Instância

```bash
# 1. servidor sobe e gera par Ed25519 automaticamente no primeiro boot
docker compose up

# 2. admin copia a chave pública do servidor manualmente para o CI
sysupdate-server pubkey
# → imprime chave pública no terminal
# → admin cola no secret do CI: SERVER_PUBLIC_KEY=<chave>
# → CI injeta no build via variável de ambiente (nunca via HTTP)

# 3. CLI conecta (única config necessária — resto é automático)
sysupdate connect https://servidor.empresa.com

# 4. admin aprova publishers quando necessário
sysupdate-server approve <install_id>
```

### 7.5 Roadmap de Segurança

| Fase | Mecanismo | Detalhe |
|---|---|---|
| Alpha | Nenhum | `verifyBundle()` e `verifyFile()` sempre retornam `true`. `signBundle()` retorna buffer vazio. |
| v1.0 | Ed25519 — identidade + assinatura | Geração de par no `connect`. Comunicação assinada por request com timestamp + nonce. Roles. Re-assinatura pelo servidor. Chave pública embutida no build. |
| v1.1 | State file + code signing | State file assinado. CLI rejeita state file com versão manipulada. Authenticode no EXE. |
| v2.0 | X25519 + AES-256-GCM | Manifest cifrado. Chave AES por pacote, cifrada com X25519. Leitura indevida passa a ser impossível. |

---

## 8. Interface de Linha de Comando

Todos os subcomandos seguem a convenção: `sysupdate <comando> [flags]`. O binário detecta automaticamente o SO para ajustar separadores de caminho e encoding.

| Fase | Subcomando | Descrição |
|---|---|---|
| Alpha | `pull [--version v]` | Baixa e aplica o pacote mais recente. Com `--version`, aplica uma versão específica. |
| Alpha | `push` | Compacta os arquivos, calcula checksums e publica no servidor. |
| Alpha | `connect <url>` | Registra esta instalação no servidor — gera par Ed25519 local e envia a chave pública. |
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

O Bun compila o projeto em um único executável standalone via `bun build --compile`, sem necessidade de runtime instalado na máquina do cliente. A chave pública Ed25519 do servidor é injetada no binário como variável de ambiente no momento do build a partir da v1.0.

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
  ├── cli/
  │   ├── src/
  │   │   ├── commands/
  │   │   │   ├── pull.ts
  │   │   │   ├── push.ts
  │   │   │   ├── connect.ts
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
  │   │   └── main.ts
  │   └── package.json
  ├── server/
  │   ├── src/
  │   │   ├── routes/
  │   │   │   ├── manifest.ts       # GET /manifest/:version
  │   │   │   ├── bundle.ts         # GET /bundle/:version
  │   │   │   ├── publish.ts        # POST /publish
  │   │   │   └── register.ts        # POST /register
  │   │   ├── middleware/
  │   │   │   └── auth.ts           # validação assinatura Ed25519 + role
  │   │   ├── db/
  │   │   │   ├── schema.ts
  │   │   │   └── releases.ts
  │   │   ├── storage/
  │   │   │   ├── ftp.ts
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
| 1 | Alpha | Sem. 1–3 | Setup Bun + TypeScript, servidor HTTP (rotas manifest/bundle/publish/register), FTP adapter, CLI base (pull/push/connect), Security Layer stub |
| 2 | Alpha | Sem. 4–5 | Backup, state file, checksum SHA-256, rollback, validação JSON Schema, rotação de backups |
| 3 | Alpha | Sem. 6–7 | `--dry-run`, `--verbose`, testes E2E, proteção contra rollback malicioso, limpeza de `.bak` em background |
| 4 | v1.0 | Sem. 8–9 | Security Layer Ed25519: geração de par no `connect`, comunicação assinada por request, roles, re-assinatura de bundles pelo servidor, chave pública embutida no build |
| 5 | v1.1 | Sem. 10 | State file assinado, FTPS/SFTP, S3/MinIO, code signing Authenticode |
| 6 | v1.x | Sem. 11–12 | Build EXE multi-plataforma, DLL Windows com API pública, pipeline CI/CD |
| 7 | v2.0 | Futuro | Criptografia do manifest: X25519 + AES-256-GCM |
| 8 | v3.0 | Futuro | Download por chunks para bundles grandes — otimização para conexões lentas |

---

## 11. Riscos e Mitigações

| Fase | Risco | Impacto | Mitigação |
|---|---|---|---|
| Alpha | Falha de rede no meio do pull | Alto | Bundle em diretório temporário. Operação atômica. State file só atualizado após todas as substituições. |
| Alpha | Checksum inválido do bundle | Alto | Valida SHA-256 antes de extrair. Aborta e descarta se não bater. |
| Alpha | Arquivo em uso no Windows | Médio | Detecta lock antes de iniciar. Orienta usuário a parar o processo. |
| Alpha | Permissão negada ao sobrescrever | Médio | Verifica permissão de escrita em todos os targets antes de iniciar qualquer download. |
| Alpha | Disco cheio por acúmulo de backups | Baixo | Rotação automática por `keepBackups`. Alerta de espaço insuficiente antes do pull. |
| Alpha | Servidor fora do ar durante pull | Médio | CLI detecta timeout e aborta com mensagem clara. Nenhum arquivo é alterado. |
| v1.0 | Instalação falsa tenta publicar | Alto | Role default é `pending`. Publish exige aprovação explícita do admin. Autenticação criptográfica — sem segredo compartilhado. |
| v1.0 | Replay attack em request | Alto | Payload de assinatura inclui timestamp (janela de 30s) + nonce UUID único por request. |
| v1.0 | Chave privada do servidor vazada | Alto | Gerada no primeiro boot, nunca entra no VCS. Fica em secrets do CI. Rotação exige novo build da CLI. |
| v1.0 | Publisher legítimo comprometido | Alto | Servidor re-assina após validar — bundle malicioso ainda precisa ser aceito pelo servidor. Revogação imediata via `sysupdate-server revoke`. |
| v1.0 | Manifest adulterado no servidor | Alto | CLI consumers verificam assinatura do servidor embutida no build — sem consulta DNS em runtime. |

---

## 12. Decisões em Aberto

| Decisão | Opções / Notas |
|---|---|
| Parser de argumentos CLI | citty (leve, nativo Bun) vs commander.js (mais maduro). Recomendação: citty |
| Compressão de backups | Sem compressão vs gzip vs zstd. Avaliar pelo tamanho típico dos arquivos do sistema alvo |
| Multi-ambiente (dev/staging/prod) | Um `sysupdate.json` por ambiente vs variável `SYSUPDATE_ENV` selecionando seção do arquivo |
| Notificações pós-pull | Sem notificação vs webhook configurável vs log estruturado JSON |
| Deploy do servidor | VPS própria vs serviço cloud vs mesma máquina do FTP |
| Rotação de chaves Ed25519 (v1.0) | Sem rotação vs rotação manual via novo boot do servidor + rebuild da CLI |
| Banco de dados (futuro) | Migrations e integração com DB fora do escopo até v2+. Reavaliar após validação completa do fluxo de arquivos |

> ℹ Revisar as decisões em aberto ao final da Fase 1 (Alpha), com base no feedback dos primeiros testes em ambiente real.