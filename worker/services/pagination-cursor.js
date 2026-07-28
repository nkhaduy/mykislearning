import { hmacHash, signToken, verifyToken } from "./crypto.js";

function cursorSecret(env = {}) {
  const secret = env.CURSOR_SIGNING_SECRET || env.JWT_SECRET || "";
  if (String(secret).length < 32) {
    throw Object.assign(new Error("Cursor signing secret is not configured"), {
      status: 503,
      code: "CURSOR_SECURITY_CONFIG_MISSING",
    });
  }
  return secret;
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export async function createPaginationCursor(env, { requesterId, scope, filters, position, ttlSeconds = 900 }) {
  const secret = cursorSecret(env);
  const filterHash = await hmacHash(canonicalJson(filters), secret);
  return signToken({
    sub: String(requesterId),
    role: "pagination_cursor",
    kind: String(scope),
    filterHash,
    position,
    exp: Math.floor(Date.now() / 1000) + Math.max(60, Math.min(3600, ttlSeconds)),
  }, secret);
}

export async function readPaginationCursor(env, token, { requesterId, scope, filters }) {
  if (!token) return null;
  const secret = cursorSecret(env);
  const payload = await verifyToken(token, secret);
  if (!payload || payload.role !== "pagination_cursor" || payload.kind !== scope || payload.sub !== String(requesterId)) {
    throw Object.assign(new Error("Invalid cursor"), { status: 400, code: "INVALID_CURSOR" });
  }
  const filterHash = await hmacHash(canonicalJson(filters), secret);
  if (payload.filterHash !== filterHash || !payload.position || typeof payload.position !== "object") {
    throw Object.assign(new Error("Cursor does not match this query"), { status: 400, code: "INVALID_CURSOR" });
  }
  return payload.position;
}
