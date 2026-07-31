const ACTIVE_PAGE_KEY = "agf-crm-active-page";
const validPages = new Set([
  "dashboard",
  "operation",
  "followups",
  "agenda",
  "projects",
  "history",
]);

export function readActiveCrmPage(storage = globalThis.localStorage) {
  try {
    const page = storage?.getItem(ACTIVE_PAGE_KEY);
    return validPages.has(page) ? page : "operation";
  } catch {
    return "operation";
  }
}

export function writeActiveCrmPage(page, storage = globalThis.localStorage) {
  const safePage = validPages.has(page) ? page : "operation";
  try { storage?.setItem(ACTIVE_PAGE_KEY, safePage); } catch { /* storage indisponivel */ }
  return safePage;
}

export function openCrmEntityDetails(viewState, type, id) {
  if (type === "project") {
    viewState.selectedId = null;
    viewState.selectedProjectId = id;
  } else {
    viewState.selectedProjectId = null;
    viewState.selectedId = id;
  }
  viewState.notificationCenterOpen = false;
  return viewState;
}
