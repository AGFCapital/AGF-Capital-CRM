import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../crm.js", import.meta.url), "utf8");

test("cada operador salva sua própria agenda no perfil", () => {
  assert.match(source, /Link público da minha agenda/);
  assert.match(source, /booking_url: values\.bookingUrl\.trim\(\)/);
  assert.match(source, /calendar_enabled: true/);
  assert.doesNotMatch(source, /setting_key=eq\.calendar_booking/);
});

test("o agendamento usa o responsável do card e preserva o snapshot", () => {
  assert.match(source, /lead\?\.schedulingBookingUrl \|\| schedulingProfile\(lead\)\?\.booking_url/);
  assert.match(source, /targetStage === "agendamento"/);
  assert.match(source, /owner\.calendar_enabled \|\| !owner\.booking_url/);
  assert.match(source, /scheduling_profile_id,scheduling_booking_url,scheduling_started_at/);
});
