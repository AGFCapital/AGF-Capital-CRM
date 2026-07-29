import assert from "node:assert/strict";
import fs from "node:fs";

const workflowUrl = new URL("./agf-calendar-to-supabase.json", import.meta.url);
const workflow = JSON.parse(fs.readFileSync(workflowUrl, "utf8"));
const normalizer = workflow.nodes.find((node) => node.name === "Normalizar reserva");
const cancellationTrigger = workflow.nodes.find((node) => node.parameters?.triggerOn === "eventCancelled");

assert.ok(normalizer, "O workflow deve conter o normalizador de reservas.");
assert.ok(cancellationTrigger, "O workflow deve escutar cancelamentos explicitamente.");
assert.ok(
  workflow.connections[cancellationTrigger.name]?.main?.[0]?.some((edge) => edge.node === "Normalizar reserva"),
  "Cancelamentos devem passar pelo mesmo normalizador das criacoes e atualizacoes.",
);

const runNormalizer = new Function("$input", "$vars", normalizer.parameters.jsCode);
const result = runNormalizer({
  first: () => ({
    json: {
      id: "calendar-event-andre",
      status: "confirmed",
      summary: "30 min with Caio (André Müller)",
      start: { dateTime: "2026-07-30T09:00:00-03:00" },
      end: { dateTime: "2026-07-30T09:30:00-03:00" },
      attendees: [
        { email: "caio@agfcapital.com.br", organizer: true, self: true },
        { email: "mullern.andre@gmail.com", responseStatus: "accepted" },
      ],
    },
  }),
}, {});

assert.equal(
  result[0].json.payload.guest_name,
  "André Müller",
  "O nome do convidado deve ser extraído dos parênteses do título criado pelo Appointment Schedule.",
);

const cancelled = runNormalizer({
  first: () => ({
    json: {
      id: "calendar-event-andre",
      status: "cancelled",
      summary: "30 min with Caio (AndrÃ© MÃ¼ller)",
      attendees: [
        { email: "caio@agfcapital.com.br", organizer: true, self: true },
        { email: "mullern.andre@gmail.com", responseStatus: "accepted" },
      ],
    },
  }),
}, {});

assert.equal(cancelled[0].json.payload.status, "cancelled",
  "Cancelamento sem datas deve ser encaminhado ao Supabase.");

console.log("calendar booking normalizer: ok");
