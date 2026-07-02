import { createNotificationEvent } from "./notificationEngine.js";
import { auditLater } from "./audit-service.js";

const VERSION_TABLE = {
  course: "course_versions",
  quiz: "quiz_versions",
  learning_path: "learning_path_versions",
};

const ENTITY_TABLE = {
  course: "courses",
  quiz: "quizzes",
  learning_path: "learning_paths",
};

const ENTITY_ID = {
  course: "course_id",
  quiz: "quiz_id",
  learning_path: "learning_path_id",
};

export const VALID_CHANGE_TYPES = new Set(["patch", "minor", "major"]);

export function versionLabel(row) {
  return row?.version_number ? `v${row.version_number}` : "";
}

export async function currentVersionId(supabase, type, entityId) {
  const table = ENTITY_TABLE[type];
  if (!table || !entityId) return null;
  const { data } = await supabase.from(table).select("current_version_id").eq("id", entityId).maybeSingle();
  return data?.current_version_id || null;
}

export async function listVersions(supabase, type, entityId) {
  const table = VERSION_TABLE[type];
  const column = ENTITY_ID[type];
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq(column, entityId)
    .order("version_number", { ascending: false });
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data || [];
}

export async function getVersion(supabase, type, versionId) {
  const table = VERSION_TABLE[type];
  const { data, error } = await supabase.from(table).select("*").eq("id", versionId).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!data) throw Object.assign(new Error("VERSION_NOT_FOUND"), { status: 404, code: "VERSION_NOT_FOUND" });
  return data;
}

async function nextVersionNumber(supabase, type, entityId) {
  const table = VERSION_TABLE[type];
  const column = ENTITY_ID[type];
  const { data, error } = await supabase
    .from(table)
    .select("version_number")
    .eq(column, entityId)
    .order("version_number", { ascending: false })
    .limit(1);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return (data?.[0]?.version_number || 0) + 1;
}

export async function createDraftVersion(supabase, request, acct, type, entityId, fromVersionId) {
  const existingDrafts = await listVersions(supabase, type, entityId);
  if (existingDrafts.some((v) => ["draft", "in_review"].includes(v.status))) {
    throw Object.assign(new Error("DRAFT_ALREADY_EXISTS"), { status: 409, code: "DRAFT_ALREADY_EXISTS" });
  }
  const from = fromVersionId
    ? await getVersion(supabase, type, fromVersionId)
    : existingDrafts.find((v) => v.status === "published") || existingDrafts[0];
  if (!from) throw Object.assign(new Error("VERSION_NOT_FOUND"), { status: 404, code: "VERSION_NOT_FOUND" });
  const table = VERSION_TABLE[type];
  const column = ENTITY_ID[type];
  const copy = { ...from };
  delete copy.id;
  delete copy.published_by;
  delete copy.published_at;
  delete copy.retired_by;
  delete copy.retired_at;
  copy[column] = entityId;
  copy.version_number = await nextVersionNumber(supabase, type, entityId);
  copy.status = "draft";
  copy.change_type = "minor";
  copy.change_summary = "Draft created from " + versionLabel(from);
  copy.created_from_version_id = from.id;
  copy.created_by = acct.accountId;
  copy.created_at = new Date().toISOString();
  copy.updated_at = copy.created_at;
  const { data, error } = await supabase.from(table).insert(copy).select().single();
  if (error) throw Object.assign(new Error(error.message), { status: 500, code: "VERSION_CONFLICT" });
  auditLater(supabase, request, {
    actor: acct,
    action: `${type}.version_created`,
    entityType: type,
    entityId,
    metadata: { version_id: data.id, version_number: data.version_number, from_version_id: from.id },
  });
  return data;
}

