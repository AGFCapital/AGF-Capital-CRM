# Setup local

## 1. Banco

Em um projeto novo, aplique as migrations históricas em ordem e, por último, a
migration de transição:

1. `20260722_001_initial_agf_crm.sql`
2. `20260722_002_pipeline_and_sheet_sync.sql`
3. `20260722_003_sheet_status_sync.sql`
4. `20260722_004_score_to_ten.sql`
5. `20260723_005_stage_zero_schema_alignment.sql`

As referências a Sheets nas migrations 001 e 003 são histórico imutável. A
migration 005 remove esses objetos do schema corrente.

O rollback da 005 é somente para teste vazio:

`20260723_005_stage_zero_schema_alignment.rollback.sql`

## 2. Ambiente

Copie `.env.example` para `.env.local` e configure apenas a URL e a chave
publicável do Supabase, além do webhook interno do n8n quando necessário.

Nunca exponha `service_role`, PhantomBuster ou credenciais de IA.

## 3. Execução

```powershell
node .\prototype-agf-crm\server.mjs
```

Sem Supabase configurado, a aplicação exibe erro. Não existe base local de
demonstração.
