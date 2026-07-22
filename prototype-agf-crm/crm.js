const STORAGE_KEY = "agf-crm-local-v1";
const SESSION_KEY = "agf-crm-supabase-session-v1";
const defaultMessage = "{Nome}, tudo bem? Obrigado por aceitar o convite.\n\nVi {trigger da empresa}. Imagino que usar AI de verdade no financeiro, sem virar projeto eterno, esteja na pauta ai tambem.\n\nMontei a AGF exatamente para isso. Contamos com profissionais das melhores consultorias do Brasil, que atuam no dia a dia da empresa, do operacional ao estrategico, criando automacoes no caminho.\n\nEu venho de 10+ anos entre banking e corporate development, e fundei uma empresa na qual levantei recursos com investidores institucionais.\n\nTopa 15-30 minutos para eu me apresentar rapidamente?";

const stages = [
  ["ready_to_send", "Prontos para enviar"],
  ["approved", "Aprovado"],
  ["send_invitation", "Enviar convite"],
  ["invitation_sent", "Convite enviado"],
  ["send_message", "Enviar mensagem"],
  ["in_conversation", "Em conversa"],
  ["scheduling", "Agendamento"],
  ["call_booked", "Call marcada"],
  ["concluded", "Concluido"],
];

const stageNames = Object.fromEntries(stages);
const defaultSettings = {
  extractionEnabled: true,
  extractionTime: "08:00",
  vacancyCount: 5,
  middleMarketCount: 15,
  sendStart: "09:00",
  sendEnd: "20:00",
  dailyAlertAt: 20,
  callDuration: 30,
  slotInterval: 15,
};

