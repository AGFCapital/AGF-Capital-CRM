-- AGF CRM — contratos atômicos para integrações Apollo e Google Calendar.
-- O n8n apenas valida/normaliza a entrada e chama estas funções. Toda regra
-- de deduplicação e mudança de estágio permanece transacional no Postgres.

begin;

alter table public.companies
  add column if not exists apollo_account_id text;

create unique index if not exists companies_apollo_account_id_unique_idx
  on public.companies (apollo_account_id)
  where apollo_account_id is not null;

alter table public.contacts
  add column if not exists apollo_contact_id text,
  add column if not exists email text;

create unique index if not exists contacts_apollo_contact_id_unique_idx
  on public.contacts (apollo_contact_id)
  where apollo_contact_id is not null;

create index if not exists contacts_email_lower_idx
  on public.contacts (lower(email))
  where email is not null;

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('apollo', 'google_calendar')),
  external_event_id text not null,
  event_type text not null,
  status text not null default 'processed'
    check (status in ('processed', 'ignored', 'failed')),
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create index if not exists integration_events_provider_created_idx
  on public.integration_events (provider, created_at desc);

alter table public.integration_events enable row level security;
grant select on public.integration_events to authenticated;
revoke insert, update, delete on public.integration_events from authenticated;

create policy "authenticated users read integration events"
  on public.integration_events
  for select to authenticated
  using (true);

