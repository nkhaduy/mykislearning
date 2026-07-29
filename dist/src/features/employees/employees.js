import { apiJson } from "../../shared/api/client.js";
import { createI18n } from "../../shared/i18n/runtime.js";
import { createRouteShell, escapeAttribute, escapeHtml } from "../../shared/ui/route-shell.js";

const copy = {
  vi: {
    title: "Quản lý nhân viên", eyebrow: "HR / People Operations", intro: "Tìm kiếm và cập nhật hồ sơ nhân viên với phân trang theo cursor.", add: "Thêm nhân viên",
    search: "Mã nhân viên, họ tên, email, phòng ban...", department: "Phòng ban", status: "Trạng thái", location: "Địa điểm", position: "Vị trí", manager: "Quản lý",
    apply: "Áp dụng", clear: "Xóa lọc", sortAsc: "Tên A-Z", sortDesc: "Tên Z-A", refresh: "Làm mới", loading: "Đang tải danh sách nhân viên", loadError: "Không thể tải danh sách nhân viên.", retry: "Thử lại",
    empty: "Không tìm thấy nhân viên phù hợp.", employee: "Nhân viên", code: "Mã NV", contact: "Liên hệ", organization: "Tổ chức", account: "Tài khoản", actions: "Thao tác", edit: "Sửa", records: "Chứng chỉ", security: "Tài khoản", previous: "Trang trước", next: "Trang sau", resultCount: "kết quả trên trang này",
    restricted: "Tài khoản này không có quyền quản lý nhân viên.", close: "Đóng", save: "Lưu thay đổi", saving: "Đang lưu", saved: "Đã cập nhật hồ sơ nhân viên", updateError: "Không thể cập nhật hồ sơ.", createTitle: "Thêm nhân viên", createIntro: "Tạo hồ sơ employee và mật khẩu tạm thời trong một bước.", create: "Tạo nhân viên", creating: "Đang tạo", created: "Đã tạo nhân viên", createError: "Không thể tạo nhân viên.", password: "Mật khẩu tạm thời", passwordHint: "Ít nhất 12 ký tự; nhân viên sẽ đổi mật khẩu khi đăng nhập.", required: "Trường này bắt buộc.", searchHint: "Từ 1-2 ký tự chỉ tìm theo tiền tố; từ 3 ký tự hỗ trợ tìm chuỗi con và không dấu.",
  },
  en: {
    title: "Employee management", eyebrow: "HR / People Operations", intro: "Search and update employee profiles with cursor pagination.", add: "Add employee",
    search: "Employee code, name, email, department...", department: "Department", status: "Status", location: "Location", position: "Position", manager: "Manager",
    apply: "Apply", clear: "Clear", sortAsc: "Name A-Z", sortDesc: "Name Z-A", refresh: "Refresh", loading: "Loading employees", loadError: "Unable to load employees.", retry: "Retry",
    empty: "No matching employees.", employee: "Employee", code: "Code", contact: "Contact", organization: "Organization", account: "Account", actions: "Actions", edit: "Edit", records: "Certificates", security: "Account", previous: "Previous", next: "Next", resultCount: "results on this page",
    restricted: "This account cannot manage employees.", close: "Close", save: "Save changes", saving: "Saving", saved: "Employee profile updated", updateError: "Unable to update the profile.", createTitle: "Add employee", createIntro: "Create the employee profile and temporary password in one step.", create: "Create employee", creating: "Creating", created: "Employee created", createError: "Unable to create the employee.", password: "Temporary password", passwordHint: "At least 12 characters; the employee will change it after sign-in.", required: "This field is required.", searchHint: "One or two characters use prefix search; three or more support accent-insensitive substring search.",
  },
  kr: {
    title: "직원 관리", eyebrow: "HR / People Operations", intro: "커서 페이지네이션으로 직원 프로필을 검색하고 수정합니다.", add: "직원 추가",
    search: "사번, 이름, 이메일, 부서...", department: "부서", status: "상태", location: "근무지", position: "직책", manager: "관리자",
    apply: "적용", clear: "초기화", sortAsc: "이름 오름차순", sortDesc: "이름 내림차순", refresh: "새로고침", loading: "직원 목록 로딩 중", loadError: "직원 목록을 불러올 수 없습니다.", retry: "다시 시도",
    empty: "조건에 맞는 직원이 없습니다.", employee: "직원", code: "사번", contact: "연락처", organization: "조직", account: "계정", actions: "작업", edit: "수정", records: "자격증", security: "계정", previous: "이전", next: "다음", resultCount: "현재 페이지 결과",
    restricted: "직원 관리 권한이 없습니다.", close: "닫기", save: "변경 저장", saving: "저장 중", saved: "직원 프로필이 업데이트되었습니다", updateError: "프로필을 업데이트할 수 없습니다.", createTitle: "직원 추가", createIntro: "직원 프로필과 임시 비밀번호를 한 번에 만듭니다.", create: "직원 만들기", creating: "생성 중", created: "직원이 생성되었습니다", createError: "직원을 생성할 수 없습니다.", password: "임시 비밀번호", passwordHint: "12자 이상; 로그인 후 비밀번호를 변경합니다.", required: "필수 입력입니다.", searchHint: "1~2자는 접두사 검색, 3자 이상은 악센트 비구분 부분 문자열 검색을 사용합니다.",
  },
};

