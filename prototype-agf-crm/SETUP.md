# Setup local do CRM AGF

## 1. Banco

Em uma base nova, aplique todas as migrations em ordem de nome. Para a versao
manual atual, a ultima e:

`../supabase/migrations/20260724000100_manual_crm_operations.sql`

Ela depende da transicao de schema da Etapa 0 e cria follow-ups, projetos e a
configuracao publica de agenda.

## 2. Ambiente

Copie `.env.example` para `.env.local` e informe somente:

```text
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

O browser nunca recebe `service_role`, token do n8n, token do PhantomBuster ou
chave de IA.

## 3. Executar

```powershell
node .\prototype-agf-crm\server.mjs
```

Abra `http://localhost:4173`.

## 4. Configurar a agenda

Depois de entrar, abra **Configuracoes** e salve o link publico da pagina de
agendamento. O link e exibido na mensagem copiada no card. O callback do
Calendar para `calendar_bookings` deve ser implementado no n8n conforme
`../docs/N8N_CALENDAR_CALLBACK_CONTRACT.md`.
