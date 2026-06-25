import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth } from "../middleware/auth.js";

export async function handleAttendance(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/attendance/check-in") {
    if (method !== "POST") return methodNotAllowed();

    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabase = getSupabase(env);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: "Invalid session" }, 401);

    const body = await readJson(request);
    const { tokenHash, action, latitude, longitude, accuracyMeters } = body;
    if (!tokenHash || !action) return json({ error: "tokenHash and action required" }, 400);

    const now = new Date();

    const { data: qrToken, error: tokenErr } = await supabase
      .from("qr_tokens")
      .select("*, session_slots(*, training_sessions(*))")
      .eq("token_hash", tokenHash)
      .eq("action", action)
      .eq("status", "open")
      .single();

    if (tokenErr || !qrToken) return json({ error: "qr_invalid" }, 400);
    if (now < new Date(qrToken.opens_at)) return json({ error: "not_open_yet" }, 400);
    if (now > new Date(qrToken.closes_at)) return json({ error: "expired" }, 400);

    const slot = qrToken.session_slots;
    const session = slot?.training_sessions;

    // Accept participant from both table names (training_participants is the real table name)
    const { data: participant } = await supabase.from("training_participants")
      .select("id").eq("session_id", slot.session_id).eq("account_id", user.id).single();
    if (!participant) return json({ error: "not_invited" }, 403);

    // Resolve geofence config: prefer dedicated columns, fallback to data JSON
    const sessionData = session?.data || {};
    const sessionLat = session?.location_lat ?? sessionData.latitude ?? null;
    const sessionLng = session?.location_lng ?? sessionData.longitude ?? null;
    const sessionRadius = session?.location_radius_m ?? sessionData.allowedRadiusMeters ?? null;

    let insideGeofence = null;
    let distanceMeters = null;
    const hasGeofence = sessionLat != null && sessionLng != null && sessionRadius != null;

    if (hasGeofence) {
      if (!latitude || !longitude) {
        return json({ error: "gps_required", message: "GPS bắt buộc để điểm danh tại địa điểm này" }, 400);
      }
      const R = 6371000;
      const phi1 = sessionLat * Math.PI / 180;
      const phi2 = latitude * Math.PI / 180;
      const dPhi = (latitude - sessionLat) * Math.PI / 180;
      const dLam = (longitude - sessionLng) * Math.PI / 180;
      const a = Math.sin(dPhi/2)**2 + Math.cos(phi1)*Math.cos(phi2)*Math.sin(dLam/2)**2;
      distanceMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
      insideGeofence = distanceMeters <= sessionRadius;
      if (!insideGeofence) {
        return json({ error: "outside_geofence", distanceMeters, allowedRadius: sessionRadius,
          message: `Bạn đang cách ${distanceMeters}m, giới hạn là ${sessionRadius}m` }, 400);
      }
    } else if (session?.location_lat && session?.location_lng && latitude && longitude) {
      // Legacy path: columns exist but no radius → just record distance
      const R = 6371000;
      const phi1 = session.location_lat * Math.PI / 180;
      const phi2 = latitude * Math.PI / 180;
      const dPhi = (latitude - session.location_lat) * Math.PI / 180;
      const dLam = (longitude - session.location_lng) * Math.PI / 180;
      const a = Math.sin(dPhi/2)**2 + Math.cos(phi1)*Math.cos(phi2)*Math.sin(dLam/2)**2;
      distanceMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
      insideGeofence = true;
    }

    const updateField = action === "check_in" ? {
      check_in_at: now.toISOString(), check_in_accuracy_m: accuracyMeters || null,
      check_in_location: latitude && longitude ? `(${longitude},${latitude})` : null,
    } : {
      check_out_at: now.toISOString(), check_out_accuracy_m: accuracyMeters || null,
      check_out_location: latitude && longitude ? `(${longitude},${latitude})` : null,
    };

    const { error: upsertErr } = await supabase.from("attendance").upsert({
      slot_id: slot.id, account_id: user.id,
      inside_geofence: insideGeofence, distance_meters: distanceMeters,
      status: "present", ...updateField,
    }, { onConflict: "slot_id,account_id" });

    if (upsertErr) return json({ error: upsertErr.message }, 500);
    return json({ ok: true, action, insideGeofence, distanceMeters, timestamp: now.toISOString() });
  }

  // ── POST /api/attendance/scan — cross-browser QR attendance (X-Account-Id auth)
  if (path === "/api/attendance/scan") {
    if (method !== "POST") return methodNotAllowed();
    const acct = await requireAuth(request, env);
    if (!acct) return json({ error: "Unauthorized" }, 401);

    const body = await readJson(request);
    const { sessionId, action, expires, latitude, longitude, accuracy } = body || {};
    if (!sessionId || !action) return json({ error: "sessionId and action required" }, 400);
    if (expires && Date.now() > Number(expires)) return json({ error: "expired" }, 400);

    const supabase = getSupabase(env);

    const { data: sessionRow, error: sessionErr } = await supabase
      .from("training_sessions").select("*").eq("id", sessionId).single();
    if (sessionErr || !sessionRow) return json({ error: "session_not_found" }, 404);
    if (sessionRow.status === "cancelled") return json({ error: "session_cancelled" }, 400);

    const { data: participant, error: partErr } = await supabase
      .from("training_participants").select("*")
      .eq("session_id", sessionId).eq("account_id", acct.accountId).single();
    if (partErr || !participant) return json({ error: "not_invited" }, 403);

    const partData = participant.data || {};
    const att = partData.attendance || {};
    if (action === "check_in" && att.checkInAt) return json({ error: "already_checked_in", timestamp: att.checkInAt }, 400);
    if (action === "check_out" && att.checkOutAt) return json({ error: "already_checked_out", timestamp: att.checkOutAt }, 400);
    if (action === "check_out" && !att.checkInAt) return json({ error: "missing_check_in" }, 400);

    const sessionData = sessionRow.data || {};
    const sesLat = sessionData.latitude ?? null;
    const sesLng = sessionData.longitude ?? null;
    const sesRadius = sessionData.allowedRadiusMeters ?? null;
    const hasGeofence = sesLat != null && sesLng != null && sesRadius != null;
    let insideGeofence = null;
    let distanceMeters = null;

    if (hasGeofence) {
      if (!latitude || !longitude) return json({ error: "gps_required", message: "GPS bắt buộc tại địa điểm này" }, 400);
      const R = 6371000;
      const phi1 = sesLat * Math.PI / 180, phi2 = latitude * Math.PI / 180;
      const dPhi = (latitude - sesLat) * Math.PI / 180, dLam = (longitude - sesLng) * Math.PI / 180;
      const a = Math.sin(dPhi/2)**2 + Math.cos(phi1)*Math.cos(phi2)*Math.sin(dLam/2)**2;
      distanceMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
      insideGeofence = distanceMeters <= sesRadius;
      if (!insideGeofence) return json({ error: "outside_geofence", distanceMeters, allowedRadius: sesRadius,
        message: `Bạn đang cách ${distanceMeters}m, giới hạn là ${sesRadius}m` }, 400);
    }

    const now = new Date().toISOString();
    const updatedAtt = {
      ...att,
      ...(action === "check_in" ? { checkInAt: now, checkInLat: latitude || null, checkInLng: longitude || null, checkInAccuracy: accuracy || null } : {}),
      ...(action === "check_out" ? { checkOutAt: now, checkOutLat: latitude || null, checkOutLng: longitude || null } : {}),
      attendanceStatus: "attended", insideGeofence, distanceMeters,
    };

    const { error: updateErr } = await supabase
      .from("training_participants")
      .update({ data: { ...partData, attendance: updatedAtt } })
      .eq("session_id", sessionId).eq("account_id", acct.accountId);

    if (updateErr) return json({ error: updateErr.message }, 500);
    return json({ ok: true, action, timestamp: now, insideGeofence, distanceMeters });
  }

  return json({ error: "NOT_FOUND" }, 404);
}
