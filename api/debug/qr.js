/**
 * POST /api/debug/qr
 * Receives camera diagnostics from iPhone Safari users.
 * Logged to Vercel console for developer inspection — no PII stored.
 */
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const code = "QR-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const ts = new Date().toISOString();

  // Safe fields only — no GPS, no tokens, no passwords
  const {
    timestamp, url, ua, iosVersion, isSafari, isHttps, pageVisibility,
    videoFound, sameElement, connected, hasSrcObject, videoPaused,
    videoReadyState, videoSize, renderedSize,
    streamExists, trackState, trackEnabled, trackMuted, trackSettings,
    camPermission, locPermission,
    currentStep, elapsedMs, lastErrorCode, lastErrorMessage,
    accountIdMasked,
  } = req.body || {};

  // Print to Vercel log — visible in dashboard → project → logs
  console.log(`[QR-DEBUG] ${code} @ ${ts}`, JSON.stringify({
    code, timestamp: timestamp || ts,
    url, ua, iosVersion, isSafari, isHttps, pageVisibility,
    video: { videoFound, sameElement, connected, hasSrcObject, videoPaused, videoReadyState, videoSize, renderedSize },
    stream: { streamExists, trackState, trackEnabled, trackMuted, trackSettings },
    permissions: { camPermission, locPermission },
    flow: { currentStep, elapsedMs, lastErrorCode, lastErrorMessage },
    account: accountIdMasked,
  }, null, 2));

  return res.status(200).json({ ok: true, code });
}
