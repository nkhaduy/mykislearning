import { json, corsPreflight } from "./services/responses.js";
import { handleConfig } from "./routes/config.js";
import { handleAuth } from "./routes/auth.js";
import { handleCourses } from "./routes/courses.js";
import { handleEnrollments } from "./routes/enrollments.js";
import { handleContentProgress } from "./routes/content-progress.js";
import { handleTraining } from "./routes/training.js";
import { handleAttendance } from "./routes/attendance.js";
import { handleExternalTraining } from "./routes/external-training.js";
import { handleEmployees } from "./routes/employees.js";
import { handleBackfill } from "./routes/backfill.js";
import { handleNotifications } from "./routes/notifications.js";
import { handleQuizzes } from "./routes/quizzes.js";
import { handleActivity } from "./routes/activity.js";
import { handleAdminOverview } from "./routes/admin-overview.js";
import { handleAccountSupport, handleHrAccountActions } from "./routes/account-support.js";
import { handleLearningRecords } from "./routes/learning-records.js";
import { handleLearningPaths } from "./routes/learning-paths.js";
import { handleCompliance } from "./routes/compliance.js";
import { handleCertificates } from "./routes/certificates.js";

export async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") return corsPreflight();

  try {
    if (path === "/api/config") return await handleConfig(request, env);

    if (path === "/api/auth" || path.startsWith("/api/auth/")) return await handleAuth(request, env);

    if (path === "/api/courses" || path === "/api/courses/content") return await handleCourses(request, env);

    if (path === "/api/enrollments") return await handleEnrollments(request, env);

    if (path === "/api/content-progress") return await handleContentProgress(request, env);

    if (
      path === "/api/training/sessions" ||
      path === "/api/training/participants" ||
      path === "/api/training/calendar" ||
      path === "/api/training/registrations"
    ) return await handleTraining(request, env);

    if (path.startsWith("/api/attendance/")) return await handleAttendance(request, env);

    if (path === "/api/external-training" || path.startsWith("/api/external-training/")) return await handleExternalTraining(request, env);

    if (
      path === "/api/certificates/my" ||
      path.startsWith("/api/certificates/my/") ||
      path === "/api/admin/certificates" ||
      path.startsWith("/api/admin/certificates/")
    ) return await handleCertificates(request, env);

    if (
      path === "/api/learning-history" ||
      path.startsWith("/api/learning-history/") ||
      path === "/api/certifications" ||
      path.startsWith("/api/certifications/") ||
      path.startsWith("/api/admin/learning-records") ||
      path.startsWith("/api/admin/certifications") ||
      path.startsWith("/api/learning-evidence/")
    ) return await handleLearningRecords(request, env);

    if (path === "/api/employees" || path.startsWith("/api/employees/")) return await handleEmployees(request, env);

    if (path === "/api/admin/backfill") return await handleBackfill(request, env);

    if (path === "/api/activity/heartbeat") return await handleActivity(request, env);

    if (
      path === "/api/admin/overview" ||
      path === "/api/admin/online-users" ||
      path === "/api/admin/pending-actions" ||
      path === "/api/admin/tasks"
    ) return await handleAdminOverview(request, env);

    if (path === "/api/account-support/requests") return await handleAccountSupport(request, env);

    if (path === "/api/admin/account-support/requests" ||
        path.startsWith("/api/admin/account-support/requests/")) return await handleAccountSupport(request, env);

    if (path === "/api/admin/hr-account-actions") return await handleHrAccountActions(request, env);

    if (path === "/api/notifications") return await handleNotifications(request, env);

    if (
      path === "/api/quizzes" ||
      path === "/api/quizzes/attempts" ||
      path.match(/^\/api\/quizzes\/[^/]+\/questions$/)
    ) return await handleQuizzes(request, env);

    if (
      path === "/api/learning-paths/my" ||
      path.startsWith("/api/learning-paths/my/") ||
      path === "/api/admin/learning-paths" ||
      path.startsWith("/api/admin/learning-paths/") ||
      path.startsWith("/api/admin/learning-path-assignments/")
    ) return await handleLearningPaths(request, env);

    if (
      path === "/api/compliance/my" ||
      path.startsWith("/api/compliance/my/") ||
      path === "/api/admin/compliance/overview" ||
      path.startsWith("/api/admin/compliance/")
    ) return await handleCompliance(request, env);

    return json({ ok: false, error: "NOT_FOUND" }, 404);
  } catch (error) {
    console.error("[WORKER]", error);
    return json({
      ok: false,
      error: error.code || "INTERNAL_ERROR",
      message: error.message || "Unexpected error",
    }, error.status || 500);
  }
}
