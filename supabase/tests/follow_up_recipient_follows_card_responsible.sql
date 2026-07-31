begin;

do $$
declare
  v_responsible_id uuid;
  v_creator_id uuid;
  v_lead_id uuid;
  v_follow_up_id uuid;
  v_assigned_to uuid;
  v_delivery_recipient uuid;
begin
  select id
    into v_responsible_id
    from public.profiles
   order by created_at, id
   limit 1;

  select id
    into v_creator_id
    from public.profiles
   where id <> v_responsible_id
   order by created_at, id
   limit 1;

  if v_responsible_id is null or v_creator_id is null then
    raise exception 'test_requires_two_profiles';
  end if;

  select id
    into v_lead_id
    from public.leads
   order by created_at, id
   limit 1;

  if v_lead_id is null then
    raise exception 'test_requires_lead';
  end if;

  update public.leads
     set responsible_id = v_responsible_id
   where id = v_lead_id;

  insert into public.lead_follow_ups (
    lead_id,
    due_at,
    note,
    status,
    created_by,
    assigned_to
  )
  values (
    v_lead_id,
    now() + interval '1 day',
    'Teste de destinatario por responsavel do card',
    'open',
    v_creator_id,
    v_creator_id
  )
  returning id, assigned_to
       into v_follow_up_id, v_assigned_to;

  if v_assigned_to is distinct from v_responsible_id then
    raise exception 'follow_up_assigned_to_creator_instead_of_card_responsible';
  end if;

  select recipient_profile_id
    into v_delivery_recipient
    from public.follow_up_email_deliveries
   where follow_up_id = v_follow_up_id;

  if v_delivery_recipient is distinct from v_responsible_id then
    raise exception 'delivery_recipient_is_not_card_responsible';
  end if;
end;
$$;

rollback;
