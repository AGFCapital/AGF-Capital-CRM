import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import { renderApprovedImportSql } from "./approved-import-sql.mjs";

export const SOURCE_TABS = [
  {
    name: "Vagas — leads quentes",
    xlsxAliases: ["Vagas — leads quentes"],
    source: "vacancy",
    stageHeader: "Status CRM",
    adjacentLegacyStatusHeader: "Status",
    headers: {
      legacyId: "ID",
      company: "Empresa",
      contact: "Contato prioritário",
      title: "Cargo atual",
      linkedin: "LinkedIn",
    },
  },
  {
    name: "Middle market — prospecção proativa",
    xlsxAliases: [
      "Middle market — prospecção proativa",
      "Middle market — prospecção proa",
    ],
    source: "middle_market",
    stageHeader: "Status CRM",
    adjacentLegacyStatusHeader: "Status",
    headers: {
      legacyId: "ID",
      company: "Empresa",
      contact: "Contato prioritário",
      title: "Cargo atual",
      linkedin: "LinkedIn",
    },
  },
];

function asText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function normalizeCompanyName(value) {
  return asText(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/&/g, " e ")
    .replace(/\b(s\/?a|ltda|limitada|eireli|me)\b/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeLinkedInUrl(value) {
  const raw = asText(value);
  if (!raw) return "";

  let parsed;
  try {
    parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return "";
  }

  const hostname = parsed.hostname
    .toLocaleLowerCase("en-US")
    .replace(/^(br|pt|mx)\./, "")
    .replace(/^linkedin\.com$/, "www.linkedin.com");

  if (hostname !== "www.linkedin.com") return "";

  let pathname;
  try {
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    pathname = parsed.pathname;
  }

  pathname = pathname
    .normalize("NFC")
    .toLocaleLowerCase("en-US")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");

  if (!pathname.startsWith("/in/") || pathname.length <= 4) return "";
  return `https://www.linkedin.com${pathname}`;
}

function headerIndex(row) {
  const index = new Map();
  row.forEach((value, column) => {
    const header = asText(value);
    if (header) index.set(header, column);
  });
  return index;
}

function requireHeaders(tab, index) {
  const required = [
    ...Object.values(tab.headers),
    tab.stageHeader,
    tab.adjacentLegacyStatusHeader,
  ];
  const missing = required.filter((header) => !index.has(header));
  if (missing.length) {
    throw new Error(
      `Aba "${tab.name}" sem cabeçalho obrigatório: ${missing.join(", ")}`,
    );
  }
}

function valueAt(row, index, header) {
  return row[index.get(header)];
}

function isDataRow(row, index, tab) {
  return Object.values(tab.headers).some(
    (header) => asText(valueAt(row, index, header)) !== "",
  );
}

function makeOrigin(
  tabName,
  sheetRow,
  legacyId,
  statusCrm,
  legacyStatus,
) {
  const escapedTab = tabName.replaceAll('"', '\\"');
  const escapedId = legacyId.replaceAll('"', '\\"');
  return [
    "Google Sheets",
    `aba=${JSON.stringify(escapedTab)}`,
    `linha=${sheetRow}`,
    `legacy_id=${JSON.stringify(escapedId)}`,
    `status_crm_legado=${JSON.stringify(statusCrm)}`,
    `status_legado=${JSON.stringify(legacyStatus)}`,
  ].join(" | ");
}

function abort(row, reason, detail = {}) {
  row.abortReasons.push({ reason, ...detail });
}

function parseSheetRows(values, tab) {
  const headerOffset = values.findIndex((row) =>
    row.some((value) => asText(value) === tab.headers.legacyId),
  );

  if (headerOffset < 0) {
    throw new Error(`Cabeçalho não encontrado na aba "${tab.name}".`);
  }

  const index = headerIndex(values[headerOffset]);
  requireHeaders(tab, index);

  return values
    .slice(headerOffset + 1)
    .map((sourceRow, offset) => {
      const sheetRow = headerOffset + offset + 2;
      if (!isDataRow(sourceRow, index, tab)) return null;

      const legacyId = asText(valueAt(sourceRow, index, tab.headers.legacyId));
      const company = asText(valueAt(sourceRow, index, tab.headers.company));
      const contact = asText(valueAt(sourceRow, index, tab.headers.contact));
      const title = asText(valueAt(sourceRow, index, tab.headers.title));
      const linkedinRaw = asText(
        valueAt(sourceRow, index, tab.headers.linkedin),
      );
      const sourceStage = asText(valueAt(sourceRow, index, tab.stageHeader));
      const adjacentLegacyStatus = asText(
        valueAt(sourceRow, index, tab.adjacentLegacyStatusHeader),
      );

      const row = {
        tab: tab.name,
        sheetRow,
        legacyId,
        source: tab.source,
        sourceStage,
        adjacentLegacyStatus,
        company,
        companyKey: normalizeCompanyName(company),
        contact,
        title,
        linkedinRaw,
        linkedinKey: normalizeLinkedInUrl(linkedinRaw),
        importOrigin: makeOrigin(
          tab.name,
          sheetRow,
          legacyId,
          sourceStage,
          adjacentLegacyStatus,
        ),
        abortReasons: [],
      };

      if (!legacyId) abort(row, "legacy_id_ausente");
      if (!company) abort(row, "empresa_ausente");
      if (!row.companyKey) abort(row, "empresa_nao_normalizavel");
      if (!contact) abort(row, "contato_ausente");
      if (!linkedinRaw) {
        abort(row, "linkedin_url_ausente");
      } else if (!row.linkedinKey) {
        abort(row, "linkedin_url_invalida", { value: linkedinRaw });
      }

      return row;
    })
    .filter(Boolean);
}

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!value) continue;
    const group = groups.get(value) ?? [];
    group.push(row);
    groups.set(value, group);
  }
  return groups;
}

