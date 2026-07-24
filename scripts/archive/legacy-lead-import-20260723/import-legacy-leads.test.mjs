import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDryRun,
  normalizeCompanyName,
  normalizeLinkedInUrl,
} from "./import-legacy-leads.mjs";
import { renderApprovedImportSql } from "./approved-import-sql.mjs";

function row(overrides = {}) {
  return {
    tab: "Middle market — prospecção proativa",
    sheetRow: 5,
    legacyId: "MM-001",
    source: "middle_market",
    sourceStage: "qualificado",
    adjacentLegacyStatus: "Para aprovação",
    company: "Empresa Exemplo Ltda.",
    companyKey: "empresa exemplo",
    contact: "Pessoa Exemplo",
    title: "CFO",
    linkedinRaw: "https://br.linkedin.com/in/pessoa-exemplo/",
    linkedinKey: "https://www.linkedin.com/in/pessoa-exemplo",
    importOrigin:
      'Google Sheets | aba="Middle market — prospecção proativa" | linha=5 | legacy_id="MM-001" | status_crm_legado="" | status_legado="Para aprovação"',
    abortReasons: [],
    ...overrides,
  };
}

test("normaliza empresa e sufixo societário", () => {
  assert.equal(
    normalizeCompanyName("  Indústria Ágil S/A  "),
    "industria agil",
  );
});

test("normaliza host regional e remove query do LinkedIn", () => {
  assert.equal(
    normalizeLinkedInUrl(
      "https://br.linkedin.com/in/Pessoa-Exemplo/?trk=public",
    ),
    "https://www.linkedin.com/in/pessoa-exemplo",
  );
});

test("status legado não controla o estágio do lead importado", () => {
  const report = buildDryRun([row({ sourceStage: "" })]);
  assert.equal(report.importable, 1);
  assert.equal(report.inReviewManual, 1);
  assert.equal(report.importRecords[0].lead.current_stage, "revisao_manual");
  assert.deepEqual(report.importRecords[0].lead_signals, []);
  assert.equal(report.importRecords[0].lead.financial_moment_score, 0);
  assert.equal(report.invariants.sourceStatusControlsStage, false);
});

test("consolida mesma empresa e mesmo contato", () => {
  const first = row();
  const duplicate = row({
    sheetRow: 9,
    legacyId: "MM-009",
    importOrigin:
      'Google Sheets | aba="Middle market — prospecção proativa" | linha=9 | legacy_id="MM-009" | status_crm_legado="" | status_legado="Para aprovação"',
  });
  const report = buildDryRun([first, duplicate]);
  assert.equal(report.importable, 1);
  assert.equal(report.duplicatesConsolidated, 1);
  assert.match(report.importRecords[0].lead.import_origin, /linha=5/);
  assert.match(report.importRecords[0].lead.import_origin, /linha=9/);
});

test("aborta empresa repetida com contatos diferentes", () => {
  const report = buildDryRun([
    row(),
    row({
      sheetRow: 6,
      legacyId: "MM-002",
      contact: "Outra Pessoa",
      linkedinRaw: "https://www.linkedin.com/in/outra-pessoa/",
      linkedinKey: "https://www.linkedin.com/in/outra-pessoa",
    }),
  ]);
  assert.equal(report.importable, 0);
  assert.equal(report.aborted, 2);
  assert.equal(
    report.abortedRows[0].reasons[0].reason,
    "empresa_repetida_sem_decisao_deterministica",
  );
});

test("aborta contato repetido em empresas diferentes", () => {
  const report = buildDryRun([
    row(),
    row({
      sheetRow: 6,
      legacyId: "MM-002",
      company: "Outra Empresa",
      companyKey: "outra empresa",
    }),
  ]);
  assert.equal(report.importable, 0);
  assert.equal(report.aborted, 2);
  assert.equal(
    report.abortedRows[0].reasons[0].reason,
    "contato_repetido_em_empresas_diferentes",
  );
});

test("preflight para se houver status que indique possível abordagem", () => {
  const report = buildDryRun([
    row({ adjacentLegacyStatus: "Convite enviado" }),
  ]);
  assert.equal(report.legacyStatusPreflight.safeToApply, false);
  assert.equal(report.legacyStatusPreflight.rowsRequiringStop.length, 1);
});

test("SQL aprovado é transacional, de uso único e não cria sinais", () => {
  const rows = Array.from({ length: 60 }, (_, index) =>
    row({
      sheetRow: index + 5,
      legacyId: `L-${index + 1}`,
      company: `Empresa ${index + 1}`,
      companyKey: `empresa ${index + 1}`,
      contact: `Contato ${index + 1}`,
      linkedinRaw: `https://www.linkedin.com/in/contato-${index + 1}`,
      linkedinKey: `https://www.linkedin.com/in/contato-${index + 1}`,
    }),
  );

  const sql = renderApprovedImportSql(buildDryRun(rows));
  assert.match(sql, /^begin;/m);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /carga legada já executada/);
  assert.match(sql, /insert into public\.companies/);
  assert.match(sql, /insert into public\.contacts/);
  assert.match(sql, /insert into public\.leads/);
  assert.doesNotMatch(sql, /insert into public\.lead_signals/);
  assert.match(sql, /commit;/);
});

test("SQL aprovado recusa preflight inseguro", () => {
  const rows = Array.from({ length: 60 }, (_, index) =>
    row({
      sheetRow: index + 5,
      legacyId: `L-${index + 1}`,
      company: `Empresa ${index + 1}`,
      companyKey: `empresa ${index + 1}`,
      contact: `Contato ${index + 1}`,
      linkedinRaw: `https://www.linkedin.com/in/contato-${index + 1}`,
      linkedinKey: `https://www.linkedin.com/in/contato-${index + 1}`,
      adjacentLegacyStatus: index === 0 ? "Enviado" : "Para aprovação",
    }),
  );

  assert.throws(
    () => renderApprovedImportSql(buildDryRun(rows)),
    /Status diferente/,
  );
});
