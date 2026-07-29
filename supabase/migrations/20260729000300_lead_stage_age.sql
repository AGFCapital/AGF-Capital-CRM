begin;

alter table public.leads
  add column stage_entered_at timestamptz not null default now();

-- Para os cards existentes, updated_at e a melhor aproximacao disponivel.
update public.leads
   set stage_entered_at = updated_at;

create or replace function public.set_lead_stage_entered_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.current_stage is distinct from old.current_stage then
    new.stage_entered_at = now();
  end if;
  return new;
end;
$$;

create trigger leads_set_stage_entered_at
  before update of current_stage on public.leads
  for each row execute procedure public.set_lead_stage_entered_at();

create index leads_stage_entered_idx
  on public.leads (current_stage, stage_entered_at);

comment on column public.leads.stage_entered_at is
  'Data da entrada na etapa atual; alteracoes de etiqueta ou conteudo nao reiniciam o relogio.';

commit;
