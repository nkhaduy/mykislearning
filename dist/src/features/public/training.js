import { apiJson } from "../../shared/api/client.js";
import { escapeAttribute, escapeHtml } from "../../shared/ui/route-shell.js";

const copy = {
  vi: { title: "Buổi học trực tiếp", intro: "Tham gia buổi đào tạo và hoàn thành các bước bắt buộc.", loading: "Đang tải…", unavailable: "Hiện chưa có buổi học đang mở.", join: "Tham gia", name: "Tên hiển thị", submit: "Xác nhận tham gia", error: "Không thể tải buổi học.", invalid: "Vui lòng nhập tên hợp lệ.", steps: "Các bước đào tạo", start: "Mở bước", complete: "Đánh dấu hoàn thành", done: "Đã hoàn thành", back: "Về trang chủ" },
  en: { title: "Live training", intro: "Join the training session and complete the required steps.", loading: "Loading…", unavailable: "No live session is currently open.", join: "Join", name: "Display name", submit: "Confirm join", error: "Unable to load the session.", invalid: "Enter a valid name.", steps: "Training steps", start: "Open step", complete: "Mark complete", done: "Completed", back: "Back home" },
  kr: { title: "실시간 교육", intro: "교육 세션에 참여하고 필수 단계를 완료하세요.", loading: "로드 중…", unavailable: "현재 열린 세션이 없습니다.", join: "참여", name: "표시 이름", submit: "참여 확인", error: "세션을 불러올 수 없습니다.", invalid: "유효한 이름을 입력하세요.", steps: "교육 단계", start: "단계 열기", complete: "완료 표시", done: "완료됨", back: "홈으로" },
};

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function activeMarkup(flow, text) {
  const token = flow?.accessToken || flow?.access_token;
  return `<main class="public-secondary"><section class="public-secondary__hero"><p>MyKIS Learning</p><h1>${escapeHtml(text.title)}</h1><span>${escapeHtml(text.intro)}</span></section><section class="public-secondary__card"><h2>${escapeHtml(flow?.title || text.title)}</h2><p>${escapeHtml(flow?.description || "")}</p>${token ? `<a class="route-button" href="/join/${encodeURIComponent(token)}">${escapeHtml(text.join)}</a>` : ""}</section></main>`;
}

export async function mount({ route }) {
  const text = copy[localStorage.getItem("mykis-language") || "vi"] || copy.vi;
  const app = document.getElementById("app");
  const controller = new AbortController();
  window.addEventListener("pagehide", () => controller.abort(), { once: true });
  app.innerHTML = `<main class="public-secondary"><section class="public-secondary__card"><p>${escapeHtml(text.loading)}</p></section></main>`;
  const token = route?.params?.token || "";
  try {
    if (!token) {
      const result = await apiJson("/api/public/live-training/active", { signal: controller.signal });
      app.innerHTML = result.flow ? activeMarkup({ ...result.flow, accessToken: result.accessToken }, text) : `<main class="public-secondary"><section class="public-secondary__card"><h1>${escapeHtml(text.title)}</h1><p>${escapeHtml(text.unavailable)}</p><a class="route-button route-button--secondary" href="/">${escapeHtml(text.back)}</a></section></main>`;
      return;
    }
    await mountJoin(app, token, text, controller.signal);
  } catch (error) {
    app.innerHTML = `<main class="public-secondary"><section class="public-secondary__card"><h1>${escapeHtml(text.error)}</h1><p>${escapeHtml(error.code || error.message || "REQUEST_FAILED")}</p></section></main>`;
  }
}