const seedLeads = [
  {
    id: "V-042", company: "Vertice Logistica", contact: "Marina Teixeira", role: "Head de Controladoria", source: "Vagas", stage: "ready_to_send", score: 8,
    trigger: "abriu posicao de Controller Corporativo", news: "Expansao de dois centros de distribuicao anunciada em junho.",
    profile: "Brasil | +500 conexoes | perfil contatavel", realEconomy: true, location: "Goiania, GO",
    message: "Marina, tudo bem? Obrigado por aceitar o convite.\n\nVi a expansao da Vertice junto a busca por alguem para a controladoria corporativa. Imagino que usar AI de verdade no financeiro, sem virar projeto eterno, esteja na pauta ai tambem.\n\nMontei a AGF exatamente para isso. Contamos com profissionais das melhores consultorias do Brasil, que atuam no dia a dia da empresa, do operacional ao estrategico, criando automacoes no caminho.\n\nEu venho de 10+ anos entre banking e corporate development, e fundei uma empresa na qual levantei recursos com investidores institucionais.\n\nTopa 15-30 minutos para eu me apresentar rapidamente?",
    scoreBreakdown: { companySize: 3, urgency: 2, decisionMaker: 1, realEconomy: 2 },
    history: ["Perfil validado", "Sinal de vaga confirmado", "Rascunho preparado"],
  },
  {
    id: "MM-118", company: "Ceu Azul Alimentos", contact: "Renato Duarte", role: "CEO", source: "Middle market", stage: "ready_to_send", score: 7,
    trigger: "crescimento regional e emissao de debentures", news: "Captacao para expansao industrial noticiada ha dois meses.",
    profile: "Brasil | +500 conexoes | perfil contatavel", realEconomy: true, location: "Uberlandia, MG",
    message: "Renato, tudo bem? Obrigado por aceitar o convite.\n\nVi o momento de expansao da Ceu Azul e a recente emissao de debentures. Imagino que usar AI de verdade no financeiro, sem virar projeto eterno, esteja na pauta ai tambem.\n\nMontei a AGF exatamente para isso. Contamos com profissionais das melhores consultorias do Brasil, que atuam no dia a dia da empresa, do operacional ao estrategico, criando automacoes no caminho.\n\nEu venho de 10+ anos entre banking e corporate development, e fundei uma empresa na qual levantei recursos com investidores institucionais.\n\nTopa 15-30 minutos para eu me apresentar rapidamente?",
    scoreBreakdown: { companySize: 3, financialMoment: 1, decisionMaker: 1, realEconomy: 2 },
    history: ["Perfil validado", "Debenture e expansao verificados", "Rascunho preparado"],
  },
  {
    id: "V-041", company: "NorteSul Varejo", contact: "Bianca Salles", role: "Gerente de FP&A", source: "Vagas", stage: "invitation_sent", score: 7,
    trigger: "busca por analista de FP&A", news: "Crescimento de lojas no Nordeste informado no site institucional.",
    profile: "Brasil | +500 conexoes | convite disponivel", realEconomy: true, location: "Recife, PE",
    message: "Bianca, tudo bem? Obrigado por aceitar o convite.\n\nVi a busca da NorteSul por alguem em FP&A. Imagino que usar AI de verdade no financeiro, sem virar projeto eterno, esteja na pauta ai tambem.",
    scoreBreakdown: { companySize: 3, urgency: 1, decisionMaker: 1, realEconomy: 2 },
    history: ["Perfil validado", "Convite preparado no piloto"],
  },
  {
    id: "MM-117", company: "Rota Oeste Transportes", contact: "Alexandre Campos", role: "CFO", source: "Middle market", stage: "in_conversation", score: 6,
    trigger: "nova unidade e aumento de capacidade operacional", news: "Empresa comunicou abertura de filial no Centro-Oeste em maio.",
    profile: "Brasil | +500 conexoes | perfil contatavel", realEconomy: true, location: "Campo Grande, MS",
    message: "Alexandre, tudo bem? Obrigado por aceitar o convite.",
    scoreBreakdown: { companySize: 2, financialMoment: 1, decisionMaker: 1, realEconomy: 2 },
    history: ["Perfil validado", "Sinal operacional confirmado", "Lead em conversa"],
  },
  {
    id: "V-038", company: "Horizonte Saude", contact: "Paula Nascimento", role: "Head de Financas", source: "Vagas", stage: "call_booked", score: 8,
    trigger: "contratacao para Controladoria e FP&A", news: "Aquisicao de clinica regional confirmada em abril.",
    profile: "Brasil | +500 conexoes | perfil contatavel", realEconomy: true, location: "Belo Horizonte, MG",
    meeting: "Amanha, 14:30 | Google Meet", message: "Paula, tudo bem? Obrigado por aceitar o convite.",
    scoreBreakdown: { companySize: 3, urgency: 2, decisionMaker: 1, realEconomy: 2 },
    history: ["Perfil validado", "Call de 30 minutos confirmada"],
  },
];

function cloneSeed() { return JSON.parse(JSON.stringify(seedLeads)); }
function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { leads: parsed.leads || cloneSeed(), settings: { ...defaultSettings, ...(parsed.settings || {}) } };
  } catch { return { leads: cloneSeed(), settings: { ...defaultSettings } }; }
}

const persisted = loadState();
const state = {
  leads: persisted.leads,
  settings: persisted.settings,
  selectedId: null,
  settingsOpen: false,
  page: "operation",
  draggedId: null,
  remote: { config: null, session: readSession(), enabled: false, loading: true },
};
const root = document.querySelector("#app");

function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ leads: state.leads, settings: state.settings })); }
function readSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function writeSession(session) { state.remote.session = session; if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); else localStorage.removeItem(SESSION_KEY); }
function escapeHtml(value = "") { return value.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char])); }
function leadById(id) { return state.leads.find((lead) => lead.id === id); }
function scoreClass(score) { return score >= 7 ? "high" : score >= 5 ? "medium" : "low"; }
function sourceClass(source) { return source === "Vagas" ? "vacancy" : "middle"; }
function nextStage(key) { return stages[Math.min(stages.length - 1, stages.findIndex(([id]) => id === key) + 1)]?.[0]; }

async function fetchConfiguration() {
  const response = await fetch("/api/config", { cache: "no-store" });
  if (!response.ok) throw new Error("Nao foi possivel carregar a configuracao local.");
  return response.json();
}

