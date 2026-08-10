import { apiJson } from "../../shared/api/client.js";
import { createI18n } from "../../shared/i18n/runtime.js";
import { createRouteShell, escapeAttribute, escapeHtml } from "../../shared/ui/route-shell.js";

const labels = {
  vi: {
    title: "Tài khoản nhân viên", eyebrow: "Nhân sự · Kiểm soát truy cập", intro: "Quản lý tên đăng nhập, trạng thái và mật khẩu của tài khoản nhân viên. Tất cả lượt xem mật khẩu đều được ghi nhật ký.", search: "Tìm theo tên, mã, email hoặc username", all: "Tất cả trạng thái", active: "Đang hoạt động", inactive: "Đã vô hiệu hóa", locked: "Đang khóa", total: "Tổng tài khoản", revealReady: "Có thể xem mật khẩu", mustChange: "Cần đổi mật khẩu", employee: "Nhân viên", username: "Tên đăng nhập", status: "Trạng thái", password: "Mật khẩu hiện tại", actions: "Thao tác", reveal: "Xem", hide: "Ẩn", copy: "Sao chép", reset: "Đặt lại", editUsername: "Đổi username", disable: "Vô hiệu hóa", enable: "Kích hoạt", unlock: "Mở khóa", revoke: "Thu hồi phiên", unavailable: "Chưa có dữ liệu; cần đặt lại mật khẩu", loadError: "Không tải được danh sách tài khoản.", empty: "Không tìm thấy tài khoản nhân viên phù hợp.", retry: "Thử lại", previous: "Trang trước", next: "Trang sau", resetTitle: "Đặt lại mật khẩu", usernameTitle: "Cập nhật tên đăng nhập", newPassword: "Mật khẩu mới", requireChange: "Yêu cầu nhân viên đổi mật khẩu khi đăng nhập", save: "Lưu thay đổi", cancel: "Hủy", success: "Đã cập nhật tài khoản.", copied: "Đã sao chép mật khẩu.", minPassword: "Mật khẩu phải có ít nhất 6 ký tự.", confirmReveal: "Mật khẩu là dữ liệu nhạy cảm. Tiếp tục xem và ghi nhận vào nhật ký kiểm toán?"
  },
  en: {
    title: "Employee accounts", eyebrow: "People · Access control", intro: "Manage employee usernames, status, sessions, and passwords. Every password reveal is audited.", search: "Search name, ID, email, or username", all: "All statuses", active: "Active", inactive: "Disabled", locked: "Locked", total: "Total accounts", revealReady: "Password available", mustChange: "Must change password", employee: "Employee", username: "Username", status: "Status", password: "Current password", actions: "Actions", reveal: "Reveal", hide: "Hide", copy: "Copy", reset: "Reset", editUsername: "Edit username", disable: "Disable", enable: "Enable", unlock: "Unlock", revoke: "Revoke sessions", unavailable: "Unavailable until password reset", loadError: "Could not load employee accounts.", empty: "No matching employee accounts.", retry: "Retry", previous: "Previous", next: "Next", resetTitle: "Reset password", usernameTitle: "Update username", newPassword: "New password", requireChange: "Require employee to change it at next sign-in", save: "Save changes", cancel: "Cancel", success: "Account updated.", copied: "Password copied.", minPassword: "Password must contain at least 6 characters.", confirmReveal: "Passwords are sensitive. Continue and record this reveal in the audit log?"
  },
};

function textFor(language) {
  return labels[language] || labels.vi;
}

function statusClass(status) {
  return ["active", "inactive", "disabled", "locked", "temporarilyLocked"].includes(status) ? status : "neutral";
}

function actionButton(action, id, label, tone = "") {
  return `<button type="button" class="account-action ${tone}" data-account-action="${escapeAttribute(action)}" data-account-id="${escapeAttribute(id)}">${escapeHtml(label)}</button>`;
}

function dialogHtml(state, t) {
  if (!state.dialog) return "";
  const account = state.items.find((item) => item.id === state.dialog.id);
  if (!account) return "";
  const reset = state.dialog.type === "reset";
  return `<div class="account-dialog-backdrop" data-dialog-close><section class="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title" data-dialog-panel><header><div><p>${escapeHtml(account.employeeCode || account.email)}</p><h2 id="account-dialog-title">${escapeHtml(reset ? t.resetTitle : t.usernameTitle)}</h2></div><button type="button" data-dialog-close aria-label="${escapeAttribute(t.cancel)}">×</button></header><form data-account-dialog-form>${reset ? `<label><span>${escapeHtml(t.newPassword)}</span><input name="newPassword" type="password" minlength="6" maxlength="256" autocomplete="new-password" required></label><label class="account-check"><input name="requireChange" type="checkbox" checked><span>${escapeHtml(t.requireChange)}</span></label>` : `<label><span>${escapeHtml(t.username)}</span><input name="username" value="${escapeAttribute(account.username)}" pattern="[a-z0-9._-]{1,80}" maxlength="80" autocomplete="off" required></label>`}<p class="account-dialog-status" data-dialog-status role="alert"></p><footer><button type="button" class="account-secondary" data-dialog-close>${escapeHtml(t.cancel)}</button><button type="submit" class="account-primary">${escapeHtml(t.save)}</button></footer></form></section></div>`;
}

