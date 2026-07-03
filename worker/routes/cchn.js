import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireHr } from "../middleware/auth.js";
import { writeAuditLog } from "../services/audit-service.js";

const ALLOWED_GROUPS = ["subject", "fee", "reimbursement", "other"];
const ALLOWED_RSTATUSES = ["draft", "registered", "approved", "studying", "completed", "cancelled"];
const ALLOWED_COLORS = ["blue", "teal", "purple", "green", "orange", "pink", "indigo", "red", "cyan", "amber", "slate", "lime", "violet", "rose"];

function normalizeCatalogItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    itemGroup: row.item_group,
    labelVi: row.label_vi,
    labelEn: row.label_en,
    colorToken: row.color_token,
    isCustom: row.is_custom,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeRegistration(row) {
  if (!row) return null;
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    positionTitle: row.position_title,
    department: row.department,
    registrationDate: row.registration_date,
    plannedTrainingDate: row.planned_training_date,
    plannedExamDate: row.planned_exam_date,
    studyFormat: row.study_format,
    status: row.status,
    totalCostVnd: row.total_cost_vnd ? Number(row.total_cost_vnd) : null,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: row.cchn_registration_items || [],
  };
}

export async function handleCchnCatalog(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const url = new URL(request.url);
  const path = url.pathname;
  const supabase = getSupabase(env);

  try {
    // GET /api/admin/cchn/catalog — list
    if (path === "/api/admin/cchn/catalog" && method === "GET") {
      let query = supabase.from("cchn_catalog_items").select("*", { count: "exact" });
      const group = url.searchParams.get("itemGroup") || url.searchParams.get("group");
      if (group && ALLOWED_GROUPS.includes(group)) query = query.eq("item_group", group);
      const status = url.searchParams.get("status");
      if (status === "active" || status === "inactive") query = query.eq("status", status);
      query = query.order("item_group").order("label_vi");

      const { data, error, count } = await query;
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true, data: (data || []).map(normalizeCatalogItem), total: count || 0 });
    }

    // POST /api/admin/cchn/catalog — create
    if (path === "/api/admin/cchn/catalog" && method === "POST") {
      const body = await readJson(request);
      const item_group = String(body.itemGroup || body.item_group || "").trim();
      const label_vi = String(body.labelVi || body.label_vi || "").trim();
      if (!label_vi || !ALLOWED_GROUPS.includes(item_group)) {
        return json({ ok: false, error: "Missing or invalid required fields" }, 400);
      }
      if (label_vi.length > 500) return json({ ok: false, error: "Label too long (max 500)" }, 400);

      const label_en = body.labelEn || body.label_en || null;
      const color_token = body.colorToken || body.color_token || null;
      if (color_token && !ALLOWED_COLORS.includes(color_token)) {
        return json({ ok: false, error: "Invalid color token" }, 400);
      }

      // Check duplicate
      const { data: dup } = await supabase.from("cchn_catalog_items")
        .select("id").eq("item_group", item_group).ilike("label_vi", label_vi).maybeSingle();
      if (dup) return json({ ok: false, error: "DUPLICATE_LABEL" }, 409);

      const row = { item_group, label_vi, label_en, color_token, is_custom: true, created_by: acct.accountId };
      const { data, error } = await supabase.from("cchn_catalog_items").insert(row).select().single();
      if (error) return json({ ok: false, error: error.message }, 400);

      await writeAuditLog(supabase, request, {
        actor: acct, action: "cchn.catalog_item_created",
        entityType: "cchn_catalog_items", entityId: data.id,
        entityDisplayName: label_vi,
        metadata: { itemGroup: item_group },
      });

      return json({ ok: true, data: normalizeCatalogItem(data) }, 201);
    }

    // PATCH /api/admin/cchn/catalog/:id — update
    const detailMatch = path.match(/^\/api\/admin\/cchn\/catalog\/([^/]+)$/);
    if (detailMatch && method === "PATCH") {
      const { data: existing, error: fetchError } = await supabase.from("cchn_catalog_items").select("*").eq("id", detailMatch[1]).single();
      if (fetchError || !existing) return json({ ok: false, error: "NOT_FOUND" }, 404);

      const body = await readJson(request);
      const updates = {};
      if (body.labelVi || body.label_vi) updates.label_vi = String(body.labelVi || body.label_vi).trim();
      if (body.labelEn !== undefined) updates.label_en = body.labelEn || body.label_en || null;
      if (body.colorToken || body.color_token) {
        const ct = body.colorToken || body.color_token;
        if (ALLOWED_COLORS.includes(ct)) updates.color_token = ct;
      }

      const { data, error } = await supabase.from("cchn_catalog_items").update(updates).eq("id", detailMatch[1]).select().single();
      if (error) return json({ ok: false, error: error.message }, 400);

      await writeAuditLog(supabase, request, {
        actor: acct, action: "cchn.catalog_item_updated",
        entityType: "cchn_catalog_items", entityId: data.id,
        entityDisplayName: data.label_vi,
      });

      return json({ ok: true, data: normalizeCatalogItem(data) });
    }

    // POST /api/admin/cchn/catalog/:id/deactivate — deactivate
    const deactMatch = path.match(/^\/api\/admin\/cchn\/catalog\/([^/]+)\/deactivate$/);
    if (deactMatch && method === "POST") {
      const { data: existing } = await supabase.from("cchn_catalog_items").select("*").eq("id", deactMatch[1]).single();
      if (!existing) return json({ ok: false, error: "NOT_FOUND" }, 404);

      const newStatus = existing.status === "inactive" ? "active" : "inactive";
      const { data, error } = await supabase.from("cchn_catalog_items").update({ status: newStatus }).eq("id", deactMatch[1]).select().single();
      if (error) return json({ ok: false, error: error.message }, 400);

      await writeAuditLog(supabase, request, {
        actor: acct, action: "cchn.catalog_item_deactivated",
        entityType: "cchn_catalog_items", entityId: data.id,
        entityDisplayName: data.label_vi,
        metadata: { statusBefore: existing.status, statusAfter: newStatus },
      });

      return json({ ok: true, data: normalizeCatalogItem(data) });
    }

    return json({ ok: false, error: "NOT_FOUND" }, 404);
  } catch (error) {
    return json({ ok: false, error: error.message || "INTERNAL_ERROR" }, 500);
  }
}

