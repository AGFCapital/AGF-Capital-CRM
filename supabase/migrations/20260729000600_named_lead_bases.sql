-- Named lead bases keep independent CSV batches selectable at release time.
-- Global deduplication remains unchanged: the same company/contact cannot be
-- released twice merely because it appeared in another file.

begin;

alter table public.lead_import_batches
  add column display_name text not null default 'Base importada';

update public.lead_import_batches
   set display_name = coalesce(
     nullif(btrim(regexp_replace(file_name, '\.csv$', '', 'i')), ''),
     'Base importada'
   );

create index lead_import_batches_display_name_idx
  on public.lead_import_batches (lower(display_name), created_at desc);

create or replace function public.import_named_lead_pool(
  p_batch_name text,
  p_file_name text,
  p_records jsonb,
  p_total_rows integer,
  p_client_invalid_rows integer default 0,
  p_client_duplicate_rows integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(btrim(p_batch_name), '');
  v_result jsonb;
  v_batch_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória';
  end if;
  if v_name is null then
    raise exception 'O nome da base é obrigatório';
  end if;
  if char_length(v_name) > 80 then
    raise exception 'O nome da base deve ter no máximo 80 caracteres';
  end if;

  v_result := public.import_lead_pool(
    p_file_name,
    p_records,
    p_total_rows,
    p_client_invalid_rows,
    p_client_duplicate_rows
  );
  v_batch_id := (v_result ->> 'batch_id')::uuid;

  update public.lead_import_batches
     set display_name = v_name
   where id = v_batch_id;

  return v_result || jsonb_build_object('display_name', v_name);
end;
$$;

create or replace function public.release_lead_pool_batch(
  p_batch_id uuid,
  p_quantity integer
)
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
  v_batch_name text;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória';
  end if;
  if p_batch_id is null then
    raise exception 'Selecione uma base de leads';
  end if;
  if v_requested < 1 or v_requested > 100 then
    raise exception 'A quantidade deve estar entre 1 e 100';
  end if;

  select display_name
    into v_batch_name
    from public.lead_import_batches
   where id = p_batch_id;

  if not found then
    raise exception 'Base de leads não encontrada';
  end if;

  while v_released < v_requested loop
    select *
      into v_pool
      from public.lead_pool
     where batch_id = p_batch_id
       and status = 'disponivel'
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
          'Banco de leads | base="', v_batch_name,
          '" | lote=', v_pool.batch_id,
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
        'Lead liberado da base "' || v_batch_name || '" para a Base de clientes.',
        jsonb_build_object(
          'batch_id', v_pool.batch_id,
          'batch_name', v_batch_name,
          'source_row', v_pool.source_row
        ),
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

  update public.lead_import_batches
     set status = 'completed'
   where id = p_batch_id
     and status = 'ready'
     and not exists (
       select 1 from public.lead_pool
        where batch_id = p_batch_id and status = 'disponivel'
     );

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'display_name', v_batch_name,
    'requested', v_requested,
    'released', v_released,
    'duplicates_skipped', v_duplicates,
    'batch_available', (
      select count(*) from public.lead_pool
       where batch_id = p_batch_id and status = 'disponivel'
    ),
    'available', (
      select count(*) from public.lead_pool where status = 'disponivel'
    )
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
    'batches', coalesce(
      (
        select jsonb_agg(to_jsonb(batch_row) order by batch_row.created_at desc)
          from (
            select b.id,
                   b.display_name,
                   b.file_name,
                   b.status,
                   b.total_rows,
                   b.imported_rows,
                   b.invalid_rows,
                   b.duplicate_rows,
                   b.released_rows,
                   b.created_at,
                   count(p.id) filter (where p.status = 'disponivel') as available_rows
              from public.lead_import_batches b
              left join public.lead_pool p on p.batch_id = b.id
             group by b.id
             order by b.created_at desc
             limit 100
          ) batch_row
      ),
      '[]'::jsonb
    ),
    'recent_batches', coalesce(
      (
        select jsonb_agg(to_jsonb(batch_row) order by batch_row.created_at desc)
          from (
            select b.id,
                   b.display_name,
                   b.file_name,
                   b.status,
                   b.total_rows,
                   b.imported_rows,
                   b.invalid_rows,
                   b.duplicate_rows,
                   b.released_rows,
                   b.created_at,
                   count(p.id) filter (where p.status = 'disponivel') as available_rows
              from public.lead_import_batches b
              left join public.lead_pool p on p.batch_id = b.id
             group by b.id
             order by b.created_at desc
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

revoke all on function public.import_named_lead_pool(text, text, jsonb, integer, integer, integer)
  from public, anon;
revoke all on function public.release_lead_pool_batch(uuid, integer)
  from public, anon;

grant execute on function public.import_named_lead_pool(text, text, jsonb, integer, integer, integer)
  to authenticated;
grant execute on function public.release_lead_pool_batch(uuid, integer)
  to authenticated;

commit;
