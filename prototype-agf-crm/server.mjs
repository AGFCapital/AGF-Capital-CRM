import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const localEnvironment = await readLocalEnvironment();
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

async function readLocalEnvironment() {
  try {
    const raw = await readFile(resolve(root, ".env.local"), "utf8");
    return Object.fromEntries(raw.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      return match ? [[match[1], match[2]]] : [];
    }));
  } catch {
    return {};
  }
}

function json(response, body, status = 200) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "referrer-policy": "same-origin",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64_000) throw new Error("Solicitação muito grande.");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function runtimeConfig() {
  return {
    supabaseUrl: localEnvironment.SUPABASE_URL ?? process.env.SUPABASE_URL ?? null,
    supabasePublishableKey: localEnvironment.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? null,
    n8nCommandWebhookUrl: localEnvironment.N8N_COMMAND_WEBHOOK_URL ?? process.env.N8N_COMMAND_WEBHOOK_URL ?? null,
    n8nCommandWebhookToken: localEnvironment.N8N_COMMAND_WEBHOOK_TOKEN ?? process.env.N8N_COMMAND_WEBHOOK_TOKEN ?? null,
  };
}

async function verifyAuthenticatedOperator(request, config) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ") || !config.supabaseUrl || !config.supabasePublishableKey) return false;
  const verification = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: config.supabasePublishableKey, authorization },
  });
  return verification.ok;
}

function normalizedExtractionRequest(input) {
  const vacancyCount = Number(input.vacancyCount);
  const middleMarketCount = Number(input.middleMarketCount);
  return {
    command: "extra_extraction",
    requestedBy: "crm_operator",
    vacancyCount: Number.isInteger(vacancyCount) && vacancyCount > 0 ? Math.min(vacancyCount, 50) : 5,
    middleMarketCount: Number.isInteger(middleMarketCount) && middleMarketCount > 0 ? Math.min(middleMarketCount, 50) : 15,
  };
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const config = runtimeConfig();

  if (pathname === "/api/config") {
    json(response, {
      supabaseUrl: config.supabaseUrl,
      supabasePublishableKey: config.supabasePublishableKey,
    });
    return;
  }

  if (pathname === "/api/health") {
    json(response, { ok: true });
    return;
  }

  if (pathname === "/api/extractions") {
    if (request.method !== "POST") {
      json(response, { error: "Método não permitido." }, 405);
      return;
    }
    if (!await verifyAuthenticatedOperator(request, config)) {
      json(response, { error: "Sessão inválida." }, 401);
      return;
    }
    if (!config.n8nCommandWebhookUrl || !config.n8nCommandWebhookToken) {
      json(response, { error: "A integração de extração ainda não foi configurada no servidor." }, 503);
      return;
    }
    try {
      const workflowResponse = await fetch(config.n8nCommandWebhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-agf-internal-key": config.n8nCommandWebhookToken,
        },
        body: JSON.stringify(normalizedExtractionRequest(await readJson(request))),
      });
      if (!workflowResponse.ok) {
        json(response, { error: "O n8n não aceitou a solicitação de extração." }, 502);
        return;
      }
      json(response, { accepted: true }, 202);
    } catch (error) {
      json(response, { error: error instanceof Error ? error.message : "Não foi possível iniciar a extração." }, 400);
    }
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = resolve(root, relativePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, { "content-type": types[extname(filePath)] ?? "application/octet-stream" });
    response.end(file);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

const port = Number(process.env.PORT ?? 4173);
server.listen(port, "127.0.0.1", () => {
  console.log(`CRM AGF disponivel em http://localhost:${port}`);
});
