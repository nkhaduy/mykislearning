import { createNotificationEvent } from "./notificationEngine.js";
import { auditLater, writeAuditLog } from "./audit-service.js";

const ACTIVE_EMPLOYEE_STATUSES = ["active", "pending", "locked", "pendingActivation"];
const TARGET_WEIGHT = { individual: 4, job_title: 3, department: 2, all_employees: 1 };

export function cid(prefix = "cmp") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function cleanText(value, max = 500) {
  return String(value ?? "").trim().replace(/[<>]/g, "").slice(0, max);
}

export function sanitizeMetadata(value, maxBytes = 4000) {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [key, raw] of Object.entries(value)) {
    if (/password|token|secret|credential|key/i.test(key)) continue;
    if (["string", "number", "boolean"].includes(typeof raw) || raw === null) {
      out[cleanText(key, 80)] = typeof raw === "string" ? cleanText(raw, 800) : raw;
    }
  }
  return JSON.stringify(out).length > maxBytes ? { truncated: true } : out;
}

export function httpError(code, status = 400) {
  return Object.assign(new Error(code), { code, status });
}

export async function listEmployees(supabase, filters = {}) {
  let query = supabase.from("profiles")
    .select("id, employee_code, full_name, email, department, position, role, account_status, notes")
    .eq("role", "employee")
    .in("account_status", ACTIVE_EMPLOYEE_STATUSES)
    .limit(5000);
  if (filters.employeeId) query = query.eq("id", filters.employeeId);
  if (filters.department) query = query.eq("department", filters.department);
  if (filters.jobTitle) query = query.eq("position", filters.jobTitle);
  const { data, error } = await query;
  if (error) throw httpError("EMPLOYEE_LOOKUP_FAILED", 500);
  return (data || [])
    .filter((row) => !String(row.notes || "").includes('"soft_deleted":true'))
    .map((row) => ({
      id: row.id,
      employeeCode: row.employee_code || "",
      fullName: row.full_name || "",
      email: row.email || "",
      department: row.department || "",
      jobTitle: row.position || "",
      accountStatus: row.account_status || "",
    }));
}

export async function getEmployee(supabase, employeeId) {
  const rows = await listEmployees(supabase, { employeeId });
  const employee = rows[0] || null;
  if (!employee) throw httpError("EMPLOYEE_NOT_FOUND", 404);
  return employee;
}

export async function assertLevelBelongs(supabase, competencyId, levelId) {
  const { data, error } = await supabase.from("competency_levels")
    .select("id, competency_id, rank, name, code")
    .eq("id", levelId)
    .maybeSingle();
  if (error) throw httpError("COMPETENCY_LEVEL_NOT_FOUND", 500);
  if (!data || data.competency_id !== competencyId) throw httpError("COMPETENCY_LEVEL_NOT_FOUND", 404);
  return data;
}

export async function assertPublishedResource(supabase, resourceType, resourceId, resourceVersionId = "") {
  const type = cleanText(resourceType);
  const id = cleanText(resourceId, 300);
  const versionId = cleanText(resourceVersionId, 300);
  if (!id) throw httpError("RESOURCE_MAPPING_NOT_FOUND", 400);
  if (type === "course") {
    if (!versionId) throw httpError("RESOURCE_VERSION_NOT_PUBLISHED", 400);
    const { data, error } = await supabase.from("course_versions").select("id, course_id, status").eq("id", versionId).eq("course_id", id).maybeSingle();
    if (error) throw httpError(error.message, 500);
    if (!data || data.status !== "published") throw httpError("RESOURCE_VERSION_NOT_PUBLISHED", 409);
    return data;
  }
  if (type === "learning_path") {
    if (!versionId) throw httpError("RESOURCE_VERSION_NOT_PUBLISHED", 400);
    const { data, error } = await supabase.from("learning_path_versions").select("id, learning_path_id, status").eq("id", versionId).eq("learning_path_id", id).maybeSingle();
    if (error) throw httpError(error.message, 500);
    if (!data || data.status !== "published") throw httpError("RESOURCE_VERSION_NOT_PUBLISHED", 409);
    return data;
  }
  if (type === "quiz") {
    if (!versionId) throw httpError("RESOURCE_VERSION_NOT_PUBLISHED", 400);
    const { data, error } = await supabase.from("quiz_versions").select("id, quiz_id, status").eq("id", versionId).eq("quiz_id", id).maybeSingle();
    if (error) throw httpError(error.message, 500);
    if (!data || data.status !== "published") throw httpError("RESOURCE_VERSION_NOT_PUBLISHED", 409);
    return data;
  }
  if (type === "certificate_type") {
    const { data, error } = await supabase.from("certificate_types").select("id, status").eq("id", id).maybeSingle();
    if (error) throw httpError(error.message, 500);
    if (!data || !["active", "published"].includes(data.status)) throw httpError("RESOURCE_VERSION_NOT_PUBLISHED", 409);
    return data;
  }
  if (type === "compliance_program") {
    const { data, error } = await supabase.from("compliance_programs").select("id, status, pinned_resource_version_id").eq("id", id).maybeSingle();
    if (error) throw httpError(error.message, 500);
    if (!data || !["active", "published"].includes(data.status)) throw httpError("RESOURCE_VERSION_NOT_PUBLISHED", 409);
    if (versionId && data.pinned_resource_version_id && versionId !== data.pinned_resource_version_id) throw httpError("RESOURCE_VERSION_NOT_PUBLISHED", 409);
    return data;
  }
  throw httpError("RESOURCE_MAPPING_NOT_FOUND", 400);
}

