/**
 * GET /api/config
 * Returns public Supabase credentials to the frontend.
 * These are the ANON (publishable) key only — safe to expose.
 * The SERVICE_ROLE_KEY stays server-side and never leaves this file.
 */
export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = process.env.SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || "";

  if (!url || !anonKey) {
    return res.status(503).json({
      error: "Supabase not configured",
      supabaseUrl: "",
      supabaseAnonKey: "",
    });
  }

  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).json({
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
  });
}