const statuses = ["active", "inactive", "disabled", "pendingActivation"];

function readState() {
  const params = new URLSearchParams(location.search);
  return {
    search: String(params.get("search") || "").slice(0, 80),
    department: String(params.get("department") || "").slice(0, 120),
    status: statuses.includes(params.get("status")) ? params.get("status") : "",
    location: String(params.get("location") || "").slice(0, 120),
    position: String(params.get("position") || "").slice(0, 120),
    manager: String(params.get("manager") || "").slice(0, 120),
    direction: params.get("direction") === "desc" ? "desc" : "asc",
    cursor: null,
    history: [],
    items: [],
    nextCursor: null,
    hasMore: false,
    loading: true,
    error: "",
  };
}

function syncUrl(state) {
  const params = new URLSearchParams();
  for (const key of ["search", "department", "status", "location", "position", "manager"]) {
    if (state[key]) params.set(key, state[key]);
  }
  if (state.direction === "desc") params.set("direction", "desc");
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
}

function requestQuery(state) {
  const params = new URLSearchParams({ pageSize: "50", direction: state.direction });
  for (const key of ["search", "department", "status", "location", "position", "manager"]) {
    if (state[key]) params.set(key, state[key]);
  }
  if (state.cursor) params.set("cursor", state.cursor);
  return params.toString();
}

function statusLabel(value, i18n) {
  const labels = {
    active: { vi: "Hoạt động", en: "Active", kr: "활성" },
    inactive: { vi: "Không hoạt động", en: "Inactive", kr: "비활성" },
    disabled: { vi: "Đã khóa", en: "Disabled", kr: "비활성화" },
    pendingActivation: { vi: "Chờ kích hoạt", en: "Pending activation", kr: "활성화 대기" },
  };
  return i18n.pick(labels[value] || { vi: value || "—", en: value || "—", kr: value || "—" });
}

function filterField(name, label, value) {
  return `<label><span>${escapeHtml(label)}</span><input name="${escapeAttribute(name)}" value="${escapeAttribute(value)}" maxlength="120"></label>`;
}

function renderRows(state, i18n, text) {
  if (!state.items.length) return `<div class="employee-empty"><p>${escapeHtml(text.empty)}</p></div>`;
  return `<div class="employee-table-wrap"><table><caption>${escapeHtml(text.title)}</caption><thead><tr><th scope="col">${escapeHtml(text.employee)}</th><th scope="col">${escapeHtml(text.code)}</th><th scope="col">${escapeHtml(text.contact)}</th><th scope="col">${escapeHtml(text.organization)}</th><th scope="col">${escapeHtml(text.account)}</th><th scope="col">${escapeHtml(text.actions)}</th></tr></thead><tbody>${state.items.map((item) => `<tr>
    <td><strong>${escapeHtml(item.fullName || "—")}</strong><small>${escapeHtml(item.position || "—")}</small></td>
    <td>${escapeHtml(item.employeeCode || "—")}</td>
    <td><a href="mailto:${escapeAttribute(item.email)}">${escapeHtml(item.email || "—")}</a><small>${escapeHtml(item.location || "—")}</small></td>
    <td>${escapeHtml(item.department || "—")}<small>${escapeHtml(item.managerName || "—")}</small></td>
    <td><span class="employee-status employee-status--${escapeAttribute(item.accountStatus || "inactive")}">${escapeHtml(statusLabel(item.accountStatus, i18n))}</span></td>
    <td><div class="employee-actions"><button type="button" data-employee-edit="${escapeAttribute(item.id)}">${escapeHtml(text.edit)}</button><a href="/hr/certificates?employeeId=${encodeURIComponent(item.id)}">${escapeHtml(text.records)}</a><a href="/hr/accounts?employeeId=${encodeURIComponent(item.id)}">${escapeHtml(text.security)}</a></div></td>
  </tr>`).join("")}</tbody></table></div>`;
}

