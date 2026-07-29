import { apiJson } from "../../shared/api/client.js";
import { createI18n } from "../../shared/i18n/runtime.js";
import { createRouteShell, escapeAttribute, escapeHtml } from "../../shared/ui/route-shell.js";

const text = {
  vi: { title: "Quản lý khóa học", eyebrow: "Learning Operations", intro: "Danh mục khóa học được tải độc lập khỏi ứng dụng legacy.", add: "Tạo khóa học", createTitle: "Tạo khóa học", createIntro: "Bắt đầu bằng bản nháp tối thiểu, sau đó thêm nội dung và xuất bản.", create: "Tạo bản nháp", creating: "Đang tạo", created: "Đã tạo khóa học", search: "Tìm khóa học", refresh: "Làm mới", empty: "Chưa có khóa học phù hợp.", error: "Không thể tải danh sách khóa học.", createError: "Không thể tạo khóa học.", retry: "Thử lại", status: "Trạng thái", mode: "Hình thức", open: "Mở chi tiết", close: "Đóng", titleLabel: "Tên khóa học", description: "Mô tả", restricted: "Bạn không có quyền quản lý khóa học." },
  en: { title: "Course management", eyebrow: "Learning Operations", intro: "The course catalog loads independently from the legacy application.", add: "Create course", createTitle: "Create course", createIntro: "Start with a small draft, then add content and publish when ready.", create: "Create draft", creating: "Creating", created: "Course created", search: "Search courses", refresh: "Refresh", empty: "No matching courses.", error: "Unable to load courses.", createError: "Unable to create the course.", retry: "Retry", status: "Status", mode: "Mode", open: "Open details", close: "Close", titleLabel: "Course title", description: "Description", restricted: "You cannot manage courses." },
  kr: { title: "과정 관리", eyebrow: "Learning Operations", intro: "레거시 애플리케이션과 독립적으로 과정 목록을 불러옵니다.", add: "과정 만들기", createTitle: "과정 만들기", createIntro: "간단한 초안부터 시작하고 내용을 추가한 뒤 게시합니다.", create: "초안 만들기", creating: "생성 중", created: "과정이 생성되었습니다", search: "과정 검색", refresh: "새로고침", empty: "일치하는 과정이 없습니다.", error: "과정을 불러올 수 없습니다.", createError: "과정을 생성할 수 없습니다.", retry: "다시 시도", status: "상태", mode: "형식", open: "상세 보기", close: "닫기", titleLabel: "과정 이름", description: "설명", restricted: "과정 관리 권한이 없습니다." },
};

function normalizedCourse(row) {
  const data = row?.data || row || {};
  return { id: row.id, title: data.title || data.name || row.title || row.id, description: data.description || row.description || "", status: row.status || data.status || "draft", mode: row.delivery_mode || data.deliveryMode || data.format || "—" };
}

function render(state, copy) {
  const rows = state.items.filter((item) => (!state.detailId || item.id === state.detailId) && (!state.search || `${item.title} ${item.description} ${item.status}`.toLowerCase().includes(state.search.toLowerCase())));
  return `<section class="course-route-hero"><div><p>${escapeHtml(copy.eyebrow)}</p><h2 tabindex="-1">${escapeHtml(copy.title)}</h2><span>${escapeHtml(copy.intro)}</span></div><div class="course-route-actions"><button class="route-button course-add" type="button" data-course-add>${escapeHtml(copy.add)}</button><button class="route-button course-refresh" type="button" data-course-refresh>${escapeHtml(copy.refresh)}</button></div></section><section class="route-card route-panel course-route-tools"><label><span>${escapeHtml(copy.search)}</span><input type="search" data-course-search value="${escapeAttribute(state.search)}" maxlength="100"></label></section><section class="course-route-grid" aria-busy="${state.loading}">${state.loading ? `<div class="route-loading"><span></span><span></span><span></span></div>` : state.error ? `<article class="route-card route-error"><p>${escapeHtml(copy.error)}</p><button class="route-button" data-course-retry>${escapeHtml(copy.retry)}</button></article>` : rows.length ? rows.map((item) => `<article class="route-card course-route-card"><header><span>${escapeHtml(item.status)}</span><small>${escapeHtml(item.mode)}</small></header><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description || "—")}</p><a class="route-button route-button--secondary" href="/hr/courses/${encodeURIComponent(item.id)}">${escapeHtml(copy.open)}</a></article>`).join("") : `<article class="route-card course-route-empty"><p>${escapeHtml(copy.empty)}</p></article>`}</section>`;
}

function courseDialog(copy) {
  return `<dialog class="course-create-dialog" data-course-dialog><form method="dialog" class="course-dialog-close"><button value="cancel" aria-label="${escapeAttribute(copy.close)}">×</button></form><form data-course-create-form novalidate><header><p>${escapeHtml(copy.eyebrow)}</p><h2>${escapeHtml(copy.createTitle)}</h2><span>${escapeHtml(copy.createIntro)}</span></header><label><span>${escapeHtml(copy.titleLabel)}</span><input name="title" maxlength="200" required autocomplete="off"></label><label><span>${escapeHtml(copy.description)}</span><textarea name="description" maxlength="4000" rows="5"></textarea></label><p class="course-form-error" data-course-create-error role="alert" aria-live="polite"></p><footer><button type="button" class="route-button route-button--secondary" data-course-dialog-close>${escapeHtml(copy.close)}</button><button type="submit" class="route-button">${escapeHtml(copy.create)}</button></footer></form></dialog>`;
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
    shell.content.querySelector("[data-course-add]")?.addEventListener("click", openCreator);
    shell.content.querySelector("[data-course-refresh]")?.addEventListener("click", load);
    shell.content.querySelector("[data-course-retry]")?.addEventListener("click", load, { once: true });
    shell.content.querySelector("[data-course-search]")?.addEventListener("input", (event) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { state.search = event.target.value.trim(); shell.setContent(render(state, copy)); bind(); }, 250);
    });
  };
  const openCreator = () => {
    shell.content.insertAdjacentHTML("beforeend", courseDialog(copy));
    const dialog = shell.content.querySelector("[data-course-dialog]");
    const form = dialog.querySelector("[data-course-create-form]");
    const errorBox = dialog.querySelector("[data-course-create-error]");
    dialog.querySelector("[data-course-dialog-close]")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorBox.textContent = "";
      if (!form.reportValidity()) return;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.textContent = copy.creating;
      const data = Object.fromEntries(new FormData(form));
      data.id = `course-${crypto.randomUUID()}`;
      data.status = "draft";
      data.deliveryMode = "online";
      try {
        const response = await apiJson("/api/courses", { method: "POST", body: JSON.stringify(data) });
        dialog.close();
        shell.announce(copy.created);
        const id = response.course?.id || data.id;
        if (id) location.href = `/hr/courses/${encodeURIComponent(id)}`;
      } catch (error) {
        submit.disabled = false;
        submit.textContent = copy.create;
        errorBox.textContent = error.message || copy.createError;
      }
    });
    dialog.showModal();
    form?.querySelector("input")?.focus();
  };
  const load = async () => {
    state.loading = true; state.error = ""; shell.setContent(render(state, copy)); bind();
    try { const data = await apiJson("/api/courses"); state.items = (Array.isArray(data) ? data : data.items || []).map(normalizedCourse); }
    catch (error) { state.error = error.code || "COURSE_LOAD_FAILED"; }
    state.loading = false; shell.setContent(render(state, copy), { focus: true }); bind();
  };
  await load();
}
