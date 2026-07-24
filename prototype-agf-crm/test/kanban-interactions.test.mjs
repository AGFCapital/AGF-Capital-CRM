import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "..", "crm.js"), "utf8");

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

console.log("kanban interaction contract: ok");
