import { apiJson } from "../../shared/api/client.js";
import { createI18n, formatDate, formatNumber } from "../../shared/i18n/runtime.js";
import { createRouteShell, escapeAttribute, escapeHtml } from "../../shared/ui/route-shell.js";

const copy = {
  vi: {
    title: "Tổng quan học tập", eyebrow: "Không gian học tập", hello: "Hành trình học tập của bạn",
    intro: "Ưu tiên các khóa gần hạn, tiếp tục nội dung đang học và theo dõi kết quả tại một nơi.",
    total: "Tổng khóa học", active: "Đang học", completed: "Hoàn thành", overdue: "Quá hạn",
    continue: "Tiếp tục học", start: "Bắt đầu học", viewAll: "Xem tất cả khóa học", priorities: "Ưu tiên học tập",
    recent: "Thông báo gần đây", noCourses: "Bạn chưa được giao khóa học nào.", noNotifications: "Không có thông báo mới.",
    due: "Hạn", progress: "Tiến độ", assigned: "Được giao cho bạn", retry: "Thử lại", loadError: "Không thể tải dữ liệu học tập.",
    loaded: "Đã tải tổng quan học tập", restricted: "Tài khoản này không có quyền truy cập không gian học viên.", admin: "Đi đến trang quản trị",
  },
  en: {
    title: "Learning overview", eyebrow: "Learning workspace", hello: "Your learning journey",
    intro: "Prioritize approaching deadlines, continue active content, and track outcomes in one place.",
    total: "Total courses", active: "In progress", completed: "Completed", overdue: "Overdue",
    continue: "Continue learning", start: "Start learning", viewAll: "View all courses", priorities: "Learning priorities",
    recent: "Recent notifications", noCourses: "No courses have been assigned to you yet.", noNotifications: "No new notifications.",
    due: "Due", progress: "Progress", assigned: "Assigned to you", retry: "Retry", loadError: "Unable to load learning data.",
    loaded: "Learning overview loaded", restricted: "This account cannot access the learner workspace.", admin: "Go to administration",
  },
  kr: {
    title: "학습 개요", eyebrow: "학습 공간", hello: "나의 학습 여정",
    intro: "마감이 가까운 과정을 우선하고 진행 중인 학습과 결과를 한곳에서 확인하세요.",
    total: "전체 과정", active: "학습 중", completed: "완료", overdue: "기한 초과",
    continue: "계속 학습", start: "학습 시작", viewAll: "전체 과정 보기", priorities: "학습 우선순위",
    recent: "최근 알림", noCourses: "배정된 과정이 없습니다.", noNotifications: "새 알림이 없습니다.",
    due: "마감", progress: "진도", assigned: "배정된 과정", retry: "다시 시도", loadError: "학습 데이터를 불러올 수 없습니다.",
    loaded: "학습 개요를 불러왔습니다", restricted: "이 계정은 학습자 공간에 접근할 수 없습니다.", admin: "관리 페이지로 이동",
  },
};

function statusValue(enrollment) {
  return String(enrollment.status || "notStarted");
}

function statusLabel(status, text) {
  return text[status] || status;
}

function progressValue(enrollment) {
  return Math.max(0, Math.min(100, Number(enrollment.progressPercent ?? enrollment.progress ?? 0) || 0));
}

function deadlineValue(enrollment) {
  return enrollment.deadline || enrollment.dueAt || enrollment.due_at || "";
}

function courseTitle(course, enrollment) {
  return course?.title || course?.name || enrollment.courseTitle || enrollment.title || enrollment.courseId || "—";
}

function priorityScore(enrollment) {
  const status = statusValue(enrollment);
  const rank = { overdue: 0, inProgress: 1, notStarted: 2, completed: 9 }[status] ?? 5;
  return rank * 1e15 + (new Date(deadlineValue(enrollment) || "9999-12-31").getTime() || 0);
}

function progressBar(value, text) {
  return `<div class="learner-progress"><div><span>${escapeHtml(text)}</span><strong>${value}%</strong></div><div class="learner-progress__track" role="progressbar" aria-label="${escapeAttribute(text)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><i style="width:${value}%"></i></div></div>`;
}

function courseRow({ enrollment, course, text, locale }) {
  const progress = progressValue(enrollment);
  const deadline = deadlineValue(enrollment);
  const status = statusValue(enrollment);
  return `<article class="learner-priority-row learner-priority-row--${escapeAttribute(status)}">
    <div class="learner-priority-row__mark" aria-hidden="true"></div>
    <div class="learner-priority-row__body"><span class="learner-status">${escapeHtml(statusLabel(status, text))}</span><h3>${escapeHtml(courseTitle(course, enrollment))}</h3><p>${deadline ? `${escapeHtml(text.due)}: ${escapeHtml(formatDate(deadline, locale))}` : escapeHtml(text.assigned)}</p>${progressBar(progress, text.progress)}</div>
    <a class="route-button route-button--secondary" href="/dashboard/courses/${encodeURIComponent(enrollment.courseId || course?.id || "")}">${escapeHtml(progress > 0 ? text.continue : text.start)}</a>
  </article>`;
}

