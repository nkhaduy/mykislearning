/**
 * GET /api/training/calendar
 * Returns training sessions (with registration status) for the requesting employee.
 * Joins: training_sessions ← training_participants → training_registrations
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
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const acct = requireAuth(req, res);
  if (!acct) return;

  const db = supabase();
  const { accountId } = acct;

  // 1. Find sessions where accountId is a participant
  const { data: parts, error: partErr } = await db
    .from("training_participants")
    .select("session_id")
    .eq("account_id", accountId);

  if (partErr) return res.status(500).json({ error: partErr.message });

  const sessionIds = (parts || []).map((p) => p.session_id);
  if (!sessionIds.length) return res.json({ sessions: [], registrations: [], participants: [] });

  // 2. Fetch session records (exclude draft/cancelled for employee view)
  const { data: sessions, error: sessErr } = await db
    .from("training_sessions")
    .select("id, status, data")
    .in("id", sessionIds)
    .not("status", "in", '("draft")');

  if (sessErr) return res.status(500).json({ error: sessErr.message });

  // 3. Fetch registrations for this account across those sessions
  const { data: regs, error: regErr } = await db
    .from("training_registrations")
    .select("session_id, data")
    .in("session_id", sessionIds)
    .eq("account_id", accountId);

  if (regErr) return res.status(500).json({ error: regErr.message });

  return res.json({
    sessions: (sessions || []).map((row) => ({ ...row.data, id: row.id, status: row.status })),
    registrations: (regs || []).map((row) => ({ ...row.data, sessionId: row.session_id })),
    participants: (parts || []).map((p) => ({ sessionId: p.session_id, accountId })),
  });
}
