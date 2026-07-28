-- AGF CRM — banco de leads para importações longas.
-- Um CSV inteiro entra no pool em uma única chamada. Apenas a quantidade
-- escolhida pelo operador é materializada como company/contact/lead no CRM.

begin;

create table public.lead_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null check (nullif(btrim(file_name), '') is not null),
  source text not null default 'apollo_csv'
    check (source in ('apollo_csv', 'csv_manual')),
  status text not null default 'processing'
    check (status in ('processing', 'ready', 'empty', 'completed', 'failed')),
  total_rows integer not null default 0 check (total_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  released_rows integer not null default 0 check (released_rows >= 0),
  uploaded_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint lead_import_batches_totals_check check (
    imported_rows + invalid_rows + duplicate_rows <= total_rows
  )
);

create index lead_import_batches_created_idx
  on public.lead_import_batches (created_at desc);

create table public.lead_pool (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.lead_import_batches(id) on delete cascade,
  source_row integer not null check (source_row > 1),
  status text not null default 'disponivel'
    check (status in ('disponivel', 'liberado_para_crm', 'duplicado', 'invalido', 'descartado')),
  company_name text not null check (nullif(btrim(company_name), '') is not null),
  normalized_company_name text not null check (nullif(btrim(normalized_company_name), '') is not null),
  company_linkedin_url text,
  website_domain text,
  industry text,
  city text,
  state text,
  country text,
  employee_count integer check (employee_count is null or employee_count >= 0),
  company_size text check (company_size in ('small', 'medium', 'large')),
  annual_revenue numeric(18,2) check (annual_revenue is null or annual_revenue >= 0),
  contact_name text not null check (nullif(btrim(contact_name), '') is not null),
  contact_title text,
  contact_linkedin_url text not null,
  normalized_contact_linkedin_url text not null,
  apollo_contact_id text,
  apollo_account_id text,
  extracted_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references public.profiles(id) on delete set null,
  released_lead_id uuid references public.leads(id) on delete set null,
  duplicate_reason text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, source_row),
  constraint lead_pool_release_check check (
    (status = 'liberado_para_crm' and released_at is not null and released_lead_id is not null)
    or status <> 'liberado_para_crm'
  )
);

create unique index lead_pool_company_unique_idx
  on public.lead_pool (normalized_company_name);

create unique index lead_pool_contact_linkedin_unique_idx
  on public.lead_pool (normalized_contact_linkedin_url);

create unique index lead_pool_apollo_contact_unique_idx
  on public.lead_pool (apollo_contact_id)
  where apollo_contact_id is not null;

create unique index lead_pool_apollo_account_unique_idx
  on public.lead_pool (apollo_account_id)
  where apollo_account_id is not null;

create index lead_pool_available_idx
  on public.lead_pool (created_at, source_row)
  where status = 'disponivel';

create index lead_pool_batch_status_idx
  on public.lead_pool (batch_id, status);

create trigger lead_pool_set_updated_at
  before update on public.lead_pool
  for each row execute procedure public.set_updated_at();

alter table public.lead_import_batches enable row level security;
alter table public.lead_pool enable row level security;

grant select on public.lead_import_batches, public.lead_pool to authenticated;
revoke insert, update, delete on public.lead_import_batches, public.lead_pool from authenticated;

create policy "authenticated users read lead import batches"
  on public.lead_import_batches
  for select to authenticated
  using (true);

create policy "authenticated users read lead pool"
  on public.lead_pool
  for select to authenticated
  using (true);

insert into public.app_settings (setting_key, description, value)
values (
  'lead_pool_release',
  'Quantidade padrão liberada do banco de leads para a Base de clientes.',
  '{"default_release_quantity":20}'::jsonb
)
on conflict (setting_key) do nothing;

