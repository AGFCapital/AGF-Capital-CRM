# Status da plataforma AGF

Atualizado em 24 de julho de 2026.

## Marco atual

**O CRM foi redirecionado para operacao comercial manual.** A descoberta e a
extracao de leads foram retiradas do produto enquanto Apollo, planilha,
PhantomBuster e outros caminhos sao avaliados separadamente.

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
- remocao da interface e do endpoint de solicitacao de extracao.

As colunas operacionais `Encerrado` e `Ja prospectado` foram removidas. Interesse
comercial resulta em projeto; ausencia de interesse resulta em descarte.

O texto de convite/agendamento e copiado pelo operador e o LinkedIn nunca e
automatizado nesta fase.

## Migration pendente de confirmacao remota

`supabase/migrations/20260724000100_manual_crm_operations.sql` adiciona:

- `lead_follow_ups`;
- `commercial_projects`;
- `app_settings.calendar_booking`.

A migration foi preparada para `supabase db push`. A CLI local nao retornou um
diagnostico legivel nesta sessao; antes de usar follow-ups ou projetos em
producao, confirmar no Supabase que a versao `20260724000100` consta na lista
de migrations aplicadas. Nenhuma afirmacao de aplicacao remota deve ser feita
sem essa confirmacao.

## Integracoes no escopo atual

| Integracao | Papel atual | Estado |
|---|---|---|
| Supabase | autenticacao e fonte de verdade do CRM | conectado no ambiente de teste |
| Google Calendar | pagina publica de agenda e criacao de evento/Meet | conta de teste conectada no n8n; link do Giulio pendente |
| n8n | callback seguro de reserva para `calendar_bookings` | contrato operacional pendente de workflow |
| LinkedIn | convite e mensagens enviados pelo operador | manual |
| Apollo / PhantomBuster / planilha | futura entrada de leads | fora do CRM ate decisao comercial |
| Gemini | contexto e redacao futuros | fora do CRM ate decisao da extracao |

## Proximo teste de ponta a ponta

1. confirmar a migration remota;
2. cadastrar o link de agenda de teste nas configuracoes;
3. escolher tres socios da AGF como leads internos;
4. percorrer convite manual, aceite manual, mensagem, conversa e agendamento;
5. fazer uma reserva interna e verificar se o workflow n8n atualiza
   `calendar_bookings`, move o card para `call_marcada` e exibe o horario;
6. criar um projeto comercial a partir da call;
7. so depois decidir como a proxima base de leads entrara no Supabase.

## Referencias historicas congeladas

Os planos de ranking, fontes, saved searches, PhantomBuster e Apollo continuam
arquivados como pesquisa. Eles nao devem ser interpretados como workflow ativo
nem acionados pelo frontend atual.
