import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { hasAdministrativeAccess, requireAuth, requireHr } from "../middleware/auth.js";
import { auditLater, writeAuditLog } from "../services/audit-service.js";
import { requirePrivilegedSession } from "./auth.js";
import { createPaginationCursor, readPaginationCursor } from "../services/pagination-cursor.js";

// Parse notes JSON safely
function parseNotes(raw) {
  if (!raw) return {};
  try { return typeof raw === "object" ? raw : JSON.parse(raw); } catch { return {}; }
}

function isDemo(row) {
  return parseNotes(row.notes).is_demo === true;
}

function isDeleted(row) {
  return parseNotes(row.notes).soft_deleted === true;
}

const ACCOUNT_STATUSES = new Set(["active", "inactive", "disabled", "pendingActivation"]);
const CERTIFICATION_CREATE_FIELDS = [
  "name", "certificate_type", "certificate_number", "issuer", "issue_date",
  "expiry_date", "evidence_path", "notes", "certificate_type_id",
  "storage_bucket", "storage_path", "original_file_name", "mime_type", "file_size_bytes",
];
const CERTIFICATION_UPDATE_FIELDS = [
  "name", "certificate_type", "certificate_number", "issuer", "issue_date",
  "expiry_date", "evidence_path", "notes", "certificate_type_id",
  "storage_bucket", "storage_path", "original_file_name", "mime_type", "file_size_bytes",
];

function stringField(body, key, max, { required = false } = {}) {
  if (body[key] === undefined || body[key] === null) {
    if (required) throw Object.assign(new Error(`${key} is required`), { status: 400, code: "INVALID_INPUT" });
    return undefined;
  }
  const value = String(body[key]).trim();
  if (required && !value) throw Object.assign(new Error(`${key} is required`), { status: 400, code: "INVALID_INPUT" });
  if (value.length > max) throw Object.assign(new Error(`${key} is too long`), { status: 400, code: "INVALID_INPUT" });
  return value || null;
}

function certificationPayload(body, fields, { create = false } = {}) {
  const payload = {};
  for (const field of fields) {
    if (body[field] === undefined) continue;
    if (field === "file_size_bytes") {
      const size = Number(body[field]);
      if (!Number.isSafeInteger(size) || size < 0) throw Object.assign(new Error("file_size_bytes is invalid"), { status: 400, code: "INVALID_INPUT" });
      payload[field] = size;
      continue;
    }
    payload[field] = stringField(body, field, field === "notes" ? 4000 : 500, { required: create && ["name", "certificate_type", "issuer", "issue_date"].includes(field) });
  }
  if (create) {
    for (const field of ["name", "certificate_type", "issuer", "issue_date"]) {
      if (!payload[field]) throw Object.assign(new Error(`${field} is required`), { status: 400, code: "INVALID_INPUT" });
    }
  }
  if (payload.issue_date && !/^\d{4}-\d{2}-\d{2}$/.test(payload.issue_date)) {
    throw Object.assign(new Error("issue_date must be YYYY-MM-DD"), { status: 400, code: "INVALID_INPUT" });
  }
  if (payload.expiry_date && !/^\d{4}-\d{2}-\d{2}$/.test(payload.expiry_date)) {
    throw Object.assign(new Error("expiry_date must be YYYY-MM-DD"), { status: 400, code: "INVALID_INPUT" });
  }
  if (payload.issue_date && payload.expiry_date && payload.expiry_date < payload.issue_date) {
    throw Object.assign(new Error("expiry_date must not precede issue_date"), { status: 400, code: "INVALID_INPUT" });
  }
  return payload;
}

export function buildCertificationCreatePayload(body) {
  return certificationPayload(body, CERTIFICATION_CREATE_FIELDS, { create: true });
}

export function buildCertificationUpdatePayload(body) {
  return certificationPayload(body, CERTIFICATION_UPDATE_FIELDS);
}

function mapProfile(row) {
  return {
    id: row.id,
    employeeCode: row.employee_code || "",
    fullName: row.full_name || "",
    email: row.email || "",
    role: row.role || "employee",
    department: row.department || "",
    position: row.position || "",
    accountStatus: row.account_status || "active",
    managerName: row.manager_name || "",
    location: row.location || "",
    updatedAt: row.updated_at || null,
  };
}

function normalizedListField(params, name, max = 120) {
  return String(params.get(name) || "").trim().slice(0, max);
}

