import * as XLSX from "xlsx";

const TZ = "Asia/Ho_Chi_Minh";
const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;
const EXPORT_ROW_LIMIT = 50000;

const REPORT_TYPES = new Set([
  "overview",
  "employees",
  "departments",
  "courses",
  "learning-paths",
  "compliance",
  "certificates",
  "quizzes",
  "training-sessions",
  "competencies",
  "development-plans",
]);

const SORT_FIELDS = {
  employees: new Set(["employee", "department", "completionRate", "overdue", "lastActivityAt"]),
  departments: new Set(["department", "totalEmployees", "completionRate", "overdue"]),
  courses: new Set(["course", "completionRate", "assigned", "overdue"]),
  "learning-paths": new Set(["learningPath", "averageProgress", "assigned", "overdue"]),
  compliance: new Set(["program", "cycle", "completionRate", "onTimeRate", "overdue"]),
  certificates: new Set(["certificateType", "employee", "expiresAt", "status"]),
  quizzes: new Set(["quiz", "attempts", "averageScore", "passRate"]),
  "training-sessions": new Set(["title", "startAt", "registered", "attendanceRate"]),
  competencies: new Set(["competency", "met", "minorGap", "significantGap", "notAssessed"]),
  "development-plans": new Set(["employee", "status", "totalItems", "completedItems", "dueAt"]),
};

const STATUS_FIELDS = new Set([
  "notStarted",
  "inProgress",
  "completed",
  "overdue",
  "pending",
  "verified",
  "expired",
  "missing",
  "failed",
  "exempted",
  "revoked",
  "rejected",
  "draft",
  "active",
  "cancelled",
  "archived",
]);

export function isReportType(value) {
  return REPORT_TYPES.has(value);
}

