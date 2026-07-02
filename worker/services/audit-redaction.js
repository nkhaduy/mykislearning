const SENSITIVE_KEY_RE = /(password|password_hash|token|access_token|refresh_token|authorization|cookie|secret|api_key|service_role|signed_url|private_url)/i;
const MAX_TEXT = 4000;
const MAX_JSON = 12000;

function redactValue(value, depth = 0) {
  if (depth > 8) return "[TRUNCATED_DEPTH]";
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}...[TRUNCATED]` : value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redactValue(item, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value).slice(0, 100)) {
      out[key] = SENSITIVE_KEY_RE.test(key) ? "[REDACTED]" : redactValue(child, depth + 1);
    }
    return out;
  }
  return String(value);
}

export function sanitizeAuditPayload(value) {
  const redacted = redactValue(value);
  const json = JSON.stringify(redacted);
  if (json.length <= MAX_JSON) return redacted;
  return { payload_truncated: true, preview: json.slice(0, MAX_JSON), original_size: json.length };
}

export function changedFields(beforeData, afterData) {
  const before = beforeData && typeof beforeData === "object" ? beforeData : {};
  const after = afterData && typeof afterData === "object" ? afterData : {};
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .slice(0, 100);
}
