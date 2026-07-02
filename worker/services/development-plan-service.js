import { auditLater, writeAuditLog } from "./audit-service.js";
import { createNotificationEvent } from "./notificationEngine.js";
import { assertLevelBelongs, cid, cleanText, getEmployee, httpError, sanitizeMetadata, syncEvidenceForEmployee } from "./competency-service.js";

function allowed(value, values, fallback) {
  return values.includes(value) ? value : fallback;
}

export async function listPlans(supabase, filters = {}) {
  let query = supabase.from("development_plans").select("*").order("created_at", { ascending: false }).limit(1000);
  if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw httpError(error.message, 500);
  const planIds = (data || []).map((plan) => plan.id);
  const itemsByPlan = new Map();
  if (planIds.length) {
    const { data: items, error: itemErr } = await supabase.from("development_plan_items").select("*").in("development_plan_id", planIds).limit(10000);
    if (itemErr) throw httpError(itemErr.message, 500);
    for (const item of items || []) itemsByPlan.set(item.development_plan_id, [...(itemsByPlan.get(item.development_plan_id) || []), item]);
  }
  const employeeIds = [...new Set((data || []).map((plan) => plan.employee_id).filter(Boolean))];
  const employees = new Map();
  if (employeeIds.length) {
    const rows = await Promise.all(employeeIds.map((id) => getEmployee(supabase, id).catch(() => null)));
    for (const row of rows) if (row) employees.set(row.id, row);
  }
  return { data: (data || []).map((plan) => ({ ...plan, employee: employees.get(plan.employee_id) || null, items: itemsByPlan.get(plan.id) || [] })) };
}

export async function getPlan(supabase, id, employeeScope = "") {
  let query = supabase.from("development_plans")
    .select("*")
    .eq("id", id);
  if (employeeScope) query = query.eq("employee_id", employeeScope);
  const { data, error } = await query.maybeSingle();
  if (error) throw httpError(error.message, 500);
  if (!data) throw httpError("DEVELOPMENT_PLAN_NOT_FOUND", 404);
  const { data: items, error: itemErr } = await supabase.from("development_plan_items")
    .select("*, competency:competencies(*)")
    .eq("development_plan_id", id)
    .order("due_at", { ascending: true, nullsFirst: false });
  if (itemErr) throw httpError(itemErr.message, 500);
  const levelIds = [...new Set((items || []).flatMap((item) => [item.current_level_id, item.target_level_id]).filter(Boolean))];
  const levels = new Map();
  if (levelIds.length) {
    const { data: levelRows, error: levelErr } = await supabase.from("competency_levels").select("*").in("id", levelIds);
    if (levelErr) throw httpError(levelErr.message, 500);
    for (const level of levelRows || []) levels.set(level.id, level);
  }
  const employee = await getEmployee(supabase, data.employee_id).catch(() => null);
  return { ...data, employee, items: (items || []).map((item) => ({ ...item, current_level: levels.get(item.current_level_id) || null, target_level: levels.get(item.target_level_id) || null })) };
}

export async function createPlan(supabase, request, acct, body) {
  const employeeId = cleanText(body.employeeId || body.employee_id);
  await getEmployee(supabase, employeeId);
  const row = {
    id: cid("dpln"),
    employee_id: employeeId,
    title: cleanText(body.title, 200) || "Kế hoạch phát triển cá nhân",
    description: cleanText(body.description, 1500),
    status: "draft",
    start_at: body.startAt || body.start_at || null,
    target_end_at: body.targetEndAt || body.target_end_at || null,
    created_by: acct.accountId,
  };
  const { data, error } = await supabase.from("development_plans").insert(row).select().single();
  if (error) throw httpError(error.message, 500);
  auditLater(supabase, request, { actor: acct, action: "development_plan.created", entityType: "development_plan", entityId: data.id, metadata: { employee_id: employeeId, plan_id: data.id } });
  return data;
}

