import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { verifySession } from "./auth.js";

const LEARNING_TYPES = new Set(["course_view", "content_view", "quiz_attempt"]);
const VALID_TYPES = new Set(["login", "dashboard", "course_view", "content_view", "quiz_attempt", "training_view", "logout"]);

function normalizeActivityType(value) {
  return VALID_TYPES.has(value) ? value : "dashboard";
}

export async function handleActivity(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();
  if (method !== "POST") return methodNotAllowed();

  const acct = await verifySession(request, env);
  if (!acct) return json({ error: "UNAUTHORIZED" }, 401);

  const body = await readJson(request);
  const activityType = normalizeActivityType(String(body.activity_type || body.activityType || ""));
  const sessionId = String(body.session_id || body.sessionId || "").trim();
  if (!sessionId) return json({ error: "SESSION_ID_REQUIRED" }, 400);

  const now = new Date().toISOString();
  const row = {
    account_id: acct.accountId,
    session_id: sessionId,
    activity_type: activityType,
    page_path: String(body.page_path || body.pagePath || "").slice(0, 500),
    course_id: body.course_id || body.courseId || null,
    last_seen_at: now,
    ended_at: activityType === "logout" ? now : null,
    metadata: {
      title: body.title || null,
      hidden: Boolean(body.hidden),
      learning: LEARNING_TYPES.has(activityType),
    },
  };

  const supabase = getSupabase(env);
  const { error } = await supabase
    .from("user_activity")
    .upsert(row, { onConflict: "session_id,account_id" });

  if (error) return json({ error: "ACTIVITY_WRITE_FAILED", message: error.message }, 500);
  return json({ ok: true, lastSeenAt: now });
}
