export function calculateEnrollmentProgress({ content = [], progress = [], attempts = [] } = {}) {
  const progressMap = new Map(progress.map((row) => [row.content_id, row.data || {}]));
  const requiredContent = content.filter((row) => row.data?.required !== false);
  let totalWeight = 0;
  let completedWeight = 0;
  for (const item of requiredContent) {
    const weight = Math.max(0, Number(item.data?.completionWeight || 1) || 1);
    totalWeight += weight;
    let completed = progressMap.get(item.id)?.completed === true;
    if (item.type === "quiz") {
      const quizId = item.data?.quizId || item.data?.quiz_id;
      const requirePass = item.data?.completionRule?.requirePass !== false;
      completed = attempts.some((attempt) => attempt.quiz_id === quizId && attempt.submitted_at
        && (requirePass ? attempt.passed === true : attempt.data?.gradingStatus !== "pendingManual"));
    }
    if (completed) completedWeight += weight;
  }

  const progressPercent = totalWeight ? Math.round((completedWeight / totalWeight) * 100) : 0;
  return {
    progressPercent,
    completed: totalWeight > 0 && completedWeight === totalWeight,
  };
}

export async function recalculateEnrollmentProgress(supabase, accountId, courseId) {
  const [contentResult, progressResult, attemptsResult, enrollmentResult] = await Promise.all([
    supabase.from("course_content").select("id, type, data").eq("course_id", courseId).order("sort_order", { ascending: true }),
    supabase.from("content_progress").select("content_id, data").eq("course_id", courseId).eq("account_id", accountId),
    supabase.from("quiz_attempts").select("quiz_id, passed, submitted_at, data").eq("course_id", courseId).eq("account_id", accountId),
    supabase.from("enrollments").select("id, status, data").eq("course_id", courseId).eq("account_id", accountId).maybeSingle(),
  ]);
  if (contentResult.error || progressResult.error || attemptsResult.error || enrollmentResult.error || !enrollmentResult.data) {
    throw Object.assign(new Error("ENROLLMENT_PROGRESS_LOOKUP_FAILED"), { code: "ENROLLMENT_PROGRESS_LOOKUP_FAILED", status: 503 });
  }

  const { progressPercent, completed } = calculateEnrollmentProgress({
    content: contentResult.data || [],
    progress: progressResult.data || [],
    attempts: attemptsResult.data || [],
  });
  const now = new Date().toISOString();
  const prior = enrollmentResult.data;
  const data = {
    ...(prior.data || {}),
    progressPercent,
    completedAt: completed ? (prior.data?.completedAt || now) : null,
  };
  const update = await supabase.from("enrollments").update({
    data,
    status: completed ? "completed" : progressPercent > 0 ? "inProgress" : "notStarted",
    updated_at: now,
  }).eq("id", prior.id);
  if (update.error) throw Object.assign(new Error("ENROLLMENT_PROGRESS_SAVE_FAILED"), { code: "ENROLLMENT_PROGRESS_SAVE_FAILED", status: 503 });
  return progressPercent;
}
