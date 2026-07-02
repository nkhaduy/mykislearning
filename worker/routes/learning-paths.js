/**
 * Learning Path API — Phase 2
 *
 * HR endpoints:  /api/admin/learning-paths*
 * Employee endpoints: /api/learning-paths/my*
 *
 * Auth is enforced at every handler.
 * Progress is calculated server-side; frontend cannot self-report completion.
 */

import { json, readJson, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";
import { createNotificationEvent } from "../services/notificationEngine.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  return crypto.randomUUID();
}

/** Derive assignment status from progress + due_at. */
function deriveAssignmentStatus(current, progressPercent, dueAt) {
  if (current === "cancelled" || current === "completed") return current;
  if (progressPercent >= 100) return "completed";
  if (dueAt && new Date(dueAt).getTime() < Date.now()) return "overdue";
  if (progressPercent > 0) return "in_progress";
  return "not_started";
}

/**
 * Recalculate progress_percent for an assignment from step progress rows.
 * Required steps only; optional steps don't block completion.
 */
async function recalcAssignmentProgress(supabase, assignmentId) {
  // Get all steps for this assignment's path
  const { data: assignment } = await supabase
    .from("learning_path_assignments")
    .select("learning_path_id, due_at, status")
    .eq("id", assignmentId)
    .single();
  if (!assignment) return;

  const { data: steps } = await supabase
    .from("learning_path_steps")
    .select("id, is_required")
    .eq("learning_path_id", assignment.learning_path_id);
  if (!steps?.length) return;

  const required = steps.filter((s) => s.is_required);
  if (!required.length) return;

  const { data: progress } = await supabase
    .from("learning_path_step_progress")
    .select("step_id, status")
    .eq("assignment_id", assignmentId);

  const completedIds = new Set((progress || []).filter((p) => p.status === "completed").map((p) => p.step_id));
  const completedRequired = required.filter((s) => completedIds.has(s.id)).length;
  const percent = Math.round((completedRequired / required.length) * 100);

  const newStatus = deriveAssignmentStatus(assignment.status, percent, assignment.due_at);
  const patch = {
    progress_percent: percent,
    status: newStatus,
    updated_at: nowIso(),
  };
  if (newStatus === "completed" && assignment.status !== "completed") {
    patch.completed_at = nowIso();
  }
  await supabase.from("learning_path_assignments").update(patch).eq("id", assignmentId);
}

/**
 * Determine the unlock status of a step for a given assignment.
 * sequential: step N unlocks only when all required steps before it are done.
 * flexible: steps without prerequisites are always available.
 */
async function resolveStepStatus(supabase, step, allSteps, progressMap, completionMode) {
  // If already in DB, return that
  const existing = progressMap.get(step.id);
  if (existing?.status === "completed") return "completed";
  if (existing?.status === "in_progress") return "in_progress";
  if (existing?.status === "skipped") return "skipped";

  if (completionMode === "flexible") {
    if (!step.prerequisite_step_id) return existing?.status ?? "available";
    const prereqDone = progressMap.get(step.prerequisite_step_id)?.status === "completed";
    return prereqDone ? (existing?.status ?? "available") : "locked";
  }

  // Sequential: all required steps before this position must be completed
  const required_before = allSteps.filter(
    (s) => s.position < step.position && s.is_required
  );
  const allDone = required_before.every(
    (s) => progressMap.get(s.id)?.status === "completed"
  );
  return allDone ? (existing?.status ?? "available") : "locked";
}

// ─── HR handlers ──────────────────────────────────────────────────────────────

