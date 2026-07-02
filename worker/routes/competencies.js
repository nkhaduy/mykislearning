import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";
import { writeAuditLog } from "../services/audit-service.js";
import * as XLSX from "xlsx";
import {
  assertLevelBelongs,
  assertPublishedResource,
  buildSkillsMatrix,
  cid,
  cleanText,
  createManualAssessment,
  createSelfAssessment,
  getEmployeeCompetencyDetail,
  httpError,
  listCatalog,
  listEmployees,
  sanitizeMetadata,
  syncEvidenceForEmployee,
  verifyAssessment,
} from "../services/competency-service.js";

function sendError(error) {
  return json({ ok: false, error: error.code || error.message || "COMPETENCY_ERROR" }, error.status || 500);
}

function parseFilters(url) {
  return {
    page: url.searchParams.get("page"),
    pageSize: url.searchParams.get("pageSize"),
    department: cleanText(url.searchParams.get("department")),
    jobTitle: cleanText(url.searchParams.get("job_title") || url.searchParams.get("jobTitle")),
    employeeId: cleanText(url.searchParams.get("employee") || url.searchParams.get("employeeId")),
    competencyId: cleanText(url.searchParams.get("competency") || url.searchParams.get("competencyId")),
    categoryId: cleanText(url.searchParams.get("category") || url.searchParams.get("categoryId")),
    status: cleanText(url.searchParams.get("status")),
    q: cleanText(url.searchParams.get("q"), 120),
  };
}

function escapeFormula(value) {
  const text = String(value ?? "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function matrixRowsForExport(matrix) {
  const rows = [["Employee", "Employee Code", "Department", "Job Title", "Competency", "Required Level", "Effective Level", "Gap", "Status", "Requirement Source", "Evidence Source", "Resource Version"]];
  for (const row of matrix.rows || []) {
    for (const cell of row.cells || []) {
      rows.push([
        row.employee.fullName,
        row.employee.employeeCode,
        row.employee.department,
        row.employee.jobTitle,
        cell.competencyName,
        cell.requiredLevel?.name || "",
        cell.effectiveLevel?.name || cell.selfLevel?.name || "",
        cell.gap ?? "",
        cell.status,
        `${cell.requirementSource?.type || ""}:${cell.requirementSource?.value || ""}`,
        cell.evidenceSource?.sourceType || "",
        cell.evidenceSource?.sourceVersionId || "",
      ].map(escapeFormula));
    }
  }
  return rows;
}

async function exportSkillsMatrix(supabase, request, acct, url) {
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const matrix = await buildSkillsMatrix(supabase, { ...parseFilters(url), pageSize: Math.min(500, Number(url.searchParams.get("pageSize") || 500) || 500) });
  const rows = matrixRowsForExport(matrix);
  await writeAuditLog(supabase, request, { actor: acct, action: "report.exported", entityType: "skills_matrix", entityId: "skills-matrix", metadata: { report_type: "skills_matrix", format, row_count: rows.length - 1 } }).catch(() => {});
  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, rows.length - 1), c: rows[0].length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, ws, "Skills Matrix");
    return new Response(XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true }), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=\"skills-matrix.xlsx\"" },
    });
  }
  const csv = "\ufeff" + rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=\"skills-matrix.csv\"" } });
}

async function createCategory(supabase, request, acct, body) {
  const row = {
    id: cid("ccat"),
    code: cleanText(body.code, 80),
    name: cleanText(body.name, 200),
    description: cleanText(body.description, 1000),
    position: Number(body.position || 0) || 0,
    status: ["active", "inactive", "archived"].includes(body.status) ? body.status : "active",
    created_by: acct.accountId,
  };
  if (!row.code || !row.name) throw httpError("MISSING_REQUIRED_FIELDS", 400);
  const { data, error } = await supabase.from("competency_categories").insert(row).select().single();
  if (error) throw httpError(error.code === "23505" ? "DUPLICATE_CATEGORY" : error.message, error.code === "23505" ? 409 : 500);
  await writeAuditLog(supabase, request, { actor: acct, action: "competency.category_created", entityType: "competency_category", entityId: data.id, metadata: { competency_id: null } });
  return data;
}

