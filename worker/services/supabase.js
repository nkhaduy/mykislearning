import { createClient } from "@supabase/supabase-js";

export function getSupabase(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw Object.assign(new Error("SUPABASE_ENV_MISSING"), { status: 503, code: "SUPABASE_ENV_MISSING" });
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
