import test from "node:test";
import assert from "node:assert/strict";

import { hashPassword, verifyPassword, isHashFormat } from "../../worker/services/crypto.js";

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function legacyHash(password) {
  const salt = new Uint8Array(16).fill(7);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, key, 256);
  return `pbkdf2$${toHex(salt)}$${toHex(bits)}`;
}

test("SEC-004: new password hashes stay within the Cloudflare PBKDF2 limit", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.match(hash, /^pbkdf2-sha256\$100000\$/);
  assert.equal(isHashFormat(hash), true);
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
});

test("SEC-004: legacy PBKDF2 hashes remain verifiable for one-way migration", async () => {
  const hash = await legacyHash("legacy-password");
  assert.equal(await verifyPassword("legacy-password", hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
});
