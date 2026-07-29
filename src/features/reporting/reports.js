import { apiJson, downloadFile } from "../../shared/api/client.js";
import { createI18n, formatNumber } from "../../shared/i18n/runtime.js";
import { createRouteShell, escapeAttribute, escapeHtml } from "../../shared/ui/route-shell.js";

const REPORT_TYPES = ["overview", "employees", "departments", "courses", "learning-paths", "compliance", "certificates", "quizzes", "training-sessions"];
const ASYNC_EXPORT_TYPES = { employees: "employees", compliance: "compliance", certificates: "certificates", quizzes: "quiz-results", "training-sessions": "attendance" };

const copy = {
  vi: { eyebrow: "HR / L&D Analytics", loading: "Đang tải báo cáo", loaded: "Đã tải báo cáo", exporting: "Đang xuất báo cáo", exported: "Đã bắt đầu tải báo cáo", loadError: "Không thể tải báo cáo.", retry: "Thử lại", restricted: "Tài khoản này không có quyền xem báo cáo.", back: "Về trang học viên", caption: "Dữ liệu báo cáo", chartAlt: "So sánh tỷ lệ hoàn thành theo phòng ban", noData: "Không có dữ liệu phù hợp.", filters: "Bộ lọc báo cáo", largeCsv: "CSV lớn", jobQueued: "Đã xếp hàng export", jobTitle: "Export nền", cancel: "Hủy", download: "Tải file", expires: "Hết hạn", jobFailed: "Export thất bại", jobRetry: "Tạo job mới" },
  en: { eyebrow: "HR / L&D Analytics", loading: "Loading report", loaded: "Report loaded", exporting: "Exporting report", exported: "Report download started", loadError: "Unable to load the report.", retry: "Retry", restricted: "This account cannot view reports.", back: "Go to learner workspace", caption: "Report data", chartAlt: "Completion rate comparison by department", noData: "No matching data.", filters: "Report filters", largeCsv: "Large CSV", jobQueued: "Export queued", jobTitle: "Background export", cancel: "Cancel", download: "Download", expires: "Expires", jobFailed: "Export failed", jobRetry: "Create new job" },
  kr: { eyebrow: "HR / L&D Analytics", loading: "보고서를 불러오는 중", loaded: "보고서를 불러왔습니다", exporting: "보고서를 내보내는 중", exported: "보고서 다운로드를 시작했습니다", loadError: "보고서를 불러올 수 없습니다.", retry: "다시 시도", restricted: "이 계정은 보고서를 볼 수 없습니다.", back: "학습자 공간으로 이동", caption: "보고서 데이터", chartAlt: "부서별 완료율 비교", noData: "조건에 맞는 데이터가 없습니다.", filters: "보고서 필터", largeCsv: "대용량 CSV", jobQueued: "내보내기 대기 중", jobTitle: "백그라운드 내보내기", cancel: "취소", download: "다운로드", expires: "만료", jobFailed: "내보내기 실패", jobRetry: "새 작업 만들기" },
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dateOffset(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

function defaultBounds(range) {
  const today = todayIso();
  const now = new Date();
  if (range === "today") return { from: today, to: today };
  if (range === "7d") return { from: dateOffset(6), to: today };
  if (range === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  if (range === "quarter") {
    const month = Math.floor(now.getMonth() / 3) * 3;
    return { from: new Date(now.getFullYear(), month, 1).toISOString().slice(0, 10), to: today };
  }
  if (range === "year") return { from: `${now.getFullYear()}-01-01`, to: today };
  return { from: dateOffset(29), to: today };
}

function readState() {
  const params = new URLSearchParams(location.search);
  const type = REPORT_TYPES.includes(params.get("type")) ? params.get("type") : "overview";
  const range = ["today", "7d", "30d", "month", "quarter", "year", "custom"].includes(params.get("range")) ? params.get("range") : "30d";
  const defaults = defaultBounds(range);
  return {
    type,
    range,
    from: params.get("from") || defaults.from,
    to: params.get("to") || defaults.to,
    department: params.get("department") || "",
    courseId: params.get("courseId") || "",
    status: params.get("status") || "",
    page: Math.max(1, Number(params.get("page") || 1) || 1),
    pageSize: 25,
    cursors: [null],
    data: null,
    loading: false,
    error: "",
    exportJob: null,
    exportBusy: false,
  };
}

function typeLabel(type, i18n) {
  const keys = {
    overview: ["reports.overview", { vi: "Tổng quan", en: "Overview", kr: "개요" }],
    employees: ["reports.employees", { vi: "Nhân viên", en: "Employees", kr: "직원" }],
    departments: ["reports.departments", { vi: "Phòng ban", en: "Departments", kr: "부서" }],
    courses: ["reports.courses", { vi: "Khóa học", en: "Courses", kr: "과정" }],
    "learning-paths": ["reports.learningPaths", { vi: "Lộ trình học", en: "Learning paths", kr: "학습 경로" }],
    compliance: ["reports.compliance", { vi: "Tuân thủ", en: "Compliance", kr: "컴플라이언스" }],
    certificates: ["reports.certificates", { vi: "Chứng chỉ", en: "Certificates", kr: "자격증" }],
    quizzes: ["reports.quizzes", { vi: "Bài kiểm tra", en: "Quizzes", kr: "퀴즈" }],
    "training-sessions": ["reports.trainingSessions", { vi: "Buổi học", en: "Training sessions", kr: "교육 세션" }],
  }[type];
  return i18n.t(keys[0], i18n.pick(keys[1]));
}

function columnDefinitions(type, i18n) {
  const t = (key, fallback) => i18n.t(`reports.${key}`, fallback);
  return {
    employees: [["employee", t("employee", "Employee")], ["employeeCode", t("employeeCode", "Code")], ["department", t("department", "Department")], ["jobTitle", t("jobTitle", "Job title")], ["assigned", t("assigned", "Assigned")], ["completed", t("completed", "Completed")], ["inProgress", t("inProgress", "In progress")], ["overdue", t("overdue", "Overdue")], ["completionRate", t("completionRate", "Completion rate")], ["lastActivityAt", t("lastActivity", "Last activity")]],
    departments: [["department", t("department", "Department")], ["totalEmployees", t("totalEmployees", "Employees")], ["assigned", t("assigned", "Assigned")], ["completed", t("completed", "Completed")], ["overdue", t("overdue", "Overdue")], ["completionRate", t("completionRate", "Completion rate")], ["participationRate", t("participationRate", "Participation rate")]],
    courses: [["course", t("course", "Course")], ["version", "Version"], ["status", t("status", "Status")], ["assigned", t("assigned", "Assigned")], ["inProgress", t("inProgress", "In progress")], ["completed", t("completed", "Completed")], ["overdue", t("overdue", "Overdue")], ["completionRate", t("completionRate", "Completion rate")], ["averageQuizScore", t("averageQuizScore", "Average quiz score")]],
    "learning-paths": [["learningPath", t("learningPath", "Learning path")], ["version", "Version"], ["assigned", t("assigned", "Assigned")], ["inProgress", t("inProgress", "In progress")], ["completed", t("completed", "Completed")], ["overdue", t("overdue", "Overdue")], ["averageProgress", t("averageProgress", "Average progress")], ["bottleneckStep", t("bottleneckStep", "Bottleneck")]],
    compliance: [["program", t("program", "Program")], ["cycle", t("cycle", "Cycle")], ["targetEmployees", t("targetEmployees", "Target employees")], ["inProgress", t("inProgress", "In progress")], ["completedOnTime", t("completedOnTime", "Completed on time")], ["overdue", t("overdue", "Overdue")], ["failed", t("failed", "Failed")], ["completionRate", t("completionRate", "Completion rate")]],
    certificates: [["certificateType", t("certificateType", "Certificate type")], ["employee", t("employee", "Employee")], ["employeeCode", t("employeeCode", "Code")], ["department", t("department", "Department")], ["verified", t("verified", "Verified")], ["pending", t("pending", "Pending")], ["expiringSoon", t("expiringSoon", "Expiring soon")], ["expired", t("expired", "Expired")], ["expiresAt", t("expiresAt", "Expires")]],
    quizzes: [["quiz", t("quiz", "Quiz")], ["attempts", t("attempts", "Attempts")], ["participants", t("participants", "Participants")], ["averageScore", t("averageScore", "Average score")], ["passRate", t("passRate", "Pass rate")], ["retakes", t("retakes", "Retakes")], ["hardestQuestion", t("hardestQuestion", "Hardest question")]],
    "training-sessions": [["title", t("sessionTitle", "Session")], ["startAt", t("sessionDate", "Date")], ["mode", t("trainingMode", "Mode")], ["registered", t("registered", "Registered")], ["present", t("present", "Present")], ["late", t("late", "Late")], ["absent", t("absent", "Absent")], ["attendanceRate", t("attendanceRate", "Attendance rate")]],
  }[type] || [];
}

function queryParams(state, extra = {}) {
  const bounds = state.range === "custom" ? { from: state.from, to: state.to } : defaultBounds(state.range);
  const params = new URLSearchParams({ from_date: bounds.from, to_date: bounds.to, pageSize: String(state.pageSize), ...extra });
  const cursor = state.cursors[state.page - 1];
  if (cursor) params.set("cursor", cursor);
  if (state.department) params.set("department", state.department);
  if (state.courseId) params.set("courseId", state.courseId);
  if (state.status) params.set("status", state.status);
  return params;
}

function syncUrl(state) {
  const params = new URLSearchParams({ type: state.type, range: state.range });
  if (state.range === "custom") { params.set("from", state.from); params.set("to", state.to); }
  if (state.department) params.set("department", state.department);
  if (state.courseId) params.set("courseId", state.courseId);
  if (state.status) params.set("status", state.status);
  if (state.page > 1) params.set("page", String(state.page));
  history.replaceState({}, "", `/hr/reports?${params}`);
}

function metric(label, value, hint = "") {
  return `<article class="route-card reporting-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "—")}</strong>${hint ? `<small>${escapeHtml(hint)}</small>` : ""}</article>`;
}

function overviewPanel(state, i18n, text) {
  const data = state.data || {};
  const metrics = data.metrics || {};
  const bars = Array.isArray(data.departmentComparison) ? data.departmentComparison : [];
  const max = Math.max(1, ...bars.map((row) => Number(row.completionRate || 0)));
  const t = (key, fallback) => i18n.t(`reports.${key}`, fallback);
  return `<section class="reporting-metrics" aria-label="${escapeAttribute(i18n.t("reports.title", "Reports"))}">
    ${metric(t("totalEmployees", "Employees"), formatNumber(metrics.totalEmployees, i18n.locale))}
    ${metric(t("activeLearners", "Active learners"), formatNumber(metrics.activeLearners, i18n.locale))}
    ${metric(t("openCourses", "Open courses"), formatNumber(metrics.openCourses, i18n.locale))}
    ${metric(t("completionRate", "Completion rate"), metrics.completionRate == null ? "—" : `${metrics.completionRate}%`)}
    ${metric(t("onTimeCompletion", "On-time completion"), metrics.onTimeCompletionRate == null ? "—" : `${metrics.onTimeCompletionRate}%`)}
    ${metric(t("overdueLearners", "Overdue learners"), formatNumber(metrics.overdueLearners, i18n.locale))}
  </section>
  <div class="reporting-grid">
    <section class="route-card route-panel reporting-chart"><header><p>Comparison</p><h2>${escapeHtml(t("departmentComparison", "Department comparison"))}</h2></header><p class="reporting-chart-alt">${escapeHtml(text.chartAlt)}. ${bars.map((row) => `${row.department}: ${row.completionRate ?? 0}%`).join("; ")}</p><div>${bars.map((row) => `<div class="reporting-bar"><span>${escapeHtml(row.department || "—")}</span><div aria-hidden="true"><i style="width:${Math.max(2, Number(row.completionRate || 0) / max * 100)}%"></i></div><strong>${escapeHtml(row.completionRate ?? "—")}%</strong></div>`).join("") || `<p class="reporting-empty">${escapeHtml(text.noData)}</p>`}</div></section>
    <section class="route-card route-panel reporting-exceptions"><header><p>Priority</p><h2>${escapeHtml(t("priorityExceptions", "Priority exceptions"))}</h2></header><table><caption>${escapeHtml(t("priorityExceptions", "Priority exceptions"))}</caption><thead><tr><th scope="col">${escapeHtml(t("employee", "Employee"))}</th><th scope="col">${escapeHtml(t("content", "Content"))}</th><th scope="col">${escapeHtml(t("dueDate", "Due date"))}</th></tr></thead><tbody>${(data.priorityExceptions || []).map((row) => `<tr><td>${escapeHtml(row.employee || "—")}</td><td>${escapeHtml(row.title || "—")}</td><td>${escapeHtml(row.dueAt || "—")}</td></tr>`).join("") || `<tr><td colspan="3">${escapeHtml(text.noData)}</td></tr>`}</tbody></table></section>
  </div>`;
}

function tablePanel(state, i18n, text) {
  const rows = Array.isArray(state.data?.rows) ? state.data.rows : [];
  const columns = columnDefinitions(state.type, i18n);
  const body = rows.length
    ? rows.map((row) => `<tr>${columns.map(([key]) => `<td>${escapeHtml(row[key] === true ? i18n.t("reports.yes", "Yes") : row[key] === false ? i18n.t("reports.no", "No") : row[key] ?? "—")}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${columns.length || 1}">${escapeHtml(text.noData)}</td></tr>`;
  return `<section class="route-card route-panel reporting-table"><header><div><p>Dataset</p><h2>${escapeHtml(typeLabel(state.type, i18n))}</h2></div><strong>${formatNumber(rows.length, i18n.locale)}</strong></header><div class="reporting-table-wrap"><table><caption>${escapeHtml(text.caption)}: ${escapeHtml(typeLabel(state.type, i18n))}</caption><thead><tr>${columns.map(([, label]) => `<th scope="col">${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div><nav class="reporting-pagination" aria-label="${escapeAttribute(i18n.t("reports.pagination", "Pagination"))}"><button type="button" data-report-page="${state.page - 1}" ${state.page <= 1 ? "disabled" : ""}>‹</button><span>${state.page}</span><button type="button" data-report-page="${state.page + 1}" ${state.data?.hasMore ? "" : "disabled"}>›</button></nav></section>`;
}

function exportJobPanel(state, text) {
  const job = state.exportJob;
  if (!job) return "";
  const active = ["queued", "running"].includes(job.status);
  const failed = ["failed", "cancelled", "expired"].includes(job.status);
  return `<section class="route-card route-panel reporting-export-job" role="status" aria-live="polite"><header><div><p>Queue / R2</p><h2>${escapeHtml(text.jobTitle)}</h2></div><strong>${escapeHtml(job.status || "queued")}</strong></header><div class="reporting-export-progress"><span style="width:${Math.max(0, Math.min(100, Number(job.progress || 0)))}%"></span></div><p>${escapeHtml(job.file_name || (failed ? text.jobFailed : text.jobQueued))}</p><div>${active ? `<button type="button" class="route-button route-button--secondary" data-export-cancel>${escapeHtml(text.cancel)}</button>` : ""}${job.status === "completed" ? `<a class="route-button" href="/api/admin/report-exports/${escapeAttribute(job.id)}/download">${escapeHtml(text.download)}</a><small>${escapeHtml(text.expires)}: ${escapeHtml(job.expires_at || "—")}</small>` : ""}${failed ? `<button type="button" class="route-button" data-export-retry>${escapeHtml(text.jobRetry)}</button>` : ""}</div></section>`;
}

function render(state, i18n, text) {
  const rangeOptions = [["today", "today"], ["7d", "last7Days"], ["30d", "last30Days"], ["month", "thisMonth"], ["quarter", "thisQuarter"], ["year", "thisYear"], ["custom", "custom"]];
  const title = i18n.t("reports.title", i18n.pick({ vi: "Báo cáo đào tạo", en: "Training reports", kr: "교육 보고서" }));
  const asyncType = ASYNC_EXPORT_TYPES[state.type];
  return `<section class="reporting-hero"><div><p>${escapeHtml(text.eyebrow)}</p><h2 tabindex="-1">${escapeHtml(title)}</h2><span>${escapeHtml(i18n.t("reports.subtitle", i18n.pick({ vi: "Dữ liệu vận hành có bộ lọc và xuất file phía máy chủ.", en: "Operational data with bounded filters and server-side exports.", kr: "필터와 서버 내보내기를 지원하는 운영 데이터입니다." })))}</span></div><div>${asyncType ? ["csv", "xlsx", "pdf"].map((format) => `<button type="button" data-report-export-job="${format}" ${state.exportBusy ? "disabled" : ""}>${format.toUpperCase()}</button>`).join("") : `<button type="button" data-report-export="csv">CSV</button><button type="button" data-report-export="xlsx">XLSX</button><button type="button" data-report-export="pdf">PDF</button>`}</div></section>
  ${exportJobPanel(state, text)}
  <form class="route-card route-panel reporting-filters" data-report-filters aria-label="${escapeAttribute(text.filters)}"><label><span>${escapeHtml(i18n.t("reports.dateRange", "Date range"))}</span><select name="range">${rangeOptions.map(([value, key]) => `<option value="${value}" ${state.range === value ? "selected" : ""}>${escapeHtml(i18n.t(`reports.${key}`, key))}</option>`).join("")}</select></label>${state.range === "custom" ? `<label><span>${escapeHtml(i18n.t("reports.fromDate", "From"))}</span><input name="from" type="date" value="${escapeAttribute(state.from)}"></label><label><span>${escapeHtml(i18n.t("reports.toDate", "To"))}</span><input name="to" type="date" value="${escapeAttribute(state.to)}"></label>` : ""}<label><span>${escapeHtml(i18n.t("reports.department", "Department"))}</span><input name="department" value="${escapeAttribute(state.department)}" placeholder="${escapeAttribute(i18n.t("reports.allDepartments", "All departments"))}"></label><label><span>${escapeHtml(i18n.t("reports.course", "Course"))}</span><input name="courseId" value="${escapeAttribute(state.courseId)}" placeholder="${escapeAttribute(i18n.t("reports.courseId", "Course ID"))}"></label><label><span>${escapeHtml(i18n.t("reports.status", "Status"))}</span><select name="status"><option value="">${escapeHtml(i18n.t("reports.allStatuses", "All statuses"))}</option>${["notStarted", "inProgress", "completed", "overdue", "pending", "verified", "expired", "failed"].map((status) => `<option value="${status}" ${state.status === status ? "selected" : ""}>${escapeHtml(i18n.t(`reports.${status}`, status))}</option>`).join("")}</select></label><button class="route-button" type="submit">${escapeHtml(i18n.t("reports.apply", "Apply"))}</button><button class="route-button route-button--secondary" type="button" data-report-reset>${escapeHtml(i18n.t("reports.resetFilters", "Reset"))}</button></form>
  <div class="reporting-tabs" role="tablist" aria-label="${escapeAttribute(title)}">${REPORT_TYPES.map((type) => `<button type="button" role="tab" aria-selected="${state.type === type}" tabindex="${state.type === type ? "0" : "-1"}" class="${state.type === type ? "active" : ""}" data-report-tab="${type}">${escapeHtml(typeLabel(type, i18n))}</button>`).join("")}</div>
  ${state.error ? `<section class="route-card route-error"><p>${escapeHtml(text.loadError)}</p><button type="button" class="route-button" data-report-retry>${escapeHtml(text.retry)}</button></section>` : state.loading ? `<div class="route-loading" aria-label="${escapeAttribute(text.loading)}"><span></span><span></span><span></span></div>` : state.type === "overview" ? overviewPanel(state, i18n, text) : tablePanel(state, i18n, text)}`;
}

export async function mount({ account }) {
  const i18n = createI18n();
  const text = copy[i18n.language] || copy.vi;
  const shell = createRouteShell({ account, i18n, title: i18n.t("reports.title", "Reports"), eyebrow: text.eyebrow, entry: "admin-reporting" });
  if (!["hr"].includes(account.role)) {
    shell.setContent(`<section class="route-card route-error"><h2 tabindex="-1">${escapeHtml(text.restricted)}</h2><a class="route-button" href="/dashboard">${escapeHtml(text.back)}</a></section>`, { focus: true });
    return;
  }
  const state = readState();
  let exportPollTimer = null;

  const renderCurrent = () => {
    shell.setContent(render(state, i18n, text));
    bind();
  };

  const pollExport = (jobId, delay = 1500) => {
    clearTimeout(exportPollTimer);
    exportPollTimer = setTimeout(async () => {
      try {
        state.exportJob = await apiJson(`/api/admin/report-exports/${encodeURIComponent(jobId)}`);
        renderCurrent();
        if (["queued", "running"].includes(state.exportJob.status)) pollExport(jobId, Math.min(10000, Math.round(delay * 1.6)));
      } catch {
        pollExport(jobId, Math.min(10000, Math.round(delay * 1.8)));
      }
    }, delay);
  };

  const startExportJob = async (format = "csv") => {
    state.exportBusy = true;
    renderCurrent();
    try {
      const result = await apiJson("/api/admin/report-exports", {
        method: "POST",
        headers: { "Idempotency-Key": `export:${account.id}:${state.type}:${crypto.randomUUID()}` },
        body: JSON.stringify({ reportType: ASYNC_EXPORT_TYPES[state.type], format, filters: { from: state.from, to: state.to, department: state.department, courseId: state.courseId, status: state.status } }),
      });
      state.exportJob = { ...result, progress: 0 };
      shell.announce(text.jobQueued);
      pollExport(result.id, result.pollAfterMs || 1500);
    } catch {
      shell.announce(text.jobFailed);
    } finally {
      state.exportBusy = false;
      renderCurrent();
    }
  };

  const bind = () => {
    shell.content.querySelector("[data-report-filters]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      state.range = String(data.get("range") || "30d");
      const bounds = defaultBounds(state.range);
      state.from = String(data.get("from") || bounds.from);
      state.to = String(data.get("to") || bounds.to);
      state.department = String(data.get("department") || "").trim();
      state.courseId = String(data.get("courseId") || "").trim();
      state.status = String(data.get("status") || "");
      state.page = 1; state.cursors = [null];
      syncUrl(state);
      load();
    });
    shell.content.querySelector("[data-report-reset]")?.addEventListener("click", () => {
      Object.assign(state, { range: "30d", ...defaultBounds("30d"), department: "", courseId: "", status: "", page: 1, cursors: [null] });
      syncUrl(state);
      load();
    });
    const tabs = [...shell.content.querySelectorAll("[data-report-tab]")];
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => { state.type = tab.dataset.reportTab; state.page = 1; state.cursors = [null]; syncUrl(state); load(); });
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        tabs[nextIndex].focus();
        tabs[nextIndex].click();
      });
    });
    shell.content.querySelectorAll("[data-report-page]").forEach((button) => button.addEventListener("click", () => { const nextPage = Number(button.dataset.reportPage); if (nextPage > state.page && state.data?.nextCursor) state.cursors[state.page] = state.data.nextCursor; state.page = nextPage; syncUrl(state); load(); }));
    shell.content.querySelector("[data-report-retry]")?.addEventListener("click", load, { once: true });
    shell.content.querySelectorAll("[data-report-export-job]").forEach((button) => button.addEventListener("click", () => startExportJob(button.dataset.reportExportJob || "csv")));
    shell.content.querySelector("[data-export-retry]")?.addEventListener("click", () => startExportJob(state.exportJob?.format || "csv"));
    shell.content.querySelector("[data-export-cancel]")?.addEventListener("click", async () => {
      if (!state.exportJob?.id) return;
      state.exportJob = await apiJson(`/api/admin/report-exports/${encodeURIComponent(state.exportJob.id)}/cancel`, { method: "POST" }).catch(() => state.exportJob);
      clearTimeout(exportPollTimer);
      renderCurrent();
    });
    shell.content.querySelectorAll("[data-report-export]").forEach((button) => button.addEventListener("click", async () => {
      const format = button.dataset.reportExport;
      button.disabled = true;
      shell.announce(text.exporting);
      try {
        await downloadFile(`/api/admin/reports/export?${queryParams(state, { report_type: state.type, format })}`, `mykis-${state.type}.${format}`);
        shell.announce(text.exported);
      } catch {
        shell.announce(text.loadError);
      } finally {
        button.disabled = false;
      }
    }));
  };

  const load = async () => {
    state.loading = true;
    state.error = "";
    shell.setContent(render(state, i18n, text));
    try {
      const endpoint = state.type === "overview" ? "/api/admin/reports/overview" : `/api/admin/reports/${state.type}`;
      state.data = await apiJson(`${endpoint}?${queryParams(state)}`);
      state.loading = false;
      shell.setContent(render(state, i18n, text), { focus: true });
      bind();
      shell.announce(text.loaded);
    } catch (error) {
      state.loading = false;
      state.error = error.message || "REPORT_LOAD_FAILED";
      shell.setContent(render(state, i18n, text), { focus: true });
      bind();
    }
  };
  window.addEventListener("pagehide", () => clearTimeout(exportPollTimer), { once: true });
  await load();
}
