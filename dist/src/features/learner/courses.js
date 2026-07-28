import { apiJson } from "../../shared/api/client.js";
import { createI18n, formatDate } from "../../shared/i18n/runtime.js";
import { createRouteShell, escapeAttribute, escapeHtml } from "../../shared/ui/route-shell.js";

const copy = {
  vi: {
    title: "Khóa học của tôi", eyebrow: "Học tập", intro: "Tìm khóa học được giao và tiếp tục từ tiến độ gần nhất.",
    search: "Tìm theo tên khóa học", all: "Tất cả trạng thái", notStarted: "Chưa bắt đầu", inProgress: "Đang học", completed: "Hoàn thành", overdue: "Quá hạn",
    progress: "Tiến độ", due: "Hạn hoàn thành", continue: "Tiếp tục học", start: "Bắt đầu học", empty: "Không có khóa học phù hợp.", loadError: "Không thể tải danh sách khóa học.", retry: "Thử lại", loaded: "Đã tải danh sách khóa học",
  },
  en: {
    title: "My courses", eyebrow: "Learning", intro: "Find assigned courses and continue from your latest progress.",
    search: "Search by course title", all: "All statuses", notStarted: "Not started", inProgress: "In progress", completed: "Completed", overdue: "Overdue",
    progress: "Progress", due: "Due date", continue: "Continue learning", start: "Start learning", empty: "No matching courses.", loadError: "Unable to load courses.", retry: "Retry", loaded: "Course list loaded",
  },
  kr: {
    title: "내 교육 과정", eyebrow: "학습", intro: "배정된 과정을 찾고 최근 진도부터 계속 학습하세요.",
    search: "과정명 검색", all: "전체 상태", notStarted: "시작 전", inProgress: "학습 중", completed: "완료", overdue: "기한 초과",
    progress: "진도", due: "마감일", continue: "계속 학습", start: "학습 시작", empty: "조건에 맞는 과정이 없습니다.", loadError: "과정 목록을 불러올 수 없습니다.", retry: "다시 시도", loaded: "과정 목록을 불러왔습니다",
  },
};

const statusKey = (value) => ({ not_started: "notStarted", in_progress: "inProgress" }[value] || value || "notStarted");
const progressValue = (row) => Math.max(0, Math.min(100, Number(row.progressPercent ?? row.progress ?? 0) || 0));
const dueValue = (row) => row.deadline || row.dueAt || row.due_at || "";

function renderRows({ courses, enrollments, text, locale, query = "", status = "" }) {
  const enrollmentMap = new Map(enrollments.map((row) => [row.courseId || row.course_id, row]));
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const rows = courses.map((course) => ({ course, enrollment: enrollmentMap.get(course.id) || {} }))
    .filter(({ course, enrollment }) => {
      const rowStatus = statusKey(enrollment.status);
      const title = String(course.title || course.name || "").toLocaleLowerCase(locale);
      return (!normalizedQuery || title.includes(normalizedQuery)) && (!status || rowStatus === status);
    });
  if (!rows.length) return `<section class="route-card route-empty"><h2 tabindex="-1">${escapeHtml(text.empty)}</h2></section>`;
  return `<section class="learner-course-grid">${rows.map(({ course, enrollment }) => {
    const rowStatus = statusKey(enrollment.status);
    const progress = progressValue(enrollment);
    const due = dueValue(enrollment);
    const courseId = course.id || enrollment.courseId || enrollment.course_id || "";
    return `<article class="route-card learner-course-card">
      <div class="learner-course-card__cover" aria-hidden="true"><span>${escapeHtml(String(course.category || course.deliveryMode || "KIS").slice(0, 24))}</span></div>
      <div class="learner-course-card__body"><span class="learner-course-card__status learner-course-card__status--${escapeAttribute(rowStatus)}">${escapeHtml(text[rowStatus] || rowStatus)}</span><h2>${escapeHtml(course.title || course.name || courseId || "—")}</h2><p>${escapeHtml(course.description || text.intro)}</p>
      <div class="learner-progress"><div><span>${escapeHtml(text.progress)}</span><strong>${progress}%</strong></div><div class="learner-progress__track" role="progressbar" aria-label="${escapeAttribute(text.progress)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><i style="width:${progress}%"></i></div></div>
      ${due ? `<small>${escapeHtml(text.due)}: ${escapeHtml(formatDate(due, locale))}</small>` : ""}<a class="route-button" href="/dashboard/courses/${encodeURIComponent(courseId)}">${escapeHtml(progress ? text.continue : text.start)}</a></div>
    </article>`;
  }).join("")}</section>`;
}

export async function mount({ account }) {
  const i18n = createI18n();
  const text = copy[i18n.language] || copy.vi;
  const shell = createRouteShell({ account, i18n, title: text.title, eyebrow: text.eyebrow, entry: "learner-courses" });
  if (account.role !== "employee") {
    shell.setContent(`<section class="route-card route-error"><h2 tabindex="-1">403</h2></section>`, { focus: true });
    return;
  }
  const load = async () => {
    try {
      const [courseBody, enrollmentBody] = await Promise.all([
        apiJson("/api/courses"),
        apiJson(`/api/enrollments?accountId=${encodeURIComponent(account.id)}`),
      ]);
      const courses = Array.isArray(courseBody) ? courseBody : courseBody.items || [];
      const enrollments = Array.isArray(enrollmentBody) ? enrollmentBody : enrollmentBody.items || [];
      shell.setContent(`<section class="learner-course-hero"><div><p>${escapeHtml(text.eyebrow)}</p><h2 tabindex="-1">${escapeHtml(text.title)}</h2><span>${escapeHtml(text.intro)}</span></div></section><form class="route-card learner-course-filters" role="search"><label><span>${escapeHtml(text.search)}</span><input type="search" name="search" placeholder="${escapeAttribute(text.search)}"></label><label><span>${escapeHtml(text.all)}</span><select name="status"><option value="">${escapeHtml(text.all)}</option>${["notStarted", "inProgress", "completed", "overdue"].map((key) => `<option value="${key}">${escapeHtml(text[key])}</option>`).join("")}</select></label></form><div data-course-results>${renderRows({ courses, enrollments, text, locale: i18n.locale })}</div>`, { focus: true });
      const form = shell.content.querySelector(".learner-course-filters");
      const refresh = () => {
        const data = new FormData(form);
        shell.content.querySelector("[data-course-results]").innerHTML = renderRows({ courses, enrollments, text, locale: i18n.locale, query: data.get("search"), status: data.get("status") });
      };
      form.addEventListener("input", refresh);
      form.addEventListener("change", refresh);
      shell.announce(text.loaded);
    } catch {
      shell.setContent(`<section class="route-card route-error"><h2 tabindex="-1">${escapeHtml(text.loadError)}</h2><button type="button" class="route-button" data-course-retry>${escapeHtml(text.retry)}</button></section>`, { focus: true });
      shell.content.querySelector("[data-course-retry]")?.addEventListener("click", load, { once: true });
    }
  };
  await load();
}
