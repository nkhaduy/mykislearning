/**
 * GET  /api/content-progress?accountId=&courseId=   → get progress records
 * POST /api/content-progress                         → save/update progress
 */
import { createClient } from "@supabase/supabase-js";
import { cors, requireAuth } from "../courses/_auth.js";

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const supabase = db();

  // ── GET ─────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const acct = requireAuth(req, res);
    if (!acct) return;

    const { accountId, courseId, contentId } = req.query;

    // Employees can only query own progress
    const targetAccount = acct.role === "hr" ? (accountId || acct.accountId) : acct.accountId;

    let query = supabase
      .from("content_progress")
      .select("id, content_id, account_id, course_id, data")
      .eq("account_id", targetAccount);

    if (courseId) query = query.eq("course_id", courseId);
    if (contentId) query = query.eq("content_id", contentId);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.json((data || []).map((row) => ({
      ...row.data,
      id: row.id,
      contentId: row.content_id,
      accountId: row.account_id,
      courseId: row.course_id,
    })));
  }

  // ── POST: save progress ─────────────────────────────────────────────────────
  if (req.method === "POST") {
    const acct = requireAuth(req, res);
    if (!acct) return;

    const progress = req.body;
    if (!progress?.contentId || !progress?.courseId) {
      return res.status(400).json({ error: "contentId and courseId required" });
    }

    // Employees can only save own progress
    const accountId = acct.role === "hr" ? (progress.accountId || acct.accountId) : acct.accountId;

    const id = progress.id || `cp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const row = {
      id,
      content_id: progress.contentId,
      account_id: accountId,
      course_id: progress.courseId,
      data: { ...progress, accountId },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("content_progress")
      .upsert(row, { onConflict: "content_id,account_id" });
    if (error) return res.status(500).json({ error: error.message });

    // Also update enrollment progress % if provided
    if (typeof progress.enrollmentProgressPercent === "number") {
      await supabase
        .from("enrollments")
        .update({
          status: progress.enrollmentProgressPercent === 100 ? "completed"
            : progress.enrollmentProgressPercent > 0 ? "inProgress" : "notStarted",
          data: supabase.rpc ? undefined : undefined, // handled by client
          updated_at: new Date().toISOString(),
        })
        .eq("course_id", progress.courseId)
        .eq("account_id", accountId);
    }

    return res.json({ ok: true, id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
