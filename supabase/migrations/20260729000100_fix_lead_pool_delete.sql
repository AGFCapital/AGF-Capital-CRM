begin;

-- A exclusao definitiva de um card tambem remove a linha que o originou no
-- banco de espera. Manter a linha com released_lead_id nulo seria invalido
-- para o status liberado_para_crm e permitiria liberar o mesmo lead de novo.
alter table public.lead_pool
  drop constraint if exists lead_pool_released_lead_id_fkey;

alter table public.lead_pool
  add constraint lead_pool_released_lead_id_fkey
  foreign key (released_lead_id)
  references public.leads(id)
  on delete cascade;

commit;
