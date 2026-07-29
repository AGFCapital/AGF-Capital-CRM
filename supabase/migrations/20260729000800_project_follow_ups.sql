-- AGF CRM — follow-ups unificados para leads e projetos comerciais.
-- A tabela existente permanece como a fonte única para preservar ownership,
-- notificações, conclusão e a fila idempotente de e-mail.

begin;

alter table public.lead_follow_ups
  add column project_id uuid
    references public.commercial_projects(id) on delete cascade;

alter table public.lead_follow_ups
  alter column lead_id drop not null;

alter table public.lead_follow_ups
  add constraint lead_follow_ups_single_parent_check
  check (num_nonnulls(lead_id, project_id) = 1);

create index lead_follow_ups_project_idx
  on public.lead_follow_ups (project_id, due_at desc)
  where project_id is not null;

-- Mantém os campos consumidos pelo workflow atual e acrescenta o contexto
-- explícito do projeto. O n8n pode continuar usando company_name e
-- contact_name sem qualquer ramificação adicional.
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
       coalesce(company.name, project.company_name) as company_name,
       coalesce(contact.full_name, project.responsible_name) as contact_name,
       lead.id as lead_id,
       project.id as project_id,
       case
         when follow_up.project_id is not null then 'project'
         else 'lead'
       end as entity_type
  from public.follow_up_email_deliveries delivery
  join public.lead_follow_ups follow_up on follow_up.id = delivery.follow_up_id
  join public.profiles profile on profile.id = delivery.recipient_profile_id
  left join public.leads lead on lead.id = follow_up.lead_id
  left join public.companies company on company.id = lead.company_id
  left join public.contacts contact on contact.id = lead.contact_id
  left join public.commercial_projects project on project.id = follow_up.project_id
 where follow_up.status = 'open'
   and profile.follow_up_email_enabled
   and profile.notification_email is not null
   and delivery.status in ('pending', 'failed')
   and delivery.attempts < 3
   and delivery.scheduled_for <= now();

grant select on public.follow_up_email_queue to authenticated, service_role;

commit;
