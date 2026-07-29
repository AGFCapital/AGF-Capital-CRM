-- Regressao: apagar definitivamente um lead liberado do banco de espera
-- deve apagar tambem a linha de origem, sem violar lead_pool_release_check.
begin;

do $$
declare
  v_batch_id uuid;
  v_company_id uuid;
  v_contact_id uuid;
  v_lead_id uuid;
  v_pool_id uuid;
begin
  insert into public.lead_import_batches (
    file_name,
    total_rows,
    imported_rows,
    duplicate_rows,
    invalid_rows,
    released_rows
  )
  values ('lead-deletion-regression.csv', 1, 1, 0, 0, 1)
  returning id into v_batch_id;

  insert into public.companies (name, normalized_name)
  values (
    'AGF Lead Deletion Regression',
    public.normalize_company_name('AGF Lead Deletion Regression')
  )
  returning id into v_company_id;

  insert into public.contacts (full_name, linkedin_url)
  values (
    'Lead Deletion Regression',
    'https://www.linkedin.com/in/agf-lead-deletion-regression'
  )
  returning id into v_contact_id;

  insert into public.leads (
    company_id,
    contact_id,
    source,
    current_stage
  )
  values (
    v_company_id,
    v_contact_id,
    'manual_referral',
    'revisao_manual'
  )
  returning id into v_lead_id;

  insert into public.lead_pool (
    batch_id,
    source_row,
    company_name,
    normalized_company_name,
    contact_name,
    contact_linkedin_url,
    normalized_contact_linkedin_url,
    status,
    released_at,
    released_lead_id
  )
  values (
    v_batch_id,
    2,
    'AGF Lead Deletion Regression',
    public.normalize_company_name('AGF Lead Deletion Regression'),
    'Lead Deletion Regression',
    'https://www.linkedin.com/in/agf-lead-deletion-regression',
    'https://www.linkedin.com/in/agf-lead-deletion-regression',
    'liberado_para_crm',
    now(),
    v_lead_id
  )
  returning id into v_pool_id;

  delete from public.leads where id = v_lead_id;

  if exists (select 1 from public.leads where id = v_lead_id) then
    raise exception 'REGRESSION: lead % ainda existe depois da exclusao', v_lead_id;
  end if;

  if exists (select 1 from public.lead_pool where id = v_pool_id) then
    raise exception 'REGRESSION: lead_pool % ainda existe depois da exclusao', v_pool_id;
  end if;
end;
$$;

rollback;
