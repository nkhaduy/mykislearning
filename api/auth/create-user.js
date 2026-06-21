/**
 * POST /api/auth/create-user
 * HR/Admin creates a new employee account.
 * Uses SERVICE_ROLE_KEY — server side only.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Verify caller is HR or Admin via their JWT
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !caller) return res.status(401).json({ error: "Invalid token" });

  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || !["hr", "admin"].includes(callerProfile.role)) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const { email, password, fullName, employeeCode, role, departmentId, position } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: "email, password, fullName are required" });
  }

  // Create auth user
  const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
  });
  if (createErr) return res.status(400).json({ error: createErr.message });

  // Create profile
  const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
    id: authData.user.id,
    full_name: fullName.trim(),
    email: email.trim().toLowerCase(),
    employee_code: employeeCode || null,
    role: role || "employee",
    department_id: departmentId || null,
    position: position || null,
    account_status: "active",
  });
  if (profileErr) {
    // Rollback: delete auth user if profile creation fails
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return res.status(500).json({ error: profileErr.message });
  }

  // Audit log
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: caller.id,
    action: "create_user",
    target_type: "profile",
    target_id: authData.user.id,
    result: "success",
    details: { email, role: role || "employee" },
  });

  return res.status(201).json({ userId: authData.user.id });
}
