import { apiJson } from "../../shared/api/client.js";
import { createI18n } from "../../shared/i18n/runtime.js";
import { createRouteShell, escapeAttribute, escapeHtml } from "../../shared/ui/route-shell.js";

const text = {
  vi: { title: "Quản lý khóa học", eyebrow: "Learning Operations", intro: "Danh mục khóa học được tải độc lập khỏi ứng dụng legacy.", search: "Tìm khóa học", refresh: "Làm mới", empty: "Chưa có khóa học phù hợp.", error: "Không thể tải danh sách khóa học.", retry: "Thử lại", status: "Trạng thái", mode: "Hình thức", open: "Mở chi tiết", restricted: "Bạn không có quyền quản lý khóa học." },
  en: { title: "Course management", eyebrow: "Learning Operations", intro: "The course catalog loads independently from the legacy application.", search: "Search courses", refresh: "Refresh", empty: "No matching courses.", error: "Unable to load courses.", retry: "Retry", status: "Status", mode: "Mode", open: "Open details", restricted: "You cannot manage courses." },
  kr: { title: "과정 관리", eyebrow: "Learning Operations", intro: "레거시 애플리케이션과 독립적으로 과정 목록을 불러옵니다.", search: "과정 검색", refresh: "새로고침", empty: "일치하는 과정이 없습니다.", error: "과정을 불러올 수 없습니다.", retry: "다시 시도", status: "상태", mode: "형식", open: "상세 보기", restricted: "과정 관리 권한이 없습니다." },
};

function normalizedCourse(row) {
  const data = row?.data || row || {};
  return { id: row.id, title: data.title || data.name || row.title || row.id, description: data.description || row.description || "", status: row.status || data.status || "draft", mode: row.delivery_mode || data.deliveryMode || data.format || "—" };
}

function render(state, copy) {
  const rows = state.items.filter((item) => (!state.detailId || item.id === state.detailId) && (!state.search || `${item.title} ${item.description} ${item.status}`.toLowerCase().includes(state.search.toLowerCase())));
  return `<section class="course-route-hero"><div><p>${escapeHtml(copy.eyebrow)}</p><h2 tabindex="-1">${escapeHtml(copy.title)}</h2><span>${escapeHtml(copy.intro)}</span></div><button class="route-button" type="button" data-course-refresh>${escapeHtml(copy.refresh)}</button></section><section class="route-card route-panel course-route-tools"><label><span>${escapeHtml(copy.search)}</span><input type="search" data-course-search value="${escapeAttribute(state.search)}" maxlength="100"></label></section><section class="course-route-grid" aria-busy="${state.loading}">${state.loading ? `<div class="route-loading"><span></span><span></span><span></span></div>` : state.error ? `<article class="route-card route-error"><p>${escapeHtml(copy.error)}</p><button class="route-button" data-course-retry>${escapeHtml(copy.retry)}</button></article>` : rows.length ? rows.map((item) => `<article class="route-card course-route-card"><header><span>${escapeHtml(item.status)}</span><small>${escapeHtml(item.mode)}</small></header><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description || "—")}</p><a class="route-button route-button--secondary" href="/hr/courses/${encodeURIComponent(item.id)}">${escapeHtml(copy.open)}</a></article>`).join("") : `<article class="route-card course-route-empty"><p>${escapeHtml(copy.empty)}</p></article>`}</section>`;
}

export async function mount({ account }) {
  const i18n = createI18n();
  const copy = text[i18n.language] || text.vi;
  const shell = createRouteShell({ account, i18n, title: copy.title, eyebrow: copy.eyebrow, entry: "course-management" });
  if (!["hr"].includes(account.role)) { shell.setContent(`<section class="route-card route-error"><h2>${escapeHtml(copy.restricted)}</h2></section>`); return; }
  const parts = location.pathname.split("/").filter(Boolean);
  const state = { items: [], search: "", detailId: parts.length === 3 ? decodeURIComponent(parts[2]) : "", loading: true, error: "" };
  let debounceTimer;
  const bind = () => {
    shell.content.querySelector("[data-course-refresh]")?.addEventListener("click", load);
    shell.content.querySelector("[data-course-retry]")?.addEventListener("click", load, { once: true });
    shell.content.querySelector("[data-course-search]")?.addEventListener("input", (event) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { state.search = event.target.value.trim(); shell.setContent(render(state, copy)); bind(); }, 250);
    });
  };
  const load = async () => {
    state.loading = true; state.error = ""; shell.setContent(render(state, copy)); bind();
    try { const data = await apiJson("/api/courses"); state.items = (Array.isArray(data) ? data : data.items || []).map(normalizedCourse); }
    catch (error) { state.error = error.code || "COURSE_LOAD_FAILED"; }
    state.loading = false; shell.setContent(render(state, copy), { focus: true }); bind();
  };
  await load();
}