function render(state, i18n, text) {
  return `<section class="employee-hero"><div><p>${escapeHtml(text.eyebrow)}</p><h2 tabindex="-1">${escapeHtml(text.title)}</h2><span>${escapeHtml(text.intro)}</span></div><div class="employee-hero-actions"><button type="button" class="route-button employee-add" data-employee-add>${escapeHtml(text.add)}</button><button type="button" class="route-button employee-refresh" data-employee-refresh>${escapeHtml(text.refresh)}</button></div></section>
  <form class="route-card route-panel employee-filters" data-employee-filters>
    <label class="employee-search"><span>${escapeHtml(text.search)}</span><input id="employeeDirSearch" name="search" type="search" value="${escapeAttribute(state.search)}" maxlength="80" autocomplete="off" placeholder="${escapeAttribute(text.search)}" aria-describedby="employee-search-hint"><small id="employee-search-hint">${escapeHtml(text.searchHint)}</small></label>
    ${filterField("department", text.department, state.department)}
    <label><span>${escapeHtml(text.status)}</span><select name="status"><option value=""></option>${statuses.map((status) => `<option value="${status}" ${state.status === status ? "selected" : ""}>${escapeHtml(statusLabel(status, i18n))}</option>`).join("")}</select></label>
    ${filterField("location", text.location, state.location)}
    ${filterField("position", text.position, state.position)}
    ${filterField("manager", text.manager, state.manager)}
    <div class="employee-filter-actions"><button class="route-button" type="submit">${escapeHtml(text.apply)}</button><button class="route-button route-button--secondary" type="button" data-employee-clear>${escapeHtml(text.clear)}</button><button class="route-button route-button--secondary" type="button" data-employee-sort>${escapeHtml(state.direction === "asc" ? text.sortAsc : text.sortDesc)}</button></div>
  </form>
  <section class="route-card route-panel employee-results" aria-busy="${state.loading}">
    <header><div><p>${escapeHtml(text.eyebrow)}</p><h2>${escapeHtml(text.title)}</h2></div><strong>${state.items.length} ${escapeHtml(text.resultCount)}</strong></header>
    ${state.loading ? `<div class="route-loading" aria-label="${escapeAttribute(text.loading)}"><span></span><span></span><span></span></div>` : state.error ? `<div class="route-error"><p>${escapeHtml(text.loadError)}</p><button type="button" class="route-button" data-employee-retry>${escapeHtml(text.retry)}</button></div>` : renderRows(state, i18n, text)}
    <nav class="employee-pagination" aria-label="Pagination"><button type="button" data-employee-previous ${state.loading || !state.history.length ? "disabled" : ""}>${escapeHtml(text.previous)}</button><button type="button" data-employee-next ${state.loading || !state.hasMore || !state.nextCursor ? "disabled" : ""}>${escapeHtml(text.next)}</button></nav>
  </section>`;
}

