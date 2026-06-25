import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";

const ACTIVE_EMPLOYEE_STATUSES = ["active", "pending", "locked"];

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix = "cmp") {
  return `${prefix}-${crypto.randomUUID()}`;
}

function cleanText(value) {
  return String(value || "").trim();
}

function addDaysIso(base, days) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString();
}

function isOnOrAfter(value, floor) {
  if (!value || !floor) return false;
  return new Date(value).getTime() >= new Date(floor).getTime();
}

function error(code, status = 400, message = code) {
  return json({ ok: false, error: code, message }, status);
}

function normalizeProgram(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    status: row.status,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    recurrenceType: row.recurrence_type,
    recurrenceIntervalMonths: row.recurrence_interval_months,
    defaultDurationDays: row.default_duration_days,
    defaultPassScore: row.default_pass_score,
    defaultMaxAttempts: row.default_max_attempts,
    defaultGracePeriodDays: row.default_grace_period_days,
    requiresRetrainingOnResourceChange: row.requires_retraining_on_resource_change,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    data: row.data || {},
  };
}

function normalizeCycle(row) {
  if (!row) return null;
  return {
    id: row.id,
    programId: row.program_id,
    cycleCode: row.cycle_code,
    title: row.title,
    status: row.status,
    startAt: row.start_at,
    dueAt: row.due_at,
    graceUntil: row.grace_until,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    passScore: row.pass_score,
    maxAttempts: row.max_attempts,
    activatedAt: row.activated_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    program: row.program ? normalizeProgram(row.program) : undefined,
  };
}

function normalizeAssignment(row) {
  if (!row) return null;
  return {
    id: row.id,
    cycleId: row.cycle_id,
    employeeId: row.employee_id,
    assignmentSource: row.assignment_source,
    assignedAt: row.assigned_at,
    startAt: row.start_at,
    dueAt: row.due_at,
    graceUntil: row.grace_until,
    status: row.status,
    progressPercent: row.progress_percent,
    attemptCount: row.attempt_count,
    lastActivityAt: row.last_activity_at,
    completedAt: row.completed_at,
    overdueAt: row.overdue_at,
    exemptedAt: row.exempted_at,
    exemptionReason: row.exemption_reason,
    data: row.data || {},
    cycle: row.cycle ? normalizeCycle(row.cycle) : undefined,
    employee: row.employee || undefined,
  };
}

async function resourceExists(supabase, type, id) {
  if (!["course", "learning_path"].includes(type) || !id) return false;
  const table = type === "course" ? "courses" : "learning_paths";
  const { data, error } = await supabase.from(table).select("id, status").eq("id", id).maybeSingle();
  if (error || !data) return false;
  return data.status === "published";
}

async function listEmployees(supabase) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, account_status, department, position, notes")
    .eq("role", "employee")
    .in("account_status", ACTIVE_EMPLOYEE_STATUSES)
    .order("full_name", { ascending: true });
  if (error) throw Object.assign(new Error(error.message), { status: 500, code: "EMPLOYEE_LOOKUP_FAILED" });
  return (data || []).filter((p) => !String(p.notes || "").includes('"soft_deleted":true'));
}

async function resolveTargets(supabase, programId, cycleId = "") {
  const { data: rules, error: ruleErr } = await supabase
    .from("compliance_target_rules")
    .select("*")
    .eq("program_id", programId);
  if (ruleErr) throw Object.assign(new Error(ruleErr.message), { status: 500, code: "TARGET_RULE_LOOKUP_FAILED" });

  const employees = await listEmployees(supabase);
  const selected = new Map();
  const inactive = [];
  for (const rule of rules || []) {
    for (const emp of employees) {
      const match = rule.target_type === "all_employees"
        || (rule.target_type === "department" && emp.department === rule.target_value)
        || (rule.target_type === "job_title" && emp.position === rule.target_value)
        || (rule.target_type === "individual" && emp.id === rule.target_value);
      if (match) selected.set(emp.id, emp);
    }
  }

  const ids = [...selected.keys()];
  const existing = new Set();
  if (cycleId && ids.length) {
    const { data } = await supabase
      .from("compliance_assignments")
      .select("employee_id")
      .eq("cycle_id", cycleId)
      .in("employee_id", ids);
    for (const row of data || []) existing.add(row.employee_id);
  }

  return {
    rules: rules || [],
    employees: ids.map((id) => ({ ...selected.get(id), alreadyAssigned: existing.has(id) })),
    inactive,
    totalMatched: ids.length,
    alreadyAssigned: existing.size,
    willCreate: ids.filter((id) => !existing.has(id)).length,
  };
}

