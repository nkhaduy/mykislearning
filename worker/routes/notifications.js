import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";

export async function handleNotifications(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const url = new URL(request.url);
  const supabase = getSupabase(env);
  const acct = await requireAuth(request, env);
  if (!acct) return json({ error: "Unauthorized" }, 401);

  // GET /api/notifications — list for current user (or all for HR)
  if (method === "GET") {
    const accountId = url.searchParams.get("accountId") || acct.accountId;
    // Non-HR can only read their own
    if (acct.role !== "hr" && accountId !== acct.accountId) {
      return json({ error: "Forbidden" }, 403);
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("id, account_id, type, title, body, link, is_read, created_by, expires_at, data, created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return json({ error: error.message }, 500);

    const now = new Date().toISOString();
    const rows = (data || [])
      .filter((n) => !n.expires_at || n.expires_at >= now)
      .map((n) => ({
        id: n.id,
        accountId: n.account_id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link || n.data?.actionUrl || "",
        isRead: n.is_read,
        createdBy: n.created_by,
        createdAt: n.created_at,
        expiresAt: n.expires_at,
      }));

    return json(rows);
  }

  // POST /api/notifications — HR creates notification(s)
  if (method === "POST") {
    const body = await readJson(request);

    // Bulk mode: { notifications: [...] }
    const items = Array.isArray(body.notifications)
      ? body.notifications
      : [body];

    if (!items.length) return json({ error: "No notifications provided" }, 400);

    // Allow employee to create their own system notifications (e.g. QR check-in)
    // HR can create for anyone
    const rows = items.map((n) => {
      if (acct.role !== "hr" && n.account_id !== acct.accountId) {
        throw new Error(`Employee cannot create notification for other users`);
      }
      return {
        id: n.id || `notif-${crypto.randomUUID()}`,
        account_id: n.account_id || acct.accountId,
        type: n.type || "info",
        title: String(n.title || "").trim(),
        body: n.body || null,
        link: n.link || null,
        is_read: n.is_read || false,
        created_by: n.created_by || acct.accountId,
        expires_at: n.expires_at || null,
        data: n.data || {},
        created_at: n.created_at || new Date().toISOString(),
      };
    });

    const { error } = await supabase.from("notifications").upsert(rows, { onConflict: "id" });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, count: rows.length });
  }

  // PATCH /api/notifications — mark read / mark all read
  if (method === "PATCH") {
    const body = await readJson(request);
    const { id, markAllRead, accountId: targetAccountId } = body;

    if (markAllRead) {
      const targetId = (acct.role === "hr" && targetAccountId) ? targetAccountId : acct.accountId;
      const { error } = await supabase.from("notifications")
        .update({ is_read: true })
        .eq("account_id", targetId)
        .eq("is_read", false);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (!id) return json({ error: "id or markAllRead required" }, 400);

    // Verify ownership before marking
    const { data: existing } = await supabase.from("notifications")
      .select("account_id").eq("id", id).single();
    if (!existing) return json({ error: "Not found" }, 404);
    if (acct.role !== "hr" && existing.account_id !== acct.accountId) {
      return json({ error: "Forbidden" }, 403);
    }

    const { error } = await supabase.from("notifications")
      .update({ is_read: true }).eq("id", id);
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
