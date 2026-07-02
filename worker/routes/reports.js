import { json, corsHeaders, corsPreflight, methodNotAllowed } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireHr } from "../middleware/auth.js";
import { createNotificationEvent } from "../services/notificationEngine.js";
import { exportReport, getOverviewReport, getTableReport, isReportType, parseReportFilters } from "../services/reporting.js";
import { writeAuditLog } from "../services/audit-service.js";

export async function handleReports(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const url = new URL(request.url);
  const path = url.pathname;
  const supabase = getSupabase(env);

  try {
    if (path === "/api/admin/reports/export") {
      if (method !== "GET") return methodNotAllowed();
      const reportType = url.searchParams.get("report_type") || "overview";
      const format = url.searchParams.get("format") || "csv";
      if (!isReportType(reportType)) return json({ error: "INVALID_REPORT_TYPE" }, 400);
      const filters = parseReportFilters(url, reportType);
      let file;
      try {
        file = await exportReport(supabase, reportType, format, filters);
        await writeAuditLog(supabase, request, {
          actor: acct,
          action: "report.exported",
          entityType: "report",
          entityId: reportType,
          entityDisplayName: reportType,
          metadata: {
            report_type: reportType,
            format,
            row_count: file.rowCount || null,
            filters: {
              from_date: filters.fromDate,
              to_date: filters.toDate,
              department: filters.department,
              status: filters.status,
              q: filters.q ? "[SEARCH]" : "",
            },
          },
        }, { critical: true });
        createNotificationEvent(supabase, {
          eventType: "report_export_completed",
          entityType: "report_export",
          entityId: `${reportType}:${format}`,
          actorId: acct.accountId,
          recipientId: acct.accountId,
          idempotencyKey: `report_export_completed:${acct.accountId}:${reportType}:${format}:${Date.now()}`,
          payload: { report_type: `${reportType}.${format}` },
        }).catch(() => {});
      } catch (error) {
        await writeAuditLog(supabase, request, {
          actor: acct,
          action: "report.export_failed",
          status: "failed",
          entityType: "report",
          entityId: reportType,
          entityDisplayName: reportType,
          metadata: { report_type: reportType, format },
          errorCode: error.message || "REPORT_EXPORT_FAILED",
        }).catch(() => {});
        createNotificationEvent(supabase, {
          eventType: "report_export_failed",
          entityType: "report_export",
          entityId: `${reportType}:${format}`,
          actorId: acct.accountId,
          recipientId: acct.accountId,
          idempotencyKey: `report_export_failed:${acct.accountId}:${reportType}:${format}:${Date.now()}`,
          payload: { report_type: `${reportType}.${format}`, error_message: error.message || "REPORT_EXPORT_FAILED" },
        }).catch(() => {});
        throw error;
      }
      return new Response(file.body, {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": file.contentType,
          "Content-Disposition": `attachment; filename="${file.filename}"`,
          "Cache-Control": "no-store",
          "Access-Control-Expose-Headers": "Content-Disposition, X-Request-ID, X-Correlation-ID",
        },
      });
    }

    if (method !== "GET") return methodNotAllowed();
    const reportType = path.replace("/api/admin/reports/", "") || "overview";
    if (!isReportType(reportType)) return json({ error: "INVALID_REPORT_TYPE" }, 400);
    const filters = parseReportFilters(url, reportType);
    if (reportType === "overview") return json(await getOverviewReport(supabase, filters));
    return json(await getTableReport(supabase, reportType, filters));
  } catch (error) {
    return json({ error: error.message || "REPORT_QUERY_FAILED" }, error.status || 500);
  }
}
