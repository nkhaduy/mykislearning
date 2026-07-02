import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";
import { createNotificationEvent } from "../services/notificationEngine.js";

export async function handleEnrollments(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const url = new URL(request.url);
  const supabase = getSupabase(env);

  if (method === "GET") {
    const acct = await requireAuth(request, env);
    if (!acct) return json({ error: "Unauthorized" }, 401);

    const accountId = url.searchParams.get("accountId");
    const courseId = url.searchParams.get("courseId");
    const targetAccount = acct.role === "hr" ? (accountId || null) : acct.accountId;

    let query = supabase.from("enrollments").select("id, course_id, account_id, status, data, updated_at");
    if (targetAccount) query = query.eq("account_id", targetAccount);
    if (courseId) query = query.eq("course_id", courseId);
    if (!accountId && !courseId && acct.role !== "hr") query = query.eq("account_id", acct.accountId);

    const { data, error } = await query.order("updated_at", { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json((data || []).map((row) => ({
      ...row.data, id: row.id, courseId: row.course_id, accountId: row.account_id, status: row.status,
    })));
  }

  if (method === "POST") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request);
    const { enrollments } = body;
    if (!Array.isArray(enrollments) || !enrollments.length) return json({ error: "enrollments[] required" }, 400);

    const rows = enrollments.map((e) => ({
      id: e.id || crypto.randomUUID(),
      course_id: e.courseId || e.course_id,
      account_id: e.accountId || e.account_id,
      status: e.status || "notStarted",
      data: e,
      updated_at: new Date().toISOString(),
    }));
    if (rows.some((r) => !r.course_id || !r.account_id)) return json({ error: "Each enrollment requires courseId and accountId" }, 400);

    const { error } = await supabase.from("enrollments").upsert(rows, { onConflict: "course_id,account_id" });
    if (error) return json({ error: error.message }, 500);
    const courseIds = [...new Set(rows.map((r) => r.course_id))];
    const { data: courses } = await supabase.from("courses").select("id, data").in("id", courseIds);
    const courseMap = new Map((courses || []).map((c) => [c.id, c]));
    await Promise.allSettled(rows.map((row) => createNotificationEvent(supabase, {
      eventType: "course_assigned",
      entityType: "course_assignment",
      entityId: row.id,
      actorId: acct.accountId,
      recipientId: row.account_id,
      idempotencyKey: `course_assigned:${row.course_id}:${row.account_id}`,
      payload: {
        course_title: courseMap.get(row.course_id)?.data?.title || row.data?.courseTitle || "Khóa học",
        due_date: row.data?.deadline || row.data?.dueAt || "",
      },
    })));
    return json({ ok: true, count: rows.length });
  }

  if (method === "PATCH") {
    const acct = await requireAuth(request, env);
    if (!acct) return json({ error: "Unauthorized" }, 401);
    const body = await readJson(request);
    const { id, courseId, accountId, patch } = body;
    if ((!id && (!courseId || !accountId)) || !patch) return json({ error: "id (or courseId+accountId) and patch required" }, 400);
    if (acct.role !== "hr" && accountId && accountId !== acct.accountId) return json({ error: "Forbidden" }, 403);

    let query = supabase.from("enrollments").select("id, data").limit(1);
    if (id) query = query.eq("id", id);
    else query = query.eq("course_id", courseId).eq("account_id", accountId);
    const { data: existing, error: findErr } = await query;
    if (findErr) return json({ error: findErr.message }, 500);
    if (!existing?.length) return json({ error: "Enrollment not found" }, 404);

    const row = existing[0];
    const merged = { ...row.data, ...patch };
    const { error } = await supabase.from("enrollments").update({
      data: merged, status: merged.status || row.data?.status, updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, enrollment: merged });
  }

  if (method === "DELETE") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request);
    const id = url.searchParams.get("id") || body?.id;
    if (!id) return json({ error: "id required" }, 400);
    const { error } = await supabase.from("enrollments").delete().eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return methodNotAllowed();
}
