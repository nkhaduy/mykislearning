/**
 * GET  /api/training/participants?sessionId=  → list participants for a session (HR)
 * POST /api/training/participants             → upsert participant list (HR only)
 * DELETE /api/training/participants           → remove one participant (HR only)
 */
import { createClient } from "@supabase/supabase-js";
import { cors, requireAuth, requireHr } from "./_auth.js";

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const db = supabase();

  // ── GET: list participants ──────────────────────────────────────────────────
  if (req.method === "GET") {
    const acct = requireAuth(req, res);
    if (!acct) return;
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: "sessionId required" });

    const { data, error } = await db
      .from("training_participants")
      .select("*")
      .eq("session_id", sessionId)
      .order("data->addedAt", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json((data || []).map((row) => ({ ...row.data, id: row.id })));
  }

  // ── POST: upsert participants ───────────────────────────────────────────────
  if (req.method === "POST") {
    const acct = requireHr(req, res);
    if (!acct) return;

    const { sessionId, participants } = req.body;
    if (!sessionId || !Array.isArray(participants)) {
      return res.status(400).json({ error: "sessionId and participants[] required" });
    }

    if (participants.length === 0) return res.json({ ok: true });

    const rows = participants.map((p) => ({
      id: p.id,
      session_id: sessionId,
      account_id: p.accountId,
      data: p,
    }));

    const { error } = await db
      .from("training_participants")
      .upsert(rows, { onConflict: "session_id,account_id" });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  // ── DELETE: remove participant ──────────────────────────────────────────────
  if (req.method === "DELETE") {
    const acct = requireHr(req, res);
    if (!acct) return;

    const { sessionId, accountId } = req.body;
    if (!sessionId || !accountId) return res.status(400).json({ error: "sessionId and accountId required" });

    const { error } = await db
      .from("training_participants")
      .delete()
      .eq("session_id", sessionId)
      .eq("account_id", accountId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
