import { json, readJson, methodNotAllowed, corsPreflight, notFound } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireHr } from "../middleware/auth.js";
import { writeAuditLog } from "../services/audit-service.js";

const STEPS = new Set(["pretest", "posttest", "evaluation"]);
const STEP_LABEL = { pretest: "Pre-test", posttest: "Post-test", evaluation: "Đánh giá" };

function base64Url(bytes) {
  let value = "";
  for (const b of bytes) value += String.fromCharCode(b);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return base64Url(new Uint8Array(hash));
}

function nowIso() {
  return new Date().toISOString();
}

function cleanName(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

function normalizeName(value = "") {
  return cleanName(value).normalize("NFKC").toLocaleLowerCase("vi-VN");
}

function isHttpsUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(String(value));
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function assertUrl(value, field) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (trimmed.length > 2048 || !isHttpsUrl(trimmed)) {
    throw Object.assign(new Error(`${field} must be a valid HTTPS URL`), { status: 400, code: "INVALID_URL" });
  }
  return trimmed;
}

function publicLink(request, accessToken) {
  const url = new URL(request.url);
  return `${url.origin}/join/${accessToken}`;
}

function isExpired(flow) {
  return Boolean(flow?.expires_at && new Date(flow.expires_at).getTime() <= Date.now());
}

function flowAvailable(flow, { allowDraft = false } = {}) {
  if (!flow) return { ok: false, code: "NOT_FOUND", status: 404 };
  if (flow.status === "closed") return { ok: false, code: "FLOW_CLOSED", status: 403 };
  if (!allowDraft && flow.status !== "live") return { ok: false, code: "FLOW_NOT_LIVE", status: 403 };
  if (isExpired(flow)) return { ok: false, code: "FLOW_EXPIRED", status: 410 };
  return { ok: true };
}

function flowPublic(flow) {
  const available = flowAvailable(flow);
  return {
    id: flow.id,
    title: flow.title,
    description: flow.description,
    status: flow.status,
    closed: flow.status === "closed",
    expired: isExpired(flow),
    available: available.ok,
    error: available.ok ? null : available.code,
  };
}

function participantPublic(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    pretestStartedAt: row.pretest_started_at,
    pretestCompletedAt: row.pretest_completed_at,
    posttestStartedAt: row.posttest_started_at,
    posttestCompletedAt: row.posttest_completed_at,
    evaluationStartedAt: row.evaluation_started_at,
    evaluationCompletedAt: row.evaluation_completed_at,
    completedAt: row.completed_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  };
}

function completionEligible(flow, p) {
  return flow.completion_state === "open"
    && (!flow.pretest_required || p.pretest_completed_at)
    && (!flow.posttest_required || p.posttest_completed_at)
    && (!flow.evaluation_required || p.evaluation_completed_at)
    && !p.completed_at
    && flowAvailable(flow).ok;
}

function statePayload(flow, participant = null) {
  const payload = {
    flow: flowPublic(flow),
    steps: {
      pretest: { state: flow.pretest_state, required: flow.pretest_required, url: flow.pretest_state === "open" ? flow.pretest_url : null },
      posttest: { state: flow.posttest_state, required: flow.posttest_required, url: flow.posttest_state === "open" ? flow.posttest_url : null },
      evaluation: { state: flow.evaluation_state, required: flow.evaluation_required, url: flow.evaluation_state === "open" ? flow.evaluation_url : null },
      completion: { state: flow.completion_state },
    },
    participant: participant ? participantPublic(participant) : null,
    completionEligible: participant ? completionEligible(flow, participant) : false,
    note: "Trạng thái hoàn thành do người tham gia tự xác nhận. Kết quả Quizizz và Google Forms chưa được đồng bộ tự động.",
  };
  return payload;
}

async function getFlowByToken(supabase, accessToken) {
  const { data, error } = await supabase.from("public_training_flows").select("*").eq("access_token", accessToken).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

async function getFlowById(supabase, id) {
  const { data, error } = await supabase.from("public_training_flows").select("*").eq("id", id).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

async function requireParticipant(supabase, request, flow) {
  const header = request.headers.get("Authorization") || "";
  const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!raw) throw Object.assign(new Error("PARTICIPANT_TOKEN_REQUIRED"), { status: 401, code: "UNAUTHORIZED" });
  const tokenHash = await sha256(raw);
  const { data, error } = await supabase.from("public_training_participants")
    .select("*").eq("flow_id", flow.id).eq("participant_token_hash", tokenHash).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!data) throw Object.assign(new Error("INVALID_PARTICIPANT_TOKEN"), { status: 401, code: "UNAUTHORIZED" });
  return data;
}