async function hrListPaths(request, env) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const supabase = getSupabase(env);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "20", 10));
  const offset = (page - 1) * limit;

  let q = supabase
    .from("learning_paths")
    .select("id, title, description, status, completion_mode, thumbnail_url, estimated_duration_minutes, created_by, published_at, archived_at, created_at, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) q = q.eq("status", status);

  const { data: paths, error, count } = await q;
  if (error) return json({ error: error.message }, 500);

  // Enrich with step count + assignment count
  const ids = (paths || []).map((p) => p.id);
  let stepCounts = {};
  let assignCounts = {};
  let completedCounts = {};

  if (ids.length) {
    const { data: stepRows } = await supabase
      .from("learning_path_steps")
      .select("learning_path_id")
      .in("learning_path_id", ids);
    for (const r of stepRows || []) {
      stepCounts[r.learning_path_id] = (stepCounts[r.learning_path_id] || 0) + 1;
    }

    const { data: assignRows } = await supabase
      .from("learning_path_assignments")
      .select("learning_path_id, status")
      .in("learning_path_id", ids)
      .neq("status", "cancelled");
    for (const r of assignRows || []) {
      assignCounts[r.learning_path_id] = (assignCounts[r.learning_path_id] || 0) + 1;
      if (r.status === "completed") {
        completedCounts[r.learning_path_id] = (completedCounts[r.learning_path_id] || 0) + 1;
      }
    }
  }

  const enriched = (paths || []).map((p) => ({
    ...p,
    stepCount: stepCounts[p.id] || 0,
    assignmentCount: assignCounts[p.id] || 0,
    completedCount: completedCounts[p.id] || 0,
    completionRate: assignCounts[p.id]
      ? Math.round(((completedCounts[p.id] || 0) / assignCounts[p.id]) * 100)
      : 0,
  }));

  return json({ data: enriched, total: count ?? 0, page, limit });
}

async function hrCreatePath(request, env) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const body = await readJson(request);
  const title = (body?.title || "").trim();
  if (!title) return json({ error: "TITLE_REQUIRED" }, 400);

  const supabase = getSupabase(env);
  const id = uid();
  const row = {
    id,
    title,
    description: body.description || null,
    status: "draft",
    completion_mode: body.completion_mode || "sequential",
    thumbnail_url: body.thumbnail_url || null,
    estimated_duration_minutes: body.estimated_duration_minutes || null,
    created_by: acct.accountId,
    data: {},
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  const { error } = await supabase.from("learning_paths").insert(row);
  if (error) return json({ error: error.message }, 500);
  const { data: version } = await supabase.from("learning_path_versions").insert({
    learning_path_id: id,
    version_number: 1,
    status: "draft",
    title,
    description: body.description || null,
    completion_mode: row.completion_mode,
    completion_rules: {},
    source_data: row.data,
    change_type: "patch",
    change_summary: "Initial version",
    created_by: acct.accountId,
  }).select("id").maybeSingle();
  if (version?.id) await supabase.from("learning_paths").update({ current_version_id: version.id }).eq("id", id);
  return json({ ok: true, id }, 201);
}

async function hrGetPath(request, env, pathId) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const supabase = getSupabase(env);
  const { data: path, error } = await supabase
    .from("learning_paths")
    .select("*")
    .eq("id", pathId)
    .single();

  if (error || !path) return json({ error: "NOT_FOUND" }, 404);

  const { data: steps } = await supabase
    .from("learning_path_steps")
    .select("*")
    .eq("learning_path_id", pathId)
    .order("position", { ascending: true });

  return json({ ...path, steps: steps || [] });
}