export async function listCatalog(supabase, filters = {}) {
  let categories = supabase.from("competency_categories").select("*").order("position", { ascending: true }).order("name");
  if (filters.categoryStatus) categories = categories.eq("status", filters.categoryStatus);
  const [catRes, compRes, levelRes, reqRes, mapRes] = await Promise.all([
    categories,
    supabase.from("competencies").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("competency_levels").select("*").order("rank", { ascending: true }).limit(5000),
    supabase.from("competency_requirements").select("*, required_level:competency_levels(*)").order("created_at", { ascending: false }).limit(5000),
    supabase.from("competency_resource_mappings").select("*, awarded_level:competency_levels(*)").order("created_at", { ascending: false }).limit(5000),
  ]);
  for (const res of [catRes, compRes, levelRes, reqRes, mapRes]) if (res.error) throw httpError(res.error.message, 500);
  const levelsByComp = new Map();
  for (const level of levelRes.data || []) levelsByComp.set(level.competency_id, [...(levelsByComp.get(level.competency_id) || []), level]);
  const reqByComp = new Map();
  for (const req of reqRes.data || []) reqByComp.set(req.competency_id, [...(reqByComp.get(req.competency_id) || []), req]);
  const mapByComp = new Map();
  for (const mapping of mapRes.data || []) mapByComp.set(mapping.competency_id, [...(mapByComp.get(mapping.competency_id) || []), mapping]);
  let competencies = (compRes.data || []).map((row) => ({
    ...row,
    levels: levelsByComp.get(row.id) || [],
    requirements: reqByComp.get(row.id) || [],
    mappings: mapByComp.get(row.id) || [],
  }));
  if (filters.status) competencies = competencies.filter((row) => row.status === filters.status);
  if (filters.categoryId) competencies = competencies.filter((row) => row.category_id === filters.categoryId);
  if (filters.q) {
    const q = String(filters.q).toLowerCase();
    competencies = competencies.filter((row) => `${row.code} ${row.name} ${row.description || ""}`.toLowerCase().includes(q));
  }
  return { categories: catRes.data || [], competencies };
}

export function appliesToEmployee(rule, employee, asOf = new Date()) {
  const today = asOf.toISOString().slice(0, 10);
  if (rule.effective_from && rule.effective_from > today) return false;
  if (rule.effective_until && rule.effective_until < today) return false;
  if (rule.target_type === "all_employees") return true;
  if (rule.target_type === "department") return employee.department === rule.target_value;
  if (rule.target_type === "job_title") return employee.jobTitle === rule.target_value;
  if (rule.target_type === "individual") return employee.id === rule.target_value;
  return false;
}

function chooseRequirement(rules, employee) {
  const matching = rules.filter((rule) => appliesToEmployee(rule, employee));
  matching.sort((a, b) => {
    const aw = TARGET_WEIGHT[a.target_type] || 0;
    const bw = TARGET_WEIGHT[b.target_type] || 0;
    if (aw !== bw) return bw - aw;
    if ((a.priority || 0) !== (b.priority || 0)) return (b.priority || 0) - (a.priority || 0);
    return (b.required_level?.rank || 0) - (a.required_level?.rank || 0);
  });
  return matching[0] || null;
}

