import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireHr } from "../middleware/auth.js";
import { writeAuditLog } from "../services/audit-service.js";

const ALLOWED_STATUSES = ["not_updated", "planned", "in_progress", "completed", "cancelled"];
const ALLOWED_ORDER_BY = ["created_at", "employee_name", "department", "training_name", "start_date", "end_date", "status", "total_cost_vnd"];

function normalizeRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    positionTitle: row.position_title,
    department: row.department,
    trainingName: row.training_name,
    purposeAndJobRelevance: row.purpose_and_job_relevance,
    trainingProvider: row.training_provider,
    trainingCategory: row.training_category,
    startDate: row.start_date,
    endDate: row.end_date,
    studyFormat: row.study_format,
    totalCostVnd: row.total_cost_vnd ? Number(row.total_cost_vnd) : null,
    status: row.status,
    notes: row.notes,
    sourceKey: row.source_key,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function handleTrainingTracking(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const url = new URL(request.url);
  const path = url.pathname;
  const supabase = getSupabase(env);

  try {
    // GET /api/admin/training-tracking — list with filters
    if (path === "/api/admin/training-tracking" && method === "GET") {
      let query = supabase.from("training_tracking_records").select("*", { count: "exact" });

      const search = url.searchParams.get("search");
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`employee_name.ilike.${term},training_name.ilike.${term},training_provider.ilike.${term},department.ilike.${term}`);
      }
      const department = url.searchParams.get("department");
      if (department) query = query.eq("department", department);
      const category = url.searchParams.get("category");
      if (category) query = query.eq("training_category", category);
      const status = url.searchParams.get("status");
      if (status && ALLOWED_STATUSES.includes(status)) query = query.eq("status", status);

      const orderBy = url.searchParams.get("orderBy");
      const orderDir = url.searchParams.get("orderDir") === "asc" ? "asc" : "desc";
      const sortCol = ALLOWED_ORDER_BY.includes(orderBy) ? orderBy : "created_at";
      query = query.order(sortCol, { ascending: orderDir === "asc" });

      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
      const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "25")));
      const offset = (page - 1) * pageSize;
      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;
      if (error) return json({ ok: false, error: error.message }, 400);
      return json({ ok: true, data: (data || []).map(normalizeRecord), total: count || 0, page, pageSize });
    }

    // POST /api/admin/training-tracking — create
    if (path === "/api/admin/training-tracking" && method === "POST") {
      const body = await readJson(request);
      const employee_name = String(body.employeeName || body.employee_name || "").trim();
      const position_title = String(body.positionTitle || body.position_title || "").trim();
      const department = String(body.department || "").trim();
      const training_name = String(body.trainingName || body.training_name || "").trim();
      const purpose_and_job_relevance = String(body.purposeAndJobRelevance || body.purpose_and_job_relevance || "").trim();
      const training_provider = String(body.trainingProvider || body.training_provider || "").trim();
      const training_category = String(body.trainingCategory || body.training_category || "").trim();
      if (!employee_name || !training_name || !training_provider || !training_category) {
        return json({ ok: false, error: "Missing required fields" }, 400);
      }
      if (purpose_and_job_relevance.length > 5000) {
        return json({ ok: false, error: "Purpose text too long (max 5000 chars)" }, 400);
      }
      const study_format = String(body.studyFormat || body.study_format || "").trim() || null;
      const notes = String(body.notes || "").trim() || null;
      if (notes && notes.length > 2000) {
        return json({ ok: false, error: "Notes too long (max 2000 chars)" }, 400);
      }
      const start_date = body.startDate || body.start_date || null;
      const end_date = body.endDate || body.end_date || null;
      const total_cost_vnd = body.totalCostVnd != null ? Number(body.totalCostVnd) : body.total_cost_vnd != null ? Number(body.total_cost_vnd) : null;
      const status = body.status && ALLOWED_STATUSES.includes(body.status) ? body.status : "not_updated";

      const row = {
        employee_name, position_title, department, training_name,
        purpose_and_job_relevance, training_provider, training_category,
        start_date, end_date, study_format, total_cost_vnd,
        status, notes, created_by: acct.accountId,
      };

      const { data, error } = await supabase.from("training_tracking_records").insert(row).select().single();
      if (error) return json({ ok: false, error: error.message }, 400);

      await writeAuditLog(supabase, request, {
        actor: acct, action: "training_tracking.created",
        entityType: "training_tracking_records", entityId: data.id,
        entityDisplayName: training_name,
        metadata: { employeeName: employee_name, department, trainingCategory: training_category },
      });

      return json({ ok: true, data: normalizeRecord(data) }, 201);
    }

    // GET /api/admin/training-tracking/:id — detail
    const detailMatch = path.match(/^\/api\/admin\/training-tracking\/([^/]+)$/);
    if (detailMatch && method === "GET") {
      const { data, error } = await supabase.from("training_tracking_records").select("*").eq("id", detailMatch[1]).single();
      if (error) return json({ ok: false, error: "NOT_FOUND" }, 404);
      return json({ ok: true, data: normalizeRecord(data) });
    }

    // PATCH /api/admin/training-tracking/:id — update
    if (detailMatch && method === "PATCH") {
      const { data: existing, error: fetchError } = await supabase.from("training_tracking_records").select("*").eq("id", detailMatch[1]).single();
      if (fetchError || !existing) return json({ ok: false, error: "NOT_FOUND" }, 404);

      const body = await readJson(request);
      const updates = {};
      if (body.employeeName || body.employee_name) updates.employee_name = String(body.employeeName || body.employee_name).trim();
      if (body.positionTitle || body.position_title) updates.position_title = String(body.positionTitle || body.position_title).trim();
      if (body.department) updates.department = String(body.department).trim();
      if (body.trainingName || body.training_name) updates.training_name = String(body.trainingName || body.training_name).trim();
      if (body.purposeAndJobRelevance || body.purpose_and_job_relevance) updates.purpose_and_job_relevance = String(body.purposeAndJobRelevance || body.purpose_and_job_relevance).trim();
      if (body.trainingProvider || body.training_provider) updates.training_provider = String(body.trainingProvider || body.training_provider).trim();
      if (body.trainingCategory || body.training_category) updates.training_category = String(body.trainingCategory || body.training_category).trim();
      if (body.startDate !== undefined || body.start_date !== undefined) updates.start_date = body.startDate || body.start_date || null;
      if (body.endDate !== undefined || body.end_date !== undefined) updates.end_date = body.endDate || body.end_date || null;
      if (body.studyFormat !== undefined || body.study_format !== undefined) updates.study_format = String(body.studyFormat || body.study_format || "").trim() || null;
      if (body.totalCostVnd !== undefined || body.total_cost_vnd !== undefined) updates.total_cost_vnd = body.totalCostVnd != null ? Number(body.totalCostVnd) : body.total_cost_vnd != null ? Number(body.total_cost_vnd) : null;
      if (body.status && ALLOWED_STATUSES.includes(body.status)) updates.status = body.status;
      if (body.notes !== undefined) updates.notes = String(body.notes || "").trim() || null;

      const { data, error } = await supabase.from("training_tracking_records").update(updates).eq("id", detailMatch[1]).select().single();
      if (error) return json({ ok: false, error: error.message }, 400);

      await writeAuditLog(supabase, request, {
        actor: acct, action: "training_tracking.updated",
        entityType: "training_tracking_records", entityId: data.id,
        entityDisplayName: data.training_name,
        metadata: { employeeName: data.employee_name, statusBefore: existing.status, statusAfter: data.status },
      });

      return json({ ok: true, data: normalizeRecord(data) });
    }

    // POST /api/admin/training-tracking/:id/archive — archive
    const archiveMatch = path.match(/^\/api\/admin\/training-tracking\/([^/]+)\/archive$/);
    if (archiveMatch && method === "POST") {
      const { data: existing, error: fetchError } = await supabase.from("training_tracking_records").select("*").eq("id", archiveMatch[1]).single();
      if (fetchError || !existing) return json({ ok: false, error: "NOT_FOUND" }, 404);

      const newStatus = existing.status === "cancelled" ? "cancelled" : "cancelled";
      const { data, error } = await supabase.from("training_tracking_records").update({ status: "cancelled", notes: existing.notes ? `${existing.notes}\n[Archived ${new Date().toISOString()}]` : `[Archived ${new Date().toISOString()}]` }).eq("id", archiveMatch[1]).select().single();
      if (error) return json({ ok: false, error: error.message }, 400);

      await writeAuditLog(supabase, request, {
        actor: acct, action: "training_tracking.archived",
        entityType: "training_tracking_records", entityId: data.id,
        entityDisplayName: data.training_name,
        metadata: { employeeName: data.employee_name, statusBefore: existing.status },
      });

      return json({ ok: true, data: normalizeRecord(data) });
    }

    return json({ ok: false, error: "NOT_FOUND" }, 404);
  } catch (error) {
    return json({ ok: false, error: error.message || "INTERNAL_ERROR" }, 500);
  }
}