function isRemoteConfigured() {
  return Boolean(state.remote.config?.supabaseUrl && state.remote.config?.supabasePublishableKey);
}

async function supabaseRequest(path, options = {}) {
  const { supabaseUrl, supabasePublishableKey } = state.remote.config;
  const headers = new Headers(options.headers || {});
  headers.set("apikey", supabasePublishableKey);
  headers.set("Content-Type", "application/json");
  if (state.remote.session?.access_token) headers.set("Authorization", `Bearer ${state.remote.session.access_token}`);
  const response = await fetch(`${supabaseUrl}${path}`, { ...options, headers });
  if (response.status === 401 || response.status === 403) {
    writeSession(null);
    throw new Error("Sua sessao expirou. Entre novamente.");
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || "A operacao no Supabase nao foi concluida.");
  }
  return response.status === 204 ? null : response.json();
}

async function signIn(email, password) {
  const { supabaseUrl, supabasePublishableKey } = state.remote.config;
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: supabasePublishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error("E-mail ou senha invalidos.");
  const session = await response.json();
  writeSession(session);
}

function messageFor(row, company, contact) {
  const drafts = row.message_drafts || [];
  const currentDraft = drafts.find((draft) => draft.is_current) || drafts[0];
  if (currentDraft?.body) return currentDraft.body;
  return defaultMessage.replace("{Nome}", contact?.full_name?.split(" ")[0] || "").replace("{trigger da empresa}", row.signal_summary || company?.name || "o momento da empresa");
}

function mapRemoteLead(row) {
  const company = row.company || {};
  const contact = row.contact || {};
  const booking = (row.calendar_bookings || [])[0];
  const news = Array.isArray(row.recent_news) && row.recent_news.length ? row.recent_news.map((item) => item.title || item.summary || item).join(" | ") : "Contexto ainda em enriquecimento.";
  return {
    id: row.id,
    company: company.name || "Empresa sem nome",
    contact: contact.full_name || "Contato a identificar",
    role: contact.title || "Cargo a identificar",
    source: row.source === "vacancy" ? "Vagas" : "Middle market",
    stage: row.current_stage,
    score: row.total_score || 0,
    scoreBreakdown: {
      companySize: row.company_size_score || 0,
      urgency: row.urgency_score,
      financialMoment: row.financial_moment_score,
      decisionMaker: row.decision_maker_score || 0,
      realEconomy: row.real_economy_bonus || 0,
    },
    trigger: row.signal_summary || "Sinal a confirmar",
    news,
    profile: contact.profile_gate_passed ? `${contact.location_country || "Brasil"} | ${contact.connection_count || "+100"} conexoes | perfil contatavel` : (contact.profile_gate_reason || "Perfil pendente de validacao"),
    realEconomy: company.real_economy,
    location: [company.headquarters_city, company.headquarters_state].filter(Boolean).join(", "),
    meeting: booking?.starts_at ? `${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(booking.starts_at))} | Google Meet` : null,
    message: messageFor(row, company, contact),
    history: ["Importado do Supabase", row.company_overview || row.contact_context || "Contexto disponivel no card"].filter(Boolean),
    linkedinUrl: contact.linkedin_url,
  };
}

function settingsFromRows(rows) {
  const values = Object.fromEntries(rows.map((row) => [row.setting_key, row.value]));
  const extraction = values.lead_extraction || {};
  const outbound = values.outbound || {};
  const calendar = values.calendar || {};
  return {
    ...state.settings,
    extractionEnabled: extraction.enabled ?? state.settings.extractionEnabled,
    extractionTime: extraction.time ?? state.settings.extractionTime,
    vacancyCount: extraction.vacancy_count ?? state.settings.vacancyCount,
    middleMarketCount: extraction.middle_market_count ?? state.settings.middleMarketCount,
    sendStart: outbound.start ?? state.settings.sendStart,
    sendEnd: outbound.end ?? state.settings.sendEnd,
    dailyAlertAt: outbound.daily_alert_at ?? state.settings.dailyAlertAt,
    callDuration: calendar.duration_minutes ?? state.settings.callDuration,
    slotInterval: calendar.slot_minutes ?? state.settings.slotInterval,
  };
}

