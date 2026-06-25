import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";

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

function mapProfile(row) {
  const notes = parseNotes(row.notes);
  return {
    id: row.id,
    employeeCode: row.employee_code || "",
    fullName: row.full_name || "",
    email: row.email || "",
    role: row.role || "employee",
    department: row.department || "",
    position: row.position || "",
    accountStatus: row.account_status || "active",
    phone: row.phone || "",
    joinedDate: row.joined_date || "",
    managerName: row.manager_name || "",
    location: row.location || "",
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    isDemo: notes.is_demo === true,
    deletedAt: notes.deleted_at || null,
    certificateType: notes.certificate_type || "",
    leadershipTraining: notes.leadership_training || "",
    communicationTraining: notes.communication_training || "",
    passwordStatus: row.password_status || "normal",
    photoBlobId: notes.photoBlobId || null,
    photoFileName: notes.photoFileName || null,
  };
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

    const search = url.searchParams.get("search") || "";
    const department = url.searchParams.get("department") || "";
    const status = url.searchParams.get("status") || "";
    const includeDemo = url.searchParams.get("includeDemo") === "true";
    const includeDeleted = url.searchParams.get("includeDeleted") === "true";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const pageSize = Math.min(1000, Math.max(1, parseInt(url.searchParams.get("pageSize") || "50", 10)));

    let query = supabase.from("profiles").select("*");

    if (!includeDeleted) query = query.not("notes", "ilike", '%"soft_deleted":true%');
    if (!includeDemo) query = query.not("notes", "ilike", '%"is_demo":true%');
    if (department) query = query.eq("department", department);
    if (status) query = query.eq("account_status", status);

    query = query.order("full_name");

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);

    let rows = data || [];

    // Search filter (client-side for simplicity across multiple fields)
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(row =>
        (row.full_name || "").toLowerCase().includes(q) ||
        (row.email || "").toLowerCase().includes(q) ||
        (row.department || "").toLowerCase().includes(q) ||
        (row.employee_code || "").toLowerCase().includes(q)
      );
    }

    const total = rows.length;
    const items = rows.slice((page - 1) * pageSize, page * pageSize).map(mapProfile);

    return json({ items, total, page, pageSize });
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

    // Build safe patch payload — only known columns
    const patch = { id: employeeId, updated_at: new Date().toISOString() };
    if (body.full_name !== undefined) patch.full_name = body.full_name;
    if (body.email !== undefined) patch.email = body.email;
    if (body.employee_code !== undefined) patch.employee_code = body.employee_code;
    if (body.role !== undefined) patch.role = body.role;
    if (body.department !== undefined) patch.department = body.department;
    if (body.position !== undefined) patch.position = body.position;
    if (body.account_status !== undefined) patch.account_status = body.account_status;
    if (body.phone !== undefined) patch.phone = body.phone;
    if (body.joined_date !== undefined) patch.joined_date = body.joined_date;
    if (body.manager_name !== undefined) patch.manager_name = body.manager_name;
    if (body.location !== undefined) patch.location = body.location;
    if (body.password_status !== undefined) patch.password_status = body.password_status;
    if (body.avatar_url !== undefined) patch.avatar_url = body.avatar_url;

    // Merge notes JSON
    if (body.notes !== undefined || body._notes !== undefined) {
      // Fetch current notes first to merge
      const { data: cur } = await supabase.from("profiles").select("notes").eq("id", employeeId).single();
      const existing = parseNotes(cur?.notes);
      const incoming = body._notes || (typeof body.notes === "object" ? body.notes : {});
      patch.notes = JSON.stringify({ ...existing, ...incoming });
    }

    const { error } = await supabase.from("profiles")
      .upsert(patch, { onConflict: "id" });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // DELETE /api/employees/:id  — soft delete (HR only)
  if (employeeId && employeeId !== "departments" && !subResource && method === "DELETE") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);

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

    // Write audit log (best-effort, ignore if table doesn't exist)
    await supabase.from("audit_logs").insert({
      action: "employee_deleted",
      actor_account_id: acct.accountId,
      target_account_id: employeeId,
      description: `Soft deleted employee: ${profile.full_name}`,
      created_at: deletedAt,
    }).then(() => {}, () => {});

    return json({ ok: true, deletedAt });
  }

  // GET /api/employees/:id/certifications
  if (employeeId && subResource === "certifications" && method === "GET") {
    const acct = await requireAuth(request, env);
    if (!acct) return json({ error: "Unauthorized" }, 401);
    if (acct.role !== "hr" && acct.accountId !== employeeId) return json({ error: "Forbidden" }, 403);
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
    const row = { account_id: employeeId, ...body, created_by: acct.accountId };
    const { data, error } = await supabase.from("employee_certifications").insert(row).select().single();
    if (error) return json({ error: error.message }, 500);
    return json({ certification: data }, 201);
  }

  // PATCH /api/employees/:id/certifications/:certId
  if (employeeId && subResource === "certifications" && subId && method === "PATCH") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request);
    const { data, error } = await supabase.from("employee_certifications")
      .update({ ...body, updated_at: new Date().toISOString() })
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