create or replace function public.normalize_company_name(input text)
returns text
language sql
immutable
parallel safe
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        translate(
          lower(coalesce(input, '')),
          'áàãâäéèêëíìîïóòõôöúùûüç',
          'aaaaaeeeeiiiiooooouuuuc'
        ),
        '\m(s/?a|ltda|limitada|eireli|me)\M',
        ' ',
        'gi'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.normalize_linkedin_url(input text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(regexp_replace(split_part(btrim(coalesce(input, '')), '?', 1), '/+$', ''));
$$;

create or replace function public.ingest_apollo_lead(
  p_payload jsonb,
  p_external_event_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company jsonb := coalesce(p_payload -> 'company', '{}'::jsonb);
  v_contact jsonb := coalesce(p_payload -> 'contact', '{}'::jsonb);
  v_company_name text := nullif(btrim(v_company ->> 'name'), '');
  v_company_normalized text;
  v_company_linkedin text := nullif(btrim(v_company ->> 'linkedin_url'), '');
  v_contact_name text := nullif(btrim(v_contact ->> 'full_name'), '');
  v_contact_linkedin text := public.normalize_linkedin_url(v_contact ->> 'linkedin_url');
  v_apollo_account_id text := nullif(btrim(v_company ->> 'apollo_account_id'), '');
  v_apollo_contact_id text := nullif(btrim(v_contact ->> 'apollo_contact_id'), '');
  v_company_id uuid;
  v_contact_id uuid;
  v_lead_id uuid;
  v_existing_contact_id uuid;
  v_existing_stage public.lead_stage;
  v_company_size text;
  v_employee_count integer;
  v_revenue numeric(18,2);
  v_event_id text := nullif(btrim(p_external_event_id), '');
  v_result text := 'created';
begin
  if v_event_id is null then
    raise exception 'external_event_id é obrigatório';
  end if;

  select entity_id
    into v_lead_id
    from public.integration_events
   where provider = 'apollo'
     and external_event_id = v_event_id
   limit 1;

  if found then
    return jsonb_build_object(
      'status', 'duplicate_event',
      'lead_id', v_lead_id,
      'external_event_id', v_event_id
    );
  end if;

  if v_company_name is null then
    raise exception 'company.name é obrigatório';
  end if;
  if v_contact_name is null then
    raise exception 'contact.full_name é obrigatório';
  end if;
  if v_contact_linkedin = '' or v_contact_linkedin not like 'https://www.linkedin.com/in/%' then
    raise exception 'contact.linkedin_url deve ser uma URL de perfil do LinkedIn';
  end if;

  v_company_normalized := public.normalize_company_name(v_company_name);
  if v_company_normalized = '' then
    raise exception 'company.name não pôde ser normalizado';
  end if;

  begin
    v_employee_count := nullif(v_company ->> 'employee_count', '')::integer;
  exception when invalid_text_representation then
    raise exception 'company.employee_count inválido: %', v_company ->> 'employee_count';
  end;

  begin
    v_revenue := nullif(v_company ->> 'annual_revenue', '')::numeric;
  exception when invalid_text_representation then
    raise exception 'company.annual_revenue inválido: %', v_company ->> 'annual_revenue';
  end;

  v_company_size := nullif(v_company ->> 'company_size', '');
  if v_company_size not in ('small', 'medium', 'large') then
    v_company_size := case
      when v_employee_count is null then null
      when v_employee_count > 1000 then 'large'
      when v_employee_count >= 201 then 'medium'
      else 'small'
    end;
  end if;

  if v_apollo_account_id is not null then
    select id into v_company_id
      from public.companies
     where apollo_account_id = v_apollo_account_id;
  end if;

  if v_company_id is null then
    select id into v_company_id
      from public.companies
     where normalized_name = v_company_normalized;
  end if;

  if v_company_id is null then
    insert into public.companies (
      name,
      normalized_name,
      linkedin_url,
      website_domain,
      industry,
      headquarters_city,
      headquarters_state,
      employee_count,
      company_size,
      revenue_proxy_min,
      revenue_proxy_max,
      real_economy,
      apollo_account_id
    )
    values (
      v_company_name,
      v_company_normalized,
      v_company_linkedin,
      nullif(btrim(v_company ->> 'website_domain'), ''),
      nullif(btrim(v_company ->> 'industry'), ''),
      nullif(btrim(v_company ->> 'city'), ''),
      nullif(btrim(v_company ->> 'state'), ''),
      v_employee_count,
      v_company_size,
      v_revenue,
      v_revenue,
      coalesce((v_company ->> 'real_economy')::boolean, false),
      v_apollo_account_id
    )
    returning id into v_company_id;
  else
    update public.companies
       set name = v_company_name,
           linkedin_url = coalesce(v_company_linkedin, linkedin_url),
           website_domain = coalesce(nullif(btrim(v_company ->> 'website_domain'), ''), website_domain),
           industry = coalesce(nullif(btrim(v_company ->> 'industry'), ''), industry),
           headquarters_city = coalesce(nullif(btrim(v_company ->> 'city'), ''), headquarters_city),
           headquarters_state = coalesce(nullif(btrim(v_company ->> 'state'), ''), headquarters_state),
           employee_count = coalesce(v_employee_count, employee_count),
           company_size = coalesce(v_company_size, company_size),
           revenue_proxy_min = coalesce(v_revenue, revenue_proxy_min),
           revenue_proxy_max = coalesce(v_revenue, revenue_proxy_max),
           apollo_account_id = coalesce(v_apollo_account_id, apollo_account_id),
           updated_at = now()
     where id = v_company_id;
  end if;

  if v_apollo_contact_id is not null then
    select id into v_contact_id
      from public.contacts
     where apollo_contact_id = v_apollo_contact_id;
  end if;

  if v_contact_id is null then
    select id into v_contact_id
      from public.contacts
     where public.normalize_linkedin_url(linkedin_url) = v_contact_linkedin;
  end if;

  if v_contact_id is null then
    insert into public.contacts (
      full_name,
      linkedin_url,
      title,
      location_country,
      profile_gate_passed,
      profile_gate_reason,
      apollo_contact_id,
      email
    )
    values (
      v_contact_name,
      v_contact_linkedin,
      nullif(btrim(v_contact ->> 'title'), ''),
      coalesce(nullif(btrim(v_contact ->> 'country'), ''), 'Brasil'),
      false,
      'Importado do Apollo; conexões e disponibilidade do perfil ainda não verificadas.',
      v_apollo_contact_id,
      nullif(lower(btrim(v_contact ->> 'email')), '')
    )
    returning id into v_contact_id;
  else
    update public.contacts
       set full_name = v_contact_name,
           linkedin_url = v_contact_linkedin,
           title = coalesce(nullif(btrim(v_contact ->> 'title'), ''), title),
           location_country = coalesce(nullif(btrim(v_contact ->> 'country'), ''), location_country),
           apollo_contact_id = coalesce(v_apollo_contact_id, apollo_contact_id),
           email = coalesce(nullif(lower(btrim(v_contact ->> 'email')), ''), email),
           updated_at = now()
     where id = v_contact_id;
  end if;

  -- Deduplicação é deliberadamente global: nenhum lead histórico é ignorado.
  select l.id, l.contact_id, l.current_stage
    into v_lead_id, v_existing_contact_id, v_existing_stage
    from public.leads l
   where l.company_id = v_company_id
   order by l.created_at desc
   limit 1;

  if v_lead_id is not null then
    if v_existing_contact_id <> v_contact_id then
      v_result := 'company_contact_conflict';
    else
      v_result := 'existing_lead_updated';
      update public.leads
         set import_origin = concat(
               'Apollo API | event=', v_event_id,
               ' | apollo_contact_id=', coalesce(v_apollo_contact_id, ''),
               ' | apollo_account_id=', coalesce(v_apollo_account_id, '')
             ),
             company_overview = concat_ws(
               ' | ',
               nullif(v_company ->> 'industry', ''),
               case when v_employee_count is not null then v_employee_count || ' funcionários' end,
               case when v_revenue is not null then 'receita Apollo: ' || v_revenue end
             ),
             contact_context = coalesce(nullif(v_contact ->> 'title', ''), contact_context),
             updated_at = now()
       where id = v_lead_id;
    end if;
  else
    -- O mesmo contato ligado a outra empresa exige revisão, não reatribuição.
    select l.id
      into v_lead_id
      from public.leads l
     where l.contact_id = v_contact_id
     order by l.created_at desc
     limit 1;

    if v_lead_id is not null then
      v_result := 'contact_company_conflict';
    else
      insert into public.leads (
        company_id,
        contact_id,
        source,
        current_stage,
        import_origin,
        company_overview,
        contact_context
      )
      values (
        v_company_id,
        v_contact_id,
        'manual_referral',
        'revisao_manual',
        concat(
          'Apollo API | event=', v_event_id,
          ' | apollo_contact_id=', coalesce(v_apollo_contact_id, ''),
          ' | apollo_account_id=', coalesce(v_apollo_account_id, '')
        ),
        concat_ws(
          ' | ',
          nullif(v_company ->> 'industry', ''),
          case when v_employee_count is not null then v_employee_count || ' funcionários' end,
          case when v_revenue is not null then 'receita Apollo: ' || v_revenue end
        ),
        nullif(v_contact ->> 'title', '')
      )
      returning id into v_lead_id;
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
    'apollo',
    v_event_id,
    'lead_upsert',
    case when v_result like '%conflict' then 'ignored' else 'processed' end,
    v_lead_id,
    p_payload
  );

  return jsonb_build_object(
    'status', v_result,
    'lead_id', v_lead_id,
    'company_id', v_company_id,
    'contact_id', v_contact_id,
    'current_stage', v_existing_stage,
    'external_event_id', v_event_id
  );
end;
$$;

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
    v_lead_id := null;
    v_match_method := null;
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
    set lead_id = excluded.lead_id,
        booking_link = excluded.booking_link,
        event_title = excluded.event_title,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        meeting_url = excluded.meeting_url,
        lead_company_answer = excluded.lead_company_answer,
        additional_participant_mentioned = excluded.additional_participant_mentioned,
        additional_participant_note = excluded.additional_participant_note,
        status = excluded.status,
        match_status = excluded.match_status,
        raw_payload = excluded.raw_payload,
        updated_at = now()
  returning id into v_booking_id;

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

revoke all on function public.ingest_apollo_lead(jsonb, text) from public, anon, authenticated;
revoke all on function public.sync_google_calendar_booking(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_apollo_lead(jsonb, text) to service_role;
grant execute on function public.sync_google_calendar_booking(jsonb) to service_role;

commit;
