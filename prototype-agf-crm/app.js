// PROTÓTIPO VISUAL — dados locais, sem integração ou persistência.
const leads = [
  {
    id: "V-042",
    company: "Vértice Logística",
    contact: "Marina Teixeira",
    role: "CFO",
    source: "Vagas",
    score: 8,
    status: "Prontos para enviar",
    trigger: "abriu posição de Controller Corporativo",
    news: "Expansão de dois centros de distribuição anunciada em junho.",
    fit: "Alta",
    message: "Marina, tudo bem? Obrigado por aceitar o convite.\n\nVi a expansão da Vértice junto à busca por alguém para a controladoria corporativa. Imagino que usar AI de verdade no financeiro, sem virar projeto eterno, esteja na pauta aí também.",
  },
  {
    id: "MM-118",
    company: "Céu Azul Alimentos",
    contact: "Renato Duarte",
    role: "CEO",
    source: "Middle market",
    score: 7,
    status: "Prontos para enviar",
    trigger: "crescimento regional e emissão de debêntures",
    news: "Captação para expansão industrial noticiada há dois meses.",
    fit: "Alta",
    message: "Renato, tudo bem? Obrigado por aceitar o convite.\n\nVi o momento de expansão da Céu Azul e a recente emissão de debêntures. Imagino que usar AI de verdade no financeiro, sem virar projeto eterno, esteja na pauta aí também.",
  },
  {
    id: "V-041",
    company: "NorteSul Varejo",
    contact: "Bianca Salles",
    role: "Diretora Financeira",
    source: "Vagas",
    score: 7,
    status: "Convite enviado",
    trigger: "busca por analista de FP&A",
    news: "Nenhuma notícia financeira relevante nos últimos seis meses.",
    fit: "Média",
    message: "Bianca, tudo bem? Obrigado por aceitar o convite.\n\nVi a busca da NorteSul por alguém em FP&A. Imagino que usar AI de verdade no financeiro, sem virar projeto eterno, esteja na pauta aí também.",
  },
  {
    id: "MM-117",
    company: "Rota Oeste Transportes",
    contact: "Alexandre Campos",
    role: "CFO",
    source: "Middle market",
    score: 6,
    status: "Em conversa",
    trigger: "nova unidade e aumento de capacidade operacional",
    news: "Empresa comunicou abertura de filial no Centro-Oeste em maio.",
    fit: "Alta",
    message: "Alexandre, tudo bem? Obrigado por aceitar o convite.",
  },
  {
    id: "V-038",
    company: "Horizonte Saúde",
    contact: "Paula Nascimento",
    role: "Head de Finanças",
    source: "Vagas",
    score: 7,
    status: "Call marcada",
    trigger: "contratação para Controladoria e FP&A",
    news: "Aquisição de clínica regional confirmada em abril.",
    fit: "Alta",
    meeting: "Amanhã, 14:30 · Google Meet",
    message: "Paula, tudo bem? Obrigado por aceitar o convite.",
  },
];

const variantMeta = {
  A: "A — Kanban operacional",
  B: "B — Foco diário",
  C: "C — Mesa de inteligência",
};

const state = { selected: leads[0].id, toast: "" };
const app = document.querySelector("#app");
const icons = {
  spark: "✦",
  calendar: "◷",
  search: "⌕",
  arrow: "→",
  settings: "⚙",
};

function currentVariant() {
  const value = new URLSearchParams(window.location.search).get("variant");
  return variantMeta[value] ? value : "A";
}

function leadById(id) {
  return leads.find((lead) => lead.id === id) ?? leads[0];
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;",
  }[character]));
}

function scoreTone(score) {
  return score >= 7 ? "score-high" : score >= 5 ? "score-medium" : "score-low";
}

function card(lead, compact = false) {
  return `
    <article class="lead-card ${lead.id === state.selected ? "is-selected" : ""}" data-lead-id="${lead.id}" tabindex="0">
      <div class="card-topline">
        <span class="source-badge source-${lead.source === "Vagas" ? "job" : "middle"}">${lead.source}</span>
        <span class="score ${scoreTone(lead.score)}">${lead.score}/8</span>
      </div>
      <h3>${lead.company}</h3>
      <p class="contact">${lead.contact} <span>· ${lead.role}</span></p>
      ${compact ? "" : `<p class="trigger">${lead.trigger}</p>`}
      <div class="card-footer"><span>${lead.id}</span><span>${lead.fit} fit</span></div>
    </article>`;
}