export function vnDayBounds(dateText) {
  const d = String(dateText || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const start = new Date(`${d}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime())) return null;
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatVnDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function defaultRange() {
  const to = formatVnDate();
  const start = new Date(`${to}T00:00:00+07:00`);
  start.setDate(start.getDate() - 29);
  return { fromDate: formatVnDate(start), toDate: to };
}

export function parseReportFilters(url, reportType = "overview") {
  const defaults = defaultRange();
  const fromDate = url.searchParams.get("from_date") || defaults.fromDate;
  const toDate = url.searchParams.get("to_date") || defaults.toDate;
  const from = vnDayBounds(fromDate);
  const to = vnDayBounds(toDate);
  if (!from || !to || from.start > to.start) {
    const err = new Error("INVALID_DATE_RANGE");
    err.status = 400;
    throw err;
  }

  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") || String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT));
  const sortBy = url.searchParams.get("sortBy") || "";
  const sortDir = url.searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  const allowedSort = SORT_FIELDS[reportType];
  if (sortBy && allowedSort && !allowedSort.has(sortBy)) {
    const err = new Error("INVALID_SORT_FIELD");
    err.status = 400;
    throw err;
  }

  const status = url.searchParams.get("status") || "";
  if (status && !STATUS_FIELDS.has(status)) {
    const err = new Error("INVALID_STATUS");
    err.status = 400;
    throw err;
  }

  return {
    fromDate,
    toDate,
    fromIso: from.start,
    toIsoExclusive: to.end,
    department: url.searchParams.get("department") || "",
    jobTitle: url.searchParams.get("jobTitle") || "",
    employeeId: url.searchParams.get("employeeId") || "",
    courseId: url.searchParams.get("courseId") || "",
    learningPathId: url.searchParams.get("learningPathId") || "",
    complianceProgramId: url.searchParams.get("complianceProgramId") || "",
    complianceCycleId: url.searchParams.get("complianceCycleId") || "",
    certificateTypeId: url.searchParams.get("certificateTypeId") || "",
    status,
    trainingMode: url.searchParams.get("trainingMode") || "",
    expiryWindowDays: Math.min(365, Math.max(1, Number.parseInt(url.searchParams.get("expiryWindowDays") || "30", 10) || 30)),
    q: (url.searchParams.get("q") || "").trim().toLowerCase(),
    page,
    pageSize,
    sortBy,
    sortDir,
  };
}

function normalizeCourse(row) {
  const d = row?.data || {};
  return {
    id: row.id,
    title: d.title || d.name || row.id,
    status: row.status || d.status || "draft",
    deliveryMode: row.delivery_mode || d.deliveryMode || d.format || "",
    durationHours: Number(d.durationHours || d.estimatedHours || 0) || null,
    version: row.current_version_id ? "current" : "",
  };
}

function normalizeEnrollment(row, employees, courses) {
  const d = row?.data || {};
  const due = d.deadline || d.dueAt || d.due_at || null;
  const completedAt = d.completedAt || d.completed_at || (row.status === "completed" ? row.updated_at : null);
  const lastActivityAt = d.lastActivityAt || d.last_activity_at || row.updated_at || row.created_at || null;
  const status = row.status || d.status || "notStarted";
  const overdue = due && new Date() > new Date(`${String(due).slice(0, 10)}T23:59:59+07:00`) && !["completed", "cancelled", "exempted"].includes(status);
  return {
    id: row.id,
    courseId: row.course_id,
    courseVersionId: row.course_version_id || null,
    courseVersion: row.version?.version_number ? `v${row.version.version_number}` : "",
    employeeId: row.account_id,
    status,
    progress: Number(d.progressPercent ?? d.progress_percent ?? (status === "completed" ? 100 : 0)) || 0,
    dueAt: due,
    assignedAt: d.assignedAt || d.assigned_at || row.created_at,
    completedAt,
    lastActivityAt,
    overdue,
    onTime: Boolean(completedAt && due && new Date(completedAt) <= new Date(`${String(due).slice(0, 10)}T23:59:59+07:00`)),
    employee: employees.get(row.account_id) || null,
    course: courses.get(row.course_id) || null,
  };
}

function safeNum(value) {
  return Number.isFinite(value) ? value : 0;
}

function pct(n, d) {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : null;
}

function paginate(items, filters) {
  const total = items.length;
  const start = (filters.page - 1) * filters.pageSize;
  return { rows: items.slice(start, start + filters.pageSize), total, page: filters.page, pageSize: filters.pageSize };
}

function sortRows(rows, field, dir) {
  if (!field) return rows;
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[field] ?? "";
    const bv = b[field] ?? "";
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
    return String(av).localeCompare(String(bv), "vi") * sign;
  });
}

function applyEmployeeFilters(employees, filters) {
  return [...employees.values()].filter((e) => {
    if (filters.department && e.department !== filters.department) return false;
    if (filters.jobTitle && e.jobTitle !== filters.jobTitle) return false;
    if (filters.employeeId && e.id !== filters.employeeId) return false;
    if (filters.q && !`${e.fullName} ${e.employeeCode} ${e.email} ${e.department} ${e.jobTitle}`.toLowerCase().includes(filters.q)) return false;
    return true;
  });
}

async function fetchBase(supabase) {
  const [profilesRes, coursesRes, enrollmentsRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, employee_code, department, position, role, account_status, last_login_at, notes").eq("role", "employee").limit(5000),
    supabase.from("courses").select("id, status, delivery_mode, data, updated_at, current_version_id").limit(5000),
    supabase.from("enrollments").select("id, course_id, course_version_id, account_id, status, data, version:course_versions(version_number,status)").limit(20000),
  ]);
  for (const res of [profilesRes, coursesRes, enrollmentsRes]) {
    if (res.error) throw new Error(res.error.message);
  }
  const employees = new Map((profilesRes.data || [])
    .filter((row) => row.account_status !== "disabled" && !String(row.notes || "").includes('"soft_deleted":true'))
    .map((row) => [row.id, {
      id: row.id,
      fullName: row.full_name || "",
      email: row.email || "",
      employeeCode: row.employee_code || "",
      department: row.department || "",
      jobTitle: row.position || "",
      lastLoginAt: row.last_login_at || null,
    }]));
  const courses = new Map((coursesRes.data || []).map((row) => [row.id, normalizeCourse(row)]));
  const enrollments = (enrollmentsRes.data || []).map((row) => normalizeEnrollment(row, employees, courses)).filter((row) => row.employee);
  return { employees, courses, enrollments };
}

function filterEnrollments(enrollments, filters) {
  return enrollments.filter((e) => {
    if (filters.department && e.employee?.department !== filters.department) return false;
    if (filters.jobTitle && e.employee?.jobTitle !== filters.jobTitle) return false;
    if (filters.employeeId && e.employeeId !== filters.employeeId) return false;
    if (filters.courseId && e.courseId !== filters.courseId) return false;
    if (filters.status) {
      const s = e.overdue ? "overdue" : e.status;
      if (s !== filters.status) return false;
    }
    const activityDate = e.completedAt || e.lastActivityAt || e.assignedAt;
    if (activityDate && (activityDate < filters.fromIso || activityDate >= filters.toIsoExclusive)) return false;
    return true;
  });
}

export async function getOverviewReport(supabase, filters) {
  const base = await fetchBase(supabase);
  const employees = applyEmployeeFilters(base.employees, filters);
  const employeeIds = new Set(employees.map((e) => e.id));
  const enrollments = filterEnrollments(base.enrollments, filters).filter((e) => employeeIds.has(e.employeeId));
  const completed = enrollments.filter((e) => e.status === "completed").length;
  const deadlineAssignments = enrollments.filter((e) => e.dueAt).length;
  const onTime = enrollments.filter((e) => e.onTime).length;
  const overdue = enrollments.filter((e) => e.overdue).length;
  const activeLearners = new Set(enrollments.filter((e) => e.lastActivityAt && e.lastActivityAt >= filters.fromIso && e.lastActivityAt < filters.toIsoExclusive).map((e) => e.employeeId)).size;
  const trendMap = new Map();
  for (const e of enrollments.filter((x) => x.status === "completed" && x.completedAt)) {
    const day = formatVnDate(new Date(e.completedAt));
    trendMap.set(day, (trendMap.get(day) || 0) + 1);
  }
  const departmentRows = buildDepartmentRows(base, filters).rows.slice(0, 8);
  return {
    filters,
    metrics: {
      totalEmployees: employees.length,
      activeLearners,
      openCourses: [...base.courses.values()].filter((c) => c.status === "published").length,
      completionRate: pct(completed, enrollments.length),
      onTimeCompletionRate: pct(onTime, deadlineAssignments),
      totalCompletions: completed,
      estimatedLearningHours: null,
      overdueLearners: new Set(enrollments.filter((e) => e.overdue).map((e) => e.employeeId)).size,
      totalAssignments: enrollments.length,
    },
    trend: [...trendMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, completions]) => ({ date, completions })),
    departmentComparison: departmentRows,
    priorityExceptions: buildPriorityExceptions(base, filters),
  };
}

function buildPriorityExceptions(base, filters) {
  const overdueCourses = filterEnrollments(base.enrollments, filters).filter((e) => e.overdue).slice(0, 10).map((e) => ({
    type: "course_overdue",
    employee: e.employee?.fullName || "",
    department: e.employee?.department || "",
    title: e.course?.title || e.courseId,
    dueAt: e.dueAt,
  }));
  return overdueCourses;
}

function buildEmployeeRows(base, filters) {
  const employees = applyEmployeeFilters(base.employees, filters);
  const byEmployee = new Map(employees.map((e) => [e.id, []]));
  for (const e of filterEnrollments(base.enrollments, filters)) {
    if (byEmployee.has(e.employeeId)) byEmployee.get(e.employeeId).push(e);
  }
  const rows = employees.map((employee) => {
    const rows = byEmployee.get(employee.id) || [];
    const completed = rows.filter((e) => e.status === "completed").length;
    const inProgress = rows.filter((e) => e.status === "inProgress").length;
    const notStarted = rows.filter((e) => e.status === "notStarted").length;
    const overdue = rows.filter((e) => e.overdue).length;
    return {
      employee: employee.fullName,
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      department: employee.department,
      jobTitle: employee.jobTitle,
      assigned: rows.length,
      completed,
      inProgress,
      notStarted,
      overdue,
      completionRate: pct(completed, rows.length),
      lastActivityAt: rows.map((e) => e.lastActivityAt).filter(Boolean).sort().at(-1) || null,
    };
  });
  return { rows: sortRows(rows, filters.sortBy, filters.sortDir), total: rows.length };
}

function buildDepartmentRows(base, filters) {
  const employees = applyEmployeeFilters(base.employees, { ...filters, department: "" });
  const employeeByDept = new Map();
  for (const e of employees) {
    const dept = e.department || "Chưa cập nhật";
    employeeByDept.set(dept, [...(employeeByDept.get(dept) || []), e.id]);
  }
  const rows = [...employeeByDept.entries()]
    .filter(([dept]) => !filters.department || dept === filters.department)
    .map(([department, ids]) => {
      const idSet = new Set(ids);
      const assignments = filterEnrollments(base.enrollments, { ...filters, department: "" }).filter((e) => idSet.has(e.employeeId));
      const completed = assignments.filter((e) => e.status === "completed").length;
      const onTime = assignments.filter((e) => e.onTime).length;
      const deadlineAssignments = assignments.filter((e) => e.dueAt).length;
      const assignedEmployees = new Set(assignments.map((e) => e.employeeId)).size;
      return {
        department,
        totalEmployees: ids.length,
        assigned: assignments.length,
        completed,
        completedOnTime: onTime,
        overdue: assignments.filter((e) => e.overdue).length,
        completionRate: pct(completed, assignments.length),
        participationRate: pct(assignedEmployees, ids.length),
        onTimeRate: pct(onTime, deadlineAssignments),
      };
    });
  return { rows: sortRows(rows, filters.sortBy, filters.sortDir), total: rows.length };
}

function buildCourseRows(base, filters) {
  const assignments = filterEnrollments(base.enrollments, filters);
  const byCourse = new Map();
  for (const e of assignments) byCourse.set(e.courseId, [...(byCourse.get(e.courseId) || []), e]);
  const rows = [...byCourse.entries()].map(([courseId, rows]) => {
    const course = base.courses.get(courseId);
    const completed = rows.filter((e) => e.status === "completed").length;
    return {
      course: course?.title || courseId,
      courseId,
      version: rows.find((e) => e.courseVersion)?.courseVersion || course?.version || "",
      status: course?.status || "",
      assigned: rows.length,
      notStarted: rows.filter((e) => e.status === "notStarted").length,
      inProgress: rows.filter((e) => e.status === "inProgress").length,
      completed,
      overdue: rows.filter((e) => e.overdue).length,
      completionRate: pct(completed, rows.length),
      averageQuizScore: null,
      averageCompletionDays: null,
    };
  });
  return { rows: sortRows(rows, filters.sortBy, filters.sortDir), total: rows.length };
}

async function buildLearningPathRows(supabase, base, filters) {
  const [pathsRes, assRes] = await Promise.all([
    supabase.from("learning_paths").select("id, title, status, data, current_version_id").limit(5000),
    supabase.from("learning_path_assignments").select("id, learning_path_id, learning_path_version_id, employee_id, status, progress_percent, due_at, completed_at, updated_at, data, version:learning_path_versions(version_number,status)").limit(20000),
  ]);
  for (const res of [pathsRes, assRes]) if (res.error) throw new Error(res.error.message);
  const paths = new Map((pathsRes.data || []).map((p) => [p.id, p]));
  const employees = applyEmployeeFilters(base.employees, filters);
  const employeeIds = new Set(employees.map((e) => e.id));
  const byPath = new Map();
  for (const a of assRes.data || []) {
    if (!employeeIds.has(a.employee_id)) continue;
    if (filters.learningPathId && a.learning_path_id !== filters.learningPathId) continue;
    const due = a.due_at || a.data?.dueAt || null;
    const overdue = due && new Date() > new Date(due) && !["completed", "cancelled", "exempted"].includes(a.status);
    byPath.set(a.learning_path_id, [...(byPath.get(a.learning_path_id) || []), { ...a, overdue }]);
  }
  const rows = [...byPath.entries()].map(([pathId, rows]) => {
    const path = paths.get(pathId);
    const completed = rows.filter((r) => r.status === "completed").length;
    return {
      learningPath: path?.title || path?.data?.title || pathId,
      learningPathId: pathId,
      version: rows.find((r) => r.version?.version_number)?.version?.version_number ? `v${rows.find((r) => r.version?.version_number).version.version_number}` : "",
      assigned: rows.length,
      notStarted: rows.filter((r) => r.status === "not_started" || r.status === "notStarted").length,
      inProgress: rows.filter((r) => r.status === "in_progress" || r.status === "inProgress").length,
      completed,
      overdue: rows.filter((r) => r.overdue).length,
      averageProgress: rows.length ? Math.round(rows.reduce((sum, r) => sum + (Number(r.progress_percent ?? r.data?.progressPercent ?? 0) || 0), 0) / rows.length) : null,
      bottleneckStep: null,
    };
  });
  return { rows: sortRows(rows, filters.sortBy, filters.sortDir), total: rows.length };
}

async function buildComplianceRows(supabase, base, filters) {
  const [programsRes, cyclesRes, assRes, recordsRes] = await Promise.all([
    supabase.from("compliance_programs").select("id, name, status").limit(5000),
    supabase.from("compliance_cycles").select("id, program_id, name, title, status, resource_version_id").limit(5000),
    supabase.from("compliance_assignments").select("id, cycle_id, employee_id, status, due_at, completed_at, progress_percent, resource_version_id").limit(30000),
    supabase.from("compliance_completion_records").select("assignment_id, cycle_id, employee_id, completed_at, was_completed_on_time, resource_version_id").limit(30000),
  ]);
  for (const res of [programsRes, cyclesRes, assRes, recordsRes]) if (res.error) throw new Error(res.error.message);
  const programs = new Map((programsRes.data || []).map((p) => [p.id, p]));
  const cycles = new Map((cyclesRes.data || []).map((c) => [c.id, c]));
  const completionByAssignment = new Map((recordsRes.data || []).map((r) => [r.assignment_id, r]));
  const employees = new Set(applyEmployeeFilters(base.employees, filters).map((e) => e.id));
  const byCycle = new Map();
  for (const a of assRes.data || []) {
    if (!employees.has(a.employee_id)) continue;
    const cycle = cycles.get(a.cycle_id);
    if (!cycle) continue;
    if (filters.complianceProgramId && cycle.program_id !== filters.complianceProgramId) continue;
    if (filters.complianceCycleId && a.cycle_id !== filters.complianceCycleId) continue;
    byCycle.set(a.cycle_id, [...(byCycle.get(a.cycle_id) || []), a]);
  }
  const rows = [...byCycle.entries()].map(([cycleId, rows]) => {
    const cycle = cycles.get(cycleId);
    const program = programs.get(cycle?.program_id);
    const completedRecords = rows.map((r) => completionByAssignment.get(r.id)).filter(Boolean);
    const completedOnTime = completedRecords.filter((r) => r.was_completed_on_time).length;
    const completedLate = completedRecords.filter((r) => !r.was_completed_on_time).length;
    const denominator = rows.filter((r) => !["cancelled", "exempted"].includes(r.status)).length;
    return {
      program: program?.name || cycle?.program_id || "",
      cycle: cycle?.name || cycle?.title || cycleId,
      cycleId,
      version: rows.find((r) => r.resource_version_id)?.resource_version_id || cycle?.resource_version_id || "",
      targetEmployees: rows.length,
      notStarted: rows.filter((r) => r.status === "not_started").length,
      inProgress: rows.filter((r) => r.status === "in_progress").length,
      completedOnTime,
      completedLate,
      overdue: rows.filter((r) => r.status === "overdue" || (r.due_at && new Date() > new Date(r.due_at) && !["completed", "cancelled", "exempted"].includes(r.status))).length,
      failed: rows.filter((r) => r.status === "failed").length,
      exempted: rows.filter((r) => r.status === "exempted").length,
      completionRate: pct(completedRecords.length, denominator),
      onTimeRate: pct(completedOnTime, rows.filter((r) => r.due_at && !["cancelled", "exempted"].includes(r.status)).length),
    };
  });
  return { rows: sortRows(rows, filters.sortBy, filters.sortDir), total: rows.length };
}

async function buildCertificateRows(supabase, base, filters) {
  const [typesRes, certsRes, reqRes] = await Promise.all([
    supabase.from("certificate_types").select("id, code, name, status").limit(5000),
    supabase.from("employee_certifications").select("id, account_id, certificate_type_id, name, certificate_type, certificate_number, issuer, issue_date, expiry_date, status, verification_status, rejection_reason, created_at, updated_at").limit(30000),
    supabase.from("certificate_requirements").select("id, certificate_type_id, target_type, target_value, is_required, effective_from, effective_until").eq("is_required", true).limit(10000),
  ]);
  for (const res of [typesRes, certsRes, reqRes]) if (res.error) throw new Error(res.error.message);
  const types = new Map((typesRes.data || []).map((t) => [t.id, t]));
  const employees = applyEmployeeFilters(base.employees, filters);
  const employeeIds = new Set(employees.map((e) => e.id));
  const until = new Date(Date.now() + filters.expiryWindowDays * 86400000);
  const rows = (certsRes.data || []).filter((c) => employeeIds.has(c.account_id)).filter((c) => !filters.certificateTypeId || c.certificate_type_id === filters.certificateTypeId).map((c) => {
    const employee = base.employees.get(c.account_id);
    const type = types.get(c.certificate_type_id);
    const expiresAt = c.expiry_date || null;
    const expired = expiresAt && new Date(`${expiresAt}T23:59:59+07:00`) < new Date();
    const expiringSoon = expiresAt && !expired && new Date(`${expiresAt}T23:59:59+07:00`) <= until;
    return {
      certificateType: type?.name || c.certificate_type || c.name || "Chưa phân loại",
      employee: employee?.fullName || "",
      employeeCode: employee?.employeeCode || "",
      department: employee?.department || "",
      verified: c.verification_status === "verified" || c.verification_status === "approved",
      pending: ["submitted", "pending", "in_review"].includes(c.verification_status),
      expiringSoon: Boolean(expiringSoon),
      expired: Boolean(expired || c.status === "expired"),
      missingRequired: false,
      rejected: c.verification_status === "rejected",
      revoked: c.status === "revoked",
      expiresAt,
      status: c.status,
      verificationStatus: c.verification_status,
    };
  });
  const validByEmployeeType = new Set((certsRes.data || []).filter((c) => employeeIds.has(c.account_id) && ["verified", "approved"].includes(c.verification_status) && !["revoked", "expired", "pending"].includes(c.status)).map((c) => `${c.account_id}:${c.certificate_type_id}`));
  const missing = [];
  for (const req of reqRes.data || []) {
    const matchedEmployees = employees.filter((e) => req.target_type === "all_employees" || (req.target_type === "department" && e.department === req.target_value) || (req.target_type === "job_title" && e.jobTitle === req.target_value) || (req.target_type === "individual" && e.id === req.target_value));
    for (const e of matchedEmployees) {
      if (!validByEmployeeType.has(`${e.id}:${req.certificate_type_id}`)) {
        missing.push({
          certificateType: types.get(req.certificate_type_id)?.name || req.certificate_type_id,
          employee: e.fullName,
          employeeCode: e.employeeCode,
          department: e.department,
          verified: false,
          pending: false,
          expiringSoon: false,
          expired: false,
          missingRequired: true,
          rejected: false,
          revoked: false,
          expiresAt: null,
          status: "missing",
          verificationStatus: "missing",
        });
      }
    }
  }
  const all = [...rows, ...missing].filter((r) => !filters.status || (filters.status === "verified" ? r.verified : filters.status === "pending" ? r.pending : filters.status === "missing" ? r.missingRequired : filters.status === "expired" ? r.expired : filters.status === "revoked" ? r.revoked : filters.status === "rejected" ? r.rejected : r.status === filters.status));
  return { rows: sortRows(all, filters.sortBy, filters.sortDir), total: all.length };
}

async function buildQuizRows(supabase, base, filters) {
  const [quizRes, attemptsRes] = await Promise.all([
    supabase.from("quizzes").select("id, course_id, status, data").limit(5000),
    supabase.from("quiz_attempts").select("id, quiz_id, quiz_version_id, account_id, course_id, score_percent, passed, submitted_at, created_at, data, version:quiz_versions(version_number,status)").limit(30000),
  ]);
  for (const res of [quizRes, attemptsRes]) if (res.error) throw new Error(res.error.message);
  const quizzes = new Map((quizRes.data || []).map((q) => [q.id, q]));
  const employees = new Set(applyEmployeeFilters(base.employees, filters).map((e) => e.id));
  const byQuiz = new Map();
  for (const a of attemptsRes.data || []) {
    if (!employees.has(a.account_id)) continue;
    if (filters.courseId && a.course_id !== filters.courseId) continue;
    const at = a.submitted_at || a.created_at;
    if (at && (at < filters.fromIso || at >= filters.toIsoExclusive)) continue;
    const key = `${a.quiz_id}::${a.quiz_version_id || "current"}`;
    byQuiz.set(key, [...(byQuiz.get(key) || []), a]);
  }
  const rows = [...byQuiz.entries()].map(([key, rows]) => {
    const [quizId] = key.split("::");
    const scores = rows.map((r) => Number(r.score_percent)).filter(Number.isFinite);
    const participants = new Set(rows.map((r) => r.account_id));
    return {
      quiz: quizzes.get(quizId)?.data?.title || quizId,
      quizId,
      version: rows.find((r) => r.version?.version_number)?.version?.version_number ? `v${rows.find((r) => r.version?.version_number).version.version_number}` : "",
      attempts: rows.length,
      participants: participants.size,
      averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      passRate: pct(rows.filter((r) => r.passed).length, rows.length),
      retakes: Math.max(0, rows.length - participants.size),
      hardestQuestion: null,
    };
  });
  return { rows: sortRows(rows, filters.sortBy, filters.sortDir), total: rows.length };
}

async function buildTrainingSessionRows(supabase, base, filters) {
  const [sessionsRes, partsRes, regsRes, attRes] = await Promise.all([
    supabase.from("training_sessions").select("id, course_id, status, start_at, end_at, data").limit(10000),
    supabase.from("training_participants").select("id, session_id, account_id, data").limit(30000),
    supabase.from("training_registrations").select("id, session_id, account_id, data").limit(30000),
    supabase.from("attendance").select("id, slot_id, account_id, status, check_in_at, data, slot:session_slots(session_id)").limit(30000),
  ]);
  for (const res of [sessionsRes, partsRes, regsRes, attRes]) if (res.error) throw new Error(res.error.message);
  const employees = new Set(applyEmployeeFilters(base.employees, filters).map((e) => e.id));
  const partsBySession = new Map();
  for (const p of partsRes.data || []) if (employees.has(p.account_id)) partsBySession.set(p.session_id, [...(partsBySession.get(p.session_id) || []), p]);
  const regsBySession = new Map();
  for (const r of regsRes.data || []) if (employees.has(r.account_id)) regsBySession.set(r.session_id, [...(regsBySession.get(r.session_id) || []), r]);
  const attBySession = new Map();
  for (const a of attRes.data || []) {
    const sessionId = a.slot?.session_id || a.data?.sessionId;
    if (sessionId && employees.has(a.account_id)) attBySession.set(sessionId, [...(attBySession.get(sessionId) || []), a]);
  }
  const rows = (sessionsRes.data || []).filter((s) => !filters.courseId || s.course_id === filters.courseId).filter((s) => !s.start_at || (s.start_at >= filters.fromIso && s.start_at < filters.toIsoExclusive)).map((s) => {
    const d = s.data || {};
    const participants = partsBySession.get(s.id) || [];
    const regs = regsBySession.get(s.id) || [];
    const attendance = attBySession.get(s.id) || [];
    const presentIds = new Set(attendance.filter((a) => a.check_in_at || ["attended", "present"].includes(a.status || a.data?.attendanceStatus)).map((a) => a.account_id));
    const absent = regs.filter((r) => r.data?.attendanceStatus === "absent").length;
    const late = attendance.filter((a) => a.data?.late || a.data?.attendanceStatus === "late").length;
    return {
      title: d.title || d.courseTitle || s.id,
      sessionId: s.id,
      startAt: s.start_at,
      mode: d.meetingUrl ? "online" : "offline",
      registered: Math.max(participants.length, regs.length),
      present: presentIds.size,
      late,
      absent,
      attendanceRate: pct(presentIds.size, Math.max(participants.length, regs.length)),
      status: s.status,
    };
  });
  return { rows: sortRows(rows, filters.sortBy, filters.sortDir), total: rows.length };
}

async function buildCompetencyReportRows(supabase, base, filters) {
  const [compRes, reqRes, evRes, assRes] = await Promise.all([
    supabase.from("competencies").select("id, code, name, category:competency_categories(name)").eq("status", "active").limit(1000),
    supabase.from("competency_requirements").select("competency_id, required_level:competency_levels(rank)").eq("is_mandatory", true).limit(5000),
    supabase.from("employee_competency_evidence").select("employee_id, competency_id, awarded_level:competency_levels(rank), status").eq("status", "active").limit(20000),
    supabase.from("employee_competency_assessments").select("employee_id, competency_id, assessed_level:competency_levels(rank), status, assessment_type").eq("status", "verified").limit(20000),
  ]);
  for (const res of [compRes, reqRes, evRes, assRes]) if (res.error) throw new Error(res.error.message);
  const employeeCount = applyEmployeeFilters(base.employees, filters).length;
  const reqByComp = new Map();
  for (const req of reqRes.data || []) reqByComp.set(req.competency_id, Math.max(reqByComp.get(req.competency_id) || 0, req.required_level?.rank || 0));
  const effective = new Map();
  for (const ev of evRes.data || []) effective.set(`${ev.employee_id}:${ev.competency_id}`, Math.max(effective.get(`${ev.employee_id}:${ev.competency_id}`) || 0, ev.awarded_level?.rank || 0));
  for (const ass of assRes.data || []) if (["hr", "system"].includes(ass.assessment_type)) effective.set(`${ass.employee_id}:${ass.competency_id}`, Math.max(effective.get(`${ass.employee_id}:${ass.competency_id}`) || 0, ass.assessed_level?.rank || 0));
  const employees = applyEmployeeFilters(base.employees, filters);
  const rows = (compRes.data || []).map((comp) => {
    const required = reqByComp.get(comp.id) || 0;
    let met = 0, minorGap = 0, significantGap = 0, notAssessed = 0;
    for (const emp of employees) {
      const rank = effective.get(`${emp.id}:${comp.id}`);
      if (rank === undefined) notAssessed += 1;
      else if (Math.max(0, required - rank) === 0) met += 1;
      else if (Math.max(0, required - rank) === 1) minorGap += 1;
      else significantGap += 1;
    }
    return { competency: comp.name, code: comp.code, category: comp.category?.name || "", totalEmployees: employeeCount, met, minorGap, significantGap, notAssessed, coverageRate: pct(met, employeeCount) };
  });
  return { rows: sortRows(rows, filters.sortBy, filters.sortDir), total: rows.length };
}

async function buildDevelopmentPlanReportRows(supabase, base, filters) {
  const { data, error } = await supabase.from("development_plans").select("*, employee:profiles(id, full_name, employee_code, department, position), items:development_plan_items(id,status,due_at,resource_type,resource_id,resource_version_id)").limit(5000);
  if (error) throw new Error(error.message);
  const rows = (data || []).filter((plan) => {
    if (filters.department && plan.employee?.department !== filters.department) return false;
    if (filters.employeeId && plan.employee_id !== filters.employeeId) return false;
    if (filters.status && plan.status !== filters.status) return false;
    return true;
  }).map((plan) => {
    const items = plan.items || [];
    const completed = items.filter((i) => i.status === "completed").length;
    return {
      employee: plan.employee?.full_name || plan.employee_id,
      employeeCode: plan.employee?.employee_code || "",
      department: plan.employee?.department || "",
      jobTitle: plan.employee?.position || "",
      title: plan.title,
      status: plan.status,
      totalItems: items.length,
      completedItems: completed,
      overdueItems: items.filter((i) => i.status === "overdue" || (i.due_at && new Date(i.due_at) < new Date() && !["completed", "cancelled"].includes(i.status))).length,
      progressRate: pct(completed, items.length),
      dueAt: plan.target_end_at || "",
      resourceVersions: items.map((i) => i.resource_version_id).filter(Boolean).join("; "),
    };
  });
  return { rows: sortRows(rows, filters.sortBy, filters.sortDir), total: rows.length };
}

export async function getTableReport(supabase, reportType, filters) {
  const base = await fetchBase(supabase);
  let result;
  if (reportType === "employees") result = buildEmployeeRows(base, filters);
  else if (reportType === "departments") result = buildDepartmentRows(base, filters);
  else if (reportType === "courses") result = buildCourseRows(base, filters);
  else if (reportType === "learning-paths") result = await buildLearningPathRows(supabase, base, filters);
  else if (reportType === "compliance") result = await buildComplianceRows(supabase, base, filters);
  else if (reportType === "certificates") result = await buildCertificateRows(supabase, base, filters);
  else if (reportType === "quizzes") result = await buildQuizRows(supabase, base, filters);
  else if (reportType === "training-sessions") result = await buildTrainingSessionRows(supabase, base, filters);
  else if (reportType === "competencies") result = await buildCompetencyReportRows(supabase, base, filters);
  else if (reportType === "development-plans") result = await buildDevelopmentPlanReportRows(supabase, base, filters);
  else {
    const err = new Error("INVALID_REPORT_TYPE");
    err.status = 400;
    throw err;
  }
  return { filters, ...paginate(result.rows, filters), total: result.total };
}

const HEADERS = {
  employees: ["Nhân viên", "Mã nhân viên", "Phòng ban", "Chức danh", "Nội dung được giao", "Đã hoàn thành", "Đang học", "Chưa bắt đầu", "Quá hạn", "Tỷ lệ hoàn thành", "Lần hoạt động cuối"],
  departments: ["Phòng ban", "Tổng nhân viên", "Được giao", "Hoàn thành", "Hoàn thành đúng hạn", "Quá hạn", "Tỷ lệ hoàn thành", "Tỷ lệ tham gia"],
  courses: ["Tên khóa học", "Phiên bản", "Trạng thái", "Số người được giao", "Chưa bắt đầu", "Đang học", "Hoàn thành", "Quá hạn", "Tỷ lệ hoàn thành", "Điểm quiz TB", "Thời gian hoàn thành TB"],
  "learning-paths": ["Learning Path", "Phiên bản", "Số người được giao", "Chưa bắt đầu", "Đang học", "Hoàn thành", "Quá hạn", "Tiến độ trung bình", "Step gây nghẽn"],
  compliance: ["Program", "Cycle", "Resource version", "Target employees", "Not started", "In progress", "Completed on time", "Completed late", "Overdue", "Failed", "Exempted", "Completion rate", "On-time rate"],
  certificates: ["Loại chứng chỉ", "Nhân viên", "Mã nhân viên", "Phòng ban", "Đã xác minh", "Chờ xác minh", "Sắp hết hạn", "Đã hết hạn", "Thiếu bắt buộc", "Bị từ chối", "Bị thu hồi", "Ngày hết hạn"],
  quizzes: ["Quiz", "Phiên bản", "Số lượt thi", "Số người thi", "Điểm trung bình", "Tỷ lệ đạt", "Số lần thi lại", "Câu hỏi sai cao"],
  "training-sessions": ["Tên lớp", "Ngày tổ chức", "Hình thức", "Số đăng ký", "Có mặt", "Đi trễ", "Vắng mặt", "Tỷ lệ tham gia"],
  competencies: ["Năng lực", "Mã", "Danh mục", "Tổng nhân viên", "Đạt", "Thiếu nhẹ", "Thiếu đáng kể", "Chưa đánh giá", "Tỷ lệ đạt"],
  "development-plans": ["Nhân viên", "Mã nhân viên", "Phòng ban", "Chức danh", "Kế hoạch", "Trạng thái", "Tổng mục", "Đã hoàn thành", "Quá hạn", "Tiến độ", "Hạn", "Resource versions"],
};

function rowToArray(type, r) {
  if (type === "employees") return [r.employee, r.employeeCode, r.department, r.jobTitle, r.assigned, r.completed, r.inProgress, r.notStarted, r.overdue, r.completionRate, r.lastActivityAt];
  if (type === "departments") return [r.department, r.totalEmployees, r.assigned, r.completed, r.completedOnTime, r.overdue, r.completionRate, r.participationRate];
  if (type === "courses") return [r.course, r.version, r.status, r.assigned, r.notStarted, r.inProgress, r.completed, r.overdue, r.completionRate, r.averageQuizScore, r.averageCompletionDays];
  if (type === "learning-paths") return [r.learningPath, r.version, r.assigned, r.notStarted, r.inProgress, r.completed, r.overdue, r.averageProgress, r.bottleneckStep];
  if (type === "compliance") return [r.program, r.cycle, r.version, r.targetEmployees, r.notStarted, r.inProgress, r.completedOnTime, r.completedLate, r.overdue, r.failed, r.exempted, r.completionRate, r.onTimeRate];
  if (type === "certificates") return [r.certificateType, r.employee, r.employeeCode, r.department, r.verified, r.pending, r.expiringSoon, r.expired, r.missingRequired, r.rejected, r.revoked, r.expiresAt];
  if (type === "quizzes") return [r.quiz, r.version, r.attempts, r.participants, r.averageScore, r.passRate, r.retakes, r.hardestQuestion];
  if (type === "training-sessions") return [r.title, r.startAt, r.mode, r.registered, r.present, r.late, r.absent, r.attendanceRate];
  if (type === "competencies") return [r.competency, r.code, r.category, r.totalEmployees, r.met, r.minorGap, r.significantGap, r.notAssessed, r.coverageRate];
  if (type === "development-plans") return [r.employee, r.employeeCode, r.department, r.jobTitle, r.title, r.status, r.totalItems, r.completedItems, r.overdueItems, r.progressRate, r.dueAt, r.resourceVersions];
  return Object.values(r);
}

function escapeFormula(value) {
  if (typeof value !== "string") return value;
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value) {
  const text = String(escapeFormula(value ?? ""));
  return `"${text.replaceAll('"', '""')}"`;
}

function pdfText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[\\()]/g, "\\$&");
}