function markDedupConflicts(rows) {
  const otherwiseValid = rows.filter((row) => row.abortReasons.length === 0);
  const companyGroups = groupBy(otherwiseValid, "companyKey");
  let consolidated = 0;

  for (const [companyKey, group] of companyGroups) {
    if (group.length < 2) continue;

    const contacts = new Set(group.map((row) => row.linkedinKey));
    const sources = new Set(group.map((row) => row.source));
    if (contacts.size === 1 && sources.size === 1) {
      const keeper = group[0];
      keeper.consolidatedOrigins = group.map((row) => row.importOrigin);
      for (const duplicate of group.slice(1)) {
        duplicate.consolidatedInto = {
          tab: keeper.tab,
          sheetRow: keeper.sheetRow,
          legacyId: keeper.legacyId,
        };
        consolidated += 1;
      }
      continue;
    }

    const conflicts = group.map((row) => ({
      tab: row.tab,
      sheetRow: row.sheetRow,
      legacyId: row.legacyId,
      contact: row.contact,
      linkedin: row.linkedinRaw,
    }));
    for (const row of group) {
      abort(row, "empresa_repetida_sem_decisao_deterministica", {
        companyKey,
        conflicts,
      });
    }
  }

  const stillValid = rows.filter(
    (row) => row.abortReasons.length === 0 && !row.consolidatedInto,
  );
  const contactGroups = groupBy(stillValid, "linkedinKey");

  for (const [linkedinKey, group] of contactGroups) {
    if (group.length < 2) continue;
    const companies = new Set(group.map((row) => row.companyKey));
    if (companies.size === 1) continue;

    const conflicts = group.map((row) => ({
      tab: row.tab,
      sheetRow: row.sheetRow,
      legacyId: row.legacyId,
      company: row.company,
    }));
    for (const row of group) {
      abort(row, "contato_repetido_em_empresas_diferentes", {
        linkedinKey,
        conflicts,
      });
    }
  }

  return consolidated;
}

function mergeOrigins(row) {
  return (row.consolidatedOrigins ?? [row.importOrigin]).join(" || ");
}

