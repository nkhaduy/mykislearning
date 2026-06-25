/**
 * Calendar service — all data from Supabase via Worker API.
 */

import { trainingApiService } from "./trainingApiService.js";
import { sessionService } from "./sessionService.js";

const BASE = "/api";

function authHeaders() {
  const sess = sessionService.getValidSession();
  const h = { "Content-Type": "application/json" };
  if (sess?.supabaseAccessToken) h["Authorization"] = `Bearer ${sess.supabaseAccessToken}`;
  h["X-Account-Id"] = sess?.accountId || "";
  h["X-Account-Role"] = sess?.role || "employee";
  return h;
}

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function inRange(value, dateFrom, dateTo) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  if (dateFrom && time < new Date(dateFrom).getTime()) return false;
  if (dateTo && time > new Date(dateTo).getTime()) return false;
  return true;
}

function buildSessionStatus(session, registration) {
  if (session.status === "cancelled") return "cancelled";
  if (registration?.attendanceStatus === "attended") return "attended";
  if (registration?.attendanceStatus === "partial") return "partial";
  if (registration?.attendanceStatus === "absent") return "absent";
  if (registration?.attendanceStatus === "excused") return "excused";
  if (registration?.responseStatus === "attending") return "attending";
  if (registration?.responseStatus === "busy") return "busy";
  return "pending";
}

export const calendarService = {
  async getEventsForAccountAsync(accountId, options = {}) {
    const { dateFrom = "", dateTo = "", includeCancelled = true } = options;
    const events = [];

    // ── Session events ──────────────────────────────────────────────────────
    try {
      const calData = await trainingApiService.getCalendar(accountId);
      const sessions = Array.isArray(calData) ? calData : (calData?.sessions || []);
      const registrations = Array.isArray(calData?.registrations) ? calData.registrations : [];
      const regMap = new Map(registrations.map((r) => [r.sessionId || r.session_id, r]));

      for (const session of sessions) {
        if (!includeCancelled && session.status === "cancelled") continue;
        if (!inRange(session.startAt, dateFrom, dateTo)) continue;
        const registration = regMap.get(session.id) || null;
        events.push({
          id: `session-${session.id}`,
          eventType: "offline_session",
          courseId: session.courseId,
          sessionId: session.id,
          title: session.courseTitle || session.title || session.courseId,
          subtitle: session.title,
          startAt: session.startAt,
          endAt: session.endAt,
          location: session.locationName || session.meetingUrl || "",
          trainerName: session.trainerName || "",
          status: buildSessionStatus(session, registration),
          responseStatus: registration?.responseStatus || "pending",
          attendanceStatus: registration?.attendanceStatus || "not_marked",
          actionUrl: `/dashboard/calendar?sessionId=${encodeURIComponent(session.id)}`,
        });
      }
    } catch { /* no sessions available */ }

    // ── Deadline events ─────────────────────────────────────────────────────
    try {
      const enrollments = await apiFetch(`/enrollments?accountId=${encodeURIComponent(accountId)}`);
      const enrList = Array.isArray(enrollments) ? enrollments : (enrollments?.enrollments || []);
      for (const enr of enrList) {
        const deadline = enr.deadline || enr.data?.deadline;
        if (!deadline) continue;
        const deadlineAt = `${deadline}T00:00:00`;
        if (!inRange(deadlineAt, dateFrom, dateTo)) continue;
        events.push({
          id: `deadline-${enr.id}`,
          eventType: "course_deadline",
          courseId: enr.courseId || enr.course_id,
          sessionId: "",
          title: enr.courseTitle || enr.course_id || "",
          subtitle: "Deadline khóa học",
          startAt: deadlineAt,
          endAt: deadlineAt,
          location: "",
          status: enr.status || "notStarted",
          responseStatus: "",
          attendanceStatus: "",
          actionUrl: `/dashboard/courses/${encodeURIComponent(enr.courseId || enr.course_id)}`,
        });
      }
    } catch { /* no enrollments available */ }

    events.sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));
    return { events, source: "api" };
  },

  // Sync version — returns empty, async version should be used
  getEventsForAccount() { return []; },
};