function skeletonRows() {
  return Array.from({ length: 6 }, () => `<tr class="account-skeleton"><td><span></span><small></small></td><td><span></span></td><td><span></span></td><td><span></span></td><td><span></span></td></tr>`).join("");
}

function renderPage(shell, state, t) {
  const activeCount = state.items.filter((item) => item.accountStatus === "active").length;
  const revealCount = state.items.filter((item) => item.passwordRevealStatus === "available").length;
  const changeCount = state.items.filter((item) => item.mustChange).length;
  const tableRows = state.loading ? skeletonRows() : state.items.map((item) => {
    const revealed = state.revealed.get(item.id);
    const available = item.passwordRevealStatus === "available";
    const isActive = item.accountStatus === "active";
    return `<tr><td data-label="${escapeAttribute(t.employee)}"><strong>${escapeHtml(item.fullName)}</strong><small>${escapeHtml([item.employeeCode, item.email, item.department].filter(Boolean).join(" · "))}</small></td><td data-label="${escapeAttribute(t.username)}"><code>${escapeHtml(item.username || "—")}</code><button type="button" class="account-link" data-account-action="username" data-account-id="${escapeAttribute(item.id)}">${escapeHtml(t.editUsername)}</button></td><td data-label="${escapeAttribute(t.status)}"><span class="account-status ${statusClass(item.accountStatus)}">${escapeHtml(item.accountStatus)}</span>${item.mustChange ? `<small class="account-warning">${escapeHtml(t.mustChange)}</small>` : ""}</td><td data-label="${escapeAttribute(t.password)}">${revealed ? `<div class="account-password"><code>${escapeHtml(revealed)}</code>${actionButton("copy", item.id, t.copy)}${actionButton("hide", item.id, t.hide)}</div>` : available ? actionButton("reveal", item.id, t.reveal, "primary") : `<span class="account-unavailable">${escapeHtml(t.unavailable)}</span>`}</td><td data-label="${escapeAttribute(t.actions)}"><div class="account-actions">${actionButton("reset", item.id, t.reset)}${actionButton(isActive ? "disable" : "enable", item.id, isActive ? t.disable : t.enable, isActive ? "danger" : "")}${item.accountStatus === "locked" || item.accountStatus === "temporarilyLocked" ? actionButton("unlock", item.id, t.unlock) : ""}${actionButton("revoke-sessions", item.id, t.revoke)}</div></td></tr>`;
  }).join("");

  shell.setContent(`<section class="account-hero"><div><p>${escapeHtml(t.eyebrow)}</p><h2>${escapeHtml(t.title)}</h2><span>${escapeHtml(t.intro)}</span></div><div class="account-stats"><article><strong>${state.total}</strong><span>${escapeHtml(t.total)}</span></article><article><strong>${revealCount}</strong><span>${escapeHtml(t.revealReady)}</span></article><article><strong>${changeCount}</strong><span>${escapeHtml(t.mustChange)}</span></article></div></section><section class="account-panel"><form class="account-filters" data-account-search><label><span class="sr-only">${escapeHtml(t.search)}</span><input name="search" type="search" value="${escapeAttribute(state.search)}" placeholder="${escapeAttribute(t.search)}"></label><label><span class="sr-only">${escapeHtml(t.status)}</span><select name="status"><option value="">${escapeHtml(t.all)}</option><option value="active" ${state.status === "active" ? "selected" : ""}>${escapeHtml(t.active)}</option><option value="inactive" ${state.status === "inactive" ? "selected" : ""}>${escapeHtml(t.inactive)}</option><option value="locked" ${state.status === "locked" ? "selected" : ""}>${escapeHtml(t.locked)}</option></select></label></form>${state.error ? `<div class="account-error" role="alert"><p>${escapeHtml(t.loadError)}</p><button type="button" data-account-retry>${escapeHtml(t.retry)}</button></div>` : `<div class="account-table-wrap"><table data-account-table><caption>${escapeHtml(t.title)}</caption><thead><tr><th>${escapeHtml(t.employee)}</th><th>${escapeHtml(t.username)}</th><th>${escapeHtml(t.status)}</th><th>${escapeHtml(t.password)}</th><th>${escapeHtml(t.actions)}</th></tr></thead><tbody>${tableRows || `<tr><td colspan="5" class="account-empty">${escapeHtml(t.empty)}</td></tr>`}</tbody></table></div>`}<footer class="account-pagination"><span>${state.total} · ${escapeHtml(t.active)}: ${activeCount}</span><div><button type="button" data-account-page="previous" ${state.page <= 1 ? "disabled" : ""}>${escapeHtml(t.previous)}</button><strong>${state.page}</strong><button type="button" data-account-page="next" ${state.page * state.pageSize >= state.total ? "disabled" : ""}>${escapeHtml(t.next)}</button></div></footer></section>${dialogHtml(state, t)}`);
}

