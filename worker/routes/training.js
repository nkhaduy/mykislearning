import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";

export async function handleTraining(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const url = new URL(request.url);
  const path = url.pathname;
  const supabase = getSupabase(env);

  // ── /api/training/sessions ──────────────────────────────────────────────────
  if (path === "/api/training/sessions") {
    if (method === "GET") {
      const acct = requireAuth(request);
      if (!acct) return json({ error: "Unauthorized" }, 401);

      let query = supabase.from("training_sessions").select("*").order("start_at", { ascending: true });
      if (acct.role !== "hr") {
        const { data: parts } = await supabase.from("training_participants")
          .select("session_id").eq("account_id", acct.accountId);
        const ids = (parts || []).map((p) => p.session_id);
        if (!ids.length) return json([]);
        query = query.in("id", ids).not("status", "in", '("cancelled","draft")');
      }
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json((data || []).map((row) => ({ ...row.data, id: row.id, status: row.status })));
    }

    if (method === "POST") {
      const acct = requireHr(request);
      if (!acct) return json({ error: "HR only" }, 403);
      const session = await readJson(request);
      if (!session?.id) return json({ error: "session.id required" }, 400);
      const row = {
        id: session.id, course_id: session.courseId || "",
        status: session.status || "scheduled",
        start_at: session.startAt, end_at: session.endAt,
        created_by: session.createdBy || acct.accountId,
        data: session, updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("training_sessions").upsert(row, { onConflict: "id" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (method === "DELETE") {
      const acct = requireHr(request);
      if (!acct) return json({ error: "HR only" }, 403);
      const body = await readJson(request);
      const { id } = body;
      if (!id) return json({ error: "id required" }, 400);
      await supabase.from("training_participants").delete().eq("session_id", id);
      const { error } = await supabase.from("training_sessions").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return methodNotAllowed();
  }

  // ── /api/training/participants ──────────────────────────────────────────────
  if (path === "/api/training/participants") {
    if (method === "GET") {
      const acct = requireAuth(request);
      if (!acct) return json({ error: "Unauthorized" }, 401);
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) return json({ error: "sessionId required" }, 400);
      const { data, error } = await supabase.from("training_participants")
        .select("*").eq("session_id", sessionId).order("id", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json((data || []).map((row) => ({ ...row.data, id: row.id })));
    }

    if (method === "POST") {
      const acct = requireHr(request);
      if (!acct) return json({ error: "HR only" }, 403);
      const body = await readJson(request);
      const sessionId = body?.session_id || body?.sessionId;
      const participants = body?.participants;
      const mode = body?.mode === "replace" ? "replace" : "merge";
      if (!sessionId || !Array.isArray(participants)) return json({ error: "session_id and participants[] required" }, 400);

      const normalizedByAccount = new Map(participants.map((p) => {
        const accountId = String(p.account_id || p.accountId || "").trim();
        return [accountId, {
          id: String(p.id || crypto.randomUUID()),
          sessionId: String(p.session_id || p.sessionId || sessionId),
          accountId, role: String(p.role || "learner"),
          status: String(p.status || "assigned"),
          createdAt: String(p.created_at || p.createdAt || new Date().toISOString()),
          source: String(p.source || "manual"),
          addedBy: String(p.added_by || p.addedBy || acct.accountId),
        }];
      }));
      const normalized = [...normalizedByAccount.values()];
      if (normalized.some((p) => !p.accountId || p.sessionId !== String(sessionId))) {
        return json({ error: "Each participant requires matching session_id and account_id" }, 400);
      }

      const rows = normalized.map((p) => ({ id: p.id, session_id: sessionId, account_id: p.accountId, data: p }));
      if (rows.length) {
        const { error } = await supabase.from("training_participants").upsert(rows, { onConflict: "session_id,account_id" });
        if (error) return json({ error: error.message, code: error.code || "participant_upsert_failed" }, 500);
      }

      if (mode === "replace") {
        const desiredIds = new Set(normalized.map((p) => p.accountId));
        const { data: existing, error: existingError } = await supabase.from("training_participants").select("account_id").eq("session_id", sessionId);
        if (existingError) return json({ error: existingError.message, code: "participant_cleanup_read_failed" }, 500);
        const staleIds = (existing || []).map((r) => r.account_id).filter((id) => !desiredIds.has(id));
        if (staleIds.length) {
          const { error: deleteError } = await supabase.from("training_participants").delete().eq("session_id", sessionId).in("account_id", staleIds);
          if (deleteError) return json({ error: deleteError.message, code: "participant_cleanup_failed" }, 500);
        }
      }

      const { data: saved, error: verifyError } = await supabase.from("training_participants")
        .select("id, session_id, account_id, data").eq("session_id", sessionId);
      if (verifyError) return json({ error: verifyError.message, code: "participant_verify_failed" }, 500);
      return json({ ok: true, participants: saved || [], count: saved?.length || 0 });
    }

    if (method === "DELETE") {
      const acct = requireHr(request);
      if (!acct) return json({ error: "HR only" }, 403);
      const body = await readJson(request);
      const { sessionId, accountId } = body;
      if (!sessionId || !accountId) return json({ error: "sessionId and accountId required" }, 400);
      const { error } = await supabase.from("training_participants").delete()
        .eq("session_id", sessionId).eq("account_id", accountId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }
    return methodNotAllowed();
  }

  // ── /api/training/calendar ──────────────────────────────────────────────────
  if (path === "/api/training/calendar") {
    if (method !== "GET") return methodNotAllowed();
    const acct = requireAuth(request);
    if (!acct) return json({ error: "Unauthorized" }, 401);
    const { accountId } = acct;

    const { data: parts, error: partErr } = await supabase.from("training_participants")
      .select("session_id").eq("account_id", accountId);
    if (partErr) return json({ error: partErr.message }, 500);

    const sessionIds = (parts || []).map((p) => p.session_id);
    if (!sessionIds.length) return json({ sessions: [], registrations: [], participants: [] });

    const { data: sessions, error: sessErr } = await supabase.from("training_sessions")
      .select("id, status, data").in("id", sessionIds).not("status", "in", '("draft")');
    if (sessErr) return json({ error: sessErr.message }, 500);

    const { data: regs, error: regErr } = await supabase.from("training_registrations")
      .select("session_id, data").in("session_id", sessionIds).eq("account_id", accountId);
    if (regErr) return json({ error: regErr.message }, 500);

    return json({
      sessions: (sessions || []).map((row) => ({ ...row.data, id: row.id, status: row.status })),
      registrations: (regs || []).map((row) => ({ ...row.data, sessionId: row.session_id })),
      participants: (parts || []).map((p) => ({ sessionId: p.session_id, accountId })),
    });
  }

  // ── /api/training/registrations ─────────────────────────────────────────────
  if (path === "/api/training/registrations") {
    const acct = requireAuth(request);
    if (!acct) return json({ error: "Unauthorized" }, 401);

    if (method === "GET") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) return json({ error: "sessionId required" }, 400);
      const { data, error } = await supabase.from("training_registrations")
        .select("*").eq("session_id", sessionId);
      if (error) return json({ error: error.message }, 500);
      return json((data || []).map((row) => ({ ...row.data, id: row.id })));
    }

    if (method === "POST") {
      const body = await readJson(request);
      const { registrations } = body;
      if (!Array.isArray(registrations)) return json({ error: "registrations[] required" }, 400);
      if (!registrations.length) return json({ ok: true });
      const rows = registrations.map((r) => ({
        id: r.id, session_id: r.sessionId, account_id: r.accountId,
        data: r, updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("training_registrations").upsert(rows, { onConflict: "session_id,account_id" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (method === "PATCH") {
      const body = await readJson(request);
      const { sessionId, accountId, patch } = body;
      if (!sessionId || !accountId || !patch) return json({ error: "sessionId, accountId, patch required" }, 400);
      const { data: existing } = await supabase.from("training_registrations")
        .select("data").eq("session_id", sessionId).eq("account_id", accountId).single();
      const merged = { ...(existing?.data || {}), ...patch };
      const { error } = await supabase.from("training_registrations").upsert({
        id: merged.id || crypto.randomUUID(),
        session_id: sessionId, account_id: accountId,
        data: merged, updated_at: new Date().toISOString(),
      }, { onConflict: "session_id,account_id" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, registration: merged });
    }
    return methodNotAllowed();
  }

  return json({ error: "NOT_FOUND" }, 404);
}
