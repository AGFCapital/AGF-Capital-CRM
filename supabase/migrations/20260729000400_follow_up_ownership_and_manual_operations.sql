-- AGF CRM — ownership de follow-ups, notificacoes por e-mail e operacoes
-- manuais atomicas do CRM.

begin;

alter table public.profiles
  add column notification_email text,
  add column follow_up_email_enabled boolean not null default true;

update public.profiles profile
   set notification_email = auth_user.email
  from auth.users auth_user
 where auth_user.id = profile.id
   and profile.notification_email is null;

alter table public.profiles
  add constraint profiles_notification_email_check
  check (
    notification_email is null
    or notification_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, notification_email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );
  return new;
end;
$$;

alter table public.lead_follow_ups
  add column assigned_to uuid references public.profiles(id) on delete set null;

update public.lead_follow_ups
   set assigned_to = created_by
 where assigned_to is null;

create index lead_follow_ups_assignee_open_due_idx
  on public.lead_follow_ups (assigned_to, due_at)
  where status = 'open';

create or replace function public.assign_follow_up_creator()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.assigned_to is null then
    new.assigned_to := coalesce(new.created_by, auth.uid());
  end if;
  return new;
end;
$$;

create trigger lead_follow_ups_assign_creator
  before insert on public.lead_follow_ups
  for each row execute procedure public.assign_follow_up_creator();

create table public.follow_up_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null unique
    references public.lead_follow_ups(id) on delete cascade,
  recipient_profile_id uuid not null
    references public.profiles(id) on delete cascade,
  recipient_email text not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  provider_message_id text,
  last_error text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index follow_up_email_deliveries_pending_idx
  on public.follow_up_email_deliveries (scheduled_for)
  where status in ('pending', 'failed');

create trigger follow_up_email_deliveries_set_updated_at
  before update on public.follow_up_email_deliveries
  for each row execute procedure public.set_updated_at();

alter table public.follow_up_email_deliveries enable row level security;
grant select on public.follow_up_email_deliveries to authenticated;
create policy "authenticated users read follow up email deliveries"
  on public.follow_up_email_deliveries
  for select to authenticated
  using (true);

create or replace function public.sync_follow_up_email_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if new.assigned_to is null then
    return new;
  end if;

  select notification_email
    into v_email
    from public.profiles
   where id = new.assigned_to;

  if v_email is null then
    return new;
  end if;

  insert into public.follow_up_email_deliveries (
    follow_up_id,
    recipient_profile_id,
    recipient_email,
    scheduled_for,
    status
  )
  values (
    new.id,
    new.assigned_to,
    v_email,
    new.due_at,
    case when new.status = 'open' then 'pending' else 'cancelled' end
  )
  on conflict (follow_up_id) do update
    set recipient_profile_id = excluded.recipient_profile_id,
        recipient_email = excluded.recipient_email,
        scheduled_for = excluded.scheduled_for,
        status = case
          when follow_up_email_deliveries.status = 'sent'
            then follow_up_email_deliveries.status
          when new.status = 'open'
            then 'pending'
          else 'cancelled'
        end,
        last_error = null,
        claimed_at = null;

  return new;
end;
$$;

create trigger lead_follow_ups_sync_email_delivery
  after insert or update of assigned_to, due_at, status
  on public.lead_follow_ups
  for each row execute procedure public.sync_follow_up_email_delivery();

insert into public.follow_up_email_deliveries (
  follow_up_id,
  recipient_profile_id,
  recipient_email,
  scheduled_for
)
select follow_up.id,
       follow_up.assigned_to,
       profile.notification_email,
       follow_up.due_at
  from public.lead_follow_ups follow_up
  join public.profiles profile on profile.id = follow_up.assigned_to
 where follow_up.status = 'open'
   and profile.notification_email is not null
on conflict (follow_up_id) do nothing;

