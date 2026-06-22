/**
 * GET  /api/courses          → list courses (HR: all, Employee: enrolled only)
 * POST /api/courses          → upsert course (HR only)
 * DELETE /api/courses?id=    → delete course (HR only)
 */
import { createClient } from "@supabase/supabase-js";
import { cors, requireAuth, requireHr } from "./_auth.js";

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const supabase = db();

  // ── GET: list courses ───────────────────────────────────────────────────────
  if (req.method === "GET") {
    const acct = requireAuth(req, res);
    if (!acct) return;

    if (acct.role === "hr") {
      // HR sees all courses
      const { data, error } = await supabase
        .from("courses")
        .select("id, status, delivery_mode, data, updated_at")
        .order("updated_at", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.json((data || []).map((row) => ({ ...row.data, id: row.id, status: row.status, deliveryMode: row.delivery_mode })));
    } else {
      // Employee sees only enrolled courses
      const { data: enrs, error: enrErr } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("account_id", acct.accountId);
      if (enrErr) return res.status(500).json({ error: enrErr.message });
      const ids = (enrs || []).map((e) => e.course_id);
      if (!ids.length) return res.json([]);

      const { data, error } = await supabase
        .from("courses")
        .select("id, status, delivery_mode, data")
        .in("id", ids)
        .eq("status", "published");
      if (error) return res.status(500).json({ error: error.message });
      return res.json((data || []).map((row) => ({ ...row.data, id: row.id, status: row.status, deliveryMode: row.delivery_mode })));
    }
  }

  // ── POST: upsert course ─────────────────────────────────────────────────────
  if (req.method === "POST") {
    const acct = requireHr(req, res);
    if (!acct) return;

    const course = req.body;
    if (!course?.id) return res.status(400).json({ error: "course.id required" });

    const row = {
      id: course.id,
      status: course.status || "draft",
      delivery_mode: course.deliveryMode || course.delivery_mode || "online",
      created_by: course.createdBy || acct.accountId,
      data: course,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("courses").upsert(row, { onConflict: "id" });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, id: course.id });
  }

  // ── DELETE: remove course ───────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const acct = requireHr(req, res);
    if (!acct) return;

    const id = req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ error: "id required" });

    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