create or replace function public.import_lead_pool(
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
  v_batch_id uuid;
  v_record jsonb;
  v_company_name text;
  v_company_normalized text;
  v_contact_name text;
  v_contact_linkedin text;
  v_apollo_contact_id text;
  v_apollo_account_id text;
  v_source_row integer;
  v_employee_count integer;
  v_annual_revenue numeric(18,2);
  v_imported integer := 0;
  v_invalid integer := greatest(coalesce(p_client_invalid_rows, 0), 0);
  v_duplicates integer := greatest(coalesce(p_client_duplicate_rows, 0), 0);
  v_total integer := greatest(coalesce(p_total_rows, 0), 0);
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória';
  end if;
  if nullif(btrim(p_file_name), '') is null then
    raise exception 'file_name é obrigatório';
  end if;
  if jsonb_typeof(p_records) <> 'array' then
    raise exception 'records deve ser um array JSON';
  end if;
  if jsonb_array_length(p_records) > 5000 then
    raise exception 'Cada lote aceita no máximo 5000 registros';
  end if;
  if v_total < jsonb_array_length(p_records) + v_invalid + v_duplicates then
    raise exception 'total_rows é menor do que os registros reportados';
  end if;

  insert into public.lead_import_batches (
    file_name,
    total_rows,
    invalid_rows,
    duplicate_rows,
    uploaded_by
  )
  values (
    btrim(p_file_name),
    v_total,
    v_invalid,
    v_duplicates,
    auth.uid()
  )
  returning id into v_batch_id;

  for v_record in select value from jsonb_array_elements(p_records)
  loop
    v_company_name := nullif(btrim(v_record ->> 'companyName'), '');
    v_company_normalized := public.normalize_company_name(v_company_name);
    v_contact_name := nullif(btrim(v_record ->> 'fullName'), '');
    v_contact_linkedin := public.normalize_linkedin_url(v_record ->> 'linkedinUrl');
    v_apollo_contact_id := nullif(btrim(v_record ->> 'apolloContactId'), '');
    v_apollo_account_id := nullif(btrim(v_record ->> 'apolloAccountId'), '');

    if v_company_name is null
       or v_company_normalized = ''
       or v_contact_name is null
       or v_contact_linkedin = ''
       or v_contact_linkedin not like 'https://www.linkedin.com/in/%' then
      v_invalid := v_invalid + 1;
      continue;
    end if;

    begin
      v_source_row := (v_record ->> 'sourceRow')::integer;
      v_employee_count := nullif(v_record ->> 'employees', '')::integer;
      v_annual_revenue := nullif(v_record ->> 'annualRevenue', '')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        v_invalid := v_invalid + 1;
        continue;
    end;

    if v_source_row is null or v_source_row <= 1
       or v_employee_count < 0
       or v_annual_revenue < 0 then
      v_invalid := v_invalid + 1;
      continue;
    end if;

    -- Dedupe global: o histórico do CRM e todos os lotes anteriores contam.
    if exists (
      select 1
        from public.companies c
        join public.leads l on l.company_id = c.id
       where c.normalized_name = v_company_normalized
          or (v_apollo_account_id is not null and c.apollo_account_id = v_apollo_account_id)
    ) or exists (
      select 1
        from public.contacts c
        join public.leads l on l.contact_id = c.id
       where public.normalize_linkedin_url(c.linkedin_url) = v_contact_linkedin
          or (v_apollo_contact_id is not null and c.apollo_contact_id = v_apollo_contact_id)
    ) or exists (
      select 1
        from public.lead_pool p
       where p.normalized_company_name = v_company_normalized
          or p.normalized_contact_linkedin_url = v_contact_linkedin
          or (v_apollo_account_id is not null and p.apollo_account_id = v_apollo_account_id)
          or (v_apollo_contact_id is not null and p.apollo_contact_id = v_apollo_contact_id)
    ) then
      v_duplicates := v_duplicates + 1;
      continue;
    end if;

    begin
      insert into public.lead_pool (
        batch_id,
        source_row,
        company_name,
        normalized_company_name,
        company_linkedin_url,
        website_domain,
        industry,
        city,
        state,
        country,
        employee_count,
        company_size,
        annual_revenue,
        contact_name,
        contact_title,
        contact_linkedin_url,
        normalized_contact_linkedin_url,
        apollo_contact_id,
        apollo_account_id,
        extracted_at,
        raw_payload
      )
      values (
        v_batch_id,
        v_source_row,
        v_company_name,
        v_company_normalized,
        nullif(btrim(v_record ->> 'companyLinkedinUrl'), ''),
        nullif(btrim(v_record ->> 'websiteDomain'), ''),
        nullif(btrim(v_record ->> 'industry'), ''),
        nullif(btrim(v_record ->> 'city'), ''),
        nullif(btrim(v_record ->> 'state'), ''),
        nullif(btrim(v_record ->> 'country'), ''),
        v_employee_count,
        case
          when v_record ->> 'companySize' in ('small', 'medium', 'large')
            then v_record ->> 'companySize'
          else null
        end,
        v_annual_revenue,
        v_contact_name,
        nullif(btrim(v_record ->> 'title'), ''),
        v_contact_linkedin,
        v_contact_linkedin,
        v_apollo_contact_id,
        v_apollo_account_id,
        coalesce(nullif(v_record ->> 'extractedAt', '')::timestamptz, now()),
        v_record
      );
      v_imported := v_imported + 1;
    exception
      when unique_violation then
        v_duplicates := v_duplicates + 1;
      when invalid_datetime_format then
        v_invalid := v_invalid + 1;
    end;
  end loop;

  update public.lead_import_batches
     set imported_rows = v_imported,
         invalid_rows = v_invalid,
         duplicate_rows = v_duplicates,
         status = case when v_imported > 0 then 'ready' else 'empty' end,
         completed_at = now()
   where id = v_batch_id;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'file_name', btrim(p_file_name),
    'total', v_total,
    'imported', v_imported,
    'invalid', v_invalid,
    'duplicates', v_duplicates,
    'available', (select count(*) from public.lead_pool where status = 'disponivel')
  );
