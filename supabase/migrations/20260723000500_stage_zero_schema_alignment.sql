-- AGF CRM — Etapa 0: limpeza e alinhamento do schema com o contrato v2.
-- Esta migration preserva as migrations históricas e remove o acoplamento
-- operacional com Google Sheets.

begin;

-- Falhar explicitamente se houver ações InMail que não possam ser removidas
-- sem uma decisão de negócio. Não existe conversão aproximada.
do $$
begin
  if exists (
    select 1 from public.dispatches where action::text = 'inmail'
    union all
    select 1 from public.message_drafts where channel::text = 'inmail'
  ) then
    raise exception 'Etapa 0 bloqueada: existem registros InMail. Remova-os ou classifique-os explicitamente antes da migration.';
  end if;
end;
$$;

-- Remoção integral do antigo espelho do Google Sheets.
drop view if exists public.pending_sheet_status_sync;
drop trigger if exists leads_queue_sheet_status_sync on public.leads;
drop function if exists public.queue_sheet_status_sync();
drop function if exists public.lead_stage_label(public.lead_stage);
drop table if exists public.sheet_sync_logs;

alter table public.leads
  drop column if exists source_sheet_tab,
  drop column if exists source_sheet_row_key,
  drop column if exists source_sheet_row_number;

-- Pipeline v2. A ausência de default é intencional: toda ingestão deve
-- informar um estágio válido. Valor ausente ou fora do enum falha no banco.
drop index if exists public.leads_one_active_company_idx;

create type public.lead_stage_v2 as enum (
  'qualificado',
  'aprovado',
  'convite_enviado',
  'conexao_aceita',
  'mensagem_enviada',
  'em_conversa',
  'agendamento',
  'call_marcada',
  'concluido',
  'convite_expirado',
  'descartado',
  'revisao_manual'
);

alter table public.leads alter column current_stage drop default;

alter table public.leads
  alter column current_stage type public.lead_stage_v2
  using (
    case current_stage::text
      when 'ready_to_send' then 'qualificado'
      when 'approved' then 'aprovado'
      when 'send_invitation' then 'aprovado'
      when 'invitation_sent' then 'convite_enviado'
      when 'send_message' then 'convite_enviado'
      when 'in_conversation' then 'em_conversa'
      when 'scheduling' then 'agendamento'
      when 'call_booked' then 'call_marcada'
      when 'concluded' then 'concluido'
      else null
    end
  )::public.lead_stage_v2;

alter table public.lead_activities
  alter column from_stage type public.lead_stage_v2
  using (
    case from_stage::text
      when 'ready_to_send' then 'qualificado'
      when 'approved' then 'aprovado'
      when 'send_invitation' then 'aprovado'
      when 'invitation_sent' then 'convite_enviado'
      when 'send_message' then 'convite_enviado'
      when 'in_conversation' then 'em_conversa'
      when 'scheduling' then 'agendamento'
      when 'call_booked' then 'call_marcada'
      when 'concluded' then 'concluido'
      else null
    end
  )::public.lead_stage_v2,
  alter column to_stage type public.lead_stage_v2
  using (
    case to_stage::text
      when 'ready_to_send' then 'qualificado'
      when 'approved' then 'aprovado'
      when 'send_invitation' then 'aprovado'
      when 'invitation_sent' then 'convite_enviado'
      when 'send_message' then 'convite_enviado'
      when 'in_conversation' then 'em_conversa'
      when 'scheduling' then 'agendamento'
      when 'call_booked' then 'call_marcada'
      when 'concluded' then 'concluido'
      else null
    end
  )::public.lead_stage_v2;

drop type public.lead_stage;
alter type public.lead_stage_v2 rename to lead_stage;

comment on column public.leads.current_stage is
  'Obrigatório e sem default. Importações com estágio ausente ou inválido devem falhar explicitamente.';

