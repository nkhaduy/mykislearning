import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";

export async function handleConfig(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  if (method === "GET") {
    const url = env.SUPABASE_URL || "";
    const anonKey = env.SUPABASE_ANON_KEY || "";
    if (!url || !anonKey) {
      return json({ error: "Supabase not configured", supabaseUrl: "", supabaseAnonKey: "" }, 503);
    }
    return new Response(JSON.stringify({ supabaseUrl: url, supabaseAnonKey: anonKey }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  if (method === "POST") {
    const body = await readJson(request);
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
    } = body;

    console.log(`[QR-DEBUG] ${code} @ ${ts}`, JSON.stringify({
      code, event, build, timestamp: timestamp || ts,
      url, ua, iosVersion, isSafari, isHttps, pageVisibility,
      video: { videoFound, sameElement, connected, hasSrcObject, videoPaused, videoReadyState, videoSize, renderedSize },
      stream: { streamExists, trackState, trackEnabled, trackMuted, trackSettings },
      permissions: { camPermission, locPermission },
      flow: { currentStep, elapsedMs, lastErrorCode, lastErrorMessage },
      account: accountIdMasked,
    }, null, 2));

    return json({ ok: true, code });
  }

  return methodNotAllowed();
}
