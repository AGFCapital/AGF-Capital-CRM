import assert from "node:assert/strict";
import fs from "node:fs";

const workflowUrl = new URL("./agf-linkedin-acceptance-to-supabase.json", import.meta.url);
const workflow = JSON.parse(fs.readFileSync(workflowUrl, "utf8"));
const normalizer = workflow.nodes.find((node) => node.name === "Normalizar aceite");
const trigger = workflow.nodes.find((node) => node.type === "n8n-nodes-base.gmailTrigger");
const sync = workflow.nodes.find((node) => node.type === "n8n-nodes-base.httpRequest");
const migration = fs.readFileSync(
  new URL("../../supabase/migrations/20260806000100_linkedin_acceptance_sync.sql", import.meta.url),
  "utf8",
);

assert.ok(normalizer, "O workflow deve conter o normalizador de aceites.");
assert.ok(trigger, "O workflow deve escutar a caixa do Gmail.");
assert.match(
  trigger.parameters.filters.q,
  /from:invitations@linkedin\.com/,
  "So o remetente oficial de convites do LinkedIn pode disparar o fluxo.",
);
assert.match(
  sync.parameters.url,
  /\/rest\/v1\/rpc\/sync_linkedin_connection_acceptance$/,
  "O fluxo deve chamar a RPC de aceite, e nao escrever direto na tabela leads.",
);
assert.ok(
  workflow.connections[trigger.name]?.main?.[0]?.some((edge) => edge.node === "Normalizar aceite"),
  "O gatilho do Gmail deve passar pelo normalizador.",
);

const runNormalizer = new Function("$input", "$vars", normalizer.parameters.jsCode);
const gmailItem = (overrides = {}) => ({
  first: () => ({
    json: {
      id: "19fd41c0aa6f0e2b",
      threadId: "19fd41c0aa6f0e2b",
      labelIds: ["INBOX"],
      internalDate: "1786029300000",
      from: '"Alessandra Dos Anjos Rosa via LinkedIn" <invitations@linkedin.com>',
      subject: "Alessandra accepted your invitation, explore their network",
      text: [
        "LinkedIn",
        "",
        "Alessandra has accepted your invitation",
        "",
        "Alessandra Dos Anjos Rosa",
        "Analista De Controladoria - Grupo Malwee",
        "",
        "Message",
        "",
        "Suggestions from Alessandra's network",
      ].join("\n"),
      ...overrides,
    },
  }),
});

const [aceite] = runNormalizer(gmailItem(), {});
assert.equal(
  aceite.json.payload.full_name,
  "Alessandra Dos Anjos Rosa",
  "O nome completo sai do remetente, porque o assunto traz apenas o primeiro nome.",
);
assert.equal(
  aceite.json.payload.headline,
  "Analista De Controladoria - Grupo Malwee",
  "O cargo com a empresa sai da linha logo abaixo da repeticao do nome no corpo.",
);
assert.equal(
  aceite.json.payload.message_id,
  "19fd41c0aa6f0e2b",
  "O id da mensagem e a chave de idempotencia do reprocessamento.",
);
assert.equal(
  aceite.json.payload.received_at,
  new Date(1786029300000).toISOString(),
  "A data do aceite deve vir do proprio e-mail, nao do momento da execucao.",
);

assert.deepEqual(
  runNormalizer(gmailItem({ from: '"LinkedIn" <news-noreply@linkedin.com>' }), {}),
  [],
  "Newsletter do LinkedIn cita nomes e nao pode mover card nenhum.",
);
assert.deepEqual(
  runNormalizer(gmailItem({ subject: "Alessandra shared a post" }), {}),
  [],
  "Somente o e-mail de aceite avanca a etapa.",
);

const semCargo = runNormalizer(gmailItem({
  text: ["Alessandra Dos Anjos Rosa", "Message", "Suggestions"].join("\n"),
}), {});
assert.equal(
  semCargo[0].json.payload.headline,
  "",
  "Rotulo de botao nao pode ser confundido com cargo; sem cargo o desempate fica com o Supabase.",
);

const html = runNormalizer(gmailItem({
  text: undefined,
  html: "<p>Alessandra Dos Anjos Rosa</p><p>Analista De Controladoria - Grupo Malwee</p>",
}), {});
assert.equal(
  html[0].json.payload.headline,
  "Analista De Controladoria - Grupo Malwee",
  "O e-mail so em HTML tambem precisa render o cargo.",
);

assert.throws(
  () => runNormalizer({ first: () => ({ json: { body: {}, query: {}, headers: {} } }) }, {}),
  /não autorizado/i,
  "O webhook de teste sem segredo deve ser recusado.",
);

assert.match(migration, /metadata ->> 'linkedin_message_id' = v_message_id/,
  "Reprocessar a mesma mensagem nao pode mover o card duas vezes.");
assert.match(migration, /if v_candidate_count <> 1 then/,
  "Candidato ambiguo nao pode ser escolhido pela rotina.");
assert.match(migration, /l\.current_stage = 'convite_enviado'/,
  "Somente cards em Convite pendente podem avancar por e-mail.");
assert.match(migration, /grant execute on function public\.sync_linkedin_connection_acceptance\(jsonb\)\s*\n\s*to service_role;/,
  "A RPC roda com o service_role do n8n e fica fora do alcance do frontend.");

console.log("linkedin acceptance workflow: ok");
