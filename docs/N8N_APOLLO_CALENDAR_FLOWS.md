# Fluxos n8n — Apollo e Google Calendar

## Decisão técnica atual

O fluxo padrao do Apollo nao passa mais pelo n8n. A AGF exporta uma lista CSV
ja filtrada, importa uma unica vez no banco de leads do CRM e libera os cards
gradualmente. O workflow Apollo abaixo permanece inativo apenas como fallback
futuro e nao deve ser ativado junto com a importacao CSV.

O Apollo não publica um evento genérico quando um contato é salvo. Por isso,
o workflow `AGF | Apollo -> Supabase` expõe um webhook privado que poderá ser
chamado pelo botão `Importar do Apollo` ou por uma sincronização agendada.

O Google Appointment Schedule também não expõe um webhook configurável com o
conteúdo completo da reserva. Em produção, o workflow
`AGF | Google Calendar -> Supabase` usa o `Google Calendar Trigger`. O webhook
adicional desse workflow existe apenas para teste interno controlado.

## Workflow 1 — Apollo para Supabase

Arquivo importável:
`n8n/workflows/agf-apollo-to-supabase.json`.

Fluxo:

1. `POST /webhook/agf-apollo-leads`;
2. validar `X-AGF-Webhook-Secret` contra a variável
   `AGF_APOLLO_WEBHOOK_SECRET`;
3. aceitar um objeto em `record` ou uma lista em `records`;
4. normalizar campos estruturados ou nomes de colunas do CSV Apollo;
5. chamar `public.ingest_apollo_lead()` para cada registro;
6. deduplicar globalmente por empresa e contato, incluindo leads históricos;
7. criar leads novos em `revisao_manual`, sem criar sinal verificado;
8. registrar o payload em `integration_events`.

Payload mínimo:

```json
{
  "records": [
    {
      "event_id": "apollo-contact-id:updated-at",
      "company": {
        "name": "Empresa",
        "apollo_account_id": "id-conta",
        "employee_count": 500,
        "annual_revenue": 100000000
      },
      "contact": {
        "full_name": "Nome do contato",
        "apollo_contact_id": "id-contato",
        "linkedin_url": "https://www.linkedin.com/in/perfil",
        "title": "CFO",
        "email": "contato@empresa.com",
        "country": "Brasil"
      }
    }
  ]
}
```

O webhook não chama o Apollo sozinho. O emissor será definido quando a AGF
decidir entre:

- botão de sincronização no CRM;
- lista salva no Apollo consultada em agenda;
- importação CSV atual;
- outra origem que entregue o mesmo contrato.

## Workflow 2 — Google Calendar para Supabase

Arquivo importável:
`n8n/workflows/agf-calendar-to-supabase.json`.

Fluxo:

1. monitorar eventos criados, atualizados e cancelados na agenda conectada;
2. normalizar ID, início, fim, título, Meet, convidado e resposta `Empresa`;
3. casar o lead, nesta ordem:
   - e-mail exato;
   - empresa normalizada;
   - nome exato e único;
   - fallback de nome com primeiro nome idêntico, distância máxima de uma
     letra e exatamente um candidato ativo. Se houver empresa no formulário,
     ela precisa coincidir;
4. fazer upsert em `calendar_bookings` por `provider_event_id`;
5. mover para `call_marcada` somente quando houver casamento único;
6. manter reservas ambíguas como `unmatched`, com `raw_payload`;
7. mostrar sempre a reserva ativa criada mais recentemente;
8. se a reserva mais recente for cancelada, manter outra reserva ativa ou
   devolver o card para `agendamento` quando nenhuma permanecer.

Para o casamento por empresa funcionar, a página do Appointment Schedule deve
manter a pergunta obrigatória `Empresa`. Sem essa resposta, o sistema ainda
pode casar por e-mail exato ou pelo fallback conservador de nome.

## Variáveis e credenciais no n8n

Criar em `Variables`:

- `AGF_APOLLO_WEBHOOK_SECRET`;
- `AGF_CALENDAR_WEBHOOK_SECRET` — usada apenas pelo webhook de teste.

Selecionar nos nodes importados:

- `Supabase account`;
- `Google Calendar account`.

Nenhuma dessas credenciais ou variáveis pode ser copiada para a aplicação.

## Ativação

Os dois workflows devem permanecer inativos até:

1. aplicar a migration `20260727000100_apollo_calendar_ingestion.sql`;
2. configurar as duas variáveis secretas;
3. selecionar e testar as credenciais dos nodes;
4. testar Apollo com um lote interno;
5. testar Calendar com um sócio da AGF;
6. confirmar que reentregas não criam duplicatas;
7. trocar a agenda de teste pela conta do Giulio antes de produção.
