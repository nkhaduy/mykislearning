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

    if (path === "/api/employees" || path.startsWith("/api/employees/")) return await handleEmployees(request, env);

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
