import { apiJson } from "../../shared/api/client.js";
import { createI18n, formatDateTime } from "../../shared/i18n/runtime.js";
import { createRouteShell, escapeAttribute, escapeHtml } from "../../shared/ui/route-shell.js";

const ARRAY_KEYS = ["items", "data", "rows", "flows", "sessions", "records", "certifications", "plans", "assignments", "notifications", "requests", "competencies", "cycles", "programs", "roster"];

function firstArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of ARRAY_KEYS) if (Array.isArray(value[key])) return value[key];
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) return child;
  }
  return [];
}

function asText(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "object") return "";
  return String(value);
}

function defaultCard(item, locale) {
  const title = item.title || item.name || item.fullName || item.full_name || item.employee || item.program || item.cycle || item.competency || item.id || "—";
  const subtitle = item.description || item.body || item.department || item.jobTitle || item.position || item.email || item.courseTitle || item.learningPath || "";
  const status = item.status || item.accountStatus || item.account_status || item.verificationStatus || item.verification_status || "";
  const timestamp = item.updatedAt || item.updated_at || item.createdAt || item.created_at || item.dueAt || item.due_at || "";
  return { title: asText(title), subtitle: asText(subtitle), status: asText(status), meta: timestamp ? formatDateTime(timestamp, locale) : "" };
}

function detailRows(value) {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value)
    .filter(([, item]) => item !== null && item !== undefined && typeof item !== "object")
    .slice(0, 18);
}

export async function mountDataRoute({ account, route, entry, config }) {
  const i18n = createI18n();
  const text = config.copy[i18n.language] || config.copy.vi;
  const shell = createRouteShell({ account, i18n, title: text.title, eyebrow: text.eyebrow, entry });
  if (!route.roles.includes(account.role)) {
    shell.setContent(`<section class="route-card route-error"><h2 tabindex="-1">${escapeHtml(text.forbidden)}</h2></section>`, { focus: true });
    return;
  }

  const state = { loading: true, error: "", data: null, search: "" };
  const controller = new AbortController();
  let debounceTimer = 0;
  window.addEventListener("pagehide", () => { controller.abort(); clearTimeout(debounceTimer); }, { once: true });

  const render = () => {
    const rawItems = config.items ? config.items(state.data) : firstArray(state.data);
    const cards = rawItems.map((item) => ({ item, ...(config.mapItem ? config.mapItem(item, i18n) : defaultCard(item, i18n.locale)) }));
    const visible = cards.filter((card) => !state.search || `${card.title} ${card.subtitle} ${card.status} ${card.meta}`.toLowerCase().includes(state.search.toLowerCase()));
    const detail = config.detail ? config.detail(state.data) : route.classification === "detail" ? (state.data?.data || state.data?.flow || state.data?.plan || state.data?.assignment || state.data) : null;
    return `<section class="secondary-hero"><div><p>${escapeHtml(text.eyebrow)}</p><h2 tabindex="-1">${escapeHtml(text.title)}</h2><span>${escapeHtml(text.intro)}</span></div><button class="route-button" type="button" data-secondary-refresh>${escapeHtml(text.refresh)}</button></section>
      ${config.form ? config.form.render(state.data, text) : ""}
      ${!detail && config.search !== false ? `<section class="route-card secondary-tools"><label><span>${escapeHtml(text.search)}</span><input type="search" maxlength="100" value="${escapeAttribute(state.search)}" data-secondary-search></label></section>` : ""}
      <section class="secondary-content" aria-busy="${state.loading}">
        ${state.loading ? `<div class="route-loading"><span></span><span></span><span></span></div>` : state.error ? `<article class="route-card route-error"><h2>${escapeHtml(text.error)}</h2><p>${escapeHtml(state.error)}</p><button class="route-button" type="button" data-secondary-retry>${escapeHtml(text.retry)}</button></article>` : detail ? `<article class="route-card secondary-detail">${config.detailHtml ? config.detailHtml(detail, text, i18n) : `<dl>${detailRows(detail).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`}${route.parent ? `<a class="route-button route-button--secondary" href="${escapeAttribute(route.parent)}">${escapeHtml(text.back)}</a>` : ""}</article>` : visible.length ? `<div class="secondary-grid">${visible.map((card) => `<article class="route-card secondary-card"><header><span>${escapeHtml(card.status || "—")}</span><small>${escapeHtml(card.meta || "")}</small></header><h2>${escapeHtml(card.title)}</h2><p>${escapeHtml(card.subtitle)}</p>${card.href ? `<a class="route-button route-button--secondary" href="${escapeAttribute(card.href)}">${escapeHtml(text.open)}</a>` : ""}</article>`).join("")}</div>` : `<article class="route-card secondary-empty"><h2>${escapeHtml(text.empty)}</h2><p>${escapeHtml(text.emptyHelp)}</p></article>`}
      </section>`;
  };

  const bind = () => {
    shell.content.querySelector("[data-secondary-refresh]")?.addEventListener("click", load);
    shell.content.querySelector("[data-secondary-retry]")?.addEventListener("click", load, { once: true });
    shell.content.querySelector("[data-secondary-search]")?.addEventListener("input", (event) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { state.search = event.currentTarget.value.trim(); shell.setContent(render()); bind(); }, 200);
    });
    if (config.form) config.form.bind({ root: shell.content, data: state.data, text, apiJson, reload: load, announce: shell.announce });
  };

  async function load() {
    state.loading = true;
    state.error = "";
    shell.setContent(render());
    bind();
    try {
      state.data = config.load ? await config.load(apiJson, route.params, controller.signal) : config.data;
    } catch (error) {
      state.error = error.status === 403 ? text.forbidden : (error.code || error.message || "LOAD_FAILED");
    }
    state.loading = false;
    shell.setContent(render(), { focus: true });
    bind();
  }

  await load();
}

export const sharedCopy = {
  vi: { eyebrow: "MyKIS Learning", title: "", intro: "", refresh: "Tải lại", search: "Tìm trong kết quả", retry: "Thử lại", error: "Không thể tải dữ liệu", empty: "Chưa có dữ liệu", emptyHelp: "Dữ liệu mới sẽ xuất hiện tại đây khi được tạo trên hệ thống.", forbidden: "Bạn không có quyền truy cập chức năng này.", open: "Mở chi tiết", back: "Quay lại" },
  en: { eyebrow: "MyKIS Learning", title: "", intro: "", refresh: "Refresh", search: "Search results", retry: "Try again", error: "Unable to load data", empty: "No data yet", emptyHelp: "New records will appear here when they are created.", forbidden: "You do not have permission to access this feature.", open: "Open details", back: "Go back" },
  kr: { eyebrow: "MyKIS Learning", title: "", intro: "", refresh: "새로고침", search: "결과 검색", retry: "다시 시도", error: "데이터를 불러올 수 없습니다", empty: "데이터가 없습니다", emptyHelp: "새 기록이 생성되면 여기에 표시됩니다.", forbidden: "이 기능에 접근할 권한이 없습니다.", open: "상세 보기", back: "뒤로" },
};

export function routeCopy(titleVi, titleEn, titleKr, introVi, introEn = introVi, introKr = introVi) {
  return Object.fromEntries(Object.entries(sharedCopy).map(([language, base]) => [language, {
    ...base,
    title: language === "vi" ? titleVi : language === "en" ? titleEn : titleKr,
    intro: language === "vi" ? introVi : language === "en" ? introEn : introKr,
  }]));
}
