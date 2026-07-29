import { hasAdministrativeAccess } from "../middleware/auth.js";

function accessError(code, status) {
  return Object.assign(new Error(code), { code, status });
}

export async function requireCourseAccess(supabase, account, courseId, { requirePublished = true } = {}) {
  if (!courseId) throw accessError("COURSE_ID_REQUIRED", 400);
  if (hasAdministrativeAccess(account)) return { course: null, enrollment: null };

  const [courseResult, enrollmentResult] = await Promise.all([
    supabase.from("courses").select("id, status, data").eq("id", courseId).maybeSingle(),
    supabase.from("enrollments").select("id, course_id, account_id, status, data")
      .eq("course_id", courseId).eq("account_id", account.accountId).maybeSingle(),
  ]);

  if (courseResult.error || enrollmentResult.error) throw accessError("COURSE_ACCESS_LOOKUP_FAILED", 503);
  if (!courseResult.data || (requirePublished && courseResult.data.status !== "published")) {
    throw accessError("COURSE_NOT_AVAILABLE", 404);
  }
  if (!enrollmentResult.data) throw accessError("COURSE_NOT_ASSIGNED", 403);
  return { course: courseResult.data, enrollment: enrollmentResult.data };
}
