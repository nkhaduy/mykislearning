import { createNotificationEvent } from "./notificationEngine.js";
import { writeAuditLog } from "./audit-service.js";
import { getSupabase } from "./supabase.js";
import { REPORT_LIMITS } from "./reporting.js";

const EXPORT_POLICY_VERSION = "reports-export-v3-no-mfa";
const QUEUE_MESSAGE_VERSION = 2;
const EXPORT_CHUNK = 500;
const MAX_PART_BYTES = 5 * 1024 * 1024;

const commonColumns = [
  ["employee", "Employee"], ["employeeCode", "Employee code"], ["department", "Department"],
];

export const EXPORT_REGISTRY = Object.freeze({
  employees: { rpcType: "employees", roles: ["hr"], columns: [...commonColumns, ["jobTitle", "Job title"], ["assigned", "Assigned"], ["completed", "Completed"], ["inProgress", "In progress"], ["notStarted", "Not started"], ["overdue", "Overdue"], ["completionRate", "Completion rate"], ["lastActivityAt", "Last activity"]] },
  "course-completion": { rpcType: "course-completion", roles: ["hr"], columns: [...commonColumns, ["course", "Course"], ["status", "Status"], ["progress", "Progress"], ["dueAt", "Due date"], ["updatedAt", "Updated"]] },
  enrollments: { rpcType: "enrollments", roles: ["hr"], columns: [...commonColumns, ["course", "Course"], ["status", "Status"], ["progress", "Progress"], ["dueAt", "Due date"], ["updatedAt", "Updated"]] },
  attendance: { rpcType: "attendance", roles: ["hr"], columns: [...commonColumns, ["session", "Session"], ["status", "Status"], ["checkInAt", "Check in"], ["checkOutAt", "Check out"], ["startAt", "Session start"]] },
  "quiz-results": { rpcType: "quiz-results", roles: ["hr"], columns: [...commonColumns, ["quiz", "Quiz"], ["score", "Score"], ["passed", "Passed"], ["submittedAt", "Submitted"]] },
  "learning-records": { rpcType: "learning-records", roles: ["hr"], columns: [...commonColumns, ["title", "Title"], ["recordType", "Record type"], ["status", "Status"], ["completionDate", "Completion date"], ["durationHours", "Learning hours"]] },
  certificates: { rpcType: "certificates", roles: ["hr"], columns: [...commonColumns, ["certificateType", "Certificate type"], ["status", "Status"], ["verificationStatus", "Verification"], ["issueDate", "Issue date"], ["expiresAt", "Expiry date"]] },
  compliance: { rpcType: "compliance", roles: ["hr"], columns: [...commonColumns, ["program", "Program"], ["cycle", "Cycle"], ["status", "Status"], ["progress", "Progress"], ["dueAt", "Due date"], ["completedAt", "Completed"]] },
});

