/**
 * GET  /api/training/sessions         → list all sessions (HR) or sessions for account (employee)
 * POST /api/training/sessions         → upsert a session (HR only)
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

  // ── GET: list sessions ──────────────────────────────────────────────────────
  if (req.method === "GET") {
    const acct = requireAuth(req, res);
    if (!acct) return;

    let query = db.from("training_sessions").select("*").order("start_at", { ascending: true });

    // Employees only see sessions they're a participant of
    if (acct.role !== "hr") {
      const { data: parts } = await db
        .from("training_participants")
        .select("session_id")
        .eq("account_id", acct.accountId);
      const ids = (parts || []).map((p) => p.session_id);
      if (!ids.length) return res.json([]);
      query = query.in("id", ids).not("status", "in", '("cancelled","draft")');
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Return the stored data objects (camelCase preserved)
    return res.json((data || []).map((row) => ({ ...row.data, id: row.id, status: row.status })));
  }

  // ── POST: upsert session ────────────────────────────────────────────────────
  if (req.method === "POST") {
    const acct = requireHr(req, res);
    if (!acct) return;

    const session = req.body;
    if (!session?.id) return res.status(400).json({ error: "session.id required" });

    const row = {
      id: session.id,
      course_id: session.courseId || "",
      status: session.status || "scheduled",
      start_at: session.startAt,
      end_at: session.endAt,
      created_by: session.createdBy || acct.accountId,
      data: session,
      updated_at: new Date().toISOString(),
    };

    const { error } = await db
      .from("training_sessions")
      .upsert(row, { onConflict: "id" });

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
