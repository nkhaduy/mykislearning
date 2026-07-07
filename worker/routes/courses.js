import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";
import { auditLater } from "../services/audit-service.js";

const STORAGE_BUCKET = "course-content";
const SIGNED_URL_EXPIRES = 3600;

async function deleteCourseOperationalDependencies(supabase, courseId) {
  const lpSteps = await supabase
    .from("learning_path_steps")
    .select("id")
    .eq("resource_id", courseId)
    .eq("step_type", "course")
    .then((r) => r)
    .catch(() => ({ data: [], error: null }));
  if (lpSteps.error) return { error: "learning_path_steps: " + lpSteps.error.message };

  const stepIds = (lpSteps.data || []).map((step) => step.id).filter(Boolean);
  if (stepIds.length) {
    const progressDel = await supabase.from("learning_path_step_progress").delete().in("step_id", stepIds);
    if (progressDel.error) return { error: "learning_path_step_progress: " + progressDel.error.message };
    const stepsDel = await supabase.from("learning_path_steps").delete().in("id", stepIds);
    if (stepsDel.error) return { error: "learning_path_steps: " + stepsDel.error.message };
  }

  await supabase.from("learning_path_version_steps").delete().eq("resource_id", courseId).eq("resource_type", "course");
  await supabase.from("retraining_assignments").delete().eq("assignment_type", "course").eq("assignment_id", courseId);
  await supabase.from("retraining_reviews").delete().eq("entity_type", "course").eq("entity_id", courseId);
  await supabase.from("compliance_requirements").delete().eq("resource_id", courseId);
  await supabase.from("content_progress").delete().eq("course_id", courseId);

  const ccDel = await supabase.from("course_content").delete().eq("course_id", courseId);
  if (ccDel.error) return { error: "course_content: " + ccDel.error.message };
  const enrDel = await supabase.from("enrollments").delete().eq("course_id", courseId);
  if (enrDel.error) return { error: "enrollments: " + enrDel.error.message };
  await supabase.from("training_sessions").update({ status: "cancelled" }).eq("course_id", courseId);
  const verDel = await supabase.from("course_versions").delete().eq("course_id", courseId);
  if (verDel.error) return { error: "course_versions: " + verDel.error.message };

  return { ok: true };
}

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

  // ── /api/courses/impact — must be checked before general GET ───────────────
  if (path === "/api/courses/impact" && method === "GET") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "id required" }, 400);

    const course = await supabase.from("courses").select("id, status, data").eq("id", id).maybeSingle();
    if (course.error) return json({ error: course.error.message }, 500);
    if (!course.data) return json({ error: "Course not found" }, 404);

    const [enrollments, sessions, content, versions, lpSteps, compliance] = await Promise.all([
      supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", id),
      supabase.from("training_sessions").select("id", { count: "exact", head: true }).eq("course_id", id),
      supabase.from("course_content").select("id", { count: "exact", head: true }).eq("course_id", id),
      supabase.from("course_versions").select("id", { count: "exact", head: true }).eq("course_id", id),
      supabase.from("learning_path_steps").select("id", { count: "exact", head: true }).eq("resource_id", id).eq("resource_type", "course").then(r => r).catch(() => ({ count: 0 })),
      supabase.from("compliance_requirements").select("id", { count: "exact", head: true }).eq("resource_id", id).then(r => r).catch(() => ({ count: 0 })),
    ]);

    const title = course.data?.data?.title || course.data?.data?.name || id;
    return json({
      ok: true,
      id,
      title,
      status: course.data.status,
      impact: {
        enrollments: enrollments.count || 0,
        sessions: sessions.count || 0,
        content: content.count || 0,
        versions: versions.count || 0,
        learningPaths: lpSteps.count || 0,
        compliance: compliance.count || 0,
      },
    });
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
    if (!existing) {
      const { data: createdVersion } = await supabase.from("course_versions").insert({
        course_id: course.id,
        version_number: 1,
        status: row.status === "published" ? "published" : "draft",
        title: course.title || course.name || course.id,
        description: course.description || null,
        objectives: course.objectives || [],
        content_snapshot: [],
        duration_minutes: course.durationMinutes || course.duration_minutes || null,
        delivery_mode: row.delivery_mode,
        completion_rules: course.completionRules || course.completion_rules || {},
        source_data: course,
        change_type: "patch",
        change_summary: "Initial version",
        created_by: acct.accountId,
        published_by: row.status === "published" ? acct.accountId : null,
        published_at: row.status === "published" ? new Date().toISOString() : null,
      }).select("id").maybeSingle();
      if (createdVersion?.id) await supabase.from("courses").update({ current_version_id: createdVersion.id }).eq("id", course.id);
    }
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

  // (impact path now handled above, before general GET)

  if (method === "DELETE") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request);
    const id = url.searchParams.get("id") || body?.id;
    const force = url.searchParams.get("force") === "true" || body?.force === true;
    if (!id) return json({ error: "id required" }, 400);

    // Fetch course info for audit
    const { data: courseRow } = await supabase.from("courses").select("id, status, data").eq("id", id).maybeSingle();
    if (!courseRow) return json({ error: "Course not found" }, 404);
    const courseTitle = courseRow.data?.title || courseRow.data?.name || id;

    if (force) {
      // Force delete: remove dependencies then delete course
      const [enrollments, sessions, content, versions] = await Promise.all([
        supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", id),
        supabase.from("training_sessions").select("id", { count: "exact", head: true }).eq("course_id", id),
        supabase.from("course_content").select("id", { count: "exact", head: true }).eq("course_id", id),
        supabase.from("course_versions").select("id", { count: "exact", head: true }).eq("course_id", id),
      ]);
      const impact = {
        enrollments: enrollments.count || 0,
        sessions: sessions.count || 0,
        content: content.count || 0,
        versions: versions.count || 0,
      };

      const depsDeleted = await deleteCourseOperationalDependencies(supabase, id);
      if (depsDeleted.error) return json({ error: depsDeleted.error }, 500);

      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);

      auditLater(supabase, request, {
        actor: acct,
        action: "course.force_deleted",
        entityType: "course",
        entityId: id,
        entityDisplayName: courseTitle,
        metadata: { title_snapshot: courseTitle, impact },
      });
      return json({ ok: true, id, status: "force_deleted", method: "hard", impact });
    }

    // Always hard delete — count impact for audit log, then delete dependencies and course row
    const [enrollmentCount, sessionCount, contentCount, versionCount] = await Promise.all([
      supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", id),
      supabase.from("training_sessions").select("id", { count: "exact", head: true }).eq("course_id", id),
      supabase.from("course_content").select("id", { count: "exact", head: true }).eq("course_id", id),
      supabase.from("course_versions").select("id", { count: "exact", head: true }).eq("course_id", id),
    ]);
    const impact = {
      enrollments: enrollmentCount.count || 0,
      sessions: sessionCount.count || 0,
      content: contentCount.count || 0,
      versions: versionCount.count || 0,
    };

    const depsDeleted = await deleteCourseOperationalDependencies(supabase, id);
    if (depsDeleted.error) return json({ error: depsDeleted.error }, 500);

    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) return json({ error: error.message }, 500);

    // Verify row is gone
    const { data: verify } = await supabase.from("courses").select("id").eq("id", id).maybeSingle();
    if (verify) return json({ error: "Course record still exists after delete — operation incomplete." }, 500);

    auditLater(supabase, request, {
      actor: acct,
      action: "course.hard_deleted",
      entityType: "course",
      entityId: id,
      entityDisplayName: courseTitle,
      metadata: { title_snapshot: courseTitle, impact },
    });
    return json({ ok: true, id, status: "deleted", method: "hard", impact });
  }

  return methodNotAllowed();
}
