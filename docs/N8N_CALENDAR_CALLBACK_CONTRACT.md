# Contrato n8n — Google Calendar para CRM

Atualizado em 5 de agosto de 2026.

## Objetivo

Atualizar automaticamente o card quando uma reserva for criada, remarcada ou
cancelada no Google Appointment Schedule.

## Entrada

O Google Calendar Trigger deve entregar:

- ID do evento;
- data de criação do provedor;
- início e fim;
- estado;
- título;
- Meet;
- nome e e-mail do convidado;
- resposta `Empresa`;
- `host_profile_id` do operador ou `source_calendar_id` da agenda observada;
- payload original.

O formulário deve pedir **Empresa**. O título recomendado continua:

```text
AGF - Giulio / Empresa - Nome do lead
```

## Normalização

- trim e casefold de nome/e-mail;
- empresa sem sufixos triviais para comparação;
- datas convertidas para timestamptz;
- estados convertidos para o enum aceito pelo banco;
- payload original preservado.

O modelo de IA não participa do casamento.

## Identificação da agenda

Cada perfil possui:

- `booking_url`: link público editável pelo próprio usuário;
- `calendar_id`: identificador administrado para o n8n;
- `calendar_enabled`: indica se a agenda está habilitada.

Ao entrar em `agendamento`, o banco congela no lead:

- `scheduling_profile_id`;
- `scheduling_booking_url`;
- `scheduling_started_at`.

O n8n deve enviar preferencialmente `host_profile_id`. Também pode enviar
`source_calendar_id`, normalmente o e-mail/ID da agenda, para o banco resolver
o perfil. Se ambos faltarem, o payload legado continua aceito apenas durante a
transição e retorna `host_match_status = legacy_unscoped`.

Quando a agenda identificada não for a mesma congelada no lead, o RPC falha e
nenhuma alteração é confirmada.

## Ordem de casamento

1. e-mail exato do contato;
2. empresa normalizada com candidato único;
3. nome completo exato com candidato único;
4. fallback conservador:
   - primeiro nome idêntico;
   - no máximo uma inserção, remoção ou substituição;
   - exatamente um candidato ativo;
   - empresa também precisa coincidir quando informada.

Sem candidato único:

```text
lead_id = null
match_status = unmatched
```

Nenhum lead é criado para compensar.

## Reserva criada ou alterada

1. upsert por `provider_event_id`;
2. preencher `provider_created_at`;
3. atualizar horários, Meet e payload;
4. definir match;
5. com match único, mover para `call_marcada`;
6. registrar atividade.

Eventos diferentes do mesmo lead permanecem armazenados. A interface mostra a
reserva ativa com `provider_created_at` mais recente.

## Cancelamento

- marcar a reserva como cancelada;
- ignorá-la na interface;
- manter `call_marcada` se houver outra reserva ativa;
- sem reserva ativa, voltar de `call_marcada` para `agendamento`;
- não regredir lead terminal nem projeto.

## Idempotência

`calendar_bookings.provider_event_id` é único. Reentrega atualiza a mesma
linha.

## Critérios de aceite

- criar reserva move o lead correto;
- horário aparece como `DD/MM/AAAA HH:mm`;
- remarcação atualiza a reserva;
- nova reserva prevalece sobre a anterior;
- cancelamento aplica a regra de fallback;
- evento repetido não duplica;
- lead incerto fica `unmatched`;
- nenhum erro aparece no frontend.
- agenda de outro responsável não altera o card;
- trocar o responsável depois de enviar o link não muda a agenda congelada;
- cada usuário consegue atualizar apenas o próprio `booking_url`.
