-- Colaboracao de projetos: responsavel principal, membros e links de trabalho.

begin;

create table if not exists public.commercial_project_members (
  project_id uuid not null
    references public.commercial_projects(id) on delete cascade,
  profile_id uuid not null
    references public.profiles(id) on delete cascade,
  added_by uuid
    references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);

create index if not exists commercial_project_members_profile_idx
  on public.commercial_project_members (profile_id, project_id);

create table if not exists public.commercial_project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.commercial_projects(id) on delete cascade,
  title text not null check (nullif(btrim(title), '') is not null),
  url text not null check (url ~* '^https://[^[:space:]]+$'),
  created_by uuid
    references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, url)
);

create index if not exists commercial_project_links_project_idx
  on public.commercial_project_links (project_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.commercial_project_links'::regclass
       and tgname = 'commercial_project_links_set_updated_at'
       and not tgisinternal
  ) then
    create trigger commercial_project_links_set_updated_at
      before update on public.commercial_project_links
      for each row execute procedure public.set_updated_at();
  end if;
end;
$$;

alter table public.commercial_project_members enable row level security;
alter table public.commercial_project_links enable row level security;

grant select on public.commercial_project_members,
                public.commercial_project_links
  to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'commercial_project_members'
       and policyname = 'authenticated users read project members'
  ) then
    create policy "authenticated users read project members"
      on public.commercial_project_members
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'commercial_project_links'
       and policyname = 'authenticated users read project links'
  ) then
    create policy "authenticated users read project links"
      on public.commercial_project_links
      for select to authenticated using (true);
  end if;
end;
$$;

create or replace function public.ensure_project_responsible_is_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.responsible_id is not null then
    insert into public.commercial_project_members (
      project_id,
      profile_id,
      added_by
    )
    values (
      new.id,
      new.responsible_id,
      coalesce(auth.uid(), new.created_by)
    )
    on conflict (project_id, profile_id) do nothing;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.commercial_projects'::regclass
       and tgname = 'commercial_projects_ensure_responsible_member'
       and not tgisinternal
  ) then
    create trigger commercial_projects_ensure_responsible_member
      after insert or update of responsible_id
      on public.commercial_projects
      for each row execute procedure public.ensure_project_responsible_is_member();
  end if;
end;
$$;

insert into public.commercial_project_members (project_id, profile_id, added_by)
select project.id, project.responsible_id, project.created_by
  from public.commercial_projects project
 where project.responsible_id is not null
on conflict (project_id, profile_id) do nothing;

create or replace function public.save_project_collaboration(
  p_project_id uuid,
  p_responsible_id uuid,
  p_member_ids uuid[] default '{}'::uuid[],
  p_links jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_member_ids uuid[];
  v_link jsonb;
  v_title text;
  v_url text;
  v_member_count integer;
  v_link_count integer := 0;
begin
  if v_actor_id is null then
    raise exception 'authentication_required';
  end if;

  if p_responsible_id is null
     or not exists (select 1 from public.profiles where id = p_responsible_id) then
    raise exception 'project_responsible_profile_required';
  end if;

  if not exists (select 1 from public.commercial_projects where id = p_project_id) then
    raise exception 'commercial_project_not_found';
  end if;

  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array' then
    raise exception 'project_links_must_be_array';
  end if;

  select coalesce(array_agg(distinct member_id), '{}'::uuid[])
    into v_member_ids
    from unnest(coalesce(p_member_ids, '{}'::uuid[]) || array[p_responsible_id]) member_id
   where member_id is not null;

  if exists (
    select 1
      from unnest(v_member_ids) member_id
     where not exists (select 1 from public.profiles where id = member_id)
  ) then
    raise exception 'project_member_profile_not_found';
  end if;

  update public.commercial_projects
     set responsible_id = p_responsible_id
   where id = p_project_id;

  delete from public.commercial_project_members
   where project_id = p_project_id
     and not (profile_id = any(v_member_ids));

  insert into public.commercial_project_members (project_id, profile_id, added_by)
  select p_project_id, member_id, v_actor_id
    from unnest(v_member_ids) member_id
  on conflict (project_id, profile_id) do nothing;

  delete from public.commercial_project_links
   where project_id = p_project_id;

  for v_link in select value from jsonb_array_elements(coalesce(p_links, '[]'::jsonb))
  loop
    v_title := nullif(btrim(v_link ->> 'title'), '');
    v_url := nullif(btrim(v_link ->> 'url'), '');

    if v_title is null or v_url is null then
      raise exception 'project_link_title_and_url_required';
    end if;

    if v_url !~* '^https://[^[:space:]]+$' then
      raise exception 'project_link_must_use_https';
    end if;

    insert into public.commercial_project_links (
      project_id,
      title,
      url,
      created_by
    )
    values (p_project_id, v_title, v_url, v_actor_id);

    v_link_count := v_link_count + 1;
  end loop;

  v_member_count := cardinality(v_member_ids);

  return jsonb_build_object(
    'project_id', p_project_id,
    'responsible_id', p_responsible_id,
    'member_count', v_member_count,
    'link_count', v_link_count
  );
end;
$$;

revoke all on function public.save_project_collaboration(uuid, uuid, uuid[], jsonb)
  from public;
grant execute on function public.save_project_collaboration(uuid, uuid, uuid[], jsonb)
  to authenticated;

comment on table public.commercial_project_members is
  'Equipe participante do projeto; o responsavel principal sempre e membro.';
comment on table public.commercial_project_links is
  'Links HTTPS para documentos e pastas de trabalho do projeto.';

commit;
