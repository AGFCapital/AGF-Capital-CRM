# AGF CRM

Aplicacao web compartilhada para a operacao comercial da AGF. O Supabase e a
fonte de verdade dos cards, follow-ups, agenda e projetos.

## Escopo atual

A descoberta e a extracao de leads estao deliberadamente desacopladas do CRM.
Apollo, planilha, PhantomBuster ou outro processo poderao alimentar a base no
futuro, mas nenhum deles faz parte da aplicacao nesta fase.

O CRM opera os leads que ja existem na base:

```text
Base de clientes
  -> Enviar convite (manual no LinkedIn)
  -> Convite pendente
  -> Conexao aceita (confirmacao manual)
  -> Mensagem enviada (manual no LinkedIn)
  -> Em conversa
  -> Agendamento (copiar o link da agenda)
  -> Call marcada (atualizada pelo Calendar/n8n)

Call marcada -> Projeto comercial, quando aplicavel
Qualquer etapa -> Descartado, quando nao houver interesse ou fit
```

Nao ha automacao de convite, mensagem ou resposta do LinkedIn. O CRM abre o
perfil e deixa o texto pronto para copiar; o operador executa a acao no
LinkedIn e registra o resultado no card.

## Recursos implementados no frontend

- autenticacao por e-mail e senha do Supabase, com base e Kanban
  compartilhados;
- Kanban horizontal: uma coluna por etapa, rolagem lateral e rolagem interna
  de cards, sem quebrar etapas em uma segunda linha;
- detalhe expansivel do lead, perfil LinkedIn, score, contexto, historico e
  texto editavel para a mensagem longa;
- nota de convite e mensagem de agenda para copiar;
- registro manual de convite, aceite, mensagem enviada, resposta e avancos de
  etapa;
- follow-ups por data e hora, visiveis para toda a equipe;
- agenda de calls confirmadas;
- pipeline comercial independente, inclusive para projetos criados sem lead;
- configuracao do link publico da agenda.

## Banco e migration atual

As migrations historicas e a transicao de schema continuam em
`supabase/migrations/`. A extensao atual do CRM manual e:

`supabase/migrations/20260724000100_manual_crm_operations.sql`

Ela cria:

- `lead_follow_ups`;
- `commercial_projects`;
- a configuracao `app_settings.calendar_booking`.

Execute as migrations pelo Supabase CLI antes de usar esses recursos em uma
base remota:

```powershell
npx supabase db push
```

## Integracao com agenda

O unico workflow externo previsto para esta fase e:

```text
Google Calendar / pagina de agendamento
  -> webhook n8n autenticado
  -> calendar_bookings no Supabase
  -> card em Call marcada no CRM
```

O link publico da pagina de agendamento e salvo no painel Configuracoes. A
conta usada nos testes pode ser trocada depois pela agenda do Giulio, sem mudar
o CRM.

## Aplicacao local

Requisito: Node.js 18 ou superior.

```powershell
node .\prototype-agf-crm\server.mjs
```

Abra `http://localhost:4173` e configure
`prototype-agf-crm/.env.local` a partir do `.env.example`:

```text
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Nunca inclua `service_role`, token do n8n, token do PhantomBuster ou chave de
IA no frontend.

## Documentacao

- [Status da plataforma](./docs/AGF_PLATFORM_STATUS.md)
- [Operacao manual do CRM](./docs/AGF_CRM_MANUAL_OPERATION.md)
- [Contrato do callback de agenda no n8n](./docs/N8N_CALENDAR_CALLBACK_CONTRACT.md)
- [Alinhamento de schema da Etapa 0](./docs/ETAPA_0_SCHEMA_ALIGNMENT.md)
- [Importacao legada da Etapa 1](./docs/ETAPA_1_LEGACY_IMPORT.md)
- [Plano historico de verificacao de fonte](./docs/ETAPA_2_SOURCE_VERIFICATION_PLAN.md)
- [Briefing historico](./docs/AGF_PROJECT_BRIEF.md)

Os documentos de descoberta, ranking, PhantomBuster, Apollo e saved searches
permanecem como referencia historica. Eles nao definem o comportamento atual
do CRM enquanto a estrategia de extracao esta em decisao.
