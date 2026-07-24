-- AGF CRM — espelho de status no Google Sheets.
-- Deve ser aplicada depois de 20260722000200_pipeline_and_sheet_sync.sql.

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
    insert into public.sheet_sync_logs (lead_id, target_tab, target_row_key, status_value)
    values (new.id, new.source_sheet_tab, new.source_sheet_row_key, public.lead_stage_label(new.current_stage));
  end if;

  insert into public.lead_activities (lead_id, activity_type, from_stage, to_stage, summary)
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

drop trigger if exists leads_queue_sheet_status_sync on public.leads;
create trigger leads_queue_sheet_status_sync
  after update of current_stage on public.leads
  for each row
  when (old.current_stage is distinct from new.current_stage)
  execute procedure public.queue_sheet_status_sync();

create or replace view public.pending_sheet_status_sync
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
