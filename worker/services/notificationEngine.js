const DEFAULT_TZ = "Asia/Ho_Chi_Minh";
const SAFE_PLACEHOLDERS = new Set([
  "employee_name", "course_title", "learning_path_title", "program_title", "certificate_name",
  "session_title", "quiz_title", "report_type", "due_date", "expiry_date", "days_remaining",
  "days_overdue", "rejection_reason", "error_message",
]);
const MANDATORY_PREFIXES = ["compliance_", "certificate_", "account_", "password_"];

export function nid(prefix = "notif") {
  return `${prefix}-${crypto.randomUUID()}`;
}

function cleanValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[<>]/g, "").slice(0, 500);
}

export function sanitizePayload(payload = {}) {
  const out = {};
  for (const [key, value] of Object.entries(payload || {})) {
    const k = String(key);
    if (/password|token|secret|signed|credential|key/i.test(k)) continue;
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) out[k] = cleanValue(value);
  }
  return out;
}

function renderTemplate(template = "", payload = {}) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    if (!SAFE_PLACEHOLDERS.has(key)) return "";
    return cleanValue(payload[key]);
  });
}

function mandatory(eventType) {
  return MANDATORY_PREFIXES.some((prefix) => String(eventType || "").startsWith(prefix));
}

async function preferenceAllows(supabase, recipientId, eventType, channel) {
  if (channel === "in_app" && mandatory(eventType)) return true;
  const { data } = await supabase.from("notification_preferences")
    .select("in_app_enabled, email_enabled")
    .eq("employee_id", recipientId)
    .eq("event_type", eventType)
    .maybeSingle();
  if (!data) return channel === "in_app";
  return channel === "email" ? data.email_enabled === true : data.in_app_enabled !== false;
}

async function templateFor(supabase, eventType, channel, locale = "vi") {
  const { data } = await supabase.from("notification_templates")
    .select("*")
    .eq("event_type", eventType)
    .eq("channel", channel)
    .eq("locale", locale)
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1);
  return data?.[0] || null;
}

export async function createNotificationEvent(supabase, input) {
  const payload = sanitizePayload(input.payload || {});
  const eventType = cleanValue(input.eventType);
  const recipientId = cleanValue(input.recipientId);
  const entityType = cleanValue(input.entityType || "system");
  const entityId = cleanValue(input.entityId || "system");
  const idempotencyKey = cleanValue(input.idempotencyKey || `${eventType}:${entityId}:${recipientId}`);
  const eventRow = {
    id: input.id || nid("nevt"),
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    actor_id: input.actorId || null,
    recipient_id: recipientId,
    payload,
    idempotency_key: idempotencyKey,
    occurred_at: input.occurredAt || new Date().toISOString(),
    status: "pending",
  };
  const { data, error } = await supabase.from("notification_events")
    .upsert(eventRow, { onConflict: "idempotency_key", ignoreDuplicates: true })
    .select()
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, duplicate: true, idempotencyKey };
  return processNotificationEvent(supabase, data, input);
}

