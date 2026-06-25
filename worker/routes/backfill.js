import { json, readJson, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireHr } from "../middleware/auth.js";

export async function handleBackfill(request, env) {
  if (request.method.toUpperCase() === "OPTIONS") return corsPreflight();
  if (request.method.toUpperCase() !== "POST") return json({ error: "POST only" }, 405);
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR only" }, 403);

  const supabase = getSupabase(env);
  const body = await readJson(request);
  const report = {};

  // Upsert profiles
  if (Array.isArray(body.profiles) && body.profiles.length) {
    const rows = body.profiles.map(p => ({
      id: p.id, full_name: p.fullName || p.full_name || "", email: p.email || "",
      role: p.role || "employee", department: p.department || null, position: p.position || null,
      account_status: p.accountStatus || p.account_status || "active",
      employee_code: p.employeeCode || p.employee_code || null,
      phone: p.phone || null, joined_date: p.joinDate || p.joined_date || null,
      notes: p.notes || null, updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("profiles").upsert(rows, { onConflict: "id", ignoreDuplicates: false });
    report.profiles = error ? { error: error.message } : { upserted: rows.length };
  }

  // Upsert courses
  if (Array.isArray(body.courses) && body.courses.length) {
    const rows = body.courses.map(c => ({
      id: c.id, title: c.title || "", status: c.status || "draft",
      category: c.category || null, format: c.format || null,
      description: c.description || null, data: c, updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("courses").upsert(rows, { onConflict: "id" });
    report.courses = error ? { error: error.message } : { upserted: rows.length };
  }

  // Upsert training_sessions
  if (Array.isArray(body.sessions) && body.sessions.length) {
    const rows = body.sessions.map(s => ({
      id: s.id, course_id: s.courseId || "", status: s.status || "scheduled",
      start_at: s.startAt, end_at: s.endAt, created_by: s.createdBy || acct.accountId,
      data: s, updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("training_sessions").upsert(rows, { onConflict: "id" });
    report.sessions = error ? { error: error.message } : { upserted: rows.length };
  }

  // Upsert training_participants
  if (Array.isArray(body.participants) && body.participants.length) {
    const rows = body.participants.map(p => ({
      id: p.id || crypto.randomUUID(), session_id: p.sessionId, account_id: p.accountId,
      data: p,
    }));
    const { error } = await supabase.from("training_participants").upsert(rows, { onConflict: "session_id,account_id" });
    report.participants = error ? { error: error.message } : { upserted: rows.length };
  }

  // Upsert enrollments
  if (Array.isArray(body.enrollments) && body.enrollments.length) {
    const rows = body.enrollments.map(e => ({
      id: e.id, account_id: e.accountId || e.account_id, course_id: e.courseId || e.course_id,
      status: e.status || "notStarted", assigned_by: e.assignedBy || acct.accountId,
      assigned_at: e.assignedAt || new Date().toISOString(),
      deadline: e.deadline || null, updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("enrollments").upsert(rows, { onConflict: "id" });
    report.enrollments = error ? { error: error.message } : { upserted: rows.length };
  }

  return json({ ok: true, report });
}
