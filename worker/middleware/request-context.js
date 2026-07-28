const contexts = new WeakMap();
import { addSecurityHeaders } from "../services/responses.js";
import { trustedClientIp } from "../services/client-ip.js";

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

function makeId(prefix = "req") {
  return `${prefix}_${crypto.randomUUID()}`;
}

function validId(value) {
  const text = String(value || "").trim();
  return ID_RE.test(text) ? text : "";
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function trim(value, max) {
  const text = String(value || "");
  return text.length > max ? text.slice(0, max) : text;
}

export async function withRequestContext(request, env, handler) {
  const requestId = validId(request.headers.get("x-request-id")) || makeId("req");
  const correlationId = validId(request.headers.get("x-correlation-id")) || requestId;
  const userAgent = trim(request.headers.get("user-agent") || "", 512);
  const countryCode = /^[A-Z]{2}$/.test(request.headers.get("cf-ipcountry") || "") ? request.headers.get("cf-ipcountry") : null;
  const ip = trustedClientIp(request, env);
  const salt = env?.AUDIT_IP_HASH_SALT || env?.JWT_SECRET || "";
  const ipAddressHash = ip && salt ? await sha256Hex(`${salt}:${ip}`) : null;
  const context = { requestId, correlationId, userAgent, countryCode, ipAddressHash, source: "api" };
  contexts.set(request, context);
  const response = await handler(request, context);
  const securedResponse = addSecurityHeaders(response, request, env);
  const headers = new Headers(securedResponse.headers);
  headers.set("X-Request-ID", requestId);
  headers.set("X-Correlation-ID", correlationId);
  return new Response(securedResponse.body, { status: securedResponse.status, statusText: securedResponse.statusText, headers });
}

export function getRequestContext(request) {
  return contexts.get(request) || { requestId: makeId("req"), correlationId: makeId("corr"), source: "api" };
}
