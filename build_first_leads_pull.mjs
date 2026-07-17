import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "outputs";
const outputPath = `${outputDir}/agf_leads_primeira_puxada.xlsx`;

const leads = [
  [
    "Amaggi",
    "Analista de Planejamento Financeiro e Relações com Investidores",
    "https://www.linkedin.com/jobs/view/4439340767/",
    new Date("2026-07-15"),
    "Rafael C. L. Biasoli",
    "CFO / Diretor Financeiro e de Relações com Investidores na AMAGGI",
    "https://www.linkedin.com/in/rafaelbiasoli/",
    "Vaga em Cuiabá publicada há 4 dias e ainda em avaliação. A página da empresa indica 5.001–10.000 funcionários; há sinal público de reforço em planejamento financeiro e RI.",
    7,
    "Alta",
  ],
  [
    "Longitude Incorporadora",
    "Especialista de Planejamento Financeiro e RI",
    "https://www.linkedin.com/jobs/view/4440090703/",
    new Date("2026-07-15"),
    "Gonçalo Matarazzo",
    "Co-fundador e Co-CEO na Longitude Incorporadora",
    "https://www.linkedin.com/in/gon%C3%A7alo-matarazzo-8013221b/",
    "Vaga híbrida em São Paulo publicada há 1 dia. A página da empresa indica 201–500 funcionários; a posição combina planejamento financeiro e relações com investidores.",
    7,
    "Alta",
  ],
  [
    "ZAMP",
    "Coordenador de FP&A",
    "https://www.linkedin.com/jobs/view/4427355300/",
    new Date("2026-07-15"),
    "Guilherme Favaro",
    "VP na ZAMP | CEO da Popeyes Brasil",
    "https://www.linkedin.com/in/gaf/",
    "Vaga híbrida em São Paulo publicada há cerca de um mês e ainda em avaliação. A página da ZAMP indica mais de 10.000 funcionários; a coordenação de FP&A é sinal direto de demanda de capacidade financeira.",
    7,
    "Alta",
  ],
  [
    "JHSF",
    "Analista de Planejamento Financeiro Jr | Retail",
    "https://www.linkedin.com/jobs/view/4437299602/",
    new Date("2026-07-15"),
    "Thiago Alonso de Oliveira",
    "CEO at JHSF (UK)",
    "https://www.linkedin.com/in/thiago-alonso-de-oliveira-7b54711/",
    "Vaga presencial em São Paulo publicada há 1 dia. A página da empresa indica 1.001–5.000 funcionários; a função reforça a capacidade de planejamento financeiro na operação de varejo.",
    6,
    "Média",
  ],
  [
    "ESTADÃO",
    "Analista de Planejamento Financeiro Jr",
    "https://www.linkedin.com/jobs/view/4438124295/",
    new Date("2026-07-15"),
    "Omar Santos",
    "Diretor Executivo de Finanças, Operações e Serviços do Estadão",
    "https://www.linkedin.com/in/omardossantos/",
    "Vaga em São Paulo publicada há 1 semana. A página da empresa indica 1.001–5.000 funcionários; a contratação é um sinal público de aumento de capacidade no planejamento financeiro.",
    6,
    "Média",
  ],
];

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Puxada 1");
sheet.showGridLines = false;

sheet.mergeCells("A1:J1");
sheet.getRange("A1").values = [["AGF Capital — Leads Outbound | Puxada 1"]];
sheet.getRange("A1:J1").format = {
  font: { bold: true, color: "#111827", size: 16 },
  horizontalAlignment: "left",
  verticalAlignment: "center",
};
sheet.getRange("A1:J1").format.rowHeight = 28;

sheet.mergeCells("A2:J2");
sheet.getRange("A2").values = [["Pesquisa humana assistida no LinkedIn • 15 jul. 2026 • Sem contato ou acompanhamento nesta etapa"]];
sheet.getRange("A2:J2").format = {
  font: { color: "#4B5563", italic: true, size: 10 },
  horizontalAlignment: "left",
  verticalAlignment: "center",
};
sheet.getRange("A2:J2").format.rowHeight = 22;

const headers = [[
  "Empresa",
  "Vaga (sinal)",
  "Link da vaga",
  "Descoberto em",
  "Contato prioritário",
  "Cargo atual",
  "LinkedIn",
  "Evidência de qualificação",
  "Pontuação",
  "Prioridade",
]];

