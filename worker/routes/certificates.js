import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";
import { createNotificationEvent } from "../services/notificationEngine.js";

const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const BUCKET = "employee-certificates";
const WARNING_DAYS = [60, 30, 15, 7, 0];

function clean(v) { return String(v ?? "").trim(); }
function id(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function todayIso() { return new Date().toISOString().slice(0, 10); }
function isHr(acct) { return ["hr", "admin"].includes(acct?.role); }
function pageParams(url) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "25", 10)));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}
function safeFilename(fileName) {
  return clean(fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "certificate";
}
function validityStatus(row) {
  if (row.status === "revoked" || row.verification_status === "revoked") return "revoked";
  if (row.status === "superseded") return "superseded";
  if (row.verification_status === "rejected") return "rejected";
  if (!["approved", "verified"].includes(row.verification_status)) return "pending_verification";
  if (row.no_expiry || !row.expiry_date) return "valid";
  const today = todayIso();
  if (row.expiry_date < today) return "expired";
  const diff = Math.ceil((new Date(`${row.expiry_date}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000);
  const warning = Number(row.type?.default_warning_days || row.data?.warningDays || 60);
  return diff <= warning ? "expiring_soon" : "valid";
}
function daysUntil(row) {
  if (row.no_expiry || !row.expiry_date) return null;
  return Math.ceil((new Date(`${row.expiry_date}T00:00:00Z`) - new Date(`${todayIso()}T00:00:00Z`)) / 86400000);
}
function mapProfile(row) {
  return row ? { id: row.id, employeeCode: row.employee_code || "", fullName: row.full_name || "", email: row.email || "", department: row.department || "", position: row.position || "", accountStatus: row.account_status || "" } : null;
}
function mapType(row) {
  return row ? {
    id: row.id, code: row.code, name: row.name, description: row.description || "", issuerName: row.issuer_name || "",
    category: row.category || "", hasExpiration: row.has_expiration !== false,
    defaultValidityMonths: row.default_validity_months, defaultWarningDays: row.default_warning_days ?? 60,
    requiresVerification: row.requires_verification !== false, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at,
  } : null;
}
function mapRequirement(row) {
  return row ? {
    id: row.id, certificateTypeId: row.certificate_type_id, certificateType: mapType(row.certificate_type),
    targetType: row.target_type, targetValue: row.target_value || "", isRequired: row.is_required !== false,
    effectiveFrom: row.effective_from, effectiveUntil: row.effective_until || "",
    createdAt: row.created_at, updatedAt: row.updated_at,
  } : null;
}
function mapCert(row) {
  const type = mapType(row.type);
  const status = validityStatus({ ...row, type: row.type });
  return {
    id: row.id,
    employeeId: row.account_id,
    employee: mapProfile(row.employee),
    certificateTypeId: row.certificate_type_id || "",
    certificateType: type,
    certificateTypeName: type?.name || row.certificate_type || "",
    certificateName: row.name || type?.name || row.certificate_type || "",
    certificateNumber: row.certificate_number || "",
    issuer: row.issuer || type?.issuerName || "",
    issuedAt: row.issue_date || "",
    expiresAt: row.expiry_date || "",
    noExpiration: Boolean(row.no_expiry || !row.expiry_date),
    status,
    rawStatus: row.status || "",
    verificationStatus: row.verification_status === "approved" ? "verified" : (row.verification_status || "pending"),
    daysUntilExpiry: daysUntil(row),
    storageBucket: row.storage_bucket || "",
    hasFile: Boolean(row.storage_path || row.evidence_path || row.attachments?.length),
    originalFileName: row.original_file_name || row.attachments?.[0]?.file_name || "",
    submittedBy: row.submitted_by || "",
    submittedAt: row.submitted_at || row.created_at,
    verifiedBy: row.verified_by || row.reviewed_by || "",
    verifiedAt: row.verified_at || row.reviewed_at || row.approved_at || "",
    rejectionReason: row.rejection_reason || "",
    revisionNote: row.revision_note || "",
    supersedesCertificateId: row.supersedes_certificate_id || "",
    renewalGroupId: row.renewal_group_id || row.id,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
async function notify(supabase, accountId, type, title, body, link, actorId, entityId = null) {
  if (!accountId) return;
  const stableEntityId = entityId || `${type}-${accountId}`;
  await createNotificationEvent(supabase, {
    eventType: type,
    entityType: "certificate",
    entityId: stableEntityId,
    actorId,
    recipientId: accountId,
    idempotencyKey: `${type}:${stableEntityId}:${accountId}`,
    title,
    body,
    link,
    payload: { certificate_name: title, rejection_reason: body },
  }).then(null, () => {});
}
async function audit(supabase, acct, action, certId, details = {}) {
  await Promise.allSettled([
    supabase.from("audit_logs").insert({ actor_id: acct?.accountId || null, action, target_type: "employee_certification", target_id: certId, result: "success", details }),
    supabase.from("approval_events").insert({ entity_type: "certificate", entity_id: certId, actor_account_id: acct?.accountId || null, action, from_status: details.fromStatus || null, to_status: details.toStatus || null, note: details.note || null }),
  ]);
}
async function getCertificate(supabase, certId) {
  const { data, error } = await supabase.from("employee_certifications")
    .select("*, type:certificate_types(*)")
    .eq("id", certId).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!data) return null;
  const { data: employee } = await supabase.from("profiles")
    .select("id, employee_code, full_name, email, department, position, account_status")
    .eq("id", data.account_id).maybeSingle();
  return { ...data, employee: employee || null };
}
function certPayload(body, employeeId, acct, existing = null) {
  const typeId = clean(body.certificate_type_id);
  const typeName = clean(body.certificate_type || body.certificateType || body.certificateTypeName);
  const name = clean(body.certificate_name || body.name || typeName);
  const issuer = clean(body.issuer);
  const issued = body.issued_at || body.issued_date || body.issue_date || null;
  const expires = body.no_expiry || body.noExpiration ? null : (body.expires_at || body.expiry_date || null);
  if (!name && !typeId) throw Object.assign(new Error("CERTIFICATE_TYPE_NOT_FOUND"), { status: 400, code: "CERTIFICATE_TYPE_NOT_FOUND" });
  if (!issuer) throw Object.assign(new Error("MISSING_REQUIRED_FIELDS"), { status: 400, code: "MISSING_REQUIRED_FIELDS" });
  if (!issued) throw Object.assign(new Error("INVALID_DATE_RANGE"), { status: 400, code: "INVALID_DATE_RANGE" });
  if (expires && expires < issued) throw Object.assign(new Error("INVALID_DATE_RANGE"), { status: 400, code: "INVALID_DATE_RANGE" });
  const evidence = body.evidence || {};
  return {
    account_id: employeeId,
    certificate_type_id: typeId || null,
    certificate_type: typeName || name,
    name: name || typeName,
    certificate_number: clean(body.certificate_number || body.certificateNumber) || null,
    issuer,
    issue_date: issued,
    expiry_date: expires,
    no_expiry: !expires,
    status: "pending",
    verification_status: "submitted",
    submitted_by: acct.accountId,
    submitted_at: new Date().toISOString(),
    source_type: isHr(acct) ? "hr_entry" : "employee_submission",
    notes: clean(body.notes || body.note_to_hr) || null,
    storage_bucket: evidence.bucket || body.storage_bucket || existing?.storage_bucket || null,
    storage_path: evidence.storagePath || body.storage_path || existing?.storage_path || null,
    original_file_name: evidence.fileName || body.original_file_name || existing?.original_file_name || null,
    mime_type: evidence.mimeType || body.mime_type || existing?.mime_type || null,
    file_size_bytes: evidence.fileSize || body.file_size_bytes || existing?.file_size_bytes || null,
    data: { ...(existing?.data || {}), noteToHr: clean(body.note_to_hr), phase4: true },
  };
}
async function ensureNoDuplicatePending(supabase, payload) {
  if (!payload.certificate_number) return;
  let query = supabase.from("employee_certifications")
    .select("id")
    .eq("account_id", payload.account_id)
    .eq("certificate_number", payload.certificate_number)
    .in("verification_status", ["submitted", "pending", "in_review"])
    .limit(1);
  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (data?.length) throw Object.assign(new Error("CERTIFICATE_DUPLICATE_PENDING"), { status: 409, code: "CERTIFICATE_DUPLICATE_PENDING" });
}
async function activeEmployees(supabase) {
  const { data, error } = await supabase.from("profiles")
    .select("id, employee_code, full_name, email, department, position, account_status, role")
    .eq("role", "employee")
    .in("account_status", ["active", "pending", "locked", "pendingActivation"])
    .limit(5000);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data || [];
}
function requirementApplies(req, employee) {
  if (req.target_type === "all_employees") return true;
  if (req.target_type === "department") return employee.department === req.target_value;
  if (req.target_type === "job_title") return employee.position === req.target_value;
  if (req.target_type === "individual") return employee.id === req.target_value;
  return false;
}
function requirementStatus(req, employee, certs) {
  const own = certs.filter((c) => c.account_id === employee.id && (c.certificate_type_id === req.certificate_type_id || (!c.certificate_type_id && c.certificate_type === req.certificate_type?.name)));
  const mapped = own.map((c) => ({ ...c, type: req.certificate_type }));
  if (mapped.some((c) => ["valid", "expiring_soon"].includes(validityStatus(c)))) {
    return mapped.some((c) => validityStatus(c) === "expiring_soon") ? "expiring_soon" : "satisfied";
  }
  if (mapped.some((c) => validityStatus(c) === "pending_verification")) return "pending_verification";
  if (mapped.some((c) => validityStatus(c) === "expired")) return "expired";
  return "missing";
}

export async function handleCertificates(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();
  const url = new URL(request.url);
  const path = url.pathname;
  const parts = path.split("/").filter(Boolean);
  const supabase = getSupabase(env);

  try {
    if (path === "/api/certificates/my" && method === "GET") {
      const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
      const { data, error } = await supabase.from("employee_certifications")
        .select("*, type:certificate_types(*)")
        .eq("account_id", acct.accountId).order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ data: (data || []).map(mapCert), alertThresholds: WARNING_DAYS });
    }

    if (parts[1] === "certificates" && parts[2] === "my" && parts[3] && method === "GET") {
      const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
      const cert = await getCertificate(supabase, parts[3]);
      if (!cert) return json({ error: "CERTIFICATE_NOT_FOUND" }, 404);
      if (cert.account_id !== acct.accountId) return json({ error: "FORBIDDEN" }, 403);
      const { data: history } = await supabase.from("employee_certifications").select("*, type:certificate_types(*)").eq("renewal_group_id", cert.renewal_group_id || cert.id).order("created_at", { ascending: false });
      return json({ data: mapCert(cert), history: (history || []).map(mapCert) });
    }

    if (path === "/api/certificates/my/upload" && method === "POST") {
      const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
      const body = await readJson(request);
      const fileName = safeFilename(body.fileName);
      const mimeType = clean(body.mimeType);
      const fileSize = Number(body.fileSize || 0);
      if (!ALLOWED_MIME.has(mimeType)) return json({ error: "UNSUPPORTED_FILE_TYPE" }, 400);
      if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) return json({ error: "FILE_TOO_LARGE" }, 400);
      const storagePath = `${acct.accountId}/pending/${Date.now()}-${crypto.randomUUID()}-${fileName}`;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
      if (error) return json({ error: error.message }, 500);
      return json({ bucket: BUCKET, storagePath, signedUrl: data.signedUrl, token: data.token, maxFileSize: MAX_FILE_SIZE });
    }

    if (path === "/api/certificates/my/upload" && method === "PUT") {
      const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
      const body = await readJson(request);
      const payload = certPayload(body, acct.accountId, acct);
      await ensureNoDuplicatePending(supabase, payload);
      const { data, error } = await supabase.from("employee_certifications").insert(payload).select().single();
      if (error) return json({ error: error.message }, 500);
      await audit(supabase, acct, "certificate_submitted", data.id, { toStatus: data.verification_status });
      await notify(supabase, acct.accountId, "certificate_submitted", "Chứng chỉ đã được gửi", "HR sẽ kiểm tra chứng chỉ của bạn.", "/dashboard/certificates", acct.accountId, data.id);
      return json({ data: mapCert(data) }, 201);
    }

    if (parts[1] === "certificates" && parts[2] === "my" && parts[3] && parts[4] === "renew" && method === "POST") {
      const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
      const existing = await getCertificate(supabase, parts[3]);
      if (!existing) return json({ error: "CERTIFICATE_NOT_FOUND" }, 404);
      if (existing.account_id !== acct.accountId) return json({ error: "FORBIDDEN" }, 403);
      const body = await readJson(request);
      const payload = {
        ...certPayload(body, acct.accountId, acct, existing),
        supersedes_certificate_id: existing.id,
        renewal_group_id: existing.renewal_group_id || existing.id,
      };
      await ensureNoDuplicatePending(supabase, payload);
      const { data, error } = await supabase.from("employee_certifications").insert(payload).select().single();
      if (error) return json({ error: error.message }, 500);
      await audit(supabase, acct, "certificate_submitted", data.id, { fromStatus: existing.verification_status, toStatus: data.verification_status, renewal: true });
      return json({ data: mapCert(data) }, 201);
    }

    if (parts[1] === "certificates" && parts[2] === "my" && parts[3] && parts[4] === "signed-url" && method === "POST") {
      const acct = await requireAuth(request, env); if (!acct) return json({ error: "Unauthorized" }, 401);
      const cert = await getCertificate(supabase, parts[3]);
      if (!cert) return json({ error: "CERTIFICATE_NOT_FOUND" }, 404);
      if (cert.account_id !== acct.accountId) return json({ error: "FORBIDDEN" }, 403);
      if (!cert.storage_path) return json({ error: "UPLOAD_NOT_FOUND" }, 404);
      const { data, error } = await supabase.storage.from(cert.storage_bucket || BUCKET).createSignedUrl(cert.storage_path, 300);
      if (error) return json({ error: error.message }, 500);
      return json({ signedUrl: data.signedUrl, expiresIn: 300 });
    }

    if (path === "/api/admin/certificates/overview" && method === "GET") {
      const acct = await requireHr(request, env); if (!acct) return json({ error: "HR_ONLY" }, 403);
      const [certs, reqs, employees] = await Promise.all([
        supabase.from("employee_certifications").select("*, type:certificate_types(*)").limit(5000),
        supabase.from("certificate_requirements").select("*, certificate_type:certificate_types(*)").eq("is_required", true).limit(1000),
        activeEmployees(supabase),
      ]);
      if (certs.error || reqs.error) return json({ error: certs.error?.message || reqs.error?.message }, 500);
      const rows = certs.data || [];
      const counts = { pending: 0, valid: 0, expiringSoon: 0, expired: 0, rejectedOrRevoked: 0, missingRequired: 0 };
      rows.forEach((row) => {
        const st = validityStatus(row);
        if (st === "pending_verification") counts.pending += 1;
        if (st === "valid") counts.valid += 1;
        if (st === "expiring_soon") counts.expiringSoon += 1;
        if (st === "expired") counts.expired += 1;
        if (["rejected", "revoked"].includes(st)) counts.rejectedOrRevoked += 1;
      });
      const missing = [];
      for (const req of reqs.data || []) {
        for (const emp of employees) {
          if (requirementApplies(req, emp) && requirementStatus(req, emp, rows) === "missing") missing.push(`${emp.id}:${req.certificate_type_id}`);
        }
      }
      counts.missingRequired = new Set(missing).size;
      return json({ data: counts, alertThresholds: WARNING_DAYS });
    }

    if (path === "/api/admin/certificates/types" && method === "GET") {
      const acct = await requireHr(request, env); if (!acct) return json({ error: "HR_ONLY" }, 403);
      const { data, error } = await supabase.from("certificate_types").select("*").order("name");
      if (error) return json({ error: error.message }, 500);
      return json({ data: (data || []).map(mapType) });
    }

    if (path === "/api/admin/certificates/types" && method === "POST") {
      const acct = await requireHr(request, env); if (!acct) return json({ error: "HR_ONLY" }, 403);
      const body = await readJson(request);
      const name = clean(body.name);
      const code = clean(body.code) || name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      if (!name || !code) return json({ error: "MISSING_REQUIRED_FIELDS" }, 400);
      const row = {
        code, name, description: clean(body.description) || null, issuer_name: clean(body.issuer_name || body.issuerName) || null,
        category: clean(body.category) || null, has_expiration: body.has_expiration ?? body.hasExpiration ?? true,
        default_validity_months: body.default_validity_months || body.defaultValidityMonths || null,
        default_warning_days: Number(body.default_warning_days || body.defaultWarningDays || 60),
        requires_verification: body.requires_verification ?? body.requiresVerification ?? true,
        status: clean(body.status) || "active", created_by: acct.accountId,
      };
      const { data, error } = await supabase.from("certificate_types").insert(row).select().single();
      if (error) return json({ error: error.message }, 500);
      return json({ data: mapType(data) }, 201);
    }

    if (parts[1] === "admin" && parts[2] === "certificates" && parts[3] === "types" && parts[4] && method === "PATCH") {
      const acct = await requireHr(request, env); if (!acct) return json({ error: "HR_ONLY" }, 403);
      const body = await readJson(request);
      const patch = {};
      ["code", "name", "description", "category", "status"].forEach((k) => { if (body[k] !== undefined) patch[k] = clean(body[k]); });
      if (body.issuerName !== undefined || body.issuer_name !== undefined) patch.issuer_name = clean(body.issuerName || body.issuer_name) || null;
      if (body.hasExpiration !== undefined || body.has_expiration !== undefined) patch.has_expiration = body.hasExpiration ?? body.has_expiration;
      if (body.defaultValidityMonths !== undefined || body.default_validity_months !== undefined) patch.default_validity_months = body.defaultValidityMonths || body.default_validity_months || null;
      if (body.defaultWarningDays !== undefined || body.default_warning_days !== undefined) patch.default_warning_days = Number(body.defaultWarningDays || body.default_warning_days || 60);
      if (body.requiresVerification !== undefined || body.requires_verification !== undefined) patch.requires_verification = body.requiresVerification ?? body.requires_verification;
      const { data, error } = await supabase.from("certificate_types").update(patch).eq("id", parts[4]).select().single();
      if (error) return json({ error: error.message }, 500);
      return json({ data: mapType(data) });
    }

    if (parts[1] === "admin" && parts[2] === "certificates" && parts[3] === "types" && parts[4] && parts[5] === "archive" && method === "POST") {
      const acct = await requireHr(request, env); if (!acct) return json({ error: "HR_ONLY" }, 403);
      const { data, error } = await supabase.from("certificate_types").update({ status: "archived" }).eq("id", parts[4]).select().single();
      if (error) return json({ error: error.message }, 500);
      return json({ data: mapType(data) });
    }

    if (path === "/api/admin/certificates" && method === "GET") {
      const acct = await requireHr(request, env); if (!acct) return json({ error: "HR_ONLY" }, 403);
      const { from, to, page, pageSize } = pageParams(url);
      let query = supabase.from("employee_certifications")
        .select("*, type:certificate_types(*)", { count: "exact" });
      const verification = url.searchParams.get("verificationStatus");
      const typeId = url.searchParams.get("certificateTypeId");
      const q = url.searchParams.get("q");
      if (verification) query = query.eq("verification_status", verification === "verified" ? "approved" : verification);
      if (typeId) query = query.eq("certificate_type_id", typeId);
      if (q) query = query.or(`name.ilike.%${q}%,issuer.ilike.%${q}%,certificate_number.ilike.%${q}%,certificate_type.ilike.%${q}%`);
      const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
      if (error) return json({ error: error.message }, 500);
      const employeeIds = [...new Set((data || []).map((row) => row.account_id).filter(Boolean))];
      let employeeMap = new Map();
      if (employeeIds.length) {
        const { data: employees } = await supabase.from("profiles")
          .select("id, employee_code, full_name, email, department, position, account_status")
          .in("id", employeeIds);
        employeeMap = new Map((employees || []).map((row) => [row.id, row]));
      }
      return json({ data: (data || []).map((row) => mapCert({ ...row, employee: employeeMap.get(row.account_id) || null })), total: count || 0, page, pageSize });
    }

    if (path === "/api/admin/certificates/requirements" && method === "GET") {
      const acct = await requireHr(request, env); if (!acct) return json({ error: "HR_ONLY" }, 403);
      const { data, error } = await supabase.from("certificate_requirements").select("*, certificate_type:certificate_types(*)").order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ data: (data || []).map(mapRequirement) });
    }

    if (path === "/api/admin/certificates/requirements" && method === "POST") {
      const acct = await requireHr(request, env); if (!acct) return json({ error: "HR_ONLY" }, 403);
      const body = await readJson(request);
      const row = {
        certificate_type_id: clean(body.certificate_type_id || body.certificateTypeId),
        target_type: clean(body.target_type || body.targetType),
        target_value: clean(body.target_value || body.targetValue) || null,
        is_required: body.is_required ?? body.isRequired ?? true,
        effective_from: body.effective_from || body.effectiveFrom || todayIso(),
        effective_until: body.effective_until || body.effectiveUntil || null,
        created_by: acct.accountId,
      };
      if (!row.certificate_type_id || !row.target_type) return json({ error: "MISSING_REQUIRED_FIELDS" }, 400);
      const { data, error } = await supabase.from("certificate_requirements").insert(row).select("*, certificate_type:certificate_types(*)").single();
      if (error) return json({ error: error.message }, 500);
      return json({ data: mapRequirement(data) }, 201);
    }

    if (parts[1] === "admin" && parts[2] === "certificates" && parts[3] === "requirements" && parts[4] && method === "DELETE") {
      const acct = await requireHr(request, env); if (!acct) return json({ error: "HR_ONLY" }, 403);
      const { error } = await supabase.from("certificate_requirements").update({ is_required: false }).eq("id", parts[4]);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if ((path === "/api/admin/certificates/missing" || path === "/api/admin/certificates/expiring") && method === "GET") {
      const acct = await requireHr(request, env); if (!acct) return json({ error: "HR_ONLY" }, 403);
      const [certs, reqs, employees] = await Promise.all([
        supabase.from("employee_certifications").select("*, type:certificate_types(*)").limit(5000),
        supabase.from("certificate_requirements").select("*, certificate_type:certificate_types(*)").eq("is_required", true).limit(1000),
        activeEmployees(supabase),
      ]);
      if (certs.error || reqs.error) return json({ error: certs.error?.message || reqs.error?.message }, 500);
      if (path.endsWith("/expiring")) {
        return json({ data: (certs.data || []).filter((c) => ["expiring_soon", "expired"].includes(validityStatus(c))).map(mapCert) });
      }
      const missing = [];
      for (const req of reqs.data || []) for (const emp of employees) {
        if (!requirementApplies(req, emp)) continue;
        const status = requirementStatus(req, emp, certs.data || []);
        if (["missing", "expired", "pending_verification"].includes(status)) missing.push({ employee: mapProfile(emp), requirement: mapRequirement(req), status });
      }
      return json({ data: missing });
    }

    if (parts[1] === "admin" && parts[2] === "certificates" && parts[3] && !parts[4] && method === "GET") {
      const acct = await requireHr(request, env); if (!acct) return json({ error: "HR_ONLY" }, 403);
      const cert = await getCertificate(supabase, parts[3]);
      if (!cert) return json({ error: "CERTIFICATE_NOT_FOUND" }, 404);
      const { data: history } = await supabase.from("employee_certifications").select("*, type:certificate_types(*)").eq("renewal_group_id", cert.renewal_group_id || cert.id).order("created_at", { ascending: false });
      const { data: events } = await supabase.from("approval_events").select("*").eq("entity_type", "certificate").eq("entity_id", parts[3]).order("created_at", { ascending: true });
      return json({ data: mapCert(cert), history: (history || []).map(mapCert), events: events || [] });
    }

    const adminAction = parts[1] === "admin" && parts[2] === "certificates" && parts[3] && ["verify", "reject", "revoke", "signed-url"].includes(parts[4]);
    if (adminAction && method === "POST") {
      const acct = await requireHr(request, env); if (!acct) return json({ error: "HR_ONLY" }, 403);
      const cert = await getCertificate(supabase, parts[3]);
      if (!cert) return json({ error: "CERTIFICATE_NOT_FOUND" }, 404);
      if (parts[4] === "signed-url") {
        if (!cert.storage_path) return json({ error: "UPLOAD_NOT_FOUND" }, 404);
        const { data, error } = await supabase.storage.from(cert.storage_bucket || BUCKET).createSignedUrl(cert.storage_path, 300);
        if (error) return json({ error: error.message }, 500);
        return json({ signedUrl: data.signedUrl, expiresIn: 300 });
      }
      const body = await readJson(request);
      let patch = { reviewed_by: acct.accountId, reviewed_at: new Date().toISOString(), verified_by: acct.accountId, verified_at: new Date().toISOString() };
      let action = "";
      if (parts[4] === "verify") {
        patch = { ...patch, verification_status: "approved", status: "valid", approved_at: new Date().toISOString(), rejection_reason: null, revision_note: null };
        action = "certificate_verified";
      } else if (parts[4] === "reject") {
        const reason = clean(body.reason); if (!reason) return json({ error: "REJECTION_REASON_REQUIRED" }, 400);
        patch = { reviewed_by: acct.accountId, reviewed_at: new Date().toISOString(), verification_status: "rejected", status: "pending", rejection_reason: reason };
        action = "certificate_rejected";
      } else {
        const reason = clean(body.reason); if (!reason) return json({ error: "VERIFICATION_REASON_REQUIRED" }, 400);
        patch = { ...patch, verification_status: "revoked", status: "revoked", rejection_reason: reason, revoked_at: new Date().toISOString(), revoked_by: acct.accountId };
        action = "certificate_revoked";
      }
      const { data, error } = await supabase.from("employee_certifications").update(patch).eq("id", cert.id).select().single();
      if (error) return json({ error: error.message }, 500);
      if (parts[4] === "verify" && cert.supersedes_certificate_id) {
        await supabase.from("employee_certifications").update({ status: "superseded" }).eq("id", cert.supersedes_certificate_id);
      }
      await audit(supabase, acct, action, cert.id, { fromStatus: cert.verification_status, toStatus: data.verification_status, note: clean(body.reason) });
      await notify(supabase, data.account_id, action, parts[4] === "verify" ? "Chứng chỉ đã được xác minh" : parts[4] === "reject" ? "Chứng chỉ bị từ chối" : "Chứng chỉ đã bị thu hồi", clean(body.reason) || "Vui lòng xem chi tiết trong Chứng chỉ của tôi.", "/dashboard/certificates", acct.accountId, data.id);
      return json({ data: mapCert(data) });
    }

    return methodNotAllowed();
  } catch (error) {
    return json({ error: error.code || error.message || "INTERNAL_ERROR" }, error.status || 500);
  }
}