export async function updatePlan(supabase, request, acct, id, body) {
  const existing = await getPlan(supabase, id);
  const patch = {
    title: body.title !== undefined ? cleanText(body.title, 200) : existing.title,
    description: body.description !== undefined ? cleanText(body.description, 1500) : existing.description,
    target_end_at: body.targetEndAt || body.target_end_at || existing.target_end_at,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("development_plans").update(patch).eq("id", id).select().single();
  if (error) throw httpError(error.message, 500);
  auditLater(supabase, request, { actor: acct, action: "development_plan.updated", entityType: "development_plan", entityId: id, metadata: { employee_id: existing.employee_id, plan_id: id } });
  return data;
}

export async function transitionPlan(supabase, request, acct, id, action) {
  const existing = await getPlan(supabase, id);
  const now = new Date().toISOString();
  const patch = { updated_at: now };
  if (action === "activate") Object.assign(patch, { status: "active", approved_by: acct.accountId, approved_at: now, start_at: existing.start_at || now });
  else if (action === "complete") Object.assign(patch, { status: "completed", completed_at: now });
  else if (action === "cancel") Object.assign(patch, { status: "cancelled" });
  else throw httpError("INVALID_PLAN_ACTION", 400);
  const { data, error } = await supabase.from("development_plans").update(patch).eq("id", id).select().single();
  if (error) throw httpError(error.message, 500);
  auditLater(supabase, request, { actor: acct, action: `development_plan.${action === "activate" ? "activated" : action === "cancel" ? "cancelled" : "completed"}`, entityType: "development_plan", entityId: id, metadata: { employee_id: existing.employee_id, plan_id: id } });
  if (action === "activate") {
    await createNotificationEvent(supabase, { eventType: "development_plan_assigned", entityType: "development_plan", entityId: id, actorId: acct.accountId, recipientId: existing.employee_id, idempotencyKey: `development_plan_assigned:${id}`, payload: { plan_title: data.title }, link: "/dashboard/development-plan" }).catch(() => {});
  }
  if (action === "complete") {
    await createNotificationEvent(supabase, { eventType: "development_plan_completed", entityType: "development_plan", entityId: id, actorId: acct.accountId, recipientId: existing.employee_id, idempotencyKey: `development_plan_completed:${id}`, payload: { plan_title: data.title }, link: "/dashboard/development-plan" }).catch(() => {});
  }
  return data;
}

export async function addPlanItem(supabase, request, acct, planId, body) {
  const plan = await getPlan(supabase, planId);
  const competencyId = cleanText(body.competencyId || body.competency_id);
  const targetLevelId = cleanText(body.targetLevelId || body.target_level_id);
  const currentLevelId = cleanText(body.currentLevelId || body.current_level_id) || null;
  await assertLevelBelongs(supabase, competencyId, targetLevelId);
  if (currentLevelId) await assertLevelBelongs(supabase, competencyId, currentLevelId);
  const resourceType = cleanText(body.resourceType || body.resource_type) || null;
  const resourceId = cleanText(body.resourceId || body.resource_id) || null;
  const resourceVersionId = cleanText(body.resourceVersionId || body.resource_version_id);
  if ((resourceType || resourceId || resourceVersionId) && (!resourceType || !resourceId)) throw httpError("RESOURCE_MAPPING_NOT_FOUND", 400);
  const row = {
    id: cid("dpit"),
    development_plan_id: planId,
    competency_id: competencyId,
    current_level_id: currentLevelId,
    target_level_id: targetLevelId,
    resource_type: resourceType,
    resource_id: resourceId,
    resource_version_id: resourceVersionId,
    status: "planned",
    priority: allowed(cleanText(body.priority), ["low", "medium", "high", "critical"], "medium"),
    due_at: body.dueAt || body.due_at || null,
    assigned_at: new Date().toISOString(),
    created_by: acct.accountId,
  };
  const { data, error } = await supabase.from("development_plan_items").insert(row).select().single();
  if (error) throw httpError(error.message, 500);
  auditLater(supabase, request, { actor: acct, action: "development_plan.item_added", entityType: "development_plan_item", entityId: data.id, metadata: { employee_id: plan.employee_id, plan_id: planId, item_id: data.id, competency_id: row.competency_id, resource_id: row.resource_id, resource_version_id: row.resource_version_id } });
  return data;
}

export async function updatePlanItem(supabase, request, acct, planId, itemId, body) {
  const plan = await getPlan(supabase, planId);
  const { data: existing, error: findErr } = await supabase.from("development_plan_items").select("*").eq("id", itemId).eq("development_plan_id", planId).maybeSingle();
  if (findErr) throw httpError(findErr.message, 500);
  if (!existing) throw httpError("PLAN_ITEM_NOT_FOUND", 404);
  const targetLevelId = body.targetLevelId || body.target_level_id || existing.target_level_id;
  const resourceType = body.resourceType || body.resource_type || existing.resource_type;
  const resourceId = body.resourceId || body.resource_id || existing.resource_id;
  const resourceVersionId = body.resourceVersionId || body.resource_version_id || existing.resource_version_id;
  await assertLevelBelongs(supabase, existing.competency_id, targetLevelId);
  if ((resourceType || resourceId || resourceVersionId) && (!resourceType || !resourceId)) throw httpError("RESOURCE_MAPPING_NOT_FOUND", 400);
  const patch = {
    target_level_id: targetLevelId,
    resource_type: resourceType,
    resource_id: resourceId,
    resource_version_id: resourceVersionId,
    priority: allowed(cleanText(body.priority || existing.priority), ["low", "medium", "high", "critical"], existing.priority),
    due_at: body.dueAt || body.due_at || existing.due_at,
    status: body.status ? allowed(cleanText(body.status), ["planned", "in_progress", "completed", "overdue", "cancelled"], existing.status) : existing.status,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("development_plan_items").update(patch).eq("id", itemId).select().single();
  if (error) throw httpError(error.message, 500);
  auditLater(supabase, request, { actor: acct, action: "development_plan.item_updated", entityType: "development_plan_item", entityId: itemId, metadata: { employee_id: plan.employee_id, plan_id: planId, item_id: itemId, resource_id: data.resource_id, resource_version_id: data.resource_version_id } });
  return data;
}

export async function removePlanItem(supabase, request, acct, planId, itemId) {
  const plan = await getPlan(supabase, planId);
  const { error } = await supabase.from("development_plan_items").delete().eq("id", itemId).eq("development_plan_id", planId);
  if (error) throw httpError(error.message, 500);
  auditLater(supabase, request, { actor: acct, action: "development_plan.item_removed", entityType: "development_plan_item", entityId: itemId, metadata: { employee_id: plan.employee_id, plan_id: planId, item_id: itemId } });
  return { ok: true };
}

export async function startMyItem(supabase, employeeId, planId, itemId) {
  const plan = await getPlan(supabase, planId, employeeId);
  if (plan.status !== "active") throw httpError("PLAN_NOT_ACTIVE", 409);
  const { data, error } = await supabase.from("development_plan_items").update({ status: "in_progress", started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", itemId).eq("development_plan_id", planId).neq("status", "completed").select().maybeSingle();
  if (error) throw httpError(error.message, 500);
  if (!data) throw httpError("PLAN_ITEM_NOT_FOUND", 404);
  return data;
}

async function itemResourceCompleted(supabase, employeeId, item) {
  if (!item.resource_type || !item.resource_id) return false;
  if (item.resource_type === "course") {
    let q = supabase.from("enrollments").select("id").eq("account_id", employeeId).eq("course_id", item.resource_id).eq("status", "completed").limit(1);
    if (item.resource_version_id) q = q.eq("course_version_id", item.resource_version_id);
    const { data } = await q;
    return Boolean(data?.length);
  }
  if (item.resource_type === "learning_path") {
    let q = supabase.from("learning_path_assignments").select("id").eq("employee_id", employeeId).eq("learning_path_id", item.resource_id).eq("status", "completed").limit(1);
    if (item.resource_version_id) q = q.eq("learning_path_version_id", item.resource_version_id);
    const { data } = await q;
    return Boolean(data?.length);
  }
  if (item.resource_type === "quiz") {
    let q = supabase.from("quiz_attempts").select("id").eq("account_id", employeeId).eq("quiz_id", item.resource_id).eq("passed", true).limit(1);
    if (item.resource_version_id) q = q.eq("quiz_version_id", item.resource_version_id);
    const { data } = await q;
    return Boolean(data?.length);
  }
  if (item.resource_type === "certificate_type") {
    const { data } = await supabase.from("employee_certifications").select("id").eq("account_id", employeeId).eq("certificate_type_id", item.resource_id).in("verification_status", ["approved", "verified"]).limit(1);
    return Boolean(data?.length);
  }
  if (item.resource_type === "compliance_program") {
    let q = supabase.from("compliance_completion_records").select("id").eq("employee_id", employeeId).eq("program_id", item.resource_id).limit(1);
    if (item.resource_version_id) q = q.eq("resource_version_id", item.resource_version_id);
    const { data } = await q;
    return Boolean(data?.length);
  }
  return false;
}

export async function syncMyItem(supabase, employeeId, planId, itemId) {
  const plan = await getPlan(supabase, planId, employeeId);
  if (plan.status !== "active") throw httpError("PLAN_NOT_ACTIVE", 409);
  const item = (plan.items || []).find((row) => row.id === itemId);
  if (!item) throw httpError("PLAN_ITEM_NOT_FOUND", 404);
  await syncEvidenceForEmployee(supabase, employeeId).catch(() => null);
  const completed = await itemResourceCompleted(supabase, employeeId, item);
  if (!completed) {
    if (item.due_at && new Date(item.due_at).getTime() < Date.now() && !["completed", "cancelled"].includes(item.status)) {
      await supabase.from("development_plan_items").update({ status: "overdue", updated_at: new Date().toISOString() }).eq("id", itemId);
    }
    throw httpError("RESOURCE_NOT_COMPLETED", 409);
  }
  const { data, error } = await supabase.from("development_plan_items").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", itemId).select().single();
  if (error) throw httpError(error.message, 500);
  const refreshed = await getPlan(supabase, planId, employeeId);
  if ((refreshed.items || []).length && refreshed.items.every((row) => row.status === "completed")) {
    await supabase.from("development_plans").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", planId);
  }
  return data;
}

export async function runDevelopmentPlanDueReminders(supabase, now = new Date()) {
  const soon = new Date(now.getTime() + 3 * 86400000).toISOString();
  const { data } = await supabase.from("development_plan_items")
    .select("*, plan:development_plans(id, employee_id, title, status)")
    .not("status", "in", '("completed","cancelled")')
    .not("due_at", "is", null)
    .lte("due_at", soon)
    .limit(200);
  let events = 0;
  for (const item of data || []) {
    if (item.plan?.status !== "active") continue;
    const overdue = new Date(item.due_at).getTime() < now.getTime();
    await createNotificationEvent(supabase, {
      eventType: overdue ? "development_plan_item_overdue" : "development_plan_item_due_soon",
      entityType: "development_plan_item",
      entityId: item.id,
      actorId: null,
      recipientId: item.plan.employee_id,
      idempotencyKey: `${overdue ? "overdue" : "due_soon"}:${item.id}:${String(item.due_at).slice(0, 10)}`,
      payload: sanitizeMetadata({ plan_title: item.plan.title, due_date: item.due_at }),
      link: "/dashboard/development-plan",
    }).catch(() => {});
    events += 1;
  }
  return { ok: true, events };
}
