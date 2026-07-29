import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gradeQuizAttempt, sanitizeQuestionForLearner, sanitizeQuizForLearner } from "../../worker/services/quiz-security.js";
import { calculateEnrollmentProgress } from "../../worker/services/learning-progress.js";

test("SEC-QUIZ-001: learner quiz payloads never expose answer keys", () => {
  const question = {
    id: "q1",
    type: "singleChoice",
    correctOptionId: "b",
    correctAnswer: "b",
    explanation: "answer rationale",
    options: [{ id: "a", text: "A" }, { id: "b", text: "B", isCorrect: true }],
  };
  const sanitized = sanitizeQuestionForLearner(question);
  assert.equal(sanitized.correctOptionId, undefined);
  assert.equal(sanitized.correctAnswer, undefined);
  assert.equal(sanitized.explanation, undefined);
  assert.equal(sanitized.options[1].isCorrect, undefined);
  assert.equal(sanitizeQuizForLearner({ questions: [question] }).questions[0].correctOptionId, undefined);
});

test("SEC-QUIZ-002: server grading ignores forged client score and pass fields", () => {
  const result = gradeQuizAttempt({
    questions: [
      { id: "single", type: "singleChoice", correctOptionId: "b", points: 2 },
      { id: "multi", type: "multipleChoice", correctOptionIds: ["x", "z"], points: 3 },
    ],
    answers: [
      { questionId: "single", selectedOptionId: "a", scorePercent: 100, passed: true },
      { questionId: "multi", selectedOptionIds: ["z", "x"] },
    ],
    passingScore: 70,
  });
  assert.equal(result.scorePercent, 60);
  assert.equal(result.passed, false);
  assert.equal(result.correctCount, 1);
});

test("SEC-QUIZ-003: essay questions remain pending manual grading", () => {
  const result = gradeQuizAttempt({
    questions: [{ id: "essay", type: "text", points: 5 }],
    answers: [{ questionId: "essay", textAnswer: "  response  " }],
  });
  assert.equal(result.passed, null);
  assert.equal(result.gradingStatus, "pendingManual");
  assert.equal(result.answers[0].textAnswer, "response");
});

test("SEC-IDOR-001: protected learning routes share explicit course and owner checks", async () => {
  const [courses, progress, enrollments, quizzes] = await Promise.all([
    readFile(new URL("../../worker/routes/courses.js", import.meta.url), "utf8"),
    readFile(new URL("../../worker/routes/content-progress.js", import.meta.url), "utf8"),
    readFile(new URL("../../worker/routes/enrollments.js", import.meta.url), "utf8"),
    readFile(new URL("../../worker/routes/quizzes.js", import.meta.url), "utf8"),
  ]);
  assert.match(courses, /requireCourseAccess\(supabase, acct, courseId\)/);
  assert.match(progress, /requireCourseAccess\(supabase, acct, progress\.courseId\)/);
  assert.match(enrollments, /query = query\.eq\("account_id", acct\.accountId\)/);
  assert.match(quizzes, /score_percent: grading\.scorePercent/);
  assert.doesNotMatch(quizzes, /score_percent: attempt\.scorePercent/);
  assert.match(quizzes, /QUIZ_ATTEMPT_LIMIT_REACHED/);
  assert.match(quizzes, /QUIZ_PREREQUISITE_NOT_MET/);
});

test("DATA-PROGRESS-001: enrollment progress is derived from required content and graded quizzes", () => {
  const result = calculateEnrollmentProgress({
    content: [
      { id: "lesson", type: "video", data: { required: true, completionWeight: 1 } },
      { id: "quiz-content", type: "quiz", data: { required: true, completionWeight: 3, quizId: "quiz-a", completionRule: { requirePass: true } } },
      { id: "optional", type: "slide", data: { required: false, completionWeight: 20 } },
    ],
    progress: [{ content_id: "lesson", data: { completed: true } }],
    attempts: [{ quiz_id: "quiz-a", submitted_at: "2026-07-30T00:00:00Z", passed: true, data: { gradingStatus: "graded" } }],
  });
  assert.deepEqual(result, { progressPercent: 100, completed: true });
});

test("DATA-PROGRESS-002: pending manual grading cannot complete a quiz", () => {
  const result = calculateEnrollmentProgress({
    content: [{ id: "quiz-content", type: "quiz", data: { quizId: "quiz-a", completionRule: { requirePass: false } } }],
    attempts: [{ quiz_id: "quiz-a", submitted_at: "2026-07-30T00:00:00Z", passed: null, data: { gradingStatus: "pendingManual" } }],
  });
  assert.deepEqual(result, { progressPercent: 0, completed: false });
});

test("OPS-HEALTH-001: Worker exposes explicit liveness routes and analytics CSP", async () => {
  const [indexSource, responseSource] = await Promise.all([
    readFile(new URL("../../worker/index.js", import.meta.url), "utf8"),
    readFile(new URL("../../worker/services/responses.js", import.meta.url), "utf8"),
  ]);
  assert.match(indexSource, /url\.pathname === "\/health" \|\| url\.pathname === "\/api\/health"/);
  assert.match(responseSource, /https:\/\/static\.cloudflareinsights\.com/);
  assert.match(responseSource, /https:\/\/cloudflareinsights\.com/);
});