export async function updateDraftVersion(supabase, request, acct, type, versionId, patch) {
  const table = VERSION_TABLE[type];
  const version = await getVersion(supabase, type, versionId);
  if (!["draft", "in_review"].includes(version.status)) {
    throw Object.assign(new Error("PUBLISHED_VERSION_IMMUTABLE"), { status: 409, code: "PUBLISHED_VERSION_IMMUTABLE" });
  }
  const allowed = type === "course"
    ? ["title", "description", "objectives", "content_snapshot", "duration_minutes", "delivery_mode", "completion_rules", "quiz_version_id", "source_data", "change_type", "change_summary"]
    : type === "quiz"
      ? ["title", "instructions", "passing_score", "time_limit_minutes", "max_attempts", "configuration", "source_data", "change_type", "change_summary"]
      : ["title", "description", "completion_mode", "completion_rules", "source_data", "change_type", "change_summary"];
  const update = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) update[key] = patch[key];
  }
  if (update.change_type && !VALID_CHANGE_TYPES.has(update.change_type)) {
    throw Object.assign(new Error("INVALID_CHANGE_TYPE"), { status: 400, code: "INVALID_CHANGE_TYPE" });
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from(table).update(update).eq("id", versionId).select().single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  auditLater(supabase, request, {
    actor: acct,
    action: `${type}.version_updated`,
    entityType: type,
    entityId: data[ENTITY_ID[type]],
    metadata: { version_id: data.id, version_number: data.version_number, change_type: data.change_type },
  });
  return data;
}

export async function submitVersionReview(supabase, request, acct, type, versionId) {
  const table = VERSION_TABLE[type];
  const version = await getVersion(supabase, type, versionId);
  if (version.status !== "draft") throw Object.assign(new Error("INVALID_VERSION_TRANSITION"), { status: 409, code: "INVALID_VERSION_TRANSITION" });
  if (!String(version.change_summary || "").trim()) throw Object.assign(new Error("CHANGE_SUMMARY_REQUIRED"), { status: 400, code: "CHANGE_SUMMARY_REQUIRED" });
  const { data, error } = await supabase.from(table).update({ status: "in_review", updated_at: new Date().toISOString() }).eq("id", versionId).select().single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  auditLater(supabase, request, { actor: acct, action: `${type}.version_submitted`, entityType: type, entityId: data[ENTITY_ID[type]], metadata: { version_id: data.id, version_number: data.version_number } });
  return data;
}

export async function publishVersion(supabase, request, acct, type, versionId) {
  const table = VERSION_TABLE[type];
  const entityTable = ENTITY_TABLE[type];
  const column = ENTITY_ID[type];
  const version = await getVersion(supabase, type, versionId);
  if (!["draft", "in_review"].includes(version.status)) {
    throw Object.assign(new Error("VERSION_ALREADY_PUBLISHED"), { status: 409, code: "VERSION_ALREADY_PUBLISHED" });
  }
  if (!VALID_CHANGE_TYPES.has(version.change_type)) throw Object.assign(new Error("INVALID_CHANGE_TYPE"), { status: 400, code: "INVALID_CHANGE_TYPE" });
  if (!String(version.change_summary || "").trim()) throw Object.assign(new Error("CHANGE_SUMMARY_REQUIRED"), { status: 400, code: "CHANGE_SUMMARY_REQUIRED" });

  if (type === "course" && version.quiz_version_id) {
    const { data: quizVersion } = await supabase.from("quiz_versions").select("status").eq("id", version.quiz_version_id).maybeSingle();
    if (!quizVersion || quizVersion.status !== "published") throw Object.assign(new Error("DEPENDENCY_NOT_PUBLISHED"), { status: 409, code: "DEPENDENCY_NOT_PUBLISHED" });
  }

  const now = new Date().toISOString();
  const { data: currentEntity } = await supabase.from(entityTable).select("current_version_id").eq("id", version[column]).maybeSingle();
  await supabase.from(table).update({ status: "retired", retired_by: acct.accountId, retired_at: now, updated_at: now }).eq(column, version[column]).eq("status", "published");
  const { data, error } = await supabase.from(table).update({ status: "published", published_by: acct.accountId, published_at: now, updated_at: now }).eq("id", versionId).select().single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  await supabase.from(entityTable).update({ current_version_id: versionId, status: "published", updated_at: now }).eq("id", version[column]);
  auditLater(supabase, request, {
    actor: acct,
    action: `${type}.version_published`,
    entityType: type,
    entityId: version[column],
    metadata: { version_id: data.id, version_number: data.version_number, change_type: data.change_type, change_summary: data.change_summary, from_version_id: currentEntity?.current_version_id, to_version_id: data.id },
  });
  await createNotificationEvent(supabase, {
    eventType: "content_version_published",
    entityType: type,
    entityId: version[column],
    actorId: acct.accountId,
    recipientId: acct.accountId,
    idempotencyKey: `content_version_published:${type}:${data.id}`,
    payload: { content_title: data.title || data.id, version: versionLabel(data) },
  }).catch(() => {});
  let retrainingReview = null;
  if (data.change_type === "major") {
    retrainingReview = await createRetrainingReview(supabase, request, acct, type, version[column], currentEntity?.current_version_id, data.id);
  }
  return { version: data, retrainingReview };
}

