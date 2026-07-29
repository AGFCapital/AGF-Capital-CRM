import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, "..", "crm.css"), "utf8");

assert.match(
  css,
  /\.lead-pool-modal\s*\{[^}]*max-height:\s*calc\(100dvh\s*-\s*[^;]+\);[^}]*overflow-y:\s*auto;/s,
  "O Banco de leads deve limitar sua altura ao viewport e rolar o próprio conteúdo.",
);

console.log("lead pool modal scroll contract: ok");
