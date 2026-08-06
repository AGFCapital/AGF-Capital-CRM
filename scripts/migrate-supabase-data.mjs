import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const privateDirectory = path.join(root, "tmp", "supabase-migration");
const exportFile = path.join(privateDirectory, "old-public-data.json");
const importFile = path.join(privateDirectory, "import-into-new.sql");

const tables = [
  "app_settings",
  "profiles",
  "criteria_versions",
  "extraction_runs",
  "companies",
  "contacts",
  "lead_import_batches",
  "lead_pool",
  "leads",
  "lead_signals",
  "message_drafts",
  "calendar_bookings",
  "dispatches",
  "lead_activities",
  "commercial_projects",
  "commercial_project_members",
  "commercial_project_links",
  "lead_follow_ups",
  "follow_up_email_deliveries",
  "integration_events",
  "invite_note_templates",
  "connection_sync_runs",
  "outreach_metrics",
];

const insertOrder = [
  "app_settings",
  "profiles",
  "criteria_versions",
  "extraction_runs",
  "companies",
  "contacts",
  "lead_import_batches",
  "lead_pool",
  "leads",
  "lead_signals",
  "message_drafts",
  "calendar_bookings",
  "dispatches",
  "lead_activities",
  "commercial_projects",
  "commercial_project_members",
  "commercial_project_links",
  "lead_follow_ups",
  "follow_up_email_deliveries",
  "integration_events",
  "invite_note_templates",
  "connection_sync_runs",
  "outreach_metrics",
];

function runQuery(sql) {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  mkdirSync(privateDirectory, { recursive: true });
  const queryFile = path.join(privateDirectory, "query.sql");
  const queryFileArgument = path.relative(root, queryFile);
  writeFileSync(queryFile, `${sql}\n`, "utf8");
  const raw = execFileSync(
    executable,
    ["--yes", "supabase@latest", "db", "query", "--linked", "--file", queryFileArgument, "--output", "json"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      shell: process.platform === "win32",
    },
  );
  const parsed = JSON.parse(raw);
  return parsed.rows || [];
}

function exportQuery() {
  const pairs = tables.flatMap((table) => [
    `'${table}'`,
    `coalesce((select jsonb_agg(to_jsonb(row_value)) from public.${table} row_value), '[]'::jsonb)`,
  ]);
  return `select jsonb_build_object(${pairs.join(",")}) as export_data;`;
}

function replaceProfileIds(value, mapping) {
  if (Array.isArray(value)) return value.map((item) => replaceProfileIds(item, mapping));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceProfileIds(item, mapping)]),
    );
  }
  return typeof value === "string" && mapping.has(value) ? mapping.get(value) : value;
}

function sqlJson(value) {
  const json = JSON.stringify(value);
  if (json.includes("$agf_migration$")) {
    throw new Error("O dump contém o delimitador reservado da migração.");
  }
  return `$agf_migration$${json}$agf_migration$::jsonb`;
}

function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(`Identificador SQL invÃ¡lido: ${value}`);
  }
  return `"${value}"`;
}

function insertStatement(table, rows, conflictClause = "on conflict do nothing") {
  if (!rows.length) return `-- ${table}: sem linhas\n`;
  const excludedColumns = table === "leads" ? new Set(["total_score"]) : new Set();
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
    .filter((column) => !excludedColumns.has(column));
  const columnList = columns.map(quoteIdentifier).join(", ");
  const projection = columns.map((column) => `source.${quoteIdentifier(column)}`).join(", ");
  return `insert into public.${quoteIdentifier(table)} (${columnList})\nselect ${projection}\nfrom jsonb_populate_recordset(null::public.${quoteIdentifier(table)}, ${sqlJson(rows)}) as source\n${conflictClause};\n`;
}

function buildImportSql(data) {
  const sections = [
    "begin;",
    "set local session_replication_role = replica;",
    "delete from public.criteria_versions;",
  ];

  for (const table of insertOrder) {
    const rows = data[table] || [];
    if (table === "app_settings") {
      sections.push(insertStatement(table, rows, "on conflict (setting_key) do update\nset value = excluded.value, updated_at = excluded.updated_at"));
      continue;
    }
    if (table === "profiles") {
      sections.push(insertStatement(table, rows, "on conflict (id) do update\nset full_name = excluded.full_name,\n    role = excluded.role,\n    notification_email = excluded.notification_email,\n    follow_up_email_enabled = excluded.follow_up_email_enabled"));
      continue;
    }
    sections.push(insertStatement(table, rows));
  }

  sections.push("set local session_replication_role = origin;", "commit;");
  return `${sections.join("\n\n")}\n`;
}

function counts(data) {
  return Object.fromEntries(tables.map((table) => [table, (data[table] || []).length]));
}

function exportData() {
  mkdirSync(privateDirectory, { recursive: true });
  const rows = runQuery(exportQuery());
  if (rows.length !== 1 || !rows[0].export_data) {
    throw new Error("O banco antigo não retornou o pacote de exportação esperado.");
  }
  writeFileSync(exportFile, `${JSON.stringify(rows[0].export_data, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ mode: "export", file: exportFile, counts: counts(rows[0].export_data) }, null, 2));
}

function prepareImport() {
  const data = JSON.parse(readFileSync(exportFile, "utf8"));
  const targetUsers = runQuery("select id::text, lower(email) as email from auth.users order by email;");
  const targetByEmail = new Map(targetUsers.map((user) => [user.email, user.id]));
  const oldProfiles = data.profiles || [];
  const missingEmails = oldProfiles
    .map((profile) => String(profile.notification_email || "").toLowerCase())
    .filter((email) => email && !targetByEmail.has(email));

  if (missingEmails.length) {
    throw new Error(`Crie estes usuários no novo Auth antes de importar: ${missingEmails.join(", ")}`);
  }

  const profileMapping = new Map(
    oldProfiles.map((profile) => [
      profile.id,
      targetByEmail.get(String(profile.notification_email || "").toLowerCase()),
    ]),
  );
  const remapped = replaceProfileIds(data, profileMapping);
  writeFileSync(importFile, buildImportSql(remapped), "utf8");
  console.log(JSON.stringify({
    mode: "prepare-import",
    file: importFile,
    mappedProfiles: profileMapping.size,
    counts: counts(remapped),
  }, null, 2));
}

const mode = process.argv[2];
if (mode === "export") exportData();
else if (mode === "prepare-import") prepareImport();
else throw new Error("Uso: node scripts/migrate-supabase-data.mjs <export|prepare-import>");
