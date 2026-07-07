/**
 * Offline/classroom training service.
 * Supabase (via Worker API) is the source of truth.
 * No localStorage fallback for business data.
 */

import { trainingApiService } from "./trainingApiService.js";
import { notificationService } from "./notificationService.js";
import { sessionService } from "./sessionService.js";

const nowIso = () => new Date().toISOString();

function getActorId() {
  return sessionService.getValidSession()?.accountId || "";
}

function getActorRole() {
  return sessionService.getValidSession()?.role || "employee";
}

function buildSessionRow(data, prior = null, actorAccountId = "") {
  const start = new Date(data.startAt);
  const end = new Date(data.endAt);
  const deadline = data.registrationDeadline ? new Date(data.registrationDeadline) : null;

  if (!data.courseId || !String(data.title || "").trim() || !Number.isFinite(+start) || !Number.isFinite(+end) || end <= start)
    return { ok: false, error: "invalid_time" };
  if (data.locationType === "onsite" && !String(data.locationName || "").trim())
    return { ok: false, error: "location_required" };
  if (deadline && deadline >= start) return { ok: false, error: "invalid_deadline" };

  const row = {
    id: prior?.id || data.id || crypto.randomUUID(),
    courseId: data.courseId,
    title: String(data.title).trim(),
    description: String(data.description || ""),
    trainerName: String(data.trainerName || ""),
    trainerType: data.trainerType || "internal",
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    timezone: "Asia/Ho_Chi_Minh",
    locationType: data.locationType || "onsite",
    locationName: String(data.locationName || ""),
    address: String(data.address || ""),
    meetingUrl: String(data.meetingUrl || ""),
    capacity: Math.max(1, Math.floor(Number(data.capacity) || 1)),
    registrationDeadline: deadline?.toISOString() || "",
    attendanceRequired: data.attendanceRequired !== false,
    status: data.status || "scheduled",
    attendanceLocked: prior?.attendanceLocked || false,
    createdBy: prior?.createdBy || actorAccountId,
    createdAt: prior?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
  if (data.latitude != null) row.latitude = Number(data.latitude);
  if (data.longitude != null) row.longitude = Number(data.longitude);
  if (data.allowedRadiusMeters != null) row.allowedRadiusMeters = Number(data.allowedRadiusMeters);
  return { ok: true, session: row };
}

export const offlineTrainingService = {
  // ── Sessions ─────────────────────────────────────────────────────────────

  async listSessions({ courseId = "", status = "" } = {}) {
    try {
      const accountId = getActorId();
      const role = getActorRole();
      const data = await trainingApiService.listSessions(accountId, role);
      const sessions = Array.isArray(data) ? data : (data?.sessions || []);
      return sessions
        .filter((s) => (!courseId || s.courseId === courseId) && (!status || s.status === status))
        .sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));
    } catch {
      return [];
    }
  },

  async getSession(id) {
    const sessions = await this.listSessions();
    return sessions.find((s) => s.id === id) || null;
  },

  async saveSession(data, actorAccountId) {
    const prior = await this.getSession(data.id).catch(() => null);
    const result = buildSessionRow(data, prior, actorAccountId);
    if (!result.ok) return result;

    const saved = await trainingApiService.saveSession(result.session, actorAccountId);
    if (!saved?.ok && !saved?.id) return { ok: false, error: saved?.error || "save_failed" };
    return { ok: true, session: result.session };
  },

  // ── Participants ─────────────────────────────────────────────────────────

  async listParticipants(sessionId = "") {
    if (!sessionId) return [];
    try {
      const data = await trainingApiService.listParticipants(sessionId, getActorId());
      return Array.isArray(data) ? data : (data?.participants || []);
    } catch {
      return [];
    }
  },

  async getParticipantAccountIds(sessionId) {
    const participants = await this.listParticipants(sessionId);
    return [...new Set(participants.map((p) => p.accountId || p.account_id).filter(Boolean))];
  },

  async setParticipantsAsync(sessionId, accountIds, actorAccountId, { mode = "merge", source = "manual" } = {}) {
    const session = await this.getSession(sessionId);
    if (!session) return { ok: false, error: "not_found" };

    const uniqueIds = [...new Set(accountIds.filter(Boolean))];
    const participants = uniqueIds.map((accountId) => ({
      id: `part-${sessionId}-${accountId}`,
      sessionId,
      accountId,
      role: "learner",
      status: "assigned",
      source,
      addedAt: nowIso(),
      addedBy: actorAccountId,
    }));

    const result = await trainingApiService.syncParticipants(sessionId, participants, actorAccountId, { mode });
    if (!result?.ok) return { ok: false, error: result?.error || "sync_failed" };
    return { ok: true, participants, remoteCount: result.count };
  },

  setParticipants(sessionId, accountIds, actorAccountId, opts = {}) {
    return this.setParticipantsAsync(sessionId, accountIds, actorAccountId, opts);
  },

  async removeParticipant(sessionId, accountId, actorAccountId) {
    try {
      await trainingApiService.removeParticipant(sessionId, accountId, actorAccountId);
      return true;
    } catch {
      return false;
    }
  },

  participantSummary(session, participants) {
    const selected = participants?.length || 0;
    const capacity = Math.max(0, Number(session?.capacity) || 0);
    const remaining = Math.max(0, capacity - selected);
    const overBy = Math.max(0, selected - capacity);
    return { selected, capacity, remaining, overBy };
  },

  // ── Registrations ────────────────────────────────────────────────────────

  async registrations(sessionId = "") {
    if (!sessionId) return [];
    try {
      const data = await trainingApiService.listRegistrations(sessionId, getActorId(), getActorRole());
      return Array.isArray(data) ? data : (data?.registrations || []);
    } catch {
      return [];
    }
  },

  async getRegistration(sessionId, accountId) {
    const regs = await this.registrations(sessionId);
    return regs.find((r) => r.accountId === accountId || r.account_id === accountId) || null;
  },

  async ensureInvitations(sessionId) {
    const participantIds = await this.getParticipantAccountIds(sessionId);
    const regs = await this.registrations(sessionId);
    const existingIds = new Set(regs.map((r) => r.accountId || r.account_id));
    const missing = participantIds.filter((id) => !existingIds.has(id));

    if (!missing.length) return regs;

    const newRegs = missing.map((accountId) => ({
      id: `reg-${sessionId}-${accountId}`,
      sessionId,
      accountId,
      responseStatus: "pending",
      responseReason: "",
      respondedAt: "",
      attendanceStatus: "not_marked",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }));

    await trainingApiService.syncRegistrations(newRegs, getActorId(), "hr").catch(() => {});
    return [...regs, ...newRegs];
  },

  async respond(sessionId, accountId, responseStatus, responseReason = "") {
    const session = await this.getSession(sessionId);
    if (!session) return { ok: false, error: "session_not_found" };
    if (!["attending", "busy", "declined"].includes(responseStatus)) return { ok: false, error: "invalid_response" };
    if (session.registrationDeadline && new Date() > new Date(session.registrationDeadline)) {
      return { ok: false, error: "deadline_passed" };
    }

    const patch = { responseStatus, responseReason: String(responseReason || ""), respondedAt: nowIso(), updatedAt: nowIso() };
    try {
      await trainingApiService.patchRegistration(sessionId, accountId, patch, accountId, "employee");
    } catch (err) {
      return { ok: false, error: err.message };
    }

    notificationService.create({
      account_id: accountId,
      type: "offline_response",
      title: responseStatus === "attending" ? "Đã xác nhận tham gia" : "Đã ghi nhận báo bận",
      body: session.title,
      link: `/dashboard/calendar?sessionId=${sessionId}`,
      created_by: "system",
    }).catch(() => {});

    return { ok: true, registration: patch };
  },

  async markAttendance(sessionId, accountId, data, actorAccountId) {
    const session = await this.getSession(sessionId);
    if (!session) return { ok: false, error: "session_not_found" };
    if (session.attendanceLocked) return { ok: false, error: "attendance_locked" };

    const status = data.attendanceStatus;
    if (!["not_marked", "attended", "partial", "absent", "excused"].includes(status)) {
      return { ok: false, error: "invalid_status" };
    }

    const scheduled = Math.max(0, (new Date(session.endAt) - new Date(session.startAt)) / 1000);
    let seconds = 0;
    if (status === "attended" || status === "partial") {
      const checkIn = data.checkInAt ? new Date(data.checkInAt) : null;
      const checkOut = data.checkOutAt ? new Date(data.checkOutAt) : null;
      if (checkIn && checkOut && checkOut > checkIn) seconds = Math.min(scheduled, (checkOut - checkIn) / 1000);
      else seconds = Math.min(scheduled, Math.max(0, Number(data.attendedMinutes ?? (status === "attended" ? scheduled / 60 : 0)) * 60));
    }

    const patch = {
      attendanceStatus: status,
      checkInAt: data.checkInAt || "",
      checkOutAt: data.checkOutAt || "",
      attendedSeconds: Math.round(seconds),
      attendanceNote: String(data.attendanceNote || ""),
      markedBy: actorAccountId,
      markedAt: nowIso(),
      updatedAt: nowIso(),
    };

    try {
      await trainingApiService.patchRegistration(sessionId, accountId, patch, actorAccountId, "hr");
    } catch (err) {
      return { ok: false, error: err.message };
    }

    return { ok: true, registration: patch };
  },

  async setAttendanceLocked(sessionId, locked, actorAccountId, reason = "") {
    const session = await this.getSession(sessionId);
    if (!session) return false;
    const patch = { ...session, attendanceLocked: !!locked, attendanceLockReason: String(reason || ""), attendanceLockedAt: locked ? nowIso() : "", updatedAt: nowIso() };
    try {
      await trainingApiService.saveSession(patch, actorAccountId);
      return true;
    } catch {
      return false;
    }
  },

  // Legacy sync alias — no-op now that API is primary
  getRevision() { return 0; },
  buildSession: buildSessionRow,
  saveToLocal() {},
  addParticipantsByCourseAssignments() { return { ok: false, error: "use setParticipantsAsync" }; },
  addParticipantsByDepartments() { return { ok: false, error: "use setParticipantsAsync" }; },
};
