import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";

export async function handleExternalTraining(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const supabase = getSupabase(env);

  if (method === "GET") {
    const acct = await requireAuth(request, env);
    if (!acct) return json({ error: "Unauthorized" }, 401);
    let query = supabase.from("external_training_requests").select("*").order("created_at", { ascending: false });
    if (acct.role !== "hr") query = query.eq("account_id", acct.accountId);
    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    return json({ requests: data || [] });
  }

  if (method === "POST") {
    const acct = await requireAuth(request, env);
    if (!acct) return json({ error: "Unauthorized" }, 401);
    const b = await readJson(request);
    if (![b.course_name, b.provider, b.learning_content, b.study_time].every((v) => String(v || "").trim())) {
      return json({ error: "missing_required_fields" }, 400);
    }
    const row = {
      account_id: acct.accountId,
      course_name: String(b.course_name).trim(),
      provider: String(b.provider).trim(),
      learning_content: String(b.learning_content).trim(),
      study_time: String(b.study_time).trim(),
      cost: Number(b.cost) || 0,
      evidence_url: b.evidence_url || null,
      note: b.note || null,
      status: "pending",
    };
    const { data, error } = await supabase.from("external_training_requests").insert(row).select().single();
    if (error) return json({ error: error.message }, 500);
    await supabase.from("hr_tasks").insert({
      task_type: "external_training",
      requester_account_id: acct.accountId,
      reference_type: "external_training_request",
      reference_id: data.id,
      title: `Yêu cầu đào tạo bên ngoài: ${data.course_name}`,
      description: `${data.provider} · ${data.study_time}`,
      priority: "normal",
      status: "new",
    }).then(null, () => {});
    return json({ request: data }, 201);
  }

  if (method === "PATCH") {
    const acct = await requireHr(request, env);
    if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request);
    const { id, status, hr_feedback } = body;
    if (!id || !["accepted", "rejected", "needs_info"].includes(status)) return json({ error: "invalid_review" }, 400);
    const { data, error } = await supabase.from("external_training_requests").update({
      status, hr_feedback: String(hr_feedback || ""),
      reviewed_by: acct.accountId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", id).select().single();
    if (error) return json({ error: error.message }, 500);
    await supabase.from("hr_tasks").update({
      status: status === "rejected" ? "rejected" : status === "needs_info" ? "in_progress" : "done",
      resolved_by: status === "needs_info" ? null : acct.accountId,
      resolved_at: status === "needs_info" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("task_type", "external_training").eq("reference_type", "external_training_request").eq("reference_id", id).in("status", ["new", "in_progress"]);
    return json({ request: data });
  }

  return methodNotAllowed();
}