alter table public.leads
  add column invited_at timestamptz,
  add column accepted_at timestamptz,
  add column message_copied_at timestamptz,
  add column message_sent_at timestamptz,
  add column message_sent_by uuid references public.profiles(id) on delete set null,
  add column discard_reason text,
  add column import_origin text,
  drop column signal_summary,
  drop column recent_news,
  add constraint leads_discard_reason_required_check check (
    current_stage <> 'descartado'::public.lead_stage
    or nullif(btrim(discard_reason), '') is not null
  );

create unique index leads_one_active_company_idx
  on public.leads (company_id)
  where current_stage not in (
    'concluido'::public.lead_stage,
    'convite_expirado'::public.lead_stage,
    'descartado'::public.lead_stage
  );

-- Mantém o histórico de estágio sem qualquer dependência de Sheets.
create or replace function public.record_lead_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lead_activities (
    lead_id,
    activity_type,
    from_stage,
    to_stage,
    summary
  )
  values (
    new.id,
    'stage_changed',
    old.current_stage,
    new.current_stage,
    'Etapa alterada para ' || new.current_stage::text
  );

  return new;
end;
$$;

create trigger leads_record_stage_change
  after update of current_stage on public.leads
  for each row
  when (old.current_stage is distinct from new.current_stage)
  execute procedure public.record_lead_stage_change();

-- Sinais verificados: cada fato mantém a data do acontecimento e a data da
-- publicação. A regra operacional de seis meses exige que ambas estejam
-- dentro da janela; a data mais antiga é a restritiva.
alter table public.lead_signals
  drop constraint if exists lead_signals_strength_check,
  drop column strength;
alter table public.lead_signals rename column signal_type to family;
alter table public.lead_signals rename column description to summary;
alter table public.lead_signals rename column evidence_url to source_url;

alter table public.lead_signals
  alter column occurred_at set not null,
  alter column source_url set not null,
  alter column source_name set not null,
  add column published_at date not null,
  add column verified_at timestamptz not null,
  add column verification_method text not null,
  add constraint lead_signals_verification_method_not_blank_check
    check (nullif(btrim(verification_method), '') is not null);

comment on table public.lead_signals is
  'Fonte de verdade dos fatos. Para qualificação nos últimos seis meses, occurred_at e published_at devem estar na janela; prevalece a data mais antiga.';

drop index if exists public.lead_signals_lead_idx;
create index lead_signals_lead_recency_idx
  on public.lead_signals (lead_id, published_at desc, occurred_at desc);

-- Remove InMail do domínio de ações.
alter table public.message_drafts drop constraint if exists message_drafts_channel_check;

create type public.dispatch_action_v2 as enum (
  'connection_invite',
  'linkedin_message',
  'booking_link'
);

alter table public.message_drafts
  alter column channel type public.dispatch_action_v2
  using channel::text::public.dispatch_action_v2;

alter table public.dispatches
  alter column action type public.dispatch_action_v2
  using action::text::public.dispatch_action_v2;

drop type public.dispatch_action;
alter type public.dispatch_action_v2 rename to dispatch_action;

alter table public.message_drafts
  add constraint message_drafts_channel_check
  check (channel in ('linkedin_message', 'booking_link'));

-- Dry-run e idempotência de dispatch. O enum é reconstruído para que a
-- migration e o rollback sejam simétricos.
drop index if exists public.dispatches_pending_idx;

create type public.dispatch_status_v2 as enum (
  'queued',
  'requested',
  'simulated',
  'sent',
  'failed',
  'cancelled'
);

alter table public.dispatches
  alter column status drop default,
  alter column status type public.dispatch_status_v2
  using status::text::public.dispatch_status_v2;

drop type public.dispatch_status;
alter type public.dispatch_status_v2 rename to dispatch_status;
alter table public.dispatches alter column status set default 'queued';

