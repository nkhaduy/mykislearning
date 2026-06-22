import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";

export async function handleEmployees(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean); // ["api","employees",id?,...]
  const employeeId = parts[2] || null;
  const subResource = parts[3] || null; // "certifications"
  const subId = parts[4] || null;

  const supabase = getSupabase(env);

  // GET /api/employees  — list all (HR only)
  if (!employeeId && method === "GET") {
    const acct = requireHr(request);
    if (!acct) return json({ error: "HR only" }, 403);
    const { data, error } = await supabase.from("profiles").select("*").order("full_name");
    if (error) return json({ error: error.message }, 500);
    return json({ employees: data || [] });
  }

  // PATCH /api/employees/:id  — upsert profile (HR only)
  if (employeeId && !subResource && method === "PATCH") {
    const acct = requireHr(request);
    if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request);
    const { error } = await supabase.from("profiles")
      .upsert({ ...body, id: employeeId, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // GET /api/employees/:id/certifications
  if (employeeId && subResource === "certifications" && method === "GET") {
    const acct = requireAuth(request);
    if (!acct) return json({ error: "Unauthorized" }, 401);
    if (acct.role !== "hr" && acct.accountId !== employeeId) return json({ error: "Forbidden" }, 403);
    const { data, error } = await supabase.from("employee_certifications")
      .select("*").eq("account_id", employeeId).order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json({ certifications: data || [] });
  }

  // POST /api/employees/:id/certifications
  if (employeeId && subResource === "certifications" && method === "POST") {
    const acct = requireHr(request);
    if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request);
    const row = { account_id: employeeId, ...body, created_by: acct.accountId };
    const { data, error } = await supabase.from("employee_certifications").insert(row).select().single();
    if (error) return json({ error: error.message }, 500);
    return json({ certification: data }, 201);
  }

  // PATCH /api/employees/:id/certifications/:certId
  if (employeeId && subResource === "certifications" && subId && method === "PATCH") {
    const acct = requireHr(request);
    if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request);
    const { data, error } = await supabase.from("employee_certifications")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", subId).eq("account_id", employeeId).select().single();
    if (error) return json({ error: error.message }, 500);
    return json({ certification: data });
  }

  // DELETE /api/employees/:id/certifications/:certId  — soft-delete (revoke)
  if (employeeId && subResource === "certifications" && subId && method === "DELETE") {
    const acct = requireHr(request);
    if (!acct) return json({ error: "HR only" }, 403);
    const { data, error } = await supabase.from("employee_certifications")
      .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: acct.accountId, updated_at: new Date().toISOString() })
      .eq("id", subId).eq("account_id", employeeId).select().single();
    if (error) return json({ error: error.message }, 500);
    return json({ certification: data });
  }

  return json({ error: "NOT_FOUND" }, 404);
}
