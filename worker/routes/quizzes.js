import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { hasAdministrativeAccess, requireAuth, requireHr } from "../middleware/auth.js";
import { requireCourseAccess } from "../services/course-access.js";
import { gradeQuizAttempt, sanitizeQuestionForLearner, sanitizeQuizForLearner } from "../services/quiz-security.js";
import { recalculateEnrollmentProgress } from "../services/learning-progress.js";
import { auditLater } from "../services/audit-service.js";

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
      if (!hasAdministrativeAccess(acct) && accountId !== acct.accountId) return json({ error: "Forbidden" }, 403);

      let query = supabase.from("quiz_attempts")
        .select("id, quiz_id, quiz_version_id, account_id, course_id, score_percent, passed, submitted_at, data, created_at, updated_at, version:quiz_versions(version_number,status)")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (quizId) query = query.eq("quiz_id", quizId);

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json((data || []).map((row) => ({ ...row.data, id: row.id, quizId: row.quiz_id, quizVersionId: row.quiz_version_id, quizVersion: row.version?.version_number ? `v${row.version.version_number}` : "", accountId: row.account_id, courseId: row.course_id, scorePercent: row.score_percent, passed: row.passed, submittedAt: row.submitted_at, createdAt: row.created_at })));
    }

    if (method === "POST") {
      const body = await readJson(request);
      const attempt = body?.attempt && typeof body.attempt === "object" ? body.attempt : body;
      if (!attempt.quizId && !attempt.quiz_id) return json({ error: "quizId required" }, 400);

      const quizId = attempt.quizId || attempt.quiz_id;
      const { data: quiz, error: quizError } = await supabase.from("quizzes")
        .select("id, course_id, status, data, current_version_id, max_attempts").eq("id", quizId).maybeSingle();
      if (quizError) return json({ error: "QUIZ_LOOKUP_FAILED" }, 503);
      if (!quiz) return json({ error: "QUIZ_NOT_FOUND" }, 404);
      const courseId = quiz.course_id || quiz.data?.courseId || quiz.data?.course_id || null;
      const requestedId = attempt.id ? String(attempt.id).slice(0, 180) : `attempt-${crypto.randomUUID()}`;
      const targetAccountId = hasAdministrativeAccess(acct)
        ? (attempt.accountId || attempt.account_id || acct.accountId)
        : acct.accountId;
      const { data: existingAttempt, error: existingError } = await supabase.from("quiz_attempts")
        .select("id, account_id, quiz_id, submitted_at, score_percent, passed, data").eq("id", requestedId).maybeSingle();
      if (existingError) return json({ error: "QUIZ_ATTEMPT_LOOKUP_FAILED" }, 503);
      if (existingAttempt) {
        if (existingAttempt.account_id !== targetAccountId || existingAttempt.quiz_id !== quizId) {
          return json({ error: "QUIZ_ATTEMPT_CONFLICT" }, 409);
        }
        if (existingAttempt.submitted_at) {
          return json({
            ok: true,
            id: existingAttempt.id,
            scorePercent: existingAttempt.score_percent,
            passed: existingAttempt.passed,
            gradingStatus: existingAttempt.data?.gradingStatus,
            idempotent: true,
          });
        }
      }
      if (!hasAdministrativeAccess(acct)) {
        if (quiz.status !== "published") return json({ error: "QUIZ_NOT_AVAILABLE" }, 404);
        const { enrollment } = await requireCourseAccess(supabase, acct, courseId);
        if (quiz.data?.requireCourseCompletion && enrollment.status !== "completed") {
          return json({ error: "QUIZ_COURSE_PREREQUISITE_NOT_MET" }, 409);
        }
        const prerequisiteQuizId = quiz.data?.prerequisiteQuizId || quiz.data?.prerequisite_quiz_id;
        if (prerequisiteQuizId) {
          const prerequisite = await supabase.from("quiz_attempts").select("id").eq("account_id", acct.accountId)
            .eq("quiz_id", prerequisiteQuizId).eq("passed", true).limit(1);
          if (prerequisite.error) return json({ error: "QUIZ_PREREQUISITE_LOOKUP_FAILED" }, 503);
          if (!prerequisite.data?.length) return json({ error: "QUIZ_PREREQUISITE_NOT_MET" }, 409);
        }
        const maxAttempts = Number(quiz.max_attempts ?? quiz.data?.maxAttempts ?? quiz.data?.max_attempts ?? quiz.data?.attemptsAllowed);
        if (Number.isFinite(maxAttempts) && maxAttempts > 0) {
          const submitted = await supabase.from("quiz_attempts").select("id").eq("account_id", acct.accountId)
            .eq("quiz_id", quizId).not("submitted_at", "is", null).limit(maxAttempts);
          if (submitted.error) return json({ error: "QUIZ_ATTEMPT_LIMIT_LOOKUP_FAILED" }, 503);
          if ((submitted.data || []).length >= maxAttempts) return json({ error: "QUIZ_ATTEMPT_LIMIT_REACHED" }, 409);
        }
      }

      const { data: questionRows, error: questionError } = await supabase.from("quiz_questions")
        .select("id, quiz_id, sort_order, data").eq("quiz_id", quizId).order("sort_order", { ascending: true });
      if (questionError) return json({ error: "QUIZ_QUESTIONS_LOOKUP_FAILED" }, 503);
      const questions = (questionRows || []).map((question) => ({ ...question.data, id: question.id }));
      if (!questions.length) return json({ error: "QUIZ_HAS_NO_QUESTIONS" }, 409);

      const grading = gradeQuizAttempt({
        questions,
        answers: attempt.answers,
        passingScore: quiz.data?.passingScore ?? quiz.data?.passing_score ?? 70,
      });
      const row = {
        id: requestedId,
        quiz_id: quizId,
        account_id: targetAccountId,
        course_id: courseId,
        quiz_version_id: quiz.current_version_id || null,
        score_percent: grading.scorePercent,
        passed: grading.passed,
        submitted_at: new Date().toISOString(),
        data: { ...attempt, ...grading, accountId: targetAccountId, courseId, quizId },
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("quiz_attempts").upsert(row, { onConflict: "id" });
      if (error) return json({ error: "QUIZ_ATTEMPT_SAVE_FAILED" }, 503);
      if (courseId && !hasAdministrativeAccess(acct)) await recalculateEnrollmentProgress(supabase, targetAccountId, courseId);
      auditLater(supabase, request, {
        actor: acct,
        action: "quiz.attempt_submitted",
        entityType: "quiz_attempt",
        entityId: row.id,
        metadata: { quiz_id: quizId, course_id: courseId, grading_status: grading.gradingStatus },
      });
      return json({ ok: true, id: row.id, scorePercent: grading.scorePercent, passed: grading.passed, gradingStatus: grading.gradingStatus });
    }

    return methodNotAllowed();
  }

  // ── /api/quizzes/:id/questions ─────────────────────────────────────────────
  const qMatch = path.match(/^\/api\/quizzes\/([^/]+)\/questions$/);
  if (qMatch) {
    const quizId = qMatch[1];

    if (method === "GET") {
      const { data: quiz, error: quizError } = await supabase.from("quizzes")
        .select("id, course_id, status, data").eq("id", quizId).maybeSingle();
      if (quizError) return json({ error: "QUIZ_LOOKUP_FAILED" }, 503);
      if (!quiz) return json({ error: "QUIZ_NOT_FOUND" }, 404);
      if (!hasAdministrativeAccess(acct)) {
        if (quiz.status !== "published") return json({ error: "QUIZ_NOT_AVAILABLE" }, 404);
        await requireCourseAccess(supabase, acct, quiz.course_id || quiz.data?.courseId || quiz.data?.course_id);
      }
      const { data, error } = await supabase
        .from("quiz_questions")
        .select("id, quiz_id, sort_order, data")
        .eq("quiz_id", quizId)
        .order("sort_order", { ascending: true });
      if (error) return json({ error: "QUIZ_QUESTIONS_LOOKUP_FAILED" }, 503);
      const questions = (data || []).map((row) => ({ ...row.data, id: row.id, quizId: row.quiz_id, order: row.sort_order }));
      return json(hasAdministrativeAccess(acct) ? questions : questions.map(sanitizeQuestionForLearner));
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

    if (!hasAdministrativeAccess(acct)) {
      query = query.eq("status", "published");
    }
    if (courseId) query = query.eq("course_id", courseId);
    query = query.order("updated_at", { ascending: false });

    const { data, error } = await query;
    if (error) return json({ error: "QUIZ_LIST_FAILED" }, 503);
    let visible = data || [];
    if (!hasAdministrativeAccess(acct)) {
      const enrollmentResult = await supabase.from("enrollments").select("course_id").eq("account_id", acct.accountId);
      if (enrollmentResult.error) return json({ error: "QUIZ_ACCESS_LOOKUP_FAILED" }, 503);
      const assigned = new Set((enrollmentResult.data || []).map((row) => row.course_id));
      visible = visible.filter((row) => assigned.has(row.course_id || row.data?.courseId || row.data?.course_id));
    }
    return json(visible.map((row) => {
      const quiz = { ...row.data, id: row.id, courseId: row.course_id, status: row.status, createdAt: row.created_at };
      return hasAdministrativeAccess(acct) ? quiz : sanitizeQuizForLearner(quiz);
    }));
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
    const { data: existingVersion } = await supabase.from("quiz_versions").select("id").eq("quiz_id", quiz.id).eq("version_number", 1).maybeSingle();
    if (!existingVersion) {
      const { data: createdVersion } = await supabase.from("quiz_versions").insert({
        quiz_id: quiz.id,
        version_number: 1,
        status: row.status === "published" ? "published" : "draft",
        title: quiz.title || quiz.name || quiz.id,
        instructions: quiz.instructions || "",
        passing_score: quiz.passingScore ?? quiz.passing_score ?? null,
        time_limit_minutes: quiz.timeLimitMinutes ?? quiz.time_limit_minutes ?? null,
        max_attempts: quiz.maxAttempts ?? quiz.max_attempts ?? null,
        configuration: quiz,
        source_data: quiz,
        change_type: "patch",
        change_summary: "Initial version",
        created_by: hrAcct.accountId,
        published_by: row.status === "published" ? hrAcct.accountId : null,
        published_at: row.status === "published" ? new Date().toISOString() : null,
      }).select("id").maybeSingle();
      if (createdVersion?.id) await supabase.from("quizzes").update({ current_version_id: createdVersion.id }).eq("id", quiz.id);
    }
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
