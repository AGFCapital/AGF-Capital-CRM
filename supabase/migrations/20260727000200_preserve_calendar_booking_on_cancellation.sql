-- Preserva dados confirmados quando uma notificação de cancelamento chega
-- sem repetir todos os campos do evento original.

begin;

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
  v_lead_id uuid;
  v_existing_lead_id uuid;
  v_match_count integer := 0;
  v_match_method text;
  v_previous_stage public.lead_stage;
  v_booking_id uuid;
begin
  if v_event_id is null then
    raise exception 'provider_event_id é obrigatório';
  end if;

  begin
    v_starts_at := nullif(p_payload ->> 'starts_at', '')::timestamptz;
    v_ends_at := nullif(p_payload ->> 'ends_at', '')::timestamptz;
  exception when invalid_datetime_format then
    raise exception 'starts_at ou ends_at inválido';
  end;

  if v_status = 'booked' and (v_starts_at is null or v_ends_at is null) then
    raise exception 'starts_at e ends_at são obrigatórios para reserva confirmada';
  end if;

  select lead_id
    into v_existing_lead_id
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
    v_lead_id := case
      when v_status = 'cancelled' then v_existing_lead_id
      else null
    end;
    v_match_method := case
      when v_status = 'cancelled' and v_existing_lead_id is not null
        then 'existing_booking'
      else null
    end;
  end if;

  insert into public.calendar_bookings (
    lead_id,
    provider_event_id,
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

  if v_lead_id is not null and v_status = 'booked' then
    select current_stage into v_previous_stage
      from public.leads
     where id = v_lead_id
     for update;

    if v_previous_stage <> 'call_marcada' then
      update public.leads
         set current_stage = 'call_marcada',
             updated_at = now()
       where id = v_lead_id;

      insert into public.lead_activities (
        lead_id,
        activity_type,
        summary,
        metadata
      )
      values (
        v_lead_id,
        'calendar_booking_received',
        'Reserva confirmada pelo Google Calendar.',
        jsonb_build_object(
          'provider_event_id', v_event_id,
          'matched_by', v_match_method,
          'starts_at', v_starts_at,
          'meeting_url', p_payload ->> 'meeting_url'
        )
      );
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
    case when v_status = 'cancelled' then 'booking_cancelled' else 'booking_confirmed' end,
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
    'starts_at', v_starts_at,
    'meeting_url', p_payload ->> 'meeting_url'
  );
end;
$$;

revoke all on function public.sync_google_calendar_booking(jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_google_calendar_booking(jsonb)
  to service_role;

commit;
