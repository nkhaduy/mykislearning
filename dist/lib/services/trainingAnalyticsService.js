/**
 * Training analytics service.
 *
 * Online training time is computed synchronously from localStorage
 * (content progress, quiz attempts) — this data is always available.
 *
 * Offline training time (classroom sessions, QR attendance) is served by the
 * Worker API and therefore async. To avoid crashing synchronous render paths
 * (employee dashboard, HR reports), offline data is held in a module-level
 * cache populated by `hydrateOfflineTrainingData(accountId)`. Sync accessors
 * read from the cache and return zeros when data has not been loaded yet —
 * they NEVER throw and NEVER call `.map()` on a Promise.
 *
 * The dashboard triggers `hydrateOfflineTrainingData` (fire-and-forget) on
 * render; once it resolves it re-renders and the KPI updates.
 */
import { getCourseContent, getContentProgress, getQuizAttemptsByAccountId, getAccounts, getEnrollments, calculateCourseProgress, getCourseById, getCourses } from "../mockDatabase.js";
import { offlineTrainingService } from "./offlineTrainingService.js";
import { qrAttendanceService } from "./qrAttendanceService.js";
import { trainingApiService } from "./trainingApiService.js";

const cache = new Map();
const inRange = (value, from, to) => {
  const t = new Date(value).getTime();
  return Number.isFinite(t) && (!from || t >= new Date(from).getTime()) && (!to || t <= new Date(to).getTime());
};

const asArray = (v) => (Array.isArray(v) ? v : []);

// ── Offline data cache (hydrated async, read sync) ─────────────────────────
let _offline = { accountId: "", sessions: [], registrations: [], fetchedAt: 0 };
let _offlineLoading = false;
const OFFLINE_TTL_MS = 60_000;

function cachedSessions() { return asArray(_offline.sessions); }
function cachedRegistrations() { return asArray(_offline.registrations); }

function regAccountId(r) { return r.accountId || r.account_id || ""; }
function regSessionId(r) { return r.sessionId || r.session_id || ""; }

/**
 * Hydrate the offline training cache for an account from the Worker API.
 * Fire-and-forget safe: never throws, debounced via _offlineLoading, TTL-cached.
 * Returns the populated cache (or the existing one if still fresh).
 */
export async function hydrateOfflineTrainingData(accountId) {
  if (!accountId) return _offline;
  if (_offlineLoading) return _offline;
  if (_offline.accountId === accountId && _offline.fetchedAt > Date.now() - OFFLINE_TTL_MS) return _offline;
  _offlineLoading = true;
  try {
    const calData = await trainingApiService.getCalendar(accountId).catch(() => null);
    if (calData && typeof calData === "object") {
      const sessions = asArray(calData.sessions || calData.items || calData);
      const registrations = asArray(calData.registrations);
      _offline = { accountId, sessions, registrations, fetchedAt: Date.now() };
    } else {
      // No API data — mark as fetched (empty) so sync callers get zeros, not a pending state
      _offline = { accountId, sessions: [], registrations: [], fetchedAt: Date.now() };
    }
  } catch {
    // keep previous cache on error
  } finally {
    _offlineLoading = false;
  }
  return _offline;
}

/** Invalidate the offline cache (e.g. on logout / account switch). */
export function invalidateOfflineTrainingCache() {
  _offline = { accountId: "", sessions: [], registrations: [], fetchedAt: 0 };
  cache.clear();
}

