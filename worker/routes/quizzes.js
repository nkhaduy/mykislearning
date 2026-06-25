import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";

export async function handleQuizzes(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();

  const url = new URL(request.url);
  const path = url.pathname;
  const supabase = getSupabase(env);
  const acct = await requireAuth(request, env);
  if (!acct) return json({ error: "Unauthorized" }, 401);

  // ── /api/quizzes/attempts ─────────────────────────────────────────────────
  if (path === "/api/quizzes/attempts") {
    if (method === "GET") {
      const quizId = url.searchParams.get("quizId");
      const accountId = url.searchParams.get("accountId") || acct.accountId;
      if (acct.role !== "hr" && accountId !== acct.accountId) return json({ error: "Forbidden" }, 403);

      let query = supabase.from("quiz_attempts")
        .select("id, quiz_id, account_id, course_id, score_percent, passed, submitted_at, data, created_at, updated_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (quizId) query = query.eq("quiz_id", quizId);

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json((data || []).map((row) => ({ ...row.data, id: row.id, quizId: row.quiz_id, accountId: row.account_id, courseId: row.course_id, scorePercent: row.score_percent, passed: row.passed, submittedAt: row.submitted_at, createdAt: row.created_at })));
    }

    if (method === "POST") {
      const body = await readJson(request);
      const attempt = body;
      if (!attempt.quizId && !attempt.quiz_id) return json({ error: "quizId required" }, 400);

      const quizId = attempt.quizId || attempt.quiz_id;
      const row = {
        id: attempt.id || `attempt-${crypto.randomUUID()}`,
        quiz_id: quizId,
        account_id: attempt.accountId || attempt.account_id || acct.accountId,
        course_id: attempt.courseId || attempt.course_id || null,
        score_percent: attempt.scorePercent ?? attempt.score_percent ?? null,
        passed: attempt.passed ?? null,
        submitted_at: attempt.submittedAt || attempt.submitted_at || (attempt.scorePercent != null ? new Date().toISOString() : null),
        data: attempt,
        updated_at: new Date().toISOString(),
      };

      // Non-HR can only submit for themselves
      if (acct.role !== "hr" && row.account_id !== acct.accountId) {
        return json({ error: "Forbidden" }, 403);
      }

      const { error } = await supabase.from("quiz_attempts").upsert(row, { onConflict: "id" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, id: row.id });
    }

    return methodNotAllowed();
  }

  // ── /api/quizzes/:id/questions ─────────────────────────────────────────────
  const qMatch = path.match(/^\/api\/quizzes\/([^/]+)\/questions$/);
  if (qMatch) {
    const quizId = qMatch[1];

    if (method === "GET") {
      const { data, error } = await supabase
        .from("quiz_questions")
        .select("id, quiz_id, sort_order, data")
        .eq("quiz_id", quizId)
        .order("sort_order", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json((data || []).map((row) => ({ ...row.data, id: row.id, quizId: row.quiz_id, order: row.sort_order })));
    }

    if (method === "POST") {
      const hrAcct = await requireHr(request, env);
      if (!hrAcct) return json({ error: "HR only" }, 403);

      const body = await readJson(request);
      const questions = Array.isArray(body.questions) ? body.questions : [body];

      const rows = questions.map((q, idx) => ({
        id: q.id || `q-${crypto.randomUUID()}`,
        quiz_id: quizId,
        sort_order: q.order ?? q.sort_order ?? idx,
        data: q,
      }));

      const { error } = await supabase.from("quiz_questions").upsert(rows, { onConflict: "id" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, count: rows.length });
    }

    return methodNotAllowed();
  }

  // ── /api/quizzes ──────────────────────────────────────────────────────────
  if (method === "GET") {
    const courseId = url.searchParams.get("courseId");
    let query = supabase.from("quizzes")
      .select("id, course_id, status, data, created_by, created_at, updated_at");

    if (acct.role !== "hr") {
      query = query.eq("status", "published");
    }
    if (courseId) query = query.eq("course_id", courseId);
    query = query.order("updated_at", { ascending: false });

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    return json((data || []).map((row) => ({ ...row.data, id: row.id, courseId: row.course_id, status: row.status, createdAt: row.created_at })));
  }

  if (method === "POST") {
    const hrAcct = await requireHr(request, env);
    if (!hrAcct) return json({ error: "HR only" }, 403);

    const quiz = await readJson(request);
    if (!quiz?.id) return json({ error: "quiz.id required" }, 400);

    const row = {
      id: quiz.id,
      course_id: quiz.courseId || quiz.course_id || null,
      status: quiz.status || "draft",
      created_by: quiz.createdBy || hrAcct.accountId,
      data: quiz,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("quizzes").upsert(row, { onConflict: "id" });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, id: quiz.id });
  }

  if (method === "DELETE") {
    const hrAcct = await requireHr(request, env);
    if (!hrAcct) return json({ error: "HR only" }, 403);

    const body = await readJson(request);
    const id = url.searchParams.get("id") || body?.id;
    if (!id) return json({ error: "id required" }, 400);

    // Check for attempts
    const { data: attempts } = await supabase.from("quiz_attempts").select("id").eq("quiz_id", id).limit(1);
    if (attempts?.length) {
      const { error } = await supabase.from("quizzes").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, id, method: "archived" });
    }
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, id, method: "deleted" });
  }

  return methodNotAllowed();
}
