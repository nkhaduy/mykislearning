import { createClient } from "@supabase/supabase-js";
import { cors, requireAuth, requireHr } from "../training/_auth.js";

const db = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  const client = db();
  if (req.method === "GET") {
    const acct = requireAuth(req, res); if (!acct) return;
    let query = client.from("external_training_requests").select("*").order("created_at", { ascending: false });
    if (acct.role !== "hr") query = query.eq("account_id", acct.accountId);
    const { data, error } = await query;
    return error ? res.status(500).json({ error: error.message }) : res.json({ requests: data || [] });
  }
  if (req.method === "POST") {
    const acct = requireAuth(req, res); if (!acct) return;
    const b = req.body || {};
    if (![b.course_name,b.provider,b.learning_content,b.study_time].every(v => String(v || "").trim())) return res.status(400).json({ error: "missing_required_fields" });
    const row = { account_id: acct.accountId, course_name: String(b.course_name).trim(), provider: String(b.provider).trim(), learning_content: String(b.learning_content).trim(), study_time: String(b.study_time).trim(), cost: Number(b.cost)||0, evidence_url: b.evidence_url||null, note: b.note||null, status: "pending" };
    const { data, error } = await client.from("external_training_requests").insert(row).select().single();
    return error ? res.status(500).json({ error: error.message }) : res.status(201).json({ request: data });
  }
  if (req.method === "PATCH") {
    const acct = requireHr(req, res); if (!acct) return;
    const { id, status, hr_feedback } = req.body || {};
    if (!id || !["accepted","rejected","needs_info"].includes(status)) return res.status(400).json({ error: "invalid_review" });
    const { data, error } = await client.from("external_training_requests").update({ status, hr_feedback: String(hr_feedback||""), reviewed_by: acct.accountId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).select().single();
    return error ? res.status(500).json({ error: error.message }) : res.json({ request: data });
  }
  return res.status(405).json({ error: "Method not allowed" });
}
