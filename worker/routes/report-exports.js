import { json, methodNotAllowed, readJson, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireHr } from "../middleware/auth.js";
import { cancelExportJob, createExportJob, getExportDownload, getExportJob, validateExportBinding } from "../services/export-jobs.js";
import { parseReportFilters, isReportType } from "../services/reporting.js";
import { writeAuditLog } from "../services/audit-service.js";

function jobIdFromPath(pathname) {
  return pathname.match(/^\/api\/admin\/report-exports\/([0-9a-f-]{36})(?:\/(?:download|cancel))?$/i)?.[1] || null;
}

export async function handleReportExports(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight(request, env);
  const account = await requireHr(request, env);
  if (!account) return json({ error: "HR_ONLY" }, 403);
  const supabase = getSupabase(env);
  const url = new URL(request.url);
  const path = url.pathname;
  const download = /\/download$/.test(path);
  const jobId = jobIdFromPath(path);

  if (path === "/api/admin/report-exports") {
    if (method !== "POST") return methodNotAllowed();
    validateExportBinding(env);
    const body = await readJson(request);
    const reportType = String(body.reportType || body.report_type || "employees");
    const format = String(body.format || "csv");
    if (!isReportType(reportType)) return json({ error: "INVALID_REPORT_TYPE" }, 400);
    const filterUrl = new URL(request.url);
    const inputFilters = body.filters && typeof body.filters === "object" ? body.filters : {};
    const filterNames = {
      from: "from_date", to: "to_date", department: "department", jobTitle: "jobTitle",
      employeeId: "employeeId", courseId: "courseId", status: "status", q: "q",
    };
    for (const [inputName, queryName] of Object.entries(filterNames)) {
      if (inputFilters[inputName] !== undefined && inputFilters[inputName] !== "") filterUrl.searchParams.set(queryName, String(inputFilters[inputName]));
    }
    const filters = parseReportFilters(filterUrl, reportType);
    const idempotencyKey = request.headers.get("Idempotency-Key") || body.idempotencyKey || "";
    const result = await createExportJob({ supabase, queue: env.REPORT_EXPORT_QUEUE, env, account, request, reportType, format, filters, idempotencyKey });
    return json({ ...result, pollAfterMs: 1500 }, result.created ? 202 : 200);
  }

  if (!jobId) return json({ error: "NOT_FOUND" }, 404);
  if (download) {
    if (method !== "GET") return methodNotAllowed();
    const result = await getExportDownload(supabase, account, jobId);
    if (!result) return json({ error: "NOT_FOUND" }, 404);
    if (!result.available) return json({ error: `EXPORT_${String(result.state || "UNAVAILABLE").toUpperCase()}` }, result.state === "expired" ? 410 : 409);
    const bucket = env.REPORT_EXPORT_BUCKET;
    if (!bucket) return json({ error: "REPORT_EXPORT_BUCKET_MISSING" }, 503);
    const object = await bucket.get(result.object_key);
    if (!object) return json({ error: "EXPORT_OBJECT_MISSING" }, 410);
    await writeAuditLog(supabase, request, {
      actor: account,
      action: "report.export_job_downloaded",
      entityType: "export_job",
      entityId: jobId,
      metadata: { file_size: result.size_bytes || null, checksum: result.checksum || null },
    }, { critical: true });
    return new Response(object.body, { status: 200, headers: {
      "Content-Type": result.content_type || "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${String(result.file_name || "export.csv").replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      ...(result.size_bytes ? { "Content-Length": String(result.size_bytes) } : {}),
    } });
  }
  if (method === "GET") {
    const result = await getExportJob(supabase, account, jobId);
    return result ? json(result) : json({ error: "NOT_FOUND" }, 404);
  }
  if (method === "POST" && url.pathname.endsWith("/cancel")) {
    const result = await cancelExportJob({ supabase, account, request, jobId });
    return result ? json(result) : json({ error: "NOT_FOUND" }, 404);
  }
  return methodNotAllowed();
}