function createDialog(text) {
  return `<dialog class="employee-dialog" data-employee-dialog><form method="dialog" class="employee-dialog__close"><button value="cancel" aria-label="${escapeAttribute(text.close)}">×</button></form><form data-employee-create-form novalidate><header><p>${escapeHtml(text.eyebrow)}</p><h2>${escapeHtml(text.createTitle)}</h2><span>${escapeHtml(text.createIntro)}</span></header>
    <label><span>${escapeHtml(text.employee)}</span><input name="fullName" maxlength="200" required autocomplete="name"></label>
    <label><span>Email</span><input name="email" type="email" maxlength="320" required autocomplete="email"></label>
    <label><span>${escapeHtml(text.code)}</span><input name="employeeCode" maxlength="80" required autocomplete="off"></label>
    <label><span>${escapeHtml(text.department)}</span><input name="department" maxlength="200" required autocomplete="organization"></label>
    <label><span>${escapeHtml(text.position)}</span><input name="position" maxlength="200" autocomplete="organization-title"></label>
    <label><span>${escapeHtml(text.password)}</span><input name="password" type="password" minlength="12" maxlength="256" required autocomplete="new-password"><small>${escapeHtml(text.passwordHint)}</small></label>
    <p class="employee-form-error" data-employee-create-error role="alert" aria-live="polite"></p>
    <footer><button type="button" class="route-button route-button--secondary" data-employee-dialog-close>${escapeHtml(text.close)}</button><button type="submit" class="route-button">${escapeHtml(text.create)}</button></footer>
  </form></dialog>`;
}

function editDialog(item, i18n, text) {
  return `<dialog class="employee-dialog" data-employee-dialog><form method="dialog" class="employee-dialog__close"><button value="cancel" aria-label="${escapeAttribute(text.close)}">×</button></form><form data-employee-edit-form><header><p>${escapeHtml(text.eyebrow)}</p><h2>${escapeHtml(item.fullName || text.employee)}</h2></header>
    <input type="hidden" name="id" value="${escapeAttribute(item.id)}">
    <label><span>${escapeHtml(text.employee)}</span><input name="full_name" value="${escapeAttribute(item.fullName)}" maxlength="200" required></label>
    <label><span>Email</span><input name="email" type="email" value="${escapeAttribute(item.email)}" maxlength="320" required></label>
    <label><span>${escapeHtml(text.code)}</span><input name="employee_code" value="${escapeAttribute(item.employeeCode)}" maxlength="80"></label>
    ${filterField("department", text.department, item.department)}${filterField("position", text.position, item.position)}${filterField("location", text.location, item.location)}${filterField("manager_name", text.manager, item.managerName)}
    <label><span>${escapeHtml(text.status)}</span><select name="account_status">${statuses.map((status) => `<option value="${status}" ${item.accountStatus === status ? "selected" : ""}>${escapeHtml(statusLabel(status, i18n))}</option>`).join("")}</select></label>
    <footer><button type="button" class="route-button route-button--secondary" data-employee-dialog-close>${escapeHtml(text.close)}</button><button type="submit" class="route-button">${escapeHtml(text.save)}</button></footer>
  </form></dialog>`;
}