export const EXPORT_FORMAT_LIMITS = Object.freeze({
  csv: { maxRows: 1_000_000, retentionHours: 24, contentType: "text/csv; charset=utf-8" },
  xlsx: { maxRows: 10_000, retentionHours: 24, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pdf: { maxRows: REPORT_LIMITS.pdfRows, retentionHours: 12, contentType: "application/pdf" },
});

function binding(env, name) {
  if (!env?.[name]) throw Object.assign(new Error(`${name}_MISSING`), { status: 503, code: `${name}_MISSING` });
  return env[name];
}

function cleanText(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

function safeIdempotencyKey(value) {
  const key = cleanText(value, 180);
  if (!/^[a-zA-Z0-9._:-]{8,180}$/.test(key)) throw Object.assign(new Error("INVALID_IDEMPOTENCY_KEY"), { status: 400, code: "INVALID_IDEMPOTENCY_KEY" });
  return key;
}

function exportPolicy(reportType, format) {
  const report = EXPORT_REGISTRY[cleanText(reportType, 40)];
  if (!report) throw Object.assign(new Error("ASYNC_EXPORT_TYPE_UNSUPPORTED"), { status: 400, code: "ASYNC_EXPORT_TYPE_UNSUPPORTED" });
  const normalizedFormat = cleanText(format, 8).toLowerCase();
  const formatPolicy = EXPORT_FORMAT_LIMITS[normalizedFormat];
  if (!formatPolicy) throw Object.assign(new Error("ASYNC_EXPORT_FORMAT_UNSUPPORTED"), { status: 400, code: "ASYNC_EXPORT_FORMAT_UNSUPPORTED" });
  return { report, format: normalizedFormat, formatPolicy };
}

export function sanitizeExportParameters(filters) {
  return {
    fromDate: cleanText(filters.fromDate, 10), toDate: cleanText(filters.toDate, 10),
    fromIso: cleanText(filters.fromIso, 32), toIsoExclusive: cleanText(filters.toIsoExclusive, 32),
    department: cleanText(filters.department), jobTitle: cleanText(filters.jobTitle), employeeId: cleanText(filters.employeeId),
    courseId: cleanText(filters.courseId), status: cleanText(filters.status, 40), q: cleanText(filters.q, 80), sortDir: filters.sortDir === "desc" ? "desc" : "asc",
  };
}

function rpc(supabase, fn, args) {
  return supabase.rpc(fn, args);
}

export function validateExportBinding(env) {
  binding(env, "REPORT_EXPORT_QUEUE");
  binding(env, "REPORT_EXPORT_BUCKET");
}

export async function createExportJob({ supabase, queue, env, account, request, reportType, format, filters, idempotencyKey }) {
  validateExportBinding(env);
  const policy = exportPolicy(reportType, format);
  if (!policy.report.roles.includes(account.role)) throw Object.assign(new Error("EXPORT_PERMISSION_DENIED"), { status: 403, code: "EXPORT_PERMISSION_DENIED" });
  const key = safeIdempotencyKey(idempotencyKey);
  const parameters = sanitizeExportParameters(filters);
  const expiresAt = new Date(Date.now() + policy.formatPolicy.retentionHours * 3600_000).toISOString();
  const { data, error } = await rpc(supabase, "service_create_export_job", {
    p_id: crypto.randomUUID(), p_requester_id: account.accountId, p_report_type: reportType, p_format: policy.format,
    p_parameters: parameters, p_permission_snapshot: { role: account.role, policyVersion: EXPORT_POLICY_VERSION },
    p_policy_version: EXPORT_POLICY_VERSION, p_idempotency_key: key, p_expires_at: expiresAt,
  });
  if (error || !data?.id) throw Object.assign(new Error("EXPORT_JOB_CREATE_FAILED"), { status: 503, code: "EXPORT_JOB_CREATE_FAILED" });
  if (data.created) await queue.send({ version: QUEUE_MESSAGE_VERSION, kind: "report_export", jobId: data.id });
  await writeAuditLog(supabase, request, { actor: account, action: "report.export_job_created", entityType: "export_job", entityId: data.id, entityDisplayName: reportType, metadata: { report_type: reportType, format: policy.format, idempotent: !data.created } }, { critical: true });
  return data;
}

export async function getExportJob(supabase, account, jobId) {
  const { data, error } = await rpc(supabase, "service_get_export_job", { p_job_id: jobId, p_requester_id: account.accountId, p_is_admin: account.role === "hr" });
  if (error) throw Object.assign(new Error("EXPORT_JOB_READ_FAILED"), { status: 503, code: "EXPORT_JOB_READ_FAILED" });
  return data || null;
}

export async function cancelExportJob({ supabase, account, request, jobId }) {
  const { data, error } = await rpc(supabase, "service_cancel_export_job", { p_job_id: jobId, p_requester_id: account.accountId, p_is_admin: account.role === "hr" });
  if (error) throw Object.assign(new Error("EXPORT_JOB_CANCEL_FAILED"), { status: 503, code: "EXPORT_JOB_CANCEL_FAILED" });
  if (!data) return null;
  await writeAuditLog(supabase, request, { actor: account, action: "report.export_job_cancelled", entityType: "export_job", entityId: jobId }, { critical: true });
  return data;
}

export async function getExportDownload(supabase, account, jobId) {
  const { data, error } = await rpc(supabase, "service_get_export_download", { p_job_id: jobId, p_requester_id: account.accountId, p_is_admin: account.role === "hr" });
  if (error) throw Object.assign(new Error("EXPORT_DOWNLOAD_LOOKUP_FAILED"), { status: 503, code: "EXPORT_DOWNLOAD_LOOKUP_FAILED" });
  return data || null;
}

async function authorizeRequester(supabase, job, policy) {
  const { data, error } = await rpc(supabase, "service_authorize_export_requester", { p_requester_id: job.requester_id });
  if (error || !data?.active || !policy.report.roles.includes(data.role)) throw new Error("EXPORT_PERMISSION_REVOKED");
  return data;
}

async function* reportRows(supabase, job, policy, leaseToken) {
  let position = null;
  let processed = 0;
  for (;;) {
    const parameters = job.parameters || {};
    const { data, error } = await rpc(supabase, "service_report_detail_export", {
      p_report_type: policy.report.rpcType, p_from: parameters.fromIso, p_to: parameters.toIsoExclusive,
      p_department: parameters.department || "", p_job_title: parameters.jobTitle || "", p_employee_id: parameters.employeeId || "",
      p_course_id: parameters.courseId || "", p_status: parameters.status || "", p_search: parameters.q || "",
      p_cursor_sort: position?.sort || null, p_cursor_id: position?.id || null, p_sort_dir: parameters.sortDir === "desc" ? "desc" : "asc",
      p_limit: EXPORT_CHUNK + 1, p_timeout_ms: REPORT_LIMITS.exportChunkTimeoutMs,
    });
    if (error) throw new Error(/statement timeout|canceling statement/i.test(String(error.message || "")) ? "EXPORT_DB_TIMEOUT" : "EXPORT_CHUNK_READ_FAILED");
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    for (const row of rows) { processed += 1; yield row; }
    const progress = await rpc(supabase, "service_update_export_job_progress", { p_job_id: job.id, p_lease_token: leaseToken, p_progress: Math.min(95, Math.max(1, Math.floor(processed / 1000))) });
    if (progress.error || progress.data !== true) throw new Error("EXPORT_CANCELLED");
    if (!data?.hasMore || !data?.nextPosition) break;
    position = data.nextPosition;
  }
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function rowValues(row, columns) {
  return columns.map(([key]) => row[key] ?? "");
}

async function digestBytes(value) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function outputName(job, extension) {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `mykis-${job.report_type}-${date}.${extension}`.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function objectKey(job, extension) {
  return `private/report-exports/v3/${job.id.slice(0, 2)}/${job.id}/result.${extension}`;
}

async function uploadCsv({ supabase, bucket, job, policy, leaseToken }) {
  const filename = outputName(job, "csv"); const key = objectKey(job, "csv");
  const multipart = await bucket.createMultipartUpload(key, { httpMetadata: { contentType: policy.formatPolicy.contentType, contentDisposition: `attachment; filename="${filename}"` }, customMetadata: { jobId: job.id, reportType: job.report_type, policyVersion: EXPORT_POLICY_VERSION } });
  const uploadedParts = []; const partHashes = []; let partNumber = 1; let bytes = 0; let rowCount = 0;
  let buffer = `\ufeff${policy.report.columns.map(([, label]) => csvCell(label)).join(",")}\r\n`;
  const flush = async () => { if (!buffer) return; const body = new TextEncoder().encode(buffer); const part = await multipart.uploadPart(partNumber, body); uploadedParts.push({ partNumber, etag: part.etag }); partHashes.push(await digestBytes(body)); bytes += body.byteLength; partNumber += 1; buffer = ""; };
  try {
    for await (const row of reportRows(supabase, job, policy, leaseToken)) {
      rowCount += 1;
      if (rowCount > policy.formatPolicy.maxRows) throw new Error("CSV_ROW_LIMIT_EXCEEDED");
      buffer += `${rowValues(row, policy.report.columns).map(csvCell).join(",")}\r\n`;
      if (new TextEncoder().encode(buffer).byteLength >= MAX_PART_BYTES) await flush();
    }
    await flush();
    await multipart.complete(uploadedParts);
    return { objectKey: key, filename, bytes, checksum: await digestBytes(new TextEncoder().encode(partHashes.join(":"))), rowCount, contentType: policy.formatPolicy.contentType };
  } catch (error) {
    // Some R2 runtime versions do not expose abort on multipart handles; the
    // bucket lifecycle rule remains the cleanup backstop for those uploads.
    if (typeof multipart.abort === "function") await multipart.abort().catch(() => {});
    throw error;
  }
}

function simplePdf(lines) {
  const safe = (value) => String(value ?? "").replace(/[()\\]/g, (character) => `\\${character}`).replace(/[^\x20-\x7e]/g, "?");
  const content = ["BT", "/F1 15 Tf", "52 790 Td", `(${safe(lines[0])}) Tj`, "/F1 8 Tf", ...lines.slice(1, 48).flatMap((line) => ["0 -14 Td", `(${safe(line).slice(0, 125)}) Tj`]), "ET"].join("\n");
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let pdf = "%PDF-1.4\n"; const offsets = [0]; objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`; offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  return `${pdf}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
}

async function uploadBuffered({ supabase, bucket, job, policy, leaseToken }) {
  const rows = [];
  for await (const row of reportRows(supabase, job, policy, leaseToken)) {
    rows.push(row);
    if (rows.length > policy.formatPolicy.maxRows) throw new Error(`${job.format.toUpperCase()}_ROW_LIMIT_EXCEEDED`);
  }
  let body;
  if (job.format === "xlsx") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const values = [policy.report.columns.map(([, label]) => label), ...rows.map((row) => rowValues(row, policy.report.columns))];
    const sheet = XLSX.utils.aoa_to_sheet(values.map((line) => line.map((value) => typeof value === "string" && /^[=+\-@]/.test(value) ? `'${value}` : value)));
    XLSX.utils.book_append_sheet(workbook, sheet, "Report");
    body = new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true }));
  } else {
    const lines = [`MyKIS ${job.report_type}`, `Generated ${new Date().toISOString()}`, ...rows.map((row) => rowValues(row, policy.report.columns).join(" | "))];
    body = new TextEncoder().encode(simplePdf(lines));
  }
  const key = objectKey(job, job.format); const filename = outputName(job, job.format);
  await bucket.put(key, body, { httpMetadata: { contentType: policy.formatPolicy.contentType, contentDisposition: `attachment; filename="${filename}"` }, customMetadata: { jobId: job.id, reportType: job.report_type, policyVersion: EXPORT_POLICY_VERSION } });
  return { objectKey: key, filename, bytes: body.byteLength, checksum: await digestBytes(body), rowCount: rows.length, contentType: policy.formatPolicy.contentType };
}

