import { apiJson } from "../../shared/api/client.js";
import { createI18n } from "../../shared/i18n/runtime.js";
import { createRouteShell, escapeHtml } from "../../shared/ui/route-shell.js";

const copy = {
  vi: { title: "Quét QR điểm danh", eyebrow: "Attendance", intro: "Camera và QR decoder chỉ tải sau khi bạn bắt đầu quét.", token: "Dán mã QR", start: "Bắt đầu camera", submit: "Gửi điểm danh", action: "Hành động", checkIn: "Check-in", checkOut: "Check-out", success: "Điểm danh thành công.", error: "Không thể điểm danh.", restricted: "Bạn cần đăng nhập để điểm danh.", cameraError: "Không thể mở camera trên thiết bị này." },
  en: { title: "Scan attendance QR", eyebrow: "Attendance", intro: "The camera and QR decoder load only after scanning starts.", token: "Paste QR token", start: "Start camera", submit: "Submit attendance", action: "Action", checkIn: "Check in", checkOut: "Check out", success: "Attendance recorded.", error: "Unable to record attendance.", restricted: "You must be signed in to record attendance.", cameraError: "Unable to open the camera on this device." },
  kr: { title: "출석 QR 스캔", eyebrow: "Attendance", intro: "카메라와 QR 디코더는 스캔을 시작할 때만 로드됩니다.", token: "QR 토큰 붙여넣기", start: "카메라 시작", submit: "출석 제출", action: "동작", checkIn: "체크인", checkOut: "체크아웃", success: "출석이 기록되었습니다.", error: "출석을 기록할 수 없습니다.", restricted: "출석하려면 로그인해야 합니다.", cameraError: "이 기기에서 카메라를 열 수 없습니다." },
};

function decodeToken(value) {
  try {
    const raw = String(value || "").includes("token=") ? new URL(value, location.origin).searchParams.get("token") : String(value || "");
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((raw.length + 3) % 4);
    const payload = JSON.parse(atob(padded));
    if (!payload.s || !payload.a || !payload.e) return null;
    return { token: raw, sessionId: payload.s, action: payload.a, expires: payload.e };
  } catch { return null; }
}

export async function mount({ account }) {
  const i18n = createI18n(); const text = copy[i18n.language] || copy.vi;
  const shell = createRouteShell({ account, i18n, title: text.title, eyebrow: text.eyebrow, entry: "attendance-scanner" });
  if (!account?.id) { shell.setContent(`<section class="route-card route-error"><h2>${escapeHtml(text.restricted)}</h2></section>`); return; }
  const initialToken = new URLSearchParams(location.search).get("token") || "";
  shell.setContent(`<section class="scanner-hero"><p>${escapeHtml(text.eyebrow)}</p><h2 tabindex="-1">${escapeHtml(text.title)}</h2><span>${escapeHtml(text.intro)}</span></section><section class="route-card scanner-panel"><label><span>${escapeHtml(text.token)}</span><textarea data-scanner-token rows="4">${escapeHtml(initialToken)}</textarea></label><div class="scanner-actions"><button class="route-button" data-scanner-start type="button">${escapeHtml(text.start)}</button><label><span>${escapeHtml(text.action)}</span><select data-scanner-action><option value="check_in">${escapeHtml(text.checkIn)}</option><option value="check_out">${escapeHtml(text.checkOut)}</option></select></label><button class="route-button route-button--secondary" data-scanner-submit type="button">${escapeHtml(text.submit)}</button></div><video data-scanner-video playsinline muted hidden></video><canvas data-scanner-canvas hidden></canvas><p class="scanner-status" role="status" aria-live="polite"></p></section>`);
  const status = shell.content.querySelector(".scanner-status"); const tokenInput = shell.content.querySelector("[data-scanner-token]"); const video = shell.content.querySelector("[data-scanner-video]"); const canvas = shell.content.querySelector("[data-scanner-canvas]");
  let stream; let frame;
  const stop = () => { stream?.getTracks().forEach((track) => track.stop()); cancelAnimationFrame(frame); video.hidden = true; };
  const setToken = (value) => { tokenInput.value = value; stop(); };
  shell.content.querySelector("[data-scanner-start]").addEventListener("click", async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      video.srcObject = stream; video.hidden = false; await video.play();
      if ("BarcodeDetector" in window) {
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        const scan = async () => { const codes = await detector.detect(video).catch(() => []); if (codes[0]?.rawValue) setToken(codes[0].rawValue); else frame = requestAnimationFrame(scan); };
        scan();
      } else {
        const script = document.createElement("script"); script.src = "/vendor/jsqr.min.js"; script.onload = () => { const context = canvas.getContext("2d", { willReadFrequently: true }); const scan = () => { if (!video.videoWidth) return requestAnimationFrame(scan); canvas.width = video.videoWidth; canvas.height = video.videoHeight; context.drawImage(video, 0, 0); const image = context.getImageData(0, 0, canvas.width, canvas.height); const code = window.jsQR?.(image.data, image.width, image.height); if (code?.data) setToken(code.data); else frame = requestAnimationFrame(scan); }; scan(); }; document.head.append(script);
      }
    } catch { status.textContent = text.cameraError; }
  });
  shell.content.querySelector("[data-scanner-submit]").addEventListener("click", async () => {
    const decoded = decodeToken(tokenInput.value); if (!decoded) { status.textContent = text.error; return; }
    const body = { sessionId: decoded.sessionId, action: shell.content.querySelector("[data-scanner-action]").value, expires: decoded.expires };
    if (navigator.geolocation) {
      const location = await new Promise((resolve) => navigator.geolocation.getCurrentPosition((position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }), () => resolve(null), { maximumAge: 30000, timeout: 4000 }));
      if (location) Object.assign(body, location);
    }
    try { await apiJson("/api/attendance/scan", { method: "POST", body: JSON.stringify({ ...body, token: decoded.token }) }); status.textContent = text.success; } catch { status.textContent = text.error; }
  });
}
