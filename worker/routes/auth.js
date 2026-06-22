import { json, readJson, methodNotAllowed } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";

async function requireHrCaller(request, env) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { error: json({ error: "Unauthorized" }, 401) };

  const supabase = getSupabase(env);
  const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !caller) return { error: json({ error: "Invalid token" }, 401) };

  const { data: callerProfile } = await supabase
    .from("profiles").select("role").eq("id", caller.id).single();

  if (!callerProfile || !["hr", "admin"].includes(callerProfile.role)) {
    return { error: json({ error: "Insufficient permissions" }, 403) };
  }
  return { caller, supabase };
}

export async function handleAuth(request, env) {
  const method = request.method.toUpperCase();
  if (method !== "POST") return methodNotAllowed();

  const url = new URL(request.url);
  const body = await readJson(request);
  const action = url.searchParams.get("action") || body.action;

  if (action === "create-user") {
    const { error, caller, supabase } = await requireHrCaller(request, env);
    if (error) return error;

    const { email, password, fullName, employeeCode, role, departmentId, position } = body;
    if (!email || !password || !fullName) {
      return json({ error: "email, password, fullName are required" }, 400);
    }

    const { data: authData, error: createErr } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(), password, email_confirm: true,
    });
    if (createErr) return json({ error: createErr.message }, 400);

    const { error: profileErr } = await supabase.from("profiles").insert({
      id: authData.user.id, full_name: fullName.trim(),
      email: email.trim().toLowerCase(), employee_code: employeeCode || null,
      role: role || "employee", department_id: departmentId || null,
      position: position || null, account_status: "active",
    });
    if (profileErr) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return json({ error: profileErr.message }, 500);
    }

    await supabase.from("audit_logs").insert({
      actor_id: caller.id, action: "create_user", target_type: "profile",
      target_id: authData.user.id, result: "success",
      details: { email, role: role || "employee" },
    });
    return json({ userId: authData.user.id }, 201);
  }

  if (action === "reset-password") {
    const { error, caller, supabase } = await requireHrCaller(request, env);
    if (error) return error;

    const { targetUserId, newPassword } = body;
    if (!targetUserId || !newPassword) {
      return json({ error: "targetUserId and newPassword required" }, 400);
    }

    const { error: resetErr } = await supabase.auth.admin.updateUserById(targetUserId, { password: newPassword });
    if (resetErr) return json({ error: resetErr.message }, 400);

    await supabase.from("profiles").update({ password_status: "resetRequired" }).eq("id", targetUserId);
    await supabase.from("audit_logs").insert({
      actor_id: caller.id, action: "reset_password", target_type: "profile",
      target_id: targetUserId, result: "success",
    });
    return json({ ok: true });
  }

  return json({ error: "Missing or invalid action. Use ?action=create-user or ?action=reset-password" }, 400);
}
