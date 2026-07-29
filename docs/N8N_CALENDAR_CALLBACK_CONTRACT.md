# Contrato n8n — retorno de agendamento ao CRM

## Objetivo

Atualizar um card existente quando uma reserva for criada, remarcada ou
cancelada na pagina de agendamento conectada ao Google Calendar. Este e o
unico fluxo n8n ativo no escopo manual atual.

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
   - e-mail exato do convidado, quando cadastrado no contato;
   - nome da empresa informado, normalizado e comparado a `companies`;
   - contato/nome exato, somente se for uma correspondencia unica;
   - fallback de nome com no maximo uma insercao, remocao ou substituicao,
     primeiro nome identico e exatamente um candidato ativo. Se o formulario
     informar empresa, ela tambem deve coincidir.
   Depois de um fallback seguro, o e-mail do formulario e salvo no contato
   quando o CRM ainda nao possui e-mail. As proximas atualizacoes passam a
   usar igualdade exata.
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
6. Se o mesmo evento mudar de horario, atualizar a mesma linha e registrar a
   remarcacao.
7. Se o lead criar outro evento, manter as duas linhas e considerar como ativa
   a reserva com `provider_created_at` mais recente.
8. Ao cancelar:
   - ignorar a reserva cancelada na interface;
   - manter `call_marcada` se existir outra reserva ativa;
   - voltar de `call_marcada` para `agendamento` se nenhuma reserva ativa
     permanecer;
   - nunca regredir um lead que ja esteja em estagio terminal ou em Projetos.

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

- reserva sem identificacao suficiente ou com mais de um candidato:
  `unmatched`, sem mutacao de lead;
- evento cancelado: atualizar `calendar_bookings.status = 'cancelled'` e
  aplicar deterministicamente a regra da reserva ativa mais recente;
- erro no workflow: registrar a falha no n8n e manter o evento no Calendar;
- nao criar ou apagar leads para compensar um casamento incerto.
