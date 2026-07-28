const CORS_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const CORS_ALLOWED_HEADERS = "Content-Type, Authorization, X-Request-ID, X-Correlation-ID";

function configuredOrigins(env = {}) {
  return String(env.CORS_ALLOWED_ORIGINS || env.PUBLIC_APP_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(request, env = {}) {
  if (!request) return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let requestOrigin;
  try { requestOrigin = new URL(request.url).origin; } catch { return false; }
  const allowed = new Set([requestOrigin, ...configuredOrigins(env)]);
  if (["local", "development", "dev", "test"].includes(String(env.APP_ENV || env.NODE_ENV || "").toLowerCase())) {
    allowed.add("http://localhost:4173");
    allowed.add("http://127.0.0.1:4173");
  }
  return allowed.has(origin);
}

export function corsHeaders(request, env = {}) {
  const origin = request?.headers?.get("origin");
  const headers = {
    "Access-Control-Allow-Methods": CORS_METHODS,
    "Access-Control-Allow-Headers": CORS_ALLOWED_HEADERS,
    "Access-Control-Expose-Headers": "X-Request-ID, X-Correlation-ID, Content-Disposition",
    "Vary": "Origin",
  };
  if (origin && isAllowedOrigin(request, env)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

export function corsPreflight(request, env = {}) {
  if (!isAllowedOrigin(request, env)) return json({ ok: false, error: "CORS_ORIGIN_DENIED" }, 403);
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function addSecurityHeaders(response, request, env = {}) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()");
  headers.set("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "script-src 'self' 'sha256-PL0fJ1mX3OlzNlbMYD6pEUZ+bWbJgb9r2g4eQsrr8U0='",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
  ].join("; "));
  headers.set("X-Frame-Options", "SAMEORIGIN");
  if (new URL(request.url).protocol === "https:") headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  const path = new URL(request.url).pathname;
  if (/^(\/api|\/dashboard|\/admin|\/login(?:\/|$)|\/change-password|\/attendance|\/join)(?:\/|$)/.test(path)) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function notFound() {
  return json({ ok: false, error: "NOT_FOUND" }, 404);
}

export function methodNotAllowed() {
  return json({ ok: false, error: "Method not allowed" }, 405);
}

export async function readJson(request) {
  try {
    const text = await request.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}
