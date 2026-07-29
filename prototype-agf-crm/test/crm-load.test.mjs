import assert from "node:assert/strict";

const root = { innerHTML: "" };
globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
};
globalThis.document = {
  querySelector(selector) { return selector === "#app" ? root : null; },
  querySelectorAll() { return []; },
};
globalThis.window = {
  setInterval() { return 1; },
  confirm() { return false; },
};
globalThis.requestAnimationFrame = (callback) => callback();
globalThis.fetch = async () => ({
  ok: true,
  async json() { return {}; },
});

await import(`../crm.js?load-test=${Date.now()}`);
await new Promise((resolve) => setTimeout(resolve, 0));

assert.match(root.innerHTML, /configuracao Supabase valida/,
  "O modulo principal deve carregar e apresentar um estado legivel sem configuracao remota.");

console.log("crm load: ok");