export function evaluateCourseCompletion({ accountId, courseId }) {
  const course = getCourseById(courseId);
  const online = calculateCourseProgress({ accountId, courseId });
  const required = cachedSessions()
    .filter((s) => s.courseId === courseId && s.attendanceRequired && s.status !== "cancelled");
  const registrations = cachedRegistrations().filter((r) => regAccountId(r) === accountId);
  const missing = required.filter((s) => !["attended", "partial"].includes(registrations.find((r) => regSessionId(r) === s.id)?.attendanceStatus));
  const offlineRatio = required.length ? (required.length - missing.length) / required.length : 1;
  const mode = course?.deliveryMode || "online";
  const onlineRequired = mode !== "offline";
  const offlineRequired = mode !== "online";
  const completed = (!onlineRequired || online.completed) && (!offlineRequired || missing.length === 0);
  const parts = [...(onlineRequired ? [online.percent] : []), ...(offlineRequired ? [offlineRatio * 100] : [])];
  const percentage = Math.round(parts.reduce((s, x) => s + x, 0) / (parts.length || 1));
  return {
    completed,
    percentage,
    blockers: missing.map((s) => `Bạn chưa tham dự ${s.title}.`),
    onlineCompletion: online.percent,
    offlineAttendance: { required: required.length, attended: required.length - missing.length },
    quizCompletion: !online.pendingGrading,
  };
}

export function calculateEmployeeTrainingTime(accountId, { dateFrom = "", dateTo = "" } = {}) {
  const revision = _offline.fetchedAt;
  const key = `${accountId}|${dateFrom}|${dateTo}|${revision}`;
  if (cache.has(key)) return cache.get(key);

  let onlineSeconds = 0;
  let offlineSeconds = 0;
  const breakdown = [];

  // ── Online (localStorage — always available) ──────────────────────────────
  for (const enrollment of getEnrollments().filter((e) => e.accountId === accountId)) {
    let courseSeconds = 0;
    const states = getContentProgress(accountId, enrollment.courseId);
    for (const content of getCourseContent(enrollment.courseId)) {
      const state = states.find((x) => x.contentId === content.id);
      if (!state || !inRange(state.completedAt || state.lastActivityAt, dateFrom, dateTo)) continue;
      let seconds = 0;
      if (content.type === "slide") {
        seconds = (content.slides || []).reduce((sum, slide) => sum + Math.min(Number(state.metadata?.slides?.[slide.id]?.viewedSeconds || 0), Number(slide.minimumViewSeconds || content.minimumDurationSeconds || 0)), 0);
      } else if (content.type === "video") {
        const ranges = state.metadata?.watchedRanges;
        seconds = Array.isArray(ranges) ? mergeTimeRanges(ranges).reduce((s, [a, b]) => s + b - a, 0) : Math.max(0, Number(state.activeSeconds) || 0);
        const cap = Number(state.metadata?.durationSeconds || 0);
        if (cap > 0) seconds = Math.min(seconds, cap);
      } else {
        seconds = Math.max(0, Number(state.activeSeconds) || 0);
      }
      courseSeconds += seconds;
    }
    for (const attempt of getQuizAttemptsByAccountId(accountId).filter((a) => a.courseId === enrollment.courseId && a.submittedAt && inRange(a.submittedAt, dateFrom, dateTo))) {
      const quizCap = Math.max(0, Number(attempt.durationSeconds) || 0);
      courseSeconds += quizCap;
    }
    courseSeconds = Math.round(Math.max(0, courseSeconds));
    if (courseSeconds) {
      onlineSeconds += courseSeconds;
      breakdown.push({ sourceType: "online", courseId: enrollment.courseId, seconds: courseSeconds });
    }
  }

  // ── Offline (from async cache — zeros until hydrated, never throws) ───────
  const sessions = new Map(cachedSessions().map((s) => [s.id, s]));
  let attendedSessionCount = 0;
  const countedSessions = new Set();
  const seen = new Set();
  for (const registration of cachedRegistrations().filter((r) => regAccountId(r) === accountId)) {
    const sid = regSessionId(registration);
    if (seen.has(sid) || !["attended", "partial"].includes(registration.attendanceStatus)) continue;
    seen.add(sid);
    const session = sessions.get(sid);
    if (!session || session.status === "cancelled" || new Date(session.endAt) > new Date()) continue;
    if (!inRange(registration.updatedAt || session.endAt, dateFrom, dateTo)) continue;
    const scheduled = Math.max(0, (new Date(session.endAt) - new Date(session.startAt)) / 1000);
    const seconds = Math.min(scheduled, Math.max(0, Number(registration.attendedSeconds || registration.attended_seconds || 0)));
    if (seconds) {
      offlineSeconds += seconds;
      countedSessions.add(session.id);
      breakdown.push({ sourceType: "offline", courseId: session.courseId, sessionId: session.id, seconds });
    }
  }
  attendedSessionCount = countedSessions.size;

  const totalSeconds = Math.round(onlineSeconds + offlineSeconds);
  const result = {
    onlineSeconds: Math.round(onlineSeconds),
    offlineSeconds: Math.round(offlineSeconds),
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    totalHours: Math.round(totalSeconds / 360) / 10,
    completedCourseCount: getEnrollments().filter((e) => e.accountId === accountId && e.status === "completed").length,
    attendedSessionCount,
    breakdown,
  };
  cache.set(key, result);
  return result;
}