export async function processNotificationEvent(supabase, event, options = {}) {
  const channel = options.channel || "in_app";
  const allowed = await preferenceAllows(supabase, event.recipient_id, event.event_type, channel);
  if (!allowed) {
    await supabase.from("notification_events").update({ status: "skipped", processed_at: new Date().toISOString() }).eq("id", event.id);
    return { ok: true, skipped: true, event };
  }
  const template = await templateFor(supabase, event.event_type, channel, options.locale || "vi");
  const payload = event.payload || {};
  const fallbackTitle = options.title || event.event_type.replaceAll("_", " ");
  const notification = {
    id: options.notificationId || nid("notif"),
    account_id: event.recipient_id,
    recipient_id: event.recipient_id,
    event_id: event.id,
    type: event.event_type,
    event_type: event.event_type,
    title: template ? renderTemplate(template.title_template, payload) : fallbackTitle,
    body: template ? renderTemplate(template.body_template, payload) : (options.body || ""),
    link: template ? renderTemplate(template.action_url_template, payload) : (options.actionUrl || options.link || null),
    action_url: template ? renderTemplate(template.action_url_template, payload) : (options.actionUrl || options.link || null),
    action_label: template ? renderTemplate(template.action_label_template, payload) : (options.actionLabel || "Mở"),
    priority: options.priority || (mandatory(event.event_type) ? "high" : "normal"),
    created_by: event.actor_id || null,
    data: payload,
    metadata: { entityType: event.entity_type, entityId: event.entity_id, idempotencyKey: event.idempotency_key },
    created_at: event.occurred_at || new Date().toISOString(),
  };
  const { data: inserted, error } = await supabase.from("notifications")
    .insert(notification)
    .select("id")
    .maybeSingle();
  if (error) {
    await supabase.from("notification_events").update({ status: "failed", processed_at: new Date().toISOString() }).eq("id", event.id);
    return { ok: false, error: error.message };
  }
  await Promise.allSettled([
    supabase.from("notification_deliveries").insert({
      id: nid("ndlv"),
      notification_id: inserted?.id || notification.id,
      recipient_id: event.recipient_id,
      channel: "in_app",
      status: "delivered",
      provider: "mykis_in_app",
      attempt_count: 1,
      sent_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
    }),
    supabase.from("notification_deliveries").insert({
      id: nid("ndlv"),
      notification_id: inserted?.id || notification.id,
      recipient_id: event.recipient_id,
      channel: "email",
      status: "not_configured",
      provider: "not_configured",
      error_code: "EMAIL_PROVIDER_NOT_CONFIGURED",
      error_message_safe: "Email provider is not configured for this deployment.",
    }),
    supabase.from("notification_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", event.id),
  ]);
  return { ok: true, event, notificationId: inserted?.id || notification.id };
}

function vnDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function dateDiffDays(targetIso, now = new Date()) {
  const target = new Date(targetIso);
  const today = new Date(`${vnDateKey(now)}T00:00:00.000+07:00`);
  const targetDay = new Date(`${vnDateKey(target)}T00:00:00.000+07:00`);
  return Math.round((targetDay.getTime() - today.getTime()) / 86400000);
}

function deadlineFromEnrollment(row) {
  return row.data?.deadline || row.data?.dueAt || row.data?.due_at || null;
}

function dueMatches(rule, dueIso, now) {
  if (!dueIso) return false;
  const diff = rule.offset_unit === "hour"
    ? Math.round((new Date(dueIso).getTime() - now.getTime()) / 3600000)
    : dateDiffDays(dueIso, now);
  if (rule.direction === "before") return diff === Number(rule.offset_value);
  if (rule.direction === "after") return diff === -Number(rule.offset_value);
  return diff === 0;
}

