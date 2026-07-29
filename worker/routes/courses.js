import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { hasAdministrativeAccess, requireAuth, requireHr } from "../middleware/auth.js";
import { auditLater } from "../services/audit-service.js";

const STORAGE_BUCKET = "course-content";
const SIGNED_URL_EXPIRES = 3600;
const COURSE_STATUSES = new Set(["draft", "published", "archived"]);

function courseText(value, field, { required = false, max = 4000 } = {}) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  if (required && !normalized) throw Object.assign(new Error(`${field} is required`), { status: 422, code: "INVALID_INPUT" });
  if (normalized.length > max) throw Object.assign(new Error(`${field} is too long`), { status: 422, code: "INVALID_INPUT" });
  return normalized || null;
}

function generatedCourseId(title) {
  const slug = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "course";
  return `${slug}-${crypto.randomUUID().slice(0, 8)}`;
}

export function validateCourseCreationInput(body = {}) {
  const title = courseText(body.title || body.name, "title", { required: true, max: 200 });
  const requestedId = courseText(body.id, "id", { max: 128 });
  if (requestedId && !/^[\p{L}\p{N}._~-]+$/u.test(requestedId)) {
    throw Object.assign(new Error("id is invalid"), { status: 422, code: "INVALID_COURSE_ID" });
  }
  const status = courseText(body.status || "draft", "status", { max: 20 });
  if (!COURSE_STATUSES.has(status)) throw Object.assign(new Error("status is invalid"), { status: 422, code: "INVALID_COURSE_STATUS" });
  const deliveryMode = courseText(body.deliveryMode || body.delivery_mode || "online", "deliveryMode", { max: 40 });
  const description = courseText(body.description, "description", { max: 4000 });
  const durationMinutesRaw = body.durationMinutes ?? body.duration_minutes ?? null;
  const durationMinutes = durationMinutesRaw === null || durationMinutesRaw === "" ? null : Number(durationMinutesRaw);
  if (durationMinutes !== null && (!Number.isSafeInteger(durationMinutes) || durationMinutes < 0 || durationMinutes > 525600)) {
    throw Object.assign(new Error("durationMinutes is invalid"), { status: 422, code: "INVALID_DURATION" });
  }
  return {
    ...body,
    id: requestedId || generatedCourseId(title),
    title,
    description: description || "",
    status,
    deliveryMode,
    durationMinutes,
    objectives: Array.isArray(body.objectives) ? body.objectives.map((item) => String(item).trim()).filter(Boolean).slice(0, 50) : [],
  };
}

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
  const versionStatusReset = await supabase
    .from("course_versions")
    .update({ status: "draft" })
    .eq("course_id", courseId)
    .in("status", ["published", "retired", "archived"]);
  if (versionStatusReset.error) return { error: "course_versions_status: " + versionStatusReset.error.message };
  const verDel = await supabase.from("course_versions").delete().eq("course_id", courseId);
  if (verDel.error) return { error: "course_versions: " + verDel.error.message };

  return { ok: true };
}

async function getCourseImpact(supabase, id) {
  const [enrollments, sessions, content, versions, lpSteps, compliance] = await Promise.all([
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", id),
    supabase.from("training_sessions").select("id", { count: "exact", head: true }).eq("course_id", id),
    supabase.from("course_content").select("id", { count: "exact", head: true }).eq("course_id", id),
    supabase.from("course_versions").select("id", { count: "exact", head: true }).eq("course_id", id),
    supabase.from("learning_path_steps").select("id", { count: "exact", head: true }).eq("resource_id", id).eq("resource_type", "course").catch(() => ({ count: 0 })),
    supabase.from("compliance_requirements").select("id", { count: "exact", head: true }).eq("resource_id", id).catch(() => ({ count: 0 })),
  ]);
  return {
    enrollments: enrollments.count || 0,
    sessions: sessions.count || 0,
    content: content.count || 0,
    versions: versions.count || 0,
    learningPaths: lpSteps.count || 0,
    compliance: compliance.count || 0,
  };
}

