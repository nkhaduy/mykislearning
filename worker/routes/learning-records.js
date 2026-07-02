import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";
import { createNotificationEvent } from "../services/notificationEngine.js";

const WORKFLOW = ["draft", "submitted", "in_review", "needs_revision", "approved", "rejected", "archived"];
const EDITABLE_BY_EMPLOYEE = ["draft", "needs_revision"];
const CERT_EDITABLE_BY_EMPLOYEE = ["draft", "needs_revision"];
const BUCKET = "learning-evidence";
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function clean(v) { return String(v ?? "").trim(); }
function num(v) { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; }
function pageParams(url) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}
function isHr(acct) { return ["hr", "admin"].includes(acct?.role); }
function certEffectiveStatus(row) {
  if (row.status === "revoked") return "revoked";
  if (row.no_expiry || !row.expiry_date) return "no_expiry";
  const today = new Date().toISOString().slice(0, 10);
  if (row.expiry_date < today) return "expired";
  const diff = (new Date(`${row.expiry_date}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000;
  return diff <= 90 ? "expiring_soon" : "valid";
}
function mapProfile(row) {
  return row ? { id: row.id, employeeCode: row.employee_code || "", fullName: row.full_name || "", email: row.email || "", department: row.department || "", position: row.position || "" } : null;
}
function mapLearning(row) {
  return {
    id: row.id,
    kind: "learning_record",
    employee: mapProfile(row.employee),
    accountId: row.account_id,
    recordType: row.record_type,
    sourceType: row.source_type,
    title: row.title,
    category: row.category || "",
    provider: row.provider || "",
    deliveryMethod: row.delivery_method || "",
    startDate: row.start_date,
    completionDate: row.completion_date,
    durationHours: Number(row.duration_hours || 0),
    result: row.result || "",
    description: row.description || "",
    skills: row.skills || "",
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    revisionNote: row.revision_note || "",
    rejectionReason: row.rejection_reason || "",
    data: row.data || {},
    attachments: row.attachments || [],
    createdAt: row.created_at,
  };
}
function mapCert(row) {
  return {
    id: row.id,
    kind: "certificate",
    employee: mapProfile(row.employee),
    accountId: row.account_id,
    learningRecordId: row.learning_record_id || "",
    certificateType: row.certificate_type || "",
    certificateName: row.name || "",
    certificateNumber: row.certificate_number || "",
    issuer: row.issuer || "",
    issuedDate: row.issue_date || "",
    expiryDate: row.expiry_date || "",
    noExpiry: Boolean(row.no_expiry),
    score: row.score || "",
    status: certEffectiveStatus(row),
    rawStatus: row.status || "",
    verificationStatus: row.verification_status || "approved",
    submittedAt: row.submitted_at || row.created_at,
    approvedAt: row.approved_at,
    revisionNote: row.revision_note || "",
    rejectionReason: row.rejection_reason || "",
    sourceType: row.source_type || "",
    source: row.source || "",
    data: row.data || {},
    attachments: row.attachments || [],
    createdAt: row.created_at,
  };
}
async function audit(supabase, acct, action, targetType, targetId, details = {}) {
  await Promise.allSettled([
    supabase.from("audit_logs").insert({ actor_id: acct?.accountId || null, action, target_type: targetType, target_id: targetId, result: "success", details }),
    supabase.from("approval_events").insert({ entity_type: targetType === "employee_certification" ? "certificate" : "learning_record", entity_id: targetId, actor_account_id: acct?.accountId || null, action, from_status: details.fromStatus || null, to_status: details.toStatus || null, note: details.note || null }),
  ]);
}
async function notify(supabase, accountId, type, title, body, link, actorId, entityId = null) {
  if (!accountId) return;
  const stableEntityId = entityId || `${type}-${accountId}`;
  await createNotificationEvent(supabase, {
    eventType: type,
    entityType: type.startsWith("certificate") ? "certificate" : "learning_record",
    entityId: stableEntityId,
    actorId,
    recipientId: accountId,
    idempotencyKey: `${type}:${stableEntityId}:${accountId}`,
    title,
    body,
    link,
    payload: { certificate_name: title, course_title: title, rejection_reason: body },
  });
}
async function saveAttachment(supabase, body, entity) {
  const evidence = body.evidence || null;
  if (!evidence?.storagePath || !evidence?.fileName || !evidence?.mimeType) return;
  if (!ALLOWED_MIME.has(evidence.mimeType) || Number(evidence.fileSize || 0) > MAX_FILE_SIZE) return;
  await supabase.from("learning_record_attachments").insert({
    learning_record_id: entity.learningRecordId || null,
    certificate_id: entity.certificateId || null,
    file_name: evidence.fileName,
    storage_path: evidence.storagePath,
    mime_type: evidence.mimeType,
    file_size: Number(evidence.fileSize || 0),
    uploaded_by: entity.uploadedBy || null,
  });
}
async function upsertTask(supabase, type, requester, referenceType, referenceId, title, description) {
  const { data: existing } = await supabase.from("hr_tasks")
    .select("id")
    .eq("task_type", type)
    .eq("reference_type", referenceType)
    .eq("reference_id", referenceId)
    .in("status", ["new", "in_progress"])
    .maybeSingle();
  if (existing?.id) return;
  await supabase.from("hr_tasks").insert({
    task_type: type,
    requester_account_id: requester,
    reference_type: referenceType,
    reference_id: referenceId,
    title,
    description,
    priority: "normal",
    status: "new",
  }).then(null, () => {});
}
async function closeTasks(supabase, type, referenceType, referenceId, status, acct) {
  await supabase.from("hr_tasks").update({
    status,
    resolved_by: ["done", "rejected"].includes(status) ? acct.accountId : null,
    resolved_at: ["done", "rejected"].includes(status) ? now() : null,
    updated_at: now(),
  }).eq("task_type", type).eq("reference_type", referenceType).eq("reference_id", referenceId).in("status", ["new", "in_progress"]);
}
function learningPayload(body, accountId, role = "employee", approved = false) {
  return {
    account_id: accountId,
    record_type: clean(body.record_type) || "external_course",
    source_type: role === "hr" ? "hr_entry" : "employee_submission",
    title: clean(body.title),
    category: clean(body.category) || null,
    provider: clean(body.provider) || null,
    delivery_method: clean(body.delivery_method) || null,
    start_date: body.start_date || null,
    completion_date: body.completion_date || null,
    duration_hours: num(body.duration_hours),
    result: clean(body.result) || null,
    description: clean(body.description) || null,
    skills: clean(body.skills) || null,
    status: approved ? "approved" : clean(body.status) === "submitted" ? "submitted" : "draft",
    submitted_by: role === "employee" ? accountId : (body.submitted_by || accountId),
    submitted_at: approved ? now() : (clean(body.status) === "submitted" ? now() : null),
    approved_at: approved ? now() : null,
    created_by_role: role,
    data: { noteToHr: clean(body.note_to_hr), hasCertificate: Boolean(body.has_certificate) },
  };
}
function certPayload(body, accountId, role = "employee", approved = false) {
  return {
    account_id: accountId,
    learning_record_id: body.learning_record_id || null,
    certificate_type: clean(body.certificate_type),
    name: clean(body.certificate_name || body.name),
    certificate_number: clean(body.certificate_number) || null,
    issuer: clean(body.issuer),
    issue_date: body.issued_date || body.issue_date || null,
    expiry_date: body.no_expiry ? null : (body.expiry_date || null),
    no_expiry: Boolean(body.no_expiry),
    score: clean(body.score) || null,
    status: approved ? "valid" : "pending",
    verification_status: approved ? "approved" : (clean(body.verification_status) === "submitted" ? "submitted" : "draft"),
    submitted_by: role === "employee" ? accountId : (body.submitted_by || accountId),
    submitted_at: approved ? now() : (clean(body.verification_status) === "submitted" ? now() : null),
    approved_at: approved ? now() : null,
    created_by: accountId,
    source_type: role === "hr" ? "hr_entry" : "employee_submission",
    notes: clean(body.note_to_hr || body.notes) || null,
    data: { noteToHr: clean(body.note_to_hr) },
  };
}

async function internalOnline(supabase, accountId) {
  const { data } = await supabase.from("enrollments").select("*, course:courses(*)").eq("account_id", accountId).eq("status", "completed").limit(500);
  return (data || []).map((e) => ({
    id: `internal-online-${e.id}`, kind: "internal_online_course", recordType: "internal_online_course", sourceType: "system",
    title: e.course?.data?.title || e.course?.data?.name || e.course_id,
    provider: "KIS", deliveryMethod: "Trực tuyến", startDate: e.created_at?.slice(0, 10),
    completionDate: (e.data?.completedAt || e.updated_at || e.created_at)?.slice(0, 10),
    durationHours: Number(e.course?.data?.durationHours || e.course?.data?.duration || 0),
    result: e.data?.score || e.data?.result || "", status: "approved", verificationStatus: "approved",
  }));
}
async function internalOffline(supabase, accountId) {
  const [participants, regs, attendance] = await Promise.all([
    supabase.from("training_participants").select("*, session:training_sessions(*, course:courses(*))").eq("account_id", accountId).limit(500),
    supabase.from("training_registrations").select("*").eq("account_id", accountId).limit(500),
    supabase.from("attendance").select("*, slot:session_slots(session_id)").eq("account_id", accountId).limit(1000),
  ]);
  const regBySession = new Map((regs.data || []).map((r) => [r.session_id, r]));
  const attended = new Set((attendance.data || []).filter((a) => a.check_in_at || a.status === "present").map((a) => a.slot?.session_id).filter(Boolean));
  return (participants.data || []).filter((p) => {
    const r = regBySession.get(p.session_id);
    const participantStatus = p.data?.status || p.data?.participantStatus;
    const regStatus = r?.data?.status || r?.data?.attendanceStatus;
    return ["confirmed", "completed", "attended", "present"].includes(participantStatus) || ["confirmed", "completed", "attended", "present"].includes(regStatus) || attended.has(p.session_id);
  }).map((p) => {
    const s = p.session || {};
    return {
      id: `internal-offline-${p.id}`, kind: "internal_offline_training", recordType: "internal_offline_training", sourceType: "system",
      title: s.data?.title || s.course?.data?.title || s.course_id || "Lớp đào tạo nội bộ",
      provider: s.data?.provider || "KIS", deliveryMethod: s.data?.deliveryMethod || "Trực tiếp",
      startDate: s.start_at?.slice(0, 10), completionDate: (s.end_at || s.start_at)?.slice(0, 10),
      durationHours: Number(s.data?.durationHours || 0), result: p.data?.result || "", status: "approved", verificationStatus: "approved",
    };
  });
}
async function employeeHistory(request, env) {
  const acct = await requireAuth(request, env);
  if (!acct) return json({ error: "Unauthorized" }, 401);
  const supabase = getSupabase(env);
  const [online, offline, lrRes, certRes] = await Promise.all([
    internalOnline(supabase, acct.accountId),
    internalOffline(supabase, acct.accountId),
    supabase.from("learning_records").select("*").eq("account_id", acct.accountId).order("created_at", { ascending: false }).limit(500),
    supabase.from("employee_certifications").select("*").eq("account_id", acct.accountId).order("created_at", { ascending: false }).limit(500),
  ]);
  if (lrRes.error) return json({ error: lrRes.error.message }, 500);
  if (certRes.error) return json({ error: certRes.error.message }, 500);
  const records = (lrRes.data || []).map(mapLearning);
  const certificates = (certRes.data || []).map(mapCert);
  const confirmedLearning = records.filter((x) => x.status === "approved");
  const verifiedCerts = certificates.filter((x) => x.verificationStatus === "approved");
  const pendingSubmissions = [...records.filter((x) => x.status !== "approved"), ...certificates.filter((x) => x.verificationStatus !== "approved")];
  const items = [...online, ...offline, ...confirmedLearning, ...verifiedCerts].sort((a, b) => String(b.completionDate || b.issuedDate || b.createdAt || "").localeCompare(String(a.completionDate || a.issuedDate || a.createdAt || "")));
  const summary = {
    completedCourses: online.length + offline.length + confirmedLearning.length,
    totalHours: [...online, ...offline, ...confirmedLearning].reduce((s, x) => s + Number(x.durationHours || 0), 0),
    internalTraining: online.length + offline.length,
    externalTraining: confirmedLearning.filter((x) => ["external_course", "self_learning"].includes(x.recordType)).length,
    validCertificates: verifiedCerts.filter((x) => ["valid", "expiring_soon", "no_expiry"].includes(x.status)).length,
    pendingApprovals: pendingSubmissions.filter((x) => ["submitted", "in_review", "needs_revision"].includes(x.status || x.verificationStatus)).length,
  };
  return json({ summary, items, pendingSubmissions, certificates });
}

export async function handleLearningRecords(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();
  const url = new URL(request.url);
  const path = url.pathname;
  const parts = path.split("/").filter(Boolean);
  const supabase = getSupabase(env);

  if (path === "/api/learning-history/me" && method === "GET") return employeeHistory(request, env);

  if (path === "/api/learning-history" && method === "POST") {
    const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
    const body = await readJson(request);
    const payload = learningPayload(body, acct.accountId);
    if (!payload.title) return json({ error: "TITLE_REQUIRED" }, 400);
    const { data, error } = await supabase.from("learning_records").insert(payload).select().single();
    if (error) return json({ error: error.message }, 500);
    await saveAttachment(supabase, body, { learningRecordId: data.id, uploadedBy: acct.accountId });
    await audit(supabase, acct, "learning_record_created", "learning_record", data.id, { toStatus: data.status });
    return json({ record: mapLearning(data) }, 201);
  }

  if (parts[1] === "learning-history" && parts[2] && method === "PATCH") {
    const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
    const recordId = parts[2];
    const { data: existing } = await supabase.from("learning_records").select("*").eq("id", recordId).single();
    if (!existing) return json({ error: "NOT_FOUND" }, 404);
    if (!isHr(acct) && existing.account_id !== acct.accountId) return json({ error: "Forbidden" }, 403);
    if (!isHr(acct) && !EDITABLE_BY_EMPLOYEE.includes(existing.status)) return json({ error: "RECORD_LOCKED" }, 409);
    const body = await readJson(request);
    const patch = learningPayload(body, existing.account_id, isHr(acct) ? "hr" : "employee", false);
    delete patch.account_id; delete patch.source_type; delete patch.submitted_at; delete patch.submitted_by; delete patch.approved_at; delete patch.created_by_role;
    patch.status = existing.status;
    const { data, error } = await supabase.from("learning_records").update(patch).eq("id", recordId).select().single();
    if (error) return json({ error: error.message }, 500);
    await audit(supabase, acct, "learning_record_updated", "learning_record", data.id, { fromStatus: existing.status, toStatus: data.status });
    return json({ record: mapLearning(data) });
  }

  if (parts[1] === "learning-history" && parts[2] && parts[3] === "submit" && method === "POST") {
    const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
    const recordId = parts[2];
    const { data: existing } = await supabase.from("learning_records").select("*").eq("id", recordId).eq("account_id", acct.accountId).single();
    if (!existing) return json({ error: "NOT_FOUND" }, 404);
    if (!EDITABLE_BY_EMPLOYEE.includes(existing.status)) return json({ error: "RECORD_LOCKED" }, 409);
    const { data, error } = await supabase.from("learning_records").update({ status: "submitted", submitted_at: now(), submitted_by: acct.accountId, revision_note: null }).eq("id", recordId).select().single();
    if (error) return json({ error: error.message }, 500);
    await upsertTask(supabase, "external_learning_approval", acct.accountId, "learning_record", recordId, `Duyệt hồ sơ học tập: ${data.title}`, data.provider || "");
    await notify(supabase, acct.accountId, "learning_record_submitted", "Hồ sơ đã được gửi", "HR sẽ kiểm tra hồ sơ học tập của bạn.", "/dashboard/learning-history", acct.accountId, recordId);
    await audit(supabase, acct, "learning_record_submitted", "learning_record", recordId, { fromStatus: existing.status, toStatus: "submitted" });
    return json({ record: mapLearning(data) });
  }

  if (parts[1] === "learning-history" && parts[2] && parts[3] === "withdraw" && method === "POST") {
    const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
    const recordId = parts[2];
    const { data: existing } = await supabase.from("learning_records").select("*").eq("id", recordId).eq("account_id", acct.accountId).single();
    if (!existing) return json({ error: "NOT_FOUND" }, 404);
    if (!["submitted"].includes(existing.status)) return json({ error: "CANNOT_WITHDRAW" }, 409);
    const { data, error } = await supabase.from("learning_records").update({ status: "draft", submitted_at: null }).eq("id", recordId).select().single();
    if (error) return json({ error: error.message }, 500);
    await closeTasks(supabase, "external_learning_approval", "learning_record", recordId, "rejected", acct);
    return json({ record: mapLearning(data) });
  }

  if (path === "/api/certifications/me" && method === "GET") {
    const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
    const { data, error } = await supabase.from("employee_certifications").select("*").eq("account_id", acct.accountId).order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json({ certifications: (data || []).map(mapCert) });
  }

  if (path === "/api/certifications" && method === "POST") {
    const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
    const body = await readJson(request);
    const payload = certPayload(body, acct.accountId);
    if (!payload.name || !payload.certificate_type || !payload.issuer || !payload.issue_date) return json({ error: "MISSING_REQUIRED_FIELDS" }, 400);
    const { data, error } = await supabase.from("employee_certifications").insert(payload).select().single();
    if (error) return json({ error: error.message }, 500);
    await saveAttachment(supabase, body, { certificateId: data.id, uploadedBy: acct.accountId });
    await audit(supabase, acct, "certificate_submitted", "employee_certification", data.id, { toStatus: data.verification_status });
    return json({ certification: mapCert(data) }, 201);
  }

  if (parts[1] === "certifications" && parts[2] && method === "PATCH") {
    const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
    const certId = parts[2];
    const { data: existing } = await supabase.from("employee_certifications").select("*").eq("id", certId).single();
    if (!existing) return json({ error: "NOT_FOUND" }, 404);
    if (!isHr(acct) && existing.account_id !== acct.accountId) return json({ error: "Forbidden" }, 403);
    if (!isHr(acct) && !CERT_EDITABLE_BY_EMPLOYEE.includes(existing.verification_status)) return json({ error: "CERT_LOCKED" }, 409);
    const body = await readJson(request);
    const patch = certPayload(body, existing.account_id, isHr(acct) ? "hr" : "employee", false);
    delete patch.account_id; delete patch.source_type; delete patch.submitted_at; delete patch.submitted_by; delete patch.approved_at; delete patch.created_by;
    patch.verification_status = existing.verification_status;
    patch.status = existing.status;
    const { data, error } = await supabase.from("employee_certifications").update(patch).eq("id", certId).select().single();
    if (error) return json({ error: error.message }, 500);
    return json({ certification: mapCert(data) });
  }

  if (parts[1] === "certifications" && parts[2] && parts[3] === "submit" && method === "POST") {
    const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
    const certId = parts[2];
    const { data: existing } = await supabase.from("employee_certifications").select("*").eq("id", certId).eq("account_id", acct.accountId).single();
    if (!existing) return json({ error: "NOT_FOUND" }, 404);
    if (!CERT_EDITABLE_BY_EMPLOYEE.includes(existing.verification_status)) return json({ error: "CERT_LOCKED" }, 409);
    const { data, error } = await supabase.from("employee_certifications").update({ verification_status: "submitted", submitted_at: now(), submitted_by: acct.accountId, revision_note: null }).eq("id", certId).select().single();
    if (error) return json({ error: error.message }, 500);
    await upsertTask(supabase, "certificate_verification", acct.accountId, "employee_certification", certId, `Xác minh chứng chỉ: ${data.name}`, data.issuer || "");
    await notify(supabase, acct.accountId, "certificate_submitted", "Chứng chỉ đã được gửi", "HR sẽ kiểm tra chứng chỉ của bạn.", "/dashboard/learning-history", acct.accountId, certId);
    await audit(supabase, acct, "certificate_submitted", "employee_certification", certId, { fromStatus: existing.verification_status, toStatus: "submitted" });
    return json({ certification: mapCert(data) });
  }

  if (path === "/api/admin/learning-records/summary" && method === "GET") {
    const acct = await requireHr(request, env); if (!acct) return json({ error: "HR only" }, 403);
    const [records, certs] = await Promise.all([
      supabase.from("learning_records").select("id,status,record_type,source_type", { count: "exact" }).limit(5000),
      supabase.from("employee_certifications").select("id,verification_status,status,expiry_date,no_expiry", { count: "exact" }).limit(5000),
    ]);
    if (records.error || certs.error) return json({ error: records.error?.message || certs.error?.message }, 500);
    const r = records.data || [], c = certs.data || [];
    return json({ summary: {
      totalRecords: records.count || r.length,
      pendingRecords: r.filter((x) => ["submitted", "in_review", "needs_revision"].includes(x.status)).length + c.filter((x) => ["submitted", "in_review", "needs_revision"].includes(x.verification_status)).length,
      approvedExternalCourses: r.filter((x) => x.status === "approved" && x.record_type === "external_course").length,
      totalCertificates: certs.count || c.length,
      expiringCertificates: c.filter((x) => certEffectiveStatus(x) === "expiring_soon").length,
      unverifiedCertificates: c.filter((x) => x.verification_status !== "approved").length,
    }});
  }

  if (path === "/api/admin/learning-records" && method === "GET") {
    const acct = await requireHr(request, env); if (!acct) return json({ error: "HR only" }, 403);
    const { from, to, page, pageSize } = pageParams(url);
    let query = supabase.from("learning_records").select("*, employee:profiles!learning_records_account_id_fkey(id, employee_code, full_name, email, department, position)", { count: "exact" });
    const status = url.searchParams.get("status"); const type = url.searchParams.get("recordType"); const q = url.searchParams.get("q");
    if (status) query = query.eq("status", status);
    if (type) query = query.eq("record_type", type);
    if (q) query = query.or(`title.ilike.%${q}%,provider.ilike.%${q}%`);
    const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
    if (error) return json({ error: error.message }, 500);
    return json({ items: (data || []).map(mapLearning), total: count || 0, page, pageSize });
  }

  if (path === "/api/admin/certifications" && method === "GET") {
    const acct = await requireHr(request, env); if (!acct) return json({ error: "HR only" }, 403);
    const { from, to, page, pageSize } = pageParams(url);
    let query = supabase.from("employee_certifications").select("*", { count: "exact" });
    const status = url.searchParams.get("verificationStatus"); const type = url.searchParams.get("certificateType"); const q = url.searchParams.get("q");
    if (status) query = query.eq("verification_status", status);
    if (type) query = query.eq("certificate_type", type);
    if (q) query = query.or(`name.ilike.%${q}%,issuer.ilike.%${q}%,certificate_number.ilike.%${q}%`);
    const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
    if (error) return json({ error: error.message }, 500);
    const accountIds = [...new Set((data || []).map((row) => row.account_id).filter(Boolean))];
    let profileMap = new Map();
    if (accountIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, employee_code, full_name, email, department, position").in("id", accountIds);
      profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    }
    return json({ items: (data || []).map((row) => mapCert({ ...row, employee: profileMap.get(row.account_id) || null })), total: count || 0, page, pageSize });
  }

  if (path === "/api/admin/learning-records" && method === "POST") {
    const acct = await requireHr(request, env); if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request); const accountId = clean(body.account_id);
    const payload = learningPayload(body, accountId, "hr", true);
    if (!accountId || !payload.title) return json({ error: "MISSING_REQUIRED_FIELDS" }, 400);
    payload.reviewed_by = acct.accountId;
    const { data, error } = await supabase.from("learning_records").insert(payload).select().single();
    if (error) return json({ error: error.message }, 500);
    await saveAttachment(supabase, body, { learningRecordId: data.id, uploadedBy: acct.accountId });
    await notify(supabase, accountId, "learning_record_approved", "Hồ sơ học tập đã được cập nhật", "HR đã thêm hồ sơ học tập vào lịch sử của bạn.", "/dashboard/learning-history", acct.accountId, data.id);
    await audit(supabase, acct, "learning_record_approved", "learning_record", data.id, { toStatus: "approved" });
    return json({ record: mapLearning(data) }, 201);
  }

  if (path === "/api/admin/certifications" && method === "POST") {
    const acct = await requireHr(request, env); if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request); const accountId = clean(body.account_id);
    const payload = certPayload(body, accountId, "hr", true);
    if (!accountId || !payload.name || !payload.issuer || !payload.issue_date) return json({ error: "MISSING_REQUIRED_FIELDS" }, 400);
    payload.reviewed_by = acct.accountId;
    const { data, error } = await supabase.from("employee_certifications").insert(payload).select().single();
    if (error) return json({ error: error.message }, 500);
    await saveAttachment(supabase, body, { certificateId: data.id, uploadedBy: acct.accountId });
    await notify(supabase, accountId, "certificate_approved", "Chứng chỉ đã được cập nhật", "HR đã thêm chứng chỉ vào hồ sơ của bạn.", "/dashboard/learning-history", acct.accountId, data.id);
    await audit(supabase, acct, "certificate_approved", "employee_certification", data.id, { toStatus: "approved" });
    return json({ certification: mapCert(data) }, 201);
  }

  const adminAction = parts[1] === "admin" && ["learning-records", "certifications"].includes(parts[2]) && parts[3] && parts[4];
  if (adminAction && method === "POST") {
    const acct = await requireHr(request, env); if (!acct) return json({ error: "HR only" }, 403);
    const entity = parts[2] === "certifications" ? "cert" : "record";
    const entityId = parts[3]; const action = parts[4]; const body = await readJson(request);
    const table = entity === "cert" ? "employee_certifications" : "learning_records";
    const { data: existing } = await supabase.from(table).select("*").eq("id", entityId).single();
    if (!existing) return json({ error: "NOT_FOUND" }, 404);
    let patch = { reviewed_by: acct.accountId, reviewed_at: now() };
    let auditAction = "";
    if (action === "approve") {
      patch = entity === "cert" ? { ...patch, verification_status: "approved", status: "valid", approved_at: now() } : { ...patch, status: "approved", approved_at: now() };
      auditAction = entity === "cert" ? "certificate_approved" : "learning_record_approved";
    } else if (action === "request-revision") {
      const note = clean(body.note); if (!note) return json({ error: "NOTE_REQUIRED" }, 400);
      patch = entity === "cert" ? { ...patch, verification_status: "needs_revision", revision_note: note } : { ...patch, status: "needs_revision", revision_note: note };
      auditAction = entity === "cert" ? "certificate_revision_requested" : "learning_record_revision_requested";
    } else if (action === "reject") {
      const reason = clean(body.reason); if (!reason) return json({ error: "REASON_REQUIRED" }, 400);
      patch = entity === "cert" ? { ...patch, verification_status: "rejected", rejection_reason: reason } : { ...patch, status: "rejected", rejected_at: now(), rejection_reason: reason };
      auditAction = entity === "cert" ? "certificate_rejected" : "learning_record_rejected";
    } else return json({ error: "INVALID_ACTION" }, 400);
    const { data, error } = await supabase.from(table).update(patch).eq("id", entityId).select().single();
    if (error) return json({ error: error.message }, 500);
    const toStatus = entity === "cert" ? data.verification_status : data.status;
    const fromStatus = entity === "cert" ? existing.verification_status : existing.status;
    const taskType = entity === "cert" ? "certificate_verification" : "external_learning_approval";
    await closeTasks(supabase, taskType, entity === "cert" ? "employee_certification" : "learning_record", entityId, action === "reject" ? "rejected" : action === "request-revision" ? "in_progress" : "done", acct);
    await notify(supabase, data.account_id, auditAction, action === "approve" ? "Hồ sơ đã được phê duyệt" : action === "request-revision" ? "HR yêu cầu bổ sung" : "Hồ sơ đã bị từ chối", clean(body.note || body.reason) || "Vui lòng xem chi tiết trong Lịch sử học tập.", "/dashboard/learning-history", acct.accountId, entityId);
    await audit(supabase, acct, auditAction, entity === "cert" ? "employee_certification" : "learning_record", entityId, { fromStatus, toStatus, note: clean(body.note || body.reason) });
    return json(entity === "cert" ? { certification: mapCert(data) } : { record: mapLearning(data) });
  }

  if (path === "/api/learning-evidence/upload-url" && method === "POST") {
    const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
    const body = await readJson(request);
    const fileName = clean(body.fileName); const mimeType = clean(body.mimeType); const fileSize = Number(body.fileSize || 0);
    if (!fileName || !ALLOWED_MIME.has(mimeType) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) return json({ error: "INVALID_FILE" }, 400);
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${acct.accountId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
    if (error) return json({ error: error.message }, 500);
    return json({ bucket: BUCKET, storagePath, signedUrl: data.signedUrl, token: data.token, maxFileSize: MAX_FILE_SIZE });
  }

  if (parts[1] === "learning-evidence" && parts[2] && parts[3] === "download-url" && method === "GET") {
    const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
    const attachmentId = parts[2];
    const { data: att } = await supabase.from("learning_record_attachments").select("*").eq("id", attachmentId).single();
    if (!att) return json({ error: "NOT_FOUND" }, 404);
    let owner = null;
    if (att.learning_record_id) {
      const { data } = await supabase.from("learning_records").select("account_id").eq("id", att.learning_record_id).single(); owner = data?.account_id;
    } else if (att.certificate_id) {
      const { data } = await supabase.from("employee_certifications").select("account_id").eq("id", att.certificate_id).single(); owner = data?.account_id;
    }
    if (!isHr(acct) && owner !== acct.accountId) return json({ error: "Forbidden" }, 403);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(att.storage_path, 300);
    if (error) return json({ error: error.message }, 500);
    return json({ signedUrl: data.signedUrl, expiresIn: 300 });
  }

  return methodNotAllowed();
}
