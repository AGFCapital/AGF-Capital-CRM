function encodingDamageScore(value = "") {
  return (String(value).match(/\uFFFD|Ã.|Â.|â[\u0080-\uFFFF]/g) || []).length;
}

function repairMojibake(value = "") {
  const text = String(value).trim().normalize("NFC");
  if (!/[ÃÂ]/.test(text) || [...text].some((char) => char.codePointAt(0) > 255)) return text;
  try {
    const bytes = Uint8Array.from([...text], (char) => char.codePointAt(0));
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(bytes).normalize("NFC");
    return encodingDamageScore(repaired) < encodingDamageScore(text) ? repaired : text;
  } catch {
    return text;
  }
}

function normaliseText(value = "") {
  return repairMojibake(value);
}

export function decodeApolloCsv(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  const windows1252 = new TextDecoder("windows-1252").decode(bytes);
  return encodingDamageScore(utf8) <= encodingDamageScore(windows1252) ? utf8 : windows1252;
}

export function normalizeCompanyName(value = "") {
  return normaliseText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/\b(s\/?a|ltda|limitada|eireli|me)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeLinkedInUrl(value = "") {
  try {
    const url = new URL(normaliseText(value));
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, "").toLowerCase();
    return url.hostname.toLowerCase().includes("linkedin.com") && path.startsWith("/in/")
      ? `https://www.linkedin.com${path}`
      : "";
  } catch {
    return "";
  }
}

function delimiterFor(header = "") {
  return header.split(";").length > header.split(",").length ? ";" : ",";
}

export function parseApolloCsv(text) {
  const delimiter = delimiterFor(String(text).split(/\r?\n/, 1)[0]);
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      row.push(value);
      value = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
      continue;
    }
    value += char;
  }

  row.push(value);
  if (row.some((cell) => cell !== "")) rows.push(row);
  const [headers = [], ...data] = rows;
  return data.map((cells, rowIndex) => Object.fromEntries(
    headers.map((header, columnIndex) => [header, cells[columnIndex] || ""]).concat([["__row", rowIndex + 2]]),
  ));
}

function apolloCompanySize(employeeCount) {
  const count = Number(employeeCount);
  if (!Number.isFinite(count)) return null;
  if (count > 1000) return "large";
  if (count >= 201) return "medium";
  return "small";
}

function apolloNumber(value) {
  const raw = normaliseText(value).replace(/[^0-9.-]/g, "");
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function websiteDomain(value) {
  try {
    return new URL(normaliseText(value)).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Deep import module interface: receive a file and return only the records
 * safe to persist. The caller never needs Apollo's column names, delimiter,
 * normalisation rules, or internal de-duplication behaviour.
 */
export function prepareApolloImport(fileText, fileName) {
  const rows = parseApolloCsv(fileText);
  const extractedAt = new Date().toISOString();
  const records = [];
  const invalidRows = [];
  const duplicateRows = [];
  const seenCompanies = new Set();
  const seenContacts = new Set();

  rows.forEach((row) => {
    const cell = (column) => normaliseText(row[column]);
    const companyName = cell("Company Name");
    const fullName = `${cell("First Name")} ${cell("Last Name")}`.trim();
    const linkedinUrl = normalizeLinkedInUrl(cell("Person Linkedin Url"));

    if (!companyName || !fullName || !linkedinUrl) {
      invalidRows.push({ row: row.__row, reason: "Empresa, nome ou LinkedIn ausente/inválido." });
      return;
    }

    const normalizedCompany = normalizeCompanyName(companyName);
    if (seenCompanies.has(normalizedCompany)) {
      duplicateRows.push({ row: row.__row, reason: `Empresa repetida no arquivo (${companyName}).` });
      return;
    }
    if (seenContacts.has(linkedinUrl)) {
      duplicateRows.push({ row: row.__row, reason: `Contato repetido no arquivo (${fullName}).` });
      return;
    }

    seenCompanies.add(normalizedCompany);
    seenContacts.add(linkedinUrl);
    records.push({
      sourceRow: row.__row,
      companyName,
      normalizedCompany,
      companyLinkedinUrl: cell("Company Linkedin Url") || null,
      website: cell("Website") || null,
      websiteDomain: websiteDomain(cell("Website")),
      industry: cell("Industry") || null,
      city: cell("Company City") || cell("City") || null,
      state: cell("Company State") || cell("State") || null,
      country: cell("Company Country") || cell("Country") || null,
      employees: apolloNumber(cell("# Employees")),
      companySize: apolloCompanySize(cell("# Employees")),
      annualRevenue: apolloNumber(cell("Annual Revenue")),
      fullName,
      title: cell("Title") || null,
      linkedinUrl,
      apolloContactId: cell("Apollo Contact Id") || null,
      apolloAccountId: cell("Apollo Account Id") || null,
      extractedAt,
      importOrigin: `Apollo CSV | arquivo="${fileName}" | linha=${row.__row} | apollo_contact_id="${cell("Apollo Contact Id")}" | apollo_account_id="${cell("Apollo Account Id")}"`,
    });
  });

  return { fileName, total: rows.length, records, invalidRows, duplicateRows };
}