async function loadRemoteData() {
  const query = "/rest/v1/leads?select=id,current_stage,total_score,company_size_score,urgency_score,financial_moment_score,decision_maker_score,real_economy_bonus,source,signal_summary,company_overview,contact_context,recent_news,company:companies(name,headquarters_city,headquarters_state,real_economy),contact:contacts(full_name,title,linkedin_url,profile_gate_passed,profile_gate_reason,connection_count,location_country),message_drafts(body,is_current),calendar_bookings(starts_at,status)&order=created_at.desc";
  const [leadRows, settingRows] = await Promise.all([
    supabaseRequest(query),
    supabaseRequest("/rest/v1/app_settings?select=setting_key,value"),
  ]);
  state.leads = leadRows.map(mapRemoteLead);
  state.settings = settingsFromRows(settingRows);
  persist();
}

function loginPage() {
  return `<main class="login-page">
    <section class="login-intro">
      <div class="login-brand"><div class="brand-mark">A</div><div><strong>AGF</strong><span>Capital</span></div></div>
      <div class="login-copy"><p class="eyebrow">OPERACAO COMERCIAL</p><h1>Uma base. Uma visao clara do proximo movimento.</h1><p>O CRM organiza os sinais, o contexto e cada conversa em uma operacao compartilhada pela equipe.</p></div>
      <div class="login-signal-card"><div><span class="signal-dot"></span><small>SISTEMA PRONTO</small></div><strong>Leads qualificados</strong><p>Vagas e middle market chegam filtrados, enriquecidos e prontos para revisao.</p><div class="signal-steps"><span>Extracao</span><i></i><span>Revisao</span><i></i><span>Conversa</span><i></i><span>Call</span></div></div>
      <p class="login-footnote">Base compartilhada: todos veem os mesmos leads e o mesmo kanban.</p>
    </section>
    <section class="login-panel"><div class="login-card"><p class="eyebrow">ACESSO RESTRITO</p><h2>Entre na operacao.</h2><p>Use o e-mail e a senha cadastrados para sua equipe.</p><form id="login-form"><label>E-mail<input type="email" name="email" autocomplete="email" placeholder="nome@agfcapital.com.br" required></label><label>Senha<input type="password" name="password" autocomplete="current-password" placeholder="Sua senha" required></label><button class="button primary" type="submit">Entrar no CRM <span>→</span></button></form><div class="login-security"><b>Ambiente protegido</b><span>O acesso controla permissao; nao cria bases ou pipelines separados.</span></div></div></section>
  </main>`;
}

