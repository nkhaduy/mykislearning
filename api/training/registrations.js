/**
 * GET    /api/training/registrations?sessionId=   → list registrations (HR)
 * POST   /api/training/registrations              → upsert registration records
 * PATCH  /api/training/registrations              → update one registration (respond / mark attendance)
 */
import { createClient } from "@supabase/supabase-js";
import { cors, requireAuth } from "./_auth.js";

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const db = supabase();
  const acct = requireAuth(req, res);
  if (!acct) return;

  // ── GET: list registrations for a session ──────────────────────────────────
  if (req.method === "GET") {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: "sessionId required" });

    const { data, error } = await db
      .from("training_registrations")
      .select("*")
      .eq("session_id", sessionId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json((data || []).map((row) => ({ ...row.data, id: row.id })));
  }

  // ── POST: bulk upsert registrations ────────────────────────────────────────
  if (req.method === "POST") {
    const { registrations } = req.body;
    if (!Array.isArray(registrations)) return res.status(400).json({ error: "registrations[] required" });

    if (!registrations.length) return res.json({ ok: true });

    const rows = registrations.map((r) => ({
      id: r.id,
      session_id: r.sessionId,
      account_id: r.accountId,
      data: r,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await db
      .from("training_registrations")
      .upsert(rows, { onConflict: "session_id,account_id" });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  // ── PATCH: update a single registration ────────────────────────────────────
  if (req.method === "PATCH") {
    const { sessionId, accountId, patch } = req.body;
    if (!sessionId || !accountId || !patch) {
      return res.status(400).json({ error: "sessionId, accountId, patch required" });
    }

    // Fetch existing
    const { data: existing } = await db
      .from("training_registrations")
      .select("data")
      .eq("session_id", sessionId)
      .eq("account_id", accountId)
      .single();

    const merged = { ...(existing?.data || {}), ...patch };

    const { error } = await db
      .from("training_registrations")
      .upsert({
        id: merged.id || crypto.randomUUID(),
        session_id: sessionId,
        account_id: accountId,
        data: merged,
        updated_at: new Date().toISOString(),
      }, { onConflict: "session_id,account_id" });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, registration: merged });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