function chooseEffective({ evidence = [], assessments = [] }) {
  const verifiedHr = assessments
    .filter((a) => a.status === "verified" && ["hr", "system"].includes(a.assessment_type))
    .sort((a, b) => (b.assessed_level?.rank || 0) - (a.assessed_level?.rank || 0) || String(b.verified_at || b.assessment_date).localeCompare(String(a.verified_at || a.assessment_date)))[0];
  if (verifiedHr) return { level: verifiedHr.assessed_level, sourceType: `${verifiedHr.assessment_type}_assessment`, sourceId: verifiedHr.id, verified: true, lastAssessedAt: verifiedHr.verified_at || verifiedHr.assessment_date };
  const activeEvidence = evidence
    .filter((e) => e.status === "active" && (!e.expires_at || new Date(e.expires_at).getTime() >= Date.now()))
    .sort((a, b) => (b.awarded_level?.rank || 0) - (a.awarded_level?.rank || 0) || String(b.evidence_date).localeCompare(String(a.evidence_date)))[0];
  if (activeEvidence) return { level: activeEvidence.awarded_level, sourceType: activeEvidence.source_type, sourceId: activeEvidence.source_id, sourceVersionId: activeEvidence.source_version_id, verified: true, lastAssessedAt: activeEvidence.evidence_date };
  const pendingSelf = assessments
    .filter((a) => a.assessment_type === "self" && a.status === "pending")
    .sort((a, b) => String(b.assessment_date).localeCompare(String(a.assessment_date)))[0];
  if (pendingSelf) return { level: null, selfLevel: pendingSelf.assessed_level, sourceType: "self_assessment_pending", sourceId: pendingSelf.id, verified: false, lastAssessedAt: pendingSelf.assessment_date };
  return { level: null, verified: false };
}

function gapStatus(requiredRank, effectiveRank) {
  if (effectiveRank === null || effectiveRank === undefined) return "not_assessed";
  const gap = Math.max(0, requiredRank - effectiveRank);
  if (gap <= 0) return "met";
  if (gap === 1) return "minor_gap";
  return "significant_gap";
}

export async function buildSkillsMatrix(supabase, filters = {}) {
  const page = Math.max(1, Number.parseInt(filters.page || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(filters.pageSize || "25", 10) || 25));
  const employeesAll = await listEmployees(supabase, filters);
  const total = employeesAll.length;
  const employees = employeesAll.slice((page - 1) * pageSize, page * pageSize);
  const employeeIds = employees.map((e) => e.id);
  const [compRes, levelRes, reqRes, evidenceRes, assessRes] = await Promise.all([
    supabase.from("competencies").select("*, category:competency_categories(*)").eq("status", "active").limit(1000),
    supabase.from("competency_levels").select("*").limit(5000),
    supabase.from("competency_requirements").select("*, required_level:competency_levels(*)").eq("is_mandatory", true).limit(5000),
    employeeIds.length ? supabase.from("employee_competency_evidence").select("*, awarded_level:competency_levels(*)").in("employee_id", employeeIds).limit(20000) : { data: [], error: null },
    employeeIds.length ? supabase.from("employee_competency_assessments").select("*, assessed_level:competency_levels(*)").in("employee_id", employeeIds).limit(20000) : { data: [], error: null },
  ]);
  for (const res of [compRes, levelRes, reqRes, evidenceRes, assessRes]) if (res.error) throw httpError(res.error.message, 500);
  let competencies = compRes.data || [];
  if (filters.competencyId) competencies = competencies.filter((c) => c.id === filters.competencyId);
  if (filters.categoryId) competencies = competencies.filter((c) => c.category_id === filters.categoryId);
  const levelsByComp = new Map();
  for (const level of levelRes.data || []) levelsByComp.set(level.competency_id, [...(levelsByComp.get(level.competency_id) || []), level]);
  const reqByComp = new Map();
  for (const req of reqRes.data || []) reqByComp.set(req.competency_id, [...(reqByComp.get(req.competency_id) || []), req]);
  const evidenceByKey = new Map();
  for (const e of evidenceRes.data || []) evidenceByKey.set(`${e.employee_id}:${e.competency_id}`, [...(evidenceByKey.get(`${e.employee_id}:${e.competency_id}`) || []), e]);
  const assessByKey = new Map();
  for (const a of assessRes.data || []) assessByKey.set(`${a.employee_id}:${a.competency_id}`, [...(assessByKey.get(`${a.employee_id}:${a.competency_id}`) || []), a]);
  const summary = { met: 0, minor_gap: 0, significant_gap: 0, not_assessed: 0 };
  const rows = employees.map((employee) => {
    const cells = [];
    for (const comp of competencies) {
      const requirement = chooseRequirement(reqByComp.get(comp.id) || [], employee);
      if (!requirement) continue;
      const key = `${employee.id}:${comp.id}`;
      const effective = chooseEffective({ evidence: evidenceByKey.get(key) || [], assessments: assessByKey.get(key) || [] });
      const requiredRank = requirement.required_level?.rank ?? 0;
      const effectiveRank = effective.level?.rank ?? null;
      const gap = effectiveRank === null ? null : Math.max(0, requiredRank - effectiveRank);
      const status = gapStatus(requiredRank, effectiveRank);
      summary[status] += 1;
      cells.push({
        competencyId: comp.id,
        competencyCode: comp.code,
        competencyName: comp.name,
        categoryName: comp.category?.name || "",
        requiredLevel: requirement.required_level || null,
        effectiveLevel: effective.level || null,
        selfLevel: effective.selfLevel || null,
        gap,
        status,
        requirementSource: { type: requirement.target_type, value: requirement.target_value, priority: requirement.priority },
        evidenceSource: effective,
        lastAssessedAt: effective.lastAssessedAt || null,
      });
    }
    return { employee, cells };
  });
  return {
    rows,
    competencies: competencies.map((c) => ({ ...c, levels: levelsByComp.get(c.id) || [] })),
    summary,
    pagination: { total, page, pageSize },
  };
}