async function syncAssignment(supabase, assignment) {
  if (["completed", "exempted", "cancelled"].includes(assignment.status)) return assignment;
  const { data: cycle } = await supabase
    .from("compliance_cycles")
    .select("*")
    .eq("id", assignment.cycle_id)
    .single();
  if (!cycle) return assignment;

  let completed = false;
  let completedAt = null;
  let score = null;
  let source = cycle.resource_type === "course" ? "course_completion" : "learning_path_completion";
  let progress = assignment.progress_percent || 0;
  let attempts = assignment.attempt_count || 0;

  if (cycle.resource_type === "course") {
    const { data: enr } = await supabase
      .from("enrollments")
      .select("id, status, updated_at, data")
      .eq("course_id", cycle.resource_id)
      .eq("account_id", assignment.employee_id)
      .maybeSingle();
    if (enr) {
      completedAt = enr.data?.completedAt || enr.data?.completed_at || enr.updated_at || nowIso();
      if (isOnOrAfter(completedAt, cycle.start_at)) {
        progress = Number(enr.data?.progressPercent ?? enr.data?.progress_percent ?? (enr.status === "completed" ? 100 : progress)) || 0;
        completed = enr.status === "completed" || progress >= 100;
      } else {
        progress = 0;
        completed = false;
      }
    }
    const { data: quizRows } = await supabase
      .from("quiz_attempts")
      .select("id, score_percent, passed, submitted_at, created_at")
      .eq("course_id", cycle.resource_id)
      .eq("account_id", assignment.employee_id)
      .order("created_at", { ascending: false });
    attempts = quizRows?.length || attempts;
    const best = (quizRows || []).filter((a) => a.score_percent !== null).sort((a, b) => (b.score_percent || 0) - (a.score_percent || 0))[0];
    if (best) score = best.score_percent;
    if (cycle.pass_score > 0) {
      completed = completed && score !== null && score >= cycle.pass_score && isOnOrAfter(best?.submitted_at || best?.created_at, cycle.start_at);
      source = "quiz_pass";
      completedAt = best?.submitted_at || completedAt;
    }
  } else {
    const { data: lp } = await supabase
      .from("learning_path_assignments")
      .select("id, status, progress_percent, completed_at, updated_at")
      .eq("learning_path_id", cycle.resource_id)
      .eq("employee_id", assignment.employee_id)
      .maybeSingle();
    if (lp) {
      completedAt = lp.completed_at || lp.updated_at || nowIso();
      if (isOnOrAfter(completedAt, cycle.start_at)) {
        progress = lp.progress_percent || 0;
        completed = lp.status === "completed" && progress >= 100;
      } else {
        progress = 0;
        completed = false;
      }
    }
  }

  const now = nowIso();
  let status = assignment.status;
  if (completed) status = "completed";
  else if (cycle.max_attempts > 0 && attempts >= cycle.max_attempts && cycle.pass_score > 0) status = "failed";
  else if (new Date(assignment.due_at).getTime() < Date.now()) status = "overdue";
  else if (progress > 0 || assignment.status === "in_progress") status = "in_progress";
  else status = "not_started";

  const patch = {
    status,
    progress_percent: Math.min(100, Math.max(0, progress)),
    attempt_count: attempts,
    last_activity_at: progress > 0 ? now : assignment.last_activity_at,
    updated_at: now,
  };
  if (status === "completed") patch.completed_at = completedAt || now;
  if (status === "overdue" && !assignment.overdue_at) patch.overdue_at = now;

  const { data: updated, error: upErr } = await supabase
    .from("compliance_assignments")
    .update(patch)
    .eq("id", assignment.id)
    .select("*")
    .single();
  if (upErr) throw Object.assign(new Error(upErr.message), { status: 500, code: "ASSIGNMENT_SYNC_FAILED" });

  if (status === "completed") {
    const wasOnTime = new Date(patch.completed_at).getTime() <= new Date(assignment.due_at).getTime();
    const record = {
      id: uid("ccr"),
      assignment_id: assignment.id,
      cycle_id: assignment.cycle_id,
      employee_id: assignment.employee_id,
      resource_type: cycle.resource_type,
      resource_id: cycle.resource_id,
      completion_source: source,
      completed_at: patch.completed_at,
      score,
      attempt_number: attempts || null,
      was_completed_on_time: wasOnTime,
      evidence: {
        syncedAt: now,
        resourceType: cycle.resource_type,
        resourceId: cycle.resource_id,
        programId: cycle.program_id,
      },
    };
    await supabase.from("compliance_completion_records").upsert(record, {
      onConflict: "assignment_id,completion_source,completed_at",
      ignoreDuplicates: true,
    });
  }
  return updated;
}