function operatorName() {
  const email = state.remote.session?.user?.email;
  if (!email) return "Operador AGF";
  return email.split("@")[0].split(/[._-]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function appShell(content) {
  return `<div class="crm-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">A</div><div><strong>AGF</strong><span>Capital</span></div></div>
      <nav>
        <button data-page="operation" class="nav-item ${state.page === "operation" ? "active" : ""}"><span>01</span> Operacao</button>
        <button data-page="agenda" class="nav-item ${state.page === "agenda" ? "active" : ""}"><span>02</span> Agendamentos <b>${state.leads.filter((lead) => lead.stage === "call_booked").length}</b></button>
        <button data-page="history" class="nav-item ${state.page === "history" ? "active" : ""}"><span>03</span> Historico</button>
      </nav>
      <div class="sidebar-bottom"><button data-action="settings" class="settings-button">Configuracoes</button><button data-action="logout" class="settings-button">Sair</button><div class="operator"><div class="avatar">${operatorName().split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><div><strong>${operatorName()}</strong><span>${state.remote.enabled ? "Base compartilhada" : "Modo local"}</span></div></div></div>
    </aside>
    <section class="workspace">${content}</section>
  </div>`;
}

function header(eyebrow, title, description, actions = "") {
  return `<header class="page-header"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div><div class="header-actions">${actions}</div></header>`;
}

function metrics() {
  const ready = state.leads.filter((lead) => lead.stage === "ready_to_send").length;
  const conversations = state.leads.filter((lead) => lead.stage === "in_conversation").length;
  const booking = state.leads.find((lead) => lead.stage === "call_booked");
  return `<section class="metrics">
    <div><span>Abordagens hoje</span><strong>12</strong><small>Alerta em ${state.settings.dailyAlertAt}</small></div>
    <div><span>Prontos para enviar</span><strong>${ready}</strong><small>Somente perfis qualificados</small></div>
    <div><span>Em conversa</span><strong>${conversations}</strong><small>Acao humana necessaria</small></div>
    <div class="accent"><span>Proxima call</span><strong>${booking?.meeting?.split("|")[0] || "--"}</strong><small>${booking?.company || "Nenhuma call marcada"}</small></div>
  </section>`;
}

function card(lead) {
  return `<article class="lead-card" draggable="true" data-lead="${lead.id}" tabindex="0">
    <div class="card-top"><span class="badge ${sourceClass(lead.source)}">${lead.source}</span><span class="score ${scoreClass(lead.score)}">${lead.score}/10</span></div>
    <h3>${lead.company}</h3><p class="contact">${lead.contact}<span>${lead.role}</span></p>
    <p class="trigger">${lead.trigger}</p>
    ${lead.meeting ? `<p class="meeting">${lead.meeting}</p>` : ""}
    <footer><span>${lead.id}</span><span>${lead.realEconomy ? "Economia real" : "Setor a revisar"}</span></footer>
  </article>`;
}

function emptyStage(stage) {
  const messages = { approved: "Aprovacoes ficam prontas para o convite.", send_message: "Ao mover aqui, o CRM prepara o disparo para revisao.", scheduling: "Leads interessados recebem o link de agenda.", concluded: "O historico comercial permanece aqui." };
  return `<div class="empty-state">${messages[stage] || "Sem leads nesta etapa."}</div>`;
}

function operationPage() {
  const board = stages.map(([key, label]) => {
    const items = state.leads.filter((lead) => lead.stage === key);
    return `<section class="kanban-column" data-stage="${key}"><header><h2>${label}</h2><span>${items.length}</span></header><div class="cards">${items.map(card).join("") || emptyStage(key)}</div></section>`;
  }).join("");
  return appShell(`${header("OPERACAO | leads qualificados", "Leads que pedem acao hoje", "A lista ja aplica os filtros de perfil, contato e sinal. O operador apenas revisa e avanca o card.", `<button class="button secondary" data-action="extraction">Extracao extra</button><button class="button primary" data-action="settings">Ajustar extracao</button>`)}
    ${metrics()}
    <div class="board-caption"><span>Arraste os cards lateralmente para avancar o lead. Clique em um card para ver o contexto completo.</span><div><span class="status-dot"></span> Extracao automatica ${state.settings.extractionEnabled ? `ativa | ${state.settings.extractionTime}` : "pausada"}</div></div>
    <div class="kanban-scroll"><div class="kanban">${board}</div></div>
    ${state.selectedId ? leadDrawer(leadById(state.selectedId)) : ""}
    ${state.settingsOpen ? settingsModal() : ""}`);
}

function leadDrawer(lead) {
  if (!lead) return "";
  const isVacancy = lead.source === "Vagas";
  const breakdown = lead.scoreBreakdown || { companySize: 0, urgency: isVacancy ? 0 : null, financialMoment: isVacancy ? null : 0, decisionMaker: 0, realEconomy: lead.realEconomy ? 2 : 0 };
  const scores = isVacancy
    ? [["Porte", `${breakdown.companySize}/3`], ["Urgencia", `${breakdown.urgency || 0}/3`], ["Decisor", `${breakdown.decisionMaker}/2`], ["Economia real", `${breakdown.realEconomy}/2`]]
    : [["Porte", `${breakdown.companySize}/3`], ["Momento financeiro", `${breakdown.financialMoment || 0}/3`], ["Decisor", `${breakdown.decisionMaker}/2`], ["Economia real", `${breakdown.realEconomy}/2`]];
  const following = nextStage(lead.stage);
  return `<div class="backdrop" data-action="close-detail"></div><aside class="lead-drawer" role="dialog" aria-label="Detalhes de ${lead.company}">
    <header><span class="badge ${sourceClass(lead.source)}">${lead.source}</span><button data-action="close-detail" aria-label="Fechar">x</button></header>
    <p class="eyebrow">${lead.id} | ${stageNames[lead.stage]}</p><h2>${lead.company}</h2><p class="drawer-contact">${lead.contact} | ${lead.role}</p><button class="text-link" data-action="linkedin">Abrir perfil do LinkedIn</button>
    <div class="profile-gate"><strong>Perfil aprovado</strong><span>${lead.profile}</span></div>
    <div class="score-breakdown"><div><span>Score comercial</span><strong>${lead.score}<small>/10</small></strong></div><ul>${scores.map(([name, value]) => `<li>${name}<b>${value}</b></li>`).join("")}</ul></div>
    <section><h3>Gatilho</h3><p>${lead.trigger}</p></section><section><h3>Contexto recente</h3><p>${lead.news}</p><button class="text-link" data-action="source">Fonte e evidencia</button></section>
    ${lead.meeting ? `<div class="calendar-block"><strong>${lead.meeting}</strong><span>Evento reservado no Google Calendar</span></div>` : ""}
    <section><h3>Rascunho de mensagem</h3><pre>${escapeHtml(lead.message)}</pre><button class="text-link" data-action="edit">Editar rascunho</button></section>
    <section><h3>Historico</h3><ul class="history-list">${lead.history.map((item) => `<li>${item}</li>`).join("")}</ul></section>
    <footer><button class="button secondary" data-action="close-detail">Fechar</button>${following ? `<button class="button primary" data-action="advance" data-lead="${lead.id}" data-stage="${following}">Mover para ${stageNames[following]}</button>` : ""}</footer>
  </aside>`;
}

function settingsModal() {
  const setting = state.settings;
  return `<div class="backdrop" data-action="close-settings"></div><section class="settings-modal" role="dialog" aria-label="Configuracoes">
    <header><div><p class="eyebrow">ADMINISTRACAO</p><h2>Configuracoes da operacao</h2><p>Todos os operadores com acesso podem ajustar estes parametros.</p></div><button data-action="close-settings" aria-label="Fechar">x</button></header>
    <form id="settings-form">
      <section><div><h3>Extracao de leads</h3><p>Somente contatos aprovados pelos filtros entram no CRM.</p></div><label class="switch"><input name="extractionEnabled" type="checkbox" ${setting.extractionEnabled ? "checked" : ""}><span></span> Rotina automatica</label><div class="field-grid"><label>Horario<input name="extractionTime" type="time" value="${setting.extractionTime}"></label><label>Vagas<input name="vacancyCount" type="number" min="1" value="${setting.vacancyCount}"></label><label>Middle market<input name="middleMarketCount" type="number" min="1" value="${setting.middleMarketCount}"></label></div></section>
      <section><div><h3>Envio</h3><p>A integracao real ainda depende da credencial do LinkedIn e permanece desligada neste ambiente.</p></div><div class="field-grid"><label>Inicio<input name="sendStart" type="time" value="${setting.sendStart}"></label><label>Fim<input name="sendEnd" type="time" value="${setting.sendEnd}"></label><label>Alerta diario<input name="dailyAlertAt" type="number" min="1" value="${setting.dailyAlertAt}"></label></div></section>
      <section><div><h3>Calls</h3><p>Slots de 30 minutos, em :00, :15, :30 ou :45.</p></div><div class="field-grid"><label>Duracao<input type="number" value="${setting.callDuration}" readonly></label><label>Intervalo<input type="number" value="${setting.slotInterval}" readonly></label></div></section>
      <footer><button type="button" class="button secondary" data-action="close-settings">Cancelar</button><button type="submit" class="button primary">Salvar configuracoes</button></footer>
    </form>
  </section>`;
}

function agendaPage() {
  const bookings = state.leads.filter((lead) => lead.stage === "call_booked");
  return appShell(`${header("AGENDA", "Calls confirmadas", "Cada evento deve ser criado pelo Google Calendar com Meet e confirmacao automatica.", `<button class="button secondary" data-action="settings">Configuracoes de agenda</button>`)}
    <section class="agenda-list">${bookings.length ? bookings.map((lead) => `<button class="agenda-row" data-lead="${lead.id}"><span class="agenda-time">${lead.meeting || "Horario pendente"}</span><div><strong>${lead.company}</strong><small>${lead.contact} | ${lead.role}</small></div><span>Ver card</span></button>`).join("") : `<div class="empty-page">Nenhuma call marcada.</div>`}</section>
    ${state.selectedId ? leadDrawer(leadById(state.selectedId)) : ""}${state.settingsOpen ? settingsModal() : ""}`);
}

function historyPage() {
  const rows = [...state.leads].sort((a, b) => a.company.localeCompare(b.company));
  return appShell(`${header("HISTORICO", "Empresas e contatos", "Um card ativo por empresa; sinais muito fortes podem reabrir o mesmo historico.")}
    <section class="history-table"><div class="history-head"><span>Empresa e contato</span><span>Origem</span><span>Score</span><span>Etapa</span></div>${rows.map((lead) => `<button class="history-row" data-lead="${lead.id}"><div><strong>${lead.company}</strong><small>${lead.contact} | ${lead.role}</small></div><span>${lead.source}</span><span class="score ${scoreClass(lead.score)}">${lead.score}/10</span><span>${stageNames[lead.stage]}</span></button>`).join("")}</section>
    ${state.selectedId ? leadDrawer(leadById(state.selectedId)) : ""}${state.settingsOpen ? settingsModal() : ""}`);
}

function render() {
  if (state.remote.loading) {
    root.innerHTML = `<main class="loading-page">Carregando CRM AGF...</main>`;
    return;
  }
  if (state.remote.enabled && !state.remote.session?.access_token) {
    root.innerHTML = loginPage();
    bindEvents();
    return;
  }
  root.innerHTML = state.page === "agenda" ? agendaPage() : state.page === "history" ? historyPage() : operationPage();
  bindEvents();
}

function toast(message) {
  document.querySelector(".toast")?.remove();
  const node = document.createElement("div"); node.className = "toast"; node.textContent = message; document.body.append(node); setTimeout(() => node.remove(), 3200);
}

async function updateLeadStage(id, stage) {
  const lead = leadById(id); if (!lead || lead.stage === stage) return;
  try {
    if (state.remote.enabled) {
      await supabaseRequest(`/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ current_stage: stage }),
      });
    }
    lead.history.unshift(`Etapa movida para ${stageNames[stage]}`); lead.stage = stage; persist(); state.selectedId = id; render();
  } catch (error) {
    toast(error.message || "A etapa nao foi atualizada.");
    return;
  }
  const notices = { send_message: "Mensagem preparada para o piloto. Nenhum envio real foi efetuado.", scheduling: "Link de agendamento sera preparado na integracao do Calendar.", call_booked: "Call marcada. O horario aparece no card." };
  toast(notices[stage] || `Etapa atualizada: ${stageNames[stage]}.`);
}

async function requestExtraExtraction() {
  if (!state.remote.enabled || !state.remote.session?.access_token) {
    toast("Entre no CRM para solicitar uma extracao.");
    return;
  }
  try {
    const response = await fetch("/api/extractions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${state.remote.session.access_token}`,
      },
      body: JSON.stringify({
        vacancyCount: state.settings.vacancyCount,
        middleMarketCount: state.settings.middleMarketCount,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Nao foi possivel solicitar a extracao.");
    toast("Extracao enviada ao n8n. Apenas perfis aprovados entram no CRM.");
  } catch (error) {
    toast(error.message || "Nao foi possivel solicitar a extracao.");
  }
}

function bindEvents() {
  document.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => { state.page = button.dataset.page; state.selectedId = null; render(); }));
  document.querySelectorAll("[data-lead]").forEach((element) => {
    element.addEventListener("click", (event) => { if (event.target.closest("[data-action=advance]")) return; state.selectedId = element.dataset.lead; render(); });
  });
  document.querySelectorAll(".lead-card").forEach((cardNode) => {
    cardNode.addEventListener("dragstart", () => { state.draggedId = cardNode.dataset.lead; cardNode.classList.add("dragging"); });
    cardNode.addEventListener("dragend", () => { state.draggedId = null; cardNode.classList.remove("dragging"); });
  });
  document.querySelectorAll(".kanban-column").forEach((column) => {
    column.addEventListener("dragover", (event) => { event.preventDefault(); column.classList.add("drop-target"); });
    column.addEventListener("dragleave", () => column.classList.remove("drop-target"));
    column.addEventListener("drop", (event) => { event.preventDefault(); column.classList.remove("drop-target"); if (state.draggedId) void updateLeadStage(state.draggedId, column.dataset.stage); });
  });
  document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", (event) => {
    const action = button.dataset.action;
    if (action === "close-detail") { state.selectedId = null; render(); }
    if (action === "settings") { state.settingsOpen = true; render(); }
    if (action === "close-settings") { state.settingsOpen = false; render(); }
    if (action === "advance") void updateLeadStage(button.dataset.lead, button.dataset.stage);
    if (action === "extraction") void requestExtraExtraction();
    if (action === "linkedin" || action === "source" || action === "edit") toast("Acao preparada para a integracao. Nenhum site externo foi aberto nesta versao local.");
    if (action === "logout") { writeSession(null); state.selectedId = null; render(); }
  }));
  document.querySelector("#settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    state.settings = { ...state.settings, extractionEnabled: values.get("extractionEnabled") === "on", extractionTime: values.get("extractionTime"), vacancyCount: Number(values.get("vacancyCount")), middleMarketCount: Number(values.get("middleMarketCount")), sendStart: values.get("sendStart"), sendEnd: values.get("sendEnd"), dailyAlertAt: Number(values.get("dailyAlertAt")) };
    try {
      if (state.remote.enabled) await saveRemoteSettings();
      state.settingsOpen = false; persist(); render(); toast(state.remote.enabled ? "Configuracoes salvas no Supabase." : "Configuracoes salvas localmente.");
    } catch (error) { toast(error.message || "As configuracoes nao foram salvas."); }
  });
  document.querySelector("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault(); const values = new FormData(event.currentTarget); const submit = event.currentTarget.querySelector("button[type=submit]");
    submit.disabled = true; submit.textContent = "Entrando...";
    try { await signIn(values.get("email"), values.get("password")); await loadRemoteData(); state.page = "operation"; render(); }
    catch (error) { submit.disabled = false; submit.textContent = "Entrar no CRM"; toast(error.message || "Nao foi possivel entrar."); }
  });
}

async function saveRemoteSettings() {
  const extraction = { enabled: state.settings.extractionEnabled, time: state.settings.extractionTime, timezone: "America/Sao_Paulo", weekdays: [1, 2, 3, 4, 5], vacancy_count: state.settings.vacancyCount, middle_market_count: state.settings.middleMarketCount };
  const outbound = { start: state.settings.sendStart, end: state.settings.sendEnd, timezone: "America/Sao_Paulo", daily_alert_at: state.settings.dailyAlertAt };
  await Promise.all([
    supabaseRequest("/rest/v1/app_settings?setting_key=eq.lead_extraction", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ value: extraction }) }),
    supabaseRequest("/rest/v1/app_settings?setting_key=eq.outbound", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ value: outbound }) }),
  ]);
}

async function bootstrap() {
  try {
    state.remote.config = await fetchConfiguration();
    state.remote.enabled = isRemoteConfigured();
    if (state.remote.enabled && state.remote.session?.access_token) await loadRemoteData();
  } catch (error) {
    state.remote.enabled = false;
    toast("A configuracao remota nao foi carregada. O CRM abriu em modo local.");
  } finally {
    state.remote.loading = false;
    render();
  }
}

void bootstrap();
