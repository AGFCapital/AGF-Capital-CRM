// Vercel serverless equivalent of server.mjs's /api/config route — same
// contract (Supabase URL + publishable/anon key only, read from env vars
// set in the Vercel project, never a hardcoded value or service_role key).
export default function handler(request, response) {
  response.setHeader("cache-control", "no-store");
  response.setHeader("referrer-policy", "same-origin");
  response.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL ?? null,
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? null,
  });
}
