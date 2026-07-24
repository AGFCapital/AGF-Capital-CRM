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
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "referrer-policy": "same-origin" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/api/config") {
    json(response, {
      supabaseUrl: localEnvironment.SUPABASE_URL ?? process.env.SUPABASE_URL ?? null,
      supabasePublishableKey: localEnvironment.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? null,
    });
    return;
  }
  if (pathname === "/api/health") { json(response, { ok: true }); return; }

  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = resolve(root, relativePath);
  if (!filePath.startsWith(root)) { response.writeHead(403).end("Forbidden"); return; }
  try {
    const file = await readFile(filePath);
    response.writeHead(200, { "content-type": types[extname(filePath)] ?? "application/octet-stream" });
    response.end(file);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

const port = Number(process.env.PORT ?? 4173);
server.listen(port, "127.0.0.1", () => console.log(`CRM AGF disponivel em http://localhost:${port}`));
