/**
 * Crypto helpers for password hashing (PBKDF2) and HMAC-signed session tokens.
 * Uses the Web Crypto API available in Cloudflare Workers.
 *
 * Password storage format: "pbkdf2$<saltHex>$<hashHex>"
 * Must-change prefix:      "reset:pbkdf2$<saltHex>$<hashHex>"
 * Session token format:    "<base64url(payload)>.<hexSig>"
 */

const ITERATIONS = 100_000;
const HASH = "SHA-256";
const KEY_LEN_BITS = 256;

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBuf(hex) {
  const bytes = hex.match(/.{2}/g) ?? [];
  return new Uint8Array(bytes.map((h) => parseInt(h, 16)));
}
function toB64(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function fromB64(b64) {
  return atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
}

/** Hash a plaintext password. Returns a storable string. */
export async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: HASH }, key, KEY_LEN_BITS);
  return `pbkdf2$${bufToHex(salt.buffer)}$${bufToHex(bits)}`;
}

/** Verify plaintext password against a stored hash string. */
export async function verifyPassword(password, stored) {
  if (!stored) return false;
  const canonical = stored.startsWith("reset:") ? stored.slice(6) : stored;
  if (!canonical.startsWith("pbkdf2$")) return false;
  const [, saltHex, expectedHex] = canonical.split("$");
  if (!saltHex || !expectedHex) return false;
  const enc = new TextEncoder();
  const salt = hexToBuf(saltHex);
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: HASH }, key, KEY_LEN_BITS);
  return bufToHex(bits) === expectedHex;
}

/** True when the stored value is a PBKDF2 hash (normal or reset). */
export function isHashFormat(value) {
  if (!value) return false;
  const canon = value.startsWith("reset:") ? value.slice(6) : value;
  return canon.startsWith("pbkdf2$");
}

/** True when the stored hash has the must-change prefix. */
export function isMustChange(value) {
  return typeof value === "string" && value.startsWith("reset:");
}

/** Mark an existing hash as "must change". */
export function markMustChange(hash) {
  if (!hash) return hash;
  if (hash.startsWith("reset:")) return hash;
  return `reset:${hash}`;
}

/** Remove the must-change prefix. */
export function clearMustChange(hash) {
  if (!hash) return hash;
  return hash.startsWith("reset:") ? hash.slice(6) : hash;
}

// ── Session tokens ─────────────────────────────────────────────────────────

async function getHmacKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: HASH }, false, ["sign", "verify"]);
}

/**
 * Sign a payload object and return a compact token.
 * @param {{ sub: string, role: string, exp: number }} payload
 */
export async function signToken(payload, secret) {
  const enc = new TextEncoder();
  const data = toB64(JSON.stringify(payload));
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return `${data}.${bufToHex(sig)}`;
}

/**
 * Verify a token and return its payload, or null if invalid/expired.
 */
export async function verifyToken(token, secret) {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const data = token.slice(0, dot);
  const sigHex = token.slice(dot + 1);
  const enc = new TextEncoder();
  const key = await getHmacKey(secret);
  let valid = false;
  try {
    valid = await crypto.subtle.verify("HMAC", key, hexToBuf(sigHex), enc.encode(data));
  } catch { return null; }
  if (!valid) return null;
  let payload;
  try { payload = JSON.parse(fromB64(data)); } catch { return null; }
  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
