const HIDDEN_QUESTION_KEYS = new Set([
  "answer",
  "correctAnswer",
  "correct_answer",
  "correctOptionId",
  "correct_option_id",
  "correctOptionIds",
  "correct_option_ids",
  "explanation",
  "isCorrect",
  "is_correct",
]);

function cleanId(value) {
  return String(value ?? "").trim().slice(0, 180);
}

function cleanPoints(value) {
  const points = Number(value ?? 1);
  return Number.isFinite(points) && points > 0 ? Math.min(points, 1000) : 1;
}

function cleanAnswer(answer = {}) {
  const selectedOptionIds = Array.isArray(answer.selectedOptionIds || answer.selected_option_ids)
    ? [...new Set((answer.selectedOptionIds || answer.selected_option_ids).map(cleanId).filter(Boolean))].slice(0, 100)
    : [];
  return {
    questionId: cleanId(answer.questionId || answer.question_id),
    selectedOptionId: cleanId(answer.selectedOptionId || answer.selected_option_id),
    selectedOptionIds,
    textAnswer: typeof (answer.textAnswer ?? answer.text_answer) === "string"
      ? String(answer.textAnswer ?? answer.text_answer).trim().slice(0, 10000)
      : "",
  };
}

function questionType(question = {}) {
  const value = String(question.type || question.questionType || question.question_type || "").trim();
  if (["multipleChoice", "multiple_choice", "multiple"].includes(value)) return "multipleChoice";
  if (["text", "essay", "free_text"].includes(value)) return "text";
  return value || "singleChoice";
}

function expectedOptionIds(question = {}) {
  const explicit = question.correctOptionIds || question.correct_option_ids;
  if (Array.isArray(explicit)) return explicit.map(cleanId).filter(Boolean);
  if (Array.isArray(question.correctAnswer || question.correct_answer)) {
    return (question.correctAnswer || question.correct_answer).map(cleanId).filter(Boolean);
  }
  return (question.options || []).filter((option) => option?.isCorrect === true || option?.is_correct === true)
    .map((option) => cleanId(option.id || option.value)).filter(Boolean);
}

function expectedOptionId(question = {}) {
  const explicit = question.correctOptionId ?? question.correct_option_id ?? question.correctAnswer ?? question.correct_answer;
  if (explicit !== undefined && explicit !== null && !Array.isArray(explicit)) return cleanId(explicit);
  return expectedOptionIds(question)[0] || "";
}

export function sanitizeQuestionForLearner(question = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(question)) {
    if (HIDDEN_QUESTION_KEYS.has(key)) continue;
    if (key === "options" && Array.isArray(value)) {
      safe.options = value.map((option) => Object.fromEntries(
        Object.entries(option || {}).filter(([optionKey]) => !HIDDEN_QUESTION_KEYS.has(optionKey))
      ));
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

export function sanitizeQuizForLearner(quiz = {}) {
  const safe = sanitizeQuestionForLearner(quiz);
  if (Array.isArray(quiz.questions)) safe.questions = quiz.questions.map(sanitizeQuestionForLearner);
  return safe;
}

export function gradeQuizAttempt({ questions = [], answers = [], passingScore = 70 } = {}) {
  const safeAnswers = Array.isArray(answers) ? answers.map(cleanAnswer).filter((answer) => answer.questionId) : [];
  const answerMap = new Map(safeAnswers.map((answer) => [answer.questionId, answer]));
  let correctCount = 0;
  let earnedPoints = 0;
  let totalPoints = 0;
  let pendingManual = false;

  const gradedAnswers = questions.map((question) => {
    const id = cleanId(question.id || question.questionId || question.question_id || question.questionKey || question.question_key);
    const points = cleanPoints(question.points);
    const answer = answerMap.get(id) || { questionId: id, selectedOptionId: "", selectedOptionIds: [], textAnswer: "" };
    totalPoints += points;
    if (questionType(question) === "text") {
      pendingManual = true;
      return { ...answer, isCorrect: null, awardedPoints: null };
    }

    let correct;
    if (questionType(question) === "multipleChoice") {
      const selected = [...answer.selectedOptionIds].sort();
      const expected = [...expectedOptionIds(question)].sort();
      correct = selected.length === expected.length && selected.every((value, index) => value === expected[index]);
    } else {
      correct = answer.selectedOptionId === expectedOptionId(question);
    }
    if (correct) {
      correctCount += 1;
      earnedPoints += points;
    }
    return { ...answer, isCorrect: correct, awardedPoints: correct ? points : 0 };
  });

  const scorePercent = totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const threshold = Math.max(0, Math.min(100, Number(passingScore) || 70));
  return {
    answers: gradedAnswers,
    correctCount,
    totalQuestions: questions.length,
    earnedPoints,
    totalPoints,
    scorePercent,
    passed: pendingManual ? null : scorePercent >= threshold,
    gradingStatus: pendingManual ? "pendingManual" : "graded",
  };
}
