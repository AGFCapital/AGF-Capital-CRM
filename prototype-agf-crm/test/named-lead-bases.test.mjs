import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "..", "crm.js"), "utf8");
const migration = fs.readFileSync(
  path.join(here, "..", "..", "supabase", "migrations", "20260729000600_named_lead_bases.sql"),
  "utf8",
);

assert.match(source, /id="apollo-batch-name"/,
  "Todo CSV deve receber um nome de base antes do upload.");
assert.match(source, /name="batchId"/,
  "A liberação deve exigir a escolha da base de origem.");
assert.match(source, /p_batch_name:\s*batchName/,
  "O nome escolhido deve ser enviado ao banco junto do CSV.");
assert.match(source, /p_batch_id:\s*batchId/,
  "A liberação deve enviar ao banco o ID da base escolhida.");
assert.match(source, /batch\.display_name \|\| batch\.file_name/,
  "A interface deve exibir o nome amigável da base.");

assert.match(migration, /add column display_name text not null/,
  "O banco deve persistir o nome amigável de cada base.");
assert.match(migration, /create or replace function public\.import_named_lead_pool/,
  "A importação nomeada deve ser uma operação atômica no banco.");
assert.match(migration, /create or replace function public\.release_lead_pool_batch/,
  "A liberação por base deve ser uma operação atômica no banco.");
assert.match(migration, /where batch_id = p_batch_id and status = 'disponivel'/,
  "A quantidade disponível deve ser calculada dentro da base selecionada.");
assert.match(migration, /for update skip locked/,
  "Liberações simultâneas não podem criar cards duplicados.");
assert.match(migration, /'batches', coalesce\(/,
  "O dashboard deve entregar a lista de bases para o seletor.");

console.log("named lead bases contract: ok");