create or replace function public.sync_profile_follow_up_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.notification_email is null then
    update public.follow_up_email_deliveries
       set status = 'cancelled'
     where recipient_profile_id = new.id
       and status in ('pending', 'failed');
    return new;
  end if;

  update public.follow_up_email_deliveries
     set recipient_email = new.notification_email,
         status = case
           when status = 'cancelled' then 'pending'
           else status
         end
   where recipient_profile_id = new.id
     and status in ('pending', 'failed', 'cancelled');

  insert into public.follow_up_email_deliveries (
    follow_up_id,
    recipient_profile_id,
    recipient_email,
    scheduled_for
  )
  select follow_up.id,
         new.id,
         new.notification_email,
         follow_up.due_at
    from public.lead_follow_ups follow_up
   where follow_up.assigned_to = new.id
     and follow_up.status = 'open'
  on conflict (follow_up_id) do nothing;

  return new;
end;
$$;

create trigger profiles_sync_follow_up_email
  after update of notification_email on public.profiles
  for each row execute procedure public.sync_profile_follow_up_email();

create or replace view public.follow_up_email_queue
with (security_invoker = true)
as
select delivery.id as delivery_id,
       delivery.follow_up_id,
       delivery.recipient_profile_id,
       profile.notification_email as recipient_email,
       profile.full_name as recipient_name,
       delivery.scheduled_for,
       delivery.status,
       delivery.attempts,
       follow_up.note,
       company.name as company_name,
       contact.full_name as contact_name,
       lead.id as lead_id
  from public.follow_up_email_deliveries delivery
  join public.lead_follow_ups follow_up on follow_up.id = delivery.follow_up_id
  join public.profiles profile on profile.id = delivery.recipient_profile_id
  join public.leads lead on lead.id = follow_up.lead_id
  join public.companies company on company.id = lead.company_id
  join public.contacts contact on contact.id = lead.contact_id
 where follow_up.status = 'open'
   and profile.follow_up_email_enabled
   and profile.notification_email is not null
   and delivery.status in ('pending', 'failed')
   and delivery.attempts < 3;

grant select on public.follow_up_email_queue to authenticated, service_role;

create or replace function public.claim_follow_up_email(p_delivery_id uuid)
returns public.follow_up_email_deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.follow_up_email_deliveries;
begin
  update public.follow_up_email_deliveries
     set status = 'processing',
         attempts = attempts + 1,
         claimed_at = now(),
         last_error = null
   where id = p_delivery_id
     and status in ('pending', 'failed')
     and scheduled_for <= now()
     and attempts < 3
  returning * into v_delivery;

  return v_delivery;
end;
$$;

