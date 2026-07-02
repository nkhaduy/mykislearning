const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Account-Id, X-Account-Role, Authorization, X-Request-ID, X-Correlation-ID",
  "Access-Control-Expose-Headers": "X-Request-ID, X-Correlation-ID, Content-Disposition",
};

export function corsHeaders() {
  return { ...CORS_HEADERS };
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
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
