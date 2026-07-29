begin;

do $$
declare
  v_company_id uuid;
  v_contact_id uuid;
  v_lead_id uuid;
  v_original timestamptz := now() - interval '10 days';
  v_after_label timestamptz;
  v_after_stage timestamptz;
begin
  insert into public.companies (name, normalized_name)
  values (
    'AGF Stage Age Regression',
    public.normalize_company_name('AGF Stage Age Regression')
  )
  returning id into v_company_id;

  insert into public.contacts (full_name, linkedin_url)
  values (
    'Stage Age Regression',
    'https://www.linkedin.com/in/agf-stage-age-regression'
  )
  returning id into v_contact_id;

  insert into public.leads (
    company_id,
    contact_id,
    source,
    current_stage,
    stage_entered_at
  )
  values (
    v_company_id,
    v_contact_id,
    'manual_referral',
    'revisao_manual',
    v_original
  )
  returning id into v_lead_id;

  update public.leads
     set organization_label = 'Teste'
   where id = v_lead_id
  returning stage_entered_at into v_after_label;

  if v_after_label is distinct from v_original then
    raise exception 'REGRESSION: editar etiqueta reiniciou o tempo da etapa';
  end if;

  update public.leads
     set current_stage = 'aprovado'
   where id = v_lead_id
  returning stage_entered_at into v_after_stage;

  if v_after_stage <= v_original then
    raise exception 'REGRESSION: mudar etapa nao reiniciou o relogio';
  end if;
end;
$$;

rollback;
