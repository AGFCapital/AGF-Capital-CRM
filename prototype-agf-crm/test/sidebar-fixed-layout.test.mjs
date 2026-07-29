import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../crm.css", import.meta.url), "utf8");
const desktopSidebar = css.match(/\.sidebar\s*\{([^}]*)\}/)?.[1] || "";
const desktopWorkspace = css.match(/\.workspace\s*\{([^}]*)\}/)?.[1] || "";

assert.match(desktopSidebar, /position\s*:\s*fixed/, "a sidebar deve permanecer fixa na viewport");
assert.match(desktopSidebar, /height\s*:\s*100dvh/, "a sidebar deve ocupar exatamente a altura visível");
assert.match(desktopSidebar, /overflow-y\s*:\s*auto/, "a sidebar deve ter rolagem interna apenas quando necessário");
assert.match(desktopWorkspace, /margin-left\s*:\s*var\(--sidebar-width\)/, "o conteúdo deve reservar a largura da sidebar fixa");

console.log("sidebar fixed layout: ok");
