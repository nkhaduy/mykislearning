import { apiJson } from "../../shared/api/client.js";
import { createI18n } from "../../shared/i18n/runtime.js";
import { escapeHtml } from "../../shared/ui/route-shell.js";

const copy = {
  vi: { title: "Đổi mật khẩu", current: "Mật khẩu hiện tại", next: "Mật khẩu mới", confirm: "Xác nhận mật khẩu mới", submit: "Cập nhật mật khẩu", success: "Mật khẩu đã được cập nhật. Các phiên khác đã bị thu hồi.", mismatch: "Mật khẩu xác nhận không khớp.", error: "Không thể đổi mật khẩu.", policy: "Dùng mật khẩu đủ dài và không tái sử dụng mật khẩu cũ." },
  en: { title: "Change password", current: "Current password", next: "New password", confirm: "Confirm new password", submit: "Update password", success: "Password updated. Other sessions were revoked.", mismatch: "The confirmation does not match.", error: "Unable to change password.", policy: "Use a strong password and never reuse an old password." },
  kr: { title: "비밀번호 변경", current: "현재 비밀번호", next: "새 비밀번호", confirm: "새 비밀번호 확인", submit: "비밀번호 업데이트", success: "비밀번호가 변경되었습니다. 다른 세션은 취소되었습니다.", mismatch: "비밀번호 확인이 일치하지 않습니다.", error: "비밀번호를 변경할 수 없습니다.", policy: "강력한 비밀번호를 사용하고 이전 비밀번호를 재사용하지 마세요." },
};

export async function mount({ account }) {
  const i18n = createI18n();
  const text = copy[i18n.language] || copy.vi;
  const app = document.getElementById("app");
  app.innerHTML = `<main class="auth-page"><section class="auth-panel"><div class="auth-copy"><h1>${escapeHtml(text.title)}</h1><p>${escapeHtml(account?.fullName || "")}</p></div></section><section class="auth-visual"><form class="card login-card" data-change-password-form><h2>${escapeHtml(text.title)}</h2><label><span>${escapeHtml(text.current)}</span><input name="current" type="password" autocomplete="current-password" required></label><label><span>${escapeHtml(text.next)}</span><input name="next" type="password" autocomplete="new-password" minlength="8" autocomplete="new-password" required></label><label><span>${escapeHtml(text.confirm)}</span><input name="confirm" type="password" autocomplete="new-password" required></label><p>${escapeHtml(text.policy)}</p><p class="field-error" data-password-status role="alert" aria-live="polite"></p><button class="btn btn-primary" type="submit">${escapeHtml(text.submit)}</button></form></section></main>`;
  app.querySelector("[data-change-password-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    const status = form.querySelector("[data-password-status]");
    if (values.next !== values.confirm) { status.textContent = text.mismatch; return; }
    const button = form.querySelector("button"); button.disabled = true;
    try {
      await apiJson("/api/auth?action=change-password", { method: "POST", body: JSON.stringify({ currentPassword: values.current, newPassword: values.next }) });
      status.textContent = text.success;
      form.reset();
      setTimeout(() => location.replace("/login"), 900);
    } catch (error) { status.textContent = error.code || text.error; }
    finally { button.disabled = false; }
  });
}
