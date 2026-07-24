# Importação única de leads legados — ARQUIVADA

**Execução concluída em 2026-07-23.** O ponto de entrada foi bloqueado depois
da carga transacional dos 60 leads. Estes arquivos permanecem somente para
auditoria e não devem ser reutilizados.

Script isolado da Etapa 1. Ele lê apenas as abas:

- `Vagas — leads quentes`;
- `Middle market — prospecção proativa`.

`M&A - Pré-captação` permanece fora do escopo do CRM atual.

## Segurança

- o script só aceita `--dry-run`;
- não contém acesso ao Supabase;
- não cria `lead_signals`;
- não fabrica `verified_at` ou `verification_method`;
- preserva `Status CRM` e `Status` em `import_origin`, sem usá-los como estágio;
- bloqueia a futura aplicação se `Status` tiver algo diferente de
  `Para aprovação`;
- todo lead importável é preparado para `revisao_manual`;
- duplicidades de empresa ou contato só são consolidadas quando a decisão é
  determinística.

A gravação continuará bloqueada até aprovação explícita do relatório. Depois
da importação única, o diretório será marcado como arquivado e não será
incorporado aos workflows.

## Execução

```powershell
node import-legacy-leads.mjs `
  --dry-run `
  --input "C:\caminho\planilha.xlsx" `
  --report-dir "outputs\legacy-leads-import"
```
