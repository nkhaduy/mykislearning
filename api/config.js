/**
 * GET  /api/config  → return public Supabase credentials
 * POST /api/config  → receive camera diagnostics for debug (no PII stored)
 */
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    const url = process.env.SUPABASE_URL || "";
    const anonKey = process.env.SUPABASE_ANON_KEY || "";
    if (!url || !anonKey) {
      return res.status(503).json({ error: "Supabase not configured", supabaseUrl: "", supabaseAnonKey: "" });
    }
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).json({ supabaseUrl: url, supabaseAnonKey: anonKey });
  }

  if (req.method === "POST") {
    const code = "QR-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const ts = new Date().toISOString();
    const {
      event, build, timestamp, url, ua, iosVersion, isSafari, isHttps, pageVisibility,
      videoFound, sameElement, connected, hasSrcObject, videoPaused,
      videoReadyState, videoSize, renderedSize,
      streamExists, trackState, trackEnabled, trackMuted, trackSettings,
      camPermission, locPermission,
      currentStep, elapsedMs, lastErrorCode, lastErrorMessage,
      accountIdMasked,
    } = req.body || {};

    console.log(`[QR-DEBUG] ${code} @ ${ts}`, JSON.stringify({
      code, event, build, timestamp: timestamp || ts,
      url, ua, iosVersion, isSafari, isHttps, pageVisibility,
      video: { videoFound, sameElement, connected, hasSrcObject, videoPaused, videoReadyState, videoSize, renderedSize },
      stream: { streamExists, trackState, trackEnabled, trackMuted, trackSettings },
      permissions: { camPermission, locPermission },
      flow: { currentStep, elapsedMs, lastErrorCode, lastErrorMessage },
      account: accountIdMasked,
    }, null, 2));

    return res.status(200).json({ ok: true, code });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
