import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";
import { auditLater } from "../services/audit-service.js";

const STORAGE_BUCKET = "course-content";
const SIGNED_URL_EXPIRES = 3600;

async function attachSignedUrls(supabase, items) {
  return Promise.all(
    items.map(async (item) => {
      if (item.sourceType !== "uploaded" || !item.storagePath) return item;
      const { data, error } = await supabase.storage
        .from(item.storageBucket || STORAGE_BUCKET)
        .createSignedUrl(item.storagePath, SIGNED_URL_EXPIRES);
      if (error || !data?.signedUrl) return { ...item, sourceUrl: null, signedUrlError: error?.message };
      return { ...item, sourceUrl: data.signedUrl };
    })
  );
}

export async function handleCourses(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const url = new URL(request.url);
  const path = url.pathname;
  const supabase = getSupabase(env);

  // ── /api/courses/content ────────────────────────────────────────────────────
  if (path === "/api/courses/content") {
    if (method === "GET") {
      const acct = await requireAuth(request, env);
      if (!acct) return json({ error: "Unauthorized" }, 401);

      const courseId = url.searchParams.get("courseId");
      if (!courseId) return json({ error: "courseId required" }, 400);

      const { data, error } = await supabase
        .from("course_content")
        .select("id, course_id, type, sort_order, data")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true });

      if (error) return json({ error: error.message }, 500);

      const items = (data || []).map((row) => ({
        ...row.data, id: row.id, courseId: row.course_id, type: row.type, order: row.sort_order,
      }));
      const withUrls = await attachSignedUrls(supabase, items);
      return json(withUrls);
    }

    if (method === "POST") {
      const acct = await requireHr(request, env);
      if (!acct) return json({ error: "HR only" }, 403);
      const body = await readJson(request);
      const { courseId, items } = body;
      if (!courseId || !Array.isArray(items)) return json({ error: "courseId and items[] required" }, 400);

      for (const item of items) {
        if (item.type === "video" && item.sourceType === "uploaded" && !item.storagePath) {
          return json({ error: `Content "${item.title}" missing storagePath`, code: "missing_storage_path" }, 400);
        }
      }

      const rows = items.map((item, idx) => ({
        id: item.id || `content-${Date.now()}-${idx}`,
        course_id: courseId,
        type: item.type || "slide",
        sort_order: item.order ?? item.sort_order ?? idx,
        data: (() => { const d = { ...item, courseId }; if (d.sourceType === "uploaded") delete d.sourceUrl; return d; })(),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("course_content").upsert(rows, { onConflict: "id" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, count: rows.length });
    }

    if (method === "DELETE") {
      const acct = await requireHr(request, env);
      if (!acct) return json({ error: "HR only" }, 403);
      const body = await readJson(request);
      const id = url.searchParams.get("id") || body?.id;
      if (!id) return json({ error: "id required" }, 400);
      const { error } = await supabase.from("course_content").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return methodNotAllowed();
  }

  // ── /api/courses ────────────────────────────────────────────────────────────
  if (method === "GET") {
    const acct = await requireAuth(request, env);
    if (!acct) return json({ error: "Unauthorized" }, 401);

    if (acct.role === "hr") {
      const { data, error } = await supabase
        .from("courses").select("id, status, delivery_mode, data, updated_at")
        .order("updated_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json((data || []).map((row) => ({ ...row.data, id: row.id, status: row.status, deliveryMode: row.delivery_mode })));
    } else {
      const { data: enrs, error: enrErr } = await supabase
        .from("enrollments").select("course_id").eq("account_id", acct.accountId);
      if (enrErr) return json({ error: enrErr.message }, 500);
      const ids = (enrs || []).map((e) => e.course_id);
      if (!ids.length) return json([]);
      const { data, error } = await supabase
        .from("courses").select("id, status, delivery_mode, data")
        .in("id", ids).eq("status", "published");
      if (error) return json({ error: error.message }, 500);
      return json((data || []).map((row) => ({ ...row.data, id: row.id, status: row.status, deliveryMode: row.delivery_mode })));
    }
  }

  if (method === "POST") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const course = await readJson(request);
    if (!course?.id) return json({ error: "course.id required" }, 400);
    const { data: existing } = await supabase.from("courses").select("id, status, data").eq("id", course.id).maybeSingle();
    const row = {
      id: course.id, status: course.status || "draft",
      delivery_mode: course.deliveryMode || course.delivery_mode || "online",
      created_by: course.createdBy || acct.accountId,
      data: course, updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("courses").upsert(row, { onConflict: "id" });
    if (error) return json({ error: error.message }, 500);
    auditLater(supabase, request, {
      actor: acct,
      action: existing ? (existing.status !== row.status && row.status === "published" ? "course.published" : "course.updated") : "course.created",
      entityType: "course",
      entityId: course.id,
      entityDisplayName: course.title || course.name || course.id,
      beforeData: existing ? { status: existing.status, title: existing.data?.title || existing.data?.name || "" } : null,
      afterData: { status: row.status, title: course.title || course.name || "" },
    });
    return json({ ok: true, id: course.id });
  }

  if (method === "DELETE") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request);
    const id = url.searchParams.get("id") || body?.id;
    if (!id) return json({ error: "id required" }, 400);

    // Check if enrollments, sessions, or content exist → archive
    const { data: enrollments } = await supabase.from("enrollments")
      .select("id").eq("course_id", id).limit(1);
    const { data: sessions } = await supabase.from("training_sessions")
      .select("id").eq("course_id", id).limit(1);

    const hasRelatedData = (enrollments?.length || 0) + (sessions?.length || 0) > 0;
    if (hasRelatedData) {
      // Soft delete: archive
      const { error } = await supabase.from("courses")
        .update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      auditLater(supabase, request, { actor: acct, action: "course.archived", entityType: "course", entityId: id, beforeData: { status: "active" }, afterData: { status: "archived" } });
      return json({ ok: true, id, status: "archived", method: "soft" });
    } else {
      // Hard delete if no related data
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      auditLater(supabase, request, { actor: acct, action: "course.archived", entityType: "course", entityId: id, metadata: { hard_deleted_no_related_data: true } });
      return json({ ok: true, id, status: "deleted", method: "hard" });
    }
  }

  return methodNotAllowed();
}
