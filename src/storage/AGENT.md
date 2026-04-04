# AGENT - Escopo Storage

## Responsabilidade

Abstrair provedores de armazenamento (FTP/S3) com contrato unico:

- upload
- download/stream
- verificacao de existencia

Camada focada em infraestrutura, sem regra de negocio.

## Exemplo principal

Contrato simples para adapters:

```ts
export interface StorageAdapter {
  upload(localPath: string, remotePath: string): Promise<void>
  download(remotePath: string): Promise<ReadableStream | NodeJS.ReadableStream>
  exists(remotePath: string): Promise<boolean>
}
```

## Anti-patterns

- Adapter retornando formatos diferentes sem contrato comum
- Esconder erro de infra que deveria subir para tratamento superior
- Acoplar storage a DTO/HTTP

## Checklist rapido

- Adapter respeita o contrato comum?
- Erros de conexao/upload estao claros e acionaveis?
- Metodo de download evita carregar arquivo inteiro em memoria?

