/**
 * courseApiService — async client for /api/courses, /api/enrollments, /api/content-progress.
 *
 * Pattern mirrors trainingApiService.js:
 *   - All methods return the raw API response body (throw on HTTP error)
 *   - Callers use .catch() or try/catch; localStorage fallback is in the caller
 */

const BASE = "";

function headers(accountId, role) {
  return {
    "Content-Type": "application/json",
    "X-Account-Id": accountId || "",
    "X-Account-Role": role || "employee",
  };
}

async function apiFetch(path, options = {}) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export const courseApiService = {
  // ── Courses ───────────────────────────────────────────────────────────────

  /** List all courses. HR: all. Employee: enrolled only. */
  async listCourses(accountId, role) {
    return apiFetch("/api/courses", { headers: headers(accountId, role) });
  },

  /** Upsert one course (HR only). */
  async saveCourse(course, accountId) {
    return apiFetch("/api/courses", {
      method: "POST",
      headers: headers(accountId, "hr"),
      body: JSON.stringify(course),
    });
  },

  /** Delete a course by id (HR only). */
  async deleteCourse(id, accountId) {
    return apiFetch(`/api/courses?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: headers(accountId, "hr"),
    });
  },

  // ── Course Content ────────────────────────────────────────────────────────

  /** List content items for a course (with signed URLs for uploaded files). */
  async listContent(courseId, accountId, role) {
    return apiFetch(`/api/courses/content?courseId=${encodeURIComponent(courseId)}`, {
      headers: headers(accountId, role),
    });
  },

  /** Upsert content items for a course (HR only). items = array of content objects. */
  async saveContent(courseId, items, accountId) {
    return apiFetch("/api/courses/content", {
      method: "POST",
      headers: headers(accountId, "hr"),
      body: JSON.stringify({ courseId, items }),
    });
  },

  /** Delete one content item by id (HR only). */
  async deleteContent(id, accountId) {
    return apiFetch(`/api/courses/content?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: headers(accountId, "hr"),
    });
  },

  // ── Enrollments ───────────────────────────────────────────────────────────

  /** List enrollments for an account. */
  async listEnrollments(accountId, role) {
    return apiFetch(`/api/enrollments?accountId=${encodeURIComponent(accountId)}`, {
      headers: headers(accountId, role),
    });
  },

  /** List enrollments for a course (HR). */
  async listEnrollmentsByCourse(courseId, accountId) {
    return apiFetch(`/api/enrollments?courseId=${encodeURIComponent(courseId)}`, {
      headers: headers(accountId, "hr"),
    });
  },

  /** Bulk-assign enrollments (HR only). enrollments = array of enrollment objects. */
  async assignEnrollments(enrollments, accountId) {
    return apiFetch("/api/enrollments", {
      method: "POST",
      headers: headers(accountId, "hr"),
      body: JSON.stringify({ enrollments }),
    });
  },

  /** Update progress/status for one enrollment (Employee or HR). */
  async patchEnrollment({ id, courseId, accountId: targetAccount, patch }, actorAccountId, role) {
    return apiFetch("/api/enrollments", {
      method: "PATCH",
      headers: headers(actorAccountId, role),
      body: JSON.stringify({ id, courseId, accountId: targetAccount, patch }),
    });
  },

  /** Remove an enrollment (HR only). */
  async deleteEnrollment(id, accountId) {
    return apiFetch(`/api/enrollments?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: headers(accountId, "hr"),
    });
  },

  // ── Content Progress ──────────────────────────────────────────────────────

  /** Get content progress for account + course. */
  async getProgress(accountId, courseId, role) {
    return apiFetch(
      `/api/content-progress?accountId=${encodeURIComponent(accountId)}&courseId=${encodeURIComponent(courseId)}`,
      { headers: headers(accountId, role || "employee") }
    );
  },

  /** Save a content progress record. */
  async saveProgress(progressData, accountId, role) {
    return apiFetch("/api/content-progress", {
      method: "POST",
      headers: headers(accountId, role || "employee"),
      body: JSON.stringify(progressData),
    });
  },
};