create or replace function public.complete_follow_up_email(
  p_delivery_id uuid,
  p_sent boolean,
  p_provider_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.follow_up_email_deliveries
     set status = case when p_sent then 'sent' else 'failed' end,
         provider_message_id = p_provider_message_id,
         last_error = case when p_sent then null else nullif(btrim(p_error), '') end,
         sent_at = case when p_sent then now() else null end
   where id = p_delivery_id
     and status = 'processing';
end;
$$;

revoke all on function public.claim_follow_up_email(uuid) from public, anon, authenticated;
revoke all on function public.complete_follow_up_email(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.claim_follow_up_email(uuid) to service_role;
grant execute on function public.complete_follow_up_email(uuid, boolean, text, text) to service_role;

create or replace function public.create_manual_lead(
  p_company_name text,
  p_contact_name text,
  p_contact_title text,
  p_linkedin_url text,
  p_industry text default null,
  p_city text default null,
  p_state text default null,
  p_organization_label text default null,
  p_responsible_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_name text := nullif(btrim(p_company_name), '');
  v_contact_name text := nullif(btrim(p_contact_name), '');
  v_company_normalized text;
  v_linkedin_normalized text;
  v_company_id uuid;
  v_contact_id uuid;
  v_lead_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if v_company_name is null or v_contact_name is null then
    raise exception 'company_and_contact_required';
  end if;

  v_company_normalized := public.normalize_company_name(v_company_name);
  v_linkedin_normalized := public.normalize_linkedin_url(p_linkedin_url);
  if v_linkedin_normalized = '' then
    raise exception 'linkedin_url_required';
  end if;

  select id into v_company_id
    from public.companies
   where normalized_name = v_company_normalized;

  if v_company_id is null then
    insert into public.companies (
      name,
      normalized_name,
      industry,
      headquarters_city,
      headquarters_state
    )
    values (
      v_company_name,
      v_company_normalized,
      nullif(btrim(p_industry), ''),
      nullif(btrim(p_city), ''),
      nullif(btrim(p_state), '')
    )
    returning id into v_company_id;
  else
    update public.companies
       set industry = coalesce(nullif(btrim(p_industry), ''), industry),
           headquarters_city = coalesce(nullif(btrim(p_city), ''), headquarters_city),
           headquarters_state = coalesce(nullif(btrim(p_state), ''), headquarters_state)
     where id = v_company_id;
  end if;

  select id into v_contact_id
    from public.contacts
   where public.normalize_linkedin_url(linkedin_url) = v_linkedin_normalized;

  if v_contact_id is null then
    insert into public.contacts (
      full_name,
      linkedin_url,
      title,
      location_country,
      profile_gate_passed,
      profile_gate_reason
    )
    values (
      v_contact_name,
      v_linkedin_normalized,
      nullif(btrim(p_contact_title), ''),
      'Brasil',
      true,
      'Lead inserido manualmente por operador autenticado.'
    )
    returning id into v_contact_id;
  end if;

  insert into public.leads (
    company_id,
    contact_id,
    source,
    current_stage,
    import_origin,
    organization_label,
    responsible_id
  )
  values (
    v_company_id,
    v_contact_id,
    'manual_referral',
    'revisao_manual',
    'Cadastro manual no CRM',
    nullif(btrim(p_organization_label), ''),
    p_responsible_id
  )
  returning id into v_lead_id;

  insert into public.lead_activities (
    lead_id,
    activity_type,
    summary,
    created_by
  )
  values (
    v_lead_id,
    'manual_lead_created',
    'Lead criado manualmente na Base de clientes.',
    auth.uid()
  );

  return v_lead_id;
end;
$$;

grant execute on function public.create_manual_lead(
  text, text, text, text, text, text, text, text, uuid
) to authenticated;

create or replace function public.promote_lead_to_project(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads;
  v_company public.companies;
  v_contact public.contacts;
  v_project_id uuid;
  v_responsible_name text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select * into v_lead
    from public.leads
   where id = p_lead_id
   for update;
  if v_lead.id is null or v_lead.current_stage <> 'call_marcada' then
    raise exception 'lead_must_be_call_marcada';
  end if;

  select * into v_company from public.companies where id = v_lead.company_id;
  select * into v_contact from public.contacts where id = v_lead.contact_id;
  select coalesce(full_name, 'Operador AGF')
    into v_responsible_name
    from public.profiles
   where id = auth.uid();

  insert into public.commercial_projects (
    lead_id,
    company_id,
    name,
    company_name,
    responsible_name,
    current_stage,
    description,
    created_by
  )
  values (
    v_lead.id,
    v_company.id,
    'Oportunidade — ' || v_company.name,
    v_company.name,
    coalesce(v_responsible_name, 'Operador AGF'),
    'pos_call',
    'Projeto criado a partir da call com ' || v_contact.full_name || '.',
    auth.uid()
  )
  returning id into v_project_id;

  update public.leads
     set current_stage = 'concluido'
   where id = v_lead.id;

  return v_project_id;
end;
$$;

grant execute on function public.promote_lead_to_project(uuid) to authenticated;

create or replace function public.delete_commercial_project(
  p_project_id uuid,
  p_restore_lead boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select lead_id into v_lead_id
    from public.commercial_projects
   where id = p_project_id
   for update;

  if not found then
    raise exception 'project_not_found';
  end if;

  delete from public.commercial_projects where id = p_project_id;

  if p_restore_lead and v_lead_id is not null then
    update public.leads
       set current_stage = 'call_marcada'
     where id = v_lead_id
       and current_stage = 'concluido';
  end if;

  return v_lead_id;
end;
$$;

grant execute on function public.delete_commercial_project(uuid, boolean) to authenticated;

commit;