function renderDashboard({ courses, enrollments, notifications, text, locale }) {
  const courseMap = new Map(courses.map((course) => [course.id, course]));
  const prioritized = [...enrollments].sort((a, b) => priorityScore(a) - priorityScore(b));
  const active = enrollments.filter((row) => ["inProgress", "overdue"].includes(statusValue(row))).length;
  const completed = enrollments.filter((row) => statusValue(row) === "completed").length;
  const overdue = enrollments.filter((row) => statusValue(row) === "overdue" || (deadlineValue(row) && new Date(deadlineValue(row)) < new Date() && statusValue(row) !== "completed")).length;
  const primary = prioritized.find((row) => statusValue(row) !== "completed");
  const primaryCourse = primary ? courseMap.get(primary.courseId) : null;
  const primaryProgress = primary ? progressValue(primary) : 0;
  const kpis = [[text.total, enrollments.length, "all"], [text.active, active, "active"], [text.completed, completed, "done"], [text.overdue, overdue, "overdue"]];
  const recentNotifications = notifications.slice(0, 4);

  return `<section class="learner-hero">
    <div><p>${escapeHtml(text.eyebrow)}</p><h2 tabindex="-1">${escapeHtml(text.hello)}</h2><span>${escapeHtml(text.intro)}</span></div>
    <a class="route-button" href="/dashboard/courses">${escapeHtml(text.viewAll)}</a>
  </section>
  <section class="learner-kpis" aria-label="${escapeAttribute(text.title)}">${kpis.map(([label, value, tone]) => `<a href="/dashboard/courses" class="route-card learner-kpi learner-kpi--${tone}"><span>${escapeHtml(label)}</span><strong>${formatNumber(value, locale)}</strong><small>${escapeHtml(text.assigned)}</small></a>`).join("")}</section>
  ${primary ? `<section class="route-card learner-continue"><div class="learner-continue__signal"><span>${escapeHtml(statusLabel(statusValue(primary), text))}</span><i></i></div><div class="learner-continue__body"><p>${escapeHtml(text.continue)}</p><h2>${escapeHtml(courseTitle(primaryCourse, primary))}</h2>${progressBar(primaryProgress, text.progress)}${deadlineValue(primary) ? `<small>${escapeHtml(text.due)}: ${escapeHtml(formatDate(deadlineValue(primary), locale))}</small>` : ""}</div><a class="route-button" href="/dashboard/courses/${encodeURIComponent(primary.courseId || primaryCourse?.id || "")}">${escapeHtml(primaryProgress ? text.continue : text.start)}</a></section>` : `<section class="route-card route-empty"><h2>${escapeHtml(text.noCourses)}</h2><a class="route-button route-button--secondary" href="/dashboard/courses">${escapeHtml(text.viewAll)}</a></section>`}
  <div class="learner-grid">
    <section class="route-card route-panel learner-priorities"><header><div><p>${escapeHtml(text.eyebrow)}</p><h2>${escapeHtml(text.priorities)}</h2></div><a href="/dashboard/courses">${escapeHtml(text.viewAll)}</a></header><div>${prioritized.slice(0, 5).map((enrollment) => courseRow({ enrollment, course: courseMap.get(enrollment.courseId), text, locale })).join("") || `<p class="learner-empty-copy">${escapeHtml(text.noCourses)}</p>`}</div></section>
    <aside class="route-card route-panel learner-notifications"><header><p>${escapeHtml(text.eyebrow)}</p><h2>${escapeHtml(text.recent)}</h2></header>${recentNotifications.map((notification) => `<a href="${escapeAttribute(notification.link || "/dashboard/notifications")}"><span class="${notification.isRead ? "" : "unread"}" aria-hidden="true"></span><div><strong>${escapeHtml(notification.title || text.recent)}</strong><p>${escapeHtml(notification.body || "")}</p><small>${escapeHtml(formatDate(notification.createdAt || notification.created_at, locale))}</small></div></a>`).join("") || `<p class="learner-empty-copy">${escapeHtml(text.noNotifications)}</p>`}</aside>
  </div>`;
}

export async function mount({ account }) {
  const i18n = createI18n();
  const text = copy[i18n.language] || copy.vi;
  const shell = createRouteShell({ account, i18n, title: text.title, eyebrow: text.eyebrow, entry: "learner-dashboard" });
  if (account.role !== "employee") {
    shell.setContent(`<section class="route-card route-error"><h2 tabindex="-1">${escapeHtml(text.restricted)}</h2><a class="route-button" href="/admin">${escapeHtml(text.admin)}</a></section>`, { focus: true });
    return;
  }

  const load = async () => {
    try {
      const [courses, enrollments, notifications] = await Promise.all([
        apiJson("/api/courses"),
        apiJson(`/api/enrollments?accountId=${encodeURIComponent(account.id)}`),
        apiJson(`/api/notifications?accountId=${encodeURIComponent(account.id)}`),
      ]);
      shell.setContent(renderDashboard({
        courses: Array.isArray(courses) ? courses : courses.items || [],
        enrollments: Array.isArray(enrollments) ? enrollments : enrollments.items || [],
        notifications: Array.isArray(notifications) ? notifications : notifications.items || [],
        text,
        locale: i18n.locale,
      }), { focus: true });
      shell.announce(text.loaded);
    } catch {
      shell.setContent(`<section class="route-card route-error"><h2 tabindex="-1">${escapeHtml(text.loadError)}</h2><button type="button" class="route-button" data-learner-retry>${escapeHtml(text.retry)}</button></section>`, { focus: true });
      shell.content.querySelector("[data-learner-retry]")?.addEventListener("click", load, { once: true });
    }
  };
  await load();
}
