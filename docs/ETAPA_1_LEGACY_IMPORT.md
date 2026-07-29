# Etapa 1 — importação única dos leads legados

> **Histórico concluído.** O script foi executado e arquivado. Novas entradas
> usam bases CSV nomeadas; consulte
> [AGF_CRM_MANUAL_OPERATION.md](./AGF_CRM_MANUAL_OPERATION.md).

**Estado:** concluída em 23 de julho de 2026; importador arquivado e bloqueado.

## Fonte e escopo

Exportação XLSX de 23 de julho de 2026 da planilha
`AGF Capital — Leads Outbound | Puxada 1`.

Foram lidas `Vagas — leads quentes` e
`Middle market — prospecção proativa`. `M&A - Pré-captação` não foi lida
porque M&A está fora do escopo do CRM atual.

## Resultado

| Métrica | Resultado |
|---|---:|
| Empresas gravadas | 60 |
| Contatos gravados | 60 |
| Leads gravados | 60 |
| Em `revisao_manual` | 60 |
| Empresas normalizadas duplicadas | 0 |
| LinkedIns normalizados duplicados | 0 |
| Empresas presentes nas duas origens | 0 |
| Registros em `lead_signals` | 0 |

As 60 linhas possuem `Status = "Para aprovação"`. Nenhuma indica convite
enviado, mensagem, conversa ou outra abordagem anterior.

`Status CRM` e `Status` não determinam o estágio da importação. Os dois valores
são preservados em `import_origin`; todo legado entra em `revisao_manual`
porque não possui sinal verificado.

Relatórios:

- `outputs/legacy-leads-import/dry-run-report.md`;
- `outputs/legacy-leads-import/dry-run-report.json`.

## Invariantes verificadas após a gravação

- a carga ocorreu em uma transação única;
- nenhum `lead_signals` foi criado;
- `verified_at` e `verification_method` não foram fabricados;
- todo legado entra em `revisao_manual`;
- `import_origin` guarda aba, linha, ID, `Status CRM` e `Status`;
- empresa e LinkedIn são normalizados antes da deduplicação;
- conflitos não determinísticos abortam todas as linhas envolvidas.

## Arquivamento

O código foi movido para
`scripts/archive/legacy-lead-import-20260723` e seu ponto de entrada agora
falha explicitamente. O SQL aplicado e o relatório permanecem em
`outputs/legacy-leads-import` somente para auditoria.
