import assert from "node:assert/strict";
import {
  openCrmEntityDetails,
  readActiveCrmPage,
  writeActiveCrmPage,
} from "../crm-navigation.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

const storage = memoryStorage();
assert.equal(readActiveCrmPage(storage), "operation");
writeActiveCrmPage("projects", storage);
assert.equal(readActiveCrmPage(storage), "projects",
  "A pagina selecionada deve sobreviver ao reload.");

storage.setItem("agf-crm-active-page", "pagina-inexistente");
assert.equal(readActiveCrmPage(storage), "operation",
  "Uma pagina invalida deve usar a Base de clientes como fallback seguro.");

const leadView = {
  page: "followups",
  selectedId: null,
  selectedProjectId: "projeto-anterior",
  notificationCenterOpen: true,
};
openCrmEntityDetails(leadView, "lead", "lead-1");
assert.equal(leadView.page, "followups",
  "Abrir um lead em Follow-ups nao deve trocar a pagina ativa.");
assert.equal(leadView.selectedId, "lead-1");
assert.equal(leadView.selectedProjectId, null);
assert.equal(leadView.notificationCenterOpen, false);

const projectView = {
  page: "history",
  selectedId: "lead-anterior",
  selectedProjectId: null,
  notificationCenterOpen: true,
};
openCrmEntityDetails(projectView, "project", "project-1");
assert.equal(projectView.page, "history",
  "Abrir um projeto na Base completa nao deve trocar a pagina ativa.");
assert.equal(projectView.selectedId, null);
assert.equal(projectView.selectedProjectId, "project-1");
assert.equal(projectView.notificationCenterOpen, false);

console.log("navigation state: ok");
