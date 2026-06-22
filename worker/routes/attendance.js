import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";

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

    const { data: participant } = await supabase.from("session_participants")
      .select("id").eq("session_id", slot.session_id).eq("account_id", user.id).single();
    if (!participant) return json({ error: "not_invited" }, 403);

    let insideGeofence = null;
    let distanceMeters = null;
    if (session?.location_lat && session?.location_lng && latitude && longitude) {
      const R = 6371000;
      const phi1 = session.location_lat * Math.PI / 180;
      const phi2 = latitude * Math.PI / 180;
      const dPhi = (latitude - session.location_lat) * Math.PI / 180;
      const dLam = (longitude - session.location_lng) * Math.PI / 180;
      const a = Math.sin(dPhi/2)**2 + Math.cos(phi1)*Math.cos(phi2)*Math.sin(dLam/2)**2;
      distanceMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
      insideGeofence = distanceMeters <= (session.location_radius_m || 200);
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

  return json({ error: "NOT_FOUND" }, 404);
}
