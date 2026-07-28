import { apiJson } from "../../shared/api/client.js";
import { createI18n, formatDateTime } from "../../shared/i18n/runtime.js";
import { createRouteShell, escapeAttribute, escapeHtml } from "../../shared/ui/route-shell.js";

function sessionRow(session, locale) {
  const label = session.current ? "Thiết bị hiện tại" : (session.user_agent || "Thiết bị không xác định");
  return `<article class="security-session"><div><strong>${escapeHtml(label)}</strong><span>Hoạt động: ${escapeHtml(formatDateTime(session.last_seen_at, locale))}</span><small>Hết hạn: ${escapeHtml(formatDateTime(session.expires_at, locale))}</small></div><button type="button" data-revoke-session="${escapeAttribute(session.id)}">${session.current ? "Đăng xuất thiết bị này" : "Thu hồi"}</button></article>`;
}

export async function mount({ account }) {
  const i18n = createI18n();
  const shell = createRouteShell({ account, i18n, title: "Bảo mật tài khoản", eyebrow: "Authentication & sessions", entry: "account-security" });
  const load = async () => {
    try {
      const sessions = await apiJson("/api/auth?action=sessions", { method: "POST" });
      shell.setContent(`<section class="route-card security-overview"><h2 tabindex="-1">Bảo mật tài khoản</h2><p>Phiên đăng nhập được bảo vệ bằng cookie HttpOnly, xoay refresh token và thu hồi phía máy chủ.</p></section><section class="route-card security-sessions"><header><h2>Phiên đang hoạt động</h2><button type="button" class="route-button" data-logout-all>Đăng xuất tất cả thiết bị</button></header>${(sessions.sessions || []).map((session) => sessionRow(session, i18n.locale)).join("") || "<p>Không có phiên hoạt động.</p>"}</section>`, { focus: true });
      shell.content.querySelectorAll("[data-revoke-session]").forEach((button) => button.addEventListener("click", async () => {
        const result = await apiJson("/api/auth?action=revoke-session", { method: "POST", body: JSON.stringify({ sessionId: button.dataset.revokeSession }) });
        if (result.currentRevoked) location.replace("/login"); else await load();
      }));
      shell.content.querySelector("[data-logout-all]")?.addEventListener("click", async () => {
        await apiJson("/api/auth?action=logout-all", { method: "POST" });
        localStorage.removeItem("mykis.session.v1");
        location.replace("/login");
      });
    } catch {
      shell.setContent('<section class="route-card route-error"><h2 tabindex="-1">Không thể tải cài đặt bảo mật.</h2><button class="route-button" data-security-retry>Thử lại</button></section>', { focus: true });
      shell.content.querySelector("[data-security-retry]")?.addEventListener("click", load, { once: true });
    }
  };
  await load();
}
