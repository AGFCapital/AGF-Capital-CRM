import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareApolloImport } from "../apollo-import.js";
import { chooseLatestActiveBooking } from "../calendar-bookings.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "..", "crm.js"), "utf8");
const importerSource = fs.readFileSync(path.join(here, "..", "apollo-import.js"), "utf8");
const poolMigrationSource = fs.readFileSync(path.join(here, "..", "..", "supabase", "migrations", "20260728000100_long_list_lead_pool.sql"), "utf8");
const bookingLifecycleMigrationSource = fs.readFileSync(path.join(here, "..", "..", "supabase", "migrations", "20260728000300_calendar_booking_lifecycle.sql"), "utf8");
const followUpOwnershipMigrationSource = fs.readFileSync(path.join(here, "..", "..", "supabase", "migrations", "20260729000400_follow_up_ownership_and_manual_operations.sql"), "utf8");
const followUpCardResponsibleMigrationSource = fs.readFileSync(path.join(here, "..", "..", "supabase", "migrations", "20260731000100_follow_up_recipient_follows_card_responsible.sql"), "utf8");

assert.match(source, /const stageDropTargets = \{/,
  "Cada coluna operacional deve declarar a etapa que conclui ao receber um card.");
assert.match(source, /invite:\s*"aprovado"/,
  "Arrastar da base para Enviar convite deve aprovar o lead.");
assert.match(source, /pending:\s*"convite_enviado"/,
  "Arrastar para Convite pendente deve registrar o convite enviado.");
assert.match(source, /function completeLeadDrop\(/,
  "O drop deve executar a mesma ação operacional da interface, não só trocar o status.");
assert.match(source, /data-action="open-linkedin"/,
  "O card deve oferecer o atalho do LinkedIn sem abrir o painel lateral.");
assert.match(source, /function cardActions\(/,
  "As ações operacionais devem estar disponíveis diretamente no card compacto.");
assert.match(source, /data-action="copy-message"/,
  "O cartão de conexão aceita deve permitir copiar a mensagem sem abrir o painel.");
assert.match(source, /const inviteNoteTemplate = "\{Nome\}, tudo bem\? Tenho conversado com empresas como a \{Empresa\} sobre como aplicar IA no financeiro de forma prática\. Achei que faria sentido nos conectarmos por aqui\."/,
  "A nota curta do convite deve ser própria para conexão, sem reutilizar a mensagem de agenda.");
assert.match(source, /if \(lead\.stage === "aprovado"\) return `\$\{button\("copy-invite-note"/,
  "Enviar convite deve copiar a nota curta, e nao o rascunho longo de pos-aceite.");
assert.match(source, /if \(action === "copy-invite-note"\)/,
  "A copia da nota curta deve ter uma acao propria e auditavel.");
assert.match(source, /data-action="copy-scheduling"/,
  "O cartão de agendamento deve permitir copiar a mensagem de agenda sem abrir o painel.");
assert.match(source, /button\("copy-scheduling", "Copiar mensagem de agenda", "secondary"\)/,
  "Copiar a mensagem de agenda deve seguir o estilo secundário dos demais botões de cópia.");
assert.match(source, /data-action="delete-lead"/,
  "O painel expandido deve oferecer a exclusão protegida do card.");
assert.match(source, /async function deleteLead\(/,
  "A exclusão deve ser tratada por uma operação própria no Supabase.");
assert.match(source, /window\.confirm\(/,
  "A exclusão definitiva deve exigir confirmação explícita.");
assert.match(source, /function bookingThanksMessage\(/,
  "Uma call marcada deve gerar uma mensagem curta de agradecimento.");
assert.match(source, /data-action="copy-booking-thanks"/,
  "A mensagem de agradecimento deve estar disponível diretamente no card.");
assert.match(source, /https:\/\/calendar\.app\.google\/AUvpXz41GDT5hwD36/,
  "O link padrão deve apontar para o Appointment Schedule atual.");
assert.match(source, /Tenho conversado com empresas como a \{Empresa\}/,
  "O rascunho padrão deve usar o novo texto aprovado para a empresa.");
assert.match(source, /replaceAll\("\{Empresa\}"/,
  "Todas as ocorrências da empresa no novo template devem ser personalizadas.");
assert.match(source, /const forceStandardMessage = row\.import_origin\?\.startsWith\("Apollo CSV"\) \|\| row\.import_origin\?\.startsWith\("Banco de leads"\)/,
  "Leads vindos da base Apollo devem usar o último template padrão.");
assert.doesNotMatch(source, /lead\.location \|\| "Em revisao"/,
  "O rodapé não pode manter Em revisão como fallback depois de mudar o estágio.");
assert.match(source, /legacySheetDrafts\[/,
  "Leads legados devem priorizar o rascunho preservado da planilha.");
assert.match(source, /function captureBoardViewport\(/,
  "Atualizacoes de etapa devem preservar a posicao horizontal do Kanban.");
assert.match(source, /restoreBoardViewport\(viewport\)/,
  "Apos atualizar os dados compartilhados, o Kanban deve voltar ao ponto onde o operador estava.");
assert.match(source, /function scheduleRemoteRefresh\(/,
  "O CRM aberto deve buscar silenciosamente atualizacoes externas do Calendar e do n8n.");
assert.match(source, /window\.setInterval\(\(\) => void refreshRemoteData\(\), 15 \* 1000\)/,
  "A sincronizacao visual deve ocorrer em intervalo curto sem exigir reload manual.");
assert.match(source, /scheduleRemoteRefresh\(\)/,
  "O ciclo de atualizacao remota deve iniciar para toda sessao autenticada.");
assert.match(source, /calendar_bookings\(provider_event_id,provider_created_at,starts_at,status,meeting_url,match_status,created_at,updated_at\)/,
  "O CRM deve carregar os campos necessarios para escolher a reserva ativa mais recente.");
assert.match(source, /chooseLatestActiveBooking\(row\.calendar_bookings \|\| \[\]\)/,
  "O CRM deve escolher deterministicamente a ultima reserva ativa.");
assert.match(source, /async function refreshSession\(/,
  "A atualização automática não deve derrubar o operador quando o access token vencer.");
assert.match(source, /return supabaseRequest\(path, options, true\)/,
  "Uma requisição deve ser repetida uma única vez depois da renovação da sessão.");
assert.match(source, /function projectDrawer\(/,
  "Um card de projeto deve abrir o painel de edicao.");
assert.match(source, /#project-edit-form/,
  "O painel de projeto deve salvar correcoes diretamente no CRM.");
assert.match(source, /function notifyDueFollowUps\(/,
  "Follow-ups vencidos ou proximos devem gerar alerta no CRM.");
assert.match(source, /scheduleFollowUpNotifications\(\)/,
  "A verificacao de follow-ups deve continuar ativa durante a sessao.");
assert.doesNotMatch(source, /assigned_to:\s*state\.remote\.session\.user\.id/,
  "O frontend nao pode enviar o criador como destinatario do follow-up.");
assert.match(source, /const owner = responsibleProfile\(entity\?\.responsibleId\)/,
  "A interface deve validar o responsavel atual do card antes de criar o follow-up.");
assert.match(followUpCardResponsibleMigrationSource, /create or replace function public\.assign_follow_up_creator\(\)/,
  "O banco deve resolver o destinatario a partir do card pai.");
assert.match(followUpCardResponsibleMigrationSource, /leads_propagate_responsible_to_follow_ups/,
  "Trocar o responsavel do lead deve atualizar follow-ups ainda pendentes.");
assert.match(source, /data-notification-view="mine"/,
  "O sino deve abrir com uma visualizacao individual.");
assert.match(source, /data-notification-view="team"/,
  "A fila compartilhada deve continuar acessivel no sino.");
assert.match(source, /function canMoveLead\(/,
  "O Kanban deve permitir movimentos de retorno sem liberar saltos para frente.");
assert.match(source, /data-action="new-manual-lead"/,
  "A Base de clientes deve permitir cadastro manual.");
assert.match(source, /\/rest\/v1\/rpc\/create_manual_lead/,
  "O cadastro manual deve ser atomico no banco.");
assert.match(source, /data-action="delete-project"/,
  "O painel de projeto deve permitir exclusao protegida.");
assert.match(source, /\/rest\/v1\/rpc\/delete_commercial_project/,
  "Excluir projeto deve restaurar atomicamente o lead vinculado.");
assert.match(source, /projectValueByStage\(state\.projects, projectStages\)/,
  "O dashboard deve agregar valor real por etapa do pipeline.");
assert.match(followUpOwnershipMigrationSource, /follow_up_email_deliveries/,
  "O banco deve manter uma fila idempotente de notificacoes por e-mail.");
assert.match(followUpOwnershipMigrationSource, /follow_up_email_enabled/,
  "Cada perfil deve controlar sua propria preferencia de e-mail.");
assert.match(source, /import \{ decodeApolloCsv, prepareApolloImport \} from "\.\/apollo-import\.js"/,
  "O CRM deve usar o módulo de importação do Apollo antes de gravar no Supabase.");
assert.match(source, /decodeApolloCsv\(await file\.arrayBuffer\(\)\)/,
  "O CRM deve detectar a codificação do arquivo antes de interpretar nomes com acentos.");
assert.match(importerSource, /export function prepareApolloImport\(/,
  "O módulo de importação deve concentrar o mapeamento e a validação do CSV.");
assert.match(source, /\/rest\/v1\/rpc\/import_named_lead_pool/,
  "Uma lista longa nomeada deve entrar no banco de espera por uma única operação atômica.");
assert.match(source, /\/rest\/v1\/rpc\/release_lead_pool_batch/,
  "A interface deve liberar apenas a quantidade configurada da base escolhida.");
assert.doesNotMatch(source, /for \(const record of report\.records\)/,
  "A interface não deve voltar a fazer várias chamadas ao Supabase por lead.");
assert.match(poolMigrationSource, /'revisao_manual'/,
  "Leads liberados do banco de espera devem entrar na Base de clientes.");
assert.match(poolMigrationSource, /profile_gate_passed[\s\S]*false/,
  "A liberação não pode declarar conexões do LinkedIn como verificadas sem evidência.");
assert.match(poolMigrationSource, /for update skip locked/,
  "A liberação concorrente deve reservar registros do pool sem duplicar cards.");
assert.match(poolMigrationSource, /p_quantity < 1 or v_requested > 100|v_requested < 1 or v_requested > 100/,
  "A quantidade liberada deve permanecer limitada por operação.");

const importReport = prepareApolloImport([
  "First Name;Last Name;Title;Company Name;Person Linkedin Url;# Employees",
  "Ana;Silva;CFO;Empresa Norte;https://www.linkedin.com/in/ana-silva;300",
  "Bia;Souza;Controller;Empresa Norte;https://www.linkedin.com/in/bia-souza;300",
  "Ana;Silva;CFO;Outra Empresa;https://www.linkedin.com/in/ana-silva;500",
].join("\n"), "apollo.csv");
assert.equal(importReport.records.length, 1,
  "A importação deve manter apenas um registro por empresa e por contato dentro do mesmo CSV.");
assert.equal(importReport.duplicateRows.length, 2,
  "Linhas duplicadas no próprio arquivo devem ser excluídas antes do salvamento automático.");
assert.ok(importReport.records[0].extractedAt,
  "O lote deve registrar quando os dados foram extraídos/importados.");

assert.match(bookingLifecycleMigrationSource, /calendar_bookings_lead_active_latest_idx/,
  "O banco deve indexar a consulta da reserva ativa mais recente por lead.");
assert.match(bookingLifecycleMigrationSource, /v_latest_active_booking_id/,
  "O cancelamento deve verificar se ainda existe outra reserva ativa para o lead.");
assert.match(bookingLifecycleMigrationSource, /current_stage = 'agendamento'/,
  "Sem outra reserva ativa, uma call cancelada deve voltar de Call marcada para Agendamento.");

const latestBooking = chooseLatestActiveBooking([
  {
    provider_event_id: "evento-antigo",
    provider_created_at: "2026-07-28T12:00:00Z",
    status: "booked",
    match_status: "matched",
    starts_at: "2026-08-01T13:00:00Z",
    created_at: "2026-07-28T12:00:00Z",
    updated_at: "2026-07-28T12:00:00Z",
  },
  {
    provider_event_id: "evento-novo",
    provider_created_at: "2026-07-28T14:00:00Z",
    status: "booked",
    match_status: "matched",
    starts_at: "2026-08-02T15:00:00Z",
    created_at: "2026-07-28T14:00:00Z",
    updated_at: "2026-07-28T14:00:00Z",
  },
  {
    provider_event_id: "evento-cancelado-por-ultimo",
    provider_created_at: "2026-07-28T16:00:00Z",
    status: "cancelled",
    match_status: "matched",
    starts_at: "2026-08-03T17:00:00Z",
    created_at: "2026-07-28T16:00:00Z",
    updated_at: "2026-07-28T17:00:00Z",
  },
]);
assert.equal(latestBooking?.provider_event_id, "evento-novo",
  "A interface deve ignorar cancelamentos e mostrar a reserva ativa criada mais recentemente.");

assert.equal(chooseLatestActiveBooking([
  {
    provider_event_id: "evento-sem-match",
    provider_created_at: "2026-07-28T18:00:00Z",
    status: "booked",
    match_status: "unmatched",
    starts_at: "2026-08-04T13:00:00Z",
    created_at: "2026-07-28T18:00:00Z",
    updated_at: "2026-07-28T18:00:00Z",
  },
]), null, "Reserva sem correspondencia nao pode aparecer no card de um lead.");

console.log("kanban interaction contract: ok");