export function employeeListParameters(url) {
  const pageSizeRaw = Number.parseInt(url.searchParams.get("pageSize") || "50", 10);
  const pageSize = Math.min(100, Math.max(10, Number.isFinite(pageSizeRaw) ? pageSizeRaw : 50));
  const direction = url.searchParams.get("direction") === "desc" ? "desc" : "asc";
  return {
    search: normalizedListField(url.searchParams, "search", 80).replace(/[^\p{L}\p{N}@._\- ]/gu, ""),
    department: normalizedListField(url.searchParams, "department"),
    status: normalizedListField(url.searchParams, "status", 40),
    location: normalizedListField(url.searchParams, "location"),
    position: normalizedListField(url.searchParams, "position"),
    manager: normalizedListField(url.searchParams, "manager"),
    direction,
    pageSize,
    cursor: String(url.searchParams.get("cursor") || "").slice(0, 4096),
  };
}

export function employeeSearchOnlineEnabled(env = {}) {
  const runtime = String(env.APP_ENV || env.RUNTIME_ENV || "").trim().toLowerCase();
  if (env.SEARCH_ROLLOUT_ENABLED === "true") return true;
  if (env.SEARCH_ROLLOUT_ENABLED === "false") return false;
  return runtime !== "staging";
}

async function legacyProfileSearch(supabase, params, cursorPosition) {
  let query = supabase.from("profiles")
    .select("id, employee_code, full_name, email, role, department, position, account_status, location, manager_name, updated_at")
    .not("notes", "ilike", '%"soft_deleted":true%')
    .not("notes", "ilike", '%"is_demo":true%')
    .order("full_name", { ascending: params.direction !== "desc" })
    .order("id", { ascending: params.direction !== "desc" })
    .limit(params.pageSize + 1);
  if (params.department) query = query.eq("department", params.department);
  if (params.status) query = query.eq("account_status", params.status);
  if (params.location) query = query.eq("location", params.location);
  if (params.position) query = query.eq("position", params.position);
  if (params.manager) query = query.eq("manager_name", params.manager);
  if (params.search) {
    const escaped = params.search.replace(/[,%()]/g, "");
    query = query.or(`employee_code.ilike.%${escaped}%,full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }
  if (cursorPosition?.name) query = params.direction === "desc" ? query.lt("full_name", cursorPosition.name) : query.gt("full_name", cursorPosition.name);
  const { data, error } = await query;
  return { data: (data || []).map((row) => ({ ...row, sort_name: String(row.full_name || "").toLowerCase() })), error };
}

export async function handleEmployees(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean); // ["api","employees",id?,...]
  const employeeId = parts[2] || null;
  const subResource = parts[3] || null;
  const subId = parts[4] || null;

  const supabase = getSupabase(env);

  // GET /api/employees  — list (HR only)
  if (!employeeId && method === "GET") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const params = employeeListParameters(url);
    const filterBinding = {
      search: params.search,
      department: params.department,
      status: params.status,
      location: params.location,
      position: params.position,
      manager: params.manager,
      direction: params.direction,
      pageSize: params.pageSize,
    };
    const onlineSearch = employeeSearchOnlineEnabled(env);
    const cursorScope = onlineSearch ? "employee-list-v1" : "employee-list-legacy-v1";
    let cursorPosition = null;
    try {
      cursorPosition = await readPaginationCursor(env, params.cursor, {
        requesterId: acct.accountId,
        scope: cursorScope,
        filters: filterBinding,
      });
    } catch (error) {
      return json({ error: error.code || "INVALID_CURSOR" }, error.status || 400);
    }

    const { data, error } = onlineSearch
      ? await supabase.rpc("service_search_profiles", {
        p_search: params.search,
        p_department: params.department,
        p_status: params.status,
        p_location: params.location,
        p_position: params.position,
        p_manager: params.manager,
        p_cursor_name: cursorPosition?.name || null,
        p_cursor_id: cursorPosition?.id || null,
        p_direction: params.direction,
        p_limit: params.pageSize + 1,
      })
      : await legacyProfileSearch(supabase, params, cursorPosition);
    if (error) return json({ error: "EMPLOYEE_SEARCH_FAILED" }, 500);

    const rows = Array.isArray(data) ? data : [];
    const hasMore = rows.length > params.pageSize;
    if (hasMore) rows.pop();
    const last = rows.at(-1);
    const nextCursor = hasMore && last
      ? await createPaginationCursor(env, {
        requesterId: acct.accountId,
        scope: cursorScope,
        filters: filterBinding,
        position: { name: last.sort_name, id: String(last.id) },
      })
      : null;
    return json({
      items: rows.map(mapProfile),
      pageSize: params.pageSize,
      hasMore,
      nextCursor,
    });
  }

  // GET /api/employees/departments — distinct department list (HR only)
  if (employeeId === "departments" && method === "GET") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const { data, error } = await supabase
      .from("profiles")
      .select("department")
      .not("account_status", "eq", "deleted")
      .not("notes", "ilike", '%"is_demo":true%')
      .not("department", "is", null);
    if (error) return json({ error: error.message }, 500);
    const depts = [...new Set((data || []).map(r => r.department).filter(Boolean))].sort();
    return json({ departments: depts });
  }

  // PATCH /api/employees/:id  — upsert profile (HR only)
  if (employeeId && employeeId !== "departments" && !subResource && method === "PATCH") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request);
    if (body.account_status !== undefined) {
      const privileged = await requirePrivilegedSession(request, env);
      if (privileged.error) return privileged.error;
    }

    // Build safe patch payload — only known columns
    const patch = { id: employeeId, updated_at: new Date().toISOString() };
    if (body.full_name !== undefined) patch.full_name = stringField(body, "full_name", 200);
    if (body.email !== undefined) {
      patch.email = stringField(body, "email", 320);
      if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) {
        return json({ error: "INVALID_EMAIL" }, 400);
      }
    }
    if (body.employee_code !== undefined) patch.employee_code = stringField(body, "employee_code", 80);
    // Role, credential fields, owner fields, and audit fields are intentionally not writable here.
    if (body.department !== undefined) patch.department = stringField(body, "department", 200);
    if (body.position !== undefined) patch.position = stringField(body, "position", 200);
    if (body.account_status !== undefined) {
      patch.account_status = stringField(body, "account_status", 40);
      if (!ACCOUNT_STATUSES.has(patch.account_status)) return json({ error: "INVALID_ACCOUNT_STATUS" }, 400);
    }
    if (body.phone !== undefined) patch.phone = stringField(body, "phone", 40);
    if (body.joined_date !== undefined) patch.joined_date = stringField(body, "joined_date", 40);
    if (body.manager_name !== undefined) patch.manager_name = stringField(body, "manager_name", 200);
    if (body.location !== undefined) patch.location = stringField(body, "location", 200);

    // Merge notes JSON
    if (body.notes !== undefined || body._notes !== undefined) {
      // Fetch current notes first to merge
      const { data: cur } = await supabase.from("profiles").select("notes").eq("id", employeeId).single();
      const existing = parseNotes(cur?.notes);
      const incoming = body._notes || (typeof body.notes === "object" ? body.notes : {});
      const forbiddenNoteKey = Object.keys(incoming).find((key) => /(password|hash|token|secret|role|owner|created|approval)/i.test(key));
      if (forbiddenNoteKey) return json({ error: "FORBIDDEN_FIELD", field: forbiddenNoteKey }, 400);
      patch.notes = JSON.stringify({ ...existing, ...incoming });
    }

    const { data: beforeProfile } = await supabase.from("profiles").select("id, full_name, email, role, department, position, account_status").eq("id", employeeId).maybeSingle();
    const { error } = await supabase.from("profiles")
      .upsert(patch, { onConflict: "id" });
    if (error) return json({ error: error.message }, 500);
    if (["disabled", "inactive"].includes(patch.account_status)) {
      await supabase.rpc("service_revoke_all_auth_sessions", {
        p_profile_id: employeeId, p_reason: "account_disabled", p_except_session_id: null,
      });
    }
    const action = beforeProfile?.role !== undefined && patch.role !== undefined && beforeProfile.role !== patch.role
      ? "account.role_changed"
      : beforeProfile?.department !== undefined && patch.department !== undefined && beforeProfile.department !== patch.department
        ? "employee.department_changed"
        : beforeProfile?.position !== undefined && patch.position !== undefined && beforeProfile.position !== patch.position
          ? "employee.job_title_changed"
          : beforeProfile ? "employee.updated" : "employee.created";
    await writeAuditLog(supabase, request, {
      actor: acct,
      action,
      entityType: "profile",
      entityId: employeeId,
      entityDisplayName: patch.full_name || beforeProfile?.full_name || employeeId,
      beforeData: beforeProfile ? { role: beforeProfile.role, department: beforeProfile.department, position: beforeProfile.position, account_status: beforeProfile.account_status } : null,
      afterData: { role: patch.role ?? beforeProfile?.role, department: patch.department ?? beforeProfile?.department, position: patch.position ?? beforeProfile?.position, account_status: patch.account_status ?? beforeProfile?.account_status },
    }, { critical: action === "account.role_changed" });
    return json({ ok: true });
  }

  // DELETE /api/employees/:id  — soft delete (HR only)
  if (employeeId && employeeId !== "departments" && !subResource && method === "DELETE") {
    const { caller: acct, error: authError } = await requirePrivilegedSession(request, env);
    if (authError) return authError;

    // Prevent self-deletion
    if (acct.accountId === employeeId) {
      return json({ error: "CANNOT_DELETE_CURRENT_USER" }, 403);
    }

    // Fetch profile
    const { data: profile, error: fetchErr } = await supabase
      .from("profiles").select("id, full_name, account_status, role, notes").eq("id", employeeId).single();
    if (fetchErr || !profile) return json({ error: "EMPLOYEE_NOT_FOUND" }, 404);

    if (profile.account_status === "deleted") {
      return json({ error: "EMPLOYEE_ALREADY_DELETED" }, 409);
    }

    // Prevent deleting system/service accounts
    const systemIds = ["acc-sa-001", "acc-hr-001"];
    if (systemIds.includes(employeeId) || profile.role === "superAdmin") {
      return json({ error: "CANNOT_DELETE_SYSTEM_ACCOUNT" }, 403);
    }

    const deletedAt = new Date().toISOString();
    const notes = parseNotes(profile.notes);
    notes.soft_deleted = true;
    notes.deleted_at = deletedAt;
    notes.deleted_by = acct.accountId;

    const { error: updateErr } = await supabase.from("profiles").update({
      account_status: "inactive",
      notes: JSON.stringify(notes),
      updated_at: deletedAt,
    }).eq("id", employeeId);

    if (updateErr) return json({ error: "EMPLOYEE_DELETE_FAILED", detail: updateErr.message }, 500);
    await supabase.rpc("service_revoke_all_auth_sessions", {
      p_profile_id: employeeId, p_reason: "account_deleted", p_except_session_id: null,
    });

    auditLater(supabase, request, {
      actor: acct,
      action: "employee.archived",
      entityType: "profile",
      entityId: employeeId,
      entityDisplayName: profile.full_name,
      beforeData: { account_status: profile.account_status, soft_deleted: false },
      afterData: { account_status: "inactive", soft_deleted: true },
      metadata: { deleted_at: deletedAt },
    });

    return json({ ok: true, deletedAt });
  }

  // GET /api/employees/:id/certifications
  if (employeeId && subResource === "certifications" && method === "GET") {
    const acct = await requireAuth(request, env);
    if (!acct) return json({ error: "Unauthorized" }, 401);
    if (!hasAdministrativeAccess(acct) && acct.accountId !== employeeId) return json({ error: "Forbidden" }, 403);
    const { data, error } = await supabase.from("employee_certifications")
      .select("*").eq("account_id", employeeId).order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json({ certifications: data || [] });
  }

  // POST /api/employees/:id/certifications
  if (employeeId && subResource === "certifications" && method === "POST") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request);
    const row = { account_id: employeeId, ...buildCertificationCreatePayload(body), created_by: acct.accountId };
    const { data, error } = await supabase.from("employee_certifications").insert(row).select().single();
    if (error) return json({ error: error.message }, 500);
    return json({ certification: data }, 201);
  }

  // PATCH /api/employees/:id/certifications/:certId
  if (employeeId && subResource === "certifications" && subId && method === "PATCH") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request);
    const patch = buildCertificationUpdatePayload(body);
    if (!Object.keys(patch).length) return json({ error: "NO_MUTABLE_FIELDS" }, 400);
    const { data, error } = await supabase.from("employee_certifications")
      .update({ ...patch, updated_by: acct.accountId, updated_at: new Date().toISOString() })
      .eq("id", subId).eq("account_id", employeeId).select().single();
    if (error) return json({ error: error.message }, 500);
    return json({ certification: data });
  }

  // DELETE /api/employees/:id/certifications/:certId  — soft-delete (revoke)
  if (employeeId && subResource === "certifications" && subId && method === "DELETE") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const { data, error } = await supabase.from("employee_certifications")
      .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: acct.accountId, updated_at: new Date().toISOString() })
      .eq("id", subId).eq("account_id", employeeId).select().single();
    if (error) return json({ error: error.message }, 500);
    return json({ certification: data });
  }

  return json({ error: "NOT_FOUND" }, 404);
}
