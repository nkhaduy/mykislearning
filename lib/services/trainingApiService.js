/**
 * Async API client for shared training data (Supabase via Vercel functions).
 * Provides the same data shapes as offlineTrainingService but reads/writes
 * from the server so data is shared across all browsers.
 *
 * All methods return { ok, data?, error? }.
 * If the API is unavailable (network error / no config), methods reject so
 * callers can fall back to localStorage.
 */

const BASE = "/api/training";

function headers(accountId, role) {
  return {
    "Content-Type": "application/json",
    "X-Account-Id": accountId || "",
    "X-Account-Role": role || "employee",
  };
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export const trainingApiService = {
  // ── Sessions ──────────────────────────────────────────────────────────────

  async listSessions(accountId, role) {
    return apiFetch("/sessions", { headers: headers(accountId, role) });
  },

  async saveSession(session, accountId) {
    return apiFetch("/sessions", {
      method: "POST",
      headers: headers(accountId, "hr"),
      body: JSON.stringify(session),
    });
  },

  // ── Participants ──────────────────────────────────────────────────────────

  async listParticipants(sessionId, accountId) {
    return apiFetch(`/participants?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: headers(accountId, "hr"),
    });
  },

  async syncParticipants(sessionId, participants, accountId) {
    return apiFetch("/participants", {
      method: "POST",
      headers: headers(accountId, "hr"),
      body: JSON.stringify({ sessionId, participants }),
    });
  },

  async removeParticipant(sessionId, targetAccountId, actorAccountId) {
    return apiFetch("/participants", {
      method: "DELETE",
      headers: headers(actorAccountId, "hr"),
      body: JSON.stringify({ sessionId, accountId: targetAccountId }),
    });
  },

  // ── Calendar (employee) ───────────────────────────────────────────────────

  async getCalendar(accountId) {
    return apiFetch("/calendar", { headers: headers(accountId, "employee") });
  },

  // ── Registrations ─────────────────────────────────────────────────────────

  async listRegistrations(sessionId, accountId, role) {
    return apiFetch(`/registrations?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: headers(accountId, role),
    });
  },

  async syncRegistrations(registrations, accountId, role) {
    return apiFetch("/registrations", {
      method: "POST",
      headers: headers(accountId, role),
      body: JSON.stringify({ registrations }),
    });
  },

  async patchRegistration(sessionId, accountId, patch, actorAccountId, role) {
    return apiFetch("/registrations", {
      method: "PATCH",
      headers: headers(actorAccountId, role),
      body: JSON.stringify({ sessionId, accountId, patch }),
    });
  },
};
