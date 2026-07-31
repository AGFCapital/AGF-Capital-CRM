# Modelo de dados do AGF CRM

Atualizado em 29 de julho de 2026.

## Fonte de verdade

O Supabase concentra autenticação, estado do CRM, auditoria e filas de
integração. O frontend usa a publishable key e o JWT do usuário. n8n usa uma
credencial de servidor armazenada no cofre da própria instância.

## Núcleo comercial

| Tabela | Papel |
|---|---|
| `profiles` | Perfil, e-mail de notificação e preferência individual. |
| `companies` | Empresa normalizada, setor, localidade, porte e IDs externos. |
| `contacts` | Contato, cargo, LinkedIn, e-mail e IDs externos. |
| `leads` | Origem, etapa, responsável, etiqueta e contexto do card. |
| `lead_activities` | Histórico imutável das ações. |
| `message_drafts` | Rascunho atual e versões anteriores. |
| `lead_follow_ups` | Tarefas de leads ou projetos, com data, responsável e estado. |
| `commercial_projects` | Pipeline, valor e próxima ação de projetos. |

## Banco de leads

### `lead_import_batches`

Representa uma base importada:

- `display_name`: nome escolhido pelo usuário;
- `file_name`: nome físico do CSV;
- contadores de linhas;
- estado da importação;
- data e autor.

### `lead_pool`

Representa cada linha válida antes de virar card:

- referência ao lote;
- linha de origem;
- empresa e contato normalizados;
- dados Apollo úteis;
- estado `disponivel`, `liberado_para_crm`, `duplicado` ou `descartado`;
- referência ao lead criado.

### Invariantes

- deduplicação dentro do arquivo antes da gravação;
- deduplicação global por empresa, LinkedIn e IDs Apollo;
- liberação por `batch_id`;
- `FOR UPDATE SKIP LOCKED` para concorrência;
- nenhuma liberação cria mais de 100 cards por operação;
- o nome da base não altera o critério de dedupe.

RPCs:

- `import_named_lead_pool(...)`;
- `release_lead_pool_batch(...)`;
- `lead_pool_dashboard()`.

## Agenda

`calendar_bookings` guarda:

- ID único do evento;
- lead opcional;
- início, fim e Meet;
- estado da reserva;
- resultado e método do casamento;
- data de criação do provedor;
- `raw_payload`.

O ID do provedor garante idempotência. A interface escolhe a reserva ativa
com criação mais recente.

## Follow-ups e e-mail

`lead_follow_ups.created_by` identifica quem criou a tarefa.
`lead_follow_ups.assigned_to` identifica o responsável atual do card pai e,
portanto, quem recebe a notificação. Cada registro possui exatamente um pai:

- `lead_id` para uma tarefa da prospecção; ou
- `project_id` para uma tarefa do pipeline comercial.

A restrição `lead_follow_ups_single_parent_check` impede registros sem pai ou
vinculados simultaneamente aos dois domínios.

`follow_up_email_deliveries` é a fila de entrega:

- uma entrega por follow-up/janela;
- estado pendente, enviado ou falho;
- destinatário;
- horários de tentativa;
- erro seguro.

O workflow de e-mail nunca decide quem recebe: ele consome o destinatário já
resolvido pelo banco.

Ao trocar `leads.responsible_id` ou `commercial_projects.responsible_id`, o
banco propaga o novo responsável aos follow-ups abertos e às entregas ainda
não enviadas. Uma entrega já enviada permanece histórica e não é reescrita.

## Configurações

`app_settings` armazena configurações compartilhadas:

- `calendar_booking`;
- `lead_pool_release`;
- chaves históricas ainda preservadas por compatibilidade.

Preferências individuais ficam em `profiles`, não em `app_settings`.

## Segurança

- leitura compartilhada para usuários autenticados;
- escrita protegida por RLS e RPCs;
- operações compostas ficam em funções `security definer` com validação de
  `auth.uid()`;
- credenciais externas não são armazenadas em tabelas públicas;
- logs registram IDs e erros, nunca tokens.

## Migrations relevantes

```text
20260724000100  operações manuais
20260727000100  Apollo/Calendar e auditoria
20260727000200  cancelamento de reserva
20260728000100  banco de listas longas
20260728000200  totais do banco de leads
20260728000300  ciclo de vida da reserva
20260728000400  casamento conservador de nome
20260728000500  tolerância de um caractere
20260729000100  exclusão de lead
20260729000200  responsável e etiquetas
20260729000300  idade da etapa
20260729000400  follow-ups e operações manuais
20260729000500  fila de e-mail
20260729000600  bases nomeadas
20260729000700  nome da base inicial
20260729000800  follow-ups em projetos
```
