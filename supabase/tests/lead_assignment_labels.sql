begin;

do $$
declare
  v_company_id uuid;
  v_contact_id uuid;
  v_lead_id uuid;
  v_profile_id uuid;
begin
  select id into v_profile_id
    from public.profiles
   order by created_at
   limit 1;

  if v_profile_id is null then
    raise exception 'REGRESSION: o teste precisa de ao menos um perfil';
  end if;

  insert into public.companies (name, normalized_name)
  values (
    'AGF Assignment Regression',
    public.normalize_company_name('AGF Assignment Regression')
  )
  returning id into v_company_id;

  insert into public.contacts (full_name, linkedin_url)
  values (
    'Assignment Regression',
    'https://www.linkedin.com/in/agf-assignment-regression'
  )
  returning id into v_contact_id;

  insert into public.leads (
    company_id,
    contact_id,
    source,
    current_stage,
    organization_label,
    responsible_id
  )
  values (
    v_company_id,
    v_contact_id,
    'manual_referral',
    'revisao_manual',
    'Economia real - Sul',
    v_profile_id
  )
  returning id into v_lead_id;

  if not exists (
    select 1
      from public.leads
     where id = v_lead_id
       and organization_label = 'Economia real - Sul'
       and responsible_id = v_profile_id
  ) then
    raise exception 'REGRESSION: etiqueta ou responsavel nao foram persistidos';
  end if;
end;
$$;

rollback;
