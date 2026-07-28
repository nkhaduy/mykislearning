import { hmacHash } from "./crypto.js";
import { isProductionLike, trustedClientIp } from "./client-ip.js";
import { json } from "./responses.js";

const memoryBuckets = new Map();

function normalizeDimension(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function pruneMemory(now) {
  for (const [key, bucket] of memoryBuckets) if (bucket.resetAt <= now) memoryBuckets.delete(key);
  if (memoryBuckets.size <= 5000) return;
  for (const key of [...memoryBuckets.keys()].slice(0, memoryBuckets.size - 5000)) memoryBuckets.delete(key);
}

function unavailableResponse() {
  return json({ ok: false, error: "RATE_LIMIT_UNAVAILABLE" }, 503, { "Retry-After": "30" });
}

function limitedResponse(retryAfter) {
  return json({ ok: false, error: "RATE_LIMITED", retryAfter }, 429, { "Retry-After": String(retryAfter) });
}

export function validateRateLimitBinding(env = {}) {
  if (!isProductionLike(env)) return true;
  if (!env.RATE_LIMITER_DO?.idFromName || !env.RATE_LIMITER_DO?.get) {
    throw Object.assign(new Error("Durable Object rate limiter binding is missing"), { code: "RATE_LIMIT_BINDING_MISSING" });
  }
  if (String(env.RATE_LIMIT_KEY_SECRET || "").length < 32) {
    throw Object.assign(new Error("Rate-limit key secret is missing"), { code: "RATE_LIMIT_KEY_MISSING" });
  }
  return true;
}

async function bucketKey(request, env, scope, identity) {
  const material = `${normalizeDimension(scope)}:${trustedClientIp(request, env)}:${normalizeDimension(identity)}`;
  const secret = String(env.RATE_LIMIT_KEY_SECRET || "");
  return secret.length >= 32 ? hmacHash(material, secret) : sha256(material);
}

async function distributedLimit(env, key, limit, windowSeconds) {
  const objectId = env.RATE_LIMITER_DO.idFromName(`rl-${key.slice(0, 2)}`);
  const stub = env.RATE_LIMITER_DO.get(objectId);
  const response = await stub.fetch("https://rate-limiter.internal/limit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, limit, windowSeconds }),
  });
  if (!response.ok) throw new Error("Rate limiter Durable Object failed");
  return response.json();
}

function memoryLimit(key, limit, windowSeconds) {
  const now = Date.now();
  pruneMemory(now);
  const current = memoryBuckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowSeconds * 1000 }
    : current;
  bucket.count += 1;
  memoryBuckets.set(key, bucket);
  return {
    success: bucket.count <= limit,
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/**
 * @param {Request} request
 * @param {Record<string, any>} env
 * @param {string} scope
 * @param {string} identity
 * @param {{ limit: number, windowSeconds: number, critical?: boolean }} options
 */
export async function enforceRateLimit(request, env, scope, identity = "", {
  limit,
  windowSeconds,
  critical = true,
}) {
  const key = await bucketKey(request, env, scope, identity);
  let result;
  try {
    if (env?.RATE_LIMITER_DO?.idFromName && env?.RATE_LIMITER_DO?.get) {
      result = await distributedLimit(env, key, limit, windowSeconds);
    } else if (isProductionLike(env)) {
      return critical ? unavailableResponse() : null;
    } else {
      result = memoryLimit(key, limit, windowSeconds);
    }
  } catch {
    if (critical) return unavailableResponse();
    console.warn("[RATE_LIMIT] controlled fail-open");
    return null;
  }

  return result.success ? null : limitedResponse(Math.max(1, Number(result.retryAfter || windowSeconds)));
}

export async function enforceApiRateLimit(request, env, pathname) {
  const method = request.method.toUpperCase();
  if (pathname.startsWith("/api/auth") && method === "POST") {
    return enforceRateLimit(request, env, "auth-global", "", { limit: 30, windowSeconds: 300, critical: true });
  }
  if (pathname === "/api/employees" && method === "GET") {
    return enforceRateLimit(request, env, "employee-search", "", { limit: 120, windowSeconds: 60, critical: false });
  }
  if (pathname.startsWith("/api/admin/reports") || pathname.startsWith("/api/admin/report-exports")) {
    return enforceRateLimit(request, env, "report-export", "", { limit: 20, windowSeconds: 60, critical: false });
  }
  if (pathname.startsWith("/api/attendance/") || pathname.startsWith("/api/public/live-training/")) {
    return enforceRateLimit(request, env, "attendance-public-flow", "", { limit: 60, windowSeconds: 60, critical: false });
  }
  if (/upload|speaker-photo|learning-evidence/i.test(pathname)) {
    return enforceRateLimit(request, env, "upload", "", { limit: 10, windowSeconds: 60, critical: false });
  }
  return null;
}

export { normalizeDimension };
