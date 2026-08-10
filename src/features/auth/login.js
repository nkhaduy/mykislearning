const app = document.getElementById("app");

const copy = {
  vi: {
    home: "Về trang chủ", title: "Đăng nhập MyKIS Learning", formTitle: "Đăng nhập", subtitle: "Nền tảng Học tập và Phát triển năng lực dành riêng cho nhân viên KIS Việt Nam", email: "Email", emailPlaceholder: "Nhập email công ty", password: "Mật khẩu", passwordPlaceholder: "Nhập mật khẩu", remember: "Ghi nhớ đăng nhập trên thiết bị này", rememberNote: "Không nên bật trên máy dùng chung.", submit: "Đăng nhập", support: "Bạn không thể đăng nhập?", note: "Tài khoản được cấp bởi bộ phận Nhân sự.", invalidEmail: "Vui lòng nhập email công ty hợp lệ.", missingPassword: "Vui lòng nhập mật khẩu.", systemError: "Máy chủ trả về phản hồi không hợp lệ. Vui lòng thử lại hoặc liên hệ bộ phận hỗ trợ nội bộ.", invalidCredentials: "Thông tin đăng nhập không chính xác.", rateLimited: "Có quá nhiều lần đăng nhập. Vui lòng chờ một lúc rồi thử lại.", locked: "Tài khoản đang tạm khóa. Bạn có thể gửi yêu cầu hỗ trợ.", inactive: "Tài khoản đã bị vô hiệu hóa. Bạn có thể gửi yêu cầu hỗ trợ.", supportTitle: "Bạn không thể đăng nhập?", supportIntro: "Chọn vấn đề bạn đang gặp phải để HR có thể hỗ trợ.", close: "Đóng", back: "Quay lại", send: "Gửi yêu cầu đến HR", sending: "Đang gửi...", doneTitle: "Đã gửi yêu cầu", done: "Yêu cầu hỗ trợ đã được gửi đến HR. Vui lòng chờ HR kiểm tra và phản hồi.", identifier: "Email hoặc tên đăng nhập", name: "Họ và tên", code: "Mã nhân viên (nếu có)", message: "Mô tả thêm", messagePlaceholder: "Mô tả vấn đề bạn gặp phải...", forgot: "Quên mật khẩu", unlock: "Tài khoản bị tạm khóa", reactivate: "Tài khoản bị vô hiệu hóa", issue: "Lỗi đăng nhập khác", supportError: "Không thể gửi yêu cầu. Vui lòng thử lại.", supportRequired: "Vui lòng nhập email hoặc họ tên.", show: "Hiện mật khẩu", hide: "Ẩn mật khẩu", destination: "Sau khi đăng nhập, bạn sẽ tiếp tục tới", destinationDashboard: "bảng học tập", destinationAdmin: "khu vực quản trị", destinationAttendance: "trang điểm danh", destinationPassword: "trang đổi mật khẩu", roleTitle: "Chọn khu vực làm việc", roleIntro: "Tài khoản này có hai quyền truy cập. Bạn muốn đăng nhập với vai trò nào?", roleEmployee: "Nhân viên", roleEmployeeNote: "Học tập, bài kiểm tra và hồ sơ cá nhân", roleHr: "Nhân sự (HR)", roleHrNote: "Quản trị đào tạo và tài khoản nhân viên", roleCancel: "Đăng nhập bằng tài khoản khác"
  },
  en: {
    home: "Back to home", title: "Sign in to MyKIS Learning", formTitle: "Sign in", subtitle: "Learning and capability development for KIS Vietnam employees", email: "Email", emailPlaceholder: "Enter company email", password: "Password", passwordPlaceholder: "Enter your password", remember: "Remember me on this device", rememberNote: "Do not enable on shared devices.", submit: "Sign in", support: "Can't sign in?", note: "Accounts are provided by Human Resources.", invalidEmail: "Enter a valid company email.", missingPassword: "Enter your password.", systemError: "The server returned an invalid response. Please try again or contact internal support.", invalidCredentials: "Invalid sign-in details.", rateLimited: "Too many sign-in attempts. Wait a moment and try again.", locked: "This account is temporarily locked. You can submit a support request.", inactive: "This account is disabled. You can submit a support request.", supportTitle: "Can't sign in?", supportIntro: "Choose the issue you are experiencing so HR can help.", close: "Close", back: "Back", send: "Send request to HR", sending: "Sending...", doneTitle: "Request sent", done: "Your support request was sent to HR. Please wait for a response.", identifier: "Email or username", name: "Full name", code: "Employee ID (optional)", message: "Additional details", messagePlaceholder: "Describe the issue...", forgot: "Forgot password", unlock: "Account temporarily locked", reactivate: "Account disabled", issue: "Other sign-in issue", supportError: "Could not send the request. Please try again.", supportRequired: "Enter an email or full name.", show: "Show password", hide: "Hide password", destination: "After signing in, you will continue to", destinationDashboard: "your learning dashboard", destinationAdmin: "the administration area", destinationAttendance: "attendance", destinationPassword: "password change", roleTitle: "Choose a workspace", roleIntro: "This account has two access roles. Which workspace do you want to enter?", roleEmployee: "Employee", roleEmployeeNote: "Learning, quizzes, and personal records", roleHr: "Human Resources", roleHrNote: "Training and employee account administration", roleCancel: "Use another account"
  },
  kr: {
    home: "홈으로", title: "MyKIS Learning 로그인", formTitle: "로그인", subtitle: "KIS Vietnam 임직원 전용 학습 및 역량 개발 플랫폼", email: "이메일", emailPlaceholder: "회사 이메일 입력", password: "비밀번호", passwordPlaceholder: "비밀번호 입력", remember: "이 기기에서 로그인 유지", rememberNote: "공용 기기에서는 사용하지 마세요.", submit: "로그인", support: "로그인에 문제가 있나요?", note: "계정은 인사부에서 발급합니다.", invalidEmail: "유효한 회사 이메일을 입력해 주세요.", missingPassword: "비밀번호를 입력해 주세요.", systemError: "서버가 올바르지 않은 응답을 반환했습니다. 다시 시도하거나 내부 지원팀에 문의해 주세요.", invalidCredentials: "로그인 정보가 올바르지 않습니다.", rateLimited: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.", locked: "계정이 일시적으로 잠겼습니다. 지원 요청을 제출할 수 있습니다.", inactive: "계정이 비활성화되었습니다. 지원 요청을 제출할 수 있습니다.", supportTitle: "로그인에 문제가 있나요?", supportIntro: "문제를 선택하면 인사부에서 지원합니다.", close: "닫기", back: "뒤로", send: "인사부에 요청 보내기", sending: "전송 중...", doneTitle: "요청이 전송되었습니다", done: "지원 요청이 인사부로 전송되었습니다. 답변을 기다려 주세요.", identifier: "이메일 또는 사용자명", name: "성명", code: "사번 (선택)", message: "추가 설명", messagePlaceholder: "문제를 설명해 주세요...", forgot: "비밀번호 분실", unlock: "계정 일시 잠김", reactivate: "계정 비활성화", issue: "기타 로그인 문제", supportError: "요청을 전송할 수 없습니다. 다시 시도해 주세요.", supportRequired: "이메일 또는 성명을 입력해 주세요.", show: "비밀번호 표시", hide: "비밀번호 숨기기", destination: "로그인 후 다음 위치로 이동합니다", destinationDashboard: "학습 대시보드", destinationAdmin: "관리자 영역", destinationAttendance: "출석 페이지", destinationPassword: "비밀번호 변경 페이지", roleTitle: "작업 영역 선택", roleIntro: "이 계정에는 두 가지 접근 권한이 있습니다. 사용할 역할을 선택하세요.", roleEmployee: "직원", roleEmployeeNote: "학습, 퀴즈 및 개인 기록", roleHr: "인사 담당자", roleHrNote: "교육 및 직원 계정 관리", roleCancel: "다른 계정 사용"
  },
};