function simplePdf(lines) {
  const content = [
    "BT",
    "/F1 16 Tf",
    "50 790 Td",
    `(${pdfText(lines[0] || "Training report")}) Tj`,
    "/F1 10 Tf",
    ...lines.slice(1, 42).flatMap((line) => ["0 -16 Td", `(${pdfText(line).slice(0, 110)}) Tj`]),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, idx) => {
    offsets.push(pdf.length);
    pdf += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

export async function exportReport(supabase, reportType, format, filters) {
  if (!["csv", "xlsx", "pdf"].includes(format)) {
    const err = new Error("INVALID_FORMAT");
    err.status = 400;
    throw err;
  }
  const exportFilters = { ...filters, page: 1, pageSize: EXPORT_ROW_LIMIT };
  const data = reportType === "overview"
    ? await getOverviewReport(supabase, exportFilters)
    : await getTableReport(supabase, reportType, exportFilters);
  const rows = reportType === "overview"
    ? [
        ["Chỉ số", "Giá trị"],
        ...Object.entries(data.metrics).map(([k, v]) => [k, v]),
      ]
    : [HEADERS[reportType], ...data.rows.map((r) => rowToArray(reportType, r))];
  const fileBase = `bao-cao-${reportType}-${formatVnDate().replaceAll("-", "")}`;
  const rowCount = Math.max(0, rows.length - 1);

  if (format === "csv") {
    const csv = "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    return { body: csv, contentType: "text/csv; charset=utf-8", filename: `${fileBase}.csv`, rowCount };
  }
  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const summary = XLSX.utils.aoa_to_sheet([
      ["Báo cáo", reportType],
      ["Từ ngày", filters.fromDate],
      ["Đến ngày", filters.toDate],
      ["Ngày xuất", new Date().toISOString()],
    ]);
    XLSX.utils.book_append_sheet(wb, summary, "Summary");
    const safeRows = rows.map((r) => r.map(escapeFormula));
    const ws = XLSX.utils.aoa_to_sheet(safeRows);
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, safeRows.length - 1), c: Math.max(0, (safeRows[0] || []).length - 1) } }) };
    ws["!cols"] = (safeRows[0] || []).map(() => ({ wch: 22 }));
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws, "Detail");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true });
    return { body: buf, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: `${fileBase}.xlsx`, rowCount };
  }
  const pdfLines = [
    `Bao cao ${reportType}`,
    `Ky bao cao: ${filters.fromDate} - ${filters.toDate}`,
    `Ngay xuat: ${new Date().toLocaleString("vi-VN", { timeZone: TZ })}`,
    "",
    ...rows.slice(0, 36).map((row) => row.map((cell) => String(cell ?? "")).join(" | ")),
  ];
  return { body: simplePdf(pdfLines), contentType: "application/pdf", filename: `${fileBase}.pdf`, rowCount };
}
