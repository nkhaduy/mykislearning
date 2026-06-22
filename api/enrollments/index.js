/**
 * GET    /api/enrollments?accountId=        → list enrollments for an account
 * GET    /api/enrollments?courseId=         → list enrollments for a course (HR)
 * POST   /api/enrollments                   → assign / bulk-upsert enrollments (HR)
 * PATCH  /api/enrollments                   → update progress/status for one enrollment
 * DELETE /api/enrollments?id=              → remove enrollment (HR)
 */
import { createClient } from "@supabase/supabase-js";
import { cors, requireAuth, requireHr } from "../courses/_auth.js";

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const supabase = db();
  const { searchParams } = new URL(req.url, `https://${req.headers.host}`);

  // ── GET ─────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const acct = requireAuth(req, res);
    if (!acct) return;

    const { accountId, courseId } = req.query;

    // Employees can only query their own enrollments
    const targetAccount = acct.role === "hr" ? (accountId || null) : acct.accountId;

    let query = supabase.from("enrollments").select("id, course_id, account_id, status, data, updated_at");

    if (targetAccount) query = query.eq("account_id", targetAccount);
    if (courseId) query = query.eq("course_id", courseId);
    if (!accountId && !courseId && acct.role !== "hr") {
      query = query.eq("account_id", acct.accountId);
    }

    const { data, error } = await query.order("updated_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    return res.json((data || []).map((row) => ({
      ...row.data,
      id: row.id,
      courseId: row.course_id,
      accountId: row.account_id,
      status: row.status,
    })));
  }

  // ── POST: bulk upsert ───────────────────────────────────────────────────────
  if (req.method === "POST") {
    const acct = requireHr(req, res);
    if (!acct) return;

    const { enrollments } = req.body;
    if (!Array.isArray(enrollments) || !enrollments.length) {
      return res.status(400).json({ error: "enrollments[] required" });
    }

    const rows = enrollments.map((e) => ({
      id: e.id || crypto.randomUUID(),
      course_id: e.courseId || e.course_id,
      account_id: e.accountId || e.account_id,
      status: e.status || "notStarted",
      data: e,
      updated_at: new Date().toISOString(),
    }));

    if (rows.some((r) => !r.course_id || !r.account_id)) {
      return res.status(400).json({ error: "Each enrollment requires courseId and accountId" });
    }

    const { error } = await supabase
      .from("enrollments")
      .upsert(rows, { onConflict: "course_id,account_id" });
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ ok: true, count: rows.length });
  }

  // ── PATCH: update one enrollment (progress, status) ─────────────────────────
  if (req.method === "PATCH") {
    const acct = requireAuth(req, res);
    if (!acct) return;

    const { id, courseId, accountId, patch } = req.body;
    if ((!id && (!courseId || !accountId)) || !patch) {
      return res.status(400).json({ error: "id (or courseId+accountId) and patch required" });
    }

    // Employees can only update their own enrollment
    if (acct.role !== "hr" && accountId && accountId !== acct.accountId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    let query = supabase.from("enrollments").select("id, data").limit(1);
    if (id) query = query.eq("id", id);
    else query = query.eq("course_id", courseId).eq("account_id", accountId);
    const { data: existing, error: findErr } = await query;
    if (findErr) return res.status(500).json({ error: findErr.message });
    if (!existing?.length) return res.status(404).json({ error: "Enrollment not found" });

    const row = existing[0];
    const merged = { ...row.data, ...patch };
    const { error } = await supabase
      .from("enrollments")
      .update({ data: merged, status: merged.status || row.data?.status, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, enrollment: merged });
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const acct = requireHr(req, res);
    if (!acct) return;

    const id = req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: "id required" });

    const { error } = await supabase.from("enrollments").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
