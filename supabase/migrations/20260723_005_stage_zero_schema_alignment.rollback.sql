-- Rollback de teste para 20260723_005_stage_zero_schema_alignment.sql.
-- Por remover campos verificados e estados sem equivalente no pipeline antigo,
-- o rollback é deliberadamente bloqueado quando já existem leads.

begin;

do $$
begin
  if exists (select 1 from public.leads limit 1) then
    raise exception 'Rollback bloqueado: existem leads e a reversão perderia sinais verificados ou estados sem equivalente.';
  end if;

  if exists (select 1 from public.calendar_bookings where lead_id is null limit 1) then
    raise exception 'Rollback bloqueado: existem reservas unmatched sem lead.';
  end if;
end;
$$;

drop trigger if exists outreach_metrics_set_updated_at on public.outreach_metrics;
drop table if exists public.outreach_metrics;
drop table if exists public.connection_sync_runs;

drop trigger if exists invite_note_templates_set_updated_at on public.invite_note_templates;
drop trigger if exists invite_note_templates_protect_approved_body on public.invite_note_templates;
drop function if exists public.protect_approved_invite_note_template();
drop table if exists public.invite_note_templates;

delete from public.app_settings where setting_key = 'outreach';

drop index if exists public.calendar_bookings_match_status_idx;
alter table public.calendar_bookings
  drop constraint if exists calendar_bookings_match_requires_lead_check,
  drop column if exists match_status,
  drop column if exists matched_by,
  drop column if exists raw_payload;
alter table public.calendar_bookings rename column provider_event_id to google_event_id;
alter table public.calendar_bookings rename column meeting_url to meet_url;
alter table public.calendar_bookings
  rename constraint calendar_bookings_provider_event_id_key
  to calendar_bookings_google_event_id_key;
alter table public.calendar_bookings alter column lead_id set not null;
alter table public.calendar_bookings add constraint calendar_bookings_lead_id_key unique (lead_id);

drop index if exists public.dispatches_connection_invites_sent_at_idx;
drop index if exists public.dispatches_one_active_content_idx;
drop index if exists public.dispatches_pending_idx;
alter table public.dispatches
  drop constraint if exists dispatches_channel_check,
  drop constraint if exists dispatches_content_hash_check,
  drop column if exists content_hash,
  drop column if exists executed_by;
update public.dispatches
set channel = case
  when action = 'connection_invite'::public.dispatch_action then 'linkedin'
  when action = 'booking_link'::public.dispatch_action then 'calendar'
  else 'linkedin'
end;
alter table public.dispatches
  add constraint dispatches_channel_check
  check (channel in ('linkedin', 'inmail', 'calendar'));

create type public.dispatch_action_legacy as enum (
  'connection_invite',
  'linkedin_message',
  'inmail',
  'booking_link'
);
alter table public.message_drafts drop constraint if exists message_drafts_channel_check;
alter table public.message_drafts
  alter column channel type public.dispatch_action_legacy
  using channel::text::public.dispatch_action_legacy;
alter table public.dispatches
  alter column action type public.dispatch_action_legacy
  using action::text::public.dispatch_action_legacy;
drop type public.dispatch_action;
alter type public.dispatch_action_legacy rename to dispatch_action;
alter table public.message_drafts
  add constraint message_drafts_channel_check
  check (channel in ('linkedin_message', 'inmail', 'booking_link'));

create type public.dispatch_status_legacy as enum (
  'queued',
  'requested',
  'sent',
  'failed',
  'cancelled'
);
alter table public.dispatches
  alter column status drop default,
  alter column status type public.dispatch_status_legacy
  using status::text::public.dispatch_status_legacy;
drop type public.dispatch_status;
alter type public.dispatch_status_legacy rename to dispatch_status;
alter table public.dispatches alter column status set default 'queued';
create index dispatches_pending_idx
  on public.dispatches (status, scheduled_for)
  where status in (
    'queued'::public.dispatch_status,
    'requested'::public.dispatch_status
  );

drop index if exists public.lead_signals_lead_recency_idx;
alter table public.lead_signals
  drop constraint if exists lead_signals_verification_method_not_blank_check,
  drop column published_at,
  drop column verified_at,
  drop column verification_method,
  add column strength text not null default 'normal'
    check (strength in ('normal', 'strong', 'extremely_strong'));
alter table public.lead_signals rename column family to signal_type;
alter table public.lead_signals rename column summary to description;
alter table public.lead_signals rename column source_url to evidence_url;
alter table public.lead_signals
  alter column occurred_at drop not null,
  alter column evidence_url drop not null,
  alter column source_name drop not null;
create index lead_signals_lead_idx
  on public.lead_signals (lead_id, created_at desc);

