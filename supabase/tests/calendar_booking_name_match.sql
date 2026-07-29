-- Regressao: um erro de digitacao de uma letra no nome do card nao pode
-- impedir o vinculo quando existe um unico candidato forte.
begin;

do $$
declare
  v_company_id uuid;
  v_contact_id uuid;
  v_lead_id uuid;
  v_result jsonb;
begin
  insert into public.companies (name, normalized_name)
  values (
    'AGF Test Calendar Match',
    public.normalize_company_name('AGF Test Calendar Match')
  )
  returning id into v_company_id;

  insert into public.contacts (full_name, linkedin_url)
  values (
    'Zafir Qwertyson',
    'https://www.linkedin.com/in/agf-calendar-match-test'
  )
  returning id into v_contact_id;

  insert into public.leads (
    company_id,
    contact_id,
    source,
    current_stage
  )
  values (
    v_company_id,
    v_contact_id,
    'manual_referral',
    'agendamento'
  )
  returning id into v_lead_id;

  v_result := public.sync_google_calendar_booking(
    jsonb_build_object(
      'provider_event_id', 'agf-calendar-name-match-regression',
      'provider_created_at', '2026-07-28T18:00:00-03:00',
      'status', 'booked',
      'event_title', 'Teste CRM (Zafir Qwertison)',
      'guest_name', 'Zafir Qwertison',
      'guest_email', 'zafir.calendar-match@example.com',
      'starts_at', '2026-07-29T12:00:00-03:00',
      'ends_at', '2026-07-29T12:30:00-03:00',
      'raw_event', jsonb_build_object('created', '2026-07-28T18:00:00-03:00')
    )
  );

  if nullif(v_result ->> 'lead_id', '')::uuid is distinct from v_lead_id then
    raise exception
      'REGRESSION: expected lead %, got result %',
      v_lead_id,
      v_result;
  end if;

  if (
    select email
      from public.contacts
     where id = v_contact_id
  ) is distinct from 'zafir.calendar-match@example.com' then
    raise exception 'REGRESSION: guest email was not persisted after confident match';
  end if;
end;
$$;

rollback;