async function createCompetency(supabase, request, acct, body) {
  const row = {
    id: cid("comp"),
    category_id: cleanText(body.categoryId || body.category_id) || null,
    code: cleanText(body.code, 80),
    name: cleanText(body.name, 200),
    description: cleanText(body.description, 1500),
    status: ["draft", "active", "inactive", "archived"].includes(body.status) ? body.status : "draft",
    effective_from: body.effectiveFrom || body.effective_from || new Date().toISOString().slice(0, 10),
    effective_until: body.effectiveUntil || body.effective_until || null,
    created_by: acct.accountId,
  };
  if (!row.code || !row.name) throw httpError("MISSING_REQUIRED_FIELDS", 400);
  const { data, error } = await supabase.from("competencies").insert(row).select().single();
  if (error) throw httpError(error.code === "23505" ? "DUPLICATE_COMPETENCY" : error.message, error.code === "23505" ? 409 : 500);
  await writeAuditLog(supabase, request, { actor: acct, action: "competency.created", entityType: "competency", entityId: data.id, afterData: data, metadata: { competency_id: data.id } });
  return data;
}

async function patchCompetency(supabase, request, acct, id, body) {
  const { data: existing } = await supabase.from("competencies").select("*").eq("id", id).maybeSingle();
  if (!existing) throw httpError("COMPETENCY_NOT_FOUND", 404);
  const patch = {
    category_id: body.categoryId || body.category_id || existing.category_id,
    code: body.code !== undefined ? cleanText(body.code, 80) : existing.code,
    name: body.name !== undefined ? cleanText(body.name, 200) : existing.name,
    description: body.description !== undefined ? cleanText(body.description, 1500) : existing.description,
    effective_from: body.effectiveFrom || body.effective_from || existing.effective_from,
    effective_until: body.effectiveUntil || body.effective_until || existing.effective_until,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("competencies").update(patch).eq("id", id).select().single();
  if (error) throw httpError(error.message, 500);
  await writeAuditLog(supabase, request, { actor: acct, action: "competency.updated", entityType: "competency", entityId: id, beforeData: existing, afterData: data, metadata: { competency_id: id } });
  return data;
}

async function setCompetencyStatus(supabase, request, acct, id, status) {
  const { data, error } = await supabase.from("competencies").update({ status, updated_at: new Date().toISOString() }).eq("id", id).select().maybeSingle();
  if (error) throw httpError(error.message, 500);
  if (!data) throw httpError("COMPETENCY_NOT_FOUND", 404);
  await writeAuditLog(supabase, request, { actor: acct, action: status === "active" ? "competency.activated" : "competency.archived", entityType: "competency", entityId: id, metadata: { competency_id: id } });
  return data;
}

async function createLevel(supabase, competencyId, body) {
  const row = {
    id: cid("clvl"),
    competency_id: competencyId,
    code: cleanText(body.code, 80),
    name: cleanText(body.name, 160),
    rank: Number(body.rank),
    description: cleanText(body.description, 1000),
    behavioral_indicators: Array.isArray(body.behavioralIndicators || body.behavioral_indicators) ? (body.behavioralIndicators || body.behavioral_indicators).map((x) => cleanText(x, 300)).slice(0, 20) : [],
  };
  if (!row.code || !row.name || !Number.isFinite(row.rank) || row.rank < 0) throw httpError("INVALID_LEVEL_ORDER", 400);
  const { data, error } = await supabase.from("competency_levels").insert(row).select().single();
  if (error) throw httpError(error.code === "23505" ? "INVALID_LEVEL_ORDER" : error.message, error.code === "23505" ? 409 : 500);
  return data;
}

async function createRequirement(supabase, request, acct, body) {
  const competencyId = cleanText(body.competencyId || body.competency_id);
  const levelId = cleanText(body.requiredLevelId || body.required_level_id);
  await assertLevelBelongs(supabase, competencyId, levelId);
  const targetType = cleanText(body.targetType || body.target_type);
  if (!["all_employees", "department", "job_title", "individual"].includes(targetType)) throw httpError("INVALID_TARGET_TYPE", 400);
  const targetValue = targetType === "all_employees" ? "" : cleanText(body.targetValue || body.target_value, 300);
  const row = {
    id: cid("creq"),
    competency_id: competencyId,
    target_type: targetType,
    target_value: targetValue,
    required_level_id: levelId,
    priority: Number(body.priority || 100) || 100,
    is_mandatory: body.isMandatory ?? body.is_mandatory ?? true,
    effective_from: body.effectiveFrom || body.effective_from || new Date().toISOString().slice(0, 10),
    effective_until: body.effectiveUntil || body.effective_until || null,
    created_by: acct.accountId,
  };
  const { data, error } = await supabase.from("competency_requirements").insert(row).select().single();
  if (error) throw httpError(error.code === "23505" ? "DUPLICATE_REQUIREMENT" : error.message, error.code === "23505" ? 409 : 500);
  await writeAuditLog(supabase, request, { actor: acct, action: "competency.requirement_created", entityType: "competency_requirement", entityId: data.id, metadata: { competency_id: competencyId, level_to: levelId } });
  return data;
}

async function createMapping(supabase, request, acct, body) {
  const competencyId = cleanText(body.competencyId || body.competency_id);
  const awardedLevelId = cleanText(body.awardedLevelId || body.awarded_level_id);
  await assertLevelBelongs(supabase, competencyId, awardedLevelId);
  const resourceType = cleanText(body.resourceType || body.resource_type);
  if (!["course", "learning_path", "quiz", "certificate_type", "compliance_program"].includes(resourceType)) throw httpError("RESOURCE_MAPPING_NOT_FOUND", 400);
  const resourceId = cleanText(body.resourceId || body.resource_id, 300);
  const resourceVersionId = cleanText(body.resourceVersionId || body.resource_version_id, 300);
  await assertPublishedResource(supabase, resourceType, resourceId, resourceVersionId);
  const row = {
    id: cid("cmap"),
    competency_id: competencyId,
    resource_type: resourceType,
    resource_id: resourceId,
    resource_version_id: resourceVersionId,
    awarded_level_id: awardedLevelId,
    evidence_rule: sanitizeMetadata(body.evidenceRule || body.evidence_rule || {}),
    status: "active",
    created_by: acct.accountId,
  };
  if (!row.resource_id) throw httpError("RESOURCE_MAPPING_NOT_FOUND", 400);
  const { data, error } = await supabase.from("competency_resource_mappings").insert(row).select().single();
  if (error) throw httpError(error.code === "23505" ? "DUPLICATE_RESOURCE_MAPPING" : error.message, error.code === "23505" ? 409 : 500);
  await writeAuditLog(supabase, request, { actor: acct, action: "competency.mapping_created", entityType: "competency_resource_mapping", entityId: data.id, metadata: { competency_id: competencyId, resource_id: row.resource_id, resource_version_id: row.resource_version_id, level_to: awardedLevelId } });
  return data;
}

async function patchSimple(supabase, table, id, body, action, request, acct) {
  const patch = { updated_at: new Date().toISOString() };
  for (const key of ["status", "priority", "effective_until", "required_level_id", "awarded_level_id", "resource_version_id"]) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  const { data, error } = await supabase.from(table).update(patch).eq("id", id).select().maybeSingle();
  if (error) throw httpError(error.message, 500);
  if (!data) throw httpError("RESOURCE_MAPPING_NOT_FOUND", 404);
  await writeAuditLog(supabase, request, { actor: acct, action, entityType: table, entityId: id, metadata: { competency_id: data.competency_id, resource_id: data.resource_id, resource_version_id: data.resource_version_id } });
  return data;
}

async function deleteSimple(supabase, table, id, action, request, acct) {
  const { data } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw httpError(error.message, 500);
  await writeAuditLog(supabase, request, { actor: acct, action, entityType: table, entityId: id, metadata: { competency_id: data?.competency_id, resource_id: data?.resource_id, resource_version_id: data?.resource_version_id } });
  return { ok: true };
}

export async function handleCompetencies(request, env) {
  if (request.method.toUpperCase() === "OPTIONS") return corsPreflight();
  const supabase = getSupabase(env);
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  try {
    if (path.startsWith("/api/admin/") || path === "/api/admin/skills-matrix" || path.startsWith("/api/admin/skills-matrix/")) {
      const acct = await requireHr(request, env);
      if (!acct) return json({ error: "HR_ONLY" }, 403);

      if (path === "/api/admin/competencies/categories") {
        if (method === "GET") return json(await listCatalog(supabase, parseFilters(url)));
        if (method === "POST") return json({ ok: true, data: await createCategory(supabase, request, acct, await readJson(request)) }, 201);
      }
      if (path === "/api/admin/competencies") {
        if (method === "GET") return json(await listCatalog(supabase, parseFilters(url)));
        if (method === "POST") return json({ ok: true, data: await createCompetency(supabase, request, acct, await readJson(request)) }, 201);
      }
      const compMatch = path.match(/^\/api\/admin\/competencies\/([^/]+)(?:\/([^/]+))?$/);
      if (compMatch && !["requirements", "mappings"].includes(compMatch[1])) {
        const [, id, action] = compMatch;
        if (method === "GET" && !action) {
          const catalog = await listCatalog(supabase, {});
          const data = catalog.competencies.find((c) => c.id === id);
          if (!data) throw httpError("COMPETENCY_NOT_FOUND", 404);
          return json({ data });
        }
        if (method === "PATCH" && !action) return json({ ok: true, data: await patchCompetency(supabase, request, acct, id, await readJson(request)) });
        if (method === "POST" && action === "activate") return json({ ok: true, data: await setCompetencyStatus(supabase, request, acct, id, "active") });
        if (method === "POST" && action === "archive") return json({ ok: true, data: await setCompetencyStatus(supabase, request, acct, id, "archived") });
        if (method === "GET" && action === "levels") {
          const { data, error } = await supabase.from("competency_levels").select("*").eq("competency_id", id).order("rank");
          if (error) throw httpError(error.message, 500);
          return json({ data: data || [] });
        }
        if (method === "POST" && action === "levels") return json({ ok: true, data: await createLevel(supabase, id, await readJson(request)) }, 201);
      }
      if (path === "/api/admin/competencies/requirements") {
        if (method === "GET") return json({ data: (await listCatalog(supabase, {})).competencies.flatMap((c) => c.requirements) });
        if (method === "POST") return json({ ok: true, data: await createRequirement(supabase, request, acct, await readJson(request)) }, 201);
      }
      const reqMatch = path.match(/^\/api\/admin\/competencies\/requirements\/([^/]+)$/);
      if (reqMatch) {
        if (method === "PATCH") return json({ ok: true, data: await patchSimple(supabase, "competency_requirements", reqMatch[1], await readJson(request), "competency.requirement_updated", request, acct) });
        if (method === "DELETE") return json(await deleteSimple(supabase, "competency_requirements", reqMatch[1], "competency.requirement_deleted", request, acct));
      }
      if (path === "/api/admin/competencies/mappings") {
        if (method === "GET") return json({ data: (await listCatalog(supabase, {})).competencies.flatMap((c) => c.mappings) });
        if (method === "POST") return json({ ok: true, data: await createMapping(supabase, request, acct, await readJson(request)) }, 201);
      }
      const mapMatch = path.match(/^\/api\/admin\/competencies\/mappings\/([^/]+)$/);
      if (mapMatch) {
        if (method === "PATCH") return json({ ok: true, data: await patchSimple(supabase, "competency_resource_mappings", mapMatch[1], await readJson(request), "competency.mapping_updated", request, acct) });
        if (method === "DELETE") return json(await deleteSimple(supabase, "competency_resource_mappings", mapMatch[1], "competency.mapping_deleted", request, acct));
      }
      if (path === "/api/admin/skills-matrix/export" && method === "GET") return exportSkillsMatrix(supabase, request, acct, url);
      if (path === "/api/admin/skills-matrix" && method === "GET") return json(await buildSkillsMatrix(supabase, parseFilters(url)));
      const matrixEmp = path.match(/^\/api\/admin\/skills-matrix\/employees\/([^/]+)$/);
      if (matrixEmp && method === "GET") return json(await buildSkillsMatrix(supabase, { ...parseFilters(url), employeeId: matrixEmp[1], pageSize: 1 }));
      if (path === "/api/admin/competency-assessments" && method === "GET") {
        const { data, error } = await supabase.from("employee_competency_assessments").select("*, assessed_level:competency_levels(*), competency:competencies(*), employee:profiles(id, full_name, email, department, position)").order("created_at", { ascending: false }).limit(200);
        if (error) throw httpError(error.message, 500);
        return json({ data: data || [] });
      }
      const assessAction = path.match(/^\/api\/admin\/competency-assessments\/([^/]+)\/(verify|reject)$/);
      if (assessAction && method === "POST") {
        const body = await readJson(request).catch(() => ({}));
        return json({ ok: true, data: await verifyAssessment(supabase, request, acct, assessAction[1], assessAction[2], body.reason) });
      }
      if (path === "/api/admin/competency-assessments/manual" && method === "POST") return json({ ok: true, data: await createManualAssessment(supabase, request, acct, await readJson(request)) }, 201);
      if (path === "/api/admin/competencies/employees/preview" && method === "GET") return json({ data: await listEmployees(supabase, parseFilters(url)) });
    }

    const acct = await requireAuth(request, env);
    if (!acct) return json({ error: "Unauthorized" }, 401);
    if (path === "/api/competencies/my" && method === "GET") {
      await syncEvidenceForEmployee(supabase, acct.accountId).catch(() => null);
      return json(await buildSkillsMatrix(supabase, { employeeId: acct.accountId, pageSize: 1 }));
    }
    const myDetail = path.match(/^\/api\/competencies\/my\/([^/]+)$/);
    if (myDetail && method === "GET") {
      await syncEvidenceForEmployee(supabase, acct.accountId).catch(() => null);
      return json(await getEmployeeCompetencyDetail(supabase, acct.accountId, myDetail[1]));
    }
    const selfAssessment = path.match(/^\/api\/competencies\/my\/([^/]+)\/self-assessment$/);
    if (selfAssessment && method === "POST") return json({ ok: true, data: await createSelfAssessment(supabase, request, acct, selfAssessment[1], await readJson(request)) }, 201);
  } catch (error) {
    return sendError(error);
  }
  return methodNotAllowed();
}