export async function getEmployeeCompetencyDetail(supabase, employeeId, competencyId) {
  const employee = await getEmployee(supabase, employeeId);
  const matrix = await buildSkillsMatrix(supabase, { employeeId, competencyId, pageSize: 1 });
  const cell = matrix.rows[0]?.cells?.[0] || null;
  const [evidence, assessments, mappings] = await Promise.all([
    supabase.from("employee_competency_evidence").select("*, awarded_level:competency_levels(*)").eq("employee_id", employeeId).eq("competency_id", competencyId).order("evidence_date", { ascending: false }).limit(100),
    supabase.from("employee_competency_assessments").select("*, assessed_level:competency_levels(*)").eq("employee_id", employeeId).eq("competency_id", competencyId).order("assessment_date", { ascending: false }).limit(100),
    supabase.from("competency_resource_mappings").select("*, awarded_level:competency_levels(*)").eq("competency_id", competencyId).eq("status", "active").limit(100),
  ]);
  for (const res of [evidence, assessments, mappings]) if (res.error) throw httpError(res.error.message, 500);
  return { employee, cell, evidence: evidence.data || [], assessments: assessments.data || [], mappings: mappings.data || [] };
}

export async function createSystemEvidence(supabase, input) {
  const row = {
    id: input.id || cid("cevd"),
    employee_id: input.employeeId,
    competency_id: input.competencyId,
    source_type: input.sourceType,
    source_id: input.sourceId,
    source_version_id: cleanText(input.sourceVersionId || "", 300),
    awarded_level_id: input.awardedLevelId,
    status: input.status || "active",
    evidence_date: input.evidenceDate || new Date().toISOString(),
    expires_at: input.expiresAt || null,
    metadata: sanitizeMetadata(input.metadata || {}),
  };
  const { data, error } = await supabase.from("employee_competency_evidence").insert(row).select().single();
  if (error?.code === "23505") {
    const { data: existing, error: updateErr } = await supabase.from("employee_competency_evidence")
      .update({ status: row.status, expires_at: row.expires_at, metadata: row.metadata, updated_at: new Date().toISOString() })
      .eq("employee_id", row.employee_id)
      .eq("competency_id", row.competency_id)
      .eq("source_type", row.source_type)
      .eq("source_id", row.source_id)
      .eq("source_version_id", row.source_version_id)
      .select()
      .single();
    if (updateErr) throw httpError(updateErr.message, 500);
    return existing;
  }
  if (error) throw httpError(error.message, 500);
  return data;
}

