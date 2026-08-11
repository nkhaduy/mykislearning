import { apiJson } from "../api/client.js";
import { createI18n } from "../i18n/runtime.js";
import { createRouteShell, escapeAttribute, escapeHtml } from "./route-shell.js";

function asItems(data, keys) {
  if (Array.isArray(data)) return data;
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key];
  return [];
}

export async function mountCollectionRoute({ account, roles, entry, endpoint, itemKeys = ["items", "data"], copy, mapItem }) {
  const i18n = createI18n();
  const text = copy[i18n.language] || copy.vi;
  const shell = createRouteShell({ account, i18n, title: text.title, eyebrow: text.eyebrow, entry });
  if (!roles.includes(account.role)) { shell.setContent(`<section class="route-card route-error"><h2>${escapeHtml(text.restricted)}</h2></section>`, { focus: true }); return; }
  const state = { items: [], search: "", loading: true, error: "" };
  let debounceTimer;
  const render = () => {
    const rows = state.items.filter((item) => !state.search || `${item.title} ${item.subtitle} ${item.status}`.toLowerCase().includes(state.search.toLowerCase()));
    return `<section class="ops-hero"><div><p>${escapeHtml(text.eyebrow)}</p><h2 tabindex="-1">${escapeHtml(text.title)}</h2><span>${escapeHtml(text.intro)}</span></div><button class="route-button" data-ops-refresh>${escapeHtml(text.refresh)}</button></section><section class="route-card route-panel ops-tools"><label><span>${escapeHtml(text.search)}</span><input type="search" data-ops-search value="${escapeAttribute(state.search)}" maxlength="100"></label></section><section class="ops-grid" aria-busy="${state.loading}">${state.loading ? `<div class="route-loading"><span></span><span></span><span></span></div>` : state.error ? `<article class="route-card route-error"><p>${escapeHtml(text.error)}</p><button class="route-button" data-ops-retry>${escapeHtml(text.retry)}</button></article>` : rows.length ? rows.map((item) => `<article class="route-card ops-card"><header><span>${escapeHtml(item.status || "—")}</span><small>${escapeHtml(item.meta || "")}</small></header><h2>${escapeHtml(item.title || "—")}</h2><p>${escapeHtml(item.subtitle || "")}</p>${item.href ? `<a class="route-button route-button--secondary" href="${escapeAttribute(item.href)}">${escapeHtml(text.open)}</a>` : ""}</article>`).join("") : `<article class="route-card ops-empty"><p>${escapeHtml(text.empty)}</p></article>`}</section>`;
  };
  const bind = () => {
    shell.content.querySelector("[data-ops-refresh]")?.addEventListener("click", () => load(true));
    shell.content.querySelector("[data-ops-retry]")?.addEventListener("click", () => load(true), { once: true });
    shell.content.querySelector("[data-ops-search]")?.addEventListener("input", (event) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { state.search = event.target.value.trim(); shell.setContent(render()); bind(); }, 250);
    });
  };
  const load = async (forceRefresh = false) => {
    state.loading = true; state.error = ""; shell.setContent(render()); bind();
    try {
      const requestApi = (path, options = {}) => apiJson(path, { ...options, forceRefresh });
      const data = typeof endpoint === "function" ? await endpoint(requestApi, account) : await requestApi(endpoint);
      state.items = asItems(data, itemKeys).map(mapItem);
    } catch (error) { state.error = error.code || "COLLECTION_LOAD_FAILED"; }
    state.loading = false; shell.setContent(render(), { focus: true }); bind();
  };
  await load();
}
