import { apiJson } from "../../shared/api/client.js";
import { createI18n, formatDateTime, formatNumber } from "../../shared/i18n/runtime.js";
import { createRouteShell, escapeAttribute, escapeHtml } from "../../shared/ui/route-shell.js";

const copy = {
  vi: {
    title: "Tổng quan quản trị", eyebrow: "HR / L&D Control Room", intro: "Theo dõi vận hành học tập, ưu tiên xử lý và hoạt động gần thời gian thực.",
    employees: "Nhân viên hoạt động", visited: "Truy cập hôm nay", online: "Đang online", learning: "Đang học", actions: "Việc cần xử lý", courses: "Khóa đang mở", completion: "Tỷ lệ hoàn thành",
    tasks: "Hàng đợi xử lý", taskCaption: "Các yêu cầu HR cần xử lý", requester: "Người yêu cầu", priority: "Ưu tiên", status: "Trạng thái", created: "Thời gian", action: "Thao tác", done: "Hoàn tất",
    live: "Nhân viên đang học", inactive: "Cần tái tương tác", upcoming: "Buổi học sắp tới", noData: "Không có dữ liệu trong nhóm này.",
    refresh: "Cập nhật", refreshed: "Đã cập nhật tổng quan quản trị", retry: "Thử lại", loadError: "Không thể tải tổng quan quản trị.",
    quick: "Thao tác nhanh", employeesLink: "Quản lý nhân viên", coursesLink: "Quản lý khóa học", reportsLink: "Mở báo cáo", restricted: "Tài khoản này không có quyền quản trị.", learner: "Đi đến không gian học viên",
  },
  en: {
    title: "Administration overview", eyebrow: "HR / L&D Control Room", intro: "Monitor learning operations, action priorities, and near-real-time activity.",
    employees: "Active employees", visited: "Visited today", online: "Online now", learning: "Learning now", actions: "Pending actions", courses: "Open courses", completion: "Completion rate",
    tasks: "Action queue", taskCaption: "HR requests requiring action", requester: "Requester", priority: "Priority", status: "Status", created: "Created", action: "Action", done: "Complete",
    live: "Employees learning now", inactive: "Re-engagement needed", upcoming: "Upcoming sessions", noData: "No data in this group.",
    refresh: "Refresh", refreshed: "Administration overview refreshed", retry: "Retry", loadError: "Unable to load the administration overview.",
    quick: "Quick actions", employeesLink: "Manage employees", coursesLink: "Manage courses", reportsLink: "Open reports", restricted: "This account has no administration access.", learner: "Go to learner workspace",
  },
  kr: {
    title: "관리 개요", eyebrow: "HR / L&D Control Room", intro: "학습 운영, 처리 우선순위 및 실시간 활동을 확인합니다.",
    employees: "활성 직원", visited: "오늘 방문", online: "현재 온라인", learning: "학습 중", actions: "처리 대기", courses: "운영 과정", completion: "완료율",
    tasks: "처리 대기열", taskCaption: "HR 처리가 필요한 요청", requester: "요청자", priority: "우선순위", status: "상태", created: "생성 시간", action: "작업", done: "완료",
    live: "현재 학습 중인 직원", inactive: "재참여 필요", upcoming: "예정된 교육", noData: "표시할 데이터가 없습니다.",
    refresh: "새로고침", refreshed: "관리 개요를 새로고침했습니다", retry: "다시 시도", loadError: "관리 개요를 불러올 수 없습니다.",
    quick: "빠른 작업", employeesLink: "직원 관리", coursesLink: "과정 관리", reportsLink: "보고서 열기", restricted: "이 계정은 관리자 권한이 없습니다.", learner: "학습자 공간으로 이동",
  },
};

function metric(label, value, tone = "") {
  return `<article class="route-card admin-metric ${tone ? `admin-metric--${tone}` : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "—")}</strong></article>`;
}

