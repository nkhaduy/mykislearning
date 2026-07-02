import { getRequestContext } from "../middleware/request-context.js";
import { changedFields, sanitizeAuditPayload } from "./audit-redaction.js";

const ACTION_CATEGORY = [
  [/^auth\./, "authentication"],
  [/^account\./, "account"],
  [/^employee\./, "employee"],
  [/^course\./, "course"],
  [/^quiz\./, "quiz"],
  [/^learning_path\./, "learning_path"],
  [/^compliance\./, "compliance"],
  [/^certificate\./, "certificate"],
  [/^report\./, "report"],
  [/^audit\./, "security"],
  [/^notification\./, "notification"],
  [/^training_session\.|^attendance\./, "training_session"],
  [/^system\./, "system"],
];

const CRITICAL = new Set(["account.role_changed", "account.locked", "account.unlocked", "compliance.manual_completion", "certificate.revoked", "report.exported", "audit.exported", "notification.manual_run"]);
const WARNING = new Set(["auth.login_failed", "report.export_failed", "system.scheduler_run_failed", "certificate.rejected"]);

function categoryFor(action) {
  return ACTION_CATEGORY.find(([re]) => re.test(action))?.[1] || "administrative";
}

function severityFor(action, status) {
  if (CRITICAL.has(action)) return "critical";
  if (WARNING.has(action) || status === "failed") return "warning";
  return "info";
}

function actorSnapshot(actor = {}) {
  return actor.fullName || actor.full_name || actor.name || actor.email || actor.accountId || actor.id || "";
}

export async function writeAuditLog(supabase, request, event = {}, options = {}) {
  const action = String(event.action || "").trim();
  if (!action) return { ok: false, skipped: true };
  const ctx = request ? getRequestContext(request) : { source: event.source || "system" };
  const beforeData = sanitizeAuditPayload(event.beforeData || event.before_data || null);
  const afterData = sanitizeAuditPayload(event.afterData || event.after_data || null);
  const metadata = sanitizeAuditPayload(event.metadata || {});
  const actor = event.actor || {};
  const status = event.status || "success";
  const entityType = event.entityType || event.entity_type || event.targetType || event.target_type || null;
  const entityId = event.entityId || event.entity_id || event.targetId || event.target_id || null;
  const row = {
    actor_user_id: event.actorUserId || actor.accountId || actor.id || null,
    actor_type: event.actorType || (actor.accountId || actor.id ? "user" : "system"),
    actor_role: event.actorRole || actor.role || null,
    actor_display_name_snapshot: event.actorDisplayName || actorSnapshot(actor) || null,
    action,
    category: event.category || categoryFor(action),
    severity: event.severity || severityFor(action, status),
    entity_type: entityType,
    entity_id: entityId,
    entity_display_name_snapshot: event.entityDisplayName || null,
    request_id: event.requestId || ctx.requestId || null,
    correlation_id: event.correlationId || ctx.correlationId || null,
    session_reference_hash: event.sessionReferenceHash || null,
    source: event.source || ctx.source || "api",
    ip_address_hash: event.ipAddressHash || ctx.ipAddressHash || null,
    user_agent: event.userAgent || ctx.userAgent || null,
    country_code: event.countryCode || ctx.countryCode || null,
    before_data: beforeData,
    after_data: afterData,
    changed_fields: event.changedFields || changedFields(beforeData, afterData),
    metadata,
    details: metadata,
    result: status,
    status,
    error_code: event.errorCode || null,
  };
  const { error } = await supabase.from("audit_logs").insert(row);
  if (error && options.critical) throw new Error(`AUDIT_INSERT_FAILED: ${error.message}`);
  return { ok: !error, error };
}

export function auditLater(supabase, request, event) {
  Promise.resolve(writeAuditLog(supabase, request, event)).then(null, () => {});
}
