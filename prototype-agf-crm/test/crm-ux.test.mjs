import assert from "node:assert/strict";
import {
  dimensionConversion,
  formatBrlCurrency,
  formatCrmDate,
  leadAgeState,
  parseBrlCurrency,
  projectValueByStage,
  searchLeads,
} from "../crm-ux.js";

assert.equal(
  formatCrmDate("2026-07-29T16:30:00Z"),
  "29/07/2026 13:30",
  "Datas com horario devem usar DD/MM/AAAA HH:MM, sem virgula.",
);
assert.equal(formatCrmDate("2026-07-29T16:30:00Z", false), "29/07/2026");

const searchableLeads = [{
  company: "Máquinas Agrícolas Paraná",
  contact: "João Müller",
  role: "Diretor Financeiro",
  industry: "Agriculture",
  location: "Londrina, PR",
  linkedinUrl: "https://linkedin.com/in/joao",
  organizationLabel: "Economia real",
  responsibleName: "Giulio Ferraro",
}];
assert.equal(searchLeads(searchableLeads, "maquinas joao").length, 1,
  "A busca deve ignorar acentos e combinar empresa com contato.");
assert.equal(searchLeads(searchableLeads, "londrina financeiro").length, 1,
  "A busca deve cobrir localizacao e cargo.");
assert.equal(searchLeads(searchableLeads, "software").length, 0);

assert.equal(leadAgeState("2026-07-24T12:00:00Z", "2026-07-29T12:00:00Z"), null);
assert.deepEqual(
  leadAgeState("2026-07-20T12:00:00Z", "2026-07-29T12:00:00Z"),
  { days: 9, tone: "warning", label: "Parado ha 9 dias" },
);
assert.equal(leadAgeState("2026-07-01T12:00:00Z", "2026-07-29T12:00:00Z").tone, "critical");

assert.equal(parseBrlCurrency("R$ 1.234.567,89"), 1_234_567.89);
assert.equal(parseBrlCurrency("250000"), 250_000);
assert.equal(parseBrlCurrency(""), null);
assert.equal(formatBrlCurrency(1_250_000), "R$ 1.250.000");

const conversions = dimensionConversion([
  { id: "1", source: "Apollo", stage: "em_conversa" },
  { id: "2", source: "Apollo", stage: "revisao_manual" },
  { id: "3", source: "Manual", stage: "revisao_manual" },
], (lead) => lead.source, new Set(["3"]));
assert.deepEqual(conversions[0], { label: "Apollo", total: 2, advanced: 1, rate: 50 });
assert.deepEqual(conversions[1], { label: "Manual", total: 1, advanced: 1, rate: 100 });

const stageValues = projectValueByStage([
  { currentStage: "proposta", estimated_value: 100000 },
  { currentStage: "proposta", estimated_value: "25000.50" },
  { currentStage: "negociacao", estimated_value: null },
], [["proposta", "Proposta"], ["negociacao", "Negociação"]]);
assert.deepEqual(stageValues, [
  { stage: "proposta", label: "Proposta", count: 2, value: 125000.5 },
  { stage: "negociacao", label: "Negociação", count: 1, value: 0 },
]);

console.log("crm ux: ok");
