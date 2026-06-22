import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth } from "../middleware/auth.js";

export async function handleContentProgress(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const url = new URL(request.url);
  const supabase = getSupabase(env);
  const acct = requireAuth(request);
  if (!acct) return json({ error: "Unauthorized" }, 401);

  if (method === "GET") {
    const accountId = url.searchParams.get("accountId");
    const courseId = url.searchParams.get("courseId");
    const contentId = url.searchParams.get("contentId");
    const targetAccount = acct.role === "hr" ? (accountId || acct.accountId) : acct.accountId;

    let query = supabase.from("content_progress")
      .select("id, content_id, account_id, course_id, data")
      .eq("account_id", targetAccount);
    if (courseId) query = query.eq("course_id", courseId);
    if (contentId) query = query.eq("content_id", contentId);

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    return json((data || []).map((row) => ({
      ...row.data, id: row.id, contentId: row.content_id, accountId: row.account_id, courseId: row.course_id,
    })));
  }

  if (method === "POST") {
    const progress = await readJson(request);
    if (!progress?.contentId || !progress?.courseId) return json({ error: "contentId and courseId required" }, 400);
    const accountId = acct.role === "hr" ? (progress.accountId || acct.accountId) : acct.accountId;

    const id = progress.id || `cp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const row = {
      id, content_id: progress.contentId, account_id: accountId, course_id: progress.courseId,
      data: { ...progress, accountId }, updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("content_progress").upsert(row, { onConflict: "content_id,account_id" });
    if (error) return json({ error: error.message }, 500);

    if (typeof progress.enrollmentProgressPercent === "number") {
      await supabase.from("enrollments").update({
        status: progress.enrollmentProgressPercent === 100 ? "completed"
          : progress.enrollmentProgressPercent > 0 ? "inProgress" : "notStarted",
        updated_at: new Date().toISOString(),
      }).eq("course_id", progress.courseId).eq("account_id", accountId);
    }
    return json({ ok: true, id });
  }

  return methodNotAllowed();
}
