# Contrato n8n — retorno de agendamento ao CRM

## Objetivo

Atualizar um card existente quando uma reserva confirmada for criada na pagina
de agendamento conectada ao Google Calendar. Este e o unico fluxo n8n ativo no
escopo manual atual.

## Limites

- o frontend nao chama o n8n;
- o frontend nao contem `service_role`, token de Google ou token do n8n;
- o n8n usa sua credencial de servidor do Supabase;
- o workflow nao envia convite, mensagem ou InMail no LinkedIn;
- a descoberta de leads nao faz parte deste workflow.

## Entrada esperada

O provedor de agenda deve fornecer, por webhook ou por uma leitura autenticada:

- identificador unico do evento;
- inicio e fim da call;
- titulo;
- URL do Meet, quando existir;
- resposta de empresa no formulario;
- e-mail/nome do convidado, quando disponibilizados;
- payload original.

O formulario da agenda deve solicitar **Empresa**. O titulo recomendado do
evento e `AGF - Giulio / Empresa - Nome do lead`.

## Algoritmo do workflow

1. Receber a reserva autenticada e validar que ha um identificador unico do
   evento.
2. Fazer upsert de `calendar_bookings` por `provider_event_id`, sempre
   preservando o payload em `raw_payload`.
3. Procurar o lead por correspondencia deterministica, nesta ordem:
   - e-mail do convidado, se houver campo confiavel futuro;
   - nome da empresa informado, normalizado e comparado a `companies`;
   - contato/nome, somente se for uma correspondencia unica.
4. Se nao houver correspondencia unica, gravar:
   - `lead_id = null`;
   - `match_status = 'unmatched'`;
   - `status = 'booked'`;
   - e encerrar sem mover nenhum lead.
5. Se houver um unico lead correspondente:
   - preencher `lead_id`;
   - definir `match_status = 'matched'`;
   - gravar inicio, fim, Meet e status da reserva;
   - atualizar `leads.current_stage = 'call_marcada'`;
   - adicionar atividade indicando que a reserva foi recebida pela agenda.

## Idempotencia

`calendar_bookings.provider_event_id` e unico. Reentregas do mesmo webhook
atualizam o mesmo registro; nao criam nova call nem nova mudanca de card.

## Teste interno obrigatorio

Antes de qualquer lead externo:

1. usar um socio da AGF como lead de teste;
2. mover manualmente o card ate `agendamento`;
3. usar o link de agenda para reservar 30 minutos;
4. confirmar evento e Meet no Google Calendar;
5. confirmar no Supabase uma linha `calendar_bookings` com `match_status =
   'matched'`;
6. confirmar no CRM que o card esta em `call_marcada` e mostra o horario;
7. repetir o webhook e verificar que nao ha segundo registro ou segunda call.

## Falhas

- reserva sem empresa ou com empresa ambigua: `unmatched`, sem mutacao de lead;
- evento cancelado: atualizar `calendar_bookings.status = 'cancelled'`; a
  decisao de devolver o card ao funil continua humana;
- erro no workflow: registrar a falha no n8n e manter o evento no Calendar;
- nao criar ou apagar leads para compensar um casamento incerto.
