import test from "node:test";
import assert from "node:assert/strict";

import {
  decryptEscrowPassword,
  encryptEscrowPassword,
} from "../../worker/services/password-escrow.js";
import { writeCredentialBundle } from "../../worker/services/credentials.js";

const env = {
  PASSWORD_ESCROW_KEY: JSON.stringify({
    active: "v1",
    keys: { v1: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8" },
  }),
};

test("escrow encrypts with unique IVs and decrypts only for the bound profile", async () => {
  const first = await encryptEscrowPassword("abcdef", "emp-1", env);
  const second = await encryptEscrowPassword("abcdef", "emp-1", env);
  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.notEqual(first.iv, second.iv);
  assert.equal(first.keyVersion, "v1");
  assert.equal(await decryptEscrowPassword(first, "emp-1", env), "abcdef");
  await assert.rejects(() => decryptEscrowPassword(first, "emp-2", env), /PASSWORD_ESCROW_UNAVAILABLE/);
});

test("escrow rejects missing, malformed, and non-256-bit key configuration", async () => {
  await assert.rejects(() => encryptEscrowPassword("abcdef", "emp-1", {}), /PASSWORD_ESCROW_UNAVAILABLE/);
  await assert.rejects(() => encryptEscrowPassword("abcdef", "emp-1", { PASSWORD_ESCROW_KEY: "not-json" }), /PASSWORD_ESCROW_UNAVAILABLE/);
  await assert.rejects(() => encryptEscrowPassword("abcdef", "emp-1", {
    PASSWORD_ESCROW_KEY: JSON.stringify({ active: "v1", keys: { v1: "c2hvcnQ" } }),
  }), /PASSWORD_ESCROW_UNAVAILABLE/);
});

test("credential bundle writes hash and escrow atomically through one RPC", async () => {
  const calls = [];
  const supabase = {
    async rpc(name, params) {
      calls.push({ name, params });
      return { data: true, error: null };
    },
  };
  await writeCredentialBundle(supabase, "emp-1", "pbkdf2-sha256$hash", {
    ciphertext: "cipher",
    iv: "iv",
    keyVersion: "v1",
  }, { mustChange: true });
  assert.deepEqual(calls, [{
    name: "service_write_credential_bundle",
    params: {
      p_profile_id: "emp-1",
      p_password_hash: "pbkdf2-sha256$hash",
      p_must_change: true,
      p_ciphertext: "cipher",
      p_iv: "iv",
      p_key_version: "v1",
    },
  }]);
});
