# Status da plataforma AGF

Atualizado em 6 de agosto de 2026.

## Resumo executivo

O CRM manual está funcional em ambiente de teste, com Supabase remoto,
Calendar e follow-ups por e-mail. A extração foi desacoplada. A entrada atual
é um CSV filtrado armazenado em bases nomeadas, liberadas gradualmente para o
Kanban.

## Implementado

### CRM

- login por e-mail e senha;
- dados compartilhados entre operadores;
- Kanban horizontal com avanço, retorno e descarte;
- ações no card compacto e no detalhe;
- busca global;
- cadastro e exclusão de leads;
- etiquetas, responsável e histórico por empresa;
- filtro compacto por qualquer responsável, ao lado da busca, na Base de
  clientes e em Projetos;
- página ativa preservada ao recarregar o navegador;
- cards abertos em Follow-ups, Agendamentos e Base completa permanecem na
  própria seção;
- alerta de tempo parado;
- datas no padrão `DD/MM/AAAA HH:mm`;
- dashboard de operação e conversão;
- pipeline comercial editável;
- follow-ups criados e concluídos também no detalhe de projetos;
- valor de projetos por etapa.

### Banco de leads

- parser compatível com o CSV Apollo validado;
- normalização de acentos;
- deduplicação dentro do CSV e em todo o CRM;
- upload único em lote;
- nome obrigatório da base;
- seletor de base durante a liberação;
- liberação atômica de 1 a 100 leads;
- painel rolável com últimas bases;
- base inicial renomeada para `Base Middle-Market 1`.

### Follow-ups

- destinatário sempre igual ao responsável atual do card;
- criador preservado somente para auditoria;
- troca de responsável atualiza follow-ups e entregas ainda não enviadas;
- vínculo exclusivo com um lead ou um projeto;
- sino com `Minhas notificações` e `Equipe`;
- conclusão manual;
- preferência individual de e-mail;
- fila idempotente no Supabase;
- workflow n8n/Gmail conectado.

### Agenda

- link público individual e configurável no próprio perfil;
- responsável e link congelados quando o lead entra em `agendamento`;
- identificação da agenda de origem preparada no contrato do n8n;
- validação transacional impede uma agenda de atualizar o card de outro sócio;
- card mostra data e hora;
- criação, remarcação e cancelamento tratados;
- casamento por e-mail, empresa ou nome conservador;
- reserva mais recente prevalece;
- reservas incertas permanecem `unmatched`;
- fluxo testado internamente com sócios.

## Integrações

| Integração | Estado atual |
|---|---|
| Supabase | conectado e fonte de verdade |
| Google Calendar | conectado em conta de teste |
| n8n Calendar | fluxo legado testado; roteamento multiagenda pendente de teste |
| n8n Follow-up/Gmail | conectado e ativo |
| LinkedIn | manual |
| Apollo | exportação CSV externa |
| Google Sheets | fora do fluxo |
| PhantomBuster | fora do fluxo |
| Gemini | fora do fluxo |

## Banco remoto

O repositório oficial passou a ser `AGFCapital/AGF-Capital-CRM`. O novo projeto
Supabase de produção é o projeto AGF `icsilintddvfwhhxwqte`. Em 6 de agosto de
2026 as 25 migrations e a importação transacional dos dados legados foram
aplicadas pela CLI. Os quatro perfis antigos foram remapeados para os novos
UUIDs do Auth por e-mail, sem perder ownership.

A validação pós-importação confirmou 5 usuários e 5 perfis, 91 empresas, 92
contatos, 628 registros no banco de leads, 89 leads, 3 projetos, 12 follow-ups,
21 reservas de agenda e 381 atividades. Nenhuma referência de responsável,
membro de projeto, destinatário de follow-up ou host de agenda ficou quebrada.
Os cinco perfis ainda estavam sem `booking_url` e sem agenda habilitada no
momento da auditoria.

Principais extensões recentes:

- `lead_import_batches` e `lead_pool`;
- ciclo de vida de `calendar_bookings`;
- `profiles.notification_email`;
- propriedade de follow-up;
- `follow_up_email_deliveries`;
- RPCs de leads/projetos manuais;
- etiquetas e idade da etapa;
- `display_name` nas bases;
- importação e liberação por base;
- follow-ups unificados para leads e projetos.
- responsável estruturado também em projetos;
- destinatário de follow-up derivado do responsável atual do card.
- `commercial_project_members` e `commercial_project_links`;
- RPC atômica `save_project_collaboration(...)`;
- garantia de que o responsável principal sempre é membro do projeto.
- quatro modelos de mensagem compartilhados em `app_settings`, editáveis na
  interface com validação das variáveis obrigatórias.
- migration `20260805000100_profile_calendar_scheduling.sql` aplicada para
  agenda individual, backfill de usuários Auth e validação multiagenda.

## Testes atuais

Os contratos locais cobrem:

- carregamento do CRM;
- utilitários e busca;
- normalização de CSV;
- interações do Kanban;
- bases nomeadas;
- rolagem do Banco de leads;
- sidebar fixa e responsiva;
- follow-ups de projetos e compatibilidade da fila de e-mail.
- filtros pessoais no CRM e no pipeline de projetos;
- persistência de navegação e abertura contextual dos detalhes;
- invariantes de responsável, membros e links de projeto no banco remoto.
- leitura, validação, serialização e renderização dos modelos de mensagem.

## Pendências para produção

1. cadastrar `calendar_id` e link individual de cada sócio;
2. adaptar o n8n para enviar a agenda de origem e executar teste ponta a ponta;
3. validar destinatários reais dos e-mails de follow-up;
4. revisar RLS e variáveis no ambiente de produção;
5. publicar no domínio da AGF;
6. definir rotina operacional de geração dos próximos CSVs;
7. acompanhar consumo e capacidade do plano pago do Supabase da AGF.

## Decisões congeladas

- LinkedIn permanece manual;
- score não orienta a interface operacional;
- extração não será construída antes da decisão comercial;
- documentos de PhantomBuster, rankings e saved searches são históricos.