export async function handleCchnRegistrations(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const url = new URL(request.url);
  const path = url.pathname;
  const supabase = getSupabase(env);

  try {
    // GET /api/admin/cchn/registrations — list
    if (path === "/api/admin/cchn/registrations" && method === "GET") {
      let query = supabase.from("cchn_registrations").select("*, cchn_registration_items(*, cchn_catalog_items(*))", { count: "exact" });

      const search = url.searchParams.get("search");
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`employee_name.ilike.${term},department.ilike.${term}`);
      }
      const department = url.searchParams.get("department");
      if (department) query = query.eq("department", department);
      const status = url.searchParams.get("status");
      if (status && ALLOWED_RSTATUSES.includes(status)) query = query.eq("status", status);

      query = query.order("created_at", { ascending: false });

      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
      const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "25")));
      const offset = (page - 1) * pageSize;
      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true, data: (data || []).map(normalizeRegistration), total: count || 0, page, pageSize });
    }

    // POST /api/admin/cchn/registrations — create
    if (path === "/api/admin/cchn/registrations" && method === "POST") {
      const body = await readJson(request);
      const employee_name = String(body.employeeName || body.employee_name || "").trim();
      if (!employee_name) return json({ ok: false, error: "Employee name required" }, 400);

      const catalog_item_ids = Array.isArray(body.catalogItemIds || body.catalog_item_ids) ? (body.catalogItemIds || body.catalog_item_ids) : [];
      if (!catalog_item_ids.length) return json({ ok: false, error: "At least one catalog item required" }, 400);

      const registration = {
        employee_name,
        employee_id: body.employeeId || body.employee_id || null,
        position_title: String(body.positionTitle || body.position_title || "").trim() || null,
        department: String(body.department || "").trim() || null,
        registration_date: body.registrationDate || body.registration_date || new Date().toISOString().split("T")[0],
        planned_training_date: body.plannedTrainingDate || body.planned_training_date || null,
        planned_exam_date: body.plannedExamDate || body.planned_exam_date || null,
        study_format: String(body.studyFormat || body.study_format || "").trim() || null,
        status: body.status && ALLOWED_RSTATUSES.includes(body.status) ? body.status : "draft",
        total_cost_vnd: body.totalCostVnd != null ? Number(body.totalCostVnd) : body.total_cost_vnd != null ? Number(body.total_cost_vnd) : null,
        notes: String(body.notes || "").trim() || null,
        created_by: acct.accountId,
      };

      const { data: reg, error: regError } = await supabase.from("cchn_registrations").insert(registration).select().single();
      if (regError) return json({ ok: false, error: regError.message }, 400);

      const items = catalog_item_ids.map(id => ({ registration_id: reg.id, catalog_item_id: id }));
      const { error: itemsError } = await supabase.from("cchn_registration_items").insert(items);
      if (itemsError) {
        await supabase.from("cchn_registrations").delete().eq("id", reg.id);
        return json({ ok: false, error: itemsError.message }, 400);
      }

      // Fetch full record
      const { data: full } = await supabase.from("cchn_registrations")
        .select("*, cchn_registration_items(*, cchn_catalog_items(*))").eq("id", reg.id).single();

      await writeAuditLog(supabase, request, {
        actor: acct, action: "cchn.registration_created",
        entityType: "cchn_registrations", entityId: reg.id,
        entityDisplayName: employee_name,
        metadata: { department: registration.department, itemIds: catalog_item_ids },
      });

      return json({ ok: true, data: normalizeRegistration(full) }, 201);
    }

    // GET /api/admin/cchn/registrations/:id — detail
    const detailMatch = path.match(/^\/api\/admin\/cchn\/registrations\/([^/]+)$/);
    if (detailMatch && method === "GET") {
      const { data, error } = await supabase.from("cchn_registrations")
        .select("*, cchn_registration_items(*, cchn_catalog_items(*))").eq("id", detailMatch[1]).single();
      if (error) return json({ ok: false, error: "NOT_FOUND" }, 404);
      return json({ ok: true, data: normalizeRegistration(data) });
    }

    // PATCH /api/admin/cchn/registrations/:id — update
    if (detailMatch && method === "PATCH") {
      const { data: existing, error: fetchError } = await supabase.from("cchn_registrations").select("*").eq("id", detailMatch[1]).single();
      if (fetchError || !existing) return json({ ok: false, error: "NOT_FOUND" }, 404);

      const body = await readJson(request);
      const updates = {};
      if (body.employeeName || body.employee_name) updates.employee_name = String(body.employeeName || body.employee_name).trim();
      if (body.positionTitle !== undefined) updates.position_title = String(body.positionTitle || body.position_title || "").trim() || null;
      if (body.department !== undefined) updates.department = String(body.department || "").trim() || null;
      if (body.registrationDate !== undefined) updates.registration_date = body.registrationDate || body.registration_date || null;
      if (body.plannedTrainingDate !== undefined) updates.planned_training_date = body.plannedTrainingDate || body.planned_training_date || null;
      if (body.plannedExamDate !== undefined) updates.planned_exam_date = body.plannedExamDate || body.planned_exam_date || null;
      if (body.studyFormat !== undefined) updates.study_format = String(body.studyFormat || body.study_format || "").trim() || null;
      if (body.status && ALLOWED_RSTATUSES.includes(body.status)) updates.status = body.status;
      if (body.totalCostVnd !== undefined) updates.total_cost_vnd = body.totalCostVnd != null ? Number(body.totalCostVnd) : null;
      if (body.notes !== undefined) updates.notes = String(body.notes || "").trim() || null;

      const { data, error } = await supabase.from("cchn_registrations").update(updates).eq("id", detailMatch[1]).select().single();
      if (error) return json({ ok: false, error: error.message }, 400);

      // Update items if provided
      const catalog_item_ids = Array.isArray(body.catalogItemIds || body.catalog_item_ids) ? (body.catalogItemIds || body.catalog_item_ids) : null;
      if (catalog_item_ids) {
        await supabase.from("cchn_registration_items").delete().eq("registration_id", data.id);
        const items = catalog_item_ids.map(id => ({ registration_id: data.id, catalog_item_id: id }));
        await supabase.from("cchn_registration_items").insert(items);
      }

      const { data: full } = await supabase.from("cchn_registrations")
        .select("*, cchn_registration_items(*, cchn_catalog_items(*))").eq("id", data.id).single();

      await writeAuditLog(supabase, request, {
        actor: acct, action: "cchn.registration_updated",
        entityType: "cchn_registrations", entityId: data.id,
        entityDisplayName: data.employee_name,
        metadata: { statusBefore: existing.status, statusAfter: data.status, itemIds: catalog_item_ids },
      });

      return json({ ok: true, data: normalizeRegistration(full) });
    }

    // POST /api/admin/cchn/registrations/:id/cancel — cancel
    const cancelMatch = path.match(/^\/api\/admin\/cchn\/registrations\/([^/]+)\/cancel$/);
    if (cancelMatch && method === "POST") {
      const { data: existing } = await supabase.from("cchn_registrations").select("*").eq("id", cancelMatch[1]).single();
      if (!existing) return json({ ok: false, error: "NOT_FOUND" }, 404);

      const { data, error } = await supabase.from("cchn_registrations").update({ status: "cancelled" }).eq("id", cancelMatch[1]).select().single();
      if (error) return json({ ok: false, error: error.message }, 400);

      await writeAuditLog(supabase, request, {
        actor: acct, action: "cchn.registration_cancelled",
        entityType: "cchn_registrations", entityId: data.id,
        entityDisplayName: data.employee_name,
        metadata: { statusBefore: existing.status },
      });

      return json({ ok: true, data: normalizeRegistration(data) });
    }

    return json({ ok: false, error: "NOT_FOUND" }, 404);
  } catch (error) {
    return json({ ok: false, error: error.message || "INTERNAL_ERROR" }, 500);
  }
}
