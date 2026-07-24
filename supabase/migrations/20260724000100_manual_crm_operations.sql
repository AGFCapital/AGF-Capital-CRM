-- AGF CRM — operação comercial manual.
-- A descoberta e a extração de leads continuam fora deste domínio. Esta
-- migration adiciona apenas os registros necessários para operar um lead já
-- existente, acompanhar follow-ups e gerir projetos comerciais manuais.

begin;

create table public.lead_follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  due_at timestamptz not null,
  note text not null check (nullif(btrim(note), '') is not null),
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_follow_ups_completion_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create index lead_follow_ups_open_due_idx
  on public.lead_follow_ups (due_at asc)
  where status = 'open';

create index lead_follow_ups_lead_idx
  on public.lead_follow_ups (lead_id, due_at desc);

create trigger lead_follow_ups_set_updated_at
  before update on public.lead_follow_ups
  for each row execute procedure public.set_updated_at();

alter table public.lead_follow_ups enable row level security;
grant select, insert, update, delete on public.lead_follow_ups to authenticated;
create policy "authenticated users manage lead follow ups"
  on public.lead_follow_ups
  for all to authenticated
  using (true)
  with check (true);

create type public.commercial_project_stage as enum (
  'pos_call',
  'proposta',
  'negociacao',
  'projeto',
  'ganho',
  'perdido'
);

create table public.commercial_projects (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  name text not null check (nullif(btrim(name), '') is not null),
  company_name text not null check (nullif(btrim(company_name), '') is not null),
  responsible_name text not null check (nullif(btrim(responsible_name), '') is not null),
  current_stage public.commercial_project_stage not null default 'pos_call',
  description text,
  next_action text,
  next_action_at timestamptz,
  estimated_value numeric(18,2) check (estimated_value is null or estimated_value >= 0),
  notes text,
  closed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_projects_closed_stage_check check (
    (current_stage in ('ganho', 'perdido') and closed_at is not null)
    or (current_stage not in ('ganho', 'perdido') and closed_at is null)
  )
);

create index commercial_projects_stage_idx
  on public.commercial_projects (current_stage, updated_at desc);
create index commercial_projects_lead_idx
  on public.commercial_projects (lead_id)
  where lead_id is not null;

create trigger commercial_projects_set_updated_at
  before update on public.commercial_projects
  for each row execute procedure public.set_updated_at();

alter table public.commercial_projects enable row level security;
grant select, insert, update, delete on public.commercial_projects to authenticated;
create policy "authenticated users manage commercial projects"
  on public.commercial_projects
  for all to authenticated
  using (true)
  with check (true);

-- Link público não é segredo. A agenda é criada e confirmada pelo Google
-- Calendar/n8n; o CRM apenas o apresenta para cópia na etapa Agendamento.
insert into public.app_settings (setting_key, description, value)
values (
  'calendar_booking',
  'Configuração pública da página de agendamento usada na mensagem manual.',
  '{"booking_url":"","timezone":"America/Sao_Paulo","duration_minutes":30,"slot_minutes":15}'::jsonb
)
on conflict (setting_key) do nothing;

commit;