function renderOverview(data, text, locale) {
  const metrics = [
    [text.employees, formatNumber(data.totalEmployees, locale), "people"],
    [text.visited, formatNumber(data.visitedToday, locale), "visited"],
    [text.online, formatNumber(data.onlineNow, locale), "online"],
    [text.learning, formatNumber(data.learningNow, locale), "learning"],
    [text.actions, formatNumber(data.pendingActions, locale), "warning"],
    [text.courses, formatNumber(data.activeCourseCount, locale), "course"],
    [text.completion, data.completionRate == null ? "—" : `${data.completionRate}%`, "success"],
  ];
  const tasks = Array.isArray(data.tasks) ? data.tasks.filter((task) => ["new", "in_progress"].includes(task.status)).slice(0, 8) : [];
  const live = Array.isArray(data.onlineLearning) ? data.onlineLearning.slice(0, 6) : [];
  const inactive = Array.isArray(data.inactiveEmployeeRows) ? data.inactiveEmployeeRows.slice(0, 6) : [];
  const upcoming = Array.isArray(data.upcomingSessions) ? data.upcomingSessions.slice(0, 5) : [];

  return `<section class="admin-hero"><div><p>${escapeHtml(text.eyebrow)}</p><h2 tabindex="-1">${escapeHtml(text.title)}</h2><span>${escapeHtml(text.intro)}</span></div><button type="button" class="route-button admin-refresh" data-admin-refresh>${escapeHtml(text.refresh)}</button></section>
  <section class="admin-metrics" aria-label="${escapeAttribute(text.title)}">${metrics.map(([label, value, tone]) => metric(label, value, tone)).join("")}</section>
  <section class="route-card route-panel admin-tasks"><header class="admin-section-head"><div><p>${escapeHtml(text.eyebrow)}</p><h2>${escapeHtml(text.tasks)}</h2></div><span>${tasks.length}</span></header>
    <div class="admin-table-wrap"><table><caption>${escapeHtml(text.taskCaption)}</caption><thead><tr><th scope="col">${escapeHtml(text.requester)}</th><th scope="col">${escapeHtml(text.tasks)}</th><th scope="col">${escapeHtml(text.priority)}</th><th scope="col">${escapeHtml(text.status)}</th><th scope="col">${escapeHtml(text.created)}</th><th scope="col">${escapeHtml(text.action)}</th></tr></thead><tbody>${tasks.map((task) => `<tr><td><strong>${escapeHtml(task.requester?.fullName || task.requester?.email || "—")}</strong></td><td>${escapeHtml(task.title || task.taskTypeLabel || task.taskType || "—")}</td><td><span class="admin-badge admin-badge--${escapeAttribute(task.priority || "normal")}">${escapeHtml(task.priorityLabel || task.priority || "—")}</span></td><td>${escapeHtml(task.statusLabel || task.status || "—")}</td><td>${escapeHtml(formatDateTime(task.createdAt, locale))}</td><td><button type="button" class="admin-row-action" data-task-done="${escapeAttribute(task.id)}">${escapeHtml(text.done)}</button></td></tr>`).join("") || `<tr><td colspan="6">${escapeHtml(text.noData)}</td></tr>`}</tbody></table></div>
  </section>
  <div class="admin-grid">
    <section class="route-card route-panel"><header class="admin-section-head"><div><p>Live</p><h2>${escapeHtml(text.live)}</h2></div><span>${live.length}</span></header><div class="admin-list">${live.map((item) => `<a href="${escapeAttribute(item.pagePath || "/admin/training-tracking")}"><span class="admin-avatar">${escapeHtml((item.fullName || "KIS").slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(item.fullName || item.email || item.accountId || "—")}</strong><p>${escapeHtml(item.activityLabel || item.title || item.activityType || "—")}</p></div><time>${escapeHtml(formatDateTime(item.lastSeenAt, locale))}</time></a>`).join("") || `<p class="admin-empty">${escapeHtml(text.noData)}</p>`}</div></section>
    <section class="route-card route-panel"><header class="admin-section-head"><div><p>Follow-up</p><h2>${escapeHtml(text.inactive)}</h2></div><span>${inactive.length}</span></header><div class="admin-list">${inactive.map((item) => `<a href="/admin/employees"><span class="admin-avatar admin-avatar--muted">${escapeHtml((item.fullName || "KIS").slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(item.fullName || item.email || "—")}</strong><p>${escapeHtml([item.department, item.status].filter(Boolean).join(" · "))}</p></div><time>${escapeHtml(formatDateTime(item.lastSeenAt, locale))}</time></a>`).join("") || `<p class="admin-empty">${escapeHtml(text.noData)}</p>`}</div></section>
  </div>
  <div class="admin-grid admin-grid--bottom">
    <section class="route-card route-panel"><header class="admin-section-head"><div><p>Calendar</p><h2>${escapeHtml(text.upcoming)}</h2></div><span>${upcoming.length}</span></header><div class="admin-session-list">${upcoming.map((item) => `<a href="/admin/sessions"><time>${escapeHtml(formatDateTime(item.startAt, locale))}</time><div><strong>${escapeHtml(item.title || item.courseTitle || "—")}</strong><p>${escapeHtml(item.locationName || item.mode || "")}</p></div></a>`).join("") || `<p class="admin-empty">${escapeHtml(text.noData)}</p>`}</div></section>
    <section class="route-card route-panel admin-quick"><header class="admin-section-head"><div><p>Action</p><h2>${escapeHtml(text.quick)}</h2></div></header><div><a href="/admin/employees">${escapeHtml(text.employeesLink)}<span>→</span></a><a href="/admin/courses">${escapeHtml(text.coursesLink)}<span>→</span></a><a href="/admin/reports">${escapeHtml(text.reportsLink)}<span>→</span></a></div></section>
  </div>`;
}

export async function mount({ account }) {
  const i18n = createI18n();
  const text = copy[i18n.language] || copy.vi;
  const shell = createRouteShell({ account, i18n, title: text.title, eyebrow: text.eyebrow, entry: "admin-dashboard" });
  if (!["hr", "admin"].includes(account.role)) {
    shell.setContent(`<section class="route-card route-error"><h2 tabindex="-1">${escapeHtml(text.restricted)}</h2><a class="route-button" href="/dashboard">${escapeHtml(text.learner)}</a></section>`, { focus: true });
    return;
  }

  let state = null;
  const bind = () => {
    shell.content.querySelector("[data-admin-refresh]")?.addEventListener("click", () => load(true));
    shell.content.querySelectorAll("[data-task-done]").forEach((button) => button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await apiJson("/api/admin/tasks", { method: "PATCH", body: JSON.stringify({ id: button.dataset.taskDone, status: "done" }) });
        state.tasks = (state.tasks || []).map((task) => task.id === button.dataset.taskDone ? { ...task, status: "done" } : task);
        shell.setContent(renderOverview(state, text, i18n.locale));
        bind();
      } catch {
        button.disabled = false;
      }
    }));
  };
  const load = async (announce = false) => {
    try {
      state = await apiJson("/api/admin/overview");
      shell.setContent(renderOverview(state, text, i18n.locale), { focus: !announce });
      bind();
      if (announce) shell.announce(text.refreshed);
    } catch {
      shell.setContent(`<section class="route-card route-error"><h2 tabindex="-1">${escapeHtml(text.loadError)}</h2><button type="button" class="route-button" data-admin-retry>${escapeHtml(text.retry)}</button></section>`, { focus: true });
      shell.content.querySelector("[data-admin-retry]")?.addEventListener("click", () => load(false), { once: true });
    }
  };
  await load(false);
}