async function candidatesForRule(supabase, rule, now) {
  const limit = Number(rule.configuration?.limit || 100);
  if (rule.entity_type === "course_assignment") {
    const { data } = await supabase.from("enrollments").select("id, account_id, course_id, status, data, course:courses(id, data)").not("status", "eq", "completed").limit(limit);
    return (data || []).filter((row) => dueMatches(rule, deadlineFromEnrollment(row), now)).map((row) => ({
      entityId: row.id, recipientId: row.account_id,
      payload: { course_title: row.course?.data?.title || row.data?.courseTitle || "Khóa học", due_date: deadlineFromEnrollment(row), days_remaining: String(Math.max(0, dateDiffDays(deadlineFromEnrollment(row), now))), days_overdue: String(Math.max(0, -dateDiffDays(deadlineFromEnrollment(row), now))) },
    }));
  }
  if (rule.entity_type === "learning_path_assignment") {
    const { data } = await supabase.from("learning_path_assignments").select("id, employee_id, due_at, status, learning_path:learning_paths(title)").not("status", "in", '("completed","cancelled")').limit(limit);
    return (data || []).filter((row) => dueMatches(rule, row.due_at, now)).map((row) => ({
      entityId: row.id, recipientId: row.employee_id,
      payload: { learning_path_title: row.learning_path?.title || "Lộ trình", due_date: row.due_at?.slice(0, 10) || "", days_remaining: String(Math.max(0, dateDiffDays(row.due_at, now))), days_overdue: String(Math.max(0, -dateDiffDays(row.due_at, now))) },
    }));
  }
  if (rule.entity_type === "compliance_assignment") {
    const { data } = await supabase.from("compliance_assignments").select("id, employee_id, due_at, status, cycle:compliance_cycles(title, program:compliance_programs(title))").not("status", "in", '("completed","exempted","cancelled")').limit(limit);
    return (data || []).filter((row) => dueMatches(rule, row.due_at, now)).map((row) => ({
      entityId: row.id, recipientId: row.employee_id,
      payload: { program_title: row.cycle?.program?.title || row.cycle?.title || "Đào tạo tuân thủ", due_date: row.due_at?.slice(0, 10) || "", days_remaining: String(Math.max(0, dateDiffDays(row.due_at, now))), days_overdue: String(Math.max(0, -dateDiffDays(row.due_at, now))) },
    }));
  }
  if (rule.entity_type === "certificate") {
    const { data } = await supabase.from("employee_certifications").select("id, account_id, name, certificate_type, expiry_date, status, verification_status").not("expiry_date", "is", null).not("status", "in", '("revoked","rejected")').limit(limit);
    return (data || []).filter((row) => dueMatches(rule, row.expiry_date, now)).map((row) => ({
      entityId: row.id, recipientId: row.account_id,
      payload: { certificate_name: row.name || row.certificate_type || "Chứng chỉ", expiry_date: row.expiry_date },
    }));
  }
  if (rule.entity_type === "training_session") {
    const { data } = await supabase.from("session_participants").select("id, account_id, session_id, session:training_sessions(id, title, start_at, status, data)").limit(limit);
    return (data || []).filter((row) => row.session && !["cancelled", "draft"].includes(row.session.status) && dueMatches(rule, row.session.start_at, now)).map((row) => ({
      entityId: row.session_id, recipientId: row.account_id,
      payload: { session_title: row.session?.title || row.session?.data?.title || "Buổi đào tạo" },
    }));
  }
  return [];
}

export async function runReminderScheduler(supabase, scheduledFor = new Date()) {
  const { data: rules, error } = await supabase.from("reminder_rules").select("*").eq("status", "active").limit(50);
  if (error) return { ok: false, error: error.message };
  const summary = { ok: true, rules: 0, candidates: 0, eventsCreated: 0, duplicatesSkipped: 0, failures: 0 };
  for (const rule of rules || []) {
    summary.rules += 1;
    const runId = nid("rrun");
    const { data: runRow } = await supabase.from("reminder_runs").upsert({
      id: runId,
      rule_id: rule.id,
      scheduled_for: scheduledFor.toISOString(),
      status: "running",
      started_at: new Date().toISOString(),
    }, { onConflict: "rule_id,scheduled_for", ignoreDuplicates: true }).select("id").maybeSingle();
    if (!runRow) continue;
    let candidates = [];
    let created = 0;
    let dupes = 0;
    let failures = 0;
    try {
      candidates = await candidatesForRule(supabase, rule, scheduledFor);
      for (const c of candidates) {
        const threshold = rule.configuration?.threshold || `${rule.offset_value}${rule.offset_unit}`;
        const key = `${rule.event_type}:${c.entityId}:${c.recipientId}:${threshold}:${vnDateKey(scheduledFor)}`;
        const result = await createNotificationEvent(supabase, {
          eventType: rule.event_type,
          entityType: rule.entity_type,
          entityId: c.entityId,
          recipientId: c.recipientId,
          idempotencyKey: key,
          payload: c.payload,
        });
        if (result.duplicate) dupes += 1;
        else if (result.ok) created += 1;
        else failures += 1;
      }
      await supabase.from("reminder_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        candidates_found: candidates.length,
        events_created: created,
        duplicates_skipped: dupes,
        failures,
      }).eq("id", runRow.id);
    } catch (e) {
      failures += 1;
      await supabase.from("reminder_runs").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        candidates_found: candidates.length,
        events_created: created,
        duplicates_skipped: dupes,
        failures,
        error_summary: String(e.message || e).slice(0, 500),
      }).eq("id", runRow.id);
    }
    summary.candidates += candidates.length;
    summary.eventsCreated += created;
    summary.duplicatesSkipped += dupes;
    summary.failures += failures;
  }
  return summary;
}
