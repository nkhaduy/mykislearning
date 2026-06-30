import { json, corsHeaders, corsPreflight, methodNotAllowed } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireHr } from "../middleware/auth.js";
import { exportReport, getOverviewReport, getTableReport, isReportType, parseReportFilters } from "../services/reporting.js";

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
      const file = await exportReport(supabase, reportType, format, filters);
      return new Response(file.body, {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": file.contentType,
          "Content-Disposition": `attachment; filename="${file.filename}"`,
          "Cache-Control": "no-store",
          "Access-Control-Expose-Headers": "Content-Disposition",
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
