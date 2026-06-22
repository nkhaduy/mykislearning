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
  const { searchParams } = new URL(req.url, `https://${req.headers.host}`);

  // ── GET: list participants ──────────────────────────────────────────────────
  if (req.method === "GET") {
    const acct = requireAuth(req, res);
    if (!acct) return;
    const sessionId = searchParams.get("sessionId");
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

    const sessionId = req.body?.session_id || req.body?.sessionId;
    const participants = req.body?.participants;
    const mode = req.body?.mode === "replace" ? "replace" : "merge";
    if (!sessionId || !Array.isArray(participants)) {
      return res.status(400).json({ error: "session_id and participants[] required" });
    }

    const normalized = participants.map((participant) => ({
      id: String(participant.id || crypto.randomUUID()),
      sessionId: String(participant.session_id || participant.sessionId || sessionId),
      accountId: String(participant.account_id || participant.accountId || "").trim(),
      role: String(participant.role || "learner"),
      status: String(participant.status || "assigned"),
      createdAt: String(participant.created_at || participant.createdAt || new Date().toISOString()),
      source: String(participant.source || "manual"),
      addedBy: String(participant.added_by || participant.addedBy || acct.accountId),
    }));
    if (normalized.some((participant) => !participant.accountId || participant.sessionId !== String(sessionId))) {
      return res.status(400).json({ error: "Each participant requires matching session_id and account_id" });
    }

    const rows = normalized.map((participant) => ({
      id: participant.id,
      session_id: sessionId,
      account_id: participant.accountId,
      data: participant,
    }));

    if (rows.length) {
      const { error } = await db
        .from("training_participants")
        .upsert(rows, { onConflict: "session_id,account_id" });
      if (error) return res.status(500).json({ error: error.message, code: error.code || "participant_upsert_failed" });
    }

    if (mode === "replace") {
      const desiredIds = new Set(normalized.map((participant) => participant.accountId));
      const { data: existing, error: existingError } = await db.from("training_participants").select("account_id").eq("session_id", sessionId);
      if (existingError) return res.status(500).json({ error: existingError.message, code: existingError.code || "participant_cleanup_read_failed" });
      const staleIds = (existing || []).map((row) => row.account_id).filter((accountId) => !desiredIds.has(accountId));
      if (staleIds.length) {
        const { error: deleteError } = await db.from("training_participants").delete().eq("session_id", sessionId).in("account_id", staleIds);
        if (deleteError) return res.status(500).json({ error: deleteError.message, code: deleteError.code || "participant_cleanup_failed" });
      }
    }

    const { data: saved, error: verifyError } = await db
      .from("training_participants")
      .select("id, session_id, account_id, data")
      .eq("session_id", sessionId);
    if (verifyError) return res.status(500).json({ error: verifyError.message, code: verifyError.code || "participant_verify_failed" });
    return res.json({ ok: true, participants: saved || [], count: saved?.length || 0 });
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
