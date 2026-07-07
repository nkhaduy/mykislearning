window.__MYKIS_BUILD__ = "2026-06-22-cf";
window.__MYKIS_DEPLOY_TARGET__ = "cloudflare-workers";
import { dictionaries, getInitialLanguage, saveLanguage } from "./lib/i18n/index.js";
import {
  addSecurityAuditLog,
  assignCourse,
  changePassword,
  clearSession,
  createAccount,
  createCourse,
  deleteCourse,
  disableAccount,
  findAccount,
  forcePasswordChange,
  generateTemporaryPassword,
  getAccountById,
  getAccounts,
  getCourseById,
  getCourses,
  getEmployeeByAccountId,
  getEmployees,
  getEnrollments,
  getEnrollmentsByAccountId,
  getEnrollmentsByCourseId,
  getImportSummary,
  getNotifications,
  getUnreadCount,
  getSecurityAuditLog,
  getSession,
  initMockDatabase,
  login,
  markAsRead,
  DEMO_HR_EMAIL,
  DEMO_HR_PASSWORD,
  DEMO_EMPLOYEE_EMAIL,
  DEMO_EMPLOYEE_PASSWORD,
  HR_SUPPORT_NAME,
  HR_SUPPORT_EMAIL,
  resendActivationEmail,
  resetPassword,
  removeEnrollment,
  unlockAccount,
  updateAccount,
  updateCourse,
  updateEmployeeProfile,
  verifyPassword,
  getQuizzes, getQuizById, createQuiz, updateQuiz, deleteQuiz,
  getQuizAttempts, getQuizAttemptsByAccountId, startQuizAttempt, submitQuizAttempt,
  saveQuizAttemptProgress, canStartQuiz, gradeQuizEssay,
  getCourseContent, getContentProgress, getLearningActivity, logLearningActivity,
  saveContentProgress, calculateCourseProgress, resetLearningProgress,
  createCourseContent, updateCourseContent, deleteCourseContent, reorderCourseContent,
  getQuizzesByCourseId,
  getLmsOverviewStats,
  getNotificationHistory, sendNotificationCampaign, archiveNotificationCampaign,
} from "./lib/mockDatabase.js";
import { validatePassword } from "./lib/auth/passwordPolicy.js";
import { saveCourseImage, getCourseImage, saveEmployeePhoto, getEmployeePhoto, deleteEmployeePhoto, getGalleryMedia } from "./lib/blobStore.js";
import {employeeService} from "./lib/services/employeeService.js";
import {notificationService} from "./lib/services/notificationService.js";
import {galleryService} from "./lib/services/galleryService.js";
import {offlineTrainingService} from "./lib/services/offlineTrainingService.js";
import {calculateEmployeeTrainingTime,getCompanyTrainingAnalytics,getTrainingOverviewStats,formatTrainingDuration,hydrateOfflineTrainingData,invalidateOfflineTrainingCache} from "./lib/services/trainingAnalyticsService.js";
import {sessionService} from "./lib/services/sessionService.js";
import {qrAttendanceService} from "./lib/services/qrAttendanceService.js";
import {trainingApiService} from "./lib/services/trainingApiService.js";
import {calendarService} from "./lib/services/calendarService.js";
import {courseApiService} from "./lib/services/courseApiService.js";
import {excelImportService} from "./lib/services/excelImportService.js";
import {auditService} from "./lib/services/auditService.js";

const app = document.getElementById("app");
const SHOW_DEMO_CREDENTIALS = true;

let language = getInitialLanguage();
let route = location.pathname;
let session = sessionService.getValidSession();
let mobileNavOpen = false;
let userMenuOpen = false;
let lastShellFocusSelector = "";
let lastDialogFocusSelector = "";
let selectedLoginRole = new URLSearchParams(location.search).get("role") || "employee";
let dialogState = null;
let pendingNavigation = "";
let bypassNavigationGuard = false;
let accountSearch = "";
let accountFilters = { department: "", role: "", accountStatus: "", passwordStatus: "" };
let selectedAccountId = "";
let accountDrawerOpen = false;
let employeeEditId = "";
let employeeEditOpen = false;
let employeeEditSaving = false;
let certModalEmployeeId = "";
let certModalOpen = false;
let certEditId = "";
let certEditOpen = false;
let certSaving = false;
let _certList = [];
let _certListLoading = false;
let resetModalOpen = false;
let resetTargetId = "";
let temporaryPasswordResult = "";
let employeeDirectorySearch = "";
let employeeDirectoryFilters = { department: "", position: "", accountStatus: "", cchn: "" };
let employeeDirectoryPage = 1;
let employeeDirectorySortAsc = true;
let employeeDirectoryReviewIssues = false;
// API-backed employee list (source of truth — no localStorage fallback)
let _apiEmployees = [];
let _apiEmployeesLoading = false;
let _apiEmployeesError = "";
let _apiEmployeesLoaded = false;
// Timeline carousel state
let activeTimelineYear = "2025";
let _timelineDirection = "next";
// Delete employee modal state
let _deleteEmployeeId = "";
let _deleteEmployeeName = "";
let _deleteEmployeeConfirming = false;
// Account support request state
let _supportModalOpen = false;
let _supportStep = "select"; // "select" | "form" | "done"
let _supportSelectedType = "";
let _supportFormIdentifier = "";
let _supportFormName = "";
let _supportFormCode = "";
let _supportFormMessage = "";
let _supportSubmitting = false;
let _supportError = "";
// HR support request processing state
let _hrSupportModal = null; // { id, data, previousRequests }
let _hrSupportLoading = false;
let _hrSupportError = "";
let _hrSupportPasswordResult = "";
let _hrSupportRejectOpen = false;
let _hrSupportRejectNote = "";
let _hrSupportActionLoading = false;
let cchnSearch = "";
let cchnSortAsc = true;
let cchnPage = 1;
let cchnFilters = { department: "", certificate: "", year: "", status: "" };
let courseSearch = "";
let courseFilterCategory = "";
let courseFilterStatus = "";
let courseDrawerOpen = false;
let selectedCourseId = "";
let courseFormMode = "";
let _courseDeletingIds = new Set();
let contentBuilderMode = "";
let selectedContentId = "";
let contentBuilderType = "slide";
let contentPickerStep = "type"; // "type"|"slide"|"youtube"|"quiz-pick"|"text"
let slideDraft = null;
let youtubeDraft = null;
let quizPickSearch = "";
let assignCourseId = "";
let assignSearch = "";
let assignFilterDept = "";
let assignFilterStatus = "";
let assignModalOpen = false;
let assignTargetAccountId = "";
let assignTargetCourseId = "";
let assignRouteSearch = null;
let reportRouteSearch = null;
let myCourseFilter = "";
let reportDateRange = "30d";
let reportDateFrom = "";
let reportDateTo = "";
let reportDeptFilter = "";
let reportCourseFilter = "";
let reportActiveType = "overview";
let reportStatusFilter = "";
let reportPage = 1;
let reportPageSize = 25;
let reportData = null;
let reportLoading = false;
let reportError = "";
let reportLoadedKey = "";
let reportExporting = "";
let employeeNotificationPanelOpen = false;
let assignMethod = "individual";
let bulkSelectedAccountIds = [];
let bulkEmployeeSearch = "";
let bulkDepartmentFilter = "";
let bulkEmployeePage = 1;
let excelPreviewRows = [];
let importWizardOpen = false;
let importWizardMode = "employees";
let importWizardTarget = "";
let importWorkbookState = null;
let importSheetName = "";
let importHeaderRowIndex = 0;
let importColumnMapping = {};
let importPreviewRows = [];
let calendarSelectedDay = 0;
let activeQuizAttempt = null;
let quizFormOpen = false;
let selectedQuizId = "";
let quizBuilderQuestions = [];
let quizBuilderCollapsed = {};
let quizAddingQType = false;
let quizSearch = "";
let quizCourseFilter = "";
let quizStatusFilter = "";
let quizAdminView = "list";
let quizCurrentQuestion = 0;
let quizAnswers = {};
let quizBookmarks = [];
let quizSecondsRemaining = 0;
let quizTimerId = null;
let quizLastResult = null;
let learningTimerId = null;
let activeContentId = "";
let activeSlideIndex = 0;
let lastTickAt = 0;
let blurStartedAt = 0;
let youtubePlayer = null;
let _ytWatchStart = null;
let _ytWatchRanges = [];
let _ytPersistTimer = null;
let _ytCourseId = "";
let _ytContentId = "";
let _ytAccountId = "";

function mergeWatchedRanges(ranges) {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}

function uniqueWatchedSeconds(ranges) {
  return mergeWatchedRanges(ranges).reduce((sum, r) => sum + (r.end - r.start), 0);
}

function ytFlushRanges(final = false) {
  if (!_ytCourseId || !_ytContentId || !_ytAccountId) return;
  if (_ytWatchStart !== null && youtubePlayer) {
    try {
      const cur = youtubePlayer.getCurrentTime();
      if (cur > _ytWatchStart) _ytWatchRanges.push({ start: _ytWatchStart, end: cur });
    } catch {}
    if (!final) _ytWatchStart = (() => { try { return youtubePlayer.getCurrentTime(); } catch { return null; } })();
  }
  const state = getContentProgress(_ytAccountId, _ytCourseId).find(x => x.contentId === _ytContentId);
  const prev = state?.metadata?.watchedRanges || [];
  const merged = mergeWatchedRanges([...prev, ..._ytWatchRanges]);
  const duration = (() => { try { return youtubePlayer?.getDuration() || 0; } catch { return 0; } })();
  const watched = uniqueWatchedSeconds(merged);
  const requiredPercent = (() => {
    try { const content = getCourseContent(_ytCourseId).find(x => x.id === _ytContentId); return content?.completionRule?.requiredPercent ?? 90; } catch { return 90; }
  })();
  const pct = duration > 0 ? Math.min(100, Math.round(watched / duration * 100)) : 0;
  const completed = pct >= requiredPercent;
  saveContentProgress({ accountId: _ytAccountId, courseId: _ytCourseId, contentId: _ytContentId, contentType: "video", activeSeconds: watched, completionPercent: pct, completed, metadata: { watchedRanges: merged, durationSeconds: duration } });
  if (final) { _ytWatchRanges = []; _ytWatchStart = null; }
  else { _ytWatchRanges = []; }
  if (completed) render();
}

let _qrCameraStream = null;
let _qrScanRafId = null;
let _loginEmailRetain = ""; // keep email when login fails so form doesn't clear it

function isMobileQrDevice() {
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === "boolean") return navigator.userAgentData.mobile;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
  const touchCapable = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const compactScreen = Math.min(screen.width || innerWidth, screen.height || innerHeight) <= 1024;
  return mobileUa && touchCapable && compactScreen;
}

function requestQrLocationPermission() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) return reject(Object.assign(new Error("location_requires_https"), { code: "INSECURE_CONTEXT" }));
    if (!navigator.geolocation) return reject(new Error("location_unsupported"));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        _qrScanLocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString(),
          device: isMobileQrDevice() ? "mobile" : "desktop",
          userAgent: navigator.userAgent,
        };
        _qrScanLocationStatus = "acquired";
        resolve(_qrScanLocationData);
      },
      (error) => { _qrScanLocationStatus = "unavailable"; reject(error); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

function openPhoneAttendanceGuide() {
  openDialog({ type: "phoneQr", important: false });
}

// ─── QR Camera Scanner ──────────────────────────────────────────────────────

let _qrDebugTicker = null;
let _qrDiagState = {}; // shared state for diagnostics snapshot

function stopQrCameraScanner() {
  if (_qrScanRafId) { cancelAnimationFrame(_qrScanRafId); _qrScanRafId = null; }
  if (_qrDebugTicker) { clearInterval(_qrDebugTicker); _qrDebugTicker = null; }
  const video = document.getElementById("qrCameraVideo");
  if (_qrCameraStream) { _qrCameraStream.getTracks().forEach(t => t.stop()); _qrCameraStream = null; }
  if (video) { video.pause(); video.srcObject = null; }
}

// Update a single row in the debug panel (no-op if panel absent)
function _qrDB(key, val) {
  _qrDiagState[key] = String(val);
  const panel = document.getElementById("qrDebugPanel");
  if (!panel) return;
  let row = panel.querySelector(`[data-dbk]`);
  // Use a linear scan — avoids CSS.escape compat issues on old Safari
  for (const el of panel.querySelectorAll("[data-dbk]")) {
    if (el.getAttribute("data-dbk") === key) { el.textContent = `${key}: ${val}`; return; }
  }
  const div = document.createElement("div");
  div.setAttribute("data-dbk", key);
  div.textContent = `${key}: ${val}`;
  panel.querySelector(".qr-dbg-rows")?.appendChild(div) ?? panel.appendChild(div);
}

// Build the full diagnostic text for copy/send
function _qrBuildDiagnostic(videoEl, startTime) {
  const elapsed = startTime ? Math.round((Date.now() - startTime) / 100) / 10 : "—";
  const track = _qrCameraStream?.getVideoTracks()[0];
  let trackSettings = "—";
  try { trackSettings = JSON.stringify(track?.getSettings?.()); } catch {}
  const lines = [
    "QR DIAGNOSTICS",
    "──────────────────────",
    `Timestamp: ${new Date().toISOString()}`,
    `URL: ${location.href}`,
    `User agent: ${navigator.userAgent}`,
    `iOS: ${/iPhone|iPad|iPod/.test(navigator.userAgent)}`,
    `Safari: ${/Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)}`,
    `HTTPS: ${location.protocol === "https:"}`,
    `Page visibility: ${document.visibilityState}`,
    "",
    `Video element found: ${videoEl ? "yes" : "NO"}`,
    `Same element: ${_qrDiagState.sameElement || "—"}`,
    `Connected: ${videoEl?.isConnected ?? "—"}`,
    `srcObject: ${videoEl?.srcObject ? "yes" : "none"}`,
    `Video paused: ${videoEl?.paused ?? "—"}`,
    `Video readyState: ${videoEl?.readyState ?? "—"}`,
    `Video size: ${videoEl ? videoEl.videoWidth + "×" + videoEl.videoHeight : "—"}`,
    `Rendered size: ${_qrDiagState.renderedSize || "—"}`,
    `CSS display: ${_qrDiagState.cssDisplay || "—"}`,
    `CSS height: ${_qrDiagState.cssHeight || "—"}`,
    `CSS opacity: ${_qrDiagState.cssOpacity || "—"}`,
    "",
    `Stream exists: ${_qrCameraStream ? "yes" : "no"}`,
    `Stream active: ${_qrCameraStream?.active ?? "—"}`,
    `Track readyState: ${track?.readyState ?? "—"}`,
    `Track enabled: ${track?.enabled ?? "—"}`,
    `Track muted: ${track?.muted ?? "—"}`,
    `Track settings: ${trackSettings}`,
    "",
    `Camera permission: ${_qrDiagState.camPermission || "—"}`,
    `Location permission: ${_qrDiagState.locPermission || "—"}`,
    "",
    `Current step: ${_qrDiagState.step || "—"}`,
    `Elapsed: ${elapsed}s`,
    `Last error: ${_qrDiagState.error || "none"}`,
  ];
  return lines.join("\n");
}

async function _qrCopyDiagnostic(videoEl, startTime, btn) {
  const text = _qrBuildDiagnostic(videoEl, startTime);
  const orig = btn.textContent;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback: create textarea, select, copy
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0.01;font-size:16px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    btn.textContent = "✓ Đã sao chép!";
  } catch {
    btn.textContent = "Lỗi copy";
  }
  setTimeout(() => { btn.textContent = orig; }, 2500);
}

async function _qrSendReport(videoEl, startTime, btn) {
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Đang gửi...";
  const track = _qrCameraStream?.getVideoTracks()[0];
  let trackSettings = null;
  try { trackSettings = track?.getSettings?.(); } catch {}
  const body = {
    timestamp: new Date().toISOString(),
    url: location.pathname + location.search,
    ua: navigator.userAgent,
    isHttps: location.protocol === "https:",
    pageVisibility: document.visibilityState,
    videoFound: !!videoEl,
    sameElement: _qrDiagState.sameElement || "—",
    connected: videoEl?.isConnected ?? false,
    hasSrcObject: !!videoEl?.srcObject,
    videoPaused: videoEl?.paused ?? null,
    videoReadyState: videoEl?.readyState ?? null,
    videoSize: videoEl ? videoEl.videoWidth + "x" + videoEl.videoHeight : "0x0",
    renderedSize: _qrDiagState.renderedSize || "—",
    streamExists: !!_qrCameraStream,
    trackState: track?.readyState ?? "—",
    trackEnabled: track?.enabled ?? null,
    trackMuted: track?.muted ?? null,
    trackSettings,
    camPermission: _qrDiagState.camPermission || "—",
    locPermission: _qrDiagState.locPermission || "—",
    currentStep: _qrDiagState.step || "—",
    elapsedMs: startTime ? Date.now() - startTime : null,
    lastErrorCode: _qrDiagState.error || "none",
    lastErrorMessage: _qrDiagState.error || "none",
    accountIdMasked: session?.accountId ? session.accountId.slice(0, 4) + "****" : "—",
  };
  try {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    const code = data.code || "QR-????";
    _qrDB("reportCode", code);
    btn.textContent = "✓ " + code;
    btn.disabled = false;
    // Show code prominently
    const codeEl = document.getElementById("qrReportCode");
    if (codeEl) { codeEl.textContent = "Mã báo cáo: " + code; codeEl.style.display = ""; }
  } catch {
    btn.textContent = "Lỗi gửi";
    btn.disabled = false;
    setTimeout(() => { btn.textContent = orig; }, 2000);
  }
}

// Live debug ticker — runs every 500ms, updates panel and _qrDiagState
function _qrStartDebugTicker(videoEl, refEl, startTime) {
  if (_qrDebugTicker) clearInterval(_qrDebugTicker);
  _qrDebugTicker = setInterval(() => {
    if (!document.getElementById("qrDebugPanel")) { clearInterval(_qrDebugTicker); _qrDebugTicker = null; return; }
    const cur = document.getElementById("qrCameraVideo");
    const elapsed = startTime ? ((Date.now() - startTime) / 1000).toFixed(1) + "s" : "—";
    _qrDB("elapsed", elapsed);
    _qrDB("sameElement", cur === refEl ? "yes ✓" : "NO — REPLACED ✗");
    _qrDB("connected", videoEl.isConnected ? "yes" : "NO ✗");
    _qrDB("srcObject", videoEl.srcObject ? "yes" : "none");
    const stream = _qrCameraStream;
    _qrDB("streamActive", stream ? (stream.active ? "yes" : "inactive") : "none");
    const track = stream?.getVideoTracks()[0];
    _qrDB("trackState", track ? track.readyState : "none");
    _qrDB("trackEnabled", track ? String(track.enabled) : "—");
    _qrDB("trackMuted", track ? String(track.muted) : "—");
    _qrDB("videoRS", videoEl.readyState + " / paused:" + videoEl.paused);
    _qrDB("videoSize", videoEl.videoWidth + "×" + videoEl.videoHeight);
    const cs = getComputedStyle(videoEl);
    _qrDB("cssDisplay", cs.display);
    _qrDB("cssHeight", cs.height);
    _qrDB("cssOpacity", cs.opacity);
    _qrDB("cssZIndex", cs.zIndex);
    const rect = videoEl.getBoundingClientRect();
    _qrDB("renderedSize", Math.round(rect.width) + "×" + Math.round(rect.height));
  }, 500);
}

function _withTimeout(promise, ms, errCode) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errCode)), ms)),
  ]);
}

// Try getUserMedia with progressively looser constraints
async function _qrGetStream() {
  const attempts = [
    { video: { facingMode: { exact: "environment" } }, audio: false },
    { video: { facingMode: "environment" }, audio: false },
    { video: { facingMode: { ideal: "environment" } }, audio: false },
    { video: true, audio: false },
  ];
  let lastErr;
  for (const c of attempts) {
    try {
      _qrDB("constraint", JSON.stringify(c.video));
      return await navigator.mediaDevices.getUserMedia(c);
    } catch (e) {
      lastErr = e;
      _qrDB("constraintErr", e.name);
      if (e.name === "NotAllowedError" || e.name === "SecurityError") throw e;
    }
  }
  throw lastErr;
}

// Main camera init — MUST originate directly from user tap
async function initQrCameraScanner() {
  const isDebug = isQrDebugEnabled();
  const previewOnly = isQrPreviewOnly();
  const startTime = Date.now();
  _qrDiagState = {};

  const videoEl = document.getElementById("qrCameraVideo");
  const canvas = document.getElementById("qrCameraCanvas");
  const status = document.getElementById("qrCameraStatus");
  const stopBtn = document.getElementById("qrCameraStop");
  const retryBtn = document.getElementById("qrCameraRetry");

  // Lookup permission states for debug
  if (navigator.permissions?.query) {
    navigator.permissions.query({ name: "camera" }).then(p => _qrDB("camPermission", p.state)).catch(() => {});
    navigator.permissions.query({ name: "geolocation" }).then(p => _qrDB("locPermission", p.state)).catch(() => {});
  }

  if (!videoEl || !status) {
    _qrDB("step", "FAILED_NO_ELEMENT");
    _qrDB("error", "VIDEO_ELEMENT_NOT_FOUND");
    return;
  }

  _qrDB("step", "init");
  _qrDB("videoFound", "yes");

  // Start live ticker immediately so panel is always fresh
  if (isDebug) _qrStartDebugTicker(videoEl, videoEl, startTime);

  // Wire retry button to reset overlay
  retryBtn?.addEventListener("click", () => {
    stopQrCameraScanner();
    retryBtn.style.display = "none";
    const overlay = document.getElementById("qrCameraStartOverlay");
    if (overlay) overlay.style.display = "";
    const startBtn = document.getElementById("qrCameraStart");
    if (startBtn) { startBtn.disabled = false; startBtn.textContent = "Khởi động camera"; }
    const hrFallback = document.getElementById("qrHrFallback");
    if (hrFallback) hrFallback.style.display = "none";
  });
  stopBtn?.addEventListener("click", () => { stopQrCameraScanner(); render(); });

  // Show "Nhập mã HR" fallback after 5s if camera not live yet
  const hrFallbackTimer = setTimeout(() => {
    const hrFallback = document.getElementById("qrHrFallback");
    if (hrFallback && !videoEl.classList.contains("is-playing")) hrFallback.style.display = "";
  }, 5000);

  // Auto-error after 20s stuck in loading — never infinite spinner
  const globalTimeout = setTimeout(() => {
    if (!videoEl.classList.contains("is-playing")) {
      _qrDB("error", "GLOBAL_TIMEOUT");
      stopQrCameraScanner();
      if (status) status.textContent = "Hết thời gian — nhấn Thử lại hoặc nhập mã HR.";
      if (retryBtn) retryBtn.style.display = "";
      const hrFallback = document.getElementById("qrHrFallback");
      if (hrFallback) hrFallback.style.display = "";
    }
  }, 20000);

  if (!navigator.mediaDevices?.getUserMedia) {
    clearTimeout(hrFallbackTimer); clearTimeout(globalTimeout);
    _qrDB("step", "NO_GUM");
    _qrDB("error", "GETUSERMEDIA_NOT_AVAILABLE");
    if (status) status.textContent = "Thiết bị không hỗ trợ camera.";
    return;
  }

  // Load jsQR
  if (!previewOnly && !window.jsQR) {
    const script = document.createElement("script");
    script.src = "/vendor/jsqr.min.js";
    document.head.appendChild(script);
    await new Promise((res, rej) => { script.onload = res; script.onerror = rej; });
  }

  if (status) status.textContent = "Đang xin quyền camera...";
  _qrDB("step", "getUserMedia");

  try {
    const stream = await _withTimeout(_qrGetStream(), 15000, "STREAM_TIMEOUT");
    _qrCameraStream = stream;
    clearTimeout(globalTimeout);
    clearTimeout(hrFallbackTimer);

    const videoRef = document.getElementById("qrCameraVideo");
    _qrDB("stream", "yes — " + stream.getVideoTracks().length + " track(s)");
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error("NO_VIDEO_TRACK");
    if (track.readyState !== "live") throw new Error("TRACK_NOT_LIVE");
    track.enabled = true;
    _qrDB("track", track.readyState + " / " + (track.label || "unknown"));
    track.addEventListener("ended", () => _qrDB("trackEvent", "ENDED"), { once: true });
    track.addEventListener("mute", () => _qrDB("trackEvent", "MUTED"));

    if (status) status.textContent = "Đang mở camera...";
    _qrDB("step", "attach");

    // Set ALL attributes before srcObject — iOS Safari ignores post-set changes
    videoRef.setAttribute("playsinline", "");
    videoRef.setAttribute("webkit-playsinline", "");
    videoRef.setAttribute("muted", "");
    videoRef.setAttribute("autoplay", "");
    videoRef.playsInline = true;
    videoRef.muted = true;
    videoRef.autoplay = true;

    videoRef.srcObject = stream;
    _qrDB("srcObject", "set");

    if (!videoRef.isConnected) throw new Error("VIDEO_ELEMENT_REPLACED");

    // loadedmetadata
    await _withTimeout(new Promise((resolve, reject) => {
      if (videoRef.readyState >= 1) return resolve();
      videoRef.addEventListener("loadedmetadata", resolve, { once: true });
      videoRef.addEventListener("error", () => reject(new Error("VIDEO_ELEMENT_ERROR")), { once: true });
    }), 8000, "METADATA_TIMEOUT");
    _qrDB("step", "metadata-ok rs=" + videoRef.readyState);

    if (!videoRef.isConnected) throw new Error("VIDEO_ELEMENT_REPLACED");

    // play()
    try {
      await videoRef.play();
      _qrDB("play()", "ok");
    } catch (playErr) {
      _qrDB("play() err", playErr.name);
      if (playErr.name === "NotAllowedError") throw new Error("PLAY_REJECTED");
    }

    // First frame
    await _withTimeout(new Promise((resolve) => {
      if (videoRef.videoWidth > 0) return resolve();
      const check = () => {
        if (!_qrCameraStream) return;
        if (videoRef.videoWidth > 0) return resolve();
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    }), 10000, "NO_VIDEO_FRAME");

    if (!videoRef.isConnected) throw new Error("VIDEO_ELEMENT_REPLACED");

    _qrDB("step", "LIVE " + videoRef.videoWidth + "×" + videoRef.videoHeight);
    if (stopBtn) stopBtn.style.display = "";
    videoRef.classList.add("is-playing");
    if (status) status.textContent = previewOnly
      ? "[preview-only] Camera live — " + videoRef.videoWidth + "×" + videoRef.videoHeight
      : "Đang quét... Hướng camera vào mã QR.";

    if (previewOnly) return;

    function scanFrame() {
      if (!_qrCameraStream || videoRef.readyState < 2 || videoRef.videoWidth === 0) {
        _qrScanRafId = requestAnimationFrame(scanFrame); return;
      }
      canvas.width = videoRef.videoWidth;
      canvas.height = videoRef.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
      if (code?.data) {
        stopQrCameraScanner();
        let token = code.data;
        try { const u = new URL(code.data); token = u.searchParams.get("token") || u.pathname.split("/").pop() || code.data; } catch {}
        if (status) status.textContent = "Đã nhận mã. Đang xác nhận...";
        navigate(`/attendance/scan?token=${encodeURIComponent(token)}`);
        return;
      }
      _qrScanRafId = requestAnimationFrame(scanFrame);
    }
    scanFrame();

  } catch (err) {
    clearTimeout(hrFallbackTimer); clearTimeout(globalTimeout);
    stopQrCameraScanner();
    const code = err.message || err.name;
    _qrDB("error", code);
    _qrDB("step", "ERROR");
    if (retryBtn) retryBtn.style.display = "";
    const hrFallback = document.getElementById("qrHrFallback");
    if (hrFallback) hrFallback.style.display = "";

    const msgMap = {
      STREAM_TIMEOUT:        ["Hết thời gian", "STREAM_TIMEOUT — Không nhận được phản hồi camera sau 15 giây.\n\nCài đặt iPhone → Safari → Camera → Cho phép"],
      NO_VIDEO_TRACK:        ["Không có luồng video", "NO_VIDEO_TRACK — Camera trả stream nhưng không có video track."],
      TRACK_NOT_LIVE:        ["Camera không hoạt động", "TRACK_NOT_LIVE — Camera track không ở trạng thái live."],
      METADATA_TIMEOUT:      ["Camera không phản hồi", "METADATA_TIMEOUT — Safari không trả metadata sau 8 giây.\n\nCài đặt iPhone → Safari → Camera → Cho phép\nRồi đóng tab và mở lại."],
      NO_VIDEO_FRAME:        ["Camera đen", "NO_VIDEO_FRAME — Camera đã mở nhưng không có hình sau 10 giây."],
      PLAY_REJECTED:         ["Safari từ chối phát", "PLAY_REJECTED — Đóng tab và thử lại."],
      VIDEO_ELEMENT_REPLACED:["Lỗi DOM", "VIDEO_ELEMENT_REPLACED — Trình quét bị render lại sau khi camera mở."],
      VIDEO_ELEMENT_ERROR:   ["Lỗi video element", "VIDEO_ELEMENT_ERROR — Video element báo lỗi."],
      CAMERA_NOT_FOUND:      ["Không tìm thấy camera", "Không có camera hoặc camera đang bị app khác dùng."],
    };
    const [title, body] = msgMap[code] || ["Lỗi camera", `${code}\n${err.name}`];

    if (err.name === "NotAllowedError" || err.name === "SecurityError") {
      _qrCameraConsentGiven = false;
      if (status) status.textContent = "Camera bị chặn — xem hướng dẫn bên dưới.";
      openDialog({ type: "alert", title: "Cần quyền camera", body: "CAMERA_PERMISSION_DENIED\n\nCài đặt iPhone → Safari → Camera → Cho phép\nhoặc: Cài đặt → Quyền riêng tư & Bảo mật → Camera → Safari → Bật." });
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      if (status) status.textContent = "Không tìm thấy camera.";
      openDialog({ type: "alert", title: "Không tìm thấy camera", body: "CAMERA_NOT_FOUND — Camera đang bị app khác dùng hoặc không tồn tại." });
    } else {
      if (status) status.textContent = code + " — Nhấn Thử lại hoặc nhập mã HR.";
      openDialog({ type: "alert", title, body });
    }
  }
}

// Entry point from button tap — keeps iOS gesture chain intact
async function handleQrStartButton(btn) {
  btn.disabled = true;
  btn.textContent = "Đang mở camera...";
  const overlay = document.getElementById("qrCameraStartOverlay");
  if (overlay) overlay.style.display = "none";
  window._qrStartTime = Date.now();
  await initQrCameraScanner();
}

// HR manual code entry — navigate to scan?token=... same as QR decode result
function handleQrHrCodeSubmit(input) {
  const raw = (input?.value || "").trim();
  if (!raw) { input?.focus(); return; }
  let token = raw;
  try { const u = new URL(raw); token = u.searchParams.get("token") || u.pathname.split("/").pop() || raw; } catch {}
  stopQrCameraScanner();
  navigate(`/attendance/scan?token=${encodeURIComponent(token)}`);
}

function destroyYoutubePlayer() {
  if (_ytPersistTimer) { clearInterval(_ytPersistTimer); _ytPersistTimer = null; }
  if (_ytWatchStart !== null) ytFlushRanges(true);
  if (youtubePlayer) { try { youtubePlayer.destroy(); } catch {} youtubePlayer = null; }
  _ytCourseId = ""; _ytContentId = ""; _ytAccountId = "";
}

function initYoutubeTracking(courseId, contentId, accountId, videoId, requiredPercent = 90) {
  destroyYoutubePlayer();
  _ytCourseId = courseId; _ytContentId = contentId; _ytAccountId = accountId;
  const state = getContentProgress(accountId, courseId).find(x => x.contentId === contentId);
  _ytWatchRanges = state?.metadata?.watchedRanges ? [] : [];

  function setupPlayer() {
    if (!window.YT?.Player) return;
    const iframe = document.getElementById("youtube-player");
    if (!iframe) return;
    youtubePlayer = new window.YT.Player(iframe, {
      events: {
        onStateChange(e) {
          const YT = window.YT;
          if (e.data === YT.PlayerState.PLAYING) {
            if (!document.hidden) {
              try { _ytWatchStart = youtubePlayer.getCurrentTime(); } catch {}
            }
          } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED || e.data === YT.PlayerState.BUFFERING) {
            if (_ytWatchStart !== null) {
              try { _ytWatchRanges.push({ start: _ytWatchStart, end: youtubePlayer.getCurrentTime() }); } catch {}
              _ytWatchStart = null;
            }
            ytFlushRanges(false);
            if (e.data === YT.PlayerState.ENDED) ytFlushRanges(true);
          }
        },
      },
    });
    _ytPersistTimer = setInterval(() => {
      if (document.hidden || _ytWatchStart === null) return;
      ytFlushRanges(false);
    }, 8000);
  }

  if (window.YT?.Player) {
    setupPlayer();
  } else {
    window._ytReadyCallbacks = window._ytReadyCallbacks || [];
    window._ytReadyCallbacks.push(setupPlayer);
    if (!document.getElementById("yt-api-script")) {
      const s = document.createElement("script");
      s.id = "yt-api-script";
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
      window.onYouTubeIframeAPIReady = () => {
        (window._ytReadyCallbacks || []).forEach(fn => fn());
        window._ytReadyCallbacks = [];
      };
    }
  }
}
let courseDetailTab = "overview";
let notificationSearch = "";
let notificationComposerOpen = false;
let notificationMonitor = null;
let notificationMonitorLoading = false;
let auditState = { rows: [], total: 0, page: 1, pageSize: 25, loading: false, error: "", overview: null, detail: null, detailLoading: false };
let auditFilters = { date_from: "", date_to: "", actor_role: "", action: "", category: "", severity: "", entity_type: "", source: "", status: "", search: "", page: 1, pageSize: 25 };
let retrainingState = { rows: [], loading: false, error: "", preview: null };
let liveTrainingState = {
  flows: [], detail: null, participants: [], loading: false, detailLoading: false, error: "",
  createOpen: false, search: "", actionId: "", participantActionId: "",
  roster: [], rosterLoading: false, rosterParsed: null, rosterReplaceMode: true, rosterSearch: "",
};
let liveDeleteState = { flowId: null, flowTitle: "", loading: false, error: "" };
let publicTrainingState = {
  bootstrap: "unknown", // unknown | loadingFlow | checkingParticipant | needsName | ready | completed | networkError | error
  token: "", flow: null, steps: null, participant: null, completionEligible: false,
  loading: false, joining: false, error: "", name: "", action: "", pollTimer: 0,
  requestSeq: 0, lastJson: "", inFlight: false,
  roster: [], rosterSearch: "", rosterDropdownOpen: false, selectedRosterId: null, outsideRoster: false,
};
let gallerySearch = "";
let galleryYear = "";
let resourceSearch = "";
let employeeFormOpen=false;
let employeeCreateResult=null;
let notificationModalOpen=false;
let notificationFilter="all";
let notificationPage=1;
let selectedNotificationId="";
let galleryEditorOpen=false;
let selectedAlbumId="";
let mediaViewerIndex=-1;
let galleryMediaFilter="all";
let calendarView="upcoming";
let calendarMonthOffset=0;
let sessionFormOpen=false;
let selectedOfflineSessionId="";
let busySessionId="";
let selectedQrSlotId="";
let selectedQrAction="check_in";
let currentQrTokenId="";
let qrProjectorOpen=false;
let qrScanInput="";
let _qrScanLocationData = null;
let _qrScanLocationStatus = "pending";
let _qrCameraConsentGiven = false;

// Persist debugQr/previewOnly across SPA route transitions (query is lost on navigate())
;(function() {
  const p = new URLSearchParams(window.location.search);
  if (p.get("debugQr") === "1") sessionStorage.setItem("mykis.debugQr", "1");
  if (p.get("previewOnly") === "1") sessionStorage.setItem("mykis.previewOnly", "1");
})();

function isQrDebugEnabled() {
  return new URLSearchParams(window.location.search).get("debugQr") === "1"
    || sessionStorage.getItem("mykis.debugQr") === "1";
}
function isQrPreviewOnly() {
  return new URLSearchParams(window.location.search).has("previewOnly")
    || sessionStorage.getItem("mykis.previewOnly") === "1";
}
let selectedSessionDepartments = [];
let sessionEmployeeSearch = "";
let sessionEmployeeDepartment = "";
let sessionEmployeePage = 1;
let sessionParticipantDraft = null;
let participantSyncState = { saving: false, error: "" };
// Tracks accounts that were successfully synced in the last save (for ✓ badge UI)
let _recentlySyncedParticipants = new Set();
// Tracks which sessions have been auto-synced to Supabase in this browser session
const _participantSyncedSessions = new Set();

// Remote participant cache — populated by fetchParticipantsFromApi()
let _remoteParticipantIds = new Map(); // sessionId → Set<accountId> from Supabase
let _participantsLoadingFor = ""; // sessionId currently being loaded

// Remote sessions cache — populated by fetchSessionsFromApi()
let _sessions = null; // null = not loaded
let _sessionsLoading = false;
let _sessionsError = "";
let _sessionsAccountId = "";

// Backfill state
let _backfillRunning = false;
let _backfillReport = null;

// Async calendar state — populated by fetchCalendarEvents(), read by learningCalendarPageV3()
let _calendarEvents = null;       // null = not yet loaded
let _calendarLoading = false;
let _calendarError = null;
let _calendarSource = "";         // "api" | "local"
let _calendarAccountId = "";      // detect account switch

// ── Course API cache ─────────────────────────────────────────────
let _courses = null;          // null = not loaded, [] = loaded but empty
let _coursesLoading = false;
let _coursesError = null;
let _coursesAccountId = "";
let _enrollments = null;
let _enrollmentsLoading = false;
let _enrollmentsAccountId = "";
let _hrOverview = null;
let _hrOverviewLoading = false;
let _hrOverviewError = "";
let _hrOverviewLoadedAt = 0;
let _hrOverviewTab = "inactive";
let _hrOverviewPollId = 0;
let _hrTaskFilter = "all"; // "all" | "new" | "in_progress" | "high"
let _activityHeartbeatId = 0;
let _activityLastKey = "";
let _learningHistory = null;
let _learningHistoryLoading = false;
let _learningHistoryError = "";
let _learningHistoryTab = "all";
let _learningHistoryFilter = "";
let _learningForm = "";
// ── Learning Path state ───────────────────────────────────────
let _lpList = null;
let _lpListLoading = false;
let _lpListError = "";
let _lpDetail = null;
let _lpDetailLoading = false;
let _lpDetailError = "";
let _lpDetailId = "";
let _lpFormMode = ""; // "" | "create" | "edit"
let _lpFormData = {};
let _lpAddStepOpen = false;
let _lpAddStepType = "course";
let _lpStepPickSearch = "";
let _lpStepPickResults = [];
let _lpAssignOpen = false;
let _lpAssignTarget = "individual";
let _lpAssignDept = "";
let _lpAssignPosition = "";
let _lpAssignEmpIds = [];
let _lpAssignStartAt = "";
let _lpAssignDueAt = "";
let _lpPreviewData = null;
let _lpPreviewLoading = false;
let _lpAssignFilter = "all";
let _lpAssignSearch = "";
// Employee LP state
let _myLpList = null;
let _myLpLoading = false;
let _myLpError = "";
let _myLpDetail = null;
let _myLpDetailAssignmentId = "";
// ── Compliance Training state ────────────────────────────────
let _complianceOverview = null;
let _compliancePrograms = null;
let _complianceCycles = null;
let _complianceAssignments = {};
let _complianceLoading = false;
let _complianceError = "";
let _complianceProgramFormOpen = false;
let _complianceCycleFormOpen = false;
let _complianceTargetProgramId = "";
let _compliancePreview = null;
let _complianceMy = null;
let _complianceMyDetail = null;
let _complianceMyLoading = false;
let _complianceActionError = "";
let _learningSubmitting = false;
let _adminLearning = { summary: null, records: [], certifications: [], totalRecords: 0, totalCertifications: 0, page: 1, tab: "pending", status: "", q: "", loading: false, error: "" };
let _adminLearningDetail = null;
let _adminLearningActionNote = "";
let _certAdmin = { overview: null, types: [], rows: [], missing: [], requirements: [], loading: false, error: "", tab: "overview", q: "" };
let _certMy = { rows: [], loading: false, error: "", formOpen: false, renewId: "", submitting: false };
let _competencyState = {
  catalog: null, matrix: null, assessments: [], plans: [], my: null, myPlans: [],
  loading: false, error: "", q: "", status: "", department: "", employeeId: "", matrixPage: 1,
};

let sessionImportPreviewRows = [];

// Employee offline-training-time hydration state (analytics cache).
// calculateEmployeeTrainingTime reads this sync; hydrateOfflineTrainingData fills it async.
let _offlineTrainingLoadedFor = "";

const GALLERY_KEY = "mykis.galleryAlbums.v1";
const RESOURCES_KEY = "mykis.courseResources.v1";
const REPORT_SNAPSHOTS_KEY = "mykis.reportSnapshots.v1";
const readLocalRows = (key) => { try { const value=JSON.parse(localStorage.getItem(key)||"[]"); return Array.isArray(value)?value:[]; } catch { return []; } };
const writeLocalRows = (key, rows) => localStorage.setItem(key, JSON.stringify(rows));

function apiHeaders(extra = {}) {
  const headers = { ...extra };
  if (session?.supabaseAccessToken) headers.Authorization = `Bearer ${session.supabaseAccessToken}`;
  if (session?.accountId) headers["X-Account-Id"] = session.accountId;
  if (session?.role) headers["X-Account-Role"] = session.role;
  return headers;
}

async function apiJson(url, options = {}) {
  const headers = apiHeaders({ ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) });
  const res = await fetch(url, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.message || "Không thể tải dữ liệu.");
  return body;
}

function liveT(key) {
  const labels = {
    title: { vi: "Hành trình buổi học", en: "Live training journey", kr: "실시간 교육 여정" },
    create: { vi: "Tạo hành trình buổi học", en: "Create journey", kr: "교육 여정 만들기" },
    sessionTitle: { vi: "Tên buổi học", en: "Session title", kr: "교육명" },
    description: { vi: "Mô tả", en: "Description", kr: "설명" },
    pretestUrl: { vi: "Link Pre-test", en: "Pre-test link", kr: "사전 테스트 링크" },
    posttestUrl: { vi: "Link Post-test", en: "Post-test link", kr: "사후 테스트 링크" },
    evaluationUrl: { vi: "Link đánh giá", en: "Evaluation link", kr: "평가 링크" },
    required: { vi: "Bắt buộc", en: "Required", kr: "필수" },
    optional: { vi: "Không bắt buộc", en: "Optional", kr: "선택" },
    openStep: { vi: "Mở bước", en: "Open step", kr: "단계 열기" },
    closeStep: { vi: "Đóng bước", en: "Close step", kr: "단계 닫기" },
    pretest: { vi: "Pre-test", en: "Pre-test", kr: "사전 테스트" },
    posttest: { vi: "Post-test", en: "Post-test", kr: "사후 테스트" },
    evaluation: { vi: "Đánh giá", en: "Evaluation", kr: "평가" },
    completion: { vi: "Hoàn thành buổi học", en: "Complete session", kr: "교육 완료" },
    doPretest: { vi: "Làm Pre-test", en: "Take Pre-test", kr: "사전 테스트 응시" },
    doPosttest: { vi: "Làm Post-test", en: "Take Post-test", kr: "사후 테스트 응시" },
    openEvaluation: { vi: "Mở form đánh giá", en: "Open evaluation form", kr: "평가 양식 열기" },
    donePretest: { vi: "Tôi đã hoàn thành Pre-test", en: "I completed the Pre-test", kr: "사전 테스트 완료" },
    donePosttest: { vi: "Tôi đã hoàn thành Post-test", en: "I completed the Post-test", kr: "사후 테스트 완료" },
    doneEvaluation: { vi: "Tôi đã hoàn thành đánh giá", en: "I completed the evaluation", kr: "평가 완료" },
    waiting: { vi: "Đang chờ HR mở phần này.", en: "Waiting for HR to open this step.", kr: "HR이 이 단계를 열 때까지 대기 중입니다." },
    waitingNamed: { vi: "Đang chờ HR mở {step}...", en: "Waiting for HR to open {step}...", kr: "HR이 {step} 단계를 열 때까지 대기 중입니다..." },
    missingUrl: { vi: "HR chưa cập nhật liên kết.", en: "HR has not added a link yet.", kr: "HR이 링크를 아직 입력하지 않았습니다." },
    switchParticipant: { vi: "Đổi người tham gia", en: "Switch participant", kr: "참가자 변경" },
    completed: { vi: "Bạn đã hoàn thành buổi học.", en: "You have completed the session.", kr: "교육을 완료했습니다." },
    invalidLink: { vi: "Liên kết không hợp lệ", en: "Invalid link", kr: "유효하지 않은 링크" },
    expiredLink: { vi: "Liên kết đã hết hạn", en: "Link expired", kr: "링크가 만료되었습니다" },
    closedFlow: { vi: "Phiên học đã đóng", en: "Session closed", kr: "교육이 종료되었습니다" },
    started: { vi: "Đã bắt đầu", en: "Started", kr: "시작됨" },
    done: { vi: "Đã hoàn thành", en: "Completed", kr: "완료" },
    notOpen: { vi: "Chưa mở", en: "Not open", kr: "열리지 않음" },
    available: { vi: "Có thể thực hiện", en: "Available", kr: "진행 가능" },
    fullName: { vi: "Họ và tên", en: "Full name", kr: "성명" },
    start: { vi: "Bắt đầu", en: "Start", kr: "시작" },
    copyLink: { vi: "Copy link", en: "Copy link", kr: "링크 복사" },
    manage: { vi: "Mở quản lý", en: "Manage", kr: "관리" },
    liveNote: { vi: "Trạng thái hoàn thành do người tham gia tự xác nhận. Kết quả Quizizz và Google Forms chưa được đồng bộ tự động.", en: "Completion is self-confirmed by participants. Quizizz and Google Forms results are not synchronized automatically yet.", kr: "완료 상태는 참가자 자기 확인 기준입니다. Quizizz와 Google Forms 결과는 아직 자동 동기화되지 않습니다." },
    duplicateNote: { vi: "Nếu có người trùng họ tên, hãy yêu cầu nhập thêm mã nhân viên sau họ tên, ví dụ: Nguyễn Văn An - KIS0123.", en: "If names duplicate, ask participants to add employee code after their name, for example: Nguyen Van An - KIS0123.", kr: "동명이인이 있으면 이름 뒤에 사번을 추가하도록 안내하세요." },
    resuming: { vi: "Đang khôi phục tiến độ…", en: "Restoring progress…", kr: "진행 상황 복원 중…" },
    networkError: { vi: "Không thể khôi phục tiến độ", en: "Could not restore progress", kr: "진행 상황을 복원할 수 없습니다" },
    retry: { vi: "Thử lại", en: "Try again", kr: "다시 시도" },
    nameHint: { vi: "Họ tên được dùng để khôi phục tiến độ khi bạn truy cập lại.", en: "Your name is used to restore progress when you return.", kr: "이름은 재접속 시 진행 상황을 복원하는 데 사용됩니다." },
    notOnList: { vi: "Không có tên trong danh sách", en: "My name is not on the list", kr: "명단에 이름이 없습니다" },
    backToList: { vi: "Quay lại danh sách", en: "Back to list", kr: "목록으로 돌아가기" },
    searchName: { vi: "Tìm tên...", en: "Search name...", kr: "이름 검색..." },
    selectName: { vi: "Chọn họ và tên", en: "Select your name", kr: "이름을 선택하세요" },
    rosterTitle: { vi: "Danh sách tham gia", en: "Participant roster", kr: "참가자 명단" },
    importRoster: { vi: "Nhập danh sách", en: "Import roster", kr: "명단 가져오기" },
    saveRoster: { vi: "Lưu danh sách", en: "Save roster", kr: "명단 저장" },
    clearRoster: { vi: "Xóa toàn bộ danh sách", en: "Clear entire roster", kr: "전체 명단 삭제" },
    replaceRoster: { vi: "Thay thế danh sách", en: "Replace roster", kr: "명단 교체" },
    appendRoster: { vi: "Bổ sung vào danh sách", en: "Append to roster", kr: "명단에 추가" },
    speakerLabel: { vi: "Diễn giả", en: "Speaker", kr: "발표자" },
  };
  return labels[key]?.[language] || labels[key]?.vi || key;
}

function liveTrainingStorageKey(flowId) {
  return `mykis.publicTraining.${flowId}`;
}

function publicTokenHeader() {
  const flowId = publicTrainingState.flow?.id;
  const token = flowId ? localStorage.getItem(liveTrainingStorageKey(flowId)) : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function applyPublicTrainingPayload(payload) {
  publicTrainingState.flow = payload.flow || publicTrainingState.flow;
  publicTrainingState.steps = payload.steps || publicTrainingState.steps;
  publicTrainingState.participant = payload.participant || publicTrainingState.participant;
  publicTrainingState.completionEligible = Boolean(payload.completionEligible);
}

async function fetchPublicTrainingInitial(accessToken) {
  publicTrainingState.token = accessToken;
  publicTrainingState.error = "";
  publicTrainingState.bootstrap = "loadingFlow";
  render();
  try {
    const res = await fetch(`/api/public/live-training/${encodeURIComponent(accessToken)}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "NOT_FOUND");
    applyPublicTrainingPayload(body);
    // Fetch roster in background (best-effort)
    fetch(`/api/public/live-training/${encodeURIComponent(accessToken)}/roster`).then((r) => r.json()).then((rb) => { if (rb.ok) publicTrainingState.roster = rb.roster || []; }).catch(() => {});
    const flowId = publicTrainingState.flow?.id;
    const stored = flowId ? localStorage.getItem(liveTrainingStorageKey(flowId)) : "";
    if (stored) {
      publicTrainingState.bootstrap = "checkingParticipant";
      render(); // show hydration skeleton — no join form visible
      await fetchPublicTrainingState(true); // sets bootstrap to ready/completed/needsName
    } else {
      publicTrainingState.bootstrap = "needsName";
      render();
    }
    startPublicTrainingPolling();
  } catch (err) {
    publicTrainingState.bootstrap = "error";
    publicTrainingState.error = err.message || "NOT_FOUND";
    render();
  }
}

async function fetchPublicTrainingState(shouldRender = true) {
  const _flowId = publicTrainingState.flow?.id;
  const _storedToken = _flowId ? localStorage.getItem(liveTrainingStorageKey(_flowId)) : "";
  if (!_storedToken) return;
  if (!publicTrainingState.token || !_flowId || publicTrainingState.inFlight) return;
  const seq = ++publicTrainingState.requestSeq;
  publicTrainingState.inFlight = true;
  try {
    const res = await fetch(`/api/public/live-training/${encodeURIComponent(publicTrainingState.token)}/state`, { headers: publicTokenHeader() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "STATE_ERROR");
    if (seq !== publicTrainingState.requestSeq) return;
    const nextJson = JSON.stringify(body);
    const changed = nextJson !== publicTrainingState.lastJson;
    if (changed) {
      publicTrainingState.lastJson = nextJson;
      applyPublicTrainingPayload(body);
    }
    // Always update bootstrap when resolving from checkingParticipant or when data changed
    const wasChecking = publicTrainingState.bootstrap === "checkingParticipant" || publicTrainingState.bootstrap === "networkError";
    if (changed || wasChecking) {
      const p = publicTrainingState.participant;
      publicTrainingState.bootstrap = p?.completedAt ? "completed" : p ? "ready" : "needsName";
      if (shouldRender && route.startsWith("/join/")) render();
    }
  } catch (err) {
    if (seq !== publicTrainingState.requestSeq) return;
    if (String(err.message).includes("UNAUTHORIZED") || String(err.message).includes("INVALID_PARTICIPANT")) {
      const flowId = publicTrainingState.flow?.id;
      if (flowId) localStorage.removeItem(liveTrainingStorageKey(flowId));
      publicTrainingState.participant = null;
      publicTrainingState.bootstrap = "needsName";
      if (shouldRender) render();
    } else {
      // Network/transient error — don't clear token, show retry
      if (publicTrainingState.bootstrap === "checkingParticipant") {
        publicTrainingState.bootstrap = "networkError";
        if (shouldRender) render();
      }
    }
  } finally {
    publicTrainingState.inFlight = false;
  }
}

function startPublicTrainingPolling() {
  clearTimeout(publicTrainingState.pollTimer);
  if (!route.startsWith("/join/")) return;
  const bs = publicTrainingState.bootstrap;
  if (bs !== "ready" && bs !== "completed") return; // only poll after hydration
  const interval = document.hidden ? 8000 : 2000;
  publicTrainingState.pollTimer = setTimeout(async () => {
    await fetchPublicTrainingState(true);
    startPublicTrainingPolling();
  }, interval);
}

async function loadLiveTrainingList() {
  liveTrainingState.loading = true;
  liveTrainingState.error = "";
  render();
  try {
    const data = await apiJson("/api/admin/live-training");
    liveTrainingState.flows = data.flows || [];
  } catch (err) {
    liveTrainingState.error = err.message;
  } finally {
    liveTrainingState.loading = false;
    if (route === "/admin/live-training") render();
  }
}

async function loadRoster(id) {
  liveTrainingState.rosterLoading = true;
  try {
    const data = await apiJson(`/api/admin/live-training/${encodeURIComponent(id)}/roster`);
    liveTrainingState.roster = data.roster || [];
  } catch (_) { liveTrainingState.roster = []; }
  liveTrainingState.rosterLoading = false;
  if (route.startsWith("/admin/live-training/")) render();
}

async function importRoster(id, records, replace) {
  const data = await apiJson(`/api/admin/live-training/${encodeURIComponent(id)}/roster/import`, { method: "POST", body: JSON.stringify({ records, replace }) });
  return data;
}

async function loadLiveTrainingDetail(id) {
  liveTrainingState.detailLoading = true;
  liveTrainingState.error = "";
  render();
  try {
    const [detail, participants] = await Promise.all([
      apiJson(`/api/admin/live-training/${encodeURIComponent(id)}`),
      apiJson(`/api/admin/live-training/${encodeURIComponent(id)}/participants`),
    ]);
    liveTrainingState.detail = detail.flow;
    liveTrainingState.participants = participants.participants || [];
    loadRoster(id);
  } catch (err) {
    liveTrainingState.error = err.message;
  } finally {
    liveTrainingState.detailLoading = false;
    if (route.startsWith("/admin/live-training/")) render();
  }
}

initMockDatabase();

const hrContact = "Nguyễn Thị Cẩm Thanh";

const courses = [
  ["users", "Leadership Training Course", "Chương trình phát triển năng lực lãnh đạo, quản lý đội ngũ, ra quyết định và thúc đẩy hiệu suất làm việc.", 1, ["Khóa đào tạo Kỹ năng Lãnh đạo", "리더십 교육 과정", "Đã diễn ra"], "/images/leadership-training-course.png"],
  ["message", "Communication Training Course", "Chương trình thực hành kỹ năng giao tiếp, lắng nghe, phản hồi, phối hợp nội bộ và trao đổi với khách hàng.", 1, ["Khóa đào tạo Kỹ năng Giao tiếp", "커뮤니케이션 교육 과정", "Đã diễn ra"], "/images/communication-training-course.png"],
  ["chart", "Kiến thức chứng khoán cơ bản", "Củng cố kiến thức nền tảng về thị trường chứng khoán, sản phẩm dịch vụ và vận hành trong ngành.", 8, ["Nghiệp vụ", "Nền tảng"]],
  ["award", "Chứng chỉ hành nghề Môi giới chứng khoán", "Lộ trình ôn tập, tài liệu chuyên đề, bộ câu hỏi luyện tập và nội dung trọng tâm hỗ trợ nhân viên chuẩn bị cho kỳ thi chứng chỉ hành nghề.", 5, ["Tài liệu ôn tập trọng tâm", "Bộ đề luyện tập", "Theo dõi tiến độ ôn thi", "Chuẩn bị cho kỳ thi UBCKNN"]],
  ["message", "Kỹ năng mềm", "Phát triển các kỹ năng thực chiến như giao tiếp, phối hợp nội bộ, phản hồi, trình bày và chăm sóc khách hàng.", 7, ["Communication", "FAB"]],
  ["grid", "Báo cáo & trình bày công việc", "Chuẩn hóa kỹ năng báo cáo, sắp xếp vấn đề, trình bày mạch lạc và phối hợp với cấp quản lý.", 6, ["Báo cáo", "Quản trị"]],
];

const allTrainingCourses = [
  ...courses,
  ...Array.from({ length: 26 }, (_, index) => [`file`, `KIS Training Archive ${index + 1}`, "Khóa đào tạo nội bộ đã ghi nhận trên hệ thống.", 1, ["Internal"]]),
];

const trainingEnrollments = [
  { employeeId: "E001", courseId: "leadership", trainingHours: 16 },
  { employeeId: "E002", courseId: "communication", trainingHours: 12 },
  { employeeId: "E003", courseId: "communication", trainingHours: 12 },
  { employeeId: "E004", courseId: "leadership", trainingHours: 16 },
  { employeeId: "E001", courseId: "communication", trainingHours: 12 },
  ...Array.from({ length: 424 }, (_, index) => ({
    employeeId: `ED${String(index + 1).padStart(3, "0")}`,
    courseId: index % 2 ? "communication" : "leadership",
    trainingHours: index < 54 ? 2 : 3,
  })),
];

const upcomingCourses = [
  ["chart", "Kiến thức chứng khoán cơ bản", "Chuyên môn", "Trực tuyến", "Sắp mở đăng ký"],
  ["award", "Ôn tập Chứng chỉ hành nghề Môi giới chứng khoán", "Chứng chỉ chuyên môn", "Kết hợp", "Sắp diễn ra"],
  ["grid", "Excel nâng cao cho báo cáo", "Công cụ làm việc", "Trực tiếp", "Đang lên kế hoạch"],
  ["message", "Kỹ năng báo cáo và trình bày vấn đề", "Kỹ năng mềm", "Trực tuyến", "Sắp mở đăng ký"],
];

const hrAnnouncements = [
  ["Onboarding", "Lịch đào tạo hội nhập dành cho nhân viên mới", "Nhân viên mới vui lòng hoàn thành các nội dung đào tạo hội nhập bắt buộc theo thời hạn được giao."],
  ["Chứng chỉ chuyên môn", "Kế hoạch ôn tập Chứng chỉ hành nghề Môi giới chứng khoán", "HR sẽ cập nhật tài liệu, lịch ôn tập và danh sách nhân viên tham gia trong thời gian tới."],
  ["Kỹ năng mềm", "Cập nhật tài liệu Communication Training", "Tài liệu đào tạo và nội dung thực hành đã được cập nhật trên MyKIS Learning."],
  ["Đánh giá", "Nhắc hoàn thành bài kiểm tra sau đào tạo", "Nhân viên vui lòng kiểm tra deadline và hoàn thành bài đánh giá đúng thời hạn."],
];

const timelineData = {
  2015: { image: "/assets/timeline/2015.jpeg", events: ["01/06/2015: Thành lập Phòng giao dịch Bà Triệu, Hà Nội.", "08/07/2015: Thành lập Phòng giao dịch Nguyễn Tri Phương, TP. Hồ Chí Minh.", "09/01/2015: KIS Việt Nam tăng vốn điều lệ từ 264 tỷ đồng lên 1.113 tỷ đồng."] },
  2016: { image: "/assets/timeline/2016.jpeg", events: ["06/07/2016: Thành lập Phòng giao dịch Láng Hạ, Hà Nội.", "06/09/2016: Thành lập Phòng giao dịch Phạm Ngọc Thạch, TP. Hồ Chí Minh.", "2016: KIS được vinh danh Top 10 công ty chứng khoán dẫn đầu về thị phần môi giới tại HOSE và HNX."] },
  2018: { image: "/assets/timeline/2018.png", events: ["11/06/2018: KIS trở thành thành viên giao dịch thị trường chứng khoán phái sinh.", "14/05/2018: KIS tăng vốn điều lệ từ 1.113 tỷ đồng thành 1.897 tỷ đồng."] },
  2019: { image: "/assets/timeline/2019.jpeg", events: ["07/06/2019: KIS là 1 trong 7 công ty chứng khoán đầu tiên nhận Chứng nhận phát hành chứng quyền.", "03/09/2019: Đổi tên và chuyển trụ sở chi nhánh Nguyễn Tri Phương thành chi nhánh Sài Gòn tại Tòa nhà TNR."] },
  2020: { image: "/assets/timeline/2020.png", events: ["30/06/2020: KIS tăng vốn điều lệ lên 2.596 tỷ VND, nâng tỷ lệ sở hữu của KIS Hàn Quốc lên 99.7%.", "TOP 9 thị phần môi giới năm 2020 sàn HOSE."] },
  2021: { image: "/assets/timeline/2021.png", events: ["30/06/2021: KIS tăng vốn điều lệ lên 3.761 tỷ VND, nâng tỷ lệ sở hữu của KIS Hàn Quốc lên 99.8%.", "TOP 10 thị phần quý 2 năm 2021 sàn HOSE."] },
  2025: { image: "/assets/timeline/2025.jpeg", events: ["Tăng vốn điều lệ lên 4.550 tỷ đồng.", "TOP 9 thị phần môi giới HOSE năm 2025."] },
};


function d() {
  return dictionaries[language] || dictionaries.vi;
}

function t(path) {
  if(path==="admin.sessions")return {vi:"Lớp trực tiếp",en:"Live sessions",kr:"오프라인 수업"}[language];
  const resolve = (dict) => path.split(".").reduce((obj, key) => obj?.[key], dict);
  return resolve(d()) ?? resolve(dictionaries.vi) ?? path;
}

function uiText(key) {
  const labels = {
    announcements: { vi: "Thông báo", en: "Announcements", kr: "공지사항" },
    quickLinks: { vi: "Liên kết nhanh", en: "Quick Links", kr: "빠른 링크" },
    support: { vi: "Hỗ trợ", en: "Support", kr: "지원" },
    contactSupport: { vi: "Liên hệ hỗ trợ", en: "Contact Support", kr: "지원 문의" },
    contactPerson: { vi: "Liên hệ phụ trách", en: "Contact Person", kr: "담당자 연락처" },
    employeeOnly: { vi: "Dành riêng cho nhân viên KIS Việt Nam", en: "Exclusively for KIS Vietnam employees", kr: "KIS 베트남 임직원 전용" },
    internalOnly: { vi: "Chỉ sử dụng nội bộ", en: "Internal Use Only", kr: "내부 전용" },
    cchnTitle: { vi: "Danh sách nhân viên sở hữu Chứng chỉ hành nghề", en: "Employees Holding Professional Certificates", kr: "전문 자격증 보유 임직원 명단" },
    no: { vi: "STT", en: "No.", kr: "번호" },
    fullName: { vi: "Họ và tên", en: "Full Name", kr: "성명" },
    searchName: { vi: "Tìm kiếm theo tên", en: "Search by name", kr: "이름 검색" },
    learner: { vi: "Học viên", en: "Learner", kr: "학습자" }, overview: { vi: "Tổng quan", en: "Overview", kr: "개요" }, myCourses: { vi: "Khóa học của tôi", en: "My Courses", kr: "내 교육 과정" },
    inProgressCourses: { vi: "Khóa đang học", en: "Courses in Progress", kr: "학습 중인 과정" }, completed: { vi: "Hoàn thành", en: "Completed", kr: "완료" }, overdue: { vi: "Quá hạn", en: "Overdue", kr: "기한 초과" }, newNotifications: { vi: "Thông báo mới", en: "New Notifications", kr: "새 알림" },
    viewAllCourses: { vi: "Xem tất cả khóa học", en: "View All Courses", kr: "전체 교육 과정 보기" }, continueLearning: { vi: "Tiếp tục học", en: "Continue Learning", kr: "계속 학습하기" }, startCourse: { vi: "Bắt đầu", en: "Start Course", kr: "시작하기" }, updateProgress: { vi: "Cập nhật tiến độ", en: "Update Progress", kr: "진도 업데이트" },
    notStarted: { vi: "Chưa bắt đầu", en: "Not Started", kr: "시작 전" }, inProgress: { vi: "Đang học", en: "In Progress", kr: "학습 중" }, markRead: { vi: "Đánh dấu đã đọc", en: "Mark as Read", kr: "읽음으로 표시" }, all: { vi: "Tất cả", en: "All", kr: "전체" },
    recentCourses: { vi: "Khóa học cần tiếp tục", en: "Courses to Continue", kr: "계속할 교육 과정" }, recentNotifications: { vi: "Thông báo gần đây", en: "Recent Notifications", kr: "최근 알림" }, deadline: { vi: "Hạn hoàn thành", en: "Deadline", kr: "마감일" }, progressLabel: { vi: "Tiến độ", en: "Progress", kr: "진도" },
    courseIntro: { vi: "Theo dõi các khóa học được giao và tiến độ hoàn thành của bạn.", en: "Track your assigned courses and completion progress.", kr: "배정된 교육 과정과 완료 진도를 확인하세요." }, noCourses: { vi: "Bạn chưa có khóa học", en: "You have no courses yet", kr: "아직 교육 과정이 없습니다" }, noCoursesDesc: { vi: "Các khóa học được HR giao sẽ xuất hiện tại đây.", en: "Courses assigned by HR will appear here.", kr: "HR이 배정한 교육 과정이 여기에 표시됩니다." }, noMatch: { vi: "Không có khóa học phù hợp", en: "No matching courses", kr: "일치하는 교육 과정이 없습니다" }, noMatchDesc: { vi: "Hãy chọn trạng thái khác để xem các khóa học của bạn.", en: "Choose another status to view your courses.", kr: "다른 상태를 선택해 교육 과정을 확인하세요." },
    noRecentCourses: { vi: "Bạn chưa được giao khóa học nào.", en: "You have not been assigned any courses.", kr: "배정된 교육 과정이 없습니다." }, noRecentCoursesDesc: { vi: "Các khóa học được HR giao sẽ xuất hiện tại đây.", en: "Courses assigned by HR will appear here.", kr: "HR이 배정한 교육 과정이 여기에 표시됩니다." }, noNotifications: { vi: "Bạn chưa có thông báo mới.", en: "You have no new notifications.", kr: "새 알림이 없습니다." }, completedOn: { vi: "Hoàn thành ngày", en: "Completed on", kr: "완료일" }, completedText: { vi: "Đã hoàn thành", en: "Completed", kr: "완료" }, viewNotifications: { vi: "Xem tất cả thông báo", en: "View All Notifications", kr: "전체 알림 보기" },
    navComplianceShort: { vi: "Tuân thủ", en: "Compliance", kr: "준법" },
    retraining: { vi: "Tái đào tạo", en: "Retraining", kr: "재교육" },
    logout: { vi: "Đăng xuất", en: "Sign out", kr: "로그아웃" }, logoutSuccess: { vi: "Đăng xuất thành công.", en: "Signed out successfully.", kr: "로그아웃되었습니다." }, rememberMe: { vi: "Ghi nhớ đăng nhập trên thiết bị này", en: "Remember me on this device", kr: "이 기기에서 로그인 유지" }, rememberMeNote: { vi: "Không nên bật trên máy dùng chung.", en: "Do not enable on shared devices.", kr: "공용 기기에서는 사용하지 마세요." }, loginHeading: { vi: "Đăng nhập", en: "Sign in", kr: "로그인" },
    forgotPassword: { vi: "Quên mật khẩu", en: "Forgot password", kr: "비밀번호를 잊으셨나요?" }, forgotEmailRequired: { vi: "Vui lòng nhập email trước.", en: "Please enter your email first.", kr: "먼저 이메일을 입력해 주세요." }, forgotNeutral: { vi: "Nếu tài khoản hợp lệ, vui lòng liên hệ HR để được hỗ trợ đặt lại mật khẩu: thanh.ntc@kisvn.vn", en: "If the account is valid, please contact HR for password reset support: thanh.ntc@kisvn.vn", kr: "유효한 계정인 경우 비밀번호 재설정을 위해 HR에 문의해 주세요: thanh.ntc@kisvn.vn" },
    demoEmployeeAccount: { vi: "Tài khoản nhân viên demo", en: "Demo Employee Account", kr: "직원 데모 계정" }, emailLabel: { vi: "Email", en: "Email", kr: "이메일" }, passwordLabel: { vi: "Mật khẩu", en: "Password", kr: "비밀번호" }, useAccount: { vi: "Dùng tài khoản này", en: "Use This Account", kr: "이 계정 사용" },
    greeting: { vi: "Xin chào, {name}", en: "Hello, {name}", kr: "{name}님, 안녕하세요" }, learningJourney: { vi: "Tiếp tục hành trình học tập của bạn hôm nay.", en: "Continue your learning journey today.", kr: "오늘도 학습 여정을 이어가세요." }, employeeFallback: { vi: "Nhân viên", en: "Employee", kr: "직원" },
    totalTrainingHours: { vi: "Tổng giờ đào tạo", en: "Total training time", kr: "총 교육 시간" }, exploreCourses: { vi: "Khám phá khóa học", en: "Explore courses", kr: "교육 과정 보기" }, goToLearning: { vi: "Vào trang học tập", en: "Go to Learning", kr: "학습 공간으로" }, calendar: { vi: "Lịch học", en: "Calendar", kr: "학습 일정" }, qrAttendance: { vi: "Điểm danh QR", en: "QR attendance", kr: "QR 출석" },
    checkIn: { vi: "Check-in", en: "Check-in", kr: "체크인" }, checkOut: { vi: "Check-out", en: "Check-out", kr: "체크아웃" }, morning: { vi: "Buổi sáng", en: "Morning", kr: "오전" }, afternoon: { vi: "Buổi chiều", en: "Afternoon", kr: "오후" },
    manualAttendance: { vi: "Điểm danh thủ công", en: "Manual attendance", kr: "수동 출석" }, qrExpired: { vi: "QR đã hết hạn", en: "QR has expired", kr: "QR이 만료되었습니다" }, qrNotOpen: { vi: "QR chưa mở", en: "QR is not open yet", kr: "QR이 아직 열리지 않았습니다" },
    attendanceSuccess: { vi: "Điểm danh thành công", en: "Attendance recorded", kr: "출석이 기록되었습니다" }, alreadyScanned: { vi: "Bạn đã điểm danh rồi", en: "You already scanned this code", kr: "이미 출석 처리되었습니다" }, notInvited: { vi: "Bạn không thuộc danh sách tham dự", en: "You are not on the attendee list", kr: "참석 대상이 아닙니다" },
    projector: { vi: "Trình chiếu QR", en: "Project QR", kr: "QR 표시" }, closeAttendance: { vi: "Đóng điểm danh", en: "Close attendance", kr: "출석 종료" }, privacy: { vi: "Chính sách bảo mật", en: "Privacy notice", kr: "개인정보 안내" },
  };
  return labels[key]?.[language] || labels[key]?.vi || key;
}

let _calendarLoadedAt = 0; // timestamp of last successful load

async function fetchCalendarEvents(accountId) {
  if (_calendarLoading) return;
  _calendarLoading = true;
  _calendarError = null;
  _calendarAccountId = accountId;
  render(); // show spinner
  try {
    const result = await calendarService.getEventsForAccountAsync(accountId, { includeCancelled: true });
    _calendarEvents = result.events;
    _calendarSource = result.source;
    _calendarLoadedAt = Date.now();
  } catch (err) {
    _calendarError = String(err);
    _calendarEvents = [];
    _calendarSource = "local";
  } finally {
    _calendarLoading = false;
  }
  render(); // show data
}

async function fetchCoursesFromApi(accountId, role) {
  if (_coursesLoading) return;
  _coursesLoading = true;
  _coursesError = null;
  _coursesAccountId = accountId;
  // Only trigger a loading render on initial load (no data yet) — on refetch, keep existing data visible
  const isInitialLoad = _courses === null;
  if (isInitialLoad && !document.querySelector("[data-course-search], .course-library, .course-detail")) {
    queueMicrotask(() => { if (_coursesLoading) render(); });
  }
  try {
    const data = await courseApiService.listCourses(accountId, role);
    if (Array.isArray(data)) {
      _courses = data;
      // Supabase is the source of truth — write back to localStorage, but do NOT re-add deleted courses
      const { localStorageAdapter } = await import("./lib/storage/localStorageAdapter.js");
      const local = localStorageAdapter.read("mykis.courses.v1", []);
      const supabaseIds = new Set(data.map((c) => c.id));
      // Keep local-only items only if Supabase returned results (otherwise Supabase may be empty/errored)
      const localOnly = data.length > 0 ? local.filter((c) => !supabaseIds.has(c.id)) : [];
      localStorageAdapter.write("mykis.courses.v1", [...data, ...localOnly]);
    }
  } catch (err) {
    _coursesError = String(err);
    console.warn("[course-fetch] API error, using localStorage:", err?.message);
    if (_courses === null) _courses = [];
  } finally {
    _coursesLoading = false;
  }
  render();
}

async function fetchEnrollmentsFromApi(accountId, role) {
  if (_enrollmentsLoading) return;
  _enrollmentsLoading = true;
  _enrollmentsAccountId = accountId;
  try {
    const data = await courseApiService.listEnrollments(accountId, role);
    if (Array.isArray(data)) {
      _enrollments = data;
      // Only merge when Supabase has data — never wipe existing local enrollments
      if (data.length > 0) {
        const { localStorageAdapter } = await import("./lib/storage/localStorageAdapter.js");
        const local = localStorageAdapter.read("mykis.enrollments.v1", []);
        const supabaseIds = new Set(data.map((e) => e.id));
        const localOnly = local.filter((e) => !supabaseIds.has(e.id));
        localStorageAdapter.write("mykis.enrollments.v1", [...data, ...localOnly]);
      }
    }
  } catch (err) {
    console.warn("[enrollment-fetch] API error, using localStorage:", err?.message);
    if (_enrollments === null) _enrollments = [];
  } finally {
    _enrollmentsLoading = false;
  }
  render();
}

async function fetchEmployeeTrainingTime(accountId) {
  if (!accountId || _offlineTrainingLoadedFor === accountId) return;
  _offlineTrainingLoadedFor = accountId;
  try {
    await hydrateOfflineTrainingData(accountId);
  } catch {
    // analytics must never block rendering
  }
  render();
}

async function refreshNotificationsCache() {
  if (!session?.accountId) return;
  try {
    const items = await notificationService.list(session.accountId);
    if (!Array.isArray(items) || !items.length) return;
    const NOTIF_KEY = "mykis.notifications.v1";
    const existing = JSON.parse(localStorage.getItem(NOTIF_KEY) || "[]");
    const byId = new Map(existing.map((x) => [x.id, x]));
    for (const n of items) {
      const mapped = { id: n.id, type: n.type, title: n.title, body: n.body, targetAccountId: n.accountId || n.account_id || "", actionUrl: n.link || "", actionLabel: n.actionLabel || "", priority: n.priority || "normal", isRead: n.isRead || n.is_read || false, readAt: n.readAt || "", createdAt: n.createdAt || n.created_at || "" };
      byId.set(n.id, { ...(byId.get(n.id) || {}), ...mapped });
    }
    localStorage.setItem(NOTIF_KEY, JSON.stringify([...byId.values()]));
    render();
  } catch { /* ignore — stale cache is fine */ }
}

async function loadNotificationMonitor(force=false) {
  if (!hasAdminAccess() || notificationMonitorLoading) return;
  if (notificationMonitor && !force) return;
  notificationMonitorLoading = true;
  try { notificationMonitor = await notificationService.monitor(); }
  finally { notificationMonitorLoading = false; if (route === "/admin/notifications") render(); }
}

async function fetchParticipantsFromApi(sessionId, accountId) {
  if (_participantsLoadingFor === sessionId) return;
  _participantsLoadingFor = sessionId;
  render(); // show loading state
  try {
    const data = await trainingApiService.listParticipants(sessionId, accountId);
    const rows = Array.isArray(data) ? data : (data?.participants || []);
    const accountIds = rows.map(r => String(r.account_id || r.accountId || r.data?.accountId || "")).filter(Boolean);
    _remoteParticipantIds.set(sessionId, new Set(accountIds));
    // Sync back to localStorage so ensureInvitations works
    const { localStorageAdapter } = await import("./lib/storage/localStorageAdapter.js");
    const PARTICIPANTS = "mykis.sessionParticipants.v1";
    const existing = localStorageAdapter.read(PARTICIPANTS, []);
    const notThisSession = existing.filter(r => r.sessionId !== sessionId);
    const now = new Date().toISOString();
    const fresh = accountIds.map(aid => ({
      id: existing.find(r => r.sessionId === sessionId && r.accountId === aid)?.id || crypto.randomUUID(),
      sessionId, accountId: aid, role: "learner", status: "assigned", source: "supabase",
      createdAt: now, addedAt: now, addedBy: accountId,
    }));
    localStorageAdapter.write(PARTICIPANTS, [...notThisSession, ...fresh]);
  } catch (e) {
    console.warn("[participants-fetch] error:", e?.message);
    // Keep cache as-is; don't clear existing local data
  } finally {
    _participantsLoadingFor = "";
  }
  render();
}

async function fetchSessionsFromApi(accountId, role) {
  if (_sessionsLoading) return;
  _sessionsLoading = true;
  _sessionsError = "";
  _sessionsAccountId = accountId;
  try {
    const data = await trainingApiService.listSessions(accountId, role);
    const rows = Array.isArray(data) ? data : [];
    const { localStorageAdapter } = await import("./lib/storage/localStorageAdapter.js");
    const SESSIONS = "mykis.offlineSessions.v1";
    if (rows.length > 0) {
      const local = localStorageAdapter.read(SESSIONS, []);
      const remoteIds = new Set(rows.map(r => r.id));
      const localOnly = local.filter(r => !remoteIds.has(r.id) && r.status !== "cancelled");
      const merged = [...rows, ...localOnly];
      localStorageAdapter.write(SESSIONS, merged);
      _sessions = merged;
    } else {
      const local = localStorageAdapter.read(SESSIONS, []);
      const nonCancelled = local.filter(r => r.status !== "cancelled");
      _sessions = nonCancelled.length > 0 ? nonCancelled : [];
      localStorageAdapter.write(SESSIONS, _sessions);
    }
  } catch (e) {
    console.warn("[sessions-fetch] error:", e?.message);
    _sessionsError = e?.message || "Lỗi kết nối máy chủ";
    if (_sessions === null) _sessions = [];
  } finally {
    _sessionsLoading = false;
  }
  render();
}

async function runBackfill() {
  if (_backfillRunning || !session) return;
  _backfillRunning = true; _backfillReport = null; render();
  try {
    const { localStorageAdapter } = await import("./lib/storage/localStorageAdapter.js");
    const profiles = JSON.parse(localStorage.getItem("mykis.accounts.v1") || "[]");
    const courses = localStorageAdapter.read("mykis.courses.v1", []);
    const sessions = localStorageAdapter.read("mykis.offlineSessions.v1", []);
    const participants = localStorageAdapter.read("mykis.sessionParticipants.v1", []);
    const enrollments = localStorageAdapter.read("mykis.enrollments.v1", []);
    const res = await fetch("/api/admin/backfill", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Account-Id": session.accountId, "X-Account-Role": "hr" },
      body: JSON.stringify({ profiles, courses, sessions, participants, enrollments }),
    });
    const body = await res.json().catch(() => ({}));
    _backfillReport = body.report || body;
    if (!res.ok) throw new Error(body.error || "Backfill failed");
    // Invalidate caches so they reload from Supabase
    _sessions = null; _sessionsAccountId = "";
    _remoteParticipantIds = new Map();
    toast("Đồng bộ hoàn tất ✓");
  } catch (e) {
    _backfillReport = { error: e.message };
    toast("error");
  }
  _backfillRunning = false; render();
}


function navigate(path) {
  mobileNavOpen = false;
  userMenuOpen = false;
  document.body.classList.remove("nav-open");
  stopQrCameraScanner();
  if (!path.startsWith("/attendance/scan")) {
    _qrScanLocationData = null;
    _qrScanLocationStatus = "pending";
    _qrCameraConsentGiven = false;
  }
  if (!bypassNavigationGuard && shouldWarnBeforeLeaving(path)) {
    pendingNavigation = path;
    openDialog({ type: "unsaved", important: true });
    return;
  }
  bypassNavigationGuard = false;
  history.pushState({}, "", path);
  route = location.pathname;
  session = sessionService.getValidSession();
  render();
  document.querySelector(".app-main .content")?.classList.add("route-enter");
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

function currentActivityPayload(activityTypeOverride = "") {
  const path = currentPathWithQuery();
  const stage = document.querySelector(".lesson-stage");
  const quizActive = Boolean(activeQuizAttempt);
  let activityType = activityTypeOverride || "dashboard";
  let courseId = "";
  let title = document.title || "";
  if (quizActive) {
    activityType = "quiz_attempt";
    courseId = activeQuizAttempt.courseId || activeQuizAttempt.quiz?.courseId || "";
    title = activeQuizAttempt.quiz?.title || title;
  } else if (stage) {
    const item = getCourseContent(stage.dataset.courseId).find((x) => x.id === stage.dataset.contentId);
    activityType = item ? "content_view" : "course_view";
    courseId = stage.dataset.courseId || "";
    title = item?.title || getCourseById(courseId)?.title || title;
  } else if (route.startsWith("/dashboard/courses/")) {
    activityType = "course_view";
    courseId = decodeURIComponent(route.split("/").pop() || "");
    title = getCourseById(courseId)?.title || title;
  } else if (route === "/dashboard" || route.startsWith("/admin")) {
    activityType = "dashboard";
  } else if (route === "/dashboard/calendar") {
    activityType = "training_view";
  }
  return {
    sessionId: session?.sessionId,
    activityType,
    pagePath: path,
    courseId,
    title,
    hidden: document.hidden,
  };
}

async function sendActivityHeartbeat(activityTypeOverride = "") {
  if (!session?.sessionId || !session?.accountId || document.hidden) return;
  const payload = currentActivityPayload(activityTypeOverride);
  const key = `${payload.activityType}|${payload.pagePath}|${payload.courseId}|${payload.title}`;
  _activityLastKey = key;
  await fetch("/api/activity/heartbeat", {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function ensureActivityHeartbeat() {
  clearInterval(_activityHeartbeatId);
  _activityHeartbeatId = 0;
  if (!session?.accountId) return;
  sendActivityHeartbeat();
  _activityHeartbeatId = setInterval(() => {
    if (!document.hidden) sendActivityHeartbeat();
  }, 55_000);
}

function ensureHrOverviewPolling() {
  clearInterval(_hrOverviewPollId);
  _hrOverviewPollId = 0;
  if (route !== "/admin" || session?.role !== "hr") return;
  if (!_hrOverview || Date.now() - _hrOverviewLoadedAt > 30_000) fetchHrOverview({ silent: Boolean(_hrOverview) });
  _hrOverviewPollId = setInterval(() => fetchHrOverview({ silent: true }), 35_000);
  // Load employee list from API if not loaded yet
  if (!_apiEmployeesLoaded && !_apiEmployeesLoading) loadApiEmployees();
}

function hasUnsavedLearningState() {
  const video = document.getElementById("course-video");
  const videoActive = Boolean(video && !video.paused && !video.ended);
  const quizDirty = Boolean(activeQuizAttempt && Object.keys(quizAnswers || {}).length);
  return videoActive || _ytWatchStart !== null || quizDirty;
}

function shouldWarnBeforeLeaving(path) {
  if (!hasUnsavedLearningState()) return false;
  const nextPath = String(path || "").split("?")[0];
  return nextPath !== route;
}

function openDialog(state) {
  const active = document.activeElement;
  lastDialogFocusSelector = active?.id ? `#${active.id}` : active?.dataset?.focusKey ? `[data-focus-key="${active.dataset.focusKey}"]` : "";
  dialogState = state;
  render();
  requestAnimationFrame(() => document.querySelector("[data-dialog-primary], [data-dialog-close]")?.focus());
}

function closeDialog() {
  const focusSelector = lastDialogFocusSelector;
  dialogState = null;
  pendingNavigation = "";
  lastDialogFocusSelector = "";
  render();
  if (focusSelector) requestAnimationFrame(() => document.querySelector(focusSelector)?.focus?.({ preventScroll: true }));
}

function sharedDialog() {
  if (!dialogState) return "";
  const ICON_SYMBOLS = { "?": "💬", "!": "⚠", "i": "ℹ", "✓": "✓", "×": "✕", phone: "▣" };
  const ICON_CLASSES = {
    support: "info", invalidCredentials: "warning", locked: "warning",
    inactive: "warning", pending: "info", system: "error",
    unsaved: "warning", alert: "info", confirm: "warning", gradeInput: "info", phoneQr: "info",
  };
  const configs = {
    support: { title: "Hỗ trợ đặt lại mật khẩu", body: `Vui lòng liên hệ ${HR_SUPPORT_NAME} để được hỗ trợ đặt lại mật khẩu.`, icon: "?" },
    invalidCredentials: { title: "Đăng nhập không thành công", body: "Email hoặc mật khẩu chưa chính xác. Vui lòng kiểm tra và thử lại.", icon: "!" },
    locked: { title: "Tài khoản đã bị khóa", body: "Tài khoản của bạn hiện không thể đăng nhập. Vui lòng liên hệ Phòng Nhân sự để được hỗ trợ.", icon: "!" },
    inactive: { title: "Không thể đăng nhập", body: "Tài khoản này hiện không còn quyền truy cập hệ thống. Vui lòng liên hệ Phòng Nhân sự để được hỗ trợ.", icon: "!" },
    pending: { title: "Tài khoản chưa được kích hoạt", body: "Vui lòng liên hệ Phòng Nhân sự để được hỗ trợ kích hoạt tài khoản.", icon: "i" },
    system: { title: "Không thể kết nối", body: "Hệ thống đang tạm thời gián đoạn. Vui lòng thử lại sau.", icon: "!" },
    unsaved: { title: activeQuizAttempt ? "Rời khỏi bài kiểm tra?" : "Rời khỏi bài học?", body: activeQuizAttempt ? "Các câu trả lời chưa gửi có thể không được ghi nhận." : "Tiến độ hoặc nội dung chưa lưu có thể bị mất.", icon: "!" },
    alert: { title: dialogState.title || "Thông báo", body: dialogState.body || "", icon: "i" },
    confirm: { title: dialogState.title || "Xác nhận thao tác", body: dialogState.body || "", icon: "!" },
    gradeInput: { title: dialogState.title || "Chấm điểm câu hỏi tự luận", body: dialogState.body || "", icon: "i" },
    phoneQr: { title: "Điểm danh bằng điện thoại", body: "Để đảm bảo xác thực vị trí và sử dụng camera, vui lòng mở MyKIS Learning trên điện thoại và thực hiện quét mã QR tại đó.", icon: "phone" },
  };
  const config = configs[dialogState.type] || configs.alert;
  const iconClass = ICON_CLASSES[dialogState.type] || "info";
  const isUnsaved = dialogState.type === "unsaved";
  const isConfirm = dialogState.type === "confirm";
  const isGradeInput = dialogState.type === "gradeInput";
  const isSupport = dialogState.type === "support";
  const isPhoneQr = dialogState.type === "phoneQr";

  const inputHtml = isGradeInput ? `
    ${dialogState.answer ? `<p class="shared-dialog__answer-label">Câu trả lời của nhân viên</p><div class="shared-dialog__answer-box">${escapeHtml(dialogState.answer)}</div>` : ""}
    <div class="shared-dialog__input-wrap">
      <label for="sdGradeInput">Điểm (0 – ${dialogState.maxPoints ?? "?"})</label>
      <input type="number" id="sdGradeInput" min="0" max="${dialogState.maxPoints ?? 9999}" step="0.5" placeholder="Nhập điểm..." autocomplete="off">
      <span class="input-error" id="sdGradeError" aria-live="polite"></span>
    </div>` : "";

  const actionsHtml = isPhoneQr
    ? `<button class="btn btn-outline" data-dialog-close>Đóng</button><button class="btn btn-primary" data-qr-confirm-mobile>Tôi đang dùng điện thoại</button>`
    : isUnsaved
    ? `<button class="btn btn-outline" data-dialog-close>Tiếp tục học</button><button class="btn btn-primary" data-dialog-leave>Rời khỏi</button>`
    : isConfirm
    ? `<button class="btn btn-outline" data-dialog-close>Hủy</button><button class="btn btn-primary" data-dialog-confirm>Xác nhận</button>`
    : isGradeInput
    ? `<button class="btn btn-outline" data-dialog-close>Hủy</button><button class="btn btn-primary" data-dialog-grade-submit>Lưu điểm</button>`
    : isSupport
    ? `<a class="btn btn-outline" href="mailto:${escapeHtmlAttribute(HR_SUPPORT_EMAIL)}">Gửi email</a><button class="btn btn-primary" data-dialog-close data-dialog-primary>Đóng</button>`
    : (dialogState?.actions?.length ? dialogState.actions.map((a, i) => `<button class="btn ${a.primary ? "btn-primary" : "btn-outline"}" data-dialog-action="${i}">${escapeHtml(a.label)}</button>`).join("") : `<button class="btn btn-primary" data-dialog-close data-dialog-primary>Đóng</button>`);

  return `<div class="modal-backdrop open shared-dialog-backdrop" data-shared-dialog-backdrop>
  <section class="shared-dialog" role="dialog" aria-modal="true" aria-labelledby="shared-dialog-title" aria-describedby="shared-dialog-description" data-shared-dialog>
    <div class="shared-dialog__header">
      <div class="shared-dialog__icon shared-dialog__icon--${iconClass}${isPhoneQr ? " shared-dialog__icon--phone-qr" : ""}" aria-hidden="true">${isPhoneQr ? `<svg viewBox="0 0 24 24"><rect x="5" y="2" width="10" height="20" rx="2"/><path d="M9 18h2"/></svg><svg viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z"/></svg>` : ICON_SYMBOLS[config.icon] || config.icon}</div>
      <div class="shared-dialog__content">
        <h2 id="shared-dialog-title">${escapeHtml(config.title)}</h2>
        <p id="shared-dialog-description">${escapeHtml(config.body)}</p>
        ${isSupport ? `<a class="support-mail" href="mailto:${escapeHtmlAttribute(HR_SUPPORT_EMAIL)}">${escapeHtml(HR_SUPPORT_EMAIL)}</a>` : ""}
        ${inputHtml}
      </div>
    </div>
    <div class="shared-dialog__actions">${actionsHtml}</div>
  </section></div>`;
}

function currentPathWithQuery() {
  return `${location.pathname}${location.search}${location.hash || ""}`;
}

function navigateWithAuth(targetRoute, requiredRole = "employee") {
  const activeSession = sessionService.getValidSession();
  if (!activeSession) {
    sessionService.setPostLoginRedirect(targetRoute);
    navigate(requiredRole === "hr" ? "/login?role=hr" : "/login");
    return false;
  }
  if (requiredRole === "hr" && activeSession.role !== "hr") {
    navigate("/dashboard");
    return false;
  }
  if (requiredRole === "employee" && activeSession.role !== "employee") {
    navigate("/admin");
    return false;
  }
  navigate(targetRoute);
  return true;
}

function protectedRoute(path, role = "employee") {
  return `href="${role === "hr" ? "/login?role=hr" : "/login"}" data-auth-target="${escapeHtmlAttribute(path)}" data-auth-role="${role}"`;
}

function availableEmployeeAccounts() {
  return getAccounts()
    .filter((account) => account.role === "employee" && account.accountStatus === "active")
    .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || ""), "vi", { sensitivity: "base" }));
}

function sessionParticipantAccounts(sessionId) {
  const remoteIds = _remoteParticipantIds.get(sessionId);
  // Never fall back to localStorage — only show confirmed remote participants
  const ids = remoteIds ? [...remoteIds] : [];
  return ids.map(id => getAccountById(id)).filter(Boolean);
}

function sessionParticipantSummaryLabel(sessionId) {
  const summary = offlineTrainingService.participantSummary(sessionId);
  const remoteIds = _remoteParticipantIds.get(sessionId);
  if (remoteIds) summary.selected = remoteIds.size;
  return summary.overBy
    ? `Đã chọn ${summary.selected} / ${summary.capacity} · Vượt sức chứa ${summary.overBy}`
    : `${summary.selected} người đã chọn · Còn ${summary.remaining} chỗ`;
}

function formatLocalDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(+date)) return "—";
  return date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function resetImportWizard() {
  importWizardOpen = false;
  importWizardTarget = "";
  importWorkbookState = null;
  importSheetName = "";
  importHeaderRowIndex = 0;
  importColumnMapping = {};
  importPreviewRows = [];
}

function openImportWizard(mode, target = "") {
  importWizardMode = mode;
  importWizardTarget = target;
  importWizardOpen = true;
  importWorkbookState = null;
  importSheetName = "";
  importHeaderRowIndex = 0;
  importColumnMapping = {};
  importPreviewRows = [];
}

function importFieldList(mode) {
  const fields = {
    employees: [
      ["employeeCode", "Mã nhân viên"],
      ["fullName", "Họ và tên"],
      ["email", "Email"],
      ["department", "Phòng ban"],
      ["position", "Chức danh"],
      ["joinDate", "Ngày vào làm"],
      ["location", "Địa điểm"],
      ["defaultLanguage", "Ngôn ngữ"],
      ["accountStatus", "Trạng thái"],
    ],
    participants: [
      ["employeeCode", "Mã nhân viên"],
      ["email", "Email"],
      ["fullName", "Họ và tên"],
      ["department", "Phòng ban"],
      ["responseStatus", "Trạng thái đăng ký"],
    ],
    attendance: [
      ["employeeCode", "Mã nhân viên"],
      ["email", "Email"],
      ["slot", "Buổi sáng/chiều"],
      ["checkIn", "Check-in"],
      ["checkOut", "Check-out"],
      ["attendanceStatus", "Trạng thái"],
      ["note", "Ghi chú"],
    ],
  };
  return fields[mode] || [];
}

function normalizeAttendanceSlotLabel(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (["morning", "am", "buổi sáng", "sáng"].includes(text)) return "Buổi sáng";
  if (["afternoon", "pm", "buổi chiều", "chiều"].includes(text)) return "Buổi chiều";
  return text;
}

function scrollToId(id) {
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  else {
    navigate("/");
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

function goAnnouncements() {
  if (location.pathname.replace(/\/$/, "") === "" || location.pathname.replace(/\/$/, "") === "/") {
    scrollToId("hr-announcements");
  } else {
    navigate("/#hr-announcements");
    requestAnimationFrame(() => document.getElementById("hr-announcements")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

function icon(name) {
  const icons = {
    building: '<svg viewBox="0 0 24 24"><path d="M4 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><path d="M8 7h2M8 11h2M8 15h2M14 7h.01M14 11h.01M14 15h.01M3 21h18"/></svg>',
    file: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-7"/></svg>',
    award: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 22l5-3 5 3-1.5-9.5"/></svg>',
    message: '<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="m15 9 5-5"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/></svg>',
  };
  return `<span class="icon">${icons[name] || icons.file}</span>`;
}

function brand() {
  return `<a class="brand" href="/" data-link><img class="brand-logo" src="/assets/kis-logo-horizontal.png" alt="KIS"><span>${t("brand")}</span></a>`;
}

function languageSwitcher() {
  return `<div class="language-switch" data-active-lang="${language}"><span class="lang-ink" aria-hidden="true"></span>${["vi", "en", "kr"].map((lang) => `<button type="button" class="${language === lang ? "active" : ""}" data-language="${lang}" data-public-lang="${lang}" aria-pressed="${language === lang ? "true" : "false"}">${dictionaries[lang].lang}</button>`).join("")}</div>`;
}

function header() {
  const activeSession = sessionService.getValidSession();
  const activeAccount = activeSession?.accountId ? getAccountById(activeSession.accountId) : null;
  const activeEmployee = activeAccount?.role === "employee" ? getEmployeeByAccountId(activeAccount.id) : null;
  const destinationLabel = activeAccount?.role === "hr" ? "Vào trang quản trị" : "Vào trang học tập";
  const destinationRoute = activeAccount?.role === "hr" ? "/admin" : "/dashboard";
  const displayName = activeAccount?.fullName || activeAccount?.name || activeAccount?.email || "";
  return `
    <header class="header">
      <div class="container header-inner">
        ${brand()}
        <nav class="nav">
          <a href="/" data-link ${route === "/" ? 'aria-current="page" class="is-active"' : ""}>${t("nav.home")}</a>
          <a href="/about-kis" data-link ${route === "/about-kis" ? 'aria-current="page" class="is-active"' : ""}>${t("nav.about")}</a>
          <button class="nav-button" data-scroll="featured-courses">${t("nav.courses")}</button>
        </nav>
        <div class="header-actions">
          ${languageSwitcher()}
          ${activeSession
            ? `<a class="btn btn-primary header-mobile-cta" href="${destinationRoute}" data-link style="font-size:13px;padding:0 14px;min-height:38px">${destinationLabel}</a>`
            : `<a class="btn btn-primary header-mobile-cta" href="/login" data-link style="font-size:13px;padding:0 14px;min-height:38px">Đăng nhập</a>`}
          ${activeSession
            ? `<div class="topbar-user topbar-user-shell public-user-menu header-desktop-user"><button type="button" class="topbar-user-trigger public-user-menu__trigger" data-user-menu-trigger aria-haspopup="menu" aria-expanded="${userMenuOpen ? "true" : "false"}" aria-controls="publicUserMenu"><span class="topbar-user__name">${escapeHtml(displayName)}</span><svg class="topbar-user__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button><div class="topbar-user__menu public-user-menu__menu ${userMenuOpen ? "is-open" : ""}" id="publicUserMenu" data-user-menu role="menu"><strong>${escapeHtml(displayName)}</strong>${activeEmployee?.position || activeAccount?.position ? `<span>${escapeHtml(activeEmployee?.position || activeAccount?.position || "")}</span>` : ""}${activeEmployee?.department || activeAccount?.department ? `<span>${escapeHtml(activeEmployee?.department || activeAccount?.department || "")}</span>` : ""}<a class="btn btn-primary" href="${destinationRoute}" data-link role="menuitem">${destinationLabel}</a><button class="btn btn-outline" data-logout role="menuitem">${uiText("logout")}</button></div></div>`
            : `<a class="btn btn-primary btn--hero header-desktop-login" href="/login" data-link>${t("nav.login")}</a>`}
        </div>
      </div>
    </header>
  `;
}

function footer() {
  const loginLabel = language === "kr" ? "로그인" : language === "en" ? "Sign in" : "Đăng nhập";
  return `
    <footer class="footer-v2">
      <div class="container footer-v2__grid">
        <div class="footer-v2__brand">
          <span class="footer-v2__brand-name">${t("brand")}</span>
          <p class="footer-v2__brand-desc">${t("landing.footer")}</p>
          <span class="footer-v2__brand-badge">${uiText("employeeOnly")}</span>
        </div>
        <nav class="footer-v2__col footer-v2__nav-col">
          <span class="footer-v2__col-heading">${uiText("quickLinks")}</span>
          <div class="footer-v2__links">
            <a href="/" data-link>${t("nav.home")}</a>
            <a href="/about-kis" data-link>${t("nav.about")}</a>
            <a href="/#featured-courses" data-link>${t("nav.courses")}</a>
            <a href="/login" data-link>${loginLabel}</a>
          </div>
        </nav>
        <div class="public-footer-contact-col">
          <span class="footer-v2__col-heading">${uiText("contactSupport")}</span>
          <div class="public-footer-contact-text">
            <span class="public-footer-contact-name">${hrContact}</span>
            <span class="public-footer-contact-role">${t("about.footerContactRole")}</span>
            <a class="public-footer-contact-email" href="mailto:thanh.ntc@kisvn.vn">thanh.ntc@kisvn.vn</a>
          </div>
        </div>
      </div>
      <div class="container footer-v2__bottom">
        <span>© 2026 KIS Vietnam Securities. All rights reserved.</span>
        <span>${uiText("internalOnly")}</span>
        ${languageSwitcher()}
      </div>
    </footer>
  `;
}

function activeSessionForLandingModal() {
  if (location.pathname !== "/" || hasEmployeeAccess() || hasAdminAccess() || !selectedNotificationId) return "";
  const announcement = hrAnnouncements[Number(selectedNotificationId)];
  if (!announcement) return "";
  return `<div class="modal-backdrop open" data-close-landing-detail><section class="modal modal--medium modal--structured"><header class="modal__header"><div><h2>${escapeHtml(announcement[1])}</h2></div><button class="icon-btn" data-close-landing-detail aria-label="Đóng">×</button></header><div class="modal__body"><p>${escapeHtml(announcement[2])}</p></div><footer class="modal__footer"><button class="btn btn-outline" data-close-landing-detail>Đóng</button><button class="btn btn-primary" data-auth-target="/dashboard" data-auth-role="employee">Đăng nhập để xem đầy đủ</button></footer></section></div>`;
}

function badge(key) {
  const cls = { active: "done", completed: "done", inProgress: "learning", notStarted: "new", pendingActivation: "pending", temporarilyLocked: "late", overdue: "late", disabled: "new", pending: "pending", follow: "late" }[key] || "new";
  return `<span class="badge ${cls}">${t(`status.${key}`)}</span>`;
}

function progress(value) {
  return `<div class="progress"><span style="--value:${value}%"></span></div>`;
}

function learningHoursNow() {
  const BASE = 3204;
  const BASE_DATE = "2026-07-02";
  const PER_DAY = 8;
  // Compute elapsed full days in Asia/Ho_Chi_Minh timezone
  const nowVN = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const baseVN = new Date(new Date(BASE_DATE + "T00:00:00+07:00").toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const elapsedMs = nowVN - baseVN;
  const elapsedDays = Math.max(0, Math.floor(elapsedMs / 86400000));
  return Math.max(BASE, BASE + elapsedDays * PER_DAY);
}

function formatLearningHours(hours) {
  try {
    const loc = language === "vi" ? "vi-VN" : language === "kr" ? "ko-KR" : "en-US";
    return new Intl.NumberFormat(loc).format(hours);
  } catch {
    return String(hours);
  }
}

function landingPage() {
  const featuredTitles = new Set(["Đào tạo hội nhập nhân viên mới", "AI for Beginners"]);
  const publishedCourses = getCourses().filter((course) => course.status === "published" && featuredTitles.has(course.title));
  const featuredFallback = [
    { id:"featured-onboarding", title:"Đào tạo hội nhập nhân viên mới", description:"Nội dung hội nhập, văn hóa, quy trình và chính sách dành cho nhân viên mới.", category:"Onboarding", durationHours:8, status:"published", imageUrl:"/images/communication-training-course.png" },
    { id:"featured-ai", title:"AI for Beginners", description:"Kiến thức nền tảng và cách ứng dụng AI an toàn, hiệu quả trong công việc.", category:"Công nghệ", durationHours:4, status:"published", imageUrl:"/images/leadership-training-course.png" },
  ].filter((fallback) => !publishedCourses.some((course) => course.title === fallback.title));
  const featuredCourses = [...publishedCourses, ...featuredFallback].slice(0, 2);

  const ctaAttr = session
    ? `data-auth-target="${session.role === "hr" ? "/admin" : "/dashboard"}" data-auth-role="${session.role}"`
    : `href="/login" data-link`;
  const ctaTag = session ? "button" : "a";

  // Live LMS stats
  const allCourses = getCourses().filter(c => c.status === "published");
  const allEmployees = getEmployees();
  const totalLearningHours = learningHoursNow();

  const statsHtml = `
    <div class="home-stats" data-countup-section>
      <div class="container home-stats__inner">
        <div class="home-stat-item">
          <span class="home-stat-item__value gradient-text" data-countup="${allEmployees.length || 200}" data-countup-suffix="+">${allEmployees.length || "200"}+</span>
          <span class="home-stat-item__label">${overviewText("learnersCount")}</span>
        </div>
        <div class="home-stat-item">
          <span class="home-stat-item__value gradient-text" data-countup="${allCourses.length || 12}">${allCourses.length || "12"}</span>
          <span class="home-stat-item__label">${overviewText("openCoursesCount")}</span>
        </div>
        <div class="home-stat-item">
          <span class="home-stat-item__value gradient-text" data-countup="${totalLearningHours}" data-countup-locale="true">${formatLearningHours(totalLearningHours)}</span>
          <span class="home-stat-item__label">${overviewText("totalHoursCount")}</span>
        </div>
      </div>
    </div>
  `;

  const coursesHtml = featuredCourses.map(course => {
    const img = course.imageUrl
      ? `<div class="course-card-v2__thumb"><img src="${escapeHtmlAttribute(course.imageUrl)}" alt="${escapeHtmlAttribute(course.title)}" loading="lazy"></div>`
      : `<div class="course-card-v2__thumb"><div class="course-card-v2__thumb-icon">${icon("book")}</div></div>`;
    return `<article class="course-card-v2" data-auth-target="/dashboard/courses" data-auth-role="employee" tabindex="0" role="button" aria-label="${escapeHtmlAttribute(course.title)}">
      ${img}
      <div class="course-card-v2__body">
        <span class="course-card-v2__category">${escapeHtml(course.category || "")}</span>
        <h3 class="course-card-v2__title">${escapeHtml(course.title)}</h3>
        <p class="course-card-v2__desc">${escapeHtml(course.description || "")}</p>
        <div class="course-card-v2__footer">
          <span class="course-card-v2__meta">${Number(course.durationHours) || 0}h</span>
          <button class="course-card-v2__cta">${language === "kr" ? "보기" : language === "en" ? "View course" : "Xem khóa học"} →</button>
        </div>
      </div>
    </article>`;
  }).join("");

  return `
    <div class="page landing-page">
      ${header()}
      <section class="hero hero--kis">
        ${heroMockup()}
        <div class="container hero-overlay-content">
          <div class="hero-text">
            <span class="eyebrow">${t("landing.eyebrow")}</span>
            <h1 class="hero-title--kis">${t("landing.title")}</h1>
            <p class="hero-subtitle--kis">${t("landing.subtitle")}</p>
            <div class="hero-actions hero-actions--kis">
              <${ctaTag} class="btn btn-primary btn--hero" ${ctaAttr}>${t("landing.cta")}</${ctaTag}>
              <button class="btn btn-outline btn--hero-secondary" data-scroll="featured-courses">${language === "kr" ? "과정 둘러보기" : language === "en" ? "Explore courses" : "Khám phá khóa học"}</button>
            </div>
          </div>
        </div>
      </section>

      ${statsHtml}

      <section class="section--featured-v2" id="featured-courses">
        <div class="container">
          <div class="section-head" data-reveal>
            <div>
              <h2 class="section-title">${language === "kr" ? "주요 교육 과정" : language === "en" ? "Featured Courses" : "Khóa học nổi bật"}</h2>
              <p class="section-lead">${language === "kr" ? "KIS Vietnam 직원을 위해 엄선된 핵심 과정." : language === "en" ? "Carefully curated courses for KIS Vietnam employees." : "Các khóa học được chọn lọc dành riêng cho nhân viên KIS Việt Nam."}</p>
            </div>
          </div>
          <div class="course-grid-v2" data-stagger>${coursesHtml}</div>
          <div style="text-align:center;margin-top:36px">
            <a class="btn btn-primary" href="${session ? (hasAdminAccess()?"/admin/courses":"/dashboard/courses") : "/login"}" data-link>${language === "kr" ? "모든 과정 보기" : language === "en" ? "View all courses" : "Xem tất cả khóa học"}</a>
          </div>
        </div>
      </section>

      <section class="section--kis-banner">
        <div class="container">
          <a class="kis-about-banner-v2" href="/about-kis" data-link data-reveal="scale">
            <div class="kis-about-banner-v2__text">
              <span class="kis-about-banner-v2__eyebrow">${language === "kr" ? "회사 소개" : language === "en" ? "About KIS" : "Về KIS Việt Nam"}</span>
              <h2 class="kis-about-banner-v2__title">${language === "kr" ? "KIS Vietnam의 여정을 탐색하세요" : language === "en" ? "Discover the KIS Vietnam journey" : "Khám phá hành trình và giá trị của KIS Việt Nam"}</h2>
              <p class="kis-about-banner-v2__desc">${language === "kr" ? "15년 이상의 성장, 글로벌 네트워크, 전문 인재를 바탕으로 한 KIS Vietnam의 이야기." : language === "en" ? "15+ years of growth, global network and professional talent powering KIS Vietnam." : "Hơn 15 năm phát triển, mạng lưới toàn cầu và đội ngũ nhân lực chuyên nghiệp tạo nên KIS Việt Nam."}</p>
            </div>
            <div class="kis-about-banner-v2__arrow" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </a>
        </div>
      </section>

      <div class="home-final-cta" data-reveal="fade">
        <div class="container">
          <h2>${language === "kr" ? "MyKIS Learning과 함께 시작하세요" : language === "en" ? "Start your learning journey" : "Bắt đầu hành trình học tập"}</h2>
          <p>${language === "kr" ? "KIS Vietnam 직원 전용 학습 플랫폼에 접속하세요." : language === "en" ? "Access the internal learning platform built exclusively for KIS Vietnam employees." : "Truy cập nền tảng học tập nội bộ được xây dựng riêng cho nhân viên KIS Việt Nam."}</p>
          <${ctaTag} class="btn btn-primary" ${ctaAttr}>${t("landing.cta")}</${ctaTag}>
        </div>
      </div>

      ${footer()}
      ${activeSessionForLandingModal()}
      ${hasEmployeeAccess()?notificationModal():""}
    </div>
  `;
}

function overviewText(key) {
  const copy = {
    activeEmployees: { vi: "Nhân viên đang hoạt động", en: "Active employees", kr: "활성 직원" },
    publishedCourses: { vi: "Khóa học đang mở", en: "Open courses", kr: "공개 교육 과정" },
    completionRate: { vi: "Tỷ lệ hoàn thành", en: "Completion rate", kr: "완료율" },
    openCourses: { vi: "Khóa học đang mở", en: "Open courses", kr: "공개 교육 과정" },
    noOpenCourses: { vi: "Chưa có khóa học đang mở", en: "No open courses yet", kr: "현재 공개된 교육 과정이 없습니다" },
    learnersCount: { vi: "Số nhân viên học", en: "Employees learning", kr: "학습 직원 수" },
    openCoursesCount: { vi: "Số khóa đào tạo đang mở", en: "Open training courses", kr: "공개 교육 과정 수" },
    totalHoursCount: { vi: "Tổng số giờ học", en: "Total learning hours", kr: "총 학습 시간" },
  };
  return copy[key]?.[language] || copy[key]?.vi || key;
}

function realCourseCard(course) {
  const image = course.imageUrl ? `<img class="course-card-image" src="${escapeHtmlAttribute(course.imageUrl)}" alt="${escapeHtmlAttribute(course.title)}" loading="lazy">` : icon("book");
  return `<article class="card info-card course-category" data-auth-target="/dashboard/courses" data-auth-role="employee" tabindex="0" role="button" aria-label="${escapeHtmlAttribute(course.title)}">${image}<div class="course-card-body"><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.description || "")}</p><span class="card-meta">${Number(course.durationHours) || 0}h</span><span class="btn btn-outline mini-action">Xem khóa học</span></div></article>`;
}

function heroMockup() {
  return `
    <div class="hero-banner-wrap">
      <picture>
        <source media="(max-width:767px)" srcset="/public/images/mykis-learning-banner-mobile.png">
        <img class="hero-banner-img" src="/public/images/mykis-learning-banner-desktop.png" alt="MyKIS Learning" loading="eager">
      </picture>
    </div>
  `;
}

function courseCard(c) {
  const image = c[5];
  return `<article class="card info-card course-category ${c[1].includes("Chứng chỉ") ? "featured-course" : ""}">${image ? `<img class="course-card-image" src="${image}" alt="${c[1]}">` : icon(c[0])}<h3>${c[1]}</h3><p>${c[2]}</p><span class="card-meta">${c[3]} ${t("nav.courses").toLowerCase()}</span></article>`;
}

function upcomingCoursesSection() {
  return `<div class="upcoming-course-block"><div class="section-head"><div><h3>Khóa học sắp diễn ra</h3><p class="section-lead">Cập nhật các chương trình đào tạo dự kiến trong thời gian tới.</p></div></div><div class="grid-4">${upcomingCourses.map(([i, title, category, format, status]) => `<article class="card info-card upcoming-course-card">${icon(i)}<h3>${title}</h3><p>Dự kiến Quý III/2026 · ${category} · ${format} · ${status}</p><button class="btn btn-outline mini-course-btn">Xem thông tin</button></article>`).join("")}</div></div>`;
}

function hrAnnouncementsSection() {
  return `<section class="section alt" id="hr-announcements"><div class="container"><div class="section-head"><div><h2 class="section-title">Thông báo từ HR</h2><p class="section-lead">Cập nhật các thông tin quan trọng về đào tạo, hội nhập và phát triển nhân sự.</p></div></div><div class="grid-4">${hrAnnouncements.map(([category, title, desc],index) => `<article class="card info-card hr-announcement-card" data-open-landing-announcement="${index}" tabindex="0" role="button">${icon("file")}<h3>${title}</h3><p>${desc}</p><button class="btn btn-outline mini-course-btn">Xem chi tiết</button></article>`).join("")}</div></div></section>`;
}

function aboutPage() {
  const heroStats = [
    { value: "12/2010", label: language === "kr" ? "설립" : language === "en" ? "Founded" : "Thành lập" },
    { value: "4.550 tỷ", label: language === "kr" ? "자본금 (VND)" : language === "en" ? "Charter capital" : "Vốn điều lệ" },
    { value: "99.8%", label: language === "kr" ? "KIS Korea 지분" : language === "en" ? "KIS Korea stake" : "Sở hữu KIS Korea" },
    { value: "15+", label: language === "kr" ? "운영 기간 (년)" : language === "en" ? "Years in operation" : "Năm hoạt động", countup: true },
  ];
  return `
    <div class="page about-page">
      ${header()}
      <section class="about-hero-v2">
        <div class="about-hero-v2__inner">
          <div>
            <h1 class="about-hero-v2__title">${t("about.title")}</h1>
            <p class="about-hero-v2__subtitle">${t("about.subtitle")}</p>
          </div>
          <div class="about-hero-v2__stats" data-stagger>
            ${heroStats.map(s => `<div class="about-hero-stat">${s.countup ? `<span class="about-hero-stat__value" data-countup="15" data-countup-suffix="+">${escapeHtml(s.value)}</span>` : `<span class="about-hero-stat__value">${escapeHtml(s.value)}</span>`}<span class="about-hero-stat__label">${escapeHtml(s.label)}</span></div>`).join("")}
          </div>
        </div>
      </section>
      <main>
        ${kisOverviewSectionV2()}
        ${kisTimelineSection()}
        ${leadershipSectionV2()}
        ${coreValuesMissionSectionV2()}
        ${corporatePhilosophySectionV2()}
        ${globalNetworkSectionV2()}
        ${ceoMessageSectionV2()}
      </main>
      ${footer()}
    </div>
  `;
}

function kisOverviewSection() {
  const stats = [["12/2010", "Thành lập"], ["99.8%", "Sở hữu KIS Korea"], ["4.550 tỷ VND", "Vốn điều lệ"], ["15+ năm", "Hoạt động tại Việt Nam"]];
  return `<section class="section" id="kis-overview"><div class="container overview-split"><div><h2 class="section-title">Tổng quan KIS Việt Nam</h2><div class="overview-copy"><p>Công ty Cổ phần Chứng khoán KIS Vietnam (KIS Vietnam) được thành lập vào tháng 12 năm 2010 bởi Công ty Cổ phần Đầu tư & Chứng khoán Hàn Quốc (KIS Korea), cùng với sự đầu tư của Tập đoàn Dệt may Việt Nam và các cổ đông khác. KIS Korea nắm giữ 48,8% cổ phần tại KIS Vietnam tính đến tháng 11 năm 2010 và đã dần dần tăng cường sở hữu trong những năm qua, với tỷ lệ sở hữu chính thức hiện tại là <strong>99,8%</strong>.</p><p>Trong suốt <strong>15 năm</strong> hoạt động tại thị trường Việt Nam, KIS Vietnam đã liên tục tăng vốn để mở rộng các hoạt động kinh doanh của công ty, với tổng vốn điều lệ đạt <strong>4.550 tỷ VND</strong>, và con số này sẽ tiếp tục tăng trong tương lai.</p><p>KIS Vietnam nhận được sự hỗ trợ mạnh mẽ từ Tập đoàn KIS tại Hàn Quốc, tận dụng kinh nghiệm trong lĩnh vực tài chính và sự hợp tác của các chuyên gia nước ngoài cùng đội ngũ nhân viên xuất sắc có nhiều năm kinh nghiệm trong ngân hàng, kiểm toán và thị trường vốn trong nước.</p><p>KIS Vietnam tập trung phát triển kỹ thuật quản lý hoạt động và quản lý rủi ro để định vị công ty như một nhà lãnh đạo trong các lĩnh vực tài chính tại Việt Nam. Chúng tôi tin rằng nguồn nhân lực là yếu tố then chốt xây dựng danh tiếng và thành công của KIS Vietnam trên thị trường chứng khoán.</p></div></div><aside class="overview-stat-card card">${stats.map(([v,l]) => `<div><span>${l}</span><strong>${v}</strong></div>`).join("")}</aside></div></section>`;
}

function kisOverviewSectionV2() {
  const overviewParagraphs = language === "kr"
    ? [
        "한국투자증권 베트남(KIS Vietnam)은 2010년 12월 한국투자증권(KIS Korea)에 의해 설립되었으며, 베트남 섬유의류그룹 등과 함께 투자되었습니다. KIS Korea는 2010년 11월 기준 48.8%의 지분을 보유했으며, 이후 지속적으로 지분을 늘려 현재 <strong>99.8%</strong>의 공식 지분율을 기록하고 있습니다.",
        "베트남 시장에서 <strong>15년 이상</strong> 운영하는 동안, KIS Vietnam은 사업 영역을 확장하기 위해 지속적으로 자본을 증가시켜 왔으며, 총 자본금은 <strong>4,550억 VND</strong>에 달합니다.",
        "KIS Vietnam은 한국 KIS그룹의 강력한 지원을 받아 국제 금융 분야의 경험과 외국 전문가들의 협력, 은행·감사·자본시장 분야에서 다년간 경험을 쌓은 우수 인재들을 활용하고 있습니다.",
      ]
    : language === "en"
    ? [
        "Korea Investment & Securities Vietnam (KIS Vietnam) was established in December 2010 by Korea Investment & Securities (KIS Korea), together with investment from Vietnam National Textile and Garment Group and other shareholders. KIS Korea held 48.8% of shares in November 2010 and has gradually increased its stake to the current official ownership of <strong>99.8%</strong>.",
        "Over <strong>15 years</strong> of operation in Vietnam, KIS Vietnam has continuously increased capital to expand its business activities, with total charter capital reaching <strong>4,550 billion VND</strong>, and this figure will continue to grow.",
        "KIS Vietnam receives strong support from the KIS Group in Korea, leveraging financial expertise and collaboration from foreign experts and outstanding employees with years of experience in banking, auditing, and domestic capital markets.",
      ]
    : [
        "Công ty Cổ phần Chứng khoán KIS Vietnam (KIS Vietnam) được thành lập vào tháng 12 năm 2010 bởi Công ty Cổ phần Đầu tư & Chứng khoán Hàn Quốc (KIS Korea), cùng với sự đầu tư của Tập đoàn Dệt may Việt Nam và các cổ đông khác. KIS Korea nắm giữ 48,8% cổ phần tại KIS Vietnam tính đến tháng 11 năm 2010 và đã dần dần tăng cường sở hữu trong những năm qua, với tỷ lệ sở hữu chính thức hiện tại là <strong>99,8%</strong>.",
        "Trong suốt <strong>15 năm</strong> hoạt động tại thị trường Việt Nam, KIS Vietnam đã liên tục tăng vốn để mở rộng các hoạt động kinh doanh của công ty, với tổng vốn điều lệ đạt <strong>4.550 tỷ VND</strong>, và con số này sẽ tiếp tục tăng trong tương lai.",
        "KIS Vietnam nhận được sự hỗ trợ mạnh mẽ từ Tập đoàn KIS tại Hàn Quốc, tận dụng kinh nghiệm trong lĩnh vực tài chính và sự hợp tác của các chuyên gia nước ngoài cùng đội ngũ nhân viên xuất sắc có nhiều năm kinh nghiệm trong ngân hàng, kiểm toán và thị trường vốn trong nước.",
      ];

  const statItems = [
    { value: "12/2010", label: language === "kr" ? "설립일" : language === "en" ? "Founded" : "Thành lập" },
    { value: "99.8%", label: language === "kr" ? "KIS Korea 지분" : language === "en" ? "KIS Korea stake" : "Sở hữu KIS Korea" },
    { value: "4.550 tỷ", label: language === "kr" ? "자본금 (VND)" : language === "en" ? "Charter capital (VND)" : "Vốn điều lệ (VND)" },
    { value: "15+", label: language === "kr" ? "경력 연수" : language === "en" ? "Years in Vietnam" : "Năm hoạt động" },
  ];

  return `
    <section class="overview-section-v2" id="kis-overview">
      <div class="container overview-split-v2">
        <div class="overview-text-col" data-reveal>
          <span class="eyebrow">${language === "kr" ? "회사 개요" : language === "en" ? "Company Overview" : "Tổng quan"}</span>
          <h2 class="section-title">${language === "kr" ? "KIS Vietnam 소개" : language === "en" ? "About KIS Vietnam" : "Tổng quan KIS Việt Nam"}</h2>
          <div class="overview-copy-v2">
            ${overviewParagraphs.map(p => `<p>${p}</p>`).join("")}
          </div>
        </div>
        <aside class="overview-stats-panel" data-stagger>
          ${statItems.map(s => `<div class="overview-stat-item"><span class="overview-stat-item__val">${escapeHtml(s.value)}</span><span class="overview-stat-item__label">${escapeHtml(s.label)}</span></div>`).join("")}
        </aside>
      </div>
    </section>
  `;
}

function leadershipSectionV2() {
  const leaders = [
    { img: "/assets/about/leader-shin-hyun-jae.jpg", name: "Shin Hyun Jae", title: language === "kr" ? "대표이사 겸 이사회 의장" : language === "en" ? "CEO & Chairman of the Board" : "Tổng Giám đốc kiêm Chủ tịch Hội đồng Quản trị" },
    { img: "/assets/about/leader-cho-hun-hee.jpg", name: "Cho Hun Hee", title: language === "kr" ? "운영·IT 블록 고위이사, 이사회 이사" : language === "en" ? "Senior Director of Operations & IT, Board Member" : "Giám đốc cấp cao Khối Hoạt động & KHCN, Thành viên HĐQT" },
    { img: "/assets/about/leader-choi-eun-suk.jpg", name: "Choi Eun Suk", title: language === "kr" ? "이사회 이사" : language === "en" ? "Member of the Board" : "Thành viên Hội đồng Quản trị" },
  ];
  return `
    <section class="board-section" id="kis-leadership">
      <div class="container">
        <div class="board-section__head" data-reveal>
          <span class="eyebrow">${language === "kr" ? "이사회" : language === "en" ? "Board of Directors" : "Hội đồng Quản trị"}</span>
          <h2 class="section-title">${language === "kr" ? "경영진" : language === "en" ? "Leadership" : "Ban Lãnh đạo"}</h2>
        </div>
        <div class="board-grid" data-board-stagger>
          ${leaders.map((l, i) => `
            <article class="board-member" style="--i:${i}">
              <div class="board-member__photo-frame">
                <img class="board-member__photo" src="${l.img}" alt="${escapeHtmlAttribute(l.name)}" loading="lazy">
              </div>
              <div class="board-member__info">
                <h3 class="board-member__name">${escapeHtml(l.name)}</h3>
                <p class="board-member__role">${escapeHtml(l.title)}</p>
              </div>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function coreValuesMissionSectionV2() {
  const title = language === "kr" ? "핵심 가치 및 미션" : language === "en" ? "Core Values & Mission" : "Giá trị cốt lõi & Sứ mệnh";
  const subtitle = language === "kr"
    ? "KIS가 조직을 구축하고 변화를 추진하며 지속 가능한 가치를 창출하는 방향을 제시합니다."
    : language === "en"
      ? "Guiding how KIS builds its organization, drives transformation, and creates sustainable value."
      : "Định hướng cách KIS xây dựng tổ chức, thúc đẩy đổi mới và tạo ra giá trị bền vững.";
  const values = [
    { num: "01", icon: "target", name: { vi: "Tổ chức hướng đến mục tiêu", en: "Goal-Oriented Organization", kr: "목표 지향적 조직" }, desc: { vi: "Xác lập mục tiêu rõ ràng, phối hợp hiệu quả và tập trung nguồn lực để tạo ra kết quả đo lường được.", en: "Setting clear objectives, coordinating effectively, and focusing resources to deliver measurable results.", kr: "명확한 목표를 설정하고 효과적으로 협업하며 자원을 집중하여 측정 가능한 성과를 창출합니다." } },
    { num: "02", icon: "check", name: { vi: "Tổ chức thúc đẩy chuyển đổi", en: "A Transformative Organization", kr: "변화를 주도하는 조직" }, desc: { vi: "Không ngừng đổi mới phương thức làm việc, ứng dụng công nghệ và phát triển năng lực để thích ứng với thay đổi.", en: "Continuously improving ways of working, adopting technology, and building capabilities to adapt to change.", kr: "업무 방식을 지속적으로 개선하고 기술을 도입하며 변화에 대응할 수 있는 역량을 강화합니다." } },
    { num: "03", icon: "users", name: { vi: "Công ty lấy khách hàng làm trọng tâm", en: "A Customer-Focused Company", kr: "고객 중심 기업" }, desc: { vi: "Thấu hiểu nhu cầu khách hàng, nâng cao trải nghiệm và tạo ra giải pháp tài chính có giá trị lâu dài.", en: "Understanding customer needs, improving experiences, and delivering financial solutions with long-term value.", kr: "고객의 요구를 이해하고 경험을 향상시키며 장기적인 가치를 제공하는 금융 솔루션을 제공합니다." } },
  ];
  return `
    <section class="core-values-v2">
      <div class="container">
        <div class="section-head" data-reveal>
          <div>
            <span class="eyebrow">${language === "kr" ? "핵심 가치" : language === "en" ? "Core Values" : "Giá trị cốt lõi"}</span>
            <h2 class="section-title">${title}</h2>
            <p class="section-lead">${subtitle}</p>
          </div>
        </div>
        <div class="core-values-grid" data-stagger>
          ${values.map(v => `
            <article class="core-value-v2">
              <span class="core-value-v2__num" aria-hidden="true">${v.num}</span>
              <div class="core-value-v2__icon">${icon(v.icon)}</div>
              <h3 class="core-value-v2__title">${escapeHtml(v.name[language] || v.name.vi)}</h3>
              <p class="core-value-v2__desc">${escapeHtml(v.desc[language] || v.desc.vi)}</p>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function corporatePhilosophySectionV2() {
  const pillars = [
    { num: "01", name: language === "kr" ? "고객 만족" : language === "en" ? "Customer Satisfaction" : "Làm hài lòng khách hàng", bullets: language === "kr"
      ? ["증권회사가 존재하는 이유는 고객입니다.", "고객의 관점에서 의사결정을 내립니다.", "고객 만족을 통해 고객과 함께 성장합니다."]
      : language === "en"
      ? ["Customers are the reason a securities company exists.", "Make decisions based on the customer's perspective.", "Grow with customers by ensuring their satisfaction."]
      : ["Khách hàng là lý do mà công ty chứng khoán tồn tại.", "Ra quyết định dựa trên góc nhìn của khách hàng.", "Phát triển cùng với khách hàng bằng cách đảm bảo sự hài lòng của họ."] },
    { num: "02", name: language === "kr" ? "새로운 가치 창출" : language === "en" ? "Creating New Value" : "Kiến tạo giá trị mới", bullets: language === "kr"
      ? ["사회를 위해 지속적으로 새로운 가치를 창출합니다.", "조직 역량을 강화하여 도전 정신으로 혁신합니다.", "최고의 목표와 탁월함을 추구합니다."]
      : language === "en"
      ? ["Continuously create new value for society.", "Innovate with a spirit of challenge by enhancing organizational capability.", "Pursue the highest goals and excellence."]
      : ["Liên tục tạo ra giá trị mới cho xã hội.", "Đổi mới với tinh thần thử thách bằng cách nâng cao năng lực tổ chức.", "Theo đuổi những mục tiêu cao nhất và sự xuất sắc."] },
    { num: "03", name: language === "kr" ? "개인 존중" : language === "en" ? "Respecting the Individual" : "Tôn trọng cá nhân", bullets: language === "kr"
      ? ["팀의 모든 개인을 항상 존중합니다.", "직장에서 개인이 자신의 능력을 발전시킬 수 있도록 장려합니다.", "각 개인이 탁월한 직원이 되도록 지원합니다."]
      : language === "en"
      ? ["We always respect each individual on our team.", "Encourage individuals to develop their abilities in the workplace.", "Support each individual to become outstanding employees."]
      : ["Chúng tôi luôn tôn trọng từng cá nhân trong đội ngũ của mình.", "Khuyến khích cá nhân phát triển khả năng của họ tại nơi làm việc.", "Hỗ trợ mỗi cá nhân trở thành những nhân viên xuất sắc."] },
  ];
  return `
    <section class="philosophy-v2">
      <div class="container">
        <div class="section-head" data-reveal>
          <div>
            <span class="eyebrow">${language === "kr" ? "경영 철학" : language === "en" ? "Philosophy" : "Triết lý"}</span>
            <h2 class="section-title">${language === "kr" ? "기업 철학" : language === "en" ? "Corporate Philosophy" : "Triết lý tập đoàn"}</h2>
          </div>
        </div>
        <div class="philosophy-pillars" data-stagger>
          ${pillars.map(p => `
            <div class="pillar-v2">
              <span class="pillar-v2__number" aria-hidden="true">${p.num}</span>
              <div class="pillar-v2__icon">${icon("check")}</div>
              <h3 class="pillar-v2__title">${escapeHtml(p.name)}</h3>
              <ul class="pillar-v2__body">${p.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
            </div>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function globalNetworkSectionV2() {
  const cards = [
    { title: "Korea Investment & Securities (KIS)", meta: language === "kr" ? "자회사 8개 · 대표사무소 1개" : language === "en" ? "8 subsidiaries · 1 representative office" : "8 công ty con · 1 văn phòng đại diện" },
    { title: "Korea Investment Management (KIM)", meta: language === "kr" ? "자회사 1개 · 대표사무소 1개" : language === "en" ? "1 subsidiary · 1 representative office" : "1 công ty con · 1 văn phòng đại diện" },
    { title: "Korea Investment Partners (KIP)", meta: language === "kr" ? "자회사 1개 · 대표사무소 2개" : language === "en" ? "1 subsidiary · 2 representative offices" : "1 công ty con · 2 văn phòng đại diện" },
    { title: "KIARA Advisors", meta: language === "kr" ? "글로벌 자문 네트워크" : language === "en" ? "Global advisory network" : "Global advisory network" },
  ];
  return `
    <section class="network-v2">
      <div class="container">
        <div class="section-head" data-reveal>
          <div>
            <span class="eyebrow">${language === "kr" ? "글로벌 네트워크" : language === "en" ? "Global Network" : "Mạng lưới toàn cầu"}</span>
            <h2 class="section-title">${t("about.network")}</h2>
            <p class="section-lead">${language === "kr" ? "KIS는 금융, 투자, 국제 거버넌스 역량을 연결하여 베트남 시장에서의 지속 가능한 발전을 지원합니다." : language === "en" ? "KIS connects financial, investment and international governance capabilities to support sustainable development in the Vietnamese market." : "KIS kết nối năng lực tài chính, đầu tư và quản trị quốc tế nhằm hỗ trợ sự phát triển bền vững tại thị trường Việt Nam."}</p>
          </div>
        </div>
        <div class="network-cards-v2" data-stagger>
          ${cards.map(c => `<article class="network-card-v2"><h3 class="network-card-v2__title">${escapeHtml(c.title)}</h3><p class="network-card-v2__meta">${escapeHtml(c.meta)}</p></article>`).join("")}
        </div>
        <div class="network-reference-map">
          <img src="/assets/about/global-network.png" alt="${language === "kr" ? "KIS 글로벌 네트워크 지도" : language === "en" ? "KIS Global Network Map" : "Mạng lưới KIS toàn cầu"}">
        </div>
      </div>
    </section>
  `;
}

function ceoMessageSectionV2() {
  const paragraphs = language === "kr"
    ? ["존경하는 투자자 및 파트너 여러분,", "KIS Vietnam을 대표하여 15년 이상의 여정 동안 KIS Vietnam을 신뢰하고 동행해 주신 모든 투자자와 파트너 분들께 진심으로 감사드립니다.", "창립 초기부터 KIS Vietnam은 고객 중심의 방향을 굳건히 유지하며, 서비스 품질을 지속적으로 향상시키고 현대 기술을 적용하여 국내외 개인 및 기관 투자자들에게 포괄적인 금융 상품과 솔루션을 제공해 왔습니다. 고객의 성공이 KIS Vietnam의 지속 가능한 발전의 기반이라고 믿습니다.", "베트남 자본 시장에서 선도적인 금융 기관 중 하나가 되겠다는 목표를 향해 나아가는 KIS Vietnam은 한국 KIS 그룹의 강력한 금융 기반, 경영 경험, 글로벌 네트워크를 계승할 뿐만 아니라, 우수한 인적 자원, 기술, 현대적 거래 인프라에 지속적으로 투자하여 고객 경험을 향상시키고 있습니다.", "풍부한 경험을 갖춘 전문가 팀과 첨단 기술 솔루션의 지원을 바탕으로, 고객과 파트너의 투자 여정에서 지속적으로 동반자가 되어 실질적이고 지속 가능하며 효과적인 가치를 제공할 것을 약속드립니다.", "다시 한번 여러분의 신뢰와 동행에 진심으로 감사드립니다. 투자자, 파트너 및 가족 모두의 건강, 행복, 성공을 기원합니다.", "진심을 담아."]
    : language === "en"
    ? ["Dear Investors and Partners,", "On behalf of KIS Vietnam Securities, I would like to extend my sincere gratitude to all investors and partners who have always trusted, accompanied, and supported KIS Vietnam throughout our 15-year journey of development.", "From our earliest days, KIS Vietnam has remained steadfast in its customer-centric direction, continuously improving service quality and applying modern technology to bring comprehensive financial products and solutions to individual and institutional investors, both domestic and international. We believe that customers' success is the foundation for KIS Vietnam's sustainable development.", "With the goal of becoming one of the leading financial institutions in Vietnam's capital market, KIS Vietnam not only inherits the strong financial foundation, management experience, and global network from KIS Korea, but also continuously invests in high-quality human resources, technology, and modern trading infrastructure to enhance the customer experience.", "With a team of experienced experts and the support of advanced technology solutions, we are committed to continuing to accompany our customers and partners on their investment journey, delivering practical, sustainable, and effective values.", "Once again, I sincerely thank you for your trust and companionship. I wish all investors, partners and their families health, happiness and success.", "Respectfully."]
    : ["Kính gửi Quý Nhà đầu tư và Đối tác,", "Thay mặt Công ty Cổ phần Chứng khoán KIS Việt Nam, tôi xin gửi lời cảm ơn chân thành tới Quý Nhà đầu tư và Đối tác đã luôn tin tưởng, đồng hành và ủng hộ KIS Việt Nam trong suốt chặng đường phát triển hơn 15 năm qua.", "Ngay từ những ngày đầu thành lập, KIS Việt Nam luôn kiên định với định hướng lấy khách hàng làm trung tâm, không ngừng nâng cao chất lượng dịch vụ và ứng dụng công nghệ hiện đại nhằm mang đến các sản phẩm, giải pháp tài chính toàn diện cho nhà đầu tư cá nhân, tổ chức trong nước và quốc tế.", "Với mục tiêu trở thành một trong những định chế tài chính hàng đầu trên thị trường vốn Việt Nam, KIS Việt Nam không chỉ kế thừa nền tảng tài chính vững mạnh, kinh nghiệm quản trị và mạng lưới toàn cầu từ KIS Hàn Quốc, mà còn không ngừng đầu tư vào nguồn nhân lực chất lượng cao, công nghệ và hạ tầng giao dịch hiện đại để nâng cao trải nghiệm khách hàng.", "Sở hữu đội ngũ chuyên gia giàu kinh nghiệm cùng sự hỗ trợ từ các giải pháp công nghệ tiên tiến, chúng tôi cam kết tiếp tục đồng hành cùng Quý khách hàng và đối tác trên hành trình đầu tư, mang đến những giá trị thiết thực, bền vững và hiệu quả.", "Một lần nữa, xin chân thành cảm ơn sự tin tưởng và đồng hành của Quý vị. Kính chúc Quý Nhà đầu tư, Đối tác cùng gia đình sức khỏe, hạnh phúc và thành công.", "Trân trọng."];
  return `
    <section class="ceo-v2">
      <div class="container">
        <div class="section-head" data-reveal>
          <div>
            <span class="eyebrow">${language === "kr" ? "대표 메시지" : language === "en" ? "CEO Message" : "Thông điệp lãnh đạo"}</span>
            <h2 class="section-title">${language === "kr" ? "대표이사의 말씀" : language === "en" ? "Message from the CEO" : "Lời Tổng Giám đốc"}</h2>
          </div>
        </div>
        <div class="ceo-card-v2" data-reveal>
          <span class="ceo-card-v2__quote" aria-hidden="true">"</span>
          <div class="ceo-card-v2__photo">
            <img src="/assets/about/tgd.jpeg" alt="Shin, Hyun Jae" loading="lazy">
          </div>
          <div class="ceo-card-v2__body">
            <h3 class="ceo-card-v2__name">Shin, Hyun Jae</h3>
            <span class="ceo-card-v2__role">${language === "kr" ? "대표이사" : language === "en" ? "Chief Executive Officer" : "Tổng Giám đốc"}</span>
            <div class="ceo-card-v2__letter">
              ${paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join("")}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function globalNetworkSection() {
  const cards = [
    ["Korea Investment & Securities (KIS)", "8 công ty con", "1 văn phòng đại diện"],
    ["Korea Investment Management (KIM)", "1 công ty con", "1 văn phòng đại diện"],
    ["Korea Investment Partners (KIP)", "1 công ty con", "2 văn phòng đại diện"],
    ["KIARA Advisors", "Global advisory network", ""],
  ];
  return `<section class="section alt global-network-section"><div class="container"><div class="section-head"><div><h2 class="section-title">${t("about.network")}</h2><p class="section-lead">KIS kết nối năng lực tài chính, đầu tư và quản trị quốc tế nhằm hỗ trợ sự phát triển bền vững tại thị trường Việt Nam.</p></div></div><div class="network-summary-grid">${cards.map(([title, left, right]) => `<article class="card network-summary-card"><h3>${title}</h3><p>${right ? `${left} <span>|</span> ${right}` : left}</p></article>`).join("")}</div><div class="network-reference-map"><img src="/assets/about/global-network.png" alt="Mạng lưới KIS toàn cầu với bản đồ dotted map và các văn phòng quốc tế"></div></div></section>`;
}

function leadershipSection() {
  const leaders = [
    {
      img: "/assets/about/leader-shin-hyun-jae.jpg",
      name: "Shin Hyun Jae",
      title: "Tổng Giám đốc kiêm Chủ tịch Hội đồng Quản trị",
    },
    {
      img: "/assets/about/leader-cho-hun-hee.jpg",
      name: "Cho Hun Hee",
      title: "Giám đốc cấp cao Khối Hoạt động & KHCN, Thành viên HĐQT",
    },
    {
      img: "/assets/about/leader-choi-eun-suk.jpg",
      name: "Choi Eun Suk",
      title: "Thành viên Hội đồng Quản trị",
    },
  ];
  return `<section class="section alt" id="kis-leadership">
    <div class="container">
      <div class="section-head">
        <div>
          <h2 class="section-title">Ban Lãnh đạo</h2>
          <p class="section-lead">Đội ngũ lãnh đạo dẫn dắt KIS Việt Nam trên hành trình phát triển bền vững.</p>
        </div>
      </div>
      <div class="leadership-grid">
        ${leaders.map((l, i) => `
          <article class="leader-card" style="animation-delay: ${i * 80}ms">
            <div class="leader-card__photo-wrap">
              <img class="leader-card__photo" src="${l.img}" alt="Ảnh ${l.name}" loading="lazy">
            </div>
            <div class="leader-card__info">
              <h3 class="leader-card__name">Ông ${l.name}</h3>
              <p class="leader-card__title">${l.title}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </div>
  </section>`;
}

function renderTimelineContent(year) {
  const item = timelineData[year];
  if (!item) return "";
  return `<div class="timeline-carousel__content-inner" data-active-year="${year}" data-direction="${_timelineDirection}">
    <div class="timeline-carousel__watermark" aria-hidden="true">${year}</div>
    <div class="timeline-carousel__image"${year === "2020" ? ' data-year="2020"' : ""}>
      <img src="${item.image}" alt="KIS Vietnam ${year}" loading="lazy" decoding="async">
    </div>
    <div class="timeline-carousel__info" role="tabpanel" aria-labelledby="timeline-year-${year}" tabindex="0">
      <h3 class="timeline-carousel__year-big">${year}</h3>
      <ul class="timeline-carousel__events">
        ${item.events.map((ev, i) => `<li style="--i:${i}">${ev}</li>`).join("")}
      </ul>
    </div>
  </div>`;
}

function kisTimelineSection() {
  const year = activeTimelineYear;
  const years = Object.keys(timelineData);
  const idx = years.indexOf(year);
  const totalYears = years.length;
  const prevDisabled = idx === 0 ? " disabled" : "";
  const nextDisabled = idx === years.length - 1 ? " disabled" : "";
  const chevronLeft = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  const chevronRight = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  return `<section class="section timeline-carousel" id="kis-history" data-timeline-entry>
    <div class="container">
      <div class="timeline-carousel__header">
        <h2 class="section-title" data-reveal>${t("about.timeline")}</h2>
        <div class="timeline-carousel__nav-buttons">
          <button class="timeline-carousel__btn timeline-carousel__btn--prev" aria-label="Previous year"${prevDisabled}>${chevronLeft}</button>
          <button class="timeline-carousel__btn timeline-carousel__btn--next" aria-label="Next year"${nextDisabled}>${chevronRight}</button>
        </div>
      </div>
      <div class="timeline-carousel__years" role="tablist" aria-label="Select year" style="--active-index:${idx};--total-years:${totalYears}">
        <div class="timeline-carousel__years-line" aria-hidden="true"></div>
        <div class="timeline-carousel__years-progress" aria-hidden="true"></div>
        ${years.map(y => `
          <button id="timeline-year-${y}" class="timeline-carousel__year${y === year ? " is-active" : ""}" role="tab" aria-selected="${y === year}" tabindex="${y === year ? "0" : "-1"}"${y === year ? ' aria-current="true"' : ""} data-timeline-year="${y}">
            <span class="timeline-carousel__year-label">${y}</span>
            <span class="timeline-carousel__year-dot"></span>
          </button>
        `).join("")}
      </div>
      <div class="timeline-carousel__content" aria-live="polite">
        ${renderTimelineContent(year)}
      </div>
    </div>
  </section>`;
}

function ceoMessageSection() {
  const paragraphs = ["Kính gửi Quý Nhà đầu tư và Đối tác,", "Thay mặt Công ty Cổ phần Chứng khoán KIS Việt Nam, tôi xin gửi lời cảm ơn chân thành tới Quý Nhà đầu tư và Đối tác đã luôn tin tưởng, đồng hành và ủng hộ KIS Việt Nam trong suốt chặng đường phát triển hơn 15 năm qua.", "Ngay từ những ngày đầu thành lập, KIS Việt Nam luôn kiên định với định hướng lấy khách hàng làm trung tâm, không ngừng nâng cao chất lượng dịch vụ và ứng dụng công nghệ hiện đại nhằm mang đến các sản phẩm, giải pháp tài chính toàn diện cho nhà đầu tư cá nhân, tổ chức trong nước và quốc tế. Chúng tôi tin rằng sự thành công của khách hàng chính là nền tảng cho sự phát triển bền vững của KIS Việt Nam.", "Với mục tiêu trở thành một trong những định chế tài chính hàng đầu trên thị trường vốn Việt Nam, KIS Việt Nam không chỉ kế thừa nền tảng tài chính vững mạnh, kinh nghiệm quản trị và mạng lưới toàn cầu từ KIS Hàn Quốc, mà còn không ngừng đầu tư vào nguồn nhân lực chất lượng cao, công nghệ và hạ tầng giao dịch hiện đại để nâng cao trải nghiệm khách hàng.", "Sở hữu đội ngũ chuyên gia giàu kinh nghiệm cùng sự hỗ trợ từ các giải pháp công nghệ tiên tiến, chúng tôi cam kết tiếp tục đồng hành cùng Quý khách hàng và đối tác trên hành trình đầu tư, mang đến những giá trị thiết thực, bền vững và hiệu quả.", "Một lần nữa, xin chân thành cảm ơn sự tin tưởng và đồng hành của Quý vị. Kính chúc Quý Nhà đầu tư, Đối tác cùng gia đình sức khỏe, hạnh phúc và thành công.", "Trân trọng."];
  return `<section class="section alt"><div class="container"><h2 class="section-title">Lời Tổng Giám đốc</h2><div class="ceo-message-card card"><div class="ceo-photo"><img src="/assets/about/tgd.jpeg" alt="Shin, Hyun Jae - Tổng Giám đốc"></div><div class="ceo-copy"><h3>Shin, Hyun Jae</h3><p class="label">Tổng Giám đốc</p><div class="ceo-letter">${paragraphs.map((p) => `<p>${p}</p>`).join("")}</div></div></div></div></section>`;
}

function corporatePhilosophySection() {
  const cards = [["01", "Làm hài lòng khách hàng", ["Khách hàng là lý do mà công ty chứng khoán tồn tại.", "Ra quyết định dựa trên góc nhìn của khách hàng.", "Phát triển cùng với khách hàng bằng cách đảm bảo sự hài lòng của họ."]], ["02", "Kiến tạo giá trị mới", ["Liên tục tạo ra giá trị mới cho xã hội.", "Đổi mới với tinh thần thử thách bằng cách nâng cao năng lực tổ chức.", "Theo đuổi những mục tiêu cao nhất và sự xuất sắc."]], ["03", "Tôn trọng cá nhân", ["Chúng tôi luôn tôn trọng từng cá nhân trong đội ngũ của mình.", "Khuyến khích cá nhân phát triển khả năng của họ tại nơi làm việc.", "Hỗ trợ mỗi cá nhân trở thành những nhân viên xuất sắc."]]];
  return `<section class="section"><div class="container"><h2 class="section-title">Triết lý tập đoàn</h2><div class="grid-3">${cards.map(([no,title,bullets]) => `<article class="card philosophy-premium philosophy-list-card"><header class="phil-card-head"><div class="phil-icon-wrap" aria-hidden="true">${icon("check")}</div><span class="phil-no" aria-hidden="true">${no}</span></header><h3>${title}</h3><ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul></article>`).join("")}</div></div></section>`;
}

function coreValuesMissionSection() {
  const title = language === "kr" ? "핵심 가치 및 미션" : language === "en" ? "Core Values & Mission" : "Giá trị cốt lõi & Sứ mệnh";
  const subtitle = language === "kr"
    ? "KIS가 조직을 구축하고 변화를 추진하며 고객을 위한 지속 가능한 가치를 창출하는 방향을 제시합니다."
    : language === "en"
      ? "Guiding how KIS builds its organization, drives transformation, and creates sustainable value for customers."
      : "Định hướng cách KIS xây dựng tổ chức, thúc đẩy đổi mới và tạo ra giá trị bền vững cho khách hàng.";
  const cards = [
    ["01", "target", { vi: "Tổ chức hướng đến mục tiêu", en: "Goal-Oriented Organization", kr: "목표 지향적 조직" }, { vi: "Xác lập mục tiêu rõ ràng, phối hợp hiệu quả và tập trung nguồn lực để tạo ra kết quả đo lường được.", en: "Setting clear objectives, coordinating effectively, and focusing resources to deliver measurable results.", kr: "명확한 목표를 설정하고 효과적으로 협업하며 자원을 집중하여 측정 가능한 성과를 창출합니다." }],
    ["02", "check", { vi: "Tổ chức thúc đẩy chuyển đổi", en: "A Transformative Organization", kr: "변화를 주도하는 조직" }, { vi: "Không ngừng đổi mới phương thức làm việc, ứng dụng công nghệ và phát triển năng lực để thích ứng với thay đổi.", en: "Continuously improving ways of working, adopting technology, and building capabilities to adapt to change.", kr: "업무 방식을 지속적으로 개선하고 기술을 도입하며 변화에 대응할 수 있는 역량을 강화합니다." }],
    ["03", "users", { vi: "Công ty lấy khách hàng làm trọng tâm", en: "A Customer-Focused Company", kr: "고객 중심 기업" }, { vi: "Thấu hiểu nhu cầu khách hàng, nâng cao trải nghiệm và tạo ra giải pháp tài chính có giá trị lâu dài.", en: "Understanding customer needs, improving experiences, and delivering financial solutions with long-term value.", kr: "고객의 요구를 이해하고 경험을 향상시키며 장기적인 가치를 제공하는 금융 솔루션을 제공합니다." }],
  ];
  return `<section class="section alt"><div class="container"><div class="section-head"><div><h2 class="section-title">${title}</h2><p class="section-lead">${subtitle}</p></div></div><div class="grid-3">${cards.map(([no, i, names, descriptions]) => `<article class="card philosophy-premium philosophy-list-card core-value-card"><header class="phil-card-head"><div class="phil-icon-wrap" aria-hidden="true">${icon(i)}</div><span class="phil-no" aria-hidden="true">${no}</span></header><h3>${names[language] || names.vi}</h3><p>${descriptions[language] || descriptions.vi}</p></article>`).join("")}</div></div></section>`;
}

function cchnRows() {
  return getEmployees()
    .filter((employee) => employee.certificateType && employee.certificateType.trim() !== "")
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi", { sensitivity: "base" }));
}

function filteredCchnRows() {
  return cchnRows().filter((row) => {
    const text = row.fullName.toLowerCase();
    return !cchnSearch || text.includes(cchnSearch.toLowerCase());
  }).sort((a, b) => cchnSortAsc
    ? a.fullName.localeCompare(b.fullName, "vi", { sensitivity: "base" })
    : b.fullName.localeCompare(a.fullName, "vi", { sensitivity: "base" }));
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))];
}

function cchnHonorSection() {
  const rows = filteredCchnRows();
  const allRows = cchnRows();
  const totalText = language === "kr"
    ? `${allRows.length}명의 임직원이 전문 자격증을 보유하고 있습니다`
    : language === "en"
      ? `${allRows.length} employees holding professional certificates`
      : `${allRows.length} nhân viên sở hữu Chứng chỉ hành nghề`;
  const pageSize = 24;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  cchnPage = Math.min(cchnPage, totalPages);
  const pageRows = rows.slice((cchnPage - 1) * pageSize, cchnPage * pageSize);
  return `
    <section class="section cchn-section" id="cchn-honor">
      <div class="container">
        <div class="cchn-table-shell card">
          <div class="section-head"><div><h2 class="section-title">${uiText("cchnTitle")}</h2><p class="section-lead">${totalText}</p></div></div>
        <div class="cchn-filter table-only-filter">
          <input data-cchn-search placeholder="${uiText("searchName")}" value="${cchnSearch}" aria-label="${uiText("searchName")}">
          <button class="btn btn-outline" data-cchn-sort type="button">A-Z</button>
        </div>
        <div id="publicCchnResults" aria-live="polite">${publicCchnResultsHtml(pageRows, totalPages, pageSize)}</div>
        </div>
      </div>
    </section>
  `;
}

function publicCchnResultsHtml(pageRowsArg = null, totalPagesArg = null, pageSizeArg = 24) {
  const rows = filteredCchnRows();
  const totalPages = totalPagesArg || Math.max(1, Math.ceil(rows.length / pageSizeArg));
  cchnPage = Math.min(cchnPage, totalPages);
  const pageRows = pageRowsArg || rows.slice((cchnPage - 1) * pageSizeArg, cchnPage * pageSizeArg);
  return `${pageRows.length ? cchnTableView(pageRows, (cchnPage - 1) * pageSizeArg) : emptyCchnState()}${totalPages > 1 ? pagination("cchn", cchnPage, totalPages) : ""}`;
}

function renderPublicCchnResults() {
  const target = document.getElementById("publicCchnResults");
  if (!target) return;
  target.innerHTML = publicCchnResultsHtml();
  bindPublicCchnResultEvents(target);
}

function bindPublicCchnResultEvents(root = document) {
  root.querySelectorAll("[data-page-kind='cchn']").forEach((el) => el.addEventListener("click", () => { cchnPage = Math.max(1, Number(el.dataset.page) || 1); renderPublicCchnResults(); }));
}

function selectFilter(name, label, values, selected) {
  return `<select data-cchn-filter="${name}"><option value="">${label}</option>${values.map((value) => `<option value="${value}" ${selected === value ? "selected" : ""}>${value}</option>`).join("")}</select>`;
}

function cchnTableView(rows, offset = 0) {
  return `<div class="table-wrap cchn-table polished-table"><table><thead><tr><th>${uiText("no")}</th><th>${uiText("fullName")}</th></tr></thead><tbody>${rows.map((r, index) => `<tr><td>${offset + index + 1}</td><td><strong>${r.fullName}</strong></td></tr>`).join("")}</tbody></table></div>`;
}

function cchnStatusBadge(status = "Còn hiệu lực") {
  const cls = status.includes("Cần") ? "pending" : status.includes("Hết") ? "late" : "done";
  return `<span class="badge ${cls}">${status}</span>`;
}

function emptyCchnState() {
  return `<div class="empty-cchn">${icon("award")}<h3>${t("about.noData")}</h3><p>${t("about.noDataDesc")}</p></div>`;
}

function pagination(kind, current, total) {
  const previous = language === "vi" ? "Trang trước" : language === "kr" ? "이전 페이지" : "Previous page";
  const next = language === "vi" ? "Trang sau" : language === "kr" ? "다음 페이지" : "Next page";
  const label = language === "vi" ? `Trang ${current} / ${total}` : language === "kr" ? `${current} / ${total} 페이지` : `Page ${current} of ${total}`;
  return `<nav class="pagination ${kind}-pagination" aria-label="${label}"><button aria-label="${previous}" data-page-kind="${kind}" data-page="${current - 1}" ${current <= 1 ? "disabled" : ""}>‹</button><span>${label}</span><button aria-label="${next}" data-page-kind="${kind}" data-page="${current + 1}" ${current >= total ? "disabled" : ""}>›</button></nav>`;
}

function trainingValueLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "done") return "Hoàn thành";
  if (normalized === "x") return "Đã tham gia";
  return value ? String(value) : "Chưa có dữ liệu";
}

function trainingValueBadge(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "done") return badge("completed");
  if (normalized === "x") return badge("inProgress");
  return badge("notStarted");
}

function employeeTrainingRows(employee) {
  const specialization = employee.specializationCourses || {};
  return [
    ["Leadership Training", employee.leadershipTraining],
    ["Communication Training", employee.communicationTraining],
    ["Basic of Securities", specialization.basicOfSecurities],
    ["Law of Securities", specialization.lawOfSecurities],
    ["Analysis and Investment Securities", specialization.analysisAndInvestmentSecurities],
    ["Brokerage and Investment Advisory", specialization.brokerageAndInvestmentAdvisory],
    ["Analysis of Financial Statements", specialization.analysisOfFinancialStatements],
    ["Financial Advisory and Underwriting", specialization.financialAdvisoryAndUnderwriting],
    ["Assets and Fund Management", specialization.assetsAndFundManagement],
    ["Derivative Securities", specialization.derivativeSecurities],
  ].filter(([, value]) => value);
}

function localizedStatus(status) {
  const labels = {
    active: t("status.active"),
    pendingActivation: t("status.pendingActivation"),
    temporarilyLocked: t("status.temporarilyLocked"),
    disabled: t("status.disabled"),
    pendingReview: "Cần kiểm tra",
  };
  return labels[status] || status || "-";
}

function filteredEmployeeDirectory() {
  return _apiEmployees.filter((employee) => {
    const searchText = `${employee.fullName} ${employee.email} ${employee.department} ${employee.employeeCode}`.toLowerCase();
    return (!employeeDirectorySearch || searchText.includes(employeeDirectorySearch.toLowerCase()))
      && (!employeeDirectoryFilters.department || employee.department === employeeDirectoryFilters.department)
      && (!employeeDirectoryFilters.position || employee.position === employeeDirectoryFilters.position)
      && (!employeeDirectoryFilters.accountStatus || employee.accountStatus === employeeDirectoryFilters.accountStatus)
      && (!employeeDirectoryFilters.cchn || (employeeDirectoryFilters.cchn === "yes" ? !!employee.certificateType : !employee.certificateType));
  }).sort((a, b) => employeeDirectorySortAsc
    ? a.fullName.localeCompare(b.fullName, "vi", { sensitivity: "base" })
    : b.fullName.localeCompare(a.fullName, "vi", { sensitivity: "base" }));
}

function employeeSelect(name, label, values, selected) {
  return `<select data-employee-filter="${name}"><option value="">${label}</option>${values.map((value) => `<option value="${value}" ${selected === value ? "selected" : ""}>${value}</option>`).join("")}</select>`;
}

function hrEmployeeDirectory() {
  const allEmployees = _apiEmployees;
  const filtered = filteredEmployeeDirectory();
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  employeeDirectoryPage = Math.min(employeeDirectoryPage, totalPages);
  const pageRows = filtered.slice((employeeDirectoryPage - 1) * pageSize, employeeDirectoryPage * pageSize);

  let bodyContent;
  if (_apiEmployeesLoading && !_apiEmployeesLoaded) {
    bodyContent = `<div class="hr-overview-skeleton" aria-label="Đang tải danh sách nhân viên">${Array.from({ length: 4 }, () => `<span></span>`).join("")}</div>`;
  } else if (_apiEmployeesError && !_apiEmployeesLoaded) {
    bodyContent = `<div class="empty-state"><p>Không tải được danh sách nhân viên: ${escapeHtml(_apiEmployeesError)}</p><button class="btn btn-primary" data-reload-employees>Thử lại</button></div>`;
  } else {
    bodyContent = `${employeeDirectoryTable(pageRows, (employeeDirectoryPage - 1) * pageSize)}${totalPages > 1 ? pagination("employees", employeeDirectoryPage, totalPages) : ""}`;
  }

  return `<section class="card panel hr-employee-directory">
    <div class="section-head"><div><h3>${t("admin.employeeList")}</h3><p class="section-lead">${t("admin.totalEmployees")}: ${allEmployees.length}</p></div><div class="security-actions"><button class="btn btn-primary" data-add-employee>+ Thêm nhân viên</button><button class="btn btn-outline" data-reload-employees>${_apiEmployeesLoading ? "Đang tải..." : "Làm mới"}</button><label class="btn btn-outline" for="employeePhotoFolder">Import ảnh</label><input id="employeePhotoFolder" type="file" accept="image/jpeg,image/png,image/webp" webkitdirectory multiple hidden><button class="btn btn-outline" data-sort-employees>${t("admin.sortAZ")}</button></div></div>
    <div class="filter-bar employee-directory-filter">
      <input id="employeeDirSearch" data-focus-key="employee-dir-search" data-employee-search placeholder="${t("admin.searchEmployee")}" value="${employeeDirectorySearch}">
      ${employeeSelect("department", t("table.department"), uniqueValues(allEmployees, "department"), employeeDirectoryFilters.department)}
      ${employeeSelect("position", t("table.position"), uniqueValues(allEmployees, "position"), employeeDirectoryFilters.position)}
      ${employeeSelect("accountStatus", t("table.accountStatus"), uniqueValues(allEmployees, "accountStatus"), employeeDirectoryFilters.accountStatus)}
      <select data-employee-filter="cchn"><option value="">CCHN</option><option value="yes" ${employeeDirectoryFilters.cchn === "yes" ? "selected" : ""}>${t("admin.hasCchn")}</option><option value="no" ${employeeDirectoryFilters.cchn === "no" ? "selected" : ""}>${t("admin.noCchn")}</option></select>
    </div>
    <div id="employeeDirectoryResults" aria-live="polite">${bodyContent}</div>
  </section>`;
}

function employeeDirectoryResultsHtml() {
  const filtered = filteredEmployeeDirectory();
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  employeeDirectoryPage = Math.min(employeeDirectoryPage, totalPages);
  const pageRows = filtered.slice((employeeDirectoryPage - 1) * pageSize, employeeDirectoryPage * pageSize);
  if (_apiEmployeesLoading && !_apiEmployeesLoaded) return `<div class="hr-overview-skeleton" aria-label="Đang tải danh sách nhân viên">${Array.from({ length: 4 }, () => `<span></span>`).join("")}</div>`;
  if (_apiEmployeesError && !_apiEmployeesLoaded) return `<div class="empty-state"><p>Không tải được danh sách nhân viên: ${escapeHtml(_apiEmployeesError)}</p><button class="btn btn-primary" data-reload-employees>Thử lại</button></div>`;
  return `${employeeDirectoryTable(pageRows, (employeeDirectoryPage - 1) * pageSize)}${totalPages > 1 ? pagination("employees", employeeDirectoryPage, totalPages) : ""}`;
}

function renderEmployeeDirectoryResults() {
  const target = document.getElementById("employeeDirectoryResults");
  if (!target) return;
  target.innerHTML = employeeDirectoryResultsHtml();
  bindEmployeeDirectoryResultEvents(target);
}

function bindEmployeeDirectoryResultEvents(root = document) {
  root.querySelectorAll("[data-page-kind='employees']").forEach((el) => el.addEventListener("click", () => { employeeDirectoryPage = Math.max(1, Number(el.dataset.page) || 1); renderEmployeeDirectoryResults(); }));
  root.querySelectorAll("[data-edit-employee]").forEach((el) => el.addEventListener("click", () => { employeeEditId = el.dataset.editEmployee; employeeEditOpen = true; render(); }));
  root.querySelectorAll("[data-open-certs]").forEach((el) => el.addEventListener("click", () => { certModalEmployeeId = el.dataset.openCerts; certModalOpen = true; render(); }));
  root.querySelectorAll("[data-account-detail]").forEach((el) => el.addEventListener("click", () => { selectedAccountId = el.dataset.accountDetail; accountDrawerOpen = true; render(); }));
  root.querySelectorAll("[data-reset-account]").forEach((el) => el.addEventListener("click", () => { resetTargetId = el.dataset.resetAccount; resetModalOpen = true; temporaryPasswordResult = ""; render(); }));
  root.querySelectorAll("[data-delete-employee]").forEach((el) => el.addEventListener("click", () => {
    _deleteEmployeeId = el.dataset.deleteEmployee;
    _deleteEmployeeName = el.dataset.deleteEmployeeName || "";
    _deleteEmployeeConfirming = false;
    render();
  }));
}

function employeeDirectoryTable(rows, offset = 0) {
  if (!rows.length) return `<div class="empty-state"><p>Không tìm thấy nhân viên nào.</p></div>`;
  return `<div class="table-wrap employee-directory-table"><table><thead><tr><th>STT</th><th>${t("table.fullName")}</th><th>${t("table.department")}</th><th>${t("table.position")}</th><th>${t("table.email")}</th><th>${t("table.accountStatus")}</th><th>CCHN</th><th>${t("admin.action")}</th></tr></thead><tbody>${rows.map((emp, index) => `<tr>
    <td>${offset + index + 1}</td>
    <td><strong>${escapeHtml(emp.fullName || "")}</strong></td>
    <td>${escapeHtml(emp.department || "")}</td>
    <td>${escapeHtml(emp.position || "")}</td>
    <td>${emp.email ? escapeHtml(emp.email) : `<span class='muted-cell'>${t("admin.needsUpdate")}</span>`}</td>
    <td>${localizedStatus(emp.accountStatus)}</td>
    <td>${emp.certificateType ? t("admin.hasCchn") : ""}</td>
    <td><div class="row-actions">
      <button class="btn btn-outline mini-action" data-edit-employee="${escapeHtmlAttribute(emp.id)}">Sửa</button>
      <button class="btn btn-outline mini-action" data-open-certs="${escapeHtmlAttribute(emp.id)}">Chứng chỉ</button>
      <button class="btn btn-outline mini-action" data-account-detail="${escapeHtmlAttribute(emp.id)}">${t("admin.detail")}</button>
      <button class="btn btn-outline mini-action" data-reset-account="${escapeHtmlAttribute(emp.id)}">${t("admin.resetPassword")}</button>
      <button type="button" class="btn btn-outline mini-action danger-action" data-delete-employee="${escapeHtmlAttribute(emp.id)}" data-delete-employee-name="${escapeHtmlAttribute(emp.fullName || "")}">Xóa</button>
    </div></td>
  </tr>`).join("")}</tbody></table></div>`;
}

function loginPage() {
  const demoEmployee = getDemoEmployee();
  return `
    <main class="auth-page" role="main">
      <div class="auth-background" aria-hidden="true"></div>
      <div class="auth-overlay" aria-hidden="true"></div>
      <div class="auth-header" aria-hidden="false">
        <a href="/" data-link class="auth-home-btn" aria-label="Quay về trang chủ">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="16" height="16"><path d="M12 4L6 10l6 6"/></svg>
          Về trang chủ
        </a>
      </div>
      <section class="auth-context" aria-hidden="true">
        <div class="auth-context-copy">
          <h1>Đăng nhập MyKIS Learning</h1>
          <p>Nền tảng Học tập và Phát triển năng lực<br>Dành riêng cho nhân viên KIS Việt Nam</p>
        </div>
      </section>
      <section class="auth-visual">
        <form class="card login-card" id="loginForm" novalidate autocomplete="on">
          <div class="login-card-head">
            <div class="login-brand-group">
              <a href="/" data-link class="login-logo-link" aria-label="Quay về trang chủ">
                <img src="/assets/kis-logo-horizontal.png" alt="KIS Vietnam" class="login-brand-logo">
              </a>
              <div class="login-language-switcher">${languageSwitcher()}</div>
            </div>
          </div>
          <div class="login-heading">
            <h2>${uiText("loginHeading") || "Đăng nhập"}</h2>
          </div>
          <div class="field">
            <label for="loginEmail">${t("login.email") || "Email"}</label>
            <input
              id="loginEmail"
              name="identifier"
              autocomplete="email"
              type="email"
              inputmode="email"
              placeholder="${t("login.emailPlaceholder") || "Nhập email công ty"}"
              aria-describedby="loginEmailError"
              aria-required="true"
              value="${escapeHtmlAttribute(_loginEmailRetain)}"
            >
            <span class="field-error" id="loginEmailError" data-login-email-error aria-live="polite"></span>
          </div>
          <div class="field field--password">
            <label for="loginPassword">${t("login.password") || "Mật khẩu"}</label>
            <div class="input-password-wrap">
              <input
                id="loginPassword"
                name="password"
                type="password"
                autocomplete="current-password"
                placeholder="${t("login.passwordPlaceholder") || "Nhập mật khẩu"}"
                aria-required="true"
              >
              <button type="button" class="password-toggle" data-toggle-password aria-label="Hiện mật khẩu" aria-pressed="false">
                <svg class="eye-icon eye-icon--show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <svg class="eye-icon eye-icon--hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              </button>
            </div>
          </div>
          <div class="login-options">
            <label class="remember-me-row">
              <input type="checkbox" name="rememberMe" class="remember-me-check" id="loginRememberMe">
              <span>${uiText("rememberMe") || "Ghi nhớ đăng nhập"}</span>
            </label>
            <button class="link-button" type="button" data-login-support>${uiText("cannotLogin") || "Bạn không thể đăng nhập?"}</button>
          </div>
          <button class="btn btn-primary login-submit" type="submit" id="loginSubmitBtn">
            <span class="login-submit-text">${t("login.submit") || "Đăng nhập"}</span>
            <span class="login-submit-spinner" aria-hidden="true" style="display:none">
              <svg class="spinner-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="31.4 62.8"/></svg>
            </span>
          </button>
          <p class="login-security-note">${t("login.note") || "Tài khoản được cấp bởi Phòng Nhân sự."}</p>
          ${SHOW_DEMO_CREDENTIALS ? `<details class="demo-accounts">
            <summary class="demo-accounts__toggle">
              <span class="demo-accounts__label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                Tài khoản dùng thử
              </span>
              <svg class="demo-accounts__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            </summary>
            <div class="demo-accounts__body">
              <div class="demo-slot">
                <p class="demo-slot__title">Tài khoản dùng thử cho HR</p>
                <div class="demo-slot__creds">
                  <span><span class="demo-slot__label">Email</span><span class="demo-slot__val">${DEMO_HR_EMAIL}</span></span>
                  <span><span class="demo-slot__label">Mật khẩu</span><span class="demo-slot__val">${DEMO_HR_PASSWORD}</span></span>
                </div>
                <button type="button" class="demo-slot__use" data-fill-demo-account>Dùng tài khoản này</button>
              </div>
              <div class="demo-slot">
                <p class="demo-slot__title">Tài khoản dùng thử cho Nhân viên</p>
                <div class="demo-slot__creds">
                  <span><span class="demo-slot__label">Email</span><span class="demo-slot__val">${DEMO_EMPLOYEE_EMAIL}</span></span>
                  <span><span class="demo-slot__label">Mật khẩu</span><span class="demo-slot__val">${DEMO_EMPLOYEE_PASSWORD}</span></span>
                </div>
                <button type="button" class="demo-slot__use" data-fill-demo-employee>Dùng tài khoản này</button>
              </div>
            </div>
          </details>` : ""}
        </form>
      </section>
    </main>
    ${loginSupportModal()}
  `;
}

function getDemoEmployee() {
  return getAccounts().find((account) => account.role === "employee"
    && account.email?.toLowerCase() === DEMO_EMPLOYEE_EMAIL
    && account.accountStatus === "active"
    && verifyPassword(account, DEMO_EMPLOYEE_PASSWORD)) || null;
}

function employeeDashboard(compact = false) {
  if (compact || !hasEmployeeAccess()) return "";
  const { account, employee } = getCurrentEmployeeContext();
  const enrollments = employeeEnrollments();
  const notifications = getNotifications(session.accountId);
  const unread = getUnreadCount(session.accountId);
  const yearStart=`${new Date().getFullYear()}-01-01T00:00:00+07:00`;const trainingTime=calculateEmployeeTrainingTime(session.accountId,{dateFrom:yearStart});
  const completed = enrollments.filter((item) => item.status === "completed").length;
  const inProgress = enrollments.filter((item) => item.status === "inProgress").length;
  const overdue = enrollments.filter((item) => item.status === "overdue").length;
  const recent = [...enrollments].filter((item) => item.status !== "completed").sort(compareEnrollmentPriority).slice(0, 3);
  const activities=getLearningActivity({accountId:session.accountId});
  const primary = [...recent].sort((a,b)=>{
    const aa=activities.find(x=>x.courseId===a.courseId)?.occurredAt||"";
    const bb=activities.find(x=>x.courseId===b.courseId)?.occurredAt||"";
    return bb.localeCompare(aa)||compareEnrollmentPriority(a,b);
  })[0];
  const displayName = employee?.fullName || account?.fullName || account?.email?.split("@")[0] || uiText("employeeFallback");
  const jobTitle=employee?.jobTitle||employee?.position||employee?.title||account?.position||uiText("employeeFallback");
  const department=employee?.department||employee?.departmentName||employee?.division||account?.department||"";
  return `
    <div class="app-layout">${sideNav("employee")}
      <main class="app-main">${topbar(uiText("learner"), displayName, "employee", initials(displayName))}<div class="content">
        <header class="dashboard-welcome employee-greeting">${employeeAvatar(account,employee,"employee-greeting__avatar")}<div class="employee-greeting__identity"><h1>${escapeHtml(greeting(displayName))}</h1><div class="employee-meta-line">${jobTitle!==uiText("employeeFallback")?`<span class="employee-meta-line__title">${escapeHtml(jobTitle)}</span>`:""}${jobTitle!==uiText("employeeFallback")&&department?`<span class="employee-meta-line__divider" aria-hidden="true"></span>`:""}${department?`<span class="employee-meta-line__department">${escapeHtml(department)}</span>`:""}</div><p>${uiText("learningJourney")}</p></div></header>
        ${primary ? continueLearningHero(primary) : `<section class="card continue-empty"><div>${icon("book")}<h2>${uiText("noRecentCourses")}</h2><p>${uiText("noRecentCoursesDesc")}</p></div><a class="btn btn-primary" href="/dashboard/courses" data-link>${uiText("myCourses")}</a></section>`}
        <div class="progress-overview learner-private-stats"><a href="/dashboard/history" data-link class="training-hours-kpi"><span>Số giờ đào tạo<small>Online ${formatTrainingDuration(trainingTime.onlineSeconds,language,true)} · Offline ${formatTrainingDuration(trainingTime.offlineSeconds,language,true)}</small></span><strong>${formatTrainingDuration(trainingTime.totalSeconds,language,true)}</strong></a><a href="/dashboard/courses" data-link><span>Số khóa đang mở</span><strong>${enrollments.filter(item=>item.status!=="completed").length}</strong></a><a href="/dashboard/history" data-link><span>Tổng thời gian học</span><strong>${formatTrainingDuration(trainingTime.totalSeconds,language,true)}</strong></a></div>
        <div class="dashboard-grid"><section class="card panel"><div class="panel-head"><div><h3>${uiText("recentCourses")}</h3></div><a class="btn btn-outline mini-action" href="/dashboard/courses" data-link>${uiText("viewAllCourses")}</a></div>${recent.length ? recent.map(recentCourseRow).join("") : `<div class="empty-state">${icon("book")}<h3>${uiText("noRecentCourses")}</h3><p>${uiText("noRecentCoursesDesc")}</p></div>`}</section><aside class="card panel" id="employee-notifications"><div class="panel-head"><div><h3>${uiText("recentNotifications")}</h3></div><button class="btn btn-outline mini-action" type="button" data-open-notifications>${uiText("viewNotifications")}</button></div>${notifications.slice(0,3).map(notificationRow).join("") || `<div class="empty-state"><p>${uiText("noNotifications")}</p></div>`}</aside></div>
      </div></main>${notificationModal()}
    </div>
  `;
}

function continueLearningHero(enrollment){
  const course=enrollment.course||getCourseById(enrollment.courseId)||{};
  const outline=getCourseContent(enrollment.courseId); const states=getContentProgress(session.accountId,enrollment.courseId);
  const current=outline.find(x=>!states.some(s=>s.contentId===x.id&&s.completed))||outline.at(-1);
  const activeSeconds=states.reduce((sum,x)=>sum+Number(x.activeSeconds||0),0);
  const estimated=Math.max(5,Math.round((Number(course.durationHours||1)*3600*(100-enrollment.progressPercent)/100)/60));
  const image=course.imageUrl?`<img src="${escapeHtmlAttribute(course.imageUrl)}" alt="${escapeHtmlAttribute(course.imageAlt||course.title||"")}">`:`<span class="continue-hero__placeholder">${icon("book")}</span>`;
  return `<section class="card continue-hero"><div class="continue-hero__media">${image}</div><div class="continue-hero__body"><h2>${escapeHtml(course.title||"—")}</h2><p class="continue-hero__lesson">${current?escapeHtml(current.title):uiText("courseIntro")}</p><div class="continue-hero__progress"><span>${uiText("progressLabel")}</span><strong>${enrollment.progressPercent}%</strong>${progress(enrollment.progressPercent)}</div><p class="continue-hero__meta">Còn khoảng ${estimated} phút${enrollment.deadline?` · ${uiText("deadline")} ${escapeHtml(enrollment.deadline)}`:""}</p><div class="continue-hero__actions"><a class="btn btn-primary" href="/dashboard/courses/${escapeHtmlAttribute(enrollment.courseId)}${current?`?content=${encodeURIComponent(current.id)}`:""}" data-link>${uiText("continueLearning")} →</a><a class="btn btn-outline" href="/dashboard/courses/${escapeHtmlAttribute(enrollment.courseId)}" data-link>Xem nội dung</a></div></div></section>`;
}

function employeeEnrollments(){
  // Build a course lookup that includes Supabase cache (covers courses not yet in localStorage)
  const supabaseCourseMap = new Map((_courses||[]).map(c=>[c.id,c]));
  // Use Supabase enrollment cache if available and non-empty, otherwise fall back to localStorage
  const baseEnrollments = (_enrollments && _enrollments.length > 0)
    ? _enrollments.filter(e => e.accountId === session.accountId || e.course_id === undefined)
    : getEnrollmentsByAccountId(session.accountId);
  return baseEnrollments.map(e=>{
    const x=calculateCourseProgress({accountId:session.accountId,courseId:e.courseId});
    const status=x.completed?"completed":x.percent?"inProgress":"notStarted";
    // Resolve course from Supabase cache first, then localStorage
    const course = e.course || supabaseCourseMap.get(e.courseId) || getCourseById(e.courseId) || null;
    return {...e,course,progressPercent:x.percent,status:getDisplayEnrollmentStatus({...e,status}),pendingGrading:x.pendingGrading};
  });
}

function getCurrentEmployeeContext() {
  if (!session?.accountId) return { account: null, employee: null };
  return { account: getAccountById(session.accountId), employee: getEmployeeByAccountId(session.accountId) || null };
}

function hasEmployeeAccess() {
  if (!session?.accountId) return false;
  // Use session.role (set by getValidSession from account.role) as primary check,
  // fall back to localStorage read for safety.
  if (session.role === "employee") return true;
  return getAccountById(session.accountId)?.role === "employee";
}

function compareEnrollmentPriority(a, b) {
  const priority = { overdue: 0, inProgress: 1, notStarted: 2 };
  return (priority[a.status] ?? 9) - (priority[b.status] ?? 9) || String(a.deadline || "9999").localeCompare(String(b.deadline || "9999"));
}

function recentCourseRow(item) {
  const safeProgress = Math.min(100, Math.max(0, Number(item.progressPercent) || 0));
  return `<div class="course-line"><div><strong>${escapeHtml(item.course?.title || "—")}</strong><small>${uiText("deadline")}: ${escapeHtml(item.deadline || "—")}</small>${progress(safeProgress)}</div><div>${badge(item.status)}<br><a href="/dashboard/courses/${escapeHtmlAttribute(item.courseId)}" data-link>${uiText("continueLearning")}</a></div></div>`;
}

function notificationRow(item) {
  return `<div class="task"><strong>${escapeHtml(item.title || "")}</strong><span>${escapeHtml(item.body || "")} · ${escapeHtml(item.createdAt || "")}</span>${item.isRead === false ? `<button type="button" class="btn btn-outline mini-action" data-mark-notification-read="${escapeHtmlAttribute(item.id)}">${uiText("markRead")}</button>` : ""}</div>`;
}
function notificationModal(){if(!notificationModalOpen||!hasEmployeeAccess())return "";const all=getNotifications(session.accountId);const typed=all.filter(n=>notificationFilter==="all"||(notificationFilter==="unread"?!n.isRead:String(n.type||"").includes(notificationFilter)));const pages=Math.max(1,Math.ceil(typed.length/8));notificationPage=Math.min(notificationPage,pages);const rows=typed.slice((notificationPage-1)*8,notificationPage*8);const selected=all.find(n=>n.id===selectedNotificationId)||null;const selectedIndex=typed.findIndex(n=>n.id===selectedNotificationId);return `<div class="modal-backdrop open notification-overlay" data-close-notifications><section class="modal modal--xlarge modal--structured notification-modal" role="dialog" aria-modal="true" aria-labelledby="notification-title"><header class="modal__header"><div><h2 id="notification-title">Thông báo của bạn</h2></div><div class="notification-head-actions"><button class="btn btn-outline" data-mark-all-read ${all.every(n=>n.isRead)?"disabled":""}>Đánh dấu tất cả đã đọc</button><button class="icon-btn" data-close-notifications aria-label="Đóng">×</button></div></header><div class="modal__body"><div class="notification-filters" role="tablist">${[["all","Tất cả"],["unread","Chưa đọc"],["course","Khóa học"],["deadline","Deadline"],["quiz","Quiz"],["result","Kết quả"],["system","Hệ thống"]].map(([v,l])=>`<button role="tab" aria-selected="${notificationFilter===v}" class="${notificationFilter===v?"active":""}" data-notification-filter="${v}">${l}</button>`).join("")}</div>${selected?`<article class="notification-detail"><div class="notification-detail__top"><button class="btn btn-ghost" data-notification-back>← Danh sách</button><div class="notification-detail__pager"><button class="btn btn-outline mini-action" data-notification-prev ${selectedIndex<=0?"disabled":""}>‹</button><button class="btn btn-outline mini-action" data-notification-next ${selectedIndex>=typed.length-1?"disabled":""}>›</button></div></div><span class="badge ${selected.isRead?"active":"pending"}">${selected.isRead?"Đã đọc":"Chưa đọc"}</span><h3>${escapeHtml(selected.title)}</h3><time>${escapeHtml(selected.createdAt)}</time>${selected.senderName?`<p><strong>Người gửi:</strong> ${escapeHtml(selected.senderName)}</p>`:""}<p>${escapeHtml(selected.body)}</p>${selected.attachmentLabel?`<p><strong>Tệp đính kèm:</strong> ${escapeHtml(selected.attachmentLabel)}</p>`:""}${selected.actionUrl?`<div class="hero-actions"><a class="btn btn-primary" href="${escapeHtmlAttribute(selected.actionUrl)}" data-link>Mở nội dung</a></div>`:""}</article>`:`<div class="notification-list">${rows.map(n=>`<button class="notification-item ${n.isRead?"":"unread"}" data-notification-detail="${n.id}"><span class="notification-dot" aria-label="${n.isRead?"Đã đọc":"Chưa đọc"}"></span><span><strong>${escapeHtml(n.title)}</strong><span>${escapeHtml(n.body)}</span><time>${escapeHtml(n.createdAt)}</time></span></button>`).join("")||`<div class="empty-state">Không có thông báo phù hợp.</div>`}</div>`}</div>${!selected?`<footer class="modal__footer"><nav class="pagination"><button data-notification-page="${notificationPage-1}" ${notificationPage<=1?"disabled":""}>‹</button><span>Trang ${notificationPage} / ${pages}</span><button data-notification-page="${notificationPage+1}" ${notificationPage>=pages?"disabled":""}>›</button></nav></footer>`:""}</section></div>`;}

function myCoursesPage() {
  if (!hasEmployeeAccess()) return session ? restrictedPage() : loginPage();
  const account = getAccountById(session.accountId);
  const allEnrollments = employeeEnrollments();
  const filtered = myCourseFilter ? allEnrollments.filter((item) => item.status === myCourseFilter) : allEnrollments;
  const counts = { all: allEnrollments.length };
  ["inProgress", "completed", "notStarted", "overdue"].forEach((status) => { counts[status] = allEnrollments.filter((item) => item.status === status).length; });
  return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar(uiText("learner"), uiText("myCourses"), "employee", initials(account?.fullName || account?.name || ""))}<div class="content"><section class="card panel"><div class="account-toolbar"><div><h2>${uiText("myCourses")}</h2><p>${uiText("courseIntro")}</p></div></div>${myCourseFilterTabs(counts)}${filtered.length ? `<div class="stats-grid">${filtered.map(myCourseCard).join("")}</div>` : myCourseEmptyState()}</section></div></main></div>`;
}

function myCourseFilterTabs(counts) {
  const tabs = [["", "all", counts.all], ["inProgress", "inProgress", counts.inProgress], ["completed", "completed", counts.completed], ["notStarted", "notStarted", counts.notStarted]];
  if (counts.overdue > 0) tabs.push(["overdue", "overdue", counts.overdue]);
  return `<div class="filter-bar">${tabs.map(([value, label, count]) => `<button type="button" class="btn ${myCourseFilter === value ? "btn-primary" : "btn-outline"}" data-my-course-filter="${value}">${uiText(label)} (${count})</button>`).join("")}</div>`;
}

function myCourseCard(enrollment) {
  const course = enrollment.course || {};
  const safeProgress = Math.min(100, Math.max(0, Number(enrollment.progressPercent) || 0));
  const tags = [course.category, course.format, Number.isFinite(Number(course.durationHours)) ? `${Number(course.durationHours)}h` : ""].filter(Boolean);
  const media = course.imageUrl ? `<img class="course-card-image" src="${escapeHtmlAttribute(course.imageUrl)}" alt="${escapeHtmlAttribute(course.title || uiText("myCourses"))}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${icon("book")}</span>` : icon("book");
  let action = `<a class="btn btn-primary" href="/dashboard/courses/${escapeHtmlAttribute(enrollment.courseId)}" data-link>${uiText("startCourse")}</a>`;
  if (enrollment.status === "inProgress" || enrollment.status === "overdue") action = `<a class="btn btn-primary" href="/dashboard/courses/${escapeHtmlAttribute(enrollment.courseId)}" data-link>${uiText("continueLearning")}</a>`;
  if (enrollment.status === "completed") action = `<span>${icon("check")} ${uiText("completedText")}${enrollment.completedAt ? ` · ${uiText("completedOn")} ${escapeHtml(enrollment.completedAt)}` : ""}</span>`;
  return `<article class="card panel">${media}<div class="panel-head"><div><h3>${escapeHtml(course.title || "—")}</h3><p>${tags.map(escapeHtml).join(" · ")}</p></div>${badge(enrollment.status)}</div><p>${uiText("progressLabel")}: <strong>${safeProgress}%</strong></p>${progress(safeProgress)}${enrollment.status !== "completed" && enrollment.deadline ? `<p>${uiText("deadline")}: <strong>${escapeHtml(enrollment.deadline)}</strong></p>` : ""}<div class="security-actions">${action}</div></article>`;
}

function myCourseEmptyState() {
  return `<div class="card empty-state">${icon("book")}<h3>${uiText(myCourseFilter ? "noMatch" : "noCourses")}</h3><p>${uiText(myCourseFilter ? "noMatchDesc" : "noCoursesDesc")}</p></div>`;
}

function coursePlayerPage(courseId){
  if(!hasEmployeeAccess())return session?restrictedPage():loginPage(); const enrollment=employeeEnrollments().find(e=>e.courseId===courseId); if(!enrollment)return restrictedPage(); if(activeQuizAttempt)return quizAttemptPage();
  const course=getCourseById(courseId); const outline=getCourseContent(courseId); const states=getContentProgress(session.accountId,courseId); const attempts=getQuizAttemptsByAccountId(session.accountId); if(!outline.length)return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar(uiText("learner"),course?.title||"","employee")}<div class="content"><div class="empty-state"><h2>${lt("noContent")}</h2></div></div></main></div>`;
  const unlocked=(item,index)=>index===0||outline.slice(0,index).every(prev=>prev.required===false||isContentComplete(prev,states,attempts)); let index=Math.max(0,outline.findIndex(x=>x.id===(activeContentId||states.find(s=>!s.completed)?.contentId))); if(!unlocked(outline[index],index))index=outline.findIndex((x,i)=>unlocked(x,i)&&!isContentComplete(x,states,attempts)); if(index<0)index=outline.length-1; const item=outline[index]; activeContentId=item.id;
  const percent=calculateCourseProgress({accountId:session.accountId,courseId}).percent;
  return `<div class="app-layout learning-shell">${sideNav("employee")}<main class="app-main">${topbar(lt("learning"),course?.title||"","employee")}<div class="learning-notice" role="note">${lt("trackingNotice")}</div><div class="course-player"><aside class="course-outline"><div class="outline-progress"><strong>${percent}%</strong>${progress(percent)}<span>${lt("courseProgress")}</span></div><ol>${outline.map((x,i)=>{const done=isContentComplete(x,states,attempts);const lock=!unlocked(x,i);return `<li><button type="button" data-open-content="${x.id}" ${lock?"disabled":""} class="${x.id===item.id?"active":""}"><span aria-hidden="true">${lock?"🔒":done?"✓":x.type==="slide"?"▤":x.type==="video"?"▶":"?"}</span><span><strong>${escapeHtml(x.title)}</strong><small>${lock?lt("locked"):done?lt("completedLesson"):contentTypeLabel(x.type)}</small></span></button></li>`}).join("")}</ol></aside><section class="lesson-stage" data-course-id="${courseId}" data-content-id="${item.id}"><div class="lesson-heading"><div><h1>${escapeHtml(item.title)}</h1></div><span>${index+1}/${outline.length}</span></div><div id="learning-warning" class="learning-warning" aria-live="polite"></div>${renderLearningContent(item,states.find(x=>x.contentId===item.id),attempts)}<nav class="lesson-nav" aria-label="${lt("lessonNavigation")}"><button class="btn btn-outline" data-course-content-nav="${index-1}" ${index===0?"disabled":""}>${lt("previousLesson")}</button><span id="lesson-requirement">${lessonRequirement(item,states.find(x=>x.contentId===item.id),attempts)}</span><button class="btn btn-primary" data-course-content-nav="${index+1}" ${index===outline.length-1||!isContentComplete(item,states,attempts)?"disabled":""}>${lt("nextLesson")}</button></nav></section></div></main></div>`;
}
function isContentComplete(item,states,attempts){return item.type==="quiz"?attempts.some(a=>a.quizId===item.quizId&&a.submittedAt&&(item.completionRule?.requirePass?a.passed===true:a.gradingStatus!=="pendingManual")):states.some(x=>x.contentId===item.id&&x.completed);}
function contentTypeLabel(type){return lt(type==="slide"?"slideLesson":type==="video"?"videoLesson":"quickQuiz");}
function renderLearningContent(item,state,attempts){if(item.type==="slide"){const slides=item.slides||[];activeSlideIndex=Math.min(activeSlideIndex,Math.max(0,slides.length-1));const slide=slides[activeSlideIndex]||{};const viewed=Number(state?.metadata?.slides?.[slide.id]?.viewedSeconds||0);return `<article class="slide-viewer" data-slide-id="${slide.id}" data-minimum="${slide.minimumViewSeconds||item.minimumDurationSeconds||8}"><div class="slide-canvas" role="img" aria-label="${escapeHtmlAttribute(slide.alt||slide.title||"")}"><span>${activeSlideIndex+1}/${slides.length}</span><h2>${escapeHtml(slide.title||"")}</h2><p>${escapeHtml(slide.content||"")}</p></div><div class="slide-controls"><button class="btn btn-outline" data-slide-nav="${activeSlideIndex-1}" ${activeSlideIndex===0?"disabled":""}>${lt("previous")}</button><span data-slide-timer>${Math.max(0,(slide.minimumViewSeconds||8)-viewed)}s</span><button class="btn btn-primary" data-slide-nav="${activeSlideIndex+1}" ${viewed<(slide.minimumViewSeconds||8)||activeSlideIndex===slides.length-1?"disabled":""}>${lt("next")}</button></div></article>`;}if(item.type==="video"){const m=state?.metadata||{};const transcript=`<details class="transcript"><summary>${lt("transcript")}</summary><p>${escapeHtml(item.transcript||"")}</p>${item.transcriptAlternativeAllowed&&!state?.completed?`<button class="btn btn-outline" data-complete-transcript>${lt("completeViaTranscript")}</button>`:""}</details>`;if(item.sourceType==="youtube")return `<div class="video-frame"><iframe id="youtube-player" src="https://www.youtube.com/embed/${escapeHtmlAttribute(item.youtubeVideoId)}?enablejsapi=1&playsinline=1" title="${escapeHtmlAttribute(item.title)}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div><p class="media-policy">${lt("videoPolicy")}</p>${transcript}`;return `${item.sourceUrl?`<video id="course-video" controls preload="metadata" src="${escapeHtmlAttribute(item.sourceUrl)}"></video>`:`<div class="content-unavailable"><p>Chưa có tài liệu — Liên hệ HR để cập nhật nội dung này.</p></div>`}<p class="media-policy">${lt("videoPolicy")}</p>${transcript}`;}const quiz=getQuizById(item.quizId);const last=attempts.filter(a=>a.quizId===item.quizId&&a.submittedAt).at(-1);return `<div class="integrated-quiz"><h2>${escapeHtml(quiz?.title||item.title)}</h2><p>${escapeHtml(quiz?.description||"")}</p>${last?`<p>${t("quiz.score")}: <strong>${last.scorePercent}%</strong> · ${last.gradingStatus==="pendingManual"?lt("pendingGrading"):t(last.passed?"quiz.passed":"quiz.failed")}</p>`:""}<button class="btn btn-primary" data-quiz-start="${item.quizId}" ${!canStartQuiz({quizId:item.quizId,accountId:session.accountId}).ok?"disabled":""}>${last?t("quiz.retake"):t("quiz.start")}</button></div>`;}
function lessonRequirement(item,state,attempts){if(isContentComplete(item,getContentProgress(session.accountId,item.courseId),attempts))return lt("completedLesson");if(item.type==="slide")return lt("minimumViewing");if(item.type==="video")return lt("videoCompletionRule");return lt("passQuizToContinue");}
function lt(key){return (d().learning||{})[key]||key;}

async function loadApiEmployees({ silent = false } = {}) {
  if (!session || session.role !== "hr" || _apiEmployeesLoading) return;
  _apiEmployeesLoading = true;
  if (!silent) _apiEmployeesError = "";
  try {
    const res = await fetch("/api/employees?pageSize=500", { headers: apiHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "employees_load_failed");
    _apiEmployees = body.items || [];
    _apiEmployeesLoaded = true;
    _apiEmployeesError = "";
  } catch (err) {
    _apiEmployeesError = err.message || "employees_load_failed";
    _apiEmployees = [];
  } finally {
    _apiEmployeesLoading = false;
    if (route === "/admin") render();
  }
}

async function deleteEmployee(employeeId) {
  if (!session || session.role !== "hr") return { ok: false, error: "forbidden" };
  const res = await fetch(`/api/employees/${employeeId}`, {
    method: "DELETE",
    headers: apiHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: body.error || "delete_failed" };
  return { ok: true };
}

async function fetchHrOverview({ silent = false } = {}) {
  if (!session || session.role !== "hr" || _hrOverviewLoading) return;
  _hrOverviewLoading = true;
  if (!silent) _hrOverviewError = "";
  try {
    const res = await fetch("/api/admin/overview", { headers: apiHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "overview_failed");
    _hrOverview = body;
    _hrOverviewLoadedAt = Date.now();
    _hrOverviewError = "";
  } catch (error) {
    _hrOverviewError = error.message || "overview_failed";
  } finally {
    _hrOverviewLoading = false;
    if (route === "/admin") render();
  }
}

// ─── Learning Path API functions ──────────────────────────────────────────────

async function fetchLearningPathList() {
  if (!session || _lpListLoading) return;
  _lpListLoading = true; _lpListError = "";
  try {
    const res = await fetch("/api/admin/learning-paths", { headers: apiHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "load_failed");
    _lpList = body.data || [];
  } catch (e) { _lpListError = e.message || "load_failed"; }
  finally { _lpListLoading = false; if (route === "/admin/learning-paths") render(); }
}

async function fetchLearningPathDetail(lpId) {
  if (!session || _lpDetailLoading) return;
  _lpDetailLoading = true; _lpDetailError = ""; _lpDetailId = lpId;
  try {
    const res = await fetch(`/api/admin/learning-paths/${lpId}`, { headers: apiHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "load_failed");
    _lpDetail = body;
  } catch (e) { _lpDetailError = e.message || "load_failed"; }
  finally { _lpDetailLoading = false; if (route.startsWith("/admin/learning-paths/")) render(); }
}

async function fetchMyLearningPaths() {
  if (!session || _myLpLoading) return;
  _myLpLoading = true; _myLpError = "";
  try {
    const res = await fetch("/api/learning-paths/my", { headers: apiHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "load_failed");
    _myLpList = Array.isArray(body) ? body : [];
  } catch (e) { _myLpError = e.message || "load_failed"; }
  finally { _myLpLoading = false; if (route === "/dashboard/learning-paths") render(); }
}

async function fetchMyLpDetail(assignmentId) {
  if (!session || _lpDetailLoading) return;
  _lpDetailLoading = true; _lpDetailError = ""; _myLpDetailAssignmentId = assignmentId;
  try {
    const res = await fetch(`/api/learning-paths/my/${assignmentId}`, { headers: apiHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "load_failed");
    _myLpDetail = body;
  } catch (e) { _lpDetailError = e.message || "load_failed"; }
  finally { _lpDetailLoading = false; if (route.startsWith("/dashboard/learning-paths/")) render(); }
}

async function lpApiCall(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || "request_failed");
  return data;
}

// ─── Compliance Training API functions ───────────────────────────────────────

async function complianceApiCall(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || "request_failed");
  return data;
}

async function fetchComplianceAdmin() {
  if (!session || _complianceLoading) return;
  _complianceLoading = true; _complianceError = "";
  try {
    const [overview, programs, cycles] = await Promise.all([
      fetch("/api/admin/compliance/overview", { headers: apiHeaders() }).then((r) => r.json().then((b) => ({ ok: r.ok, b }))),
      fetch("/api/admin/compliance/programs", { headers: apiHeaders() }).then((r) => r.json().then((b) => ({ ok: r.ok, b }))),
      fetch("/api/admin/compliance/cycles", { headers: apiHeaders() }).then((r) => r.json().then((b) => ({ ok: r.ok, b }))),
    ]);
    for (const res of [overview, programs, cycles]) if (!res.ok) throw new Error(res.b.error || "load_failed");
    _complianceOverview = overview.b;
    _compliancePrograms = programs.b.data || [];
    _complianceCycles = cycles.b.data || [];
  } catch (e) { _complianceError = e.message || "load_failed"; }
  finally { _complianceLoading = false; if (route.startsWith("/admin/compliance")) render(); }
}

async function fetchComplianceCycleAssignments(cycleId) {
  if (!cycleId) return;
  try {
    const res = await fetch(`/api/admin/compliance/cycles/${cycleId}/assignments`, { headers: apiHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "load_failed");
    _complianceAssignments[cycleId] = body.data || [];
  } catch (e) { _complianceActionError = e.message || "load_failed"; }
  finally { if (route.startsWith("/admin/compliance/cycles/")) render(); }
}

async function fetchMyCompliance() {
  if (!session || _complianceMyLoading) return;
  _complianceMyLoading = true; _complianceError = "";
  try {
    const res = await fetch("/api/compliance/my", { headers: apiHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "load_failed");
    _complianceMy = body.data || [];
  } catch (e) { _complianceError = e.message || "load_failed"; }
  finally { _complianceMyLoading = false; if (route === "/dashboard/compliance") render(); }
}

async function fetchMyComplianceDetail(assignmentId) {
  if (!session || _complianceMyLoading) return;
  _complianceMyLoading = true; _complianceError = "";
  try {
    const res = await fetch(`/api/compliance/my/${assignmentId}`, { headers: apiHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "load_failed");
    _complianceMyDetail = body;
  } catch (e) { _complianceError = e.message || "load_failed"; }
  finally { _complianceMyLoading = false; if (route.startsWith("/dashboard/compliance/")) render(); }
}

function complianceStatusLabel(status) {
  const labels = {
    vi: { draft: "Nháp", published: "Đã công bố", archived: "Lưu trữ", active: "Đang hoạt động", scheduled: "Đã lên lịch", closed: "Đã đóng", cancelled: "Đã hủy", not_started: "Chưa bắt đầu", in_progress: "Đang học", completed: "Hoàn thành", overdue: "Quá hạn", failed: "Không đạt", exempted: "Miễn trừ" },
    en: { draft: "Draft", published: "Published", archived: "Archived", active: "Active", scheduled: "Scheduled", closed: "Closed", cancelled: "Cancelled", not_started: "Not started", in_progress: "In progress", completed: "Completed", overdue: "Overdue", failed: "Failed", exempted: "Exempted" },
    kr: { draft: "초안", published: "공개됨", archived: "보관됨", active: "진행 중", scheduled: "예약됨", closed: "종료됨", cancelled: "취소됨", not_started: "시작 전", in_progress: "학습 중", completed: "완료", overdue: "기한 초과", failed: "불합격", exempted: "면제" },
  };
  return labels[language]?.[status] || labels.vi[status] || status || "—";
}

function complianceBadge(status) {
  const cls = ({ completed: "success", published: "active", active: "active", in_progress: "active", overdue: "danger", failed: "danger", exempted: "muted", archived: "muted", cancelled: "muted" })[status] || "pending";
  return `<span class="badge ${cls}">${complianceStatusLabel(status)}</span>`;
}

function complianceResourceTitle(item) {
  const type = item.resourceType || item.resource_type;
  const id = item.resourceId || item.resource_id;
  if (type === "course") return (_courses || []).find((c) => c.id === id)?.title || id;
  if (type === "learning_path") return (_lpList || []).find((p) => p.id === id)?.title || id;
  return id || "—";
}

function adminCompliancePage() {
  if (!hasAdminAccess()) return restrictedPage();
  const c = t("compliance");
  const programs = _compliancePrograms || [];
  const cycles = _complianceCycles || [];
  const overview = _complianceOverview || {};
  const kpis = [
    [c.activePrograms || "Active programs", overview.activePrograms ?? "—"],
    [c.assignedEmployees || "Assigned employees", overview.assignedEmployees ?? "—"],
    [c.completedOnTime || "Completed on time", overview.completedOnTime ?? "—"],
    [c.overdue, overview.overdue ?? "—"],
    [c.failed, overview.failed ?? "—"],
    [c.dueSoon || "Due soon", overview.dueSoon ?? "—"],
  ].map(([label, value]) => `<div class="compliance-kpi"><span>${label}</span><strong>${value}</strong></div>`).join("");

  const rows = programs.map((p) => {
    const activeCycle = cycles.find((c) => c.programId === p.id && c.status === "active");
    return `<tr>
      <td><strong>${escapeHtml(p.code)}</strong><small>${escapeHtml(p.title)}</small></td>
      <td>${escapeHtml(complianceResourceTitle(p))}</td>
      <td>${escapeHtml(p.recurrenceType || "one_time")}</td>
      <td>${complianceBadge(p.status)}</td>
      <td>${activeCycle ? `<a href="/admin/compliance/cycles/${activeCycle.id}" data-link>${escapeHtml(activeCycle.title)}</a>` : "—"}</td>
      <td>${p.updatedAt ? formatDateTime(p.updatedAt) : "—"}</td>
    </tr>`;
  }).join("");

  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D",c.title,"hr")}<div class="content route-content">
    <section class="compliance-head"><div><h1>${c.title}</h1><p>${c.adminIntro || "Manage compliance programs, cycles, targets, and completion evidence."}</p></div>
      <div class="compliance-actions"><button class="btn btn-outline" data-compliance-reload>${c.retry}</button><button class="btn btn-primary" data-compliance-new-program>${c.createProgram || "Create program"}</button></div></section>
    ${_complianceError ? `<div class="card empty-state"><p>${c.loadError}</p><button class="btn btn-outline" data-compliance-reload>${c.retry}</button></div>` : ""}
    ${_complianceLoading && !programs.length ? `<div class="hr-overview-skeleton">${Array(6).fill("<span></span>").join("")}</div>` : `<section class="compliance-kpi-grid">${kpis}</section>`}
    <section class="card compliance-panel"><div class="panel-head"><h2>${c.program}</h2><button class="btn btn-primary" data-compliance-new-cycle ${programs.some((p) => p.status === "published") ? "" : "disabled"}>${c.createCycle || "Create cycle"}</button></div>
      ${programs.length ? `<div class="table-wrap"><table><thead><tr><th>${c.codeName || "Code / title"}</th><th>Resource</th><th>${c.recurrence}</th><th>${c.status || "Status"}</th><th>${c.activeCycle || "Active cycle"}</th><th>${c.updated || "Updated"}</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty-state"><h3>${c.emptyPrograms}</h3></div>`}
    </section>
    <section class="compliance-cycle-grid">${cycles.slice(0, 8).map((cy) => `<article class="card compliance-cycle-card"><div><h3>${escapeHtml(cy.title)}</h3><p>${escapeHtml(cy.cycleCode)} · ${escapeHtml(cy.program?.code || "")}</p></div>${complianceBadge(cy.status)}<dl><div><dt>${c.deadline}</dt><dd>${new Date(cy.dueAt).toLocaleDateString(language==="kr"?"ko-KR":language==="en"?"en-US":"vi-VN")}</dd></div><div><dt>${c.passScore}</dt><dd>${cy.passScore || "—"}</dd></div></dl><a class="btn btn-outline" href="/admin/compliance/cycles/${cy.id}" data-link>${c.monitor || "Monitor"}</a></article>`).join("")}</section>
    ${complianceProgramModal()}${complianceCycleModal()}
  </div></main></div>`;
}

function complianceProgramModal() {
  if (!_complianceProgramFormOpen) return "";
  const c = t("compliance");
  const courses = (_courses || []).filter((c) => c.status === "published");
  const paths = (_lpList || []).filter((p) => p.status === "published");
  return `<div class="modal-backdrop open"><form id="complianceProgramForm" class="modal modal--large modal--structured" role="dialog" aria-modal="true">
    <header class="modal__header"><div><h2>${c.createProgram || "Create program"}</h2></div><button type="button" class="icon-btn" data-compliance-close>×</button></header>
    <div class="modal__body">
      <div class="form-2col"><div class="field"><label>${c.programCode || "Program code"}</label><input name="code" required placeholder="AML-2026"></div><div class="field"><label>${c.programName || "Program name"}</label><input name="title" required></div></div>
      <div class="field"><label>${c.description || "Description"}</label><textarea name="description" rows="3"></textarea></div>
      <div class="form-2col"><div class="field"><label>Resource type</label><select name="resourceType"><option value="course">${c.course || "Course"}</option><option value="learning_path">${c.learningPath || "Learning Path"}</option></select></div><div class="field"><label>${c.resource || "Resource"}</label><select name="resourceId">${courses.map((course) => `<option value="${escapeHtmlAttribute(course.id)}">${escapeHtml(course.title || course.id)}</option>`).join("")}${paths.map((p) => `<option value="${escapeHtmlAttribute(p.id)}" data-kind="learning_path">${escapeHtml(p.title || p.id)}</option>`).join("")}</select></div></div>
      <div class="form-2col"><div class="field"><label>${c.recurrence}</label><select name="recurrenceType"><option value="one_time">${c.oneTime || "One-time"}</option><option value="annual">${c.annual || "Annual"}</option><option value="semiannual">${c.semiannual || "Semiannual"}</option><option value="custom_months">${c.customMonths || "Custom months"}</option></select></div><div class="field"><label>${c.defaultDuration || "Default duration (days)"}</label><input name="defaultDurationDays" type="number" min="1" value="30"></div></div>
      <div class="form-2col"><div class="field"><label>${c.passScore}</label><input name="defaultPassScore" type="number" min="0" max="100" value="0"></div><div class="field"><label>${c.attempts}</label><input name="defaultMaxAttempts" type="number" min="0" value="0"></div></div>
      <div class="form-2col"><div class="field"><label>${c.gracePeriod}</label><input name="defaultGracePeriodDays" type="number" min="0" value="0"></div><label class="setting-row"><span>${c.retrainOnChange || "Retrain when resource changes"}</span><input name="requiresRetrainingOnResourceChange" type="checkbox"></label></div>
      <div class="field"><label>${c.target || "Target"}</label><select name="targetType"><option value="individual">${c.targetIndividual}</option><option value="all_employees">${c.targetAll}</option><option value="department">${c.targetDepartment}</option><option value="job_title">${c.targetJobTitle}</option></select></div>
      <div class="field"><label>Target value</label><input name="targetValue" placeholder="employee id / phòng ban / chức danh"></div>
      <div class="field-error" role="alert">${escapeHtml(_complianceActionError)}</div>
    </div>
    <footer class="modal__footer"><button type="button" class="btn btn-outline" data-compliance-close>${t("content.cancel")}</button><button class="btn btn-primary">${c.createProgram || "Create program"}</button></footer>
  </form></div>`;
}

function complianceCycleModal() {
  if (!_complianceCycleFormOpen) return "";
  const c = t("compliance");
  const programs = (_compliancePrograms || []).filter((p) => p.status === "published");
  return `<div class="modal-backdrop open"><form id="complianceCycleForm" class="modal modal--large modal--structured" role="dialog" aria-modal="true">
    <header class="modal__header"><div><h2>${c.createCycle || "Create cycle"}</h2></div><button type="button" class="icon-btn" data-compliance-cycle-close>×</button></header>
    <div class="modal__body">
      <div class="field"><label>${c.program}</label><select name="programId">${programs.map((p) => `<option value="${escapeHtmlAttribute(p.id)}">${escapeHtml(p.code)} — ${escapeHtml(p.title)}</option>`).join("")}</select></div>
      <div class="form-2col"><div class="field"><label>${c.cycleCode || "Cycle code"}</label><input name="cycleCode" required placeholder="AML-2026"></div><div class="field"><label>${c.cycle}</label><input name="title" required></div></div>
      <div class="form-2col"><div class="field"><label>${c.startDate || "Start date"}</label><input name="startAt" type="datetime-local" required></div><div class="field"><label>${c.deadline}</label><input name="dueAt" type="datetime-local" required></div></div>
      <div class="form-2col"><div class="field"><label>${c.passScore}</label><input name="passScore" type="number" min="0" max="100"></div><div class="field"><label>${c.attempts}</label><input name="maxAttempts" type="number" min="0"></div></div>
      <div class="field-error" role="alert">${escapeHtml(_complianceActionError)}</div>
    </div>
    <footer class="modal__footer"><button type="button" class="btn btn-outline" data-compliance-cycle-close>${t("content.cancel")}</button><button class="btn btn-primary">${c.createCycle || "Create cycle"}</button></footer>
  </form></div>`;
}

function adminComplianceCyclePage() {
  if (!hasAdminAccess()) return restrictedPage();
  const c = t("compliance");
  const cycleId = route.split("/")[4];
  const cycle = (_complianceCycles || []).find((c) => c.id === cycleId);
  const assignments = _complianceAssignments[cycleId] || [];
  if (!cycle) return `<div class="app-layout">${sideNav("hr")}<main class="app-main"><div class="content"><div class="hr-overview-skeleton">${Array(5).fill("<span></span>").join("")}</div></div></main></div>`;
  const counts = ["not_started", "in_progress", "completed", "overdue", "failed", "exempted"].map((s) => [s, assignments.filter((a) => a.status === s).length]);
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D",cycle.title,"hr")}<div class="content route-content">
    <a href="/admin/compliance" data-link class="btn btn-ghost">← ${c.title}</a>
    <section class="compliance-head"><div><h1>${escapeHtml(cycle.title)}</h1><p>${escapeHtml(cycle.cycleCode)} · ${c.deadline} ${new Date(cycle.dueAt).toLocaleDateString(language==="kr"?"ko-KR":language==="en"?"en-US":"vi-VN")}</p></div><div class="compliance-actions">${complianceBadge(cycle.status)}<button class="btn btn-outline" data-compliance-preview="${escapeHtmlAttribute(cycle.id)}">${c.preview || "Preview target"}</button><button class="btn btn-primary" data-compliance-activate="${escapeHtmlAttribute(cycle.id)}">${c.activateAssign || "Activate & assign"}</button></div></section>
    ${_compliancePreview ? `<section class="card compliance-preview"><strong>${_compliancePreview.willCreate} assignment mới</strong><span>${_compliancePreview.alreadyAssigned} đã tồn tại</span><span>${_compliancePreview.totalMatched} nhân viên phù hợp</span></section>` : ""}
    <section class="compliance-kpi-grid">${counts.map(([s, n]) => `<div class="compliance-kpi"><span>${complianceStatusLabel(s)}</span><strong>${n}</strong></div>`).join("")}</section>
    <section class="card compliance-panel"><div class="panel-head"><h2>${c.assignmentMonitoring || "Assignment monitoring"}</h2><button class="btn btn-outline" data-compliance-load-assignments="${escapeHtmlAttribute(cycle.id)}">${c.retry}</button></div>
      <div class="table-wrap"><table><thead><tr><th>${c.employee || "Employee"}</th><th>${c.targetDepartment}</th><th>${c.targetJobTitle}</th><th>${c.progress || "Progress"}</th><th>${c.deadline}</th><th>${c.status || "Status"}</th><th>Action</th></tr></thead><tbody>${assignments.map((a) => `<tr><td>${escapeHtml(a.data?.employeeName || a.employeeId)}</td><td>${escapeHtml(a.data?.department || "—")}</td><td>${escapeHtml(a.data?.jobTitle || "—")}</td><td>${a.progressPercent}%</td><td>${new Date(a.dueAt).toLocaleDateString(language==="kr"?"ko-KR":language==="en"?"en-US":"vi-VN")}</td><td>${complianceBadge(a.status)}</td><td><button class="btn btn-outline mini-action" data-compliance-exempt="${escapeHtmlAttribute(a.id)}">${c.exempt}</button><button class="btn btn-outline mini-action" data-compliance-manual="${escapeHtmlAttribute(a.id)}">${c.manualComplete}</button></td></tr>`).join("") || `<tr><td colspan="7">${c.emptyTargets}</td></tr>`}</tbody></table></div>
    </section>
  </div></main></div>`;
}

function myCompliancePage() {
  if (!hasEmployeeAccess()) return session ? restrictedPage() : loginPage();
  const labels = t("compliance");
  const items = (_complianceMy || []).slice().sort((a, b) => {
    const rank = { overdue: 0, in_progress: 1, not_started: 2, failed: 3, completed: 4, exempted: 5 };
    return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || new Date(a.dueAt) - new Date(b.dueAt);
  });
  const card = (a) => {
    const cy = a.cycle || {};
    const p = cy.program || {};
    const days = Math.ceil((new Date(a.dueAt).getTime() - Date.now()) / 86400000);
    const cta = a.status === "completed" ? labels.viewResult : a.status === "not_started" ? labels.start : labels.continue;
    const dayText = days < 0 ? `${labels.overdue} ${Math.abs(days)}` : days === 0 ? labels.dueToday : `${labels.daysLeft || "Days left"} ${days}`;
    return `<article class="card compliance-my-card ${a.status === "overdue" ? "is-overdue" : ""}"><div><h2>${escapeHtml(p.title || cy.title || labels.title)}</h2><p>${escapeHtml(cy.title || "")}</p>${lpProgressBar(a.progressPercent || 0, true)}<div class="lp-my-meta"><span>${complianceBadge(a.status)}</span><span>${dayText}</span></div></div><a class="btn btn-primary" href="/dashboard/compliance/${a.id}" data-link>${cta}</a></article>`;
  };
  return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar(t("learning.learning"),labels.title,"employee")}<div class="content route-content"><section class="compliance-head"><div><h1>${labels.title}</h1><p>${labels.employeeIntro || "Track mandatory compliance items and deadlines."}</p></div><button class="btn btn-outline" data-my-compliance-reload>${labels.retry}</button></section>${_complianceError ? `<div class="card empty-state"><p>${labels.loadError}</p></div>` : ""}${_complianceMyLoading && !items.length ? `<div class="hr-overview-skeleton">${Array(4).fill("<span></span>").join("")}</div>` : items.length ? `<div class="lp-my-grid">${items.map(card).join("")}</div>` : `<div class="card empty-state"><h3>${labels.emptyEmployee}</h3></div>`}</div></main></div>`;
}

function myComplianceDetailPage() {
  if (!hasEmployeeAccess()) return session ? restrictedPage() : loginPage();
  const labels = t("compliance");
  const assignmentId = route.split("/")[3];
  const detail = _complianceMyDetail;
  if (_complianceMyLoading || !detail?.assignment || detail.assignment.id !== assignmentId) return `<div class="app-layout">${sideNav("employee")}<main class="app-main"><div class="content"><div class="hr-overview-skeleton">${Array(5).fill("<span></span>").join("")}</div></div></main></div>`;
  const a = detail.assignment, cy = a.cycle || {}, p = cy.program || {};
  const target = cy.resourceType === "course" ? `/dashboard/courses/${cy.resourceId}` : `/dashboard/learning-paths`;
  return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar(t("learning.learning"),p.title || labels.title,"employee")}<div class="content route-content"><a href="/dashboard/compliance" data-link class="btn btn-ghost">← ${labels.title}</a><section class="card compliance-detail"><div class="panel-head"><div><h1>${escapeHtml(p.title || labels.title)}</h1><p>${escapeHtml(cy.title || "")}</p></div>${complianceBadge(a.status)}</div><dl class="compliance-detail-grid"><div><dt>${labels.reason}</dt><dd>${escapeHtml(p.description || labels.mandatory)}</dd></div><div><dt>${labels.deadline}</dt><dd>${new Date(a.dueAt).toLocaleDateString(language==="kr"?"ko-KR":language==="en"?"en-US":"vi-VN")}</dd></div><div><dt>${labels.gracePeriod}</dt><dd>${a.graceUntil ? new Date(a.graceUntil).toLocaleDateString(language==="kr"?"ko-KR":language==="en"?"en-US":"vi-VN") : "—"}</dd></div><div><dt>Resource</dt><dd>${escapeHtml(complianceResourceTitle(cy))}</dd></div><div><dt>${labels.passScore}</dt><dd>${cy.passScore || "—"}</dd></div><div><dt>${labels.attempts}</dt><dd>${a.attemptCount || 0}${cy.maxAttempts ? ` / ${cy.maxAttempts}` : ""}</dd></div></dl>${lpProgressBar(a.progressPercent || 0)}<div class="compliance-actions"><button class="btn btn-outline" data-compliance-start="${escapeHtmlAttribute(a.id)}">${labels.start || "Start"}</button><a class="btn btn-primary" href="${escapeHtmlAttribute(target)}" data-link>${labels.goToResource || "Go to resource"}</a><button class="btn btn-outline" data-compliance-sync="${escapeHtmlAttribute(a.id)}">${labels.sync || "Sync result"}</button></div>${_complianceActionError ? `<p class="field-error" role="alert">${escapeHtml(_complianceActionError)}</p>` : ""}<h2>${labels.completion}</h2>${(detail.completionRecords || []).map((r) => `<div class="compliance-record"><strong>${escapeHtml(r.completion_source)}</strong><span>${formatDateTime(r.completed_at)} · ${r.was_completed_on_time ? (labels.onTime || "On time") : (labels.late || "Late")}</span></div>`).join("") || `<div class="empty-state">${labels.noEvidence || "No completion evidence yet."}</div>`}</section></div></main></div>`;
}

// ─── HR Learning Path Pages ───────────────────────────────────────────────────

function lpStatusBadge(status) {
  const map = { draft: "pending", published: "active", archived: "muted",
    not_started: "pending", in_progress: "active", completed: "success",
    overdue: "danger", cancelled: "muted" };
  const lk = {
    draft: t("lp.statusDraft"), published: t("lp.statusPublished"), archived: t("lp.statusArchived"),
    not_started: t("lp.statusNotStarted"), in_progress: t("lp.statusInProgress"),
    completed: t("lp.statusCompleted"), overdue: t("lp.statusOverdue"), cancelled: t("lp.statusCancelled"),
  };
  return `<span class="badge ${map[status] || "pending"}">${lk[status] || status}</span>`;
}

function lpStepTypeBadge(type) {
  const lk = { course: t("lp.stepTypeCourse"), quiz: t("lp.stepTypeQuiz"),
    training_session: t("lp.stepTypeSession"), document: t("lp.stepTypeDoc"), external_link: t("lp.stepTypeLink") };
  return `<span class="badge active">${lk[type] || type}</span>`;
}

function adminLearningPathsPage() {
  if (!hasAdminAccess()) return restrictedPage();
  const lp = t("lp");
  const paths = _lpList || [];
  const rows = paths.map((p) => `
    <tr>
      <td><a href="/admin/learning-paths/${p.id}" data-link><strong>${escapeHtml(p.title)}</strong></a></td>
      <td>${lpStatusBadge(p.status)}</td>
      <td>${p.stepCount ?? 0}</td>
      <td>${p.estimatedDurationMinutes ? p.estimatedDurationMinutes + " phút" : "—"}</td>
      <td>${p.assignmentCount ?? 0}</td>
      <td>${p.completionRate ?? 0}%</td>
      <td>${p.updatedAt ? formatDateTime(p.updatedAt) : "—"}</td>
      <td>
        <a class="btn btn-outline mini-action" href="/admin/learning-paths/${p.id}" data-link>Xem</a>
      </td>
    </tr>`).join("");

  return `<div class="app-layout">
    ${sideNav("hr")}
    <main class="app-main">
      <div class="content">
        <div class="panel-head">
          <div>
            <h1>${lp.title}</h1>
            <p>Tạo và quản lý lộ trình học tập, giao cho nhân viên và theo dõi tiến độ.</p>
          </div>
          <button class="btn btn-primary" data-lp-create>${lp.create}</button>
        </div>
        ${_lpListError ? `<div class="card empty-state"><p>${escapeHtml(_lpListError)}</p><button class="btn btn-outline" data-lp-reload>${lp.retry}</button></div>` : ""}
        ${_lpListLoading && !paths.length ? `<div class="hr-overview-skeleton">${Array(4).fill("<span></span>").join("")}</div>` : ""}
        ${!_lpListLoading && !_lpListError && !paths.length ? `<div class="card empty-state"><h3>${lp.noPaths}</h3><button class="btn btn-primary" data-lp-create>${lp.create}</button></div>` : ""}
        ${paths.length ? `<div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Tên lộ trình</th><th>Trạng thái</th><th>Số bước</th><th>Thời lượng</th><th>Đã giao</th><th>Hoàn thành</th><th>Cập nhật</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div></div>` : ""}
        ${lpCreateModal()}
      </div>
    </main>
  </div>`;
}

function lpCreateModal() {
  if (_lpFormMode !== "create" && _lpFormMode !== "edit") return "";
  const isEdit = _lpFormMode === "edit";
  const lp = t("lp");
  return `<div class="modal-backdrop open"><form id="lpForm" class="modal modal--large modal--structured" role="dialog" aria-modal="true">
    <header class="modal__header"><div><h2>${isEdit ? lp.edit : lp.create}</h2></div>
      <button type="button" class="icon-btn" data-lp-form-close>×</button></header>
    <div class="modal__body">
      <div class="field"><label>${lp.name} *</label>
        <input name="title" required value="${escapeHtmlAttribute(_lpFormData.title || "")}"></div>
      <div class="field"><label>${lp.desc}</label>
        <textarea name="description" rows="3">${escapeHtml(_lpFormData.description || "")}</textarea></div>
      <div class="form-2col">
        <div class="field"><label>${lp.mode}</label>
          <select name="completion_mode">
            <option value="sequential" ${(_lpFormData.completion_mode || "sequential") === "sequential" ? "selected" : ""}>${lp.sequential}</option>
            <option value="flexible" ${_lpFormData.completion_mode === "flexible" ? "selected" : ""}>${lp.flexible}</option>
          </select></div>
        <div class="field"><label>${lp.estimatedDuration}</label>
          <input name="estimated_duration_minutes" type="number" min="0" value="${_lpFormData.estimated_duration_minutes || ""}"></div>
      </div>
      <div class="field-error" data-lp-form-error role="alert"></div>
    </div>
    <footer class="modal__footer">
      <button type="button" class="btn btn-outline" data-lp-form-close>${t("content.cancel")}</button>
      <button type="submit" class="btn btn-primary">${isEdit ? "Lưu" : lp.create}</button>
    </footer>
  </form></div>`;
}

function adminLearningPathDetailPage() {
  if (!hasAdminAccess()) return restrictedPage();
  const lpId = route.split("/")[3];
  const lp = t("lp");

  if (_lpDetailLoading && !_lpDetail) return `<div class="app-layout">${sideNav("hr")}<main class="app-main"><div class="content"><div class="hr-overview-skeleton">${Array(6).fill("<span></span>").join("")}</div></div></main></div>`;
  if (_lpDetailError) return `<div class="app-layout">${sideNav("hr")}<main class="app-main"><div class="content"><div class="card empty-state"><p>${escapeHtml(_lpDetailError)}</p><button class="btn btn-outline" onclick="fetchLearningPathDetail('${escapeHtmlAttribute(lpId)}');render()">${lp.retry}</button></div></div></main></div>`;
  if (!_lpDetail || _lpDetail.id !== lpId) return `<div class="app-layout">${sideNav("hr")}<main class="app-main"><div class="content"><div class="hr-overview-skeleton">${Array(6).fill("<span></span>").join("")}</div></div></main></div>`;

  const path = _lpDetail;
  const steps = path.steps || [];

  const stepsHtml = steps.length ? steps.map((s, i) => {
    const title = s.title_override || s.resource_id || `Bước ${i + 1}`;
    return `<div class="lp-step-row" data-step-id="${escapeHtmlAttribute(s.id)}">
      <span class="lp-step-num">${s.position + 1}</span>
      <div class="lp-step-body">
        <strong>${escapeHtml(title)}</strong>
        <span class="lp-step-meta">${lpStepTypeBadge(s.step_type)} ${s.is_required ? `<span class="badge active">${lp.required}</span>` : `<span class="badge muted">${lp.optional}</span>`}</span>
        ${s.prerequisite_step_id ? `<small>Tiên quyết: bước trước</small>` : ""}
      </div>
      <div class="lp-step-actions">
        ${path.status === "draft" ? `
          <button class="btn btn-outline mini-action" data-lp-step-up="${escapeHtmlAttribute(s.id)}" ${i === 0 ? "disabled" : ""}>${lp.moveUp}</button>
          <button class="btn btn-outline mini-action" data-lp-step-down="${escapeHtmlAttribute(s.id)}" ${i === steps.length - 1 ? "disabled" : ""}>${lp.moveDown}</button>
          <button class="btn btn-outline mini-action" data-lp-step-delete="${escapeHtmlAttribute(s.id)}">${lp.removeStep}</button>` : ""}
      </div>
    </div>`;
  }).join("") : `<div class="empty-state"><p>${lp.noSteps}</p></div>`;

  return `<div class="app-layout">
    ${sideNav("hr")}
    <main class="app-main">
      <div class="content">
        <div class="panel-head">
          <div>
            <a href="/admin/learning-paths" data-link class="btn btn-ghost">← ${lp.title}</a>
            <h1>${escapeHtml(path.title)}</h1>
            ${lpStatusBadge(path.status)}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${path.status === "draft" ? `<button class="btn btn-outline" data-lp-edit>Sửa</button>` : ""}
            ${path.status === "draft" ? `<button class="btn btn-primary" data-lp-publish="${escapeHtmlAttribute(path.id)}">${lp.publish}</button>` : ""}
            ${path.status === "published" ? `<button class="btn btn-outline" data-lp-assign="${escapeHtmlAttribute(path.id)}">${lp.assign}</button>` : ""}
            ${path.status === "published" ? `<button class="btn btn-outline" data-lp-archive="${escapeHtmlAttribute(path.id)}">${lp.archive}</button>` : ""}
          </div>
        </div>

        <div class="admin-col-layout">
          <div style="flex:2;min-width:0">
            <div class="card">
              <div class="panel-head"><h3>${lp.steps} (${steps.length})</h3>
                ${path.status === "draft" ? `<button class="btn btn-primary" data-lp-add-step>${lp.addStep}</button>` : ""}
              </div>
              <div class="lp-steps-list">${stepsHtml}</div>
            </div>
            ${path.status !== "draft" ? lpAssignmentsSummary(path.id) : ""}
          </div>
          <aside style="flex:1;min-width:220px">
            <div class="card">
              <h3>Thông tin</h3>
              <div class="profile-grid">
                <div class="profile-item"><span>Mô tả</span><strong>${escapeHtml(path.description || "—")}</strong></div>
                <div class="profile-item"><span>Chế độ học</span><strong>${path.completion_mode === "flexible" ? lp.flexible : lp.sequential}</strong></div>
                <div class="profile-item"><span>Thời lượng</span><strong>${path.estimated_duration_minutes ? path.estimated_duration_minutes + " phút" : "—"}</strong></div>
                <div class="profile-item"><span>Số bước</span><strong>${steps.length}</strong></div>
                <div class="profile-item"><span>Tạo lúc</span><strong>${path.created_at ? formatDateTime(path.created_at) : "—"}</strong></div>
                ${path.published_at ? `<div class="profile-item"><span>Công bố lúc</span><strong>${formatDateTime(path.published_at)}</strong></div>` : ""}
              </div>
            </div>
          </aside>
        </div>
        ${lpAddStepModal(path.id, steps)}
        ${lpAssignModal(path.id)}
        ${lpCreateModal()}
      </div>
    </main>
  </div>`;
}

function lpAssignmentsSummary(lpId) {
  return `<div class="card" style="margin-top:16px">
    <div class="panel-head"><h3>Tiến độ nhân viên</h3>
      <a class="btn btn-outline mini-action" href="/admin/learning-paths/${lpId}/assignments" data-link>Xem tất cả →</a>
    </div>
    <p style="color:var(--color-muted);font-size:.85em">Nhấn "Xem tất cả" để xem danh sách đầy đủ và lọc theo trạng thái.</p>
  </div>`;
}

function lpAddStepModal(pathId, existingSteps) {
  if (!_lpAddStepOpen) return "";
  const lp = t("lp");
  const courses = (_courses || []).filter((c) => c.status === "published");
  const quizzes = (window._quizzesCache || []).filter((q) => q.status === "published");
  const sessions = (window._sessionsCache || []).filter((s) => s.status === "scheduled" || s.status === "ongoing");

  const stepTypes = [
    { v: "course", l: lp.stepTypeCourse },
    { v: "quiz", l: lp.stepTypeQuiz },
    { v: "training_session", l: lp.stepTypeSession },
  ];

  const resourceList = _lpAddStepType === "course" ? courses
    : _lpAddStepType === "quiz" ? quizzes : sessions;

  const filtered = resourceList.filter((r) => {
    const title = r.title || r.data?.title || r.data?.name || r.id;
    return !_lpStepPickSearch || title.toLowerCase().includes(_lpStepPickSearch.toLowerCase());
  });

  return `<div class="modal-backdrop open"><section class="modal modal--large modal--structured" role="dialog" aria-modal="true">
    <header class="modal__header"><div><h2>${lp.addStep}</h2></div>
      <button type="button" class="icon-btn" data-lp-add-step-close>×</button></header>
    <div class="modal__body">
      <div class="field"><label>${lp.stepType}</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${stepTypes.map((st) => `<button type="button" class="btn ${_lpAddStepType === st.v ? "btn-primary" : "btn-outline"} mini-action" data-lp-step-type="${st.v}">${st.l}</button>`).join("")}
        </div>
      </div>
      <div class="field"><input id="lpStepSearch" placeholder="${t("admin.search")}" value="${escapeHtmlAttribute(_lpStepPickSearch)}" data-lp-step-search autocomplete="off"></div>
      <div style="max-height:300px;overflow-y:auto">
        ${filtered.length ? filtered.map((r) => {
          const title = r.title || r.data?.title || r.data?.name || r.id;
          const already = existingSteps.some((s) => s.resource_id === r.id && s.step_type === _lpAddStepType);
          return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="flex:1;min-width:0"><strong>${escapeHtml(title)}</strong></div>
            ${already ? `<span class="badge muted">Đã thêm</span>` : `<button type="button" class="btn btn-primary mini-action" data-lp-step-pick="${escapeHtmlAttribute(r.id)}" data-lp-step-pick-title="${escapeHtmlAttribute(title)}">${t("contentType.select")}</button>`}
          </div>`;
        }).join("") : `<p style="color:var(--color-muted);text-align:center;padding:16px">${lp.noSteps}</p>`}
      </div>
    </div>
    <footer class="modal__footer"><button type="button" class="btn btn-outline" data-lp-add-step-close>${t("content.cancel")}</button></footer>
  </section></div>`;
}

function lpAssignModal(pathId) {
  if (!_lpAssignOpen) return "";
  const lp = t("lp");
  const employees = _apiEmployees || [];
  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))];
  const positions = [...new Set(employees.map((e) => e.position).filter(Boolean))];

  let previewHtml = "";
  if (_lpPreviewLoading) previewHtml = `<div class="hr-overview-skeleton">${Array(3).fill("<span></span>").join("")}</div>`;
  else if (_lpPreviewData) {
    const { will_create, already_assigned, employees: empList } = _lpPreviewData;
    previewHtml = `<div class="card" style="margin-top:12px;padding:12px">
      <p>${lp.willCreate.replace("{n}", will_create)}</p>
      ${already_assigned > 0 ? `<p style="color:var(--color-muted)">${lp.alreadyAssigned.replace("{n}", already_assigned)}</p>` : ""}
      <div style="max-height:200px;overflow-y:auto;margin-top:8px">
        ${(empList || []).filter((e) => !e.already_assigned).slice(0, 20).map((e) =>
          `<div style="font-size:.85em;padding:4px 0;border-bottom:1px solid var(--border)">${escapeHtml(e.full_name)} · ${escapeHtml(e.department || "—")}</div>`
        ).join("")}
        ${will_create > 20 ? `<p style="color:var(--color-muted);font-size:.8em">… và ${will_create - 20} người nữa</p>` : ""}
      </div>
    </div>`;
  }

  return `<div class="modal-backdrop open"><form id="lpAssignForm" class="modal modal--large modal--structured" role="dialog" aria-modal="true">
    <header class="modal__header"><div><h2>${lp.assign}</h2></div>
      <button type="button" class="icon-btn" data-lp-assign-close>×</button></header>
    <div class="modal__body">
      <div class="field"><label>${lp.assignTarget}</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${[["individual",lp.individual],["department",lp.department],["job_title",lp.jobTitle]].map(([v,l]) =>
            `<button type="button" class="btn ${_lpAssignTarget === v ? "btn-primary" : "btn-outline"} mini-action" data-lp-assign-target="${v}">${l}</button>`
          ).join("")}
        </div>
      </div>
      ${_lpAssignTarget === "individual" ? `
        <div class="field"><label>Nhân viên</label>
          <select name="employee_ids" multiple size="6" data-lp-emp-select>
            ${employees.filter((e) => e.role === "employee" || !e.role).map((e) =>
              `<option value="${escapeHtmlAttribute(e.id)}" ${_lpAssignEmpIds.includes(e.id) ? "selected" : ""}>${escapeHtml(e.fullName || e.full_name)} — ${escapeHtml(e.department || "")}</option>`
            ).join("")}
          </select>
          <small>Giữ Ctrl/Cmd để chọn nhiều người</small>
        </div>` : ""}
      ${_lpAssignTarget === "department" ? `
        <div class="field"><label>${lp.department}</label>
          <select name="department" data-lp-dept-select>
            <option value="">— Chọn phòng ban —</option>
            ${departments.map((d) => `<option value="${escapeHtmlAttribute(d)}" ${_lpAssignDept === d ? "selected" : ""}>${escapeHtml(d)}</option>`).join("")}
          </select>
        </div>` : ""}
      ${_lpAssignTarget === "job_title" ? `
        <div class="field"><label>${lp.jobTitle}</label>
          <select name="position" data-lp-position-select>
            <option value="">— Chọn chức danh —</option>
            ${positions.map((p) => `<option value="${escapeHtmlAttribute(p)}" ${_lpAssignPosition === p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
          </select>
        </div>` : ""}
      <div class="form-2col">
        <div class="field"><label>${lp.startAt}</label>
          <input type="datetime-local" name="start_at" value="${_lpAssignStartAt}"></div>
        <div class="field"><label>${lp.dueAt}</label>
          <input type="datetime-local" name="due_at" value="${_lpAssignDueAt}"></div>
      </div>
      <button type="button" class="btn btn-outline" data-lp-preview-assign data-path-id="${escapeHtmlAttribute(pathId)}">${lp.preview}</button>
      ${previewHtml}
    </div>
    <footer class="modal__footer">
      <button type="button" class="btn btn-outline" data-lp-assign-close>${t("content.cancel")}</button>
      <button type="submit" class="btn btn-primary" data-path-id="${escapeHtmlAttribute(pathId)}" ${!_lpPreviewData || !_lpPreviewData.will_create ? "disabled" : ""}>${lp.confirmAssign}</button>
    </footer>
  </form></div>`;
}

// ─── Employee Learning Path Pages ─────────────────────────────────────────────

function lpProgressBar(percent, compact = false) {
  const safe = Math.min(100, Math.max(0, Number(percent) || 0));
  if (compact) return `<div class="progress" role="progressbar" aria-valuenow="${safe}" aria-valuemin="0" aria-valuemax="100" style="height:6px"><div style="width:${safe}%"></div></div>`;
  return `<div class="progress" role="progressbar" aria-valuenow="${safe}" aria-valuemin="0" aria-valuemax="100"><div style="width:${safe}%"></div><span>${safe}%</span></div>`;
}

function myLearningPathsPage() {
  if (!hasEmployeeAccess()) return session ? restrictedPage() : loginPage();
  const lp = t("lp");
  const list = _myLpList || [];

  if (_myLpError) return `<div class="app-layout">${sideNav("employee")}<main class="app-main"><div class="content">
    <div class="card empty-state"><p>${escapeHtml(_myLpError)}</p><button class="btn btn-outline" onclick="fetchMyLearningPaths();render()">${lp.retry}</button></div>
  </div></main></div>`;

  const grouped = { in_progress: [], not_started: [], overdue: [], completed: [] };
  for (const a of list) {
    const g = a.status === "overdue" ? "overdue" : grouped[a.status] !== undefined ? a.status : "not_started";
    grouped[g].push(a);
  }

  const renderCard = (a) => {
    const p = a.path || {};
    const pct = a.progress_percent || 0;
    const isOverdue = a.status === "overdue";
    const isDone = a.status === "completed";
    const label = isDone ? lp.viewResult : pct > 0 ? lp.continuePath : lp.startPath;
    return `<div class="card lp-my-card ${isOverdue ? "lp-overdue" : ""}">
      <div class="lp-my-card__body">
        <h3>${escapeHtml(p.title || "—")}</h3>
        ${p.description ? `<p class="lp-my-desc">${escapeHtml(p.description)}</p>` : ""}
        ${lpProgressBar(pct, true)}
        <div class="lp-my-meta">
          <span>${pct}% · ${lpStatusBadge(a.status)}</span>
          ${a.due_at ? `<span ${isOverdue ? 'style="color:var(--color-danger)"' : ""}>Hạn: ${new Date(a.due_at).toLocaleDateString("vi-VN")}</span>` : ""}
        </div>
      </div>
      <div class="lp-my-card__foot">
        <a class="btn btn-primary" href="/dashboard/learning-paths/${a.id}" data-link>${label}</a>
      </div>
    </div>`;
  };

  const renderGroup = (title, items) => !items.length ? "" : `
    <section><h2 class="lp-group-title">${title}</h2>
    <div class="lp-my-grid">${items.map(renderCard).join("")}</div></section>`;

  const content = _myLpLoading && !list.length
    ? `<div class="hr-overview-skeleton">${Array(4).fill("<span></span>").join("")}</div>`
    : !list.length
      ? `<div class="card empty-state"><h3>${lp.noMyPaths}</h3></div>`
      : [
          renderGroup(lp.overdue, grouped.overdue),
          renderGroup(lp.inProgress, grouped.in_progress),
          renderGroup(lp.notStarted, grouped.not_started),
          renderGroup(lp.completed, grouped.completed),
        ].join("");

  return `<div class="app-layout">
    ${sideNav("employee")}
    <main class="app-main">
      <div class="content">
        <div class="panel-head"><div><h1>${lp.myTitle}</h1></div></div>
        ${content}
      </div>
    </main>
  </div>`;
}

function myLpDetailPage() {
  if (!hasEmployeeAccess()) return session ? restrictedPage() : loginPage();
  const lp = t("lp");
  const assignmentId = route.split("/")[3];

  if (_lpDetailLoading && !_myLpDetail) return `<div class="app-layout">${sideNav("employee")}<main class="app-main"><div class="content"><div class="hr-overview-skeleton">${Array(5).fill("<span></span>").join("")}</div></div></main></div>`;
  if (_lpDetailError) return `<div class="app-layout">${sideNav("employee")}<main class="app-main"><div class="content"><div class="card empty-state"><p>${escapeHtml(_lpDetailError)}</p><button class="btn btn-outline" onclick="fetchMyLpDetail('${escapeHtmlAttribute(assignmentId)}');render()">${lp.retry}</button></div></div></main></div>`;
  if (!_myLpDetail || _myLpDetail.assignment?.id !== assignmentId) return `<div class="app-layout">${sideNav("employee")}<main class="app-main"><div class="content"><div class="hr-overview-skeleton">${Array(5).fill("<span></span>").join("")}</div></div></main></div>`;

  const { assignment, path, steps } = _myLpDetail;
  const pct = assignment.progress_percent || 0;

  const stepsHtml = (steps || []).map((s, i) => {
    const cs = s.computed_status;
    const isLocked = cs === "locked";
    const isDone = cs === "completed";
    const title = s.title_override || s.resource_id || `Bước ${i + 1}`;

    // Find prerequisite step title
    let lockedMsg = "";
    if (isLocked && s.prerequisite_step_id) {
      const prereqStep = (steps || []).find((x) => x.id === s.prerequisite_step_id);
      const prevTitle = prereqStep ? (prereqStep.title_override || prereqStep.resource_id || `Bước ${prereqStep.position + 1}`) : "bước trước";
      lockedMsg = lp.lockedReason.replace("{prev}", prevTitle);
    } else if (isLocked) {
      lockedMsg = "Hoàn thành các bước bắt buộc trước đó để mở nội dung này.";
    }

    // CTA button based on step type
    let cta = "";
    if (!isLocked) {
      const targetUrl = s.step_type === "course" && s.resource_id
        ? `/dashboard/courses/${s.resource_id}`
        : s.step_type === "quiz" && s.resource_id
          ? `/dashboard/quizzes`
          : s.step_type === "training_session"
            ? `/dashboard/calendar`
            : null;
      if (targetUrl) {
        cta = `<a class="btn btn-outline mini-action" href="${escapeHtmlAttribute(targetUrl)}" data-link>${isDone ? "Xem lại" : "Bắt đầu"}</a>`;
      }
      if (!isDone && s.step_type === "course" && s.resource_id) {
        cta += ` <button class="btn btn-primary mini-action" data-lp-complete-step="${escapeHtmlAttribute(s.id)}" data-assignment-id="${escapeHtmlAttribute(assignmentId)}">Đánh dấu hoàn thành</button>`;
      }
    }

    return `<div class="lp-step-row ${isDone ? "lp-step-done" : isLocked ? "lp-step-locked" : ""}">
      <div class="lp-step-status-icon" aria-hidden="true">${isDone ? "✓" : isLocked ? "🔒" : String(i + 1)}</div>
      <div class="lp-step-body">
        <strong>${escapeHtml(title)}</strong>
        <span class="lp-step-meta">${lpStepTypeBadge(s.step_type)} ${s.is_required ? "" : `<span class="badge muted">${lp.optional}</span>`} ${lpStatusBadge(cs)}</span>
        ${s.estimated_duration_minutes ? `<small>${s.estimated_duration_minutes} phút</small>` : ""}
        ${lockedMsg ? `<p class="lp-lock-reason" role="status">${escapeHtml(lockedMsg)}</p>` : ""}
        ${s.completed_at ? `<small>Hoàn thành: ${formatDateTime(s.completed_at)}</small>` : ""}
      </div>
      <div class="lp-step-actions">${cta}</div>
    </div>`;
  }).join("");

  return `<div class="app-layout">
    ${sideNav("employee")}
    <main class="app-main">
      <div class="content">
        <a href="/dashboard/learning-paths" data-link class="btn btn-ghost">← ${lp.myTitle}</a>
        <div class="card" style="margin-top:16px">
          <div class="panel-head">
            <div>
              <h1>${escapeHtml(path?.title || "—")}</h1>
              ${path?.description ? `<p>${escapeHtml(path.description)}</p>` : ""}
            </div>
            <div style="text-align:right">
              ${lpStatusBadge(assignment.status)}
              ${assignment.due_at ? `<br><small>Hạn: ${new Date(assignment.due_at).toLocaleDateString("vi-VN")}</small>` : ""}
            </div>
          </div>
          <div style="margin:16px 0">
            <p>${lp.overallProgress}: <strong>${pct}%</strong></p>
            ${lpProgressBar(pct)}
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <h3>${lp.steps}</h3>
          <div class="lp-steps-list">${stepsHtml || `<div class="empty-state"><p>${lp.noSteps}</p></div>`}</div>
        </div>
      </div>
    </main>
  </div>`;
}

async function updateHrTaskStatus(id, status) {
  const res = await fetch("/api/admin/tasks", {
    method: "PATCH",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ id, status }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "task_update_failed");
  await fetchHrOverview({ silent: true });
}

function overviewSkeleton() {
  return `<div class="hr-overview-skeleton" aria-label="Đang tải dữ liệu">${Array.from({ length: 4 }, () => `<span></span>`).join("")}</div>`;
}

function formatDateTime(value) {
  if (!value) return "Chưa có dữ liệu";
  return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDuration(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} giờ ${rest} phút` : `${Math.max(1, rest)} phút`;
}

const SUPPORT_REQUEST_TYPES = ["forgot_password", "unlock_account", "reactivate_account", "login_issue", "account_access"];
const SUPPORT_TYPE_LABELS = {
  forgot_password: "Quên mật khẩu",
  unlock_account: "Mở khóa tài khoản",
  reactivate_account: "Kích hoạt lại tài khoản",
  login_issue: "Lỗi đăng nhập",
  account_access: "Yêu cầu truy cập",
};

function isSupportRequestTask(task) {
  return SUPPORT_REQUEST_TYPES.includes(task.requestType || task.taskType);
}

function renderHrTaskRow(task) {
  const isSupport = isSupportRequestTask(task);
  const primaryAction = isSupport
    ? `<button class="adm-task-btn adm-task-btn--primary" data-view-support-request="${escapeHtmlAttribute(task.id)}">Xử lý</button>`
    : task.status === "new"
      ? `<button class="adm-task-btn adm-task-btn--primary" data-hr-task-status="${task.id}" data-status="in_progress">Nhận</button>`
      : task.status === "in_progress"
        ? `<button class="adm-task-btn adm-task-btn--primary" data-hr-task-status="${task.id}" data-status="done">Hoàn tất</button>`
        : ``;
  const moreActions = task.status === "in_progress" && !isSupport
    ? `<div class="adm-task-more-wrap"><button class="adm-task-more" aria-label="Thêm thao tác">⋯</button><div class="adm-task-more-menu"><button data-hr-task-status="${task.id}" data-status="rejected">Từ chối</button></div></div>`
    : "";
  const statusCls = task.status === "done" ? "adm-status--done" : task.status === "rejected" ? "adm-status--reject" : task.status === "in_progress" ? "adm-status--progress" : "adm-status--new";
  const priorityCls = task.priority === "high" || task.priority === "urgent" ? "adm-priority--high" : task.priority === "low" ? "adm-priority--low" : "adm-priority--mid";
  const when = task.createdAt ? formatDateTime(task.createdAt) : "—";
  const requesterDisplay = task.requester?.fullName || (task.title?.includes(" - ") ? task.title.split(" - ").slice(1).join(" - ") : null) || "—";
  const deptDisplay = task.requester?.department || "";
  return `<tr class="adm-task-row" data-task-id="${escapeHtmlAttribute(task.id)}">
    <td><span class="adm-task-type-badge">${escapeHtml(task.taskTypeLabel)}</span></td>
    <td><span class="adm-task-title">${escapeHtml(task.title || task.taskTypeLabel)}</span></td>
    <td><span class="adm-task-requester">${escapeHtml(requesterDisplay)}</span><span class="adm-task-dept">${escapeHtml(deptDisplay)}</span></td>
    <td class="adm-task-time">${escapeHtml(when)}</td>
    <td><span class="adm-priority ${priorityCls}">${escapeHtml(task.priorityLabel)}</span></td>
    <td><span class="adm-status ${statusCls}">${escapeHtml(task.statusLabel)}</span></td>
    <td class="adm-task-actions">${primaryAction}${moreActions}</td>
  </tr>`;
}

// ── Login support modal ───────────────────────────────────────────────────────

function loginSupportModal() {
  if (!_supportModalOpen) return "";
  const TYPES = [
    { id: "forgot_password", label: "Quên mật khẩu", desc: "Tôi không nhớ mật khẩu và cần HR đặt lại." },
    { id: "unlock_account", label: "Tài khoản bị tạm khóa", desc: "Tài khoản bị khóa do đăng nhập sai nhiều lần." },
    { id: "reactivate_account", label: "Tài khoản bị vô hiệu hóa", desc: "Tài khoản bị HR vô hiệu hóa, tôi muốn được kích hoạt lại." },
    { id: "login_issue", label: "Lỗi đăng nhập khác", desc: "Có lỗi khác khiến tôi không thể đăng nhập." },
  ];

  if (_supportStep === "done") {
    return `<div class="modal-backdrop open" role="dialog" aria-modal="true" aria-label="Hỗ trợ tài khoản">
      <div class="card modal support-modal">
        <div class="modal-head"><h2>Đã gửi yêu cầu</h2><button class="icon-btn" data-close-support>×</button></div>
        <div class="support-done">
          <div class="support-done__icon">✓</div>
          <p><strong>Yêu cầu hỗ trợ đã được gửi đến HR.</strong></p>
          <p>Vui lòng chờ HR kiểm tra và phản hồi. Mật khẩu tạm sẽ được gửi trực tiếp qua kênh nội bộ.</p>
          <button class="btn btn-primary" data-close-support style="margin-top:16px">Đóng</button>
        </div>
      </div>
    </div>`;
  }

  if (_supportStep === "form" && _supportSelectedType) {
    const typeInfo = TYPES.find(t => t.id === _supportSelectedType) || {};
    return `<div class="modal-backdrop open" role="dialog" aria-modal="true" aria-label="Hỗ trợ tài khoản">
      <div class="card modal support-modal">
        <div class="modal-head"><h2>${escapeHtml(typeInfo.label || "Gửi yêu cầu hỗ trợ")}</h2><button class="icon-btn" data-close-support>×</button></div>
        <form id="supportRequestForm" class="support-form">
          <div class="field"><label>Email hoặc tên đăng nhập *</label><input name="identifier" type="email" placeholder="ten.nv@kisvn.vn" value="${escapeHtmlAttribute(_supportFormIdentifier)}" autocomplete="email" required></div>
          <div class="field"><label>Họ và tên</label><input name="fullName" type="text" placeholder="Nguyễn Văn A" value="${escapeHtmlAttribute(_supportFormName)}"></div>
          <div class="field"><label>Mã nhân viên (nếu có)</label><input name="employeeCode" type="text" placeholder="KIS-042" value="${escapeHtmlAttribute(_supportFormCode)}"></div>
          <div class="field"><label>Mô tả thêm</label><textarea name="message" rows="3" placeholder="Mô tả vấn đề bạn gặp phải...">${escapeHtml(_supportFormMessage)}</textarea></div>
          ${_supportError ? `<p class="form-error">${escapeHtml(_supportError)}</p>` : ""}
          <div class="support-form__actions">
            <button type="button" class="btn btn-outline" data-support-back>← Quay lại</button>
            <button type="submit" class="btn btn-primary" ${_supportSubmitting ? "disabled" : ""}>${_supportSubmitting ? "Đang gửi..." : "Gửi yêu cầu đến HR"}</button>
          </div>
        </form>
        <p class="support-note">Thông báo chung: Nếu tài khoản hợp lệ, yêu cầu sẽ xuất hiện trong HR Dashboard. Mật khẩu tạm sẽ được chuyển qua kênh nội bộ.</p>
      </div>
    </div>`;
  }

  return `<div class="modal-backdrop open" role="dialog" aria-modal="true" aria-label="Hỗ trợ tài khoản">
    <div class="card modal support-modal">
      <div class="modal-head"><h2>Bạn không thể đăng nhập?</h2><button class="icon-btn" data-close-support>×</button></div>
      <p class="support-intro">Chọn vấn đề bạn đang gặp phải để HR có thể hỗ trợ.</p>
      <div class="support-type-list">
        ${TYPES.map(t => `<button class="support-type-btn" data-support-type="${t.id}"><strong>${escapeHtml(t.label)}</strong><span>${escapeHtml(t.desc)}</span></button>`).join("")}
      </div>
    </div>
  </div>`;
}

// ── HR support request detail modal ──────────────────────────────────────────

function hrSupportRequestModal() {
  if (!_hrSupportModal && !_hrSupportLoading) return "";
  if (_hrSupportLoading && !_hrSupportModal) {
    return `<div class="modal-backdrop open" role="dialog" aria-modal="true"><div class="card modal modal--large"><div class="modal-head"><h2>Đang tải...</h2><button class="icon-btn" data-close-hr-support>×</button></div><div class="hr-overview-skeleton">${Array(3).fill("<span></span>").join("")}</div></div></div>`;
  }
  if (_hrSupportError && !_hrSupportModal) {
    return `<div class="modal-backdrop open" role="dialog" aria-modal="true"><div class="card modal"><div class="modal-head"><h2>Lỗi</h2><button class="icon-btn" data-close-hr-support>×</button></div><p>${escapeHtml(_hrSupportError)}</p></div></div>`;
  }
  if (!_hrSupportModal) return "";

  const req = _hrSupportModal.data;
  const prev = _hrSupportModal.previousRequests || [];
  const profile = req.profile;
  const isResolved = ["done", "rejected"].includes(req.status);
  const isAccountSupport = ["forgot_password", "unlock_account", "reactivate_account"].includes(req.requestType);

  // Action buttons based on request type and status
  let actionButtons = "";
  if (!isResolved) {
    if (req.status === "new") {
      actionButtons += `<button class="btn btn-outline" data-support-accept="${req.id}">Tiếp nhận xử lý</button>`;
    }
    if (req.requestType === "forgot_password" && req.requesterAccountId) {
      actionButtons += `<button class="btn btn-primary" data-support-open-reset>Tạo mật khẩu tạm</button>`;
    } else if (req.requestType === "unlock_account" && req.requesterAccountId) {
      actionButtons += `<button class="btn btn-primary" data-support-unlock="${req.id}">Mở khóa tài khoản</button>`;
    } else if (req.requestType === "reactivate_account" && req.requesterAccountId) {
      actionButtons += `<button class="btn btn-primary" data-support-reactivate="${req.id}">Kích hoạt lại tài khoản</button>`;
    }
    actionButtons += `<button class="btn btn-outline danger-action" data-support-reject-open>Từ chối</button>`;
  }

  const passwordResetForm = _hrSupportModal.showResetForm ? `
    <div class="support-reset-form card" style="margin-top:12px;padding:16px">
      <h4 style="margin:0 0 12px">Tạo mật khẩu tạm</h4>
      <div class="option-stack">
        <label><input type="radio" name="resetMode" value="auto" ${_hrSupportModal.resetMode !== "manual" ? "checked" : ""}> Tạo tự động</label>
        <label><input type="radio" name="resetMode" value="manual" ${_hrSupportModal.resetMode === "manual" ? "checked" : ""}> Nhập thủ công</label>
      </div>
      ${_hrSupportModal.resetMode === "manual" ? `<div class="field" style="margin-top:8px"><input id="supportTempPwd" type="text" placeholder="KIS@Temp2026" style="font-family:monospace"></div>` : ""}
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" data-support-do-reset="${req.id}" ${_hrSupportActionLoading ? "disabled" : ""}>${_hrSupportActionLoading ? "Đang xử lý..." : "Xác nhận tạo mật khẩu"}</button>
        <button class="btn btn-outline" data-support-cancel-reset>Huỷ</button>
      </div>
    </div>` : "";

  const passwordResult = _hrSupportPasswordResult ? `
    <div class="temp-password-box" style="margin-top:12px">
      <div><strong style="font-size:1.2em;font-family:monospace;letter-spacing:0.05em">${escapeHtml(_hrSupportPasswordResult)}</strong><p>Mật khẩu tạm đã được tạo thành công. Hãy gửi trực tiếp cho nhân viên. Mật khẩu này sẽ không được hiển thị lại.</p></div>
      <button class="btn btn-outline" data-copy-support-password="${escapeHtmlAttribute(_hrSupportPasswordResult)}">Sao chép</button>
    </div>` : "";

  const rejectForm = _hrSupportRejectOpen ? `
    <div class="support-reject-form card" style="margin-top:12px;padding:16px">
      <h4 style="margin:0 0 12px">Lý do từ chối</h4>
      <div class="option-stack">
        ${["Không xác minh được thông tin", "Tài khoản không thuộc hệ thống", "Yêu cầu trùng", "Tài khoản đã bị vô hiệu hóa theo chính sách", "Lý do khác"].map(r => `<label><input type="radio" name="rejectReason" value="${escapeHtmlAttribute(r)}" onchange="document.getElementById('rejectNoteInput').value=this.value"> ${escapeHtml(r)}</label>`).join("")}
      </div>
      <div class="field" style="margin-top:8px"><textarea id="rejectNoteInput" rows="2" placeholder="Ghi chú thêm (tuỳ chọn)">${escapeHtml(_hrSupportRejectNote)}</textarea></div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-outline danger-action" data-support-do-reject="${req.id}" ${_hrSupportActionLoading ? "disabled" : ""}>${_hrSupportActionLoading ? "Đang xử lý..." : "Xác nhận từ chối"}</button>
        <button class="btn btn-outline" data-support-reject-cancel>Huỷ</button>
      </div>
    </div>` : "";

  return `<div class="modal-backdrop open" role="dialog" aria-modal="true" aria-label="Yêu cầu hỗ trợ tài khoản">
    <div class="card modal modal--large">
      <div class="modal-head">
        <div><h2>Yêu cầu: ${escapeHtml(req.requestTypeLabel)}</h2><small>${escapeHtml(req.submittedName || req.submittedIdentifier || "")}</small></div>
        <button class="icon-btn" data-close-hr-support>×</button>
      </div>
      <div class="support-detail-grid">
        <div class="support-detail-section">
          <h4>Thông tin yêu cầu</h4>
          <div class="profile-grid">
            <div class="profile-item"><span>Loại</span><strong>${escapeHtml(req.requestTypeLabel)}</strong></div>
            <div class="profile-item"><span>Trạng thái</span><strong><span class="badge ${req.status === "done" ? "active" : req.status === "rejected" ? "draft" : "pending"}">${escapeHtml(req.statusLabel)}</span></strong></div>
            <div class="profile-item"><span>Ưu tiên</span><strong>${escapeHtml(req.priority === "high" ? "Cao" : req.priority === "low" ? "Thấp" : "Bình thường")}</strong></div>
            <div class="profile-item"><span>Thời gian gửi</span><strong>${formatDateTime(req.createdAt)}</strong></div>
            <div class="profile-item"><span>Email/Username đã nhập</span><strong>${escapeHtml(req.submittedIdentifier || "—")}</strong></div>
            <div class="profile-item"><span>Họ tên đã nhập</span><strong>${escapeHtml(req.submittedName || "—")}</strong></div>
            <div class="profile-item"><span>Mã nhân viên đã nhập</span><strong>${escapeHtml(req.submittedEmployeeCode || "—")}</strong></div>
            ${req.message ? `<div class="profile-item" style="grid-column:1/-1"><span>Mô tả</span><strong>${escapeHtml(req.message)}</strong></div>` : ""}
          </div>
        </div>
        ${profile ? `<div class="support-detail-section">
          <h4>Tài khoản khớp trong hệ thống</h4>
          <div class="profile-grid">
            <div class="profile-item"><span>Họ tên</span><strong>${escapeHtml(profile.fullName)}</strong></div>
            <div class="profile-item"><span>Email</span><strong>${escapeHtml(profile.email)}</strong></div>
            <div class="profile-item"><span>Phòng ban</span><strong>${escapeHtml(profile.department || "—")}</strong></div>
            <div class="profile-item"><span>Trạng thái TK</span><strong><span class="badge ${profile.accountStatus === "active" ? "active" : "pending"}">${escapeHtml(profile.accountStatus === "active" ? "Đang hoạt động" : profile.accountStatus === "inactive" ? "Đã vô hiệu hóa" : profile.accountStatus)}</span></strong></div>
            <div class="profile-item"><span>Đăng nhập gần nhất</span><strong>${formatDateTime(profile.lastLoginAt)}</strong></div>
            <div class="profile-item"><span>Số lần đăng nhập sai</span><strong>${profile.failedLoginCount || 0}</strong></div>
            ${profile.lockedUntil ? `<div class="profile-item"><span>Khóa đến</span><strong>${formatDateTime(profile.lockedUntil)}</strong></div>` : ""}
          </div>
        </div>` : `<div class="support-detail-section"><h4>Tài khoản</h4><p class="muted-cell">Không tìm thấy tài khoản khớp với email/username đã nhập.</p></div>`}
      </div>
      ${prev.length > 0 ? `<div class="support-detail-section" style="margin-top:12px"><h4>Yêu cầu trước đây</h4><div class="support-prev-list">${prev.map(p => `<div class="support-prev-row"><span class="badge pending">${escapeHtml(SUPPORT_TYPE_LABELS[p.task_type] || p.task_type)}</span><span class="badge ${p.status === "done" ? "active" : p.status === "rejected" ? "draft" : "pending"}">${p.status}</span><small>${formatDateTime(p.created_at)}</small></div>`).join("")}</div></div>` : ""}
      ${!isResolved ? `<div class="support-actions" style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">${actionButtons}</div>` : `<p class="muted-cell" style="margin-top:12px">Yêu cầu đã ${req.status === "done" ? "được hoàn tất" : "bị từ chối"} lúc ${formatDateTime(req.resolvedAt)}. ${req.resolutionNote ? `Ghi chú: ${escapeHtml(req.resolutionNote)}` : ""}</p>`}
      ${_hrSupportError ? `<p class="form-error" style="margin-top:8px">${escapeHtml(_hrSupportError)}</p>` : ""}
      ${passwordResetForm}
      ${passwordResult}
      ${rejectForm}
    </div>
  </div>`;
}

function renderInactiveEmployeeRow(row) {
  const dayCls = row.daysInactive === null || row.daysInactive > 30 ? "adm-day--risk" : row.daysInactive > 14 ? "adm-day--warn" : "adm-day--ok";
  return `<tr>
    <td><div class="adm-emp-cell"><span class="adm-avatar-sm">${initials(row.fullName || "—")}</span><div><strong>${escapeHtml(row.fullName || "—")}</strong><small>${escapeHtml(row.department || "—")}</small></div></div></td>
    <td>${escapeHtml(row.position || "—")}</td>
    <td class="adm-task-time">${row.lastSeenAt ? formatDateTime(row.lastSeenAt) : "Chưa truy cập"}</td>
    <td><span class="adm-day-badge ${dayCls}">${row.daysInactive === null ? "Chưa truy cập" : `${row.daysInactive} ngày`}</span></td>
    <td><a class="adm-task-btn adm-task-btn--ghost" href="/admin/employees" data-link>Xem</a></td>
  </tr>`;
}

function renderOnlineLearningCard(row) {
  const mins = row.durationSeconds > 0 ? Math.floor(row.durationSeconds / 60) : 0;
  const dur = mins >= 60 ? `${Math.floor(mins / 60)}g ${mins % 60}p` : `${mins} phút`;
  return `<div class="adm-online-card">
    <span class="adm-avatar-sm">${initials(row.fullName || "—")}</span>
    <div class="adm-online-card__info">
      <strong>${escapeHtml(row.fullName || "—")}</strong>
      <span>${escapeHtml(row.title || row.pagePath || "Nội dung học")}</span>
      <small>${escapeHtml(row.department || "—")} · ${escapeHtml(row.activityLabel)} · ${dur}</small>
    </div>
    <span class="adm-online-dot" title="Đang online"></span>
  </div>`;
}

function renderUpcomingSession(s) {
  const d = new Date(s.startAt);
  const dayNum = d.getDate();
  const monthStr = `Th${d.getMonth() + 1}`;
  const timeStr = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const endTime = s.endAt ? new Date(s.endAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "";
  const modeCls = s.mode === "online" ? "adm-session-mode--online" : "adm-session-mode--offline";
  const modeLabel = s.mode === "online" ? "Online" : "Offline";
  return `<div class="adm-session-item">
    <div class="adm-session-date"><strong>${dayNum}</strong><span>${monthStr}</span></div>
    <div class="adm-session-info">
      <strong>${escapeHtml(s.title || s.courseTitle || "Buổi học")}</strong>
      <span>${timeStr}${endTime ? `–${endTime}` : ""} · <span class="adm-session-mode ${modeCls}">${modeLabel}</span></span>
      ${s.locationName ? `<small>${escapeHtml(s.locationName)}</small>` : ""}
    </div>
  </div>`;
}

function adminDashboard(compact = false) {
  const overview = _hrOverview;
  const isLoading = !overview && _hrOverviewLoading;
  const hasError = _hrOverviewError && !overview;
  const tasks = overview?.tasks || [];
  const openTaskCount = overview?.pendingActions ?? 0;
  const completionRate = overview?.completionRate;
  const upcomingSessions = overview?.upcomingSessions || [];
  const onlineLearning = overview?.onlineLearning || [];
  const inactiveRows = overview?.inactiveEmployeeRows || [];

  const RESOLVED_STATUSES = ["done", "rejected"];
  const filteredTasks = _hrTaskFilter === "all" ? tasks.filter(t => !RESOLVED_STATUSES.includes(t.status))
    : _hrTaskFilter === "new" ? tasks.filter(t => t.status === "new")
    : _hrTaskFilter === "in_progress" ? tasks.filter(t => t.status === "in_progress")
    : _hrTaskFilter === "high" ? tasks.filter(t => (t.priority === "high" || t.priority === "urgent") && !RESOLVED_STATUSES.includes(t.status))
    : _hrTaskFilter === "resolved" ? tasks.filter(t => RESOLVED_STATUSES.includes(t.status))
    : tasks;
  const displayedTasks = filteredTasks.slice(0, 10);

  function kpiVal(v, suffix = "") {
    if (isLoading) return `<span class="adm-kpi-skeleton"></span>`;
    return v === undefined || v === null ? `<strong class="adm-kpi-val">—</strong>` : `<strong class="adm-kpi-val">${v}${suffix}</strong>`;
  }

  const kpiCards = [
    { label: "Tổng nhân viên", val: overview?.totalEmployees, hint: "Tài khoản đang hoạt động", icon: "👥" },
    { label: "Truy cập hôm nay", val: overview?.visitedToday, hint: "Tính theo giờ Việt Nam", icon: "📊" },
    { label: "Đang online", val: overview?.onlineNow, hint: "Hoạt động trong 5 phút gần nhất", icon: "🟢" },
    { label: "Đang học", val: overview?.learningNow, hint: "Đang xem nội dung hoặc làm quiz", icon: "📖" },
    { label: "Khóa học đang mở", val: overview?.activeCourseCount, hint: "Khóa học đã phát hành", icon: "🎓" },
    { label: "Tỷ lệ hoàn thành", val: completionRate !== null && completionRate !== undefined ? completionRate : null, hint: completionRate !== null && completionRate !== undefined ? "Dựa trên tổng enrollment" : "Chưa có dữ liệu", icon: "✅", suffix: completionRate !== null && completionRate !== undefined ? "%" : "" },
  ].map(({ label, val, hint, icon, suffix = "" }) => `
    <div class="adm-kpi-card">
      <div class="adm-kpi-icon" aria-hidden="true">${icon}</div>
      <div class="adm-kpi-body">
        <span class="adm-kpi-label">${label}</span>
        ${kpiVal(val, suffix)}
        <small class="adm-kpi-hint">${hint}</small>
      </div>
    </div>`).join("");

  const taskFilterTabs = [["all","Chờ xử lý"], ["new","Mới"], ["in_progress","Đang xử lý"], ["high","Ưu tiên cao"], ["resolved","Đã xử lý"]].map(([v, l]) =>
    `<button class="adm-filter-tab ${_hrTaskFilter === v ? "adm-filter-tab--active" : ""}" data-hr-task-filter="${v}">${l}${v==="all"&&tasks.filter(t=>!RESOLVED_STATUSES.includes(t.status)).length?` <span class="adm-badge-inline">${tasks.filter(t=>!RESOLVED_STATUSES.includes(t.status)).length}</span>`:""}</button>`).join("");

  const taskTableRows = isLoading
    ? `<tr><td colspan="7"><div class="adm-skeleton-block" style="height:160px"></div></td></tr>`
    : displayedTasks.length
      ? displayedTasks.map(renderHrTaskRow).join("")
      : `<tr><td colspan="7"><div class="adm-empty"><p>Hiện chưa có yêu cầu cần xử lý.</p></div></td></tr>`;

  const quickActions = [
    { label: "Tạo khóa học", href: "/admin/courses", icon: "📚" },
    { label: "Tạo lớp trực tiếp", href: "/admin/sessions", icon: "🏫" },
    { label: "Giao khóa học", href: "/admin/assign", icon: "📤" },
    { label: "Duyệt yêu cầu", href: "/admin/accounts", icon: "✔️" },
    { label: "Tạo bài kiểm tra", href: "/admin/quizzes", icon: "📝" },
    { label: "Gửi thông báo", href: "/admin/notifications", icon: "🔔" },
    { label: "Hồ sơ học tập", href: "/admin/learning-records", icon: "🗂️" },
    { label: "Xem báo cáo", href: "/admin/reports", icon: "📈" },
  ].map(({ label, href, icon }) => `
    <a href="${href}" data-link class="adm-qa-item">
      <span class="adm-qa-icon" aria-hidden="true">${icon}</span>
      <span class="adm-qa-label">${label}</span>
    </a>`).join("");

  const onlineSection = isLoading
    ? `<div class="adm-skeleton-block" style="height:120px"></div>`
    : onlineLearning.length
      ? `<div class="adm-online-list">${onlineLearning.slice(0, 6).map(renderOnlineLearningCard).join("")}</div>`
      : `<div class="adm-empty"><p>Hiện chưa có nhân viên đang học trực tuyến.</p></div>`;

  const sessionsSection = isLoading
    ? `<div class="adm-skeleton-block" style="height:120px"></div>`
    : upcomingSessions.length
      ? upcomingSessions.map(renderUpcomingSession).join("")
      : `<div class="adm-empty"><p>Chưa có lớp đào tạo sắp diễn ra.</p></div>`;

  const inactiveSection = isLoading
    ? `<div class="adm-skeleton-block" style="height:120px"></div>`
    : inactiveRows.length
      ? `<div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>Nhân viên</th><th>Chức danh</th><th>Lần cuối truy cập</th><th>Thời gian vắng</th><th></th></tr></thead><tbody>${inactiveRows.map(renderInactiveEmployeeRow).join("")}</tbody></table></div>`
      : `<div class="adm-empty"><p>Không có nhân viên cần nhắc truy cập.</p></div>`;

  return `
    <div class="${compact ? "dashboard-preview" : "app-layout"}">
      ${sideNav("hr")}
      <main class="app-main">
        ${adminTopbar()}
        <div class="content adm-content">
          ${hasError ? `<div class="adm-error-bar">Không thể tải dữ liệu tổng quan. <button data-refresh-hr-overview>Thử lại</button></div>` : ""}

          <!-- KPI row -->
          <div class="adm-kpi-row">${kpiCards}</div>

          <!-- Tasks + Quick Actions -->
          <div class="adm-main-grid">
            <section class="adm-card adm-tasks-section">
              <div class="adm-card-head">
                <div class="adm-card-head__left">
                  <h2 class="adm-card-title">Việc cần xử lý</h2>
                  ${openTaskCount > 0 ? `<span class="adm-badge-count">${openTaskCount}</span>` : ""}
                </div>
                <div class="adm-card-head__right">
                  <div class="adm-filter-tabs" role="tablist">${taskFilterTabs}</div>
                  <a href="/admin/accounts" data-link class="adm-see-all">Xem tất cả →</a>
                </div>
              </div>
              <div class="adm-table-wrap">
                <table class="adm-table adm-tasks-table">
                  <thead><tr><th>Loại</th><th>Nội dung</th><th>Người yêu cầu</th><th>Thời gian</th><th>Ưu tiên</th><th>Trạng thái</th><th></th></tr></thead>
                  <tbody>${taskTableRows}</tbody>
                </table>
              </div>
            </section>

            <section class="adm-card adm-quick-actions-section">
              <h2 class="adm-card-title">Thao tác nhanh</h2>
              <div class="adm-qa-grid">${quickActions}</div>
            </section>
          </div>

          <!-- Online learning + Upcoming sessions -->
          <div class="adm-secondary-grid">
            <section class="adm-card">
              <div class="adm-card-head">
                <h2 class="adm-card-title">Nhân viên đang online học <span class="adm-card-count">${isLoading ? "" : onlineLearning.length}</span></h2>
                <button class="adm-refresh-btn" data-refresh-hr-overview aria-label="Cập nhật">↺</button>
              </div>
              ${onlineSection}
            </section>

            <section class="adm-card">
              <div class="adm-card-head">
                <h2 class="adm-card-title">Lịch đào tạo sắp tới</h2>
                <a href="/admin/sessions" data-link class="adm-see-all">Xem tất cả →</a>
              </div>
              <div class="adm-sessions-list">${sessionsSection}</div>
            </section>
          </div>

          <!-- Inactive employees -->
          <section class="adm-card">
            <div class="adm-card-head">
              <h2 class="adm-card-title">Nhân viên lâu chưa truy cập</h2>
              <a href="/admin/employees" data-link class="adm-see-all">Xem tất cả →</a>
            </div>
            ${inactiveSection}
          </section>
        </div>
      </main>
      ${employeeFormModal()}${hrSupportRequestModal()}
    </div>`;
}


function shellLabel(key) {
  const labels = {
    navMain: { vi: "Điều hướng chính", en: "Main navigation", kr: "주요 탐색" },
    openMenu: { vi: "Mở menu", en: "Open menu", kr: "메뉴 열기" },
    closeMenu: { vi: "Đóng menu", en: "Close menu", kr: "메뉴 닫기" },
    menu: { vi: "Menu", en: "Menu", kr: "메뉴" },
    notifications: { vi: "Thông báo", en: "Notifications", kr: "알림" },
    userMenu: { vi: "Menu người dùng", en: "User menu", kr: "사용자 메뉴" },
    roleEmployee: { vi: "Nhân viên", en: "Employee", kr: "임직원" },
    roleHr: { vi: "HR", en: "HR", kr: "HR" },
    navOverview: { vi: "Tổng quan", en: "Overview", kr: "개요" },
    navLearning: { vi: "Học tập", en: "Learning", kr: "학습" },
    navCompliance: { vi: "Tuân thủ & Chứng chỉ", en: "Compliance & Certificates", kr: "준법 및 자격증" },
    navPersonal: { vi: "Năng lực cá nhân", en: "Personal capability", kr: "개인 역량" },
    navSystem: { vi: "Hệ thống", en: "System", kr: "시스템" },
    navTraining: { vi: "Đào tạo", en: "Training", kr: "교육" },
    navCapabilities: { vi: "Năng lực & Phát triển", en: "Capability & Development", kr: "역량 및 개발" },
    navReportsSystem: { vi: "Báo cáo & Hệ thống", en: "Reports & System", kr: "보고서 및 시스템" },
    navPersonnel: { vi: "Nhân sự", en: "Personnel", kr: "인사" },
    offlineClassManagement: { vi: "Quản lý lớp offline", en: "Offline Class Management", kr: "오프라인 교육 관리" },
    liveTrainingJourney: { vi: "Hành trình buổi học", en: "Live training journey", kr: "실시간 교육 여정" },
    trainingTracking: { vi: "Theo dõi đào tạo", en: "Training Tracking", kr: "교육 추적 관리" },
    cchnRegistration: { vi: "Đăng ký học CCHN", en: "Professional Certification Registration", kr: "전문 자격 교육 등록" },
    navComplianceShort: { vi: "Tuân thủ", en: "Compliance", kr: "컴플라이언스" },
    logout: { vi: "Đăng xuất", en: "Sign out", kr: "로그아웃" },
  };
  return labels[key]?.[language] || labels[key]?.vi || key;
}

function shellPageMeta(path = route) {
  const base = {
    "/dashboard": [shellLabel("roleEmployee"), uiText("overview")],
    "/dashboard/courses": [shellLabel("roleEmployee"), uiText("myCourses")],
    "/dashboard/quizzes": [shellLabel("roleEmployee"), t("quiz.title")],
    "/dashboard/learning-paths": [shellLabel("roleEmployee"), t("lp.myTitle")],
    "/dashboard/compliance": [shellLabel("roleEmployee"), t("compliance.title")],
    "/dashboard/certificates": [shellLabel("roleEmployee"), t("certificates.certificate")],
    "/dashboard/notifications": [shellLabel("roleEmployee"), shellLabel("notifications")],
    "/dashboard/skills": [shellLabel("roleEmployee"), c9("mySkills")],
    "/dashboard/development-plan": [shellLabel("roleEmployee"), c9("myDevelopmentPlan")],
    "/admin": [shellLabel("roleHr"), t("admin.overview")],
    "/admin/courses": [shellLabel("roleHr"), t("course.manage")],
    "/admin/assign": [shellLabel("roleHr"), t("enrollment.assign")],
    "/admin/quizzes": [shellLabel("roleHr"), t("quiz.quizzes")],
    "/admin/learning-paths": [shellLabel("roleHr"), t("lp.title")],
    "/admin/compliance": [shellLabel("roleHr"), t("compliance.title")],
    "/admin/certificates": [shellLabel("roleHr"), t("certificates.certificate")],
    "/admin/employees": [shellLabel("roleHr"), t("admin.employees")],
    "/admin/accounts": [shellLabel("roleHr"), t("admin.accountTitle")],
    "/admin/reports": [shellLabel("roleHr"), t("reports.title")],
    "/admin/notifications": [shellLabel("roleHr"), shellLabel("notifications")],
    "/admin/audit-log": [shellLabel("roleHr"), t("admin.auditLog")],
    "/admin/retraining": [shellLabel("roleHr"), shellLabel("retraining")],
    "/admin/training-tracking": [shellLabel("roleHr"), shellLabel("trainingTracking")],
    "/admin/live-training": [shellLabel("roleHr"), shellLabel("liveTrainingJourney")],
    "/admin/sessions": [shellLabel("roleHr"), shellLabel("offlineClassManagement")],
    "/admin/cchn-registrations": [shellLabel("roleHr"), shellLabel("cchnRegistration")],
  };
  const direct = base[path] || Object.entries(base).filter(([href]) => href !== "/" && path.startsWith(`${href}/`)).sort((a,b)=>b[0].length-a[0].length)[0]?.[1];
  return { label: direct?.[0] || "MyKIS", title: direct?.[1] || t("brand") };
}

function focusableElements(root) {
  return [...(root?.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),details summary,[tabindex]:not([tabindex="-1"])') || [])]
    .filter(el => !el.hasAttribute("hidden") && el.offsetParent !== null);
}

function sideNav(role) {
  const groups = role === "hr"
    ? [
        [shellLabel("navOverview"), [["/admin", t("admin.overview")]]],
        [shellLabel("navTraining"), [["/admin/courses", t("course.manage")], ["/admin/assign", t("enrollment.assign")], ["/admin/quizzes", t("quiz.quizzes")], ["/admin/learning-paths", t("lp.title")], ["/admin/live-training", shellLabel("liveTrainingJourney")], ["/admin/sessions", shellLabel("offlineClassManagement")], ["/admin/training-tracking", shellLabel("trainingTracking")], ["/admin/cchn-registrations", shellLabel("cchnRegistration")]]],
        [shellLabel("navPersonnel"), [["/admin/employees", t("admin.employees")], ["/admin/accounts", t("admin.accountTitle")]]],
        [shellLabel("navComplianceShort"), [["/admin/certificates", t("certificates.certificate")]]],
        [shellLabel("navReportsSystem"), [["/admin/reports", t("reports.title")], ["/admin/notifications", shellLabel("notifications")], ["/admin/audit-log", t("admin.auditLog")]]],
      ]
    : [
        [shellLabel("navOverview"), [["/dashboard", uiText("overview")]]],
        [shellLabel("navLearning"), [["/dashboard/courses", uiText("myCourses")], ["/dashboard/quizzes", t("quiz.title")], ["/dashboard/learning-paths", t("lp.myTitle")]]],
        [shellLabel("navCompliance"), [["/dashboard/compliance", t("compliance.title")], ["/dashboard/certificates", t("certificates.certificate")]]],
        [shellLabel("navPersonal"), [["/dashboard/skills", c9("mySkills")], ["/dashboard/development-plan", c9("myDevelopmentPlan")]]],
        [shellLabel("navSystem"), [["/dashboard/notifications", shellLabel("notifications")]]],
      ];
  const items = groups.flatMap(x => x[1]);
  const activeHref = items.reduce((best, [href]) => {
    const isActive = route === href || (href !== "/" && route.startsWith(`${href}/`));
    if (!isActive) return best;
    return best === "" || href.length > best.length ? href : best;
  }, "");
  const navRows = groups.map(([label, links]) => `
    <div class="side-nav__section">
      <span class="side-nav__group">${escapeHtml(label)}</span>
      ${links.map(([href, name]) => `<a class="${activeHref === href ? "active" : ""}" ${activeHref === href ? 'aria-current="page"' : ""} href="${href}" data-link data-close-mobile-nav>${escapeHtml(name)}</a>`).join("")}
    </div>`).join("");
  return `<aside class="app-sidebar" id="appMobileDrawer" aria-label="${escapeHtmlAttribute(shellLabel("navMain"))}" aria-hidden="${mobileNavOpen ? "false" : "true"}" data-mobile-drawer>
    <div class="app-sidebar__head">
      ${sidebarBrand()}
      <button type="button" class="icon-btn app-sidebar__close" data-close-mobile-nav aria-label="${escapeHtmlAttribute(shellLabel("closeMenu"))}">×</button>
    </div>
    <nav class="side-nav" aria-label="${escapeHtmlAttribute(shellLabel("navMain"))}">${navRows}</nav>
    <div class="app-sidebar__footer"><button type="button" class="btn btn-outline light" data-logout>${escapeHtml(shellLabel("logout"))}</button></div>
  </aside>`;
}

function adminTopbar() {
  const meta = shellPageMeta("/admin");
  return topbar(meta.label, meta.title, "hr");
}

function sidebarBrand() { return `<div class="sidebar-brand"><a href="/" data-link class="sidebar-brand__link" aria-label="MyKIS Learning"><img src="/assets/kis-logo-white.png" alt="KIS Vietnam" class="sidebar-brand__logo"><span class="sidebar-brand__name">MyKIS Learning</span></a></div>`; }

function employeeAvatar(account, employee, className="avatar") { const name=employee?.fullName||account?.fullName||account?.email?.split("@")[0]||uiText("employeeFallback"); return `<span class="${className} employee-avatar" data-photo-blob-id="${escapeHtmlAttribute(employee?.photoBlobId||"")}" data-photo-url="${escapeHtmlAttribute(employee?.photoUrl||"")}" data-photo-key="${escapeHtmlAttribute(account?.employeeCode||account?.email?.split("@")[0]||"")}" aria-label="${escapeHtmlAttribute(name)}"><span>${initials(name)}</span></span>`; }
function greeting(name){return uiText("greeting").replace("{name}",name);}

function topbar(label, title, role, avatarText = "") {
  const currentAccount = session?.accountId ? getAccountById(session.accountId) : null;
  const currentEmployee = currentAccount?.role === "employee" ? getEmployeeByAccountId(currentAccount.id) : null;
  const currentAvatarText = initials(currentAccount?.fullName || currentAccount?.name || session?.fullName || "");
  const fullName=currentAccount?.fullName||session?.fullName||t(`roles.${role}`);
  const jobTitle=currentEmployee?.jobTitle||currentEmployee?.position||currentEmployee?.title||currentAccount?.position||"";
  const dept=currentEmployee?.department||currentAccount?.department||"";
  const meta = role==="employee" ? (jobTitle||dept||shellLabel("roleEmployee")) : (dept||shellLabel("roleHr"));
  const pageMeta = shellPageMeta();
  const topLabel = label || pageMeta.label;
  const topTitle = title || pageMeta.title;
  const destinationRoute = role === "hr" ? "/admin" : "/dashboard";
  const avatar = role === "employee" ? employeeAvatar(currentAccount,currentEmployee,"topbar-user__avatar") : `<span class="avatar">${avatarText||currentAvatarText||"HR"}</span>`;
  return `<header class="topbar" role="banner">
    <div class="topbar__left">
      <button type="button" class="icon-btn topbar-menu-btn" data-open-mobile-nav aria-label="${escapeHtmlAttribute(shellLabel("openMenu"))}" aria-expanded="${mobileNavOpen ? "true" : "false"}" aria-controls="appMobileDrawer">☰</button>
      <div class="topbar__title"><span class="label">${escapeHtml(topLabel)}</span><h2>${escapeHtml(topTitle)}</h2></div>
    </div>
    <div class="topbar-actions">
      ${role === "hr" ? `<a class="icon-btn topbar-notification-btn" href="/admin/notifications" data-link aria-label="${escapeHtmlAttribute(shellLabel("notifications"))}" title="${escapeHtmlAttribute(shellLabel("notifications"))}">🔔</a>` : `<button type="button" class="icon-btn topbar-notification-btn" data-open-notifications aria-label="${escapeHtmlAttribute(shellLabel("notifications"))}" title="${escapeHtmlAttribute(shellLabel("notifications"))}">🔔</button>`}
      ${languageSwitcher()}
      <div class="topbar-user-shell">
        <button type="button" class="topbar-user-trigger" data-user-menu-trigger aria-haspopup="menu" aria-expanded="${userMenuOpen ? "true" : "false"}" aria-label="${escapeHtmlAttribute(shellLabel("userMenu"))}">
          ${avatar}<span class="topbar-user__identity"><strong>${escapeHtml(fullName)}</strong><small>${escapeHtml(meta)}</small></span><svg class="topbar-user__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="topbar-user__menu ${userMenuOpen ? "is-open" : ""}" data-user-menu role="menu">
          <strong>${escapeHtml(fullName)}</strong>${meta ? `<span>${escapeHtml(meta)}</span>` : ""}
          <a class="btn btn-primary" href="${destinationRoute}" data-link role="menuitem">${escapeHtml(topTitle)}</a>
          <button class="btn btn-outline" data-logout role="menuitem">${escapeHtml(shellLabel("logout"))}</button>
        </div>
      </div>
    </div>
  </header>${mobileNavOpen ? `<div class="mobile-nav-backdrop" data-close-mobile-nav aria-hidden="true"></div>` : ""}`;
}

function accountsPage() {
  if (!hasAdminAccess()) return restrictedPage();
  const accounts = filteredAccounts();
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("Admin", t("admin.accountTitle"), "hr")}<div class="content">
    <section class="card panel account-toolbar"><h3>${t("admin.accountTitle")}</h3><div class="filter-bar account-filter"><input data-account-search placeholder="${t("admin.search")}" value="${accountSearch}">${accountSelect("department", t("table.department"), uniqueValues(getAccounts(), "department"))}${accountSelect("role", t("table.role"), uniqueValues(getAccounts(), "role"))}${accountSelect("accountStatus", t("table.accountStatus"), uniqueValues(getAccounts(), "accountStatus"))}${accountSelect("passwordStatus", t("table.passwordStatus"), ["required", "normal"])}</div></section>
    <section class="card panel">${accountTable(accounts)}</section>
    <section class="card panel"><h3>${t("admin.auditLog")}</h3>${auditTable()}</section>
  </div></main>${accountDrawer()}${resetPasswordModal()}</div>`;
}

function filteredAccounts() {
  return getAccounts().filter((account) => {
    const text = `${account.fullName} ${account.email} ${account.employeeCode}`.toLowerCase();
    const passStatus = account.passwordResetRequired ? "required" : "normal";
    return (!accountSearch || text.includes(accountSearch.toLowerCase()))
      && (!accountFilters.department || account.department === accountFilters.department)
      && (!accountFilters.role || account.role === accountFilters.role)
      && (!accountFilters.accountStatus || account.accountStatus === accountFilters.accountStatus)
      && (!accountFilters.passwordStatus || passStatus === accountFilters.passwordStatus);
  });
}

function accountSelect(name, label, values) {
  return `<select data-account-filter="${name}"><option value="">${label}</option>${values.map((v) => `<option value="${v}" ${accountFilters[name] === v ? "selected" : ""}>${v.startsWith?.("required") || v === "normal" ? t(`status.${v}`) : v}</option>`).join("")}</select>`;
}

function accountTable(accounts) {
  const headers = ["fullName", "code", "email", "department", "role", "accountStatus", "passwordStatus", "failed", "lastLogin", "createdAt", "createdBy", "action"];
  return `<div class="table-wrap account-table"><table><thead><tr>${headers.map((h) => `<th>${h === "action" ? t("admin.action") : t(`table.${h}`)}</th>`).join("")}</tr></thead><tbody>${accounts.map((a) => `<tr><td><button class="row-link" data-account-detail="${a.id}">${a.fullName}</button></td><td>${a.employeeCode}</td><td>${a.email}</td><td>${a.department}</td><td>${a.role}</td><td>${badge(a.accountStatus)}</td><td>${badge(a.passwordResetRequired ? "required" : "normal")}</td><td>${a.failedLoginAttempts}</td><td>${a.lastLoginAt || "-"}</td><td>${a.createdAt}</td><td>${a.createdBy}</td><td><div class="row-actions"><button class="btn btn-outline mini-action" data-account-detail="${a.id}">${t("admin.detail")}</button><button class="btn btn-outline mini-action" data-reset-account="${a.id}">${t("admin.resetPassword")}</button><button class="btn btn-outline mini-action" data-force-account="${a.id}">${t("admin.forcePassword")}</button></div></td></tr>`).join("")}</tbody></table></div>`;
}

function accountDrawer() {
  if (!accountDrawerOpen || !selectedAccountId) return "";
  const a = getAccountById(selectedAccountId);
  if (!a) return "";
  const logs = getSecurityAuditLog().filter((log) => !log.targetAccountId || log.targetAccountId === a.id || log.targetEmployeeName === a.fullName).slice(0, 5);
  const rows = [["fullName", a.fullName], ["code", a.employeeCode], ["email", a.email], ["role", a.role], ["department", a.department], ["position", a.position], ["accountStatus", badge(a.accountStatus)], ["passwordStatus", badge(a.passwordResetRequired ? "required" : "normal")], ["failed", a.failedLoginAttempts], ["lastLogin", a.lastLoginAt || "-"], ["lastFailedLogin", a.lastFailedLoginAt || "-"], ["lockedUntil", a.lockedUntil || "-"], ["createdBy", a.createdBy], ["updatedBy", a.updatedBy || "-"]];
  return `<div class="modal-backdrop open"><div class="card modal modal--large" role="dialog" aria-modal="true"><div class="modal-head"><div><h2>${escapeHtml(a.fullName)}</h2></div><button class="icon-btn" data-close-drawer>×</button></div><div class="profile-grid">${rows.map(([k, v]) => `<div class="profile-item"><span>${t(`table.${k}`)}</span><strong>${v}</strong></div>`).join("")}</div><div class="security-actions" style="margin-top:16px"><button class="btn btn-primary" data-reset-account="${a.id}">${t("admin.resetPassword")}</button><button class="btn btn-outline" data-force-account="${a.id}">${t("admin.forcePassword")}</button><button class="btn btn-outline" data-unlock-account="${a.id}">${t("admin.unlock")}</button><button class="btn btn-outline" data-disable-account="${a.id}">${t("admin.disable")}</button><button class="btn btn-outline" data-resend-account="${a.id}">${t("admin.resend")}</button></div><h3 style="margin-top:20px">${t("admin.auditLog")}</h3><div class="audit-list">${logs.map((l) => `<div><strong>${l.action}</strong><span>${l.createdAt} · ${l.description}</span></div>`).join("")}</div></div></div>`;
}

function deleteEmployeeModal() {
  if (!_deleteEmployeeId) return "";
  const name = escapeHtml(_deleteEmployeeName || _deleteEmployeeId);
  return `<div class="modal-backdrop open" role="dialog" aria-modal="true" aria-labelledby="delete-emp-title">
    <section class="modal modal--small modal--structured">
      <header class="modal__header">
        <div><h2 id="delete-emp-title">Xóa nhân viên</h2></div>
        <button class="icon-btn" data-close-delete-employee aria-label="Đóng">×</button>
      </header>
      <div class="modal__body">
        <p>Bạn có chắc muốn xóa nhân viên <strong>${name}</strong>?</p>
        <p style="color:#64748b;font-size:13px">Tài khoản sẽ không thể đăng nhập và sẽ bị ẩn khỏi danh sách nhân viên đang hoạt động. Lịch sử học tập vẫn được bảo lưu.</p>
      </div>
      <footer class="modal__footer">
        <button class="btn btn-outline" data-close-delete-employee>Hủy</button>
        <button class="btn btn-danger" data-confirm-delete-employee="${escapeHtmlAttribute(_deleteEmployeeId)}" ${_deleteEmployeeConfirming ? "disabled" : ""}>${_deleteEmployeeConfirming ? "Đang xóa..." : "Xóa nhân viên"}</button>
      </footer>
    </section>
  </div>`;
}

function resetPasswordModal() {
  if (!resetModalOpen || !resetTargetId) return "";
  const a = getAccountById(resetTargetId);
  if (!a) return "";
  return `<div class="modal-backdrop open"><form class="card modal" id="resetPasswordForm"><div class="modal-head"><div><h2>${t("modal.resetTitle")}</h2></div><button type="button" class="icon-btn" data-close-reset>x</button></div><div class="profile-grid"><div class="profile-item"><span>${t("table.fullName")}</span><strong>${a.fullName}</strong></div><div class="profile-item"><span>${t("table.code")}</span><strong>${a.employeeCode}</strong></div><div class="profile-item"><span>${t("table.email")}</span><strong>${a.email}</strong></div></div><div class="option-stack"><label><input type="radio" name="mode" value="auto" checked> ${t("modal.auto")}</label><label><input type="radio" name="mode" value="manual"> ${t("modal.manual")}</label><div class="field"><label>${t("admin.tempPassword")}</label><input name="manualPassword" placeholder="KIS@Temp2026"></div><label><input type="checkbox" name="notify" checked> ${t("modal.notify")}</label><label><input type="checkbox" name="require" checked> ${t("modal.require")}</label><label><input type="checkbox" name="unlock" checked> ${t("modal.unlock")}</label><div class="field"><label>${t("modal.note")}</label><textarea name="note" rows="3"></textarea></div></div>${temporaryPasswordResult ? `<div class="temp-password-box"><div><strong>${temporaryPasswordResult}</strong><p>${t("modal.oneTime")}</p></div><button class="btn btn-outline" type="button" data-copy-temp>${t("modal.copy")}</button></div>` : ""}<button class="btn btn-primary" type="submit" style="width:100%">${t("modal.confirm")}</button></form></div>`;
}

function auditTable() {
  return `<div class="table-wrap"><table><thead><tr><th>${t("admin.auditTime")}</th><th>${t("admin.auditActor")}</th><th>${t("admin.auditAction")}</th><th>${t("admin.auditTarget")}</th><th>${t("admin.auditResult")}</th></tr></thead><tbody>${getSecurityAuditLog().slice(0, 8).map((l) => `<tr><td>${l.createdAt}</td><td>${l.actorName}</td><td>${l.action}</td><td>${l.targetEmployeeName}</td><td>${l.result}</td></tr>`).join("")}</tbody></table></div>`;
}

function employeeEditModal() {
  if (!employeeEditOpen || !employeeEditId) return "";
  const a = getAccountById(employeeEditId);
  if (!a) return "";
  const depts = uniqueValues(getEmployees(), "department");
  const positions = uniqueValues(getEmployees(), "position");
  return `<div class="modal-backdrop open"><form id="employeeEditForm" class="modal modal--xlarge modal--structured" role="dialog" aria-modal="true">
    <header class="modal__header"><div><h2>${escapeHtml(a.fullName)}</h2></div><button type="button" class="icon-btn" data-close-employee-edit>×</button></header>
    <div class="modal__body"><div class="employee-form-grid"><section><h3>Thông tin cơ bản</h3><div class="form-2col">
      <div class="field"><label>Họ và tên *</label><input name="fullName" required value="${escapeHtmlAttribute(a.fullName||"")}"></div>
      <div class="field"><label>Mã nhân viên</label><input name="employeeCode" value="${escapeHtmlAttribute(a.employeeCode||"")}"></div>
      <div class="field"><label>Email *</label><input name="email" type="email" required value="${escapeHtmlAttribute(a.email||"")}"></div>
      <div class="field"><label>Số điện thoại</label><input name="phone" type="tel" value="${escapeHtmlAttribute(a.phone||"")}"></div>
      <div class="field"><label>Phòng ban</label><input name="department" list="edit-departments" value="${escapeHtmlAttribute(a.department||"")}"><datalist id="edit-departments">${depts.map(x=>`<option value="${escapeHtmlAttribute(x)}">`).join("")}</datalist></div>
      <div class="field"><label>Chức danh</label><input name="position" list="edit-positions" value="${escapeHtmlAttribute(a.position||"")}"><datalist id="edit-positions">${positions.map(x=>`<option value="${escapeHtmlAttribute(x)}">`).join("")}</datalist></div>
      <div class="field"><label>Ngày vào làm</label><input name="joined_date" type="date" value="${escapeHtmlAttribute(a.joinDate||"")}"></div>
      <div class="field"><label>Trạng thái tài khoản</label><select name="account_status">
        <option value="active" ${a.accountStatus==="active"?"selected":""}>Đang hoạt động</option>
        <option value="pendingActivation" ${a.accountStatus==="pendingActivation"?"selected":""}>Chờ kích hoạt</option>
        <option value="disabled" ${a.accountStatus==="disabled"?"selected":""}>Đã khóa</option>
        <option value="locked" ${a.accountStatus==="locked"?"selected":""}>Locked</option>
      </select></div>
      <div class="field"><label>Role</label><select name="role">
        <option value="employee" ${a.role==="employee"?"selected":""}>Employee</option>
        <option value="hr" ${a.role==="hr"?"selected":""}>HR</option>
        <option value="trainer" ${a.role==="trainer"?"selected":""}>Trainer</option>
      </select></div>
      <div class="field"><label>Quản lý trực tiếp</label><input name="manager_name" value="${escapeHtmlAttribute(a.managerName||"")}"></div>
      <div class="field"><label>Địa điểm làm việc</label><input name="location" value="${escapeHtmlAttribute(a.location||"")}"></div>
    </div></section>
    <aside><h3>Ghi chú</h3><div class="field"><textarea name="notes" rows="6">${escapeHtml(a.notes||"")}</textarea></div>
    <div class="field" style="margin-top:16px"><h3>Chứng chỉ / CCHN</h3><p style="color:#64748b;font-size:13px">Quản lý chứng chỉ của nhân viên này.</p><button type="button" class="btn btn-outline" data-open-certs="${escapeHtmlAttribute(employeeEditId)}">Mở quản lý chứng chỉ</button></div>
    </aside></div>
    <div class="field-error" id="employeeEditError" role="alert" style="margin-top:8px"></div></div>
    <footer class="modal__footer"><button type="button" class="btn btn-outline" data-close-employee-edit>Hủy</button><button type="submit" class="btn btn-primary" ${employeeEditSaving?"disabled":""}>${employeeEditSaving?"Đang lưu...":"Lưu thay đổi"}</button></footer>
  </form></div>`;
}

function certListHtml(certs, today, expiringSoon) {
  if (!certs.length) return "<div class=\"empty-state\"><p>Chưa có chứng chỉ nào.</p></div>";
  const rows = certs.map(c => {
    const expClass = expiringSoon(c.expiry_date) ? "text-warn" : (c.expiry_date && c.expiry_date < today ? "text-error" : "");
    const statusLabel = c.status === "valid" ? "Còn hiệu lực" : c.status === "expired" ? "Hết hạn" : c.status === "pending" ? "Chờ duyệt" : "Thu hồi";
    const statusClass = c.status === "valid" ? "active" : c.status === "expired" ? "disabled" : "pending";
    return `<tr><td><strong>${escapeHtml(c.name)}</strong>${c.certificate_number ? `<small>${escapeHtml(c.certificate_number)}</small>` : ""}</td><td>${escapeHtml(c.certificate_type||"")}</td><td>${escapeHtml(c.issuer||"")}</td><td>${escapeHtml(c.issue_date||"")}</td><td class="${expClass}">${escapeHtml(c.expiry_date||"—")}${expiringSoon(c.expiry_date)?" ⚠":""}</td><td><span class="badge ${statusClass}">${statusLabel}</span></td><td><div class="row-actions"><button class="btn btn-outline mini-action" data-edit-cert="${c.id}">Sửa</button><button class="btn btn-outline mini-action" data-revoke-cert="${c.id}">Thu hồi</button></div></td></tr>`;
  }).join("");
  return `<div class="table-wrap"><table><thead><tr><th>Tên chứng chỉ</th><th>Loại</th><th>Đơn vị cấp</th><th>Ngày cấp</th><th>Hết hạn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function certModal() {
  if (!certModalOpen || !certModalEmployeeId) return "";
  const a = getAccountById(certModalEmployeeId);
  const certs = _certList || [];
  const today = new Date().toISOString().slice(0,10);
  const expiringSoon = (d) => d && d > today && d < new Date(Date.now()+60*24*3600*1000).toISOString().slice(0,10);
  if (certEditOpen) {
    const cert = certs.find(c=>c.id===certEditId) || {};
    const isNew = !certEditId;
    return `<div class="modal-backdrop open"><form id="certEditForm" class="modal modal--large modal--structured" role="dialog" aria-modal="true">
      <header class="modal__header"><div><h2>${isNew?"Thêm chứng chỉ":"Sửa chứng chỉ"}</h2></div><button type="button" class="icon-btn" data-close-cert-edit>×</button></header>
      <div class="modal__body"><div class="form-2col">
        <div class="field"><label>Tên chứng chỉ *</label><input name="name" required value="${escapeHtmlAttribute(cert.name||"")}"></div>
        <div class="field"><label>Loại chứng chỉ *</label><input name="certificate_type" required value="${escapeHtmlAttribute(cert.certificate_type||"")}"></div>
        <div class="field"><label>Số chứng chỉ</label><input name="certificate_number" value="${escapeHtmlAttribute(cert.certificate_number||"")}"></div>
        <div class="field"><label>Đơn vị cấp *</label><input name="issuer" required value="${escapeHtmlAttribute(cert.issuer||"")}"></div>
        <div class="field"><label>Ngày cấp *</label><input name="issue_date" type="date" required value="${escapeHtmlAttribute(cert.issue_date||"")}"></div>
        <div class="field"><label>Ngày hết hạn</label><input name="expiry_date" type="date" value="${escapeHtmlAttribute(cert.expiry_date||"")}"></div>
        <div class="field"><label>Trạng thái</label><select name="status">
          <option value="valid" ${(cert.status||"valid")==="valid"?"selected":""}>Còn hiệu lực</option>
          <option value="expired" ${cert.status==="expired"?"selected":""}>Hết hạn</option>
          <option value="pending" ${cert.status==="pending"?"selected":""}>Chờ xét duyệt</option>
          <option value="revoked" ${cert.status==="revoked"?"selected":""}>Đã thu hồi</option>
        </select></div>
        <div class="field" style="grid-column:1/-1"><label>Link file minh chứng</label><input name="evidence_path" type="url" placeholder="https://..." value="${escapeHtmlAttribute(cert.evidence_path||"")}"></div>
        <div class="field" style="grid-column:1/-1"><label>Ghi chú</label><textarea name="notes" rows="2">${escapeHtml(cert.notes||"")}</textarea></div>
      </div>
      <div class="field-error" id="certEditError" role="alert" style="margin-top:8px"></div></div>
      <footer class="modal__footer"><button type="button" class="btn btn-outline" data-back-cert-list>← Danh sách</button><button type="submit" class="btn btn-primary" ${certSaving?"disabled":""}>${certSaving?"Đang lưu...":isNew?"Thêm chứng chỉ":"Lưu thay đổi"}</button></footer>
    </form></div>`;
  }
  return `<div class="modal-backdrop open"><section class="modal modal--large modal--structured" role="dialog" aria-modal="true">
    <header class="modal__header"><div><h2>Chứng chỉ / CCHN</h2></div><button class="icon-btn" data-close-cert-modal>×</button></header>
    <div class="modal__body">
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn btn-primary" data-add-cert>+ Thêm chứng chỉ</button></div>
      ${_certListLoading ? "<div class=\"empty-state\"><div class=\"spinner\"></div><p>Đang tải...</p></div>" : certListHtml(certs, today, expiringSoon)}
    </div>
    <footer class="modal__footer"><button class="btn btn-outline" data-close-cert-modal>Đóng</button></footer>
  </section></div>`;
}

async function loadCertsForEmployee(accountId) {
  if (!accountId) return;
  // Only reset list on initial load — keep existing data visible during refetch
  const certInitialLoad = !_certList.length;
  _certListLoading = true;
  if (certInitialLoad) render();
  try {
    const res = await fetch(`/api/employees/${encodeURIComponent(accountId)}/certifications`, {
      headers: {"X-Account-Id": session?.accountId||"", "X-Account-Role":"hr"}
    });
    const body = await res.json().catch(()=>({}));
    _certList = body.certifications || [];
  } catch { if (!_certList.length) _certList = []; }
  _certListLoading = false; render();
}

function employeesPage() {
  if (!hasAdminAccess()) return restrictedPage();
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("Admin", t("admin.employees"), "hr")}<div class="content">${hrEmployeeDirectory()}</div></main>${accountDrawer()}${employeeFormModal()}${employeeEditModal()}${certModal()}${deleteEmployeeModal()}</div>`;
}
function employeeFormModal(){if(!employeeFormOpen)return "";if(employeeCreateResult)return `<div class="modal-backdrop open"><section class="modal modal--large modal--structured" role="dialog" aria-modal="true"><header class="modal__header"><div><h2>Tài khoản đã được tạo</h2></div><button class="icon-btn" data-close-employee-form>×</button></header><div class="modal__body"><div class="creation-success"><p><strong>${escapeHtml(employeeCreateResult.account.fullName)}</strong></p><p>Email: ${escapeHtml(employeeCreateResult.account.email)}</p><div class="temp-password-box"><div><span>Mật khẩu tạm thời</span><strong>${escapeHtml(employeeCreateResult.temporaryPassword)}</strong></div><button class="btn btn-outline" data-copy-created-account>Sao chép thông tin</button></div><p>Nhân viên phải đổi mật khẩu trong lần đăng nhập đầu tiên. Hệ thống chưa gửi email tự động.</p></div></div><footer class="modal__footer"><button class="btn btn-primary" data-close-employee-form>Đóng</button><a class="btn btn-outline" href="/admin/assign?accountId=${employeeCreateResult.account.id}&open=1" data-link>Giao khóa onboarding</a></footer></section></div>`;return `<div class="modal-backdrop open"><form id="employeeCreateForm" class="modal modal--xlarge modal--structured" role="dialog" aria-modal="true" aria-labelledby="employee-form-title"><header class="modal__header"><div><h2 id="employee-form-title">Thêm nhân viên</h2></div><button type="button" class="icon-btn" data-close-employee-form>×</button></header><div class="modal__body"><div class="employee-form-grid"><section><h3>Thông tin bắt buộc</h3><div class="form-2col"><div class="field"><label>Mã nhân viên *</label><input name="employeeCode" required autocomplete="off"><span class="field-error" data-error-for="employeeCode"></span></div><div class="field"><label>Họ và tên *</label><input name="fullName" required></div><div class="field"><label>Email công ty *</label><input name="email" type="email" required></div><div class="field"><label>Ngày vào làm</label><input name="joinDate" type="date"></div><div class="field"><label>Phòng ban *</label><input name="department" list="departments" required><datalist id="departments">${uniqueValues(_apiEmployees,"department").map(x=>`<option value="${escapeHtmlAttribute(x)}">`).join("")}</datalist></div><div class="field"><label>Chức danh *</label><input name="position" list="positions" required><datalist id="positions">${uniqueValues(_apiEmployees,"position").map(x=>`<option value="${escapeHtmlAttribute(x)}">`).join("")}</datalist></div><div class="field"><label>Ngôn ngữ mặc định</label><select name="defaultLanguage"><option value="vi">VI</option><option value="en">EN</option><option value="kr">KR</option></select></div><div class="field"><label>Trạng thái</label><select name="accountStatus"><option value="active">Kích hoạt</option><option value="pendingActivation">Chờ kích hoạt</option></select></div></div></section><aside><h3>Ảnh đại diện</h3><label class="employee-photo-drop" for="newEmployeePhoto"><span class="employee-photo-preview">Ảnh</span><strong>Chọn hoặc thả ảnh vào đây</strong><small>JPG, PNG, WebP · tối đa 5 MB</small></label><input id="newEmployeePhoto" name="photo" type="file" accept="image/jpeg,image/png,image/webp" hidden><div class="field"><label>Quản lý trực tiếp</label><input name="managerName"></div><div class="field"><label>Địa điểm làm việc</label><input name="location"></div><div class="field"><label>Ghi chú</label><textarea name="notes" rows="3"></textarea></div></aside></div><p class="form-note">Role được cố định là Employee. Mật khẩu tạm thời chỉ hiển thị một lần sau khi tạo.</p><div class="field-error" data-employee-form-error role="alert"></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-close-employee-form>Hủy</button><button type="submit" class="btn btn-primary">Tạo hồ sơ & tài khoản</button></footer></form></div>`;}

function employeeTable() {
  return employeeDirectoryTable(filteredEmployeeDirectory().slice(0, 15));
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function normalizeYoutubeId(input) {
  if (!input) return "";
  const s = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : s;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value);
}

function filteredCourses() {
  const searchValue = String(courseSearch || "").trim().toLocaleLowerCase("vi");
  return getCourses().filter((course) => {
    const title = String(course.title || "").toLocaleLowerCase("vi");
    const description = String(course.description || "").toLocaleLowerCase("vi");
    return (!searchValue || title.includes(searchValue) || description.includes(searchValue))
      && (!courseFilterCategory || course.category === courseFilterCategory)
      && (!courseFilterStatus || course.status === courseFilterStatus);
  });
}

function courseStatusBadge(status) {
  if (status === "published") return badge("active");
  if (status === "archived") return badge("disabled");
  return badge("notStarted");
}

function courseDeliveryModeLabel(course) {
  const raw = course.deliveryMode || course.format || course.delivery_mode || "";
  if (!raw) return "—";
  const map = { online: "Online", offline: "Offline", hybrid: "Hybrid", Online: "Online", Offline: "Offline", Hybrid: "Hybrid" };
  return map[raw] || raw;
}

function courseTable(courseItems) {
  if (!courseItems.length) return `<div class="empty-state"><h3>Chưa có khóa học phù hợp</h3><p>Thay đổi bộ lọc hoặc thêm khóa học mới.</p></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>STT</th><th>${t("course.title")}</th><th>${t("course.category")}</th><th>Hình thức</th><th>${t("course.duration")}</th><th>${t("course.status")}</th><th>${t("table.createdAt")}</th><th>${t("admin.action")}</th></tr></thead><tbody>${courseItems.map((course, index) => {
    const duration = Number(course.durationHours ?? course.duration_hours);
    const createdAt = course.createdAt || course.created_at || "";
    const deliveryLabel = courseDeliveryModeLabel(course);
    const deleting = _courseDeletingIds.has(course.id);
    return `<tr data-course-row="${escapeHtmlAttribute(course.id)}"><td>${index + 1}</td><td><strong>${escapeHtml(course.title || course.name || "—")}</strong></td><td>${escapeHtml(course.category || "—")}</td><td>${escapeHtml(deliveryLabel)}</td><td>${Number.isFinite(duration) && duration > 0 ? `${duration}h` : "—"}</td><td>${courseStatusBadge(course.status)}</td><td>${escapeHtml(createdAt ? formatDate(createdAt) : "—")}</td><td><div class="row-actions"><a href="/admin/courses/${escapeHtmlAttribute(course.id)}" data-link class="btn btn-outline mini-action">${t("admin.detail")}</a><button type="button" class="btn btn-outline mini-action" data-course-edit="${escapeHtmlAttribute(course.id)}" ${deleting ? "disabled" : ""}>${t("course.edit")}</button><button type="button" class="btn btn-outline mini-action danger-action ${deleting ? "loading" : ""}" data-course-delete="${escapeHtmlAttribute(course.id)}" data-course-title="${escapeHtmlAttribute(course.title || course.name || course.id)}" aria-label="Xóa khóa học ${escapeHtmlAttribute(course.title || course.name || course.id)}" aria-busy="${deleting}" ${deleting ? "disabled" : ""}>${deleting ? "Đang xóa..." : "Xóa"}</button></div></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderCourseResults() {
  const target = document.getElementById("courseResults");
  if (!target) return;
  target.innerHTML = courseTable(filteredCourses());
  bindCourseResultEvents(target);
}

function bindCourseResultEvents(root = document) {
  root.querySelectorAll("[data-link]").forEach((el) => el.addEventListener("click", (event) => { event.preventDefault(); navigate(el.getAttribute("href")); }));
  root.querySelectorAll("[data-course-edit]").forEach((el) => el.addEventListener("click", () => { selectedCourseId = el.dataset.courseEdit; courseFormMode = "edit"; courseDrawerOpen = false; render(); }));
  root.querySelectorAll("[data-course-delete]").forEach((el) => el.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteCourseImmediately(el.dataset.courseDelete, el.dataset.courseTitle || "");
  }));
}

async function deleteCourseImmediately(courseId, title = "") {
  if (!courseId || _courseDeletingIds.has(courseId)) return;
  _courseDeletingIds = new Set([..._courseDeletingIds, courseId]);
  renderCourseResults();
  try {
    const res = await fetch(`/api/courses?id=${encodeURIComponent(courseId)}&force=true`, {
      method: "DELETE",
      headers: apiHeaders({ "Content-Type": "application/json" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) throw new Error(body.error || "delete_failed");

    const verifyRes = await fetch(`/api/courses/impact?id=${encodeURIComponent(courseId)}`, { headers: apiHeaders() }).catch(() => null);
    if (verifyRes && verifyRes.status !== 404) {
      const verifyBody = await verifyRes.json().catch(() => ({}));
      if (verifyBody.ok) throw new Error("Khóa học vẫn còn tồn tại sau khi xóa. Vui lòng thử lại.");
    }

    deleteCourse(courseId);
    if (Array.isArray(_courses)) _courses = _courses.filter((course) => course.id !== courseId);
    try {
      const { localStorageAdapter } = await import("./lib/storage/localStorageAdapter.js");
      const cached = localStorageAdapter.read("mykis.courses.v1", []);
      localStorageAdapter.write("mykis.courses.v1", cached.filter((course) => course.id !== courseId));
    } catch {}
    if (selectedCourseId === courseId) { selectedCourseId = ""; courseDrawerOpen = false; courseFormMode = ""; }
    toast("Đã xóa khóa học");
    renderCourseResults();
    fetchCoursesFromApi(session.accountId, session.role);
  } catch (err) {
    console.error("[delete-course]", err?.message);
    toast(err?.message || "Xóa thất bại. Vui lòng thử lại.");
  } finally {
    _courseDeletingIds = new Set([..._courseDeletingIds].filter((id) => id !== courseId));
    renderCourseResults();
  }
}

function courseDrawer() {
  const course = getCourseById(selectedCourseId);
  if (!course) return "";
  const enrollments = getEnrollmentsByCourseId(course.id);
  const content = getCourseContent(course.id);
  const contentRows = content.map((item,i) => `<div class="course-line" style="gap:8px;align-items:center"><div style="flex:1;min-width:0"><strong>${escapeHtml(item.title || "—")}</strong><small>${item.type==="quiz"?t("content.quizType"):item.type==="video"?t("content.videoType"):t("content.slideType")} · ${item.required?t("content.required"):t("content.optional")} · ${item.minimumDurationSeconds||0}s min</small></div><div style="display:flex;gap:4px"><button type="button" class="btn btn-outline mini-action" data-content-move-up="${escapeHtmlAttribute(item.id)}" ${i===0?"disabled":""}>↑</button><button type="button" class="btn btn-outline mini-action" data-content-move-down="${escapeHtmlAttribute(item.id)}" ${i===content.length-1?"disabled":""}>↓</button><button type="button" class="btn btn-outline mini-action" data-content-edit="${escapeHtmlAttribute(item.id)}">${t("course.edit")}</button><button type="button" class="btn btn-outline mini-action" data-content-delete="${escapeHtmlAttribute(item.id)}">${t("course.delete")}</button></div></div>`).join("");

  const dur = Number(course.durationHours ?? course.duration_hours);
  const createdAt = course.createdAt || course.created_at || "";
  const createdBy = course.createdBy || course.created_by || "";
  const deliveryLabel = courseDeliveryModeLabel(course);

  const rows = [
    ["Danh mục", course.category || "—"],
    ["Hình thức", deliveryLabel],
    ["Thời lượng", Number.isFinite(dur) && dur > 0 ? `${dur}h` : "—"],
    [t("course.status"), courseStatusBadge(course.status)],
    [t("table.createdAt"), createdAt ? formatDate(createdAt) : "—"],
    ["Người tạo", createdBy || "—"],
  ];

  const enrolleeRows = enrollments.map((enrollment) => {
    const account = getAccountById(enrollment.accountId);
    const displayName = account?.fullName || account?.full_name
      ? escapeHtml(account.fullName || account.full_name)
      : `<span style="color:var(--muted);font-size:12px">${escapeHtml(enrollment.accountId)}</span>`;
    const prog = calculateCourseProgress({accountId:enrollment.accountId,courseId:course.id});
    return `<tr><td>${displayName}</td><td>${badge(enrollment.status)}</td><td>${prog.percent}%</td></tr>`;
  }).join("");

  return `<div class="modal-backdrop open"><div class="card modal modal--large" role="dialog" aria-modal="true" aria-labelledby="course-drawer-title"><div class="modal-head"><div><h2 id="course-drawer-title">${escapeHtml(course.title || course.name || "—")}</h2></div><button type="button" class="icon-btn" aria-label="Đóng" data-close-course-drawer>×</button></div><div class="modal-col-layout"><div class="modal-col"><div class="profile-grid">${rows.map(([label, value]) => `<div class="profile-item"><span>${escapeHtml(label)}</span><strong>${typeof value === "string" && value.startsWith("<") ? value : escapeHtml(String(value))}</strong></div>`).join("")}</div><div class="card" style="margin-top:16px"><h3>${t("course.description")}</h3><p>${escapeHtml(course.description || "—")}</p></div><div class="security-actions" style="margin-top:16px"><button type="button" class="btn btn-primary" data-course-edit="${escapeHtmlAttribute(course.id)}">${t("content.editInfo")}</button><a class="btn btn-outline" href="/admin/assign?courseId=${encodeURIComponent(course.id)}&open=1" data-link>${t("enrollment.assign")}</a><button type="button" class="btn btn-outline" style="color:var(--color-danger,#e53e3e);border-color:var(--color-danger,#e53e3e)" data-course-delete="${escapeHtmlAttribute(course.id)}">Xóa khóa học</button></div></div><div class="modal-col"><div class="panel-head"><h3>${t("content.title")} (${content.length})</h3><button type="button" class="btn btn-primary" data-content-add>${t("content.add")}</button></div><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${content.length ? contentRows : `<p style="color:var(--muted,#718096)">${t("content.noContent")}</p>`}</div><h3 style="margin-top:20px">${t("content.enrolledEmployees")} (${enrollments.length})</h3>${enrollments.length ? `<div class="table-wrap"><table><thead><tr><th>${t("table.fullName")}</th><th>${t("table.status")}</th><th>${t("enrollment.progress")}</th></tr></thead><tbody>${enrolleeRows}</tbody></table></div>` : `<p>${t("content.noEnrolled")}</p>`}</div></div></div></div>`;
}

function courseDetailPage(courseId) {
  const course = getCourseById(courseId);
  const content = getCourseContent(courseId);
  const allEnrollments = _enrollments || [];
  const courseEnrollments = allEnrollments.filter(e => (e.courseId || e.course_id) === courseId);

  if (_coursesLoading && !course) {
    return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D", t("course.manage"), "hr")}<div class="content"><div class="card"><div class="hr-overview-skeleton">${Array(3).fill("<span></span>").join("")}</div></div></div></main></div>`;
  }
  if (!course) {
    return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D", t("course.manage"), "hr")}<div class="content"><div class="card empty-state"><h2>Không tìm thấy khóa học</h2><p>ID: ${escapeHtml(courseId)}</p><a class="btn btn-primary" href="/admin/courses" data-link>← Quay lại</a></div></div></main></div>`;
  }

  const safeVal = (v, fallback) => { const fb = fallback !== undefined ? fallback : "—"; if (v === null || v === undefined || v === "") return fb; return escapeHtml(String(v)); };
  const dur = Number(course.durationHours ?? (course.duration_minutes ? course.duration_minutes / 60 : 0));
  const tabs = [["overview", "Tổng quan"], ["content", "Nội dung"], ["learners", "Người học"]];
  const activeTab = courseDetailTab || "overview";

  const overviewTab = `
    <div class="profile-grid">
      <div class="profile-item"><span>Danh mục</span><strong>${safeVal(course.category)}</strong></div>
      <div class="profile-item"><span>Hình thức</span><strong>${safeVal(courseDeliveryModeLabel(course))}</strong></div>
      <div class="profile-item"><span>Thời lượng</span><strong>${Number.isFinite(dur) && dur > 0 ? dur + "h" : "—"}</strong></div>
      <div class="profile-item"><span>Trạng thái</span><strong>${courseStatusBadge(course.status)}</strong></div>
      <div class="profile-item"><span>Ngày tạo</span><strong>${safeVal(course.createdAt || course.created_at ? formatDate(course.createdAt || course.created_at) : null)}</strong></div>
      <div class="profile-item"><span>Cập nhật</span><strong>${safeVal(course.updatedAt || course.updated_at ? formatDate(course.updatedAt || course.updated_at) : null)}</strong></div>
    </div>
    <div class="card" style="margin-top:16px"><h3>${t("course.description")}</h3><p>${safeVal(course.description, "Chưa có mô tả.")}</p></div>`;

  const contentRows = content.map((item, i) => `
    <div class="course-line" style="gap:8px;align-items:center">
      <div style="flex:1;min-width:0"><strong>${escapeHtml(item.title || "—")}</strong><small>${item.type === "quiz" ? t("content.quizType") : item.type === "video" ? t("content.videoType") : t("content.slideType")} · ${item.required ? t("content.required") : t("content.optional")}</small></div>
      <div style="display:flex;gap:4px">
        <button type="button" class="btn btn-outline mini-action" data-content-move-up="${escapeHtmlAttribute(item.id)}" ${i === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="btn btn-outline mini-action" data-content-move-down="${escapeHtmlAttribute(item.id)}" ${i === content.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" class="btn btn-outline mini-action" data-content-edit="${escapeHtmlAttribute(item.id)}">${t("course.edit")}</button>
        <button type="button" class="btn btn-outline mini-action" data-content-delete="${escapeHtmlAttribute(item.id)}">${t("course.delete")}</button>
      </div>
    </div>`).join("");

  const contentTab = `
    <div class="panel-head">
      <div><h3>${t("content.title")}</h3><span class="badge">${content.length} nội dung</span></div>
      <button type="button" class="btn btn-primary" data-content-add>${t("content.add")}</button>
    </div>
    ${content.length ? `<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">${contentRows}</div>` : `<div class="empty-state"><h3>${t("content.noContent")}</h3><p>Chưa có nội dung. Bấm "+ Thêm nội dung" để bắt đầu.</p></div>`}`;

  const learnerRows = courseEnrollments.map(e => {
    const acct = getAccountById(e.accountId || e.account_id);
    const empName = acct?.fullName || acct?.full_name || e.accountId || e.account_id || "—";
    const dept = acct?.department || "—";
    const prog = calculateCourseProgress({ accountId: e.accountId || e.account_id, courseId });
    return `<tr><td><strong>${escapeHtml(empName)}</strong></td><td>${escapeHtml(dept)}</td><td>${badge(e.status)}</td><td>${prog.percent}%</td></tr>`;
  }).join("");

  const learnersTab = courseEnrollments.length
    ? `<div class="table-wrap"><table><thead><tr><th>Nhân viên</th><th>Phòng ban</th><th>Trạng thái</th><th>Tiến độ</th></tr></thead><tbody>${learnerRows}</tbody></table></div>`
    : `<div class="empty-state"><h3>Chưa có người học</h3><p>Chưa có nhân viên nào được giao khóa học này.</p><a class="btn btn-primary" href="/admin/assign?courseId=${encodeURIComponent(courseId)}&open=1" data-link>${t("enrollment.assign")}</a></div>`;

  const tabContent = activeTab === "content" ? contentTab : activeTab === "learners" ? learnersTab : overviewTab;

  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D", t("course.manage"), "hr")}<div class="content">
    <nav class="breadcrumb" aria-label="Breadcrumb" style="margin-bottom:8px"><a href="/admin/courses" data-link class="breadcrumb-link">${t("course.manage")}</a><span aria-hidden="true"> › </span><span>${escapeHtml(course.title || course.name || courseId)}</span></nav>
    <section class="card panel">
      <div class="account-toolbar">
        <div><h1 style="font-size:1.4rem;margin:0">${escapeHtml(course.title || course.name || "—")}</h1><div style="margin-top:6px">${courseStatusBadge(course.status)}</div></div>
        <div class="security-actions">
          <button type="button" class="btn btn-outline" data-course-edit="${escapeHtmlAttribute(courseId)}">${t("content.editInfo")}</button>
          <a class="btn btn-outline" href="/admin/assign?courseId=${encodeURIComponent(courseId)}&open=1" data-link>${t("enrollment.assign")}</a>
          <button type="button" class="btn btn-outline" style="color:var(--color-danger,#e53e3e);border-color:currentColor" data-course-delete="${escapeHtmlAttribute(courseId)}">Xóa</button>
        </div>
      </div>
      <div class="detail-tabs" role="tablist" style="margin-top:16px;display:flex;gap:4px;border-bottom:1px solid var(--border,#e2e8f0)">
        ${tabs.map(([id, label]) => `<button role="tab" aria-selected="${activeTab === id}" class="btn ${activeTab === id ? "btn-primary" : "btn-ghost"}" style="border-radius:4px 4px 0 0;border-bottom:none" data-course-detail-tab="${id}">${label}</button>`).join("")}
      </div>
      <div style="margin-top:16px">${tabContent}</div>
    </section>
  </div>${courseFormMode ? courseFormModal() : ""}${contentBuilderMode ? contentItemForm() : ""}</main></div>`;
}

function contentItemForm() {
  if (!contentBuilderMode) return "";
  const isEdit = contentBuilderMode === "edit";
  const item = isEdit ? getCourseContent(selectedCourseId).find(x => x.id === selectedContentId) : null;
  if (isEdit && item) {
    if (item.type === "video") return contentYoutubeForm(item);
    if (item.type === "quiz") return contentQuizPickForm();
    return contentSlideOrTextForm(item);
  }
  if (contentPickerStep === "type") return contentTypePicker();
  if (contentPickerStep === "slide") return contentSlideOrTextForm(null);
  if (contentPickerStep === "youtube") return contentYoutubeForm(null);
  if (contentPickerStep === "quiz-pick") return contentQuizPickForm();
  if (contentPickerStep === "text") return contentSlideOrTextForm(null, true);
  return contentTypePicker();
}

function updateYtPreview(rawUrl) {
  const vid = normalizeYoutubeId(rawUrl || "");
  const errEl = document.getElementById("ytUrlError");
  const previewWrap = document.getElementById("ytPreviewWrap");
  const vidIdEl = document.getElementById("ytVideoIdDisplay");
  if (!rawUrl || !rawUrl.trim()) {
    if (errEl) { errEl.textContent=""; errEl.classList.remove("show"); }
    if (previewWrap) previewWrap.innerHTML = `<p style="color:var(--muted);text-align:center;padding:20px;font-size:13px">${t("contentType.preview")}</p>`;
    if (vidIdEl) vidIdEl.textContent = "";
    return;
  }
  if (!vid || !/^[a-zA-Z0-9_-]{11}$/.test(vid)) {
    if (errEl) { errEl.textContent = "URL YouTube không hợp lệ"; errEl.classList.add("show"); }
    if (previewWrap) previewWrap.innerHTML = "";
    if (vidIdEl) vidIdEl.textContent = "";
    return;
  }
  if (errEl) { errEl.textContent=""; errEl.classList.remove("show"); }
  if (vidIdEl) vidIdEl.innerHTML = `Video ID: <code style="background:#e8edf3;padding:2px 6px;border-radius:4px">${escapeHtml(vid)}</code>`;
  if (previewWrap) previewWrap.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(vid)}" loading="lazy" allowfullscreen></iframe>`;
}

function renderQuizPickResults() {
  const container = document.getElementById("quizPickResults");
  if (!container) return;
  const allQ = getQuizzes();
  const q = quizPickSearch.trim().toLowerCase();
  const filtered = (q ? allQ.filter(x => (x.title||"").toLowerCase().includes(q) || (x.description||"").toLowerCase().includes(q)) : allQ).slice(0, 60);
  if (!filtered.length) { container.innerHTML = `<p style="color:var(--muted);text-align:center;padding:16px">${t("contentType.noResults")}</p>`; return; }
  container.innerHTML = filtered.map(quiz => `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="flex:1;min-width:0"><strong style="font-size:13px">${escapeHtml(quiz.title)}</strong><div style="font-size:11px;color:var(--muted);margin-top:2px">${(quiz.questions||[]).length} câu · Điểm đạt: ${quiz.passingScore||70}% · ${quiz.timeLimitMinutes||20} phút</div></div><button type="button" class="btn btn-primary mini-action" data-select-quiz-for-content="${escapeHtmlAttribute(quiz.id)}">${t("contentType.select")}</button></div>`).join("");
  container.querySelectorAll("[data-select-quiz-for-content]").forEach(el => el.addEventListener("click", () => {
    const quiz = getQuizById(el.dataset.selectQuizForContent);
    if (!quiz) return toast("error");
    const payload = { courseId: selectedCourseId, title: quiz.title, type: "quiz", quizId: quiz.id, required: true, completionWeight: 1, completionRule: { requirePass: true } };
    const result = createCourseContent(payload);
    if (!result) return toast("error");
    contentBuilderMode=""; selectedContentId=""; contentPickerStep="type"; quizPickSearch="";
    toast("success"); render();
  }));
}

function contentTypePicker() {
  const types = [
    { key:"slide", icon:"📄", label:t("contentType.slide"), desc:t("contentType.slideDesc") },
    { key:"youtube", icon:"▶️", label:t("contentType.youtube"), desc:t("contentType.youtubeDesc") },
    { key:"quiz-pick", icon:"❓", label:t("contentType.quiz"), desc:t("contentType.quizDesc") },
    // "text" (Bài đọc văn bản) intentionally removed per product decision
  ];
  return `<div class="modal-backdrop open"><section class="modal modal--medium modal--structured" role="dialog" aria-modal="true" aria-labelledby="ct-title"><header class="modal__header"><div><h2 id="ct-title">${t("contentType.selectType")}</h2></div><button type="button" class="icon-btn" data-content-form-close>×</button></header><div class="modal__body"><div class="content-type-grid">${types.map(tp=>`<button type="button" class="ct-card" data-pick-content-type="${tp.key}"><span class="ct-icon">${tp.icon}</span><span class="ct-label">${tp.label}</span><span class="ct-desc">${tp.desc}</span></button>`).join("")}</div></div></section></div>`;
}

function contentYoutubeForm(item) {
  const vid = item?.youtubeVideoId || youtubeDraft?.videoId || "";
  const titleVal = escapeHtmlAttribute(item?.title || youtubeDraft?.title || "");
  const urlVal = escapeHtmlAttribute(vid ? `https://youtu.be/${vid}` : youtubeDraft?.url || "");
  return `<div class="modal-backdrop open"><form class="modal modal--large modal--structured" id="contentYoutubeForm" role="dialog" aria-modal="true" aria-labelledby="yt-title" novalidate><header class="modal__header"><div><h2 id="yt-title">${t("contentType.youtube")}</h2></div><button type="button" class="icon-btn" data-content-form-close>×</button></header><div class="modal__body"><div class="field"><label>${t("course.title")} <span style="color:#c0392b">*</span></label><input id="ytTitleInput" name="title" value="${titleVal}" required autocomplete="off" data-focus-key="yt-title" placeholder="Tên bài học..."></div><div class="field"><label>URL YouTube <span style="color:#c0392b">*</span></label><input id="ytUrlInput" name="youtubeUrl" value="${urlVal}" placeholder="https://www.youtube.com/watch?v=... hoặc youtu.be/..." autocomplete="off" data-focus-key="yt-url"><div id="ytUrlError" class="field-error"></div><div id="ytVideoIdDisplay" style="font-size:12px;color:var(--muted);margin-top:4px"></div></div><div id="ytPreviewWrap" class="yt-preview-wrap" style="max-width:480px"><p style="color:var(--muted);text-align:center;padding:20px;font-size:13px">Nhập URL để xem preview</p></div><div class="form-2col" style="margin-top:14px"><div class="field"><label><input type="checkbox" name="required" ${item?.required!==false?"checked":""}> ${t("content.requiredCheck")}</label></div><div class="field"><label>${t("content.weight")}</label><input name="completionWeight" type="number" min="0.1" step="0.1" value="${item?.completionWeight??1}"></div></div><div class="form-2col"><div class="field"><label>${t("content.requiredPercent")} (%)</label><input name="requiredPercent" type="number" min="0" max="100" value="${item?.completionRule?.requiredPercent??90}"></div><div class="field"><label>${t("content.minDuration")} (s)</label><input name="minimumDurationSeconds" type="number" min="0" value="${item?.minimumDurationSeconds||0}"></div></div><div class="field"><label>${t("content.transcript")}</label><textarea name="transcript" rows="2" data-focus-key="yt-transcript">${escapeHtml(item?.transcript||"")}</textarea></div><div class="field"><label><input type="checkbox" name="transcriptAlternativeAllowed" ${item?.transcriptAlternativeAllowed!==false?"checked":""}> ${t("content.transcriptAllowed")}</label></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-content-form-close>${t("content.cancel")}</button><button type="button" class="btn btn-outline" id="ytUseSample">${t("contentType.useSampleVideo")}</button><button type="submit" class="btn btn-primary">${t("content.save")}</button></footer></form></div>`;
}

function contentSlideOrTextForm(item, isText) {
  const sd = slideDraft;
  const thumbs = sd?.thumbs || [];
  const showText = isText || (item && !item.blobId && item.slideContent);

  const thumbHtml = thumbs.length ? `<div class="slide-thumb-grid">${thumbs.map((u,i)=>`<div class="slide-thumb"><img src="${escapeHtmlAttribute(u)}" alt="${i+1}"><span class="sn">${i+1}</span></div>`).join("")}</div>` : "";

  const fileSection = !showText ? `<div class="drop-zone" id="slideDropZone" tabindex="0"><span class="drop-zone-icon">📂</span><strong>${t("contentType.dropOrBrowse")}</strong><br><small style="color:var(--muted)">${t("contentType.slideAccept")}</small><input type="file" id="slideFileInput" accept=".pdf,.pptx,.png,.jpg,.jpeg,.webp" multiple style="display:none"></div>${sd?.fileName?`<div class="file-info-box"><span class="fi-icon">📄</span><div><div class="fi-name">${escapeHtml(sd.fileName)}</div><div class="fi-meta">${sd.fileSize} · ${sd.fileType}${sd.pageCount&&sd.pageCount!=="?"?` · ${sd.pageCount} ${t("contentType.pages")}`:""}</div>${sd.pptxWarning?`<div style="color:#e67e22;font-size:12px;margin-top:4px">${t("contentType.pptxNote")}</div>`:""}</div></div>${thumbHtml}`:""}` : "";

  const textSection = showText ? `<div class="field"><label>Nội dung bài đọc</label><textarea name="slideContent" rows="10" data-focus-key="slide-text">${escapeHtml(item?.slideContent||"")}</textarea></div>` : "";

  return `<div class="modal-backdrop open"><form class="modal modal--large modal--structured" id="contentSlideForm" role="dialog" aria-modal="true" aria-labelledby="slide-title" novalidate><header class="modal__header"><div><h2 id="slide-title">${showText?t("contentType.text"):t("contentType.slide")}</h2></div><button type="button" class="icon-btn" data-content-form-close>×</button></header><div class="modal__body"><div class="field"><label>${t("course.title")} <span style="color:#c0392b">*</span></label><input id="slideTitleInput" name="title" value="${escapeHtmlAttribute(item?.title||sd?.title||"")}" required autocomplete="off" data-focus-key="slide-title-inp" placeholder="Tên bài học..."><input type="hidden" name="type" value="slide"><input type="hidden" name="isText" value="${showText?'1':'0'}"></div><div class="field"><label>${t("course.description")}</label><textarea name="description" rows="2" data-focus-key="slide-desc">${escapeHtml(item?.slideContent&&!showText?item.slideContent:"")}</textarea></div>${fileSection}${textSection}<div id="slideError" class="field-error"></div><div class="form-2col" style="margin-top:12px"><div class="field"><label>${t("content.minDuration")} (s)</label><input name="minimumDurationSeconds" type="number" min="0" value="${item?.minimumDurationSeconds||sd?.minDuration||8}"></div><div class="field"><label>${t("content.weight")}</label><input name="completionWeight" type="number" min="0.1" step="0.1" value="${item?.completionWeight||1}"></div></div><div class="field"><label><input type="checkbox" name="required" ${item?.required!==false?"checked":""}> ${t("content.requiredCheck")}</label></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-content-form-close>${t("content.cancel")}</button><button type="submit" class="btn btn-primary">${t("content.save")}</button></footer></form></div>`;
}

function contentQuizPickForm() {
  const allQ = getQuizzes();
  const filtered = quizPickSearch.trim() ? allQ.filter(x=>(x.title||"").toLowerCase().includes(quizPickSearch.toLowerCase())) : allQ.slice(0,60);
  return `<div class="modal-backdrop open"><section class="modal modal--large modal--structured" role="dialog" aria-modal="true" aria-labelledby="qpick-title"><header class="modal__header"><div><h2 id="qpick-title">${t("contentType.quiz")}</h2></div><button type="button" class="icon-btn" data-content-form-close>×</button></header><div class="modal__body"><div class="quiz-pick-tabs"><button type="button" class="quiz-pick-tab active">${t("contentType.pickExisting")}</button><a href="/admin/quizzes" data-link class="quiz-pick-tab" style="text-decoration:none">${t("contentType.createNew")} →</a></div><div class="field"><input id="quizPickSearchInput" data-focus-key="quiz-pick-search" placeholder="${t("admin.search")}" value="${escapeHtmlAttribute(quizPickSearch)}" autocomplete="off"></div><div id="quizPickResults">${filtered.length?filtered.map(quiz=>`<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><div style="flex:1;min-width:0"><strong style="font-size:13px">${escapeHtml(quiz.title)}</strong><div style="font-size:11px;color:var(--muted);margin-top:2px">${(quiz.questions||[]).length} câu · ${quiz.passingScore||70}% · ${quiz.timeLimitMinutes||20} phút</div></div><button type="button" class="btn btn-primary mini-action" data-select-quiz-for-content="${escapeHtmlAttribute(quiz.id)}">${t("contentType.select")}</button></div>`).join("") : `<p style="color:var(--muted);text-align:center;padding:16px">${t("contentType.noResults")}</p>`}</div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-content-form-close>${t("content.cancel")}</button></footer></section></div>`;
}

async function handleSlideFiles(files) {
  if (!files || !files.length) return;
  const errEl = document.getElementById("slideError");
  const LIMIT = 50 * 1024 * 1024;
  const file = files[0];
  const ext = file.name.split(".").pop().toLowerCase();

  if (!["pdf","pptx","png","jpg","jpeg","webp"].includes(ext)) {
    if (errEl) { errEl.textContent = t("contentType.fileInvalid"); errEl.classList.add("show"); } return;
  }
  if (file.size > LIMIT) {
    if (errEl) { errEl.textContent = t("contentType.fileTooLarge"); errEl.classList.add("show"); } return;
  }
  if (errEl) { errEl.textContent=""; errEl.classList.remove("show"); }

  slideDraft = {
    file, fileName: file.name,
    fileSize: `${(file.size/1024/1024).toFixed(1)} MB`,
    fileType: ext.toUpperCase(),
    pageCount: 1, thumbs: [],
    title: file.name.replace(/\.[^.]+$/, ""),
    minDuration: 8, weight: 1,
  };

  const titleInput = document.getElementById("slideTitleInput");
  if (titleInput && !titleInput.value) titleInput.value = slideDraft.title;

  if (["png","jpg","jpeg","webp"].includes(ext)) {
    for (const f of Array.from(files)) {
      const fext = f.name.split(".").pop().toLowerCase();
      if (!["png","jpg","jpeg","webp"].includes(fext)) continue;
      slideDraft.thumbs.push(URL.createObjectURL(f));
    }
    slideDraft.pageCount = slideDraft.thumbs.length;
    if (files.length > 1) slideDraft.fileName = `${files.length} ảnh`;
    render();
    return;
  }

  if (ext === "pptx") {
    slideDraft.pageCount = "?";
    slideDraft.pptxWarning = true;
    render();
    return;
  }

  if (ext === "pdf") {
    render();
    await renderPdfThumbs(file);
  }
}

async function renderPdfThumbs(file) {
  try {
    if (!window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    }
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    if (slideDraft) { slideDraft.pageCount = pdf.numPages; slideDraft.thumbs = []; }
    const maxThumbs = Math.min(pdf.numPages, 12);
    for (let i = 1; i <= maxThumbs; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 0.3 });
      const canvas = document.createElement("canvas");
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
      if (slideDraft) slideDraft.thumbs.push(canvas.toDataURL("image/jpeg", 0.7));
    }
    render();
  } catch (err) {
    const errEl = document.getElementById("slideError");
    if (errEl) { errEl.textContent = t("contentType.fileReadError"); errEl.classList.add("show"); }
  }
}

function courseFormModal() {
  const course = courseFormMode === "edit" ? getCourseById(selectedCourseId) : null;
  if (courseFormMode === "edit" && !course) return "";
  const value = (field, fallback = "") => escapeHtmlAttribute(course?.[field] ?? fallback);
  // deliveryMode/format normalisation: API stores deliveryMode (online/offline/hybrid), form uses format (Online/Offline/Hybrid)
  const currentDeliveryMode = course ? (course.deliveryMode || course.format || course.delivery_mode || "online") : "online";
  const normalizeDeliveryForOption = (v) => v.toLowerCase();
  const option = (field, optionValue, fallback = "") => (course?.[field] ?? fallback) === optionValue ? "selected" : "";
  return `<div class="modal-backdrop open"><form class="modal modal--medium modal--structured" id="courseForm" role="dialog" aria-modal="true" aria-labelledby="course-form-title"><header class="modal__header"><div><h2 id="course-form-title">${courseFormMode === "edit" ? "Chỉnh sửa khóa học" : "Tạo khóa học"}</h2></div><button type="button" class="icon-btn" data-close-course-form>×</button></header><div class="modal__body"><div class="field"><label>Tên khóa học</label><input name="title" type="text" value="${value("title")}" required></div><div class="field"><label>Mô tả</label><textarea name="description" rows="3">${escapeHtml(course?.description || "")}</textarea></div><div class="field"><label>Danh mục</label><select name="category">${["Kỹ năng mềm", "Chuyên môn", "Chứng chỉ", "Onboarding"].map((item) => `<option value="${escapeHtmlAttribute(item)}" ${option("category", item, "Kỹ năng mềm")}>${item}</option>`).join("")}</select></div><div class="field"><label>Hình thức</label><select name="format">${["Online", "Offline", "Hybrid"].map((item) => `<option value="${item}" ${normalizeDeliveryForOption(currentDeliveryMode) === item.toLowerCase() ? "selected" : ""}>${item}</option>`).join("")}</select></div><div class="field"><label>Thời lượng (giờ)</label><input name="durationHours" type="number" min="0" step="0.5" value="${value("durationHours", 0)}" required></div><div class="field"><label>Trạng thái</label><select name="status"><option value="draft" ${option("status", "draft", "draft")}>Bản nháp</option><option value="published" ${option("status", "published")}>Đã xuất bản</option></select></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-close-course-form>Hủy</button><button type="submit" class="btn btn-primary">Lưu</button></footer></form></div>`;
}

function coursesPage() {
  if (!hasAdminAccess()) return restrictedPage();
  const allCourses = getCourses();
  const categories = [...new Set(allCourses.map((course) => course.category).filter(Boolean))];
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D", t("course.manage"), "hr")}<div class="content"><section class="card panel"><div class="account-toolbar"><div><h2>${t("course.manage")}</h2><p>${t("course.manageDesc")}</p></div><button type="button" class="btn btn-primary" data-course-create>${t("course.create")}</button></div><div class="filter-bar"><input id="courseSearchInput" data-focus-key="course-search" type="search" placeholder="${t("course.searchPlaceholder")}" value="${escapeHtmlAttribute(courseSearch)}" data-course-search aria-label="${t("course.searchPlaceholder")}"><select data-course-filter-category><option value="">${t("course.allCategories")}</option>${categories.map((category) => `<option value="${escapeHtmlAttribute(category)}" ${courseFilterCategory === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select><select data-course-filter-status><option value="">${t("enrollment.allStatuses")}</option><option value="published" ${courseFilterStatus === "published" ? "selected" : ""}>${t("course.published")}</option><option value="draft" ${courseFilterStatus === "draft" ? "selected" : ""}>${t("course.draft")}</option><option value="archived" ${courseFilterStatus === "archived" ? "selected" : ""}>${t("course.archived")}</option></select></div><div id="courseResults" aria-live="polite">${courseTable(filteredCourses())}</div></section></div>${courseDrawerOpen ? courseDrawer() : ""}${courseFormMode ? courseFormModal() : ""}${contentBuilderMode ? contentItemForm() : ""}</main></div>`;
}

function notificationText(key) {
  const values = {
    title:{vi:"Thông báo",en:"Notifications",kr:"알림"}, create:{vi:"Tạo thông báo",en:"Create notification",kr:"알림 만들기"},
    history:{vi:"Lịch sử gửi",en:"Delivery history",kr:"발송 내역"}, recipients:{vi:"Đối tượng nhận",en:"Recipients",kr:"수신자"},
    all:{vi:"Toàn bộ nhân viên",en:"All employees",kr:"전체 직원"}, department:{vi:"Theo phòng ban",en:"By department",kr:"부서별"},
    course:{vi:"Theo khóa học",en:"By course",kr:"교육 과정별"}, send:{vi:"Gửi ngay",en:"Send now",kr:"지금 보내기"},
    preview:{vi:"Xem trước",en:"Preview",kr:"미리보기"}, noData:{vi:"Chưa có thông báo",en:"No notifications yet",kr:"아직 알림이 없습니다"},
    emailUnavailable:{vi:"Chưa cấu hình dịch vụ email",en:"Email service is not configured",kr:"이메일 서비스가 구성되지 않았습니다"}
  }; return values[key]?.[language] || values[key]?.vi || key;
}

function auditText(key){const m={title:{vi:"Nhật ký hệ thống",en:"System audit log",kr:"시스템 감사 로그"},subtitle:{vi:"Truy vết thao tác quản trị, bảo mật và thay đổi dữ liệu quan trọng.",en:"Trace administrative, security, and important data changes.",kr:"관리, 보안 및 주요 데이터 변경을 추적합니다."},actor:{vi:"Người thực hiện",en:"Actor",kr:"수행자"},action:{vi:"Hành động",en:"Action",kr:"작업"},entity:{vi:"Đối tượng",en:"Entity",kr:"대상"},before:{vi:"Trước",en:"Before",kr:"이전"},after:{vi:"Sau",en:"After",kr:"이후"},changed:{vi:"Trường thay đổi",en:"Changed fields",kr:"변경 필드"},requestId:{vi:"Request ID",en:"Request ID",kr:"요청 ID"},correlationId:{vi:"Correlation ID",en:"Correlation ID",kr:"상관 ID"},severity:{vi:"Mức độ",en:"Severity",kr:"심각도"},source:{vi:"Nguồn",en:"Source",kr:"소스"},status:{vi:"Trạng thái",en:"Status",kr:"상태"},critical:{vi:"Quan trọng",en:"Critical",kr:"중요"},warning:{vi:"Cảnh báo",en:"Warning",kr:"경고"},export:{vi:"Xuất",en:"Export",kr:"내보내기"},empty:{vi:"Chưa có sự kiện audit phù hợp.",en:"No matching audit events.",kr:"일치하는 감사 이벤트가 없습니다."},hidden:{vi:"Giá trị nhạy cảm đã được ẩn.",en:"Sensitive values hidden.",kr:"민감한 값은 숨겨졌습니다."},loadError:{vi:"Không thể tải nhật ký hệ thống.",en:"Unable to load audit logs.",kr:"감사 로그를 불러올 수 없습니다."},exportError:{vi:"Không thể xuất dữ liệu audit.",en:"Unable to export audit data.",kr:"감사 데이터를 내보낼 수 없습니다."}};return m[key]?.[language]||m[key]?.vi||key;}

async function loadAuditLogs(force=false){if(!hasAdminAccess()||auditState.loading)return;if(auditState.rows.length&&!force)return;auditState.loading=true;auditState.error="";render();try{const filters={...auditFilters,page:auditState.page,pageSize:auditState.pageSize};const [list,overview]=await Promise.all([auditService.list(filters),auditState.overview?Promise.resolve(auditState.overview):auditService.overview()]);auditState.rows=list.rows||[];auditState.total=list.total||0;auditState.page=list.page||1;auditState.pageSize=list.pageSize||25;auditState.overview=overview;}catch{auditState.error=auditText("loadError");}finally{auditState.loading=false;if(route==="/admin/audit-log")render();}}
async function openAuditDetail(id){auditState.detailLoading=true;auditState.detail=null;render();try{auditState.detail=await auditService.detail(id);}catch{auditState.error=auditText("loadError");}finally{auditState.detailLoading=false;render();}}
function auditJsonBlock(value){return `<pre class="audit-json">${escapeHtml(JSON.stringify(value??{},null,2))}</pre>`;}
function auditDiff(row){const fields=row?.changed_fields||[];if(!fields.length)return `<p class="muted">${auditText("hidden")}</p>`;return `<div class="audit-diff">${fields.map(f=>`<div><strong>${escapeHtml(f)}</strong><span>${escapeHtml(String(row.before_data?.[f]??"—"))} → ${escapeHtml(String(row.after_data?.[f]??"—"))}</span></div>`).join("")}</div>`;}

function auditLogPage(){if(!hasAdminAccess())return restrictedPage();if(!auditState.rows.length&&!auditState.loading&&!auditState.error)queueMicrotask(()=>loadAuditLogs());const ov=auditState.overview||{};const pages=Math.max(1,Math.ceil((auditState.total||0)/auditState.pageSize));const kpis=[["Hôm nay",ov.totalToday??"—"],[auditText("critical"),ov.criticalToday??"—"],["Login fail",ov.failedLoginsToday??"—"],["Role change",ov.roleChangesToday??"—"],["Export",ov.reportExportsToday??"—"],["Scheduler lỗi",ov.schedulerErrorsToday??"—"]];const rows=auditState.rows||[];return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D",auditText("title"),"hr")}<div class="content"><section class="card panel"><div class="account-toolbar"><div><h1>${auditText("title")}</h1><p>${auditText("subtitle")}</p></div><div class="learning-actions"><button class="btn btn-outline" data-audit-refresh>Tải lại</button><button class="btn btn-outline" data-audit-export="csv">${auditText("export")} CSV</button><button class="btn btn-outline" data-audit-export="xlsx">${auditText("export")} XLSX</button></div></div><div class="kpi-grid">${kpis.map(([l,v])=>`<div class="card kpi"><span class="label">${escapeHtml(l)}</span><strong>${escapeHtml(String(v))}</strong></div>`).join("")}</div><form class="filter-bar audit-filter" data-audit-filter><input name="search" type="search" value="${escapeHtmlAttribute(auditFilters.search)}" placeholder="Tên, entity, request ID, action"><input name="date_from" type="date" value="${escapeHtmlAttribute(auditFilters.date_from)}"><input name="date_to" type="date" value="${escapeHtmlAttribute(auditFilters.date_to)}"><select name="severity"><option value="">${auditText("severity")}</option>${["info","warning","critical"].map(x=>`<option value="${x}" ${auditFilters.severity===x?"selected":""}>${x}</option>`).join("")}</select><select name="category"><option value="">Category</option>${["authentication","account","employee","course","learning_path","compliance","certificate","report","notification","system","security"].map(x=>`<option value="${x}" ${auditFilters.category===x?"selected":""}>${x}</option>`).join("")}</select><select name="source"><option value="">${auditText("source")}</option>${["web","api","cron","system"].map(x=>`<option value="${x}" ${auditFilters.source===x?"selected":""}>${x}</option>`).join("")}</select><button class="btn btn-primary">Lọc</button></form>${auditState.error?`<div class="error-card">${escapeHtml(auditState.error)} <button class="btn btn-outline" data-audit-refresh>Thử lại</button></div>`:""}${auditState.loading?`<div class="skeleton-list"><div></div><div></div><div></div></div>`:rows.length?`<div class="table-wrap"><table><thead><tr><th>Thời gian</th><th>${auditText("actor")}</th><th>Vai trò</th><th>${auditText("action")}</th><th>${auditText("entity")}</th><th>${auditText("severity")}</th><th>${auditText("source")}</th><th>${auditText("status")}</th><th>${auditText("requestId")}</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHtml(formatDateTime(r.occurred_at))}</td><td>${escapeHtml(r.actor_display_name_snapshot||r.actor_user_id||"System")}</td><td>${escapeHtml(r.actor_role||"—")}</td><td><code>${escapeHtml(r.action)}</code></td><td>${escapeHtml(r.entity_display_name_snapshot||r.entity_id||r.entity_type||"—")}</td><td><span class="badge ${r.severity==="critical"?"danger":r.severity==="warning"?"pending":"active"}">${escapeHtml(r.severity)}</span></td><td>${escapeHtml(r.source||"")}</td><td>${escapeHtml(r.status||"")}</td><td><button class="link-btn" data-copy="${escapeHtmlAttribute(r.request_id||"")}" aria-label="Copy Request ID">${escapeHtml((r.request_id||"").slice(0,12))}</button></td><td><button class="btn btn-outline" data-audit-detail="${escapeHtmlAttribute(r.id)}">Xem</button></td></tr>`).join("")}</tbody></table></div><div class="pagination"><button class="btn btn-outline" data-audit-page="${auditState.page-1}" ${auditState.page<=1?"disabled":""}>Trước</button><span>${auditState.page} / ${pages}</span><button class="btn btn-outline" data-audit-page="${auditState.page+1}" ${auditState.page>=pages?"disabled":""}>Sau</button></div>`:`<div class="empty-state"><h3>${auditText("empty")}</h3></div>`}</section>${auditState.detail||auditState.detailLoading?auditDetailDrawer():""}</div></main></div>`;}

async function loadRetrainingReviews(force=false){if(!hasAdminAccess()||retrainingState.loading)return;if(retrainingState.rows.length&&!force)return;retrainingState.loading=true;retrainingState.error="";render();try{const res=await fetch("/api/admin/retraining-reviews",{headers:apiHeaders()});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.error||"load_failed");retrainingState.rows=body.data||[];}catch(e){retrainingState.error=e.message||"Không thể tải danh sách tái đào tạo.";}finally{retrainingState.loading=false;if(route==="/admin/retraining")render();}}
async function retrainingAction(id,action){try{const res=await fetch(`/api/admin/retraining-reviews/${encodeURIComponent(id)}/${action}`,{method:"POST",headers:{...apiHeaders(),"Content-Type":"application/json"},body:JSON.stringify({})});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.error||"action_failed");if(action==="preview")retrainingState.preview={id,...body};else retrainingState.preview=null;retrainingState.rows=[];toast("success");await loadRetrainingReviews(true);}catch(e){retrainingState.error=e.message||"Không thể áp dụng thao tác.";render();}}
function retrainingPage(){if(!hasAdminAccess())return restrictedPage();if(!retrainingState.rows.length&&!retrainingState.loading&&!retrainingState.error)queueMicrotask(()=>loadRetrainingReviews());const rows=retrainingState.rows||[];return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D","Tái đào tạo","hr")}<div class="content"><section class="card panel"><div class="account-toolbar"><div><h1>Tái đào tạo</h1><p>Xem các cập nhật nội dung quan trọng và quyết định ai cần học lại.</p></div><button class="btn btn-outline" data-retraining-refresh>Tải lại</button></div>${retrainingState.error?`<div class="error-card">${escapeHtml(retrainingState.error)} <button class="btn btn-outline" data-retraining-refresh>Thử lại</button></div>`:""}${retrainingState.preview?`<div class="card panel"><h3>Preview</h3><p>Nhân viên bị ảnh hưởng: <strong>${escapeHtml(String(retrainingState.preview.affectedEmployeeCount||0))}</strong></p></div>`:""}${retrainingState.loading?`<div class="skeleton-list"><div></div><div></div><div></div></div>`:rows.length?`<div class="table-wrap"><table><thead><tr><th>Entity</th><th>From</th><th>To</th><th>Ảnh hưởng</th><th>Trạng thái</th><th>Quyết định</th><th>Ngày tạo</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.entity_type)}<br><code>${escapeHtml(r.entity_id)}</code></td><td><code>${escapeHtml(r.from_version_id||"—")}</code></td><td><code>${escapeHtml(r.to_version_id||"")}</code></td><td>${escapeHtml(String(r.affected_employee_count||0))}</td><td><span class="badge ${r.status==="pending"?"pending":r.status==="applied"?"active":""}">${escapeHtml(r.status)}</span></td><td>${escapeHtml(r.decision||"—")}</td><td>${escapeHtml(formatDateTime(r.created_at))}</td><td><div class="learning-actions"><button class="btn btn-outline mini-action" data-retraining-action="preview" data-retraining-id="${escapeHtmlAttribute(r.id)}">Preview</button><button class="btn btn-outline mini-action" data-retraining-action="approve" data-retraining-id="${escapeHtmlAttribute(r.id)}" ${r.status!=="pending"?"disabled":""}>Duyệt</button><button class="btn btn-outline mini-action" data-retraining-action="dismiss" data-retraining-id="${escapeHtmlAttribute(r.id)}" ${r.status!=="pending"?"disabled":""}>Bỏ qua</button><button class="btn btn-primary mini-action" data-retraining-action="apply" data-retraining-id="${escapeHtmlAttribute(r.id)}" ${r.status!=="approved"?"disabled":""}>Áp dụng</button></div></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty-state"><h3>Không có nhân viên cần tái đào tạo.</h3></div>`}</section></div></main></div>`;}

function auditDetailDrawer(){const r=auditState.detail;if(auditState.detailLoading||!r)return `<div class="modal-backdrop open"><div class="modal modal--large"><div class="skeleton-list"><div></div><div></div><div></div></div></div></div>`;return `<div class="modal-backdrop open"><div class="modal modal--large modal--structured" role="dialog" aria-modal="true"><header class="modal__header"><div><h2>${auditText("title")}</h2><p><code>${escapeHtml(r.id)}</code></p></div><button class="icon-btn" data-audit-close aria-label="Close">×</button></header><div class="modal__body"><div class="profile-grid">${[["Audit ID",r.id],["Occurred at",formatDateTime(r.occurred_at)],["Actor",r.actor_display_name_snapshot||r.actor_user_id||"System"],[auditText("action"),r.action],[auditText("entity"),`${r.entity_type||""} ${r.entity_id||""}`.trim()],["Request ID",r.request_id],["Correlation ID",r.correlation_id],["Source",r.source],["IP hash",r.ip_address_hash||"—"],["User-agent",r.user_agent||"—"],["Status",r.status],["Error",r.error_code||"—"]].map(([k,v])=>`<div class="profile-item"><span>${escapeHtml(k)}</span><strong>${escapeHtml(String(v||"—"))}</strong></div>`).join("")}</div><h3>${auditText("changed")}</h3>${auditDiff(r)}<details open><summary>${auditText("before")}</summary>${auditJsonBlock(r.before_data)}</details><details open><summary>${auditText("after")}</summary>${auditJsonBlock(r.after_data)}</details><details><summary>Metadata</summary>${auditJsonBlock(r.metadata)}</details></div></div></div>`;}

function notificationRecipients(type, value) {
  const accounts = getAccounts().filter(a=>a.role==="employee"&&a.accountStatus==="active");
  if(type==="department") return accounts.filter(a=>a.department===value).map(a=>a.id);
  if(type==="course") return getEnrollmentsByCourseId(value).map(e=>e.accountId).filter(id=>accounts.some(a=>a.id===id));
  return accounts.map(a=>a.id);
}

function notificationsPage() {
  if (!hasAdminAccess()) return restrictedPage();
  if (!notificationMonitor && !notificationMonitorLoading) queueMicrotask(()=>loadNotificationMonitor());
  const history=getNotificationHistory().filter(n=>!notificationSearch||`${n.title} ${n.body}`.toLowerCase().includes(notificationSearch.toLowerCase()));
  const m=notificationMonitor||{};
  const deliveryRows=(m.deliveries||[]).slice(0,8);
  const runRows=(m.runs||[]).slice(0,8);
  const ruleRows=(m.rules||[]).slice(0,12);
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D",notificationText("title"),"hr")}<div class="content"><section class="card panel"><div class="account-toolbar"><div><h1>${notificationText("title")}</h1><p>${notificationText("history")}</p></div><div class="learning-actions"><button class="btn btn-outline" data-notification-monitor-refresh>Tải lại</button><button class="btn btn-outline" data-run-reminders>Chạy reminder</button><button class="btn btn-primary" data-notification-create>${notificationText("create")}</button></div></div><div class="kpi-grid">${[["Events 7 ngày",m.last7DaysEvents??"—"],["Unread",m.unreadNotifications??"—"],["Delivery logs",deliveryRows.length],["Active rules",(m.rules||[]).filter(r=>r.status==="active").length]].map(([l,v])=>`<div class="card kpi"><span class="label">${l}</span><strong>${escapeHtml(String(v))}</strong></div>`).join("")}</div><div class="filter-bar"><input id="notificationSearch" data-focus-key="notification-search" type="search" value="${escapeHtmlAttribute(notificationSearch)}" placeholder="${t("admin.search")}" data-notification-search></div>${history.length?`<div class="table-wrap"><table><thead><tr><th>${t("course.title")}</th><th>${notificationText("recipients")}</th><th>${t("status.read")}</th><th>${t("table.createdAt")}</th><th>${t("course.status")}</th><th>${t("admin.action")}</th></tr></thead><tbody>${history.map(n=>`<tr><td><strong>${escapeHtml(n.title)}</strong><small class="table-subtext">${escapeHtml(n.body)}</small></td><td>${n.recipientCount}</td><td>${n.readCount} / ${n.recipientCount}</td><td>${escapeHtml(n.sentAt||n.createdAt)}</td><td><span class="badge active">${escapeHtml(n.status||"sent")}</span></td><td><button type="button" class="btn btn-outline mini-action" data-archive-notification="${escapeHtmlAttribute(n.id)}" title="Xóa thông báo">🗑</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty-state">${icon("message")}<h3>${notificationText("noData")}</h3></div>`}</section><section class="card panel"><div class="panel-head"><h2>Reminder rules</h2></div><div class="table-wrap"><table><thead><tr><th>Event</th><th>Entity</th><th>Offset</th><th>Channel</th><th>Status</th></tr></thead><tbody>${ruleRows.map(r=>`<tr><td>${escapeHtml(r.event_type)}</td><td>${escapeHtml(r.entity_type)}</td><td>${escapeHtml(`${r.direction} ${r.offset_value} ${r.offset_unit}`)}</td><td>${escapeHtml(r.channel)}</td><td><span class="badge ${r.status==="active"?"active":"pending"}">${escapeHtml(r.status)}</span></td></tr>`).join("")||`<tr><td colspan="5">Chưa tải rules.</td></tr>`}</tbody></table></div></section><section class="card panel"><div class="panel-head"><h2>Delivery & runs</h2></div><div class="table-wrap"><table><thead><tr><th>Channel</th><th>Status</th><th>Provider</th><th>Error</th><th>Created</th></tr></thead><tbody>${deliveryRows.map(d=>`<tr><td>${escapeHtml(d.channel)}</td><td><span class="badge ${d.status==="delivered"||d.status==="sent"?"active":d.status==="failed"?"danger":"pending"}">${escapeHtml(d.status)}</span></td><td>${escapeHtml(d.provider||"—")}</td><td>${escapeHtml(d.error_code||"—")}</td><td>${escapeHtml(d.created_at||"")}</td></tr>`).join("")||`<tr><td colspan="5">Chưa có delivery.</td></tr>`}</tbody></table></div><div class="table-wrap"><table><thead><tr><th>Rule</th><th>Status</th><th>Candidates</th><th>Created</th><th>Duplicates</th><th>Completed</th></tr></thead><tbody>${runRows.map(r=>`<tr><td>${escapeHtml(r.rule_id||"—")}</td><td><span class="badge ${r.status==="completed"?"active":r.status==="failed"?"danger":"pending"}">${escapeHtml(r.status)}</span></td><td>${r.candidates_found}</td><td>${r.events_created}</td><td>${r.duplicates_skipped}</td><td>${escapeHtml(r.completed_at||"—")}</td></tr>`).join("")||`<tr><td colspan="6">Chưa có reminder run.</td></tr>`}</tbody></table></div></section></div>${notificationComposerOpen?notificationComposer():""}</main></div>`;
}

function notificationComposer(){const departments=[...new Set(getAccounts().filter(a=>a.role==="employee").map(a=>a.department).filter(Boolean))];return `<div class="modal-backdrop open"><form id="notificationForm" class="modal modal--large modal--structured" role="dialog" aria-modal="true" aria-labelledby="notification-title"><header class="modal__header"><div><h2 id="notification-title">${notificationText("create")}</h2></div><button type="button" class="icon-btn" aria-label="Close" data-notification-close>×</button></header><div class="modal__body"><div class="form-2col"><div class="field"><label>${t("course.title")}</label><input name="title" required maxlength="160"></div><div class="field"><label>${t("course.category")}</label><select name="type"><option value="hr_announcement">HR</option><option value="deadline">Deadline</option><option value="course_updated">Course</option><option value="system">System</option></select></div></div><div class="field"><label>${t("course.description")}</label><textarea name="body" rows="6" required></textarea></div><fieldset class="recipient-fieldset"><legend>${notificationText("recipients")}</legend><div class="form-2col"><div class="field"><label>Type</label><select name="recipientType" data-recipient-type><option value="all">${notificationText("all")}</option><option value="department">${notificationText("department")}</option><option value="course">${notificationText("course")}</option></select></div><div class="field"><label>Department / Course</label><select name="recipientValue"><option value="">—</option><optgroup label="Department">${departments.map(d=>`<option value="${escapeHtmlAttribute(d)}">${escapeHtml(d)}</option>`).join("")}</optgroup><optgroup label="Course">${getCourses().filter(c=>c.status==="published").map(c=>`<option value="${c.id}">${escapeHtml(c.title)}</option>`).join("")}</optgroup></select></div></div></fieldset><div class="field"><label>CTA URL</label><input name="actionUrl" placeholder="/dashboard/courses"></div><div class="setting-row"><div><strong>Email</strong><small>${notificationText("emailUnavailable")}</small></div><button type="button" class="switch" role="switch" aria-checked="false" disabled><span></span></button></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-notification-close>${t("content.cancel")}</button><button class="btn btn-primary" type="submit">${notificationText("send")}</button></footer></form></div>`;}

function getTodayDateString() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getDisplayEnrollmentStatus(enrollment) {
  return enrollment.status !== "completed" && enrollment.deadline && enrollment.deadline < getTodayDateString()
    ? "overdue"
    : enrollment.status;
}

function enrichedEnrollments() {
  return getEnrollments().map((enrollment) => { const computed=calculateCourseProgress({accountId:enrollment.accountId,courseId:enrollment.courseId}); const derived={...enrollment,progressPercent:computed.percent,status:computed.completed?"completed":computed.percent?"inProgress":"notStarted"}; return ({
    ...derived,
    displayStatus: computed.pendingGrading ? "pending" : getDisplayEnrollmentStatus(derived),
    course: getCourseById(enrollment.courseId),
    account: getAccountById(enrollment.accountId),
  });});
}

function filteredAssignments() {
  const searchValue = String(assignSearch || "").trim().toLocaleLowerCase("vi");
  return enrichedEnrollments().filter((row) => {
    const employeeName = String(row.account?.fullName || row.account?.name || "").toLocaleLowerCase("vi");
    const email = String(row.account?.email || "").toLocaleLowerCase("vi");
    const courseTitle = String(row.course?.title || "").toLocaleLowerCase("vi");
    return (!searchValue || employeeName.includes(searchValue) || email.includes(searchValue) || courseTitle.includes(searchValue))
      && (!assignCourseId || row.courseId === assignCourseId)
      && (!assignFilterDept || row.account?.department === assignFilterDept)
      && (!assignFilterStatus || row.displayStatus === assignFilterStatus);
  });
}

function enrollmentTable(rows) {
  if (!rows.length) return `<div class="card"><p>${t("enrollment.noResults")}</p></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>STT</th><th>${t("enrollment.employee")}</th><th>${t("table.department")}</th><th>${t("enrollment.course")}</th><th>${t("enrollment.assignedDate")}</th><th>${t("enrollment.deadline")}</th><th>${t("table.status")}</th><th>${t("enrollment.progress")}</th><th>${t("admin.action")}</th></tr></thead><tbody>${rows.map((row, index) => {
    const progressValue = Number(row.progressPercent);
    const safeProgress = Number.isFinite(progressValue) ? Math.min(100, Math.max(0, progressValue)) : 0;
    const signals=getLearningActivity({accountId:row.accountId,courseId:row.courseId}).filter(x=>["rapid_advance_attempt","tab_hidden","invalid_seek"].includes(x.eventType)).length;
    return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(row.account?.fullName || row.account?.name || row.accountId)}</strong><br>${escapeHtml(row.account?.email || "")}</td><td>${escapeHtml(row.account?.department || "—")}</td><td>${escapeHtml(row.course?.title || t("enrollment.courseDeleted"))}</td><td>${escapeHtml(row.assignedAt || "—")}</td><td>${escapeHtml(row.deadline || "—")}</td><td>${badge(signals>2?"follow":row.displayStatus)}${signals?`<small>${signals} ${t("enrollment.signals")}</small>`:""}</td><td>${safeProgress}%${progress(safeProgress)}</td><td><div class="row-actions"><button type="button" class="btn btn-outline mini-action" data-view-learning-log="${escapeHtmlAttribute(row.id)}">${t("enrollment.learningLog")}</button><button type="button" class="btn btn-outline mini-action" data-reset-learning="${escapeHtmlAttribute(row.id)}">${t("enrollment.resetProgress")}</button><button type="button" class="btn btn-outline mini-action" data-remove-enrollment="${escapeHtmlAttribute(row.id)}">${t("enrollment.cancel")}</button></div></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function getDefaultAssignmentDeadline() {
  const date = new Date();
  date.setDate(date.getDate() + 60);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function assignModal() {
  const accounts = getAccounts()
    .filter((account) => account.role === "employee" && account.accountStatus !== "disabled")
    .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || ""), "vi", { sensitivity: "base" }));
  // HR sees ALL non-archived courses (draft + published) — use Supabase cache if loaded
  const allHrCourses = (_courses && _courses.length ? _courses : getCourses())
    .filter((course) => course.status !== "archived")
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "vi", { sensitivity: "base" }));
  const publishedCourses = allHrCourses; // keep var name for template compat
  const selectedCourseId = assignTargetCourseId || assignCourseId;
  const departments = [...new Set(accounts.map((a) => a.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"vi"));
  const visible = accounts.filter((a) => (!bulkEmployeeSearch || `${a.fullName} ${a.email}`.toLowerCase().includes(bulkEmployeeSearch.toLowerCase())) && (!bulkDepartmentFilter || a.department === bulkDepartmentFilter));
  const deptEmployees = bulkDepartmentFilter ? accounts.filter(a=>a.department===bulkDepartmentFilter) : [];
  const deptPicker = `<div class="field"><label>${t("bulkAssign.selectDepartments")}</label><select data-bulk-department><option value="">— ${t("bulkAssign.selectDepartments")} —</option>${departments.map(d=>`<option value="${escapeHtmlAttribute(d)}" ${bulkDepartmentFilter===d?"selected":""}>${escapeHtml(d)} (${accounts.filter(a=>a.department===d).length})</option>`).join("")}</select></div>${bulkDepartmentFilter ? `<div style="background:#f0f7ff;border:1px solid var(--border);border-radius:8px;padding:14px;margin-top:8px"><p style="margin:0 0 10px"><strong>${deptEmployees.length}</strong> ${t("table.department")}: <strong>${escapeHtml(bulkDepartmentFilter)}</strong></p><div class="table-wrap" style="max-height:220px;overflow:auto"><table><thead><tr><th>${t("table.fullName")}</th><th>${t("table.email")}</th></tr></thead><tbody>${deptEmployees.map(a=>`<tr><td>${escapeHtml(a.fullName)}</td><td>${escapeHtml(a.email)}</td></tr>`).join("")}</tbody></table></div></div>` : `<p style="color:var(--muted);font-size:14px;margin-top:8px">Chọn phòng ban để xem danh sách nhân viên.</p>`}`;
  const indivPicker = `<div class="filter-bar"><input id="bulkSearchInput" data-focus-key="bulk-search" type="search" value="${escapeHtmlAttribute(bulkEmployeeSearch)}" placeholder="${t("admin.search")}" data-bulk-search><select data-bulk-department><option value="">${t("bulkAssign.selectDepartments")}</option>${departments.map(d=>`<option value="${escapeHtmlAttribute(d)}" ${bulkDepartmentFilter===d?"selected":""}>${escapeHtml(d)} (${accounts.filter(a=>a.department===d).length})</option>`).join("")}</select></div><div class="security-actions"><button type="button" class="btn btn-outline mini-action" data-select-visible>${t("bulkAssign.selectEmployees")}</button><button type="button" class="btn btn-outline mini-action" data-clear-bulk>${t("bulkAssign.noSelection")}</button></div><div class="table-wrap"><table><thead><tr><th></th><th>${t("table.fullName")}</th><th>${t("table.email")}</th><th>${t("table.department")}</th></tr></thead><tbody>${visible.map(a=>`<tr><td><input type="checkbox" aria-label="${escapeHtmlAttribute(a.fullName)}" data-bulk-account="${a.id}" ${bulkSelectedAccountIds.includes(a.id)?"checked":""}></td><td>${escapeHtml(a.fullName)}</td><td>${escapeHtml(a.email)}</td><td>${escapeHtml(a.department||"")}</td></tr>`).join("")}</tbody></table></div>`;
  const picker = assignMethod === "excel" ? `<div class="field"><label>${t("bulkAssign.uploadFile")}</label><input type="file" accept=".xls,.xlsx" data-bulk-excel></div>${excelPreviewRows.length ? bulkPreviewTable(excelPreviewRows) : ""}` : assignMethod === "department" ? deptPicker : indivPicker;
  return `<div class="modal-backdrop open"><form class="modal modal--large modal--structured" id="assignForm" role="dialog" aria-modal="true" aria-labelledby="assign-form-title"><header class="modal__header"><div><h2 id="assign-form-title">${t("bulkAssign.title")}</h2></div><button type="button" class="icon-btn" aria-label="Close" data-close-assign-modal>×</button></header><div class="modal__body"><div class="detail-tabs" role="tablist">${[["individual","individual"],["department","department"],["excel","excel"]].map(([v,k])=>`<button type="button" class="${assignMethod===v?"active":""}" data-assign-method="${v}" aria-selected="${assignMethod===v}">${t(`bulkAssign.${k}`)}</button>`).join("")}</div><div class="field"><label>${t("bulkAssign.selectCourse")}</label><select name="courseId" required><option value="">${t("bulkAssign.selectCourse")}</option>${publishedCourses.map(c=>`<option value="${c.id}" ${selectedCourseId===c.id?"selected":""}>${escapeHtml(c.title)}${c.status==="draft"?" (Bản nháp)":""}</option>`).join("")}</select></div>${picker}<p><strong>${t("bulkAssign.selectedCount")}: ${bulkSelectedAccountIds.length}</strong></p><div class="field"><label>${t("enrollment.deadline")}</label><input name="deadline" type="date" value="${getDefaultAssignmentDeadline()}" required></div><div class="field"><label>${t("table.note")}</label><textarea name="note" rows="3"></textarea></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-close-assign-modal>Hủy</button><button type="submit" class="btn btn-primary">${t("bulkAssign.confirm")}</button></footer></form></div>`;
}

function bulkPreviewTable(rows) { return `<div class="table-wrap"><table><thead><tr><th>STT</th><th>${t("table.email")}</th><th>${t("table.fullName")}</th><th>${t("table.department")}</th><th>${t("table.status")}</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.email||r.employeeCode||"")}</td><td>${escapeHtml(r.account?.fullName||r.name||"")}</td><td>${escapeHtml(r.account?.department||r.department||"")}</td><td>${r.valid?t("bulkAssign.validRows"):t(`bulkAssign.${r.reason||"unmatched"}`)}</td></tr>`).join("")}</tbody></table></div>`; }

function assignCourseToAccounts({ courseId, accountIds, assignedBy, deadline, note }) {
  const summary = { totalSelected: new Set(accountIds).size, assigned: 0, duplicates: 0, invalid: 0, failed: 0 };
  if (!getCourseById(courseId) || !deadline || deadline < getTodayDateString()) { summary.invalid = summary.totalSelected; return summary; }
  [...new Set(accountIds)].forEach((accountId) => { const a=getAccountById(accountId); if(a?.role!=="employee"||a.accountStatus==="disabled") return summary.invalid++; const r=assignCourse({courseId,accountId,assignedBy,deadline,note}); if(r.ok) summary.assigned++; else if(r.reason==="duplicate") summary.duplicates++; else summary.failed++; });
  return summary;
}

function quizStatusBadge(value) { return `<span class="badge ${value === "published" ? "learning" : value === "archived" ? "new" : "pending"}">${t(`course.${value}`)}</span>`; }

function adminQuizzesPage() {
  if (!hasAdminAccess()) return restrictedPage();
  const quizzes=getQuizzes().filter(q=>(!quizSearch||q.title.toLowerCase().includes(quizSearch.toLowerCase()))&&(!quizCourseFilter||q.courseId===quizCourseFilter)&&(!quizStatusFilter||q.status===quizStatusFilter)); const attempts=getQuizAttempts().filter(a=>a.submittedAt);
  const avg=attempts.length?Math.round(attempts.reduce((s,a)=>s+(a.scorePercent||0),0)/attempts.length):0; const pass=attempts.length?Math.round(attempts.filter(a=>a.passed).length/attempts.length*100):0;
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D",t("quiz.quizzes"),"hr")}<div class="content"><div class="kpi-grid"><div class="card kpi"><span>${t("quiz.quizzes")}</span><strong>${quizzes.length}</strong></div><div class="card kpi"><span>${t("quiz.employeesCompleted")}</span><strong>${new Set(attempts.map(a=>a.accountId)).size}</strong></div><div class="card kpi"><span>${t("quiz.averageScore")}</span><strong>${avg}%</strong></div><div class="card kpi"><span>${t("quiz.passRate")}</span><strong>${pass}%</strong></div></div><div class="detail-tabs"><button class="${quizAdminView==="list"?"active":""}" data-quiz-admin-view="list">${t("quiz.quizzes")}</button><button class="${quizAdminView==="results"?"active":""}" data-quiz-admin-view="results">${t("quiz.result")}</button><button class="${quizAdminView==="leaderboard"?"active":""}" data-quiz-admin-view="leaderboard">${t("quiz.leaderboard")}</button><button class="${quizAdminView==="analytics"?"active":""}" data-quiz-admin-view="analytics">${t("quiz.analytics")}</button></div>${quizAdminView==="list"?`<section class="card panel"><div class="panel-head"><h3>${t("quiz.quizzes")}</h3><button class="btn btn-primary" data-quiz-create>${t("quiz.create")}</button></div><div class="filter-bar"><input id="quizSearchInput" data-focus-key="quiz-search" data-quiz-search placeholder="${t("admin.search")}" value="${escapeHtmlAttribute(quizSearch)}"><select data-quiz-course-filter><option value="">${t("nav.courses")}</option>${getCourses().map(c=>`<option value="${c.id}" ${quizCourseFilter===c.id?"selected":""}>${escapeHtml(c.title)}</option>`).join("")}</select><select data-quiz-status-filter><option value="">${t("course.status")}</option>${["draft","published","archived"].map(s=>`<option value="${s}" ${quizStatusFilter===s?"selected":""}>${t(`course.${s}`)}</option>`).join("")}</select></div>${quizzes.length?`<div class="table-wrap"><table><thead><tr><th>${t("quiz.title")}</th><th>${t("nav.courses")}</th><th>${t("course.status")}</th><th>${t("quiz.questions")}</th><th>${t("admin.action")}</th></tr></thead><tbody>${quizzes.map(q=>`<tr><td><strong>${escapeHtml(q.title)}</strong></td><td>${escapeHtml(getCourseById(q.courseId)?.title||"")}</td><td>${quizStatusBadge(q.status)}</td><td>${q.questions.length}</td><td><button class="btn btn-outline mini-action" data-quiz-edit="${q.id}">${t("quiz.edit")}</button><button class="btn btn-outline mini-action" data-quiz-delete="${q.id}">${t("quiz.delete")}</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty-state"><h3>${t("quiz.noQuiz")}</h3></div>`}</section>`:quizAdminView==="results"?quizResultsPanel(attempts):quizAdminView==="leaderboard"?quizLeaderboard(attempts):quizAnalytics(attempts)}</div>${quizFormOpen?quizForm():""}</main></div>`;
}

function quizResultsPanel(attempts){return `<section class="card panel"><div class="panel-head"><h3>${t("quiz.result")}</h3><button class="btn btn-outline" data-quiz-export>${t("quiz.exportCsv")}</button></div><div class="table-wrap"><table><thead><tr><th>${t("table.fullName")}</th><th>${t("quiz.title")}</th><th>${t("quiz.score")}</th><th>${t("quiz.result")}</th><th>${t("admin.action")}</th></tr></thead><tbody>${attempts.map(a=>`<tr><td>${escapeHtml(getAccountById(a.accountId)?.fullName||"")}</td><td>${escapeHtml(getQuizById(a.quizId)?.title||"")}</td><td>${a.scorePercent}%</td><td>${t(a.gradingStatus==="pendingManual"?"quiz.pendingGrading":a.passed?"quiz.passed":"quiz.failed")}</td><td>${a.gradingStatus==="pendingManual"?`<button class="btn btn-outline mini-action" data-grade-attempt="${a.id}">${t("quiz.manualGrade")}</button>`:""}</td></tr>`).join("")}</tbody></table></div></section>`;}
function quizLeaderboard(attempts){const best=new Map();attempts.filter(a=>a.gradingStatus==="graded").forEach(a=>{const old=best.get(a.accountId);if(!old||a.scorePercent>old.scorePercent||(a.scorePercent===old.scorePercent&&a.durationSeconds<old.durationSeconds))best.set(a.accountId,a)});const rows=[...best.values()].sort((a,b)=>b.scorePercent-a.scorePercent||a.durationSeconds-b.durationSeconds);return `<section class="card panel"><h3>${t("quiz.leaderboard")}</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>${t("table.fullName")}</th><th>${t("quiz.score")}</th><th>${t("quiz.duration")}</th></tr></thead><tbody>${rows.map((a,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(getAccountById(a.accountId)?.fullName||"")}</td><td>${a.scorePercent}%</td><td>${a.durationSeconds}s</td></tr>`).join("")}</tbody></table></div></section>`;}
function quizAnalytics(attempts){const rows=[];getQuizzes().forEach(q=>q.questions.forEach(question=>{const answers=attempts.filter(a=>a.quizId===q.id).map(a=>a.answers.find(x=>x.questionId===question.id)).filter(Boolean);const graded=answers.filter(a=>typeof a.isCorrect==="boolean");rows.push({text:question.text,total:answers.length,rate:graded.length?Math.round(graded.filter(a=>a.isCorrect).length/graded.length*100):0});}));const ranked=rows.filter(r=>r.total).sort((a,b)=>a.rate-b.rate);return `<section class="card panel"><h3>${t("quiz.analytics")}</h3>${ranked.length?`<p><strong>${t("quiz.hardestQuestion")}:</strong> ${escapeHtml(ranked[0].text)} · <strong>${t("quiz.easiestQuestion")}:</strong> ${escapeHtml(ranked[ranked.length-1].text)}</p>`:""}<div class="table-wrap"><table><thead><tr><th>${t("quiz.question")}</th><th>${t("quiz.responses")}</th><th>${t("quiz.correctRate")}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.text)}</td><td>${r.total}</td><td>${r.rate}%</td></tr>`).join("")}</tbody></table></div></section>`;}

function quizForm() {
  const q=selectedQuizId?getQuizById(selectedQuizId):null;
  const addQuestionUi = quizAddingQType ? `<div class="q-type-grid">${[
    ["singleChoice","Single Choice"],["multipleChoice","Multiple Choice"],["trueFalse","True / False"],
    ["shortAnswer","Short Answer"],["text","Essay"],["fillBlank","Fill in Blank"],
    ["matching","Matching"],["ordering","Ordering"],["numeric","Numeric"],
  ].map(([k,l])=>`<button type="button" class="q-type-btn" data-add-q-type="${k}">${l}</button>`).join("")}</div>` : `<button type="button" class="btn btn-outline" data-add-question>${t("contentType.addQuestion")}</button>`;
  return `<div class="modal-backdrop open"><form class="modal modal--xlarge modal--structured" id="quizForm" role="dialog" aria-modal="true" aria-labelledby="quiz-form-title"><header class="modal__header"><div><h2 id="quiz-form-title">${q?t("quiz.edit"):t("quiz.create")}</h2></div><button type="button" class="icon-btn" aria-label="${t("quiz.close")}" data-quiz-close>×</button></header><div class="modal__body"><div class="field"><label>${t("quiz.title")}</label><input name="title" required value="${escapeHtmlAttribute(q?.title||"")}"></div><div class="field"><label>${t("nav.courses")}</label><select name="courseId" required>${getCourses().map(c=>`<option value="${c.id}" ${q?.courseId===c.id?"selected":""}>${escapeHtml(c.title)}</option>`).join("")}</select></div><div class="field"><label>${t("course.description")}</label><textarea name="description">${escapeHtml(q?.description||"")}</textarea></div><div class="profile-grid"><div class="field"><label>${t("quiz.passingScore")}</label><input name="passingScore" type="number" min="0" max="100" value="${q?.passingScore??70}" required></div><div class="field"><label>${t("quiz.timeLimit")}</label><input name="timeLimitMinutes" type="number" min="1" value="${q?.timeLimitMinutes??20}" required></div><div class="field"><label>${t("quiz.attemptsAllowed")}</label><input name="attemptsAllowed" type="number" min="1" value="${q?.attemptsAllowed??2}" required></div><div class="field"><label>${t("course.status")}</label><select name="status"><option value="draft">${t("course.draft")}</option><option value="published" ${q?.status==="published"?"selected":""}>${t("course.published")}</option><option value="archived" ${q?.status==="archived"?"selected":""}>${t("course.archived")}</option></select></div></div><label><input type="checkbox" name="requireCourseCompletion" ${q?.requireCourseCompletion?"checked":""}> ${t("quiz.requireCourseCompletion")}</label><div class="field"><label>${t("quiz.prerequisite")}</label><select name="prerequisiteQuizId"><option value="">—</option>${getQuizzes().filter(x=>x.id!==q?.id).map(x=>`<option value="${x.id}" ${q?.prerequisiteQuizId===x.id?"selected":""}>${escapeHtml(x.title)}</option>`).join("")}</select></div><div class="panel-head"><h3>${t("quiz.questions")}</h3></div>${quizBuilderQuestions.map((qq,i)=>questionEditor(qq,i)).join("")}${addQuestionUi}<details class="card" style="margin-top:12px"><summary>${t("quiz.importJson")}</summary><div class="field"><label>${t("quiz.jsonData")}</label><textarea rows="6" data-quiz-json></textarea></div><button type="button" class="btn btn-outline" data-import-quiz-json>${t("quiz.validateImport")}</button></details></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-quiz-close>${t("content.cancel")}</button><button class="btn btn-primary" type="submit">${t("changePassword.submit")}</button></footer></form></div>`;
}

const _QTYPES = {
  singleChoice:"Single Choice",multipleChoice:"Multiple Choice",trueFalse:"True / False",
  text:"Essay",single_choice:"Single Choice",multiple_choice:"Multiple Choice",true_false:"True / False",
  essay:"Essay",shortAnswer:"Short Answer",short_answer:"Short Answer",
  fillBlank:"Fill in the Blank",fill_blank:"Fill in the Blank",
  matching:"Matching",ordering:"Ordering",numeric:"Numeric",
};

function questionEditor(question, index) {
  const collapsed = quizBuilderCollapsed[index] === true;
  const type = question.type || "singleChoice";
  const typeLabel = _QTYPES[type] || type;
  const preview = (question.text || "").replace(/<[^>]*>/g,"").substring(0,55) || "(Chưa nhập)";
  const pts = question.points || 1;

  const opts = question.options || [];
  const isChoice = ["singleChoice","single_choice","multipleChoice","multiple_choice"].includes(type);
  const isMulti = ["multipleChoice","multiple_choice"].includes(type);
  const isTF = ["trueFalse","true_false"].includes(type);
  const isEssay = ["text","essay"].includes(type);
  const isSA = ["shortAnswer","short_answer"].includes(type);
  const isFB = ["fillBlank","fill_blank"].includes(type);
  const isMatch = type === "matching";
  const isOrder = type === "ordering";
  const isNum = type === "numeric";

  const headHtml = `<div class="question-card__head" data-q-toggle="${index}"><span class="question-card__num">Câu ${index+1}</span><span class="question-card__typebadge">${typeLabel}</span><span class="question-card__preview">${escapeHtml(preview)}</span><span style="font-size:12px;color:var(--muted);margin-left:4px">${pts} điểm</span><div class="question-card__acts" onclick="event.stopPropagation()"><button type="button" class="btn btn-outline mini-action" data-q-move-up="${index}" ${index===0?"disabled":""} title="Lên">↑</button><button type="button" class="btn btn-outline mini-action" data-q-move-down="${index}" title="Xuống">↓</button><button type="button" class="btn btn-outline mini-action" data-q-duplicate="${index}" title="Nhân bản">⊕</button><button type="button" class="btn btn-outline mini-action" data-q-delete="${index}" title="Xóa">🗑</button></div><span style="color:var(--muted);margin-left:4px;font-size:14px">${collapsed?"▾":"▴"}</span></div>`;

  if (collapsed) return `<div class="question-card" data-q-idx="${index}">${headHtml}</div>`;

  const baseTextArea = `<div class="field"><label>Nội dung câu hỏi <span style="color:#c0392b">*</span></label><textarea name="q_${index}_text" rows="3" data-focus-key="q-${index}-text">${escapeHtml(question.text||"")}</textarea></div>`;
  const baseScoreExp = `<div class="form-2col"><div class="field"><label>Điểm</label><input type="number" name="q_${index}_points" min="0" step="0.5" value="${pts}"></div><div class="field"><label>Giải thích</label><input type="text" name="q_${index}_explanation" value="${escapeHtmlAttribute(question.explanation||"")}" data-focus-key="q-${index}-exp"></div></div>`;

  let bodyHtml = "";

  if (isChoice) {
    const optHtml = opts.map((opt, oi) => {
      const checked = isMulti ? (question.correctOptionIds||[]).includes(opt.id) : question.correctOptionId === opt.id;
      return `<div class="q-option-row"><input type="${isMulti?"checkbox":"radio"}" name="${isMulti?`q_${index}_correct[]`:`q_${index}_correct`}" value="${escapeHtmlAttribute(opt.id)}" ${checked?"checked":""}><input type="text" name="q_${index}_opt_${oi}_text" value="${escapeHtmlAttribute(opt.text||"")}" placeholder="Lựa chọn ${oi+1}" data-focus-key="q-${index}-opt-${oi}"><input type="hidden" name="q_${index}_opt_${oi}_id" value="${escapeHtmlAttribute(opt.id)}"><button type="button" class="btn btn-outline mini-action" data-q-del-opt="${index}-${oi}" ${opts.length<=2?"disabled":""}>×</button></div>`;
    }).join("");
    bodyHtml = `${baseTextArea}<div class="field"><label>${isMulti?"Đáp án đúng (chọn nhiều)":"Đáp án đúng (chọn một)"}</label><div class="q-option-list" id="q-opts-${index}">${optHtml}</div><button type="button" class="btn btn-outline mini-action" style="margin-top:6px" data-q-add-opt="${index}">+ Thêm lựa chọn</button></div>${baseScoreExp}`;
  } else if (isTF) {
    const tfVal = question.correctAnswer;
    bodyHtml = `${baseTextArea}<div class="field"><label>Đáp án</label><div style="display:flex;gap:20px"><label><input type="radio" name="q_${index}_correct" value="true" ${tfVal===true?"checked":""}> Đúng</label><label><input type="radio" name="q_${index}_correct" value="false" ${tfVal===false?"checked":""}> Sai</label></div></div>${baseScoreExp}`;
  } else if (isEssay) {
    bodyHtml = `${baseTextArea}<div class="form-2col"><div class="field"><label>Ký tự tối thiểu</label><input type="number" name="q_${index}_minChars" min="0" value="${question.minChars||0}"></div><div class="field"><label>Ký tự tối đa (0=không giới hạn)</label><input type="number" name="q_${index}_maxChars" min="0" value="${question.maxChars||0}"></div></div><div class="field"><label>Rubric chấm điểm</label><textarea name="q_${index}_rubric" rows="2" data-focus-key="q-${index}-rubric">${escapeHtml(question.rubric||"")}</textarea></div>${baseScoreExp}`;
  } else if (isSA) {
    const accepted = question.acceptedAnswers || [""];
    const accHtml = accepted.map((a,ai)=>`<div class="q-option-row"><input type="text" name="q_${index}_acc_${ai}" value="${escapeHtmlAttribute(a)}" placeholder="Đáp án ${ai+1}" data-focus-key="q-${index}-acc-${ai}"><button type="button" class="btn btn-outline mini-action" data-q-del-acc="${index}-${ai}" ${accepted.length<=1?"disabled":""}>×</button></div>`).join("");
    bodyHtml = `${baseTextArea}<div class="field"><label>Đáp án chấp nhận</label><div class="q-option-list" id="q-acc-${index}">${accHtml}</div><button type="button" class="btn btn-outline mini-action" style="margin-top:6px" data-q-add-acc="${index}">+ Thêm đáp án</button></div><div class="field"><label><input type="checkbox" name="q_${index}_ignoreCase" ${question.ignoreCase!==false?"checked":""}> Không phân biệt hoa thường</label></div>${baseScoreExp}`;
  } else if (isFB) {
    bodyHtml = `<div class="field"><label>Câu hỏi (dùng ____ cho chỗ trống) <span style="color:#c0392b">*</span></label><textarea name="q_${index}_text" rows="2" data-focus-key="q-${index}-text">${escapeHtml(question.text||"")}</textarea><small style="color:var(--muted)">Ví dụ: KIS được thành lập năm ____.</small></div><div class="field"><label>Đáp án chấp nhận (cách nhau bằng |)</label><input type="text" name="q_${index}_blanks" value="${escapeHtmlAttribute((question.blanks||[""]).join("|"))}" data-focus-key="q-${index}-blanks" placeholder="2012|hai nghìn mười hai"></div><div class="field"><label><input type="checkbox" name="q_${index}_ignoreCase" ${question.ignoreCase!==false?"checked":""}> Không phân biệt hoa thường</label></div>${baseScoreExp}`;
  } else if (isMatch) {
    const pairs = question.pairs || [{ left:"", right:"" }];
    const pairHtml = pairs.map((p,pi)=>`<div class="q-pair-row"><input type="text" name="q_${index}_left_${pi}" value="${escapeHtmlAttribute(p.left||"")}" placeholder="Cột A" data-focus-key="q-${index}-l-${pi}"><span style="color:var(--muted)">→</span><input type="text" name="q_${index}_right_${pi}" value="${escapeHtmlAttribute(p.right||"")}" placeholder="Cột B" data-focus-key="q-${index}-r-${pi}"><button type="button" class="btn btn-outline mini-action" data-q-del-pair="${index}-${pi}" ${pairs.length<=1?"disabled":""}>×</button></div>`).join("");
    bodyHtml = `${baseTextArea}<div class="field"><label>Các cặp ghép</label><div id="q-pairs-${index}">${pairHtml}</div><button type="button" class="btn btn-outline mini-action" style="margin-top:6px" data-q-add-pair="${index}">+ Thêm cặp</button></div>${baseScoreExp}`;
  } else if (isOrder) {
    const items = question.items || [""];
    const itemHtml = items.map((it,ii)=>`<div class="q-order-row"><span style="font-weight:700;color:var(--muted);min-width:20px">${ii+1}.</span><input type="text" name="q_${index}_item_${ii}" value="${escapeHtmlAttribute(it||"")}" placeholder="Bước ${ii+1}" data-focus-key="q-${index}-item-${ii}"><button type="button" class="btn btn-outline mini-action" data-q-del-item="${index}-${ii}" ${items.length<=2?"disabled":""}>×</button></div>`).join("");
    bodyHtml = `${baseTextArea}<div class="field"><label>Các bước (thứ tự đúng)</label><div id="q-items-${index}">${itemHtml}</div><button type="button" class="btn btn-outline mini-action" style="margin-top:6px" data-q-add-item="${index}">+ Thêm bước</button></div>${baseScoreExp}`;
  } else if (isNum) {
    bodyHtml = `${baseTextArea}<div class="form-2col"><div class="field"><label>Đáp án số <span style="color:#c0392b">*</span></label><input type="number" step="any" name="q_${index}_numAnswer" value="${question.numericAnswer??""}" data-focus-key="q-${index}-num"></div><div class="field"><label>Sai số cho phép (±)</label><input type="number" step="any" min="0" name="q_${index}_tolerance" value="${question.tolerance||0}"></div></div><div class="field"><label>Đơn vị</label><input type="text" name="q_${index}_unit" value="${escapeHtmlAttribute(question.unit||"")}"></div>${baseScoreExp}`;
  }

  return `<div class="question-card" data-q-idx="${index}">${headHtml}<div class="question-card__body">${bodyHtml}</div></div>`;
}

function readQuestionEditors() {
  return [...document.querySelectorAll("[data-q-idx]")].map((el, index) => {
    const g = n => el.querySelector(`[name="q_${index}_${n}"]`)?.value ?? "";
    const type = quizBuilderQuestions[index]?.type || "singleChoice";
    const id = quizBuilderQuestions[index]?.id || `q-${Date.now()}-${index}`;
    const text = g("text").trim();
    const points = Number(g("points")) || 1;
    const explanation = g("explanation").trim();

    const isChoice = ["singleChoice","single_choice","multipleChoice","multiple_choice"].includes(type);
    const isMulti = ["multipleChoice","multiple_choice"].includes(type);
    const isTF = ["trueFalse","true_false"].includes(type);

    let extra = {};

    if (isChoice) {
      const optEls = [...el.querySelectorAll(`[name^="q_${index}_opt_"][name$="_text"]`)];
      const options = optEls.map((inp, oi) => ({
        id: el.querySelector(`[name="q_${index}_opt_${oi}_id"]`)?.value || `${id}-o${oi+1}`,
        text: inp.value.trim(),
      }));
      if (isMulti) {
        const checked = [...el.querySelectorAll(`[name="q_${index}_correct[]"]:checked`)].map(x=>x.value);
        extra = { options, correctOptionIds: checked };
      } else {
        const checked = el.querySelector(`[name="q_${index}_correct"]:checked`)?.value || "";
        extra = { options, correctOptionId: checked };
      }
    } else if (isTF) {
      const val = el.querySelector(`[name="q_${index}_correct"]:checked`)?.value;
      extra = { correctAnswer: val === "true" ? true : val === "false" ? false : null };
    } else if (["text","essay"].includes(type)) {
      extra = { minChars: Number(g("minChars"))||0, maxChars: Number(g("maxChars"))||0, rubric: g("rubric") };
    } else if (["shortAnswer","short_answer"].includes(type)) {
      const accEls = [...el.querySelectorAll(`[name^="q_${index}_acc_"]`)];
      extra = { acceptedAnswers: accEls.map(x=>x.value.trim()).filter(Boolean), ignoreCase: el.querySelector(`[name="q_${index}_ignoreCase"]`)?.checked !== false };
    } else if (["fillBlank","fill_blank"].includes(type)) {
      extra = { blanks: g("blanks").split("|").map(x=>x.trim()).filter(Boolean), ignoreCase: el.querySelector(`[name="q_${index}_ignoreCase"]`)?.checked !== false };
    } else if (type === "matching") {
      const leftEls = [...el.querySelectorAll(`[name^="q_${index}_left_"]`)];
      const rightEls = [...el.querySelectorAll(`[name^="q_${index}_right_"]`)];
      extra = { pairs: leftEls.map((l,i) => ({ left: l.value.trim(), right: rightEls[i]?.value.trim()||"" })) };
    } else if (type === "ordering") {
      const itemEls = [...el.querySelectorAll(`[name^="q_${index}_item_"]`)];
      extra = { items: itemEls.map(x=>x.value.trim()) };
    } else if (type === "numeric") {
      extra = { numericAnswer: Number(g("numAnswer")), tolerance: Number(g("tolerance"))||0, unit: g("unit") };
    }

    return { id, type, text, points, explanation, ...extra };
  });
}

function employeeQuizzesPage() {
  if (!hasEmployeeAccess()) return session?restrictedPage():loginPage();
  if(activeQuizAttempt) return quizAttemptPage(); if(quizLastResult)return quizResultPage(); const enrollments=getEnrollmentsByAccountId(session.accountId); const courseIds=new Set(enrollments.map(e=>e.courseId)); const quizzes=getQuizzes().filter(q=>q.status==="published"&&courseIds.has(q.courseId)); const attempts=getQuizAttemptsByAccountId(session.accountId);
  return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar(t("roles.employee"),t("quiz.title"),"employee")}<div class="content"><section class="card panel"><h2>${t("quiz.title")}</h2>${quizzes.length?`<div class="stats-grid">${quizzes.map(q=>{const own=attempts.filter(a=>a.quizId===q.id&&a.submittedAt);const best=Math.max(0,...own.map(a=>a.scorePercent||0));const allowed=canStartQuiz({quizId:q.id,accountId:session.accountId});return `<article class="card panel"><h3>${escapeHtml(q.title)}</h3><p>${escapeHtml(q.description||"")}</p><p>${t("quiz.timeLimit")}: ${q.timeLimitMinutes} min · ${t("quiz.passingScore")}: ${q.passingScore}%</p><p>${t("quiz.attemptHistory")}: ${own.length}/${q.attemptsAllowed} · ${t("quiz.remainingAttempts")}: ${Math.max(0,q.attemptsAllowed-own.length)} · ${t("quiz.score")}: ${best}%</p>${!allowed.ok?`<p class="badge pending">${t(`quiz.${allowed.reason}`)}</p>`:""}<button class="btn btn-primary" data-quiz-start="${q.id}" ${!allowed.ok?"disabled":""}>${own.length?t("quiz.retake"):t("quiz.start")}</button></article>`;}).join("")}</div>`:`<div class="empty-state"><h3>${t("quiz.noQuiz")}</h3></div>`}</section></div></main></div>`;
}

function quizAttemptPage() { const quiz=activeQuizAttempt.quiz;const q=quiz.questions[quizCurrentQuestion];const answered=new Set(Object.keys(quizAnswers).filter(k=>quizAnswers[k]&&(!Array.isArray(quizAnswers[k])||quizAnswers[k].length)));return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar(t("quiz.title"),escapeHtml(quiz.title),"employee")}<div class="content"><form class="card panel" id="quizAttemptForm"><div class="panel-head"><strong class="${quizSecondsRemaining<=60?"badge pending":""}" data-quiz-timer>${formatQuizTime(quizSecondsRemaining)}</strong><button type="button" class="btn btn-outline" data-bookmark-question>${quizBookmarks.includes(q.id)?"★":"☆"} ${t("quiz.bookmark")}</button></div><div class="detail-tabs" aria-label="${t("quiz.questionNavigation")}">${quiz.questions.map((x,i)=>`<button type="button" class="${i===quizCurrentQuestion?"active":""}" data-question-nav="${i}" aria-label="${t("quiz.question")} ${i+1}">${quizBookmarks.includes(x.id)?"★ ":""}${i+1}${answered.has(x.id)?" ✓":""}</button>`).join("")}</div>${renderAttemptQuestion(q,quizCurrentQuestion)}<div class="security-actions"><button type="button" class="btn btn-outline" data-question-prev ${quizCurrentQuestion===0?"disabled":""}>${t("quiz.previous")}</button><button type="button" class="btn btn-outline" data-question-next ${quizCurrentQuestion===quiz.questions.length-1?"disabled":""}>${t("quiz.next")}</button><button class="btn btn-primary" type="submit">${t("quiz.submit")}</button></div></form></div></main></div>`; }
function renderAttemptQuestion(q,index){const value=quizAnswers[q.id];if(q.type==="text")return `<fieldset class="card"><legend>${index+1}. ${escapeHtml(q.text)}</legend><textarea rows="6" data-answer-text="${q.id}">${escapeHtml(value||"")}</textarea></fieldset>`;return `<fieldset class="card"><legend>${index+1}. ${escapeHtml(q.text)}</legend>${q.options.map(o=>`<label class="task"><input type="${q.type==="multipleChoice"?"checkbox":"radio"}" name="${q.id}" value="${o.id}" data-answer-option="${q.id}" ${Array.isArray(value)?value.includes(o.id)?"checked":"":value===o.id?"checked":""}> ${escapeHtml(o.text)}</label>`).join("")}</fieldset>`;}
function formatQuizTime(seconds){const safe=Math.max(0,seconds);return `${String(Math.floor(safe/60)).padStart(2,"0")}:${String(safe%60).padStart(2,"0")}`;}
function quizResultPage(){const result=quizLastResult;const quiz=getQuizById(result.quizId);const optionText=(q,id)=>q.options?.find(o=>o.id===id)?.text||id||"";return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar(t("quiz.result"),escapeHtml(quiz?.title||""),"employee")}<div class="content"><section class="card panel"><h2>${t(result.gradingStatus==="pendingManual"?"quiz.pendingGrading":result.passed?"quiz.passed":"quiz.failed")}</h2><div class="kpi-grid"><div class="card kpi"><span>${t("quiz.score")}</span><strong>${result.scorePercent}%</strong></div><div class="card kpi"><span>${t("quiz.correctCount")}</span><strong>${result.correctCount}/${result.totalQuestions}</strong></div></div>${quiz?.questions.map(q=>{const a=result.answers.find(x=>x.questionId===q.id);const given=a?.textAnswer||optionText(q,a?.selectedOptionId)||(a?.selectedOptionIds||[]).map(id=>optionText(q,id)).join(", ")||"—";const correct=q.type==="multipleChoice"?(q.correctOptionIds||[]).map(id=>optionText(q,id)).join(", "):optionText(q,q.correctOptionId);return `<article class="card"><h3>${escapeHtml(q.text)}</h3><p>${t("quiz.answer")}: ${escapeHtml(given)}</p>${q.type!=="text"?`<p>${t("quiz.correctAnswer")}: ${escapeHtml(correct)}</p><p>${escapeHtml(q.explanation||"")}</p>`:""}</article>`;}).join("")||""}<button class="btn btn-primary" data-quiz-result-close>${t("quiz.quizzes")}</button></section></div></main></div>`;}
function captureQuizAnswer(){if(!activeQuizAttempt)return;const q=activeQuizAttempt.quiz.questions[quizCurrentQuestion];if(q.type==="text")quizAnswers[q.id]=document.querySelector(`[data-answer-text="${q.id}"]`)?.value||"";else{const selected=[...document.querySelectorAll(`[data-answer-option="${q.id}"]:checked`)].map(el=>el.value);quizAnswers[q.id]=q.type==="multipleChoice"?selected:selected[0]||"";}persistQuizDraft();}
function persistQuizDraft(){if(!activeQuizAttempt||!session?.accountId)return;saveQuizAttemptProgress({attemptId:activeQuizAttempt.id,accountId:session.accountId,answers:activeQuizAttempt.quiz.questions.map(q=>({questionId:q.id,...(q.type==="text"?{textAnswer:String(quizAnswers[q.id]||"")} : q.type==="multipleChoice"?{selectedOptionIds:quizAnswers[q.id]||[]}:{selectedOptionId:String(quizAnswers[q.id]||"")})})),bookmarks:quizBookmarks});}
function finishQuizAttempt(){if(!activeQuizAttempt||!hasEmployeeAccess())return;clearInterval(quizTimerId);quizTimerId=null;const answers=activeQuizAttempt.quiz.questions.map(q=>({questionId:q.id,...(q.type==="text"?{textAnswer:String(quizAnswers[q.id]||"")} : q.type==="multipleChoice"?{selectedOptionIds:quizAnswers[q.id]||[]}:{selectedOptionId:String(quizAnswers[q.id]||"")})}));const result=submitQuizAttempt({attemptId:activeQuizAttempt.id,accountId:session.accountId,answers});if(!result)return toast("error");const item=getCourseContent(result.courseId).find(x=>x.quizId===result.quizId);if(item)saveContentProgress({accountId:session.accountId,courseId:result.courseId,contentId:item.id,contentType:"quiz",completionPercent:result.passed?100:0,completed:result.passed===true,metadata:{attemptId:result.id,gradingStatus:result.gradingStatus}});activeQuizAttempt=null;quizLastResult=result;render();}
function startQuizCountdown(){if(!activeQuizAttempt||quizTimerId)return;quizTimerId=setInterval(()=>{quizSecondsRemaining--;const el=document.querySelector("[data-quiz-timer]");if(el){el.textContent=formatQuizTime(quizSecondsRemaining);if(quizSecondsRemaining<=60)el.classList.add("badge","pending");}if(quizSecondsRemaining===60)toast(t("quiz.timerWarning"));if(quizSecondsRemaining<=0)finishQuizAttempt();},1000);}
function exportQuizCsv(){const rows=getQuizAttempts().filter(a=>a.submittedAt).map(a=>[getAccountById(a.accountId)?.fullName||"",getAccountById(a.accountId)?.email||"",getQuizById(a.quizId)?.title||"",a.attemptNumber,a.scorePercent,a.gradingStatus,a.passed===null?t("quiz.pendingGrading"):t(a.passed?"quiz.passed":"quiz.failed"),a.submittedAt]);const csv="\uFEFF"+[[t("table.fullName"),t("table.email"),t("quiz.title"),t("quiz.attemptHistory"),t("quiz.score"),t("quiz.result"),t("table.status"),t("table.createdAt")],...rows].map(row=>row.map(value=>`"${String(value??"").replaceAll('"','""')}"`).join(",")).join("\r\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="quiz-results.csv";link.click();URL.revokeObjectURL(url);}

function assignPage() {
  if (!hasAdminAccess()) return restrictedPage();
  const allEnrollments = enrichedEnrollments();
  const allCourses = getCourses();
  const allAccounts = getAccounts().filter((account) => account.role === "employee");
  const departments = [...new Set(allAccounts.map((account) => account.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }));
  const selectedCourse = assignCourseId ? getCourseById(assignCourseId) : null;
  const completed = allEnrollments.filter((item) => item.displayStatus === "completed").length;
  const inProgress = allEnrollments.filter((item) => item.displayStatus === "inProgress").length;
  const overdue = allEnrollments.filter((item) => item.displayStatus === "overdue").length;
  const completionRate = allEnrollments.length ? Math.round((completed / allEnrollments.length) * 100) : 0;
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D", t("enrollment.assign"), "hr")}<div class="content"><section class="card panel"><div class="account-toolbar"><div><h2>${t("enrollment.assign")}</h2><p>${t("enrollment.description")}</p></div><button type="button" class="btn btn-primary" data-assign-new>${t("enrollment.assign")}</button></div>${selectedCourse ? `<div class="card"><strong>${t("enrollment.filteringByCourse")}:</strong> ${escapeHtml(selectedCourse.title)} <button type="button" class="btn btn-outline mini-action" data-clear-assign-course>${t("enrollment.clearFilter")}</button></div>` : ""}<div class="kpi-grid"><div class="card kpi"><span>${t("enrollment.totalAssigned")}</span><strong>${allEnrollments.length}</strong></div><div class="card kpi"><span>${t("status.completed")}</span><strong>${completed}</strong>${progress(completionRate)}</div><div class="card kpi"><span>${t("status.inProgress")}</span><strong>${inProgress}</strong></div><div class="card kpi"><span>${t("status.overdue")}</span><strong>${overdue}</strong></div></div><div class="filter-bar"><input id="assignSearchInput" data-focus-key="assign-search" type="search" placeholder="${t("enrollment.searchPlaceholder")}" value="${escapeHtmlAttribute(assignSearch)}" data-assign-search><select data-assign-filter-course><option value="">${t("enrollment.allCourses")}</option>${allCourses.map((course) => `<option value="${escapeHtmlAttribute(course.id)}" ${assignCourseId === course.id ? "selected" : ""}>${escapeHtml(course.title || course.id)}</option>`).join("")}</select><select data-assign-filter-dept><option value="">${t("enrollment.allDepts")}</option>${departments.map((department) => `<option value="${escapeHtmlAttribute(department)}" ${assignFilterDept === department ? "selected" : ""}>${escapeHtml(department)}</option>`).join("")}</select><select data-assign-filter-status><option value="">${t("enrollment.allStatuses")}</option><option value="notStarted" ${assignFilterStatus === "notStarted" ? "selected" : ""}>${t("status.notStarted")}</option><option value="inProgress" ${assignFilterStatus === "inProgress" ? "selected" : ""}>${t("status.inProgress")}</option><option value="completed" ${assignFilterStatus === "completed" ? "selected" : ""}>${t("status.completed")}</option><option value="overdue" ${assignFilterStatus === "overdue" ? "selected" : ""}>${t("status.overdue")}</option></select></div>${enrollmentTable(filteredAssignments())}</section></div>${assignModalOpen ? assignModal() : ""}</main></div>`;
}

function getReportDateBounds() {
  const vnNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const today = vnNow.toISOString().slice(0, 10);
  if (reportDateRange === "today") return { from: today, to: today };
  if (reportDateRange === "7d") { const d = new Date(vnNow); d.setDate(d.getDate() - 6); return { from: d.toISOString().slice(0, 10), to: today }; }
  if (reportDateRange === "30d") { const d = new Date(vnNow); d.setDate(d.getDate() - 29); return { from: d.toISOString().slice(0, 10), to: today }; }
  if (reportDateRange === "month") return { from: `${vnNow.getFullYear()}-${String(vnNow.getMonth() + 1).padStart(2, "0")}-01`, to: today };
  if (reportDateRange === "quarter") { const q = Math.floor(vnNow.getMonth() / 3); return { from: `${vnNow.getFullYear()}-${String(q * 3 + 1).padStart(2, "0")}-01`, to: today }; }
  if (reportDateRange === "year") return { from: `${vnNow.getFullYear()}-01-01`, to: today };
  if (reportDateRange === "custom" && reportDateFrom && reportDateTo && reportDateFrom <= reportDateTo) return { from: reportDateFrom, to: reportDateTo };
  const d = new Date(vnNow); d.setDate(d.getDate() - 29); return { from: d.toISOString().slice(0, 10), to: today };
}

function reportTypeLabel(type) {
  const labels = {
    overview: t("reports.overview"), employees: t("reports.employees"), departments: t("reports.departments"), courses: t("reports.courses"),
    "learning-paths": t("reports.learningPaths"), compliance: t("reports.compliance"), certificates: t("reports.certificates"), quizzes: t("reports.quizzes"), "training-sessions": t("reports.trainingSessions")
  };
  return labels[type] || type;
}

function reportQueryParams(extra = {}) {
  const { from, to } = getReportDateBounds();
  const params = new URLSearchParams({ from_date: from, to_date: to, page: String(reportPage), pageSize: String(reportPageSize), ...extra });
  if (reportDeptFilter) params.set("department", reportDeptFilter);
  if (reportCourseFilter) params.set("courseId", reportCourseFilter);
  if (reportStatusFilter) params.set("status", reportStatusFilter);
  return params;
}

function syncReportUrl() {
  const params = new URLSearchParams();
  params.set("type", reportActiveType);
  params.set("range", reportDateRange);
  if (reportDateFrom) params.set("from", reportDateFrom);
  if (reportDateTo) params.set("to", reportDateTo);
  if (reportDeptFilter) params.set("department", reportDeptFilter);
  if (reportCourseFilter) params.set("courseId", reportCourseFilter);
  if (reportStatusFilter) params.set("status", reportStatusFilter);
  if (reportPage > 1) params.set("page", String(reportPage));
  history.replaceState({}, "", `/admin/reports?${params.toString()}`);
}

function readReportUrl(params) {
  const type = params.get("type");
  if (type) reportActiveType = type;
  reportDateRange = params.get("range") || reportDateRange;
  reportDateFrom = params.get("from") || reportDateFrom;
  reportDateTo = params.get("to") || reportDateTo;
  reportDeptFilter = params.get("department") || reportDeptFilter;
  reportCourseFilter = params.get("courseId") || reportCourseFilter;
  reportStatusFilter = params.get("status") || reportStatusFilter;
  reportPage = Number(params.get("page") || reportPage) || 1;
}

async function loadReports(force = false) {
  if (!hasAdminAccess() || reportLoading) return;
  const key = `${reportActiveType}:${reportQueryParams().toString()}`;
  if (!force && reportLoadedKey === key && reportData) return;
  reportLoading = true; reportError = ""; render();
  try {
    const endpoint = reportActiveType === "overview" ? "/api/admin/reports/overview" : `/api/admin/reports/${reportActiveType}`;
    reportData = await apiJson(`${endpoint}?${reportQueryParams()}`);
    reportLoadedKey = key;
  } catch (e) {
    reportError = e.message || t("reports.loadFailed");
  } finally {
    reportLoading = false; render();
  }
}

function reportKpi(label, value, hint = "") {
  const display = value === null || value === undefined ? "—" : String(value);
  return `<div class="card kpi report-kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(display)}</strong>${hint ? `<small>${escapeHtml(hint)}</small>` : ""}</div>`;
}

function reportOverviewPanel() {
  const m = reportData?.metrics || {};
  const bars = reportData?.departmentComparison || [];
  const max = Math.max(1, ...bars.map(r => Number(r.completionRate || 0)));
  return `${reportLoading ? overviewSkeleton() : ""}
    <div class="kpi-grid">
      ${reportKpi(t("reports.totalEmployees"), m.totalEmployees)}
      ${reportKpi(t("reports.activeLearners"), m.activeLearners)}
      ${reportKpi(t("reports.openCourses"), m.openCourses)}
      ${reportKpi(t("reports.completionRate"), m.completionRate == null ? "—" : `${m.completionRate}%`)}
      ${reportKpi(t("reports.onTimeCompletion"), m.onTimeCompletionRate == null ? "—" : `${m.onTimeCompletionRate}%`)}
      ${reportKpi(t("reports.totalCompletions"), m.totalCompletions)}
      ${reportKpi(t("reports.learningHours"), m.estimatedLearningHours ?? "—", t("reports.noActualHours"))}
      ${reportKpi(t("reports.overdueLearners"), m.overdueLearners)}
    </div>
    <section class="report-grid-2">
      <div class="card panel"><h3>${t("reports.departmentComparison")}</h3><p class="sr-only">${t("reports.chartSummary")}</p><div class="report-bars">${bars.map(r=>`<div class="report-bar-row"><span>${escapeHtml(r.department)}</span><div><i style="width:${Math.max(2, Number(r.completionRate || 0) / max * 100)}%"></i></div><strong>${r.completionRate ?? "—"}%</strong></div>`).join("") || `<div class="empty-state">${t("reports.noData")}</div>`}</div></div>
      <div class="card panel"><h3>${t("reports.priorityExceptions")}</h3><div class="table-wrap"><table><thead><tr><th>${t("reports.employee")}</th><th>${t("reports.content")}</th><th>${t("reports.dueDate")}</th></tr></thead><tbody>${(reportData?.priorityExceptions||[]).map(x=>`<tr><td>${escapeHtml(x.employee||"")}</td><td>${escapeHtml(x.title||"")}</td><td>${escapeHtml(x.dueAt||"")}</td></tr>`).join("") || `<tr><td colspan="3">${t("reports.noOverdue")}</td></tr>`}</tbody></table></div></div>
    </section>`;
}

function reportColumns(type) {
  return {
    employees: [["employee",t("reports.employee")],["employeeCode",t("reports.employeeCode")],["department",t("reports.department")],["jobTitle",t("reports.jobTitle")],["assigned",t("reports.assigned")],["completed",t("reports.completed")],["inProgress",t("reports.inProgress")],["notStarted",t("reports.notStarted")],["overdue",t("reports.overdue")],["completionRate",t("reports.completionRate")],["lastActivityAt",t("reports.lastActivity")]],
    departments: [["department",t("reports.department")],["totalEmployees",t("reports.totalEmployees")],["assigned",t("reports.assigned")],["completed",t("reports.completed")],["completedOnTime",t("reports.onTimeCompletion")],["overdue",t("reports.overdue")],["completionRate",t("reports.completionRate")],["participationRate",t("reports.participationRate")]],
    courses: [["course",t("reports.course")],["version","Version"],["status",t("reports.status")],["assigned",t("reports.assigned")],["notStarted",t("reports.notStarted")],["inProgress",t("reports.inProgress")],["completed",t("reports.completed")],["overdue",t("reports.overdue")],["completionRate",t("reports.completionRate")],["averageQuizScore",t("reports.averageQuizScore")],["averageCompletionDays",t("reports.averageCompletionTime")]],
    "learning-paths": [["learningPath",t("reports.learningPath")],["version","Version"],["assigned",t("reports.assigned")],["notStarted",t("reports.notStarted")],["inProgress",t("reports.inProgress")],["completed",t("reports.completed")],["overdue",t("reports.overdue")],["averageProgress",t("reports.averageProgress")],["bottleneckStep",t("reports.bottleneckStep")]],
    compliance: [["program",t("reports.program")],["cycle",t("reports.cycle")],["version","Version"],["targetEmployees",t("reports.targetEmployees")],["notStarted",t("reports.notStarted")],["inProgress",t("reports.inProgress")],["completedOnTime",t("reports.completedOnTime")],["completedLate",t("reports.completedLate")],["overdue",t("reports.overdue")],["failed",t("reports.failed")],["exempted",t("reports.exempted")],["completionRate",t("reports.completionRate")],["onTimeRate",t("reports.onTimeRate")]],
    certificates: [["certificateType",t("reports.certificateType")],["employee",t("reports.employee")],["employeeCode",t("reports.employeeCode")],["department",t("reports.department")],["verified",t("reports.verified")],["pending",t("reports.pending")],["expiringSoon",t("reports.expiringSoon")],["expired",t("reports.expired")],["missingRequired",t("reports.missingRequired")],["rejected",t("reports.rejected")],["revoked",t("reports.revoked")],["expiresAt",t("reports.expiresAt")]],
    quizzes: [["quiz",t("reports.quiz")],["version","Version"],["attempts",t("reports.attempts")],["participants",t("reports.participants")],["averageScore",t("reports.averageScore")],["passRate",t("reports.passRate")],["retakes",t("reports.retakes")],["hardestQuestion",t("reports.hardestQuestion")]],
    "training-sessions": [["title",t("reports.sessionTitle")],["startAt",t("reports.sessionDate")],["mode",t("reports.trainingMode")],["registered",t("reports.registered")],["present",t("reports.present")],["late",t("reports.late")],["absent",t("reports.absent")],["attendanceRate",t("reports.attendanceRate")]],
  }[type] || [];
}

function reportTablePanel() {
  const rows = reportData?.rows || [];
  const cols = reportColumns(reportActiveType);
  const pages = Math.max(1, Math.ceil((reportData?.total || 0) / reportPageSize));
  return `<section class="card panel report-table-panel"><div class="panel-head"><div><h3>${escapeHtml(reportTypeLabel(reportActiveType))}</h3><p>${t("reports.rows")}: ${reportData?.total ?? 0}</p></div></div><div class="table-wrap report-table-wrap"><table><thead><tr>${cols.map(([,label])=>`<th scope="col">${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${reportLoading?`<tr><td colspan="${cols.length}">${overviewSkeleton()}</td></tr>`:rows.map(row=>`<tr>${cols.map(([key])=>`<td>${escapeHtml(row[key] === true ? t("reports.yes") : row[key] === false ? t("reports.no") : row[key] ?? "—")}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}">${t("reports.noData")}</td></tr>`}</tbody></table></div><nav class="pagination" aria-label="${t("reports.pagination")}"><button data-report-page="${reportPage-1}" ${reportPage<=1?"disabled":""}>‹</button><span>${reportPage} / ${pages}</span><button data-report-page="${reportPage+1}" ${reportPage>=pages?"disabled":""}>›</button></nav></section>`;
}

function reportsPage() {
  if (!hasAdminAccess()) return restrictedPage();
  if (!reportLoadedKey && !reportLoading) queueMicrotask(()=>loadReports());
  const { from, to } = getReportDateBounds();
  const tabs = ["overview","employees","departments","courses","learning-paths","compliance","certificates","quizzes","training-sessions"];
  const rangeOptions = [["today",t("reports.today")],["7d",t("reports.last7Days")],["30d",t("reports.last30Days")],["month",t("reports.thisMonth")],["quarter",t("reports.thisQuarter")],["year",t("reports.thisYear")],["custom",t("reports.custom")]];
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR/L&D Analytics", t("admin.reports"), "hr")}<div class="content reports-page">
    <section class="card panel report-head"><div><h1>${t("reports.title")}</h1><p>${t("reports.period")}: <strong>${escapeHtml(from)} - ${escapeHtml(to)}</strong></p></div><div class="report-actions"><button class="btn btn-outline" data-report-export-format="csv" ${reportExporting?"disabled":""}>${t("reports.csv")}</button><button class="btn btn-outline" data-report-export-format="xlsx" ${reportExporting?"disabled":""}>${t("reports.excel")}</button><button class="btn btn-outline" data-report-export-format="pdf" ${reportExporting?"disabled":""}>${t("reports.pdf")}</button></div></section>
    <section class="card panel report-filter-bar"><div class="filter-bar reports-filter">
      <label><span>${t("reports.dateRange")}</span><select data-report-range>${rangeOptions.map(([v,l])=>`<option value="${v}" ${reportDateRange===v?"selected":""}>${l}</option>`).join("")}</select></label>
      ${reportDateRange==="custom"?`<label><span>${t("reports.fromDate")}</span><input type="date" id="reportFrom" value="${escapeHtmlAttribute(reportDateFrom)}"></label><label><span>${t("reports.toDate")}</span><input type="date" id="reportTo" value="${escapeHtmlAttribute(reportDateTo)}"></label><button class="btn btn-primary" id="reportApply">${t("reports.apply")}</button>`:""}
      <label><span>${t("reports.department")}</span><input data-report-dept value="${escapeHtmlAttribute(reportDeptFilter)}" placeholder="${t("reports.allDepartments")}"></label>
      <label><span>${t("reports.course")}</span><input data-report-course value="${escapeHtmlAttribute(reportCourseFilter)}" placeholder="${t("reports.courseId")}"></label>
      <label><span>${t("reports.status")}</span><select data-report-status><option value="">${t("reports.allStatuses")}</option>${["notStarted","inProgress","completed","overdue","pending","verified","expired","missing","failed","exempted"].map(s=>`<option value="${s}" ${reportStatusFilter===s?"selected":""}>${t(`reports.${s}`)}</option>`).join("")}</select></label>
      <button class="btn btn-outline" id="reportReset">${t("reports.resetFilters")}</button>
    </div></section>
    <div class="detail-tabs report-tabs" role="tablist">${tabs.map(type=>`<button role="tab" aria-selected="${reportActiveType===type}" class="${reportActiveType===type?"active":""}" data-report-tab="${type}">${escapeHtml(reportTypeLabel(type))}</button>`).join("")}</div>
    ${reportError?`<section class="card panel form-error">${escapeHtml(reportError)} <button class="btn btn-outline mini-action" data-report-retry>${t("reports.retry")}</button></section>`:""}
    ${reportActiveType==="overview"?reportOverviewPanel():reportTablePanel()}
  </div></main></div>`;
}

function employeeGalleryPage(){
  if(!hasEmployeeAccess())return restrictedPage(); const ctx=getCurrentEmployeeContext(); const courseIds=new Set(employeeEnrollments().map(e=>e.courseId));
  const rows=readLocalRows(GALLERY_KEY).filter(a=>a.status==="published"&&(a.visibility==="all_employees"||(a.courseId&&courseIds.has(a.courseId))||(a.visibility==="departments"&&(a.departmentNames||[]).includes(ctx.employee?.department))));
  const filtered=rows.filter(a=>(!gallerySearch||`${a.title} ${a.description}`.toLowerCase().includes(gallerySearch.toLowerCase()))&&(!galleryYear||String(a.eventDate||"").startsWith(galleryYear)));
  return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Thư viện","Ảnh","employee")}<div class="content"><section class="library-head"><div><h1>Thư viện ảnh</h1><p>Album được HR chia sẻ theo khóa học và phòng ban của bạn.</p></div><div class="filter-bar"><input type="search" data-gallery-search value="${escapeHtmlAttribute(gallerySearch)}" placeholder="Tìm album"><select data-gallery-year><option value="">Tất cả năm</option>${[...new Set(rows.map(x=>String(x.eventDate||"").slice(0,4)).filter(Boolean))].map(y=>`<option ${galleryYear===y?"selected":""}>${y}</option>`).join("")}</select></div></section>${filtered.length?`<div class="gallery-grid">${filtered.map(a=>`<article class="card album-card"><img src="${escapeHtmlAttribute(a.coverUrl||"/images/communication-training-course.png")}" alt="${escapeHtmlAttribute(a.coverAlt||a.title)}" loading="lazy"><div><time>${escapeHtml(a.eventDate||"")}</time><h2>${escapeHtml(a.title)}</h2><p>${escapeHtml(a.description||"")}</p><span>${Number(a.imageCount||a.images?.length||1)} ảnh${a.courseId?` · ${escapeHtml(getCourseById(a.courseId)?.title||"")}`:""}</span></div></article>`).join("")}</div>`:`<div class="empty-state"><h2>Chưa có album phù hợp</h2><p>Album được xuất bản và cấp quyền sẽ xuất hiện tại đây.</p></div>`}</div></main></div>`;
}
function adminGalleryPage(){if(!hasAdminAccess())return restrictedPage();const rows=readLocalRows(GALLERY_KEY);return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D","Quản lý ảnh","hr")}<div class="content"><section class="card panel"><div class="panel-head"><div><h1>Album đào tạo</h1><p>Chỉ album Published mới hiển thị cho nhân viên đúng quyền.</p></div></div><form id="galleryForm" class="form-2col"><div class="field"><label>Tên album</label><input name="title" required></div><div class="field"><label>Ngày sự kiện</label><input name="eventDate" type="date" required></div><div class="field"><label>Quyền xem</label><select name="visibility"><option value="all_employees">Tất cả nhân viên</option><option value="course_assignees">Người được giao khóa học</option><option value="departments">Theo phòng ban</option></select></div><div class="field"><label>Khóa học liên quan</label><select name="courseId"><option value="">Không liên kết</option>${getCourses().map(c=>`<option value="${c.id}">${escapeHtml(c.title)}</option>`).join("")}</select></div><div class="field"><label>URL ảnh bìa</label><input name="coverUrl" type="url" placeholder="https://..."></div><div class="field"><label>Mô tả / alt text</label><input name="description"></div><button class="btn btn-primary" type="submit">Tạo và xuất bản album</button></form></section><section class="gallery-grid">${rows.map(a=>`<article class="card album-card"><img src="${escapeHtmlAttribute(a.coverUrl||"/images/leadership-training-course.png")}" alt="${escapeHtmlAttribute(a.title)}"><div><span class="badge ${a.status}">${a.status}</span><h2>${escapeHtml(a.title)}</h2><p>${escapeHtml(a.visibility)}</p><button class="btn btn-outline" data-gallery-toggle="${a.id}">${a.status==="published"?"Archive":"Publish"}</button></div></article>`).join("")||`<div class="empty-state">Chưa có album.</div>`}</section></div></main></div>`;}
function galleryContext(){const {account,employee}=getCurrentEmployeeContext();return {account,employee,enrollments:employeeEnrollments()};}
function galleryPageV2(albumId=""){if(!hasEmployeeAccess())return restrictedPage();if(albumId)return albumDetailPage(albumId);const rows=galleryService.visibleFor(galleryContext()).filter(a=>(!gallerySearch||`${a.title} ${a.description}`.toLowerCase().includes(gallerySearch.toLowerCase()))&&(!galleryYear||String(a.eventDate).startsWith(galleryYear)));return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Thư viện","Album đào tạo","employee")}<div class="content route-content"><section class="library-head"><div><h1>Thư viện album đào tạo</h1><p>Xem lại các hoạt động đào tạo được chia sẻ với bạn.</p></div><div class="filter-bar"><input data-gallery-search type="search" value="${escapeHtmlAttribute(gallerySearch)}" placeholder="Tìm album"><select data-gallery-year><option value="">Tất cả năm</option>${[...new Set(rows.map(a=>a.eventDate?.slice(0,4)).filter(Boolean))].map(y=>`<option ${galleryYear===y?"selected":""}>${y}</option>`).join("")}</select></div></section><div class="gallery-grid">${rows.map(albumCard).join("")||`<div class="empty-state"><h2>Chưa có album phù hợp</h2><p>Album được xuất bản đúng quyền sẽ xuất hiện tại đây.</p></div>`}</div></div></main></div>`;}
function albumCard(a){const images=a.mediaItems.filter(x=>x.type==="image").length,videos=a.mediaItems.length-images,cover=a.mediaItems.find(x=>x.id===a.coverMediaId)||a.mediaItems[0];const coverHtml=cover?.type==="youtube"?`<img src="https://i.ytimg.com/vi/${cover.youtubeVideoId}/hqdefault.jpg" alt="${escapeHtmlAttribute(a.title)}" loading="lazy">`:cover?.blobId?`<div class="album-blob-cover" data-media-blob="${cover.blobId}" data-media-kind="${cover.type}"><span>MyKIS Learning</span></div>`:`<div class="album-fallback">MyKIS Learning</div>`;return `<article class="card album-card">${coverHtml}<div><time>${escapeHtml(a.eventDate||"")}</time><h2>${escapeHtml(a.title)}</h2><p>${images} ảnh · ${videos} video</p><span>${escapeHtml(getCourseById(a.courseId)?.title||"")}</span><a class="btn btn-primary" href="/dashboard/gallery/${a.id}" data-link>Xem album</a></div></article>`;}
function albumDetailPage(id){const album=galleryService.get(id);if(!galleryService.canView(album,galleryContext()))return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Thư viện","Không có quyền xem","employee")}<div class="content"><div class="empty-state"><h1>Không có quyền xem album</h1><a href="/dashboard/gallery" data-link class="btn btn-primary">Quay lại thư viện</a></div></div></main></div>`;const media=album.mediaItems.filter(x=>galleryMediaFilter==="all"||x.type===galleryMediaFilter||(galleryMediaFilter==="video"&&x.type==="youtube"));return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Thư viện",album.title,"employee")}<div class="content route-content"><a href="/dashboard/gallery" data-link class="back-link">← Quay lại album</a><header class="album-detail-head"><div><h1>${escapeHtml(album.title)}</h1><p>${escapeHtml(album.description||"")}</p><div>${escapeHtml(album.eventDate||"")}${album.location?` · ${escapeHtml(album.location)}`:""}${album.courseId?` · ${escapeHtml(getCourseById(album.courseId)?.title||"")}`:""}</div></div></header><div class="media-filter" role="tablist">${[["all","Tất cả"],["image","Ảnh"],["video","Video"]].map(([v,l])=>`<button class="${galleryMediaFilter===v?"active":""}" data-media-filter="${v}" role="tab" aria-selected="${galleryMediaFilter===v}">${l}</button>`).join("")}</div><div class="media-grid">${media.slice(0,50).map((m,i)=>mediaCard(m,i)).join("")||`<div class="empty-state">Album chưa có media.</div>`}</div></div></main>${mediaViewer(album,media)}</div>`;}
function mediaCard(m,i){const visual=m.type==="youtube"?`<img src="https://i.ytimg.com/vi/${m.youtubeVideoId}/hqdefault.jpg" alt="${escapeHtmlAttribute(m.alt||m.caption||"Video")}" loading="lazy"><span class="play-badge">▶</span>`:`<div class="media-blob-placeholder" data-media-blob="${m.blobId}" data-media-kind="${m.type}"><span>${m.type==="video"?"▶ Video":"Ảnh"}</span></div>`;return `<button class="media-card" data-open-media="${i}" aria-label="Mở ${escapeHtmlAttribute(m.caption||m.fileName||"media")}">${visual}<span>${escapeHtml(m.caption||m.fileName||"")}</span></button>`;}
function mediaViewer(album,media){if(mediaViewerIndex<0||!media[mediaViewerIndex])return "";const m=media[mediaViewerIndex];const body=m.type==="youtube"?`<iframe src="https://www.youtube.com/embed/${m.youtubeVideoId}" title="${escapeHtmlAttribute(m.caption||album.title)}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>`:m.type==="video"?`<video controls preload="metadata" data-viewer-blob="${m.blobId}"></video>`:`<img data-viewer-blob="${m.blobId}" alt="${escapeHtmlAttribute(m.alt||m.caption||album.title)}">`;return `<div class="media-viewer open" role="dialog" aria-modal="true" aria-label="Media viewer"><button class="media-viewer__close" data-close-media aria-label="Đóng">×</button><button class="media-viewer__nav prev" data-media-index="${mediaViewerIndex-1}" ${mediaViewerIndex===0?"disabled":""} aria-label="Trước">‹</button><figure>${body}<figcaption><strong>${mediaViewerIndex+1} / ${media.length}</strong><span>${escapeHtml(m.caption||"")}</span></figcaption></figure><button class="media-viewer__nav next" data-media-index="${mediaViewerIndex+1}" ${mediaViewerIndex===media.length-1?"disabled":""} aria-label="Sau">›</button></div>`;}
function adminGalleryPageV2(){if(!hasAdminAccess())return restrictedPage();const rows=galleryService.list();return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D","Album đa phương tiện","hr")}<div class="content route-content"><section class="library-head"><div><h1>Album đào tạo</h1><p>Ảnh và video được lưu trong IndexedDB; chỉ metadata nằm trong prototype storage.</p></div><button class="btn btn-primary" data-create-album>+ Tạo album</button></section><div class="gallery-grid">${rows.map(a=>`<article class="card album-card"><div class="album-fallback">${a.mediaItems.length} media</div><div><span class="badge ${a.status}">${a.status}</span><h2>${escapeHtml(a.title)}</h2><p>${a.mediaItems.filter(x=>x.type==="image").length} ảnh · ${a.mediaItems.filter(x=>x.type!=="image").length} video</p><div class="card-actions"><button class="btn btn-primary" data-edit-album="${a.id}">Quản lý album</button><button class="btn btn-outline" data-gallery-toggle="${a.id}">${a.status==="published"?"Archive":"Publish"}</button></div></div></article>`).join("")||`<div class="empty-state">Chưa có album. Hãy tạo album đầu tiên.</div>`}</div></div></main>${albumEditorModal()}</div>`;}
function albumEditorModal(){if(!galleryEditorOpen)return "";const a=galleryService.get(selectedAlbumId)||{mediaItems:[],status:"draft",visibility:"all_employees"};return `<div class="modal-backdrop open"><form id="albumEditorForm" class="modal modal--xlarge modal--structured" role="dialog" aria-modal="true"><header class="modal__header"><div><h2>${a.id?"Sửa album":"Tạo album"}</h2></div><button type="button" class="icon-btn" data-close-album-editor>×</button></header><div class="modal__body"><input type="hidden" name="id" value="${escapeHtmlAttribute(a.id||"")}"><div class="form-2col"><div class="field"><label>Tên album *</label><input name="title" required value="${escapeHtmlAttribute(a.title||"")}"></div><div class="field"><label>Ngày sự kiện</label><input name="eventDate" type="date" value="${escapeHtmlAttribute(a.eventDate||"")}"></div><div class="field"><label>Địa điểm</label><input name="location" value="${escapeHtmlAttribute(a.location||"")}"></div><div class="field"><label>Course liên quan</label><select name="courseId"><option value="">Không liên kết</option>${getCourses().map(c=>`<option value="${c.id}" ${a.courseId===c.id?"selected":""}>${escapeHtml(c.title)}</option>`).join("")}</select></div><div class="field span-2"><label>Mô tả</label><textarea name="description" rows="3">${escapeHtml(a.description||"")}</textarea></div><div class="field"><label>Quyền xem</label><select name="visibility">${[["all_employees","Toàn bộ nhân viên"],["course_assignees","Người được giao course"],["course_completed","Đã hoàn thành course"],["departments","Theo phòng ban"]].map(([v,l])=>`<option value="${v}" ${a.visibility===v?"selected":""}>${l}</option>`).join("")}</select></div><div class="field"><label>Trạng thái</label><select name="status"><option value="draft" ${a.status==="draft"?"selected":""}>Draft</option><option value="published" ${a.status==="published"?"selected":""}>Published</option><option value="archived" ${a.status==="archived"?"selected":""}>Archived</option></select></div></div>${a.id?`<section class="album-upload-zone"><label for="albumFiles"><strong>Upload ảnh / video</strong><span>Chọn nhiều JPG, PNG, WebP, MP4 hoặc WebM</span></label><input id="albumFiles" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple><div class="youtube-add"><input data-youtube-url placeholder="URL YouTube"><input data-youtube-caption placeholder="Caption"><button type="button" class="btn btn-outline" data-add-youtube>+ Thêm YouTube</button></div></section><div class="media-admin-list">${a.mediaItems.map(m=>`<div><span>${m.type}</span><strong>${escapeHtml(m.caption||m.fileName||m.youtubeVideoId||"")}</strong><button type="button" class="btn btn-ghost" data-remove-album-media="${m.id}">Xóa</button></div>`).join("")||`<p>Chưa có media. Lưu thông tin album trước, sau đó upload.</p>`}</div>`:`<p class="form-note">Lưu album trước để bắt đầu upload media.</p>`}</div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-close-album-editor>Đóng</button><button class="btn btn-primary" type="submit">Lưu album</button></footer></form></div>`;}
function resourceRows(){const existing=readLocalRows(RESOURCES_KEY);if(existing.length)return existing;const course=getCourses().find(c=>c.status==="published")||getCourses()[0];if(!course)return [];const seed=[{id:"resource-handbook",courseId:course.id,title:"Handbook sau đào tạo",description:"Tài liệu tổng kết và checklist áp dụng.",type:"link",externalUrl:"https://www.kisvn.vn/",unlockRule:"after_completion",downloadable:false,createdAt:new Date().toISOString()}];writeLocalRows(RESOURCES_KEY,seed);return seed;}
function isResourceUnlocked(r,e){if(r.unlockRule==="always")return true;if(r.unlockRule==="after_completion")return e?.status==="completed";if(r.unlockRule==="after_quiz_pass")return getQuizAttemptsByAccountId(session.accountId).some(a=>a.quizId===r.requiredQuizId&&a.passed);return false;}
function employeeResourcesPage(){if(!hasEmployeeAccess())return restrictedPage();const enrollments=employeeEnrollments();const byCourse=new Map(enrollments.map(e=>[e.courseId,e]));const rows=resourceRows().filter(r=>byCourse.has(r.courseId)&&(!resourceSearch||r.title.toLowerCase().includes(resourceSearch.toLowerCase())));return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Thư viện","Tài liệu","employee")}<div class="content"><section class="library-head"><div><h1>Thư viện tài liệu</h1><p>Tài liệu từ các khóa học được giao; quyền mở được kiểm tra lại khi truy cập.</p></div><input type="search" data-resource-search value="${escapeHtmlAttribute(resourceSearch)}" placeholder="Tìm tài liệu"></section><div class="resource-list">${rows.map(r=>{const open=isResourceUnlocked(r,byCourse.get(r.courseId));return `<article class="card resource-row"><div><span class="badge ${open?"completed":"pending"}">${open?"Đã mở khóa":"Bị khóa"}</span><h2>${escapeHtml(r.title)}</h2><p>${escapeHtml(getCourseById(r.courseId)?.title||"")} · ${escapeHtml(r.description||"")}</p>${!open?`<small>Hoàn thành khóa học để mở khóa.</small>`:""}</div>${open&&r.externalUrl?`<a class="btn btn-primary" href="${escapeHtmlAttribute(r.externalUrl)}" target="_blank" rel="noopener" data-resource-open="${r.id}">Xem tài liệu</a>`:`<button class="btn btn-outline" disabled>Chưa thể mở</button>`}</article>`}).join("")||`<div class="empty-state">Chưa có tài liệu phù hợp.</div>`}</div></div></main></div>`;}
async function loadLearningHistory(force=false){if(!session?.accountId||_learningHistoryLoading)return;if(_learningHistory&&!force)return;_learningHistoryLoading=true;_learningHistoryError="";render();try{_learningHistory=await apiJson("/api/learning-history/me");}catch(e){_learningHistoryError=e.message||"Không thể tải lịch sử học tập.";}finally{_learningHistoryLoading=false;render();}}
async function loadAdminLearning(force=false){if(!hasAdminAccess()||_adminLearning.loading)return;if(_adminLearning.summary&&!force)return;_adminLearning.loading=true;_adminLearning.error="";render();try{const status=_adminLearning.tab==="pending"?"submitted":_adminLearning.status;const qs=new URLSearchParams({page:String(_adminLearning.page),pageSize:"20"});if(status)qs.set("status",status);if(_adminLearning.q)qs.set("q",_adminLearning.q);const certQs=new URLSearchParams({page:String(_adminLearning.page),pageSize:"20"});if(_adminLearning.tab==="pending")certQs.set("verificationStatus","submitted");if(_adminLearning.q)certQs.set("q",_adminLearning.q);const [summary,records,certs]=await Promise.all([apiJson("/api/admin/learning-records/summary"),apiJson(`/api/admin/learning-records?${qs}`),apiJson(`/api/admin/certifications?${certQs}`)]);_adminLearning.summary=summary.summary;_adminLearning.records=records.items||[];_adminLearning.totalRecords=records.total||0;_adminLearning.certifications=certs.items||[];_adminLearning.totalCertifications=certs.total||0;}catch(e){_adminLearning.error=e.message||"Không thể tải hồ sơ học tập.";}finally{_adminLearning.loading=false;render();}}
async function loadCertificateAdmin(force=false){if(!hasAdminAccess()||_certAdmin.loading)return;if(_certAdmin.overview&&!force)return;_certAdmin.loading=true;_certAdmin.error="";render();try{const qs=new URLSearchParams({page:"1",pageSize:"50"});if(_certAdmin.q)qs.set("q",_certAdmin.q);const [overview,types,rows,missing,requirements]=await Promise.all([apiJson("/api/admin/certificates/overview"),apiJson("/api/admin/certificates/types"),apiJson(`/api/admin/certificates?${qs}`),apiJson("/api/admin/certificates/missing"),apiJson("/api/admin/certificates/requirements")]);_certAdmin.overview=overview.data||{};_certAdmin.types=types.data||[];_certAdmin.rows=rows.data||[];_certAdmin.missing=missing.data||[];_certAdmin.requirements=requirements.data||[];}catch(e){_certAdmin.error=e.message||"Không thể tải chứng chỉ.";}finally{_certAdmin.loading=false;render();}}
async function loadMyCertificates(force=false){if(!hasEmployeeAccess()||_certMy.loading)return;if(_certMy.rows.length&&!force)return;_certMy.loading=true;_certMy.error="";render();try{const body=await apiJson("/api/certificates/my");_certMy.rows=body.data||[];}catch(e){_certMy.error=e.message||"Không thể tải chứng chỉ của bạn.";}finally{_certMy.loading=false;render();}}
const LR_STATUS_LABELS={draft:"Bản nháp",submitted:"Đã gửi HR",in_review:"HR đang xem xét",needs_revision:"Cần bổ sung",approved:"Đã phê duyệt",rejected:"Đã từ chối",archived:"Đã lưu trữ"};
const CERT_STATUS_LABELS={valid:"Còn hiệu lực",expiring_soon:"Sắp hết hạn",expired:"Đã hết hạn",no_expiry:"Không thời hạn",revoked:"Đã thu hồi"};
function learningStatusBadge(s){const cls=s==="approved"?"active":s==="rejected"?"draft":s==="needs_revision"?"pending":"pending";return `<span class="badge ${cls}">${escapeHtml(LR_STATUS_LABELS[s]||s||"")}</span>`;}
function certStatusBadge(s){const cls=s==="valid"||s==="no_expiry"?"active":s==="expired"||s==="revoked"?"draft":"pending";return `<span class="badge ${cls}">${escapeHtml(CERT_STATUS_LABELS[s]||LR_STATUS_LABELS[s]||s||"")}</span>`;}
function learningRecordCard(item){const isCert=item.kind==="certificate";const title=isCert?item.certificateName:item.title;const source=isCert?item.issuer:(item.sourceType==="system"?"KIS":item.sourceType==="hr_entry"?"HR nhập":"Bên ngoài");const date=isCert?item.issuedDate:item.completionDate;const status=isCert?item.verificationStatus:item.status;return `<article class="learning-card"><div><span class="badge ${item.sourceType==="system"?"active":"pending"}">${escapeHtml(source||"—")}</span><h3>${escapeHtml(title||"—")}</h3><p>${escapeHtml(isCert?item.certificateType:(item.category||item.deliveryMethod||item.recordType||"Đào tạo"))}</p></div><div class="learning-card__meta"><span>${escapeHtml(date||"—")}</span>${!isCert?`<span>${Number(item.durationHours||0)} giờ</span>`:""}${isCert?certStatusBadge(item.verificationStatus==="approved"?item.status:item.verificationStatus):learningStatusBadge(status)}</div>${item.revisionNote?`<p class="form-error">Cần bổ sung: ${escapeHtml(item.revisionNote)}</p>`:""}${item.rejectionReason?`<p class="form-error">Lý do từ chối: ${escapeHtml(item.rejectionReason)}</p>`:""}</article>`;}
function certificateAttentionRank(c){return ({expired:0,expiring_soon:1,rejected:2,pending_verification:3,valid:4,superseded:5,revoked:6}[c.status]??9);}
function certPhase4Badge(status){const label={valid:"Còn hiệu lực",expiring_soon:"Sắp hết hạn",expired:"Đã hết hạn",pending_verification:"Chờ xác minh",rejected:"Bị từ chối",revoked:"Thu hồi",superseded:"Bản cũ",verified:"Đã xác minh"}[status]||status;const cls=["valid","verified"].includes(status)?"active":["expired","rejected","revoked"].includes(status)?"draft":"pending";return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;}
function adminCertificatesPage(){if(!hasAdminAccess())return restrictedPage();if(!_certAdmin.overview&&!_certAdmin.loading)queueMicrotask(()=>loadCertificateAdmin());const o=_certAdmin.overview||{};const rows=_certAdmin.tab==="missing"?_certAdmin.missing:_certAdmin.rows;return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D","Chứng chỉ hành nghề","hr")}<div class="content admin-learning"><section class="learning-hero"><div><h1>Chứng chỉ hành nghề</h1><p>Quản lý loại chứng chỉ, xác minh hồ sơ, gia hạn và cảnh báo hết hạn.</p></div><div class="learning-actions"><button class="btn btn-outline" data-cert-admin-reload>Tải lại</button><button class="btn btn-primary" data-cert-type-create>Thêm loại chứng chỉ</button></div></section>${_certAdmin.error?`<p class="form-error">${escapeHtml(_certAdmin.error)}</p>`:""}<div class="kpi-grid">${[["Chờ xác minh",o.pending],["Còn hiệu lực",o.valid],["Sắp hết hạn",o.expiringSoon],["Đã hết hạn",o.expired],["Thiếu bắt buộc",o.missingRequired],["Từ chối/thu hồi",o.rejectedOrRevoked]].map(([l,v])=>`<div class="card kpi"><span class="label">${l}</span>${_certAdmin.overview?`<strong>${escapeHtml(String(v??0))}</strong>`:`<span class="kpi-loading"></span>`}</div>`).join("")}</div><section class="card panel"><div class="panel-head"><div class="view-tabs">${[["overview","Danh sách"],["types","Loại chứng chỉ"],["requirements","Bắt buộc"],["missing","Thiếu chứng chỉ"]].map(([v,l])=>`<button class="${_certAdmin.tab===v?"active":""}" data-cert-admin-tab="${v}">${l}</button>`).join("")}</div><input data-cert-admin-search value="${escapeHtmlAttribute(_certAdmin.q)}" placeholder="Tìm nhân viên, số chứng chỉ, đơn vị cấp"></div>${_certAdmin.tab==="types"?certificateTypesTable():_certAdmin.tab==="requirements"?certificateRequirementsTable():_certAdmin.tab==="missing"?missingCertificatesTable(rows):certificatesTable(rows)}</section></div></main></div>`;}
function certificateTypesTable(){return `<div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tên loại</th><th>Đơn vị cấp</th><th>Hết hạn</th><th>Cảnh báo</th><th>Trạng thái</th></tr></thead><tbody>${_certAdmin.types.map(t=>`<tr><td>${escapeHtml(t.code||"")}</td><td><strong>${escapeHtml(t.name||"")}</strong><small>${escapeHtml(t.category||"")}</small></td><td>${escapeHtml(t.issuerName||"—")}</td><td>${t.hasExpiration?"Có":"Không"}</td><td>${Number(t.defaultWarningDays||60)} ngày</td><td>${certPhase4Badge(t.status)}</td></tr>`).join("")||`<tr><td colspan="6">Chưa có loại chứng chỉ.</td></tr>`}</tbody></table></div>`;}
function certificateRequirementsTable(){return `<div class="table-wrap"><table><thead><tr><th>Loại chứng chỉ</th><th>Áp dụng</th><th>Giá trị</th><th>Hiệu lực</th></tr></thead><tbody>${_certAdmin.requirements.map(r=>`<tr><td>${escapeHtml(r.certificateType?.name||"—")}</td><td>${escapeHtml(r.targetType)}</td><td>${escapeHtml(r.targetValue||"Toàn bộ")}</td><td>${escapeHtml(r.effectiveFrom||"")} ${r.effectiveUntil?`→ ${escapeHtml(r.effectiveUntil)}`:""}</td></tr>`).join("")||`<tr><td colspan="4">Chưa có quy tắc bắt buộc.</td></tr>`}</tbody></table></div>`;}
function missingCertificatesTable(rows){return `<div class="table-wrap"><table><thead><tr><th>Nhân viên</th><th>Phòng ban</th><th>Chức danh</th><th>Chứng chỉ bắt buộc</th><th>Trạng thái</th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${escapeHtml(x.employee?.fullName||"—")}</strong><small>${escapeHtml(x.employee?.employeeCode||"")}</small></td><td>${escapeHtml(x.employee?.department||"—")}</td><td>${escapeHtml(x.employee?.position||"—")}</td><td>${escapeHtml(x.requirement?.certificateType?.name||"—")}</td><td>${certPhase4Badge(x.status)}</td></tr>`).join("")||`<tr><td colspan="5">Không có nhân viên thiếu chứng chỉ theo quy tắc hiện tại.</td></tr>`}</tbody></table></div>`;}
function certificatesTable(rows){return `<div class="table-wrap"><table><thead><tr><th>Nhân viên</th><th>Loại chứng chỉ</th><th>Số chứng chỉ</th><th>Đơn vị cấp</th><th>Ngày hết hạn</th><th>Trạng thái</th><th>Xác minh</th><th>Thao tác</th></tr></thead><tbody>${_certAdmin.loading?`<tr><td colspan="8">${overviewSkeleton()}</td></tr>`:rows.map(c=>`<tr><td><strong>${escapeHtml(c.employee?.fullName||"—")}</strong><small>${escapeHtml(c.employee?.employeeCode||"")}</small></td><td>${escapeHtml(c.certificateTypeName||c.certificateName||"—")}</td><td>${escapeHtml(c.certificateNumber||"—")}</td><td>${escapeHtml(c.issuer||"—")}</td><td>${escapeHtml(c.noExpiration?"Không thời hạn":c.expiresAt||"—")}</td><td>${certPhase4Badge(c.status)}</td><td>${certPhase4Badge(c.verificationStatus)}</td><td><button class="btn btn-outline mini-action" data-cert-admin-action="verify" data-cert-id="${escapeHtmlAttribute(c.id)}" ${c.verificationStatus==="verified"?"disabled":""}>Duyệt</button><button class="btn btn-outline mini-action" data-cert-admin-action="reject" data-cert-id="${escapeHtmlAttribute(c.id)}">Từ chối</button><button class="btn btn-outline mini-action" data-cert-admin-action="revoke" data-cert-id="${escapeHtmlAttribute(c.id)}">Thu hồi</button></td></tr>`).join("")||`<tr><td colspan="8">Không có chứng chỉ phù hợp.</td></tr>`}</tbody></table></div>`;}
function myCertificatesPage(){if(!hasEmployeeAccess())return restrictedPage();if(!_certMy.rows.length&&!_certMy.loading)queueMicrotask(()=>loadMyCertificates());const rows=[..._certMy.rows].sort((a,b)=>certificateAttentionRank(a)-certificateAttentionRank(b));return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Học tập","Chứng chỉ của tôi","employee")}<div class="content learning-history"><section class="learning-hero"><div><h1>Chứng chỉ của tôi</h1><p>Theo dõi chứng chỉ đã tải lên, trạng thái xác minh, ngày hết hạn và lịch sử gia hạn.</p></div><div class="learning-actions"><button class="btn btn-outline" data-cert-my-reload>Tải lại</button><button class="btn btn-primary" data-cert-my-upload> Tải chứng chỉ</button></div></section>${_certMy.error?`<p class="form-error">${escapeHtml(_certMy.error)}</p>`:""}<div class="learning-list">${_certMy.loading?overviewSkeleton():rows.map(myCertificateCard).join("")||`<div class="empty-state"><h3>Chưa có chứng chỉ.</h3></div>`}</div></div></main>${certificateUploadModal()}</div>`;}
function myCertificateCard(c){const due=c.daysUntilExpiry===null?"Không thời hạn":c.daysUntilExpiry<0?`Quá hạn ${Math.abs(c.daysUntilExpiry)} ngày`:`Còn ${c.daysUntilExpiry} ngày`;return `<article class="learning-card"><div><span class="badge pending">${escapeHtml(c.issuer||"—")}</span><h3>${escapeHtml(c.certificateTypeName||c.certificateName||"—")}</h3><p>${escapeHtml(c.certificateNumber||"Chưa có số chứng chỉ")}</p>${c.rejectionReason?`<p class="form-error">Lý do từ chối: ${escapeHtml(c.rejectionReason)}</p>`:""}</div><div class="learning-card__meta"><span>Cấp ngày ${escapeHtml(c.issuedAt||"—")}</span><span>${escapeHtml(due)}</span>${certPhase4Badge(c.status)}<button class="btn btn-outline mini-action" data-cert-renew="${escapeHtmlAttribute(c.id)}">Gia hạn</button></div></article>`;}
function certificateUploadModal(){if(!_certMy.formOpen&&!_certMy.renewId)return"";const renew=Boolean(_certMy.renewId);return `<div class="modal-backdrop open"><form id="certificateUploadForm" class="modal modal--large modal--structured"><header class="modal__header"><div><h2>${renew?"Gia hạn chứng chỉ":"Tải chứng chỉ"}</h2></div><button type="button" class="icon-btn" data-cert-upload-close>×</button></header><div class="modal__body"><div class="form-2col"><div class="field"><label>Loại chứng chỉ *</label><input name="certificate_type" required placeholder="VD: Chứng chỉ hành nghề Môi giới chứng khoán"></div><div class="field"><label>Số chứng chỉ</label><input name="certificate_number"></div><div class="field"><label>Đơn vị cấp *</label><input name="issuer" required></div><div class="field"><label>Ngày cấp *</label><input type="date" name="issued_at" required></div><div class="field"><label>Ngày hết hạn</label><input type="date" name="expires_at"></div><label class="field checkbox-field"><input type="checkbox" name="no_expiry"> Không thời hạn</label><div class="field" style="grid-column:1/-1"><label>Ghi chú</label><textarea name="notes" rows="3"></textarea></div><div class="field" style="grid-column:1/-1"><label>File minh chứng *</label><input type="file" name="evidence" accept=".pdf,.jpg,.jpeg,.png,.webp" required></div></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-cert-upload-close>Hủy</button><button class="btn btn-primary" ${_certMy.submitting?"disabled":""}>${_certMy.submitting?"Đang gửi...":"Gửi HR xác minh"}</button></footer></form></div>`;}
function learningHistoryPage(){if(!hasEmployeeAccess())return restrictedPage();if(!_learningHistory&&!_learningHistoryLoading)queueMicrotask(()=>loadLearningHistory());const data=_learningHistory;const items=[...(data?.items||[]),...(data?.pendingSubmissions||[])];const filtered=items.filter(x=>{if(_learningHistoryTab==="training"&&x.kind==="certificate")return false;if(_learningHistoryTab==="certificates"&&x.kind!=="certificate")return false;if(_learningHistoryFilter==="internal")return x.sourceType==="system";if(_learningHistoryFilter==="external")return x.sourceType!=="system";if(_learningHistoryFilter==="approved")return (x.status==="approved"||x.verificationStatus==="approved");if(_learningHistoryFilter==="pending")return ["submitted","in_review"].includes(x.status||x.verificationStatus);if(_learningHistoryFilter==="needs_revision")return (x.status||x.verificationStatus)==="needs_revision";return true;});const s=data?.summary||{};const kpis=[["Tổng khóa học đã hoàn thành",s.completedCourses],["Tổng giờ học",s.totalHours],["Đào tạo nội bộ",s.internalTraining],["Đào tạo bên ngoài",s.externalTraining],["Chứng chỉ còn hiệu lực",s.validCertificates],["Hồ sơ đang chờ HR duyệt",s.pendingApprovals]];return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Học tập","Lịch sử học tập","employee")}<div class="content learning-history"><section class="learning-hero"><div><h1>Lịch sử học tập</h1><p>Hồ sơ học tập cá nhân từ khóa nội bộ, đào tạo bên ngoài và chứng chỉ đã xác minh.</p></div><div class="learning-actions"><button class="btn btn-outline" data-learning-form="course">Thêm khóa học bên ngoài</button><button class="btn btn-primary" data-learning-form="cert">Thêm chứng chỉ</button></div></section>${_learningHistoryError?`<section class="card panel"><p class="form-error">${escapeHtml(_learningHistoryError)}</p><button class="btn btn-outline" data-refresh-learning>Thử lại</button></section>`:""}<div class="kpi-grid">${kpis.map(([label,value])=>`<div class="card kpi"><span class="label">${label}</span>${data?`<strong>${escapeHtml(String(value??0))}</strong>`:`<span class="kpi-loading"></span>`}</div>`).join("")}</div><section class="card panel"><div class="panel-head"><div class="view-tabs" role="tablist">${[["all","Tất cả"],["training","Đào tạo"],["certificates","Chứng chỉ"]].map(([v,l])=>`<button role="tab" class="${_learningHistoryTab===v?"active":""}" data-learning-tab="${v}">${l}</button>`).join("")}</div><select data-learning-filter><option value="">Tất cả trạng thái</option>${[["internal","Nội bộ"],["external","Bên ngoài"],["approved","Đã được xác nhận"],["pending","Đang chờ duyệt"],["needs_revision","Cần bổ sung"]].map(([v,l])=>`<option value="${v}" ${_learningHistoryFilter===v?"selected":""}>${l}</option>`).join("")}</select></div><div class="learning-list">${_learningHistoryLoading?overviewSkeleton():filtered.map(learningRecordCard).join("")||`<div class="empty-state"><h3>Chưa có hồ sơ phù hợp.</h3></div>`}</div></section></div></main>${learningEntryModal()}</div>`;}
function learningEntryModal(){if(!_learningForm)return"";const isCert=_learningForm==="cert";return `<div class="modal-backdrop open"><form id="learningEntryForm" class="modal modal--large modal--structured"><header class="modal__header"><div><h2>${isCert?"Thêm chứng chỉ":"Thêm khóa học bên ngoài"}</h2></div><button type="button" class="icon-btn" data-close-learning-form>×</button></header><div class="modal__body"><div class="form-2col">${isCert?`
<div class="field"><label>Loại chứng chỉ *</label><select name="certificate_type" required><option>Chứng chỉ ngoại ngữ</option><option>TOEIC</option><option>IELTS</option><option>TOEFL</option><option>Chứng chỉ UBCKNN</option><option>Chứng chỉ hành nghề chứng khoán</option><option>Chứng chỉ công nghệ</option><option>Chứng nhận hoàn thành khóa học</option><option>Khác</option></select></div><div class="field"><label>Tên chứng chỉ *</label><input name="certificate_name" required></div><div class="field"><label>Số chứng chỉ</label><input name="certificate_number"></div><div class="field"><label>Đơn vị cấp *</label><input name="issuer" required></div><div class="field"><label>Ngày cấp *</label><input type="date" name="issued_date" required></div><div class="field"><label>Ngày hết hạn</label><input type="date" name="expiry_date"></div><label class="field checkbox-field"><input type="checkbox" name="no_expiry"> Không thời hạn</label><div class="field"><label>Điểm số/xếp loại</label><input name="score"></div><div class="field" style="grid-column:1/-1"><label>Ghi chú gửi HR</label><textarea name="note_to_hr" rows="3"></textarea></div>`:`
<div class="field"><label>Tên khóa học *</label><input name="title" required></div><div class="field"><label>Nhóm đào tạo</label><select name="category"><option>Ngoại ngữ</option><option>Chuyên môn chứng khoán</option><option>Tài chính - đầu tư</option><option>Công nghệ</option><option>Kỹ năng mềm</option><option>Quản lý - lãnh đạo</option><option>Tuân thủ - pháp lý</option><option>Khác</option></select></div><div class="field"><label>Đơn vị đào tạo</label><input name="provider"></div><div class="field"><label>Hình thức học</label><select name="delivery_method"><option>Trực tiếp</option><option>Trực tuyến</option><option>Kết hợp</option><option>Tự học</option></select></div><div class="field"><label>Ngày bắt đầu</label><input type="date" name="start_date"></div><div class="field"><label>Ngày hoàn thành</label><input type="date" name="completion_date"></div><div class="field"><label>Số giờ học</label><input type="number" min="0" step="0.5" name="duration_hours"></div><div class="field"><label>Kết quả hoặc xếp loại</label><input name="result"></div><div class="field" style="grid-column:1/-1"><label>Nội dung chính</label><textarea name="description" rows="3"></textarea></div><div class="field" style="grid-column:1/-1"><label>Kỹ năng đạt được</label><textarea name="skills" rows="2"></textarea></div><label class="field checkbox-field"><input type="checkbox" name="has_certificate"> Có cấp chứng chỉ</label><div class="field" style="grid-column:1/-1"><label>Ghi chú gửi HR</label><textarea name="note_to_hr" rows="3"></textarea></div>`}</div><p class="muted-cell">File minh chứng dùng bucket riêng tư và lấy signed URL qua Worker. Upload trực tiếp sẽ được bổ sung vào hồ sơ sau khi chọn file.</p><input type="file" name="evidence" accept=".pdf,.jpg,.jpeg,.png"></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-close-learning-form>Hủy</button><button type="submit" class="btn btn-primary" ${_learningSubmitting?"disabled":""}>${_learningSubmitting?"Đang gửi...":"Gửi HR phê duyệt"}</button></footer></form></div>`;}
function adminLearningPage(){if(!hasAdminAccess())return restrictedPage();if(!_adminLearning.summary&&!_adminLearning.loading)queueMicrotask(()=>loadAdminLearning());const s=_adminLearning.summary||{};const pending=[..._adminLearning.records.filter(x=>["submitted","in_review","needs_revision"].includes(x.status)),..._adminLearning.certifications.filter(x=>["submitted","in_review","needs_revision"].includes(x.verificationStatus))];const rows=_adminLearning.tab==="certificates"?_adminLearning.certifications:_adminLearning.tab==="pending"?pending:_adminLearning.records;const kpis=[["Tổng hồ sơ học tập",s.totalRecords],["Hồ sơ chờ duyệt",s.pendingRecords],["Khóa học bên ngoài đã duyệt",s.approvedExternalCourses],["Tổng chứng chỉ",s.totalCertificates],["Chứng chỉ sắp hết hạn",s.expiringCertificates],["Chứng chỉ chưa xác minh",s.unverifiedCertificates]];return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D","Hồ sơ học tập","hr")}<div class="content admin-learning"><section class="learning-hero"><div><h1>Hồ sơ học tập</h1><p>Quản lý lịch sử đào tạo, chứng chỉ, import chưa đối chiếu và các yêu cầu phê duyệt.</p></div><div class="learning-actions"><button class="btn btn-outline" data-admin-learning-form="record">Thêm lịch sử đào tạo</button><button class="btn btn-primary" data-admin-learning-form="cert">Thêm chứng chỉ</button></div></section><div class="kpi-grid">${kpis.map(([l,v])=>`<div class="card kpi"><span class="label">${l}</span>${_adminLearning.summary?`<strong>${escapeHtml(String(v??0))}</strong>`:`<span class="kpi-loading"></span>`}</div>`).join("")}</div><section class="card panel"><div class="panel-head"><div class="view-tabs">${[["overview","Tổng quan"],["pending","Chờ phê duyệt"],["training","Lịch sử đào tạo"],["certificates","Chứng chỉ"],["unmatched","Chưa đối chiếu"]].map(([v,l])=>`<button class="${_adminLearning.tab===v?"active":""}" data-admin-learning-tab="${v}">${l}</button>`).join("")}</div><input data-admin-learning-search value="${escapeHtmlAttribute(_adminLearning.q)}" placeholder="Tên nhân viên, mã NV, khóa học"></div>${_adminLearning.error?`<p class="form-error">${escapeHtml(_adminLearning.error)}</p>`:""}<div class="table-wrap"><table><thead><tr><th>Nhân viên</th><th>Phòng ban</th><th>Loại hồ sơ</th><th>Tên khóa học/chứng chỉ</th><th>Nguồn</th><th>Ngày hoàn thành</th><th>Trạng thái</th><th>Ngày gửi</th><th>Thao tác</th></tr></thead><tbody>${_adminLearning.loading?`<tr><td colspan="9">${overviewSkeleton()}</td></tr>`:rows.map(adminLearningRow).join("")||`<tr><td colspan="9">Không có hồ sơ phù hợp.</td></tr>`}</tbody></table></div></section></div></main>${adminLearningDrawer()}</div>`;}
function adminLearningRow(x){const cert=x.kind==="certificate";const employee=x.employee||{};const status=cert?x.verificationStatus:x.status;return `<tr><td><strong>${escapeHtml(employee.fullName||"—")}</strong><small>${escapeHtml(employee.employeeCode||"")}</small></td><td>${escapeHtml(employee.department||"—")}</td><td>${cert?"Chứng chỉ":escapeHtml(x.recordType||"Đào tạo")}</td><td>${escapeHtml(cert?x.certificateName:x.title)}</td><td>${escapeHtml(cert?x.issuer:(x.sourceType==="system"?"KIS":x.provider||x.sourceType||"—"))}</td><td>${escapeHtml(cert?x.issuedDate:x.completionDate||"—")}</td><td>${cert?certStatusBadge(status):learningStatusBadge(status)}</td><td>${formatDateTime(x.submittedAt||x.createdAt)}</td><td><button class="btn btn-outline mini-action" data-admin-learning-detail="${cert?"cert:":"record:"}${x.id}">Xử lý</button></td></tr>`;}
function adminLearningDrawer(){if(!_adminLearningDetail)return"";const [kind,id]=_adminLearningDetail.split(":");const x=kind==="cert"?_adminLearning.certifications.find(c=>c.id===id):_adminLearning.records.find(r=>r.id===id);if(!x)return"";const cert=kind==="cert";return `<div class="modal-backdrop open"><section class="modal modal--large modal--structured"><header class="modal__header"><div><h2>${escapeHtml(cert?x.certificateName:x.title)}</h2></div><button class="icon-btn" data-close-admin-learning>×</button></header><div class="modal__body"><div class="profile-grid"><div class="profile-item"><span>Nhân viên</span><strong>${escapeHtml(x.employee?.fullName||"—")}</strong></div><div class="profile-item"><span>Phòng ban</span><strong>${escapeHtml(x.employee?.department||"—")}</strong></div><div class="profile-item"><span>Nguồn</span><strong>${escapeHtml(cert?x.issuer:x.provider||x.sourceType||"—")}</strong></div><div class="profile-item"><span>Trạng thái</span><strong>${cert?certStatusBadge(x.verificationStatus):learningStatusBadge(x.status)}</strong></div><div class="profile-item"><span>Ngày gửi</span><strong>${formatDateTime(x.submittedAt||x.createdAt)}</strong></div><div class="profile-item"><span>Kết quả</span><strong>${escapeHtml(cert?x.score:x.result||"—")}</strong></div></div>${x.revisionNote?`<p class="form-error">Yêu cầu bổ sung trước đó: ${escapeHtml(x.revisionNote)}</p>`:""}<div class="field"><label>Ghi chú/lý do khi xử lý</label><textarea data-admin-learning-note rows="3">${escapeHtml(_adminLearningActionNote)}</textarea></div></div><footer class="modal__footer"><button class="btn btn-outline" data-admin-learning-action="request-revision">Yêu cầu bổ sung</button><button class="btn btn-outline" data-admin-learning-action="reject">Từ chối</button><button class="btn btn-primary" data-admin-learning-action="approve">Phê duyệt</button></footer></section></div>`;}
function learningCalendarPage(){if(!hasEmployeeAccess())return restrictedPage();const rows=employeeEnrollments().filter(e=>e.deadline).sort((a,b)=>a.deadline.localeCompare(b.deadline));return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Học tập","Lịch học","employee")}<div class="content"><section class="card panel"><h1>Lịch học & deadline</h1>${rows.map(e=>`<article class="calendar-row"><time>${escapeHtml(e.deadline)}</time><div><h2>${escapeHtml(e.course?.title||"")}</h2><p>${uiText(e.status)} · ${e.progressPercent}%</p></div><a href="/dashboard/courses/${e.courseId}" data-link class="btn btn-outline">Mở khóa học</a></article>`).join("")||`<div class="empty-state">Chưa có deadline.</div>`}</section></div></main></div>`;}
function learningCalendarPageV2(){if(!hasEmployeeAccess())return restrictedPage();const today=new Date();today.setHours(0,0,0,0);const rows=employeeEnrollments().filter(e=>e.deadline).map(e=>{const date=new Date(`${e.deadline}T00:00:00`),days=Math.ceil((date-today)/86400000);return {...e,date,days};}).sort((a,b)=>a.date-b.date);const monthStart=new Date(today.getFullYear(),today.getMonth(),1),daysInMonth=new Date(today.getFullYear(),today.getMonth()+1,0).getDate(),offset=(monthStart.getDay()+6)%7;const monthCells=[...Array(offset).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)];return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar("Học tập","Lịch học & deadline","employee")}<div class="content route-content"><section class="calendar-head"><div><h1>Lịch học & deadline</h1><p>Theo dõi thời hạn từ các khóa học được giao cho bạn.</p></div><div class="view-tabs" role="tablist">${[["upcoming","Sắp tới"],["month","Theo tháng"],["deadline","Deadline"]].map(([v,l])=>`<button role="tab" aria-selected="${calendarView===v}" class="${calendarView===v?"active":""}" data-calendar-view="${v}">${l}</button>`).join("")}</div></section>${calendarView==="month"?`<section class="card month-calendar"><header><h2>${today.toLocaleDateString(language==="vi"?"vi-VN":language==="kr"?"ko-KR":"en-US",{month:"long",year:"numeric"})}</h2></header><div class="month-weekdays">${["T2","T3","T4","T5","T6","T7","CN"].map(x=>`<span>${x}</span>`).join("")}</div><div class="month-grid">${monthCells.map(day=>day?`<button class="month-day ${day===today.getDate()?"today":""}" aria-label="Ngày ${day}"><span>${day}</span>${rows.some(e=>e.date.getMonth()===today.getMonth()&&e.date.getDate()===day)?`<i aria-label="Có deadline"></i>`:""}</button>`:`<span></span>`).join("")}</div></section>`:`<div class="deadline-list">${rows.filter(e=>calendarView==="deadline"||e.days>=0).map(e=>`<article class="card deadline-card ${e.days<0?"overdue":e.days===0?"today":"upcoming"}"><div class="deadline-date"><strong>${e.date.getDate()}</strong><span>${e.date.toLocaleDateString("vi-VN",{month:"short"})}</span></div><div class="deadline-card__body"><div><span class="status-text">${e.status==="completed"?"Hoàn thành":e.days<0?`Quá hạn ${Math.abs(e.days)} ngày`:e.days===0?"Hôm nay":e.days===1?"Ngày mai":`Còn ${e.days} ngày`}</span><h2>${escapeHtml(e.course?.title||"")}</h2><p>${uiText("progressLabel")}: ${e.progressPercent}%</p>${progress(e.progressPercent)}</div><a href="/dashboard/courses/${e.courseId}" data-link class="btn btn-primary">${e.progressPercent?"Tiếp tục học":"Mở khóa học"}</a></div></article>`).join("")||`<div class="empty-state">Không có deadline phù hợp.</div>`}</div>`}</div></main></div>`;}
async function exportReportFile(format = "csv") {
  if (!hasAdminAccess() || reportExporting) return;
  reportExporting = format; render();
  try {
    const params = reportQueryParams({ report_type: reportActiveType, format });
    const res = await fetch(`/api/admin/reports/export?${params}`, { headers: apiHeaders() });
    if (!res.ok) {
      const body = await res.json().catch(()=>({}));
      throw new Error(body.error || t("reports.exportFailed"));
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const name = disposition.match(/filename="([^"]+)"/)?.[1] || `bao-cao-${reportActiveType}.${format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast(e.message || t("reports.exportFailed"));
  } finally {
    reportExporting = ""; render();
  }
}

function sessionStatusLabel(event){return event.status==="cancelled"?"Đã hủy":event.attendanceStatus==="attended"?"Đã tham dự":event.attendanceStatus==="partial"?"Tham dự một phần":event.responseStatus==="attending"?"Đã xác nhận tham gia":event.responseStatus==="busy"?"Bạn đã báo bận":"Chờ phản hồi";}
function offlineSessionCards() {
  const allEvents = _calendarEvents || [];
  const events = allEvents.filter(event => event.eventType === "offline_session");
  if (!events.length) return `<div class="empty-state"><p>Bạn chưa có lịch đào tạo sắp tới. Các buổi học được giao sẽ xuất hiện tại đây.</p></div>`;
  return events.map(event => {
    const source = offlineTrainingService.getSession(event.sessionId);
    const registration = offlineTrainingService.getRegistration(event.sessionId, session.accountId);
    const start = new Date(event.startAt);
    const closed = source?.registrationDeadline && new Date() > new Date(source.registrationDeadline);
    const slots = qrAttendanceService.listSlots(event.sessionId);
    return `<article class="card offline-session-card">
      <div class="session-date"><strong>${start.getDate()}</strong><span>${start.toLocaleDateString("vi-VN", { month: "short" })}</span></div>
      <div class="session-info">
        <span class="badge ${event.status}">${sessionStatusLabel(event)}</span>
        <h2>${escapeHtml(event.title || "")}</h2>
        <h3>${escapeHtml(event.subtitle || "")}</h3>
        <p>${start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}–${new Date(event.endAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · ${escapeHtml(event.location || "")}</p>
        <p>Giảng viên: ${escapeHtml(event.trainerName || "—")}</p>
        ${slots.length ? `<div class="session-slot-list">${slots.map(slot => {
          const openToken = qrAttendanceService.listTokens(slot.id).find(row => row.action === "check_in" && row.status === "open");
          return `<button class="slot-chip" data-auth-target="${openToken ? `/attendance/scan?token=${encodeURIComponent(openToken.opaqueToken)}` : "/dashboard/calendar"}" data-auth-role="employee" ${openToken ? "" : "disabled"}>${escapeHtml(slot.label)} · ${uiText("checkIn")}</button>`;
        }).join("")}</div>` : ""}
      </div>
      <div class="session-actions">
        ${source?.status === "scheduled" && !closed
          ? `<button class="btn btn-primary" data-session-response="${event.sessionId}" data-response="attending">Xác nhận tham gia</button><button class="btn btn-outline" data-session-busy="${event.sessionId}">Tôi bận</button>`
          : `<small>${source?.status === "cancelled" ? "Lịch học đã hủy" : closed ? "Đã hết hạn phản hồi" : ""}</small>`}
        <button class="btn btn-outline" data-open-scan-entry>${uiText("qrAttendance")}</button>
      </div>
    </article>`;
  }).join("");
}
function renderCalendarMonth(events){const base=new Date();base.setMonth(base.getMonth()+calendarMonthOffset,1);base.setHours(0,0,0,0);const today=new Date();const daysInMonth=new Date(base.getFullYear(),base.getMonth()+1,0).getDate(),offset=(base.getDay()+6)%7;const eventByDay=new Map();events.forEach(event=>{const date=new Date(event.startAt);if(date.getMonth()!==base.getMonth()||date.getFullYear()!==base.getFullYear())return;const day=date.getDate();eventByDay.set(day,[...(eventByDay.get(day)||[]),event]);});const effectiveSelectedDay=calendarSelectedDay&&eventByDay.has(calendarSelectedDay)?calendarSelectedDay:0;const selectedEvents=effectiveSelectedDay?(eventByDay.get(effectiveSelectedDay)||[]):[];const cells=[...Array(offset).fill(null),...Array.from({length:daysInMonth},(_,index)=>index+1)];return `<section class="card month-calendar"><header class="calendar-month-head"><button class="btn btn-outline mini-action" data-calendar-month="-1">‹</button><h2>${base.toLocaleDateString("vi-VN",{month:"long",year:"numeric"})}</h2><div class="calendar-month-head__actions"><button class="btn btn-outline mini-action" data-calendar-today>Hôm nay</button><button class="btn btn-outline mini-action" data-calendar-month="1">›</button></div></header><div class="month-weekdays">${["T2","T3","T4","T5","T6","T7","CN"].map(label=>`<span>${label}</span>`).join("")}</div><div class="month-grid">${cells.map(day=>day?`<button class="month-day ${day===today.getDate()&&calendarMonthOffset===0?"today":""} ${effectiveSelectedDay===day?"active":""}" data-calendar-day="${day}"><span>${day}</span>${eventByDay.get(day)?.length?`<small>${eventByDay.get(day).length} sự kiện</small><i aria-hidden="true"></i>`:""}</button>`:`<span></span>`).join("")}</div>${effectiveSelectedDay?`<section class="calendar-day-detail"><div class="panel-head"><div><h3>Ngày ${effectiveSelectedDay}/${base.getMonth()+1}</h3><p>${selectedEvents.length} sự kiện đã lên lịch</p></div><button class="btn btn-outline mini-action" data-calendar-clear-day>Đóng</button></div><div class="calendar-day-detail__list">${selectedEvents.map(event=>`<article class="calendar-event-row"><div><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.subtitle||"")}</p><small>${formatLocalDateTime(event.startAt)}${event.location?` · ${escapeHtml(event.location)}`:""}</small></div><a class="btn btn-outline mini-action" href="${event.actionUrl}" data-link>Chi tiết</a></article>`).join("")}</div></section>`:""}</section>`;}
function learningCalendarPageV3() {
  if (!hasEmployeeAccess()) return restrictedPage();
  const events = _calendarEvents || [];
  const sessionEvents = events.filter(event => event.eventType === "offline_session");
  const deadlineEvents = events.filter(event => event.eventType !== "offline_session");

  const sourceNote = _calendarSource === "api"
    ? ""
    : _calendarSource === "local" && !_calendarLoading
    ? `<p class="calendar-sync-note">Dữ liệu từ bộ nhớ cục bộ — có thể chưa đồng bộ.</p>`
    : "";

  const contentArea = _calendarLoading
    ? `<div class="calendar-loading"><div class="spinner" aria-label="Đang tải lịch học..."></div><p>Đang tải lịch học...</p></div>`
    : _calendarError
    ? `<div class="empty-state calendar-error">
        <p>Không thể tải lịch học: ${escapeHtml(_calendarError)}</p>
        <button class="btn btn-outline" data-calendar-refresh>Thử lại</button>
      </div>`
    : calendarView === "month"
    ? renderCalendarMonth(events)
    : calendarView === "upcoming"
    ? `<div class="offline-session-list">${offlineSessionCards()}</div>`
    : `<div class="deadline-list">${deadlineEvents.map(event => `
        <article class="card deadline-card ${event.status === "cancelled" ? "overdue" : ""}">
          <div class="deadline-date">
            <strong>${new Date(event.startAt).getDate()}</strong>
            <span>${new Date(event.startAt).toLocaleDateString("vi-VN", { month: "short" })}</span>
          </div>
          <div class="deadline-card__body">
            <div><h2>${escapeHtml(event.title || "")}</h2><p>${escapeHtml(event.subtitle || "")}</p></div>
            <a class="btn btn-primary" href="${escapeHtmlAttribute(event.actionUrl)}" data-link>${event.eventType === "course_deadline" ? "Mở khóa học" : "Xem chi tiết"}</a>
          </div>
        </article>`).join("") || `<div class="empty-state">Bạn chưa có deadline sắp tới.</div>`}
      </div>`;

  return `<div class="app-layout">${sideNav("employee")}<main class="app-main">
    ${topbar("Học tập", "Lịch học & deadline", "employee")}
    <div class="content route-content">
      <section class="calendar-head">
        <div>
          
          <h1>Lịch học & deadline</h1>
          <p>Phản hồi lớp trực tiếp và theo dõi thời hạn học tập tại một nơi.</p>
          ${sourceNote}
        </div>
        <div class="view-tabs">
          <button class="${calendarView === "upcoming" ? "active" : ""}" data-calendar-view="upcoming">Sắp tới</button>
          <button class="${calendarView === "month" ? "active" : ""}" data-calendar-view="month">Theo tháng</button>
          <button class="${calendarView === "deadline" ? "active" : ""}" data-calendar-view="deadline">Deadline</button>
          <button class="btn-ghost calendar-refresh-btn" data-calendar-refresh title="Làm mới">↻</button>
        </div>
      </section>
      ${contentArea}
    </div>
  </main>${busyResponseModal()}</div>`;
}
function busyResponseModal(){if(!busySessionId)return "";return `<div class="modal-backdrop open"><form id="busyResponseForm" class="modal modal--medium modal--structured"><header class="modal__header"><h2>Lý do không thể tham gia</h2><button type="button" class="icon-btn" data-close-busy>×</button></header><div class="modal__body"><div class="field"><label>Lý do</label><select name="reason"><option>Trùng lịch công việc</option><option>Nghỉ phép/công tác</option><option>Đã tham gia lớp tương đương</option><option value="other">Lý do khác</option></select></div><div class="field"><label>Ghi chú</label><textarea name="note" maxlength="300" rows="3"></textarea></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-close-busy>Hủy</button><button class="btn btn-primary">Gửi phản hồi</button></footer></form></div>`;}

function adminSessionsPage(){if(!hasAdminAccess())return restrictedPage();if(session&&(!_sessions||_sessionsAccountId!==session.accountId)&&!_sessionsLoading)fetchSessionsFromApi(session.accountId,"hr");const sessions=_sessions||[];const _courseMap=new Map((_courses||[]).map(c=>[c.id,c]));const resolveCourseTitle=(courseId)=>{const c=_courseMap.get(courseId)||getCourseById(courseId);return c?.title||""};let listHtml;if(_sessionsLoading&&!sessions.length){listHtml='<div class="empty-state"><div class="spinner"></div><p>Đang tải lớp học...</p></div>';}else if(_sessionsError){listHtml='<div class="empty-state"><p>Không thể tải danh sách lớp học</p><p class="error-detail">'+escapeHtml(_sessionsError)+'</p><button class="btn btn-primary" data-retry-sessions>Thử lại</button></div>';}else if(!sessions.length){listHtml='<div class="empty-state"><p>Chưa có lớp trực tiếp nào.</p><button class="btn btn-primary" data-create-session>+ Thêm buổi học</button></div>';}else{listHtml=sessions.map(s=>{const _regs=offlineTrainingService.ensureInvitations(s.id),regs=Array.isArray(_regs)?_regs:[],attending=regs.filter(row=>row.responseStatus==="attending").length,attended=regs.filter(row=>["attended","partial"].includes(row.attendanceStatus)).length,summary=offlineTrainingService.participantSummary(s,regs),_slots=qrAttendanceService.getOrCreateDefaultSlots(s.id,session.accountId),slots=Array.isArray(_slots)?_slots:[];return `<article class="card session-admin-card"><div class="session-admin-card__body"><span class="badge ${s.status}">${s.status}</span><h2>${escapeHtml(resolveCourseTitle(s.courseId))}</h2><h3>${escapeHtml(s.title)}</h3><p>${formatLocalDateTime(s.startAt)}–${new Date(s.endAt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})} · ${escapeHtml(s.locationName||s.meetingUrl||"")}</p><div class="session-admin-summary"><span>${summary.selected} / ${summary.capacity} người</span><span>${attending} xác nhận</span><span>${attended} đã điểm danh</span></div><div class="session-slot-list">${slots.map(slot=>`<span class="slot-chip">${escapeHtml(slot.label)}</span>`).join("")}</div></div><div class="session-admin-card__actions"><button class="btn btn-primary" data-manage-session="${s.id}">Quản lý người tham gia</button><button class="btn btn-outline" data-edit-session="${s.id}">Chỉnh sửa</button><button class="btn btn-outline btn--danger" data-delete-session="${s.id}">Xóa lớp</button></div></article>`;}).join("");}return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D","Lớp trực tiếp & điểm danh","hr")}<div class="content route-content"><section class="library-head"><div><h1>Quản lý buổi học</h1><p>Chọn người tham dự, mở QR theo từng slot và chốt attendance bằng dữ liệu thật.</p></div><button class="btn btn-primary" data-create-session>+ Thêm buổi học</button></section><div class="session-admin-list">${listHtml}</div></div></main>${sessionEditorModal()}${attendanceModal()}${qrProjectorModal()}${importWizardModal()}</div>`;}
function sessionEditorModal(){if(!sessionFormOpen)return "";const s=(_sessions||[]).find(x=>x.id===selectedOfflineSessionId)||{};const summary=s.id?offlineTrainingService.participantSummary(s.id):{selected:0,capacity:Number(s.capacity)||30,remaining:Number(s.capacity)||30,overBy:0};return `<div class="modal-backdrop open"><form id="offlineSessionForm" class="modal modal--large modal--structured"><header class="modal__header"><div><h2>${s.id?"Chỉnh sửa buổi học":"Thêm buổi học"}</h2></div><button type="button" class="icon-btn" data-close-session-form>×</button></header><div class="modal__body"><input name="id" type="hidden" value="${s.id||""}"><div class="form-2col"><div class="field"><label>Khóa học *</label><select name="courseId" required>${_coursesLoading?`<option value="" disabled selected>Đang tải khóa học...</option>`:(_courses&&_courses.length?_courses:getCourses()).filter(c=>c.status!=="archived").map(c=>`<option value="${c.id}" ${s.courseId===c.id?"selected":""}>${escapeHtml(c.title)}${c.status==="draft"?" (Bản nháp)":""}</option>`).join("")||`<option value="" disabled selected>Chưa có khóa học</option>`}</select></div><div class="field"><label>Tên buổi học *</label><input name="title" required value="${escapeHtmlAttribute(s.title||"")}"></div><div class="field" style="grid-column:1/-1"><label>Ngày học *</label><input name="sessionDate" type="date" required value="${s.startAt?s.startAt.slice(0,10):""}"></div><div class="field" style="grid-column:1/-1"><label>Thời gian</label><div class="session-time-row"><div class="field"><input name="startTime" type="time" required value="${s.startAt?s.startAt.slice(11,16):"08:30"}"><small>Bắt đầu</small></div><span class="session-time-arrow">→</span><div class="field"><input name="endTime" type="time" required value="${s.endAt?s.endAt.slice(11,16):"11:30"}"><small>Kết thúc</small></div></div></div><div class="field"><label>Hạn xác nhận</label><input name="registrationDeadline" type="datetime-local" value="${s.registrationDeadline?s.registrationDeadline.slice(0,16):""}"></div><div class="field"><label>Giảng viên</label><input name="trainerName" value="${escapeHtmlAttribute(s.trainerName||"")}"></div><div class="field"><label>Hình thức</label><select name="locationType"><option value="onsite" ${s.locationType==="onsite"?"selected":""}>Trực tiếp</option><option value="online_live" ${s.locationType==="online_live"?"selected":""}>Online live</option><option value="hybrid" ${s.locationType==="hybrid"?"selected":""}>Kết hợp</option></select></div><div class="field"><label>Địa điểm *</label><input name="locationName" value="${escapeHtmlAttribute(s.locationName||"")}"></div><div class="field"><label>Sức chứa</label><input name="capacity" type="number" min="1" value="${s.capacity||30}"></div><div class="field"><label>Trạng thái</label><select name="status"><option value="scheduled" ${s.status==="scheduled"?"selected":""}>Scheduled</option><option value="completed" ${s.status==="completed"?"selected":""}>Completed</option><option value="cancelled" ${s.status==="cancelled"?"selected":""}>Cancelled</option></select></div></div><details class="geofence-section" style="grid-column:1/-1;margin-top:8px"><summary style="cursor:pointer;font-weight:600;padding:8px 0">Địa điểm điểm danh GPS (Geofence)</summary><div class="form-2col" style="margin-top:12px"><div class="field" style="grid-column:1/-1"><label>Tên địa điểm GPS</label><input name="geoLocationLabel" value="${escapeHtmlAttribute(s.locationName||"")}" placeholder="VD: Hội trường A, Tầng 3, Tòa nhà KIS"></div><div class="field"><label>Vĩ độ (Latitude)</label><input name="latitude" type="number" step="any" value="${s.latitude||""}" placeholder="VD: 10.776540" id="geoLat"></div><div class="field"><label>Kinh độ (Longitude)</label><input name="longitude" type="number" step="any" value="${s.longitude||""}" placeholder="VD: 106.700870" id="geoLng"></div><div class="field" style="grid-column:1/-1"><button type="button" class="btn btn-outline" id="btnGetGps">📍 Lấy vị trí hiện tại</button><span id="gpsStatus" style="margin-left:8px;font-size:13px;color:var(--color-muted)"></span></div><div class="field" style="grid-column:1/-1"><label>Bán kính điểm danh</label><select name="allowedRadiusMeters"><option value="" ${!s.allowedRadiusMeters?"selected":""}>Không giới hạn</option><option value="30" ${s.allowedRadiusMeters==30?"selected":""}>30 mét</option><option value="50" ${s.allowedRadiusMeters==50?"selected":""}>50 mét (Khuyến nghị)</option><option value="100" ${s.allowedRadiusMeters==100?"selected":""}>100 mét</option><option value="200" ${s.allowedRadiusMeters==200?"selected":""}>200 mét</option></select><small style="display:block;margin-top:4px;color:var(--color-muted)">Nhân viên chỉ có thể điểm danh khi đứng trong bán kính này.</small></div></div></details><div class="participant-summary-bar"><strong>${summary.selected} người</strong><span>Sức chứa ${summary.capacity}</span><span>${summary.overBy?`Vượt ${summary.overBy} người`:`Còn ${summary.remaining} chỗ`}</span></div><div class="field-error" data-session-error></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-close-session-form>Hủy</button><button class="btn btn-primary">Lưu buổi học</button></footer></form></div>`;}
function attendanceModal(){if(!selectedOfflineSessionId||sessionFormOpen)return "";const s=(_sessions||[]).find(x=>x.id===selectedOfflineSessionId);if(!s)return "";const _regs=offlineTrainingService.ensureInvitations(s.id);const regs=Array.isArray(_regs)?_regs:[];const _slots=qrAttendanceService.getOrCreateDefaultSlots(s.id,session.accountId);const slots=Array.isArray(_slots)?_slots:[];const summary=offlineTrainingService.participantSummary(s,regs);const _rPids=_remoteParticipantIds.get(s.id);if(_rPids)summary.selected=_rPids.size;const _participantsLoading=_participantsLoadingFor===s.id;selectedQrSlotId=selectedQrSlotId&&slots.some(slot=>slot.id===selectedQrSlotId)?selectedQrSlotId:(slots[0]?.id||"");const live=selectedQrSlotId?qrAttendanceService.getLiveSummary(selectedQrSlotId):null;const token=selectedQrSlotId?qrAttendanceService.listTokens(selectedQrSlotId).find(row=>row.action===selectedQrAction&&row.status==="open"):null;const participants=sessionParticipantAccounts(s.id);const filtered=availableEmployeeAccounts().filter(account=>(!sessionEmployeeSearch||`${account.fullName} ${account.email} ${account.employeeCode}`.toLowerCase().includes(sessionEmployeeSearch.toLowerCase()))&&(!sessionEmployeeDepartment||account.department===sessionEmployeeDepartment));const pageSize=8,totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));sessionEmployeePage=Math.min(sessionEmployeePage,totalPages);const pageRows=filtered.slice((sessionEmployeePage-1)*pageSize,sessionEmployeePage*pageSize);return `<div class="modal-backdrop open"><section class="modal modal--xlarge modal--structured attendance-modal"><header class="modal__header"><div><h2>Người tham gia & điểm danh</h2><p>${escapeHtml(s.title)} · ${formatLocalDateTime(s.startAt)}</p></div><button class="icon-btn" data-close-attendance>×</button></header><div class="modal__body"><section class="session-overview-strip"><div><strong>${summary.selected}</strong><span>Đã chọn</span></div><div><strong>${summary.capacity}</strong><span>Sức chứa</span></div><div><strong>${summary.overBy?`+${summary.overBy}`:summary.remaining}</strong><span>${summary.overBy?"Vượt chỗ":"Còn chỗ"}</span></div><div><strong>${regs.filter(row=>row.responseStatus==="attending").length}</strong><span>Xác nhận</span></div></section><section class="attendance-layout"><div class="attendance-layout__left"><div class="attendance-section card"><div class="panel-head"><div><h3>Chọn người tham dự</h3><p>${sessionParticipantSummaryLabel(s.id)}</p></div><div class="security-actions"><button class="btn btn-outline mini-action" data-session-add-assigned="${s.id}">+ Người đã enroll khóa học</button><button class="btn btn-outline mini-action" data-open-import-wizard="participants" data-import-target="${s.id}">Import Excel</button><button class="btn btn-outline mini-action" data-sync-participants>Đồng bộ Supabase</button></div></div><div class="session-picker-toolbar"><input type="search" data-session-employee-search value="${escapeHtmlAttribute(sessionEmployeeSearch)}" placeholder="Tìm tên, mã nhân viên hoặc email"><select data-session-employee-department><option value="">Tất cả phòng ban</option>${[...new Set(availableEmployeeAccounts().map(account=>account.department).filter(Boolean))].map(department=>`<option value="${escapeHtmlAttribute(department)}" ${sessionEmployeeDepartment===department?"selected":""}>${escapeHtml(department)}</option>`).join("")}</select><button class="btn btn-outline mini-action" data-session-select-visible>Chọn trang hiện tại</button></div><div class="department-picker">${[...new Set(availableEmployeeAccounts().map(account=>account.department).filter(Boolean))].map(department=>{const total=availableEmployeeAccounts().filter(account=>account.department===department).length;const chosen=participants.filter(account=>account.department===department).length;const active=selectedSessionDepartments.includes(department);return `<button class="department-chip ${active?"active":""}" data-session-department-chip="${escapeHtmlAttribute(department)}">${escapeHtml(department)} · ${chosen}/${total}</button>`;}).join("")}</div><div class="table-wrap"><table><thead><tr><th></th><th>Nhân viên</th><th>Phòng ban</th><th>Mã / Email</th></tr></thead><tbody>${pageRows.map(account=>{const isParticipant=participants.some(row=>row.id===account.id);const justSynced=_recentlySyncedParticipants.has(account.id);return `<tr class="${participantSyncState.saving?"row--saving":""}${justSynced?" row--synced":""}"><td><input type="checkbox" data-session-participant="${account.id}" ${isParticipant?"checked":""} ${participantSyncState.saving?"disabled":""}>${participantSyncState.saving?`<span class="sync-indicator saving"></span>`:justSynced&&isParticipant?`<span class="sync-indicator synced">✓</span>`:""}</td><td><strong>${escapeHtml(account.fullName)}</strong><small>${escapeHtml(account.position||"")}</small></td><td>${escapeHtml(account.department||"")}</td><td>${escapeHtml(account.employeeCode||account.email||"")}</td></tr>`;}).join("")}</tbody></table></div>${pagination("session-employees",sessionEmployeePage,totalPages)}<div class="selected-summary-card ${participants.length>0?"selected-summary-card--active":""}"><div class="selected-count-row"><strong class="selected-count">${participants.length}</strong><span>nhân viên đã chọn</span>${_participantsLoading?`<span class="sync-badge saving">Đang tải từ Supabase...</span>`:participantSyncState.saving?`<span class="sync-badge saving">Đang lưu...</span>`:participants.length>0?`<span class="sync-badge synced">Đã đồng bộ Supabase ✓</span>`:""}</div><div class="security-actions"><button class="btn btn-outline mini-action" data-open-selected-participants>Xem danh sách</button><button class="btn btn-outline mini-action" data-session-clear-selection="${s.id}">Xóa tất cả</button></div></div></div><div class="attendance-section card"><div class="panel-head"><div><h3>Điểm danh QR</h3><p>Thiết lập nhanh, trình chiếu và chốt attendance sau khi xử lý exception.</p></div><div class="security-actions"><button class="btn btn-outline mini-action" data-quick-setup-slots="${s.id}">Thiết lập nhanh</button><button class="btn btn-outline mini-action" data-open-import-wizard="attendance" data-import-target="${s.id}">Import attendance</button><button class="btn btn-outline mini-action" data-finalize-session="${s.id}">Chốt điểm danh</button></div></div><section class="qr-attendance-head"><div class="media-filter" role="tablist">${slots.map(slot=>`<button class="${selectedQrSlotId===slot.id?"active":""}" data-qr-slot="${slot.id}">${escapeHtml(slot.label)}</button>`).join("")}</div><div class="media-filter" role="tablist"><button class="${selectedQrAction==="check_in"?"active":""}" data-qr-action="check_in">${uiText("checkIn")}</button><button class="${selectedQrAction==="check_out"?"active":""}" data-qr-action="check_out">${uiText("checkOut")}</button></div><div class="qr-toolbar"><button class="btn btn-primary" data-generate-qr ${selectedQrSlotId?"":"disabled"}>${uiText("qrAttendance")}</button><button class="btn btn-outline" data-open-projector ${token?"":"disabled"}>${uiText("projector")}</button><button class="btn btn-outline" data-close-qr-token ${token?"":"disabled"}>${uiText("closeAttendance")}</button></div></section>${live?`<section class="kpi-grid qr-live-kpis"><div class="card kpi"><span>Được mời</span><strong>${live.invited}</strong></div><div class="card kpi"><span>${uiText("checkIn")}</span><strong>${live.checkedIn}</strong></div><div class="card kpi"><span>${uiText("checkOut")}</span><strong>${live.checkedOut}</strong></div><div class="card kpi"><span>Đến trễ</span><strong>${live.late}</strong></div><div class="card kpi"><span>Báo bận</span><strong>${live.busy}</strong></div><div class="card kpi"><span>Cần HR xem xét</span><strong>${live.exceptions}</strong></div></section>`:""}<div class="table-wrap"><table><thead><tr><th>Nhân viên</th><th>RSVP</th><th>${uiText("checkIn")} / ${uiText("checkOut")}</th><th>Attendance</th><th>Phút được tính</th><th>Thao tác</th></tr></thead><tbody>${regs.slice(0,50).map(r=>{const record=selectedQrSlotId?qrAttendanceService.getRecord(selectedQrSlotId,r.accountId):null;const account=getAccountById(r.accountId);return `<tr><td><strong>${escapeHtml(account?.fullName||"")}</strong><small>${escapeHtml(account?.department||"")}</small></td><td>${escapeHtml(r.responseStatus)}</td><td>${record?.checkInAt?`In ${escapeHtml(record.checkInAt.slice(11,16))}`:"—"}${record?.checkOutAt?` · Out ${escapeHtml(record.checkOutAt.slice(11,16))}`:""}</td><td><select data-attendance-status="${r.accountId}"><option value="attended" ${r.attendanceStatus==="attended"?"selected":""}>Đã tham dự</option><option value="partial" ${r.attendanceStatus==="partial"?"selected":""}>Tham dự một phần</option><option value="absent" ${r.attendanceStatus==="absent"?"selected":""}>Vắng mặt</option><option value="excused" ${r.attendanceStatus==="excused"?"selected":""}>Vắng có lý do</option></select></td><td><input data-attendance-minutes="${r.accountId}" type="number" min="0" value="${Math.round(Number(record?.countedSeconds||r.attendedSeconds||0)/60)}"></td><td><button class="btn btn-primary mini-action" data-save-attendance="${r.accountId}">Lưu</button></td></tr>`;}).join("")}</tbody></table></div></div></section></div></div></section></div>`;}

function importWizardModal(){if(!importWizardOpen)return "";const sheetOptions=importWorkbookState?.sheets||[];const preview=importWorkbookState&&importSheetName?excelImportService.getSheetPreview(importWorkbookState.workbook,importSheetName,importHeaderRowIndex,12):{headers:[],rows:[],totalRows:0};const fields=importFieldList(importWizardMode);return `<div class="modal-backdrop open"><section class="modal modal--xlarge modal--structured"><header class="modal__header"><div><h2>${importWizardMode==="employees"?"Import nhân viên":importWizardMode==="participants"?"Import danh sách tham dự":"Import attendance"}</h2></div><button class="icon-btn" data-close-import-wizard>×</button></header><div class="modal__body"><section class="import-wizard-step"><h3>Bước 1 — Chọn file</h3><label class="upload-dropzone"><input type="file" accept=".xlsx,.xls,.csv" data-import-file hidden><strong>${importWorkbookState?escapeHtml(importWorkbookState.fileName):"Tải file Excel"}</strong><span>${importWorkbookState?`${(importWorkbookState.fileSize/1024).toFixed(0)} KB · ${sheetOptions.length} sheet`:"Hỗ trợ .xlsx và .xls"}</span></label></section>${importWorkbookState?`<section class="import-wizard-step"><h3>Bước 2 — Chọn sheet</h3><div class="sheet-chip-list">${sheetOptions.map(sheet=>`<button class="sheet-chip ${importSheetName===sheet.name?"active":""}" data-import-sheet="${escapeHtmlAttribute(sheet.name)}">${escapeHtml(sheet.name)}</button>`).join("")}</div></section><section class="import-wizard-step"><h3>Bước 3 — Chọn hàng tiêu đề</h3><div class="header-row-picker">${[0,1,2,3,4].map(index=>`<button class="sheet-chip ${importHeaderRowIndex===index?"active":""}" data-import-header-row="${index}">Hàng ${index+1}</button>`).join("")}</div><div class="table-wrap"><table><thead><tr>${preview.headers.map(header=>`<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${preview.rows.slice(0,8).map(row=>`<tr>${preview.headers.map(header=>`<td>${escapeHtml(row.values[header]||"")}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section><section class="import-wizard-step"><h3>Bước 4 — Map cột</h3><div class="form-2col">${fields.map(([field,label])=>`<div class="field"><label>${label}</label><select data-import-map="${field}"><option value="">Không map</option>${preview.headers.map(header=>`<option value="${escapeHtmlAttribute(header)}" ${importColumnMapping[field]===header?"selected":""}>${escapeHtml(header)}</option>`).join("")}</select></div>`).join("")}</div><button class="btn btn-outline" data-import-autodetect>Gợi ý tự động</button></section><section class="import-wizard-step"><h3>Bước 5 — Preview & validation</h3>${importPreviewRows.length?`<div class="table-wrap"><table><thead><tr><th>Dòng</th><th>Mã nhân viên</th><th>Họ tên</th><th>Email</th><th>Phòng ban</th><th>Trạng thái</th></tr></thead><tbody>${importPreviewRows.map(row=>`<tr><td>${row.rowNumber}</td><td>${escapeHtml(row.employeeCode||"")}</td><td>${escapeHtml(row.fullName||"")}</td><td>${escapeHtml(row.email||"")}</td><td>${escapeHtml(row.department||"")}</td><td>${row.status==="valid"?"Hợp lệ":escapeHtml(row.message||"Lỗi")}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty-state"><p>Map ít nhất Mã nhân viên hoặc Email để xem preview.</p></div>`}</section>`:""}</div><footer class="modal__footer"><button class="btn btn-outline" data-close-import-wizard>Hủy</button>${importWorkbookState?`<button class="btn btn-outline" data-build-import-preview>Tạo preview</button><button class="btn btn-primary" data-confirm-import ${importPreviewRows.some(row=>row.status==="valid")?"":"disabled"}>Xác nhận import</button>`:""}</footer></section></div>`;}

function attendanceScanPage(tokenValue) {
  const activeSession = sessionService.getValidSession();
  if (!activeSession) return loginPage();

  // Token provided (from QR link or camera scan) — show confirmation UI
  if (tokenValue) {
    const preview = qrAttendanceService.validateToken(tokenValue);
    if (!preview.ok) {
      const errorMap = {
        expired: uiText("qrExpired"),
        not_open_yet: uiText("qrNotOpen"),
        closed: "QR đã đóng",
        session_cancelled: "Buổi học đã hủy",
        not_found: "QR không hợp lệ",
      };
      return `<div class="page">${header()}
        <section class="section"><div class="container">
          <div class="card attendance-result attendance-result--error">
            <div class="attendance-result__icon" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2>${errorMap[preview.error] || "Không thể điểm danh"}</h2>
            <p>${preview.error === "expired" ? "Vui lòng quét mã QR mới đang được HR hiển thị." : preview.error === "not_open_yet" ? "Phiên điểm danh chưa mở. Vui lòng quét đúng thời gian." : "Mã QR không hợp lệ hoặc đã hết hiệu lực."}</p>
            <div class="hero-actions">
              <button class="btn btn-primary" data-qr-retry>Quét lại</button>
              <a class="btn btn-outline" href="/dashboard/calendar" data-link>${uiText("calendar")}</a>
            </div>
          </div>
        </div></section>
      </div>`;
    }

    const course = preview._isV2 ? (preview.course || {}) : getCourseById(preview.session.courseId);
    const existing = preview._isV2 ? null : qrAttendanceService.getRecord(preview.slot.id, activeSession.accountId);
    const alreadyDone = existing && ((preview.token.action === "check_in" && existing.checkInAt) || (preview.token.action === "check_out" && existing.checkOutAt));
    const needsCheckInFirst = preview.token.action === "check_out" && !existing?.checkInAt;
    const actionLabel = preview.token.action === "check_in" ? uiText("checkIn") : uiText("checkOut");
    const _sesLat = preview.session.latitude ?? null;
    const _sesLng = preview.session.longitude ?? null;
    const _sesRadius = preview.session.allowedRadiusMeters ?? null;
    const _hasGeofence = _sesLat != null && _sesLng != null && _sesRadius != null;
    function _haversineM(lat1,lon1,lat2,lon2){const R=6371000,p1=lat1*Math.PI/180,p2=lat2*Math.PI/180,dp=(lat2-lat1)*Math.PI/180,dl=(lon2-lon1)*Math.PI/180,a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));}
    const _dist = (_hasGeofence && _qrScanLocationData) ? _haversineM(_sesLat,_sesLng,_qrScanLocationData.latitude,_qrScanLocationData.longitude) : null;
    const _inside = _dist != null ? _dist <= _sesRadius : null;
    const locationCapture = _qrScanLocationData
      ? _hasGeofence
        ? `<div class="qr-geofence-info ${_inside?"qr-geofence--ok":"qr-geofence--fail"}">
            <p><strong>Địa điểm đào tạo:</strong> ${escapeHtml(preview.session.locationName||"Đã cấu hình")}</p>
            <p><strong>Khoảng cách hiện tại:</strong> ${_dist}m</p>
            <p><strong>Bán kính cho phép:</strong> ${_sesRadius}m</p>
            <p>${_inside?"✓ Bạn đang trong phạm vi điểm danh":"✗ Bạn đang ở ngoài khu vực điểm danh"}</p>
           </div>`
        : `<p class="qr-location-info"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> Vị trí đã xác định · Độ chính xác ~${Math.round(_qrScanLocationData.accuracy)}m</p>`
      : `<p class="qr-location-info qr-location-info--pending" id="qrLocationStatus"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> <span id="qrLocText">Vị trí sẽ được yêu cầu khi bạn bấm điểm danh</span></p>`;

    return `<div class="page">${header()}
      <section class="section"><div class="container">
        <div class="card panel qr-scan-result">
          
          <h1>${escapeHtml(course?.title || preview.session.title)}</h1>
          <p class="qr-session-meta">${escapeHtml(preview.slot.label)} · ${actionLabel}</p>
          ${preview.session.locationName ? `<p class="qr-session-location"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> ${escapeHtml(preview.session.locationName)}</p>` : ""}
          ${alreadyDone
            ? `<div class="attendance-result attendance-result--already">
                <div class="attendance-result__icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
                <h3>${uiText("alreadyScanned")}</h3>
                <p>Hệ thống đã ghi nhận lượt điểm danh của bạn trước đó.${existing.checkInAt ? " Check-in: " + new Date(existing.checkInAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""}${existing.checkOutAt ? " · Check-out: " + new Date(existing.checkOutAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""}</p>
                <a class="btn btn-outline" href="/dashboard/calendar" data-link>${uiText("calendar")}</a>
              </div>`
            : needsCheckInFirst
            ? `<div class="attendance-result attendance-result--warn">
                <h3>Chưa có check-in</h3>
                <p>Vui lòng quét mã check-in trước khi check-out.</p>
                <button class="btn btn-primary" data-qr-retry>Quét lại</button>
              </div>`
            : `<div class="qr-confirm-actions">
                ${locationCapture}
                <div class="hero-actions">
                  <button class="btn btn-primary btn--hero" data-submit-scan="${escapeHtmlAttribute(tokenValue)}">${actionLabel}</button>
                  <a class="btn btn-outline" href="/dashboard/calendar" data-link>Huỷ</a>
                </div>
              </div>`}
        </div>
      </div></section>
    </div>`;
  }

  // No token — show camera scanner UI with consent gate
  if (!isMobileQrDevice()) {
    return `<div class="page">${header()}<section class="section"><div class="container"><div class="card panel qr-camera-wrap"><h2>${uiText("qrAttendance")}</h2><p>Điểm danh QR yêu cầu camera và GPS của điện thoại.</p></div></div></section>
      <div class="modal-backdrop open shared-dialog-backdrop"><section class="shared-dialog" role="dialog" aria-modal="true" aria-labelledby="phone-qr-title" aria-describedby="phone-qr-desc">
        <div class="shared-dialog__header"><div class="shared-dialog__icon shared-dialog__icon--info shared-dialog__icon--phone-qr" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="2" width="10" height="20" rx="2"/><path d="M9 18h2"/></svg><svg viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z"/></svg></div><div class="shared-dialog__content"><h2 id="phone-qr-title">Điểm danh bằng điện thoại</h2><p id="phone-qr-desc">Để đảm bảo xác thực vị trí và sử dụng camera, vui lòng mở MyKIS Learning trên điện thoại và thực hiện quét mã QR tại đó.</p></div></div>
        <div class="shared-dialog__actions"><a class="btn btn-outline" href="/dashboard/calendar" data-link>Đóng</a><button class="btn btn-primary" data-qr-confirm-mobile>Tôi đang dùng điện thoại</button></div>
      </section></div></div>`;
  }
  if (!_qrCameraConsentGiven) {
    return `<div class="page">${header()}
      <section class="section"><div class="container">
        <div class="card panel qr-consent-card">
          <div class="qr-consent-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </div>
          <h2>Cho phép sử dụng camera</h2>
          <p>MyKIS Learning cần truy cập camera để quét mã QR điểm danh do HR cung cấp.</p>
          <ul class="qr-consent-list">
            <li>Camera chỉ dùng để đọc mã QR điểm danh.</li>
            <li>Hệ thống không ghi hình, không lưu video.</li>
            <li>Camera sẽ tắt ngay sau khi quét thành công.</li>
          </ul>
          <div class="hero-actions">
            <button class="btn btn-primary btn--hero" data-qr-consent-accept>Tiếp tục quét QR</button>
            <a class="btn btn-outline" href="/dashboard/calendar" data-link>Huỷ</a>
          </div>
        </div>
      </div></section>
    </div>`;
  }

  const _dbg = isQrDebugEnabled();
  const _prev = isQrPreviewOnly();
  const _ua = navigator.userAgent;
  const _isSafari = /Safari/.test(_ua) && !/Chrome/.test(_ua);
  const _isIOS = /iPhone|iPad|iPod/.test(_ua);
  const _isHttps = location.protocol === "https:";
  const _hasGUM = "mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices;

  const _debugBadge = _dbg ? `<div style="position:fixed;top:8px;right:8px;z-index:9999;background:#ef4444;color:#fff;font:bold 11px/1 monospace;padding:4px 8px;border-radius:6px;pointer-events:none">DEBUG QR ON</div>` : "";

  const _debugPanel = _dbg ? `
    <div id="qrDebugPanel" style="display:block;margin-top:16px;background:#040d1a;border:2px solid #ef4444;border-radius:12px;overflow:visible;font-size:13px;text-align:left;position:relative;z-index:50;opacity:1;visibility:visible">
      <div style="padding:10px 14px;background:#0b1a2e;border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <span style="color:#38bdf8;font-weight:700;font-size:13px">QR Diagnostics${_prev ? " [preview-only]" : ""}</span>
        <span style="color:#64748b;font-size:11px;font-family:monospace">${_isIOS ? "iOS" : "non-iOS"} / ${_isSafari ? "Safari" : "non-Safari"} / ${_isHttps ? "HTTPS✓" : "HTTP✗"}</span>
      </div>
      <div class="qr-dbg-rows" style="padding:10px 14px;font:12px/2.2 monospace;color:#94a3b8;word-break:break-all;white-space:pre-wrap">
        <div data-dbk="build" style="color:#4ade80">build: 2026-06-22-01</div>
        <div data-dbk="route">route: ${location.pathname}</div>
        <div data-dbk="debugFlag">debugFlag: ${_dbg ? "yes (sessionStorage)" : "no"}</div>
        <div data-dbk="gum">gum: ${_hasGUM ? "available ✓" : "NOT AVAILABLE ✗"}</div>
        <div data-dbk="step" style="color:#7dd3fc;font-weight:bold">step: scanner-rendered</div>
        <div data-dbk="elapsed">elapsed: 0s</div>
        <div data-dbk="camPermission">camPermission: —</div>
        <div data-dbk="locPermission">locPermission: —</div>
        <div data-dbk="stream">stream: no</div>
        <div data-dbk="trackState">trackState: —</div>
        <div data-dbk="sameElement">sameElement: —</div>
        <div data-dbk="connected">connected: —</div>
        <div data-dbk="srcObject">srcObject: —</div>
        <div data-dbk="videoRS">videoRS: —</div>
        <div data-dbk="videoSize">videoSize: 0×0</div>
        <div data-dbk="renderedSize">renderedSize: —</div>
        <div data-dbk="cssH">cssH: —</div>
        <div data-dbk="play()">play(): —</div>
        <div data-dbk="error" style="color:#f87171">error: none</div>
        <div id="qrReportCode" style="display:none;color:#4ade80;font-weight:bold;padding-top:4px"></div>
      </div>
      <div style="padding:10px 14px;display:flex;gap:8px;border-top:1px solid #1e3a5f;flex-wrap:wrap">
        <button id="qrCopyDiag" style="flex:1;min-width:130px;padding:12px 8px;background:#0e7a70;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">Sao chép chẩn đoán</button>
        <button id="qrSendReport" style="flex:1;min-width:130px;padding:12px 8px;background:#1e3a5f;color:#7dd3fc;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation">Gửi báo cáo lỗi</button>
      </div>
    </div>` : "";

  return `<div class="page">${header()}
    ${_debugBadge}
    <section class="section"><div class="container">
      <div class="card panel qr-camera-wrap">
        
        <h2>Quét mã QR điểm danh</h2>
        <p class="text-muted">Hướng camera vào mã QR được chiếu bởi HR.</p>
        <div class="qr-camera-viewport" id="qrCameraViewport">
          <video id="qrCameraVideo" autoplay muted playsinline webkit-playsinline style="position:relative;z-index:1;display:block;width:100%;height:100%;min-height:280px;object-fit:cover;background:#000;opacity:1;visibility:visible"></video>
          <canvas id="qrCameraCanvas" style="display:none;position:absolute;top:-9999px;left:-9999px"></canvas>
          <div class="qr-camera-corner qr-camera-corner--tl"></div>
          <div class="qr-camera-corner qr-camera-corner--tr"></div>
          <div class="qr-camera-corner qr-camera-corner--bl"></div>
          <div class="qr-camera-corner qr-camera-corner--br"></div>
          <div class="qr-scan-line"></div>
          <div id="qrCameraStartOverlay" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);z-index:2;border-radius:inherit">
            <button id="qrCameraStart" class="btn btn-primary" style="font-size:16px;padding:14px 28px;touch-action:manipulation">Khởi động camera</button>
          </div>
        </div>
        <p class="qr-camera-status" id="qrCameraStatus" style="min-height:20px">Nhấn để mở camera.</p>
        <div class="qr-camera-actions">
          <button class="btn btn-outline" id="qrCameraStop" style="display:none">Dừng camera</button>
          <button class="btn btn-outline" id="qrCameraRetry" style="display:none">Thử lại camera</button>
          <a class="btn btn-ghost" href="/dashboard/calendar" data-link>Huỷ</a>
        </div>
        <div id="qrHrFallback" style="display:none;margin-top:20px;padding:16px;background:var(--surface,#f8fafc);border:1.5px solid var(--border,#e2e8f0);border-radius:12px;text-align:left">
          <p style="margin:0 0 4px;font-weight:600;font-size:15px">Camera chưa sẵn sàng?</p>
          <p style="margin:0 0 12px;color:#64748b;font-size:13px">Nhập mã điểm danh do HR cung cấp.</p>
          <div style="display:flex;gap:8px">
            <input id="qrHrCodeInput" type="text" placeholder="Nhập mã hoặc dán link QR" style="flex:1;padding:11px 12px;border:1.5px solid var(--border,#e2e8f0);border-radius:8px;font-size:15px;background:var(--bg,#fff);color:inherit;-webkit-appearance:none" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
            <button id="qrHrSubmit" style="padding:11px 16px;background:var(--teal,#0e7a70);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;white-space:nowrap;touch-action:manipulation">Xác nhận</button>
          </div>
        </div>
        ${_debugPanel}
      </div>
    </div></section>
  </div>`;
}

function qrProjectorModal(){if(!qrProjectorOpen||!currentQrTokenId)return "";const token=qrAttendanceService.listTokens().find(row=>row.id===currentQrTokenId);const slot=token?qrAttendanceService.getSlot(token.slotId):null;const sessionRow=slot?offlineTrainingService.getSession(slot.sessionId):null;const live=slot?qrAttendanceService.getLiveSummary(slot.id):null;if(!token||!slot||!sessionRow)return "";return `<div class="modal-backdrop open"><section class="modal modal--large modal--structured qr-projector"><header class="modal__header"><div><h2>${uiText("projector")}</h2></div><button class="icon-btn" data-close-projector>×</button></header><div class="modal__body"><div class="qr-projector__code" data-qr-render="${escapeHtmlAttribute(qrAttendanceService.attendanceLink(token))}"></div><div class="qr-projector__meta"><h3>${escapeHtml(sessionRow.title)}</h3><p>${escapeHtml(slot.label)} · ${token.action==="check_in"?uiText("checkIn"):uiText("checkOut")}</p><p>${new Date(token.opensAt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}–${new Date(token.closesAt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}</p><div class="kpi-grid"><div class="card kpi"><span>Đã quét</span><strong>${token.action==="check_in"?live?.checkedIn||0:live?.checkedOut||0}</strong></div><div class="card kpi"><span>Chưa quét</span><strong>${live?.pending||0}</strong></div></div><a class="btn btn-outline" href="${escapeHtmlAttribute(qrAttendanceService.attendanceLink(token))}" target="_blank" rel="noopener">Mở link scan</a></div></div><footer class="modal__footer"><button class="btn btn-outline" data-close-projector>Đóng</button><button class="btn btn-primary" data-close-qr-token>${uiText("closeAttendance")}</button></footer></section></div>`;}

function changePasswordPage() {
  const account = session?.accountId ? getAccountById(session.accountId) : null;
  const passwordPolicyText = {
    vi: "Tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt. Không được trùng mật khẩu cũ.",
    en: "At least 8 characters with uppercase, lowercase, number and special character. Cannot be the same as the old password.",
    kr: "대문자, 소문자, 숫자, 특수문자를 포함하여 최소 8자. 이전 비밀번호와 동일할 수 없습니다.",
  }[language] || "Tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt. Không được trùng mật khẩu cũ.";
  return `<main class="auth-page"><section class="auth-panel">${brand()}<div class="auth-copy"><h1>${t("changePassword.title")}</h1><p>${account?.fullName || ""}</p></div></section><section class="auth-visual"><form class="card login-card" id="changePasswordForm"><div class="login-card-head">${brand()}${languageSwitcher()}</div><h2>${t("changePassword.title")}</h2><div class="field"><label>${t("changePassword.current")}</label><input name="current" type="password" autocomplete="current-password" required></div><div class="field"><label>${t("changePassword.next")}</label><input name="next" type="password" autocomplete="new-password" required></div><div class="field"><label>${t("changePassword.confirm")}</label><input name="confirm" type="password" autocomplete="new-password" required></div><div class="policy-card"><strong>${t("changePassword.title")}</strong><p>${passwordPolicyText}</p></div><div class="field-error" data-change-password-error role="alert" aria-live="polite"></div><button class="btn btn-primary" type="submit" style="width:100%">${t("changePassword.submit")}</button></form></section></main>`;
}

function c9(key) { return t(`competency.${key}`); }
async function loadCompetencyCatalog(force=false){if(_competencyState.loading)return;if(_competencyState.catalog&&!force)return;_competencyState.loading=true;_competencyState.error="";render();try{_competencyState.catalog=await apiJson(`/api/admin/competencies?q=${encodeURIComponent(_competencyState.q)}&status=${encodeURIComponent(_competencyState.status)}`);_competencyState.assessments=(await apiJson("/api/admin/competency-assessments")).data||[];}catch(e){_competencyState.error=e.message;}finally{_competencyState.loading=false;if(route.startsWith("/admin/competencies"))render();}}
async function loadSkillsMatrix(force=false){if(_competencyState.loading)return;if(_competencyState.matrix&&!force)return;_competencyState.loading=true;_competencyState.error="";render();try{const p=new URLSearchParams({page:String(_competencyState.matrixPage),pageSize:"25"});if(_competencyState.department)p.set("department",_competencyState.department);if(_competencyState.employeeId)p.set("employee",_competencyState.employeeId);_competencyState.matrix=await apiJson(`/api/admin/skills-matrix?${p}`);}catch(e){_competencyState.error=e.message;}finally{_competencyState.loading=false;if(route==="/admin/skills-matrix")render();}}
async function loadDevelopmentPlans(force=false){if(_competencyState.loading)return;if(_competencyState.plans.length&&!force)return;_competencyState.loading=true;_competencyState.error="";render();try{_competencyState.plans=(await apiJson("/api/admin/development-plans")).data||[];if(!_competencyState.catalog)_competencyState.catalog=await apiJson("/api/admin/competencies");}catch(e){_competencyState.error=e.message;}finally{_competencyState.loading=false;if(route==="/admin/development-plans")render();}}
async function loadMyCompetencies(force=false){if(_competencyState.loading)return;if(_competencyState.my&&!force)return;_competencyState.loading=true;_competencyState.error="";render();try{_competencyState.my=await apiJson("/api/competencies/my");}catch(e){_competencyState.error=e.message;}finally{_competencyState.loading=false;if(route==="/dashboard/skills")render();}}
async function loadMyDevelopmentPlans(force=false){if(_competencyState.loading)return;if(_competencyState.myPlans.length&&!force)return;_competencyState.loading=true;_competencyState.error="";render();try{_competencyState.myPlans=(await apiJson("/api/development-plans/my")).data||[];}catch(e){_competencyState.error=e.message;}finally{_competencyState.loading=false;if(route==="/dashboard/development-plan")render();}}
function competencyBadge(status){const cls=status==="met"?"active":status==="significant_gap"?"danger":status==="minor_gap"?"pending":"neutral";return `<span class="badge ${cls}">${escapeHtml(c9(status)||status)}</span>`;}
function adminCompetenciesPage(){if(!hasAdminAccess())return restrictedPage();if(!_competencyState.catalog&&!_competencyState.loading)queueMicrotask(()=>loadCompetencyCatalog());const data=_competencyState.catalog||{categories:[],competencies:[]};const comps=data.competencies||[];const active=comps.filter(c=>c.status==="active").length;return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D",c9("title"),"hr")}<div class="content phase9-page"><section class="learning-hero"><div><h1>${c9("title")}</h1><p>${c9("catalogIntro")}</p></div><div class="learning-actions"><button class="btn btn-outline" data-competency-reload>${c9("reload")}</button></div></section>${_competencyState.error?`<p class="form-error">${escapeHtml(_competencyState.error)}</p>`:""}<div class="kpi-grid"><div class="card kpi"><span>${c9("competencies")}</span><strong>${comps.length}</strong></div><div class="card kpi"><span>${c9("active")}</span><strong>${active}</strong></div><div class="card kpi"><span>${c9("requirements")}</span><strong>${comps.reduce((s,c)=>s+(c.requirements?.length||0),0)}</strong></div><div class="card kpi"><span>${c9("mappedResources")}</span><strong>${comps.reduce((s,c)=>s+(c.mappings?.length||0),0)}</strong></div></div><div class="phase9-grid"><section class="card panel"><h2>${c9("createCompetency")}</h2><form id="competencyCreateForm" class="form-2col"><div class="field"><label>${c9("category")}</label><input name="categoryName" placeholder="[TEST]"></div><div class="field"><label>${c9("code")}</label><input name="code" required></div><div class="field" style="grid-column:1/-1"><label>${c9("name")}</label><input name="name" required></div><div class="field" style="grid-column:1/-1"><label>${c9("description")}</label><textarea name="description" rows="3"></textarea></div><button class="btn btn-primary">${c9("create")}</button></form></section><section class="card panel"><h2>${c9("requirementBuilder")}</h2><form id="competencyRequirementForm" class="form-2col">${competencySelect("competencyId",comps)}<div class="field"><label>${c9("targetType")}</label><select name="targetType"><option value="all_employees">${c9("allEmployees")}</option><option value="department">${t("table.department")}</option><option value="job_title">${t("table.position")}</option><option value="individual">${c9("individual")}</option></select></div><div class="field"><label>${c9("targetValue")}</label><input name="targetValue"></div><div class="field"><label>${c9("requiredLevel")}</label><select name="requiredLevelId">${levelOptions(comps)}</select></div><div class="field"><label>${c9("priority")}</label><input name="priority" type="number" value="100"></div><button class="btn btn-primary">${c9("save")}</button></form></section><section class="card panel"><h2>${c9("resourceMapping")}</h2><form id="competencyMappingForm" class="form-2col">${competencySelect("competencyId",comps)}<div class="field"><label>${c9("resourceType")}</label><select name="resourceType"><option value="course">Course</option><option value="learning_path">Learning Path</option><option value="quiz">Quiz</option><option value="certificate_type">Certificate</option><option value="compliance_program">Compliance</option></select></div><div class="field"><label>${c9("resourceId")}</label><input name="resourceId" required></div><div class="field"><label>${c9("version")}</label><input name="resourceVersionId"></div><div class="field"><label>${c9("awardedLevel")}</label><select name="awardedLevelId">${levelOptions(comps)}</select></div><button class="btn btn-primary">${c9("save")}</button></form></section></div><section class="card panel"><div class="panel-head"><h2>${c9("catalog")}</h2><input data-competency-search value="${escapeHtmlAttribute(_competencyState.q)}" placeholder="${t("admin.search")}"></div><div class="table-wrap"><table><thead><tr><th>${c9("code")}</th><th>${c9("name")}</th><th>${c9("levels")}</th><th>${c9("requirements")}</th><th>${c9("mappedResources")}</th><th>${t("table.status")}</th><th>${t("admin.action")}</th></tr></thead><tbody>${comps.map(c=>`<tr><td><code>${escapeHtml(c.code)}</code></td><td><strong>${escapeHtml(c.name)}</strong><small class="table-subtext">${escapeHtml(c.description||"")}</small></td><td>${(c.levels||[]).map(l=>`${l.rank} ${escapeHtml(l.name)}`).join("<br>")}</td><td>${c.requirements?.length||0}</td><td>${c.mappings?.length||0}</td><td><span class="badge ${c.status==="active"?"active":"pending"}">${escapeHtml(c.status)}</span></td><td><button class="btn btn-outline mini-action" data-competency-status="${c.status==="active"?"archive":"activate"}" data-competency-id="${escapeHtmlAttribute(c.id)}">${c.status==="active"?c9("archive"):c9("activate")}</button></td></tr>`).join("")||`<tr><td colspan="7">${c9("empty")}</td></tr>`}</tbody></table></div></section></div></main></div>`;}
function competencySelect(name, comps){return `<div class="field"><label>${c9("competency")}</label><select name="${name}" required>${comps.map(c=>`<option value="${escapeHtmlAttribute(c.id)}">${escapeHtml(c.name)}</option>`).join("")}</select></div>`;}
function levelOptions(comps){return comps.flatMap(c=>(c.levels||[]).map(l=>`<option value="${escapeHtmlAttribute(l.id)}">${escapeHtml(c.name)} - ${l.rank} ${escapeHtml(l.name)}</option>`)).join("");}
function adminSkillsMatrixPage(){if(!hasAdminAccess())return restrictedPage();if(!_competencyState.matrix&&!_competencyState.loading)queueMicrotask(()=>loadSkillsMatrix());const m=_competencyState.matrix||{rows:[],competencies:[],summary:{},pagination:{page:1,total:0,pageSize:25}};const pages=Math.max(1,Math.ceil((m.pagination.total||0)/(m.pagination.pageSize||25)));return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D",c9("skillsMatrix"),"hr")}<div class="content phase9-page"><section class="learning-hero"><div><h1>${c9("skillsMatrix")}</h1><p>${c9("matrixIntro")}</p></div><div class="learning-actions"><button class="btn btn-outline" data-skills-export="csv">CSV</button><button class="btn btn-outline" data-skills-export="xlsx">XLSX</button><button class="btn btn-outline" data-skills-reload>${c9("reload")}</button></div></section><div class="kpi-grid">${["met","minor_gap","significant_gap","not_assessed"].map(k=>`<div class="card kpi"><span>${c9(k)}</span><strong>${m.summary?.[k]||0}</strong></div>`).join("")}</div><section class="card panel"><form class="filter-bar" data-skills-filter><input name="department" value="${escapeHtmlAttribute(_competencyState.department)}" placeholder="${t("table.department")}"><input name="employeeId" value="${escapeHtmlAttribute(_competencyState.employeeId)}" placeholder="${c9("employeeId")}"><button class="btn btn-primary">${c9("filter")}</button></form><div class="skills-matrix-wrap"><table class="skills-matrix"><thead><tr><th class="sticky-col">${t("enrollment.employee")}</th>${(m.competencies||[]).map(c=>`<th>${escapeHtml(c.name)}</th>`).join("")}</tr></thead><tbody>${(m.rows||[]).map(r=>`<tr><th class="sticky-col"><strong>${escapeHtml(r.employee.fullName)}</strong><small>${escapeHtml(r.employee.department)} · ${escapeHtml(r.employee.jobTitle)}</small></th>${(m.competencies||[]).map(c=>{const cell=r.cells.find(x=>x.competencyId===c.id);return `<td>${cell?`<button class="matrix-cell ${cell.status}" data-matrix-cell="${escapeHtmlAttribute(c.id)}" title="${escapeHtmlAttribute(cell.status)}"><strong>${escapeHtml(cell.requiredLevel?.name||"")}</strong><span>${escapeHtml(cell.effectiveLevel?.name||cell.selfLevel?.name||c9("notAssessed"))}</span>${competencyBadge(cell.status)}</button>`:"-"}</td>`}).join("")}</tr>`).join("")||`<tr><td>${c9("empty")}</td></tr>`}</tbody></table></div><div class="pagination"><button class="btn btn-outline" data-matrix-page="${_competencyState.matrixPage-1}" ${_competencyState.matrixPage<=1?"disabled":""}>${c9("previous")}</button><span>${_competencyState.matrixPage} / ${pages}</span><button class="btn btn-outline" data-matrix-page="${_competencyState.matrixPage+1}" ${_competencyState.matrixPage>=pages?"disabled":""}>${c9("next")}</button></div></section></div></main></div>`;}
function adminDevelopmentPlansPage(){if(!hasAdminAccess())return restrictedPage();if(!_competencyState.plans.length&&!_competencyState.loading)queueMicrotask(()=>loadDevelopmentPlans());const plans=_competencyState.plans||[];const comps=_competencyState.catalog?.competencies||[];return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D",c9("developmentPlan"),"hr")}<div class="content phase9-page"><section class="learning-hero"><div><h1>${c9("developmentPlan")}</h1><p>${c9("planIntro")}</p></div><button class="btn btn-outline" data-plans-reload>${c9("reload")}</button></section>${_competencyState.error?`<p class="form-error">${escapeHtml(_competencyState.error)}</p>`:""}<section class="card panel"><h2>${c9("createPlan")}</h2><form id="developmentPlanForm" class="form-2col"><div class="field"><label>${c9("employeeId")}</label><input name="employeeId" required></div><div class="field"><label>${c9("titleLabel")}</label><input name="title" value="[TEST] ${escapeHtmlAttribute(c9("developmentPlan"))}" required></div><div class="field"><label>${c9("targetEnd")}</label><input name="targetEndAt" type="date"></div><div class="field" style="grid-column:1/-1"><label>${c9("description")}</label><textarea name="description" rows="3"></textarea></div><button class="btn btn-primary">${c9("create")}</button></form></section><section class="card panel"><div class="table-wrap"><table><thead><tr><th>${c9("employee")}</th><th>${c9("titleLabel")}</th><th>${t("table.status")}</th><th>${c9("items")}</th><th>${t("admin.action")}</th></tr></thead><tbody>${plans.map(p=>`<tr><td>${escapeHtml(p.employee?.full_name||p.employee_id)}</td><td><strong>${escapeHtml(p.title)}</strong></td><td><span class="badge ${p.status==="active"?"active":"pending"}">${escapeHtml(p.status)}</span></td><td>${p.items?.length||0}</td><td><form class="inline-plan-item" data-plan-item-form="${escapeHtmlAttribute(p.id)}">${competencySelect("competencyId",comps)}<select name="targetLevelId">${levelOptions(comps)}</select><input name="resourceType" placeholder="course"><input name="resourceId" placeholder="resource id"><input name="resourceVersionId" placeholder="version"><button class="btn btn-outline mini-action">${c9("addItem")}</button></form><button class="btn btn-primary mini-action" data-plan-action="activate" data-plan-id="${escapeHtmlAttribute(p.id)}" ${p.status!=="draft"?"disabled":""}>${c9("activate")}</button></td></tr>`).join("")||`<tr><td colspan="5">${c9("empty")}</td></tr>`}</tbody></table></div></section></div></main></div>`;}
function mySkillsPage(){if(!hasEmployeeAccess())return restrictedPage();if(!_competencyState.my&&!_competencyState.loading)queueMicrotask(()=>loadMyCompetencies());const row=_competencyState.my?.rows?.[0];const cells=[...(row?.cells||[])].sort((a,b)=>["significant_gap","minor_gap","not_assessed","met"].indexOf(a.status)-["significant_gap","minor_gap","not_assessed","met"].indexOf(b.status));return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar(t("learning.learning"),c9("mySkills"),"employee")}<div class="content phase9-page"><section class="learning-hero"><div><h1>${c9("mySkills")}</h1><p>${c9("mySkillsIntro")}</p></div><button class="btn btn-outline" data-my-skills-reload>${c9("reload")}</button></section>${_competencyState.error?`<p class="form-error">${escapeHtml(_competencyState.error)}</p>`:""}<div class="skills-card-list">${cells.map(cell=>`<article class="card skill-card"><div><span>${escapeHtml(cell.categoryName||"")}</span><h2>${escapeHtml(cell.competencyName)}</h2><dl><div><dt>${c9("requiredLevel")}</dt><dd>${escapeHtml(cell.requiredLevel?.name||"")}</dd></div><div><dt>${c9("effectiveLevel")}</dt><dd>${escapeHtml(cell.effectiveLevel?.name||cell.selfLevel?.name||c9("notAssessed"))}</dd></div><div><dt>${c9("skillGap")}</dt><dd>${cell.gap??"-"} · ${competencyBadge(cell.status)}</dd></div></dl></div><form class="self-assessment-form" data-self-assessment="${escapeHtmlAttribute(cell.competencyId)}"><label>${c9("selfAssessment")}<select name="assessedLevelId">${(_competencyState.my?.competencies?.find(c=>c.id===cell.competencyId)?.levels||[]).map(l=>`<option value="${escapeHtmlAttribute(l.id)}">${l.rank} ${escapeHtml(l.name)}</option>`).join("")}</select></label><input name="reason" placeholder="${c9("reason")}"><button class="btn btn-primary">${c9("submitAssessment")}</button></form></article>`).join("")||`<div class="empty-state">${c9("empty")}</div>`}</div></div></main></div>`;}
function myDevelopmentPlanPage(){if(!hasEmployeeAccess())return restrictedPage();if(!_competencyState.myPlans.length&&!_competencyState.loading)queueMicrotask(()=>loadMyDevelopmentPlans());const plans=_competencyState.myPlans||[];return `<div class="app-layout">${sideNav("employee")}<main class="app-main">${topbar(t("learning.learning"),c9("myDevelopmentPlan"),"employee")}<div class="content phase9-page"><section class="learning-hero"><div><h1>${c9("myDevelopmentPlan")}</h1><p>${c9("myPlanIntro")}</p></div><button class="btn btn-outline" data-my-plans-reload>${c9("reload")}</button></section><div class="skills-card-list">${plans.map(p=>`<article class="card skill-card"><div><span class="badge ${p.status==="active"?"active":"pending"}">${escapeHtml(p.status)}</span><h2>${escapeHtml(p.title)}</h2><p>${escapeHtml(p.description||"")}</p></div><a class="btn btn-outline" href="/dashboard/development-plan/${escapeHtmlAttribute(p.id)}" data-link>${c9("viewResult")}</a></article>`).join("")||`<div class="empty-state">${c9("empty")}</div>`}</div></div></main></div>`;}

// ─── Training Tracking ─────────────────────────────────────────────────────
let _ttState = { rows: [], total: 0, loading: false, error: "" };
let _ttFormOpen = false;
let _ttEditId = "";
let _ttDrawerOpen = false;
let _ttDetail = null;
let _ttFilters = { search: "", department: "", category: "", status: "" };
let _ttRequestSeq = 0;
const TT = (k) => t("trainingTracking." + k);

function ttApiHeaders() {
  const h = { "Content-Type": "application/json" };
  if (session?.accountId) h["X-Account-Id"] = session.accountId;
  if (session?.role) h["X-Account-Role"] = session.role;
  return h;
}

async function loadTrainingTracking({ renderMode = "full" } = {}) {
  if (_ttState.loading) return;
  const requestSeq = ++_ttRequestSeq;
  _ttState.loading = true;
  _ttState.error = "";
  if (renderMode === "section") renderTrainingTrackingResults();
  else render();
  try {
    const params = new URLSearchParams();
    if (_ttFilters.search) params.set("search", _ttFilters.search);
    if (_ttFilters.department) params.set("department", _ttFilters.department);
    if (_ttFilters.category) params.set("category", _ttFilters.category);
    if (_ttFilters.status) params.set("status", _ttFilters.status);
    const res = await fetch("/api/admin/training-tracking?" + params.toString(), { headers: ttApiHeaders() });
    const body = await res.json().catch(() => ({}));
    if (requestSeq !== _ttRequestSeq) return;
    if (!res.ok) throw new Error(body.error || "load_failed");
    _ttState.rows = body.data || [];
    _ttState.total = body.total || 0;
  } catch (e) {
    if (requestSeq !== _ttRequestSeq) return;
    _ttState.error = e.message || "Không thể tải dữ liệu.";
  } finally {
    if (requestSeq !== _ttRequestSeq) return;
    _ttState.loading = false;
    if (route === "/admin/training-tracking") {
      if (renderMode === "section") renderTrainingTrackingResults();
      else render();
    }
  }
}

function formatVnd(n) {
  if (n == null) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", minimumFractionDigits: 0 }).format(n);
}

function formatDate(d) {
  if (!d) return "—";
  try {
    const locale = language === "vi" ? "vi-VN" : language === "kr" ? "ko-KR" : "en-US";
    return new Date(d + "T00:00:00").toLocaleDateString(locale, { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch { return d; }
}

function ttStatusBadge(s) {
  const labels = { not_updated: TT("notUpdated"), planned: TT("planned"), in_progress: TT("inProg"), completed: TT("completed"), cancelled: TT("cancelled") };
  return `<span class="badge ${s === "in_progress" ? "active" : s === "completed" ? "" : s === "cancelled" ? "pending" : "pending"}">${escapeHtml(labels[s] || s)}</span>`;
}

function trainingTrackingPage() {
  if (!hasAdminAccess()) return restrictedPage();
  if (!_ttState.rows.length && !_ttState.loading && !_ttState.error) queueMicrotask(() => loadTrainingTracking());
  const rows = _ttState.rows || [];
  const totalCost = rows.reduce((s, r) => s + (Number(r.totalCostVnd) || 0), 0);
  const inProg = rows.filter(r => r.status === "in_progress").length;
  const notUpd = rows.filter(r => r.status === "not_updated").length;
  const depts = [...new Set(rows.map(r => r.department).filter(Boolean))];
  const cats = [...new Set(rows.map(r => r.trainingCategory).filter(Boolean))];
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D", TT("title"), "hr")}<div class="content"><section class="learning-hero"><div><h1>${TT("title")}</h1><p>${TT("subtitle")}</p></div><button class="btn btn-primary" data-tt-create>+ ${TT("create")}</button></section>${_ttState.error ? `<p class="form-error">${escapeHtml(_ttState.error)}</p>` : ""}<div class="kpi-grid"><div class="card kpi"><span>${TT("totalPrograms")}</span><strong>${rows.length}</strong></div><div class="card kpi"><span>${TT("totalCost")}</span><strong>${formatVnd(totalCost)}</strong></div><div class="card kpi"><span>${TT("inProgress")}</span><strong>${inProg}</strong></div><div class="card kpi"><span>${TT("notUpdated")}</span><strong>${notUpd}</strong></div></div><section class="card panel"><div class="filter-bar"><input type="search" data-tt-search value="${escapeHtmlAttribute(_ttFilters.search)}" placeholder="${TT("search")}" aria-label="${TT("search")}"><select data-tt-filter-dept><option value="">${TT("filterDepartment")}</option>${depts.map(d => `<option value="${escapeHtmlAttribute(d)}" ${_ttFilters.department === d ? "selected" : ""}>${escapeHtml(d)}</option>`).join("")}</select><select data-tt-filter-cat><option value="">${TT("filterCategory")}</option>${cats.map(c => `<option value="${escapeHtmlAttribute(c)}" ${_ttFilters.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}</select><select data-tt-filter-status><option value="">${TT("filterStatus")}</option>${[["not_updated", TT("notUpdated")], ["planned", TT("planned")], ["in_progress", TT("inProg")], ["completed", TT("completed")], ["cancelled", TT("cancelled")]].map(([v, l]) => `<option value="${v}" ${_ttFilters.status === v ? "selected" : ""}>${escapeHtml(l)}</option>`).join("")}</select></div><div id="ttResults" aria-live="polite">${trainingTrackingResultsHtml()}</div></section></div></main>${_ttDrawerOpen ? ttDrawer() : ""}${_ttFormOpen ? ttFormDrawer() : ""}</div>`;
}

function trainingTrackingResultsHtml() {
  const rows = _ttState.rows || [];
  if (_ttState.loading) return `<div class="hr-overview-skeleton">${Array(3).fill("<span></span>").join("")}</div>`;
  if (!rows.length) return `<div class="empty-state"><h3>${TT("noData")}</h3></div>`;
  const table = `<div class="table-wrap tt-table"><table><thead><tr><th>${TT("employee")}</th><th>${TT("position")}</th><th>${TT("department")}</th><th>${TT("trainingName")}</th><th>${TT("trainingProvider")}</th><th>${TT("trainingCategory")}</th><th>${TT("time")}</th><th>${TT("format")}</th><th>${TT("cost")}</th><th>${TT("status")}</th><th>${TT("action")}</th></tr></thead><tbody>${rows.map(r => `<tr><td>${escapeHtml(r.employeeName)}</td><td>${escapeHtml(r.positionTitle)}</td><td>${escapeHtml(r.department)}</td><td><strong>${escapeHtml(r.trainingName)}</strong></td><td>${escapeHtml(r.trainingProvider)}</td><td>${escapeHtml(r.trainingCategory)}</td><td>${formatDate(r.startDate)} — ${formatDate(r.endDate)}</td><td>${escapeHtml(r.studyFormat || "—")}</td><td>${formatVnd(r.totalCostVnd)}</td><td>${ttStatusBadge(r.status)}</td><td><div class="learning-actions"><button class="btn btn-outline mini-action" data-tt-view="${escapeHtmlAttribute(r.id)}">${TT("viewDetail")}</button><button class="btn btn-outline mini-action" data-tt-edit="${escapeHtmlAttribute(r.id)}">${TT("edit")}</button>${r.status !== "cancelled" ? `<button class="btn btn-outline mini-action" data-tt-archive="${escapeHtmlAttribute(r.id)}">${TT("archive")}</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div>`;
  const cards = `<div class="tt-cards-mobile">${rows.map(r => `<article class="card tt-card"><div class="tt-card__head"><strong>${escapeHtml(r.trainingName)}</strong>${ttStatusBadge(r.status)}</div><div class="tt-card__body"><span>${escapeHtml(r.employeeName)} · ${escapeHtml(r.department)}</span><span>${escapeHtml(r.trainingProvider)}</span><span>${formatDate(r.startDate)} — ${formatDate(r.endDate)}</span><span>${formatVnd(r.totalCostVnd)}</span></div><div class="card-actions"><button class="btn btn-outline mini-action" data-tt-view="${escapeHtmlAttribute(r.id)}">${TT("viewDetail")}</button><button class="btn btn-outline mini-action" data-tt-edit="${escapeHtmlAttribute(r.id)}">${TT("edit")}</button>${r.status !== "cancelled" ? `<button class="btn btn-outline mini-action" data-tt-archive="${escapeHtmlAttribute(r.id)}">${TT("archive")}</button>` : ""}</div></article>`).join("")}</div>`;
  return table + cards;
}

function renderTrainingTrackingResults() {
  const target = document.getElementById("ttResults");
  if (!target) return;
  target.innerHTML = trainingTrackingResultsHtml();
  bindTrainingTrackingResultEvents(target);
}

function bindTrainingTrackingResultEvents(root = document) {
  root.querySelectorAll("[data-tt-edit]").forEach(el => el.addEventListener("click", () => { _ttEditId = el.dataset.ttEdit; _ttFormOpen = true; render(); }));
  root.querySelectorAll("[data-tt-view]").forEach(el => el.addEventListener("click", async () => {
    try { const res = await fetch(`/api/admin/training-tracking/${el.dataset.ttView}`, { headers: ttApiHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "load_failed");
      _ttDetail = body.data; _ttDrawerOpen = true; render();
    } catch (e) { toast("Lỗi: " + e.message); }
  }));
  root.querySelectorAll("[data-tt-archive]").forEach(el => el.addEventListener("click", () => archiveTrainingRecord(el.dataset.ttArchive)));
}

function ttDrawer() {
  if (!_ttDetail) return "";
  const r = _ttDetail;
  return `<div class="modal-backdrop open" data-tt-close-drawer><section class="modal modal--large modal--structured" role="dialog" aria-modal="true"><header class="modal__header"><div><h2>${escapeHtml(r.trainingName)}</h2></div><button type="button" class="icon-btn" data-tt-close-drawer>×</button></header><div class="modal__body"><dl class="compliance-detail-grid"><div><dt>${TT("employee")}</dt><dd>${escapeHtml(r.employeeName)}</dd></div><div><dt>${TT("position")}</dt><dd>${escapeHtml(r.positionTitle)}</dd></div><div><dt>${TT("department")}</dt><dd>${escapeHtml(r.department)}</dd></div><div><dt>${TT("trainingProvider")}</dt><dd>${escapeHtml(r.trainingProvider)}</dd></div><div><dt>${TT("trainingCategory")}</dt><dd>${escapeHtml(r.trainingCategory)}</dd></div><div><dt>${TT("time")}</dt><dd>${formatDate(r.startDate)} — ${formatDate(r.endDate)}</dd></div><div><dt>${TT("format")}</dt><dd>${escapeHtml(r.studyFormat || "—")}</dd></div><div><dt>${TT("cost")}</dt><dd>${formatVnd(r.totalCostVnd)}</dd></div><div><dt>${TT("status")}</dt><dd>${ttStatusBadge(r.status)}</dd></div></dl><h3>${TT("purpose")}</h3><p style="white-space:pre-wrap">${escapeHtml(r.purposeAndJobRelevance || "—")}</p>${r.notes ? `<h3>${TT("notes")}</h3><p style="white-space:pre-wrap">${escapeHtml(r.notes)}</p>` : ""}</div><footer class="modal__footer"><button class="btn btn-outline" data-tt-close-drawer>${TT("cancel")}</button></footer></section></div>`;
}

function ttFormDrawer() {
  const r = _ttEditId ? _ttState.rows.find(x => x.id === _ttEditId) : null;
  const isEdit = !!r;
  const statuses = [["not_updated", TT("notUpdated")], ["planned", TT("planned")], ["in_progress", TT("inProg")], ["completed", TT("completed")], ["cancelled", TT("cancelled")]];
  return `<div class="modal-backdrop open" data-tt-close-form><form id="ttForm" class="modal modal--xlarge modal--structured" role="dialog" aria-modal="true"><header class="modal__header"><div><h2>${isEdit ? TT("edit") : TT("create")}</h2></div><button type="button" class="icon-btn" data-tt-close-form>×</button></header><div class="modal__body"><div class="form-2col"><div class="field"><label>${TT("employee")} *</label><input name="employeeName" value="${escapeHtmlAttribute(r?.employeeName || "")}" required></div><div class="field"><label>${TT("position")} *</label><input name="positionTitle" value="${escapeHtmlAttribute(r?.positionTitle || "")}" required></div><div class="field"><label>${TT("department")} *</label><input name="department" value="${escapeHtmlAttribute(r?.department || "")}" required></div><div class="field"><label>${TT("trainingName")} *</label><input name="trainingName" value="${escapeHtmlAttribute(r?.trainingName || "")}" required></div><div class="field" style="grid-column:1/-1"><label>${TT("purpose")} *</label><textarea name="purposeAndJobRelevance" rows="3" required>${escapeHtml(r?.purposeAndJobRelevance || "")}</textarea></div><div class="field"><label>${TT("trainingProvider")} *</label><input name="trainingProvider" value="${escapeHtmlAttribute(r?.trainingProvider || "")}" required></div><div class="field"><label>${TT("trainingCategory")} *</label><input name="trainingCategory" value="${escapeHtmlAttribute(r?.trainingCategory || "")}" required></div><div class="field"><label>${TT("startDate")}</label><input name="startDate" type="date" value="${escapeHtmlAttribute(r?.startDate || "")}"></div><div class="field"><label>${TT("endDate")}</label><input name="endDate" type="date" value="${escapeHtmlAttribute(r?.endDate || "")}"></div><div class="field"><label>${TT("format")}</label><input name="studyFormat" value="${escapeHtmlAttribute(r?.studyFormat || "")}"></div><div class="field"><label>${TT("cost")}</label><input name="totalCostVnd" type="number" min="0" value="${r?.totalCostVnd != null ? r.totalCostVnd : ""}"></div><div class="field"><label>${TT("status")}</label><select name="status">${statuses.map(([v, l]) => `<option value="${v}" ${(r?.status || "not_updated") === v ? "selected" : ""}>${escapeHtml(l)}</option>`).join("")}</select></div><div class="field" style="grid-column:1/-1"><label>${TT("notes")}</label><textarea name="notes" rows="2">${escapeHtml(r?.notes || "")}</textarea></div></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-tt-close-form>${TT("cancel")}</button><button type="submit" class="btn btn-primary">${TT("save")}</button></footer></form></div>`;
}

async function submitTtForm(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const fd = new FormData(form);
  const body = {};
  for (const [k, v] of fd) body[k] = v;
  if (body.totalCostVnd === "") body.totalCostVnd = null;
  const isEdit = !!_ttEditId;
  const url = isEdit ? `/api/admin/training-tracking/${_ttEditId}` : "/api/admin/training-tracking";
  const method = isEdit ? "PATCH" : "POST";
  try {
    const res = await fetch(url, { method, headers: ttApiHeaders(), body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "save_failed");
    _ttFormOpen = false;
    _ttEditId = "";
    toast(isEdit ? "Đã cập nhật." : "Đã tạo mới.");
    loadTrainingTracking();
  } catch (e) {
    toast("Lỗi: " + e.message);
  }
}

async function archiveTrainingRecord(id) {
  if (!confirm(TT("confirmDelete"))) return;
  try {
    const res = await fetch(`/api/admin/training-tracking/${id}/archive`, { method: "POST", headers: ttApiHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "archive_failed");
    toast("Đã lưu trữ.");
    loadTrainingTracking();
  } catch (e) {
    toast("Lỗi: " + e.message);
  }
}

// ─── CCHN Registration ──────────────────────────────────────────────────────
let _cchnState = { catalog: [], registrations: [], total: 0, loading: false, error: "" };
let _cchnFormOpen = false;
let _cchnEditId = "";
let _cchnDrawerOpen = false;
let _cchnDetail = null;
let _cchnFilters = { search: "", department: "", status: "" };
let _cchnAddItemOpen = false;
let _cchnRequestSeq = 0;
const CCHN = (k) => t("cchnRegistration." + k);

async function loadCchnCatalog() {
  try {
    const res = await fetch("/api/admin/cchn/catalog?status=active", { headers: ttApiHeaders() });
    const body = await res.json().catch(() => ({}));
    if (res.ok) _cchnState.catalog = body.data || [];
  } catch {}
}

async function loadCchnRegistrations({ renderMode = "full" } = {}) {
  if (_cchnState.loading) return;
  const requestSeq = ++_cchnRequestSeq;
  _cchnState.loading = true;
  _cchnState.error = "";
  if (renderMode === "section") renderCchnRegistrationResults();
  else render();
  try {
    const params = new URLSearchParams();
    if (_cchnFilters.search) params.set("search", _cchnFilters.search);
    if (_cchnFilters.department) params.set("department", _cchnFilters.department);
    if (_cchnFilters.status) params.set("status", _cchnFilters.status);
    const res = await fetch("/api/admin/cchn/registrations?" + params.toString(), { headers: ttApiHeaders() });
    const body = await res.json().catch(() => ({}));
    if (requestSeq !== _cchnRequestSeq) return;
    if (!res.ok) throw new Error(body.error || "load_failed");
    _cchnState.registrations = body.data || [];
    _cchnState.total = body.total || 0;
  } catch (e) {
    if (requestSeq !== _cchnRequestSeq) return;
    _cchnState.error = e.message || "Không thể tải dữ liệu.";
  } finally {
    if (requestSeq !== _cchnRequestSeq) return;
    _cchnState.loading = false;
    if (route === "/admin/cchn-registrations") {
      if (renderMode === "section") renderCchnRegistrationResults();
      else render();
    }
  }
}

function cchnRegStatusBadge(s) {
  const labels = { draft: CCHN("draft"), registered: CCHN("registered"), approved: CCHN("approved"), studying: CCHN("studying"), completed: CCHN("completed"), cancelled: CCHN("cancelled") };
  const cls = { draft: "pending", registered: "active", approved: "", studying: "active", completed: "", cancelled: "pending" };
  return `<span class="badge ${cls[s] || "pending"}">${escapeHtml(labels[s] || s)}</span>`;
}

const CCHN_COLORS = { blue: "#3b82f6", teal: "#14b8a6", purple: "#a855f7", green: "#22c55e", orange: "#f97316", pink: "#ec4899", indigo: "#6366f1", red: "#ef4444", cyan: "#06b6d4", amber: "#f59e0b", slate: "#64748b", lime: "#84cc16", violet: "#8b5cf6", rose: "#f43f5e" };

function cchnChip(item) {
  const color = CCHN_COLORS[item.colorToken] || "#64748b";
  return `<span class="cchn-chip" style="background:${color}15;color:${color};border:1px solid ${color}30;border-radius:4px;padding:2px 8px;font-size:.8em;display:inline-block;margin:2px">${escapeHtml(item.labelVi || item.label_vi)}</span>`;
}

function cchnRegistrationPage() {
  if (!hasAdminAccess()) return restrictedPage();
  if (!_cchnState.catalog.length) loadCchnCatalog();
  if (!_cchnState.registrations.length && !_cchnState.loading && !_cchnState.error) queueMicrotask(() => loadCchnRegistrations());
  const rows = _cchnState.registrations || [];
  const depts = [...new Set(rows.map(r => r.department).filter(Boolean))];
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D", CCHN("title"), "hr")}<div class="content"><section class="learning-hero"><div><h1>${CCHN("title")}</h1><p>${CCHN("subtitle")}</p></div><button class="btn btn-primary" data-cchn-create>+ ${CCHN("create")}</button></section>${_cchnState.error ? `<p class="form-error">${escapeHtml(_cchnState.error)}</p>` : ""}<section class="card panel"><div class="filter-bar"><input type="search" data-cchn-search value="${escapeHtmlAttribute(_cchnFilters.search)}" placeholder="${CCHN("search")}" aria-label="${CCHN("search")}"><select data-cchn-filter-dept><option value="">${CCHN("filterDepartment")}</option>${depts.map(d => `<option value="${escapeHtmlAttribute(d)}" ${_cchnFilters.department === d ? "selected" : ""}>${escapeHtml(d)}</option>`).join("")}</select><select data-cchn-filter-status><option value="">${CCHN("filterStatus")}</option>${[["draft", CCHN("draft")], ["registered", CCHN("registered")], ["approved", CCHN("approved")], ["studying", CCHN("studying")], ["completed", CCHN("completed")], ["cancelled", CCHN("cancelled")]].map(([v, l]) => `<option value="${v}" ${_cchnFilters.status === v ? "selected" : ""}>${escapeHtml(l)}</option>`).join("")}</select></div><div id="cchnRegistrationResults" aria-live="polite">${cchnRegistrationResultsHtml()}</div></section></div></main>${_cchnDrawerOpen ? cchnDrawer() : ""}${_cchnFormOpen ? cchnFormDrawer() : ""}${_cchnAddItemOpen ? cchnAddItemModal() : ""}</div>`;
}

function cchnRegistrationResultsHtml() {
  const rows = _cchnState.registrations || [];
  if (_cchnState.loading) return `<div class="hr-overview-skeleton">${Array(3).fill("<span></span>").join("")}</div>`;
  if (!rows.length) return `<div class="empty-state"><h3>${CCHN("noData")}</h3></div>`;
  const table = `<div class="table-wrap cchn-table"><table><thead><tr><th>${CCHN("employee")}</th><th>${CCHN("department")}</th><th>${CCHN("content")}</th><th>${CCHN("registrationDate")}</th><th>${CCHN("plannedTrainingDate")}</th><th>${CCHN("plannedExamDate")}</th><th>${CCHN("studyFormat")}</th><th>${CCHN("totalCost")}</th><th>${CCHN("status")}</th><th>${CCHN("action")}</th></tr></thead><tbody>${rows.map(r => `<tr><td>${escapeHtml(r.employeeName)}</td><td>${escapeHtml(r.department || "—")}</td><td>${(r.items || []).map(i => cchnChip(i.cchn_catalog_items || i.catalogItem || {})).join("")}</td><td>${formatDate(r.registrationDate)}</td><td>${formatDate(r.plannedTrainingDate)}</td><td>${formatDate(r.plannedExamDate)}</td><td>${escapeHtml(r.studyFormat || "—")}</td><td>${formatVnd(r.totalCostVnd)}</td><td>${cchnRegStatusBadge(r.status)}</td><td><div class="learning-actions"><button class="btn btn-outline mini-action" data-cchn-view="${escapeHtmlAttribute(r.id)}">${CCHN("viewDetail")}</button><button class="btn btn-outline mini-action" data-cchn-edit="${escapeHtmlAttribute(r.id)}">${CCHN("edit")}</button>${r.status !== "cancelled" ? `<button class="btn btn-outline mini-action" data-cchn-cancel="${escapeHtmlAttribute(r.id)}">${CCHN("cancelled")}</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div>`;
  const cards = `<div class="cchn-cards-mobile">${rows.map(r => `<article class="card cchn-card"><div class="cchn-card__head"><strong>${escapeHtml(r.employeeName)}</strong>${cchnRegStatusBadge(r.status)}</div><div class="cchn-card__body"><span>${escapeHtml(r.department || "—")}</span><div>${(r.items || []).map(i => cchnChip(i.cchn_catalog_items || i.catalogItem || {})).join("")}</div><span>${formatDate(r.registrationDate)}</span><span>${formatVnd(r.totalCostVnd)}</span></div><div class="card-actions"><button class="btn btn-outline mini-action" data-cchn-view="${escapeHtmlAttribute(r.id)}">${CCHN("viewDetail")}</button><button class="btn btn-outline mini-action" data-cchn-edit="${escapeHtmlAttribute(r.id)}">${CCHN("edit")}</button>${r.status !== "cancelled" ? `<button class="btn btn-outline mini-action" data-cchn-cancel="${escapeHtmlAttribute(r.id)}">${CCHN("cancelled")}</button>` : ""}</div></article>`).join("")}</div>`;
  return table + cards;
}

function renderCchnRegistrationResults() {
  const target = document.getElementById("cchnRegistrationResults");
  if (!target) return;
  target.innerHTML = cchnRegistrationResultsHtml();
  bindCchnRegistrationResultEvents(target);
}

function bindCchnRegistrationResultEvents(root = document) {
  root.querySelectorAll("[data-cchn-edit]").forEach(el => el.addEventListener("click", () => { _cchnEditId = el.dataset.cchnEdit; _cchnFormOpen = true; render(); }));
  root.querySelectorAll("[data-cchn-view]").forEach(el => el.addEventListener("click", async () => {
    try { const res = await fetch(`/api/admin/cchn/registrations/${el.dataset.cchnView}`, { headers: ttApiHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "load_failed");
      _cchnDetail = body.data; _cchnDrawerOpen = true; render();
    } catch (e) { toast("Lỗi: " + e.message); }
  }));
  root.querySelectorAll("[data-cchn-cancel]").forEach(el => el.addEventListener("click", () => cancelCchnRegistration(el.dataset.cchnCancel)));
}

function cchnDrawer() {
  if (!_cchnDetail) return "";
  const r = _cchnDetail;
  return `<div class="modal-backdrop open" data-cchn-close-drawer><section class="modal modal--large modal--structured" role="dialog" aria-modal="true"><header class="modal__header"><div><h2>${escapeHtml(r.employeeName)}</h2></div><button type="button" class="icon-btn" data-cchn-close-drawer>×</button></header><div class="modal__body"><dl class="compliance-detail-grid"><div><dt>${CCHN("employee")}</dt><dd>${escapeHtml(r.employeeName)}</dd></div><div><dt>${CCHN("department")}</dt><dd>${escapeHtml(r.department || "—")}</dd></div><div><dt>${CCHN("content")}</dt><dd>${(r.items || []).map(i => cchnChip(i.cchn_catalog_items || i.catalogItem || {})).join("")}</dd></div><div><dt>${CCHN("registrationDate")}</dt><dd>${formatDate(r.registrationDate)}</dd></div><div><dt>${CCHN("plannedTrainingDate")}</dt><dd>${formatDate(r.plannedTrainingDate)}</dd></div><div><dt>${CCHN("plannedExamDate")}</dt><dd>${formatDate(r.plannedExamDate)}</dd></div><div><dt>${CCHN("studyFormat")}</dt><dd>${escapeHtml(r.studyFormat || "—")}</dd></div><div><dt>${CCHN("totalCost")}</dt><dd>${formatVnd(r.totalCostVnd)}</dd></div><div><dt>${CCHN("status")}</dt><dd>${cchnRegStatusBadge(r.status)}</dd></div></dl>${r.notes ? `<h3>${TT("notes")}</h3><p style="white-space:pre-wrap">${escapeHtml(r.notes)}</p>` : ""}</div><footer class="modal__footer"><button class="btn btn-outline" data-cchn-close-drawer>${CCHN("cancel")}</button></footer></section></div>`;
}

function cchnFormDrawer() {
  const r = _cchnEditId ? _cchnState.registrations.find(x => x.id === _cchnEditId) : null;
  const isEdit = !!r;
  const allItems = _cchnState.catalog || [];
  const selectedIds = new Set((r?.items || []).map(i => i.catalog_item_id || i.catalogItemId || i.cchn_catalog_items?.id));
  const statuses = [["draft", CCHN("draft")], ["registered", CCHN("registered")], ["approved", CCHN("approved")], ["studying", CCHN("studying")], ["completed", CCHN("completed")], ["cancelled", CCHN("cancelled")]];
  return `<div class="modal-backdrop open" data-cchn-close-form><form id="cchnForm" class="modal modal--xlarge modal--structured" role="dialog" aria-modal="true"><header class="modal__header"><div><h2>${isEdit ? CCHN("edit") : CCHN("create")}</h2></div><button type="button" class="icon-btn" data-cchn-close-form>×</button></header><div class="modal__body"><div class="form-2col"><div class="field"><label>${CCHN("employee")} *</label><input name="employeeName" value="${escapeHtmlAttribute(r?.employeeName || "")}" required></div><div class="field"><label>${TT("position")}</label><input name="positionTitle" value="${escapeHtmlAttribute(r?.positionTitle || "")}"></div><div class="field"><label>${CCHN("department")}</label><input name="department" value="${escapeHtmlAttribute(r?.department || "")}"></div><div class="field"><label>${CCHN("registrationDate")}</label><input name="registrationDate" type="date" value="${escapeHtmlAttribute(r?.registrationDate || "")}"></div><div class="field"><label>${CCHN("plannedTrainingDate")}</label><input name="plannedTrainingDate" type="date" value="${escapeHtmlAttribute(r?.plannedTrainingDate || "")}"></div><div class="field"><label>${CCHN("plannedExamDate")}</label><input name="plannedExamDate" type="date" value="${escapeHtmlAttribute(r?.plannedExamDate || "")}"></div><div class="field"><label>${CCHN("studyFormat")}</label><input name="studyFormat" value="${escapeHtmlAttribute(r?.studyFormat || "")}"></div><div class="field"><label>${CCHN("totalCost")}</label><input name="totalCostVnd" type="number" min="0" value="${r?.totalCostVnd != null ? r.totalCostVnd : ""}"></div><div class="field"><label>${CCHN("status")}</label><select name="status">${statuses.map(([v, l]) => `<option value="${v}" ${(r?.status || "draft") === v ? "selected" : ""}>${escapeHtml(l)}</option>`).join("")}</select></div></div><div class="field"><label>${CCHN("selectItems")}</label><div class="cchn-chip-selector" data-cchn-chip-selector>${allItems.filter(i => i.status === "active").map(i => `<label class="cchn-chip-option" style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;padding:4px"><input type="checkbox" name="catalogItemIds" value="${escapeHtmlAttribute(i.id)}" ${selectedIds.has(i.id) ? "checked" : ""}>${cchnChip(i)}</label>`).join("")}</div><button type="button" class="btn btn-outline mini-action" data-cchn-add-item style="margin-top:8px">+ ${CCHN("addItem")}</button></div><div class="field" style="grid-column:1/-1"><label>${TT("notes")}</label><textarea name="notes" rows="2">${escapeHtml(r?.notes || "")}</textarea></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-cchn-close-form>${CCHN("cancel")}</button><button type="submit" class="btn btn-primary">${CCHN("save")}</button></footer></form></div>`;
}

function cchnAddItemModal() {
  const groups = [["subject", CCHN("groupSubject")], ["fee", CCHN("groupFee")], ["reimbursement", CCHN("groupReimbursement")], ["other", CCHN("groupOther")]];
  return `<div class="modal-backdrop open" data-cchn-close-add><form id="cchnAddItemForm" class="modal modal--medium modal--structured" role="dialog" aria-modal="true"><header class="modal__header"><div><h2>${CCHN("addItem")}</h2></div><button type="button" class="icon-btn" data-cchn-close-add>×</button></header><div class="modal__body"><div class="form-2col"><div class="field"><label>${CCHN("itemGroup")} *</label><select name="itemGroup" required>${groups.map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`).join("")}</select></div><div class="field" style="grid-column:1/-1"><label>${CCHN("itemNameVi")} *</label><input name="labelVi" required></div><div class="field" style="grid-column:1/-1"><label>${CCHN("itemNameEn")}</label><input name="labelEn"></div></div></div><footer class="modal__footer"><button type="button" class="btn btn-outline" data-cchn-close-add>${CCHN("cancel")}</button><button type="submit" class="btn btn-primary">${CCHN("save")}</button></footer></form></div>`;
}

async function submitCchnForm(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const fd = new FormData(form);
  const catalogItemIds = fd.getAll("catalogItemIds");
  const body = {};
  for (const [k, v] of fd) { if (k !== "catalogItemIds") body[k] = v; }
  body.catalogItemIds = catalogItemIds;
  if (body.totalCostVnd === "") body.totalCostVnd = null;
  const isEdit = !!_cchnEditId;
  const url = isEdit ? `/api/admin/cchn/registrations/${_cchnEditId}` : "/api/admin/cchn/registrations";
  const method = isEdit ? "PATCH" : "POST";
  try {
    const res = await fetch(url, { method, headers: ttApiHeaders(), body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "save_failed");
    _cchnFormOpen = false;
    _cchnEditId = "";
    toast(isEdit ? "Đã cập nhật." : "Đã tạo mới.");
    loadCchnRegistrations();
  } catch (e) {
    toast("Lỗi: " + e.message);
  }
}

async function submitCchnAddItem(e) {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const body = {};
  for (const [k, v] of fd) body[k] = v;
  try {
    const res = await fetch("/api/admin/cchn/catalog", { method: "POST", headers: ttApiHeaders(), body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.error === "DUPLICATE_LABEL") { toast("Mục này đã tồn tại."); return; }
      throw new Error(data.error || "save_failed");
    }
    _cchnAddItemOpen = false;
    await loadCchnCatalog();
    toast("Đã thêm mục mới.");
    if (route === "/admin/cchn-registrations") render();
  } catch (e) {
    toast("Lỗi: " + e.message);
  }
}

async function cancelCchnRegistration(id) {
  if (!confirm("Hủy đăng ký này?")) return;
  try {
    const res = await fetch(`/api/admin/cchn/registrations/${id}/cancel`, { method: "POST", headers: ttApiHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "cancel_failed");
    toast("Đã hủy đăng ký.");
    loadCchnRegistrations();
  } catch (e) {
    toast("Lỗi: " + e.message);
  }
}

function restrictedPage() {
  return `<div class="page">${header()}<section class="section"><div class="container"><div class="card empty-state">${icon("lock")}<h2>${t("toast.restricted")}</h2><a class="btn btn-primary" href="/login" data-link>${t("nav.login")}</a></div></div></section>${footer()}</div>`;
}

function hasAdminAccess() {
  return ["hr", "admin"].includes(session?.role);
}

function setupLearningTracking(){clearInterval(learningTimerId);learningTimerId=null;destroyYoutubePlayer();const stage=document.querySelector(".lesson-stage");if(!stage||!hasEmployeeAccess())return;const item=getCourseContent(stage.dataset.courseId).find(x=>x.id===stage.dataset.contentId);if(!item)return;lastTickAt=Date.now();
  if(item.type==="slide")learningTimerId=setInterval(()=>{if(document.hidden||!document.hasFocus())return;const viewer=document.querySelector(".slide-viewer");const slide=item.slides?.[activeSlideIndex];if(!viewer||!slide)return;const state=getContentProgress(session.accountId,item.courseId).find(x=>x.contentId===item.id);const slides={...(state?.metadata?.slides||{})};const prior=slides[slide.id]||{viewedSeconds:0,completed:false,rapidAdvanceAttempts:0};prior.viewedSeconds=Math.min(slide.minimumViewSeconds,prior.viewedSeconds+1);prior.completed=prior.viewedSeconds>=slide.minimumViewSeconds;prior.lastViewedAt=new Date().toISOString();slides[slide.id]=prior;const complete=item.slides.every(s=>slides[s.id]?.completed);saveContentProgress({accountId:session.accountId,courseId:item.courseId,contentId:item.id,contentType:"slide",activeSeconds:Number(state?.activeSeconds||0)+1,completionPercent:Math.round(Object.values(slides).filter(s=>s.completed).length/item.slides.length*100),completed:complete,metadata:{slides}});const remaining=Math.max(0,slide.minimumViewSeconds-prior.viewedSeconds);const timer=document.querySelector("[data-slide-timer]");if(timer)timer.textContent=`${remaining}s`;const next=document.querySelector(`[data-slide-nav="${activeSlideIndex+1}"]`);if(next&&remaining===0){next.disabled=false;next.removeAttribute("aria-disabled");}if(complete){clearInterval(learningTimerId);render();}},1000);
  const video=document.getElementById("course-video");if(video){let last=video.currentTime||0;video.playbackRate=Math.min(video.playbackRate,item.completionRule?.maxPlaybackRate||1.25);video.addEventListener("ratechange",()=>{if(video.playbackRate>(item.completionRule?.maxPlaybackRate||1.25))video.playbackRate=item.completionRule?.maxPlaybackRate||1.25;});video.addEventListener("seeking",()=>{const state=getContentProgress(session.accountId,item.courseId).find(x=>x.contentId===item.id);const allowed=Number(state?.metadata?.furthestAllowedTime||0)+2;if(video.currentTime>allowed){video.currentTime=Math.max(0,allowed-1);logLearningActivity({eventType:"invalid_seek",accountId:session.accountId,courseId:item.courseId,contentId:item.id});showLearningWarning(lt("invalidSeek"));}});video.addEventListener("timeupdate",()=>{if(document.hidden||video.paused||video.seeking||video.readyState<3)return;if(video.muted||video.volume<(item.completionRule?.minimumVolume||.1)){video.pause();showLearningWarning(lt("enableSound"));return;}const delta=Math.max(0,Math.min(1.5,video.currentTime-last));last=video.currentTime;if(!delta)return;const state=getContentProgress(session.accountId,item.courseId).find(x=>x.contentId===item.id);const watched=Number(state?.activeSeconds||0)+delta;const duration=video.duration||item.minimumDurationSeconds||1;const pct=Math.min(100,Math.round(watched/duration*100));saveContentProgress({accountId:session.accountId,courseId:item.courseId,contentId:item.id,contentType:"video",activeSeconds:watched,completionPercent:pct,completed:pct>=(item.completionRule?.requiredPercent||90),metadata:{furthestAllowedTime:Math.max(Number(state?.metadata?.furthestAllowedTime||0),video.currentTime),durationSeconds:duration}});});}
  if(item.sourceType==="youtube"&&item.youtubeVideoId){initYoutubeTracking(item.courseId,item.id,session.accountId,item.youtubeVideoId,item.completionRule?.requiredPercent??90);}
}
function recordRapidAdvance(viewer){if(!viewer)return;const stage=document.querySelector(".lesson-stage");const item=getCourseContent(stage.dataset.courseId).find(x=>x.id===stage.dataset.contentId);const state=getContentProgress(session.accountId,item.courseId).find(x=>x.contentId===item.id);const slide=item.slides[activeSlideIndex];const slides={...(state?.metadata?.slides||{})};const prior=slides[slide.id]||{viewedSeconds:0,completed:false,rapidAdvanceAttempts:0};prior.rapidAdvanceAttempts=(prior.rapidAdvanceAttempts||0)+1;slides[slide.id]=prior;saveContentProgress({accountId:session.accountId,courseId:item.courseId,contentId:item.id,contentType:"slide",metadata:{slides}});logLearningActivity({eventType:"rapid_advance_attempt",accountId:session.accountId,courseId:item.courseId,contentId:item.id,metadata:{slideId:slide.id,count:prior.rapidAdvanceAttempts}});showLearningWarning(prior.rapidAdvanceAttempts>=3?lt("rapidWarningLogged"):lt("rapidWarning"));}
function showLearningWarning(message){const el=document.getElementById("learning-warning");if(el)el.textContent=message;else toast(message);}
document.addEventListener("visibilitychange",()=>{const stage=document.querySelector(".lesson-stage");if(document.hidden){if(stage){blurStartedAt=Date.now();document.getElementById("course-video")?.pause();if(_ytWatchStart!==null){try{_ytWatchRanges.push({start:_ytWatchStart,end:youtubePlayer?.getCurrentTime()||_ytWatchStart});}catch{}  _ytWatchStart=null;ytFlushRanges(false);}logLearningActivity({eventType:"tab_hidden",accountId:session.accountId,courseId:stage.dataset.courseId,contentId:stage.dataset.contentId,metadata:{durationSeconds:0}});}return;}sendActivityHeartbeat();if(stage)showLearningWarning(lt("pausedOnLeave"));});
window.addEventListener("blur",()=>{blurStartedAt=Date.now();document.getElementById("course-video")?.pause();});

function liveDeleteModal() {
  if (!liveDeleteState.flowId) return "";
  return `<div class="modal-backdrop open" id="liveDeleteModal" role="dialog" aria-modal="true" aria-labelledby="liveDeleteTitle">
    <section class="shared-dialog">
      <div class="shared-dialog__header">
        <div class="shared-dialog__icon shared-dialog__icon--warning" aria-hidden="true">⚠</div>
        <div class="shared-dialog__content">
          <h2 id="liveDeleteTitle">Xóa hành trình?</h2>
          <p>Thao tác này sẽ xóa vĩnh viễn:</p>
          <ul style="margin:8px 0 8px 16px;line-height:1.7">
            <li>Hành trình <strong>${escapeHtml(liveDeleteState.flowTitle)}</strong></li>
            <li>Toàn bộ danh sách người tham gia và tiến độ</li>
            <li>Liên kết public — người đang truy cập sẽ gặp lỗi tức thì</li>
          </ul>
          <p><strong>Không thể hoàn tác.</strong></p>
          ${liveDeleteState.error ? `<p class="field-error" style="margin-top:8px">${escapeHtml(liveDeleteState.error)}</p>` : ""}
        </div>
      </div>
      <div class="shared-dialog__footer">
        <button class="btn btn-outline" id="liveDeleteCancel" ${liveDeleteState.loading ? "disabled" : ""}>Hủy</button>
        <button class="btn btn-danger" id="liveDeleteConfirm" ${liveDeleteState.loading ? "disabled" : ""}>${liveDeleteState.loading ? "Đang xóa…" : "Xóa hành trình"}</button>
      </div>
    </section>
  </div>`;
}

function liveStatusBadge(value) {
  const cls = value === "open" || value === "live" || value ? "done" : "pending";
  const text = value === "open" ? "Mở" : value === "closed" ? "Đóng" : value === "live" ? "Live" : value === "draft" ? "Draft" : value || "—";
  return `<span class="badge ${cls}">${escapeHtml(text)}</span>`;
}

function adminLiveTrainingPage() {
  const rows = (liveTrainingState.flows || []).filter((f) => !liveTrainingState.search || String(f.title || "").toLowerCase().includes(liveTrainingState.search.toLowerCase()));
  const createForm = liveTrainingState.createOpen ? `<section class="ui-card live-training-form"><div class="ui-card-header"><h2>${liveT("create")}</h2><button class="icon-btn" data-live-create-close aria-label="Close">x</button></div>
    <form id="liveTrainingCreateForm" class="form-grid">
      <div class="field"><label>${liveT("sessionTitle")}</label><input name="title" required maxlength="180"></div>
      <div class="field span-2"><label>${liveT("description")}</label><textarea name="description" rows="3"></textarea></div>
      <div class="field"><label>${liveT("pretestUrl")}</label><input name="pretestUrl" type="url" placeholder="https://quizizz.com/..."></div>
      <div class="field"><label>${liveT("posttestUrl")}</label><input name="posttestUrl" type="url" placeholder="https://quizizz.com/..."></div>
      <div class="field"><label>${liveT("evaluationUrl")}</label><input name="evaluationUrl" type="url" placeholder="https://forms.gle/..."></div>
      <label class="setting-row"><span>Pre-test ${liveT("required")}</span><input name="pretestRequired" type="checkbox" checked></label>
      <label class="setting-row"><span>Post-test ${liveT("required")}</span><input name="posttestRequired" type="checkbox" checked></label>
      <label class="setting-row"><span>${liveT("evaluation")} ${liveT("required")}</span><input name="evaluationRequired" type="checkbox" checked></label>
      <div class="field"><label>Hết hạn</label><input name="expiresAt" type="datetime-local"></div>
      <p class="field-help span-2">${liveT("duplicateNote")}</p>
      <div class="span-2"><button class="btn btn-primary" type="submit">${liveT("create")}</button></div>
      <p class="field-error span-2" data-live-create-error></p>
    </form></section>` : "";
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D", liveT("title"), "hr")}<div class="content route-content live-training-page">
    <section class="page-header"><div><h1>${liveT("title")}</h1><p>${liveT("liveNote")}</p></div><button class="btn btn-primary" data-live-create-open>${liveT("create")}</button></section>
    ${createForm}
    <section class="ui-card"><div class="table-tools"><input data-live-search placeholder="${t("admin.search")}" value="${escapeHtmlAttribute(liveTrainingState.search)}"><button class="btn btn-outline" data-live-reload>${liveTrainingState.loading ? "Đang tải..." : "Làm mới"}</button></div>
    ${liveTrainingState.error ? `<div class="ui-error">${escapeHtml(liveTrainingState.error)}</div>` : ""}
    <div class="table-wrap"><table class="data-table"><thead><tr><th>${liveT("sessionTitle")}</th><th>Trạng thái</th><th>Ngày tạo</th><th>Hết hạn</th><th>Pre-test</th><th>Post-test</th><th>${liveT("evaluation")}</th><th>Người tham gia</th><th>${t("admin.action")}</th></tr></thead><tbody>
      ${rows.map((f) => `<tr><td><strong>${escapeHtml(f.title)}</strong></td><td>${liveStatusBadge(f.status)}</td><td>${formatDateTime(f.created_at)}</td><td>${f.expires_at ? formatDateTime(f.expires_at) : "—"}</td><td>${liveStatusBadge(f.pretest_state)}</td><td>${liveStatusBadge(f.posttest_state)}</td><td>${liveStatusBadge(f.evaluation_state)}</td><td>${f.participant_count || 0} / ${f.completed_count || 0}</td><td><div class="row-actions"><a class="btn btn-outline mini-action" href="/admin/live-training/${f.id}" data-link>${liveT("manage")}</a><button class="btn btn-outline mini-action" data-copy-live-link="${escapeHtmlAttribute(f.publicLink || "")}">${liveT("copyLink")}</button><button class="btn btn-outline mini-action" data-live-close="${f.id}">Đóng phiên</button><button class="btn btn-danger mini-action" data-live-delete="${f.id}" data-live-delete-title="${escapeHtmlAttribute(f.title)}">Xóa</button></div></td></tr>`).join("") || `<tr><td colspan="9"><div class="ui-empty">${liveTrainingState.loading ? "Đang tải..." : "Chưa có hành trình."}</div></td></tr>`}
    </tbody></table></div></section></div></main></div>${liveDeleteModal()}`;
}

function adminLiveTrainingDetailPage() {
  const id = route.split("/")[3];
  const f = liveTrainingState.detail;
  if (!f || f.id !== id) return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D", liveT("title"), "hr")}<div class="content"><div class="ui-skeleton ui-skeleton--block"></div></div></main></div>`;
  const control = (step, label) => {
    const state = f[`${step}_state`];
    const counts = f.step_counts || {};
    const started = counts[`${step}Started`] || 0;
    const completed = counts[`${step}Completed`] || 0;
    return `<article class="ui-card live-control"><div><h3>${label}</h3><p>${escapeHtml(f[`${step}_url`] || liveT("missingUrl"))}</p></div><div>${liveStatusBadge(state)}<small>${started} đã bắt đầu · ${completed} tự xác nhận</small></div><button class="btn btn-outline" data-live-step="${step}" data-live-state="${state === "open" ? "closed" : "open"}">${state === "open" ? liveT("closeStep") : liveT("openStep")}</button></article>`;
  };
  const participants = (liveTrainingState.participants || []).filter((p) => !liveTrainingState.search || p.displayName.toLowerCase().includes(liveTrainingState.search.toLowerCase()));
  return `<div class="app-layout">${sideNav("hr")}<main class="app-main">${topbar("HR / L&D", f.title, "hr")}<div class="content route-content live-training-page">
    <a class="btn btn-ghost" href="/admin/live-training" data-link>← ${liveT("title")}</a>
    <section class="page-header"><div><h1>${escapeHtml(f.title)}</h1><p>${escapeHtml(f.description || "")}</p></div><div class="row-actions"><button class="btn btn-outline" data-copy-live-link="${escapeHtmlAttribute(f.publicLink || "")}">${liveT("copyLink")}</button><button class="btn btn-outline" data-live-rotate="${f.id}">Rotate link</button><button class="btn btn-danger" data-live-delete="${f.id}" data-live-delete-title="${escapeHtmlAttribute(f.title)}">Xóa hành trình</button></div></section>
    <p class="field-help">${liveT("liveNote")}</p><p class="field-help">${liveT("duplicateNote")}</p>
    <form id="liveTrainingUpdateForm" class="ui-card form-grid">
      <div class="field"><label>${liveT("sessionTitle")}</label><input name="title" value="${escapeHtmlAttribute(f.title)}" required></div>
      <div class="field"><label>Public link</label><input value="${escapeHtmlAttribute(f.publicLink || "")}" readonly></div>
      <div class="field span-2"><label>${liveT("description")}</label><textarea name="description" rows="2">${escapeHtml(f.description || "")}</textarea></div>
      <div class="field"><label>${liveT("pretestUrl")}</label><input name="pretestUrl" value="${escapeHtmlAttribute(f.pretest_url || "")}"></div>
      <div class="field"><label>${liveT("posttestUrl")}</label><input name="posttestUrl" value="${escapeHtmlAttribute(f.posttest_url || "")}"></div>
      <div class="field"><label>${liveT("evaluationUrl")}</label><input name="evaluationUrl" value="${escapeHtmlAttribute(f.evaluation_url || "")}"></div>
      <label class="setting-row"><span>Pre-test ${liveT("required")}</span><input name="pretestRequired" type="checkbox" ${f.pretest_required ? "checked" : ""}></label>
      <label class="setting-row"><span>Post-test ${liveT("required")}</span><input name="posttestRequired" type="checkbox" ${f.posttest_required ? "checked" : ""}></label>
      <label class="setting-row"><span>${liveT("evaluation")} ${liveT("required")}</span><input name="evaluationRequired" type="checkbox" ${f.evaluation_required ? "checked" : ""}></label>
      <div class="field span-2" style="border-top:1px solid var(--line);padding-top:16px;margin-top:4px"><strong>${liveT("speakerLabel")}</strong></div>
      <div class="field"><label>Tên diễn giả</label><input name="speakerName" value="${escapeHtmlAttribute(f.speaker_name || "")}"></div>
      <div class="field"><label>Chức danh</label><input name="speakerTitle" value="${escapeHtmlAttribute(f.speaker_title || "")}"></div>
      <div class="field"><label>Tổ chức</label><input name="speakerOrg" value="${escapeHtmlAttribute(f.speaker_org || "")}"></div>
      <div class="field"><label>Ảnh diễn giả (URL)</label><input name="speakerPhotoUrl" type="url" value="${escapeHtmlAttribute(f.speaker_photo_url || "")}"></div>
      <div class="field span-2"><label>Giới thiệu diễn giả</label><textarea name="speakerBio" rows="3">${escapeHtml(f.speaker_bio || "")}</textarea></div>
      <div class="span-2"><button class="btn btn-primary" type="submit">Lưu</button></div><p class="field-error span-2" data-live-update-error></p>
    </form>
    <section class="live-controls">${control("pretest", liveT("pretest"))}${control("posttest", liveT("posttest"))}${control("evaluation", liveT("evaluation"))}${control("completion", liveT("completion"))}</section>
    <section class="ui-card"><div class="table-tools"><input data-live-search placeholder="Tìm theo tên" value="${escapeHtmlAttribute(liveTrainingState.search)}"><button class="btn btn-outline" data-live-detail-reload>Làm mới</button></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>${liveT("fullName")}</th><th>Tham gia</th><th>Gần nhất</th><th>Pre</th><th>Post</th><th>${liveT("evaluation")}</th><th>${liveT("completion")}</th><th>${t("admin.action")}</th></tr></thead><tbody>
      ${participants.map((p) => `<tr><td>${escapeHtml(p.displayName)}</td><td>${formatDateTime(p.createdAt)}</td><td>${formatDateTime(p.lastSeenAt)}</td><td>${p.pretestCompletedAt ? liveT("done") : p.pretestStartedAt ? liveT("started") : "—"}</td><td>${p.posttestCompletedAt ? liveT("done") : p.posttestStartedAt ? liveT("started") : "—"}</td><td>${p.evaluationCompletedAt ? liveT("done") : p.evaluationStartedAt ? liveT("started") : "—"}</td><td>${p.completedAt ? liveT("done") : "—"}</td><td><div class="row-actions"><button class="btn btn-outline mini-action" data-live-participant="${p.id}" data-field="pretestCompleted">Pre ✓</button><button class="btn btn-outline mini-action" data-live-participant="${p.id}" data-field="posttestCompleted">Post ✓</button><button class="btn btn-outline mini-action" data-live-participant="${p.id}" data-field="evaluationCompleted">${liveT("evaluation")} ✓</button><button class="btn btn-outline mini-action" data-live-participant="${p.id}" data-field="completed">${liveT("completion")}</button><button class="btn btn-outline mini-action" data-live-participant-reset="${p.id}">Reset</button></div></td></tr>`).join("") || `<tr><td colspan="8"><div class="ui-empty">Chưa có người tham gia.</div></td></tr>`}
      </tbody></table></div></section>
    <section class="ui-card live-roster-section">
      <h2 style="margin:0 0 16px;font-size:18px">${liveT("rosterTitle")} <span style="font-weight:400;font-size:14px;color:var(--muted)">(${liveTrainingState.roster.length} ${liveT("required").toLowerCase()})</span></h2>
      <div class="live-roster-dropzone" id="liveRosterDropzone" tabindex="0" role="button" aria-label="Tải lên file Excel/CSV">
        <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <p>Kéo thả file .xlsx / .csv vào đây hoặc <label style="color:var(--primary);cursor:pointer;text-decoration:underline" for="liveRosterFileInput">chọn file</label></p>
        <input type="file" id="liveRosterFileInput" accept=".xlsx,.xls,.csv" style="display:none">
      </div>
      ${liveTrainingState.rosterParsed ? (() => {
        const p = liveTrainingState.rosterParsed;
        return `<div style="margin-top:16px"><p class="live-roster-stats"><strong>${p.valid}</strong> hợp lệ · <strong>${p.duplicates}</strong> trùng · <strong>${p.skipped}</strong> bỏ qua</p>
        <div style="margin:10px 0;display:flex;gap:12px;align-items:center"><label style="font-size:14px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="rosterMode" value="replace" ${liveTrainingState.rosterReplaceMode ? "checked" : ""}> ${liveT("replaceRoster")}</label><label style="font-size:14px;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="radio" name="rosterMode" value="append" ${!liveTrainingState.rosterReplaceMode ? "checked" : ""}> ${liveT("appendRoster")}</label></div>
        <div class="table-wrap" style="max-height:280px;overflow:auto"><table class="live-roster-preview-table"><thead><tr><th>#</th><th>Họ và tên</th><th>Phòng ban</th><th>Địa điểm</th><th>Hình thức</th></tr></thead><tbody>${p.records.slice(0,50).map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.fullName)}</td><td>${escapeHtml(r.department||"")}</td><td>${escapeHtml(r.location||"")}</td><td>${escapeHtml(r.mode||"")}</td></tr>`).join("")}${p.records.length>50?`<tr><td colspan="5" style="text-align:center;color:var(--muted)">... và ${p.records.length-50} dòng nữa</td></tr>`:""}</tbody></table></div>
        <button class="btn btn-primary" style="margin-top:14px" id="liveRosterSaveBtn">${liveT("saveRoster")}</button></div>`;
      })() : ""}
      ${liveTrainingState.roster.length > 0 ? `<div style="margin-top:24px"><div class="table-tools" style="margin-bottom:8px"><input placeholder="Tìm trong danh sách..." data-live-roster-search value="${escapeHtmlAttribute(liveTrainingState.rosterSearch)}"><button class="btn btn-danger" style="margin-left:auto" data-live-roster-clear>🗑 ${liveT("clearRoster")}</button></div><div class="table-wrap" style="max-height:360px;overflow:auto"><table class="live-roster-preview-table"><thead><tr><th>#</th><th>Họ và tên</th><th>Phòng ban</th><th>Địa điểm</th><th>Hình thức</th><th></th></tr></thead><tbody>${(liveTrainingState.rosterSearch ? liveTrainingState.roster.filter(r=>r.full_name.toLowerCase().includes(liveTrainingState.rosterSearch.toLowerCase())) : liveTrainingState.roster).map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.full_name)}</td><td>${escapeHtml(r.department||"")}</td><td>${escapeHtml(r.location||"")}</td><td>${escapeHtml(r.mode||"")}</td><td><button class="btn btn-danger mini-action" data-live-roster-delete="${escapeHtmlAttribute(r.id)}">Xóa</button></td></tr>`).join("")}</tbody></table></div></div>` : ""}
    </section>
    </div></main></div>${liveDeleteModal()}`;
}

function publicTrainingPage(accessToken) {
  const bs = publicTrainingState.bootstrap;
  if (bs === "unknown" || (publicTrainingState.token !== accessToken)) {
    queueMicrotask(() => fetchPublicTrainingInitial(accessToken));
    publicTrainingState.bootstrap = "loadingFlow";
  }
  const f = publicTrainingState.flow;
  const p = publicTrainingState.participant;

  const header = `<header class="pub-hdr"><a href="/" data-link class="pub-logo-link" aria-label="KIS Vietnam"><img src="/assets/kis-logo-white.png" alt="KIS Vietnam" class="pub-logo"></a><div class="pub-lang-wrap">${languageSwitcher()}</div></header>`;

  let content;
  if (bs === "loadingFlow" || bs === "unknown") {
    content = `<div class="pub-card pub-skeleton-card" aria-busy="true"><div class="ui-skeleton" style="height:22px;width:55%;border-radius:6px;margin-bottom:10px"></div><div class="ui-skeleton" style="height:14px;width:35%;border-radius:6px"></div></div>`;
  } else if (bs === "checkingParticipant") {
    content = `<div class="pub-card pub-skeleton-card" aria-busy="true" aria-live="polite"><p class="pub-resuming">${liveT("resuming")}</p>${f ? `<p class="pub-session-title-sm">${escapeHtml(f.title)}</p>` : ""}<div class="ui-skeleton" style="height:14px;width:40%;border-radius:6px;margin-top:12px"></div></div>`;
  } else if (bs === "networkError") {
    content = `<div class="pub-card"><p class="pub-resuming">${liveT("networkError")}</p><button class="btn btn-primary" data-public-retry style="margin-top:14px">${liveT("retry")}</button></div>`;
  } else if (bs === "error") {
    const err = publicTrainingState.error || f?.error || "";
    const errText = err === "FLOW_EXPIRED" ? liveT("expiredLink") : err === "FLOW_CLOSED" ? liveT("closedFlow") : liveT("invalidLink");
    content = `<div class="pub-card pub-error-card"><h1>${errText}</h1></div>`;
  } else if (bs === "needsName") {
    const hasRoster = publicTrainingState.roster && publicTrainingState.roster.length > 0;
    const outsideRoster = publicTrainingState.outsideRoster;
    let namePickerHtml;
    if (hasRoster && !outsideRoster) {
      const rSearch = publicTrainingState.rosterSearch || "";
      const filtered = rSearch ? publicTrainingState.roster.filter((r) => r.fullName.toLowerCase().normalize("NFKC").includes(rSearch.toLowerCase().normalize("NFKC")) || (r.department || "").toLowerCase().includes(rSearch.toLowerCase())) : publicTrainingState.roster;
      const dropItems = filtered.map((r) => `<button type="button" class="pub-roster-item" data-roster-id="${escapeHtmlAttribute(r.id)}" data-roster-name="${escapeHtmlAttribute(r.fullName)}"><span class="pub-roster-name">${escapeHtml(r.fullName)}</span>${r.department || r.location || r.mode ? `<span class="pub-roster-meta">${[r.department, r.location, r.mode].filter(Boolean).map(escapeHtml).join(" · ")}</span>` : ""}</button>`).join("");
      namePickerHtml = `<div class="pub-roster-wrap"><label class="pub-roster-label">${liveT("selectName")}</label><div class="pub-roster-search-wrap"><input id="publicRosterSearch" class="pub-roster-search" placeholder="${escapeHtmlAttribute(liveT("searchName"))}" value="${escapeHtmlAttribute(rSearch)}" autocomplete="off" aria-autocomplete="list" aria-controls="pubRosterList"><svg class="pub-roster-search-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div><div class="pub-roster-list" id="pubRosterList" role="listbox">${dropItems}<button type="button" class="pub-roster-item pub-roster-not-listed" data-roster-not-listed>${liveT("notOnList")}</button></div><p class="pub-roster-hint">${liveT("nameHint")}</p></div>`;
    } else {
      namePickerHtml = `<div class="field">${hasRoster ? `<button type="button" class="btn btn-ghost" style="margin-bottom:10px;font-size:13px" data-roster-back>← ${liveT("backToList")}</button>` : ""}<label for="publicTrainingName">${liveT("fullName")}</label><input id="publicTrainingName" name="displayName" value="${escapeHtmlAttribute(publicTrainingState.name)}" required maxlength="120" autocomplete="name" aria-required="true"><small>${liveT("nameHint")}</small></div>`;
    }
    content = `<div class="pub-card pub-join-card"><h1 class="pub-session-title">${escapeHtml(f?.title || "")}</h1>${f?.description ? `<p class="pub-session-desc">${escapeHtml(f.description)}</p>` : ""}<form id="publicTrainingJoinForm">${namePickerHtml}${!hasRoster || outsideRoster ? `<button class="btn btn-primary" type="submit" style="width:100%;min-height:48px">${publicTrainingState.joining ? liveT("resuming").replace("…", "") : liveT("start")}</button>` : ""}<p class="field-error" role="alert">${escapeHtml(publicTrainingState.error || "")}</p></form></div>`;
  } else {
    // ready or completed
    const stepCard = (step, label, openLabel, doneLabel) => {
      const s = publicTrainingState.steps?.[step] || {};
      const started = p?.[`${step}StartedAt`];
      const done = p?.[`${step}CompletedAt`];
      const status = done ? liveT("done") : started ? liveT("started") : !s.required ? liveT("optional") : s.state === "open" ? liveT("available") : liveT("notOpen");
      const body = s.state !== "open" ? `<span class="pub-step-wait">${liveT("waitingNamed").replace("{step}", label)}</span>` : !s.url ? `<span class="pub-step-wait">${liveT("missingUrl")}</span>` : `<button class="btn btn-primary" data-public-step-start="${step}">${openLabel}</button>${started ? `<button class="btn btn-outline" data-public-step-complete="${step}" ${done ? "disabled" : ""}>${doneLabel}</button>` : ""}`;
      return `<article class="public-step ${done ? "is-done" : ""}"><div><h2>${label}</h2><span class="pub-step-badge">${status}</span></div><div class="pub-step-actions">${body}</div></article>`;
    };
    const completionOpen = publicTrainingState.completionEligible;
    const speakerCard = f.speaker_name ? `<div class="pub-card pub-speaker-card"><div class="pub-speaker-inner">${f.speaker_photo_url ? `<img class="pub-speaker-photo" src="${escapeHtmlAttribute(f.speaker_photo_url)}" alt="${escapeHtmlAttribute(f.speaker_name)}" loading="lazy">` : `<div class="pub-speaker-initials" aria-hidden="true">${escapeHtml(f.speaker_name.trim().split(/\s+/).map(w=>w[0]).slice(-2).join("").toUpperCase())}</div>`}<div class="pub-speaker-info"><strong class="pub-speaker-name">${escapeHtml(f.speaker_name)}</strong>${f.speaker_title ? `<span class="pub-speaker-title">${escapeHtml(f.speaker_title)}</span>` : ""}${f.speaker_org ? `<span class="pub-speaker-org">${escapeHtml(f.speaker_org)}</span>` : ""}${f.speaker_bio ? `<p class="pub-speaker-bio">${escapeHtml(f.speaker_bio)}</p>` : ""}</div></div></div>` : "";
    content = `<div class="pub-journey"><div class="pub-journey-header"><div class="pub-journey-meta"><h1 class="pub-session-title">${escapeHtml(f.title)}</h1>${f.description ? `<p class="pub-session-desc">${escapeHtml(f.description)}</p>` : ""}${speakerCard}<span class="pub-participant-name">${escapeHtml(p.displayName)}</span></div><button class="btn btn-outline pub-switch-btn" data-public-switch aria-label="${liveT("switchParticipant")}">${liveT("switchParticipant")}</button></div>${p.completedAt ? `<div class="pub-card pub-done-card"><h2>${liveT("completed")}</h2><p class="pub-done-time">${formatDateTime(p.completedAt)}</p></div>` : `<section class="pub-stepper" aria-label="${liveT("title")}">${stepCard("pretest", liveT("pretest"), liveT("doPretest"), liveT("donePretest"))}${stepCard("posttest", liveT("posttest"), liveT("doPosttest"), liveT("donePosttest"))}${stepCard("evaluation", liveT("evaluation"), liveT("openEvaluation"), liveT("doneEvaluation"))}<article class="public-step ${completionOpen ? "is-open" : ""}"><div><h2>${liveT("completion")}</h2><span class="pub-step-badge">${completionOpen ? liveT("available") : liveT("waiting")}</span></div><div class="pub-step-actions">${completionOpen ? `<button class="btn btn-success" data-public-complete>${liveT("completion")}</button>` : `<span class="pub-step-wait">${liveT("waiting")}</span>`}</div></article></section>`}</div>`;
  }

  return `<div class="public-outer"><div class="pub-bg" aria-hidden="true"></div><div class="pub-ov" aria-hidden="true"></div>${header}<main class="pub-main" ${bs === "checkingParticipant" ? 'aria-busy="true"' : ""}>${content}</main></div>`;
}

function render() {
  const _af = document.activeElement;
  const _afId = _af?.id || "";
  const _afKey = _af?.dataset?.focusKey || "";
  const _afSel = [_af?.selectionStart ?? null, _af?.selectionEnd ?? null];

  route = location.pathname.replace(/\/$/, "") || "/";
  document.body.dataset.route = route;
  let robotsMeta = document.querySelector('meta[name="robots"]');
  if (route.startsWith("/join/")) {
    if (!robotsMeta) {
      robotsMeta = document.createElement("meta");
      robotsMeta.name = "robots";
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.content = "noindex, nofollow";
  } else if (robotsMeta?.content === "noindex, nofollow") {
    robotsMeta.remove();
  }
  if (!route.startsWith("/join/")) clearTimeout(publicTrainingState.pollTimer);
  session = sessionService.getValidSession();
  const routeParams = new URLSearchParams(location.search);
  selectedLoginRole = routeParams.get("role") || selectedLoginRole;
  const returnTo = routeParams.get("returnTo") || "";
  if (route === "/login" && returnTo && sessionService.canRedirectTo(returnTo)) {
    sessionService.setPostLoginRedirect(returnTo);
  }
  if ((route.startsWith("/dashboard") || route.startsWith("/attendance/scan")) && !session) {
    sessionService.setPostLoginRedirect(currentPathWithQuery());
  }
  if (route.startsWith("/admin") && !session) {
    sessionService.setPostLoginRedirect(currentPathWithQuery());
  }
  if (route === "/change-password" && (!session || !session.supabaseAccessToken)) {
    sessionService.setPostLoginRedirect("/change-password");
    sessionService.endSession();
    route = "/login";
    history.replaceState({}, "", "/login?returnTo=/change-password");
    session = null;
  }
  if (route === "/admin/assign" && assignRouteSearch !== location.search) {
    assignRouteSearch = location.search;
    assignCourseId = routeParams.get("courseId") || "";
    assignTargetCourseId = routeParams.get("courseId") || "";
    assignTargetAccountId = routeParams.get("accountId") || "";
    assignModalOpen = routeParams.get("open") === "1";
  }
  if (route !== "/admin/assign") assignRouteSearch = null;
  if (route === "/admin/reports" && reportRouteSearch !== location.search) {
    reportRouteSearch = location.search;
    readReportUrl(routeParams);
    reportData = null;
    reportLoadedKey = "";
  }
  if (route !== "/admin/reports") reportRouteSearch = null;
  document.documentElement.lang = language;
  if (route === "/admin/courses" && app.querySelector("#courseSearchInput") && !courseDrawerOpen && !courseFormMode && !contentBuilderMode) {
    renderCourseResults();
    document.body.classList.toggle("nav-open", mobileNavOpen);
    document.body.classList.toggle("modal-open", !!(mobileNavOpen || dialogState || notificationModalOpen));
    return;
  }
  if (route === "/admin/employees" && app.querySelector("#employeeDirSearch") && !employeeEditOpen && !certModalOpen && !accountDrawerOpen && !resetModalOpen) {
    renderEmployeeDirectoryResults();
    return;
  }
  if (route === "/admin/training-tracking" && app.querySelector("[data-tt-search]") && !_ttDrawerOpen && !_ttFormOpen) {
    renderTrainingTrackingResults();
    return;
  }
  if (route === "/admin/cchn-registrations" && app.querySelector("[data-cchn-search]") && !_cchnDrawerOpen && !_cchnFormOpen && !_cchnAddItemOpen) {
    renderCchnRegistrationResults();
    return;
  }
  if (route === "/admin/audit-log" && app.querySelector("[data-audit-filter] input[name='search']") && !auditState.detail && !auditState.detailLoading) {
    return;
  }
  if (route.startsWith("/join/")) app.innerHTML = publicTrainingPage(decodeURIComponent(route.split("/").pop() || ""));
  else if (route === "/") app.innerHTML = landingPage();
  else if (route === "/about-kis") app.innerHTML = aboutPage();
  else if (route === "/login") app.innerHTML = loginPage();
  else if (route === "/attendance/scan") app.innerHTML = attendanceScanPage(routeParams.get("token") || "");
  else if (route === "/dashboard") {
    if (session && (!_courses || _coursesAccountId !== session.accountId) && !_coursesLoading) {
      fetchCoursesFromApi(session.accountId, session.role);
    }
    if (session && session.role === "employee" && (!_enrollments || _enrollmentsAccountId !== session.accountId) && !_enrollmentsLoading) {
      fetchEnrollmentsFromApi(session.accountId, "employee");
    }
    if (session && session.role === "employee" && _offlineTrainingLoadedFor !== session.accountId) {
      fetchEmployeeTrainingTime(session.accountId);
    }
    if (hasEmployeeAccess()) {
      try {
        app.innerHTML = employeeDashboard(false);
      } catch (err) {
        console.error("[render] employeeDashboard error:", err);
        notificationModalOpen = false;
        const errMsg = String(err?.message || err || "unknown");
        app.innerHTML = `<div class="app-layout"><main class="app-main"><div class="content"><div class="card empty-state" style="margin:2rem auto;max-width:480px"><h2>Không thể tải trang</h2><p>Đã xảy ra lỗi khi hiển thị dashboard. Vui lòng thử lại.</p><details style="margin:1rem 0;text-align:left"><summary style="cursor:pointer;font-size:.85em;color:#666">Chi tiết lỗi (debug)</summary><pre style="font-size:.75em;overflow:auto;max-height:120px;background:#f5f5f5;padding:.5rem;border-radius:4px">${escapeHtml(errMsg)}</pre></details><div style="display:flex;gap:1rem;justify-content:center;margin-top:1rem"><button class="btn btn-primary" onclick="location.reload()">Tải lại</button><button class="btn btn-outline" onclick="(()=>{window.__mykisSessionService?.endSession();location.href='/login';})()">Đăng xuất</button></div></div></div></main></div>`;
      }
    } else {
      app.innerHTML = session ? restrictedPage() : loginPage();
    }
  }
  else if (route === "/dashboard/courses") {
    if (session && (!_courses || _coursesAccountId !== session.accountId) && !_coursesLoading) {
      fetchCoursesFromApi(session.accountId, session.role);
    }
    if (session && session.role === "employee" && (!_enrollments || _enrollmentsAccountId !== session.accountId) && !_enrollmentsLoading) {
      fetchEnrollmentsFromApi(session.accountId, "employee");
    }
    app.innerHTML = hasEmployeeAccess() ? myCoursesPage() : session ? restrictedPage() : loginPage();
  }
  else if (route.startsWith("/dashboard/courses/")) app.innerHTML = coursePlayerPage(decodeURIComponent(route.split("/").pop()));
  else if (route === "/dashboard/quizzes") app.innerHTML = hasEmployeeAccess() ? employeeQuizzesPage() : session ? restrictedPage() : loginPage();
  else if (route === "/dashboard/gallery") app.innerHTML = galleryPageV2();
  else if (route.startsWith("/dashboard/gallery/")) app.innerHTML = galleryPageV2(decodeURIComponent(route.split("/").pop()));
  else if (route === "/dashboard/resources") app.innerHTML = employeeResourcesPage();
  else if (route === "/dashboard/history") { history.replaceState({}, "", "/dashboard/learning-history"); route="/dashboard/learning-history"; app.innerHTML = learningHistoryPage(); }
  else if (route === "/dashboard/learning-history") app.innerHTML = learningHistoryPage();
  else if (route === "/dashboard/certificates") {
    if (hasEmployeeAccess()) { if (!_certMy.loading) loadMyCertificates(); app.innerHTML = myCertificatesPage(); }
    else app.innerHTML = session ? restrictedPage() : loginPage();
  }
  else if (route === "/dashboard/calendar") {
    // Trigger async fetch if: no data yet, account changed, or cache older than 60s
    const calendarStale = Date.now() - _calendarLoadedAt > 60_000;
    if (session && (!_calendarEvents || _calendarAccountId !== session.accountId || calendarStale) && !_calendarLoading) {
      fetchCalendarEvents(session.accountId); // async, triggers re-render on completion
    }
    app.innerHTML = learningCalendarPageV3();
  }
  else if (route === "/admin") {
    if (hasAdminAccess() && (!_hrOverview || Date.now() - _hrOverviewLoadedAt > 30_000) && !_hrOverviewLoading) {
      fetchHrOverview({ silent: Boolean(_hrOverview) });
    }
    app.innerHTML = hasAdminAccess() ? adminDashboard(false) : session ? restrictedPage() : loginPage();
  }
  else if (route === "/admin/employees") app.innerHTML = employeesPage();
  else if (route === "/admin/accounts") app.innerHTML = accountsPage();
  else if (route === "/admin/courses") {
    if (session && (!_courses || _coursesAccountId !== session.accountId) && !_coursesLoading) {
      fetchCoursesFromApi(session.accountId, session.role);
    }
    app.innerHTML = hasAdminAccess() ? coursesPage() : session ? restrictedPage() : loginPage();
  }
  else if (route.startsWith("/admin/courses/")) {
    const courseId = decodeURIComponent(route.split("/").pop());
    if (session && (!_courses || _coursesAccountId !== session.accountId) && !_coursesLoading) {
      fetchCoursesFromApi(session.accountId, session.role);
    }
    app.innerHTML = hasAdminAccess() ? courseDetailPage(courseId) : session ? restrictedPage() : loginPage();
  }
  else if (route === "/admin/assign") {
    if (session && (!_courses || _coursesAccountId !== session.accountId) && !_coursesLoading) {
      fetchCoursesFromApi(session.accountId, session.role);
    }
    app.innerHTML = hasAdminAccess() ? assignPage() : session ? restrictedPage() : loginPage();
  }
  else if (route === "/admin/quizzes") app.innerHTML = hasAdminAccess() ? adminQuizzesPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/notifications") app.innerHTML = hasAdminAccess() ? notificationsPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/retraining") app.innerHTML = hasAdminAccess() ? retrainingPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/competencies") app.innerHTML = hasAdminAccess() ? adminCompetenciesPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/skills-matrix") app.innerHTML = hasAdminAccess() ? adminSkillsMatrixPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/development-plans") app.innerHTML = hasAdminAccess() ? adminDevelopmentPlansPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/reports") app.innerHTML = hasAdminAccess() ? reportsPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/training-tracking") app.innerHTML = hasAdminAccess() ? trainingTrackingPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/live-training") {
    if (hasAdminAccess() && !liveTrainingState.loading && !liveTrainingState.flows.length) loadLiveTrainingList();
    app.innerHTML = hasAdminAccess() ? adminLiveTrainingPage() : session ? restrictedPage() : loginPage();
  }
  else if (route.startsWith("/admin/live-training/")) {
    const id = route.split("/")[3];
    if (hasAdminAccess() && id && !liveTrainingState.detailLoading && liveTrainingState.detail?.id !== id) loadLiveTrainingDetail(id);
    app.innerHTML = hasAdminAccess() ? adminLiveTrainingDetailPage() : session ? restrictedPage() : loginPage();
  }
  else if (route === "/admin/cchn-registrations") app.innerHTML = hasAdminAccess() ? cchnRegistrationPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/audit-log") app.innerHTML = hasAdminAccess() ? auditLogPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/learning-records") app.innerHTML = hasAdminAccess() ? adminLearningPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/certifications") { history.replaceState({}, "", "/admin/certificates"); route="/admin/certificates"; app.innerHTML = hasAdminAccess() ? adminCertificatesPage() : session ? restrictedPage() : loginPage(); }
  else if (route === "/admin/certificates") {
    if (hasAdminAccess()) { if (!_certAdmin.loading) loadCertificateAdmin(); app.innerHTML = adminCertificatesPage(); }
    else app.innerHTML = session ? restrictedPage() : loginPage();
  }
  else if (route === "/admin/compliance") {
    if (hasAdminAccess()) {
      if ((!_courses || _coursesAccountId !== session.accountId) && !_coursesLoading) fetchCoursesFromApi(session.accountId, session.role);
      if (!_lpListLoading) fetchLearningPathList();
      if (!_complianceLoading) fetchComplianceAdmin();
      app.innerHTML = adminCompliancePage();
    } else app.innerHTML = session ? restrictedPage() : loginPage();
  }
  else if (route.startsWith("/admin/compliance/cycles/")) {
    if (hasAdminAccess()) {
      const cycleId = route.split("/")[4];
      if (!_complianceLoading && !_complianceCycles) fetchComplianceAdmin();
      if (cycleId && !_complianceAssignments[cycleId]) fetchComplianceCycleAssignments(cycleId);
      app.innerHTML = adminComplianceCyclePage();
    } else app.innerHTML = session ? restrictedPage() : loginPage();
  }
  else if (route === "/admin/learning-paths") {
    if (hasAdminAccess()) { if (!_lpListLoading) fetchLearningPathList(); app.innerHTML = adminLearningPathsPage(); }
    else app.innerHTML = session ? restrictedPage() : loginPage();
  }
  else if (route.startsWith("/admin/learning-paths/")) {
    if (hasAdminAccess()) { const lpId = route.split("/")[3]; if (lpId && !_lpDetailLoading) fetchLearningPathDetail(lpId); app.innerHTML = adminLearningPathDetailPage(); }
    else app.innerHTML = session ? restrictedPage() : loginPage();
  }
  else if (route === "/dashboard/notifications") {
    notificationModalOpen = true;
    app.innerHTML = hasEmployeeAccess() ? employeeDashboard(false) : session ? restrictedPage() : loginPage();
  }
  else if (route === "/dashboard/learning-paths") {
    if (hasEmployeeAccess()) { if (!_myLpLoading) fetchMyLearningPaths(); app.innerHTML = myLearningPathsPage(); }
    else app.innerHTML = session ? restrictedPage() : loginPage();
  }
  else if (route.startsWith("/dashboard/learning-paths/")) {
    if (hasEmployeeAccess()) { const aid = route.split("/")[3]; if (aid && !_lpDetailLoading) fetchMyLpDetail(aid); app.innerHTML = myLpDetailPage(); }
    else app.innerHTML = session ? restrictedPage() : loginPage();
  }
  else if (route === "/dashboard/compliance") {
    if (hasEmployeeAccess()) { if (!_complianceMyLoading) fetchMyCompliance(); app.innerHTML = myCompliancePage(); }
    else app.innerHTML = session ? restrictedPage() : loginPage();
  }
  else if (route.startsWith("/dashboard/compliance/")) {
    if (hasEmployeeAccess()) { const aid = route.split("/")[3]; if (aid && !_complianceMyLoading) fetchMyComplianceDetail(aid); app.innerHTML = myComplianceDetailPage(); }
    else app.innerHTML = session ? restrictedPage() : loginPage();
  }
  else if (route === "/dashboard/skills") app.innerHTML = hasEmployeeAccess() ? mySkillsPage() : session ? restrictedPage() : loginPage();
  else if (route === "/dashboard/development-plan" || route.startsWith("/dashboard/development-plan/")) app.innerHTML = hasEmployeeAccess() ? myDevelopmentPlanPage() : session ? restrictedPage() : loginPage();
  else if (route === "/admin/gallery") app.innerHTML = adminGalleryPageV2();
  else if (route === "/admin/sessions") {
    if (session && (!_courses || _coursesAccountId !== session.accountId) && !_coursesLoading) {
      fetchCoursesFromApi(session.accountId, session.role);
    }
    app.innerHTML = adminSessionsPage();
  }
  else if (route === "/change-password") app.innerHTML = changePasswordPage();
  else app.innerHTML = landingPage();
  app.insertAdjacentHTML("beforeend", sharedDialog());
  bindEvents();
  enhanceCourseImageForm();
  enhanceEmployeePhotoManager();
  hydrateEmployeePhotos();
  hydrateGalleryMedia();
  hydrateQrCanvases();
  enhanceReportsPage();
  enhanceTrainingReport();
  document.body.classList.toggle("nav-open", mobileNavOpen);
  document.body.classList.toggle("modal-open", !!(mobileNavOpen || dialogState || notificationModalOpen || contentBuilderMode || quizFormOpen || courseDrawerOpen || accountDrawerOpen || assignModalOpen || resetModalOpen || courseFormMode || employeeEditOpen || certModalOpen || certEditOpen));
  setupActiveFocusTrap();
  setupLearningTracking();
  ensureActivityHeartbeat();
  ensureHrOverviewPolling();
  if (activeQuizAttempt) startQuizCountdown();
  if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" }));
  // Restore focus after re-render so search/form inputs keep cursor position
  if (_afId || _afKey) requestAnimationFrame(() => {
    const el = (_afId && document.getElementById(_afId)) || (_afKey && document.querySelector(`[data-focus-key="${_afKey}"]`));
    if (!el) return;
    el.focus({ preventScroll: true });
    if (_afSel[0] != null && el.setSelectionRange) try { el.setSelectionRange(_afSel[0], _afSel[1]); } catch {}
  });
  // Sliding language indicator — position after layout paint
  requestAnimationFrame(() => {
    document.querySelectorAll(".language-switch").forEach(sw => {
      const active = sw.querySelector("button.active");
      const ink = sw.querySelector(".lang-ink");
      if (!active || !ink) return;
      const swRect = sw.getBoundingClientRect();
      const btnRect = active.getBoundingClientRect();
      sw.dataset.activeLang = active.dataset.language || "";
      sw.style.setProperty("--lang-x", `${btnRect.left - swRect.left}px`);
      sw.style.setProperty("--lang-w", `${btnRect.width}px`);
    });
  });
  // Landing entrance animation — trigger once per navigation to "/"
  if (route === "/" && !dialogState) {
    requestAnimationFrame(() => document.querySelector(".landing-page")?.classList.add("landing-entrance"));
  }
  // After login failure: dialog closed → email retained, focus password
  if (route === "/login" && _loginEmailRetain && !dialogState) {
    requestAnimationFrame(() => document.getElementById("loginPassword")?.focus());
  }
  // Scroll reveal — wire up [data-reveal] and [data-stagger] elements
  requestAnimationFrame(() => initScrollReveal());
}

function initScrollReveal() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Reveal observer ---
  const revealEls = document.querySelectorAll("[data-reveal],[data-stagger]");
  if (revealEls.length) {
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add("is-visible");
        if (el.hasAttribute("data-stagger")) {
          el.querySelectorAll(":scope > *").forEach((child, i) => {
            child.style.transitionDelay = reduced ? "0ms" : `${i * 60}ms`;
            child.classList.add("is-visible");
          });
        }
        revealObs.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(el => revealObs.observe(el));
  }

  // --- Board stagger observer ---
  const boardGrids = document.querySelectorAll("[data-board-stagger]");
  if (boardGrids.length) {
    const boardObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const grid = entry.target;
        grid.querySelectorAll(".board-member").forEach((m, i) => {
          if (reduced) {
            m.classList.add("is-visible");
          } else {
            setTimeout(() => m.classList.add("is-visible"), i * 100);
          }
        });
        boardObs.unobserve(grid);
      });
    }, { threshold: 0.1 });
    boardGrids.forEach(g => boardObs.observe(g));
  }

  // --- Count-up observer ---
  const countSection = document.querySelector("[data-countup-section]");
  if (!countSection) return;
  const countObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      countObs.unobserve(entry.target);
      entry.target.classList.add("is-visible");
      entry.target.querySelectorAll("[data-countup]").forEach(el => {
        const target = parseInt(el.dataset.countup, 10);
        const suffix = el.dataset.countupSuffix || "";
        const useLocale = el.dataset.countupLocale === "true";
        if (reduced || isNaN(target)) { return; }
        const duration = 1500;
        const start = performance.now();
        const startVal = Math.max(0, Math.floor(target * 0.15));
        function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
        function tick(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const current = Math.round(startVal + (target - startVal) * easeOutCubic(progress));
          if (useLocale) {
            try {
              const loc = (typeof language !== "undefined" && language === "vi") ? "vi-VN" : (typeof language !== "undefined" && language === "kr") ? "ko-KR" : "en-US";
              el.textContent = new Intl.NumberFormat(loc).format(current) + suffix;
            } catch { el.textContent = current + suffix; }
          } else {
            el.textContent = current + suffix;
          }
          if (progress < 1) requestAnimationFrame(tick);
          else {
            if (useLocale) {
              try {
                const loc = (typeof language !== "undefined" && language === "vi") ? "vi-VN" : (typeof language !== "undefined" && language === "kr") ? "ko-KR" : "en-US";
                el.textContent = new Intl.NumberFormat(loc).format(target) + suffix;
              } catch { el.textContent = target + suffix; }
            } else {
              el.textContent = target + suffix;
            }
          }
        }
        requestAnimationFrame(tick);
      });
    });
  }, { threshold: 0.3 });
  countObs.observe(countSection);

  // About hero stat count-up (15+ years)
  const heroStats = document.querySelector(".about-hero-v2__stats");
  if (heroStats) {
    const heroCountObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        heroCountObs.unobserve(entry.target);
        entry.target.querySelectorAll("[data-countup]").forEach(el => {
          const target = parseInt(el.dataset.countup, 10);
          const suffix = el.dataset.countupSuffix || "";
          if (reduced || isNaN(target)) { el.textContent = target + suffix; return; }
          const duration = 900;
          const start = performance.now();
          function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
          function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const current = Math.round(target * easeOutCubic(progress));
            el.textContent = current + suffix;
            if (progress < 1) requestAnimationFrame(tick);
            else el.textContent = target + suffix;
          }
          requestAnimationFrame(tick);
        });
      });
    }, { threshold: 0.5 });
    heroCountObs.observe(heroStats);
  }
  if (typeof setupPageSpecificHandlers === "function") setupPageSpecificHandlers();
}

async function enhanceCourseImageForm(){const form=document.getElementById("courseForm");if(!form||form.querySelector(".course-image-upload"))return;const course=courseFormMode==="edit"?getCourseById(selectedCourseId):null;const body=form.querySelector(".modal__body");if(!body)return;const section=document.createElement("section");section.className="course-image-upload";section.innerHTML=`<img data-course-image-preview alt="${escapeHtmlAttribute(course?.imageAlt||course?.title||"")}"><div><label class="btn btn-outline" for="courseCoverInput">Cover image</label><input id="courseCoverInput" name="coverImage" type="file" accept="image/jpeg,image/png,image/webp" hidden><input name="coverImageId" type="hidden" value="${escapeHtmlAttribute(course?.coverImageId||"")}"><div class="field"><label>Alt text</label><input name="imageAlt" value="${escapeHtmlAttribute(course?.imageAlt||course?.title||"")}"></div><small>JPG, PNG, WebP · max 5 MB · 1200×675 recommended</small></div>`;body.prepend(section);if(course?.coverImageId){try{const blob=await getCourseImage(course.coverImageId);if(blob){const image=section.querySelector("img"),url=URL.createObjectURL(blob);image.src=url;image.dataset.objectUrl=url;}}catch{}}
  const input=section.querySelector("#courseCoverInput");input.addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{const id=await saveCourseImage(file);section.querySelector('[name="coverImageId"]').value=id;const image=section.querySelector("img");if(image.dataset.objectUrl)URL.revokeObjectURL(image.dataset.objectUrl);const url=URL.createObjectURL(file);image.src=url;image.dataset.objectUrl=url;}catch{toast("error");}});
}

function enhanceReportsPage(){return;}
function enhanceTrainingReport(){return;}
const employeePhotoUrls=new Map();
window.addEventListener("beforeunload",()=>{employeePhotoUrls.forEach(url=>URL.revokeObjectURL(url));employeePhotoUrls.clear();},{once:true});
window.addEventListener("beforeunload", () => {
  if (!session?.sessionId) return;
  const payload = currentActivityPayload("logout");
  fetch("/api/activity/heartbeat", {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
});
window.addEventListener("beforeunload", (event) => {
  if (!hasUnsavedLearningState()) return;
  event.preventDefault();
  event.returnValue = "";
});
async function hydrateEmployeePhotos(){for(const el of document.querySelectorAll("[data-photo-blob-id],[data-photo-url]")){const id=el.dataset.photoBlobId,url=el.dataset.photoUrl;if(!id&&!url)continue;try{let src=url;if(id){if(!employeePhotoUrls.has(id)){const blob=await getEmployeePhoto(id);if(blob)employeePhotoUrls.set(id,URL.createObjectURL(blob));}src=employeePhotoUrls.get(id);}if(!src)continue;let img=el.querySelector("img");if(!img){img=document.createElement("img");img.alt=el.getAttribute("aria-label")||"";img.loading="lazy";img.addEventListener("error",()=>img.remove(),{once:true});el.append(img);}img.src=src;}catch{}}}
function enhanceEmployeePhotoManager(){if(!accountDrawerOpen||!selectedAccountId)return;const modal=document.querySelector(".modal-backdrop .modal");if(!modal||modal.querySelector(".employee-photo-manager"))return;const account=getAccountById(selectedAccountId),employee=getEmployeeByAccountId(selectedAccountId);if(!account||!employee)return;const section=document.createElement("section");section.className="employee-photo-manager";section.innerHTML=`<div>${employeeAvatar(account,employee,"employee-photo-manager__preview")}<div><h3>Ảnh đại diện</h3><p>JPG, PNG hoặc WebP · tối đa 5 MB</p></div></div><div class="employee-photo-manager__actions"><label class="btn btn-outline" for="employeePhotoInput">Thay ảnh</label><input id="employeePhotoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden><button type="button" class="btn btn-ghost" data-remove-employee-photo ${employee.photoBlobId?"":"disabled"}>Xóa ảnh</button></div>`;modal.querySelector(".modal-head")?.after(section);hydrateEmployeePhotos();section.querySelector("#employeePhotoInput")?.addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{const photoBlobId=await saveEmployeePhoto(file);if(employee.photoBlobId)await deleteEmployeePhoto(employee.photoBlobId);updateEmployeeProfile(employee.id,{photoBlobId,photoFileName:file.name,photoUpdatedAt:new Date().toISOString(),photoUpdatedBy:session.accountId});accountDrawerOpen=false;toast("success");render();}catch{toast("error");}});section.querySelector("[data-remove-employee-photo]")?.addEventListener("click",async()=>{if(employee.photoBlobId)await deleteEmployeePhoto(employee.photoBlobId);updateEmployeeProfile(employee.id,{photoBlobId:null,photoFileName:"",photoUpdatedAt:new Date().toISOString(),photoUpdatedBy:session.accountId});accountDrawerOpen=false;render();});}

async function hydrateGalleryMedia(){for(const el of document.querySelectorAll("[data-media-blob]")){if(el.dataset.hydrated)return;try{const blob=await getGalleryMedia(el.dataset.mediaBlob);if(!blob)continue;const url=URL.createObjectURL(blob),node=el.dataset.mediaKind==="video"?document.createElement("video"):document.createElement("img");node.src=url;node.dataset.objectUrl=url;if(node.tagName==="VIDEO"){node.preload="metadata";node.muted=true;}else{node.loading="lazy";node.alt="";}el.replaceChildren(node);el.dataset.hydrated="1";}catch{}}const viewer=document.querySelector("[data-viewer-blob]");if(viewer){try{const blob=await getGalleryMedia(viewer.dataset.viewerBlob);if(blob){const url=URL.createObjectURL(blob);viewer.src=url;viewer.dataset.objectUrl=url;}}catch{}}}
async function hydrateQrCanvases(){const targets=[...document.querySelectorAll("[data-qr-render]")];if(!targets.length)return;try{if(!window.QRCode){await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="/vendor/qrcode.min.js";s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}for(const el of targets){if(el.dataset.hydratedQr==="1")continue;const canvas=document.createElement("canvas");await window.QRCode.toCanvas(canvas,el.dataset.qrRender,{width:280,margin:1,color:{dark:"#0b1f3a",light:"#ffffff"}});el.replaceChildren(canvas);el.dataset.hydratedQr="1";}}catch{targets.forEach(el=>{el.innerHTML=`<div class="empty-state"><p>Không thể tạo QR lúc này.</p><small>${escapeHtml(el.dataset.qrRender||"")}</small></div>`;});}}
function revokeGalleryUrls(){document.querySelectorAll("[data-object-url]").forEach(el=>{URL.revokeObjectURL(el.dataset.objectUrl);delete el.dataset.objectUrl;});}
async function saveSessionParticipants(accountIds,{mode="replace",source="manual"}={}){
  if(participantSyncState.saving)return {ok:false,error:"saving"};
  _recentlySyncedParticipants=new Set();
  participantSyncState={saving:true,error:""};
  render();
  const nowStr=new Date().toISOString();
  const participants=accountIds.map(accountId=>({
    id:crypto.randomUUID(),
    sessionId:selectedOfflineSessionId,
    accountId,
    role:"learner",
    status:"assigned",
    source,
    addedAt:nowStr,
    addedBy:session.accountId,
    createdAt:nowStr,
  }));
  try{
    const result=await trainingApiService.syncParticipants(selectedOfflineSessionId,participants,session.accountId,{mode});
    if(!result?.ok)throw new Error(result?.error||"participant_sync_failed");
    // Extract saved account IDs from API response
    const savedIds=(result.participants||[]).map(p=>String(p.account_id||p.data?.accountId||"")).filter(Boolean);
    _remoteParticipantIds.set(selectedOfflineSessionId,new Set(savedIds));
    _recentlySyncedParticipants=new Set(savedIds);
    _participantSyncedSessions.add(selectedOfflineSessionId);
    participantSyncState={saving:false,error:""};
    // Sync back to localStorage for ensureInvitations compatibility
    const {localStorageAdapter:lsa}=await import("./lib/storage/localStorageAdapter.js");
    const PARTICIPANTS="mykis.sessionParticipants.v1";
    const existing=lsa.read(PARTICIPANTS,[]);
    const notThis=existing.filter(r=>r.sessionId!==selectedOfflineSessionId);
    const fresh=savedIds.map(aid=>({id:crypto.randomUUID(),sessionId:selectedOfflineSessionId,accountId:aid,source,addedAt:nowStr,addedBy:session.accountId}));
    lsa.write(PARTICIPANTS,[...notThis,...fresh]);
    const count=savedIds.length;
    toast(`Đã đồng bộ ${count} học viên vào lớp ✓`);
    render();
    return {ok:true,participants:result.participants,count};
  }catch(e){
    participantSyncState={saving:false,error:e.message||"Lỗi không xác định"};
    openDialog({type:"alert",title:"Không thể lưu danh sách học viên",body:participantSyncState.error});
    render();
    return {ok:false,error:e.message};
  }
}
// Silently pushes any existing localStorage participants to Supabase when HR opens a session.
// Runs once per session ID per page load to backfill data from before the async sync was deployed.
async function autoSyncParticipantsIfNeeded(sessionId){
  if(!sessionId||!session||_participantSyncedSessions.has(sessionId))return;
  const ids=offlineTrainingService.getParticipantAccountIds(sessionId);
  if(!ids.length)return;
  _participantSyncedSessions.add(sessionId);
  const result=await offlineTrainingService.setParticipantsAsync(sessionId,ids,session.accountId,{mode:"merge",source:"auto-sync"});
  if(result.ok)console.info("[participant-sync] backfilled",result.remoteCount,"participants for session",sessionId);
  else console.warn("[participant-sync] backfill failed for session",sessionId,":",result.message);
}

// ----- Timeline carousel (about-kis / Lịch sử phát triển) -----
let _timelineCarouselCleanup = null;
function initTimelineCarousel() {
  if (_timelineCarouselCleanup) { _timelineCarouselCleanup(); _timelineCarouselCleanup = null; }
  const section = document.querySelector("#kis-history");
  if (!section) return;
  const years = Object.keys(timelineData);
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const updateShell = (year) => {
    section.querySelectorAll("[data-timeline-year]").forEach((btn) => {
      const isActive = btn.dataset.timelineYear === year;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
      if (isActive) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
    });
    const idx = years.indexOf(year);
    const yearNav = section.querySelector(".timeline-carousel__years");
    if (yearNav) yearNav.style.setProperty("--active-index", idx);
    prevBtn?.toggleAttribute("disabled", idx === 0);
    nextBtn?.toggleAttribute("disabled", idx === years.length - 1);
  };
  const updateContent = (year) => {
    const content = section.querySelector(".timeline-carousel__content");
    const currentInner = content?.querySelector(".timeline-carousel__content-inner");
    if (!content || !currentInner) return;
    const nextMarkup = renderTimelineContent(year);
    if (prefersReduced) {
      content.innerHTML = nextMarkup;
      return;
    }
    currentInner.classList.add("is-updating");
    window.setTimeout(() => {
      content.innerHTML = nextMarkup;
    }, 140);
  };

  const goToYear = (y, direction) => {
    if (y && y !== activeTimelineYear && timelineData[y]) {
      _timelineDirection = direction || "next";
      activeTimelineYear = y;
      updateShell(y);
      updateContent(y);
    }
  };

  // Year buttons
  section.querySelectorAll("[data-timeline-year]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = years.indexOf(activeTimelineYear);
      const newIdx = years.indexOf(btn.dataset.timelineYear);
      goToYear(btn.dataset.timelineYear, newIdx > idx ? "next" : "prev");
    });
  });

  // Prev / Next
  const prevBtn = section.querySelector(".timeline-carousel__btn--prev");
  const nextBtn = section.querySelector(".timeline-carousel__btn--next");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      const idx = years.indexOf(activeTimelineYear);
      if (idx > 0) goToYear(years[idx - 1], "prev");
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const idx = years.indexOf(activeTimelineYear);
      if (idx < years.length - 1) goToYear(years[idx + 1], "next");
    });
  }

  // Keyboard: left/right arrows on the year nav
  const yearNav = section.querySelector(".timeline-carousel__years");
  if (yearNav) {
    yearNav.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const idx = years.indexOf(activeTimelineYear);
        if (e.key === "ArrowLeft" && idx > 0) goToYear(years[idx - 1], "prev");
        else if (e.key === "ArrowRight" && idx < years.length - 1) goToYear(years[idx + 1], "next");
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        goToYear(e.key === "Home" ? years[0] : years[years.length - 1], e.key === "Home" ? "prev" : "next");
      }
    });
  }

  // Touch swipe on content area (mobile)
  let touchStartX = 0;
  let touchEndX = 0;
  const content = section.querySelector(".timeline-carousel__content");
  if (content && !prefersReduced) {
    content.addEventListener("touchstart", (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    content.addEventListener("touchend", (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        const idx = years.indexOf(activeTimelineYear);
        if (diff > 0 && idx < years.length - 1) goToYear(years[idx + 1], "next");
        else if (diff < 0 && idx > 0) goToYear(years[idx - 1], "prev");
      }
    }, { passive: true });
  }

  // Keep the active year visible on initial load without changing page scroll.
  const activeYearEl = section.querySelector(".timeline-carousel__year.is-active");
  if (activeYearEl) {
    activeYearEl.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
  }

  // Timeline entry animation (rail draw on first scroll-into-view)
  if (!section.classList.contains("tl-entered")) {
    const entryObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("tl-entered");
        entryObs.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    entryObs.observe(section);
  }

  _timelineCarouselCleanup = () => {
    // Cleanup is handled by render() re-building the DOM
  };
}

function closeMobileNav({ restoreFocus = true } = {}) {
  const selector = lastShellFocusSelector;
  mobileNavOpen = false;
  document.body.classList.remove("nav-open");
  if (restoreFocus && selector) requestAnimationFrame(() => document.querySelector(selector)?.focus?.({ preventScroll: true }));
}

function setupActiveFocusTrap() {
  const drawer = mobileNavOpen ? document.querySelector("[data-mobile-drawer]") : null;
  const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
  const target = drawer || dialog;
  if (!target) return;
  requestAnimationFrame(() => {
    const activeInside = target.contains(document.activeElement);
    if (!activeInside) focusableElements(target)[0]?.focus?.({ preventScroll: true });
  });
}

function bindShellEvents() {
  if (window.__mykisShellBound) return;
  window.__mykisShellBound = true;
  document.addEventListener("click", (event) => {
    const openBtn = event.target.closest("[data-open-mobile-nav]");
    if (openBtn) {
      event.preventDefault();
      lastShellFocusSelector = openBtn.id ? `#${openBtn.id}` : "[data-open-mobile-nav]";
      mobileNavOpen = true;
      userMenuOpen = false;
      render();
      return;
    }
    if (event.target.closest("[data-close-mobile-nav]")) {
      event.preventDefault();
      closeMobileNav();
      render();
      return;
    }
    const userTrigger = event.target.closest("[data-user-menu-trigger]");
    if (userTrigger) {
      event.preventDefault();
      userMenuOpen = !userMenuOpen;
      render();
      return;
    }
    if (userMenuOpen && !event.target.closest(".topbar-user-shell")) {
      userMenuOpen = false;
      render();
    }
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (mobileNavOpen) { event.preventDefault(); closeMobileNav(); render(); return; }
      if (userMenuOpen) { event.preventDefault(); userMenuOpen = false; render(); return; }
      if (dialogState) { event.preventDefault(); closeDialog(); return; }
    }
    const drawer = mobileNavOpen ? document.querySelector("[data-mobile-drawer]") : null;
    const dialog = !drawer ? document.querySelector('[role="dialog"][aria-modal="true"]') : null;
    const trap = drawer || dialog;
    if (event.key !== "Tab" || !trap) return;
    const focusables = focusableElements(trap);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 901 && mobileNavOpen) { mobileNavOpen = false; document.body.classList.remove("nav-open"); render(); }
  });
}

function bindEvents() {
  bindShellEvents();
  document.querySelector("[data-live-create-open]")?.addEventListener("click", () => { liveTrainingState.createOpen = true; render(); });
  document.querySelector("[data-live-create-close]")?.addEventListener("click", () => { liveTrainingState.createOpen = false; render(); });
  document.querySelector("[data-live-reload]")?.addEventListener("click", () => loadLiveTrainingList());
  document.querySelector("[data-live-detail-reload]")?.addEventListener("click", () => loadLiveTrainingDetail(route.split("/")[3]));
  document.querySelector("[data-live-search]")?.addEventListener("input", (e) => { liveTrainingState.search = e.target.value; render(); });
  document.querySelectorAll("[data-copy-live-link]").forEach((el) => el.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(el.dataset.copyLiveLink || ""); toast("copied"); } catch { toast("error"); }
  }));
  document.getElementById("liveTrainingCreateForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const errEl = form.querySelector("[data-live-create-error]");
    const payload = {
      title: fd.get("title"), description: fd.get("description"),
      pretestUrl: fd.get("pretestUrl"), posttestUrl: fd.get("posttestUrl"), evaluationUrl: fd.get("evaluationUrl"),
      pretestRequired: fd.get("pretestRequired") === "on", posttestRequired: fd.get("posttestRequired") === "on", evaluationRequired: fd.get("evaluationRequired") === "on",
      expiresAt: fd.get("expiresAt") ? new Date(fd.get("expiresAt")).toISOString() : null,
    };
    try {
      const res = await apiJson("/api/admin/live-training", { method: "POST", body: JSON.stringify(payload) });
      liveTrainingState.createOpen = false; liveTrainingState.flows = [];
      navigate(`/admin/live-training/${res.flow.id}`);
    } catch (err) { if (errEl) errEl.textContent = err.message; }
  });
  document.getElementById("liveTrainingUpdateForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = route.split("/")[3];
    const fd = new FormData(event.currentTarget);
    const payload = {
      title: fd.get("title"), description: fd.get("description"),
      pretestUrl: fd.get("pretestUrl"), posttestUrl: fd.get("posttestUrl"), evaluationUrl: fd.get("evaluationUrl"),
      pretestRequired: fd.get("pretestRequired") === "on", posttestRequired: fd.get("posttestRequired") === "on", evaluationRequired: fd.get("evaluationRequired") === "on",
      speakerName: fd.get("speakerName") || "", speakerTitle: fd.get("speakerTitle") || "",
      speakerOrg: fd.get("speakerOrg") || "", speakerBio: fd.get("speakerBio") || "",
      speakerPhotoUrl: fd.get("speakerPhotoUrl") || "",
    };
    try { await apiJson(`/api/admin/live-training/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); await loadLiveTrainingDetail(id); toast("success"); }
    catch (err) { event.currentTarget.querySelector("[data-live-update-error]").textContent = err.message; }
  });
  document.querySelectorAll("[data-live-step]").forEach((el) => el.addEventListener("click", async () => {
    const id = route.split("/")[3];
    el.disabled = true;
    try { await apiJson(`/api/admin/live-training/${id}/steps/${el.dataset.liveStep}`, { method: "PATCH", body: JSON.stringify({ state: el.dataset.liveState }) }); await loadLiveTrainingDetail(id); }
    catch { toast("error"); el.disabled = false; }
  }));
  document.querySelectorAll("[data-live-close]").forEach((el) => el.addEventListener("click", async () => {
    if (!confirm("Đóng phiên này?")) return;
    try { await apiJson(`/api/admin/live-training/${el.dataset.liveClose}/close`, { method: "POST", body: "{}" }); await loadLiveTrainingList(); } catch { toast("error"); }
  }));
  document.querySelector("[data-live-rotate]")?.addEventListener("click", async (e) => {
    if (!confirm("Rotate public link? Link cũ sẽ không còn dùng được.")) return;
    try { await apiJson(`/api/admin/live-training/${e.currentTarget.dataset.liveRotate}/rotate-link`, { method: "POST", body: "{}" }); await loadLiveTrainingDetail(e.currentTarget.dataset.liveRotate); } catch { toast("error"); }
  });
  // Roster admin handlers
  (() => {
    const loadXlsx = () => {
      if (window.XLSX) return Promise.resolve(window.XLSX);
      return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
        s.onload = () => resolve(window.XLSX);
        s.onerror = () => reject(new Error("Failed to load xlsx library"));
        document.head.appendChild(s);
      });
    };
    const parseXlsxFile = (file) => {
      return loadXlsx().then((XLSX) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            if (!XLSX) { reject(new Error("XLSX not loaded")); return; }
            const wb = XLSX.read(evt.target.result, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
            let headerRow = -1, nameCol = -1, deptCol = -1, locCol = -1, modeCol = -1;
            for (let i = 0; i < Math.min(12, rows.length); i++) {
              const row = rows[i];
              for (let j = 0; j < row.length; j++) {
                const cell = String(row[j] || "").trim().toLowerCase().normalize("NFKC");
                if (nameCol < 0 && (cell.includes("full name") || cell.includes("họ và tên") || cell.includes("họ tên") || cell === "name" || (cell.includes("tên") && !cell.includes("địa")))) { headerRow = i; nameCol = j; }
                if (deptCol < 0 && (cell.includes("department") || cell.includes("phòng") || cell.includes("bộ phận"))) deptCol = j;
                if (locCol < 0 && (cell.includes("location") || cell.includes("địa điểm") || cell.includes("chi nhánh"))) locCol = j;
                if (modeCol < 0 && (cell.includes("mode") || cell.includes("hình thức"))) modeCol = j;
              }
              if (headerRow >= 0) break;
            }
            if (headerRow < 0 || nameCol < 0) { reject(new Error("Không tìm thấy cột tên")); return; }
            const records = []; const seen = new Set(); let duplicates = 0, skipped = 0;
            for (let i = headerRow + 1; i < rows.length; i++) {
              const row = rows[i];
              const fullName = String(row[nameCol] || "").trim().replace(/\s+/g, " ");
              if (!fullName || fullName.length < 2) { skipped++; continue; }
              const normalized = fullName.normalize("NFKC").toLocaleLowerCase("vi-VN");
              if (seen.has(normalized)) { duplicates++; continue; }
              seen.add(normalized);
              records.push({ fullName, department: deptCol >= 0 ? String(row[deptCol] || "").trim() : "", location: locCol >= 0 ? String(row[locCol] || "").trim() : "", mode: modeCol >= 0 ? String(row[modeCol] || "").trim() : "", sourceRow: i + 1 });
            }
            resolve({ records, valid: records.length, duplicates, skipped });
          } catch (e) { reject(e); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      }));
    };
    const handleFile = (file) => {
      if (!file) return;
      parseXlsxFile(file).then((result) => { liveTrainingState.rosterParsed = result; render(); }).catch((e) => toast("Lỗi đọc file: " + e.message));
    };
    document.getElementById("liveRosterFileInput")?.addEventListener("change", (e) => handleFile(e.target.files[0]));
    const dropzone = document.getElementById("liveRosterDropzone");
    if (dropzone) {
      dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("is-over"); });
      dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-over"));
      dropzone.addEventListener("drop", (e) => { e.preventDefault(); dropzone.classList.remove("is-over"); handleFile(e.dataTransfer.files[0]); });
    }
    document.querySelectorAll("[name='rosterMode']").forEach((el) => el.addEventListener("change", () => { liveTrainingState.rosterReplaceMode = el.value === "replace"; }));
    document.getElementById("liveRosterSaveBtn")?.addEventListener("click", async () => {
      const id = route.split("/")[3];
      const p = liveTrainingState.rosterParsed;
      if (!p) return;
      try {
        const result = await importRoster(id, p.records, liveTrainingState.rosterReplaceMode);
        liveTrainingState.rosterParsed = null;
        await loadRoster(id);
        toast(`Đã lưu ${result.imported} người`);
      } catch (e) { toast("Lỗi: " + e.message); }
    });
    document.querySelector("[data-live-roster-search]")?.addEventListener("input", (e) => { liveTrainingState.rosterSearch = e.target.value; render(); document.querySelector("[data-live-roster-search]")?.focus(); });
    document.querySelector("[data-live-roster-clear]")?.addEventListener("click", async () => {
      const id = route.split("/")[3];
      if (!confirm("Xóa toàn bộ danh sách?")) return;
      try { await apiJson(`/api/admin/live-training/${id}/roster`, { method: "DELETE" }); await loadRoster(id); toast("Đã xóa danh sách"); } catch { toast("error"); }
    });
    document.querySelectorAll("[data-live-roster-delete]").forEach((el) => el.addEventListener("click", async () => {
      const id = route.split("/")[3];
      try { await apiJson(`/api/admin/live-training/${id}/roster/${el.dataset.liveRosterDelete}`, { method: "DELETE" }); await loadRoster(id); } catch { toast("error"); }
    }));
  })();
  document.querySelectorAll("[data-live-delete]").forEach((el) => el.addEventListener("click", () => {
    liveDeleteState = { flowId: el.dataset.liveDelete, flowTitle: el.dataset.liveDeleteTitle || "", loading: false, error: "" };
    render();
  }));
  document.getElementById("liveDeleteCancel")?.addEventListener("click", () => {
    liveDeleteState = { flowId: null, flowTitle: "", loading: false, error: "" };
    render();
  });
  document.getElementById("liveDeleteConfirm")?.addEventListener("click", async () => {
    const { flowId, flowTitle } = liveDeleteState;
    if (!flowId || liveDeleteState.loading) return;
    liveDeleteState = { flowId, flowTitle, loading: true, error: "" };
    render();
    try {
      await apiJson(`/api/admin/live-training/${encodeURIComponent(flowId)}`, { method: "DELETE" });
      liveDeleteState = { flowId: null, flowTitle: "", loading: false, error: "" };
      liveTrainingState.flows = (liveTrainingState.flows || []).filter((f) => f.id !== flowId);
      if (route.startsWith("/admin/live-training/") && route.split("/")[3] === flowId) {
        navigate("/admin/live-training");
      } else {
        render();
      }
      toast("Đã xóa hành trình");
    } catch (err) {
      liveDeleteState = { flowId, flowTitle, loading: false, error: err.message || "Xóa thất bại. Thử lại." };
      render();
    }
  });
  document.querySelectorAll("[data-live-participant]").forEach((el) => el.addEventListener("click", async () => {
    const id = route.split("/")[3];
    try { await apiJson(`/api/admin/live-training/${id}/participants/${el.dataset.liveParticipant}`, { method: "PATCH", body: JSON.stringify({ [el.dataset.field]: true }) }); await loadLiveTrainingDetail(id); } catch { toast("error"); }
  }));
  document.querySelectorAll("[data-live-participant-reset]").forEach((el) => el.addEventListener("click", async () => {
    const id = route.split("/")[3];
    try { await apiJson(`/api/admin/live-training/${id}/participants/${el.dataset.liveParticipantReset}`, { method: "PATCH", body: JSON.stringify({ reset: true }) }); await loadLiveTrainingDetail(id); } catch { toast("error"); }
  }));
  document.getElementById("publicTrainingJoinForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("displayName") || publicTrainingState.name;
    publicTrainingState.name = String(name || "");
    publicTrainingState.joining = true; publicTrainingState.error = ""; render();
    try {
      let joinBody;
      if (publicTrainingState.selectedRosterId) {
        joinBody = { rosterEntryId: publicTrainingState.selectedRosterId };
      } else if (publicTrainingState.outsideRoster) {
        joinBody = { displayName: name, outsideRoster: true };
      } else {
        joinBody = { displayName: name };
      }
      const res = await fetch(`/api/public/live-training/${encodeURIComponent(publicTrainingState.token)}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(joinBody) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "JOIN_ERROR");
      applyPublicTrainingPayload(body);
      localStorage.setItem(liveTrainingStorageKey(body.flow.id), body.participantToken);
      const p2 = publicTrainingState.participant;
      publicTrainingState.bootstrap = p2?.completedAt ? "completed" : "ready";
      publicTrainingState.joining = false; render(); startPublicTrainingPolling();
    } catch (err) { publicTrainingState.joining = false; publicTrainingState.error = err.message; render(); }
  });
  // Roster search
  document.getElementById("publicRosterSearch")?.addEventListener("input", (e) => {
    publicTrainingState.rosterSearch = e.target.value;
    render();
    document.getElementById("publicRosterSearch")?.focus();
  });
  // Roster item selection
  document.querySelectorAll("[data-roster-id]").forEach((el) => el.addEventListener("click", () => {
    publicTrainingState.selectedRosterId = el.dataset.rosterId;
    publicTrainingState.name = el.dataset.rosterName || "";
    publicTrainingState.outsideRoster = false;
    publicTrainingState.joining = true; publicTrainingState.error = ""; render();
    fetch(`/api/public/live-training/${encodeURIComponent(publicTrainingState.token)}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rosterEntryId: publicTrainingState.selectedRosterId }) })
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => {
        if (!ok) throw new Error(b.error || "JOIN_ERROR");
        applyPublicTrainingPayload(b);
        localStorage.setItem(liveTrainingStorageKey(b.flow.id), b.participantToken);
        const p2 = publicTrainingState.participant;
        publicTrainingState.bootstrap = p2?.completedAt ? "completed" : "ready";
        publicTrainingState.joining = false; render(); startPublicTrainingPolling();
      })
      .catch((err) => { publicTrainingState.joining = false; publicTrainingState.selectedRosterId = null; publicTrainingState.error = err.message; render(); });
  }));
  // Not on list
  document.querySelector("[data-roster-not-listed]")?.addEventListener("click", () => {
    publicTrainingState.outsideRoster = true;
    publicTrainingState.selectedRosterId = null;
    publicTrainingState.name = "";
    render();
  });
  // Back to roster list
  document.querySelector("[data-roster-back]")?.addEventListener("click", () => {
    publicTrainingState.outsideRoster = false;
    publicTrainingState.selectedRosterId = null;
    render();
  });
  document.querySelector("[data-public-retry]")?.addEventListener("click", async () => {
    publicTrainingState.bootstrap = "checkingParticipant";
    render();
    await fetchPublicTrainingState(true);
    startPublicTrainingPolling();
  });
  document.querySelector("[data-public-switch]")?.addEventListener("click", () => {
    clearTimeout(publicTrainingState.pollTimer);
    const flowId = publicTrainingState.flow?.id;
    if (flowId) localStorage.removeItem(liveTrainingStorageKey(flowId));
    publicTrainingState.participant = null;
    publicTrainingState.bootstrap = "needsName";
    publicTrainingState.name = "";
    publicTrainingState.error = "";
    publicTrainingState.selectedRosterId = null;
    publicTrainingState.outsideRoster = false;
    render();
  });
  document.querySelectorAll("[data-public-step-start]").forEach((el) => el.addEventListener("click", async () => {
    const step = el.dataset.publicStepStart;
    try {
      const res = await fetch(`/api/public/live-training/${encodeURIComponent(publicTrainingState.token)}/steps/${step}/start`, { method: "POST", headers: publicTokenHeader() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "STEP_ERROR");
      applyPublicTrainingPayload(body); render();
      if (body.externalUrl) window.open(body.externalUrl, "_blank", "noopener,noreferrer");
    } catch (err) { toast(err.message || "error"); }
  }));
  document.querySelectorAll("[data-public-step-complete]").forEach((el) => el.addEventListener("click", async () => {
    const step = el.dataset.publicStepComplete;
    try {
      const res = await fetch(`/api/public/live-training/${encodeURIComponent(publicTrainingState.token)}/steps/${step}/complete`, { method: "POST", headers: publicTokenHeader() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "STEP_ERROR");
      applyPublicTrainingPayload(body); render();
    } catch (err) { toast(err.message || "error"); }
  }));
  document.querySelector("[data-public-complete]")?.addEventListener("click", async () => {
    try {
      const res = await fetch(`/api/public/live-training/${encodeURIComponent(publicTrainingState.token)}/complete`, { method: "POST", headers: publicTokenHeader() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "COMPLETE_ERROR");
      applyPublicTrainingPayload(body); render();
    } catch (err) { toast(err.message || "error"); }
  });
  document.querySelector("[data-retry-sessions]")?.addEventListener("click",()=>{_sessions=null;_sessionsError="";fetchSessionsFromApi(session?.accountId||"","hr");});
  document.querySelector("[data-create-session]")?.addEventListener("click",()=>{
    selectedOfflineSessionId="";sessionFormOpen=true;
    if(session&&(!_courses||_coursesAccountId!==session.accountId)&&!_coursesLoading)fetchCoursesFromApi(session.accountId,session.role);
    render();
  });
  document.querySelectorAll("[data-edit-session]").forEach(el=>el.addEventListener("click",()=>{
    selectedOfflineSessionId=el.dataset.editSession;sessionFormOpen=true;
    if(session&&(!_courses||_coursesAccountId!==session.accountId)&&!_coursesLoading)fetchCoursesFromApi(session.accountId,session.role);
    render();
  }));
  document.querySelectorAll("[data-manage-session]").forEach(el=>el.addEventListener("click",()=>{selectedOfflineSessionId=el.dataset.manageSession;sessionFormOpen=false;render();fetchParticipantsFromApi(el.dataset.manageSession,session.accountId);}));
  document.querySelectorAll("[data-close-session-form]").forEach(el=>el.addEventListener("click",()=>{sessionFormOpen=false;selectedOfflineSessionId="";render();}));
  document.querySelector("[data-close-attendance]")?.addEventListener("click",()=>{selectedOfflineSessionId="";sessionEmployeeSearch="";sessionEmployeeDepartment="";_recentlySyncedParticipants=new Set();render();});
  document.getElementById("offlineSessionForm")?.addEventListener("submit",async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    const saveBtn=form.querySelector("[type=submit]");
    const errEl=form.querySelector("[data-session-error]");
    if(errEl)errEl.textContent="";
    const data=Object.fromEntries(new FormData(form));
    data.attendanceRequired=true;
    const date=data.sessionDate;
    if(data.startTime&&data.endTime&&data.endTime<=data.startTime){if(errEl)errEl.textContent="Giờ kết thúc phải sau giờ bắt đầu.";return;}
    data.startAt=`${date}T${data.startTime}:00`;
    data.endAt=`${date}T${data.endTime}:00`;
    delete data.sessionDate;delete data.startTime;delete data.endTime;
    if(data.latitude)data.latitude=parseFloat(data.latitude);
    if(data.longitude)data.longitude=parseFloat(data.longitude);
    if(data.allowedRadiusMeters)data.allowedRadiusMeters=parseInt(data.allowedRadiusMeters,10);
    const isNew=!data.id;
    // Step 1: validate + build row — NO localStorage write yet
    const built=offlineTrainingService.buildSession(data,session.accountId);
    if(!built.ok){if(errEl)errEl.textContent=built.error==="invalid_time"?"Giờ kết thúc phải sau giờ bắt đầu.":built.error==="invalid_deadline"?"Hạn xác nhận phải trước giờ bắt đầu.":"Vui lòng kiểm tra thông tin buổi học.";return;}
    // Step 2: disable form, show saving state
    if(saveBtn){saveBtn.disabled=true;saveBtn.textContent="Đang lưu...";}
    try{
      // Step 3: await API — database first
      const apiRes=await trainingApiService.saveSession(built.session,session.accountId);
      if(!apiRes?.ok&&!apiRes?.id)throw new Error(apiRes?.error||"Không thể kết nối Supabase");
      // Step 4: only on API success — write to localStorage and update UI
      offlineTrainingService.saveToLocal(built.session);
      qrAttendanceService.getOrCreateDefaultSlots(built.session.id,session.accountId);
      sessionFormOpen=false;
      selectedOfflineSessionId=built.session.id;
      _sessions=null;
      // Step 5: fetch from API to sync UI
      await fetchSessionsFromApi(session.accountId,"hr");
      if(isNew){openDialog({type:"alert",title:"Đã tạo lớp học thành công",body:`${built.session.title}\n${formatLocalDateTime(built.session.startAt)}\nSức chứa: ${built.session.capacity} người`});}
      else{toast("success");}
    }catch(e){
      // API failed — do NOT save, show real error
      if(errEl)errEl.textContent=`Lỗi lưu: ${e.message||"Không thể kết nối máy chủ. Kiểm tra mạng và thử lại."}`;
      console.error("[session-save] API error:",e?.message);
    }finally{
      if(saveBtn){saveBtn.disabled=false;saveBtn.textContent="Lưu buổi học";}
    }
  });
  // Delete session handler — soft delete (cancelled) if has participants, hard delete if not
  document.querySelectorAll("[data-delete-session]").forEach(el=>el.addEventListener("click",()=>{const sessionId=el.dataset.deleteSession;const s=offlineTrainingService.getSession(sessionId)||(_sessions||[]).find(x=>x.id===sessionId);openDialog({type:"confirm",title:"Xóa lớp đào tạo",body:`Bạn có chắc muốn xóa lớp đào tạo này?\nDanh sách người tham gia và điểm danh liên quan sẽ được xử lý theo chính sách hệ thống.`,onConfirm:async()=>{try{const res=await fetch("/api/training/sessions?id="+encodeURIComponent(sessionId),{method:"DELETE",headers:{"Content-Type":"application/json","X-Account-Id":session.accountId,"X-Account-Role":"hr"}});const body=await res.json().catch(()=>({}));if(!body.ok)throw new Error(body.error||"delete_failed");// Update localStorage
const {localStorageAdapter:lsa}=await import("./lib/storage/localStorageAdapter.js");const rows=lsa.read("mykis.offlineSessions.v1",[]);if(body.method==="soft"){const idx=rows.findIndex(x=>x.id===sessionId);if(idx>=0){rows[idx]={...rows[idx],status:"cancelled"};lsa.write("mykis.offlineSessions.v1",rows);}}else{lsa.write("mykis.offlineSessions.v1",rows.filter(x=>x.id!==sessionId));}if(selectedOfflineSessionId===sessionId)selectedOfflineSessionId="";_sessions=null;toast("success");await fetchSessionsFromApi(session.accountId,"hr");}catch(e){console.error("[delete-session]",e?.message);toast("error");}}})}));

  // GPS button in session form
  document.getElementById("btnGetGps")?.addEventListener("click",()=>{const status=document.getElementById("gpsStatus");if(status)status.textContent="Đang lấy vị trí...";navigator.geolocation?.getCurrentPosition(pos=>{const lat=document.getElementById("geoLat");const lng=document.getElementById("geoLng");if(lat)lat.value=pos.coords.latitude.toFixed(7);if(lng)lng.value=pos.coords.longitude.toFixed(7);if(status)status.textContent=`✓ Vị trí: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (±${Math.round(pos.coords.accuracy)}m)`;},()=>{if(status)status.textContent="Không lấy được vị trí. Hãy cho phép GPS.";},{enableHighAccuracy:true,timeout:10000});});

  document.querySelectorAll("[data-save-attendance]").forEach(el=>el.addEventListener("click",()=>{const accountId=el.dataset.saveAttendance,status=document.querySelector(`[data-attendance-status="${accountId}"]`)?.value,minutes=document.querySelector(`[data-attendance-minutes="${accountId}"]`)?.value;el.disabled=true;const result=offlineTrainingService.markAttendance(selectedOfflineSessionId,accountId,{attendanceStatus:status,attendedMinutes:Number(minutes)},session.accountId);toast(result.ok?"success":"error");render();}));
  document.querySelectorAll("[data-session-response]").forEach(el=>el.addEventListener("click",()=>{el.disabled=true;el.textContent="Đang lưu...";const result=offlineTrainingService.respond(el.dataset.sessionResponse,session.accountId,el.dataset.response);toast(result.ok?"success":"error");render();}));
  document.querySelectorAll("[data-session-busy]").forEach(el=>el.addEventListener("click",()=>{busySessionId=el.dataset.sessionBusy;render();}));
  document.querySelectorAll("[data-close-busy]").forEach(el=>el.addEventListener("click",()=>{busySessionId="";render();}));
  document.getElementById("busyResponseForm")?.addEventListener("submit",event=>{event.preventDefault();const fd=new FormData(event.currentTarget),reason=fd.get("reason")==="other"?fd.get("note"):fd.get("reason");const result=offlineTrainingService.respond(busySessionId,session.accountId,"busy",reason);busySessionId="";toast(result.ok?"success":"error");render();});
  document.querySelector("[data-session-add-assigned]")?.addEventListener("click",async()=>{const sessionRow=offlineTrainingService.getSession(selectedOfflineSessionId);const ids=sessionRow?getEnrollmentsByCourseId(sessionRow.courseId).map(row=>row.accountId):[];await saveSessionParticipants(ids,{mode:"merge",source:"course_assignment"});});
  document.querySelector("[data-session-clear-selection]")?.addEventListener("click",async()=>{await saveSessionParticipants([],{mode:"replace",source:"manual"});});
  document.querySelector("[data-session-select-visible]")?.addEventListener("click",async()=>{const ids=availableEmployeeAccounts().filter(account=>(!sessionEmployeeSearch||`${account.fullName} ${account.email} ${account.employeeCode}`.toLowerCase().includes(sessionEmployeeSearch.toLowerCase()))&&(!sessionEmployeeDepartment||account.department===sessionEmployeeDepartment)).map(account=>account.id);await saveSessionParticipants(ids,{mode:"merge",source:"manual"});});
  document.querySelectorAll("[data-session-participant]").forEach((el)=>el.addEventListener("change",async()=>{
    // Only use remote data — never fall back to localStorage
    const remoteIds=_remoteParticipantIds.get(selectedOfflineSessionId);
    const selected=new Set(remoteIds||[]);
    if(el.checked)selected.add(el.dataset.sessionParticipant);
    else selected.delete(el.dataset.sessionParticipant);
    await saveSessionParticipants([...selected],{mode:"replace",source:"manual"});
  }));
  document.querySelectorAll("[data-session-department-chip]").forEach((el)=>el.addEventListener("click",async()=>{const department=el.dataset.sessionDepartmentChip;selectedSessionDepartments=selectedSessionDepartments.includes(department)?selectedSessionDepartments.filter(value=>value!==department):[...selectedSessionDepartments,department];if(selectedSessionDepartments.length){const ids=availableEmployeeAccounts().filter(account=>selectedSessionDepartments.includes(account.department)).map(account=>account.id);await saveSessionParticipants(ids,{mode:"merge",source:"department"});}else render();}));
  document.querySelector("[data-session-employee-search]")?.addEventListener("input",debounce((event)=>{sessionEmployeeSearch=event.target.value;sessionEmployeePage=1;render();},180));
  document.querySelector("[data-session-employee-department]")?.addEventListener("change",(event)=>{sessionEmployeeDepartment=event.target.value;sessionEmployeePage=1;render();});
  document.querySelector("[data-quick-setup-slots]")?.addEventListener("click",()=>{qrAttendanceService.getOrCreateDefaultSlots(selectedOfflineSessionId,session.accountId);toast("success");render();});
  document.querySelector("[data-finalize-session]")?.addEventListener("click",()=>{const result=qrAttendanceService.finalizeSessionAttendance(selectedOfflineSessionId,session.accountId,{allowExceptions:true,notifyLearners:true});toast(result.ok?"success":"error");render();});
  document.querySelectorAll("[data-open-import-wizard]").forEach((el)=>el.addEventListener("click",()=>{openImportWizard(el.dataset.openImportWizard||"employees",el.dataset.importTarget||"");render();}));
  document.querySelectorAll("[data-close-import-wizard]").forEach((el)=>el.addEventListener("click",()=>{resetImportWizard();render();}));
  document.querySelector("[data-sync-participants]")?.addEventListener("click",async(event)=>{if(!selectedOfflineSessionId||!session)return;const btn=event.currentTarget;const originalText=btn.textContent;btn.disabled=true;btn.textContent="Đang đồng bộ...";const ids=offlineTrainingService.getParticipantAccountIds(selectedOfflineSessionId);_participantSyncedSessions.delete(selectedOfflineSessionId);await saveSessionParticipants(ids.length?ids:[],{mode:"replace",source:"manual-sync"});btn.disabled=false;btn.textContent=originalText;});
  document.querySelector("[data-import-file]")?.addEventListener("change",async(event)=>{const file=event.target.files?.[0];if(!file)return;importWorkbookState=await excelImportService.parseWorkbook(file);importSheetName=importWorkbookState.sheets[0]?.name||"";importHeaderRowIndex=0;importColumnMapping=excelImportService.suggestMapping(importWorkbookState.sheets[0]?.preview?.headers||[],importWizardMode);importPreviewRows=[];render();});
  document.querySelectorAll("[data-import-sheet]").forEach((el)=>el.addEventListener("click",()=>{importSheetName=el.dataset.importSheet;importColumnMapping=excelImportService.suggestMapping(excelImportService.getSheetPreview(importWorkbookState.workbook,importSheetName,importHeaderRowIndex,12).headers,importWizardMode);importPreviewRows=[];render();}));
  document.querySelectorAll("[data-import-header-row]").forEach((el)=>el.addEventListener("click",()=>{importHeaderRowIndex=Number(el.dataset.importHeaderRow);importColumnMapping=excelImportService.suggestMapping(excelImportService.getSheetPreview(importWorkbookState.workbook,importSheetName,importHeaderRowIndex,12).headers,importWizardMode);importPreviewRows=[];render();}));
  document.querySelectorAll("[data-import-map]").forEach((el)=>el.addEventListener("change",()=>{importColumnMapping={...importColumnMapping,[el.dataset.importMap]:el.value};}));
  document.querySelector("[data-import-autodetect]")?.addEventListener("click",()=>{const headers=excelImportService.getSheetPreview(importWorkbookState.workbook,importSheetName,importHeaderRowIndex,12).headers;importColumnMapping=excelImportService.suggestMapping(headers,importWizardMode);render();});
  document.querySelector("[data-build-import-preview]")?.addEventListener("click",()=>{const sheetPreview=excelImportService.getSheetPreview(importWorkbookState.workbook,importSheetName,importHeaderRowIndex,500);importPreviewRows=excelImportService.resolveRows(sheetPreview.rows,importColumnMapping,importWizardMode);render();});
  if(importWizardMode==="participants")document.querySelector("[data-confirm-import]")?.addEventListener("click",async(event)=>{event.stopImmediatePropagation();const ids=importPreviewRows.filter(row=>row.status==="valid"&&row.account).map(row=>row.account.id);const before=offlineTrainingService.listParticipants(importWizardTarget).length;selectedOfflineSessionId=importWizardTarget;const result=await saveSessionParticipants(ids,{mode:"merge",source:"excel"});if(!result.ok)return;const after=result.participants.length;resetImportWizard();openDialog({type:"alert",title:"Import người tham dự hoàn tất",body:`Đã đồng bộ ${Math.max(0,after-before)} người mới. Bỏ qua ${Math.max(0,ids.length-(after-before))} dòng trùng hoặc không hợp lệ.`});},{capture:true});
  document.querySelector("[data-confirm-import]")?.addEventListener("click",()=>{if(importWizardMode==="employees"){let created=0,updated=0,failed=0;importPreviewRows.forEach(row=>{if(row.status!=="valid"){failed++;return;}const result=employeeService.create({employeeCode:row.employeeCode,fullName:row.fullName,email:row.email,department:row.department,position:row.position,joinDate:row.joinDate,defaultLanguage:"vi",accountStatus:"active"});if(result.ok)created++;else failed++;});openDialog({type:"alert",title:"Import nhân viên hoàn tất",body:`Đã tạo: ${created} · Lỗi/Bỏ qua: ${failed}`});}else if(importWizardMode==="participants"){const ids=importPreviewRows.filter(row=>row.status==="valid"&&row.account).map(row=>row.account.id);const before=offlineTrainingService.getParticipantAccountIds(importWizardTarget).length;const result=offlineTrainingService.setParticipants(importWizardTarget,ids,session.accountId,{mode:"merge",source:"excel"});if(!result.ok)return toast("error");const after=offlineTrainingService.getParticipantAccountIds(importWizardTarget).length;openDialog({type:"alert",title:"Import người tham dự hoàn tất",body:`Đã thêm ${Math.max(0,after-before)} người mới. Bỏ qua ${Math.max(0,ids.length-(after-before))} dòng trùng hoặc không hợp lệ.`});}else if(importWizardMode==="attendance"){const sessionRow=offlineTrainingService.getSession(importWizardTarget);const slots=qrAttendanceService.getOrCreateDefaultSlots(importWizardTarget,session.accountId);if(!sessionRow||!slots.length)return toast("error");let updated=0,failed=0;importPreviewRows.forEach(row=>{if(row.status!=="valid"||!row.account){failed++;return;}const slot=slots.find(item=>item.label.toLowerCase()===normalizeAttendanceSlotLabel(row.slot).toLowerCase())||slots[0];const statusMap={attended:"manual_attended",present:"manual_attended","đã tham dự":"manual_attended",partial:"manual_partial","tham dự một phần":"manual_partial",absent:"manual_absent","vắng mặt":"manual_absent",excused:"exception","vắng có lý do":"exception"};const attendanceStatus=statusMap[String(row.attendanceStatus||"").trim().toLowerCase()]||"manual_attended";const startAt=row.checkIn?`${String(sessionRow.startAt).slice(0,10)}T${String(row.checkIn).trim()}:00+07:00`:"";const endAt=row.checkOut?`${String(sessionRow.startAt).slice(0,10)}T${String(row.checkOut).trim()}:00+07:00`:"";const result=qrAttendanceService.manualMark(slot.id,row.account.id,{attendanceStatus,checkInAt:startAt,checkOutAt:endAt,adjustmentReason:row.note||"Imported from Excel"},session.accountId);if(result.ok)updated++;else failed++;});openDialog({type:"alert",title:"Import điểm danh hoàn tất",body:`Đã cập nhật: ${updated} · Lỗi/Bỏ qua: ${failed}`});}resetImportWizard();toast("success");render();});
  if(!window.__galleryKeysBound){window.__galleryKeysBound=true;document.addEventListener("keydown",event=>{if(mediaViewerIndex<0)return;if(event.key==="Escape"){revokeGalleryUrls();mediaViewerIndex=-1;render();}if(event.key==="ArrowLeft"&&mediaViewerIndex>0){revokeGalleryUrls();mediaViewerIndex--;render();}if(event.key==="ArrowRight"){const album=galleryService.get(route.split("/").pop()),items=(album?.mediaItems||[]).filter(x=>galleryMediaFilter==="all"||x.type===galleryMediaFilter||(galleryMediaFilter==="video"&&x.type==="youtube"));if(mediaViewerIndex<items.length-1){revokeGalleryUrls();mediaViewerIndex++;render();}}});}
  document.querySelectorAll("[data-calendar-view]").forEach(el=>el.addEventListener("click",()=>{calendarView=el.dataset.calendarView;calendarSelectedDay=0;render();}));
  document.querySelectorAll("[data-calendar-month]").forEach((el)=>el.addEventListener("click",()=>{calendarMonthOffset+=Number(el.dataset.calendarMonth)||0;calendarSelectedDay=0;render();}));
  document.querySelector("[data-calendar-today]")?.addEventListener("click",()=>{calendarMonthOffset=0;calendarSelectedDay=0;render();});
  document.querySelector("[data-calendar-refresh]")?.addEventListener("click",()=>{if(session){_calendarEvents=null;_calendarLoading=false;fetchCalendarEvents(session.accountId);}});
  document.querySelector("[data-add-employee]")?.addEventListener("click",()=>{employeeFormOpen=true;employeeCreateResult=null;render();});
  document.getElementById("employeeImportFile")?.addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;openImportWizard("employees");importWorkbookState=await excelImportService.parseWorkbook(file);importSheetName=importWorkbookState.sheets[0]?.name||"";importColumnMapping=excelImportService.suggestMapping(importWorkbookState.sheets[0]?.preview?.headers||[],importWizardMode);importPreviewRows=[];render();});
  document.querySelector("[data-run-backfill]")?.addEventListener("click",runBackfill);
  document.querySelector("[data-open-selected-participants]")?.addEventListener("click",()=>{const rows=sessionParticipantAccounts(selectedOfflineSessionId);openDialog({type:"alert",title:`Danh sách người tham dự (${rows.length})`,body:rows.length?rows.map((account,index)=>`${index+1}. ${account.fullName} — ${account.department||"Không rõ phòng ban"}`).join("\n"):"Chưa có nhân viên nào được chọn."});});
  document.querySelectorAll("[data-calendar-day]").forEach((el)=>el.addEventListener("click",()=>{calendarSelectedDay=Number(el.dataset.calendarDay)||0;render();}));
  document.querySelector("[data-calendar-clear-day]")?.addEventListener("click",()=>{calendarSelectedDay=0;render();});
  initTimelineCarousel();
  document.querySelectorAll("[data-close-employee-form]").forEach(el=>el.addEventListener("click",()=>{employeeFormOpen=false;employeeCreateResult=null;render();}));
  document.getElementById("newEmployeePhoto")?.addEventListener("change",event=>{const file=event.target.files?.[0],preview=document.querySelector(".employee-photo-preview");if(!file||!preview)return;const url=URL.createObjectURL(file);preview.innerHTML=`<img src="${url}" alt="Xem trước ảnh đại diện">`;preview.querySelector("img").addEventListener("load",()=>URL.revokeObjectURL(url),{once:true});});
  document.getElementById("employeeCreateForm")?.addEventListener("submit",async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),data=Object.fromEntries(new FormData(form));button.disabled=true;button.textContent="Đang tạo...";const result=employeeService.create(data);if(!result.ok){const box=form.querySelector("[data-employee-form-error]");box.textContent=result.error==="duplicate_email"?"Email này đã được sử dụng bởi tài khoản khác.":result.error==="duplicate_code"?"Mã nhân viên này đã tồn tại.":"Vui lòng kiểm tra các trường bắt buộc.";button.disabled=false;button.textContent="Tạo hồ sơ & tài khoản";return;}const file=form.querySelector('[name="photo"]')?.files?.[0];if(file)try{await employeeService.uploadPhoto(result.employee.id,file);}catch{}employeeCreateResult=result;render();});
  document.querySelector("[data-copy-created-account]")?.addEventListener("click",()=>navigator.clipboard.writeText(`${employeeCreateResult.account.email}\n${employeeCreateResult.temporaryPassword}`).then(()=>toast("copied")));
  document.querySelector("[data-open-notifications]")?.addEventListener("click",()=>{notificationModalOpen=true;notificationPage=1;render();refreshNotificationsCache();});
  document.querySelector("[data-retraining-refresh]")?.addEventListener("click",()=>loadRetrainingReviews(true));
  document.querySelectorAll("[data-retraining-action]").forEach(el=>el.addEventListener("click",()=>retrainingAction(el.dataset.retrainingId,el.dataset.retrainingAction)));
  document.querySelectorAll("[data-open-landing-announcement]").forEach(el=>el.addEventListener("click",()=>{selectedNotificationId=el.dataset.openLandingAnnouncement;render();}));
  document.querySelectorAll("[data-close-landing-detail]").forEach(el=>el.addEventListener("click",()=>{selectedNotificationId="";render();}));
  document.querySelectorAll("[data-close-notifications]").forEach(el=>el.addEventListener("click",event=>{if(event.target!==el&&el.classList.contains("notification-overlay"))return;notificationModalOpen=false;selectedNotificationId="";render();}));
  document.querySelectorAll("[data-notification-filter]").forEach(el=>el.addEventListener("click",()=>{notificationFilter=el.dataset.notificationFilter;notificationPage=1;selectedNotificationId="";render();}));
  document.querySelectorAll("[data-notification-detail]").forEach(el=>el.addEventListener("click",()=>{selectedNotificationId=el.dataset.notificationDetail;markAsRead(selectedNotificationId);notificationService.markRead(selectedNotificationId,session.accountId).catch(()=>{});render();}));
  document.querySelector("[data-notification-back]")?.addEventListener("click",()=>{selectedNotificationId="";render();});
  document.querySelector("[data-mark-all-read]")?.addEventListener("click",()=>{getNotifications(session.accountId).forEach(n=>markAsRead(n.id));notificationService.markAllRead(session.accountId).catch(()=>{});render();});
  document.querySelectorAll("[data-notification-page]").forEach(el=>el.addEventListener("click",()=>{notificationPage=Number(el.dataset.notificationPage);render();}));
  document.querySelector("[data-notification-prev]")?.addEventListener("click",()=>{const typed=getNotifications(session.accountId).filter(n=>notificationFilter==="all"||(notificationFilter==="unread"?!n.isRead:String(n.type||"").includes(notificationFilter)));const index=typed.findIndex(n=>n.id===selectedNotificationId);if(index>0){selectedNotificationId=typed[index-1].id;markAsRead(selectedNotificationId);notificationService.markRead(selectedNotificationId,session.accountId).catch(()=>{});render();}});
  document.querySelector("[data-notification-next]")?.addEventListener("click",()=>{const typed=getNotifications(session.accountId).filter(n=>notificationFilter==="all"||(notificationFilter==="unread"?!n.isRead:String(n.type||"").includes(notificationFilter)));const index=typed.findIndex(n=>n.id===selectedNotificationId);if(index>=0&&index<typed.length-1){selectedNotificationId=typed[index+1].id;markAsRead(selectedNotificationId);notificationService.markRead(selectedNotificationId,session.accountId).catch(()=>{});render();}});
  document.querySelectorAll("[data-auth-target]").forEach(el=>el.addEventListener("click",event=>{event.preventDefault();const target=el.dataset.authTarget||"/dashboard";navigateWithAuth(target,el.dataset.authRole||"employee");}));
  document.querySelectorAll("[data-compliance-reload]").forEach((el) => el.addEventListener("click", () => {
    _compliancePrograms = null; _complianceCycles = null; _complianceOverview = null; fetchComplianceAdmin(); render();
  }));
  document.querySelector("[data-compliance-new-program]")?.addEventListener("click", () => {
    _complianceProgramFormOpen = true; _complianceActionError = ""; render();
  });
  document.querySelectorAll("[data-compliance-close]").forEach((el) => el.addEventListener("click", () => {
    _complianceProgramFormOpen = false; _complianceActionError = ""; render();
  }));
  document.getElementById("complianceProgramForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const resourceSelect = event.currentTarget.querySelector("[name=resourceId]");
    const selected = resourceSelect?.selectedOptions?.[0];
    const resourceType = selected?.dataset?.kind || String(fd.get("resourceType") || "course");
    try {
      const created = await complianceApiCall("POST", "/api/admin/compliance/programs", {
        code: fd.get("code"), title: fd.get("title"), description: fd.get("description"),
        resourceType, resourceId: fd.get("resourceId"), recurrenceType: fd.get("recurrenceType"),
        defaultDurationDays: Number(fd.get("defaultDurationDays") || 30),
        defaultPassScore: Number(fd.get("defaultPassScore") || 0),
        defaultMaxAttempts: Number(fd.get("defaultMaxAttempts") || 0),
        defaultGracePeriodDays: Number(fd.get("defaultGracePeriodDays") || 0),
        requiresRetrainingOnResourceChange: fd.get("requiresRetrainingOnResourceChange") === "on",
      });
      const targetType = String(fd.get("targetType") || "individual");
      await complianceApiCall("POST", `/api/admin/compliance/programs/${created.id}/targets`, {
        targetType,
        targetValue: targetType === "all_employees" ? null : fd.get("targetValue"),
      });
      await complianceApiCall("POST", `/api/admin/compliance/programs/${created.id}/publish`, {});
      _complianceProgramFormOpen = false; _compliancePrograms = null; _complianceCycles = null;
      await fetchComplianceAdmin();
      toast("success");
    } catch (e) {
      _complianceActionError = e.message || "request_failed"; render();
    }
  });
  document.querySelector("[data-compliance-new-cycle]")?.addEventListener("click", () => {
    _complianceCycleFormOpen = true; _complianceActionError = ""; render();
  });
  document.querySelectorAll("[data-compliance-cycle-close]").forEach((el) => el.addEventListener("click", () => {
    _complianceCycleFormOpen = false; _complianceActionError = ""; render();
  }));
  document.getElementById("complianceCycleForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    try {
      await complianceApiCall("POST", "/api/admin/compliance/cycles", {
        programId: fd.get("programId"), cycleCode: fd.get("cycleCode"), title: fd.get("title"),
        startAt: fd.get("startAt"), dueAt: fd.get("dueAt"),
        passScore: fd.get("passScore") ? Number(fd.get("passScore")) : undefined,
        maxAttempts: fd.get("maxAttempts") ? Number(fd.get("maxAttempts")) : undefined,
      });
      _complianceCycleFormOpen = false; _complianceCycles = null; await fetchComplianceAdmin(); toast("success");
    } catch (e) { _complianceActionError = e.message || "request_failed"; render(); }
  });
  document.querySelectorAll("[data-compliance-preview]").forEach((el) => el.addEventListener("click", async () => {
    try { _compliancePreview = await complianceApiCall("GET", `/api/admin/compliance/cycles/${el.dataset.compliancePreview}/preview-target`); render(); }
    catch (e) { _complianceActionError = e.message || "request_failed"; render(); }
  }));
  document.querySelectorAll("[data-compliance-activate]").forEach((el) => el.addEventListener("click", async () => {
    const id = el.dataset.complianceActivate;
    try {
      await complianceApiCall("POST", `/api/admin/compliance/cycles/${id}/activate`, {});
      await complianceApiCall("POST", `/api/admin/compliance/cycles/${id}/assign`, {});
      _complianceCycles = null; await fetchComplianceAdmin(); await fetchComplianceCycleAssignments(id); toast("success");
    } catch (e) { _complianceActionError = e.message || "request_failed"; render(); }
  }));
  document.querySelectorAll("[data-compliance-load-assignments]").forEach((el) => el.addEventListener("click", () => fetchComplianceCycleAssignments(el.dataset.complianceLoadAssignments)));
  document.querySelectorAll("[data-compliance-exempt]").forEach((el) => el.addEventListener("click", async () => {
    const reason = prompt("Nhập lý do miễn trừ");
    if (!reason) return;
    try { await complianceApiCall("POST", `/api/admin/compliance/assignments/${el.dataset.complianceExempt}/exempt`, { reason }); _complianceAssignments = {}; render(); }
    catch (e) { _complianceActionError = e.message || "request_failed"; render(); }
  }));
  document.querySelectorAll("[data-compliance-manual]").forEach((el) => el.addEventListener("click", async () => {
    const reason = prompt("Nhập lý do xác nhận thủ công");
    if (!reason) return;
    const evidence = prompt("Nhập bằng chứng/ghi chú xác nhận");
    if (!evidence) return;
    try { await complianceApiCall("POST", `/api/admin/compliance/assignments/${el.dataset.complianceManual}/manual-complete`, { reason, evidence }); _complianceAssignments = {}; render(); }
    catch (e) { _complianceActionError = e.message || "request_failed"; render(); }
  }));
  document.querySelector("[data-my-compliance-reload]")?.addEventListener("click", () => {
    _complianceMy = null; fetchMyCompliance(); render();
  });
  document.querySelectorAll("[data-compliance-start]").forEach((el) => el.addEventListener("click", async () => {
    try { await complianceApiCall("POST", `/api/compliance/my/${el.dataset.complianceStart}/start`, {}); await fetchMyComplianceDetail(el.dataset.complianceStart); }
    catch (e) { _complianceActionError = e.message || "request_failed"; render(); }
  }));
  document.querySelectorAll("[data-compliance-sync]").forEach((el) => el.addEventListener("click", async () => {
    try { await complianceApiCall("POST", `/api/compliance/my/${el.dataset.complianceSync}/sync`, {}); await fetchMyComplianceDetail(el.dataset.complianceSync); toast("success"); }
    catch (e) { _complianceActionError = e.message || "RESOURCE_NOT_COMPLETED"; render(); }
  }));
  document.querySelector("[data-create-album]")?.addEventListener("click",()=>{selectedAlbumId="";galleryEditorOpen=true;render();});
  document.querySelectorAll("[data-edit-album]").forEach(el=>el.addEventListener("click",()=>{selectedAlbumId=el.dataset.editAlbum;galleryEditorOpen=true;render();}));
  document.querySelectorAll("[data-close-album-editor]").forEach(el=>el.addEventListener("click",()=>{galleryEditorOpen=false;selectedAlbumId="";render();}));
  document.getElementById("albumEditorForm")?.addEventListener("submit",event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));data.createdBy=session.accountId;data.allowDownload=new FormData(event.currentTarget).get("allowDownload")==="on";const result=galleryService.save(data);if(!result.ok)return toast("error");selectedAlbumId=result.album.id;galleryEditorOpen=true;toast("success");render();});
  document.getElementById("albumFiles")?.addEventListener("change",async event=>{const button=document.querySelector('#albumEditorForm [type="submit"]');if(button){button.disabled=true;button.textContent="Đang lưu media...";}const result=await galleryService.addFiles(selectedAlbumId,[...event.target.files]);toast(result.ok?"success":"error");render();});
  document.querySelector("[data-add-youtube]")?.addEventListener("click",()=>{const result=galleryService.addYoutube(selectedAlbumId,document.querySelector("[data-youtube-url]")?.value,document.querySelector("[data-youtube-caption]")?.value);toast(result.ok?"success":"error");if(result.ok)render();});
  document.querySelectorAll("[data-remove-album-media]").forEach(el=>el.addEventListener("click",async()=>{await galleryService.removeMedia(selectedAlbumId,el.dataset.removeAlbumMedia);render();}));
  document.querySelectorAll("[data-media-filter]").forEach(el=>el.addEventListener("click",()=>{galleryMediaFilter=el.dataset.mediaFilter;mediaViewerIndex=-1;render();}));
  document.querySelectorAll("[data-open-media]").forEach(el=>el.addEventListener("click",()=>{mediaViewerIndex=Number(el.dataset.openMedia);render();}));
  document.querySelector("[data-close-media]")?.addEventListener("click",()=>{revokeGalleryUrls();mediaViewerIndex=-1;render();});
  document.querySelectorAll("[data-media-index]").forEach(el=>el.addEventListener("click",()=>{revokeGalleryUrls();mediaViewerIndex=Number(el.dataset.mediaIndex);render();}));
  document.getElementById("galleryForm")?.addEventListener("submit",event=>{event.preventDefault();const f=new FormData(event.currentTarget),rows=readLocalRows(GALLERY_KEY);rows.unshift({id:crypto.randomUUID(),title:String(f.get("title")).trim(),description:String(f.get("description")||""),coverUrl:String(f.get("coverUrl")||""),coverAlt:String(f.get("description")||f.get("title")),courseId:String(f.get("courseId")||""),departmentNames:[],visibility:String(f.get("visibility")),status:"published",eventDate:String(f.get("eventDate")),createdBy:session.accountId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),images:[]});writeLocalRows(GALLERY_KEY,rows);toast("success");render();});
  document.querySelectorAll("[data-gallery-toggle]").forEach(el=>el.addEventListener("click",()=>{const row=galleryService.get(el.dataset.galleryToggle);if(row){galleryService.save({...row,status:row.status==="published"?"archived":"published"});render();}}));
  document.querySelector("[data-gallery-search]")?.addEventListener("input",debounce(e=>{gallerySearch=e.target.value;render();},180));
  document.querySelector("[data-gallery-year]")?.addEventListener("change",e=>{galleryYear=e.target.value;render();});
  document.querySelector("[data-resource-search]")?.addEventListener("input",debounce(e=>{resourceSearch=e.target.value;render();},180));
  document.querySelectorAll("[data-resource-open]").forEach(el=>el.addEventListener("click",event=>{const r=resourceRows().find(x=>x.id===el.dataset.resourceOpen),e=employeeEnrollments().find(x=>x.courseId===r?.courseId);if(!r||!e||!isResourceUnlocked(r,e)){event.preventDefault();toast("error");return;}logLearningActivity({actorAccountId:session.accountId,accountId:session.accountId,courseId:r.courseId,eventType:"resource_downloaded",metadata:{resourceId:r.id}});}));
  document.querySelectorAll("[data-report-export-format]").forEach(el=>el.addEventListener("click",()=>exportReportFile(el.dataset.reportExportFormat)));
  document.querySelectorAll("[data-report-tab]").forEach(el=>el.addEventListener("click",()=>{reportActiveType=el.dataset.reportTab;reportPage=1;reportData=null;reportLoadedKey="";syncReportUrl();loadReports(true);}));
  document.querySelector("[data-report-range]")?.addEventListener("change",e=>{reportDateRange=e.target.value;if(reportDateRange!=="custom"){reportDateFrom="";reportDateTo="";reportPage=1;reportData=null;reportLoadedKey="";syncReportUrl();loadReports(true);}else render();});
  document.querySelector("[data-report-dept]")?.addEventListener("input",debounce(e=>{reportDeptFilter=e.target.value;reportPage=1;reportData=null;reportLoadedKey="";syncReportUrl();loadReports(true);},300));
  document.querySelector("[data-report-course]")?.addEventListener("input",debounce(e=>{reportCourseFilter=e.target.value;reportPage=1;reportData=null;reportLoadedKey="";syncReportUrl();loadReports(true);},300));
  document.querySelector("[data-report-status]")?.addEventListener("change",e=>{reportStatusFilter=e.target.value;reportPage=1;reportData=null;reportLoadedKey="";syncReportUrl();loadReports(true);});
  document.getElementById("reportApply")?.addEventListener("click",()=>{reportDateFrom=document.getElementById("reportFrom")?.value||"";reportDateTo=document.getElementById("reportTo")?.value||"";reportPage=1;reportData=null;reportLoadedKey="";syncReportUrl();loadReports(true);});
  document.getElementById("reportReset")?.addEventListener("click",()=>{reportDateRange="30d";reportDateFrom="";reportDateTo="";reportDeptFilter="";reportCourseFilter="";reportStatusFilter="";reportPage=1;reportData=null;reportLoadedKey="";syncReportUrl();loadReports(true);});
  document.querySelector("[data-report-retry]")?.addEventListener("click",()=>loadReports(true));
  document.querySelectorAll("[data-report-page]").forEach(el=>el.addEventListener("click",()=>{reportPage=Math.max(1,Number(el.dataset.reportPage)||1);reportData=null;reportLoadedKey="";syncReportUrl();loadReports(true);}));
  document.getElementById("employeePhotoFolder")?.addEventListener("change",async event=>{const files=[...(event.target.files||[])].filter(file=>["image/jpeg","image/png","image/webp"].includes(file.type));const employees=getEmployees(),byCode=new Map(employees.map(employee=>{const account=employee.accountId?getAccountById(employee.accountId):null;return [String(account?.employeeCode||"").toLowerCase(),employee];}).filter(([code])=>code));const matched=[],unmatched=[];for(const file of files){const stem=file.name.replace(/\.[^.]+$/,"").toLowerCase();const employee=byCode.get(stem);if(employee)matched.push({file,employee});else unmatched.push(file.name);}if(!matched.length)return toast("error");const doPhotoImport=async()=>{for(const {file,employee} of matched){try{const photoBlobId=await saveEmployeePhoto(file);if(employee.photoBlobId)await deleteEmployeePhoto(employee.photoBlobId);updateEmployeeProfile(employee.id,{photoBlobId,photoFileName:file.name,photoUpdatedAt:new Date().toISOString(),photoUpdatedBy:session.accountId});}catch{}}}; openDialog({type:"confirm",title:"Xác nhận import ảnh",body:`${matched.length} file khớp thành công · ${unmatched.length} không tìm thấy nhân viên.`,onConfirm:()=>doPhotoImport().then(()=>{toast("success");render();})});});
  document.querySelector("[data-notification-create]")?.addEventListener("click",()=>{notificationComposerOpen=true;render();});
  document.querySelectorAll("[data-archive-notification]").forEach(el=>el.addEventListener("click",async ()=>{const id=el.dataset.archiveNotification;openDialog({type:"confirm",title:"Xóa thông báo",body:"Thông báo sẽ được lưu trữ và không còn hiển thị trong danh sách lịch sử.",onConfirm:async ()=>{el.disabled=true;el.textContent="...";try{if(!archiveNotificationCampaign(id))throw new Error("archive_failed");addSecurityAuditLog({action:"archive_notification",targetAccountId:id,description:""});toast("success");notificationMonitor=null;render();}catch{e=>{toast("error");el.disabled=false;el.textContent="🗑";}}}});}));
  document.querySelector("[data-notification-monitor-refresh]")?.addEventListener("click",()=>{notificationMonitor=null;loadNotificationMonitor(true);});
  document.querySelector("[data-run-reminders]")?.addEventListener("click",async()=>{const result=await notificationService.runReminders();notificationMonitor=null;await loadNotificationMonitor(true);toast(result?.ok?"success":"error");});
  document.querySelector("[data-audit-refresh]")?.addEventListener("click",()=>{auditState.overview=null;loadAuditLogs(true);});
  document.querySelector("[data-audit-filter]")?.addEventListener("submit",event=>{event.preventDefault();const form=new FormData(event.currentTarget);for(const key of Object.keys(auditFilters))if(form.has(key))auditFilters[key]=form.get(key);auditState.page=1;auditState.rows=[];loadAuditLogs(true);});
  document.querySelectorAll("[data-audit-page]").forEach(el=>el.addEventListener("click",()=>{auditState.page=Math.max(1,Number(el.dataset.auditPage)||1);auditState.rows=[];loadAuditLogs(true);}));
  document.querySelectorAll("[data-audit-detail]").forEach(el=>el.addEventListener("click",()=>openAuditDetail(el.dataset.auditDetail)));
  document.querySelector("[data-audit-close]")?.addEventListener("click",()=>{auditState.detail=null;render();});
  document.querySelectorAll("[data-copy]").forEach(el=>el.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(el.dataset.copy||"");toast("success");}catch{toast("error");}}));
  document.querySelectorAll("[data-audit-export]").forEach(el=>el.addEventListener("click",async()=>{try{const format=el.dataset.auditExport;const blob=await auditService.export(format,auditFilters);const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`audit-logs.${format}`;a.click();URL.revokeObjectURL(url);toast("success");loadAuditLogs(true);}catch{auditState.error=auditText("exportError");render();}}));
  document.querySelectorAll("[data-notification-close]").forEach(el=>el.addEventListener("click",()=>{notificationComposerOpen=false;render();}));
  document.querySelectorAll("[data-refresh-hr-overview]").forEach(el => el.addEventListener("click", () => fetchHrOverview()));
  document.querySelectorAll("[data-hr-overview-tab]").forEach(el=>el.addEventListener("click",()=>{_hrOverviewTab=el.dataset.hrOverviewTab;render();}));
  document.querySelectorAll("[data-hr-task-filter]").forEach(el=>el.addEventListener("click",()=>{_hrTaskFilter=el.dataset.hrTaskFilter;render();}));
  document.querySelector(".adm-user-menu-trigger")?.addEventListener("click", e => { e.currentTarget.closest(".adm-user-menu")?.classList.toggle("adm-user-menu--open"); });
  document.querySelectorAll("[data-hr-task-status]").forEach(el=>el.addEventListener("click",async()=>{try{el.disabled=true;await updateHrTaskStatus(el.dataset.hrTaskStatus,el.dataset.status);toast("success");}catch{toast("error");render();}}));

  // HR support request modal handlers (delegated)
  document.querySelectorAll("[data-view-support-request]").forEach(el => el.addEventListener("click", async () => {
    _hrSupportModal = null; _hrSupportLoading = true; _hrSupportError = ""; _hrSupportPasswordResult = "";
    _hrSupportRejectOpen = false; _hrSupportRejectNote = ""; render();
    try {
      const res = await fetch(`/api/admin/account-support/requests/${el.dataset.viewSupportRequest}`, { headers: apiHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "load_failed");
      _hrSupportModal = { id: el.dataset.viewSupportRequest, data: body.request, previousRequests: body.previousRequests || [], showResetForm: false, resetMode: "auto" };
    } catch (err) { _hrSupportError = err.message; }
    _hrSupportLoading = false; render();
  }));

  document.addEventListener("click", async (e) => {
    // Close HR support modal
    if (e.target.closest("[data-close-hr-support]")) {
      _hrSupportModal = null; _hrSupportLoading = false; _hrSupportError = ""; _hrSupportPasswordResult = "";
      _hrSupportRejectOpen = false; render(); return;
    }
    // Accept request
    const acceptBtn = e.target.closest("[data-support-accept]");
    if (acceptBtn && _hrSupportModal) {
      try {
        const res = await fetch(`/api/admin/account-support/requests/${_hrSupportModal.id}/status`, {
          method: "PATCH", headers: apiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ status: "in_progress" }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { _hrSupportError = body.error || "Lỗi tiếp nhận"; render(); return; }
        _hrSupportModal.data.status = "in_progress"; _hrSupportModal.data.statusLabel = "Đang xử lý";
        toast("success"); render();
      } catch { _hrSupportError = "Lỗi kết nối"; render(); }
      return;
    }
    // Open reset password form
    if (e.target.closest("[data-support-open-reset]") && _hrSupportModal) {
      _hrSupportModal = { ..._hrSupportModal, showResetForm: true, resetMode: "auto" };
      _hrSupportPasswordResult = ""; render(); return;
    }
    // Cancel reset form
    if (e.target.closest("[data-support-cancel-reset]") && _hrSupportModal) {
      _hrSupportModal = { ..._hrSupportModal, showResetForm: false }; render(); return;
    }
    // Toggle reset mode
    const modeInput = e.target.closest("input[name='resetMode']");
    if (modeInput && _hrSupportModal) {
      _hrSupportModal = { ..._hrSupportModal, resetMode: modeInput.value }; render(); return;
    }
    // Confirm reset password
    const resetBtn = e.target.closest("[data-support-do-reset]");
    if (resetBtn && _hrSupportModal) {
      _hrSupportActionLoading = true; _hrSupportError = ""; render();
      try {
        let newPassword;
        if (_hrSupportModal.resetMode === "manual") {
          newPassword = document.getElementById("supportTempPwd")?.value || "";
          if (newPassword.length < 6) { _hrSupportError = "Mật khẩu tạm phải có ít nhất 6 ký tự."; _hrSupportActionLoading = false; render(); return; }
        } else {
          // Auto-generate: 12 chars
          const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
          newPassword = Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => chars[b % chars.length]).join("");
        }
        const res = await fetch(`/api/admin/account-support/requests/${_hrSupportModal.id}/reset-password`, {
          method: "POST", headers: apiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ newPassword, requireChange: true }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { _hrSupportError = body.message || body.error || "Lỗi tạo mật khẩu"; _hrSupportActionLoading = false; render(); return; }
        _hrSupportPasswordResult = newPassword; // display once
        _hrSupportModal = { ..._hrSupportModal, showResetForm: false, data: { ..._hrSupportModal.data, status: "done", statusLabel: "Đã hoàn tất" } };
        toast("success"); fetchHrOverview({ silent: true });
      } catch { _hrSupportError = "Lỗi kết nối"; }
      _hrSupportActionLoading = false; render(); return;
    }
    // Copy temp password
    const copyPwdBtn = e.target.closest("[data-copy-support-password]");
    if (copyPwdBtn) {
      navigator.clipboard?.writeText(copyPwdBtn.dataset.copySupportPassword || "").then(() => toast("success"), () => {});
      return;
    }
    // Unlock account
    const unlockBtn = e.target.closest("[data-support-unlock]");
    if (unlockBtn && _hrSupportModal) {
      _hrSupportActionLoading = true; _hrSupportError = ""; render();
      try {
        const res = await fetch(`/api/admin/account-support/requests/${_hrSupportModal.id}/unlock`, {
          method: "POST", headers: apiHeaders({ "Content-Type": "application/json" }), body: "{}",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { _hrSupportError = body.error || "Lỗi mở khóa"; _hrSupportActionLoading = false; render(); return; }
        _hrSupportModal = { ..._hrSupportModal, data: { ..._hrSupportModal.data, status: "done", statusLabel: "Đã hoàn tất" } };
        toast("success"); fetchHrOverview({ silent: true });
      } catch { _hrSupportError = "Lỗi kết nối"; }
      _hrSupportActionLoading = false; render(); return;
    }
    // Reactivate account
    const reactivateBtn = e.target.closest("[data-support-reactivate]");
    if (reactivateBtn && _hrSupportModal) {
      _hrSupportActionLoading = true; _hrSupportError = ""; render();
      try {
        const res = await fetch(`/api/admin/account-support/requests/${_hrSupportModal.id}/reactivate`, {
          method: "POST", headers: apiHeaders({ "Content-Type": "application/json" }), body: "{}",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { _hrSupportError = body.error || "Lỗi kích hoạt"; _hrSupportActionLoading = false; render(); return; }
        _hrSupportModal = { ..._hrSupportModal, data: { ..._hrSupportModal.data, status: "done", statusLabel: "Đã hoàn tất" } };
        toast("success"); fetchHrOverview({ silent: true });
      } catch { _hrSupportError = "Lỗi kết nối"; }
      _hrSupportActionLoading = false; render(); return;
    }
    // Open reject form
    if (e.target.closest("[data-support-reject-open]") && _hrSupportModal) {
      _hrSupportRejectOpen = true; _hrSupportRejectNote = ""; render(); return;
    }
    // Cancel reject form
    if (e.target.closest("[data-support-reject-cancel]")) { _hrSupportRejectOpen = false; render(); return; }
    // Confirm reject
    const rejectBtn = e.target.closest("[data-support-do-reject]");
    if (rejectBtn && _hrSupportModal) {
      const note = document.getElementById("rejectNoteInput")?.value || "";
      _hrSupportActionLoading = true; _hrSupportError = ""; render();
      try {
        const res = await fetch(`/api/admin/account-support/requests/${_hrSupportModal.id}/reject`, {
          method: "POST", headers: apiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ resolutionNote: note }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { _hrSupportError = body.error || "Lỗi từ chối"; _hrSupportActionLoading = false; render(); return; }
        _hrSupportModal = { ..._hrSupportModal, data: { ..._hrSupportModal.data, status: "rejected", statusLabel: "Đã từ chối", resolutionNote: note } };
        _hrSupportRejectOpen = false; toast("success"); fetchHrOverview({ silent: true });
      } catch { _hrSupportError = "Lỗi kết nối"; }
      _hrSupportActionLoading = false; render(); return;
    }
  });
  { let composing=false; const el=document.querySelector("[data-notification-search]"); el?.addEventListener("compositionstart",()=>composing=true); el?.addEventListener("compositionend",e=>{composing=false;notificationSearch=e.target.value;render();}); el?.addEventListener("input",debounce(e=>{if(!composing){notificationSearch=e.target.value;render();}},180)); }
  document.getElementById("notificationForm")?.addEventListener("submit",async event=>{event.preventDefault();const form=new FormData(event.currentTarget);const type=form.get("recipientType"),value=form.get("recipientValue");const recipientIds=notificationRecipients(type,value);const payload={title:form.get("title"),body:form.get("body"),type:form.get("type"),recipientType:type,recipientIds,actionUrl:form.get("actionUrl"),createdBy:session.accountId};const result=sendNotificationCampaign(payload);const apiResult=await notificationService.create({notifications:recipientIds.map((recipientId,index)=>({account_id:recipientId,type:form.get("type"),title:form.get("title"),body:form.get("body"),link:form.get("actionUrl"),entity_type:"manual_notification",entity_id:`manual-${Date.now()}-${index}`,data:{recipientType:type,recipientValue:value||""}}))});if(result.ok||apiResult?.ok){notificationComposerOpen=false;notificationMonitor=null;toast("success");render();loadNotificationMonitor(true);}else toast("error");});
  document.getElementById("courseCoverInput")?.addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{const id=await saveCourseImage(file);const hidden=document.querySelector('[name="coverImageId"]');if(hidden)hidden.value=id;const image=document.querySelector("[data-course-image-preview]");if(image){if(image.dataset.objectUrl)URL.revokeObjectURL(image.dataset.objectUrl);const url=URL.createObjectURL(file);image.src=url;image.dataset.objectUrl=url;}}catch{toast("error");}});
  document.querySelectorAll("[data-link]").forEach((el) => el.addEventListener("click", (event) => { event.preventDefault(); navigate(el.getAttribute("href")); }));
function setupPageSpecificHandlers() {
  // Competency handlers
  document.querySelector("[data-competency-reload]")?.addEventListener("click",()=>{_competencyState.catalog=null;loadCompetencyCatalog(true);});
  document.querySelector("[data-skills-reload]")?.addEventListener("click",()=>{_competencyState.matrix=null;loadSkillsMatrix(true);});
  document.querySelector("[data-plans-reload]")?.addEventListener("click",()=>{_competencyState.plans=[];loadDevelopmentPlans(true);});
  document.querySelector("[data-my-skills-reload]")?.addEventListener("click",()=>{_competencyState.my=null;loadMyCompetencies(true);});
  document.querySelector("[data-my-plans-reload]")?.addEventListener("click",()=>{_competencyState.myPlans=[];loadMyDevelopmentPlans(true);});
  { let compSearchComposing=false; const el=document.querySelector("[data-competency-search]"); el?.addEventListener("compositionstart",()=>compSearchComposing=true); el?.addEventListener("compositionend",e=>{compSearchComposing=false;_competencyState.q=e.target.value;_competencyState.catalog=null;loadCompetencyCatalog(true);}); el?.addEventListener("input",debounce(e=>{if(compSearchComposing)return;_competencyState.q=e.target.value;_competencyState.catalog=null;loadCompetencyCatalog(true);},250)); }
  document.getElementById("competencyCreateForm")?.addEventListener("submit",async event=>{event.preventDefault();try{const fd=new FormData(event.currentTarget);let categoryId="";const categoryName=String(fd.get("categoryName")||"").trim();if(categoryName){const cat=await apiJson("/api/admin/competencies/categories",{method:"POST",body:JSON.stringify({code:`cat-${Date.now()}`,name:categoryName})});categoryId=cat.data?.id||"";}const comp=await apiJson("/api/admin/competencies",{method:"POST",body:JSON.stringify({categoryId,code:fd.get("code"),name:fd.get("name"),description:fd.get("description")})});const levels=[["0","Chưa có",0],["1","Nhận biết",1],["2","Cơ bản",2],["3","Thành thạo",3],["4","Nâng cao",4],["5","Chuyên gia",5]];for(const [code,name,rank] of levels){await apiJson(`/api/admin/competencies/${comp.data.id}/levels`,{method:"POST",body:JSON.stringify({code,name,rank})});}await apiJson(`/api/admin/competencies/${comp.data.id}/activate`,{method:"POST",body:"{}"});_competencyState.catalog=null;toast("success");loadCompetencyCatalog(true);}catch(e){toast(e.message||"error");}});
  document.getElementById("competencyRequirementForm")?.addEventListener("submit",async event=>{event.preventDefault();try{const fd=new FormData(event.currentTarget);await apiJson("/api/admin/competencies/requirements",{method:"POST",body:JSON.stringify(Object.fromEntries(fd.entries()))});_competencyState.catalog=null;_competencyState.matrix=null;toast("success");loadCompetencyCatalog(true);}catch(e){toast(e.message||"error");}});
  document.getElementById("competencyMappingForm")?.addEventListener("submit",async event=>{event.preventDefault();try{const fd=new FormData(event.currentTarget);await apiJson("/api/admin/competencies/mappings",{method:"POST",body:JSON.stringify(Object.fromEntries(fd.entries()))});_competencyState.catalog=null;toast("success");loadCompetencyCatalog(true);}catch(e){toast(e.message||"error");}});
  document.querySelectorAll("[data-competency-status]").forEach(el=>el.addEventListener("click",async()=>{try{await apiJson(`/api/admin/competencies/${el.dataset.competencyId}/${el.dataset.competencyStatus}`,{method:"POST",body:"{}"});_competencyState.catalog=null;toast("success");loadCompetencyCatalog(true);}catch(e){toast(e.message||"error");}}));
  document.querySelector("[data-skills-filter]")?.addEventListener("submit",event=>{event.preventDefault();const fd=new FormData(event.currentTarget);_competencyState.department=String(fd.get("department")||"");_competencyState.employeeId=String(fd.get("employeeId")||"");_competencyState.matrixPage=1;_competencyState.matrix=null;loadSkillsMatrix(true);});
  document.querySelectorAll("[data-matrix-page]").forEach(el=>el.addEventListener("click",()=>{_competencyState.matrixPage=Math.max(1,Number(el.dataset.matrixPage)||1);_competencyState.matrix=null;loadSkillsMatrix(true);}));
  document.querySelectorAll("[data-skills-export]").forEach(el=>el.addEventListener("click",async()=>{const format=el.dataset.skillsExport||"csv";const params=new URLSearchParams({format,pageSize:"500"});if(_competencyState.department)params.set("department",_competencyState.department);if(_competencyState.employeeId)params.set("employee",_competencyState.employeeId);try{const res=await fetch(`/api/admin/skills-matrix/export?${params}`,{headers:apiHeaders()});if(!res.ok)throw new Error(await res.text());const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`skills-matrix.${format==="xlsx"?"xlsx":"csv"}`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){toast(e.message||"error");}}));
  document.getElementById("developmentPlanForm")?.addEventListener("submit",async event=>{event.preventDefault();try{const fd=new FormData(event.currentTarget);await apiJson("/api/admin/development-plans",{method:"POST",body:JSON.stringify(Object.fromEntries(fd.entries()))});_competencyState.plans=[];toast("success");loadDevelopmentPlans(true);}catch(e){toast(e.message||"error");}});
  document.querySelectorAll("[data-plan-item-form]").forEach(form=>form.addEventListener("submit",async event=>{event.preventDefault();try{const fd=new FormData(form);await apiJson(`/api/admin/development-plans/${form.dataset.planItemForm}/items`,{method:"POST",body:JSON.stringify(Object.fromEntries(fd.entries()))});_competencyState.plans=[];toast("success");loadDevelopmentPlans(true);}catch(e){toast(e.message||"error");}}));
  document.querySelectorAll("[data-plan-action]").forEach(el=>el.addEventListener("click",async()=>{try{await apiJson(`/api/admin/development-plans/${el.dataset.planId}/${el.dataset.planAction}`,{method:"POST",body:"{}"});_competencyState.plans=[];toast("success");loadDevelopmentPlans(true);}catch(e){toast(e.message||"error");}}));
  document.querySelectorAll("[data-self-assessment]").forEach(form=>form.addEventListener("submit",async event=>{event.preventDefault();try{const fd=new FormData(form);await apiJson(`/api/competencies/my/${form.dataset.selfAssessment}/self-assessment`,{method:"POST",body:JSON.stringify(Object.fromEntries(fd.entries()))});_competencyState.my=null;toast("success");loadMyCompetencies(true);}catch(e){toast(e.message||"error");}}));

  // ─── Training Tracking event bindings ─────────────────────────────────
  if (route === "/admin/training-tracking") {
  document.querySelector("[data-tt-create]")?.addEventListener("click", () => { _ttEditId = ""; _ttFormOpen = true; render(); });
  document.querySelectorAll("[data-tt-edit]").forEach(el => el.addEventListener("click", () => { _ttEditId = el.dataset.ttEdit; _ttFormOpen = true; render(); }));
  document.querySelectorAll("[data-tt-view]").forEach(el => el.addEventListener("click", async () => {
    try { const res = await fetch(`/api/admin/training-tracking/${el.dataset.ttView}`, { headers: ttApiHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "load_failed");
      _ttDetail = body.data; _ttDrawerOpen = true; render();
    } catch (e) { toast("Lỗi: " + e.message); }
  }));
  document.querySelectorAll("[data-tt-archive]").forEach(el => el.addEventListener("click", () => archiveTrainingRecord(el.dataset.ttArchive)));
  document.querySelector("[data-tt-close-form]")?.addEventListener("click", () => { _ttFormOpen = false; _ttEditId = ""; render(); });
  document.querySelector("[data-tt-close-drawer]")?.addEventListener("click", () => { _ttDrawerOpen = false; _ttDetail = null; render(); });
  document.getElementById("ttForm")?.addEventListener("submit", submitTtForm);
  { let ttsComposing = false; const el = document.querySelector("[data-tt-search]");
    el?.addEventListener("compositionstart", () => ttsComposing = true);
    el?.addEventListener("compositionend", e => { ttsComposing = false; _ttFilters.search = e.target.value; loadTrainingTracking({ renderMode: "section" }); });
    el?.addEventListener("input", debounce(e => { if (ttsComposing) return; _ttFilters.search = e.target.value; loadTrainingTracking({ renderMode: "section" }); }, 250)); }
  document.querySelector("[data-tt-filter-dept]")?.addEventListener("change", e => { _ttFilters.department = e.target.value; loadTrainingTracking(); });
  document.querySelector("[data-tt-filter-cat]")?.addEventListener("change", e => { _ttFilters.category = e.target.value; loadTrainingTracking(); });
  document.querySelector("[data-tt-filter-status]")?.addEventListener("change", e => { _ttFilters.status = e.target.value; loadTrainingTracking(); });
  bindTrainingTrackingResultEvents(document);
  }

  // ─── CCHN Registration event bindings ─────────────────────────────────
  if (route === "/admin/cchn-registrations") {
  document.querySelector("[data-cchn-create]")?.addEventListener("click", () => { _cchnEditId = ""; _cchnFormOpen = true; render(); });
  document.querySelectorAll("[data-cchn-edit]").forEach(el => el.addEventListener("click", () => { _cchnEditId = el.dataset.cchnEdit; _cchnFormOpen = true; render(); }));
  document.querySelectorAll("[data-cchn-view]").forEach(el => el.addEventListener("click", async () => {
    try { const res = await fetch(`/api/admin/cchn/registrations/${el.dataset.cchnView}`, { headers: ttApiHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "load_failed");
      _cchnDetail = body.data; _cchnDrawerOpen = true; render();
    } catch (e) { toast("Lỗi: " + e.message); }
  }));
  document.querySelectorAll("[data-cchn-cancel]").forEach(el => el.addEventListener("click", () => cancelCchnRegistration(el.dataset.cchnCancel)));
  document.querySelector("[data-cchn-close-form]")?.addEventListener("click", () => { _cchnFormOpen = false; _cchnEditId = ""; render(); });
  document.querySelector("[data-cchn-close-drawer]")?.addEventListener("click", () => { _cchnDrawerOpen = false; _cchnDetail = null; render(); });
  document.getElementById("cchnForm")?.addEventListener("submit", submitCchnForm);
  document.querySelector("[data-cchn-add-item]")?.addEventListener("click", () => { _cchnAddItemOpen = true; render(); });
  document.querySelector("[data-cchn-close-add]")?.addEventListener("click", () => { _cchnAddItemOpen = false; render(); });
  document.getElementById("cchnAddItemForm")?.addEventListener("submit", submitCchnAddItem);
  { let cchnsComposing = false; const el = document.querySelector("[data-cchn-search]");
    el?.addEventListener("compositionstart", () => cchnsComposing = true);
    el?.addEventListener("compositionend", e => { cchnsComposing = false; _cchnFilters.search = e.target.value; loadCchnRegistrations({ renderMode: "section" }); });
    el?.addEventListener("input", debounce(e => { if (cchnsComposing) return; _cchnFilters.search = e.target.value; loadCchnRegistrations({ renderMode: "section" }); }, 250)); }
  document.querySelector("[data-cchn-filter-dept]")?.addEventListener("change", e => { _cchnFilters.department = e.target.value; loadCchnRegistrations(); });
  document.querySelector("[data-cchn-filter-status]")?.addEventListener("change", e => { _cchnFilters.status = e.target.value; loadCchnRegistrations(); });
  bindCchnRegistrationResultEvents(document);
  }
}

  document.querySelector("[data-logout]")?.addEventListener("click", () => {
    sendActivityHeartbeat("logout");
    sessionService.endSession();
    session = null;
    _calendarEvents = null;
    _calendarLoading = false;
    _calendarError = null;
    _calendarAccountId = "";
    _calendarLoadedAt = 0;
    _recentlySyncedParticipants = new Set();
    _courses = null; _coursesLoading = false; _coursesError = null; _coursesAccountId = "";
    _enrollments = null; _enrollmentsLoading = false; _enrollmentsAccountId = "";
    _offlineTrainingLoadedFor = "";
    invalidateOfflineTrainingCache();
    _hrOverview = null; _hrOverviewError = ""; _hrOverviewLoadedAt = 0;
    clearInterval(_hrOverviewPollId);
    clearInterval(_activityHeartbeatId);
    navigate("/login");
    toast(uiText("logoutSuccess"));
  });
  document.querySelectorAll("[data-language]").forEach((el) => el.addEventListener("click", () => {if(language===el.dataset.language)return;const main=document.querySelector(".app-main,.landing-page,.auth-page,.public-outer");main?.classList.add("i18n-transition");setTimeout(()=>{language=el.dataset.language;saveLanguage(language);render();requestAnimationFrame(()=>document.querySelector(".app-main,.landing-page,.auth-page,.public-outer")?.classList.add("i18n-enter"));},120);}));
  document.querySelector("[data-quiz-create]")?.addEventListener("click",()=>{quizFormOpen=true;selectedQuizId="";quizBuilderQuestions=[];quizBuilderCollapsed={};quizAddingQType=false;render();});
  document.querySelectorAll("[data-quiz-edit]").forEach(el=>el.addEventListener("click",()=>{quizFormOpen=true;selectedQuizId=el.dataset.quizEdit;quizBuilderQuestions=structuredClone(getQuizById(selectedQuizId)?.questions||[]);quizBuilderCollapsed={};quizAddingQType=false;render();}));
  document.querySelectorAll("[data-quiz-close]").forEach(el=>el.addEventListener("click",()=>{quizFormOpen=false;selectedQuizId="";quizAddingQType=false;render();}));
  document.querySelectorAll("[data-quiz-delete]").forEach(el=>el.addEventListener("click",()=>{if(deleteQuiz(el.dataset.quizDelete,session?.accountId)){toast("success");render();}else toast("error");}));
  document.querySelectorAll("[data-quiz-admin-view]").forEach(el=>el.addEventListener("click",()=>{quizAdminView=el.dataset.quizAdminView;render();}));
  { let _qsc = false;
    const el = document.getElementById("quizSearchInput");
    el?.addEventListener("compositionstart", () => { _qsc = true; });
    el?.addEventListener("compositionend", debounce((e) => { _qsc = false; quizSearch = e.target.value; render(); }, 30));
    el?.addEventListener("input", debounce((e) => { if (_qsc) return; quizSearch = e.target.value; render(); }, 180));
  }
  document.querySelector("[data-quiz-course-filter]")?.addEventListener("change",e=>{quizCourseFilter=e.target.value;render();});
  document.querySelector("[data-quiz-status-filter]")?.addEventListener("change",e=>{quizStatusFilter=e.target.value;render();});
  document.querySelector("[data-add-question]")?.addEventListener("click",()=>{quizBuilderQuestions=readQuestionEditors();quizAddingQType=true;render();});
  document.querySelector("[data-import-quiz-json]")?.addEventListener("click",()=>{try{const value=JSON.parse(document.querySelector("[data-quiz-json]")?.value||"");if(!Array.isArray(value))throw new Error();const valid=value.every(q=>q&&typeof q.text==="string"&&["singleChoice","multipleChoice","trueFalse","text"].includes(q.type)&&Number(q.points)>0&&(q.type==="text"||(Array.isArray(q.options)&&q.options.length>=2&&q.options.every(o=>typeof o==="string"||typeof o?.text==="string")&&(q.type==="multipleChoice"?Array.isArray(q.correctOptionIds)&&q.correctOptionIds.length>0:Boolean(q.correctOptionId)))));if(!valid)throw new Error();quizBuilderQuestions=value.map((q,i)=>({...q,id:q.id||`import-q-${Date.now()}-${i}`,options:(q.options||[]).map((o,j)=>typeof o==="string"?{id:`import-q-${Date.now()}-${i}-o${j+1}`,text:o}:o)}));toast("success");render();}catch{toast(t("quiz.invalidJson"));}});
  document.getElementById("quizForm")?.addEventListener("submit",(event)=>{event.preventDefault();if(!hasAdminAccess())return toast("error");quizBuilderQuestions=readQuestionEditors();const d=new FormData(event.currentTarget);const payload={courseId:String(d.get("courseId")),title:String(d.get("title")).trim(),description:String(d.get("description")||""),status:String(d.get("status")),passingScore:Number(d.get("passingScore")),timeLimitMinutes:Number(d.get("timeLimitMinutes")),attemptsAllowed:Number(d.get("attemptsAllowed")),shuffleQuestions:false,requireCourseCompletion:d.get("requireCourseCompletion")==="on",prerequisiteQuizId:String(d.get("prerequisiteQuizId")||""),createdBy:session.accountId,updatedBy:session.accountId,questions:quizBuilderQuestions};const result=selectedQuizId?updateQuiz(selectedQuizId,payload):createQuiz(payload);if(!result)return toast(t("quiz.invalidQuiz"));quizFormOpen=false;selectedQuizId="";quizBuilderQuestions=[];quizBuilderCollapsed={};quizAddingQType=false;toast("success");render();});
  document.querySelectorAll("[data-grade-attempt]").forEach(el=>el.addEventListener("click",()=>{const attempt=getQuizAttempts().find(a=>a.id===el.dataset.gradeAttempt);const quiz=getQuizById(attempt?.quizId);const question=quiz?.questions.find(q=>q.type==="text"&&!attempt.answers.find(a=>a.questionId===q.id&&Number.isFinite(a.awardedPoints)));if(!question)return;const answer=attempt.answers.find(a=>a.questionId===question.id)?.textAnswer||"";openDialog({type:"gradeInput",title:t("quiz.manualGrade"),body:`Câu hỏi: ${escapeHtml(question.text||"")}`,answer,maxPoints:question.points,onGrade:(pts)=>{const result=gradeQuizEssay({attemptId:attempt.id,questionId:question.id,points:pts,gradedBy:session.accountId});toast(result?"success":"error");render();}});}));
  document.querySelector("[data-quiz-export]")?.addEventListener("click",exportQuizCsv);
  document.querySelectorAll("[data-quiz-start]").forEach(el=>el.addEventListener("click",()=>{if(!hasEmployeeAccess())return toast("error");activeQuizAttempt=startQuizAttempt({quizId:el.dataset.quizStart,accountId:session.accountId});if(!activeQuizAttempt)return toast("error");quizCurrentQuestion=0;quizAnswers=Object.fromEntries((activeQuizAttempt.answers||[]).map(a=>[a.questionId,a.textAnswer??a.selectedOptionIds??a.selectedOptionId]));quizBookmarks=activeQuizAttempt.bookmarks||[];const started=new Date(activeQuizAttempt.startedAt.replace(" ","T")).getTime();quizSecondsRemaining=Math.max(0,activeQuizAttempt.quiz.timeLimitMinutes*60-Math.floor((Date.now()-started)/1000));render();}));
  document.querySelectorAll("[data-question-nav]").forEach(el=>el.addEventListener("click",()=>{captureQuizAnswer();quizCurrentQuestion=Number(el.dataset.questionNav);render();}));
  document.querySelector("[data-question-prev]")?.addEventListener("click",()=>{captureQuizAnswer();quizCurrentQuestion=Math.max(0,quizCurrentQuestion-1);render();});
  document.querySelector("[data-question-next]")?.addEventListener("click",()=>{captureQuizAnswer();quizCurrentQuestion=Math.min(activeQuizAttempt.quiz.questions.length-1,quizCurrentQuestion+1);render();});
  document.querySelector("[data-bookmark-question]")?.addEventListener("click",()=>{captureQuizAnswer();const id=activeQuizAttempt.quiz.questions[quizCurrentQuestion].id;quizBookmarks=quizBookmarks.includes(id)?quizBookmarks.filter(x=>x!==id):[...quizBookmarks,id];persistQuizDraft();render();});
  document.querySelectorAll("[data-answer-option]").forEach(el=>el.addEventListener("change",captureQuizAnswer));document.querySelector("[data-answer-text]")?.addEventListener("input",captureQuizAnswer);
  document.getElementById("quizAttemptForm")?.addEventListener("submit",(event)=>{event.preventDefault();captureQuizAnswer();openDialog({type:"confirm",title:t("quiz.confirmSubmit"),body:"Bạn sẽ không thể thay đổi câu trả lời sau khi nộp.",onConfirm:()=>finishQuizAttempt()});return;});
  document.querySelector("[data-quiz-result-close]")?.addEventListener("click",()=>{quizLastResult=null;render();});
  document.querySelectorAll("[data-my-course-filter]").forEach((el) => el.addEventListener("click", () => { myCourseFilter = el.dataset.myCourseFilter || ""; render(); }));
  document.querySelector("[data-toggle-employee-notifications]")?.addEventListener("click", () => { employeeNotificationPanelOpen = !employeeNotificationPanelOpen; render(); });
  document.querySelectorAll("[data-open-content]").forEach(el=>el.addEventListener("click",()=>{activeContentId=el.dataset.openContent;activeSlideIndex=0;render();}));
  document.querySelectorAll("[data-course-content-nav]").forEach(el=>el.addEventListener("click",()=>{const stage=document.querySelector(".lesson-stage");const outline=getCourseContent(stage?.dataset.courseId);const next=outline[Number(el.dataset.courseContentNav)];if(next){activeContentId=next.id;activeSlideIndex=0;render();}}));
  document.querySelectorAll("[data-slide-nav]").forEach(el=>el.addEventListener("click",()=>{const target=Number(el.dataset.slideNav);const viewer=document.querySelector(".slide-viewer");const remaining=Number(document.querySelector("[data-slide-timer]")?.textContent?.replace("s","")||0);if(target>activeSlideIndex&&remaining>0){recordRapidAdvance(viewer);return;}activeSlideIndex=target;render();}));
  document.querySelector("[data-complete-transcript]")?.addEventListener("click",()=>{const stage=document.querySelector(".lesson-stage");saveContentProgress({accountId:session.accountId,courseId:stage.dataset.courseId,contentId:stage.dataset.contentId,contentType:"video",completed:true,completionPercent:100,metadata:{completedViaTranscript:true}});logLearningActivity({eventType:"transcript_completed",accountId:session.accountId,courseId:stage.dataset.courseId,contentId:stage.dataset.contentId});render();});
  document.querySelectorAll("[data-mark-notification-read]").forEach((el) => el.addEventListener("click", () => {
    if (!hasEmployeeAccess()) return toast("error");
    const own = getNotifications(session.accountId).find((item) => item.id === el.dataset.markNotificationRead);
    if (!own || !markAsRead(own.id)) return toast("error");
    notificationService.markRead(own.id).catch(()=>{});
    toast("success"); render();
  }));
  document.querySelectorAll("[data-scroll]").forEach((el) => el.addEventListener("click", () => scrollToId(el.dataset.scroll)));
  document.querySelector("[data-announcements-link]")?.addEventListener("click", goAnnouncements);
  document.querySelector("[data-hr-link]")?.addEventListener("click", () => navigate(session?.role === "hr" ? "/admin" : "/login?role=hr"));
  // Password show/hide toggle
  document.querySelector("[data-toggle-password]")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const input = document.getElementById("loginPassword");
    if (!input) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    btn.setAttribute("aria-pressed", String(isPassword));
    btn.setAttribute("aria-label", isPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu");
    btn.querySelector(".eye-icon--show").style.display = isPassword ? "none" : "";
    btn.querySelector(".eye-icon--hide").style.display = isPassword ? "" : "none";
  });
  // role-toggle removed from login UI
  // Support modal — "Bạn không thể đăng nhập?"
  document.querySelector("[data-login-support]")?.addEventListener("click", () => {
    _supportModalOpen = true;
    _supportStep = "select";
    _supportSelectedType = "";
    _supportError = "";
    render();
  });
  // Support modal sub-handlers (delegated since modal re-renders)
  document.addEventListener("click", (e) => {
    if (!_supportModalOpen) return;
    if (e.target.closest("[data-close-support]")) {
      _supportModalOpen = false; _supportStep = "select"; _supportSelectedType = ""; _supportError = "";
      render(); return;
    }
    if (e.target.closest("[data-support-type]")) {
      _supportSelectedType = e.target.closest("[data-support-type]").dataset.supportType;
      _supportStep = "form"; _supportError = ""; render(); return;
    }
    if (e.target.closest("[data-support-back]")) {
      _supportStep = "select"; _supportError = ""; render(); return;
    }
  });
  document.addEventListener("submit", async (e) => {
    if (!e.target.matches("#supportRequestForm")) return;
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    _supportFormIdentifier = String(fd.get("identifier") || "").trim().toLowerCase();
    _supportFormName = String(fd.get("fullName") || "").trim();
    _supportFormCode = String(fd.get("employeeCode") || "").trim();
    _supportFormMessage = String(fd.get("message") || "").trim();
    if (!_supportFormIdentifier) { _supportError = "Vui lòng nhập email."; render(); return; }
    _supportSubmitting = true; _supportError = ""; render();
    try {
      const res = await fetch("/api/account-support/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: _supportSelectedType,
          submittedIdentifier: _supportFormIdentifier,
          submittedName: _supportFormName,
          submittedEmployeeCode: _supportFormCode,
          message: _supportFormMessage,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        _supportError = body.message || body.error || "Gửi thất bại. Vui lòng thử lại.";
      } else {
        _supportStep = "done";
        _supportFormIdentifier = ""; _supportFormName = ""; _supportFormCode = ""; _supportFormMessage = "";
      }
    } catch {
      _supportError = "Lỗi kết nối. Vui lòng thử lại.";
    } finally {
      _supportSubmitting = false; render();
    }
  });
  function demoFillEffect(form) {
    const card = form.closest(".login-card") || form;
    card.classList.add("demo-filled");
    setTimeout(() => card.classList.remove("demo-filled"), 700);
    form.elements.identifier?.focus();
  }
  document.querySelector("[data-fill-demo-account]")?.addEventListener("click", () => {
    const form = document.getElementById("loginForm");
    if (!form) return;
    form.elements.identifier.value = DEMO_HR_EMAIL;
    form.elements.password.value = DEMO_HR_PASSWORD;
    demoFillEffect(form);
  });
  document.querySelector("[data-fill-demo-employee]")?.addEventListener("click", () => {
    const form = document.getElementById("loginForm");
    if (!form) return;
    form.elements.identifier.value = DEMO_EMPLOYEE_EMAIL;
    form.elements.password.value = DEMO_EMPLOYEE_PASSWORD;
    demoFillEffect(form);
  });
  document.getElementById("loginForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitBtn = document.getElementById("loginSubmitBtn");
    const submitText = submitBtn?.querySelector(".login-submit-text");
    const submitSpinner = submitBtn?.querySelector(".login-submit-spinner");

    const data = new FormData(form);
    const email = String(data.get("identifier") || "").trim().toLowerCase();
    const emailError = form.querySelector("[data-login-email-error]");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (emailError) emailError.textContent = "Vui lòng nhập email công ty hợp lệ.";
      form.elements.identifier?.setAttribute("aria-invalid", "true");
      form.elements.identifier?.focus();
      return;
    }
    if (emailError) emailError.textContent = "";
    form.elements.identifier?.removeAttribute("aria-invalid");

    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.style.display = "none";
    if (submitSpinner) submitSpinner.style.display = "";

    const resetLoginUI = () => {
      if (submitBtn) submitBtn.disabled = false;
      if (submitText) submitText.style.display = "";
      if (submitSpinner) submitSpinner.style.display = "none";
    };

    (async () => {
      try {
        const res = await fetch("/api/auth?action=login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: data.get("password") }),
        });
        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          resetLoginUI();
          _loginEmailRetain = email;
          if (body.error === "ACCOUNT_INACTIVE") {
            openDialog({
              type: "alert",
              title: "Tài khoản đã bị vô hiệu hóa",
              body: "Tài khoản hiện đã bị vô hiệu hóa. Vui lòng liên hệ HR nếu bạn cho rằng đây là nhầm lẫn.",
              actions: [{ label: "Gửi yêu cầu hỗ trợ", primary: true, onClick: () => { closeDialog(); _supportModalOpen = true; _supportStep = "form"; _supportSelectedType = "reactivate_account"; _supportFormIdentifier = email; render(); } }],
            });
          } else if (body.error === "ACCOUNT_LOCKED") {
            openDialog({
              type: "alert",
              title: "Tài khoản đang tạm khóa",
              body: "Tài khoản đang tạm khóa do đăng nhập sai quá nhiều lần. Bạn có thể gửi yêu cầu mở khóa đến HR.",
              actions: [{ label: "Gửi yêu cầu mở khóa", primary: true, onClick: () => { closeDialog(); _supportModalOpen = true; _supportStep = "form"; _supportSelectedType = "unlock_account"; _supportFormIdentifier = email; render(); } }],
            });
          } else {
            openDialog({ type: "invalidCredentials" });
          }
          return;
        }

        // Sync Supabase profile to localStorage so getAccountById(uuid) works.
        // Wrap in try so a localStorage quota error cannot strand the user on /login
        // after a successful authentication — the session token is the source of truth.
        const { syncSupabaseProfile, hydrateFromSupabase } = await import("./lib/mockDatabase.js");
        try { syncSupabaseProfile(body.profile); } catch (e) { console.warn("[login] syncSupabaseProfile failed:", e?.message); }

        _loginEmailRetain = "";
        const isHr = body.profile.role === "hr" || body.profile.role === "admin";
        session = sessionService.startSession(
          { id: body.profile.id, role: body.profile.role, fullName: body.profile.fullName, accountStatus: body.profile.accountStatus },
          { rememberMe: data.get("rememberMe") === "on", supabaseAccessToken: body.access_token, supabaseRefreshToken: body.refresh_token }
        );

        // Reset per-account caches for the new session
        _offlineTrainingLoadedFor = "";
        invalidateOfflineTrainingCache();

        // Hydrate localStorage cache from Supabase so cross-device data is fresh
        hydrateFromSupabase(body.profile.id, body.profile.role).catch(() => {});

        // Determine redirect target. Never redirect back to /login — if a stale
        // post-login redirect points there (or anywhere disallowed), fall back to the role default.
        if (body.profile.passwordStatus === "resetRequired") {
          navigate("/change-password");
        } else {
          const fallback = isHr ? "/admin" : "/dashboard";
          const target = sessionService.consumePostLoginRedirect(fallback);
          navigate(target === "/login" ? fallback : target);
        }
      } catch {
        resetLoginUI();
        openDialog({ type: "system" });
      }
    })();
  });
  document.querySelectorAll("[data-dialog-close]").forEach((el) => el.addEventListener("click", closeDialog));
  document.querySelectorAll("[data-dialog-action]").forEach((el) => el.addEventListener("click", () => {
    const idx = parseInt(el.dataset.dialogAction || "0");
    const action = dialogState?.actions?.[idx];
    closeDialog();
    if (typeof action?.onClick === "function") action.onClick();
    render();
  }));
  document.querySelector("[data-dialog-leave]")?.addEventListener("click", () => {
    const target = pendingNavigation || "/dashboard";
    dialogState = null;
    pendingNavigation = "";
    bypassNavigationGuard = true;
    destroyYoutubePlayer();
    navigate(target);
  });
  document.querySelector("[data-dialog-confirm]")?.addEventListener("click", () => {
    const action = dialogState?.onConfirm;
    dialogState = null;
    if (typeof action === "function") action();
    render();
  });
  document.querySelector("[data-dialog-grade-submit]")?.addEventListener("click", () => {
    const input = document.getElementById("sdGradeInput");
    const errEl = document.getElementById("sdGradeError");
    const val = parseFloat(input?.value);
    const max = parseFloat(input?.max ?? "9999");
    if (!input || isNaN(val) || val < 0 || val > max) {
      if (errEl) errEl.textContent = `Vui lòng nhập điểm từ 0 đến ${max}.`;
      input?.focus();
      return;
    }
    const action = dialogState?.onGrade;
    dialogState = null;
    if (typeof action === "function") action(val);
    render();
  });
  // QR camera consent
  document.querySelector("[data-qr-consent-accept]")?.addEventListener("click", async (event) => {
    if (!isMobileQrDevice()) return openPhoneAttendanceGuide();
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Đang xin quyền vị trí...";
    try {
      await requestQrLocationPermission();
      _qrCameraConsentGiven = true;
      render();
    } catch {
      openDialog({ type: "alert", title: "Cần quyền truy cập vị trí", body: "Vui lòng cho phép MyKIS Learning truy cập vị trí chính xác để tiếp tục quét QR điểm danh." });
    }
  });

  document.querySelector("[data-qr-confirm-mobile]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (!isMobileQrDevice() || !navigator.mediaDevices?.getUserMedia || !navigator.geolocation) {
      return openDialog({ type: "alert", title: "Thiết bị chưa phù hợp", body: "Thiết bị này chưa được nhận diện là điện thoại có camera và GPS. Vui lòng mở MyKIS Learning trên điện thoại để điểm danh." });
    }
    button.disabled = true;
    button.textContent = "Đang kiểm tra quyền...";
    try {
      await requestQrLocationPermission();
      dialogState = null;
      _qrCameraConsentGiven = true;
      navigate("/attendance/scan" + (isQrDebugEnabled() ? "?debugQr=1" : ""));
    } catch {
      openDialog({ type: "alert", title: "Cần quyền truy cập vị trí", body: "Vui lòng bật GPS và cho phép truy cập vị trí để tiếp tục." });
    }
  });

  // QR retry — back to camera scanner
  document.querySelector("[data-qr-retry]")?.addEventListener("click", () => {
    navigate("/attendance/scan" + (isQrDebugEnabled() ? "?debugQr=1" : ""));
  });

  // QR submit — geolocation then scan
  const submitScanBtn = document.querySelector("[data-submit-scan]");
  if (submitScanBtn) {
    submitScanBtn.addEventListener("click", () => {
      const tokenVal = submitScanBtn.dataset.submitScan || "";

      async function doScan(locData) {
        const qrPayload = qrAttendanceService.decodeQrToken(tokenVal);
        if (qrPayload) {
          // V2 cross-browser token — call Worker API
          const body = { sessionId: qrPayload.s, action: qrPayload.a, expires: qrPayload.e };
          if (locData?.latitude) { body.latitude = locData.latitude; body.longitude = locData.longitude; body.accuracy = locData.accuracy; }
          try {
            const resp = await fetch("/api/attendance/scan", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Account-Id": session.accountId },
              body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (!resp.ok) {
              const msgMap = {
                already_checked_in: uiText("alreadyScanned"), already_checked_out: uiText("alreadyScanned"),
                not_invited: "Bạn không có trong danh sách người tham dự buổi học này. Vui lòng liên hệ HR.",
                missing_check_in: "Vui lòng quét mã check-in trước khi check-out.",
                expired: uiText("qrExpired"),
                outside_geofence: data.message || "Bạn đang ở ngoài khu vực tổ chức buổi học.",
                session_not_found: "Buổi học chưa được đồng bộ lên hệ thống. Vui lòng yêu cầu HR tạo lại QR.",
                session_cancelled: "Buổi học đã bị hủy.",
                gps_required: "Buổi học này yêu cầu GPS. Vui lòng bật vị trí và thử lại.",
              };
              openDialog({ type: "alert", title: "Không thể điểm danh", body: msgMap[data.error] || `Lỗi: ${data.error || "không xác định"}` });
              return;
            }
            const timeStr = new Date(data.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
            openDialog({ type: "alert", title: "Điểm danh thành công", body: `Bạn đã được ghi nhận tham gia buổi học lúc ${timeStr}.` });
            render();
          } catch {
            openDialog({ type: "alert", title: "Lỗi kết nối", body: "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại." });
          }
          return;
        }
        // Legacy localStorage token (same browser as HR)
        const result = qrAttendanceService.scan(tokenVal, session.accountId, locData);
        if (!result.ok) {
          const msgMap = {
            already_checked_in: uiText("alreadyScanned"),
            already_checked_out: uiText("alreadyScanned"),
            not_invited: uiText("notInvited"),
            missing_check_in: "Vui lòng quét mã check-in trước khi check-out.",
            expired: uiText("qrExpired"),
          };
          openDialog({ type: "alert", title: "Không thể điểm danh", body: msgMap[result.error] || uiText("qrNotOpen") });
          return;
        }
        const now = new Date();
        const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        const locNote = locData
          ? locData.insideGeofence === false
            ? "\n\nVị trí hiện tại nằm ngoài khu vực tổ chức. HR sẽ kiểm tra và xác nhận."
            : "\nVị trí đã được xác minh."
          : "";
        openDialog({
          type: "alert",
          title: "Điểm danh thành công",
          body: `Bạn đã được ghi nhận tham gia buổi học lúc ${timeStr}.${locNote}`,
        });
        render();
      }

      // Request geolocation with user-facing status update
      if (navigator.geolocation) {
        const locText = document.getElementById("qrLocText");
        if (locText) locText.textContent = "Đang yêu cầu quyền vị trí...";
        submitScanBtn.disabled = true;
        requestQrLocationPermission().then(locData => {
            // Client-side geofence pre-check (server will also verify)
            const sesLat = preview?.session?.latitude ?? null;
            const sesLng = preview?.session?.longitude ?? null;
            const sesRadius = preview?.session?.allowedRadiusMeters ?? null;
            if (sesLat != null && sesLng != null && sesRadius != null) {
              const R=6371000,p1=sesLat*Math.PI/180,p2=locData.latitude*Math.PI/180,dp=(locData.latitude-sesLat)*Math.PI/180,dl=(locData.longitude-sesLng)*Math.PI/180,a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
              const dist=Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
              if (dist > sesRadius) {
                submitScanBtn.disabled = false;
                openDialog({ type: "alert", title: "Ngoài phạm vi điểm danh", body: `Bạn đang cách địa điểm ${dist}m. Giới hạn cho phép là ${sesRadius}m.\n\nVui lòng di chuyển đến gần địa điểm tổ chức và thử lại.` });
                return;
              }
            }
            submitScanBtn.disabled = false;
            doScan(locData);
          }).catch((error) => {
            _qrScanLocationStatus = "unavailable";
            submitScanBtn.disabled = false;
            if (locText) locText.textContent = "Chưa thể xác định vị trí";
            const reason = error?.code === 1 ? "Quyền vị trí đã bị từ chối trước đó nên trình duyệt sẽ không hiện popup lần nữa. Hãy cấp Location trong cài đặt Safari/Chrome rồi thử lại." : error?.code === "INSECURE_CONTEXT" ? "Location chỉ hoạt động trên HTTPS. Hãy mở đúng địa chỉ Vercel HTTPS, không dùng HTTP hoặc trình duyệt nhúng." : "Không lấy được vị trí chính xác. Hãy bật GPS, đứng gần cửa sổ và thử lại.";
            openDialog({ type: "alert", title: "Cần vị trí để điểm danh", body: reason });
          });
      } else {
        openDialog({ type: "alert", title: "Thiết bị không hỗ trợ vị trí", body: "Không thể điểm danh vì trình duyệt không cung cấp Location." });
      }
    });
  }

  // Camera QR scanner — wire up "Khởi động camera" button.
  // initQrCameraScanner() must NOT be called here (outside user gesture).
  // iOS Safari requires video.play() to originate synchronously from a user tap.
  // "Khởi động camera" — direct user tap, gesture chain intact
  const qrStartBtn = document.getElementById("qrCameraStart");
  if (qrStartBtn) {
    qrStartBtn.addEventListener("click", () => handleQrStartButton(qrStartBtn));
  }

  // Debug panel buttons — work regardless of camera state
  document.getElementById("qrCopyDiag")?.addEventListener("click", function() {
    _qrCopyDiagnostic(document.getElementById("qrCameraVideo"), window._qrStartTime, this);
  });
  document.getElementById("qrSendReport")?.addEventListener("click", function() {
    _qrSendReport(document.getElementById("qrCameraVideo"), window._qrStartTime, this);
  });

  // HR manual code fallback
  document.getElementById("qrHrSubmit")?.addEventListener("click", () => {
    handleQrHrCodeSubmit(document.getElementById("qrHrCodeInput"));
  });
  document.getElementById("qrHrCodeInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleQrHrCodeSubmit(e.currentTarget);
  });

  // Scanner rendered — auto-send diagnostic immediately and set up tracking
  if (document.getElementById("qrCameraViewport")) {
    window._qrStartTime = window._qrStartTime || Date.now();
    // Auto-send diagnostic event on render so Vercel logs confirm page is loading
    fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "scanner_rendered",
        build: "2026-06-22-01",
        route: location.pathname + location.search,
        ua: navigator.userAgent,
        isHttps: location.protocol === "https:",
        isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
        iosVersion: navigator.userAgent.match(/OS (\d+)_/)?.[1] || null,
        debugEnabled: isQrDebugEnabled(),
        timestamp: new Date().toISOString(),
      }),
    }).then(r => r.json()).then(d => {
      _qrDB("autoReport", d.code || "sent");
    }).catch(() => {});

    // HR fallback is already visible (display:block in template)
    // Hide it only if camera actually starts playing
    document.getElementById("qrCameraVideo")?.addEventListener("playing", () => {
      const hr = document.getElementById("qrHrFallback");
      if (hr) hr.style.display = "none";
    }, { once: true });

    // Auto-error after 20s if still loading
    const _autoErrorTimer = setTimeout(() => {
      const video = document.getElementById("qrCameraVideo");
      const status = document.getElementById("qrCameraStatus");
      const retryBtn = document.getElementById("qrCameraRetry");
      if (!video?.classList.contains("is-playing")) {
        _qrDB("step", "GLOBAL_TIMEOUT");
        _qrDB("error", "GLOBAL_TIMEOUT — 20s elapsed with no frame");
        stopQrCameraScanner();
        if (status) status.textContent = "Hết thời gian. Nhấn Thử lại hoặc nhập mã HR.";
        if (retryBtn) retryBtn.style.display = "";
      }
    }, 20000);
    window.addEventListener("popstate", () => clearTimeout(_autoErrorTimer), { once: true });
  }
  document.querySelectorAll("[data-qr-slot]").forEach(el=>el.addEventListener("click",()=>{selectedQrSlotId=el.dataset.qrSlot;render();}));
  document.querySelectorAll("[data-qr-action]").forEach(el=>el.addEventListener("click",()=>{selectedQrAction=el.dataset.qrAction;render();}));
  document.querySelector("[data-generate-qr]")?.addEventListener("click",async()=>{
    if(!selectedQrSlotId)return;
    // Auto-sync session + participants to Supabase so cross-browser QR works
    try{
      const ses=offlineTrainingService.getSession(offlineTrainingService.getSlotSessionId?.(selectedQrSlotId)||(qrAttendanceService.getSlot(selectedQrSlotId)?.sessionId||""));
      if(ses){
        await fetch("/api/training/sessions",{method:"POST",headers:{"Content-Type":"application/json","X-Account-Id":session.accountId,"X-Account-Role":"hr"},body:JSON.stringify(ses)}).catch(()=>{});
        const pids=offlineTrainingService.getParticipantAccountIds(ses.id);
        if(pids.length){
          const participants=pids.map(id=>({id:`${ses.id}_${id}`,sessionId:ses.id,accountId:id,responseStatus:"attending"}));
          await fetch("/api/training/participants",{method:"POST",headers:{"Content-Type":"application/json","X-Account-Id":session.accountId,"X-Account-Role":"hr"},body:JSON.stringify({session_id:ses.id,participants})}).catch(()=>{});
        }
      }
    }catch{}
    const result=qrAttendanceService.createToken({slotId:selectedQrSlotId,action:selectedQrAction},session.accountId);if(!result.ok)return toast("error");currentQrTokenId=result.token.id;qrProjectorOpen=true;render();});
  document.querySelector("[data-open-projector]")?.addEventListener("click",()=>{const token=qrAttendanceService.listTokens(selectedQrSlotId).find(row=>row.action===selectedQrAction&&row.status==="open");if(!token)return toast("error");currentQrTokenId=token.id;qrProjectorOpen=true;render();});
  document.querySelectorAll("[data-close-projector]").forEach(el=>el.addEventListener("click",()=>{qrProjectorOpen=false;render();}));
  document.querySelectorAll("[data-close-qr-token]").forEach(el=>el.addEventListener("click",()=>{const token=qrAttendanceService.listTokens(selectedQrSlotId).find(row=>row.action===selectedQrAction&&row.status==="open");if(token)qrAttendanceService.closeToken(token.id,session.accountId);qrProjectorOpen=false;render();}));
  document.querySelectorAll("[data-open-scan-entry]").forEach(el=>el.addEventListener("click",()=>{if(isMobileQrDevice())navigate("/attendance/scan");else openPhoneAttendanceGuide();}));
  document.getElementById("changePasswordForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = form.querySelector("[data-change-password-error]");
    const submitBtn = form.querySelector("[type=submit]");
    const showPasswordError = (message) => {
      if (errorEl) errorEl.textContent = message;
      else toast(message);
    };
    if (errorEl) errorEl.textContent = "";
    const data = new FormData(form);
    const next = String(data.get("next") || "");
    const current = String(data.get("current") || "");
    const confirm = String(data.get("confirm") || "");
    if (!current) return showPasswordError("Vui lòng nhập mật khẩu hiện tại.");
    if (next !== confirm) return showPasswordError("Mật khẩu mới và xác nhận mật khẩu không khớp.");
    const validation = validatePassword(next, current);
    if (!validation.passed) {
      const missing = validation.checks.filter((check) => !check.passed).map((check) => ({
        minLength: "tối thiểu 8 ký tự",
        uppercase: "chữ hoa",
        lowercase: "chữ thường",
        number: "số",
        special: "ký tự đặc biệt",
        notTemporary: "khác mật khẩu hiện tại",
      })[check.key]).filter(Boolean);
      return showPasswordError(`Mật khẩu mới cần có ${missing.join(", ")}.`);
    }
    if (submitBtn) submitBtn.disabled = true;

    const supabaseToken = session?.supabaseAccessToken;
    if (!supabaseToken) {
      if (submitBtn) submitBtn.disabled = false;
      sessionService.endSession();
      showPasswordError("Phiên đăng nhập đã cũ. Vui lòng đăng nhập lại bằng mật khẩu tạm thời để đổi mật khẩu.");
      setTimeout(() => navigate("/login?returnTo=/change-password"), 900);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/auth?action=change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseToken}` },
          body: JSON.stringify({ currentPassword: current, newPassword: next }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (submitBtn) submitBtn.disabled = false;
          return showPasswordError(body.error === "WRONG_CURRENT_PASSWORD"
            ? "Mật khẩu hiện tại không đúng. Nếu vừa được HR reset, hãy nhập mật khẩu tạm thời ở ô này."
            : "Không thể cập nhật mật khẩu. Vui lòng thử lại hoặc liên hệ HR.");
        }
        // Clear passwordResetRequired in localStorage
        if (session?.accountId) {
          const { updateAccount } = await import("./lib/mockDatabase.js");
          updateAccount(session.accountId, { passwordResetRequired: false, accountStatus: "active" });
        }
        toast("changed");
        navigate(session.role === "hr" ? "/admin" : "/dashboard");
      } catch {
        if (submitBtn) submitBtn.disabled = false;
        showPasswordError("Không thể kết nối máy chủ. Vui lòng thử lại.");
      }
    })();
  });
  document.querySelectorAll("[data-account-search]").forEach((el) => el.addEventListener("input", () => { accountSearch = el.value; render(); }));
  document.querySelectorAll("[data-account-filter]").forEach((el) => el.addEventListener("change", () => { accountFilters[el.dataset.accountFilter] = el.value; render(); }));
  { let _esc = false;
    const el = document.getElementById("employeeDirSearch");
    el?.addEventListener("compositionstart", () => { _esc = true; });
    el?.addEventListener("compositionend", debounce((e) => { _esc = false; employeeDirectorySearch = e.target.value; employeeDirectoryPage = 1; renderEmployeeDirectoryResults(); }, 30));
    el?.addEventListener("input", debounce((e) => { if (_esc) return; employeeDirectorySearch = e.target.value; employeeDirectoryPage = 1; renderEmployeeDirectoryResults(); }, 180));
  }
  document.querySelectorAll("[data-employee-filter]").forEach((el) => el.addEventListener("change", () => { employeeDirectoryFilters[el.dataset.employeeFilter] = el.value; employeeDirectoryReviewIssues = false; employeeDirectoryPage = 1; render(); }));
  document.querySelector("[data-sort-employees]")?.addEventListener("click", () => { employeeDirectorySortAsc = !employeeDirectorySortAsc; render(); });
  document.querySelector("[data-review-issues]")?.addEventListener("click", () => { employeeDirectoryFilters = { department: "", position: "", accountStatus: "", cchn: "" }; employeeDirectorySearch = ""; employeeDirectoryReviewIssues = true; employeeDirectoryPage = 1; navigate("/admin/employees"); });
  document.querySelectorAll("[data-page-kind]").forEach((el) => el.addEventListener("click", () => { if (el.dataset.pageKind === "employees") employeeDirectoryPage = Number(el.dataset.page); if (el.dataset.pageKind === "cchn") cchnPage = Number(el.dataset.page); if (el.dataset.pageKind === "session-employees") sessionEmployeePage = Number(el.dataset.page); render(); }));
  document.querySelectorAll("[data-account-detail]").forEach((el) => el.addEventListener("click", () => { selectedAccountId = el.dataset.accountDetail; accountDrawerOpen = true; render(); }));
  document.querySelector("[data-close-drawer]")?.addEventListener("click", () => { accountDrawerOpen = false; render(); });

  // HR employee edit modal
  document.querySelectorAll("[data-edit-employee]").forEach((el) => el.addEventListener("click", () => { employeeEditId = el.dataset.editEmployee; employeeEditOpen = true; employeeEditSaving = false; render(); }));
  document.querySelector("[data-close-employee-edit]")?.addEventListener("click", () => { employeeEditOpen = false; render(); });
  document.getElementById("employeeEditForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (employeeEditSaving) return;
    employeeEditSaving = true; render();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    // Update locally first
    updateAccount(employeeEditId, { fullName: data.fullName, email: data.email, department: data.department, position: data.position, accountStatus: data.account_status, role: data.role, phone: data.phone, managerName: data.manager_name, location: data.location, notes: data.notes, joinDate: data.joined_date });
    // Sync to Supabase
    try {
      const res = await fetch(`/api/employees/${encodeURIComponent(employeeEditId)}`, {
        method: "PATCH",
        headers: {"Content-Type":"application/json","X-Account-Id":session?.accountId||"","X-Account-Role":"hr"},
        body: JSON.stringify({ full_name: data.fullName, email: data.email, department: data.department, position: data.position, account_status: data.account_status, role: data.role, phone: data.phone, manager_name: data.manager_name, location: data.location, notes: data.notes, joined_date: data.joined_date || null, employee_code: data.employeeCode }),
      });
      if (!res.ok) { const b = await res.json().catch(()=>({error:"Lỗi server"})); throw new Error(b.error); }
      toast("Đã cập nhật nhân viên ✓");
      employeeEditOpen = false;
    } catch (e) {
      document.getElementById("employeeEditError").textContent = e.message || "Không thể lưu lên Supabase.";
    }
    employeeEditSaving = false; render();
  });

  // Certification modal
  document.querySelectorAll("[data-open-certs]").forEach((el) => el.addEventListener("click", () => { certModalEmployeeId = el.dataset.openCerts; certModalOpen = true; certEditOpen = false; certEditId = ""; loadCertsForEmployee(certModalEmployeeId); }));
  document.querySelector("[data-close-cert-modal]")?.addEventListener("click", () => { certModalOpen = false; render(); });
  document.querySelector("[data-back-cert-list]")?.addEventListener("click", () => { certEditOpen = false; certEditId = ""; render(); });
  document.querySelector("[data-close-cert-edit]")?.addEventListener("click", () => { certEditOpen = false; certEditId = ""; render(); });
  document.querySelector("[data-add-cert]")?.addEventListener("click", () => { certEditId = ""; certEditOpen = true; render(); });
  document.querySelectorAll("[data-edit-cert]").forEach((el) => el.addEventListener("click", () => { certEditId = el.dataset.editCert; certEditOpen = true; render(); }));
  document.querySelectorAll("[data-revoke-cert]").forEach((el) => el.addEventListener("click", () => {
    openDialog({type:"confirm",title:"Thu hồi chứng chỉ",body:"Chứng chỉ sẽ được đánh dấu là đã thu hồi.",onConfirm:async()=>{
      const res = await fetch(`/api/employees/${encodeURIComponent(certModalEmployeeId)}/certifications/${el.dataset.revokeCert}`,{method:"PATCH",headers:{"Content-Type":"application/json","X-Account-Id":session?.accountId||"","X-Account-Role":"hr"},body:JSON.stringify({status:"revoked",revoked_at:new Date().toISOString(),revoked_by:session?.accountId||""})});
      if(res.ok){toast("Đã thu hồi chứng chỉ");loadCertsForEmployee(certModalEmployeeId);}else{toast("error");}
    }});
  }));
  document.getElementById("certEditForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (certSaving) return;
    certSaving = true; render();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { name: data.name, certificate_type: data.certificate_type, certificate_number: data.certificate_number||null, issuer: data.issuer, issue_date: data.issue_date, expiry_date: data.expiry_date||null, status: data.status||"valid", evidence_path: data.evidence_path||null, notes: data.notes||null };
    try {
      let res;
      if (certEditId) {
        res = await fetch(`/api/employees/${encodeURIComponent(certModalEmployeeId)}/certifications/${certEditId}`,{method:"PATCH",headers:{"Content-Type":"application/json","X-Account-Id":session?.accountId||"","X-Account-Role":"hr"},body:JSON.stringify(payload)});
      } else {
        res = await fetch(`/api/employees/${encodeURIComponent(certModalEmployeeId)}/certifications`,{method:"POST",headers:{"Content-Type":"application/json","X-Account-Id":session?.accountId||"","X-Account-Role":"hr"},body:JSON.stringify(payload)});
      }
      if (!res.ok) { const b = await res.json().catch(()=>({error:"Lỗi server"})); throw new Error(b.error); }
      toast(certEditId?"Đã cập nhật chứng chỉ ✓":"Đã thêm chứng chỉ ✓");
      certEditOpen = false; certEditId = "";
      loadCertsForEmployee(certModalEmployeeId);
    } catch (e) {
      document.getElementById("certEditError").textContent = e.message || "Không thể lưu.";
    }
    certSaving = false; render();
  });

  document.querySelector("[data-refresh-learning]")?.addEventListener("click",()=>loadLearningHistory(true));
  document.querySelector("[data-cert-my-reload]")?.addEventListener("click",()=>loadMyCertificates(true));
  document.querySelector("[data-cert-my-upload]")?.addEventListener("click",()=>{_certMy.formOpen=true;_certMy.renewId="";render();});
  document.querySelectorAll("[data-cert-renew]").forEach(el=>el.addEventListener("click",()=>{_certMy.renewId=el.dataset.certRenew;_certMy.formOpen=false;render();}));
  document.querySelectorAll("[data-cert-upload-close]").forEach(el=>el.addEventListener("click",()=>{_certMy.formOpen=false;_certMy.renewId="";render();}));
  document.getElementById("certificateUploadForm")?.addEventListener("submit",async(event)=>{
    event.preventDefault(); if(_certMy.submitting)return; _certMy.submitting=true; render();
    try{
      const form=event.currentTarget; const fd=new FormData(form); const payload=Object.fromEntries(fd.entries());
      payload.no_expiry=payload.no_expiry==="on";
      const file=form.querySelector('input[type="file"]')?.files?.[0];
      if(!file)throw new Error("Vui lòng chọn file minh chứng.");
      const meta=await apiJson("/api/certificates/my/upload",{method:"POST",body:JSON.stringify({fileName:file.name,mimeType:file.type,fileSize:file.size})});
      const up=await fetch(meta.signedUrl,{method:"PUT",headers:{"Content-Type":file.type},body:file});
      if(!up.ok)throw new Error("Không thể upload file minh chứng.");
      payload.evidence={bucket:meta.bucket,fileName:file.name,mimeType:file.type,fileSize:file.size,storagePath:meta.storagePath};
      const url=_certMy.renewId?`/api/certificates/my/${encodeURIComponent(_certMy.renewId)}/renew`:"/api/certificates/my/upload";
      await apiJson(url,{method:_certMy.renewId?"POST":"PUT",body:JSON.stringify(payload)});
      toast("Đã gửi HR xác minh"); _certMy.formOpen=false; _certMy.renewId=""; _certMy.rows=[]; await loadMyCertificates(true);
    }catch(e){toast(e.message||"error");}
    _certMy.submitting=false; render();
  });
  document.querySelectorAll("[data-learning-tab]").forEach(el=>el.addEventListener("click",()=>{_learningHistoryTab=el.dataset.learningTab;render();}));
  document.querySelector("[data-learning-filter]")?.addEventListener("change",(e)=>{_learningHistoryFilter=e.target.value;render();});
  document.querySelectorAll("[data-learning-form]").forEach(el=>el.addEventListener("click",()=>{_learningForm=el.dataset.learningForm;render();}));
  document.querySelectorAll("[data-close-learning-form]").forEach(el=>el.addEventListener("click",()=>{_learningForm="";render();}));
  document.getElementById("learningEntryForm")?.addEventListener("submit",async(event)=>{
    event.preventDefault(); if(_learningSubmitting)return; _learningSubmitting=true; render();
    try{
      const form=event.currentTarget; const fd=new FormData(form); const payload=Object.fromEntries(fd.entries());
      if(payload.no_expiry==="on")payload.no_expiry=true; if(payload.has_certificate==="on")payload.has_certificate=true;
      let evidence=null; const file=form.querySelector('input[type="file"]')?.files?.[0];
      if(file){
        const meta=await apiJson("/api/learning-evidence/upload-url",{method:"POST",body:JSON.stringify({fileName:file.name,mimeType:file.type,fileSize:file.size})});
        const up=await fetch(meta.signedUrl,{method:"PUT",headers:{"Content-Type":file.type},body:file});
        if(!up.ok)throw new Error("Không thể upload file minh chứng.");
        evidence={fileName:file.name,mimeType:file.type,fileSize:file.size,storagePath:meta.storagePath};
      }
      if(evidence)payload.evidence=evidence;
      if(_learningForm==="cert"){
        payload.verification_status="submitted";
        await apiJson("/api/certifications",{method:"POST",body:JSON.stringify(payload)});
      }else{
        payload.status="submitted"; payload.record_type="external_course";
        await apiJson("/api/learning-history",{method:"POST",body:JSON.stringify(payload)});
      }
      toast("Đã gửi HR phê duyệt"); _learningForm=""; _learningHistory=null; loadLearningHistory(true);
    }catch(e){toast(e.message||"error");}
    _learningSubmitting=false; render();
  });
  document.querySelectorAll("[data-admin-learning-tab]").forEach(el=>el.addEventListener("click",()=>{_adminLearning.tab=el.dataset.adminLearningTab;_adminLearning.summary=null;loadAdminLearning(true);}));
  document.querySelector("[data-admin-learning-search]")?.addEventListener("input",debounce((e)=>{_adminLearning.q=e.target.value;_adminLearning.summary=null;loadAdminLearning(true);},250));
  document.querySelectorAll("[data-admin-learning-detail]").forEach(el=>el.addEventListener("click",()=>{_adminLearningDetail=el.dataset.adminLearningDetail;_adminLearningActionNote="";render();}));
  document.querySelector("[data-close-admin-learning]")?.addEventListener("click",()=>{_adminLearningDetail=null;render();});
  document.querySelector("[data-admin-learning-note]")?.addEventListener("input",(e)=>{_adminLearningActionNote=e.target.value;});
  document.querySelectorAll("[data-admin-learning-action]").forEach(el=>el.addEventListener("click",async()=>{
    if(!_adminLearningDetail)return; const [kind,id]=_adminLearningDetail.split(":"); const action=el.dataset.adminLearningAction; const base=kind==="cert"?"/api/admin/certifications":"/api/admin/learning-records";
    try{const body=action==="request-revision"?{note:_adminLearningActionNote}:action==="reject"?{reason:_adminLearningActionNote||"Không đạt yêu cầu xác minh."}:{};await apiJson(`${base}/${encodeURIComponent(id)}/${action}`,{method:"POST",body:JSON.stringify(body)});toast("Đã cập nhật hồ sơ");_adminLearningDetail=null;_adminLearning.summary=null;loadAdminLearning(true);fetchHrOverview({silent:true});}catch(e){toast(e.message||"error");}
  }));
  document.querySelectorAll("[data-admin-learning-form]").forEach(el=>el.addEventListener("click",async()=>{
    const type=el.dataset.adminLearningForm;
    const accountId=prompt("Nhập mã account nhân viên từ Supabase");
    if(!accountId)return;
    try{
      if(type==="cert"){
        const name=prompt("Tên chứng chỉ"); if(!name)return;
        const issuer=prompt("Đơn vị cấp")||"";
        const issue_date=prompt("Ngày cấp (YYYY-MM-DD)")||new Date().toISOString().slice(0,10);
        await apiJson("/api/admin/certifications",{method:"POST",body:JSON.stringify({account_id:accountId,certificate_name:name,certificate_type:"Khác",issuer,issued_date:issue_date,no_expiry:true})});
      }else{
        const title=prompt("Tên khóa học/lịch sử đào tạo"); if(!title)return;
        const provider=prompt("Đơn vị tổ chức")||"KIS";
        await apiJson("/api/admin/learning-records",{method:"POST",body:JSON.stringify({account_id:accountId,title,provider,record_type:"external_course",delivery_method:"Trực tiếp",completion_date:new Date().toISOString().slice(0,10),duration_hours:0})});
      }
      toast("Đã thêm hồ sơ đã phê duyệt");_adminLearning.summary=null;loadAdminLearning(true);
    }catch(e){toast(e.message||"error");}
  }));
  document.querySelector("[data-cert-admin-reload]")?.addEventListener("click",()=>{_certAdmin.overview=null;loadCertificateAdmin(true);});
  document.querySelectorAll("[data-cert-admin-tab]").forEach(el=>el.addEventListener("click",()=>{_certAdmin.tab=el.dataset.certAdminTab;render();}));
  document.querySelector("[data-cert-admin-search]")?.addEventListener("input",debounce(e=>{_certAdmin.q=e.target.value;_certAdmin.overview=null;loadCertificateAdmin(true);},250));
  document.querySelector("[data-cert-type-create]")?.addEventListener("click",async()=>{
    const name=prompt("Tên loại chứng chỉ"); if(!name)return;
    const issuer=prompt("Đơn vị cấp mặc định")||"";
    try{await apiJson("/api/admin/certificates/types",{method:"POST",body:JSON.stringify({name,issuerName:issuer,category:"professional",defaultWarningDays:60})});toast("Đã thêm loại chứng chỉ");_certAdmin.overview=null;loadCertificateAdmin(true);}catch(e){toast(e.message||"error");}
  });
  document.querySelectorAll("[data-cert-admin-action]").forEach(el=>el.addEventListener("click",async()=>{
    const id=el.dataset.certId; const action=el.dataset.certAdminAction;
    const body={};
    if(action==="reject"||action==="revoke"){const reason=prompt(action==="reject"?"Lý do từ chối":"Lý do thu hồi"); if(!reason)return; body.reason=reason;}
    try{await apiJson(`/api/admin/certificates/${encodeURIComponent(id)}/${action}`,{method:"POST",body:JSON.stringify(body)});toast("Đã cập nhật chứng chỉ");_certAdmin.overview=null;loadCertificateAdmin(true);}catch(e){toast(e.message||"error");}
  }));
  // Delete employee
  document.querySelectorAll("[data-delete-employee]").forEach((el) => el.addEventListener("click", () => {
    _deleteEmployeeId = el.dataset.deleteEmployee;
    _deleteEmployeeName = el.dataset.deleteEmployeeName || "";
    _deleteEmployeeConfirming = false;
    render();
  }));
  document.querySelector("[data-close-delete-employee]")?.addEventListener("click", () => { _deleteEmployeeId = ""; _deleteEmployeeName = ""; render(); });
  document.querySelector(`[data-confirm-delete-employee]`)?.addEventListener("click", async () => {
    if (_deleteEmployeeConfirming) return;
    _deleteEmployeeConfirming = true; render();
    const result = await deleteEmployee(_deleteEmployeeId);
    _deleteEmployeeConfirming = false;
    if (result.ok) {
      _deleteEmployeeId = "";
      _deleteEmployeeName = "";
      toast("Đã xóa nhân viên ✓");
      await loadApiEmployees({ silent: false });
      await fetchHrOverview({ silent: true });
    } else {
      toast("error");
      render();
    }
  });
  // Reload employees
  document.querySelector("[data-reload-employees]")?.addEventListener("click", () => { _apiEmployeesLoaded = false; loadApiEmployees(); });

  document.querySelectorAll("[data-reset-account]").forEach((el) => el.addEventListener("click", () => { resetTargetId = el.dataset.resetAccount; resetModalOpen = true; temporaryPasswordResult = ""; render(); }));
  document.querySelectorAll("[data-force-account]").forEach((el) => el.addEventListener("click", () => { forcePasswordChange(el.dataset.forceAccount); toast("success"); render(); }));
  document.querySelectorAll("[data-activate-account]").forEach((el) => el.addEventListener("click", () => { updateAccount(el.dataset.activateAccount, { accountStatus: "active" }); toast("success"); render(); }));
  document.querySelectorAll("[data-edit-employee-email]").forEach((el) => el.addEventListener("click", () => {
    const employee = getEmployees().find((item) => item.id === el.dataset.editEmployeeEmail);
    const nextEmail = prompt(`Email mới cho ${employee?.fullName || "nhân viên"}`, employee?.email || "");
    if (nextEmail === null) return;
    updateEmployeeProfile(el.dataset.editEmployeeEmail, { email: nextEmail });
    toast("success");
    render();
  }));
  document.querySelectorAll("[data-unlock-account]").forEach((el) => el.addEventListener("click", () => {
    openDialog({ type: "confirm", title: t("admin.unlock"), body: "Tài khoản sẽ được mở khóa và nhân viên có thể đăng nhập lại.", onConfirm: async () => {
      try {
        const res = await fetch("/api/admin/hr-account-actions", {
          method: "POST", headers: apiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ action: "unlock", targetId: el.dataset.unlockAccount }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "unlock_failed");
        toast("success"); render();
      } catch { toast("error"); render(); }
    }});
  }));
  document.querySelectorAll("[data-disable-account]").forEach((el) => el.addEventListener("click", () => {
    openDialog({ type: "confirm", title: t("admin.disable"), body: "Tài khoản sẽ bị vô hiệu hóa. Nhân viên sẽ không thể đăng nhập.", onConfirm: async () => {
      try {
        const res = await fetch("/api/admin/hr-account-actions", {
          method: "POST", headers: apiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ action: "disable", targetId: el.dataset.disableAccount }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "disable_failed");
        toast("success"); render();
      } catch { toast("error"); render(); }
    }});
  }));
  document.querySelectorAll("[data-resend-account]").forEach((el) => el.addEventListener("click", () => { resendActivationEmail(el.dataset.resendAccount); toast("success"); render(); }));
  document.querySelector("[data-close-reset]")?.addEventListener("click", () => { resetModalOpen = false; temporaryPasswordResult = ""; render(); });
  document.getElementById("resetPasswordForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const temp = data.get("mode") === "manual" && data.get("manualPassword")
      ? String(data.get("manualPassword"))
      : generateTemporaryPassword();
    const requireChange = data.get("require") === "on";
    const unlock = data.get("unlock") === "on";
    const submitBtn = form.querySelector("[type=submit]");
    if (submitBtn) submitBtn.disabled = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/hr-account-actions", {
          method: "POST",
          headers: apiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ action: "reset-password", targetId: resetTargetId, newPassword: temp, requireChange }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) { toast("error"); if (submitBtn) submitBtn.disabled = false; return; }
        temporaryPasswordResult = temp;
        toast("passwordReset");
        render();
      } catch {
        toast("error");
        if (submitBtn) submitBtn.disabled = false;
      }
    })();
  });
  document.querySelector("[data-copy-temp]")?.addEventListener("click", async () => { await navigator.clipboard?.writeText(temporaryPasswordResult); toast("copied"); });
  document.querySelector(".cchn-section [data-cchn-search]")?.addEventListener("input", (event) => { cchnSearch = event.target.value; cchnPage = 1; renderPublicCchnResults(); });
  document.querySelector("[data-cchn-sort]")?.addEventListener("click", () => { cchnSortAsc = !cchnSortAsc; cchnPage = 1; renderPublicCchnResults(); });
  bindPublicCchnResultEvents(document);
  document.querySelectorAll("[data-cchn-filter]").forEach((el) => el.addEventListener("change", () => { cchnFilters[el.dataset.cchnFilter] = el.value; render(); }));
  { let _csc = false;
    const el = document.getElementById("courseSearchInput");
    el?.addEventListener("compositionstart", () => { _csc = true; });
    el?.addEventListener("compositionend", debounce((e) => { _csc = false; courseSearch = e.target.value; renderCourseResults(); }, 30));
    el?.addEventListener("input", debounce((e) => { if (_csc) return; courseSearch = e.target.value; renderCourseResults(); }, 180));
  }
  document.querySelector("[data-course-filter-category]")?.addEventListener("change", (event) => { courseFilterCategory = event.target.value; render(); });
  document.querySelector("[data-course-filter-status]")?.addEventListener("change", (event) => { courseFilterStatus = event.target.value; render(); });
  document.querySelector("[data-course-create]")?.addEventListener("click", () => { courseFormMode = "create"; selectedCourseId = ""; courseDrawerOpen = false; render(); });
  document.querySelectorAll("[data-course-detail]").forEach((el) => el.addEventListener("click", () => { selectedCourseId = el.dataset.courseDetail; courseDrawerOpen = true; courseFormMode = ""; render(); }));
  document.querySelectorAll("[data-course-detail-tab]").forEach(el => el.addEventListener("click", () => { courseDetailTab = el.dataset.courseDetailTab; render(); }));
  bindCourseResultEvents(document);
  document.querySelector("[data-close-course-drawer]")?.addEventListener("click", () => { courseDrawerOpen = false; contentBuilderMode = ""; selectedContentId = ""; render(); });
  document.querySelectorAll("[data-close-course-form]").forEach((el) => el.addEventListener("click", () => { courseFormMode = ""; render(); }));
  document.querySelector("[data-content-add]")?.addEventListener("click", () => { contentBuilderMode = "add"; selectedContentId = ""; contentPickerStep = "type"; slideDraft = null; youtubeDraft = null; render(); });
  document.querySelectorAll("[data-content-edit]").forEach(el => el.addEventListener("click", () => { const item = getCourseContent(selectedCourseId).find(x=>x.id===el.dataset.contentEdit); if(!item)return; contentBuilderMode = "edit"; selectedContentId = item.id; contentBuilderType = item.type; render(); }));
  document.querySelectorAll("[data-content-delete]").forEach(el => el.addEventListener("click", () => { const cid=el.dataset.contentDelete;openDialog({type:"confirm",title:"Xóa nội dung bài học",body:"Nội dung sẽ bị xóa. Tiến trình học liên quan sẽ không bị xóa.",onConfirm:()=>{deleteCourseContent(cid);toast("success");render();}}); }));
  document.querySelectorAll("[data-content-move-up]").forEach(el => el.addEventListener("click", () => { const items = getCourseContent(selectedCourseId); const i = items.findIndex(x=>x.id===el.dataset.contentMoveUp); if(i<=0)return; const ids=items.map(x=>x.id); [ids[i-1],ids[i]]=[ids[i],ids[i-1]]; reorderCourseContent(selectedCourseId,ids); render(); }));
  document.querySelectorAll("[data-content-move-down]").forEach(el => el.addEventListener("click", () => { const items = getCourseContent(selectedCourseId); const i = items.findIndex(x=>x.id===el.dataset.contentMoveDown); if(i<0||i>=items.length-1)return; const ids=items.map(x=>x.id); [ids[i],ids[i+1]]=[ids[i+1],ids[i]]; reorderCourseContent(selectedCourseId,ids); render(); }));
  document.querySelectorAll("[data-content-form-close]").forEach(el => el.addEventListener("click", () => { contentBuilderMode = ""; selectedContentId = ""; contentPickerStep = "type"; slideDraft = null; youtubeDraft = null; quizPickSearch = ""; render(); }));
  // Content type picker
  document.querySelectorAll("[data-pick-content-type]").forEach(el => el.addEventListener("click", () => { contentPickerStep = el.dataset.pickContentType; render(); }));
  // YouTube form submit
  document.getElementById("contentYoutubeForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!hasAdminAccess()) return toast("error");
    const fd = new FormData(e.currentTarget);
    const rawUrl = String(fd.get("youtubeUrl")||"").trim();
    const vid = normalizeYoutubeId(rawUrl);
    if (!vid || !/^[a-zA-Z0-9_-]{11}$/.test(vid)) { const errEl = document.getElementById("ytUrlError"); if (errEl) { errEl.style.display=""; errEl.textContent="URL YouTube không hợp lệ"; } return; }
    const title = String(fd.get("title")||"").trim();
    if (!title) return toast("error");
    const payload = { courseId: selectedCourseId, title, type: "video", sourceType: "youtube", youtubeVideoId: vid, required: fd.get("required")==="on", completionWeight: Number(fd.get("completionWeight"))||1, minimumDurationSeconds: Number(fd.get("minimumDurationSeconds"))||0, transcript: String(fd.get("transcript")||""), transcriptAlternativeAllowed: fd.get("transcriptAlternativeAllowed")==="on", completionRule: { requiredPercent: Number(fd.get("requiredPercent"))||90 } };
    const result = contentBuilderMode==="edit"&&selectedContentId ? updateCourseContent(selectedContentId,payload) : createCourseContent(payload);
    if (!result) return toast("error");
    contentBuilderMode=""; selectedContentId=""; contentPickerStep="type"; youtubeDraft=null;
    toast("success"); render();
  });
  // YouTube URL live preview (no full render)
  { const ytInput = document.getElementById("ytUrlInput");
    if (ytInput) { let _ytc = false;
      ytInput.addEventListener("compositionstart", () => { _ytc = true; });
      ytInput.addEventListener("compositionend", debounce((e) => { _ytc=false; updateYtPreview(e.target.value); }, 30));
      ytInput.addEventListener("input", debounce((e) => { if (_ytc) return; updateYtPreview(e.target.value); }, 500));
    }
  }
  // Quiz pick search (no full render)
  { let _qps = false;
    const el = document.getElementById("quizPickSearchInput");
    el?.addEventListener("compositionstart", () => { _qps = true; });
    el?.addEventListener("compositionend", debounce((e) => { _qps=false; quizPickSearch=e.target.value; renderQuizPickResults(); }, 30));
    el?.addEventListener("input", debounce((e) => { if (_qps) return; quizPickSearch=e.target.value; renderQuizPickResults(); }, 180));
  }
  // Select existing quiz for content
  document.querySelectorAll("[data-select-quiz-for-content]").forEach(el => el.addEventListener("click", () => {
    const quiz = getQuizById(el.dataset.selectQuizForContent);
    if (!quiz) return toast("error");
    const payload = { courseId: selectedCourseId, title: quiz.title, type: "quiz", quizId: quiz.id, required: true, completionWeight: 1, completionRule: { requirePass: true } };
    const result = createCourseContent(payload);
    if (!result) return toast("error");
    contentBuilderMode=""; selectedContentId=""; contentPickerStep="type"; quizPickSearch="";
    toast("success"); render();
  }));
  // Slide form submit
  document.getElementById("contentSlideForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!hasAdminAccess()) return toast("error");
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title")||"").trim();
    const isText = fd.get("isText") === "1";
    if (!title) { const errEl = document.getElementById("slideError"); if(errEl){errEl.textContent="Vui lòng nhập tên bài học";errEl.classList.add("show");} return; }
    if (!isText && !slideDraft?.fileName && contentBuilderMode !== "edit") { const errEl = document.getElementById("slideError"); if(errEl){errEl.textContent="Vui lòng chọn file";errEl.classList.add("show");} return; }
    const payload = {
      courseId: selectedCourseId, title, type: "slide",
      slideContent: isText ? String(fd.get("slideContent")||"") : String(fd.get("description")||""),
      required: fd.get("required")==="on", completionWeight: Number(fd.get("completionWeight"))||1,
      minimumDurationSeconds: Number(fd.get("minimumDurationSeconds"))||8,
      blobId: slideDraft?.blobId||null, pageCount: slideDraft?.pageCount||1,
    };
    const result = contentBuilderMode==="edit"&&selectedContentId ? updateCourseContent(selectedContentId,payload) : createCourseContent(payload);
    if (!result) return toast("error");
    if (slideDraft?.thumbs) slideDraft.thumbs.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    contentBuilderMode=""; selectedContentId=""; contentPickerStep="type"; slideDraft=null;
    toast("success"); render();
  });
  // Drop zone and file input
  { const dropZone = document.getElementById("slideDropZone");
    const fileInput = document.getElementById("slideFileInput");
    if (dropZone && fileInput) {
      dropZone.addEventListener("click", () => fileInput.click());
      dropZone.addEventListener("keydown", (e) => { if(e.key==="Enter"||e.key===" ") fileInput.click(); });
      dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
      dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
      dropZone.addEventListener("drop", (e) => { e.preventDefault(); dropZone.classList.remove("drag-over"); handleSlideFiles(e.dataTransfer.files); });
      fileInput.addEventListener("change", (e) => handleSlideFiles(e.target.files));
    }
  }
  // "Use sample video" button
  document.getElementById("ytUseSample")?.addEventListener("click", () => {
    const sampleId = "dQw4w9WgXcQ";
    const ytInput = document.getElementById("ytUrlInput");
    if (ytInput) { ytInput.value = `https://youtu.be/${sampleId}`; updateYtPreview(ytInput.value); }
  });
  // Auto-show YouTube preview when editing
  { const ytInputEl = document.getElementById("ytUrlInput");
    if (ytInputEl?.value) updateYtPreview(ytInputEl.value);
  }
  // Add-question type picker
  document.querySelectorAll("[data-add-q-type]").forEach(el => el.addEventListener("click", () => {
    quizBuilderQuestions = readQuestionEditors();
    const qtype = el.dataset.addQType;
    const newQ = { id:`q-${Date.now()}`, type: qtype, text:"", points:1, explanation:"", options: ["singleChoice","single_choice","multipleChoice","multiple_choice"].includes(qtype)?[{id:`o${Date.now()}1`,text:""},{id:`o${Date.now()}2`,text:""}]:[] };
    quizBuilderQuestions.push(newQ);
    quizAddingQType = false;
    render();
    requestAnimationFrame(() => {
      const lastCard = document.querySelector(`[data-q-idx="${quizBuilderQuestions.length-1}"] textarea`);
      lastCard?.focus();
      lastCard?.scrollIntoView({ behavior:"smooth", block:"nearest" });
    });
  }));
  // Question card toggle / move / duplicate / delete
  document.querySelectorAll("[data-q-toggle]").forEach(el => el.addEventListener("click", () => {
    quizBuilderQuestions = readQuestionEditors();
    const idx = Number(el.dataset.qToggle);
    quizBuilderCollapsed[idx] = !quizBuilderCollapsed[idx];
    render();
  }));
  document.querySelectorAll("[data-q-move-up]").forEach(el => el.addEventListener("click", () => {
    quizBuilderQuestions = readQuestionEditors();
    const i = Number(el.dataset.qMoveUp);
    if (i<=0) return;
    [quizBuilderQuestions[i-1],quizBuilderQuestions[i]] = [quizBuilderQuestions[i],quizBuilderQuestions[i-1]];
    render();
  }));
  document.querySelectorAll("[data-q-move-down]").forEach(el => el.addEventListener("click", () => {
    quizBuilderQuestions = readQuestionEditors();
    const i = Number(el.dataset.qMoveDown);
    if (i>=quizBuilderQuestions.length-1) return;
    [quizBuilderQuestions[i],quizBuilderQuestions[i+1]] = [quizBuilderQuestions[i+1],quizBuilderQuestions[i]];
    render();
  }));
  document.querySelectorAll("[data-q-duplicate]").forEach(el => el.addEventListener("click", () => {
    quizBuilderQuestions = readQuestionEditors();
    const i = Number(el.dataset.qDuplicate);
    const clone = structuredClone(quizBuilderQuestions[i]);
    clone.id = `q-dup-${Date.now()}`;
    quizBuilderQuestions.splice(i+1, 0, clone);
    render();
  }));
  document.querySelectorAll("[data-q-delete]").forEach(el => el.addEventListener("click", () => {
    quizBuilderQuestions = readQuestionEditors().filter((_,i)=>i!==Number(el.dataset.qDelete));
    delete quizBuilderCollapsed[Number(el.dataset.qDelete)];
    render();
  }));
  // Dynamic option/acc/pair/item add+delete
  document.querySelectorAll("[data-q-add-opt]").forEach(el => el.addEventListener("click", () => {
    const idx = Number(el.dataset.qAddOpt);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.options) q.options = [];
    const newOpt = { id:`o${Date.now()}`, text:"" };
    q.options.push(newOpt);
    const container = document.getElementById(`q-opts-${idx}`);
    const isMulti = ["multipleChoice","multiple_choice"].includes(q.type);
    const oi = q.options.length - 1;
    const row = document.createElement("div");
    row.className = "q-option-row";
    row.innerHTML = `<input type="${isMulti?"checkbox":"radio"}" name="${isMulti?`q_${idx}_correct[]`:`q_${idx}_correct`}" value="${escapeHtmlAttribute(newOpt.id)}"><input type="text" name="q_${idx}_opt_${oi}_text" value="" placeholder="Lựa chọn ${oi+1}" data-focus-key="q-${idx}-opt-${oi}"><input type="hidden" name="q_${idx}_opt_${oi}_id" value="${escapeHtmlAttribute(newOpt.id)}"><button type="button" class="btn btn-outline mini-action" data-q-del-opt="${idx}-${oi}">×</button>`;
    container?.appendChild(row);
    row.querySelector("input[type=text]")?.focus();
  }));
  document.querySelectorAll("[data-q-del-opt]").forEach(el => el.addEventListener("click", () => {
    const [idx, oi] = el.dataset.qDelOpt.split("-").map(Number);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.options || q.options.length <= 2) return;
    q.options.splice(oi, 1);
    render();
  }));
  document.querySelectorAll("[data-q-add-acc]").forEach(el => el.addEventListener("click", () => {
    const idx = Number(el.dataset.qAddAcc);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.acceptedAnswers) q.acceptedAnswers = [];
    q.acceptedAnswers.push("");
    const ai = q.acceptedAnswers.length - 1;
    const container = document.getElementById(`q-acc-${idx}`);
    const row = document.createElement("div");
    row.className = "q-option-row";
    row.innerHTML = `<input type="text" name="q_${idx}_acc_${ai}" placeholder="Đáp án ${ai+1}" data-focus-key="q-${idx}-acc-${ai}"><button type="button" class="btn btn-outline mini-action" data-q-del-acc="${idx}-${ai}">×</button>`;
    container?.appendChild(row);
    row.querySelector("input")?.focus();
  }));
  document.querySelectorAll("[data-q-del-acc]").forEach(el => el.addEventListener("click", () => {
    const [idx, ai] = el.dataset.qDelAcc.split("-").map(Number);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.acceptedAnswers || q.acceptedAnswers.length <= 1) return;
    q.acceptedAnswers.splice(ai, 1);
    render();
  }));
  document.querySelectorAll("[data-q-add-pair]").forEach(el => el.addEventListener("click", () => {
    const idx = Number(el.dataset.qAddPair);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.pairs) q.pairs = [];
    q.pairs.push({ left:"", right:"" });
    const pi = q.pairs.length - 1;
    const container = document.getElementById(`q-pairs-${idx}`);
    const row = document.createElement("div");
    row.className = "q-pair-row";
    row.innerHTML = `<input type="text" name="q_${idx}_left_${pi}" placeholder="Cột A" data-focus-key="q-${idx}-l-${pi}"><span style="color:var(--muted)">→</span><input type="text" name="q_${idx}_right_${pi}" placeholder="Cột B" data-focus-key="q-${idx}-r-${pi}"><button type="button" class="btn btn-outline mini-action" data-q-del-pair="${idx}-${pi}">×</button>`;
    container?.appendChild(row);
    row.querySelector("input")?.focus();
  }));
  document.querySelectorAll("[data-q-del-pair]").forEach(el => el.addEventListener("click", () => {
    const [idx, pi] = el.dataset.qDelPair.split("-").map(Number);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.pairs || q.pairs.length <= 1) return;
    q.pairs.splice(pi, 1);
    render();
  }));
  document.querySelectorAll("[data-q-add-item]").forEach(el => el.addEventListener("click", () => {
    const idx = Number(el.dataset.qAddItem);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.items) q.items = [];
    q.items.push("");
    const ii = q.items.length - 1;
    const container = document.getElementById(`q-items-${idx}`);
    const row = document.createElement("div");
    row.className = "q-order-row";
    row.innerHTML = `<span style="font-weight:700;color:var(--muted);min-width:20px">${ii+1}.</span><input type="text" name="q_${idx}_item_${ii}" placeholder="Bước ${ii+1}" data-focus-key="q-${idx}-item-${ii}"><button type="button" class="btn btn-outline mini-action" data-q-del-item="${idx}-${ii}">×</button>`;
    container?.appendChild(row);
    row.querySelector("input")?.focus();
  }));
  document.querySelectorAll("[data-q-del-item]").forEach(el => el.addEventListener("click", () => {
    const [idx, ii] = el.dataset.qDelItem.split("-").map(Number);
    quizBuilderQuestions = readQuestionEditors();
    const q = quizBuilderQuestions[idx];
    if (!q.items || q.items.length <= 2) return;
    q.items.splice(ii, 1);
    render();
  }));
  document.getElementById("contentItemForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if(!hasAdminAccess())return toast("error");
    const fd = new FormData(event.currentTarget);
    const type = String(fd.get("type")||"slide");
    const payload = { title: String(fd.get("title")||"").trim(), type, required: fd.get("required")==="on", completionWeight: Number(fd.get("completionWeight"))||1, minimumDurationSeconds: Number(fd.get("minimumDurationSeconds"))||8, slideTitle: String(fd.get("slideTitle")||"").trim(), slideContent: String(fd.get("slideContent")||"").trim(), sourceType: String(fd.get("sourceType")||"youtube"), youtubeVideoId: normalizeYoutubeId(String(fd.get("youtubeVideoId")||"")), sourceUrl: String(fd.get("sourceUrl")||"").trim(), transcript: String(fd.get("transcript")||""), transcriptAlternativeAllowed: fd.get("transcriptAlternativeAllowed")==="on", requiredPercent: Number(fd.get("requiredPercent"))||90, quizId: String(fd.get("quizId")||""), requirePass: fd.get("requirePass")==="on" };
    if(!payload.title)return toast("error");
    if(type==="quiz"&&!payload.quizId)return toast("error");
    if(type==="video"&&payload.sourceType==="youtube"&&payload.youtubeVideoId&&!/^[a-zA-Z0-9_-]{11}$/.test(payload.youtubeVideoId))return toast("invalidYoutubeId");
    let result;
    if(contentBuilderMode==="edit"&&selectedContentId){ result=updateCourseContent(selectedContentId,payload); }
    else{ result=createCourseContent({...payload,courseId:selectedCourseId}); }
    if(!result)return toast("error");
    contentBuilderMode=""; selectedContentId="";
    toast("success"); render();
  });
  document.getElementById("courseForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitBtn = form.querySelector("button[type=submit]");
    const formData = new FormData(form);
    const account = session?.accountId ? getAccountById(session.accountId) : null;
    const payload = {
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      category: String(formData.get("category") || "").trim(),
      format: String(formData.get("format") || "").trim(),
      deliveryMode: String(formData.get("format") || "online").toLowerCase(),
      durationHours: Number(formData.get("durationHours")),
      status: String(formData.get("status") || "draft"),
      coverImageId: String(formData.get("coverImageId") || ""),
      thumbnailImageId: String(formData.get("coverImageId") || ""),
      imageAlt: String(formData.get("imageAlt") || formData.get("title") || "").trim(),
      updatedBy: account?.fullName || "HR / L&D",
    };
    if (!payload.title || !Number.isFinite(payload.durationHours) || payload.durationHours < 0) return toast("error");

    // Step 1: save to localStorage immediately (sync)
    const result = courseFormMode === "edit"
      ? updateCourse(selectedCourseId, payload)
      : createCourse({ ...payload, createdBy: account?.fullName || "Nguyễn Thị Cẩm Thanh" });
    if (!result) return toast("error");

    // Step 2: await Supabase API — use session.accountId (not createdBy which is a display name)
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Đang lưu..."; }
    let apiOk = false;
    try {
      await courseApiService.saveCourse(result, session?.accountId || "acc-hr-demo");
      apiOk = true;
    } catch (err) {
      console.error("[courseForm] Supabase sync failed:", err?.message);
      openDialog({ type: "alert", title: "Lưu thất bại", body: `Không thể lưu lên Supabase: ${err?.message || "Lỗi không xác định"}. Khóa học đã được lưu cục bộ.` });
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Lưu"; }
    }

    courseFormMode = "";
    selectedCourseId = result.id || selectedCourseId;
    courseDrawerOpen = false;
    // Invalidate and refetch so every dropdown picks up the new/edited course
    _courses = null;
    _coursesAccountId = "";
    if (apiOk) toast("success");
    render();
    if (session) fetchCoursesFromApi(session.accountId, session.role);
  });
  { let _asc = false;
    const el = document.getElementById("assignSearchInput");
    el?.addEventListener("compositionstart", () => { _asc = true; });
    el?.addEventListener("compositionend", debounce((e) => { _asc = false; assignSearch = e.target.value; render(); }, 30));
    el?.addEventListener("input", debounce((e) => { if (_asc) return; assignSearch = e.target.value; render(); }, 180));
  }
  document.querySelector("[data-assign-filter-course]")?.addEventListener("change", (event) => { assignCourseId = event.target.value; assignTargetCourseId = event.target.value; render(); });
  document.querySelector("[data-assign-filter-dept]")?.addEventListener("change", (event) => { assignFilterDept = event.target.value; render(); });
  document.querySelector("[data-assign-filter-status]")?.addEventListener("change", (event) => { assignFilterStatus = event.target.value; render(); });
  document.querySelector("[data-clear-assign-course]")?.addEventListener("click", () => {
    assignCourseId = "";
    assignTargetCourseId = "";
    history.replaceState({}, "", "/admin/assign");
    assignRouteSearch = location.search;
    render();
  });
  document.querySelector("[data-assign-new]")?.addEventListener("click", () => { assignModalOpen = true; assignTargetAccountId = ""; assignTargetCourseId = assignCourseId || ""; render(); });
  document.querySelectorAll("[data-assign-method]").forEach((el)=>el.addEventListener("click",()=>{assignMethod=el.dataset.assignMethod; bulkSelectedAccountIds=[]; excelPreviewRows=[]; render();}));
  { let _bsc = false;
    const el = document.getElementById("bulkSearchInput");
    el?.addEventListener("compositionstart", () => { _bsc = true; });
    el?.addEventListener("compositionend", debounce((e) => { _bsc = false; bulkEmployeeSearch = e.target.value; render(); }, 30));
    el?.addEventListener("input", debounce((e) => { if (_bsc) return; bulkEmployeeSearch = e.target.value; render(); }, 180));
  }
  document.querySelector("[data-bulk-department]")?.addEventListener("change",(e)=>{bulkDepartmentFilter=e.target.value; if(assignMethod==="department") bulkSelectedAccountIds=getAccounts().filter(a=>a.role==="employee"&&a.accountStatus!=="disabled"&&a.department===bulkDepartmentFilter).map(a=>a.id); render();});
  document.querySelectorAll("[data-bulk-account]").forEach((el)=>el.addEventListener("change",()=>{bulkSelectedAccountIds=el.checked?[...new Set([...bulkSelectedAccountIds,el.dataset.bulkAccount])]:bulkSelectedAccountIds.filter(id=>id!==el.dataset.bulkAccount); render();}));
  document.querySelector("[data-select-visible]")?.addEventListener("click",()=>{bulkSelectedAccountIds=getAccounts().filter(a=>a.role==="employee"&&a.accountStatus!=="disabled"&&(!bulkEmployeeSearch||`${a.fullName} ${a.email}`.toLowerCase().includes(bulkEmployeeSearch.toLowerCase()))&&(!bulkDepartmentFilter||a.department===bulkDepartmentFilter)).map(a=>a.id);render();});
  document.querySelector("[data-clear-bulk]")?.addEventListener("click",()=>{bulkSelectedAccountIds=[];render();});
  document.querySelector("[data-bulk-excel]")?.addEventListener("change", async ()=>{openImportWizard("participants",selectedOfflineSessionId);render();});
  document.querySelectorAll("[data-close-assign-modal]").forEach((el) => el.addEventListener("click", () => {
    assignModalOpen = false;
    assignTargetAccountId = "";
    assignTargetCourseId = "";
    history.replaceState({}, "", "/admin/assign");
    assignRouteSearch = location.search;
    render();
  }));
  document.getElementById("assignForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const courseId = String(formData.get("courseId") || "").trim();
    const deadline = String(formData.get("deadline") || "").trim();
    const note = String(formData.get("note") || "").trim();
    if (!bulkSelectedAccountIds.length || !courseId || !deadline || deadline < getTodayDateString()) return toast("error");
    const currentSession = sessionService.getValidSession();
    const result = assignCourseToAccounts({ courseId, accountIds: bulkSelectedAccountIds, assignedBy: currentSession?.accountId || "acc-hr-demo", deadline, note });
    assignModalOpen = false;
    assignTargetAccountId = "";
    assignTargetCourseId = "";
    history.replaceState({}, "", "/admin/assign");
    assignRouteSearch = location.search;
    bulkSelectedAccountIds=[]; excelPreviewRows=[];
    toast(result.assigned ? t(result.invalid || result.duplicates ? "bulkAssign.partialSuccess" : "bulkAssign.assignSuccess") : "error");
    render();
  });
  document.querySelectorAll("[data-reset-learning]").forEach(el=>el.addEventListener("click",()=>{const row=getEnrollments().find(x=>x.id===el.dataset.resetLearning);openDialog({type:"confirm",title:lt("resetConfirm"),body:lt("resetReason"),onConfirm:()=>{const result=resetLearningProgress({performedBy:session.accountId,targetAccountId:row.accountId,courseId:row.courseId,reason:"HR đặt lại tiến trình"});toast(result?"success":"error");if(result)render();}});}));
  document.querySelectorAll("[data-view-learning-log]").forEach(el=>el.addEventListener("click",()=>{const row=getEnrollments().find(x=>x.id===el.dataset.viewLearningLog);const logs=getLearningActivity({accountId:row.accountId,courseId:row.courseId}).slice(0,20);openDialog({type:"alert",title:"Nhật ký học tập",body:logs.length?logs.map(x=>`${x.occurredAt} · ${x.eventType}`).join("\n"):lt("noActivity")});}));
  document.querySelectorAll("[data-remove-enrollment]").forEach((el) => el.addEventListener("click", () => {
    const enrollmentId = el.dataset.removeEnrollment;
    openDialog({type:"confirm",title:"Hủy giao khóa học",body:"Nhân viên sẽ bị xóa khỏi khóa học này. Tiến trình học sẽ không bị xóa.",onConfirm:()=>{
      const removed = removeEnrollment(enrollmentId);
      toast(removed ? "success" : "error");
      if (removed) render();
    }});
  }));
  document.querySelectorAll("[data-quick-assign]").forEach((el) => el.addEventListener("click", () => {
    const accountId = el.dataset.quickAssign;
    if (!accountId) return toast("error");
    assignTargetAccountId = accountId;
    assignTargetCourseId = "";
    assignModalOpen = true;
    navigate(`/admin/assign?accountId=${encodeURIComponent(accountId)}&open=1`);
  }));
  // ── Learning Path event handlers ───────────────────────────────────────────
  document.querySelector("[data-lp-create]")?.addEventListener("click", () => {
    _lpFormMode = "create"; _lpFormData = {}; render();
  });
  document.querySelector("[data-lp-form-close]")?.addEventListener("click", () => {
    _lpFormMode = ""; _lpFormData = {}; render();
  });
  document.querySelector("[data-lp-edit]")?.addEventListener("click", () => {
    if (!_lpDetail) return;
    _lpFormMode = "edit";
    _lpFormData = { title: _lpDetail.title, description: _lpDetail.description, completion_mode: _lpDetail.completion_mode, estimated_duration_minutes: _lpDetail.estimated_duration_minutes };
    render();
  });
  document.querySelector("[data-lp-reload]")?.addEventListener("click", () => {
    _lpList = null; _lpListError = ""; fetchLearningPathList();
  });
  document.getElementById("lpForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const errEl = form.querySelector("[data-lp-form-error]");
    if (errEl) errEl.textContent = "";
    const fd = new FormData(form);
    const payload = {
      title: (fd.get("title") || "").trim(),
      description: (fd.get("description") || "").trim() || null,
      completion_mode: fd.get("completion_mode") || "sequential",
      estimated_duration_minutes: parseInt(fd.get("estimated_duration_minutes") || "0", 10) || null,
    };
    if (!payload.title) { if (errEl) errEl.textContent = "Tên lộ trình không được để trống."; return; }
    const btn = form.querySelector("[type=submit]");
    if (btn) { btn.disabled = true; btn.textContent = "Đang lưu..."; }
    try {
      if (_lpFormMode === "create") {
        const res = await lpApiCall("POST", "/api/admin/learning-paths", payload);
        _lpFormMode = ""; _lpFormData = {}; _lpList = null;
        navigate(`/admin/learning-paths/${res.id}`);
      } else if (_lpFormMode === "edit" && _lpDetail) {
        await lpApiCall("PATCH", `/api/admin/learning-paths/${_lpDetail.id}`, payload);
        _lpFormMode = ""; _lpFormData = {};
        _lpDetail = null; _lpDetailLoading = false;
        fetchLearningPathDetail(_lpDetail?.id || route.split("/")[3]);
        render();
      }
    } catch (err) {
      if (errEl) errEl.textContent = err.message || "Lỗi không xác định.";
      if (btn) { btn.disabled = false; btn.textContent = "Lưu"; }
    }
  });
  document.querySelectorAll("[data-lp-publish]").forEach((el) => el.addEventListener("click", async () => {
    if (!confirm(t("lp.confirmPublish"))) return;
    try {
      await lpApiCall("POST", `/api/admin/learning-paths/${el.dataset.lpPublish}/publish`);
      _lpDetail = null; fetchLearningPathDetail(el.dataset.lpPublish);
    } catch (err) { toast("error"); }
  }));
  document.querySelectorAll("[data-lp-archive]").forEach((el) => el.addEventListener("click", async () => {
    if (!confirm(t("lp.confirmArchive"))) return;
    try {
      await lpApiCall("POST", `/api/admin/learning-paths/${el.dataset.lpArchive}/archive`);
      _lpDetail = null; fetchLearningPathDetail(el.dataset.lpArchive);
    } catch (err) { toast("error"); }
  }));
  // Step management
  document.querySelector("[data-lp-add-step]")?.addEventListener("click", () => {
    _lpAddStepOpen = true; _lpStepPickSearch = ""; render();
  });
  document.querySelector("[data-lp-add-step-close]")?.addEventListener("click", () => {
    _lpAddStepOpen = false; render();
  });
  document.querySelectorAll("[data-lp-step-type]").forEach((el) => el.addEventListener("click", () => {
    _lpAddStepType = el.dataset.lpStepType; _lpStepPickSearch = ""; render();
  }));
  document.querySelector("[data-lp-step-search]")?.addEventListener("input", (e) => {
    _lpStepPickSearch = e.target.value; render();
  });
  document.querySelectorAll("[data-lp-step-pick]").forEach((el) => el.addEventListener("click", async () => {
    const pathId = route.split("/")[3];
    try {
      await lpApiCall("POST", `/api/admin/learning-paths/${pathId}/steps`, {
        step_type: _lpAddStepType,
        resource_id: el.dataset.lpStepPick,
        title_override: el.dataset.lpStepPickTitle || null,
        is_required: true,
      });
      _lpAddStepOpen = false; _lpDetail = null; fetchLearningPathDetail(pathId);
    } catch (err) { toast("error"); }
  }));
  document.querySelectorAll("[data-lp-step-up]").forEach((el) => el.addEventListener("click", async () => {
    const pathId = route.split("/")[3];
    const steps = (_lpDetail?.steps || []);
    const idx = steps.findIndex((s) => s.id === el.dataset.lpStepUp);
    if (idx <= 0) return;
    const order = steps.map((s, i) => ({ id: s.id, position: i }));
    [order[idx - 1].position, order[idx].position] = [order[idx].position, order[idx - 1].position];
    try {
      await lpApiCall("POST", `/api/admin/learning-paths/${pathId}/reorder`, { order });
      _lpDetail = null; fetchLearningPathDetail(pathId);
    } catch (err) { toast("error"); }
  }));
  document.querySelectorAll("[data-lp-step-down]").forEach((el) => el.addEventListener("click", async () => {
    const pathId = route.split("/")[3];
    const steps = (_lpDetail?.steps || []);
    const idx = steps.findIndex((s) => s.id === el.dataset.lpStepDown);
    if (idx < 0 || idx >= steps.length - 1) return;
    const order = steps.map((s, i) => ({ id: s.id, position: i }));
    [order[idx].position, order[idx + 1].position] = [order[idx + 1].position, order[idx].position];
    try {
      await lpApiCall("POST", `/api/admin/learning-paths/${pathId}/reorder`, { order });
      _lpDetail = null; fetchLearningPathDetail(pathId);
    } catch (err) { toast("error"); }
  }));
  document.querySelectorAll("[data-lp-step-delete]").forEach((el) => el.addEventListener("click", async () => {
    if (!confirm("Xóa bước này?")) return;
    const pathId = route.split("/")[3];
    try {
      await lpApiCall("DELETE", `/api/admin/learning-paths/${pathId}/steps/${el.dataset.lpStepDelete}`);
      _lpDetail = null; fetchLearningPathDetail(pathId);
    } catch (err) { toast("error"); }
  }));
  // Assign modal
  document.querySelectorAll("[data-lp-assign]").forEach((el) => el.addEventListener("click", () => {
    _lpAssignOpen = true; _lpPreviewData = null; _lpAssignEmpIds = []; render();
  }));
  document.querySelector("[data-lp-assign-close]")?.addEventListener("click", () => {
    _lpAssignOpen = false; _lpPreviewData = null; render();
  });
  document.querySelectorAll("[data-lp-assign-target]").forEach((el) => el.addEventListener("click", () => {
    _lpAssignTarget = el.dataset.lpAssignTarget; _lpPreviewData = null; render();
  }));
  document.querySelector("[data-lp-dept-select]")?.addEventListener("change", (e) => {
    _lpAssignDept = e.target.value; _lpPreviewData = null;
  });
  document.querySelector("[data-lp-position-select]")?.addEventListener("change", (e) => {
    _lpAssignPosition = e.target.value; _lpPreviewData = null;
  });
  document.querySelector("[data-lp-emp-select]")?.addEventListener("change", (e) => {
    _lpAssignEmpIds = [...e.target.selectedOptions].map((o) => o.value);
  });
  document.querySelector("[data-lp-preview-assign]")?.addEventListener("click", async (e) => {
    _lpPreviewLoading = true; render();
    const pathId = e.currentTarget.dataset.pathId;
    let url = `/api/admin/learning-paths/preview-target?path_id=${encodeURIComponent(pathId)}`;
    if (_lpAssignTarget === "department" && _lpAssignDept) url += `&department=${encodeURIComponent(_lpAssignDept)}`;
    if (_lpAssignTarget === "job_title" && _lpAssignPosition) url += `&position=${encodeURIComponent(_lpAssignPosition)}`;
    if (_lpAssignTarget === "individual") _lpAssignEmpIds.forEach((id) => { url += `&employee_id=${encodeURIComponent(id)}`; });
    try {
      const res = await fetch(url, { headers: apiHeaders() });
      _lpPreviewData = await res.json();
    } catch { _lpPreviewData = null; }
    _lpPreviewLoading = false; render();
  });
  document.getElementById("lpAssignForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!_lpPreviewData || !_lpPreviewData.will_create) return;
    const pathId = e.currentTarget.querySelector("[data-path-id]")?.dataset.pathId;
    if (!pathId) return;
    const fd = new FormData(e.currentTarget);
    const empIds = _lpAssignTarget === "individual"
      ? _lpAssignEmpIds
      : (_lpPreviewData.employees || []).filter((ep) => !ep.already_assigned).map((ep) => ep.id);
    if (!empIds.length) return;
    const btn = e.currentTarget.querySelector("[type=submit]");
    if (btn) { btn.disabled = true; btn.textContent = "Đang giao..."; }
    try {
      const res = await lpApiCall("POST", `/api/admin/learning-paths/${pathId}/assign`, {
        employee_ids: empIds,
        start_at: fd.get("start_at") || null,
        due_at: fd.get("due_at") || null,
        assignment_source: _lpAssignTarget,
      });
      _lpAssignOpen = false; _lpPreviewData = null;
      openDialog({ type: "alert", title: "Giao thành công", body: `Đã tạo ${res.created} assignment. Bỏ qua ${res.skipped} (đã giao).` });
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = t("lp.confirmAssign"); }
      toast("error");
    }
  });
  // Employee: complete step
  document.querySelectorAll("[data-lp-complete-step]").forEach((el) => el.addEventListener("click", async () => {
    const stepId = el.dataset.lpCompleteStep;
    const assignmentId = el.dataset.assignmentId;
    el.disabled = true; el.textContent = "Đang xử lý...";
    try {
      await lpApiCall("POST", `/api/learning-paths/my/${assignmentId}/steps/${stepId}/complete`, {});
      _myLpDetail = null; fetchMyLpDetail(assignmentId);
    } catch (err) {
      el.disabled = false; el.textContent = "Đánh dấu hoàn thành";
      toast("error");
    }
  }));

  if (!window.__kisEscBound) {
    window.__kisEscBound = true;
    document.addEventListener("keydown", (e) => {
      if (dialogState) {
        if (e.key === "Tab") {
          const focusable = [...document.querySelectorAll("[data-shared-dialog] button, [data-shared-dialog] a")].filter((item) => !item.disabled);
          if (focusable.length) {
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          }
          return;
        }
        if (e.key === "Escape" && !dialogState.important) { e.preventDefault(); closeDialog(); }
        return;
      }
      if (e.key !== "Escape") return;
      if (contentBuilderMode) { contentBuilderMode=""; contentPickerStep="type"; slideDraft=null; youtubeDraft=null; render(); return; }
      if (quizFormOpen) { quizFormOpen=false; quizBuilderQuestions=[]; quizAddingQType=false; render(); return; }
      if (courseDrawerOpen) { courseDrawerOpen=false; render(); return; }
      if (accountDrawerOpen) { accountDrawerOpen=false; render(); return; }
      if (assignModalOpen) { assignModalOpen=false; render(); return; }
      if (resetModalOpen) { resetModalOpen=false; render(); return; }
    }, { capture: true });
  }
}

function toast(key) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  const translated = t(`toast.${key}`);
  el.textContent = key === "error"
    ? t("toast.error")
    : translated === `toast.${key}`
      ? (key.includes(".") ? t(key) : key)
      : translated;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

function mostCommon(values) {
  const counts = values.filter(Boolean).reduce((acc, item) => ((acc[item] = (acc[item] || 0) + 1), acc), {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

window.addEventListener("popstate", render);
window.__mykisSessionService = sessionService;
render();