drop trigger if exists leads_record_stage_change on public.leads;
drop function if exists public.record_lead_stage_change();
drop index if exists public.leads_one_active_company_idx;

alter table public.leads
  drop constraint if exists leads_discard_reason_required_check,
  drop column invited_at,
  drop column accepted_at,
  drop column message_copied_at,
  drop column message_sent_at,
  drop column message_sent_by,
  drop column discard_reason,
  drop column import_origin,
  add column source_sheet_tab text,
  add column source_sheet_row_key text,
  add column source_sheet_row_number integer,
  add column signal_summary text not null,
  add column recent_news jsonb not null default '[]'::jsonb;

create type public.lead_stage_legacy as enum (
  'ready_to_send',
  'approved',
  'send_invitation',
  'invitation_sent',
  'send_message',
  'in_conversation',
  'scheduling',
  'call_booked',
  'concluded'
);

alter table public.leads
  alter column current_stage type public.lead_stage_legacy
  using (
    case current_stage::text
      when 'qualificado' then 'ready_to_send'
      when 'aprovado' then 'approved'
      when 'convite_enviado' then 'invitation_sent'
      when 'em_conversa' then 'in_conversation'
      when 'agendamento' then 'scheduling'
      when 'call_marcada' then 'call_booked'
      when 'concluido' then 'concluded'
    end
  )::public.lead_stage_legacy;

alter table public.lead_activities
  alter column from_stage type public.lead_stage_legacy
  using (
    case from_stage::text
      when 'qualificado' then 'ready_to_send'
      when 'aprovado' then 'approved'
      when 'convite_enviado' then 'invitation_sent'
      when 'em_conversa' then 'in_conversation'
      when 'agendamento' then 'scheduling'
      when 'call_marcada' then 'call_booked'
      when 'concluido' then 'concluded'
    end
  )::public.lead_stage_legacy,
  alter column to_stage type public.lead_stage_legacy
  using (
    case to_stage::text
      when 'qualificado' then 'ready_to_send'
      when 'aprovado' then 'approved'
      when 'convite_enviado' then 'invitation_sent'
      when 'em_conversa' then 'in_conversation'
      when 'agendamento' then 'scheduling'
      when 'call_marcada' then 'call_booked'
      when 'concluido' then 'concluded'
    end
  )::public.lead_stage_legacy;

drop type public.lead_stage;
alter type public.lead_stage_legacy rename to lead_stage;
alter table public.leads alter column current_stage set default 'ready_to_send';

create unique index leads_one_active_company_idx
  on public.leads (company_id)
  where current_stage <> 'concluded'::public.lead_stage;

create table public.sheet_sync_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  target_tab text not null,
  target_row_key text,
  status_value text not null,
  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'synced', 'failed')),
  attempted_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);
create index sheet_sync_logs_pending_idx
  on public.sheet_sync_logs (sync_status, created_at);
alter table public.sheet_sync_logs enable row level security;
create policy "authenticated users manage sheet sync logs"
  on public.sheet_sync_logs for all to authenticated
  using (true) with check (true);

create or replace function public.lead_stage_label(stage public.lead_stage)
returns text
language sql
immutable
as $$
  select case stage
    when 'ready_to_send' then 'Prontos para enviar'
    when 'approved' then 'Aprovado'
    when 'send_invitation' then 'Enviar convite'
    when 'invitation_sent' then 'Convite enviado'
    when 'send_message' then 'Enviar mensagem'
    when 'in_conversation' then 'Em conversa'
    when 'scheduling' then 'Agendamento'
    when 'call_booked' then 'Call marcada'
    when 'concluded' then 'Concluído'
  end;
$$;

create or replace function public.queue_sheet_status_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source_sheet_tab is not null and new.source_sheet_row_key is not null then
    insert into public.sheet_sync_logs (
      lead_id,
      target_tab,
      target_row_key,
      status_value
    )
    values (
      new.id,
      new.source_sheet_tab,
      new.source_sheet_row_key,
      public.lead_stage_label(new.current_stage)
    );
  end if;

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
    'Etapa alterada para ' || public.lead_stage_label(new.current_stage)
  );

  return new;
end;
$$;

create trigger leads_queue_sheet_status_sync
  after update of current_stage on public.leads
  for each row
  when (old.current_stage is distinct from new.current_stage)
  execute procedure public.queue_sheet_status_sync();

create view public.pending_sheet_status_sync
with (security_invoker = true)
as
select
  log.id,
  log.lead_id,
  log.target_tab,
  log.target_row_key,
  log.status_value,
  log.created_at
from public.sheet_sync_logs log
where log.sync_status = 'pending'
order by log.created_at asc;

commit;