sheet.getRange("A4:J4").values = headers;
sheet.getRange("A5:J9").values = leads;
sheet.getRange("A4:J4").format = {
  fill: "#F3F4F6",
  font: { bold: true, color: "#111827" },
  horizontalAlignment: "left",
  verticalAlignment: "center",
  wrapText: true,
  borders: { bottom: { style: "thin", color: "#D1D5DB" } },
};
sheet.getRange("A5:J9").format = {
  font: { color: "#111827", size: 10 },
  verticalAlignment: "top",
  wrapText: true,
  borders: { insideHorizontal: { style: "thin", color: "#E5E7EB" } },
};
sheet.getRange("D5:D9").format.numberFormat = "yyyy-mm-dd";
sheet.getRange("I5:I9").format.horizontalAlignment = "center";
sheet.getRange("J5:J9").format.horizontalAlignment = "center";
sheet.getRange("A4:J9").format.rowHeight = 56;
sheet.getRange("A4:J4").format.rowHeight = 32;

sheet.getRange("A:A").format.columnWidthPx = 150;
sheet.getRange("B:B").format.columnWidthPx = 220;
sheet.getRange("C:C").format.columnWidthPx = 245;
sheet.getRange("D:D").format.columnWidthPx = 105;
sheet.getRange("E:E").format.columnWidthPx = 160;
sheet.getRange("F:F").format.columnWidthPx = 245;
sheet.getRange("G:G").format.columnWidthPx = 250;
sheet.getRange("H:H").format.columnWidthPx = 405;
sheet.getRange("I:I").format.columnWidthPx = 85;
sheet.getRange("J:J").format.columnWidthPx = 90;
sheet.freezePanes.freezeRows(4);
sheet.getRange("I5:I9").conditionalFormats.add("cellIs", {
  operator: "greaterThanOrEqual",
  formula: 7,
  format: { fill: "#DCFCE7", font: { bold: true, color: "#166534" } },
});
sheet.getRange("I5:I9").conditionalFormats.add("cellIs", {
  operator: "between",
  formula: [4, 6],
  format: { fill: "#FEF3C7", font: { bold: true, color: "#92400E" } },
});

const criteria = workbook.worksheets.add("Critérios");
criteria.showGridLines = false;
criteria.mergeCells("A1:C1");
criteria.getRange("A1").values = [["Rubrica aplicada nesta puxada"]];
criteria.getRange("A1:C1").format = {
  font: { bold: true, color: "#111827", size: 14 },
  verticalAlignment: "center",
};
criteria.getRange("A1:C1").format.rowHeight = 28;
criteria.getRange("A3:C3").values = [["Critério", "Regra", "Pontos"]];
criteria.getRange("A4:C10").values = [
  ["Urgência", "Coordenação/gerência/head ou 2+ vagas = 3; pleno/sênior/especialista = 2; júnior ou sem senioridade = 1.", "0–3"],
  ["Recência", "Até 7 dias = 2; de 8 a 30 dias = 1.", "0–2"],
  ["Porte", "Faturamento público ≥ R$ 50 mi = 2; porte LinkedIn de 100+ pessoas = 1.", "0–2"],
  ["Decisor", "CFO ou CEO = 2; gestor/recrutador interno, se necessário = 1.", "0–2"],
  ["Localização", "Empresa fora do eixo Rio–São Paulo = 1; demais casos = 0.", "0–1"],
  ["Entrada", "Lead entra a partir de 4 pontos; 4 é classificado como exploratório.", "≥ 4"],
  ["Escopo", "Somente descoberta: não há contato, revisão de lotes anteriores ou follow-up.", "—"],
];
criteria.getRange("A3:C3").format = {
  fill: "#F3F4F6",
  font: { bold: true, color: "#111827" },
  borders: { bottom: { style: "thin", color: "#D1D5DB" } },
};
criteria.getRange("A4:C10").format = {
  font: { color: "#111827", size: 10 },
  verticalAlignment: "top",
  wrapText: true,
  borders: { insideHorizontal: { style: "thin", color: "#E5E7EB" } },
};
criteria.getRange("A:A").format.columnWidthPx = 120;
criteria.getRange("B:B").format.columnWidthPx = 580;
criteria.getRange("C:C").format.columnWidthPx = 80;
criteria.getRange("A3:C10").format.rowHeight = 42;
criteria.getRange("A3:C3").format.rowHeight = 26;
criteria.freezePanes.freezeRows(3);

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