function assertCanStart(flow, p, step) {
  if (!STEPS.has(step)) throw Object.assign(new Error("INVALID_STEP"), { status: 404 });
  if (flow[`${step}_state`] !== "open") throw Object.assign(new Error("STEP_CLOSED"), { status: 409, code: "STEP_CLOSED" });
  if (!flow[`${step}_url`]) throw Object.assign(new Error("STEP_URL_MISSING"), { status: 409, code: "STEP_URL_MISSING" });
  if (step === "posttest" && flow.pretest_required && !p.pretest_completed_at) throw Object.assign(new Error("PRETEST_REQUIRED"), { status: 409 });
  if (step === "evaluation" && flow.posttest_required && !p.posttest_completed_at) throw Object.assign(new Error("POSTTEST_REQUIRED"), { status: 409 });
}

async function audit(supabase, request, action, actor, entityId, metadata = {}, beforeData = null, afterData = null) {
  await writeAuditLog(supabase, request, {
    action,
    actor,
    entityType: "public_training",
    entityId,
    metadata,
    beforeData,
    afterData,
  });
}

async function adminSummaryRows(supabase) {
  const { data, error } = await supabase.from("public_training_flows")
    .select("*, public_training_participants(id, completed_at, pretest_started_at, pretest_completed_at, posttest_started_at, posttest_completed_at, evaluation_started_at, evaluation_completed_at)")
    .order("created_at", { ascending: false });
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return (data || []).map((flow) => {
    const participants = flow.public_training_participants || [];
    delete flow.public_training_participants;
    return {
      ...flow,
      participant_count: participants.length,
      completed_count: participants.filter((p) => p.completed_at).length,
      step_counts: {
        pretestStarted: participants.filter((p) => p.pretest_started_at).length,
        pretestCompleted: participants.filter((p) => p.pretest_completed_at).length,
        posttestStarted: participants.filter((p) => p.posttest_started_at).length,
        posttestCompleted: participants.filter((p) => p.posttest_completed_at).length,
        evaluationStarted: participants.filter((p) => p.evaluation_started_at).length,
        evaluationCompleted: participants.filter((p) => p.evaluation_completed_at).length,
      },
    };
  });
}

