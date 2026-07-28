import { apiJson } from "../../shared/api/client.js";
import { createI18n } from "../../shared/i18n/runtime.js";
import { createRouteShell, escapeHtml } from "../../shared/ui/route-shell.js";

const copy = {
  vi: { title: "Nội dung khóa học", eyebrow: "Learning Player", back: "Khóa học của tôi", empty: "Không tìm thấy khóa học hoặc bạn chưa được phân công.", error: "Không thể tải nội dung khóa học.", retry: "Thử lại", progress: "Tiến độ", content: "Nội dung", restricted: "Route này chỉ dành cho học viên." },
  en: { title: "Course content", eyebrow: "Learning Player", back: "My courses", empty: "The course was not found or is not assigned to you.", error: "Unable to load course content.", retry: "Retry", progress: "Progress", content: "Content", restricted: "This route is for learners." },
  kr: { title: "과정 콘텐츠", eyebrow: "Learning Player", back: "내 과정", empty: "과정을 찾을 수 없거나 배정되지 않았습니다.", error: "과정 콘텐츠를 불러올 수 없습니다.", retry: "다시 시도", progress: "진행률", content: "콘텐츠", restricted: "학습자 전용 경로입니다." },
};

function courseData(row) { return row?.data || row || {}; }

function render(state, text) {
  if (state.loading) return `<div class="route-loading"><span></span><span></span><span></span></div>`;
  if (state.error) return `<section class="route-card route-error"><h2>${escapeHtml(text.error)}</h2><button class="route-button" data-player-retry>${escapeHtml(text.retry)}</button></section>`;
  if (!state.course) return `<section class="route-card course-route-empty"><p>${escapeHtml(text.empty)}</p><a class="route-button" href="/dashboard/courses">${escapeHtml(text.back)}</a></section>`;
  const data = courseData(state.course);
  const modules = Array.isArray(data.modules) ? data.modules : Array.isArray(data.contents) ? data.contents : [];
  return `<section class="course-player-hero"><a href="/dashboard/courses">← ${escapeHtml(text.back)}</a><p>${escapeHtml(text.eyebrow)}</p><h2 tabindex="-1">${escapeHtml(data.title || data.name || state.course.id)}</h2><span>${escapeHtml(data.description || "")}</span></section><section class="route-card course-player-progress"><div><span>${escapeHtml(text.progress)}</span><strong>${escapeHtml(state.enrollment?.progressPercent ?? state.enrollment?.progress_percent ?? 0)}%</strong></div><progress max="100" value="${Number(state.enrollment?.progressPercent ?? state.enrollment?.progress_percent ?? 0) || 0}"></progress></section><section class="route-card route-panel course-player-content"><h2>${escapeHtml(text.content)}</h2>${modules.length ? `<ol>${modules.map((item) => `<li><strong>${escapeHtml(item.title || item.name || "—")}</strong><p>${escapeHtml(item.description || item.type || "")}</p></li>`).join("")}</ol>` : `<p>${escapeHtml(text.empty)}</p>`}</section>`;
}

export async function mount({ account }) {
  const i18n = createI18n(); const text = copy[i18n.language] || copy.vi;
  const shell = createRouteShell({ account, i18n, title: text.title, eyebrow: text.eyebrow, entry: "course-player" });
  if (account.role !== "employee") { shell.setContent(`<section class="route-card route-error"><h2>${escapeHtml(text.restricted)}</h2></section>`); return; }
  const courseId = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1));
  const state = { course: null, enrollment: null, loading: true, error: "" };
  const bind = () => shell.content.querySelector("[data-player-retry]")?.addEventListener("click", load, { once: true });
  const load = async () => {
    state.loading = true; state.error = ""; shell.setContent(render(state, text));
    try {
      const [courses, enrollments] = await Promise.all([apiJson("/api/courses"), apiJson(`/api/enrollments?accountId=${encodeURIComponent(account.id)}`)]);
      const list = Array.isArray(courses) ? courses : courses.items || [];
      const assigned = Array.isArray(enrollments) ? enrollments : enrollments.items || [];
      state.enrollment = assigned.find((item) => (item.courseId || item.course_id) === courseId) || null;
      state.course = state.enrollment ? list.find((item) => String(item.id) === courseId) || null : null;
    } catch (error) { state.error = error.code || "COURSE_PLAYER_FAILED"; }
    state.loading = false; shell.setContent(render(state, text), { focus: true }); bind();
  };
  await load();
}