async function hrUpdatePath(request, env, pathId) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const supabase = getSupabase(env);
  const { data: existing } = await supabase
    .from("learning_paths")
    .select("status")
    .eq("id", pathId)
    .single();
  if (!existing) return json({ error: "NOT_FOUND" }, 404);

  const body = await readJson(request);
  const patch = {};
  if (body.title !== undefined) patch.title = (body.title || "").trim();
  if (body.description !== undefined) patch.description = body.description || null;
  if (body.completion_mode !== undefined) patch.completion_mode = body.completion_mode;
  if (body.thumbnail_url !== undefined) patch.thumbnail_url = body.thumbnail_url || null;
  if (body.estimated_duration_minutes !== undefined) patch.estimated_duration_minutes = body.estimated_duration_minutes || null;
  patch.updated_at = nowIso();

  if (!Object.keys(patch).length) return json({ ok: true });

  const { error } = await supabase.from("learning_paths").update(patch).eq("id", pathId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function hrPublishPath(request, env, pathId) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const supabase = getSupabase(env);
  const { data: path } = await supabase
    .from("learning_paths")
    .select("id, status")
    .eq("id", pathId)
    .single();
  if (!path) return json({ error: "NOT_FOUND" }, 404);
  if (path.status === "archived") return json({ error: "CANNOT_PUBLISH_ARCHIVED" }, 400);

  const { error } = await supabase.from("learning_paths").update({
    status: "published",
    published_at: path.status === "published" ? undefined : nowIso(),
    updated_at: nowIso(),
  }).eq("id", pathId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function hrArchivePath(request, env, pathId) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const supabase = getSupabase(env);
  const { error } = await supabase.from("learning_paths").update({
    status: "archived",
    archived_at: nowIso(),
    updated_at: nowIso(),
  }).eq("id", pathId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

// Steps

async function hrAddStep(request, env, pathId) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const supabase = getSupabase(env);
  const { data: path } = await supabase
    .from("learning_paths")
    .select("status, current_version_id")
    .eq("id", pathId)
    .single();
  if (!path) return json({ error: "PATH_NOT_FOUND" }, 404);

  const body = await readJson(request);
  const stepType = body.step_type;
  if (!["course", "quiz", "training_session", "document", "external_link"].includes(stepType)) {
    return json({ error: "INVALID_STEP_TYPE" }, 400);
  }
  if (!body.resource_id && !["document", "external_link"].includes(stepType)) {
    return json({ error: "RESOURCE_ID_REQUIRED" }, 400);
  }

  // Get max position
  const { data: existing } = await supabase
    .from("learning_path_steps")
    .select("position")
    .eq("learning_path_id", pathId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = existing?.length ? (existing[0].position + 1) : 0;

  const id = uid();
  const row = {
    id,
    learning_path_id: pathId,
    step_type: stepType,
    resource_id: body.resource_id || null,
    title_override: body.title_override || null,
    description_override: body.description_override || null,
    position: body.position ?? nextPos,
    is_required: body.is_required !== false,
    prerequisite_step_id: body.prerequisite_step_id || null,
    due_offset_days: body.due_offset_days || null,
    estimated_duration_minutes: body.estimated_duration_minutes || null,
    data: {},
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  const { error } = await supabase.from("learning_path_steps").insert(row);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, id }, 201);
}

async function hrUpdateStep(request, env, pathId, stepId) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const supabase = getSupabase(env);
  const body = await readJson(request);
  const patch = {};
  if (body.title_override !== undefined) patch.title_override = body.title_override || null;
  if (body.description_override !== undefined) patch.description_override = body.description_override || null;
  if (body.resource_id !== undefined) patch.resource_id = body.resource_id || null;
  if (body.is_required !== undefined) patch.is_required = Boolean(body.is_required);
  if (body.prerequisite_step_id !== undefined) patch.prerequisite_step_id = body.prerequisite_step_id || null;
  if (body.due_offset_days !== undefined) patch.due_offset_days = body.due_offset_days || null;
  if (body.estimated_duration_minutes !== undefined) patch.estimated_duration_minutes = body.estimated_duration_minutes || null;
  patch.updated_at = nowIso();

  const { error } = await supabase.from("learning_path_steps")
    .update(patch)
    .eq("id", stepId)
    .eq("learning_path_id", pathId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function hrDeleteStep(request, env, pathId, stepId) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const supabase = getSupabase(env);
  const { error } = await supabase.from("learning_path_steps")
    .delete()
    .eq("id", stepId)
    .eq("learning_path_id", pathId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function hrReorderSteps(request, env, pathId) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const supabase = getSupabase(env);
  const body = await readJson(request);
  // body.order = [{id, position}]
  const order = body.order;
  if (!Array.isArray(order)) return json({ error: "ORDER_ARRAY_REQUIRED" }, 400);

  for (const item of order) {
    if (!item.id) continue;
    await supabase.from("learning_path_steps")
      .update({ position: item.position, updated_at: nowIso() })
      .eq("id", item.id)
      .eq("learning_path_id", pathId);
  }
  return json({ ok: true });
}

// Assignments

async function hrGetAssignments(request, env, pathId) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const supabase = getSupabase(env);
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50", 10));
  const offset = (page - 1) * limit;
  const statusFilter = url.searchParams.get("status") || "";

  let q = supabase
    .from("learning_path_assignments")
    .select("*, version:learning_path_versions(version_number,status)", { count: "exact" })
    .eq("learning_path_id", pathId)
    .order("assigned_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (statusFilter) q = q.eq("status", statusFilter);

  const { data, error, count } = await q;
  if (error) return json({ error: error.message }, 500);

  // Enrich with employee info
  const empIds = [...new Set((data || []).map((a) => a.employee_id))];
  let empMap = {};
  if (empIds.length) {
    const { data: emps } = await supabase
      .from("profiles")
      .select("id, full_name, department, position, email")
      .in("id", empIds);
    for (const e of emps || []) empMap[e.id] = e;
  }

  const enriched = (data || []).map((a) => ({
    ...a,
    learningPathVersion: a.version?.version_number ? `v${a.version.version_number}` : "",
    employee: empMap[a.employee_id] || { id: a.employee_id },
  }));

  return json({ data: enriched, total: count ?? 0, page, limit });
}

async function hrAssign(request, env, pathId) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const supabase = getSupabase(env);
  const { data: path } = await supabase
    .from("learning_paths")
    .select("status")
    .eq("id", pathId)
    .single();
  if (!path) return json({ error: "PATH_NOT_FOUND" }, 404);
  if (path.status !== "published") return json({ error: "PATH_NOT_PUBLISHED" }, 400);

  const body = await readJson(request);
  const employeeIds = body.employee_ids;
  if (!Array.isArray(employeeIds) || !employeeIds.length) {
    return json({ error: "EMPLOYEE_IDS_REQUIRED" }, 400);
  }

  const startAt = body.start_at || null;
  const dueAt = body.due_at || null;
  const source = body.assignment_source || "individual";

  // Check for existing assignments (skip duplicates)
  const { data: existing } = await supabase
    .from("learning_path_assignments")
    .select("employee_id")
    .eq("learning_path_id", pathId)
    .in("employee_id", employeeIds)
    .neq("status", "cancelled");

  const alreadyAssigned = new Set((existing || []).map((e) => e.employee_id));
  const toCreate = employeeIds.filter((id) => !alreadyAssigned.has(id));

  if (!toCreate.length) {
    return json({ ok: true, created: 0, skipped: alreadyAssigned.size, message: "ALL_ALREADY_ASSIGNED" });
  }

  const rows = toCreate.map((empId) => ({
    id: uid(),
    learning_path_id: pathId,
    learning_path_version_id: path.current_version_id || null,
    employee_id: empId,
    assigned_by: acct.accountId,
    assigned_at: nowIso(),
    start_at: startAt,
    due_at: dueAt,
    status: "not_started",
    progress_percent: 0,
    assignment_source: source,
    data: {},
    created_at: nowIso(),
    updated_at: nowIso(),
  }));

  const { error } = await supabase.from("learning_path_assignments").insert(rows);
  if (error) return json({ error: error.message }, 500);

  // Create idempotent notification events for assigned employees.
  try {
    const { data: pathInfo } = await supabase
      .from("learning_paths")
      .select("title")
      .eq("id", pathId)
      .single();

    await Promise.allSettled(rows.map((row) => createNotificationEvent(supabase, {
      eventType: "learning_path_assigned",
      entityType: "learning_path_assignment",
      entityId: row.id,
      actorId: acct.accountId,
      recipientId: row.employee_id,
      idempotencyKey: `learning_path_assigned:${row.id}:${row.employee_id}`,
      payload: {
        learning_path_title: pathInfo?.title || "Lộ trình học tập",
        due_date: row.due_at?.slice(0, 10) || "",
      },
    })));
  } catch { /* non-blocking */ }

  return json({ ok: true, created: toCreate.length, skipped: alreadyAssigned.size });
}

async function hrCancelAssignment(request, env, assignmentId) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const supabase = getSupabase(env);
  const { data: assignment } = await supabase
    .from("learning_path_assignments")
    .select("status, employee_id")
    .eq("id", assignmentId)
    .single();
  if (!assignment) return json({ error: "NOT_FOUND" }, 404);
  if (assignment.status === "completed") return json({ error: "CANNOT_CANCEL_COMPLETED" }, 400);

  const { error } = await supabase.from("learning_path_assignments").update({
    status: "cancelled",
    cancelled_at: nowIso(),
    updated_at: nowIso(),
  }).eq("id", assignmentId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

// Preview employees for assignment
async function hrPreviewTarget(request, env) {
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const supabase = getSupabase(env);
  const url = new URL(request.url);
  const pathId = url.searchParams.get("path_id");
  const department = url.searchParams.get("department") || "";
  const position = url.searchParams.get("position") || "";
  const empIds = url.searchParams.getAll("employee_id");

  let q = supabase
    .from("profiles")
    .select("id, full_name, department, position, email, account_status")
    .eq("account_status", "active")
    .eq("role", "employee");

  if (department) q = q.eq("department", department);
  if (position) q = q.eq("position", position);
  if (empIds.length) q = q.in("id", empIds);

  const { data: employees, error } = await q;
  if (error) return json({ error: error.message }, 500);

  let alreadyAssigned = new Set();
  if (pathId && employees?.length) {
    const ids = employees.map((e) => e.id);
    const { data: existing } = await supabase
      .from("learning_path_assignments")
      .select("employee_id")
      .eq("learning_path_id", pathId)
      .in("employee_id", ids)
      .neq("status", "cancelled");
    alreadyAssigned = new Set((existing || []).map((e) => e.employee_id));
  }

  const result = (employees || []).map((e) => ({
    ...e,
    already_assigned: alreadyAssigned.has(e.id),
  }));
  const toAssign = result.filter((e) => !e.already_assigned);

  return json({ employees: result, will_create: toAssign.length, already_assigned: alreadyAssigned.size });
}

// ─── Employee handlers ─────────────────────────────────────────────────────────

async function empMyPaths(request, env) {
  const acct = await requireAuth(request, env);
  if (!acct) return json({ error: "UNAUTHORIZED" }, 401);

  const supabase = getSupabase(env);
  const { data: assignments, error } = await supabase
    .from("learning_path_assignments")
    .select("*, version:learning_path_versions(version_number,status)")
    .eq("employee_id", acct.accountId)
    .neq("status", "cancelled")
    .order("assigned_at", { ascending: false });

  if (error) return json({ error: error.message }, 500);

  // Enrich with path info
  const pathIds = [...new Set((assignments || []).map((a) => a.learning_path_id))];
  let pathMap = {};
  if (pathIds.length) {
    const { data: paths } = await supabase
      .from("learning_paths")
      .select("id, title, description, status, completion_mode, thumbnail_url, estimated_duration_minutes")
      .in("id", pathIds);
    for (const p of paths || []) pathMap[p.id] = p;
  }

  // Filter: employee only sees published paths (or their in-progress/completed ones)
  const result = (assignments || [])
    .filter((a) => {
      const p = pathMap[a.learning_path_id];
      if (!p) return false;
      // Show assignment if path is published, OR if they already started/completed
      return p.status === "published" || ["in_progress", "completed"].includes(a.status);
    })
    .map((a) => ({
      ...a,
      learningPathVersion: a.version?.version_number ? `v${a.version.version_number}` : "",
      path: pathMap[a.learning_path_id] || null,
    }));

  return json(result);
}

async function empGetPathDetail(request, env, assignmentId) {
  const acct = await requireAuth(request, env);
  if (!acct) return json({ error: "UNAUTHORIZED" }, 401);

  const supabase = getSupabase(env);

  // IDOR protection: verify assignment belongs to this employee
  const { data: assignment, error: aErr } = await supabase
    .from("learning_path_assignments")
    .select("*, version:learning_path_versions(version_number,status)")
    .eq("id", assignmentId)
    .eq("employee_id", acct.accountId)
    .single();

  if (aErr || !assignment) return json({ error: "NOT_FOUND" }, 404);

  const { data: path } = await supabase
    .from("learning_paths")
    .select("id, title, description, status, completion_mode, estimated_duration_minutes")
    .eq("id", assignment.learning_path_id)
    .single();

  const { data: steps } = await supabase
    .from("learning_path_steps")
    .select("*")
    .eq("learning_path_id", assignment.learning_path_id)
    .order("position", { ascending: true });

  // Get step progress for this assignment
  const { data: progressRows } = await supabase
    .from("learning_path_step_progress")
    .select("*")
    .eq("assignment_id", assignmentId);

  const progressMap = new Map((progressRows || []).map((p) => [p.step_id, p]));

  // Resolve status for each step
  const completionMode = path?.completion_mode || "sequential";
  const enrichedSteps = await Promise.all(
    (steps || []).map(async (step) => {
      const status = await resolveStepStatus(supabase, step, steps || [], progressMap, completionMode);
      const prog = progressMap.get(step.id);
      return {
        ...step,
        computed_status: status,
        progress_percent: prog?.progress_percent || 0,
        started_at: prog?.started_at || null,
        completed_at: prog?.completed_at || null,
        last_activity_at: prog?.last_activity_at || null,
      };
    })
  );

  return json({ assignment, path, steps: enrichedSteps });
}

async function empStartStep(request, env, assignmentId, stepId) {
  const acct = await requireAuth(request, env);
  if (!acct) return json({ error: "UNAUTHORIZED" }, 401);

  const supabase = getSupabase(env);

  // IDOR check
  const { data: assignment } = await supabase
    .from("learning_path_assignments")
    .select("id, learning_path_id, status, employee_id")
    .eq("id", assignmentId)
    .eq("employee_id", acct.accountId)
    .single();
  if (!assignment) return json({ error: "NOT_FOUND" }, 404);
  if (assignment.status === "cancelled") return json({ error: "ASSIGNMENT_CANCELLED" }, 400);

  // Verify step belongs to this path
  const { data: step } = await supabase
    .from("learning_path_steps")
    .select("*")
    .eq("id", stepId)
    .eq("learning_path_id", assignment.learning_path_id)
    .single();
  if (!step) return json({ error: "STEP_NOT_FOUND" }, 404);

  // Check/create step progress
  const { data: existing } = await supabase
    .from("learning_path_step_progress")
    .select("id, status")
    .eq("assignment_id", assignmentId)
    .eq("step_id", stepId)
    .single();

  if (existing?.status === "completed") return json({ ok: true, status: "completed" });

  const now = nowIso();
  if (!existing) {
    await supabase.from("learning_path_step_progress").insert({
      id: uid(),
      assignment_id: assignmentId,
      step_id: stepId,
      status: "in_progress",
      started_at: now,
      progress_percent: 0,
      last_activity_at: now,
      data: {},
      created_at: now,
      updated_at: now,
    });
  } else {
    await supabase.from("learning_path_step_progress").update({
      status: "in_progress",
      started_at: existing.started_at || now,
      last_activity_at: now,
      updated_at: now,
    }).eq("id", existing.id);
  }

  // Update assignment to in_progress if still not_started
  if (assignment.status === "not_started") {
    await supabase.from("learning_path_assignments").update({
      status: "in_progress",
      updated_at: now,
    }).eq("id", assignmentId);
  }

  return json({ ok: true, status: "in_progress" });
}

async function empCompleteStep(request, env, assignmentId, stepId) {
  const acct = await requireAuth(request, env);
  if (!acct) return json({ error: "UNAUTHORIZED" }, 401);

  const supabase = getSupabase(env);

  // IDOR check
  const { data: assignment } = await supabase
    .from("learning_path_assignments")
    .select("id, learning_path_id, employee_id, status")
    .eq("id", assignmentId)
    .eq("employee_id", acct.accountId)
    .single();
  if (!assignment) return json({ error: "NOT_FOUND" }, 404);
  if (assignment.status === "cancelled") return json({ error: "ASSIGNMENT_CANCELLED" }, 400);

  const { data: step } = await supabase
    .from("learning_path_steps")
    .select("id, step_type, resource_id, is_required, learning_path_id")
    .eq("id", stepId)
    .eq("learning_path_id", assignment.learning_path_id)
    .single();
  if (!step) return json({ error: "STEP_NOT_FOUND" }, 404);

  // Verify actual resource completion (anti-cheat)
  const body = await readJson(request).catch(() => ({}));
  const attemptReference = body?.attempt_reference || null;

  let resourceCompleted = false;

  if (step.step_type === "course" && step.resource_id) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("status")
      .eq("course_id", step.resource_id)
      .eq("account_id", acct.accountId)
      .single();
    resourceCompleted = enrollment?.status === "completed";
  } else if (step.step_type === "quiz" && step.resource_id) {
    const { data: attempts } = await supabase
      .from("quiz_attempts")
      .select("passed")
      .eq("quiz_id", step.resource_id)
      .eq("account_id", acct.accountId)
      .eq("passed", true);
    resourceCompleted = (attempts || []).length > 0;
  } else if (step.step_type === "training_session" && step.resource_id) {
    const { data: reg } = await supabase
      .from("training_registrations")
      .select("data")
      .eq("session_id", step.resource_id)
      .eq("account_id", acct.accountId)
      .single();
    resourceCompleted = reg?.data?.attended === true || reg?.data?.status === "attended";
  } else {
    // document / external_link: trust that employee reached the page
    resourceCompleted = true;
  }

  if (!resourceCompleted) {
    return json({ error: "RESOURCE_NOT_COMPLETED", message: "Complete the resource before marking this step done." }, 400);
  }

  const now = nowIso();
  const { data: existing } = await supabase
    .from("learning_path_step_progress")
    .select("id, status")
    .eq("assignment_id", assignmentId)
    .eq("step_id", stepId)
    .single();

  if (existing?.status === "completed") {
    return json({ ok: true, status: "completed", already: true });
  }

  if (!existing) {
    await supabase.from("learning_path_step_progress").insert({
      id: uid(),
      assignment_id: assignmentId,
      step_id: stepId,
      status: "completed",
      started_at: now,
      completed_at: now,
      progress_percent: 100,
      attempt_reference: attemptReference,
      last_activity_at: now,
      data: {},
      created_at: now,
      updated_at: now,
    });
  } else {
    await supabase.from("learning_path_step_progress").update({
      status: "completed",
      completed_at: now,
      progress_percent: 100,
      attempt_reference: attemptReference,
      last_activity_at: now,
      updated_at: now,
    }).eq("id", existing.id);
  }

  // Recalculate assignment progress
  await recalcAssignmentProgress(supabase, assignmentId);

  return json({ ok: true, status: "completed" });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export async function handleLearningPaths(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // ── Employee routes ──────────────────────────────────────────
    if (path === "/api/learning-paths/my") {
      if (method === "GET") return empMyPaths(request, env);
    }

    const myDetailMatch = path.match(/^\/api\/learning-paths\/my\/([^/]+)$/);
    if (myDetailMatch) {
      const assignmentId = myDetailMatch[1];
      if (method === "GET") return empGetPathDetail(request, env, assignmentId);
    }

    const stepMatch = path.match(/^\/api\/learning-paths\/my\/([^/]+)\/steps\/([^/]+)\/(start|complete)$/);
    if (stepMatch) {
      const [, assignmentId, stepId, action] = stepMatch;
      if (method === "POST") {
        if (action === "start") return empStartStep(request, env, assignmentId, stepId);
        if (action === "complete") return empCompleteStep(request, env, assignmentId, stepId);
      }
    }

    // ── HR: preview target ───────────────────────────────────────
    if (path === "/api/admin/learning-paths/preview-target") {
      if (method === "GET") return hrPreviewTarget(request, env);
    }

    // ── HR: cancel assignment ────────────────────────────────────
    const cancelMatch = path.match(/^\/api\/admin\/learning-path-assignments\/([^/]+)\/cancel$/);
    if (cancelMatch) {
      if (method === "POST") return hrCancelAssignment(request, env, cancelMatch[1]);
    }

    // ── HR: path list + create ───────────────────────────────────
    if (path === "/api/admin/learning-paths") {
      if (method === "GET") return hrListPaths(request, env);
      if (method === "POST") return hrCreatePath(request, env);
    }

    // ── HR: single path ──────────────────────────────────────────
    const pathIdMatch = path.match(/^\/api\/admin\/learning-paths\/([^/]+)$/);
    if (pathIdMatch) {
      const pathId = pathIdMatch[1];
      if (method === "GET") return hrGetPath(request, env, pathId);
      if (method === "PATCH") return hrUpdatePath(request, env, pathId);
    }

    const publishMatch = path.match(/^\/api\/admin\/learning-paths\/([^/]+)\/publish$/);
    if (publishMatch) {
      if (method === "POST") return hrPublishPath(request, env, publishMatch[1]);
    }

    const archiveMatch = path.match(/^\/api\/admin\/learning-paths\/([^/]+)\/archive$/);
    if (archiveMatch) {
      if (method === "POST") return hrArchivePath(request, env, archiveMatch[1]);
    }

    // ── HR: steps ────────────────────────────────────────────────
    const stepsMatch = path.match(/^\/api\/admin\/learning-paths\/([^/]+)\/steps$/);
    if (stepsMatch) {
      const pathId = stepsMatch[1];
      if (method === "POST") return hrAddStep(request, env, pathId);
    }

    const stepIdMatch = path.match(/^\/api\/admin\/learning-paths\/([^/]+)\/steps\/([^/]+)$/);
    if (stepIdMatch) {
      const [, pathId, stepId] = stepIdMatch;
      if (method === "PATCH") return hrUpdateStep(request, env, pathId, stepId);
      if (method === "DELETE") return hrDeleteStep(request, env, pathId, stepId);
    }

    const reorderMatch = path.match(/^\/api\/admin\/learning-paths\/([^/]+)\/reorder$/);
    if (reorderMatch) {
      if (method === "POST") return hrReorderSteps(request, env, reorderMatch[1]);
    }

    // ── HR: assignments ──────────────────────────────────────────
    const assignmentsMatch = path.match(/^\/api\/admin\/learning-paths\/([^/]+)\/assignments$/);
    if (assignmentsMatch) {
      const pathId = assignmentsMatch[1];
      if (method === "GET") return hrGetAssignments(request, env, pathId);
    }

    const assignMatch = path.match(/^\/api\/admin\/learning-paths\/([^/]+)\/assign$/);
    if (assignMatch) {
      if (method === "POST") return hrAssign(request, env, assignMatch[1]);
    }

    return json({ error: "NOT_FOUND" }, 404);
  } catch (err) {
    console.error("[learning-paths]", err);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
}