async function hrListPrograms(request, env) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const supabase = getSupabase(env);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
  let q = supabase.from("compliance_programs").select("*", { count: "exact" }).order("updated_at", { ascending: false }).range((page - 1) * limit, page * limit - 1);
  const status = url.searchParams.get("status");
  if (status) q = q.eq("status", status);
  const { data, error: err, count } = await q;
  if (err) return error("PROGRAM_LIST_FAILED", 500, err.message);
  return json({ data: (data || []).map(normalizeProgram), total: count || 0, page, limit });
}

async function hrCreateProgram(request, env) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const body = await readJson(request);
  const code = cleanText(body.code).toUpperCase();
  const title = cleanText(body.title);
  const resourceType = cleanText(body.resourceType || body.resource_type);
  const resourceId = cleanText(body.resourceId || body.resource_id);
  if (!code || !title) return error("PROGRAM_REQUIRED_FIELDS", 400);
  const supabase = getSupabase(env);
  if (!(await resourceExists(supabase, resourceType, resourceId))) return error("RESOURCE_NOT_FOUND", 404);
  const row = {
    id: body.id || uid("cp"),
    code,
    title,
    description: body.description || null,
    status: "draft",
    resource_type: resourceType,
    resource_id: resourceId,
    recurrence_type: body.recurrenceType || body.recurrence_type || "one_time",
    recurrence_interval_months: body.recurrenceIntervalMonths || body.recurrence_interval_months || null,
    default_duration_days: Number(body.defaultDurationDays || body.default_duration_days || 30),
    default_pass_score: Number(body.defaultPassScore || body.default_pass_score || 0),
    default_max_attempts: Number(body.defaultMaxAttempts || body.default_max_attempts || 0),
    default_grace_period_days: Number(body.defaultGracePeriodDays || body.default_grace_period_days || 0),
    requires_retraining_on_resource_change: Boolean(body.requiresRetrainingOnResourceChange || body.requires_retraining_on_resource_change),
    created_by: acct.accountId,
    data: { auditHooks: ["program_created", "program_published"], notificationHooks: ["compliance_assigned", "compliance_completed"] },
  };
  const { error: err } = await supabase.from("compliance_programs").insert(row);
  if (err) return error(err.code === "23505" ? "DUPLICATE_PROGRAM_CODE" : "PROGRAM_CREATE_FAILED", err.code === "23505" ? 409 : 500, err.message);
  return json({ ok: true, id: row.id }, 201);
}

