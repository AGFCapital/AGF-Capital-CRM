-- Mantem o CRM sincronizado quando uma reserva e remarcada, duplicada ou cancelada.
-- A reserva ativa exibida e sempre a criada mais recentemente no Google Calendar.

begin;

alter table public.calendar_bookings
  add column if not exists provider_created_at timestamptz;

create index if not exists calendar_bookings_lead_active_latest_idx
  on public.calendar_bookings (
    lead_id,
    provider_created_at desc nulls last,
    created_at desc
  )
  where lead_id is not null and status = 'booked';

create or replace function public.sync_google_calendar_booking(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id text := nullif(btrim(p_payload ->> 'provider_event_id'), '');
  v_status text := case
    when lower(coalesce(p_payload ->> 'status', '')) = 'cancelled' then 'cancelled'
    else 'booked'
  end;
  v_guest_email text := nullif(lower(btrim(p_payload ->> 'guest_email')), '');
  v_guest_name text := nullif(btrim(p_payload ->> 'guest_name'), '');
  v_company_answer text := nullif(btrim(p_payload ->> 'company_answer'), '');
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_provider_created_at timestamptz;
  v_lead_id uuid;
  v_existing_lead_id uuid;
  v_existing_status text;
  v_existing_starts_at timestamptz;
  v_match_count integer := 0;
  v_match_method text;
  v_previous_stage public.lead_stage;
  v_booking_id uuid;
  v_latest_active_booking_id uuid;
  v_latest_active_starts_at timestamptz;
  v_latest_active_meeting_url text;
begin
  if v_event_id is null then
    raise exception 'provider_event_id e obrigatorio';
  end if;

  begin
    v_starts_at := nullif(p_payload ->> 'starts_at', '')::timestamptz;
    v_ends_at := nullif(p_payload ->> 'ends_at', '')::timestamptz;
    v_provider_created_at := coalesce(
      nullif(p_payload ->> 'provider_created_at', ''),
      nullif(p_payload #>> '{raw_event,created}', '')
    )::timestamptz;
  exception when invalid_datetime_format then
    raise exception 'starts_at, ends_at ou provider_created_at invalido';
  end;

  if v_status = 'booked' and (v_starts_at is null or v_ends_at is null) then
    raise exception 'starts_at e ends_at sao obrigatorios para reserva confirmada';
  end if;

  select lead_id, status, starts_at
    into v_existing_lead_id, v_existing_status, v_existing_starts_at
    from public.calendar_bookings
   where provider_event_id = v_event_id;

  if v_guest_email is not null then
    select count(*), min(l.id::text)::uuid
      into v_match_count, v_lead_id
      from public.leads l
      join public.contacts c on c.id = l.contact_id
     where lower(c.email) = v_guest_email
       and l.current_stage not in ('concluido', 'convite_expirado', 'descartado');
    if v_match_count = 1 then
      v_match_method := 'guest_email';
    end if;
  end if;

  if v_match_count <> 1 and v_company_answer is not null then
    select count(*), min(l.id::text)::uuid
      into v_match_count, v_lead_id
      from public.leads l
      join public.companies c on c.id = l.company_id
     where c.normalized_name = public.normalize_company_name(v_company_answer)
       and l.current_stage not in ('concluido', 'convite_expirado', 'descartado');
    if v_match_count = 1 then
      v_match_method := 'company_answer';
    end if;
  end if;

  if v_match_count <> 1 and v_guest_name is not null then
    select count(*), min(l.id::text)::uuid
      into v_match_count, v_lead_id
      from public.leads l
      join public.contacts c on c.id = l.contact_id
     where public.normalize_company_name(c.full_name) =
           public.normalize_company_name(v_guest_name)
       and l.current_stage not in ('concluido', 'convite_expirado', 'descartado');
    if v_match_count = 1 then
      v_match_method := 'guest_name';
    end if;
  end if;

  if v_match_count <> 1 then
    v_lead_id := v_existing_lead_id;
    v_match_method := case
      when v_existing_lead_id is not null then 'existing_booking'
      else null
    end;
  end if;

  insert into public.calendar_bookings (
    lead_id,
    provider_event_id,
    provider_created_at,
    booking_link,
    event_title,
    starts_at,
    ends_at,
    meeting_url,
    lead_company_answer,
    additional_participant_mentioned,
    additional_participant_note,
    status,
    match_status,
    raw_payload
  )
  values (
    v_lead_id,
    v_event_id,
    v_provider_created_at,
    nullif(p_payload ->> 'booking_link', ''),
    nullif(p_payload ->> 'event_title', ''),
    v_starts_at,
    v_ends_at,
    nullif(p_payload ->> 'meeting_url', ''),
    v_company_answer,
    coalesce((p_payload ->> 'additional_participant_mentioned')::boolean, false),
    nullif(p_payload ->> 'additional_participant_note', ''),
    v_status,
    case when v_lead_id is null then 'unmatched' else 'matched' end,
    p_payload
  )
  on conflict (provider_event_id) do update
    set lead_id = coalesce(excluded.lead_id, public.calendar_bookings.lead_id),
        provider_created_at = coalesce(
          excluded.provider_created_at,
          public.calendar_bookings.provider_created_at
        ),
        booking_link = coalesce(excluded.booking_link, public.calendar_bookings.booking_link),
        event_title = coalesce(excluded.event_title, public.calendar_bookings.event_title),
        starts_at = coalesce(excluded.starts_at, public.calendar_bookings.starts_at),
        ends_at = coalesce(excluded.ends_at, public.calendar_bookings.ends_at),
        meeting_url = coalesce(excluded.meeting_url, public.calendar_bookings.meeting_url),
        lead_company_answer = coalesce(
          excluded.lead_company_answer,
          public.calendar_bookings.lead_company_answer
        ),
        additional_participant_mentioned =
          excluded.additional_participant_mentioned
          or public.calendar_bookings.additional_participant_mentioned,
        additional_participant_note = coalesce(
          excluded.additional_participant_note,
          public.calendar_bookings.additional_participant_note
        ),
        status = excluded.status,
        match_status = case
          when coalesce(excluded.lead_id, public.calendar_bookings.lead_id) is null
            then 'unmatched'
          else 'matched'
        end,
        raw_payload = excluded.raw_payload,
        updated_at = now()
  returning id, lead_id into v_booking_id, v_lead_id;

  if v_lead_id is not null then
    select id, starts_at, meeting_url
      into v_latest_active_booking_id, v_latest_active_starts_at, v_latest_active_meeting_url
      from public.calendar_bookings
     where lead_id = v_lead_id
       and status = 'booked'
       and match_status in ('matched', 'resolved')
     order by
       coalesce(provider_created_at, created_at) desc,
       created_at desc,
       id desc
     limit 1;

    select current_stage
      into v_previous_stage
      from public.leads
     where id = v_lead_id
     for update;

    if v_status = 'booked'
       and v_previous_stage not in ('concluido', 'convite_expirado', 'descartado') then
      if v_previous_stage <> 'call_marcada' then
        update public.leads
           set current_stage = 'call_marcada',
               updated_at = now()
         where id = v_lead_id;

        insert into public.lead_activities (
          lead_id,
          activity_type,
          from_stage,
          to_stage,
          summary,
          metadata
        )
        values (
          v_lead_id,
          'calendar_booking_received',
          v_previous_stage,
          'call_marcada',
          'Reserva confirmada pelo Google Calendar.',
          jsonb_build_object(
            'provider_event_id', v_event_id,
            'matched_by', v_match_method,
            'starts_at', v_starts_at,
            'meeting_url', p_payload ->> 'meeting_url'
          )
        );
      elsif v_existing_status = 'booked'
            and v_existing_starts_at is distinct from v_starts_at then
        insert into public.lead_activities (
          lead_id,
          activity_type,
          summary,
          metadata
        )
        values (
          v_lead_id,
          'calendar_booking_rescheduled',
          'Reserva remarcada no Google Calendar.',
          jsonb_build_object(
            'provider_event_id', v_event_id,
            'previous_starts_at', v_existing_starts_at,
            'starts_at', v_starts_at
          )
        );
      elsif v_existing_status is null and v_latest_active_booking_id = v_booking_id then
        insert into public.lead_activities (
          lead_id,
          activity_type,
          summary,
          metadata
        )
        values (
          v_lead_id,
          'calendar_booking_replaced',
          'Nova reserva recebida; o CRM passou a considerar o horario mais recente.',
          jsonb_build_object(
            'provider_event_id', v_event_id,
            'starts_at', v_starts_at
          )
        );
      end if;
    elsif v_status = 'cancelled' and v_existing_status is distinct from 'cancelled' then
      if v_latest_active_booking_id is null and v_previous_stage = 'call_marcada' then
        update public.leads
           set current_stage = 'agendamento',
               updated_at = now()
         where id = v_lead_id;

        insert into public.lead_activities (
          lead_id,
          activity_type,
          from_stage,
          to_stage,
          summary,
          metadata
        )
        values (
          v_lead_id,
          'calendar_booking_cancelled',
          'call_marcada',
          'agendamento',
          'Reserva cancelada; nao existe outro horario ativo.',
          jsonb_build_object('provider_event_id', v_event_id)
        );
      elsif v_latest_active_booking_id is not null then
        insert into public.lead_activities (
          lead_id,
          activity_type,
          summary,
          metadata
        )
        values (
          v_lead_id,
          'calendar_booking_cancelled_with_fallback',
          'Reserva cancelada; o CRM manteve a reserva ativa mais recente.',
          jsonb_build_object(
            'provider_event_id', v_event_id,
            'active_booking_id', v_latest_active_booking_id,
            'active_starts_at', v_latest_active_starts_at
          )
        );
      end if;
    end if;
  end if;

  insert into public.integration_events (
    provider,
    external_event_id,
    event_type,
    status,
    entity_id,
    payload
  )
  values (
    'google_calendar',
    concat(v_event_id, ':', v_status, ':', coalesce(v_starts_at::text, '')),
    case
      when v_status = 'cancelled' then 'booking_cancelled'
      when v_existing_status = 'booked'
           and v_existing_starts_at is distinct from v_starts_at
        then 'booking_rescheduled'
      else 'booking_confirmed'
    end,
    case when v_lead_id is null then 'ignored' else 'processed' end,
    coalesce(v_lead_id, v_booking_id),
    p_payload
  )
  on conflict (provider, external_event_id) do update
    set entity_id = excluded.entity_id,
        payload = excluded.payload,
        status = excluded.status,
        processed_at = now();

  return jsonb_build_object(
    'status', v_status,
    'booking_id', v_booking_id,
    'lead_id', v_lead_id,
    'match_status', case when v_lead_id is null then 'unmatched' else 'matched' end,
    'matched_by', v_match_method,
    'active_booking_id', v_latest_active_booking_id,
    'active_starts_at', v_latest_active_starts_at,
    'active_meeting_url', v_latest_active_meeting_url
  );
end;
$$;

revoke all on function public.sync_google_calendar_booking(jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_google_calendar_booking(jsonb)
  to service_role;

commit;
