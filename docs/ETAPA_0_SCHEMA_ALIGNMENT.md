# Etapa 0 — alinhamento do schema

Data: 23 de julho de 2026.

Este documento registra o resultado da Etapa 0 do plano de construção. Ele não
autoriza nem implementa a Etapa 1.

## Pipeline

O enum `lead_stage` passa a aceitar exclusivamente:

1. `qualificado`
2. `aprovado`
3. `convite_enviado`
4. `conexao_aceita`
5. `mensagem_enviada`
6. `em_conversa`
7. `agendamento`
8. `call_marcada`
9. `concluido`
10. `convite_expirado`
11. `descartado`
12. `revisao_manual`

Mapeamento legado:

| Legado | V2 |
|---|---|
| `ready_to_send` | `qualificado` |
| `approved` | `aprovado` |
| `send_invitation` | `aprovado` |
| `invitation_sent` | `convite_enviado` |
| `send_message` | `convite_enviado` |
| `in_conversation` | `em_conversa` |
| `scheduling` | `agendamento` |
| `call_booked` | `call_marcada` |
| `concluded` | `concluido` |

Não existe mapeamento aproximado. A coluna `current_stage` não possui default;
uma importação com valor ausente ou inválido falha no banco.

Os estados terminais são `concluido`, `convite_expirado` e `descartado`.
`revisao_manual` continua sendo um lead ativo.

## Remoção do Google Sheets

Foram removidos do schema corrente:

- `sheet_sync_logs`;
- `pending_sheet_status_sync`;
- `queue_sheet_status_sync()`;
- `lead_stage_label()`;
- trigger `leads_queue_sheet_status_sync`;
- `source_sheet_tab`;
- `source_sheet_row_key`;
- `source_sheet_row_number`.

Antes da remoção, a busca no repositório confirmou que
`lead_stage_label()` só era chamada por `queue_sheet_status_sync()`.

O histórico de estágio foi preservado por uma nova função independente,
`record_lead_stage_change()`.

## Sinais verificados

`lead_signals` é a fonte de verdade dos fatos apresentados no card:

- `family`
- `summary`
- `source_url`
- `source_name`
- `occurred_at`
- `published_at`
- `verified_at`
- `verification_method`

`strength` foi removido. `leads.signal_summary` e `leads.recent_news` também
foram removidos; a interface deriva o conteúdo diretamente dos sinais.

Para o filtro de seis meses, tanto `occurred_at` quanto `published_at` devem
estar dentro da janela. A data mais antiga é a restritiva. Um fato antigo
republicado recentemente não se torna um sinal recente.

## Outreach

`app_settings` possui a configuração:

```json
{
  "enabled": false,
  "dry_run": true
}
```

Ela fica sob `setting_key = 'outreach'`. O valor de `dry_run` nasce como
`true` e só poderá ser desligado após autorização expressa do piloto.

O limite semanal de 100 convites deve ser calculado por query direta em
`dispatches`:

- `action = connection_invite`;
- `status = sent`;
- `sent_at` dentro da janela rolante dos últimos sete dias.

`outreach_metrics.weekly_invite_count` é informativo. Ele nunca substitui a
query de segurança.

Mensagens e booking ativos são únicos por:

```text
(lead_id, action, content_hash)
```

Para esse índice, os status ativos são `queued` e `requested`.

Convites têm uma regra independente: existe no máximo um
`connection_invite` por `lead_id` quando o status é `queued`, `requested` ou
`sent`, independentemente do conteúdo da nota. Somente cancelar ou marcar o
dispatch como `failed` permite reconvidar. `simulated` representa uma avaliação
dry-run e não bloqueia um envio real posterior.

O hash é calculado com a função nativa `sha256()` sobre o payload e a ação,
sem depender de `digest()` ou do `search_path` de `pgcrypto`.

## RLS revisada

Todos os usuários autenticados mantêm leitura de `app_settings` e
`dispatches`.

- `app_settings`: o cliente pode atualizar qualquer linha exceto `outreach`;
  habilitação e dry-run são exclusivos do backend/n8n.
- `dispatches`: o cliente só pode inserir o registro de uma mensagem manual já
  enviada: `linkedin_message`, canal `manual`, status `sent`.
- connection invite e qualquer status `queued` são exclusivos do backend/n8n.

As outras tabelas que ainda possuem política `ALL` para `authenticated` e não
foram alteradas nesta etapa são:

- `criteria_versions`
- `extraction_runs`
- `companies`
- `contacts`
- `leads`
- `lead_signals`
- `message_drafts`
- `calendar_bookings`
- `lead_activities`

## Templates de convite

Um template aprovado:

- pode ser lido por usuários autenticados;
- só pode ser criado, aprovado, ativado ou desativado por administrador;
- não pode ter corpo nem `variables` alterados;
- não pode ter `approved_at` apagado;
- não pode ser apagado.

Uma edição deve criar outra linha, inicialmente inativa. Templates não
aprovados podem ser removidos por administradores.

## Agendamento

`calendar_bookings.lead_id` é opcional para permitir o recebimento seguro de
reservas ainda não identificadas.

`match_status` aceita:

- `matched`
- `unmatched`
- `resolved`

Reservas unmatched preservam `raw_payload`. IDs e URLs usam nomes neutros ao
provedor: `provider_event_id` e `meeting_url`.

## Pendência explícita do Workflow A

Não implementada nesta etapa:

> O dedup deve verificar todos os leads da empresa e todos os leads do contato,
> inclusive terminais, e não apenas cards ativos. Uma duplicata só pode reabrir
> o card anterior mediante regra explícita de reabertura; não deve criar um
> segundo histórico nem reabrir por aproximação.

## Rollback

O rollback fornecido é seguro para um banco de teste vazio. Ele falha
explicitamente quando existem leads ou reservas unmatched, pois voltar ao
schema antigo descartaria estados e evidências sem equivalência.