async function hrGetProgram(request, env, id) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const supabase = getSupabase(env);
  const { data, error: err } = await supabase.from("compliance_programs").select("*").eq("id", id).single();
  if (err || !data) return error("PROGRAM_NOT_FOUND", 404);
  const { data: targets } = await supabase.from("compliance_target_rules").select("*").eq("program_id", id).order("created_at");
  const { data: cycles } = await supabase.from("compliance_cycles").select("*").eq("program_id", id).order("start_at", { ascending: false });
  return json({ ...normalizeProgram(data), targets: targets || [], cycles: (cycles || []).map(normalizeCycle) });
}

async function hrPatchProgram(request, env, id) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const body = await readJson(request);
  const patch = { updated_at: nowIso() };
  for (const [from, to] of [["title", "title"], ["description", "description"], ["defaultDurationDays", "default_duration_days"], ["defaultPassScore", "default_pass_score"], ["defaultMaxAttempts", "default_max_attempts"], ["defaultGracePeriodDays", "default_grace_period_days"]]) {
    if (body[from] !== undefined) patch[to] = body[from];
  }
  const supabase = getSupabase(env);
  const { error: err } = await supabase.from("compliance_programs").update(patch).eq("id", id);
  if (err) return error("PROGRAM_UPDATE_FAILED", 500, err.message);
  return json({ ok: true });
}

async function hrTransitionProgram(request, env, id, action) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const supabase = getSupabase(env);
  const { data: program } = await supabase.from("compliance_programs").select("*").eq("id", id).single();
  if (!program) return error("PROGRAM_NOT_FOUND", 404);
  if (action === "publish") {
    if (program.status === "archived") return error("INVALID_STATE_TRANSITION", 409);
    if (!(await resourceExists(supabase, program.resource_type, program.resource_id))) return error("RESOURCE_NOT_FOUND", 404);
    const { data: rules } = await supabase.from("compliance_target_rules").select("id").eq("program_id", id).limit(1);
    if (!rules?.length) return error("TARGET_RULE_REQUIRED", 400);
    await supabase.from("compliance_programs").update({ status: "published", published_at: program.published_at || nowIso(), updated_at: nowIso() }).eq("id", id);
    return json({ ok: true });
  }
  if (action === "archive") {
    await supabase.from("compliance_programs").update({ status: "archived", archived_at: nowIso(), updated_at: nowIso() }).eq("id", id);
    return json({ ok: true });
  }
  return error("INVALID_ACTION", 404);
}

async function hrCreateTarget(request, env, programId) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const body = await readJson(request);
  const targetType = cleanText(body.targetType || body.target_type);
  const targetValue = targetType === "all_employees" ? null : cleanText(body.targetValue || body.target_value);
  if (!["all_employees", "department", "job_title", "individual"].includes(targetType)) return error("INVALID_TARGET_TYPE", 400);
  const supabase = getSupabase(env);
  const row = { id: uid("ctr"), program_id: programId, target_type: targetType, target_value: targetValue };
  const { error: err } = await supabase.from("compliance_target_rules").insert(row);
  if (err) return error(err.code === "23505" ? "DUPLICATE_TARGET_RULE" : "TARGET_CREATE_FAILED", err.code === "23505" ? 409 : 500, err.message);
  return json({ ok: true, id: row.id }, 201);
}

async function hrDeleteTarget(request, env, programId, targetId) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const supabase = getSupabase(env);
  await supabase.from("compliance_target_rules").delete().eq("id", targetId).eq("program_id", programId);
  return json({ ok: true });
}

