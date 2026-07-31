begin;

do $$
declare
  v_actor_id uuid;
  v_second_profile_id uuid;
  v_project_id uuid;
  v_result jsonb;
begin
  select id into v_actor_id
    from public.profiles
   order by created_at, id
   limit 1;

  select id into v_second_profile_id
    from public.profiles
   where id <> v_actor_id
   order by created_at, id
   limit 1;

  if v_actor_id is null or v_second_profile_id is null then
    raise exception 'test_requires_two_profiles';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_actor_id, 'role', 'authenticated')::text,
    true
  );

  insert into public.commercial_projects (
    name,
    company_name,
    responsible_name,
    responsible_id,
    description,
    created_by
  )
  values (
    'Teste de colaboracao',
    'AGF Teste',
    'Responsavel de teste',
    v_actor_id,
    'Projeto temporario para regressao.',
    v_actor_id
  )
  returning id into v_project_id;

  select public.save_project_collaboration(
    v_project_id,
    v_second_profile_id,
    array[v_actor_id],
    jsonb_build_array(jsonb_build_object(
      'title', 'Pasta do projeto',
      'url', 'https://drive.google.com/teste-agf'
    ))
  ) into v_result;

  if (select responsible_id from public.commercial_projects where id = v_project_id)
     is distinct from v_second_profile_id then
    raise exception 'responsible_not_updated';
  end if;

  if (select count(*) from public.commercial_project_members where project_id = v_project_id) <> 2 then
    raise exception 'project_members_not_saved';
  end if;

  if not exists (
    select 1 from public.commercial_project_members
     where project_id = v_project_id and profile_id = v_second_profile_id
  ) then
    raise exception 'responsible_must_be_project_member';
  end if;

  if (select count(*) from public.commercial_project_links where project_id = v_project_id) <> 1 then
    raise exception 'project_link_not_saved';
  end if;

  if (v_result ->> 'member_count')::integer <> 2
     or (v_result ->> 'link_count')::integer <> 1 then
    raise exception 'collaboration_result_counts_invalid';
  end if;
end;
$$;

rollback;
