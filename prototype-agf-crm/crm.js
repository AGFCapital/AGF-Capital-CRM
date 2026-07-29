import { legacySheetDrafts } from "./legacy-sheet-drafts.js";
import { decodeApolloCsv, prepareApolloImport } from "./apollo-import.js";
import { chooseLatestActiveBooking } from "./calendar-bookings.js";

const SESSION_KEY = "agf-crm-supabase-session-v1";

const defaultMessage = "{Nome}, tudo bem? Obrigado por aceitar o convite.\n\nTenho conversado com empresas como a {Empresa} sobre como aplicar inteligência artificial no financeiro de forma prática, sem transformar a iniciativa em um projeto longo, complexo e distante da operação.\n\nMontei a AGF exatamente com esse propósito. Contamos com profissionais vindos das principais consultorias do Brasil, que atuam diretamente no dia a dia das empresas, do operacional ao estratégico, identificando oportunidades e desenvolvendo automações ao longo do processo.\n\nEu venho de mais de 10 anos entre banking e corporate development e também fundei uma empresa na qual captei recursos com investidores institucionais.\n\nTopa uma conversa de 15 a 30 minutos para eu me apresentar e entender melhor o momento da {Empresa}?";
const inviteNoteTemplate = "{Nome}, tudo bem? Tenho conversado com empresas como a {Empresa} sobre como aplicar IA no financeiro de forma prática. Achei que faria sentido nos conectarmos por aqui.";
const schedulingTemplate = "Perfeito, {Nome}. Para facilitar, deixei alguns horarios livres na minha agenda aqui: {link}. Se nenhum fizer sentido, me avise que buscamos outro.";
const bookingThanksTemplate = "Perfeito, {Nome}. Obrigado por agendar. Nossa conversa ficou marcada para {data_hora}. Até lá!";
const defaultBookingUrl = "https://calendar.app.google/AUvpXz41GDT5hwD36";
const MESSAGE_TEMPLATE_EFFECTIVE_AT = "2026-07-28T15:58:55-03:00";

const stageNames = {
  revisao_manual: "Base de clientes",
  qualificado: "Base de clientes",
  aprovado: "Enviar convite",
  convite_enviado: "Convite pendente",
  conexao_aceita: "Conexao aceita",
  mensagem_enviada: "Mensagem enviada",
  em_conversa: "Em conversa",
  agendamento: "Agendamento",
  call_marcada: "Call marcada",
  concluido: "Encerrado",
  convite_expirado: "Ja prospectado",
  descartado: "Descartado",
};

const boardColumns = [
  { key: "base", label: "Base de clientes", stages: ["revisao_manual", "qualificado"] },
  { key: "invite", label: "Enviar convite", stages: ["aprovado"] },
  { key: "pending", label: "Convite pendente", stages: ["convite_enviado"] },
  { key: "accepted", label: "Conexao aceita", stages: ["conexao_aceita"] },
  { key: "message", label: "Mensagem enviada", stages: ["mensagem_enviada"] },
  { key: "conversation", label: "Em conversa", stages: ["em_conversa"] },
  { key: "scheduling", label: "Agendamento", stages: ["agendamento"] },
  { key: "booked", label: "Call marcada", stages: ["call_marcada"] },
  { key: "create-project", label: "Criar projeto", stages: [] },
  { key: "discarded", label: "Descartado", stages: ["descartado"] },
];

const projectStages = [
  ["pos_call", "Pos-call"], ["proposta", "Proposta"], ["negociacao", "Negociacao"],
  ["projeto", "Projeto"], ["ganho", "Ganho"], ["perdido", "Perdido"],
];
const projectStageNames = Object.fromEntries(projectStages);
const validTargets = {
  revisao_manual: ["aprovado", "descartado"],
  qualificado: ["aprovado", "descartado"],
  aprovado: ["convite_enviado", "descartado"],
  convite_enviado: ["conexao_aceita", "descartado"],
  conexao_aceita: ["mensagem_enviada", "descartado"],
  mensagem_enviada: ["em_conversa", "descartado"],
  em_conversa: ["agendamento", "descartado"],
  agendamento: ["call_marcada", "descartado"],
  call_marcada: ["concluido", "descartado"],
};
const stageDropTargets = {
  invite: "aprovado",
  pending: "convite_enviado",
  accepted: "conexao_aceita",
  message: "mensagem_enviada",
  conversation: "em_conversa",
  scheduling: "agendamento",
  booked: "call_marcada",
  discarded: "descartado",
};

const state = {
  leads: [], projects: [], settings: { bookingUrl: "", timezone: "America/Sao_Paulo", callDuration: 30, slotInterval: 15 },
  leadPool: { available: 0, released: 0, duplicates: 0, discarded: 0, default_release_quantity: 20, recent_batches: [] },
  selectedId: null, selectedProjectId: null, page: "operation", draggedId: null, draggedProjectId: null,
  settingsOpen: false, projectModal: null, followUpLeadId: null, importModal: null, followUpNotificationTimer: null, lastFollowUpAlertKey: "",
  remoteRefreshTimer: null, remoteRefreshInFlight: false,
  remote: { config: null, session: readSession(), enabled: false, loading: true, error: null },
};
const root = document.querySelector("#app");

function readSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function writeSession(session) { state.remote.session = session; if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); else localStorage.removeItem(SESSION_KEY); }
function escapeHtml(value = "") { return String(value).replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char])); }
function leadById(id) { return state.leads.find((lead) => lead.id === id); }
function projectById(id) { return state.projects.find((project) => project.id === id); }
function scoreClass(score) { return score >= 7 ? "high" : score >= 5 ? "medium" : "low"; }
function sourceClass(source) { return source === "Vagas" ? "vacancy" : source === "Manual" || source === "Apollo" ? "manual" : "middle"; }
function humanDate(value, withTime = true) { if (!value) return "--"; return new Intl.DateTimeFormat("pt-BR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(new Date(value)); }
function firstName(name = "") { return name.trim().split(/\s+/)[0] || ""; }
function legacyIdFromOrigin(value = "") { return String(value).match(/legacy_id="([^"]+)"/)?.[1] || ""; }
function bookingLink() { return state.settings.bookingUrl || "[link da agenda ainda nao configurado]"; }
function inviteNoteMessage(lead) { return inviteNoteTemplate.replace("{Nome}", firstName(lead.contact)).replace("{Empresa}", lead.company || "sua empresa"); }
function schedulingMessage(lead) { return schedulingTemplate.replace("{Nome}", firstName(lead.contact)).replace("{link}", bookingLink()); }
function bookingThanksMessage(lead) { return bookingThanksTemplate.replace("{Nome}", firstName(lead.contact)).replace("{data_hora}", lead.meeting || "o horário escolhido"); }
function standardMessageFor(company, contact) { return defaultMessage.replace("{Nome}", firstName(contact?.full_name)).replaceAll("{Empresa}", company?.name || "sua empresa"); }

async function fetchConfiguration() {
  const response = await fetch("/api/config", { cache: "no-store" });
  if (!response.ok) throw new Error("Nao foi possivel carregar a configuracao local.");
  return response.json();
}
function isRemoteConfigured() { return Boolean(state.remote.config?.supabaseUrl && state.remote.config?.supabasePublishableKey); }
async function refreshSession() {
  const refreshToken = state.remote.session?.refresh_token;
  if (!refreshToken) return null;
  const { supabaseUrl, supabasePublishableKey } = state.remote.config;
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: supabasePublishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return null;
  const session = await response.json();
  writeSession(session);
  return session;
}
async function supabaseRequest(path, options = {}, retriedAfterRefresh = false) {
  const { supabaseUrl, supabasePublishableKey } = state.remote.config;
  const headers = new Headers(options.headers || {});
  headers.set("apikey", supabasePublishableKey); headers.set("Content-Type", "application/json");
  if (state.remote.session?.access_token) headers.set("Authorization", `Bearer ${state.remote.session.access_token}`);
  const response = await fetch(`${supabaseUrl}${path}`, { ...options, headers });
  if ((response.status === 401 || response.status === 403) && !retriedAfterRefresh && await refreshSession()) return supabaseRequest(path, options, true);
  if (response.status === 401 || response.status === 403) { writeSession(null); throw new Error("Sua sessao expirou. Entre novamente."); }
  const body = await response.text();
  if (!response.ok) throw new Error(body || "A operacao no Supabase nao foi concluida.");
  return body ? JSON.parse(body) : null;
}
async function signIn(email, password) {
  const { supabaseUrl, supabasePublishableKey } = state.remote.config;
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: supabasePublishableKey, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!response.ok) throw new Error("E-mail ou senha invalidos.");
  writeSession(await response.json());
}

function messageFor(row, company, contact, signals) {
  const drafts = row.message_drafts || [];
  const currentDraft = drafts.find((draft) => draft.is_current) || drafts[0];
  const forceStandardMessage = row.import_origin?.startsWith("Apollo CSV") || row.import_origin?.startsWith("Banco de leads");
  const draftUsesCurrentTemplate = currentDraft?.updated_at && new Date(currentDraft.updated_at) >= new Date(MESSAGE_TEMPLATE_EFFECTIVE_AT);
  if (currentDraft?.body && (!forceStandardMessage || draftUsesCurrentTemplate)) return currentDraft.body;
  if (forceStandardMessage) return standardMessageFor(company, contact);
  const legacyDraft = legacySheetDrafts[legacyIdFromOrigin(row.import_origin)];
  if (legacyDraft) return legacyDraft;
  return standardMessageFor(company, contact);
}
function mapRemoteLead(row) {
  const company = row.company || {}; const contact = row.contact || {};
  const signals = (row.lead_signals || []).filter((signal) => signal.source_url && signal.verified_at).sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  const booking = chooseLatestActiveBooking(row.calendar_bookings || []);
  const draft = (row.message_drafts || []).find((item) => item.is_current) || (row.message_drafts || [])[0];
  return {
    id: row.id, companyId: company.id, company: company.name || "Empresa sem nome", contact: contact.full_name || "Contato a identificar", role: contact.title || "Cargo a identificar",
    source: row.import_origin?.startsWith("Apollo CSV") || row.import_origin?.startsWith("Banco de leads") ? "Apollo" : row.source === "vacancy" ? "Vagas" : row.source === "manual_referral" ? "Manual" : "Middle market", stage: row.current_stage, score: row.total_score || 0,
    scoreBreakdown: { companySize: row.company_size_score || 0, urgency: row.urgency_score, financialMoment: row.financial_moment_score, decisionMaker: row.decision_maker_score || 0, realEconomy: row.real_economy_bonus || 0 },
    trigger: signals[0]?.summary || "Gatilho ainda nao definido", news: signals.length ? signals.map((signal) => `${signal.summary} (${signal.source_name})`).join(" | ") : "Sem noticia ou sinal verificado.", signals,
    profile: contact.profile_gate_passed ? `${contact.location_country || "Brasil"} | ${contact.connection_count || "+100"} conexoes | perfil contatavel` : (contact.profile_gate_reason || "Perfil pendente de validacao"),
    realEconomy: company.real_economy, location: [company.headquarters_city, company.headquarters_state].filter(Boolean).join(", "), linkedinUrl: contact.linkedin_url,
    message: messageFor(row, company, contact, signals), messageDraftId: draft?.id || null,
    meeting: booking?.starts_at ? humanDate(booking.starts_at) : null, meetingUrl: booking?.meeting_url || null,
    history: (row.lead_activities || []).map((item) => `${humanDate(item.created_at)} — ${item.summary}`),
    followUps: (row.lead_follow_ups || []).sort((a, b) => new Date(a.due_at) - new Date(b.due_at)),
  };
}
function mapProject(row) { return { ...row, currentStage: row.current_stage }; }
function settingsFromRows(rows) {
  const value = rows.find((row) => row.setting_key === "calendar_booking")?.value || {};
  return { bookingUrl: value.booking_url || defaultBookingUrl, timezone: value.timezone || "America/Sao_Paulo", callDuration: value.duration_minutes || 30, slotInterval: value.slot_minutes || 15 };
}
// Apollo parsing and file-only de-duplication live in apollo-import.js.
function dueFollowUps() {
  const now = Date.now();
  const nextDay = now + (24 * 60 * 60 * 1000);
  return state.leads.flatMap((lead) => lead.followUps.filter((item) => item.status === "open" && new Date(item.due_at).getTime() <= nextDay).map((item) => ({ ...item, lead, overdue: new Date(item.due_at).getTime() < now })));
}
function notifyDueFollowUps() {
  if (!state.remote.session?.access_token) return;
  const alerts = dueFollowUps();
  const alertKey = alerts.map((item) => `${item.id}:${item.due_at}`).sort().join("|");
  if (!alerts.length || alertKey === state.lastFollowUpAlertKey) return;
  state.lastFollowUpAlertKey = alertKey;
  const overdue = alerts.filter((item) => item.overdue).length;
  toast(overdue ? `${overdue} follow-up${overdue === 1 ? " vencido" : "s vencidos"}. Abra a fila de Follow-ups.` : `${alerts.length} follow-up${alerts.length === 1 ? " vence" : "s vencem"} nas proximas 24 horas.`);
}
function scheduleFollowUpNotifications() {
  if (state.followUpNotificationTimer) return;
  state.followUpNotificationTimer = window.setInterval(notifyDueFollowUps, 60 * 1000);
}
async function loadRemoteData() {
  const leadQuery = "/rest/v1/leads?select=id,current_stage,total_score,company_size_score,urgency_score,financial_moment_score,decision_maker_score,real_economy_bonus,source,import_origin,company_overview,contact_context,company:companies(id,name,headquarters_city,headquarters_state,real_economy),contact:contacts(full_name,title,linkedin_url,profile_gate_passed,profile_gate_reason,connection_count,location_country),lead_signals(summary,family,source_url,source_name,published_at,occurred_at,verified_at,verification_method),message_drafts(id,body,is_current,updated_at),calendar_bookings(provider_event_id,provider_created_at,starts_at,status,meeting_url,match_status,created_at,updated_at),lead_activities(summary,created_at),lead_follow_ups(id,due_at,note,status,completed_at)&order=created_at.desc";
  const [leadRows, projectRows, settingRows, leadPool] = await Promise.all([
    supabaseRequest(leadQuery),
    supabaseRequest("/rest/v1/commercial_projects?select=*&order=updated_at.desc"),
    supabaseRequest("/rest/v1/app_settings?select=setting_key,value"),
    supabaseRequest("/rest/v1/rpc/lead_pool_dashboard", { method: "POST", body: "{}" }),
  ]);
  state.leads = leadRows.map(mapRemoteLead);
  state.projects = projectRows.map(mapProject);
  state.settings = settingsFromRows(settingRows);
  state.leadPool = leadPool || state.leadPool;
}

function operatorName() {
  const email = state.remote.session?.user?.email; if (!email) return "Operador AGF";
  return email.split("@")[0].split(/[._-]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
function loginPage() { return `<main class="login-page"><section class="login-intro"><div class="login-brand"><div class="brand-mark">A</div><div><strong>AGF</strong><span>Capital</span></div></div><div class="login-copy"><p class="eyebrow">OPERACAO COMERCIAL</p><h1>Uma base. Uma visao clara do proximo movimento.</h1><p>O CRM organiza os leads ja cadastrados, as conversas e os projetos em uma operacao compartilhada.</p></div><div class="login-signal-card"><div><span class="signal-dot"></span><small>SISTEMA PRONTO</small></div><strong>Operacao manual assistida</strong><p>O CRM nao extrai nem envia pelo LinkedIn. Ele deixa cada acao humana pronta, rastreavel e organizada.</p><div class="signal-steps"><span>Base</span><i></i><span>Conversa</span><i></i><span>Call</span><i></i><span>Projeto</span></div></div><p class="login-footnote">Base compartilhada: todos veem os mesmos leads, follow-ups e projetos.</p></section><section class="login-panel"><div class="login-card"><p class="eyebrow">ACESSO RESTRITO</p><h2>Entre na operacao.</h2><p>Use o e-mail e a senha cadastrados para sua equipe.</p><form id="login-form"><label>E-mail<input type="email" name="email" autocomplete="email" placeholder="nome@agfcapital.com.br" required></label><label>Senha<input type="password" name="password" autocomplete="current-password" placeholder="Sua senha" required></label><button class="button primary" type="submit">Entrar no CRM <span>→</span></button></form><div class="login-security"><b>Ambiente protegido</b><span>O acesso controla permissao; nao cria bases ou pipelines separados.</span></div></div></section></main>`; }
function appShell(content) { return `<div class="crm-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">A</div><div><strong>AGF</strong><span>Capital</span></div></div><nav><button data-page="operation" class="nav-item ${state.page === "operation" ? "active" : ""}"><span>01</span> Base de clientes</button><button data-page="followups" class="nav-item ${state.page === "followups" ? "active" : ""}"><span>02</span> Follow-ups <b>${state.leads.flatMap((lead) => lead.followUps).filter((item) => item.status === "open").length}</b></button><button data-page="agenda" class="nav-item ${state.page === "agenda" ? "active" : ""}"><span>03</span> Agendamentos <b>${state.leads.filter((lead) => lead.stage === "call_marcada").length}</b></button><button data-page="projects" class="nav-item ${state.page === "projects" ? "active" : ""}"><span>04</span> Projetos <b>${state.projects.filter((project) => !["ganho", "perdido"].includes(project.currentStage)).length}</b></button><button data-page="history" class="nav-item ${state.page === "history" ? "active" : ""}"><span>05</span> Base completa</button></nav><div class="sidebar-bottom"><button data-action="settings" class="settings-button">Configuracoes</button><button data-action="logout" class="settings-button">Sair</button><div class="operator"><div class="avatar">${operatorName().split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><strong>${operatorName()}</strong><span>Base compartilhada</span></div></div></div></aside><section class="workspace">${content}</section></div>`; }
function header(eyebrow, title, description, actions = "") { return `<header class="page-header"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div><div class="header-actions">${actions}</div></header>`; }
function metrics() { const openFollowUps = state.leads.flatMap((lead) => lead.followUps).filter((item) => item.status === "open"); const conversations = state.leads.filter((lead) => lead.stage === "em_conversa").length; const booked = state.leads.find((lead) => lead.stage === "call_marcada"); return `<section class="metrics"><div><span>Follow-ups abertos</span><strong>${openFollowUps.length}</strong><small>${openFollowUps.filter((item) => new Date(item.due_at) < new Date()).length} vencidos</small></div><div><span>Convites pendentes</span><strong>${state.leads.filter((lead) => lead.stage === "convite_enviado").length}</strong><small>Aceite confirmado manualmente</small></div><div><span>Em conversa</span><strong>${conversations}</strong><small>Acao humana necessaria</small></div><div class="accent"><span>Proxima call</span><strong>${booked?.meeting || "--"}</strong><small>${booked?.company || "Nenhuma call marcada"}</small></div></section>`; }
function cardActions(lead) {
  const button = (action, label, tone = "primary") => `<button class="card-action ${tone}" data-action="${action}" data-lead="${lead.id}">${label}</button>`;
  if (["revisao_manual", "qualificado"].includes(lead.stage)) return button("move-to-invite", "Enviar convite");
  if (lead.stage === "aprovado") return `${button("copy-invite-note", "Copiar nota", "secondary")}${button("invite-sent", "Convite enviado")}`;
  if (lead.stage === "convite_enviado") return button("connection-accepted", "Confirmar aceite");
  if (lead.stage === "conexao_aceita") return `${button("copy-message", "Copiar mensagem", "secondary")}${button("message-sent", "Mensagem enviada")}`;
  if (lead.stage === "mensagem_enviada") return button("response-received", "Recebi resposta");
  if (lead.stage === "em_conversa") return button("move-to-scheduling", "Ir para agendamento");
  if (lead.stage === "agendamento") return button("copy-scheduling", "Copiar mensagem de agenda", "secondary");
  if (lead.stage === "call_marcada") return `${button("copy-booking-thanks", "Copiar agradecimento", "secondary")}${button("create-project-now", "Criar projeto")}`;
  return "";
}
function card(lead) { const due = lead.followUps.find((item) => item.status === "open"); const actions = cardActions(lead); return `<article class="lead-card" draggable="true" data-lead="${lead.id}" tabindex="0"><div class="card-top"><span class="badge ${sourceClass(lead.source)}">${lead.source}</span><span class="score ${scoreClass(lead.score)}">${lead.score}/10</span></div><h3>${escapeHtml(lead.company)}</h3><p class="contact">${escapeHtml(lead.contact)}<span>${escapeHtml(lead.role)}</span></p>${lead.meeting ? `<p class="meeting">${lead.meeting}</p>` : ""}${due ? `<p class="followup-chip">Follow-up: ${humanDate(due.due_at)}</p>` : ""}${actions ? `<div class="card-actions">${actions}</div>` : ""}<footer><span class="card-stage">${stageNames[lead.stage]}</span>${lead.linkedinUrl ? `<button class="card-linkedin" data-action="open-linkedin" data-lead="${lead.id}">LinkedIn ↗</button>` : ""}</footer></article>`; }
function emptyStage(column) { const messages = { base: "Leads cadastrados aguardam a proxima acao.", invite: "Abra o perfil, envie o convite e registre o envio.", pending: "Aguarde o aceite ou atualize manualmente.", accepted: "A mensagem longa esta pronta para copiar e editar.", message: "Registre quando houver resposta.", conversation: "Leads com conversa ativa.", scheduling: "Envie manualmente o link da agenda.", booked: "Reservas do Calendar aparecem aqui.", "create-project": "Arraste para ca uma call com interesse. O card vira um projeto em Pos-call.", discarded: "Leads descartados com motivo." }; return `<div class="empty-state">${messages[column] || "Sem cards nesta etapa."}</div>`; }
function operationPage() { const board = boardColumns.map((column) => { const items = state.leads.filter((lead) => column.stages.includes(lead.stage)); return `<section class="kanban-column" data-column="${column.key}" data-target="${stageDropTargets[column.key] || ""}"><header><h2>${column.label}</h2><span>${items.length}</span></header><div class="cards">${items.map(card).join("") || emptyStage(column.key)}</div></section>`; }).join(""); return appShell(`${header("OPERAÇÃO COMERCIAL", "Base de clientes", "Arraste o card para registrar a próxima ação ou abra-o para revisar o contexto.", `<button class="button primary" data-action="import-csv">Banco de leads <span class="button-count">${state.leadPool.available || 0}</span></button><button class="button secondary" data-action="settings">Configurar agenda</button>`) }${metrics()}<div class="board-caption"><span>O Kanban é horizontal; cada coluna mantém sua própria rolagem de cards.</span><div><span class="status-dot"></span> LinkedIn operado manualmente</div></div><div class="kanban-scroll"><div class="kanban">${board}</div></div>${drawOverlays()}`); }
function stageAction(lead) {
  if (["revisao_manual", "qualificado"].includes(lead.stage)) return `<button class="button primary" data-action="move-to-invite" data-lead="${lead.id}">Mover para Enviar convite</button>`;
  if (lead.stage === "aprovado") return `<div class="manual-action"><p>Copie a nota, abra o perfil, envie o convite manualmente e volte para registrar.</p><button class="button secondary" data-action="copy-invite-note" data-lead="${lead.id}">Copiar nota</button><button class="button secondary" data-action="open-linkedin" data-lead="${lead.id}">Abrir perfil</button><button class="button primary" data-action="invite-sent" data-lead="${lead.id}">Enviei o convite</button></div>`;
  if (lead.stage === "convite_enviado") return `<div class="manual-action"><p>Quando vir o aceite no LinkedIn, registre-o aqui.</p><button class="button primary" data-action="connection-accepted" data-lead="${lead.id}">Confirmar aceite</button></div>`;
  if (lead.stage === "conexao_aceita") return `<div class="manual-action"><p>Depois de enviar a mensagem manualmente no LinkedIn, registre o envio.</p><button class="button secondary" data-action="open-linkedin" data-lead="${lead.id}">Abrir perfil</button><button class="button primary" data-action="message-sent" data-lead="${lead.id}">Enviei a mensagem</button></div>`;
  if (lead.stage === "mensagem_enviada") return `<div class="manual-action"><p>Ao receber uma resposta, mova o lead para a conversa.</p><button class="button primary" data-action="response-received" data-lead="${lead.id}">Recebi uma resposta</button></div>`;
  if (lead.stage === "em_conversa") return `<div class="manual-action"><p>Quando houver abertura para uma call, entregue o link da agenda.</p><button class="button primary" data-action="move-to-scheduling" data-lead="${lead.id}">Ir para Agendamento</button></div>`;
  if (lead.stage === "agendamento") return `<div class="manual-action"><p>Copie a mensagem, envie-a no LinkedIn e aguarde a reserva detectada pelo Calendar.</p><button class="button secondary" data-action="copy-scheduling" data-lead="${lead.id}">Copiar mensagem de agenda</button></div>`;
  if (lead.stage === "call_marcada") return `<div class="manual-action"><p>Envie o agradecimento e, se houver interesse comercial, leve o card para Projetos.</p><button class="button secondary" data-action="copy-booking-thanks" data-lead="${lead.id}">Copiar agradecimento</button><button class="button secondary" data-action="create-project-now" data-lead="${lead.id}">Criar projeto</button><button class="button primary" data-action="discard-lead" data-lead="${lead.id}">Descartar lead</button></div>`;
  return "";
}
function leadDrawer(lead) { if (!lead) return ""; const isVacancy = lead.source === "Vagas"; const breakdown = lead.scoreBreakdown; const scores = isVacancy ? [["Porte", `${breakdown.companySize}/3`], ["Urgencia", `${breakdown.urgency || 0}/3`], ["Decisor", `${breakdown.decisionMaker}/2`], ["Economia real", `${breakdown.realEconomy}/2`]] : [["Porte", `${breakdown.companySize}/3`], ["Momento financeiro", `${breakdown.financialMoment || 0}/3`], ["Decisor", `${breakdown.decisionMaker}/2`], ["Economia real", `${breakdown.realEconomy}/2`]]; const openFollowUps = lead.followUps.filter((item) => item.status === "open"); return `<div class="backdrop" data-action="close-detail"></div><aside class="lead-drawer" role="dialog" aria-label="Detalhes de ${escapeHtml(lead.company)}"><header><span class="badge ${sourceClass(lead.source)}">${lead.source}</span><button data-action="close-detail" aria-label="Fechar">×</button></header><p class="eyebrow">${stageNames[lead.stage]}</p><h2>${escapeHtml(lead.company)}</h2><p class="drawer-contact">${escapeHtml(lead.contact)} | ${escapeHtml(lead.role)}</p><button class="text-link" data-action="open-linkedin" data-lead="${lead.id}">Abrir perfil do LinkedIn</button><div class="profile-gate"><strong>Perfil</strong><span>${escapeHtml(lead.profile)}</span></div><div class="score-breakdown"><div><span>Score comercial</span><strong>${lead.score}<small>/10</small></strong></div><ul>${scores.map(([name, value]) => `<li>${name}<b>${value}</b></li>`).join("")}</ul></div><section><h3>Gatilho e contexto</h3><p>${escapeHtml(lead.trigger)}</p><p class="muted-copy">${escapeHtml(lead.news)}</p></section>${lead.stage === "aprovado" ? `<section><h3>Nota do convite</h3><pre>${escapeHtml(inviteNoteMessage(lead))}</pre><button class="text-link" data-action="copy-invite-note" data-lead="${lead.id}">Copiar nota</button></section>` : ""}${lead.stage === "conexao_aceita" ? `<section><h3>Mensagem para LinkedIn</h3><textarea id="message-draft" aria-label="Rascunho de mensagem">${escapeHtml(lead.message)}</textarea><button class="text-link" data-action="save-message" data-lead="${lead.id}">Salvar rascunho</button> <button class="text-link" data-action="copy-message" data-lead="${lead.id}">Copiar mensagem</button></section>` : ""}${lead.stage === "agendamento" ? `<section><h3>Mensagem de agendamento</h3><pre>${escapeHtml(schedulingMessage(lead))}</pre>${state.settings.bookingUrl ? "" : `<p class="warning-copy">O link da agenda ainda nao foi configurado.</p>`}</section>` : ""}${lead.stage === "call_marcada" ? `<section><h3>Mensagem de agradecimento</h3><pre>${escapeHtml(bookingThanksMessage(lead))}</pre><button class="text-link" data-action="copy-booking-thanks" data-lead="${lead.id}">Copiar agradecimento</button></section>` : ""}${lead.meeting ? `<div class="calendar-block"><strong>${lead.meeting}</strong><span>${lead.meetingUrl ? "Meet disponivel no Calendar" : "Reserva confirmada pelo Calendar"}</span></div>` : ""}<section><div class="section-heading"><h3>Follow-ups</h3><button class="text-link" data-action="new-followup" data-lead="${lead.id}">Adicionar</button></div>${openFollowUps.length ? `<ul class="followup-list">${openFollowUps.map((item) => `<li><span><b>${humanDate(item.due_at)}</b>${escapeHtml(item.note)}</span><button data-action="complete-followup" data-followup="${item.id}">Concluir</button></li>`).join("")}</ul>` : `<p class="muted-copy">Nenhum lembrete aberto.</p>`}</section><section><h3>Historico</h3><ul class="history-list">${lead.history.length ? lead.history.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>Sem movimentacoes registradas.</li>"}</ul></section><footer><button class="button secondary" data-action="close-detail">Fechar</button>${stageAction(lead)}<button class="button danger" data-action="delete-lead" data-lead="${lead.id}">Apagar card</button></footer></aside>`; }
function settingsModal() { return `<div class="backdrop" data-action="close-settings"></div><section class="settings-modal" role="dialog" aria-label="Configuracoes"><header><div><p class="eyebrow">CONFIGURACOES</p><h2>Agenda e operacao manual</h2><p>Estas configuracoes nao controlam descoberta ou extracao de leads.</p></div><button data-action="close-settings" aria-label="Fechar">×</button></header><form id="settings-form"><section><div><h3>Link da agenda</h3><p>O CRM coloca este link na mensagem copiada para o lead. A reserva, Meet e confirmacao continuam no Google Calendar.</p></div><div class="field-grid single-wide"><label>Link publico da agenda<input name="bookingUrl" type="url" value="${escapeHtml(state.settings.bookingUrl)}" placeholder="https://calendar.app.google/..." required></label><label>Fuso horario<input value="${state.settings.timezone}" readonly></label><label>Duracao<input value="${state.settings.callDuration} min" readonly></label><label>Slots<input value="a cada ${state.settings.slotInterval} min" readonly></label></div></section><section><div><h3>Lembretes</h3><p>Follow-ups sao criados por data e hora no card. Esta versao mostra a fila compartilhada dentro do CRM.</p></div></section><footer><button type="button" class="button secondary" data-action="close-settings">Cancelar</button><button type="submit" class="button primary">Salvar configuracoes</button></footer></form></section>`; }
function agendaPage() { const bookings = state.leads.filter((lead) => lead.stage === "call_marcada"); return appShell(`${header("AGENDA", "Calls confirmadas", "Quando a agenda receber uma reserva, o workflow do Calendar atualizara este card automaticamente.", `<button class="button secondary" data-action="settings">Configurar link da agenda</button>`)}<section class="agenda-list">${bookings.length ? bookings.map((lead) => `<button class="agenda-row" data-lead="${lead.id}"><span class="agenda-time">${lead.meeting || "Horario pendente"}</span><div><strong>${escapeHtml(lead.company)}</strong><small>${escapeHtml(lead.contact)} | ${escapeHtml(lead.role)}</small></div><span>Ver card</span></button>`).join("") : `<div class="empty-page">Nenhuma call marcada.</div>`}</section>${drawOverlays()}`); }
function followUpsPage() { const items = state.leads.flatMap((lead) => lead.followUps.filter((item) => item.status === "open").map((item) => ({ ...item, lead }))).sort((a, b) => new Date(a.due_at) - new Date(b.due_at)); return appShell(`${header("FOLLOW-UPS", "Proximas acoes", "Lembretes compartilhados por data e hora, sem depender da extracao de leads.")}<section class="agenda-list">${items.length ? items.map((item) => `<button class="agenda-row" data-lead="${item.lead.id}"><span class="agenda-time">${humanDate(item.due_at)}</span><div><strong>${escapeHtml(item.lead.company)}</strong><small>${escapeHtml(item.note)}</small></div><span>Ver card</span></button>`).join("") : `<div class="empty-page">Nenhum follow-up aberto.</div>`}</section>${drawOverlays()}`); }
function projectCard(project) { return `<article class="project-card" draggable="true" data-project="${project.id}" tabindex="0"><p class="eyebrow">${projectStageNames[project.currentStage]}</p><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.company_name)}</p><small>${escapeHtml(project.responsible_name)}</small><footer>${project.next_action_at ? `${humanDate(project.next_action_at, false)} · ${escapeHtml(project.next_action || "Proxima acao")}` : "Sem proxima acao"}<span>Abrir</span></footer></article>`; }
function projectsPage() { const board = projectStages.map(([key, label]) => { const items = state.projects.filter((project) => project.currentStage === key); return `<section class="project-column" data-project-stage="${key}"><header><h2>${label}</h2><span>${items.length}</span></header><div class="project-cards">${items.map(projectCard).join("") || `<div class="empty-state">Sem projetos nesta etapa.</div>`}</div></section>`; }).join(""); return appShell(`${header("PIPELINE COMERCIAL", "Projetos sob gestao", "Crie projetos manualmente ou a partir de uma call marcada.", `<button class="button primary" data-action="new-project">Novo projeto</button>`)}<div class="project-scroll"><div class="project-kanban">${board}</div></div>${drawOverlays()}`); }
function projectModal(lead) { const company = lead?.company || ""; return `<div class="backdrop" data-action="close-project-modal"></div><section class="project-modal" role="dialog" aria-label="Novo projeto"><header><div><p class="eyebrow">PIPELINE COMERCIAL</p><h2>${lead ? "Criar projeto da call" : "Novo projeto"}</h2><p>Projetos podem existir sem terem passado pela base de leads.</p></div><button data-action="close-project-modal">×</button></header><form id="project-form"><input type="hidden" name="leadId" value="${lead?.id || ""}"><input type="hidden" name="companyId" value="${lead?.companyId || ""}"><div class="form-grid"><label>Nome do projeto<input name="name" required placeholder="Ex.: Automacao financeira"></label><label>Empresa<input name="companyName" required value="${escapeHtml(company)}"></label><label>Responsavel<input name="responsibleName" required value="${escapeHtml(operatorName())}"></label><label>Etapa<select name="stage">${projectStages.map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></label><label>Proxima acao<input name="nextAction" placeholder="Ex.: enviar proposta"></label><label>Data da proxima acao<input name="nextActionAt" type="datetime-local"></label><label>Valor estimado (opcional)<input name="estimatedValue" type="number" min="0" step="0.01" placeholder="0,00"></label></div><label>Descricao<textarea name="description" required placeholder="Escopo e contexto do projeto"></textarea></label><label>Observacoes<textarea name="notes" placeholder="Observacoes internas"></textarea></label><footer><button type="button" class="button secondary" data-action="close-project-modal">Cancelar</button><button type="submit" class="button primary">Criar projeto</button></footer></form></section>`; }
function datetimeLocalValue(value) { return value ? new Date(value).toISOString().slice(0, 16) : ""; }
function projectDrawer(project) { if (!project) return ""; return `<div class="backdrop" data-action="close-project-detail"></div><aside class="lead-drawer project-drawer" role="dialog" aria-label="Editar projeto ${escapeHtml(project.name)}"><header><div><p class="eyebrow">${projectStageNames[project.currentStage]}</p><h2>${escapeHtml(project.name)}</h2><p class="drawer-contact">${escapeHtml(project.company_name)}</p></div><button data-action="close-project-detail" aria-label="Fechar">×</button></header><form id="project-edit-form"><input type="hidden" name="projectId" value="${project.id}"><div class="form-grid"><label>Nome do projeto<input name="name" required value="${escapeHtml(project.name)}"></label><label>Empresa<input name="companyName" required value="${escapeHtml(project.company_name)}"></label><label>Responsavel<input name="responsibleName" required value="${escapeHtml(project.responsible_name)}"></label><label>Etapa<select name="stage">${projectStages.map(([key, label]) => `<option value="${key}" ${project.currentStage === key ? "selected" : ""}>${label}</option>`).join("")}</select></label><label>Proxima acao<input name="nextAction" value="${escapeHtml(project.next_action || "")}" placeholder="Ex.: enviar proposta"></label><label>Data da proxima acao<input name="nextActionAt" type="datetime-local" value="${datetimeLocalValue(project.next_action_at)}"></label><label>Valor estimado (opcional)<input name="estimatedValue" type="number" min="0" step="0.01" value="${project.estimated_value ?? ""}"></label></div><section><h3>Descricao</h3><textarea name="description" required>${escapeHtml(project.description || "")}</textarea></section><section><h3>Observacoes internas</h3><textarea name="notes">${escapeHtml(project.notes || "")}</textarea></section><footer><button type="button" class="button secondary" data-action="close-project-detail">Cancelar</button><button type="submit" class="button primary">Salvar alteracoes</button></footer></form></aside>`; }
function importProblemList(items = []) {
  if (!items.length) return "";
  const preview = items.slice(0, 3);
  return `<ul class="import-problem-list">${preview.map((item) => `<li>Linha ${item.row}: ${escapeHtml(item.reason)}</li>`).join("")}${items.length > preview.length ? `<li>e mais ${items.length - preview.length} linha(s).</li>` : ""}</ul>`;
}

function importCsvModal() {
  const view = state.importModal || {};
  const report = view.report;
  const result = view.result;
  const releaseResult = view.releaseResult;
  const pool = state.leadPool || {};
  const blocked = report && !report.records.length;
  const excluded = report ? report.invalidRows.length + report.duplicateRows.length : 0;
  const busy = ["reading", "importing", "releasing"].includes(view.status);
  const statusCopy = view.status === "reading"
    ? "Lendo e validando o arquivo…"
    : view.status === "importing"
      ? `Guardando ${report.records.length} lead(s) no banco de espera…`
      : "Liberando os próximos leads para o Kanban…";
  const recentBatches = (pool.recent_batches || []).slice(0, 3);
  return `<div class="backdrop" data-action="close-import-csv"></div><section class="small-modal import-modal lead-pool-modal" role="dialog" aria-label="Banco de leads"><header><div><p class="eyebrow">BANCO DE LEADS</p><h2>Entrada gradual no CRM</h2><p>Importe uma lista longa uma única vez e libere apenas o volume que a equipe deseja trabalhar agora.</p></div><button data-action="close-import-csv" aria-label="Fechar">×</button></header>
  <div class="pool-summary">
    <div><span>Disponíveis</span><strong>${pool.available || 0}</strong></div>
    <div><span>Já liberados</span><strong>${pool.released || 0}</strong></div>
    <div><span>Duplicados</span><strong>${pool.duplicates || 0}</strong></div>
  </div>
  ${busy ? `<div class="import-progress"><span class="import-spinner"></span><div><strong>${statusCopy}</strong><p>A operação acontece em lote, sem milhares de chamadas individuais.</p></div></div>` : ""}
  ${view.status === "complete" ? `<div class="import-result"><span class="import-result-mark">✓</span><div><p class="eyebrow">LISTA ARMAZENADA</p><h3>${result.imported} lead(s) adicionados ao banco de espera</h3><p>${result.total} linha(s) lida(s) · ${result.duplicates} duplicada(s) · ${result.invalid} inválida(s). Nenhum card foi criado automaticamente.</p></div></div>${excluded ? `<div class="import-issues"><strong>Validação do arquivo</strong>${report.duplicateRows.length ? importProblemList(report.duplicateRows) : ""}${report.invalidRows.length ? importProblemList(report.invalidRows) : ""}</div>` : ""}` : ""}
  ${view.status === "released" ? `<div class="import-result"><span class="import-result-mark">✓</span><div><p class="eyebrow">LEADS LIBERADOS</p><h3>${releaseResult.released} novo(s) card(s) na Base de clientes</h3><p>${releaseResult.available} lead(s) continuam no banco de espera${releaseResult.duplicates_skipped ? ` · ${releaseResult.duplicates_skipped} duplicado(s) ignorado(s)` : ""}.</p></div></div>` : ""}
  ${blocked ? `<div class="import-issues"><strong>Nenhum lead válido no arquivo</strong><p>O banco de espera não foi alterado.</p>${importProblemList(report.duplicateRows)}${importProblemList(report.invalidRows)}</div>` : ""}
  ${!busy ? `<section class="pool-release">
    <div><p class="eyebrow">LIBERAR PARA O KANBAN</p><h3>Próximo grupo de leads</h3><p>A quantidade escolhida fica salva como padrão para a próxima liberação.</p></div>
    <form id="release-leads-form">
      <label>Quantidade<input name="quantity" type="number" min="1" max="100" value="${pool.default_release_quantity || 20}" ${pool.available ? "" : "disabled"}></label>
      <button class="button primary" type="submit" ${pool.available ? "" : "disabled"}>Liberar leads</button>
    </form>
  </section>
  <label class="import-dropzone compact" for="apollo-csv-file"><input id="apollo-csv-file" type="file" name="file" accept=".csv,text/csv"><span class="import-dropzone-icon">↑</span><span><strong>Adicionar lista ao banco</strong><small>CSV exportado do Apollo · até 5.000 linhas por lote</small></span></label>
  <div class="import-rules"><div><b>Uma única carga</b><span>A lista completa fica armazenada sem lotar o Kanban.</span></div><div><b>Dedupe global</b><span>Empresa, contato, LinkedIn e IDs do Apollo são conferidos.</span></div><div><b>Liberação controlada</b><span>Só os próximos N viram cards na Base de clientes.</span></div></div>` : ""}
  ${recentBatches.length ? `<section class="pool-batches"><p class="eyebrow">ÚLTIMOS LOTES</p>${recentBatches.map((batch) => `<div><span><b>${escapeHtml(batch.file_name)}</b><small>${humanDate(batch.created_at)} · ${batch.total_rows} linhas</small></span><strong>${batch.released_rows}/${batch.imported_rows} liberados</strong></div>`).join("")}</section>` : ""}
  <footer><button type="button" class="button secondary" data-action="close-import-csv">Fechar</button></footer>
  </section>`;
}
function historyPage() { const rows = [...state.leads].sort((a, b) => a.company.localeCompare(b.company)); return appShell(`${header("BASE COMPARTILHADA", "Todas as empresas", "Consulte qualquer empresa, inclusive as que já foram descartadas ou viraram projeto.")}<section class="history-table"><div class="history-head"><span>Empresa e contato</span><span>Origem</span><span>Score</span><span>Etapa</span></div>${rows.map((lead) => `<button class="history-row" data-lead="${lead.id}"><div><strong>${escapeHtml(lead.company)}</strong><small>${escapeHtml(lead.contact)} | ${escapeHtml(lead.role)}</small></div><span>${lead.source}</span><span class="score ${scoreClass(lead.score)}">${lead.score}/10</span><span>${stageNames[lead.stage]}</span></button>`).join("")}</section>${drawOverlays()}`); }
function drawOverlays() { return `${state.selectedId ? leadDrawer(leadById(state.selectedId)) : ""}${state.selectedProjectId ? projectDrawer(projectById(state.selectedProjectId)) : ""}${state.settingsOpen ? settingsModal() : ""}${state.projectModal !== null ? projectModal(state.projectModal ? leadById(state.projectModal) : null) : ""}${state.followUpLeadId ? followUpModal(leadById(state.followUpLeadId)) : ""}${state.importModal ? importCsvModal() : ""}`; }
function followUpModal(lead) { return `<div class="backdrop" data-action="close-followup-modal"></div><section class="small-modal" role="dialog" aria-label="Adicionar follow-up"><header><div><p class="eyebrow">FOLLOW-UP</p><h2>${escapeHtml(lead.company)}</h2><p>O lembrete fica visivel para toda a equipe no CRM.</p></div><button data-action="close-followup-modal">×</button></header><form id="followup-form"><input name="leadId" type="hidden" value="${lead.id}"><label>Data e hora<input name="dueAt" type="datetime-local" required></label><label>Proxima acao<textarea name="note" required placeholder="Ex.: retomar conversa sobre o fechamento mensal"></textarea></label><footer><button type="button" class="button secondary" data-action="close-followup-modal">Cancelar</button><button class="button primary" type="submit">Criar lembrete</button></footer></form></section>`; }
function render() { if (state.remote.loading) { root.innerHTML = `<main class="loading-page">Carregando CRM AGF...</main>`; return; } if (state.remote.error || !state.remote.enabled) { root.innerHTML = `<main class="loading-page">O CRM precisa de uma configuracao Supabase valida. ${escapeHtml(state.remote.error || "Configuracao ausente.")}</main>`; return; } if (!state.remote.session?.access_token) { root.innerHTML = loginPage(); bindEvents(); return; } root.innerHTML = state.page === "agenda" ? agendaPage() : state.page === "followups" ? followUpsPage() : state.page === "projects" ? projectsPage() : state.page === "history" ? historyPage() : operationPage(); bindEvents(); scheduleFollowUpNotifications(); scheduleRemoteRefresh(); requestAnimationFrame(notifyDueFollowUps); }
function toast(message) { document.querySelector(".toast")?.remove(); const node = document.createElement("div"); node.className = "toast"; node.textContent = message; document.body.append(node); setTimeout(() => node.remove(), 3400); }
function captureBoardViewport() {
  if (state.page !== "operation") return null;
  const board = document.querySelector(".kanban-scroll");
  if (!board) return null;
  return {
    scrollLeft: board.scrollLeft,
    columns: Object.fromEntries([...document.querySelectorAll(".kanban-column")].map((column) => [column.dataset.column, column.querySelector(".cards")?.scrollTop || 0])),
  };
}
function restoreBoardViewport(viewport) {
  if (!viewport) return;
  requestAnimationFrame(() => {
    const board = document.querySelector(".kanban-scroll");
    if (!board) return;
    board.scrollLeft = viewport.scrollLeft;
    document.querySelectorAll(".kanban-column").forEach((column) => {
      const scrollTop = viewport.columns[column.dataset.column];
      if (scrollTop) column.querySelector(".cards").scrollTop = scrollTop;
    });
  });
}
async function reloadAndRender(message) { const viewport = captureBoardViewport(); await loadRemoteData(); render(); restoreBoardViewport(viewport); if (message) toast(message); }
async function refreshRemoteData() {
  const hasOpenInteraction = state.selectedId || state.selectedProjectId || state.settingsOpen || state.projectModal !== null || state.followUpLeadId || state.importModal || state.draggedId || state.draggedProjectId;
  if (!state.remote.session?.access_token || document.hidden || hasOpenInteraction || state.remoteRefreshInFlight) return;
  state.remoteRefreshInFlight = true;
  try {
    await reloadAndRender();
  } catch {
    if (!state.remote.session?.access_token) render();
  } finally {
    state.remoteRefreshInFlight = false;
  }
}
function scheduleRemoteRefresh() {
  if (state.remoteRefreshTimer) return;
  state.remoteRefreshTimer = window.setInterval(() => void refreshRemoteData(), 15 * 1000);
}
async function recordActivity(leadId, activityType, summary, metadata = {}) { await supabaseRequest("/rest/v1/lead_activities", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ lead_id: leadId, activity_type: activityType, summary, metadata, created_by: state.remote.session.user.id }) }); }
async function updateLeadStage(id, stage, extra = {}, message) { const lead = leadById(id); if (!lead || lead.stage === stage) return; if (!(validTargets[lead.stage] || []).includes(stage)) { toast("Essa movimentacao precisa ser feita pela acao indicada no card."); return; } try { await supabaseRequest(`/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ current_stage: stage, ...extra }) }); await reloadAndRender(message || `Card movido para ${stageNames[stage]}.`); } catch (error) { toast(error.message || "A etapa nao foi atualizada."); } }
async function completeLeadDrop(leadId, targetStage) {
  const lead = leadById(leadId);
  if (!lead || !(validTargets[lead.stage] || []).includes(targetStage)) return;
  const transitions = {
    aprovado: { activity: "lead_approved", summary: "Lead aprovado para envio manual do convite.", message: "Lead pronto para o convite." },
    convite_enviado: { activity: "connection_invite_sent", summary: "Convite enviado manualmente no LinkedIn.", extra: { invited_at: new Date().toISOString() }, message: "Convite registrado como pendente." },
    conexao_aceita: { activity: "connection_accepted", summary: "Aceite de conexao confirmado manualmente.", extra: { accepted_at: new Date().toISOString() }, message: "Conexao aceita. A mensagem esta pronta." },
    mensagem_enviada: { activity: "linkedin_message_sent", summary: "Mensagem enviada manualmente no LinkedIn.", extra: { message_sent_at: new Date().toISOString(), message_sent_by: state.remote.session.user.id }, message: "Mensagem enviada registrada." },
    em_conversa: { activity: "response_received", summary: "Resposta recebida e conversa iniciada.", message: "Lead movido para conversa." },
    agendamento: { activity: "scheduling_started", summary: "Lead entrou em agendamento.", message: "Copie agora a mensagem com o link da agenda." },
    call_marcada: { activity: "call_marked_manually", summary: "Call marcada manualmente no Kanban.", message: "Call marcada. O horario pode ser atualizado no card." },
    descartado: { activity: "lead_discarded", summary: "Lead descartado manualmente no Kanban.", extra: { discard_reason: "Descartado manualmente no Kanban." }, message: "Lead descartado." },
  };
  const transition = transitions[targetStage];
  try {
    if (transition?.activity) await recordActivity(leadId, transition.activity, transition.summary);
    await updateLeadStage(leadId, targetStage, transition?.extra || {}, transition?.message);
  } catch (error) {
    toast(error.message || "A acao do card nao foi registrada.");
  }
}
async function copyText(text, message) { try { await navigator.clipboard.writeText(text); toast(message); } catch { toast("Nao foi possivel copiar automaticamente. Selecione o texto no card."); } }
async function saveMessage(lead) { const field = document.querySelector("#message-draft"); if (!field) return; const body = field.value.trim(); if (!body) { toast("A mensagem nao pode ficar vazia."); return; } try { if (lead.messageDraftId) await supabaseRequest(`/rest/v1/message_drafts?id=eq.${encodeURIComponent(lead.messageDraftId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ body }) }); else await supabaseRequest("/rest/v1/message_drafts", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ lead_id: lead.id, channel: "linkedin_message", body, is_current: true, created_by: state.remote.session.user.id }) }); await recordActivity(lead.id, "message_draft_saved", "Rascunho de mensagem atualizado manualmente."); await reloadAndRender("Rascunho salvo."); } catch (error) { toast(error.message || "Nao foi possivel salvar o rascunho."); } }
async function createFollowUp(values) { try { await supabaseRequest("/rest/v1/lead_follow_ups", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ lead_id: values.leadId, due_at: new Date(values.dueAt).toISOString(), note: values.note, created_by: state.remote.session.user.id }) }); await recordActivity(values.leadId, "follow_up_created", `Follow-up agendado para ${humanDate(new Date(values.dueAt).toISOString())}.`); state.followUpLeadId = null; await reloadAndRender("Follow-up criado."); } catch (error) { toast(error.message || "Nao foi possivel criar o follow-up."); } }
async function completeFollowUp(id) { try { await supabaseRequest(`/rest/v1/lead_follow_ups?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "completed", completed_at: new Date().toISOString(), completed_by: state.remote.session.user.id }) }); await reloadAndRender("Follow-up concluido."); } catch (error) { toast(error.message || "Nao foi possivel concluir o follow-up."); } }
async function deleteLead(lead) {
  if (!lead || !window.confirm(`Apagar definitivamente o card de ${lead.contact} — ${lead.company}? O historico e os follow-ups deste lead tambem serao removidos.`)) return;
  try {
    await supabaseRequest(`/rest/v1/leads?id=eq.${encodeURIComponent(lead.id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    state.selectedId = null;
    await reloadAndRender("Card apagado.");
  } catch (error) {
    toast(error.message || "Nao foi possivel apagar o card.");
  }
}
async function createProject(values) { const stage = values.stage; const closed = ["ganho", "perdido"].includes(stage) ? new Date().toISOString() : null; try { await supabaseRequest("/rest/v1/commercial_projects", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ lead_id: values.leadId || null, company_id: values.companyId || null, name: values.name, company_name: values.companyName, responsible_name: values.responsibleName, current_stage: stage, description: values.description, next_action: values.nextAction || null, next_action_at: values.nextActionAt ? new Date(values.nextActionAt).toISOString() : null, estimated_value: values.estimatedValue ? Number(values.estimatedValue) : null, notes: values.notes || null, closed_at: closed, created_by: state.remote.session.user.id }) }); if (values.leadId) await recordActivity(values.leadId, "commercial_project_created", "Projeto comercial criado a partir deste lead."); state.projectModal = null; state.page = "projects"; await reloadAndRender("Projeto criado no pipeline comercial."); } catch (error) { toast(error.message || "Nao foi possivel criar o projeto."); } }
async function saveProjectEdits(values) { const stage = values.stage; try { await supabaseRequest(`/rest/v1/commercial_projects?id=eq.${encodeURIComponent(values.projectId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ name: values.name, company_name: values.companyName, responsible_name: values.responsibleName, current_stage: stage, description: values.description, next_action: values.nextAction || null, next_action_at: values.nextActionAt ? new Date(values.nextActionAt).toISOString() : null, estimated_value: values.estimatedValue ? Number(values.estimatedValue) : null, notes: values.notes || null, closed_at: ["ganho", "perdido"].includes(stage) ? new Date().toISOString() : null }) }); state.selectedProjectId = null; await reloadAndRender("Projeto atualizado."); } catch (error) { toast(error.message || "Nao foi possivel salvar o projeto."); } }
async function importLeadPoolRecords(report) {
  const result = await supabaseRequest("/rest/v1/rpc/import_lead_pool", {
    method: "POST",
    body: JSON.stringify({
      p_file_name: report.fileName,
      p_records: report.records,
      p_total_rows: report.total,
      p_client_invalid_rows: report.invalidRows.length,
      p_client_duplicate_rows: report.duplicateRows.length,
    }),
  });
  await loadRemoteData();
  state.importModal = { status: "complete", report, result };
  render();
  toast(`${result.imported} lead(s) adicionados ao banco de espera.`);
}
async function releaseLeadPool(values) {
  const quantity = Number(values.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    toast("Escolha uma quantidade entre 1 e 100.");
    return;
  }
  state.importModal = { status: "releasing" };
  render();
  try {
    await supabaseRequest("/rest/v1/app_settings?setting_key=eq.lead_pool_release", {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ value: { default_release_quantity: quantity } }),
    });
    const releaseResult = await supabaseRequest("/rest/v1/rpc/release_lead_pool", {
      method: "POST",
      body: JSON.stringify({ p_quantity: quantity }),
    });
    await loadRemoteData();
    state.importModal = { status: "released", releaseResult };
    render();
    toast(`${releaseResult.released} lead(s) liberado(s) para a Base de clientes.`);
  } catch (error) {
    state.importModal = {};
    render();
    toast(error.message || "Não foi possível liberar os leads.");
  }
}
async function promoteLeadToProject(id) {
  const lead = leadById(id);
  if (!lead || lead.stage !== "call_marcada") return;
  try {
    await supabaseRequest("/rest/v1/commercial_projects", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        lead_id: lead.id,
        company_id: lead.companyId || null,
        name: `Oportunidade — ${lead.company}`,
        company_name: lead.company,
        responsible_name: operatorName(),
        current_stage: "pos_call",
        description: `Projeto criado a partir da call com ${lead.contact}.`,
        created_by: state.remote.session.user.id,
      }),
    });
    await recordActivity(lead.id, "commercial_project_created", "Projeto comercial criado automaticamente a partir da call.");
    await supabaseRequest(`/rest/v1/leads?id=eq.${encodeURIComponent(lead.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ current_stage: "concluido" }),
    });
    state.selectedId = null;
    state.page = "projects";
    await reloadAndRender("Projeto criado e enviado para o pipeline comercial.");
  } catch (error) {
    toast(error.message || "Nao foi possivel criar o projeto a partir da call.");
  }
}
async function updateProjectStage(id, stage) { try { await supabaseRequest(`/rest/v1/commercial_projects?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ current_stage: stage, closed_at: ["ganho", "perdido"].includes(stage) ? new Date().toISOString() : null }) }); await reloadAndRender(`Projeto movido para ${projectStageNames[stage]}.`); } catch (error) { toast(error.message || "Nao foi possivel mover o projeto."); } }
async function saveSettings(values) { try { const value = { booking_url: values.bookingUrl.trim(), timezone: state.settings.timezone, duration_minutes: state.settings.callDuration, slot_minutes: state.settings.slotInterval }; await supabaseRequest("/rest/v1/app_settings?setting_key=eq.calendar_booking", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ value }) }); state.settingsOpen = false; await reloadAndRender("Link da agenda salvo."); } catch (error) { toast(error.message || "Nao foi possivel salvar as configuracoes."); } }
function bindEvents() {
  document.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => { state.page = button.dataset.page; state.selectedId = null; render(); }));
  document.querySelectorAll("[data-lead]").forEach((element) => element.addEventListener("click", (event) => { if (event.target.closest("[data-action]")) return; state.selectedId = element.dataset.lead; render(); }));
  document.querySelectorAll(".lead-card").forEach((cardNode) => { cardNode.addEventListener("dragstart", () => { state.draggedId = cardNode.dataset.lead; cardNode.classList.add("dragging"); }); cardNode.addEventListener("dragend", () => { state.draggedId = null; cardNode.classList.remove("dragging"); }); });
  document.querySelectorAll(".kanban-column").forEach((column) => { column.addEventListener("dragover", (event) => { const lead = leadById(state.draggedId); if (lead && column.dataset.target && (validTargets[lead.stage] || []).includes(column.dataset.target)) { event.preventDefault(); column.classList.add("drop-target"); } }); column.addEventListener("dragleave", () => column.classList.remove("drop-target")); column.addEventListener("drop", (event) => { event.preventDefault(); column.classList.remove("drop-target"); if (state.draggedId && column.dataset.target) void completeLeadDrop(state.draggedId, column.dataset.target); }); });
  const createProjectColumn = document.querySelector('[data-column="create-project"]');
  createProjectColumn?.addEventListener("dragover", (event) => {
    const lead = leadById(state.draggedId);
    if (lead?.stage === "call_marcada") { event.preventDefault(); createProjectColumn.classList.add("drop-target"); }
  });
  createProjectColumn?.addEventListener("dragleave", () => createProjectColumn.classList.remove("drop-target"));
  createProjectColumn?.addEventListener("drop", (event) => {
    event.preventDefault();
    createProjectColumn.classList.remove("drop-target");
    if (state.draggedId) void promoteLeadToProject(state.draggedId);
  });
  document.querySelectorAll("[data-project]").forEach((node) => { node.addEventListener("click", () => { state.selectedProjectId = node.dataset.project; render(); }); node.addEventListener("dragstart", () => { state.draggedProjectId = node.dataset.project; node.classList.add("dragging"); }); node.addEventListener("dragend", () => { state.draggedProjectId = null; node.classList.remove("dragging"); }); });
  document.querySelectorAll(".project-column").forEach((column) => { column.addEventListener("dragover", (event) => { if (state.draggedProjectId) { event.preventDefault(); column.classList.add("drop-target"); } }); column.addEventListener("dragleave", () => column.classList.remove("drop-target")); column.addEventListener("drop", (event) => { event.preventDefault(); column.classList.remove("drop-target"); if (state.draggedProjectId) void updateProjectStage(state.draggedProjectId, column.dataset.projectStage); }); });
  document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", (event) => { const action = button.dataset.action; const lead = leadById(button.dataset.lead); const manualStageActions = { "move-to-invite": "aprovado", "invite-sent": "convite_enviado", "connection-accepted": "conexao_aceita", "message-sent": "mensagem_enviada", "response-received": "em_conversa", "move-to-scheduling": "agendamento" }; if (lead && manualStageActions[action]) { event.stopImmediatePropagation(); void completeLeadDrop(lead.id, manualStageActions[action]); return; } }));
  document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => { const action = button.dataset.action; const lead = leadById(button.dataset.lead); if (action === "close-detail") { state.selectedId = null; render(); } if (action === "close-project-detail") { state.selectedProjectId = null; render(); } if (action === "settings") { state.settingsOpen = true; render(); } if (action === "close-settings") { state.settingsOpen = false; render(); } if (action === "logout") { writeSession(null); state.selectedId = null; state.selectedProjectId = null; render(); } if (action === "open-linkedin" && lead?.linkedinUrl) window.open(lead.linkedinUrl, "_blank", "noopener,noreferrer"); if (action === "open-linkedin" && !lead?.linkedinUrl) toast("Este contato ainda nao possui URL do LinkedIn."); if (action === "copy-invite-note") { void recordActivity(lead.id, "invite_note_copied", "Nota do convite copiada manualmente.").then(() => copyText(inviteNoteMessage(lead), "Nota do convite copiada.")); } if (action === "copy-scheduling") { void recordActivity(lead.id, "booking_link_copied", "Mensagem de agendamento copiada manualmente.").then(() => copyText(schedulingMessage(lead), "Mensagem de agendamento copiada.")); } if (action === "copy-booking-thanks") { void recordActivity(lead.id, "booking_thanks_copied", "Mensagem de agradecimento da call copiada manualmente.").then(() => copyText(bookingThanksMessage(lead), "Mensagem de agradecimento copiada.")); } if (action === "copy-message") { const text = document.querySelector("#message-draft")?.value || lead.message; void copyText(text, "Mensagem copiada."); } if (action === "save-message") void saveMessage(lead); if (action === "new-followup") { state.followUpLeadId = lead.id; render(); } if (action === "close-followup-modal") { state.followUpLeadId = null; render(); } if (action === "complete-followup") void completeFollowUp(button.dataset.followup); if (action === "new-project") { state.projectModal = ""; render(); } if (action === "project-from-lead") { state.projectModal = lead.id; render(); } if (action === "close-project-modal") { state.projectModal = null; render(); } }));
  document.querySelectorAll("[data-action=discard-lead]").forEach((button) => button.addEventListener("click", () => {
    const lead = leadById(button.dataset.lead);
    if (lead) void updateLeadStage(lead.id, "descartado", { discard_reason: "Sem interesse comercial apos a call." }, "Lead descartado.");
  }));
  document.querySelectorAll("[data-action=delete-lead]").forEach((button) => button.addEventListener("click", () => {
    const lead = leadById(button.dataset.lead);
    if (lead) void deleteLead(lead);
  }));
  document.querySelectorAll("[data-action=create-project-now]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.lead) void promoteLeadToProject(button.dataset.lead);
  }));
  document.querySelectorAll("[data-action=import-csv]").forEach((button) => button.addEventListener("click", () => { state.importModal = {}; render(); }));
  document.querySelectorAll("[data-action=close-import-csv]").forEach((button) => button.addEventListener("click", () => { state.importModal = null; render(); }));
  document.querySelectorAll("[data-action=reset-import-csv]").forEach((button) => button.addEventListener("click", () => { state.importModal = {}; render(); }));
  document.querySelector("#login-form")?.addEventListener("submit", async (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); const submit = event.currentTarget.querySelector("button[type=submit]"); submit.disabled = true; submit.textContent = "Entrando..."; try { await signIn(values.get("email"), values.get("password")); await loadRemoteData(); state.page = "operation"; render(); } catch (error) { submit.disabled = false; submit.textContent = "Entrar no CRM"; toast(error.message || "Nao foi possivel entrar."); } });
  document.querySelector("#settings-form")?.addEventListener("submit", (event) => { event.preventDefault(); void saveSettings(Object.fromEntries(new FormData(event.currentTarget))); });
  document.querySelector("#followup-form")?.addEventListener("submit", (event) => { event.preventDefault(); void createFollowUp(Object.fromEntries(new FormData(event.currentTarget))); });
  document.querySelector("#project-form")?.addEventListener("submit", (event) => { event.preventDefault(); void createProject(Object.fromEntries(new FormData(event.currentTarget))); });
  document.querySelector("#project-edit-form")?.addEventListener("submit", (event) => { event.preventDefault(); void saveProjectEdits(Object.fromEntries(new FormData(event.currentTarget))); });
  document.querySelector("#release-leads-form")?.addEventListener("submit", (event) => { event.preventDefault(); void releaseLeadPool(Object.fromEntries(new FormData(event.currentTarget))); });
  document.querySelector("#apollo-csv-file")?.addEventListener("change", async (event) => {
    const file = event.currentTarget.files[0];
    if (!file) return;
    try {
      state.importModal = { status: "reading", fileName: file.name };
      render();
      const report = prepareApolloImport(decodeApolloCsv(await file.arrayBuffer()), file.name);
      if (!report.records.length) {
        state.importModal = { status: "blocked", report };
        render();
        return;
      }
      state.importModal = { status: "importing", report };
      render();
      await importLeadPoolRecords(report);
    } catch (error) {
      state.importModal = { status: "blocked", report: { total: 0, records: [], invalidRows: [{ row: "—", reason: error.message || "Não foi possível ler o CSV." }], duplicateRows: [] } };
      render();
    }
  });
}
async function bootstrap() { try { state.remote.config = await fetchConfiguration(); state.remote.enabled = isRemoteConfigured(); if (state.remote.enabled && state.remote.session?.access_token) await loadRemoteData(); } catch (error) { if (state.remote.enabled && /sessao expirou/i.test(error.message || "")) { writeSession(null); state.remote.error = null; } else { state.remote.enabled = false; state.remote.error = error.message || "A configuracao remota nao foi carregada."; } } finally { state.remote.loading = false; render(); } }
void bootstrap();