async function hrCreateCycle(request, env) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const body = await readJson(request);
  const supabase = getSupabase(env);
  const { data: program } = await supabase.from("compliance_programs").select("*").eq("id", body.programId || body.program_id).single();
  if (!program) return error("PROGRAM_NOT_FOUND", 404);
  const startAt = new Date(body.startAt || body.start_at).toISOString();
  const dueAt = new Date(body.dueAt || body.due_at).toISOString();
  if (new Date(dueAt).getTime() < new Date(startAt).getTime()) return error("INVALID_DATE_RANGE", 400);
  const graceDays = Number(body.gracePeriodDays ?? body.grace_period_days ?? program.default_grace_period_days ?? 0);
  const row = {
    id: body.id || uid("ccy"),
    program_id: program.id,
    cycle_code: cleanText(body.cycleCode || body.cycle_code).toUpperCase(),
    title: cleanText(body.title),
    status: "draft",
    start_at: startAt,
    due_at: dueAt,
    grace_until: graceDays > 0 ? addDaysIso(dueAt, graceDays) : null,
    resource_type: program.resource_type,
    resource_id: program.resource_id,
    resource_revision_reference: program.updated_at,
    pass_score: Number(body.passScore ?? body.pass_score ?? program.default_pass_score ?? 0),
    max_attempts: Number(body.maxAttempts ?? body.max_attempts ?? program.default_max_attempts ?? 0),
    created_by: acct.accountId,
    data: { recurrenceType: program.recurrence_type, programCode: program.code, auditHooks: ["cycle_activated", "assignments_created"] },
  };
  if (!row.cycle_code || !row.title) return error("CYCLE_REQUIRED_FIELDS", 400);
  const { error: err } = await supabase.from("compliance_cycles").insert(row);
  if (err) return error(err.code === "23505" ? "DUPLICATE_CYCLE_CODE" : "CYCLE_CREATE_FAILED", err.code === "23505" ? 409 : 500, err.message);
  return json({ ok: true, id: row.id }, 201);
}

async function hrListCycles(request, env) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const supabase = getSupabase(env);
  const { data, error: err } = await supabase
    .from("compliance_cycles")
    .select("*, program:compliance_programs(*)")
    .order("start_at", { ascending: false })
    .limit(100);
  if (err) return error("CYCLE_LIST_FAILED", 500, err.message);
  return json({ data: (data || []).map(normalizeCycle) });
}

async function hrGetCycle(request, env, id) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const supabase = getSupabase(env);
  const { data, error: err } = await supabase.from("compliance_cycles").select("*, program:compliance_programs(*)").eq("id", id).single();
  if (err || !data) return error("CYCLE_NOT_FOUND", 404);
  return json(normalizeCycle(data));
}

async function hrTransitionCycle(request, env, id, action) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const supabase = getSupabase(env);
  const { data: cycle } = await supabase.from("compliance_cycles").select("*, program:compliance_programs(*)").eq("id", id).single();
  if (!cycle) return error("CYCLE_NOT_FOUND", 404);
  if (action === "activate") {
    if (cycle.program.status !== "published") return error("PROGRAM_NOT_PUBLISHED", 409);
    if (!(await resourceExists(supabase, cycle.resource_type, cycle.resource_id))) return error("RESOURCE_NOT_FOUND", 404);
    await supabase.from("compliance_cycles").update({ status: "active", activated_at: nowIso(), updated_at: nowIso() }).eq("id", id);
    return json({ ok: true });
  }
  if (action === "close") {
    await supabase.from("compliance_cycles").update({ status: "closed", closed_at: nowIso(), updated_at: nowIso() }).eq("id", id);
    return json({ ok: true });
  }
  if (action === "cancel") {
    await supabase.from("compliance_cycles").update({ status: "cancelled", updated_at: nowIso() }).eq("id", id);
    await supabase
      .from("compliance_assignments")
      .update({ status: "cancelled", updated_at: nowIso() })
      .eq("cycle_id", id)
      .not("status", "in", '("completed","exempted")');
    return json({ ok: true });
  }
  return error("INVALID_ACTION", 404);
}

async function hrPreviewTarget(request, env, cycleId) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const supabase = getSupabase(env);
  const { data: cycle } = await supabase.from("compliance_cycles").select("program_id").eq("id", cycleId).single();
  if (!cycle) return error("CYCLE_NOT_FOUND", 404);
  const preview = await resolveTargets(supabase, cycle.program_id, cycleId);
  return json(preview);
}

