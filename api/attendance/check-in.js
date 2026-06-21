/**
 * POST /api/attendance/check-in
 * Records a QR-verified attendance check-in.
 * Validates QR token server-side — frontend cannot fake this.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Invalid session" });

  const { tokenHash, action, latitude, longitude, accuracyMeters } = req.body;
  if (!tokenHash || !action) return res.status(400).json({ error: "tokenHash and action required" });

  const now = new Date();

  // Validate QR token
  const { data: qrToken, error: tokenErr } = await supabaseAdmin
    .from("qr_tokens")
    .select("*, session_slots(*, training_sessions(*))")
    .eq("token_hash", tokenHash)
    .eq("action", action)
    .eq("status", "open")
    .single();

  if (tokenErr || !qrToken) return res.status(400).json({ error: "qr_invalid" });
  if (now < new Date(qrToken.opens_at)) return res.status(400).json({ error: "not_open_yet" });
  if (now > new Date(qrToken.closes_at)) return res.status(400).json({ error: "expired" });

  const slot = qrToken.session_slots;
  const session = slot?.training_sessions;

  // Check participant is invited
  const { data: participant } = await supabaseAdmin
    .from("session_participants")
    .select("id")
    .eq("session_id", slot.session_id)
    .eq("account_id", user.id)
    .single();

  if (!participant) return res.status(403).json({ error: "not_invited" });

  // Geofence check (optional)
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

  // Upsert attendance
  const updateField = action === "check_in" ? {
    check_in_at: now.toISOString(),
    check_in_accuracy_m: accuracyMeters || null,
    check_in_location: latitude && longitude ? `(${longitude},${latitude})` : null,
  } : {
    check_out_at: now.toISOString(),
    check_out_accuracy_m: accuracyMeters || null,
    check_out_location: latitude && longitude ? `(${longitude},${latitude})` : null,
  };

  const { error: upsertErr } = await supabaseAdmin.from("attendance").upsert({
    slot_id: slot.id,
    account_id: user.id,
    inside_geofence: insideGeofence,
    distance_meters: distanceMeters,
    status: "present",
    ...updateField,
  }, { onConflict: "slot_id,account_id" });

  if (upsertErr) return res.status(500).json({ error: upsertErr.message });

  return res.status(200).json({
    ok: true,
    action,
    insideGeofence,
    distanceMeters,
    timestamp: now.toISOString(),
  });
}