export async function syncEvidenceForEmployee(supabase, employeeId) {
  const { data: mappings, error } = await supabase.from("competency_resource_mappings").select("*").eq("status", "active").limit(5000);
  if (error) throw httpError("RESOURCE_MAPPING_NOT_FOUND", 500);
  let created = 0;
  for (const mapping of mappings || []) {
    try {
      if (mapping.resource_type === "course") {
        let query = supabase.from("enrollments").select("id, course_id, course_version_id, status, updated_at, data").eq("account_id", employeeId).eq("course_id", mapping.resource_id).eq("status", "completed").limit(50);
        if (mapping.resource_version_id) query = query.eq("course_version_id", mapping.resource_version_id);
        const { data } = await query;
        for (const row of data || []) {
          await createSystemEvidence(supabase, { employeeId, competencyId: mapping.competency_id, sourceType: "course_completion", sourceId: row.id, sourceVersionId: row.course_version_id, awardedLevelId: mapping.awarded_level_id, evidenceDate: row.data?.completedAt || row.updated_at, metadata: { resourceType: "course", courseId: row.course_id } });
          created += 1;
        }
      } else if (mapping.resource_type === "learning_path") {
        let query = supabase.from("learning_path_assignments").select("id, learning_path_id, learning_path_version_id, status, completed_at, updated_at").eq("employee_id", employeeId).eq("learning_path_id", mapping.resource_id).eq("status", "completed").limit(50);
        if (mapping.resource_version_id) query = query.eq("learning_path_version_id", mapping.resource_version_id);
        const { data } = await query;
        for (const row of data || []) {
          await createSystemEvidence(supabase, { employeeId, competencyId: mapping.competency_id, sourceType: "learning_path_completion", sourceId: row.id, sourceVersionId: row.learning_path_version_id, awardedLevelId: mapping.awarded_level_id, evidenceDate: row.completed_at || row.updated_at, metadata: { learningPathId: row.learning_path_id } });
          created += 1;
        }
      } else if (mapping.resource_type === "quiz") {
        let query = supabase.from("quiz_attempts").select("id, quiz_id, quiz_version_id, passed, score_percent, submitted_at, created_at").eq("account_id", employeeId).eq("quiz_id", mapping.resource_id).eq("passed", true).limit(50);
        if (mapping.resource_version_id) query = query.eq("quiz_version_id", mapping.resource_version_id);
        const { data } = await query;
        for (const row of data || []) {
          await createSystemEvidence(supabase, { employeeId, competencyId: mapping.competency_id, sourceType: "quiz_pass", sourceId: row.id, sourceVersionId: row.quiz_version_id, awardedLevelId: mapping.awarded_level_id, evidenceDate: row.submitted_at || row.created_at, metadata: { quizId: row.quiz_id, scorePercent: row.score_percent } });
          created += 1;
        }
      } else if (mapping.resource_type === "certificate_type") {
        const { data } = await supabase.from("employee_certifications").select("id, certificate_type_id, verification_status, status, verified_at, reviewed_at, expiry_date, updated_at").eq("account_id", employeeId).eq("certificate_type_id", mapping.resource_id).in("verification_status", ["approved", "verified"]).limit(50);
        for (const row of data || []) {
          const active = row.status !== "revoked" && (!row.expiry_date || row.expiry_date >= new Date().toISOString().slice(0, 10));
          await createSystemEvidence(supabase, { employeeId, competencyId: mapping.competency_id, sourceType: "certificate_verified", sourceId: row.id, awardedLevelId: mapping.awarded_level_id, status: active ? "active" : "expired", evidenceDate: row.verified_at || row.reviewed_at || row.updated_at, expiresAt: row.expiry_date ? `${row.expiry_date}T23:59:59+07:00` : null, metadata: { certificateTypeId: row.certificate_type_id } });
          created += 1;
        }
      } else if (mapping.resource_type === "compliance_program") {
        let query = supabase.from("compliance_completion_records").select("id, employee_id, program_id, resource_version_id, completed_at, completion_source").eq("employee_id", employeeId).eq("program_id", mapping.resource_id).limit(50);
        if (mapping.resource_version_id) query = query.eq("resource_version_id", mapping.resource_version_id);
        const { data } = await query;
        for (const row of data || []) {
          await createSystemEvidence(supabase, { employeeId, competencyId: mapping.competency_id, sourceType: "compliance_completion", sourceId: row.id, sourceVersionId: row.resource_version_id, awardedLevelId: mapping.awarded_level_id, evidenceDate: row.completed_at, metadata: { programId: row.program_id, source: row.completion_source } });
          created += 1;
        }
      }
    } catch {
      // Evidence sync is retryable and must not fail the source workflow.
    }
  }
  return { ok: true, created };
}

