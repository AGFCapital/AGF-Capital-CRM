# Interface AGF CRM

Frontend compartilhado do CRM da AGF. A interface usa autenticação e dados do
Supabase; não possui seeds nem base alternativa em `localStorage`.

## Executar

Na raiz do repositório:

```powershell
node .\prototype-agf-crm\server.mjs
```

Abra `http://localhost:4173`.

Copie `.env.example` para `.env.local` e configure:

```text
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
N8N_COMMAND_WEBHOOK_URL=https://seu-n8n/webhook/...
N8N_COMMAND_WEBHOOK_TOKEN=segredo-interno-do-webhook
```

Nunca coloque a chave `service_role`, tokens do PhantomBuster ou chaves de IA
no frontend.

## Pipeline exibido

`qualificado → aprovado → convite_enviado → conexao_aceita →
mensagem_enviada → em_conversa → agendamento → call_marcada → concluido`

Também são exibidos `revisao_manual`, `convite_expirado` e `descartado`.

Contexto e notícias são derivados de `lead_signals` verificados. Os campos
legados `leads.signal_summary` e `leads.recent_news` não são utilizados.

## Estado desta versão

Esta pasta está alinhada somente à Etapa 0. Workflows de ingestão, convite,
detecção de aceite e agendamento pertencem às etapas seguintes e não foram
implementados aqui.