export async function mount({ account }) {
  const i18n = createI18n();
  const t = textFor(i18n.language);
  const shell = createRouteShell({ account, i18n, title: t.title, eyebrow: t.eyebrow, entry: "employee-accounts" });
  const state = { items: [], total: 0, page: 1, pageSize: 30, search: "", status: "", loading: true, error: false, dialog: null, revealed: new Map() };

  const load = async () => {
    state.loading = true; state.error = false; renderPage(shell, state, t);
    try {
      const params = new URLSearchParams({ page: state.page, pageSize: state.pageSize });
      if (state.search) params.set("search", state.search);
      if (state.status) params.set("status", state.status);
      const result = await apiJson(`/api/admin/employee-accounts?${params}`);
      state.items = result.items || [];
      state.total = Number(result.total || 0);
    } catch {
      state.error = true;
    } finally {
      state.loading = false; renderPage(shell, state, t);
    }
  };

  const updateAccount = async (id, action, payload = {}) => {
    await apiJson("/api/admin/hr-account-actions", { method: "POST", body: JSON.stringify({ action, targetId: id, ...payload }) });
    state.revealed.delete(id);
    shell.announce(t.success);
    await load();
  };

  shell.content.addEventListener("click", async (event) => {
    const close = event.target.closest("button[data-dialog-close]");
    if (close || event.target.matches(".account-dialog-backdrop")) { state.dialog = null; renderPage(shell, state, t); return; }
    const retry = event.target.closest("[data-account-retry]");
    if (retry) { await load(); return; }
    const pageButton = event.target.closest("[data-account-page]");
    if (pageButton && !pageButton.disabled) { state.page += pageButton.dataset.accountPage === "next" ? 1 : -1; await load(); return; }
    const button = event.target.closest("[data-account-action]");
    if (!button) return;
    const { accountAction: action, accountId: id } = button.dataset;
    const item = state.items.find((candidate) => candidate.id === id);
    if (!item) return;
    if (action === "reset" || action === "username") { state.dialog = { type: action, id }; renderPage(shell, state, t); return; }
    if (action === "hide") { state.revealed.delete(id); renderPage(shell, state, t); return; }
    if (action === "copy") { await navigator.clipboard.writeText(state.revealed.get(id) || ""); shell.announce(t.copied); return; }
    if (action === "reveal") {
      if (!window.confirm(t.confirmReveal)) return;
      button.disabled = true;
      try {
        const result = await apiJson(`/api/admin/employee-accounts/${encodeURIComponent(id)}/reveal-password`, { method: "POST", body: "{}" });
        state.revealed.set(id, result.password);
        renderPage(shell, state, t);
      } catch (error) { shell.announce(error.code || t.loadError); button.disabled = false; }
      return;
    }
    button.disabled = true;
    try { await updateAccount(id, action); } catch (error) { shell.announce(error.code || t.loadError); button.disabled = false; }
  });

  shell.content.addEventListener("submit", async (event) => {
    const searchForm = event.target.closest("[data-account-search]");
    if (searchForm) { event.preventDefault(); return; }
    const form = event.target.closest("[data-account-dialog-form]");
    if (!form) return;
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    const status = form.querySelector("[data-dialog-status]");
    const submit = form.querySelector("button[type='submit']");
    submit.disabled = true;
    try {
      if (state.dialog.type === "reset") {
        if (String(values.newPassword).length < 6) { status.textContent = t.minPassword; submit.disabled = false; return; }
        await updateAccount(state.dialog.id, "reset-password", { newPassword: values.newPassword, requireChange: values.requireChange === "on" });
      } else {
        await updateAccount(state.dialog.id, "set-username", { username: values.username });
      }
      state.dialog = null;
      renderPage(shell, state, t);
    } catch (error) { status.textContent = error.code || t.loadError; submit.disabled = false; }
  });

  let searchTimer;
  shell.content.addEventListener("input", (event) => {
    const form = event.target.closest("[data-account-search]");
    if (!form) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const values = Object.fromEntries(new FormData(form));
      state.search = String(values.search || "").trim();
      state.status = String(values.status || "");
      state.page = 1;
      await load();
    }, 300);
  });
  shell.content.addEventListener("change", (event) => {
    if (event.target.matches("[data-account-search] select")) event.target.dispatchEvent(new Event("input", { bubbles: true }));
  });
  addEventListener("pagehide", () => state.revealed.clear(), { once: true });
  await load();
}