export async function handlePublicTraining(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  const supabase = getSupabase(env);

  const publicMatch = path.match(/^\/api\/public\/live-training\/([^/]+)(?:\/(.+))?$/);
  if (publicMatch) {
    const accessToken = publicMatch[1];
    const rest = publicMatch[2] || "";
    const flow = await getFlowByToken(supabase, accessToken);
    if (!flow) return notFound();

    if (!rest && method === "GET") return json(statePayload(flow));

    const availability = flowAvailable(flow);
    if (!availability.ok) return json({ ok: false, error: availability.code, flow: flowPublic(flow) }, availability.status);

    if (rest === "join" && method === "POST") {
      const body = await readJson(request);
      const displayName = cleanName(body.displayName || "");
      if (displayName.length < 2 || displayName.length > 120) return json({ ok: false, error: "INVALID_NAME" }, 400);
      const normalizedName = normalizeName(displayName);
      const rawToken = randomToken(32);
      const tokenHash = await sha256(rawToken);
      const row = { flow_id: flow.id, display_name: displayName, normalized_name: normalizedName, participant_token_hash: tokenHash, last_seen_at: nowIso() };
      const { data, error } = await supabase.from("public_training_participants")
        .upsert(row, { onConflict: "flow_id,normalized_name" }).select("*").single();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, participantToken: rawToken, ...statePayload(flow, data) });
    }

    if (rest === "state" && method === "GET") {
      const p = await requireParticipant(supabase, request, flow);
      const lastSeen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
      let participant = p;
      if (Date.now() - lastSeen > 15_000) {
        const { data } = await supabase.from("public_training_participants").update({ last_seen_at: nowIso() }).eq("id", p.id).select("*").single();
        participant = data || p;
      }
      return json({ ok: true, ...statePayload(flow, participant) });
    }

    const startMatch = rest.match(/^steps\/([^/]+)\/start$/);
    if (startMatch && method === "POST") {
      const step = startMatch[1];
      const p = await requireParticipant(supabase, request, flow);
      assertCanStart(flow, p, step);
      const field = `${step}_started_at`;
      let participant = p;
      if (!p[field]) {
        const { data, error } = await supabase.from("public_training_participants").update({ [field]: nowIso(), last_seen_at: nowIso() }).eq("id", p.id).select("*").single();
        if (error) return json({ ok: false, error: error.message }, 500);
        participant = data;
      }
      return json({ ok: true, externalUrl: flow[`${step}_url`], ...statePayload(flow, participant) });
    }

    const completeMatch = rest.match(/^steps\/([^/]+)\/complete$/);
    if (completeMatch && method === "POST") {
      const step = completeMatch[1];
      const p = await requireParticipant(supabase, request, flow);
      assertCanStart(flow, p, step);
      if (!p[`${step}_started_at`]) return json({ ok: false, error: "STEP_NOT_STARTED" }, 409);
      const { data, error } = await supabase.from("public_training_participants")
        .update({ [`${step}_completed_at`]: nowIso(), last_seen_at: nowIso() }).eq("id", p.id).select("*").single();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, ...statePayload(flow, data) });
    }

    if (rest === "complete" && method === "POST") {
      const p = await requireParticipant(supabase, request, flow);
      if (!completionEligible(flow, p)) return json({ ok: false, error: "COMPLETION_NOT_ALLOWED" }, 409);
      const { data, error } = await supabase.from("public_training_participants")
        .update({ completed_at: nowIso(), last_seen_at: nowIso() }).eq("id", p.id).is("completed_at", null).select("*").single();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, ...statePayload(flow, data) });
    }
    return methodNotAllowed();
  }

  if (!path.startsWith("/api/admin/live-training")) return notFound();
  const actor = await requireHr(request, env);
  if (!actor) return json({ ok: false, error: "HR only" }, 403);

  if (path === "/api/admin/live-training") {
    if (method === "GET") {
      const rows = await adminSummaryRows(supabase);
      return json({ ok: true, flows: rows.map((r) => ({ ...r, publicLink: publicLink(request, r.access_token) })) });
    }
    if (method === "POST") {
      const body = await readJson(request);
      const title = cleanName(body.title || "");
      if (!title || title.length > 180) return json({ ok: false, error: "INVALID_TITLE" }, 400);
      const row = {
        title,
        description: cleanName(body.description || "") || null,
        access_token: randomToken(32),
        status: body.status === "draft" ? "draft" : "live",
        pretest_url: assertUrl(body.pretestUrl, "pretestUrl"),
        posttest_url: assertUrl(body.posttestUrl, "posttestUrl"),
        evaluation_url: assertUrl(body.evaluationUrl, "evaluationUrl"),
        pretest_required: body.pretestRequired !== false,
        posttest_required: body.posttestRequired !== false,
        evaluation_required: body.evaluationRequired !== false,
        expires_at: body.expiresAt || null,
        training_session_id: body.trainingSessionId || null,
        created_by: actor.accountId || actor.id || null,
      };
      const { data, error } = await supabase.from("public_training_flows").insert(row).select("*").single();
      if (error) return json({ ok: false, error: error.message }, 500);
      await audit(supabase, request, "public_training.created", actor, data.id, { flowId: data.id });
      return json({ ok: true, flow: { ...data, publicLink: publicLink(request, data.access_token) } }, 201);
    }
    return methodNotAllowed();
  }

  const adminMatch = path.match(/^\/api\/admin\/live-training\/([^/]+)(?:\/(.+))?$/);
  if (!adminMatch) return notFound();
  const id = adminMatch[1];
  const rest = adminMatch[2] || "";
  const flow = await getFlowById(supabase, id);
  if (!flow) return notFound();

  if (!rest && method === "GET") {
    const rows = await adminSummaryRows(supabase);
    return json({ ok: true, flow: { ...rows.find((r) => r.id === id), publicLink: publicLink(request, flow.access_token) } });
  }

  if (!rest && method === "PATCH") {
    const body = await readJson(request);
    const patch = {};
    if ("title" in body) patch.title = cleanName(body.title || "");
    if ("description" in body) patch.description = cleanName(body.description || "") || null;
    if ("pretestUrl" in body) patch.pretest_url = assertUrl(body.pretestUrl, "pretestUrl");
    if ("posttestUrl" in body) patch.posttest_url = assertUrl(body.posttestUrl, "posttestUrl");
    if ("evaluationUrl" in body) patch.evaluation_url = assertUrl(body.evaluationUrl, "evaluationUrl");
    if ("pretestRequired" in body) patch.pretest_required = Boolean(body.pretestRequired);
    if ("posttestRequired" in body) patch.posttest_required = Boolean(body.posttestRequired);
    if ("evaluationRequired" in body) patch.evaluation_required = Boolean(body.evaluationRequired);
    if ("expiresAt" in body) patch.expires_at = body.expiresAt || null;
    if ("trainingSessionId" in body) patch.training_session_id = body.trainingSessionId || null;
    const { data, error } = await supabase.from("public_training_flows").update(patch).eq("id", id).select("*").single();
    if (error) return json({ ok: false, error: error.message }, 500);
    await audit(supabase, request, "public_training.updated", actor, id, { flowId: id }, flow, patch);
    return json({ ok: true, flow: { ...data, publicLink: publicLink(request, data.access_token) } });
  }

  if (rest === "close" && method === "POST") {
    const { data, error } = await supabase.from("public_training_flows").update({ status: "closed" }).eq("id", id).select("*").single();
    if (error) return json({ ok: false, error: error.message }, 500);
    await audit(supabase, request, "public_training.closed", actor, id, { flowId: id, before: flow.status, after: "closed" });
    return json({ ok: true, flow: data });
  }
  if (rest === "reopen" && method === "POST") {
    const { data, error } = await supabase.from("public_training_flows").update({ status: "live" }).eq("id", id).select("*").single();
    if (error) return json({ ok: false, error: error.message }, 500);
    await audit(supabase, request, "public_training.reopened", actor, id, { flowId: id, before: flow.status, after: "live" });
    return json({ ok: true, flow: data });
  }
  if (rest === "rotate-link" && method === "POST") {
    const { data, error } = await supabase.from("public_training_flows").update({ access_token: randomToken(32) }).eq("id", id).select("*").single();
    if (error) return json({ ok: false, error: error.message }, 500);
    await audit(supabase, request, "public_training.link_rotated", actor, id, { flowId: id });
    return json({ ok: true, flow: { ...data, publicLink: publicLink(request, data.access_token) } });
  }

  const stepPatch = rest.match(/^steps\/([^/]+)$/);
  if (stepPatch && method === "PATCH") {
    const step = stepPatch[1];
    if (![...STEPS, "completion"].includes(step)) return notFound();
    const body = await readJson(request);
    const state = body.state === "open" ? "open" : "closed";
    const field = `${step}_state`;
    const { data, error } = await supabase.from("public_training_flows").update({ [field]: state }).eq("id", id).select("*").single();
    if (error) return json({ ok: false, error: error.message }, 500);
    await audit(supabase, request, state === "open" ? "public_training.step_opened" : "public_training.step_closed", actor, id, { flowId: id, step, before: flow[field], after: state });
    return json({ ok: true, flow: data });
  }

  if (rest === "participants" && method === "GET") {
    const { data, error } = await supabase.from("public_training_participants").select("*").eq("flow_id", id).order("created_at", { ascending: true });
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, participants: (data || []).map(participantPublic) });
  }

  const participantPatch = rest.match(/^participants\/([^/]+)$/);
  if (participantPatch && method === "PATCH") {
    const participantId = participantPatch[1];
    const body = await readJson(request);
    const patch = {};
    if (body.reset) {
      Object.assign(patch, {
        pretest_started_at: null, pretest_completed_at: null,
        posttest_started_at: null, posttest_completed_at: null,
        evaluation_started_at: null, evaluation_completed_at: null,
        completed_at: null,
      });
    } else {
      for (const step of STEPS) {
        if (`${step}Completed` in body) patch[`${step}_completed_at`] = body[`${step}Completed`] ? nowIso() : null;
      }
      if ("completed" in body) patch.completed_at = body.completed ? nowIso() : null;
    }
    const { data, error } = await supabase.from("public_training_participants").update(patch).eq("flow_id", id).eq("id", participantId).select("*").single();
    if (error) return json({ ok: false, error: error.message }, 500);
    await audit(supabase, request, body.reset ? "public_training.participant_reset" : "public_training.participant_updated", actor, id, { flowId: id, participantId, patch: Object.keys(patch) });
    return json({ ok: true, participant: participantPublic(data) });
  }

  return methodNotAllowed();
}
