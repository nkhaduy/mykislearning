/**
 * QR Attendance service.
 * Slots and tokens are stored in Supabase via Worker API.
 * QR scan still works cross-browser via self-contained base64 token.
 */

import { notificationService } from "./notificationService.js";
import { offlineTrainingService } from "./offlineTrainingService.js";
import { sessionService } from "./sessionService.js";

const QR_SCAN_PATH = "/attendance/scan";
const BASE_TRAINING = "/api/training";

function nowIso() { return new Date().toISOString(); }

function authHeaders() {
  const session = sessionService.getValidSession();
  const h = { "Content-Type": "application/json" };
  if (session?.supabaseAccessToken) h["Authorization"] = `Bearer ${session.supabaseAccessToken}`;
  h["X-Account-Id"] = session?.accountId || "";
  h["X-Account-Role"] = session?.role || "employee";
  return h;
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function scheduledSeconds(slot) {
  return Math.max(0, Math.round((new Date(slot.endAt) - new Date(slot.startAt)) / 1000));
}

function computeCountedSeconds(slot, record) {
  const maxSeconds = scheduledSeconds(slot);
  if (!record.checkInAt || !record.checkOutAt) return 0;
  const seconds = Math.max(0, Math.round((new Date(record.checkOutAt) - new Date(record.checkInAt)) / 1000));
  return Math.min(maxSeconds, seconds);
}

export const qrAttendanceService = {
  // ── Slots (stored in session data via training API) ──────────────────────

  async listSlots(sessionId = "") {
    if (!sessionId) return [];
    try {
      const sessionData = await apiFetch(`${BASE_TRAINING}/sessions?sessionId=${encodeURIComponent(sessionId)}`);
      const sessions = Array.isArray(sessionData) ? sessionData : [sessionData];
      const session = sessions.find((s) => s.id === sessionId);
      return session?.slots || [];
    } catch {
      return [];
    }
  },

  async getSlot(slotId) {
    // slotId is session-local, fetch from session data
    return null; // resolved via session payload in Worker
  },

  async saveSlot(data, actorAccountId) {
    const session = await offlineTrainingService.getSession(data.sessionId);
    if (!session) return { ok: false, error: "session_not_found" };

    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    if (!Number.isFinite(+startAt) || !Number.isFinite(+endAt) || endAt <= startAt) {
      return { ok: false, error: "invalid_time" };
    }

    const existingSlots = session.slots || [];
    const slotIdx = existingSlots.findIndex((s) => s.id === data.id);
    const prior = slotIdx >= 0 ? existingSlots[slotIdx] : null;

    const slot = {
      id: prior?.id || data.id || crypto.randomUUID(),
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
    };

    // Save slot in session's data.slots array
    const updatedSlots = slotIdx >= 0
      ? existingSlots.map((s, i) => (i === slotIdx ? slot : s))
      : [...existingSlots, slot];

    await offlineTrainingService.saveSession({ ...session, slots: updatedSlots }, actorAccountId);
    return { ok: true, slot };
  },

  async getOrCreateDefaultSlots(sessionId, actorAccountId) {
    const session = await offlineTrainingService.getSession(sessionId);
    if (!session) return [];
    const existing = session.slots || [];
    if (existing.length) return existing;

    const start = new Date(session.startAt);
    const end = new Date(session.endAt);
    const totalMinutes = Math.max(60, Math.round((end - start) / 60000));

    if (totalMinutes <= 240) {
      const result = await this.saveSlot({
        sessionId,
        label: "Buổi sáng",
        startAt: session.startAt,
        endAt: session.endAt,
        checkInOpenAt: new Date(start.getTime() - 30 * 60000).toISOString(),
        checkInCloseAt: new Date(start.getTime() + 30 * 60000).toISOString(),
        checkOutOpenAt: new Date(end.getTime() - 20 * 60000).toISOString(),
        checkOutCloseAt: new Date(end.getTime() + 30 * 60000).toISOString(),
      }, actorAccountId);
      return result.slot ? [result.slot] : [];
    }

    const midday = new Date(start.getTime() + Math.floor(totalMinutes / 2) * 60000);
    const lunchEnd = new Date(midday.getTime() + 60 * 60000);
    const [s1, s2] = await Promise.all([
      this.saveSlot({ sessionId, label: "Buổi sáng", startAt: session.startAt, endAt: midday.toISOString(), checkInOpenAt: new Date(start.getTime() - 30 * 60000).toISOString(), checkInCloseAt: new Date(start.getTime() + 30 * 60000).toISOString(), checkOutOpenAt: new Date(midday.getTime() - 20 * 60000).toISOString(), checkOutCloseAt: new Date(midday.getTime() + 30 * 60000).toISOString() }, actorAccountId),
      this.saveSlot({ sessionId, label: "Buổi chiều", startAt: lunchEnd.toISOString(), endAt: session.endAt, checkInOpenAt: new Date(lunchEnd.getTime() - 30 * 60000).toISOString(), checkInCloseAt: new Date(lunchEnd.getTime() + 30 * 60000).toISOString(), checkOutOpenAt: new Date(end.getTime() - 20 * 60000).toISOString(), checkOutCloseAt: new Date(end.getTime() + 30 * 60000).toISOString() }, actorAccountId),
    ]);
    return [s1.slot, s2.slot].filter(Boolean);
  },

  // ── QR Tokens (self-contained base64, no server storage needed for scan) ──

  decodeQrToken(opaqueToken) {
    try {
      const padded = opaqueToken.replace(/-/g, "+").replace(/_/g, "/");
      const j = atob(padded + "===".slice((padded.length + 3) % 4));
      const p = JSON.parse(j);
      if (p.s && p.a && p.e) return p;
    } catch {}
    return null;
  },

  createToken({ slotId, sessionId, courseTitle, sessionTitle, locationName, action, opensAt, closesAt, latitude, longitude, allowedRadiusMeters }, actorAccountId) {
    const closesAtMs = closesAt ? new Date(closesAt).getTime() : Date.now() + 2 * 3600 * 1000;
    const payload = {
      s: sessionId,
      sn: sessionTitle || "",
      cn: courseTitle || "",
      l: locationName || "",
      a: action,
      e: closesAtMs,
      lat: latitude ?? null,
      lng: longitude ?? null,
      r: allowedRadiusMeters ?? null,
    };
    const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const token = {
      id: crypto.randomUUID(),
      slotId,
      sessionId,
      action,
      opaqueToken: b64,
      opensAt: opensAt || nowIso(),
      closesAt: new Date(closesAtMs).toISOString(),
      status: "open",
      createdAt: nowIso(),
      createdBy: actorAccountId,
    };
    return { ok: true, token, url: `${QR_SCAN_PATH}?token=${encodeURIComponent(b64)}` };
  },

  validateToken(opaqueToken) {
    const p = this.decodeQrToken(opaqueToken);
    if (!p) return { ok: false, error: "not_found" };
    const now = Date.now();
    if (now > p.e) return { ok: false, error: "expired" };
    return {
      ok: true,
      _isV2: true,
      token: { action: p.a, opaqueToken, status: "open", closesAt: new Date(p.e).toISOString() },
      slot: { id: `slot_${p.s}`, sessionId: p.s, startAt: "", endAt: "" },
      session: { id: p.s, title: p.sn, locationName: p.l, courseId: "", status: "scheduled", latitude: p.lat ?? null, longitude: p.lng ?? null, allowedRadiusMeters: p.r ?? null },
      course: { title: p.cn },
    };
  },

  // ── Scan (sends to Worker API /api/attendance/scan) ───────────────────────

  async scan(opaqueToken, accountId, locationData = null) {
    const validated = this.validateToken(opaqueToken);
    if (!validated.ok) return validated;
    const { token, slot, session } = validated;

    try {
      const res = await fetch("/api/attendance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Account-Id": accountId, "X-Account-Role": "employee" },
        body: JSON.stringify({
          token: opaqueToken,
          action: token.action,
          accountId,
          sessionId: session.id,
          location: locationData,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.error || `HTTP ${res.status}`, slot, session };

      // Fire-and-forget notification
      notificationService.create({
        account_id: accountId,
        type: token.action === "check_in" ? "qr_check_in_success" : "qr_check_out_success",
        title: token.action === "check_in" ? "Điểm danh thành công" : "Check-out thành công",
        body: `${session.title}`,
        link: `/dashboard/calendar?sessionId=${session.id}`,
        created_by: "system",
      }).catch(() => {});

      return { ok: true, token, slot, session, record: body };
    } catch (err) {
      return { ok: false, error: err.message, slot, session };
    }
  },

  attendanceLink(token) {
    return `${QR_SCAN_PATH}?token=${encodeURIComponent(token.opaqueToken)}`;
  },

  describeScanResult(result) {
    if (!result?.ok) return "";
    return `${result.session?.title || ""} · ${result.slot?.label || ""}`;
  },
};
