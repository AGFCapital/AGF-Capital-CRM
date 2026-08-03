export const defaultMessageTemplates = Object.freeze({
  inviteNote: "{Nome}, tudo bem? Tenho conversado com empresas como a {Empresa} sobre como aplicar IA no financeiro de forma prática. Achei que faria sentido nos conectarmos por aqui.",
  linkedinMessage: "{Nome}, tudo bem? Obrigado por aceitar o convite.\n\nTenho conversado com empresas como a {Empresa} sobre como aplicar inteligência artificial no financeiro de forma prática, sem transformar a iniciativa em um projeto longo, complexo e distante da operação.\n\nMontei a AGF exatamente com esse propósito. Contamos com profissionais vindos das principais consultorias do Brasil, que atuam diretamente no dia a dia das empresas, do operacional ao estratégico, identificando oportunidades e desenvolvendo automações ao longo do processo.\n\nEu venho de mais de 10 anos entre banking e corporate development e também fundei uma empresa na qual captei recursos com investidores institucionais.\n\nTopa uma conversa de 15 a 30 minutos para eu me apresentar e entender melhor o momento da {Empresa}?",
  scheduling: "Perfeito, {Nome}. Para facilitar, deixei alguns horários livres na minha agenda aqui: {link}. Se nenhum fizer sentido, me avise que buscamos outro.",
  bookingThanks: "Perfeito, {Nome}. Obrigado por agendar. Nossa conversa ficou marcada para {data_hora}. Até lá!",
});

export const messageTemplateFields = Object.freeze([
  { key: "inviteNote", storageKey: "invite_note", label: "Nota do convite", requiredTokens: ["{Nome}", "{Empresa}"] },
  { key: "linkedinMessage", storageKey: "linkedin_message", label: "Mensagem após o aceite", requiredTokens: ["{Nome}", "{Empresa}"] },
  { key: "scheduling", storageKey: "scheduling", label: "Mensagem de agendamento", requiredTokens: ["{Nome}", "{link}"] },
  { key: "bookingThanks", storageKey: "booking_thanks", label: "Agradecimento da call", requiredTokens: ["{Nome}", "{data_hora}"] },
]);

export function readMessageTemplates(value = {}) {
  return messageTemplateFields.reduce((templates, field) => {
    const stored = value?.[field.storageKey];
    templates[field.key] = typeof stored === "string" && stored.trim()
      ? stored
      : defaultMessageTemplates[field.key];
    return templates;
  }, {});
}

export function serializeMessageTemplates(templates = {}) {
  return messageTemplateFields.reduce((value, field) => {
    value[field.storageKey] = String(templates[field.key] || "").trim();
    return value;
  }, {});
}

export function validateMessageTemplates(templates = {}) {
  for (const field of messageTemplateFields) {
    const body = String(templates[field.key] || "").trim();
    if (!body) return `${field.label}: o texto não pode ficar vazio.`;
    const missing = field.requiredTokens.filter((token) => !body.includes(token));
    if (missing.length) return `${field.label}: mantenha ${missing.join(" e ")} no texto.`;
  }
  return null;
}

export function renderMessageTemplate(template, replacements = {}) {
  return Object.entries(replacements).reduce(
    (body, [token, value]) => body.replaceAll(`{${token}}`, value ?? ""),
    String(template || ""),
  );
}
