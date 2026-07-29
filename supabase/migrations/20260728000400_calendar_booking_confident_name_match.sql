-- Resolve reservas quando o formulario e o CRM diferem por um erro pequeno
-- de digitacao no nome. O fallback e conservador: primeiro nome igual,
-- similaridade alta e exatamente um candidato ativo.

begin;

create extension if not exists pg_trgm with schema extensions;

create or replace function public.resolve_calendar_booking_confident_name_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_name text := nullif(btrim(new.raw_payload ->> 'guest_name'), '');
  v_guest_email text := nullif(lower(btrim(new.raw_payload ->> 'guest_email')), '');
  v_company_answer text := nullif(btrim(new.raw_payload ->> 'company_answer'), '');
  v_normalized_guest_name text;
  v_normalized_company_answer text;
  v_candidate_count integer := 0;
  v_candidate_lead_id uuid;
  v_candidate_contact_id uuid;
  v_candidate_similarity real;
begin
  if new.lead_id is not null or v_guest_name is null then
    return new;
  end if;

  v_normalized_guest_name := public.normalize_company_name(v_guest_name);
  v_normalized_company_answer := public.normalize_company_name(v_company_answer);

  -- Nomes de uma palavra sao comuns demais para um casamento aproximado.
  if v_normalized_guest_name = ''
     or position(' ' in v_normalized_guest_name) = 0 then
    return new;
  end if;

  select
    count(*)::integer,
    min(candidate.lead_id::text)::uuid,
    min(candidate.contact_id::text)::uuid,
    max(candidate.name_similarity)
  into
    v_candidate_count,
    v_candidate_lead_id,
    v_candidate_contact_id,
    v_candidate_similarity
  from (
    select
      l.id as lead_id,
      c.id as contact_id,
      extensions.similarity(
        public.normalize_company_name(c.full_name),
        v_normalized_guest_name
      ) as name_similarity
    from public.leads l
    join public.contacts c on c.id = l.contact_id
    join public.companies company on company.id = l.company_id
    where l.current_stage not in (
      'concluido',
      'convite_expirado',
      'descartado'
    )
      and position(' ' in public.normalize_company_name(c.full_name)) > 0
      and split_part(public.normalize_company_name(c.full_name), ' ', 1) =
          split_part(v_normalized_guest_name, ' ', 1)
      and (
        v_normalized_company_answer is null
        or v_normalized_company_answer = ''
        or company.normalized_name = v_normalized_company_answer
      )
      and extensions.similarity(
        public.normalize_company_name(c.full_name),
        v_normalized_guest_name
      ) >= 0.72
  ) as candidate;

  if v_candidate_count <> 1 then
    return new;
  end if;

  new.lead_id := v_candidate_lead_id;
  new.match_status := 'matched';
  new.raw_payload := coalesce(new.raw_payload, '{}'::jsonb)
    || jsonb_build_object(
      'calendar_match',
      jsonb_build_object(
        'method', 'guest_name_fuzzy_unique',
        'confidence', round(v_candidate_similarity::numeric, 4),
        'crm_lead_id', v_candidate_lead_id,
        'calendar_guest_name', v_guest_name
      )
    );

  -- Uma vez que o casamento foi forte e unico, guardar o e-mail do formulario
  -- torna remarcacoes e cancelamentos futuros uma igualdade exata.
  if v_guest_email is not null then
    update public.contacts
       set email = v_guest_email,
           updated_at = now()
     where id = v_candidate_contact_id
       and email is null;
  end if;

  return new;
end;
$$;

drop trigger if exists calendar_bookings_confident_name_match
  on public.calendar_bookings;

create trigger calendar_bookings_confident_name_match
before insert or update of lead_id, raw_payload
on public.calendar_bookings
for each row
execute function public.resolve_calendar_booking_confident_name_match();

revoke all on function public.resolve_calendar_booking_confident_name_match()
  from public, anon, authenticated;

commit;
