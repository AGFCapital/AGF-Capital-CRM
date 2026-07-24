# AGF CRM

Aplicação web compartilhada para qualificação e operação comercial de leads da
AGF. O Supabase é a única fonte de verdade do CRM.

## Escopo vigente

O desenvolvimento segue, nesta ordem:

1. `Middle market`;
2. `Vagas`, somente depois de o fluxo completo de Middle market estar validado.

M&A e startups permanecem fora do escopo atual. O Google Sheets também foi
removido do fluxo operacional; existirá apenas uma importação única dos dados
legados na Etapa 1.

```text
PhantomBuster → n8n → Supabase → aplicação AGF
                    ↘ Gemini

Calendly/Cal.com → webhook n8n → Supabase
```

## Decisões comerciais relevantes

- convite de conexão: automático, com limites de segurança;
- primeira mensagem: manual, copiada e enviada pelo Giulio;
- InMail: fora do produto;
- detecção de aceite: automática por export diário de conexões;
- respostas: registradas manualmente;
- agendamento: Calendly ou Cal.com, com empresa obrigatória;
- fatos da empresa: somente sinais verificados com URL e data de verificação;
- `dry_run` começa ativo e impede o PhantomBuster de enviar convites reais.

## Pipeline

```text
qualificado → aprovado → convite_enviado → conexao_aceita
→ mensagem_enviada → em_conversa → agendamento → call_marcada → concluido
```

Estados paralelos:

- `revisao_manual`
- `convite_expirado`
- `descartado`

Importações devem informar um estágio válido. Estágio ausente ou fora do enum
causa erro explícito; não existe conversão por aproximação.

## Banco de dados

As migrations históricas permanecem intactas. A transição do contrato v1 para
o v2 está em:

- `supabase/migrations/20260723000500_stage_zero_schema_alignment.sql`
- `supabase/rollbacks/20260723000500_stage_zero_schema_alignment.rollback.sql`

O rollback é destinado a um banco de teste vazio e se recusa a executar quando
existem leads, evitando perda silenciosa de estados ou sinais verificados.

## Segurança de outreach

As configurações ficam na linha `app_settings.setting_key = 'outreach'`:

```json
{
  "enabled": false,
  "dry_run": true
}
```

O teto de 100 convites é calculado diretamente em `dispatches`, usando
`connection_invite` enviados na janela rolante de sete dias.
`outreach_metrics` é apenas um snapshot para observabilidade e nunca autoriza
ou bloqueia um envio.

Mensagens e booking ativos são idempotentes por:

```text
(lead_id, action, content_hash)
```

Os status ativos para essa unicidade são `queued` e `requested`. Convites usam
uma trava separada e única por `lead_id` enquanto estiverem em `queued`,
`requested` ou `sent`. Somente cancelar ou marcar o dispatch como `failed`
permite reconvidar o mesmo lead. Registros `simulated` não impedem um futuro
envio real.

## Aplicação local

Requisito: Node.js 18 ou superior.

```powershell
node .\prototype-agf-crm\server.mjs
```

Abra `http://localhost:4173`.

Configure `prototype-agf-crm/.env.local` a partir do `.env.example`:

```text
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
N8N_COMMAND_WEBHOOK_URL=https://seu-n8n/webhook/...
N8N_COMMAND_WEBHOOK_TOKEN=segredo-interno-do-webhook
```

Não há mais dados fictícios ou fallback em `localStorage`. Sem configuração
válida do Supabase, o CRM mostra um erro e não abre uma base local divergente.

## Documentação

- [Status da plataforma](./docs/AGF_PLATFORM_STATUS.md)
- [Alinhamento de schema da Etapa 0](./docs/ETAPA_0_SCHEMA_ALIGNMENT.md)
- [Importação legada da Etapa 1](./docs/ETAPA_1_LEGACY_IMPORT.md)
- [Plano de verificação de fonte da Etapa 2](./docs/ETAPA_2_SOURCE_VERIFICATION_PLAN.md)
- [Regras das buscas do LinkedIn](./docs/LINKEDIN_SAVED_SEARCHES.md)
- [Briefing histórico](./docs/AGF_PROJECT_BRIEF.md)

O contrato v1 em `docs/N8N_INTEGRATION_CONTRACT.md` é histórico e obsoleto. O
contrato vigente é `N8N_INTEGRATION_CONTRACT_v2.md`, fornecido pelo responsável
do projeto.

## Marco atual

A Etapa 0 está aplicada. A Etapa 1 gravou 60 leads em `revisao_manual`, sem
sinais legados, e o importador foi arquivado. A Etapa 2 está
apenas planejada e não foi implementada.
