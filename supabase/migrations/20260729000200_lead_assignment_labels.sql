begin;

alter table public.leads
  add column organization_label text
    check (
      organization_label is null
      or (
        nullif(btrim(organization_label), '') is not null
        and char_length(organization_label) <= 60
      )
    ),
  add column responsible_id uuid
    references public.profiles(id)
    on delete set null;

create index leads_responsible_stage_idx
  on public.leads (responsible_id, current_stage)
  where responsible_id is not null;

comment on column public.leads.organization_label is
  'Etiqueta operacional livre e compartilhada exibida no card.';

comment on column public.leads.responsible_id is
  'Operador responsavel pelo lead. Nao altera a visibilidade compartilhada.';

commit;
