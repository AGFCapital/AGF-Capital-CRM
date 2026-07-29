# Índice da documentação AGF CRM

Atualizado em 29 de julho de 2026.

## Documentos canônicos

Estes arquivos definem o comportamento atual:

1. [Briefing do projeto](./AGF_PROJECT_BRIEF.md)
2. [Status da plataforma](./AGF_PLATFORM_STATUS.md)
3. [Operação manual do CRM](./AGF_CRM_MANUAL_OPERATION.md)
4. [Modelo de dados](./AGF_DATA_MODEL.md)
5. [Contrato atual do n8n](./N8N_INTEGRATION_CONTRACT.md)
6. [Callback do Google Calendar](./N8N_CALENDAR_CALLBACK_CONTRACT.md)
7. [Modelos de mensagem](./CRM_MESSAGE_TEMPLATES_CURRENT.md)
8. [Roadmap de construção](./AGF_BUILD_PLAN.md)

Em caso de divergência, o código e as migrations aplicadas prevalecem; a
documentação deve ser corrigida na mesma alteração.

## Referências históricas

Os arquivos abaixo registram decisões ou experimentos anteriores. Eles não
autorizam workflows nem definem o produto atual:

- [Alinhamento de schema — Etapa 0](./ETAPA_0_SCHEMA_ALIGNMENT.md)
- [Importação legada — Etapa 1](./ETAPA_1_LEGACY_IMPORT.md)
- [Descoberta estrutural — Etapa 2](./ETAPA_2_SOURCE_VERIFICATION_PLAN.md)
- [Saved searches do LinkedIn](./LINKEDIN_SAVED_SEARCHES.md)
- [Fluxos Apollo e Calendar](./N8N_APOLLO_CALENDAR_FLOWS.md)

## Decisões vigentes

- descoberta e qualificação são externas ao CRM;
- a entrada operacional atual é CSV filtrado;
- cada CSV cria uma base nomeada;
- LinkedIn é inteiramente manual;
- Supabase é a fonte de verdade;
- n8n executa Calendar e e-mails de follow-up;
- Google Sheets, PhantomBuster e Gemini não participam do fluxo ativo;
- todos veem os mesmos registros; responsável e notificações são individuais;
- leads e projetos usam a mesma estrutura de follow-ups e a mesma fila de e-mail.