const FORMATTERS = Object.freeze({ csv: uploadCsv, xlsx: uploadBuffered, pdf: uploadBuffered });

export function createDlqEnvelope(payload, failure = {}) {
  return { version: 1, kind: "report_export_dlq", jobId: cleanText(payload?.jobId, 64), sourceMessageVersion: Number(payload?.version || 0), errorCode: cleanText(failure.errorCode || "EXPORT_FAILED", 120), attempts: Math.min(20, Math.max(0, Number(failure.attempts || 0))), failedAt: new Date().toISOString() };
}

export async function processExportMessage(message, env) {
  const payload = message?.body || {};
  if (![1, QUEUE_MESSAGE_VERSION].includes(payload.version) || !payload.jobId || (payload.version === QUEUE_MESSAGE_VERSION && payload.kind !== "report_export")) return { ack: true, skipped: true };
  const supabase = env.SUPABASE_CLIENT || getSupabase(env); const bucket = binding(env, "REPORT_EXPORT_BUCKET"); const leaseToken = crypto.randomUUID();
  const { data: job, error } = await rpc(supabase, "service_claim_export_job", { p_job_id: payload.jobId, p_lease_token: leaseToken, p_lease_seconds: 120 });
  if (error) throw new Error("EXPORT_JOB_CLAIM_FAILED");
  if (!job?.claimed) return { ack: true, state: job?.state || "not_claimed" };
  let output = null;
  try {
    const policy = exportPolicy(job.report_type, job.format);
    await authorizeRequester(supabase, job, policy);
    await writeAuditLog(supabase, null, { actor: { accountId: job.requester_id, role: job.permission_snapshot?.role }, action: "report.export_job_started", entityType: "export_job", entityId: job.id, metadata: { report_type: job.report_type, format: job.format, attempt: job.attempt_count } }).catch(() => {});
    output = await FORMATTERS[job.format]({ supabase, bucket, job, policy, leaseToken });
    const { data: completed, error: completeError } = await rpc(supabase, "service_complete_export_job", { p_job_id: job.id, p_lease_token: leaseToken, p_object_key: output.objectKey, p_file_name: output.filename, p_content_type: output.contentType, p_size_bytes: output.bytes, p_checksum: output.checksum });
    if (completeError || !completed) throw new Error("EXPORT_JOB_COMPLETE_FAILED");
    await writeAuditLog(supabase, null, { actor: { accountId: job.requester_id, role: job.permission_snapshot?.role }, action: "report.export_job_completed", entityType: "export_job", entityId: job.id, metadata: { format: job.format, size_bytes: output.bytes, row_count: output.rowCount } }).catch(() => {});
    await createNotificationEvent(supabase, { eventType: "report_export_completed", entityType: "export_job", entityId: job.id, actorId: job.requester_id, recipientId: job.requester_id, idempotencyKey: `export_job_completed:${job.id}`, payload: { report_type: job.report_type } }).catch(() => {});
    return { ack: true, state: "completed" };
  } catch (failure) {
    if (output?.objectKey) await bucket.delete(output.objectKey).catch(() => {});
    const retryable = !/INVALID|UNSUPPORTED|PERMISSION|CANCELLED|ROW_LIMIT/.test(String(failure.message || ""));
    const result = await rpc(supabase, "service_fail_export_job", { p_job_id: job.id, p_lease_token: leaseToken, p_error_code: failure.message || "EXPORT_FAILED", p_retryable: retryable });
    if (result.error) throw new Error("EXPORT_JOB_FAILURE_UPDATE_FAILED", { cause: failure });
    if (!result.data?.retry) await writeAuditLog(supabase, null, { actor: { accountId: job.requester_id, role: job.permission_snapshot?.role }, action: "report.export_job_failed", status: "failed", entityType: "export_job", entityId: job.id, metadata: createDlqEnvelope(payload, { errorCode: failure.message, attempts: job.attempt_count }), errorCode: failure.message || "EXPORT_FAILED" }).catch(() => {});
    return { ack: !result.data?.retry, retry: Boolean(result.data?.retry), error: failure.message };
  }
}

export { EXPORT_POLICY_VERSION, QUEUE_MESSAGE_VERSION };