create index dispatches_pending_idx
  on public.dispatches (status, scheduled_for)
  where status in (
    'queued'::public.dispatch_status,
    'requested'::public.dispatch_status
  );

alter table public.dispatches drop constraint if exists dispatches_channel_check;
alter table public.dispatches
  add column content_hash text,
  add column executed_by uuid references public.profiles(id) on delete set null;

update public.dispatches
set channel = case
  when action = 'connection_invite'::public.dispatch_action then 'automated'
  else 'manual'
end,
content_hash = encode(
  sha256(
    convert_to(
      coalesce(payload::text, '') || ':' || action::text,
      'UTF8'
    )
  ),
  'hex'
);

alter table public.dispatches
  alter column content_hash set not null,
  add constraint dispatches_channel_check
    check (channel in ('automated', 'manual')),
  add constraint dispatches_content_hash_check
    check (content_hash ~ '^[0-9a-f]{64}$');

create unique index dispatches_manual_content_active_idx
  on public.dispatches (lead_id, action, content_hash)
  where action in (
      'linkedin_message'::public.dispatch_action,
      'booking_link'::public.dispatch_action
    )
    and status in (
    'queued'::public.dispatch_status,
    'requested'::public.dispatch_status
  );

create unique index dispatches_one_connection_invite_idx
  on public.dispatches (lead_id)
  where action = 'connection_invite'::public.dispatch_action
    and status in (
      'queued'::public.dispatch_status,
      'requested'::public.dispatch_status,
      'sent'::public.dispatch_status
    );

comment on index public.dispatches_one_connection_invite_idx is
  'Um lead só pode receber novo convite se o dispatch anterior tiver status failed ou cancelled.';

create index dispatches_connection_invites_sent_at_idx
  on public.dispatches (sent_at desc)
  where action = 'connection_invite'::public.dispatch_action
    and status = 'sent'::public.dispatch_status;

comment on index public.dispatches_connection_invites_sent_at_idx is
  'Suporta o teto semanal: contar dispatches sent de connection_invite diretamente na janela rolante de sete dias. outreach_metrics nunca é fonte de bloqueio.';

-- Reservas Calendly/Cal.com, inclusive payloads ainda sem correspondência.
alter table public.calendar_bookings
  drop constraint if exists calendar_bookings_lead_id_key,
  alter column lead_id drop not null;

alter table public.calendar_bookings rename column google_event_id to provider_event_id;
alter table public.calendar_bookings rename column meet_url to meeting_url;
alter table public.calendar_bookings
  rename constraint calendar_bookings_google_event_id_key
  to calendar_bookings_provider_event_id_key;

alter table public.calendar_bookings
  add column match_status text not null default 'unmatched'
    check (match_status in ('matched', 'unmatched', 'resolved')),
  add column matched_by uuid references public.profiles(id) on delete set null,
  add column raw_payload jsonb not null default '{}'::jsonb,
  add constraint calendar_bookings_match_requires_lead_check check (
    match_status = 'unmatched' or lead_id is not null
  );

create index calendar_bookings_match_status_idx
  on public.calendar_bookings (match_status, created_at desc);

-- Template aprovado é auditável e seu corpo não pode ser alterado.
create table public.invite_note_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  variables jsonb not null default '[]'::jsonb,
  is_active boolean not null default false,
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invite_note_templates_approval_pair_check check (
    (approved_by is null and approved_at is null)
    or (approved_by is not null and approved_at is not null)
  ),
  constraint invite_note_templates_active_requires_approval_check check (
    not is_active or approved_at is not null
  )
);

create unique index invite_note_templates_one_active_idx
  on public.invite_note_templates ((is_active))
  where is_active;

create or replace function public.protect_approved_invite_note_template()
returns trigger
language plpgsql
as $$
begin
  if old.approved_at is not null then
    if new.approved_at is null then
      raise exception 'A aprovação de um template não pode ser removida.';
    end if;

    if new.body is distinct from old.body
       or new.variables is distinct from old.variables then
      raise exception 'Corpo e variáveis de um template aprovado são imutáveis. Crie uma nova linha inativa para editar.';
    end if;
  end if;

  return new;
