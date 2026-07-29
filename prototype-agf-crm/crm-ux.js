const CRM_TIMEZONE = "America/Sao_Paulo";

function dateParts(value, withTime) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const options = withTime
    ? { timeZone: CRM_TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
    : { timeZone: CRM_TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric" };
  return Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", options)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

export function formatCrmDate(value, withTime = true) {
  if (!value) return "--";
  const parts = dateParts(value, withTime);
  if (!parts) return "--";
  const date = `${parts.day}/${parts.month}/${parts.year}`;
  return withTime ? `${date} ${parts.hour}:${parts.minute}` : date;
}

function normalizeSearchText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchLeads(leads, query) {
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  if (!terms.length) return [];
  return leads.filter((lead) => {
    const haystack = normalizeSearchText([
      lead.company,
      lead.contact,
      lead.role,
      lead.linkedinUrl,
      lead.industry,
      lead.location,
      lead.organizationLabel,
      lead.responsibleName,
    ].filter(Boolean).join(" "));
    return terms.every((term) => haystack.includes(term));
  });
}

export function leadAgeState(updatedAt, now = new Date()) {
  if (!updatedAt) return null;
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return null;
  const days = Math.max(0, Math.floor((new Date(now).getTime() - updated.getTime()) / 86_400_000));
  if (days < 7) return null;
  return {
    days,
    tone: days >= 14 ? "critical" : "warning",
    label: `Parado ha ${days} ${days === 1 ? "dia" : "dias"}`,
  };
}

export function parseBrlCurrency(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const clean = String(value || "").replace(/[^\d,.-]/g, "").trim();
  if (!clean) return null;
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function formatBrlCurrency(value) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(number);
}

export function dimensionConversion(leads, dimension, convertedLeadIds = new Set()) {
  const advancedStages = new Set(["em_conversa", "agendamento", "call_marcada", "concluido"]);
  const groups = new Map();
  leads.forEach((lead) => {
    const key = String(dimension(lead) || "Nao informado").trim() || "Nao informado";
    const current = groups.get(key) || { label: key, total: 0, advanced: 0 };
    current.total += 1;
    if (advancedStages.has(lead.stage) || convertedLeadIds.has(lead.id)) current.advanced += 1;
    groups.set(key, current);
  });
  return [...groups.values()]
    .map((item) => ({ ...item, rate: item.total ? Math.round((item.advanced / item.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "pt-BR"));
}

export function projectValueByStage(projects, stages) {
  return stages.map(([stage, label]) => {
    const matching = projects.filter((project) => project.currentStage === stage);
    return {
      stage,
      label,
      count: matching.length,
      value: matching.reduce((total, project) => {
        const value = Number(project.estimated_value);
        return total + (Number.isFinite(value) ? value : 0);
      }, 0),
    };
  });
}
