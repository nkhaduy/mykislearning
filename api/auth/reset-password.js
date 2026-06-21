/**
 * POST /api/auth/reset-password
 * HR resets an employee's password. SERVICE_ROLE_KEY only.
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

  const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !caller) return res.status(401).json({ error: "Invalid token" });

  const { data: callerProfile } = await supabaseAdmin
    .from("profiles").select("role").eq("id", caller.id).single();

  if (!callerProfile || !["hr", "admin"].includes(callerProfile.role)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const { targetUserId, newPassword } = req.body;
  if (!targetUserId || !newPassword) {
    return res.status(400).json({ error: "targetUserId and newPassword required" });
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
    password: newPassword,
  });
  if (error) return res.status(400).json({ error: error.message });

  await supabaseAdmin.from("profiles").update({
    password_status: "resetRequired",
  }).eq("id", targetUserId);

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: caller.id,
    action: "reset_password",
    target_type: "profile",
    target_id: targetUserId,
    result: "success",
  });

  return res.status(200).json({ ok: true });
}