end;
$$;

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
          name,
          normalized_name,
          linkedin_url,
          website_domain,
          industry,
          headquarters_city,
          headquarters_state,
          employee_count,
          company_size,
          revenue_proxy_min,
          revenue_proxy_max,
          apollo_account_id
        )
        values (
          v_pool.company_name,
          v_pool.normalized_company_name,
          v_pool.company_linkedin_url,
          v_pool.website_domain,
          v_pool.industry,
          v_pool.city,
          v_pool.state,
          v_pool.employee_count,
          v_pool.company_size,
          v_pool.annual_revenue,
          v_pool.annual_revenue,
          v_pool.apollo_account_id
        )
        returning id into v_company_id;
      end if;

      if v_contact_id is null then
        insert into public.contacts (
          full_name,
          linkedin_url,
          title,
          location_country,
          profile_gate_passed,
          profile_gate_reason,
          apollo_contact_id
        )
        values (
          v_pool.contact_name,
          v_pool.normalized_contact_linkedin_url,
          v_pool.contact_title,
          case when lower(v_pool.country) = 'brazil' then 'Brasil' else v_pool.country end,
          false,
          'Importado do banco de leads; conexões do LinkedIn ainda não verificadas.',
          v_pool.apollo_contact_id
        )
        returning id into v_contact_id;
      end if;

      insert into public.leads (
        company_id,
        contact_id,
        source,
        current_stage,
        import_origin,
        company_overview,
        contact_context
      )
      values (
        v_company_id,
        v_contact_id,
        'manual_referral',
        'revisao_manual',
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
         set released_rows = released_rows + 1,
             status = case
               when released_rows + 1 >= imported_rows then 'completed'
               else status
             end
       where id = v_pool.batch_id;

      insert into public.lead_activities (
        lead_id,
        activity_type,
        summary,
        metadata,
        created_by
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
    'duplicates', count(*) filter (where status = 'duplicado'),
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

revoke all on function public.import_lead_pool(text, jsonb, integer, integer, integer) from public, anon;
revoke all on function public.release_lead_pool(integer) from public, anon;
revoke all on function public.lead_pool_dashboard() from public, anon;

grant execute on function public.import_lead_pool(text, jsonb, integer, integer, integer) to authenticated;
grant execute on function public.release_lead_pool(integer) to authenticated;
grant execute on function public.lead_pool_dashboard() to authenticated;

commit;
