# AGF CRM

Aplicação web compartilhada para organizar a prospecção e o pipeline comercial
da AGF Capital. O Supabase é a fonte de verdade. A descoberta dos leads fica
fora do CRM; a entrada atual é um CSV já filtrado, normalmente exportado do
Apollo.

## Fluxo atual

```text
CSV filtrado
  -> base nomeada no Banco de leads
  -> liberação gradual para Base de clientes
  -> Enviar convite
  -> Convite pendente
  -> Conexão aceita
  -> Mensagem enviada
  -> Em conversa
  -> Agendamento
  -> Call marcada
  -> Criar projeto

Sem continuidade -> Descartado
```

Convites, mensagens e respostas no LinkedIn são manuais. O CRM abre o perfil,
prepara os textos, copia o conteúdo e registra a ação. Arrastar um card para a
etapa seguinte equivale a confirmar a ação correspondente.

## Recursos implementados

- autenticação com e-mail e senha pelo Supabase;
- mesma base, Kanban e projetos para todos os usuários;
- busca global de leads;
- Kanban horizontal com retorno de etapas e rolagem por coluna;
- cards compactos com LinkedIn, cópia de mensagem e ação principal;
- detalhe expansível, edição, histórico, etiquetas e responsável;
- modelos de convite, mensagem, agenda e agradecimento editáveis nas
  Configurações e compartilhados pela equipe;
- filtro compacto por responsável no CRM e no pipeline de projetos;
- cadastro manual e exclusão protegida de leads;
- Banco de leads para CSVs extensos:
  - formato Apollo validado;
  - bases nomeadas e independentes;
  - deduplicação interna e global;
  - normalização de acentos;
  - liberação de 1 a 100 leads da base escolhida;
- follow-ups individuais para leads e projetos, com sino, visão da equipe e e-mail via n8n;
- alerta visual para cards parados;
- Google Appointment Schedule com atualização automática da call;
- tratamento de criação, remarcação e cancelamento;
- pipeline comercial independente com criação manual;
- valor dos projetos por etapa no dashboard;
- conversão por origem, região e setor.

## Arquitetura

```text
Navegador
  -> servidor web local/produção
  -> Supabase Auth + REST/RPC

CSV Apollo
  -> parser no navegador
  -> RPC de importação
  -> lead_import_batches + lead_pool

Google Calendar
  -> n8n
  -> RPC de sincronização
  -> calendar_bookings + atualização do lead

Follow-up vencido
  -> fila idempotente no Supabase
  -> n8n
  -> Gmail do responsável
```

Segredos de servidor, credenciais Google e tokens do n8n nunca ficam no
frontend.

## Aplicação local

Requisito: Node.js 18 ou superior.

```powershell
node .\prototype-agf-crm\server.mjs
```

Abra `http://localhost:4173`.

Crie `prototype-agf-crm/.env.local` a partir de `.env.example`:

```text
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Use somente a chave publicável. Nunca inclua `service_role` no arquivo da
aplicação.

## Banco

As migrations ficam em `supabase/migrations/` e são aplicadas por:

```powershell
npx supabase db push
```

As migrations mais recentes adicionam:

- operações manuais e projetos;
- ciclo de vida completo de reservas;
- importação de listas longas;
- etiquetas e responsáveis;
- idade da etapa;
- follow-ups individuais e fila de e-mail;
- follow-ups vinculados a leads ou projetos;
- bases de leads nomeadas.

## Testes

```powershell
node --check .\prototype-agf-crm\crm.js
Get-ChildItem .\prototype-agf-crm\test\*.test.mjs |
  ForEach-Object { node $_.FullName }
```

## Documentação

Comece pelo [índice da documentação](./docs/DOCUMENTATION_INDEX.md).
