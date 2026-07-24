# Etapa 1 — relatório de dry-run

- Fonte: `C:\Users\caiom\Downloads\AGF Capital — Leads Outbound _ Puxada 1.xlsx`
- Gerado em: 2026-07-23T19:22:33.695Z
- Total lido: 60
- Importáveis: 60
- Em `revisao_manual`: 60
- Duplicatas consolidadas: 0
- Linhas abortadas: 0
- Registros em `lead_signals`: 0
- Preflight de status legado seguro: sim

## Preflight de status legado

Valor esperado: `Para aprovação`.

- "Para aprovação": 60

## Linhas abortadas

Nenhuma.

## Duplicatas consolidadas

Nenhuma.

## Invariantes

- Nenhum `lead_signals` é criado.
- `verified_at` e `verification_method` não são fabricados.
- Todo registro importável é gravado em `revisao_manual`, independentemente do status legado.
- `Status CRM` e `Status` são preservados apenas em `import_origin`.
- O modo dry-run não executa qualquer escrita no Supabase.