async function hrAssignCycle(request, env, cycleId) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const supabase = getSupabase(env);
  const { data: cycle } = await supabase.from("compliance_cycles").select("*").eq("id", cycleId).single();
  if (!cycle) return error("CYCLE_NOT_FOUND", 404);
  if (cycle.status !== "active") return error("CYCLE_NOT_ACTIVE", 409);
  const preview = await resolveTargets(supabase, cycle.program_id, cycleId);
  const rows = preview.employees.filter((e) => !e.alreadyAssigned).map((e) => ({
    id: uid("cas"),
    cycle_id: cycle.id,
    employee_id: e.id,
    assignment_source: "target_rule",
    start_at: cycle.start_at,
    due_at: cycle.due_at,
    grace_until: cycle.grace_until,
    status: new Date(cycle.due_at).getTime() < Date.now() ? "overdue" : "not_started",
    overdue_at: new Date(cycle.due_at).getTime() < Date.now() ? nowIso() : null,
    data: { employeeName: e.full_name, department: e.department, jobTitle: e.position, notificationHook: "compliance_assigned" },
  }));
  if (!rows.length) return json({ ok: true, created: 0, duplicate: preview.alreadyAssigned });
  const { error: err } = await supabase.from("compliance_assignments").insert(rows);
  if (err) return error("ASSIGNMENT_CREATE_FAILED", 500, err.message);
  return json({ ok: true, created: rows.length, duplicate: preview.alreadyAssigned });
}

async function hrListAssignments(request, env, cycleId) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const supabase = getSupabase(env);
  const { data, error: err } = await supabase
    .from("compliance_assignments")
    .select("*")
    .eq("cycle_id", cycleId)
    .order("due_at", { ascending: true });
  if (err) return error("ASSIGNMENT_LIST_FAILED", 500, err.message);
  return json({ data: (data || []).map(normalizeAssignment) });
}

async function hrGetAssignment(request, env, id) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const supabase = getSupabase(env);
  const { data, error: err } = await supabase.from("compliance_assignments").select("*").eq("id", id).single();
  if (err || !data) return error("ASSIGNMENT_NOT_FOUND", 404);
  return json(normalizeAssignment(data));
}

async function hrExemptAssignment(request, env, id) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const body = await readJson(request);
  const reason = cleanText(body.reason || body.exemptionReason);
  if (!reason) return error("REASON_REQUIRED", 400);
  const supabase = getSupabase(env);
  const { error: err } = await supabase.from("compliance_assignments").update({
    status: "exempted",
    exempted_at: nowIso(),
    exemption_reason: reason,
    data: { evidence: body.evidence || null, auditHook: "assignment_exempted" },
  }).eq("id", id);
  if (err) return error("EXEMPT_FAILED", 500, err.message);
  return json({ ok: true });
}

async function hrManualComplete(request, env, id) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const body = await readJson(request);
  const reason = cleanText(body.reason);
  const evidence = cleanText(body.evidence);
  if (!reason || !evidence) return error("MANUAL_EVIDENCE_REQUIRED", 400);
  const supabase = getSupabase(env);
  const { data: assignment } = await supabase.from("compliance_assignments").select("*").eq("id", id).single();
  if (!assignment) return error("ASSIGNMENT_NOT_FOUND", 404);
  const { data: existingManual } = await supabase
    .from("compliance_completion_records")
    .select("id")
    .eq("assignment_id", id)
    .eq("completion_source", "manual_verified")
    .limit(1);
  if (existingManual?.length) {
    return json({ ok: true, id: existingManual[0].id, duplicate: false });
  }
  const { data: cycle } = await supabase.from("compliance_cycles").select("*").eq("id", assignment.cycle_id).single();
  const completedAt = nowIso();
  await supabase.from("compliance_assignments").update({ status: "completed", progress_percent: 100, completed_at: completedAt, updated_at: completedAt }).eq("id", id);
  const { data: record, error: recordErr } = await supabase.from("compliance_completion_records").insert({
    id: uid("ccr"),
    assignment_id: id,
    cycle_id: assignment.cycle_id,
    employee_id: assignment.employee_id,
    resource_type: cycle.resource_type,
    resource_id: cycle.resource_id,
    completion_source: "manual_verified",
    completed_at: completedAt,
    score: body.score ?? null,
    attempt_number: assignment.attempt_count || null,
    was_completed_on_time: new Date(completedAt).getTime() <= new Date(assignment.due_at).getTime(),
    evidence: { reason, evidence, verifiedBy: acct.accountId, auditHook: "manual_completion" },
  }).select("id").single();
  if (recordErr) return error("MANUAL_COMPLETE_FAILED", 500, recordErr.message);
  return json({ ok: true, id: record.id, duplicate: false });
}