async function mountJoin(app, token, text, signal) {
  const state = { flow: null, steps: {}, participant: null, error: "" };
  const storageKey = `mykis.public-training.${token}`;
  const participantToken = sessionStorage.getItem(storageKey) || "";
  const authHeaders = () => participantToken ? { Authorization: `Bearer ${participantToken}` } : {};
  const load = async () => {
    const response = await fetch(`/api/public/live-training/${encodeURIComponent(token)}`, { credentials: "same-origin", headers: { Accept: "application/json", ...authHeaders() }, signal });
    const body = await response.json();
    if (!response.ok) throw Object.assign(new Error(body.error || "TRAINING_LOAD_FAILED"), { code: body.error || "TRAINING_LOAD_FAILED" });
    state.flow = body.flow; state.steps = body.steps || {}; state.participant = body.participant || null;
  };
  const render = () => {
    if (!state.participant) {
      app.innerHTML = `<main class="public-secondary"><section class="public-secondary__hero"><p>MyKIS Learning</p><h1>${escapeHtml(state.flow?.title || text.title)}</h1><span>${escapeHtml(state.flow?.description || text.intro)}</span></section><form class="public-secondary__card" data-join-form><label><span>${escapeHtml(text.name)}</span><input name="displayName" required minlength="2" maxlength="120" autocomplete="name"></label><button class="route-button" type="submit">${escapeHtml(text.submit)}</button><p role="alert" data-join-error>${escapeHtml(state.error)}</p></form></main>`;
      app.querySelector("[data-join-form]").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.reportValidity()) return;
        const displayName = String(new FormData(form).get("displayName") || "").trim();
        try {
          const response = await fetch(`/api/public/live-training/${encodeURIComponent(token)}/join`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ displayName }), signal });
          const body = await response.json();
          if (!response.ok) throw Object.assign(new Error(body.error || "JOIN_FAILED"), { code: body.error || "JOIN_FAILED" });
          sessionStorage.setItem(storageKey, body.participantToken);
          state.flow = body.flow; state.steps = body.steps || {}; state.participant = body.participant || null;
          render();
        } catch (error) { state.error = error.code || text.error; render(); }
      });
      return;
    }
    const steps = Object.entries(state.steps || {});
    app.innerHTML = `<main class="public-secondary"><section class="public-secondary__hero"><p>MyKIS Learning</p><h1>${escapeHtml(state.flow?.title || text.title)}</h1><span>${escapeHtml(state.participant.displayName || "")}</span></section><section class="public-secondary__card"><h2>${escapeHtml(text.steps)}</h2><div class="public-secondary__steps">${steps.map(([key, value]) => { const external = safeExternalUrl(value?.url); const completed = Boolean(value?.completedAt || value?.completed_at); return `<article><strong>${escapeHtml(key)}</strong><span>${completed ? escapeHtml(text.done) : escapeHtml(value?.state || "open")}</span>${!completed && external ? `<button type="button" class="route-button route-button--secondary" data-step-start="${escapeAttribute(key)}" data-step-url="${escapeAttribute(external)}">${escapeHtml(text.start)}</button><button type="button" class="route-button" data-step-complete="${escapeAttribute(key)}">${escapeHtml(text.complete)}</button>` : ""}</article>`; }).join("")}</div><p role="status" data-step-status></p></section></main>`;
    app.querySelectorAll("[data-step-start]").forEach((button) => button.addEventListener("click", async () => {
      const step = button.dataset.stepStart;
      const response = await fetch(`/api/public/live-training/${encodeURIComponent(token)}/steps/${encodeURIComponent(step)}/start`, { method: "POST", headers: { Accept: "application/json", ...authHeaders() }, signal });
      const body = await response.json();
      if (response.ok && safeExternalUrl(body.externalUrl)) window.open(body.externalUrl, "_blank", "noopener,noreferrer");
      else app.querySelector("[data-step-status]").textContent = body.error || text.error;
    }));
    app.querySelectorAll("[data-step-complete]").forEach((button) => button.addEventListener("click", async () => {
      const step = button.dataset.stepComplete;
      const response = await fetch(`/api/public/live-training/${encodeURIComponent(token)}/steps/${encodeURIComponent(step)}/complete`, { method: "POST", headers: { Accept: "application/json", ...authHeaders() }, signal });
      if (!response.ok) { app.querySelector("[data-step-status]").textContent = text.error; return; }
      await load(); render();
    }));
  };
  await load();
  render();
}
