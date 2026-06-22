/**
 * GET    /api/courses/content?courseId=   → list content items for course
 * POST   /api/courses/content             → upsert content items (HR only)
 * DELETE /api/courses/content?id=         → delete one content item (HR only)
 *
 * For uploaded files, data object must include:
 *   { storageBucket, storagePath, mimeType, fileName }
 * sourceUrl must NOT be stored as empty string — omit it entirely if file not uploaded.
 * Employee fetching content receives a signed URL for uploaded files (valid 1h).
 */
import { createClient } from "@supabase/supabase-js";
import { cors, requireAuth, requireHr } from "./_auth.js";

const STORAGE_BUCKET = "course-content";
const SIGNED_URL_EXPIRES = 3600; // 1 hour

function db() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function attachSignedUrls(supabase, items) {
  return Promise.all(
    items.map(async (item) => {
      if (item.sourceType !== "uploaded" || !item.storagePath) return item;
      const { data, error } = await supabase.storage
        .from(item.storageBucket || STORAGE_BUCKET)
        .createSignedUrl(item.storagePath, SIGNED_URL_EXPIRES);
      if (error || !data?.signedUrl) return { ...item, sourceUrl: null, signedUrlError: error?.message };
      return { ...item, sourceUrl: data.signedUrl };
    })
  );
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const supabase = db();
  const { searchParams } = new URL(req.url, `https://${req.headers.host}`);

  // ── GET: list content for a course ─────────────────────────────────────────
  if (req.method === "GET") {
    const acct = requireAuth(req, res);
    if (!acct) return;

    const courseId = searchParams.get("courseId");
    if (!courseId) return res.status(400).json({ error: "courseId required" });

    const { data, error } = await supabase
      .from("course_content")
      .select("id, course_id, type, sort_order, data")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    // Map to camelCase and attach signed URLs for uploaded files
    const items = (data || []).map((row) => ({
      ...row.data,
      id: row.id,
      courseId: row.course_id,
      type: row.type,
      order: row.sort_order,
    }));

    const withUrls = await attachSignedUrls(supabase, items);
    return res.json(withUrls);
  }

  // ── POST: upsert content items ──────────────────────────────────────────────
  if (req.method === "POST") {
    const acct = requireHr(req, res);
    if (!acct) return;

    const { courseId, items } = req.body;
    if (!courseId || !Array.isArray(items)) {
      return res.status(400).json({ error: "courseId and items[] required" });
    }

    // Validate: uploaded video must have storagePath (never empty sourceUrl)
    for (const item of items) {
      if (item.type === "video" && item.sourceType === "uploaded" && !item.storagePath) {
        return res.status(400).json({
          error: `Content "${item.title}" is uploaded type but missing storagePath. Upload file first.`,
          code: "missing_storage_path",
        });
      }
    }

    const rows = items.map((item, idx) => ({
      id: item.id || `content-${Date.now()}-${idx}`,
      course_id: courseId,
      type: item.type || "slide",
      sort_order: item.order ?? item.sort_order ?? idx,
      // Strip sourceUrl from stored data to avoid empty strings
      data: (() => {
        const d = { ...item, courseId };
        if (d.sourceType === "uploaded") delete d.sourceUrl; // use storagePath instead
        return d;
      })(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("course_content").upsert(rows, { onConflict: "id" });
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ ok: true, count: rows.length });
  }

  // ── DELETE: remove one content item ────────────────────────────────────────
  if (req.method === "DELETE") {
    const acct = requireHr(req, res);
    if (!acct) return;

    const id = searchParams.get("id") || req.body?.id;
    if (!id) return res.status(400).json({ error: "id required" });

    const { error } = await supabase.from("course_content").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
