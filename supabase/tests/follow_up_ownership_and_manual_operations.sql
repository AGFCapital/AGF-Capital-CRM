begin;

do $$
declare
  v_profile_id uuid;
  v_follow_up_id uuid;
  v_assigned_to uuid;
  v_delivery_count integer;
begin
  select id into v_profile_id from public.profiles order by created_at limit 1;
  if v_profile_id is null then
    raise exception 'test_requires_profile';
  end if;

  update public.profiles
     set notification_email = 'operador@agfcapital.com.br',
         follow_up_email_enabled = true
   where id = v_profile_id;

  select follow_up.id
    into v_follow_up_id
    from public.lead_follow_ups follow_up
   order by follow_up.created_at
   limit 1;

  if v_follow_up_id is null then
    raise exception 'test_requires_follow_up';
  end if;

  update public.lead_follow_ups
     set assigned_to = v_profile_id,
         status = 'open',
         completed_at = null,
         completed_by = null
   where id = v_follow_up_id;

  select assigned_to
    into v_assigned_to
    from public.lead_follow_ups
   where id = v_follow_up_id;

  if v_assigned_to <> v_profile_id then
    raise exception 'follow_up_assignee_not_persisted';
  end if;

  select count(*)
    into v_delivery_count
    from public.follow_up_email_deliveries
   where follow_up_id = v_follow_up_id;

  if v_delivery_count <> 1 then
    raise exception 'follow_up_email_delivery_not_idempotent';
  end if;
end;
$$;

rollback;