end;
$$;

create trigger invite_note_templates_protect_approved_body
  before update on public.invite_note_templates
  for each row execute procedure public.protect_approved_invite_note_template();

create trigger invite_note_templates_set_updated_at
  before update on public.invite_note_templates
  for each row execute procedure public.set_updated_at();

alter table public.invite_note_templates enable row level security;

create policy "authenticated users read invite templates"
  on public.invite_note_templates
  for select to authenticated
  using (true);

create policy "admins insert invite templates"
  on public.invite_note_templates
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "admins update invite templates"
  on public.invite_note_templates
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "admins delete unapproved invite templates"
  on public.invite_note_templates
  for delete to authenticated
  using (
    approved_at is null
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create table public.connection_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.run_status not null default 'running',
  accepted_count integer not null default 0 check (accepted_count >= 0),
  error_summary text,
  created_at timestamptz not null default now()
);

alter table public.connection_sync_runs enable row level security;

create policy "authenticated users read connection sync runs"
  on public.connection_sync_runs
  for select to authenticated
  using (true);

create table public.outreach_metrics (
  date date primary key,
  invites_sent integer not null default 0 check (invites_sent >= 0),
  invites_accepted integer not null default 0 check (invites_accepted >= 0),
  acceptance_rate_14d numeric(7,4)
    check (acceptance_rate_14d between 0 and 1),
  weekly_invite_count integer not null default 0
    check (weekly_invite_count >= 0),
  daily_cap_applied integer not null check (daily_cap_applied >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.outreach_metrics is
  'Snapshots para observabilidade. O teto semanal de 100 é sempre calculado por query direta em dispatches na janela rolante de sete dias.';

create trigger outreach_metrics_set_updated_at
  before update on public.outreach_metrics
  for each row execute procedure public.set_updated_at();

alter table public.outreach_metrics enable row level security;

create policy "authenticated users read outreach metrics"
  on public.outreach_metrics
  for select to authenticated
  using (true);

-- RLS das tabelas operacionais sensíveis. Todos os usuários autenticados
-- mantêm leitura; somente escritas explicitamente autorizadas ficam no client.
drop policy if exists "authenticated users manage settings"
  on public.app_settings;

create policy "authenticated users read settings"
  on public.app_settings
  for select to authenticated
  using (true);

create policy "authenticated users update non-outreach settings"
  on public.app_settings
  for update to authenticated
  using (setting_key <> 'outreach')
  with check (setting_key <> 'outreach');

drop policy if exists "authenticated users manage dispatches"
  on public.dispatches;

create policy "authenticated users read dispatches"
  on public.dispatches
  for select to authenticated
  using (true);

create policy "authenticated users record manual linkedin messages"
  on public.dispatches
  for insert to authenticated
  with check (
    action = 'linkedin_message'::public.dispatch_action
    and channel = 'manual'
    and status = 'sent'::public.dispatch_status
  );

-- Configuração de segurança: todo piloto começa em dry-run.
insert into public.app_settings (setting_key, description, value)
values (
  'outreach',
  'Controle do convite automático. dry_run permanece ativo até autorização escrita.',
  '{"enabled":false,"dry_run":true}'::jsonb
)
on conflict (setting_key) do update
set value = jsonb_set(
      jsonb_set(
        public.app_settings.value,
        '{enabled}',
        coalesce(
          nullif(public.app_settings.value -> 'enabled', 'null'::jsonb),
          'false'::jsonb
        ),
        true
      ),
      '{dry_run}',
      coalesce(
        nullif(public.app_settings.value -> 'dry_run', 'null'::jsonb),
        'true'::jsonb
      ),
      true
    ),
    description = excluded.description,
    updated_at = now();

commit;
