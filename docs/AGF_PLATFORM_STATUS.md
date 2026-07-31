# Status da plataforma AGF

Atualizado em 31 de julho de 2026.

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

- link público configurável;
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
| n8n Calendar | funcional no ambiente de teste |
| n8n Follow-up/Gmail | conectado e ativo |
| LinkedIn | manual |
| Apollo | exportação CSV externa |
| Google Sheets | fora do fluxo |
| PhantomBuster | fora do fluxo |
| Gemini | fora do fluxo |

## Banco remoto

As migrations até
`20260731000100_follow_up_recipient_follows_card_responsible.sql` foram aplicadas.

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

## Pendências para produção

1. trocar a agenda de teste pela conta definitiva do Giulio;
2. executar teste ponta a ponta com o workflow definitivo;
3. validar destinatários reais dos e-mails de follow-up;
4. revisar RLS e variáveis no ambiente de produção;
5. publicar no domínio da AGF;
6. definir rotina operacional de geração dos próximos CSVs;
7. acompanhar uso do plano gratuito do Supabase e migrar apenas se métricas
   reais exigirem.

## Decisões congeladas

- LinkedIn permanece manual;
- score não orienta a interface operacional;
- extração não será construída antes da decisão comercial;
- documentos de PhantomBuster, rankings e saved searches são históricos.
