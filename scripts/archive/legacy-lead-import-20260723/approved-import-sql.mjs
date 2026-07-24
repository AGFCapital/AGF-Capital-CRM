import crypto from "node:crypto";

function sqlLiteral(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function renderApprovedImportSql(report) {
  if (report.aborted > 0) {
    throw new Error("Importação bloqueada: há linhas abortadas.");
  }
  if (!report.legacyStatusPreflight.safeToApply) {
    throw new Error(
      'Importação bloqueada: existe Status diferente de "Para aprovação".',
    );
  }
  if (report.importable !== 60 || report.totalRead !== 60) {
    throw new Error(
      `Importação bloqueada: esperado 60/60, recebido ${report.importable}/${report.totalRead}.`,
    );
  }

  const values = report.importRecords
    .map((record) => {
      const { company, contact, lead } = record;
      return `(${[
        `${sqlLiteral(crypto.randomUUID())}::uuid`,
        sqlLiteral(company.name),
        sqlLiteral(company.normalized_name),
        sqlLiteral(company.industry),
        sqlLiteral(company.headquarters_city),
        sqlLiteral(company.headquarters_state),
        company.employee_count ?? "null",
        sqlLiteral(company.company_size),
        company.revenue_proxy_min ?? "null",
        company.revenue_proxy_max ?? "null",
        company.real_economy ? "true" : "false",
        sqlLiteral(company.real_economy_rationale),
        `${sqlLiteral(crypto.randomUUID())}::uuid`,
        sqlLiteral(contact.full_name),
        sqlLiteral(contact.linkedin_url),
        sqlLiteral(contact.title),
        sqlLiteral(contact.location_country),
        contact.connection_count ?? "null",
        contact.connect_available ? "true" : "false",
        contact.profile_gate_passed ? "true" : "false",
        sqlLiteral(contact.profile_gate_reason),
        sqlLiteral(contact.career_context),
        `${sqlLiteral(crypto.randomUUID())}::uuid`,
        `${sqlLiteral(lead.source)}::public.lead_source`,
        `${sqlLiteral(lead.current_stage)}::public.lead_stage`,
        lead.company_size_score,
        lead.urgency_score ?? "null",
        lead.financial_moment_score ?? "null",
        lead.decision_maker_score,
        lead.real_economy_bonus,
        sqlLiteral(lead.company_overview),
        sqlLiteral(lead.contact_context),
        sqlLiteral(lead.import_origin),
      ].join(", ")})`;
    })
    .join(",\n");

  return `-- Etapa 1: importação única aprovada em 2026-07-23.
-- Gerado pelo importador isolado; não reutilizar.
begin;

select pg_advisory_xact_lock(hashtext('agf_etapa_1_legacy_import_20260723'));

create temp table legacy_import_payload (
  company_id uuid primary key,
  company_name text not null,
  normalized_name text not null,
  industry text,
  headquarters_city text,
  headquarters_state text,
  employee_count integer,
  company_size text,
  revenue_proxy_min numeric(18,2),
  revenue_proxy_max numeric(18,2),
  real_economy boolean not null,
  real_economy_rationale text,
  contact_id uuid unique not null,
  contact_name text not null,
  linkedin_url text not null,
  title text,
  location_country text,
  connection_count integer,
  connect_available boolean not null,
  profile_gate_passed boolean not null,
  profile_gate_reason text,
  career_context text,
  lead_id uuid unique not null,
  source public.lead_source not null,
  current_stage public.lead_stage not null,
  company_size_score smallint not null,
  urgency_score smallint,
  financial_moment_score smallint,
  decision_maker_score smallint not null,
  real_economy_bonus smallint not null,
  company_overview text,
  contact_context text,
  import_origin text not null
) on commit drop;

insert into legacy_import_payload values
${values};

do $$
begin
  if (select count(*) from legacy_import_payload) <> 60 then
    raise exception 'Importação bloqueada: payload não contém 60 registros.';
  end if;
  if exists (
    select normalized_name from legacy_import_payload
    group by normalized_name having count(*) > 1
  ) then
    raise exception 'Importação bloqueada: empresa duplicada no payload.';
  end if;
  if exists (
    select linkedin_url from legacy_import_payload
    group by linkedin_url having count(*) > 1
  ) then
    raise exception 'Importação bloqueada: contato duplicado no payload.';
  end if;
  if exists (
    select 1 from public.leads
    where import_origin like 'Google Sheets |%'
  ) then
    raise exception 'Importação bloqueada: carga legada já executada.';
  end if;
  if exists (
    select 1
    from legacy_import_payload p
    join public.companies c using (normalized_name)
  ) then
    raise exception 'Importação bloqueada: empresa já existe no banco.';
  end if;
  if exists (
    select 1
    from legacy_import_payload p
    join public.contacts c using (linkedin_url)
  ) then
    raise exception 'Importação bloqueada: contato já existe no banco.';
  end if;
end
$$;

insert into public.companies (
  id, name, normalized_name, industry, headquarters_city,
  headquarters_state, employee_count, company_size, revenue_proxy_min,
  revenue_proxy_max, real_economy, real_economy_rationale
)
select
  company_id, company_name, normalized_name, industry, headquarters_city,
  headquarters_state, employee_count, company_size, revenue_proxy_min,
  revenue_proxy_max, real_economy, real_economy_rationale
from legacy_import_payload;

insert into public.contacts (
  id, full_name, linkedin_url, title, location_country, connection_count,
  connect_available, profile_gate_passed, profile_gate_reason, career_context
)
select
  contact_id, contact_name, linkedin_url, title, location_country,
  connection_count, connect_available, profile_gate_passed,
  profile_gate_reason, career_context
from legacy_import_payload;

insert into public.leads (
  id, company_id, contact_id, source, current_stage, company_size_score,
  urgency_score, financial_moment_score, decision_maker_score,
  real_economy_bonus, company_overview, contact_context, import_origin
)
select
  lead_id, company_id, contact_id, source, current_stage, company_size_score,
  urgency_score, financial_moment_score, decision_maker_score,
  real_economy_bonus, company_overview, contact_context, import_origin
from legacy_import_payload;

do $$
begin
  if (select count(*) from public.leads where import_origin like 'Google Sheets |%') <> 60 then
    raise exception 'Importação truncada: não foram gravados 60 leads.';
  end if;
  if exists (
    select 1 from public.lead_signals s
    join public.leads l on l.id = s.lead_id
    where l.import_origin like 'Google Sheets |%'
  ) then
    raise exception 'Importação inválida: lead_signal legado foi criado.';
  end if;
end
$$;

commit;
`;
}