export async function mount({ account }) {
  const i18n = createI18n();
  const text = copy[i18n.language] || copy.vi;
  const shell = createRouteShell({ account, i18n, title: text.title, eyebrow: text.eyebrow, entry: "employee-management" });
  if (!["hr"].includes(account.role)) {
    shell.setContent(`<section class="route-card route-error"><h2 tabindex="-1">${escapeHtml(text.restricted)}</h2><a class="route-button" href="/dashboard">Dashboard</a></section>`, { focus: true });
    return;
  }

  const state = readState();
  let controller = null;
  let debounceTimer = null;

  const bind = () => {
    const form = shell.content.querySelector("[data-employee-filters]");
    const applyForm = () => {
      const data = new FormData(form);
      for (const key of ["search", "department", "status", "location", "position", "manager"]) state[key] = String(data.get(key) || "").trim();
      state.cursor = null;
      state.history = [];
      syncUrl(state);
      load();
    };
    form?.addEventListener("submit", (event) => { event.preventDefault(); applyForm(); });
    form?.querySelector('[name="search"]')?.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyForm, 320);
    });
    shell.content.querySelector("[data-employee-clear]")?.addEventListener("click", () => {
      Object.assign(state, { search: "", department: "", status: "", location: "", position: "", manager: "", cursor: null, history: [] });
      syncUrl(state);
      load();
    });
    shell.content.querySelector("[data-employee-sort]")?.addEventListener("click", () => {
      state.direction = state.direction === "asc" ? "desc" : "asc";
      state.cursor = null;
      state.history = [];
      syncUrl(state);
      load();
    });
    shell.content.querySelector("[data-employee-refresh]")?.addEventListener("click", () => load(true));
    shell.content.querySelector("[data-employee-add]")?.addEventListener("click", openCreator);
    shell.content.querySelector("[data-employee-retry]")?.addEventListener("click", () => load(), { once: true });
    shell.content.querySelector("[data-employee-next]")?.addEventListener("click", () => {
      if (!state.nextCursor) return;
      state.history.push(state.cursor);
      state.cursor = state.nextCursor;
      load();
    });
    shell.content.querySelector("[data-employee-previous]")?.addEventListener("click", () => {
      if (!state.history.length) return;
      state.cursor = state.history.pop() || null;
      load();
    });
    shell.content.querySelectorAll("[data-employee-edit]").forEach((button) => button.addEventListener("click", () => openEditor(button.dataset.employeeEdit)));
  };

  const openCreator = () => {
    shell.content.insertAdjacentHTML("beforeend", createDialog(text));
    const dialog = shell.content.querySelector("[data-employee-dialog]");
    const form = dialog.querySelector("[data-employee-create-form]");
    const errorBox = dialog.querySelector("[data-employee-create-error]");
    dialog.querySelector("[data-employee-dialog-close]")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorBox.textContent = "";
      if (!form.reportValidity()) return;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.textContent = text.creating;
      try {
        await apiJson("/api/auth", { method: "POST", body: JSON.stringify({ action: "create-user", ...Object.fromEntries(new FormData(form)) }) });
        dialog.close();
        shell.announce(text.created);
        await load(true);
      } catch (error) {
        submit.disabled = false;
        submit.textContent = text.create;
        const messages = { DUPLICATE_EMAIL: "Email đã tồn tại.", DUPLICATE_EMPLOYEE_CODE: "Mã nhân viên đã tồn tại.", INVALID_EMAIL: "Email không hợp lệ.", INVALID_PASSWORD: "Mật khẩu phải có ít nhất 12 ký tự." };
        errorBox.textContent = messages[error.code] || error.message || text.createError;
      }
    });
    dialog.showModal();
    form?.querySelector("input")?.focus();
  };

  const openEditor = (id) => {
    const item = state.items.find((candidate) => candidate.id === id);
    if (!item) return;
    shell.content.insertAdjacentHTML("beforeend", editDialog(item, i18n, text));
    const dialog = shell.content.querySelector("[data-employee-dialog]");
    dialog.querySelector("[data-employee-dialog-close]")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.querySelector("[data-employee-edit-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.textContent = text.saving;
      const data = Object.fromEntries(new FormData(form));
      const employeeId = data.id;
      delete data.id;
      try {
        await apiJson(`/api/employees/${encodeURIComponent(employeeId)}`, { method: "PATCH", body: JSON.stringify(data) });
        dialog.close();
        shell.announce(text.saved);
        await load();
      } catch {
        submit.disabled = false;
        submit.textContent = text.save;
        shell.announce(text.updateError);
      }
    });
    dialog.showModal();
  };

  const load = async (announce = false) => {
    controller?.abort();
    controller = new AbortController();
    state.loading = true;
    state.error = "";
    shell.setContent(render(state, i18n, text));
    bind();
    const endpoint = `/api/employees?${requestQuery(state)}`;
    try {
      const data = await apiJson(endpoint, { signal: controller.signal });
      state.items = Array.isArray(data.items) ? data.items : [];
      state.nextCursor = data.nextCursor || null;
      state.hasMore = Boolean(data.hasMore);
      state.loading = false;
      shell.setContent(render(state, i18n, text), { focus: announce });
      bind();
      if (announce) shell.announce(`${state.items.length} ${text.resultCount}`);
    } catch (error) {
      if (error.name === "AbortError") return;
      state.loading = false;
      state.error = error.code || error.message || "EMPLOYEE_SEARCH_FAILED";
      shell.setContent(render(state, i18n, text), { focus: true });
      bind();
    }
  };

  await load();
}