function hasCourseDependencies(impact) {
  return ["enrollments", "sessions", "content", "versions", "learningPaths", "compliance"].some((key) => impact[key] > 0);
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

    const impact = await getCourseImpact(supabase, id);

    const title = course.data?.data?.title || course.data?.data?.name || id;
    return json({
      ok: true,
      id,
      title,
      status: course.data.status,
      impact,
      safeToDelete: !hasCourseDependencies(impact),
    });
  }

  // ── /api/courses ────────────────────────────────────────────────────────────
  if (method === "GET") {
    const acct = await requireAuth(request, env);
    if (!acct) return json({ error: "Unauthorized" }, 401);

    if (hasAdministrativeAccess(acct)) {
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

  if (path === "/api/courses" && method === "POST") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const course = validateCourseCreationInput(await readJson(request));
    const { data: existing, error: existingError } = await supabase.from("courses").select("id, status, data, created_by, current_version_id").eq("id", course.id).maybeSingle();
    if (existingError) return json({ error: "COURSE_LOOKUP_FAILED" }, 500);
    const created = !existing;
    const row = {
      id: course.id, status: course.status || "draft",
      delivery_mode: course.deliveryMode || course.delivery_mode || "online",
      created_by: existing?.created_by || acct.accountId,
      data: { ...(existing?.data || {}), ...course, createdBy: existing?.data?.createdBy || existing?.created_by || acct.accountId },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("courses").upsert(row, { onConflict: "id" });
    if (error) return json({ error: "COURSE_CREATE_FAILED" }, 500);

    let { data: initialVersion, error: versionLookupError } = await supabase.from("course_versions")
      .select("id, status, version_number").eq("course_id", course.id).eq("version_number", 1).maybeSingle();
    if (versionLookupError) {
      if (created) await supabase.from("courses").delete().eq("id", course.id);
      return json({ error: "COURSE_VERSION_LOOKUP_FAILED" }, 500);
    }
    if (!initialVersion) {
      const versionInsert = await supabase.from("course_versions").insert({
        course_id: course.id,
        version_number: 1,
        status: row.status === "published" ? "published" : "draft",
        title: course.title,
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
      }).select("id, status, version_number").maybeSingle();
      initialVersion = versionInsert.data || null;
      if (versionInsert.error?.code === "23505") {
        const raced = await supabase.from("course_versions").select("id, status, version_number")
          .eq("course_id", course.id).eq("version_number", 1).maybeSingle();
        initialVersion = raced.data || null;
      } else if (versionInsert.error) {
        if (created) await supabase.from("courses").delete().eq("id", course.id);
        auditLater(supabase, request, { actor: acct, action: "course.create_failed", status: "failed", entityType: "course", entityId: course.id, errorCode: "COURSE_VERSION_CREATE_FAILED", metadata: { course_cleanup: created ? "attempted" : "not_applicable" } });
        return json({ error: "COURSE_VERSION_CREATE_FAILED" }, 500);
      }
    }
    if (!initialVersion?.id) {
      if (created) await supabase.from("courses").delete().eq("id", course.id);
      return json({ error: "COURSE_VERSION_CREATE_FAILED" }, 500);
    }
    const currentVersionUpdate = await supabase.from("courses").update({ current_version_id: initialVersion.id }).eq("id", course.id);
    if (currentVersionUpdate.error) {
      if (created) {
        await supabase.from("course_versions").delete().eq("id", initialVersion.id);
        await supabase.from("courses").delete().eq("id", course.id);
      }
      return json({ error: "COURSE_VERSION_LINK_FAILED" }, 500);
    }
    auditLater(supabase, request, {
      actor: acct,
      action: existing ? (existing.status !== row.status && row.status === "published" ? "course.published" : "course.updated") : "course.created",
      entityType: "course",
      entityId: course.id,
      entityDisplayName: course.title,
      beforeData: existing ? { status: existing.status, title: existing.data?.title || existing.data?.name || "" } : null,
      afterData: { status: row.status, title: course.title, initial_version_id: initialVersion.id },
    });
    return json({
      ok: true,
      created,
      course: { ...row.data, id: course.id, status: row.status, deliveryMode: row.delivery_mode, currentVersionId: initialVersion.id },
      initialVersion: { id: initialVersion.id, status: initialVersion.status, versionNumber: initialVersion.version_number || 1 },
    }, created ? 201 : 200);
  }

  if (path === "/api/courses/bulk" && method === "POST") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request);
    const ids = [...new Set(Array.isArray(body.ids) ? body.ids.filter(Boolean) : [])];
    const action = body.action || "delete";
    if (!ids.length) return json({ error: "ids[] required" }, 400);
    if (!["delete", "archive", "publish", "restore"].includes(action)) return json({ error: "Unsupported bulk action" }, 400);

    const results = [];
    for (const id of ids) {
      const { data: row, error: findError } = await supabase.from("courses").select("id, status, data").eq("id", id).maybeSingle();
      if (findError) { results.push({ id, status: "failed", reason: findError.message }); continue; }
      if (!row) { results.push({ id, status: "failed", reason: "Course not found" }); continue; }
      const title = row.data?.title || row.data?.name || id;
      if (action === "delete") {
        const impact = await getCourseImpact(supabase, id);
        if (hasCourseDependencies(impact)) {
          const archived = await supabase.from("courses").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", id);
          if (archived.error) results.push({ id, title, status: "failed", reason: archived.error.message, impact });
          else {
            auditLater(supabase, request, { actor: acct, action: "course.archived_by_bulk_delete", entityType: "course", entityId: id, entityDisplayName: title, metadata: { impact } });
            results.push({ id, title, status: "archived", reason: "Course has dependent records", impact });
          }
          continue;
        }
        const deleted = await supabase.from("courses").delete().eq("id", id);
        if (deleted.error) results.push({ id, title, status: "failed", reason: deleted.error.message });
        else {
          auditLater(supabase, request, { actor: acct, action: "course.hard_deleted_bulk", entityType: "course", entityId: id, entityDisplayName: title });
          results.push({ id, title, status: "deleted" });
        }
        continue;
      }
      const nextStatus = action === "publish" ? "published" : action === "restore" ? "draft" : "archived";
      const updated = await supabase.from("courses").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", id);
      if (updated.error) results.push({ id, title, status: "failed", reason: updated.error.message });
      else { auditLater(supabase, request, { actor: acct, action: `course.${nextStatus}_bulk`, entityType: "course", entityId: id, entityDisplayName: title }); results.push({ id, title, status: nextStatus }); }
    }
    return json({ ok: true, action, results });
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