export function getCompanyTrainingAnalytics(options = {}) {
  // HR company-wide view. Offline data is cached per-account, so for HR we only
  // have online totals reliably; offline stays 0 unless cache happens to hold
  // sessions. This is defensive — it NEVER crashes (previously threw because
  // offlineTrainingService.listSessions() is async).
  const active = getAccounts().filter((a) => a.role === "employee" && a.accountStatus === "active");
  const rows = active.map((a) => ({ account: a, training: calculateEmployeeTrainingTime(a.id, options) }));
  const totalSeconds = rows.reduce((s, x) => s + x.training.totalSeconds, 0);
  const onlineSeconds = rows.reduce((s, x) => s + x.training.onlineSeconds, 0);
  const offlineSeconds = rows.reduce((s, x) => s + x.training.offlineSeconds, 0);
  const sessions = cachedSessions();
  const regs = cachedRegistrations();
  const confirmed = regs.filter((r) => r.responseStatus === "attending").length;
  const noShow = regs.filter((r) => r.responseStatus === "attending" && r.attendanceStatus === "absent").length;
  const attended = regs.filter((r) => ["attended", "partial"].includes(r.attendanceStatus)).length;
  return {
    employees: active.length,
    totalSeconds,
    onlineSeconds,
    offlineSeconds,
    averageSeconds: active.length ? Math.round(totalSeconds / active.length) : 0,
    totalSessions: sessions.length,
    cancelledSessions: sessions.filter((s) => s.status === "cancelled").length,
    busyCount: regs.filter((r) => r.responseStatus === "busy").length,
    attendanceRate: regs.length ? Math.round(attended / regs.length * 100) : 0,
    noShowRate: confirmed ? Math.round(noShow / confirmed * 100) : 0,
    rows,
  };
}

export function getTrainingOverviewStats(options = {}) {
  const analytics = getCompanyTrainingAnalytics(options);
  const publishedCourseCount = getCourses().filter((course) => course.status === "published").length;
  const completedEnrollmentCount = getEnrollments().filter((enrollment) => calculateCourseProgress({ accountId: enrollment.accountId, courseId: enrollment.courseId }).completed).length;
  return {
    totalTrainingSeconds: analytics.totalSeconds,
    totalOnlineSeconds: analytics.onlineSeconds,
    totalOfflineSeconds: analytics.offlineSeconds,
    activeEmployeeCount: analytics.employees,
    publishedCourseCount,
    completedEnrollmentCount,
  };
}

export function formatTrainingDuration(seconds, locale = "vi", compact = false) {
  const safe = Math.max(0, Number(seconds) || 0);
  const hours = safe / 3600;
  if (compact) {
    const value = new Intl.NumberFormat(locale === "kr" ? "ko-KR" : locale === "en" ? "en-US" : "vi-VN", { maximumFractionDigits: 1 }).format(hours);
    return locale === "kr" ? `${value}시간` : locale === "en" ? `${value} hours` : `${value} giờ`;
  }
  const h = Math.floor(safe / 3600);
  const m = Math.round((safe % 3600) / 60);
  return locale === "kr" ? `${h}시간 ${m}분` : locale === "en" ? `${h} hr ${m} min` : `${h} giờ ${m} phút`;
}

export function mergeTimeRanges(ranges = []) {
  const clean = ranges.map((r) => [Math.max(0, Number(r[0]) || 0), Math.max(0, Number(r[1]) || 0)]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of clean) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}