export async function createSelfAssessment(supabase, request, acct, competencyId, body) {
  const levelId = cleanText(body.assessedLevelId || body.assessed_level_id);
  await assertLevelBelongs(supabase, competencyId, levelId);
  const row = {
    id: cid("cass"),
    employee_id: acct.accountId,
    competency_id: competencyId,
    assessment_type: "self",
    assessed_level_id: levelId,
    status: "pending",
    assessor_id: acct.accountId,
    reason: cleanText(body.reason, 1000),
    notes: cleanText(body.notes || body.evidenceNote, 1500),
  };
  const { data, error } = await supabase.from("employee_competency_assessments").insert(row).select().single();
  if (error) throw httpError(error.message, 500);
  await createNotificationEvent(supabase, {
    eventType: "self_assessment_submitted",
    entityType: "competency_assessment",
    entityId: data.id,
    actorId: acct.accountId,
    recipientId: "acc-hr-demo",
    idempotencyKey: `self_assessment_submitted:${data.id}`,
    payload: { competency_name: competencyId, employee_name: acct.accountId },
    link: "/admin/skills-matrix",
  }).catch(() => {});
  auditLater(supabase, request, { actor: acct, action: "competency.self_assessment_submitted", entityType: "competency_assessment", entityId: data.id, metadata: { competency_id: competencyId, employee_id: acct.accountId, level_to: levelId } });
  return data;
}

export async function verifyAssessment(supabase, request, acct, id, action, reason = "") {
  const { data: existing, error } = await supabase.from("employee_competency_assessments").select("*").eq("id", id).maybeSingle();
  if (error) throw httpError("ASSESSMENT_NOT_FOUND", 500);
  if (!existing) throw httpError("ASSESSMENT_NOT_FOUND", 404);
  if (existing.status === "verified" && action === "verify") throw httpError("ASSESSMENT_ALREADY_VERIFIED", 409);
  if (action === "reject" && !cleanText(reason)) throw httpError("ASSESSMENT_REASON_REQUIRED", 400);
  const status = action === "verify" ? "verified" : "rejected";
  const patch = { status, verified_by: acct.accountId, verified_at: new Date().toISOString(), reason: cleanText(reason || existing.reason, 1000), updated_at: new Date().toISOString() };
  const { data, error: updateErr } = await supabase.from("employee_competency_assessments").update(patch).eq("id", id).select().single();
  if (updateErr) throw httpError(updateErr.message, 500);
  await writeAuditLog(supabase, request, { actor: acct, action: action === "verify" ? "competency.assessment_verified" : "competency.assessment_rejected", entityType: "competency_assessment", entityId: id, beforeData: { status: existing.status, assessed_level_id: existing.assessed_level_id }, afterData: { status, assessed_level_id: data.assessed_level_id }, metadata: { competency_id: data.competency_id, employee_id: data.employee_id, level_to: data.assessed_level_id } });
  await createNotificationEvent(supabase, {
    eventType: action === "verify" ? "self_assessment_verified" : "self_assessment_rejected",
    entityType: "competency_assessment",
    entityId: id,
    actorId: acct.accountId,
    recipientId: data.employee_id,
    idempotencyKey: `${action}:competency_assessment:${id}`,
    payload: { competency_name: data.competency_id, rejection_reason: patch.reason || "" },
    link: "/dashboard/skills",
  }).catch(() => {});
  return data;
}

export async function createManualAssessment(supabase, request, acct, body) {
  const employeeId = cleanText(body.employeeId || body.employee_id);
  const competencyId = cleanText(body.competencyId || body.competency_id);
  const levelId = cleanText(body.assessedLevelId || body.assessed_level_id);
  if (!cleanText(body.reason)) throw httpError("ASSESSMENT_REASON_REQUIRED", 400);
  await getEmployee(supabase, employeeId);
  await assertLevelBelongs(supabase, competencyId, levelId);
  const row = { id: cid("cass"), employee_id: employeeId, competency_id: competencyId, assessment_type: "hr", assessed_level_id: levelId, status: "verified", assessor_id: acct.accountId, reason: cleanText(body.reason, 1000), notes: cleanText(body.notes, 1500), verified_by: acct.accountId, verified_at: new Date().toISOString() };
  const { data, error } = await supabase.from("employee_competency_assessments").insert(row).select().single();
  if (error) throw httpError(error.message, 500);
  auditLater(supabase, request, { actor: acct, action: "competency.manual_assessment", entityType: "competency_assessment", entityId: data.id, metadata: { competency_id: competencyId, employee_id: employeeId, level_to: levelId } });
  return data;
}
