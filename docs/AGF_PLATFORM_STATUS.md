# Status da plataforma AGF

Atualizado em 28 de julho de 2026.

## Marco atual

**O CRM opera manualmente o relacionamento e agora possui um banco de espera
para listas longas.** A descoberta e a filtragem continuam fora do produto.
Uma lista CSV ja filtrada pode ser carregada uma unica vez e liberada
gradualmente para o Kanban.

As entregas historicas permanecem validas:

- Etapa 0 de alinhamento de schema aplicada;
- Etapa 1 concluiu a importacao unica de 60 leads em `revisao_manual`, sem
  sinais legados;
- nenhum workflow de descoberta, verificacao de ranking, Gemini ou
  PhantomBuster foi ativado a partir deste redirecionamento.

## CRM manual — implementado localmente

- login Supabase e base compartilhada;
- Kanban horizontal, sem quebra de colunas, com rolagem interna de cards;
- fluxo manual de convite, aceite, mensagem, conversa e agendamento;
- detalhe expansivel de lead com perfil, score, contexto, mensagem e historico;
- follow-ups por data e hora;
- agenda de calls marcadas;
- pipeline comercial independente e criacao manual de projetos;
- configuracao do link publico da agenda;
- importacao atomica de ate 5.000 linhas para o banco de leads;
- painel com disponiveis, liberados, duplicados e lotes recentes;
- quantidade padrao configuravel e liberacao de 1 a 100 leads por operacao;
- deduplicacao global sem criar todos os cards ao mesmo tempo;
- deteccao de UTF-8/Windows-1252 e reparo seguro de nomes com acentos
  corrompidos no CSV.

As colunas operacionais `Encerrado` e `Ja prospectado` foram removidas. Interesse
comercial resulta em projeto; ausencia de interesse resulta em descarte.

O texto de convite/agendamento e copiado pelo operador e o LinkedIn nunca e
automatizado nesta fase.

## Migrations remotas confirmadas

`supabase/migrations/20260724000100_manual_crm_operations.sql` adiciona:

- `lead_follow_ups`;
- `commercial_projects`;
- `app_settings.calendar_booking`.

As migrations `20260724000100`, `20260727000100`, `20260727000200`,
`20260728000100` e `20260728000200` constam como aplicadas no projeto remoto.

As migrations de 28 de julho adicionam:

- `lead_import_batches` e `lead_pool`;
- configuracao `app_settings.lead_pool_release`;
- RPCs `import_lead_pool`, `release_lead_pool` e `lead_pool_dashboard`;
- importacao unica e liberacao atomica com `FOR UPDATE SKIP LOCKED`.

As migrations de 27 de julho adicionam:

- IDs Apollo em empresas e contatos;
- e-mail de contato para casamento de reserva;
- auditoria em `integration_events`;
- RPC atômica `ingest_apollo_lead`;
- RPC atômica `sync_google_calendar_booking`;
- preservacao dos dados originais em notificacoes de cancelamento.

O `supabase db lint --linked --level warning` foi executado apos a aplicacao e
nao encontrou erros de schema.

## Integracoes no escopo atual

| Integracao | Papel atual | Estado |
|---|---|---|
| Supabase | autenticacao e fonte de verdade do CRM | conectado no ambiente de teste |
| Google Calendar | pagina publica de agenda e criacao de evento/Meet | conta de teste conectada; triggers de criacao e atualizacao preparados, ainda inativos |
| n8n | sincronizacao de reservas do Calendar | workflow criado e salvo, ainda inativo ate o piloto |
| LinkedIn | convite e mensagens enviados pelo operador | manual |
| Apollo | descoberta externa e exportacao CSV | a lista filtrada entra pelo banco de leads; o webhook n8n fica inativo como alternativa futura |
| PhantomBuster / planilha | alternativas historicas de entrada | fora do CRM ate decisao comercial |
| Gemini | contexto e redacao futuros | fora do CRM ate decisao da extracao |

## Proximo teste de ponta a ponta

1. criar os segredos privados dos dois webhooks no n8n;
2. confirmar a credencial Supabase nos nodes HTTP;
3. confirmar a credencial e a agenda da conta de teste nos triggers Calendar;
4. manter a pergunta obrigatoria `Empresa` no Appointment Schedule;
5. escolher um socio da AGF como lead interno;
6. fazer uma reserva interna e verificar se o workflow n8n atualiza
   `calendar_bookings`, move o card para `call_marcada` e exibe o horario;
7. reenviar o mesmo evento e confirmar idempotencia;
8. importar um CSV interno para o banco de espera;
9. liberar um grupo pequeno e confirmar os cards na Base de clientes;
10. repetir a liberacao e confirmar que nenhum registro e duplicado.

## Referencias historicas congeladas

Os planos de ranking, fontes, saved searches, PhantomBuster e Apollo continuam
arquivados como pesquisa. Eles nao devem ser interpretados como workflow ativo
nem acionados pelo frontend atual.
