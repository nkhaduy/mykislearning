import { getAccountById, getCourseById, getEnrollmentsByAccountId, getQuizzesByCourseId } from "../mockDatabase.js";
import { offlineTrainingService } from "./offlineTrainingService.js";
import { trainingApiService } from "./trainingApiService.js";

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
  if (registration?.responseStatus === "waitlisted") return "waitlisted";
  return "pending";
}

function buildEvents(sessions, registrationMap, accountId, { dateFrom = "", dateTo = "", includeCancelled = true } = {}) {
  const events = [];
  for (const session of sessions) {
    const course = getCourseById(session.courseId);
    // Only require course to be published if we have course data; if not, show session anyway
    if (course && course.status !== "published") continue;
    const registration = registrationMap.get(session.id) || null;
    if (!includeCancelled && session.status === "cancelled") continue;
    if (!inRange(session.startAt, dateFrom, dateTo)) continue;
    events.push({
      id: `session-${session.id}`,
      eventType: "offline_session",
      courseId: session.courseId,
      sessionId: session.id,
      title: course?.title || session.title || session.courseId,
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
  return events;
}

export const calendarService = {
  /**
   * Async version — fetches from Supabase via API, falls back to localStorage.
   * Returns { events, source: "api" | "local" }.
   */
  async getEventsForAccountAsync(accountId, options = {}) {
    const account = getAccountById(accountId);
    if (!account || account.role !== "employee" || account.accountStatus !== "active") {
      return { events: this._deadlineEvents(accountId, options), source: "local" };
    }

    let sessionEvents = [];
    let source = "local";

    try {
      const { sessions, registrations } = await trainingApiService.getCalendar(accountId);
      const regMap = new Map((registrations || []).map((r) => [r.sessionId, r]));
      sessionEvents = buildEvents(sessions || [], regMap, accountId, options);
      source = "api";

      // Write-through to localStorage so HR side and offline mode stay in sync
      if (sessions?.length) {
        const existing = offlineTrainingService.listSessions();
        const existingIds = new Set(existing.map((s) => s.id));
        for (const s of sessions) {
          if (!existingIds.has(s.id)) {
            // Merge into local store without triggering another API call
            const { localStorageAdapter } = await import("../storage/localStorageAdapter.js");
            const rows = localStorageAdapter.read("mykis.offlineSessions.v1", []);
            if (!rows.find((r) => r.id === s.id)) {
              rows.push(s);
              localStorageAdapter.write("mykis.offlineSessions.v1", rows);
            }
          }
        }
      }
    } catch {
      // API unavailable — fall back to localStorage (development / offline)
      const sessions = offlineTrainingService.listSessions().filter((s) => {
        const directParticipant = offlineTrainingService.listParticipants(s.id).some((r) => r.accountId === accountId);
        return directParticipant;
      });
      const regMap = new Map(
        sessions.map((s) => [s.id, offlineTrainingService.getRegistration(s.id, accountId)])
      );
      sessionEvents = buildEvents(sessions, regMap, accountId, options);
    }

    const deadlines = this._deadlineEvents(accountId, options);
    const all = [...sessionEvents, ...deadlines].sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));
    return { events: all, source };
  },

  /**
   * Sync fallback kept for non-calendar uses (e.g. HR listing sessions on their page).
   */
  getEventsForAccount(accountId, options = {}) {
    const account = getAccountById(accountId);
    if (!account || account.role !== "employee" || account.accountStatus !== "active") return [];
    const events = [];
    for (const session of offlineTrainingService.listSessions()) {
      const course = getCourseById(session.courseId);
      if (!course || course.status !== "published") continue;
      const registration = offlineTrainingService.getRegistration(session.id, accountId);
      const directParticipant = offlineTrainingService.listParticipants(session.id).some((row) => row.accountId === accountId);
      const visible = directParticipant;
      if (!visible) continue;
      if (!options.includeCancelled && session.status === "cancelled") continue;
      if (!inRange(session.startAt, options.dateFrom, options.dateTo)) continue;
      events.push({
        id: `session-${session.id}`,
        eventType: "offline_session",
        courseId: session.courseId,
        sessionId: session.id,
        title: course.title,
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
    return [...events, ...this._deadlineEvents(accountId, options)].sort(
      (a, b) => String(a.startAt).localeCompare(String(b.startAt))
    );
  },

  _deadlineEvents(accountId, { dateFrom = "", dateTo = "" } = {}) {
    const events = [];
    const enrollments = getEnrollmentsByAccountId(accountId);
    for (const enrollment of enrollments) {
      const course = getCourseById(enrollment.courseId);
      if (!course || course.status !== "published" || !enrollment.deadline) continue;
      const deadlineAt = `${enrollment.deadline}T00:00:00`;
      if (!inRange(deadlineAt, dateFrom, dateTo)) continue;
      events.push({
        id: `deadline-${enrollment.id}`,
        eventType: "course_deadline",
        courseId: enrollment.courseId,
        sessionId: "",
        title: course.title,
        subtitle: "Deadline khóa học",
        startAt: deadlineAt,
        endAt: deadlineAt,
        location: "",
        status: enrollment.status,
        responseStatus: "",
        attendanceStatus: "",
        actionUrl: `/dashboard/courses/${encodeURIComponent(enrollment.courseId)}`,
      });
      for (const quiz of getQuizzesByCourseId(enrollment.courseId)) {
        if (quiz.deadline && inRange(`${quiz.deadline}T00:00:00`, dateFrom, dateTo)) {
          events.push({
            id: `quiz-${quiz.id}`,
            eventType: "quiz_deadline",
            courseId: enrollment.courseId,
            sessionId: "",
            title: course.title,
            subtitle: quiz.title,
            startAt: `${quiz.deadline}T00:00:00`,
            endAt: `${quiz.deadline}T00:00:00`,
            location: "",
            status: "quiz_due",
            responseStatus: "",
            attendanceStatus: "",
            actionUrl: `/dashboard/quizzes`,
          });
        }
      }
    }
    return events;
  },
};