function toImportRecord(row) {
  return {
    company: {
      name: row.company,
      normalized_name: row.companyKey,
      industry: null,
      headquarters_city: null,
      headquarters_state: null,
      employee_count: null,
      company_size: null,
      revenue_proxy_min: null,
      revenue_proxy_max: null,
      real_economy: false,
      real_economy_rationale: null,
    },
    contact: {
      full_name: row.contact,
      linkedin_url: row.linkedinKey,
      title: row.title || null,
      location_country: null,
      connection_count: null,
      connect_available: false,
      profile_gate_passed: false,
      profile_gate_reason: "Importação legada: perfil não revalidado.",
      career_context: null,
    },
    lead: {
      source: row.source,
      current_stage: "revisao_manual",
      company_size_score: 0,
      urgency_score: row.source === "vacancy" ? 0 : null,
      financial_moment_score: row.source === "middle_market" ? 0 : null,
      decision_maker_score: 0,
      real_economy_bonus: 0,
      company_overview: null,
      contact_context: null,
      import_origin: mergeOrigins(row),
    },
    lead_signals: [],
  };
}

export function buildDryRun(rows) {
  const statusCounts = new Map();
  for (const row of rows) {
    statusCounts.set(
      row.adjacentLegacyStatus,
      (statusCounts.get(row.adjacentLegacyStatus) ?? 0) + 1,
    );
  }
  const unsafeLegacyStatusRows = rows.filter(
    (row) => row.adjacentLegacyStatus !== "Para aprovação",
  );

  const duplicatesConsolidated = markDedupConflicts(rows);
  const importableRows = rows.filter(
    (row) => row.abortReasons.length === 0 && !row.consolidatedInto,
  );
  const abortedRows = rows.filter((row) => row.abortReasons.length > 0);

  return {
    mode: "dry-run",
    generatedAt: new Date().toISOString(),
    totalRead: rows.length,
    importable: importableRows.length,
    inReviewManual: importableRows.length,
    duplicatesConsolidated,
    aborted: abortedRows.length,
    legacyStatusPreflight: {
      expectedValue: "Para aprovação",
      safeToApply: unsafeLegacyStatusRows.length === 0,
      distinctValues: [...statusCounts.entries()].map(([value, count]) => ({
        value,
        count,
      })),
      rowsRequiringStop: unsafeLegacyStatusRows.map((row) => ({
        tab: row.tab,
        sheetRow: row.sheetRow,
        legacyId: row.legacyId,
        company: row.company,
        status: row.adjacentLegacyStatus,
        statusCrm: row.sourceStage,
      })),
    },
    abortedRows: abortedRows.map((row) => ({
      tab: row.tab,
      sheetRow: row.sheetRow,
      legacyId: row.legacyId,
      company: row.company,
      contact: row.contact,
      reasons: row.abortReasons,
    })),
    consolidatedRows: rows
      .filter((row) => row.consolidatedInto)
      .map((row) => ({
        tab: row.tab,
        sheetRow: row.sheetRow,
        legacyId: row.legacyId,
        consolidatedInto: row.consolidatedInto,
      })),
    importRecords: importableRows.map(toImportRecord),
    invariants: {
      targetStage: "revisao_manual",
      sourceStatusControlsStage: false,
      legacyStatusesPreservedInImportOrigin: true,
      leadSignalsCreated: 0,
      verifiedAtFabricated: false,
      verificationMethodFabricated: false,
      sourceTabs: SOURCE_TABS.map((tab) => tab.name),
      excludedTabs: ["M&A - Pré-captação", "Critérios e filtros"],
    },
  };
}