Object.assign(copy.vi, { email: "Email hoặc tên đăng nhập", emailPlaceholder: "Nhập email hoặc tên đăng nhập", invalidEmail: "Vui lòng nhập email hoặc tên đăng nhập." });
Object.assign(copy.en, { email: "Email or username", emailPlaceholder: "Enter email or username", invalidEmail: "Enter your email or username." });
Object.assign(copy.kr, { email: "이메일 또는 사용자명", emailPlaceholder: "이메일 또는 사용자명 입력", invalidEmail: "이메일 또는 사용자명을 입력해 주세요." });

const state = { language: readLanguage(), email: "", returnTo: readReturnTo(), support: null, supportType: "", supportError: "", supportSubmitting: false, supportDone: false, passwordVisible: false, error: "", submitting: false, rolePrompt: null };
const supportTypes = ["forgot", "unlock", "reactivate", "issue"];
let supportReturnFocus = false;
let supportKeydownBound = false;

function readLanguage() {
  const saved = localStorage.getItem("mykis-language");
  return ["vi", "en", "kr"].includes(saved) ? saved : "vi";
}

function normalizeReturnTo(route) {
  if (typeof route !== "string") return "";
  if (/^\/admin(?:[/?#]|$)/.test(route)) return `/hr${route.slice("/admin".length)}`;
  return route;
}

function isSafeReturnTo(route) {
  if (typeof route !== "string" || !route.startsWith("/") || route.startsWith("//") || route.startsWith("/login")) return false;
  return /^(\/dashboard|\/hr|\/attendance\/scan|\/change-password)(?:[/?#]|$)/.test(route);
}

function isReturnToAllowedForRole(route, role) {
  if (!isSafeReturnTo(route)) return false;
  if (route.startsWith("/dashboard")) return role === "employee";
  if (route.startsWith("/hr")) return role === "hr";
  return true;
}

function readReturnTo() {
  const query = new URLSearchParams(location.search).get("returnTo");
  const stored = localStorage.getItem("mykis.postLoginRedirect.v1") || "";
  const candidate = normalizeReturnTo(query === null ? stored : query);
  if (!isSafeReturnTo(candidate)) {
    if (query !== null) localStorage.removeItem("mykis.postLoginRedirect.v1");
    return "";
  }
  localStorage.setItem("mykis.postLoginRedirect.v1", candidate);
  return candidate;
}

function destinationLabel(t) {
  if (state.returnTo.startsWith("/hr")) return t.destinationAdmin;
  if (state.returnTo.startsWith("/attendance/scan")) return t.destinationAttendance;
  if (state.returnTo.startsWith("/change-password")) return t.destinationPassword;
  return t.destinationDashboard;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
}

function switcher(language) {
  return `<div class="auth-language-switcher" role="group" aria-label="Language"><button type="button" class="${language === "vi" ? "active" : ""}" data-auth-language="vi" aria-pressed="${language === "vi"}">VI</button><button type="button" class="${language === "en" ? "active" : ""}" data-auth-language="en" aria-pressed="${language === "en"}">EN</button><button type="button" class="${language === "kr" ? "active" : ""}" data-auth-language="kr" aria-pressed="${language === "kr"}">KR</button></div>`;
}

function modal(t) {
  if (!state.support) return "";
  if (state.supportDone) return `<div class="auth-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="support-title"><section class="auth-modal"><div class="auth-modal-head"><h2 id="support-title">${t.doneTitle}</h2><button type="button" data-support-close aria-label="${t.close}">×</button></div><p>${t.done}</p><button class="auth-btn auth-btn-primary" type="button" data-support-close>${t.close}</button></section></div>`;
  if (state.supportType) return `<div class="auth-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="support-title"><section class="auth-modal"><div class="auth-modal-head"><h2 id="support-title">${t.supportTitle}</h2><button type="button" data-support-close aria-label="${t.close}">×</button></div><form id="authSupportForm"><label>${t.identifier}<input name="identifier" type="email" autocomplete="email" value="${esc(state.email)}" required></label><label>${t.name}<input name="fullName" type="text" autocomplete="name"></label><label>${t.code}<input name="employeeCode" type="text" autocomplete="off"></label><label>${t.message}<textarea name="message" rows="3" placeholder="${t.messagePlaceholder}"></textarea></label>${state.supportError ? `<p class="auth-error" role="alert">${esc(state.supportError)}</p>` : ""}<div class="auth-modal-actions"><button class="auth-btn auth-btn-outline" type="button" data-support-back>${t.back}</button><button class="auth-btn auth-btn-primary" type="submit" ${state.supportSubmitting ? "disabled" : ""}>${state.supportSubmitting ? t.sending : t.send}</button></div></form></section></div>`;
  return `<div class="auth-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="support-title"><section class="auth-modal"><div class="auth-modal-head"><h2 id="support-title">${t.supportTitle}</h2><button type="button" data-support-close aria-label="${t.close}">×</button></div><p>${t.supportIntro}</p><div class="auth-support-options">${supportTypes.map((type) => `<button type="button" data-support-type="${type}">${t[type]}</button>`).join("")}</div></section></div>`;
}

function render() {
  const t = copy[state.language];
  const destination = state.returnTo ? `<p class="auth-destination">${t.destination} <strong>${destinationLabel(t)}</strong>.</p>` : "";
  document.documentElement.lang = state.language === "kr" ? "ko" : state.language;
  document.body.dataset.route = "/login";
  const eyeIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.75"/></svg>`;
  const loginCard = state.rolePrompt
    ? `<section class="auth-card auth-role-card"><div class="auth-card-head"><a href="/" class="auth-logo-link" aria-label="${t.home}"><img src="/assets/kis-logo-horizontal.png" alt="KIS Vietnam" width="700" height="92" decoding="async"></a>${switcher(state.language)}</div><p class="auth-role-eyebrow">${esc(state.email)}</p><h1>${t.roleTitle}</h1><p class="auth-role-intro">${t.roleIntro}</p><div class="auth-role-options">${state.rolePrompt.allowedRoles.includes("employee") ? `<button type="button" data-role-choice="employee"><strong>${t.roleEmployee}</strong><span>${t.roleEmployeeNote}</span></button>` : ""}${state.rolePrompt.allowedRoles.includes("hr") ? `<button type="button" data-role-choice="hr"><strong>${t.roleHr}</strong><span>${t.roleHrNote}</span></button>` : ""}</div><button type="button" class="auth-link auth-role-cancel" data-role-cancel>${t.roleCancel}</button></section>`
    : `<form class="auth-card" id="loginForm" method="post" action="/api/auth?action=login" autocomplete="on" aria-busy="${state.submitting}"><div class="auth-card-head"><a href="/" class="auth-logo-link" aria-label="${t.home}"><img src="/assets/kis-logo-horizontal.png" alt="KIS Vietnam" width="700" height="92" decoding="async"></a>${switcher(state.language)}</div><h1>${t.formTitle}</h1>${destination}<label>${t.email}<input id="loginEmail" name="identifier" type="email" inputmode="email" autocomplete="email" placeholder="${t.emailPlaceholder}" value="${esc(state.email)}" aria-describedby="loginEmailError" required><span id="loginEmailError" class="auth-error" aria-live="polite">${state.error === "email" ? t.invalidEmail : ""}</span></label><label>${t.password}<span class="auth-password-wrap"><input id="loginPassword" name="password" type="${state.passwordVisible ? "text" : "password"}" autocomplete="current-password" placeholder="${t.passwordPlaceholder}" aria-describedby="loginPasswordError" required><button type="button" data-password-toggle aria-label="${state.passwordVisible ? t.hide : t.show}" aria-pressed="${state.passwordVisible}">${eyeIcon}</button></span><span id="loginPasswordError" class="auth-error" aria-live="polite">${state.error === "password" ? t.missingPassword : ""}</span></label><div class="auth-options"><label class="auth-remember"><input type="checkbox" name="rememberMe"> <span>${t.remember}</span></label><button type="button" class="auth-link" data-support-open>${t.support}</button></div>${state.error === "invalid" ? `<p class="auth-error" role="alert">${t.invalidCredentials}</p>` : state.error === "rate" ? `<p class="auth-error" role="alert">${t.rateLimited}</p>` : state.error === "locked" ? `<p class="auth-error" role="alert">${t.locked}</p>` : state.error === "inactive" ? `<p class="auth-error" role="alert">${t.inactive}</p>` : state.error === "system" ? `<p class="auth-error" role="alert">${t.systemError}</p>` : ""}<button id="loginSubmitBtn" class="auth-btn auth-btn-primary auth-submit" type="submit" ${state.submitting ? "disabled" : ""}>${state.submitting ? "..." : t.submit}</button><p class="auth-note">${t.note}<br><small>${t.rememberNote}</small></p></form>`;
  app.innerHTML = `<main class="auth-page"><div class="auth-backdrop" aria-hidden="true"></div><a class="auth-home-link" href="/"><span aria-hidden="true">‹</span>${t.home}</a><section class="auth-context" aria-hidden="true"><div><p>${t.title}</p><span>${t.subtitle}</span></div></section><section class="auth-panel">${loginCard}</section></main>${modal(t)}`;
  const loginIdentifier = document.getElementById("loginEmail");
  if (loginIdentifier) {
    loginIdentifier.type = "text";
    loginIdentifier.autocomplete = "username";
  }
  bind();
  if (state.support) {
    queueMicrotask(() => app.querySelector(".auth-modal [data-support-type], .auth-modal input, .auth-modal [data-support-close]")?.focus());
  }
}

function closeSupport() {
  state.support = null;
  state.supportType = "";
  state.supportDone = false;
  state.supportError = "";
  render();
  if (supportReturnFocus) app.querySelector("[data-support-open]")?.focus();
  supportReturnFocus = false;
}

function handleSupportKeydown(event) {
  const dialog = app.querySelector(".auth-modal");
  if (!dialog || !state.support) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeSupport();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...dialog.querySelectorAll("button, input, textarea, select, [href], [tabindex]:not([tabindex='-1'])")]
    .filter((element) => !element.disabled && element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function bind() {
  app.querySelectorAll("[data-auth-language]").forEach((button) => button.addEventListener("click", () => { state.language = button.dataset.authLanguage; localStorage.setItem("mykis-language", state.language); render(); }));
  app.querySelector("[data-password-toggle]")?.addEventListener("click", () => { state.passwordVisible = !state.passwordVisible; render(); document.getElementById("loginPassword")?.focus(); });
  app.querySelector("[data-support-open]")?.addEventListener("click", () => { supportReturnFocus = true; state.support = "select"; state.supportType = ""; state.supportError = ""; render(); });
  app.querySelector("[data-support-close]")?.addEventListener("click", closeSupport);
  app.querySelector("[data-support-back]")?.addEventListener("click", () => { state.supportType = ""; state.supportError = ""; render(); });
  app.querySelectorAll("[data-support-type]").forEach((button) => button.addEventListener("click", () => { state.supportType = button.dataset.supportType; state.supportError = ""; render(); }));
  app.querySelector("#authSupportForm")?.addEventListener("submit", submitSupport);
  app.querySelector("#loginForm")?.addEventListener("submit", submitLogin);
  app.querySelectorAll("[data-role-choice]").forEach((button) => button.addEventListener("click", () => retryWithRole(button.dataset.roleChoice)));
  app.querySelector("[data-role-cancel]")?.addEventListener("click", () => { state.rolePrompt = null; state.error = ""; render(); });
  if (!supportKeydownBound) {
    document.addEventListener("keydown", handleSupportKeydown);
    supportKeydownBound = true;
  }
}

async function submitSupport(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const identifier = String(data.get("identifier") || "").trim().toLowerCase();
  const fullName = String(data.get("fullName") || "").trim();
  if (!identifier && !fullName) { state.supportError = copy[state.language].supportRequired; render(); return; }
  state.supportSubmitting = true; state.supportError = ""; render();
  try {
    const response = await fetch("/api/account-support/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestType: state.supportType === "forgot" ? "forgot_password" : state.supportType === "unlock" ? "unlock_account" : state.supportType === "reactivate" ? "reactivate_account" : "login_issue", submittedIdentifier: identifier, submittedName: fullName, submittedEmployeeCode: String(data.get("employeeCode") || "").trim(), message: String(data.get("message") || "").trim() }) });
    const contentType = response.headers.get("content-type") || "";
    if (!/\bjson\b/i.test(contentType)) throw new Error("non_json");
    if (!response.ok) throw new Error((await response.json()).message || "request_failed");
    state.supportDone = true;
  } catch { state.supportError = copy[state.language].supportError; }
  state.supportSubmitting = false; render();
}

async function submitLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const email = String(data.get("identifier") || "").trim().toLowerCase();
  const password = String(data.get("password") || "");
  state.email = email;
  state.error = !email ? "email" : !password ? "password" : "";
  if (state.error) { render(); (state.error === "email" ? document.getElementById("loginEmail") : document.getElementById("loginPassword"))?.focus(); return; }
  await requestLogin({ identifier: email, password, rememberMe: data.get("rememberMe") === "on" });
}

async function retryWithRole(requestedRole) {
  if (!state.rolePrompt) return;
  const credentials = state.rolePrompt;
  await requestLogin({ ...credentials, requestedRole });
}

async function requestLogin({ identifier, password, rememberMe, requestedRole }) {
  state.submitting = true; state.error = ""; render();
  try {
    const response = await fetch("/api/auth?action=login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ identifier, password, rememberMe, ...(requestedRole ? { requestedRole } : {}) }) });
    const contentType = response.headers.get("content-type") || "";
    if (!/\bjson\b/i.test(contentType)) throw new Error("non_json");
    const body = await response.json();
    if (!response.ok) {
      if (body.error === "ROLE_SELECTION_REQUIRED" && Array.isArray(body.allowedRoles)) {
        state.rolePrompt = { identifier, password, rememberMe, allowedRoles: body.allowedRoles.filter((role) => ["employee", "hr"].includes(role)) };
        state.submitting = false;
        render();
        return;
      }
      state.rolePrompt = null;
      state.error = response.status === 429 || body.error === "RATE_LIMITED" ? "rate" : body.error === "ACCOUNT_LOCKED" ? "locked" : body.error === "ACCOUNT_INACTIVE" ? "inactive" : response.status >= 500 ? "system" : "invalid"; state.submitting = false; render(); return;
    }
    state.rolePrompt = null;
    await finishLogin(body.profile, body);
  } catch { state.error = "system"; state.submitting = false; render(); }
}

async function finishLogin(profile) {
  if (!profile?.id) throw new Error("profile_missing");
  const role = profile.role;
  if (!["hr", "employee"].includes(role)) throw new Error("invalid_role");
  const fallback = role === "hr" ? "/hr" : "/dashboard";
  const target = profile.passwordStatus === "resetRequired" ? "/change-password" : (isReturnToAllowedForRole(state.returnTo, role) ? state.returnTo : fallback);
  localStorage.removeItem("mykis.postLoginRedirect.v1");
  location.assign(target === "/login" ? fallback : target);
}

render();
