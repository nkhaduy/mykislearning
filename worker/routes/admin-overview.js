import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { verifySession } from "./auth.js";

const ACTIVE_EMPLOYEE_STATUSES = ["active"];
const OPEN_TASK_STATUSES = ["new", "in_progress"];
const LEARNING_TYPES = ["course_view", "content_view", "quiz_attempt"];

function todayVnBounds() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date()).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  const start = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function cutoffIso(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function taskStatusLabel(status) {
  return ({ new: "Mới", in_progress: "Đang xử lý", done: "Đã hoàn tất", rejected: "Từ chối" })[status] || status;
}

function taskTypeLabel(type) {
  return ({
    password_reset: "Reset mật khẩu",
    account_unlock: "Mở khóa tài khoản",
    external_training: "Đào tạo bên ngoài",
    certification: "Chứng chỉ",
    course_approval: "Duyệt khóa học",
    assignment: "Tác vụ HR",
    data_issue: "Lỗi dữ liệu",
    // Account support request types
    forgot_password: "Quên mật khẩu",
    unlock_account: "Mở khóa tài khoản",
    reactivate_account: "Kích hoạt lại tài khoản",
    login_issue: "Lỗi đăng nhập",
    account_access: "Yêu cầu truy cập",
  })[type] || "Yêu cầu";
}

function priorityLabel(priority) {
  return ({ low: "Thấp", normal: "Bình thường", high: "Cao", urgent: "Khẩn cấp" })[priority] || "Bình thường";
}

function mapProfile(row) {
  return {
    id: row.id,
    fullName: row.full_name || "",
    email: row.email || "",
    department: row.department || "",
    position: row.position || "",
  };
}

function mapTask(row) {
  return {
    id: row.id,
    taskType: row.task_type,
    taskTypeLabel: taskTypeLabel(row.task_type),
    requester: row.requester ? mapProfile(row.requester) : null,
    title: row.title || taskTypeLabel(row.task_type),
    description: row.description || "",
    priority: row.priority || "normal",
    priorityLabel: priorityLabel(row.priority),
    status: row.status || "new",
    statusLabel: taskStatusLabel(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    referenceType: row.reference_type || "",
    referenceId: row.reference_id || "",
  };
}

function activeEmployeesQuery(supabase) {
  return supabase
    .from("profiles")
    .select("id, full_name, email, department, position, last_login_at, created_at", { count: "exact" })
    .eq("role", "employee")
    .in("account_status", ACTIVE_EMPLOYEE_STATUSES)
    .not("notes", "ilike", '%"is_demo":true%')
    .not("notes", "ilike", '%"soft_deleted":true%')
    .order("full_name", { ascending: true });
}

export async function handleAdminOverview(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const acct = await verifySession(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);
  if (!["hr", "admin"].includes(acct.role)) return json({ error: "HR_ONLY" }, 403);

  const supabase = getSupabase(env);
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/admin/tasks") {
    if (method === "PATCH") {
      const body = await readJson(request);
      const id = String(body.id || "");
      const status = String(body.status || "");
      if (!id || !["new", "in_progress", "done", "rejected"].includes(status)) {
        return json({ error: "INVALID_TASK_STATUS" }, 400);
      }
      const patch = {
        status,
        updated_at: new Date().toISOString(),
        ...(status === "done" || status === "rejected" ? { resolved_at: new Date().toISOString(), resolved_by: acct.accountId } : {}),
      };
      const { data, error } = await supabase.from("hr_tasks").update(patch).eq("id", id).select("*, requester:profiles!hr_tasks_requester_account_id_fkey(id, full_name, email, department, position)").single();
      if (error) return json({ error: "TASK_UPDATE_FAILED", message: error.message }, 500);
      return json({ task: mapTask(data) });
    }
    return methodNotAllowed();
  }

  if (method !== "GET") return methodNotAllowed();

  const onlineCutoff = cutoffIso(5);
  const { start, end } = todayVnBounds();

  const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const [employeesRes, activeIdsRes, todayActivityRes, onlineActivityRes, learningActivityRes, allActivityRes, taskRes, coursesRes, enrollmentRes, upcomingSessionsRes] = await Promise.all([
    activeEmployeesQuery(supabase).limit(1000),
    supabase.from("profiles").select("id").eq("role", "employee").in("account_status", ACTIVE_EMPLOYEE_STATUSES).not("notes", "ilike", '%"is_demo":true%').not("notes", "ilike", '%"soft_deleted":true%'),
    supabase.from("user_activity").select("account_id").gte("last_seen_at", start).lt("last_seen_at", end),
    supabase.from("user_activity").select("account_id").gte("last_seen_at", onlineCutoff).is("ended_at", null),
    supabase.from("user_activity").select("account_id, activity_type, course_id, started_at, last_seen_at, page_path, metadata").gte("last_seen_at", onlineCutoff).is("ended_at", null).in("activity_type", LEARNING_TYPES).order("last_seen_at", { ascending: false }),
    supabase.from("user_activity").select("account_id, last_seen_at").order("last_seen_at", { ascending: false }).limit(5000),
    supabase.from("hr_tasks").select("*, requester:profiles!hr_tasks_requester_account_id_fkey(id, full_name, email, department, position)").order("created_at", { ascending: false }).limit(20),
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("enrollments").select("status", { count: "exact" }).limit(5000),
    supabase.from("training_sessions").select("id, course_id, status, start_at, end_at, data").gte("start_at", new Date().toISOString()).lte("start_at", in14Days).not("status", "in", '("cancelled","draft")').order("start_at", { ascending: true }).limit(5),
  ]);

  for (const res of [employeesRes, activeIdsRes, todayActivityRes, onlineActivityRes, learningActivityRes, allActivityRes, taskRes, coursesRes]) {
    if (res.error) return json({ error: "OVERVIEW_QUERY_FAILED", message: res.error.message }, 500);
  }

  const activeEmployeeIds = new Set((activeIdsRes.data || []).map((row) => row.id));
  const visitedToday = new Set((todayActivityRes.data || []).map((row) => row.account_id).filter((id) => activeEmployeeIds.has(id))).size;
  const onlineIds = new Set((onlineActivityRes.data || []).map((row) => row.account_id).filter((id) => activeEmployeeIds.has(id)));
  const lastSeenByAccount = new Map();
  for (const row of allActivityRes.data || []) {
    if (!lastSeenByAccount.has(row.account_id)) lastSeenByAccount.set(row.account_id, row.last_seen_at);
  }
  const learningLatest = new Map();
  for (const row of learningActivityRes.data || []) {
    if (!activeEmployeeIds.has(row.account_id) || learningLatest.has(row.account_id)) continue;
    learningLatest.set(row.account_id, row);
  }

  const employeeMap = new Map((employeesRes.data || []).map((row) => [row.id, row]));
  const inactiveEmployees = [...employeeMap.values()].map((employee) => {
    const last = lastSeenByAccount.get(employee.id) || employee.last_login_at || null;
    const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
    let status = "Chưa từng truy cập";
    if (days !== null && days >= 7 && days <= 14) status = "7-14 ngày";
    else if (days !== null && days >= 15 && days <= 30) status = "15-30 ngày";
    else if (days !== null && days > 30) status = "Trên 30 ngày";
    return { ...mapProfile(employee), lastSeenAt: last, daysInactive: days, status };
  }).sort((a, b) => {
    if (!a.lastSeenAt && b.lastSeenAt) return -1;
    if (a.lastSeenAt && !b.lastSeenAt) return 1;
    return String(a.lastSeenAt || "").localeCompare(String(b.lastSeenAt || ""));
  }).slice(0, 8);

  const tasks = (taskRes.data || []).map(mapTask);
  const openTasks = tasks.filter((task) => OPEN_TASK_STATUSES.includes(task.status));
  const onlineLearning = [...learningLatest.entries()].map(([accountId, row]) => {
    const employee = employeeMap.get(accountId) || {};
    const startedAt = row.started_at || row.last_seen_at;
    return {
      ...mapProfile(employee),
      accountId,
      courseId: row.course_id || "",
      activityType: row.activity_type,
      activityLabel: row.activity_type === "quiz_attempt" ? "Đang làm quiz" : row.activity_type === "content_view" ? "Đang xem nội dung" : "Đang mở khóa học",
      title: row.metadata?.title || "",
      pagePath: row.page_path || "",
      startedAt,
      lastSeenAt: row.last_seen_at,
      durationSeconds: Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)),
    };
  });

  const allEnrollments = enrollmentRes.data || [];
  const completedCount = allEnrollments.filter((e) => e.status === "completed").length;
  const totalEnrollments = allEnrollments.length;
  const completionRate = totalEnrollments > 0 ? Math.round((completedCount / totalEnrollments) * 100) : null;

  const upcomingSessions = (upcomingSessionsRes.data || []).map((row) => {
    const d = row.data || {};
    return {
      id: row.id,
      title: d.title || "",
      courseId: row.course_id || "",
      courseTitle: d.courseTitle || d.courseName || "",
      startAt: row.start_at,
      endAt: row.end_at,
      locationName: d.locationName || "",
      meetingUrl: d.meetingUrl || "",
      mode: d.meetingUrl ? "online" : "offline",
      status: row.status,
      capacity: d.capacity || 0,
    };
  });

  return json({
    totalEmployees: employeesRes.count || activeEmployeeIds.size,
    visitedToday,
    onlineNow: onlineIds.size,
    learningNow: onlineLearning.length,
    pendingActions: openTasks.length,
    inactiveEmployees: inactiveEmployees.length,
    activeCourseCount: coursesRes.count || 0,
    completionRate,
    completedEnrollments: completedCount,
    totalEnrollments,
    tasks,
    onlineLearning,
    inactiveEmployeeRows: inactiveEmployees,
    upcomingSessions,
  });
}
