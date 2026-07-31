-- O destinatario de um follow-up acompanha sempre o responsavel atual do
-- card. O criador permanece apenas como dado de auditoria.

begin;

alter table public.commercial_projects
  add column if not exists responsible_id uuid
    references public.profiles(id) on delete set null;

create index if not exists commercial_projects_responsible_idx
  on public.commercial_projects (responsible_id, current_stage)
  where responsible_id is not null;

create or replace function public.set_project_responsible_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_responsible_name text;
begin
  if new.responsible_id is null and new.lead_id is not null then
    select lead.responsible_id
      into new.responsible_id
      from public.leads lead
     where lead.id = new.lead_id;
  end if;

  new.responsible_id := coalesce(new.responsible_id, new.created_by);

  if new.responsible_id is not null then
    select profile.full_name
      into v_responsible_name
      from public.profiles profile
     where profile.id = new.responsible_id;

    if not found then
      raise exception 'project_responsible_profile_not_found';
    end if;

    new.responsible_name := coalesce(
      nullif(btrim(v_responsible_name), ''),
      new.responsible_name,
      'Operador AGF'
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
      from pg_trigger
     where tgrelid = 'public.commercial_projects'::regclass
       and tgname = 'commercial_projects_set_responsible_identity'
       and not tgisinternal
  ) then
    create trigger commercial_projects_set_responsible_identity
      before insert or update of responsible_id, lead_id
      on public.commercial_projects
      for each row execute procedure public.set_project_responsible_identity();
  end if;
end;
$$;

with exact_profile_matches as (
  select project.id as project_id,
         min(profile.id::text)::uuid as responsible_id
    from public.commercial_projects project
    join public.profiles profile
      on lower(btrim(profile.full_name)) = lower(btrim(project.responsible_name))
   group by project.id
  having count(*) = 1
)
update public.commercial_projects project
   set responsible_id = matched.responsible_id
  from exact_profile_matches matched
 where project.id = matched.project_id
   and project.responsible_id is null;

update public.commercial_projects
   set responsible_id = created_by
 where responsible_id is null
   and created_by is not null;

-- Mantem o nome historico da funcao para atualizar o trigger de INSERT sem
-- remover objetos do banco. A semantica passa a ser a do responsavel do card.
create or replace function public.assign_follow_up_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_responsible_id uuid;
begin
  if new.lead_id is not null then
    select lead.responsible_id
      into v_responsible_id
      from public.leads lead
     where lead.id = new.lead_id;
  elsif new.project_id is not null then
    select project.responsible_id
      into v_responsible_id
      from public.commercial_projects project
     where project.id = new.project_id;
  end if;

  if v_responsible_id is null and tg_op = 'INSERT' then
    raise exception 'follow_up_parent_responsible_required';
  end if;

  new.assigned_to := v_responsible_id;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
      from pg_trigger
     where tgrelid = 'public.lead_follow_ups'::regclass
       and tgname = 'lead_follow_ups_reassign_card_responsible'
       and not tgisinternal
  ) then
    create trigger lead_follow_ups_reassign_card_responsible
      before update of lead_id, project_id, assigned_to
      on public.lead_follow_ups
      for each row execute procedure public.assign_follow_up_creator();
  end if;
end;
$$;

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
    update public.follow_up_email_deliveries
       set status = case when status = 'sent' then status else 'cancelled' end,
           last_error = null,
           claimed_at = null
     where follow_up_id = new.id;
    return new;
  end if;

  select profile.notification_email
    into v_email
    from public.profiles profile
   where profile.id = new.assigned_to;

  if v_email is null then
    update public.follow_up_email_deliveries
       set status = case when status = 'sent' then status else 'cancelled' end,
           last_error = null,
           claimed_at = null
     where follow_up_id = new.id;
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
    set recipient_profile_id = case
          when follow_up_email_deliveries.status = 'sent'
            then follow_up_email_deliveries.recipient_profile_id
          else excluded.recipient_profile_id
        end,
        recipient_email = case
          when follow_up_email_deliveries.status = 'sent'
            then follow_up_email_deliveries.recipient_email
          else excluded.recipient_email
        end,
        scheduled_for = case
          when follow_up_email_deliveries.status = 'sent'
            then follow_up_email_deliveries.scheduled_for
          else excluded.scheduled_for
        end,
        status = case
          when follow_up_email_deliveries.status = 'sent'
            then follow_up_email_deliveries.status
          when new.status = 'open'
            then 'pending'
          else 'cancelled'
        end,
        last_error = case
          when follow_up_email_deliveries.status = 'sent'
            then follow_up_email_deliveries.last_error
          else null
        end,
        claimed_at = case
          when follow_up_email_deliveries.status = 'sent'
            then follow_up_email_deliveries.claimed_at
          else null
        end;

  return new;
end;
$$;

create or replace function public.propagate_lead_responsible_to_follow_ups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.lead_follow_ups
     set assigned_to = new.responsible_id
   where lead_id = new.id
     and assigned_to is distinct from new.responsible_id;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
      from pg_trigger
     where tgrelid = 'public.leads'::regclass
       and tgname = 'leads_propagate_responsible_to_follow_ups'
       and not tgisinternal
  ) then
    create trigger leads_propagate_responsible_to_follow_ups
      after update of responsible_id on public.leads
      for each row execute procedure public.propagate_lead_responsible_to_follow_ups();
  end if;
end;
$$;

create or replace function public.propagate_project_responsible_to_follow_ups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.lead_follow_ups
     set assigned_to = new.responsible_id
   where project_id = new.id
     and assigned_to is distinct from new.responsible_id;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
      from pg_trigger
     where tgrelid = 'public.commercial_projects'::regclass
       and tgname = 'projects_propagate_responsible_to_follow_ups'
       and not tgisinternal
  ) then
    create trigger projects_propagate_responsible_to_follow_ups
      after update of responsible_id on public.commercial_projects
      for each row execute procedure public.propagate_project_responsible_to_follow_ups();
  end if;
end;
$$;

update public.lead_follow_ups follow_up
   set assigned_to = lead.responsible_id
  from public.leads lead
 where follow_up.lead_id = lead.id
   and follow_up.assigned_to is distinct from lead.responsible_id;

update public.lead_follow_ups follow_up
   set assigned_to = project.responsible_id
  from public.commercial_projects project
 where follow_up.project_id = project.id
   and follow_up.assigned_to is distinct from project.responsible_id;

comment on column public.lead_follow_ups.assigned_to is
  'Responsavel atual do card pai; nunca e derivado do criador do follow-up.';

comment on column public.commercial_projects.responsible_id is
  'Perfil responsavel pelo projeto e destinatario de seus follow-ups.';

commit;
