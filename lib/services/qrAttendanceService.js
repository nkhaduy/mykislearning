import { createNotification, getAccountById, getCourseById } from "../mockDatabase.js";
import { localStorageAdapter } from "../storage/localStorageAdapter.js";
import { offlineTrainingService } from "./offlineTrainingService.js";

const SLOTS_KEY = "mykis.attendanceSlots.v1";
const TOKENS_KEY = "mykis.qrAttendanceTokens.v1";
const RECORDS_KEY = "mykis.qrAttendanceRecords.v1";

const QR_SCAN_PATH = "/attendance/scan";

function nowIso() {
  return new Date().toISOString();
}

function scheduledSeconds(slot) {
  return Math.max(0, Math.round((new Date(slot.endAt) - new Date(slot.startAt)) / 1000));
}

function sortByStart(a, b) {
  return String(a.startAt).localeCompare(String(b.startAt));
}

function readRows(key) {
  return localStorageAdapter.read(key, []);
}

function writeRows(key, rows) {
  return localStorageAdapter.write(key, rows);
}

function safeToken() {
  return crypto.randomUUID().replaceAll("-", "");
}

function computeCountedSeconds(slot, record) {
  const maxSeconds = scheduledSeconds(slot);
  if (!record.checkInAt || !record.checkOutAt) return 0;
  const seconds = Math.max(0, Math.round((new Date(record.checkOutAt) - new Date(record.checkInAt)) / 1000));
  return Math.min(maxSeconds, seconds);
}

function updateSessionRegistrationFromRecord(slot, record, actorAccountId = "system") {
  if (!slot?.sessionId || !record?.accountId) return;
  const statuses = {
    checked_in: "partial",
    checked_out: record.countedSeconds > 0 ? "attended" : "partial",
    manual_attended: "attended",
    manual_partial: "partial",
    manual_absent: "absent",
    exception: "partial",
  };
  const attendanceStatus = statuses[record.attendanceStatus] || "partial";
  offlineTrainingService.markAttendance(
    slot.sessionId,
    record.accountId,
    {
      attendanceStatus,
      checkInAt: record.checkInAt || "",
      checkOutAt: record.checkOutAt || "",
      attendedMinutes: Math.round((record.countedSeconds || 0) / 60),
      attendanceNote: `Slot ${slot.label}`,
    },
    actorAccountId,
  );
}

