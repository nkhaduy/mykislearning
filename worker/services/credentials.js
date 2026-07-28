export async function readCredential(supabase, profileId) {
  const { data, error } = await supabase.rpc("service_read_account_credential", {
    p_profile_id: String(profileId),
  });
  if (error) throw Object.assign(new Error("CREDENTIAL_READ_FAILED"), { status: 503, code: "CREDENTIAL_STORE_UNAVAILABLE" });
  return data || null;
}

export async function writeCredential(supabase, profileId, passwordHash, { mustChange = false } = {}) {
  const { error } = await supabase.rpc("service_write_account_credential", {
    p_profile_id: String(profileId),
    p_password_hash: String(passwordHash),
    p_must_change: Boolean(mustChange),
  });
  if (error) throw Object.assign(new Error("CREDENTIAL_WRITE_FAILED"), { status: 503, code: "CREDENTIAL_STORE_UNAVAILABLE" });
}
