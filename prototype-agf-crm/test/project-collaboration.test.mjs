import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "..", "crm.js"), "utf8");
const styles = fs.readFileSync(path.join(here, "..", "crm.css"), "utf8");
const migration = fs.readFileSync(
  path.join(here, "..", "..", "supabase", "migrations", "20260731000200_project_collaboration.sql"),
  "utf8",
);

assert.match(migration, /create table if not exists public\.commercial_project_members/,
  "Projetos devem persistir membros em uma relacao propria.");
assert.match(migration, /create table if not exists public\.commercial_project_links/,
  "Projetos devem persistir links documentais em uma relacao propria.");
assert.match(migration, /create or replace function public\.save_project_collaboration/,
  "Responsavel, membros e links devem ser salvos por uma interface unica no banco.");
assert.match(migration, /commercial_projects_ensure_responsible_member/,
  "O responsavel principal deve fazer parte da equipe automaticamente.");
assert.match(source, /project_members:commercial_project_members\(profile_id\),project_links:commercial_project_links\(id,title,url,created_at,created_by\)/,
  "O carregamento do pipeline deve incluir membros e documentos.");
assert.match(source, /<select data-owner-filter data-owner-scope="\$\{scope\}"/,
  "CRM e projetos devem oferecer um filtro compacto de responsavel.");
assert.match(source, /state\.profiles\.map\(\(profile\) => `<option value="\$\{profile\.id\}"/,
  "O filtro deve permitir escolher qualquer membro cadastrado.");
assert.match(source, /name="memberIds"/,
  "O formulario deve preservar os membros existentes sem expo-los no layout.");
assert.doesNotMatch(source, /function projectTeamEditor|class="project-member-picker"/,
  "O card expandido deve manter o layout simples anterior, sem o seletor visual de equipe.");
assert.doesNotMatch(source, /project-workspace-drawer/,
  "O detalhe do projeto nao deve voltar ao drawer alargado da interface de equipe.");
assert.match(source, /data-action="add-project-link"/,
  "O projeto expandido deve permitir adicionar links.");
assert.match(source, /class="project-link-open"/,
  "Links salvos devem poder ser abertos diretamente no projeto.");
assert.match(source, /save_project_collaboration/,
  "A interface deve salvar a colaboracao pela funcao atomica do banco.");
assert.match(styles, /\.utility-owner-filter/,
  "O filtro por responsavel deve ficar compacto ao lado da busca.");
assert.match(styles, /\.project-team-grid/,
  "A selecao da equipe deve ter layout visual dedicado.");
assert.match(styles, /\.project-link-row/,
  "Os links do projeto devem ter editor visual dedicado.");

console.log("project collaboration: ok");
