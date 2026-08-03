import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  defaultMessageTemplates,
  readMessageTemplates,
  renderMessageTemplate,
  serializeMessageTemplates,
  validateMessageTemplates,
} from "../message-templates.js";

test("modelos padrão preservam todas as variáveis operacionais", () => {
  assert.equal(validateMessageTemplates(defaultMessageTemplates), null);
});

test("validação impede salvar um modelo sem variável obrigatória", () => {
  const templates = { ...defaultMessageTemplates, scheduling: "Escolha um horário aqui: {link}" };
  assert.match(validateMessageTemplates(templates), /Mensagem de agendamento.*\{Nome\}/);
});

test("configuração persistida é lida, serializada e renderizada", () => {
  const stored = serializeMessageTemplates(defaultMessageTemplates);
  const loaded = readMessageTemplates(stored);
  assert.deepEqual(loaded, defaultMessageTemplates);
  assert.equal(
    renderMessageTemplate(loaded.inviteNote, { Nome: "Giulio", Empresa: "AGF Capital" }),
    "Giulio, tudo bem? Tenho conversado com empresas como a AGF Capital sobre como aplicar IA no financeiro de forma prática. Achei que faria sentido nos conectarmos por aqui.",
  );
});

test("configurações exibem quatro editores compartilhados", async () => {
  const source = await readFile(new URL("../crm.js", import.meta.url), "utf8");
  assert.match(source, /Modelos de mensagens/);
  assert.match(source, /messageTemplateFields\.map/);
  assert.match(source, /setting_key=eq\.message_templates/);
  assert.match(source, /state\.settings = settingsFromRows\(settingRows\);[\s\S]*state\.leads = leadRows\.map/);
});
