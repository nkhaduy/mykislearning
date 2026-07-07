/**
 * Supabase client for MyKIS Learning.
 *
 * Credentials are fetched once from /api/config so the anon key
 * is never hard-coded in source. Falls back gracefully so the app
 * still renders in development without a live Supabase project.
 */

let _client = null;
let _initPromise = null;

export async function getSupabaseClient() {
  if (_client) return _client;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    // Load supabase UMD bundle if not already available
    if (!window.supabase?.createClient) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "/vendor/supabase.min.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    // Fetch public config from server (keeps keys out of source code)
    let url = "", anonKey = "";
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const cfg = await res.json();
        url = cfg.supabaseUrl || "";
        anonKey = cfg.supabaseAnonKey || "";
      }
    } catch {
      // /api/config not available in local dev without a server
      // Developers can set window.__SUPABASE_URL__ / window.__SUPABASE_ANON_KEY__
      // in a local index.html or start script for development.
      url = window.__SUPABASE_URL__ || "";
      anonKey = window.__SUPABASE_ANON_KEY__ || "";
    }

    if (!url || !anonKey) {
      console.warn("[supabase] No credentials available — running in localStorage mode.");
      return null;
    }

    _client = window.supabase.createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: "mykis_auth",
      },
    });
    return _client;
  })();

  return _initPromise;
}

/**
 * Returns true if Supabase is configured and reachable.
 * Used to decide whether to use Supabase or localStorage fallback.
 */
export async function isSupabaseAvailable() {
  const client = await getSupabaseClient();
  return client !== null;
}
