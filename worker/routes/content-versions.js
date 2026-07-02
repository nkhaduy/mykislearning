import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireHr } from "../middleware/auth.js";
import { auditLater } from "../services/audit-service.js";
import { createNotificationEvent } from "../services/notificationEngine.js";
import {
  affectedEmployees,
  compareVersions,
  createDraftVersion,
  getVersion,
  listVersions,
  publishVersion,
  retireVersion,
  submitVersionReview,
  updateDraftVersion,
} from "../services/versioning-service.js";

const ROUTES = [
  { re: /^\/api\/admin\/courses\/([^/]+)\/versions(?:\/([^/]+))?(?:\/([^/]+))?$/, type: "course" },
  { re: /^\/api\/admin\/quizzes\/([^/]+)\/versions(?:\/([^/]+))?(?:\/([^/]+))?$/, type: "quiz" },
  { re: /^\/api\/admin\/learning-paths\/([^/]+)\/versions(?:\/([^/]+))?(?:\/([^/]+))?$/, type: "learning_path" },
];

function errorResponse(error) {
  return json({ ok: false, error: error.code || error.message || "VERSION_ERROR" }, error.status || 500);
}

async function handleEntityVersions(request, env, match, type) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);
  const supabase = getSupabase(env);
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const [, entityId, versionId, action] = match;

  try {
    if (method === "GET" && (!versionId || versionId === "compare")) {
      const compare = url.searchParams.get("compare") || versionId === "compare";
      if (compare) {
        const before = await getVersion(supabase, type, url.searchParams.get("from"));
        const after = await getVersion(supabase, type, url.searchParams.get("to"));
        return json({ before, after, changes: compareVersions(before, after) });
      }
      return json({ data: await listVersions(supabase, type, entityId) });
    }
    if (method === "GET" && versionId && !action) return json(await getVersion(supabase, type, versionId));
    if (method === "POST" && !versionId) {
      const body = await readJson(request).catch(() => ({}));
      const version = await createDraftVersion(supabase, request, acct, type, entityId, body.createdFromVersionId || body.created_from_version_id);
      return json({ ok: true, version }, 201);
    }
    if (method === "PATCH" && versionId && !action) {
      const body = await readJson(request);
      const version = await updateDraftVersion(supabase, request, acct, type, versionId, body);
      return json({ ok: true, version });
    }
    if (method === "POST" && action === "submit-review") return json({ ok: true, version: await submitVersionReview(supabase, request, acct, type, versionId) });
    if (method === "POST" && action === "publish") return json({ ok: true, ...(await publishVersion(supabase, request, acct, type, versionId)) });
    if (method === "POST" && action === "retire") return json({ ok: true, version: await retireVersion(supabase, request, acct, type, versionId) });
  } catch (error) {
    return errorResponse(error);
  }
  return methodNotAllowed();
}

async function handleRetraining(request, env) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);
  const supabase = getSupabase(env);
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const path = url.pathname;
  const idMatch = path.match(/^\/api\/admin\/retraining-reviews\/([^/]+)(?:\/([^/]+))?$/);

  if (path === "/api/admin/retraining-reviews" && method === "GET") {
    const { data, error } = await supabase.from("retraining_reviews").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) return json({ error: error.message }, 500);
    return json({ data: data || [] });
  }
  if (!idMatch) return methodNotAllowed();

  const [, id, action] = idMatch;
  const { data: review, error } = await supabase.from("retraining_reviews").select("*").eq("id", id).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!review) return json({ error: "RETRAINING_REVIEW_NOT_FOUND" }, 404);

  if (method === "GET" && !action) return json(review);

  if (method === "POST" && action === "preview") {
    const employees = await affectedEmployees(supabase, review.entity_type, review.entity_id, review.from_version_id);
    await supabase.from("retraining_reviews").update({ affected_employee_count: employees.length, target_rule: { employeeIds: employees }, updated_at: new Date().toISOString() }).eq("id", id);
    return json({ affectedEmployeeCount: employees.length, employeeIds: employees });
  }

  if (method === "POST" && ["approve", "dismiss"].includes(action)) {
    const body = await readJson(request).catch(() => ({}));
    const status = action === "approve" ? "approved" : "dismissed";
    const { data, error: updateErr } = await supabase.from("retraining_reviews").update({
      status,
      decision: action,
      decision_reason: body.reason || body.decision_reason || null,
      decided_by: acct.accountId,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", id).select().single();
    if (updateErr) return json({ error: updateErr.message }, 500);
    auditLater(supabase, request, { actor: acct, action: `retraining.review_${status}`, entityType: "retraining_review", entityId: id, metadata: { affected_employee_count: data.affected_employee_count } });
    return json({ ok: true, review: data });
  }

  if (method === "POST" && action === "apply") {
    if (review.status === "applied") return json({ error: "RETRAINING_ALREADY_APPLIED" }, 409);
    if (review.status !== "approved") return json({ error: "INVALID_VERSION_TRANSITION" }, 409);
    const employeeIds = review.target_rule?.employeeIds || await affectedEmployees(supabase, review.entity_type, review.entity_id, review.from_version_id);
    let created = 0;
    for (const employeeId of employeeIds) {
      if (review.entity_type === "course") {
        const courseId = review.entity_id;
        const enrollmentId = `retrain-${id}-${employeeId}`;
        const { error: enrErr } = await supabase.from("enrollments").upsert({
          id: enrollmentId,
          course_id: courseId,
          account_id: employeeId,
          status: "notStarted",
          course_version_id: review.to_version_id,
          data: { retraining: true, reviewId: id, assignedVersionId: review.to_version_id },
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
        await supabase.from("retraining_assignments").upsert({
          review_id: id, employee_id: employeeId, assignment_type: "course", assignment_id: enrollmentId, version_id: review.to_version_id, status: enrErr ? "failed" : "created", error_code: enrErr?.code || null,
        }, { onConflict: "review_id,employee_id,assignment_type" });
        if (!enrErr) created += 1;
        await createNotificationEvent(supabase, {
          eventType: "retraining_assigned",
          entityType: "course_assignment",
          entityId: enrollmentId,
          actorId: acct.accountId,
          recipientId: employeeId,
          idempotencyKey: `retraining_assigned:${id}:${employeeId}`,
          payload: { course_title: "Đào tạo lại", version: review.to_version_id },
        }).catch(() => {});
      }
    }
    await supabase.from("retraining_reviews").update({ status: "applied", updated_at: new Date().toISOString() }).eq("id", id);
    auditLater(supabase, request, { actor: acct, action: "retraining.applied", entityType: "retraining_review", entityId: id, metadata: { affected_employee_count: employeeIds.length, created } });
    return json({ ok: true, created, affectedEmployeeCount: employeeIds.length });
  }

  return methodNotAllowed();
}

export async function handleContentVersions(request, env) {
  if (request.method.toUpperCase() === "OPTIONS") return corsPreflight();
  const path = new URL(request.url).pathname;
  if (path === "/api/admin/retraining-reviews" || path.startsWith("/api/admin/retraining-reviews/")) {
    return handleRetraining(request, env);
  }
  for (const route of ROUTES) {
    const match = path.match(route.re);
    if (match) return handleEntityVersions(request, env, match, route.type);
  }
  return methodNotAllowed();
}
