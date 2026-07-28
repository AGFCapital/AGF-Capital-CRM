-- Ajusta os indicadores para incluir duplicidades detectadas no upload e
-- encerra lotes cujo último item disponível foi descartado como duplicado.

begin;

create or replace function public.release_lead_pool(p_quantity integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested integer := coalesce(p_quantity, 0);
  v_released integer := 0;
  v_duplicates integer := 0;
  v_pool public.lead_pool%rowtype;
  v_company_id uuid;
  v_contact_id uuid;
  v_lead_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória';
  end if;
  if v_requested < 1 or v_requested > 100 then
    raise exception 'A quantidade deve estar entre 1 e 100';
  end if;

  while v_released < v_requested loop
    select *
      into v_pool
      from public.lead_pool
     where status = 'disponivel'
     order by created_at, source_row
     for update skip locked
     limit 1;

    exit when not found;

    v_company_id := null;
    v_contact_id := null;
    v_lead_id := null;

    if v_pool.apollo_account_id is not null then
      select id into v_company_id
        from public.companies
       where apollo_account_id = v_pool.apollo_account_id;
    end if;
    if v_company_id is null then
      select id into v_company_id
        from public.companies
       where normalized_name = v_pool.normalized_company_name;
    end if;

    if v_company_id is not null
       and exists (select 1 from public.leads where company_id = v_company_id) then
      update public.lead_pool
         set status = 'duplicado',
             duplicate_reason = 'Empresa já possui lead no histórico do CRM.'
       where id = v_pool.id;
      v_duplicates := v_duplicates + 1;
      continue;
    end if;

    if v_pool.apollo_contact_id is not null then
      select id into v_contact_id
        from public.contacts
       where apollo_contact_id = v_pool.apollo_contact_id;
    end if;
    if v_contact_id is null then
      select id into v_contact_id
        from public.contacts
       where public.normalize_linkedin_url(linkedin_url) = v_pool.normalized_contact_linkedin_url;
    end if;

    if v_contact_id is not null
       and exists (select 1 from public.leads where contact_id = v_contact_id) then
      update public.lead_pool
         set status = 'duplicado',
             duplicate_reason = 'Contato já possui lead no histórico do CRM.'
       where id = v_pool.id;
      v_duplicates := v_duplicates + 1;
      continue;
    end if;

    begin
      if v_company_id is null then
        insert into public.companies (
          name, normalized_name, linkedin_url, website_domain, industry,
          headquarters_city, headquarters_state, employee_count, company_size,
          revenue_proxy_min, revenue_proxy_max, apollo_account_id
        )
        values (
          v_pool.company_name, v_pool.normalized_company_name,
          v_pool.company_linkedin_url, v_pool.website_domain, v_pool.industry,
          v_pool.city, v_pool.state, v_pool.employee_count, v_pool.company_size,
          v_pool.annual_revenue, v_pool.annual_revenue, v_pool.apollo_account_id
        )
        returning id into v_company_id;
      end if;

      if v_contact_id is null then
        insert into public.contacts (
          full_name, linkedin_url, title, location_country,
          profile_gate_passed, profile_gate_reason, apollo_contact_id
        )
        values (
          v_pool.contact_name, v_pool.normalized_contact_linkedin_url,
          v_pool.contact_title,
          case when lower(v_pool.country) = 'brazil' then 'Brasil' else v_pool.country end,
          false,
          'Importado do banco de leads; conexões do LinkedIn ainda não verificadas.',
          v_pool.apollo_contact_id
        )
        returning id into v_contact_id;
      end if;

      insert into public.leads (
        company_id, contact_id, source, current_stage, import_origin,
        company_overview, contact_context
      )
      values (
        v_company_id, v_contact_id, 'manual_referral', 'revisao_manual',
        concat(
          'Banco de leads | lote=', v_pool.batch_id,
          ' | linha=', v_pool.source_row,
          ' | apollo_contact_id=', coalesce(v_pool.apollo_contact_id, ''),
          ' | apollo_account_id=', coalesce(v_pool.apollo_account_id, '')
        ),
        concat_ws(
          ' | ',
          v_pool.industry,
          case when v_pool.employee_count is not null then v_pool.employee_count || ' funcionários' end,
          case when v_pool.annual_revenue is not null then 'receita Apollo: ' || v_pool.annual_revenue end
        ),
        v_pool.contact_title
      )
      returning id into v_lead_id;

      update public.lead_pool
         set status = 'liberado_para_crm',
             released_at = now(),
             released_by = auth.uid(),
             released_lead_id = v_lead_id
       where id = v_pool.id;

      update public.lead_import_batches
         set released_rows = released_rows + 1
       where id = v_pool.batch_id;

      insert into public.lead_activities (
        lead_id, activity_type, summary, metadata, created_by
      )
      values (
        v_lead_id,
        'released_from_lead_pool',
        'Lead liberado do banco de espera para a Base de clientes.',
        jsonb_build_object('batch_id', v_pool.batch_id, 'source_row', v_pool.source_row),
        auth.uid()
      );

      v_released := v_released + 1;
    exception
      when unique_violation then
        update public.lead_pool
           set status = 'duplicado',
               duplicate_reason = 'Conflito de unicidade detectado durante a liberação.'
         where id = v_pool.id;
        v_duplicates := v_duplicates + 1;
    end;
  end loop;

  update public.lead_import_batches b
     set status = 'completed'
   where b.status = 'ready'
     and not exists (
       select 1 from public.lead_pool p
        where p.batch_id = b.id and p.status = 'disponivel'
     );

  return jsonb_build_object(
    'requested', v_requested,
    'released', v_released,
    'duplicates_skipped', v_duplicates,
    'available', (select count(*) from public.lead_pool where status = 'disponivel')
  );
end;
$$;

create or replace function public.lead_pool_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória';
  end if;

  select jsonb_build_object(
    'available', count(*) filter (where status = 'disponivel'),
    'released', count(*) filter (where status = 'liberado_para_crm'),
    'duplicates',
      count(*) filter (where status = 'duplicado')
      + coalesce((select sum(duplicate_rows) from public.lead_import_batches), 0),
    'discarded', count(*) filter (where status = 'descartado'),
    'default_release_quantity', coalesce(
      (
        select (value ->> 'default_release_quantity')::integer
          from public.app_settings
         where setting_key = 'lead_pool_release'
      ),
      20
    ),
    'recent_batches', coalesce(
      (
        select jsonb_agg(to_jsonb(batch_row) order by batch_row.created_at desc)
          from (
            select id, file_name, status, total_rows, imported_rows,
                   invalid_rows, duplicate_rows, released_rows, created_at
              from public.lead_import_batches
             order by created_at desc
             limit 5
          ) batch_row
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.lead_pool;

  return v_result;
end;
$$;

commit;
