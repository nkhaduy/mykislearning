import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";

export async function handleExternalTraining(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const supabase = getSupabase(env);

  if (method === "GET") {
    const acct = requireAuth(request);
    if (!acct) return json({ error: "Unauthorized" }, 401);
    let query = supabase.from("external_training_requests").select("*").order("created_at", { ascending: false });
    if (acct.role !== "hr") query = query.eq("account_id", acct.accountId);
    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    return json({ requests: data || [] });
  }

  if (method === "POST") {
    const acct = requireAuth(request);
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
    return json({ request: data }, 201);
  }

  if (method === "PATCH") {
    const acct = requireHr(request);
    if (!acct) return json({ error: "HR only" }, 403);
    const body = await readJson(request);
    const { id, status, hr_feedback } = body;
    if (!id || !["accepted", "rejected", "needs_info"].includes(status)) return json({ error: "invalid_review" }, 400);
    const { data, error } = await supabase.from("external_training_requests").update({
      status, hr_feedback: String(hr_feedback || ""),
      reviewed_by: acct.accountId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", id).select().single();
    if (error) return json({ error: error.message }, 500);
    return json({ request: data });
  }

  return methodNotAllowed();
}