export const qrAttendanceService = {
  listSlots(sessionId = "") {
    return readRows(SLOTS_KEY).filter((slot) => !sessionId || slot.sessionId === sessionId).sort(sortByStart);
  },
  getSlot(slotId) {
    return this.listSlots().find((slot) => slot.id === slotId) || null;
  },
  saveSlot(data, actorAccountId) {
    if (getAccountById(actorAccountId)?.role !== "hr") return { ok: false, error: "forbidden" };
    const session = offlineTrainingService.getSession(data.sessionId);
    if (!session) return { ok: false, error: "session_not_found" };
    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    if (!Number.isFinite(+startAt) || !Number.isFinite(+endAt) || endAt <= startAt) return { ok: false, error: "invalid_time" };
    const rows = readRows(SLOTS_KEY);
    const index = rows.findIndex((slot) => slot.id === data.id);
    const prior = index >= 0 ? rows[index] : null;
    const slot = {
      id: prior?.id || crypto.randomUUID(),
      sessionId: data.sessionId,
      label: data.label || "Buổi sáng",
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      checkInOpenAt: new Date(data.checkInOpenAt || data.startAt).toISOString(),
      checkInCloseAt: new Date(data.checkInCloseAt || data.startAt).toISOString(),
      checkOutOpenAt: new Date(data.checkOutOpenAt || data.endAt).toISOString(),
      checkOutCloseAt: new Date(data.checkOutCloseAt || data.endAt).toISOString(),
      mode: data.mode === "check_in_only" ? "check_in_only" : "check_in_out",
      status: data.status || "scheduled",
      attendanceRules: {
        lateAfterMinutes: Math.max(0, Number(data.lateAfterMinutes) || 15),
        earlyLeaveBeforeMinutes: Math.max(0, Number(data.earlyLeaveBeforeMinutes) || 15),
        minimumAttendancePercent: Math.max(1, Number(data.minimumAttendancePercent) || 80),
      },
      createdAt: prior?.createdAt || nowIso(),
      createdBy: prior?.createdBy || actorAccountId,
      updatedAt: nowIso(),
      updatedBy: actorAccountId,
    };
    if (index >= 0) rows[index] = slot;
    else rows.push(slot);
    writeRows(SLOTS_KEY, rows);
    return { ok: true, slot };
  },
  getOrCreateDefaultSlots(sessionId, actorAccountId) {
    const existing = this.listSlots(sessionId);
    if (existing.length) return existing;
    const session = offlineTrainingService.getSession(sessionId);
    if (!session) return [];
    const start = new Date(session.startAt);
    const end = new Date(session.endAt);
    const totalMinutes = Math.max(60, Math.round((end - start) / 60000));
    if (totalMinutes <= 240) {
      return [this.saveSlot({
        sessionId,
        label: "Buổi sáng",
        startAt: session.startAt,
        endAt: session.endAt,
        checkInOpenAt: new Date(start.getTime() - 30 * 60000).toISOString(),
        checkInCloseAt: new Date(start.getTime() + 30 * 60000).toISOString(),
        checkOutOpenAt: new Date(end.getTime() - 20 * 60000).toISOString(),
        checkOutCloseAt: new Date(end.getTime() + 30 * 60000).toISOString(),
      }, actorAccountId).slot].filter(Boolean);
    }
    const midday = new Date(start.getTime() + Math.floor(totalMinutes / 2) * 60000);
    const lunchEnd = new Date(midday.getTime() + 60 * 60000);
    return [
      this.saveSlot({
        sessionId,
        label: "Buổi sáng",
        startAt: session.startAt,
        endAt: midday.toISOString(),
        checkInOpenAt: new Date(start.getTime() - 30 * 60000).toISOString(),
        checkInCloseAt: new Date(start.getTime() + 30 * 60000).toISOString(),
        checkOutOpenAt: new Date(midday.getTime() - 20 * 60000).toISOString(),
        checkOutCloseAt: new Date(midday.getTime() + 30 * 60000).toISOString(),
      }, actorAccountId).slot,
      this.saveSlot({
        sessionId,
        label: "Buổi chiều",
        startAt: lunchEnd.toISOString(),
        endAt: session.endAt,
        checkInOpenAt: new Date(lunchEnd.getTime() - 30 * 60000).toISOString(),
        checkInCloseAt: new Date(lunchEnd.getTime() + 30 * 60000).toISOString(),
        checkOutOpenAt: new Date(end.getTime() - 20 * 60000).toISOString(),
        checkOutCloseAt: new Date(end.getTime() + 30 * 60000).toISOString(),
      }, actorAccountId).slot,
    ].filter(Boolean);
  },
  listTokens(slotId = "") {
    return readRows(TOKENS_KEY).filter((row) => !slotId || row.slotId === slotId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },
  createToken({ slotId, action, opensAt = "", closesAt = "" }, actorAccountId) {
    if (getAccountById(actorAccountId)?.role !== "hr") return { ok: false, error: "forbidden" };
    const slot = this.getSlot(slotId);
    if (!slot) return { ok: false, error: "slot_not_found" };
    if (!["check_in", "check_out"].includes(action)) return { ok: false, error: "invalid_action" };
    const token = {
      id: crypto.randomUUID(),
      slotId,
      sessionId: slot.sessionId,
      courseId: offlineTrainingService.getSession(slot.sessionId)?.courseId || "",
      action,
      opaqueToken: safeToken(),
      opensAt: new Date(opensAt || (action === "check_in" ? slot.checkInOpenAt : slot.checkOutOpenAt)).toISOString(),
      closesAt: new Date(closesAt || (action === "check_in" ? slot.checkInCloseAt : slot.checkOutCloseAt)).toISOString(),
      status: "open",
      createdAt: nowIso(),
      createdBy: actorAccountId,
    };
    const rows = readRows(TOKENS_KEY).filter((row) => !(row.slotId === slotId && row.action === action && row.status === "open"));
    rows.unshift(token);
    writeRows(TOKENS_KEY, rows);
    return { ok: true, token, url: `${QR_SCAN_PATH}?token=${encodeURIComponent(token.opaqueToken)}` };
  },
  closeToken(tokenId, actorAccountId) {
    if (getAccountById(actorAccountId)?.role !== "hr") return false;
    const rows = readRows(TOKENS_KEY);
    const index = rows.findIndex((row) => row.id === tokenId);
    if (index < 0) return false;
    rows[index] = { ...rows[index], status: "closed", closedAt: nowIso() };
    writeRows(TOKENS_KEY, rows);
    return true;
  },
  getTokenByOpaque(opaqueToken) {
    return this.listTokens().find((row) => row.opaqueToken === opaqueToken) || null;
  },
  validateToken(opaqueToken) {
    const token = this.getTokenByOpaque(opaqueToken);
    if (!token) return { ok: false, error: "not_found" };
    if (token.status !== "open") return { ok: false, error: "closed", token };
    const now = Date.now();
    if (new Date(token.opensAt).getTime() > now) return { ok: false, error: "not_open_yet", token };
    if (new Date(token.closesAt).getTime() < now) return { ok: false, error: "expired", token };
    const slot = this.getSlot(token.slotId);
    const session = slot ? offlineTrainingService.getSession(slot.sessionId) : null;
    const course = session ? getCourseById(session.courseId) : null;
    if (!slot || !session || session.status === "cancelled") return { ok: false, error: "session_cancelled", token };
    if (!course || course.status !== "published" || session.status === "draft") return { ok: false, error: "session_unavailable", token };
    return { ok: true, token, slot, session };
  },
  listRecords(slotId = "") {
    return readRows(RECORDS_KEY).filter((row) => !slotId || row.slotId === slotId);
  },
  getRecord(slotId, accountId) {
    return this.listRecords(slotId).find((row) => row.slotId === slotId && row.accountId === accountId) || null;
  },
  scan(opaqueToken, accountId, locationData = null) {
    const validated = this.validateToken(opaqueToken);
    if (!validated.ok) return validated;
    const { token, slot, session } = validated;
    const registration = offlineTrainingService.getRegistration(session.id, accountId);
    const account = getAccountById(accountId);
    if (!account || account.accountStatus !== "active") return { ok: false, error: "account_disabled" };
    if (session.status === "cancelled" || new Date(session.startAt) > new Date(token.closesAt)) return { ok: false, error: "session_cancelled" };
    if (!registration) return { ok: false, error: "not_invited" };
    if (registration.responseStatus === "busy" || registration.responseStatus === "declined") return { ok: false, error: "busy" };
    const rows = readRows(RECORDS_KEY);
    const index = rows.findIndex((row) => row.slotId === slot.id && row.accountId === accountId);
    const prior = index >= 0 ? rows[index] : null;
    if (token.action === "check_in" && prior?.checkInAt) return { ok: false, error: "already_checked_in", record: prior, slot, session };
    if (token.action === "check_out" && prior?.checkOutAt) return { ok: false, error: "already_checked_out", record: prior, slot, session };
    if (token.action === "check_out" && !prior?.checkInAt) return { ok: false, error: "missing_check_in", slot, session };
    const checkInAt = token.action === "check_in" ? nowIso() : (prior?.checkInAt || "");
    const checkOutAt = token.action === "check_out" ? nowIso() : (prior?.checkOutAt || "");
    const lateMinutes = checkInAt ? Math.max(0, Math.round((new Date(checkInAt) - new Date(slot.startAt)) / 60000)) : 0;
    const earlyLeaveMinutes = checkOutAt ? Math.max(0, Math.round((new Date(slot.endAt) - new Date(checkOutAt)) / 60000)) : 0;
    const countedSeconds = computeCountedSeconds(slot, { checkInAt, checkOutAt });
    const attendancePercent = scheduledSeconds(slot) ? countedSeconds / scheduledSeconds(slot) * 100 : 0;
    const attendanceStatus = token.action === "check_out"
      ? (attendancePercent >= Number(slot.attendanceRules?.minimumAttendancePercent || 80) ? "checked_out" : "exception")
      : "checked_in";
    const record = {
      id: prior?.id || crypto.randomUUID(),
      accountId,
      courseId: session.courseId,
      sessionId: session.id,
      slotId: slot.id,
      responseStatus: registration.responseStatus,
      checkInAt,
      checkOutAt,
      checkInMethod: checkInAt ? "qr" : prior?.checkInMethod || "",
      checkOutMethod: checkOutAt ? "qr" : prior?.checkOutMethod || "",
      checkInLocation: token.action === "check_in" && locationData ? locationData : (prior?.checkInLocation || null),
      checkOutLocation: token.action === "check_out" && locationData ? locationData : (prior?.checkOutLocation || null),
      attendanceStatus,
      lateMinutes,
      earlyLeaveMinutes,
      countedSeconds,
      manuallyAdjusted: prior?.manuallyAdjusted || false,
      adjustmentReason: prior?.adjustmentReason || "",
      markedBy: prior?.markedBy || "",
      createdAt: prior?.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    if (index >= 0) rows[index] = record;
    else rows.unshift(record);
    writeRows(RECORDS_KEY, rows);
    if (token.action === "check_out") updateSessionRegistrationFromRecord(slot, record, "acc-hr-demo");
    createNotification({
      type: token.action === "check_in" ? "qr_check_in_success" : "qr_check_out_success",
      targetAccountId: accountId,
      title: token.action === "check_in" ? "Điểm danh thành công" : "Check-out thành công",
      body: `${session.title} · ${slot.label}`,
      actionUrl: `/dashboard/calendar?sessionId=${session.id}`,
      createdBy: "system",
    });
    return { ok: true, token, slot, session, record };
  },
  manualMark(slotId, accountId, data, actorAccountId) {
    if (getAccountById(actorAccountId)?.role !== "hr") return { ok: false, error: "forbidden" };
    const slot = this.getSlot(slotId);
    const session = slot ? offlineTrainingService.getSession(slot.sessionId) : null;
    if (!slot || !session) return { ok: false, error: "slot_not_found" };
    const rows = readRows(RECORDS_KEY);
    const index = rows.findIndex((row) => row.slotId === slotId && row.accountId === accountId);
    const prior = index >= 0 ? rows[index] : null;
    const checkInAt = data.checkInAt || prior?.checkInAt || "";
    const checkOutAt = data.checkOutAt || prior?.checkOutAt || "";
    const countedSeconds = Math.min(scheduledSeconds(slot), Math.max(0, Number(data.countedSeconds) || computeCountedSeconds(slot, { checkInAt, checkOutAt })));
    const record = {
      id: prior?.id || crypto.randomUUID(),
      accountId,
      courseId: session.courseId,
      sessionId: session.id,
      slotId,
      responseStatus: offlineTrainingService.getRegistration(session.id, accountId)?.responseStatus || "pending",
      checkInAt,
      checkOutAt,
      checkInMethod: checkInAt ? (prior?.checkInMethod || "manual") : "",
      checkOutMethod: checkOutAt ? (prior?.checkOutMethod || "manual") : "",
      attendanceStatus: data.attendanceStatus || "manual_attended",
      lateMinutes: Math.max(0, Number(data.lateMinutes) || 0),
      earlyLeaveMinutes: Math.max(0, Number(data.earlyLeaveMinutes) || 0),
      countedSeconds,
      manuallyAdjusted: true,
      adjustmentReason: String(data.adjustmentReason || ""),
      markedBy: actorAccountId,
      createdAt: prior?.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    if (index >= 0) rows[index] = record;
    else rows.unshift(record);
    writeRows(RECORDS_KEY, rows);
    updateSessionRegistrationFromRecord(slot, record, actorAccountId);
    return { ok: true, record, slot, session };
  },
  getLiveSummary(slotId) {
    const slot = this.getSlot(slotId);
    const session = slot ? offlineTrainingService.getSession(slot.sessionId) : null;
    if (!slot || !session) return null;
    const registrations = offlineTrainingService.ensureInvitations(session.id);
    const records = this.listRecords(slotId);
    const invited = registrations.length;
    const busy = registrations.filter((row) => row.responseStatus === "busy").length;
    const checkedIn = records.filter((row) => row.checkInAt).length;
    const checkedOut = records.filter((row) => row.checkOutAt).length;
    const late = records.filter((row) => row.lateMinutes > Number(slot.attendanceRules?.lateAfterMinutes || 15)).length;
    const exceptions = records.filter((row) => row.attendanceStatus === "exception").length;
    return {
      slot,
      session,
      invited,
      busy,
      checkedIn,
      checkedOut,
      late,
      exceptions,
      pending: Math.max(0, invited - checkedIn - busy),
      records,
      registrations,
    };
  },
  getSessionExceptions(sessionId) {
    const slots = this.listSlots(sessionId);
    const exceptions = [];
    slots.forEach((slot) => {
      this.listRecords(slot.id).forEach((record) => {
        if (record.attendanceStatus === "exception" || (record.checkInAt && !record.checkOutAt && slot.mode !== "check_in_only") || record.manuallyAdjusted) {
          exceptions.push({ slot, record });
        }
      });
    });
    return exceptions;
  },
  finalizeSessionAttendance(sessionId, actorAccountId, { allowExceptions = false, notifyLearners = false } = {}) {
    const session = offlineTrainingService.getSession(sessionId);
    if (!session || getAccountById(actorAccountId)?.role !== "hr") return { ok: false, error: "forbidden" };
    const exceptions = this.getSessionExceptions(sessionId);
    if (exceptions.length && !allowExceptions) return { ok: false, error: "exceptions_pending", exceptions };
    const registrations = offlineTrainingService.ensureInvitations(sessionId);
    const slots = this.listSlots(sessionId);
    registrations.forEach((registration) => {
      const records = slots.map((slot) => this.getRecord(slot.id, registration.accountId)).filter(Boolean);
      const countedSeconds = records.reduce((sum, record) => sum + Math.max(0, Number(record.countedSeconds) || 0), 0);
      if (countedSeconds > 0) {
        offlineTrainingService.markAttendance(sessionId, registration.accountId, {
          attendanceStatus: records.some((record) => record.attendanceStatus === "exception") ? "partial" : "attended",
          attendedMinutes: Math.round(countedSeconds / 60),
          checkInAt: records.find((record) => record.checkInAt)?.checkInAt || "",
          checkOutAt: [...records].reverse().find((record) => record.checkOutAt)?.checkOutAt || "",
          attendanceNote: `QR finalized · ${records.length} slot`,
        }, actorAccountId);
        if (notifyLearners) {
          createNotification({
            type: "attendance_confirmed",
            targetAccountId: registration.accountId,
            title: "Điểm danh đã được chốt",
            body: session.title,
            actionUrl: `/dashboard/calendar?sessionId=${sessionId}`,
          });
        }
      }
    });
    offlineTrainingService.setAttendanceLocked(sessionId, true, actorAccountId, allowExceptions ? "Finalized with reviewed exceptions" : "Finalized");
    return { ok: true, exceptions, registrations: offlineTrainingService.registrations(sessionId) };
  },
  attendanceLink(token) {
    return `${QR_SCAN_PATH}?token=${encodeURIComponent(token.opaqueToken)}`;
  },
  describeScanResult(result) {
    if (!result?.ok) return "";
    const course = getCourseById(result.session.courseId);
    return `${course?.title || result.session.title} · ${result.slot.label}`;
  },
};
