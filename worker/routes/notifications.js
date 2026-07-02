import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";
import { createNotificationEvent, nid, runReminderScheduler } from "../services/notificationEngine.js";
import { writeAuditLog } from "../services/audit-service.js";

export async function handleNotifications(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const url = new URL(request.url);
  const supabase = getSupabase(env);
  const acct = await requireAuth(request, env);
  if (!acct) return json({ error: "Unauthorized" }, 401);

  if (method === "GET" && url.pathname === "/api/admin/notifications/monitor") {
    const hr = await requireHr(request, env);
    if (!hr) return json({ error: "HR_ONLY" }, 403);
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [events, unread, deliveries, runs, rules] = await Promise.all([
      supabase.from("notification_events").select("id, event_type, status, created_at", { count: "exact", head: true }).gte("created_at", since),
      supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null).is("archived_at", null),
      supabase.from("notification_deliveries").select("id, status, channel, error_code, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("reminder_runs").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("reminder_rules").select("id, event_type, entity_type, offset_value, offset_unit, direction, channel, is_mandatory, status").order("created_at", { ascending: true }),
    ]);
    return json({
      ok: true,
      last7DaysEvents: events.count || 0,
      unreadNotifications: unread.count || 0,
      deliveries: deliveries.data || [],
      runs: runs.data || [],
      rules: rules.data || [],
    });
  }

  if (method === "POST" && url.pathname === "/api/admin/notifications/run-reminders") {
    const hr = await requireHr(request, env);
    if (!hr) return json({ error: "HR_ONLY" }, 403);
    const result = await runReminderScheduler(supabase, new Date());
    await writeAuditLog(supabase, request, {
      actor: hr,
      action: "notification.manual_run",
      entityType: "reminder_runs",
      status: result.ok ? "success" : "failed",
      metadata: result,
      errorCode: result.ok ? null : "REMINDER_RUN_FAILED",
    }, { critical: true }).catch(() => {});
    return json(result, result.ok ? 200 : 500);
  }

  // GET /api/notifications — list for current user (or all for HR)
  if (method === "GET") {
    const accountId = url.searchParams.get("accountId") || acct.accountId;
    // Non-HR can only read their own
    if (acct.role !== "hr" && accountId !== acct.accountId) {
      return json({ error: "Forbidden" }, 403);
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("id, account_id, recipient_id, event_id, event_type, type, title, body, link, action_label, action_url, priority, is_read, read_at, archived_at, created_by, expires_at, data, metadata, created_at")
      .or(`account_id.eq.${accountId},recipient_id.eq.${accountId}`)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return json({ error: error.message }, 500);

    const now = new Date().toISOString();
    const rows = (data || [])
      .filter((n) => !n.expires_at || n.expires_at >= now)
      .map((n) => ({
        id: n.id,
        accountId: n.recipient_id || n.account_id,
        eventId: n.event_id,
        type: n.event_type || n.type,
        title: n.title,
        body: n.body,
        link: n.action_url || n.link || n.data?.actionUrl || "",
        actionLabel: n.action_label || "",
        priority: n.priority || "normal",
        isRead: Boolean(n.read_at || n.is_read),
        readAt: n.read_at,
        createdBy: n.created_by,
        createdAt: n.created_at,
        expiresAt: n.expires_at,
      }));

    return json(rows);
  }

  // POST /api/notifications — HR creates notification event(s)
  if (method === "POST") {
    const hr = await requireHr(request, env);
    if (!hr) return json({ error: "HR_ONLY" }, 403);
    const body = await readJson(request);

    // Bulk mode: { notifications: [...] }
    const items = Array.isArray(body.notifications)
      ? body.notifications
      : [body];

    if (!items.length) return json({ error: "No notifications provided" }, 400);

    const results = [];
    for (const n of items) {
      const recipientId = n.recipient_id || n.account_id || n.accountId;
      if (!recipientId) return json({ error: "recipient_id/account_id required" }, 400);
      const eventType = n.event_type || n.type || "hr_announcement";
      const entityType = n.entity_type || n.entityType || "manual_notification";
      const entityId = n.entity_id || n.entityId || n.id || nid("manual");
      const idempotencyKey = n.idempotency_key || n.idempotencyKey || `${eventType}:${entityId}:${recipientId}`;
      const result = await createNotificationEvent(supabase, {
        eventType,
        entityType,
        entityId,
        actorId: hr.accountId,
        recipientId,
        idempotencyKey,
        title: n.title,
        body: n.body,
        link: n.link || n.actionUrl || n.action_url,
        actionLabel: n.actionLabel || n.action_label,
        payload: { ...(n.data || {}), title: n.title || "", body: n.body || "", action_url: n.link || n.actionUrl || "" },
      });
      results.push(result);
    }
    await writeAuditLog(supabase, request, {
      actor: hr,
      action: "notification.manual_run",
      entityType: "notification_events",
      metadata: { recipients: items.length, created: results.filter((r) => r.ok && !r.duplicate).length, duplicates: results.filter((r) => r.duplicate).length },
    }, { critical: true }).catch(() => {});
    return json({ ok: true, count: results.filter((r) => r.ok && !r.duplicate).length, duplicates: results.filter((r) => r.duplicate).length, results });
  }

  // PATCH /api/notifications — mark read / mark all read
  if (method === "PATCH") {
    const body = await readJson(request);
    const { id, markAllRead, accountId: targetAccountId, read, archived } = body;
    const patch = {};
    if (read === false) {
      patch.is_read = false;
      patch.read_at = null;
    } else {
      patch.is_read = true;
      patch.read_at = new Date().toISOString();
    }
    if (archived === true) patch.archived_at = new Date().toISOString();

    if (markAllRead) {
      const targetId = (acct.role === "hr" && targetAccountId) ? targetAccountId : acct.accountId;
      const { error } = await supabase.from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .or(`account_id.eq.${targetId},recipient_id.eq.${targetId}`)
        .is("read_at", null);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (!id) return json({ error: "id or markAllRead required" }, 400);

    // Verify ownership before marking
    const { data: existing } = await supabase.from("notifications")
      .select("account_id, recipient_id").eq("id", id).single();
    if (!existing) return json({ error: "Not found" }, 404);
    if (acct.role !== "hr" && existing.account_id !== acct.accountId && existing.recipient_id !== acct.accountId) {
      return json({ error: "Forbidden" }, 403);
    }

    const { error } = await supabase.from("notifications")
      .update(patch).eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // DELETE /api/notifications — HR deletes, or user deletes own
  if (method === "DELETE") {
    const body = await readJson(request);
    const id = url.searchParams.get("id") || body?.id;
    if (!id) return json({ error: "id required" }, 400);

    const { data: existing } = await supabase.from("notifications")
      .select("account_id").eq("id", id).single();
    if (!existing) return json({ error: "Not found" }, 404);
    if (acct.role !== "hr" && existing.account_id !== acct.accountId) {
      return json({ error: "Forbidden" }, 403);
    }

    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return methodNotAllowed();
}
