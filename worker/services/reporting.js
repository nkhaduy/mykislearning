import * as XLSX from "xlsx";

const TZ = "Asia/Ho_Chi_Minh";
const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;
const SYNCHRONOUS_EXPORT_ROW_LIMIT = 2000;
const MAX_REPORT_RANGE_DAYS = 366;
const MAX_GROUP_CARDINALITY = 100;
const PDF_ROW_LIMIT = 120;
const XLSX_ROW_LIMIT = 10000;

const REPORT_TYPES = new Set([
  "overview", "employees", "departments", "courses", "enrollments", "completion", "course-completion",
  "learning-paths", "compliance", "certificates", "quizzes", "quiz-results", "training-sessions", "attendance",
  "learning-records", "competencies", "development-plans",
]);

const STATUS_FIELDS = new Set([
  "notStarted", "inProgress", "completed", "overdue", "not_started", "in_progress", "pending", "verified",
  "expired", "missing", "failed", "exempted", "revoked", "rejected", "draft", "active", "cancelled", "archived",
]);

export const REPORT_LIMITS = Object.freeze({
  maxDateRangeDays: MAX_REPORT_RANGE_DAYS,
  maxPageSize: PAGE_SIZE_MAX,
  maxGroupCardinality: MAX_GROUP_CARDINALITY,
  maxSynchronousRows: SYNCHRONOUS_EXPORT_ROW_LIMIT,
  overviewTimeoutMs: 8000,
  detailTimeoutMs: 5000,
  exportChunkTimeoutMs: 15000,
  pdfRows: PDF_ROW_LIMIT,
  xlsxRows: XLSX_ROW_LIMIT,
});

export function isReportType(value) {
  return REPORT_TYPES.has(value);
}

export function vnDayBounds(dateText) {
  const value = String(dateText || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const start = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(start.getTime())) return null;
  return { start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString() };
}

function formatVnDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function defaultRange() {
  const toDate = formatVnDate();
  const start = new Date(`${toDate}T00:00:00+07:00`);
  start.setDate(start.getDate() - 29);
  return { fromDate: formatVnDate(start), toDate };
}

export function parseReportFilters(url) {
  const defaults = defaultRange();
  const fromDate = url.searchParams.get("from_date") || defaults.fromDate;
  const toDate = url.searchParams.get("to_date") || defaults.toDate;
  const from = vnDayBounds(fromDate);
  const to = vnDayBounds(toDate);
  if (!from || !to || from.start > to.start) throw Object.assign(new Error("INVALID_DATE_RANGE"), { status: 400 });
  const rangeDays = Math.ceil((new Date(to.end).getTime() - new Date(from.start).getTime()) / 86400000);
  if (rangeDays > MAX_REPORT_RANGE_DAYS) throw Object.assign(new Error("REPORT_RANGE_TOO_LARGE"), { status: 400 });
  const status = (url.searchParams.get("status") || "").trim();
  if (status && !STATUS_FIELDS.has(status)) throw Object.assign(new Error("INVALID_STATUS"), { status: 400 });
  const sortDir = url.searchParams.get("sortDir") === "desc" ? "desc" : "asc";
  return {
    fromDate, toDate, fromIso: from.start, toIsoExclusive: to.end,
    department: (url.searchParams.get("department") || "").trim().slice(0, 120),
    jobTitle: (url.searchParams.get("jobTitle") || "").trim().slice(0, 120),
    employeeId: (url.searchParams.get("employeeId") || "").trim().slice(0, 120),
    courseId: (url.searchParams.get("courseId") || "").trim().slice(0, 120),
    status,
    q: (url.searchParams.get("q") || "").trim().slice(0, 80),
    pageSize: Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") || String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT)),
    cursor: (url.searchParams.get("cursor") || "").trim().slice(0, 4096),
    sortBy: (url.searchParams.get("sortBy") || "").trim().slice(0, 40),
    sortDir,
  };
}

function rpcError(error, fallback = "REPORT_QUERY_FAILED") {
  const message = String(error?.message || error?.details || "");
  if (/statement timeout|canceling statement/i.test(message)) return Object.assign(new Error("REPORT_DB_TIMEOUT"), { status: 504, code: "REPORT_DB_TIMEOUT" });
  return Object.assign(new Error(fallback), { status: 503, code: fallback });
}

function reportRpcArgs(filters, timeoutMs) {
  return {
    p_from: filters.fromIso,
    p_to: filters.toIsoExclusive,
    p_department: filters.department,
    p_job_title: filters.jobTitle,
    p_course_id: filters.courseId,
    p_status: filters.status,
    p_search: filters.q,
    p_timeout_ms: timeoutMs,
  };
}

