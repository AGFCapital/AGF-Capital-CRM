import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareApolloImport } from "../apollo-import.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "..", "crm.js"), "utf8");
const importerSource = fs.readFileSync(path.join(here, "..", "apollo-import.js"), "utf8");
const poolMigrationSource = fs.readFileSync(path.join(here, "..", "..", "supabase", "migrations", "20260728000100_long_list_lead_pool.sql"), "utf8");

assert.match(source, /const stageDropTargets = \{/,
  "Cada coluna operacional deve declarar a etapa que conclui ao receber um card.");
assert.match(source, /invite:\s*"aprovado"/,
  "Arrastar da base para Enviar convite deve aprovar o lead.");
assert.match(source, /pending:\s*"convite_enviado"/,
  "Arrastar para Convite pendente deve registrar o convite enviado.");
assert.match(source, /function completeLeadDrop\(/,
  "O drop deve executar a mesma ação operacional da interface, não só trocar o status.");
assert.match(source, /data-action="open-linkedin"/,
  "O card deve oferecer o atalho do LinkedIn sem abrir o painel lateral.");
assert.match(source, /function cardActions\(/,
  "As ações operacionais devem estar disponíveis diretamente no card compacto.");
assert.match(source, /data-action="copy-message"/,
  "O cartão de conexão aceita deve permitir copiar a mensagem sem abrir o painel.");
assert.match(source, /data-action="copy-scheduling"/,
  "O cartão de agendamento deve permitir copiar a mensagem de agenda sem abrir o painel.");
assert.doesNotMatch(source, /lead\.location \|\| "Em revisao"/,
  "O rodapé não pode manter Em revisão como fallback depois de mudar o estágio.");
assert.match(source, /legacySheetDrafts\[/,
  "Leads legados devem priorizar o rascunho preservado da planilha.");
assert.match(source, /function captureBoardViewport\(/,
  "Atualizacoes de etapa devem preservar a posicao horizontal do Kanban.");
assert.match(source, /restoreBoardViewport\(viewport\)/,
  "Apos atualizar os dados compartilhados, o Kanban deve voltar ao ponto onde o operador estava.");
assert.match(source, /function projectDrawer\(/,
  "Um card de projeto deve abrir o painel de edicao.");
assert.match(source, /#project-edit-form/,
  "O painel de projeto deve salvar correcoes diretamente no CRM.");
assert.match(source, /function notifyDueFollowUps\(/,
  "Follow-ups vencidos ou proximos devem gerar alerta no CRM.");
assert.match(source, /scheduleFollowUpNotifications\(\)/,
  "A verificacao de follow-ups deve continuar ativa durante a sessao.");
assert.match(source, /import \{ decodeApolloCsv, prepareApolloImport \} from "\.\/apollo-import\.js"/,
  "O CRM deve usar o módulo de importação do Apollo antes de gravar no Supabase.");
assert.match(source, /decodeApolloCsv\(await file\.arrayBuffer\(\)\)/,
  "O CRM deve detectar a codificação do arquivo antes de interpretar nomes com acentos.");
assert.match(importerSource, /export function prepareApolloImport\(/,
  "O módulo de importação deve concentrar o mapeamento e a validação do CSV.");
assert.match(source, /\/rest\/v1\/rpc\/import_lead_pool/,
  "Uma lista longa deve entrar no banco de espera por uma única operação atômica.");
assert.match(source, /\/rest\/v1\/rpc\/release_lead_pool/,
  "A interface deve liberar apenas a quantidade configurada para o Kanban.");
assert.doesNotMatch(source, /for \(const record of report\.records\)/,
  "A interface não deve voltar a fazer várias chamadas ao Supabase por lead.");
assert.match(poolMigrationSource, /'revisao_manual'/,
  "Leads liberados do banco de espera devem entrar na Base de clientes.");
assert.match(poolMigrationSource, /profile_gate_passed[\s\S]*false/,
  "A liberação não pode declarar conexões do LinkedIn como verificadas sem evidência.");
assert.match(poolMigrationSource, /for update skip locked/,
  "A liberação concorrente deve reservar registros do pool sem duplicar cards.");
assert.match(poolMigrationSource, /p_quantity < 1 or v_requested > 100|v_requested < 1 or v_requested > 100/,
  "A quantidade liberada deve permanecer limitada por operação.");

const importReport = prepareApolloImport([
  "First Name;Last Name;Title;Company Name;Person Linkedin Url;# Employees",
  "Ana;Silva;CFO;Empresa Norte;https://www.linkedin.com/in/ana-silva;300",
  "Bia;Souza;Controller;Empresa Norte;https://www.linkedin.com/in/bia-souza;300",
  "Ana;Silva;CFO;Outra Empresa;https://www.linkedin.com/in/ana-silva;500",
].join("\n"), "apollo.csv");
assert.equal(importReport.records.length, 1,
  "A importação deve manter apenas um registro por empresa e por contato dentro do mesmo CSV.");
assert.equal(importReport.duplicateRows.length, 2,
  "Linhas duplicadas no próprio arquivo devem ser excluídas antes do salvamento automático.");
assert.ok(importReport.records[0].extractedAt,
  "O lote deve registrar quando os dados foram extraídos/importados.");

console.log("kanban interaction contract: ok");
