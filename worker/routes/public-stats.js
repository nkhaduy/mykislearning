import { json, corsPreflight, methodNotAllowed } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";

// Kept in the isolate so the public landing page does not run an aggregate on
// every request. The value is deliberately aggregate-only: no learner data is
// exposed by this endpoint.
let cached = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function creditedHours(seconds) {
  // 120–239 real minutes earns one displayed hour; never round up.
  return Math.floor(Math.max(0, Number(seconds) || 0) / 7200);
}

export async function handlePublicStats(request, env) {
  if (request.method.toUpperCase() === "OPTIONS") return corsPreflight();
  if (request.method.toUpperCase() !== "GET") return methodNotAllowed();

  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    return json(cached, 200, { "Cache-Control": "public, max-age=300" });
  }

  const supabase = getSupabase(env);
  const { data, error } = await supabase
    .from("content_progress")
    .select("data")
    .limit(50000);

  if (error) return json({ error: "LEARNING_HOURS_UNAVAILABLE" }, 503);

  const actualSeconds = (data || []).reduce((total, row) => {
    // Each content-progress row is unique per learner/content. activeSeconds is
    // updated in place, so summing it neither rounds up nor double-counts.
    return total + Math.max(0, Number(row?.data?.activeSeconds) || 0);
  }, 0);
  cached = { ok: true, creditedHours: creditedHours(actualSeconds) };
  cachedAt = Date.now();
  return json(cached, 200, { "Cache-Control": "public, max-age=300" });
}
