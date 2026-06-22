/**
 * POST /api/auth?action=create-user   → create employee account (HR/Admin only)
 * POST /api/auth?action=reset-password → reset password (HR/Admin only)
 * Merged from create-user.js + reset-password.js to stay under Vercel 12-function limit.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function requireHrCaller(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return null; }
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !caller) { res.status(401).json({ error: "Invalid token" }); return null; }
  const { data: callerProfile } = await supabaseAdmin.from("profiles").select("role").eq("id", caller.id).single();
  if (!callerProfile || !["hr", "admin"].includes(callerProfile.role)) {
    res.status(403).json({ error: "Insufficient permissions" }); return null;
  }
  return caller;
}

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;

  if (action === "create-user") {
    const caller = await requireHrCaller(req, res); if (!caller) return;
    const { email, password, fullName, employeeCode, role, departmentId, position } = req.body;
    if (!email || !password || !fullName) return res.status(400).json({ error: "email, password, fullName are required" });
    const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(), password, email_confirm: true,
    });
    if (createErr) return res.status(400).json({ error: createErr.message });
    const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
      id: authData.user.id, full_name: fullName.trim(), email: email.trim().toLowerCase(),
      employee_code: employeeCode || null, role: role || "employee",
      department_id: departmentId || null, position: position || null, account_status: "active",
    });
    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: profileErr.message });
    }
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: caller.id, action: "create_user", target_type: "profile",
      target_id: authData.user.id, result: "success", details: { email, role: role || "employee" },
    });
    return res.status(201).json({ userId: authData.user.id });
  }

  if (action === "reset-password") {
    const caller = await requireHrCaller(req, res); if (!caller) return;
    const { targetUserId, newPassword } = req.body;
    if (!targetUserId || !newPassword) return res.status(400).json({ error: "targetUserId and newPassword required" });
    const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password: newPassword });
    if (error) return res.status(400).json({ error: error.message });
    await supabaseAdmin.from("profiles").update({ password_status: "resetRequired" }).eq("id", targetUserId);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: caller.id, action: "reset_password", target_type: "profile",
      target_id: targetUserId, result: "success",
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Missing or invalid action. Use ?action=create-user or ?action=reset-password" });
}
