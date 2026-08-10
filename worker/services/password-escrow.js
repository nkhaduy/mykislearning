const ESCROW_ERROR = "PASSWORD_ESCROW_UNAVAILABLE";

function unavailable() {
  return Object.assign(new Error(ESCROW_ERROR), { status: 503, code: ESCROW_ERROR });
}

function decodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) throw unavailable();
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw unavailable();
  }
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function escrowKey(env) {
  let config;
  try {
    config = JSON.parse(String(env?.PASSWORD_ESCROW_KEY || ""));
  } catch {
    throw unavailable();
  }
  const active = String(config?.active || "");
  const encoded = config?.keys?.[active];
  if (!active || typeof encoded !== "string") throw unavailable();
  const raw = decodeBase64Url(encoded);
  if (raw.length !== 32) throw unavailable();
  return { active, raw };
}

export async function encryptEscrowPassword(password, profileId, env) {
  const value = String(password ?? "");
  const subject = String(profileId || "");
  if (!subject || value.length < 1) throw unavailable();
  const { active, raw } = escrowKey(env);
  try {
    const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(subject) },
      key,
      new TextEncoder().encode(value),
    );
    return { ciphertext: encodeBase64Url(new Uint8Array(ciphertext)), iv: encodeBase64Url(iv), keyVersion: active };
  } catch {
    throw unavailable();
  }
}

export async function decryptEscrowPassword(record, profileId, env) {
  const subject = String(profileId || "");
  const keyVersion = String(record?.keyVersion || record?.key_version || "");
  if (!subject || !record?.ciphertext || !record?.iv || !keyVersion) throw unavailable();
  let config;
  try {
    config = JSON.parse(String(env?.PASSWORD_ESCROW_KEY || ""));
  } catch {
    throw unavailable();
  }
  const encoded = config?.keys?.[keyVersion];
  if (typeof encoded !== "string") throw unavailable();
  const raw = decodeBase64Url(encoded);
  if (raw.length !== 32) throw unavailable();
  try {
    const iv = decodeBase64Url(record.iv);
    const ciphertext = decodeBase64Url(record.ciphertext);
    if (iv.length !== 12 || ciphertext.length < 16) throw unavailable();
    const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(subject) },
      key,
      ciphertext,
    );
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    if (error?.code === ESCROW_ERROR) throw error;
    throw unavailable();
  }
}