async function hrOverview(request, env) {
  const acct = await requireHr(request, env);
  if (!acct) return error("HR_ONLY", 403);
  const supabase = getSupabase(env);
  const [programs, assignments] = await Promise.all([
    supabase.from("compliance_programs").select("status", { count: "exact" }).eq("status", "published"),
    supabase.from("compliance_assignments").select("status, due_at, completed_at"),
  ]);
  if (programs.error || assignments.error) return error("OVERVIEW_FAILED", 500);
  const rows = assignments.data || [];
  const dueSoonLimit = Date.now() + 7 * 86400000;
  return json({
    activePrograms: programs.count || 0,
    assignedEmployees: rows.length,
    completedOnTime: rows.filter((r) => r.status === "completed" && r.completed_at && new Date(r.completed_at) <= new Date(r.due_at)).length,
    overdue: rows.filter((r) => r.status === "overdue").length,
    failed: rows.filter((r) => r.status === "failed").length,
    dueSoon: rows.filter((r) => !["completed", "exempted", "cancelled"].includes(r.status) && new Date(r.due_at).getTime() <= dueSoonLimit).length,
  });
}

async function employeeList(request, env) {
  const acct = await requireAuth(request, env);
  if (!acct) return error("UNAUTHORIZED", 401);
  const supabase = getSupabase(env);
  const { data, error: err } = await supabase
    .from("compliance_assignments")
    .select("*, cycle:compliance_cycles(*, program:compliance_programs(*))")
    .eq("employee_id", acct.accountId)
    .neq("status", "cancelled")
    .order("due_at", { ascending: true });
  if (err) return error("ASSIGNMENT_LIST_FAILED", 500, err.message);
  const synced = [];
  for (const row of data || []) {
    if (row.cycle?.status === "cancelled") continue;
    const updated = await syncAssignment(supabase, row);
    synced.push({ ...row, ...updated });
  }
  return json({ data: synced.map(normalizeAssignment) });
}

async function employeeGet(request, env, id) {
  const acct = await requireAuth(request, env);
  if (!acct) return error("UNAUTHORIZED", 401);
  const supabase = getSupabase(env);
  const { data, error: err } = await supabase
    .from("compliance_assignments")
    .select("*, cycle:compliance_cycles(*, program:compliance_programs(*))")
    .eq("id", id)
    .eq("employee_id", acct.accountId)
    .single();
  if (err || !data) return error("ASSIGNMENT_NOT_FOUND", 404);
  const updated = await syncAssignment(supabase, data);
  const { data: records } = await supabase.from("compliance_completion_records").select("*").eq("assignment_id", id).order("created_at", { ascending: false });
  return json({ assignment: normalizeAssignment({ ...data, ...updated }), completionRecords: records || [] });
}

async function employeeStart(request, env, id) {
  const acct = await requireAuth(request, env);
  if (!acct) return error("UNAUTHORIZED", 401);
  const supabase = getSupabase(env);
  const { data } = await supabase.from("compliance_assignments").select("*").eq("id", id).eq("employee_id", acct.accountId).single();
  if (!data) return error("ASSIGNMENT_NOT_FOUND", 404);
  if (data.status === "not_started") {
    await supabase.from("compliance_assignments").update({ status: "in_progress", last_activity_at: nowIso(), updated_at: nowIso() }).eq("id", id);
  }
  return json({ ok: true });
}

