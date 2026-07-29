import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { hasAdministrativeAccess, requireAuth } from "../middleware/auth.js";
import { requireCourseAccess } from "../services/course-access.js";
import { recalculateEnrollmentProgress } from "../services/learning-progress.js";

export async function handleContentProgress(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const url = new URL(request.url);
  const supabase = getSupabase(env);
  const acct = await requireAuth(request, env);
  if (!acct) return json({ error: "Unauthorized" }, 401);

  if (method === "GET") {
    const accountId = url.searchParams.get("accountId");
    const courseId = url.searchParams.get("courseId");
    const contentId = url.searchParams.get("contentId");
    const targetAccount = hasAdministrativeAccess(acct) ? (accountId || acct.accountId) : acct.accountId;

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
    const accountId = hasAdministrativeAccess(acct) ? (progress.accountId || acct.accountId) : acct.accountId;
    if (!hasAdministrativeAccess(acct)) await requireCourseAccess(supabase, acct, progress.courseId);

    const percentFields = [progress.completionPercent, progress.enrollmentProgressPercent].filter((value) => value !== undefined);
    if (percentFields.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100)) {
      return json({ error: "INVALID_PROGRESS_PERCENT" }, 422);
    }
    const content = await supabase.from("course_content").select("id, type, data").eq("id", progress.contentId)
      .eq("course_id", progress.courseId).maybeSingle();
    if (content.error) return json({ error: "CONTENT_LOOKUP_FAILED" }, 503);
    if (!content.data) return json({ error: "CONTENT_NOT_FOUND" }, 404);

    const existing = await supabase.from("content_progress").select("id, data").eq("content_id", progress.contentId)
      .eq("account_id", accountId).maybeSingle();
    if (existing.error) return json({ error: "CONTENT_PROGRESS_LOOKUP_FAILED" }, 503);
    const mergedProgress = {
      ...(existing.data?.data || {}),
      ...progress,
      metadata: { ...(existing.data?.data?.metadata || {}), ...(progress.metadata || {}) },
    };
    const completionPercent = Number(mergedProgress.completionPercent ?? 0);
    let completed = false;
    if (content.data.type === "video") {
      const requiredPercent = Number(content.data.data?.completionRule?.requiredPercent || 90);
      completed = Boolean(mergedProgress.metadata?.completedViaTranscript && content.data.data?.transcriptAlternativeAllowed)
        || completionPercent >= requiredPercent;
    } else if (content.data.type !== "quiz") {
      completed = completionPercent >= 100;
    }
    const id = progress.id || existing.data?.id || `cp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const row = {
      id, content_id: progress.contentId, account_id: accountId, course_id: progress.courseId,
      data: { ...mergedProgress, accountId, completionPercent, completed }, updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("content_progress").upsert(row, { onConflict: "content_id,account_id" });
    if (error) return json({ error: "CONTENT_PROGRESS_SAVE_FAILED" }, 503);

    const enrollmentProgressPercent = await recalculateEnrollmentProgress(supabase, accountId, progress.courseId);
    return json({ ok: true, id, enrollmentProgressPercent });
  }

  return methodNotAllowed();
}
