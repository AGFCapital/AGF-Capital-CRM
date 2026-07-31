import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "..", "crm.js"), "utf8");
const migration = fs.readFileSync(
  path.join(here, "..", "..", "supabase", "migrations", "20260729000800_project_follow_ups.sql"),
  "utf8",
);
const responsibleMigration = fs.readFileSync(
  path.join(here, "..", "..", "supabase", "migrations", "20260731000100_follow_up_recipient_follows_card_responsible.sql"),
  "utf8",
);

assert.match(
  migration,
  /add column project_id uuid\s+references public\.commercial_projects\(id\) on delete cascade/,
  "O mesmo registro de follow-up deve poder pertencer a um projeto.",
);
assert.match(
  responsibleMigration,
  /add column(?: if not exists)? responsible_id uuid\s+references public\.profiles\(id\) on delete set null/,
  "Projetos devem ter um perfil responsavel, nao apenas um nome livre.",
);
assert.match(
  responsibleMigration,
  /projects_propagate_responsible_to_follow_ups/,
  "Trocar o responsavel do projeto deve atualizar seus follow-ups pendentes.",
);
assert.match(
  migration,
  /num_nonnulls\(lead_id, project_id\) = 1/,
  "Um follow-up deve pertencer exatamente a um lead ou a um projeto.",
);
assert.match(
  migration,
  /coalesce\(company\.name, project\.company_name\) as company_name/,
  "A fila de e-mail deve manter o contrato de empresa para follow-ups de projetos.",
);
assert.match(
  migration,
  /project\.id as project_id/,
  "A fila de e-mail deve identificar o projeto relacionado.",
);

assert.match(
  source,
  /commercial_projects\?select=\*,lead_follow_ups\(id,due_at,note,status,completed_at,assigned_to\)/,
  "O carregamento dos projetos deve incluir seus follow-ups.",
);
assert.match(
  source,
  /function allFollowUps\(/,
  "Notificações e listagem devem usar uma única coleção de follow-ups.",
);
assert.match(
  source,
  /data-action="new-followup" data-project="\$\{project\.id\}"/,
  "O projeto expandido deve permitir criar follow-up.",
);
assert.match(
  source,
  /project_id:\s*target\.type === "project" \? target\.id : null/,
  "A criação deve persistir o vínculo com o projeto.",
);
assert.match(
  source,
  /<select name="responsibleId" required>/,
  "O responsavel do projeto deve ser escolhido entre os perfis da equipe.",
);
assert.match(
  source,
  /data-notification-project=/,
  "O sino deve abrir diretamente o projeto relacionado.",
);
assert.match(
  source,
  /data-followup-project=/,
  "A página de follow-ups deve abrir diretamente o projeto relacionado.",
);
assert.match(
  source,
  /Follow-up:\s*\$\{humanDate\(due\.due_at\)\}/,
  "O card compacto de projeto deve exibir o próximo follow-up.",
);

console.log("project follow-ups: ok");
