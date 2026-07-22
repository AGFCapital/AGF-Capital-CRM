# AGF CRM - conexao da primeira versao

Esta interface ja funciona localmente para validar a operacao. Ela nao envia
mensagens, nao cria eventos e nao altera a planilha. As mudancas de etapa ficam
salvas apenas no navegador ate a conexao com o Supabase ser habilitada.

## Banco de dados

No SQL Editor do projeto Supabase, aplique nesta ordem:

1. `supabase/migrations/20260722_001_initial_agf_crm.sql`
2. `supabase/migrations/20260722_002_pipeline_and_sheet_sync.sql`
3. `supabase/migrations/20260722_003_sheet_status_sync.sql`
4. `supabase/migrations/20260722_004_score_to_ten.sql`

A terceira migracao cria a fila `pending_sheet_status_sync`. O workflow n8n vai
ler essa fila e atualizar unicamente a celula `Status CRM` da linha de origem
no Google Sheets.

## Variaveis locais da aplicacao

- `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` podem ficar no `.env.local`.
  Somente a chave publicavel chega ao navegador.
- `N8N_COMMAND_WEBHOOK_URL` e `N8N_COMMAND_WEBHOOK_TOKEN` ficam apenas no
  servidor local ou hospedado. Eles autorizam o botao **Extracao extra** a
  chamar um webhook de comando do n8n.
- A chave privilegiada do Supabase, PhantomBuster e Gemini permanecem somente
  no cofre de credenciais do n8n.

## O que sera conectado depois

1. PhantomBuster -> Google Sheets -> n8n -> Supabase.
2. Mudanca de etapa no CRM -> fila de sync -> coluna `Status CRM` no Sheets.
3. Revisao humana -> mensagem ou convite do LinkedIn, somente no piloto
   interno e apos aprovacao explicita.
4. Agendamento -> pagina nativa do Google Calendar -> evento, Meet e card
   `Call marcada`.