export async function readLegacyWorkbook(inputPath) {
  const input = await FileBlob.load(inputPath);
  const workbook = await SpreadsheetFile.importXlsx(input);
  const rows = [];

  for (const tab of SOURCE_TABS) {
    let worksheet;
    let lastError;
    for (const alias of tab.xlsxAliases) {
      try {
        worksheet = workbook.worksheets.getItem(alias);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!worksheet) {
      throw new Error(
        `Aba "${tab.name}" não encontrada no XLSX exportado.`,
        { cause: lastError },
      );
    }
    const usedRange = worksheet.getUsedRange(true);
    const values = usedRange?.values ?? [];
    rows.push(...parseSheetRows(values, tab));
  }

  return rows;
}

function renderMarkdown(report, inputPath) {
  const lines = [
    "# Etapa 1 — relatório de dry-run",
    "",
    `- Fonte: \`${inputPath}\``,
    `- Gerado em: ${report.generatedAt}`,
    `- Total lido: ${report.totalRead}`,
    `- Importáveis: ${report.importable}`,
    `- Em \`revisao_manual\`: ${report.inReviewManual}`,
    `- Duplicatas consolidadas: ${report.duplicatesConsolidated}`,
    `- Linhas abortadas: ${report.aborted}`,
    `- Registros em \`lead_signals\`: ${report.invariants.leadSignalsCreated}`,
    `- Preflight de status legado seguro: ${report.legacyStatusPreflight.safeToApply ? "sim" : "não"}`,
    "",
    "## Preflight de status legado",
    "",
    `Valor esperado: \`${report.legacyStatusPreflight.expectedValue}\`.`,
    "",
    ...report.legacyStatusPreflight.distinctValues.map(
      ({ value, count }) => `- ${JSON.stringify(value)}: ${count}`,
    ),
    "",
    "## Linhas abortadas",
    "",
  ];

  if (report.abortedRows.length === 0) {
    lines.push("Nenhuma.");
  } else {
    for (const row of report.abortedRows) {
      const reasons = row.reasons
        .map((reason) => {
          const value = Object.hasOwn(reason, "value")
            ? `; valor=${JSON.stringify(reason.value)}`
            : "";
          const column = reason.column ? `; coluna=${reason.column}` : "";
          const adjacent =
            reason.adjacentColumn !== undefined
              ? `; ${reason.adjacentColumn}=${JSON.stringify(reason.adjacentValue)}`
              : "";
          return `${reason.reason}${column}${value}${adjacent}`;
        })
        .join(" | ");
      lines.push(
        `- ${row.tab}, linha ${row.sheetRow}, ${row.legacyId || "(sem ID)"}, ${row.company || "(sem empresa)"}: ${reasons}`,
      );
    }
  }

  lines.push("", "## Duplicatas consolidadas", "");
  if (report.consolidatedRows.length === 0) {
    lines.push("Nenhuma.");
  } else {
    for (const row of report.consolidatedRows) {
      lines.push(
        `- ${row.tab}, linha ${row.sheetRow}, ${row.legacyId} → ${row.consolidatedInto.tab}, linha ${row.consolidatedInto.sheetRow}, ${row.consolidatedInto.legacyId}`,
      );
    }
  }

  lines.push(
    "",
    "## Invariantes",
    "",
    "- Nenhum `lead_signals` é criado.",
    "- `verified_at` e `verification_method` não são fabricados.",
    "- Todo registro importável é gravado em `revisao_manual`, independentemente do status legado.",
    "- `Status CRM` e `Status` são preservados apenas em `import_origin`.",
    "- O modo dry-run não executa qualquer escrita no Supabase.",
    "",
  );

  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const args = { dryRun: false, apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === "--dry-run") args.dryRun = true;
    else if (current === "--apply") args.apply = true;
    else if (current === "--input") args.input = argv[++i];
    else if (current === "--report-dir") args.reportDir = argv[++i];
    else if (current === "--sql-output") args.sqlOutput = argv[++i];
    else throw new Error(`Argumento desconhecido: ${current}`);
  }

  if (args.dryRun === args.apply) {
    throw new Error(
      "Informe exatamente um modo: --dry-run ou --apply.",
    );
  }
  if (args.apply && !args.sqlOutput) {
    throw new Error("No modo --apply, informe --sql-output <arquivo.sql>.");
  }
  if (!args.input) throw new Error("Informe --input <arquivo.xlsx>.");
  return args;
}

async function main() {
  throw new Error(
    "ARQUIVADO: a importação única foi concluída em 2026-07-23 e não pode ser executada novamente.",
  );
  /* c8 ignore next */
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.input);
  const reportDir = path.resolve(
    args.reportDir ?? "outputs/legacy-leads-import",
  );

  const rows = await readLegacyWorkbook(inputPath);
  const report = buildDryRun(rows);

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(
    path.join(reportDir, "dry-run-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(reportDir, "dry-run-report.md"),
    renderMarkdown(report, inputPath),
    "utf8",
  );

  if (args.apply) {
    const sqlOutput = path.resolve(args.sqlOutput);
    await fs.mkdir(path.dirname(sqlOutput), { recursive: true });
    await fs.writeFile(sqlOutput, renderApprovedImportSql(report), "utf8");
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.aborted > 0) process.exitCode = 2;
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
