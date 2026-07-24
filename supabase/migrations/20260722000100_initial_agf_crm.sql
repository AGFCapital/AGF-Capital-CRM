-- AGF CRM — esquema inicial
-- Fonte de verdade após a importação: Supabase.
-- Google Sheets permanece como entrada e espelho de Status CRM.

create extension if not exists pgcrypto;

create type public.lead_source as enum ('vacancy', 'middle_market', 'manual_referral');
create type public.lead_stage as enum (
  'ready_to_send',
  'send_invitation',
  'invitation_sent',
  'send_message',
  'in_conversation',
  'scheduling',
  'call_booked',
  'concluded'
);
create type public.dispatch_action as enum ('connection_invite', 'linkedin_message', 'inmail', 'booking_link');
create type public.dispatch_status as enum ('queued', 'requested', 'sent', 'failed', 'cancelled');
create type public.run_status as enum ('running', 'completed', 'partial', 'failed');
create type public.lead_outcome as enum ('opportunity', 'no_fit', 'no_response', 'declined', 'invalid_contact');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'operator' check (role in ('operator', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  setting_key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.criteria_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  name text not null,
  rules jsonb not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create unique index criteria_versions_one_active_idx
  on public.criteria_versions ((is_active)) where is_active;

create table public.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  source public.lead_source not null,
  environment text not null check (environment in ('test', 'production')),
  criteria_version_id uuid references public.criteria_versions(id) on delete set null,
  requested_count integer not null check (requested_count > 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  discarded_count integer not null default 0 check (discarded_count >= 0),
  status public.run_status not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_summary text,
  details jsonb not null default '{}'::jsonb
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  linkedin_url text,
  website_domain text,
  industry text,
  headquarters_city text,
  headquarters_state text,
  employee_count integer check (employee_count is null or employee_count >= 0),
  company_size text check (company_size in ('small', 'medium', 'large')),
  revenue_proxy_min numeric(18,2),
  revenue_proxy_max numeric(18,2),
  real_economy boolean not null default false,
  real_economy_rationale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name)
);

create unique index companies_linkedin_url_unique_idx
  on public.companies (linkedin_url) where linkedin_url is not null;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  linkedin_url text not null,
  title text,
  location_country text,
  connection_count integer check (connection_count is null or connection_count >= 0),
  connect_available boolean not null default false,
  profile_gate_passed boolean not null default false,
  profile_gate_reason text,
  career_context text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (linkedin_url)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  source public.lead_source not null,
  extraction_run_id uuid references public.extraction_runs(id) on delete set null,
  criteria_version_id uuid references public.criteria_versions(id) on delete set null,
  current_stage public.lead_stage not null default 'ready_to_send',
  source_sheet_tab text,
  source_sheet_row_key text,
  source_sheet_row_number integer,
  company_size_score smallint not null default 0 check (company_size_score between 0 and 3),
  urgency_score smallint check (urgency_score between 0 and 3),
  financial_moment_score smallint check (financial_moment_score between 0 and 3),
  decision_maker_score smallint not null default 0 check (decision_maker_score between 0 and 2),
  real_economy_bonus smallint not null default 0 check (real_economy_bonus between 0 and 1),
  total_score smallint generated always as (
    company_size_score + coalesce(urgency_score, 0) + coalesce(financial_moment_score, 0) + decision_maker_score + real_economy_bonus
  ) stored,
  signal_summary text not null,
  company_overview text,
  contact_context text,
  recent_news jsonb not null default '[]'::jsonb,
  conclusion public.lead_outcome,
  concluded_at timestamptz,
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (source = 'vacancy' and urgency_score is not null and financial_moment_score is null)
    or (source = 'middle_market' and financial_moment_score is not null and urgency_score is null)
    or source = 'manual_referral'
  )
);

-- Uma empresa só tem um card ativo. Um sinal posterior entra no histórico;
-- só reabre o mesmo card se for explicitamente classificado como extremamente forte.
create unique index leads_one_active_company_idx
  on public.leads (company_id) where current_stage <> 'concluded';

create index leads_stage_idx on public.leads (current_stage, created_at desc);
create index leads_source_idx on public.leads (source, total_score desc);
create index leads_contact_idx on public.leads (contact_id);

create table public.lead_signals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  signal_type text not null,
  strength text not null check (strength in ('normal', 'strong', 'extremely_strong')),
  occurred_at timestamptz,
  description text not null,
  evidence_url text,
  source_name text,
  created_at timestamptz not null default now()
);

create index lead_signals_lead_idx on public.lead_signals (lead_id, created_at desc);

create table public.message_drafts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel public.dispatch_action not null check (channel in ('linkedin_message', 'inmail', 'booking_link')),
  body text not null,
  is_current boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index message_drafts_one_current_idx
  on public.message_drafts (lead_id, channel) where is_current;

create table public.dispatches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  action public.dispatch_action not null,
  channel text not null check (channel in ('linkedin', 'inmail', 'calendar')),
  status public.dispatch_status not null default 'queued',
  idempotency_key uuid not null default gen_random_uuid(),
  scheduled_for timestamptz,
  requested_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  initiated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);

create index dispatches_lead_idx on public.dispatches (lead_id, created_at desc);
create index dispatches_pending_idx on public.dispatches (status, scheduled_for) where status in ('queued', 'requested');

