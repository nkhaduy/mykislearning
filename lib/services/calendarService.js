import { getAccountById, getCourseById, getEnrollmentsByAccountId, getQuizzesByCourseId } from "../mockDatabase.js";
import { offlineTrainingService } from "./offlineTrainingService.js";

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

export const calendarService = {
  getEventsForAccount(accountId, { dateFrom = "", dateTo = "", includeCancelled = true } = {}) {
    const account = getAccountById(accountId);
    if (!account || account.role !== "employee" || account.accountStatus !== "active") return [];

    const enrollments = getEnrollmentsByAccountId(accountId);
    const courseIds = new Set(enrollments.map((row) => row.courseId));
    const events = [];

    for (const session of offlineTrainingService.listSessions()) {
      const course = getCourseById(session.courseId);
      if (!course || course.status !== "published") continue;
      const registration = offlineTrainingService.getRegistration(session.id, accountId);
      const directParticipant = offlineTrainingService.listParticipants(session.id).some((row) => row.accountId === accountId);
      const visible = directParticipant || courseIds.has(session.courseId) || !!registration;
      if (!visible) continue;
      if (!includeCancelled && session.status === "cancelled") continue;
      if (!inRange(session.startAt, dateFrom, dateTo)) continue;
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

    return events.sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));
  },
};