async function employeeSync(request, env, id) {
  const acct = await requireAuth(request, env);
  if (!acct) return error("UNAUTHORIZED", 401);
  const supabase = getSupabase(env);
  const { data } = await supabase.from("compliance_assignments").select("*").eq("id", id).eq("employee_id", acct.accountId).single();
  if (!data) return error("ASSIGNMENT_NOT_FOUND", 404);
  const synced = await syncAssignment(supabase, data);
  if (synced.status !== "completed") return error("RESOURCE_NOT_COMPLETED", 409);
  return json({ ok: true, assignment: normalizeAssignment(synced) });
}

export async function handleCompliance(request, env) {
  if (request.method.toUpperCase() === "OPTIONS") return corsPreflight();
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (path === "/api/admin/compliance/overview" && method === "GET") return hrOverview(request, env);
  if (path === "/api/admin/compliance/programs" && method === "GET") return hrListPrograms(request, env);
  if (path === "/api/admin/compliance/programs" && method === "POST") return hrCreateProgram(request, env);
  let m = path.match(/^\/api\/admin\/compliance\/programs\/([^/]+)$/);
  if (m && method === "GET") return hrGetProgram(request, env, m[1]);
  if (m && method === "PATCH") return hrPatchProgram(request, env, m[1]);
  m = path.match(/^\/api\/admin\/compliance\/programs\/([^/]+)\/(publish|archive)$/);
  if (m && method === "POST") return hrTransitionProgram(request, env, m[1], m[2]);
  m = path.match(/^\/api\/admin\/compliance\/programs\/([^/]+)\/targets$/);
  if (m && method === "GET") return hrGetProgram(request, env, m[1]);
  if (m && method === "POST") return hrCreateTarget(request, env, m[1]);
  m = path.match(/^\/api\/admin\/compliance\/programs\/([^/]+)\/targets\/([^/]+)$/);
  if (m && method === "DELETE") return hrDeleteTarget(request, env, m[1], m[2]);

  if (path === "/api/admin/compliance/cycles" && method === "GET") return hrListCycles(request, env);
  if (path === "/api/admin/compliance/cycles" && method === "POST") return hrCreateCycle(request, env);
  m = path.match(/^\/api\/admin\/compliance\/cycles\/([^/]+)$/);
  if (m && method === "GET") return hrGetCycle(request, env, m[1]);
  m = path.match(/^\/api\/admin\/compliance\/cycles\/([^/]+)\/(activate|close|cancel)$/);
  if (m && method === "POST") return hrTransitionCycle(request, env, m[1], m[2]);
  m = path.match(/^\/api\/admin\/compliance\/cycles\/([^/]+)\/preview-target$/);
  if (m && method === "GET") return hrPreviewTarget(request, env, m[1]);
  m = path.match(/^\/api\/admin\/compliance\/cycles\/([^/]+)\/assign$/);
  if (m && method === "POST") return hrAssignCycle(request, env, m[1]);
  m = path.match(/^\/api\/admin\/compliance\/cycles\/([^/]+)\/assignments$/);
  if (m && method === "GET") return hrListAssignments(request, env, m[1]);

  m = path.match(/^\/api\/admin\/compliance\/assignments\/([^/]+)$/);
  if (m && method === "GET") return hrGetAssignment(request, env, m[1]);
  m = path.match(/^\/api\/admin\/compliance\/assignments\/([^/]+)\/exempt$/);
  if (m && method === "POST") return hrExemptAssignment(request, env, m[1]);
  m = path.match(/^\/api\/admin\/compliance\/assignments\/([^/]+)\/manual-complete$/);
  if (m && method === "POST") return hrManualComplete(request, env, m[1]);

  if (path === "/api/compliance/my" && method === "GET") return employeeList(request, env);
  m = path.match(/^\/api\/compliance\/my\/([^/]+)$/);
  if (m && method === "GET") return employeeGet(request, env, m[1]);
  m = path.match(/^\/api\/compliance\/my\/([^/]+)\/start$/);
  if (m && method === "POST") return employeeStart(request, env, m[1]);
  m = path.match(/^\/api\/compliance\/my\/([^/]+)\/sync$/);
  if (m && method === "POST") return employeeSync(request, env, m[1]);

  return methodNotAllowed();
}