create table public.calendar_bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  google_event_id text unique,
  booking_link text,
  event_title text,
  starts_at timestamptz,
  ends_at timestamptz,
  meet_url text,
  lead_company_answer text,
  additional_participant_mentioned boolean not null default false,
  additional_participant_note text,
  status text not null default 'pending' check (status in ('pending', 'booked', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  activity_type text not null,
  from_stage public.lead_stage,
  to_stage public.lead_stage,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);

create table public.sheet_sync_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  target_tab text not null,
  target_row_key text,
  status_value text not null,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'failed')),
  attempted_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index sheet_sync_logs_pending_idx on public.sheet_sync_logs (sync_status, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger app_settings_set_updated_at before update on public.app_settings for each row execute procedure public.set_updated_at();
create trigger companies_set_updated_at before update on public.companies for each row execute procedure public.set_updated_at();
create trigger contacts_set_updated_at before update on public.contacts for each row execute procedure public.set_updated_at();
create trigger leads_set_updated_at before update on public.leads for each row execute procedure public.set_updated_at();
create trigger message_drafts_set_updated_at before update on public.message_drafts for each row execute procedure public.set_updated_at();
create trigger calendar_bookings_set_updated_at before update on public.calendar_bookings for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.criteria_versions enable row level security;
alter table public.extraction_runs enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.lead_signals enable row level security;
alter table public.message_drafts enable row level security;
alter table public.dispatches enable row level security;
alter table public.calendar_bookings enable row level security;
alter table public.lead_activities enable row level security;
alter table public.sheet_sync_logs enable row level security;

create policy "authenticated users can read profiles" on public.profiles for select to authenticated using (true);
create policy "users can update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "authenticated users manage settings" on public.app_settings for all to authenticated using (true) with check (true);
create policy "authenticated users manage criteria" on public.criteria_versions for all to authenticated using (true) with check (true);
create policy "authenticated users manage extraction runs" on public.extraction_runs for all to authenticated using (true) with check (true);
create policy "authenticated users manage companies" on public.companies for all to authenticated using (true) with check (true);
create policy "authenticated users manage contacts" on public.contacts for all to authenticated using (true) with check (true);
create policy "authenticated users manage leads" on public.leads for all to authenticated using (true) with check (true);
create policy "authenticated users manage signals" on public.lead_signals for all to authenticated using (true) with check (true);
create policy "authenticated users manage drafts" on public.message_drafts for all to authenticated using (true) with check (true);
create policy "authenticated users manage dispatches" on public.dispatches for all to authenticated using (true) with check (true);
create policy "authenticated users manage bookings" on public.calendar_bookings for all to authenticated using (true) with check (true);
create policy "authenticated users manage activities" on public.lead_activities for all to authenticated using (true) with check (true);
create policy "authenticated users manage sheet sync logs" on public.sheet_sync_logs for all to authenticated using (true) with check (true);

insert into public.criteria_versions (version, name, is_active, rules)
values (
  1,
  'Critérios AGF — Vagas e Middle market',
  true,
  '{
    "profile_gate": {
      "country": "Brasil",
      "minimum_connections": 100,
      "requires_connect_button": true,
      "failure_action": "discard_before_crm"
    },
    "vacancy": {
      "large_company_contact": "líder ou gerente responsável pela área/vaga; CEO/CFO/dono apenas como fallback",
      "small_medium_contact": "CEO ou CFO prioritário",
      "score": {"porte": "0-3", "urgencia": "0-3", "decisor": "0-2", "economia_real": "0-1"}
    },
    "middle_market": {
      "large_company_contact": "líder ou gerente da área; maior decisor apenas como fallback",
      "small_medium_contact": "dono, CEO, CFO ou head prioritário",
      "requires_recent_financial_or_operational_trigger": true,
      "score": {"porte": "0-3", "momento_financeiro": "0-3", "decisor": "0-2", "economia_real": "0-1"}
    }
  }'::jsonb
)
on conflict (version) do nothing;

insert into public.app_settings (setting_key, description, value)
values
  ('environment', 'Ambiente de operação atual.', '"test"'::jsonb),
  ('lead_extraction', 'Configuração padrão da extração automática.', '{"enabled":true,"time":"07:30","timezone":"America/Sao_Paulo","weekdays":[1,2,3,4,5],"vacancy_count":5,"middle_market_count":15}'::jsonb),
  ('outbound', 'Janela de envio e alerta operacional.', '{"start":"09:00","end":"20:00","timezone":"America/Sao_Paulo","daily_alert_at":20}'::jsonb),
  ('calendar', 'Regras do agendamento pelo Google Calendar.', '{"duration_minutes":30,"slot_minutes":15,"timezone":"America/Sao_Paulo","reminder_minutes":30,"event_title_template":"AGF - Giulio / {empresa} - {lead}"}'::jsonb),
  ('message_template', 'Modelo-base aprovado para a primeira mensagem do Giulio.', '{"body":"{Nome}, tudo bem? Obrigado por aceitar o convite.\\n\\nVi {trigger da empresa}. Imagino que usar AI de verdade no financeiro, sem virar projeto eterno, esteja na pauta aí também.\\n\\nMontei a AGF exatamente para isso. Contamos com profissionais das melhores consultorias do Brasil, que atuam no dia a dia da empresa, do operacional ao estratégico, criando automações no caminho.\\n\\nEu venho de 10+ anos entre banking e corporate development, e fundei uma empresa na qual levantei recursos com investidores institucionais.\\n\\nTopa 15-30 minutos para eu me apresentar rapidamente?"}'::jsonb)
on conflict (setting_key) do nothing;