export async function retireVersion(supabase, request, acct, type, versionId) {
  const table = VERSION_TABLE[type];
  const version = await getVersion(supabase, type, versionId);
  if (version.status !== "published") throw Object.assign(new Error("INVALID_VERSION_TRANSITION"), { status: 409, code: "INVALID_VERSION_TRANSITION" });
  const now = new Date().toISOString();
  const { data, error } = await supabase.from(table).update({ status: "retired", retired_by: acct.accountId, retired_at: now, updated_at: now }).eq("id", versionId).select().single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  auditLater(supabase, request, { actor: acct, action: `${type}.version_retired`, entityType: type, entityId: data[ENTITY_ID[type]], metadata: { version_id: data.id, version_number: data.version_number } });
  return data;
}

export function compareVersions(before, after) {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
    .filter((k) => !["created_at", "updated_at", "published_at", "retired_at"].includes(k));
  return keys.reduce((rows, key) => {
    const oldValue = before?.[key] ?? null;
    const newValue = after?.[key] ?? null;
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) rows.push({ field: key, before: oldValue, after: newValue });
    return rows;
  }, []);
}

export async function createRetrainingReview(supabase, request, acct, entityType, entityId, fromVersionId, toVersionId) {
  const affected = await affectedEmployees(supabase, entityType, entityId, fromVersionId);
  const row = {
    entity_type: entityType,
    entity_id: entityId,
    from_version_id: fromVersionId || null,
    to_version_id: toVersionId,
    status: "pending",
    recommended_scope: "completed_users",
    affected_employee_count: affected.length,
    target_rule: { employeeIds: affected },
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("retraining_reviews").upsert(row, {
    onConflict: "entity_type,entity_id,from_version_id,to_version_id",
  }).select().single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  auditLater(supabase, request, { actor: acct, action: "retraining.review_created", entityType: "retraining_review", entityId: data.id, metadata: { entity_id: entityId, from_version_id: fromVersionId, to_version_id: toVersionId, affected_employee_count: affected.length } });
  await createNotificationEvent(supabase, {
    eventType: "retraining_review_required",
    entityType: "retraining_review",
    entityId: data.id,
    actorId: acct.accountId,
    recipientId: acct.accountId,
    idempotencyKey: `retraining_review_required:${data.id}`,
    payload: { affected_employee_count: String(affected.length) },
  }).catch(() => {});
  return data;
}

export async function affectedEmployees(supabase, entityType, entityId, fromVersionId) {
  if (entityType === "course") {
    let q = supabase.from("enrollments").select("account_id").eq("course_id", entityId).in("status", ["completed", "inProgress", "overdue"]);
    if (fromVersionId) q = q.eq("course_version_id", fromVersionId);
    const { data } = await q;
    return [...new Set((data || []).map((r) => r.account_id).filter(Boolean))];
  }
  if (entityType === "learning_path") {
    let q = supabase.from("learning_path_assignments").select("employee_id").eq("learning_path_id", entityId).in("status", ["completed", "in_progress", "overdue"]);
    if (fromVersionId) q = q.eq("learning_path_version_id", fromVersionId);
    const { data } = await q;
    return [...new Set((data || []).map((r) => r.employee_id).filter(Boolean))];
  }
  return [];
}