export async function getOverviewReport(supabase, filters) {
  const { data, error } = await supabase.rpc("service_report_overview", {
    ...reportRpcArgs(filters, REPORT_LIMITS.overviewTimeoutMs),
    p_group_limit: REPORT_LIMITS.maxGroupCardinality,
  });
  if (error) throw rpcError(error);
  return { filters: { fromDate: filters.fromDate, toDate: filters.toDate, department: filters.department, status: filters.status }, ...(data || {}) };
}

export async function getTableReport(supabase, reportType, filters, { position = null, timeoutMs = REPORT_LIMITS.detailTimeoutMs } = {}) {
  const { data, error } = await supabase.rpc("service_report_detail", {
    p_report_type: reportType,
    ...reportRpcArgs(filters, timeoutMs),
    p_employee_id: filters.employeeId,
    p_cursor_sort: position?.sort || null,
    p_cursor_id: position?.id || null,
    p_sort_dir: filters.sortDir,
    p_limit: filters.pageSize + 1,
  });
  if (error) throw rpcError(error);
  return {
    rows: Array.isArray(data?.rows) ? data.rows : [],
    hasMore: Boolean(data?.hasMore),
    nextPosition: data?.nextPosition || null,
    pageSize: filters.pageSize,
    estimatedCount: null,
    countKind: "not_requested",
  };
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function escapeFormula(value) {
  return typeof value === "string" && /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function simplePdf(lines) {
  const safe = (value) => String(value ?? "").replace(/[()\\]/g, (character) => `\\${character}`).replace(/[^\x20-\x7e]/g, "?");
  const content = ["BT", "/F1 15 Tf", "52 790 Td", `(${safe(lines[0] || "Training report")}) Tj`, "/F1 9 Tf", ...lines.slice(1, 48).flatMap((line) => ["0 -15 Td", `(${safe(line).slice(0, 120)}) Tj`]), "ET"].join("\n");
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  return `${pdf}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
}

function tableRows(rows) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))];
}

async function collectSyncRows(supabase, reportType, filters) {
  const rows = [];
  let position = null;
  do {
    const remaining = SYNCHRONOUS_EXPORT_ROW_LIMIT - rows.length;
    const pageFilters = { ...filters, pageSize: Math.min(PAGE_SIZE_MAX, Math.max(1, remaining)) };
    const page = await getTableReport(supabase, reportType, pageFilters, { position, timeoutMs: REPORT_LIMITS.exportChunkTimeoutMs });
    rows.push(...page.rows);
    if (page.hasMore && rows.length >= SYNCHRONOUS_EXPORT_ROW_LIMIT) throw Object.assign(new Error("ASYNC_EXPORT_REQUIRED"), { status: 413 });
    position = page.hasMore ? page.nextPosition : null;
  } while (position);
  return rows;
}

export async function exportReport(supabase, reportType, format, filters) {
  if (!["csv", "xlsx", "pdf"].includes(format)) throw Object.assign(new Error("INVALID_FORMAT"), { status: 400 });
  const rows = reportType === "overview"
    ? tableRows([...(Object.entries((await getOverviewReport(supabase, filters)).metrics || {}).map(([metric, value]) => ({ metric, value })))])
    : tableRows(await collectSyncRows(supabase, reportType, filters));
  const rowCount = Math.max(0, rows.length - 1);
  if (format === "pdf" && rowCount > PDF_ROW_LIMIT) throw Object.assign(new Error("PDF_ROW_LIMIT_EXCEEDED"), { status: 413 });
  if (format === "xlsx" && rowCount > XLSX_ROW_LIMIT) throw Object.assign(new Error("XLSX_ROW_LIMIT_EXCEEDED"), { status: 413 });
  const fileBase = `bao-cao-${reportType}-${formatVnDate().replaceAll("-", "")}`;
  if (format === "csv") return { body: `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`, contentType: "text/csv; charset=utf-8", filename: `${fileBase}.csv`, rowCount };
  if (format === "xlsx") {
    const workbook = XLSX.utils.book_new();
    const summary = XLSX.utils.aoa_to_sheet([["Report", reportType], ["From", filters.fromDate], ["To", filters.toDate], ["Generated", new Date().toISOString()]]);
    XLSX.utils.book_append_sheet(workbook, summary, "Summary");
    const safeRows = rows.map((row) => row.map(escapeFormula));
    const detail = XLSX.utils.aoa_to_sheet(safeRows); detail["!cols"] = (safeRows[0] || []).map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(workbook, detail, "Detail");
    return { body: XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true }), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: `${fileBase}.xlsx`, rowCount };
  }
  const lines = [`Report ${reportType}`, `Period ${filters.fromDate} - ${filters.toDate}`, `Generated ${new Date().toISOString()}`, "", ...rows.map((row) => row.join(" | "))];
  return { body: simplePdf(lines), contentType: "application/pdf", filename: `${fileBase}.pdf`, rowCount };
}