function pageShell(content, active = "Operação") {
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">A</div><div><strong>AGF</strong><span>Capital</span></div></div>
        <nav>
          <button class="nav-item ${active === "Operação" ? "active" : ""}"><span>◫</span> Operação</button>
          <button class="nav-item"><span>◌</span> Agendamentos <b>1</b></button>
          <button class="nav-item"><span>◒</span> Histórico</button>
        </nav>
        <div class="sidebar-bottom">
          <button class="settings"><span>${icons.settings}</span> Configurações</button>
          <div class="user"><div class="avatar">GF</div><div><strong>Giulio Ferraro</strong><span>LinkedIn conectado</span></div></div>
        </div>
      </aside>
      <section class="workspace">${content}</section>
    </div>`;
}

function pageHeader({ eyebrow, title, description, actions = "" }) {
  return `
    <header class="page-header">
      <div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="page-description">${description}</p></div>
      <div class="header-actions">${actions}</div>
    </header>`;
}

function metrics() {
  return `
    <div class="metrics">
      <div class="metric"><span>Abordagens hoje</span><strong>12</strong><small>Alerta em 20</small></div>
      <div class="metric"><span>Prontos para enviar</span><strong>18</strong><small>5 vagas · 13 middle</small></div>
      <div class="metric"><span>Em conversa</span><strong>4</strong><small>1 call marcada</small></div>
      <div class="metric metric-highlight"><span>Próxima call</span><strong>14:30</strong><small>Horizonte Saúde</small></div>
    </div>`;
}

function variantA() {
  const columns = [
    ["Prontos para enviar", leads.filter((lead) => lead.status === "Prontos para enviar")],
    ["Aprovado", []],
    ["Convite enviado", leads.filter((lead) => lead.status === "Convite enviado")],
    ["Enviar mensagem", []],
    ["Em conversa", leads.filter((lead) => lead.status === "Em conversa")],
    ["Agendamento", []],
    ["Call marcada", leads.filter((lead) => lead.status === "Call marcada")],
    ["Concluído", []],
  ];
  const content = `
    ${pageHeader({
      eyebrow: "Operação · segunda-feira, 20 de julho",
      title: "Leads que pedem ação hoje",
      description: "Tudo já foi filtrado. Escolha quem deve receber a próxima abordagem.",
      actions: `<button class="button secondary" data-action="pull">${icons.search} Puxada extra</button><button class="button primary" data-action="settings">${icons.settings} Ajustar puxada</button>`,
    })}
    ${metrics()}
    <div class="board-caption"><span>Arraste lateralmente ou use as setas para percorrer todo o fluxo.</span><div class="board-tools"><button class="board-scroll" data-action="scroll-board-left" aria-label="Ver etapas anteriores">←</button><button class="board-scroll" data-action="scroll-board-right" aria-label="Ver próximas etapas">→</button><span class="live-dot">● Automação matinal ativa · 08:00</span></div></div>
    <div class="kanban-scroller" tabindex="0" aria-label="Etapas do pipeline">
    <div class="kanban">
      ${columns.map(([name, items]) => `
        <section class="kanban-column"><div class="column-title"><h2>${name}</h2><span>${items.length}</span></div>
          <div class="column-cards">${items.map((lead) => card(lead)).join("") || `<div class="empty-state">${name === "Aprovado" ? "Aprovar o convite libera o disparo." : name === "Enviar mensagem" ? "Após o aceite, arraste aqui para enviar." : name === "Agendamento" ? "Leads com interesse entram aqui." : name === "Concluído" ? "Convertidos e não convertidos ficam registrados aqui." : "Sem leads nesta etapa."}</div>`}</div>
          ${name === "Prontos para enviar" ? `<button class="ghost-action" data-action="approve">+ Aprovar próximo convite</button>` : ""}
        </section>`).join("")}
    </div></div>`;
  return pageShell(content);
}

function detailPanel(lead) {
  const meeting = lead.meeting ? `<div class="meeting-block"><span>${icons.calendar}</span><div><strong>${lead.meeting}</strong><small>Evento reservado no Google Calendar</small></div><button>Ver</button></div>` : "";
  return `
    <aside class="lead-detail">
      <div class="detail-heading"><span class="source-badge source-${lead.source === "Vagas" ? "job" : "middle"}">${lead.source}</span><button class="close-detail" data-action="close">×</button></div>
      <h2>${lead.company}</h2><p class="detail-contact">${lead.contact} · ${lead.role}</p>
      <a href="#" class="linkedin-link">Ver perfil no LinkedIn ${icons.arrow}</a>
      <div class="score-breakdown"><div><span>Score total</span><strong>${lead.score}<small>/8</small></strong></div><ul><li>Porte <b>3/3</b></li><li>${lead.source === "Vagas" ? "Urgência" : "Momento"} <b>${lead.score - 5}/3</b></li><li>Decisor <b>2/2</b></li></ul></div>
      <section class="detail-section"><h3>Gatilho</h3><p>${lead.trigger}</p></section>
      <section class="detail-section"><h3>Contexto recente</h3><p>${lead.news}</p><a href="#">Abrir fonte ↗</a></section>
      ${meeting}
      <section class="detail-section message-preview"><h3>Rascunho de mensagem</h3><p>${escapeHtml(lead.message).replace(/\n/g, "<br>")}</p><button class="text-button" data-action="edit">Editar rascunho</button></section>
      <div class="detail-actions"><button class="button secondary" data-action="history">Ver histórico</button><button class="button primary" data-action="approve">Aprovar convite</button></div>
    </aside>`;
}

function variantB() {
  const lead = leadById(state.selected);
  const list = [...leads].sort((a, b) => b.score - a.score);
  const content = `
    ${pageHeader({
      eyebrow: "Foco do dia · 12 de 20 abordagens",
      title: "Uma decisão de cada vez",
      description: "O CRM organiza o contexto; o Giulio só decide se avança com cada empresa.",
      actions: `<button class="button secondary" data-action="pull">${icons.search} Puxada extra</button>`,
    })}
    <div class="focus-layout">
      <section class="priority-list"><div class="list-header"><div><h2>Prioridade de hoje</h2><p>Ordenado por sinal e qualidade</p></div><span>18</span></div>
      <div class="priority-scroll">${list.map((item, index) => `
        <button class="priority-row ${item.id === lead.id ? "selected" : ""}" data-lead-id="${item.id}"><span class="priority-number">${String(index + 1).padStart(2, "0")}</span><div><strong>${item.company}</strong><small>${item.contact} · ${item.role}</small></div><span class="score ${scoreTone(item.score)}">${item.score}</span></button>`).join("")}</div>
      <button class="load-more">Ver todos os leads prontos →</button></section>
      <section class="focus-brief">
        <div class="brief-top"><span class="source-badge source-${lead.source === "Vagas" ? "job" : "middle"}">${lead.source}</span><span class="status-pill">${lead.status}</span></div>
        <p class="eyebrow">${lead.id} · Pontuação ${lead.score}/8</p><h2>${lead.company}</h2><p class="lead-role">${lead.contact} · ${lead.role}</p>
        <div class="brief-hero"><span>${icons.spark}</span><div><small>Por que agora</small><p>${lead.trigger}</p></div></div>
        <div class="brief-grid"><section><h3>Leitura da empresa</h3><p>${lead.news}</p><a href="#">Abrir fonte</a></section><section><h3>Fit de contato</h3><p><strong>${lead.fit}</strong> — decisor com contexto direto do momento financeiro.</p></section></div>
        <section class="message-box"><div><span>Rascunho pronto</span><button class="text-button" data-action="edit">Editar</button></div><p>${escapeHtml(lead.message).replace(/\n/g, "<br>")}</p></section>
        <div class="focus-actions"><button class="button danger" data-action="skip">Segurar</button><button class="button primary large" data-action="approve">Aprovar e enviar convite ${icons.arrow}</button></div>
      </section>
      <aside class="day-rail"><h2>Hoje</h2><div class="day-progress"><div class="progress-ring"><strong>12</strong><span>de 20</span></div><p>O alerta aparece ao chegar em 20; o envio pode continuar.</p></div><div class="rail-divider"></div><h3>Próxima call</h3><div class="rail-call"><span>${icons.calendar}</span><div><strong>14:30</strong><small>Horizonte Saúde</small></div></div><a href="#">Abrir agenda do Giulio →</a><div class="rail-divider"></div><h3>Proteções ativas</h3><ul class="safety-list"><li>Envios 09:00–20:00</li><li>Intervalo variável 3–7 min</li><li>Sem duplicidade ativa</li></ul></aside>
    </div>`;
  return pageShell(content);
}

function variantC() {
  const lead = leadById(state.selected);
  const content = `
    ${pageHeader({
      eyebrow: "Inteligência comercial",
      title: "Empresas com sinal verificável",
      description: "Uma mesa de análise para encontrar o melhor próximo movimento antes da abordagem.",
      actions: `<button class="button secondary" data-action="filter">Filtros</button><button class="button primary" data-action="pull">${icons.search} Puxada extra</button>`,
    })}
    <div class="intelligence-layout">
      <section class="lead-table-wrap"><div class="table-toolbar"><div class="search-stub">${icons.search} Buscar empresa ou contato</div><button class="filter-chip active">Todos <b>18</b></button><button class="filter-chip">Vagas <b>5</b></button><button class="filter-chip">Middle market <b>13</b></button></div>
      <div class="lead-table"><div class="table-head"><span>Empresa e contato</span><span>Sinal</span><span>Score</span><span>Etapa</span></div>${leads.map((item) => `
        <button class="table-row ${item.id === lead.id ? "selected" : ""}" data-lead-id="${item.id}"><div><strong>${item.company}</strong><small>${item.contact} · ${item.role}</small></div><div class="table-trigger">${item.trigger}</div><span class="score ${scoreTone(item.score)}">${item.score}/8</span><span class="table-status">${item.status}</span></button>`).join("")}</div></section>
      ${detailPanel(lead)}
    </div>`;
  return pageShell(content, "Operação");
}

function render() {
  const variant = currentVariant();
  app.innerHTML = variant === "A" ? variantA() : variant === "B" ? variantB() : variantC();
  document.querySelector("#variant-name").textContent = variantMeta[variant];
  attachInteractions();
}

function showToast(message) {
  state.toast = message;
  const previous = document.querySelector(".toast");
  if (previous) previous.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

function attachInteractions() {
  document.querySelectorAll("[data-lead-id]").forEach((element) => {
    const choose = () => { state.selected = element.dataset.leadId; render(); };
    element.addEventListener("click", choose);
    element.addEventListener("keydown", (event) => { if (event.key === "Enter") choose(); });
  });
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const action = button.dataset.action;
      const messages = {
        approve: "Protótipo: o convite seria colocado na fila de envio.",
        pull: "Protótipo: a puxada extra seria iniciada sem disparar mensagens.",
        settings: "Protótipo: abriria as configurações exclusivas do Giulio.",
        edit: "Protótipo: o rascunho ficaria editável no card.",
        history: "Protótipo: abriria o histórico completo deste contato.",
        skip: "Protótipo: o lead permaneceria pronto para uma próxima revisão.",
        filter: "Protótipo: abriria os filtros da base.",
        close: "Protótipo: o detalhe seria recolhido.",
        "scroll-board-left": "",
        "scroll-board-right": "",
      };
      if (action === "scroll-board-left" || action === "scroll-board-right") {
        document.querySelector(".kanban-scroller")?.scrollBy({ left: action.endsWith("right") ? 620 : -620, behavior: "smooth" });
        return;
      }
      showToast(messages[action] ?? "Ação de protótipo");
    });
  });
}

function cycleVariant(offset) {
  const values = Object.keys(variantMeta);
  const position = values.indexOf(currentVariant());
  const next = values[(position + offset + values.length) % values.length];
  const params = new URLSearchParams(window.location.search);
  params.set("variant", next);
  window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
  render();
}

document.querySelector("#previous-variant").addEventListener("click", () => cycleVariant(-1));
document.querySelector("#next-variant").addEventListener("click", () => cycleVariant(1));
document.addEventListener("keydown", (event) => {
  if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
  if (event.key === "ArrowLeft") cycleVariant(-1);
  if (event.key === "ArrowRight") cycleVariant(1);
});

render();
