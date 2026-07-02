import { json, readJson, methodNotAllowed, corsPreflight } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireAuth, requireHr } from "../middleware/auth.js";
import {
  addPlanItem,
  createPlan,
  getPlan,
  listPlans,
  removePlanItem,
  startMyItem,
  syncMyItem,
  transitionPlan,
  updatePlan,
  updatePlanItem,
} from "../services/development-plan-service.js";

function sendError(error) {
  return json({ ok: false, error: error.code || error.message || "DEVELOPMENT_PLAN_ERROR" }, error.status || 500);
}

export async function handleDevelopmentPlans(request, env) {
  if (request.method.toUpperCase() === "OPTIONS") return corsPreflight();
  const supabase = getSupabase(env);
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  try {
    if (path.startsWith("/api/admin/development-plans")) {
      const acct = await requireHr(request, env);
      if (!acct) return json({ error: "HR_ONLY" }, 403);
      if (path === "/api/admin/development-plans") {
        if (method === "GET") return json(await listPlans(supabase, { employeeId: url.searchParams.get("employeeId") || "", status: url.searchParams.get("status") || "" }));
        if (method === "POST") return json({ ok: true, data: await createPlan(supabase, request, acct, await readJson(request)) }, 201);
      }
      const itemMatch = path.match(/^\/api\/admin\/development-plans\/([^/]+)\/items(?:\/([^/]+))?$/);
      if (itemMatch) {
        const [, planId, itemId] = itemMatch;
        if (method === "POST" && !itemId) return json({ ok: true, data: await addPlanItem(supabase, request, acct, planId, await readJson(request)) }, 201);
        if (method === "PATCH" && itemId) return json({ ok: true, data: await updatePlanItem(supabase, request, acct, planId, itemId, await readJson(request)) });
        if (method === "DELETE" && itemId) return json(await removePlanItem(supabase, request, acct, planId, itemId));
      }
      const planMatch = path.match(/^\/api\/admin\/development-plans\/([^/]+)(?:\/([^/]+))?$/);
      if (planMatch) {
        const [, id, action] = planMatch;
        if (method === "GET" && !action) return json(await getPlan(supabase, id));
        if (method === "PATCH" && !action) return json({ ok: true, data: await updatePlan(supabase, request, acct, id, await readJson(request)) });
        if (method === "POST" && ["activate", "complete", "cancel"].includes(action)) return json({ ok: true, data: await transitionPlan(supabase, request, acct, id, action) });
      }
    }

    if (path.startsWith("/api/development-plans/my")) {
      const acct = await requireAuth(request, env);
      if (!acct) return json({ error: "Unauthorized" }, 401);
      if (path === "/api/development-plans/my" && method === "GET") return json(await listPlans(supabase, { employeeId: acct.accountId }));
      const itemAction = path.match(/^\/api\/development-plans\/my\/([^/]+)\/items\/([^/]+)\/(start|sync)$/);
      if (itemAction && method === "POST") {
        const [, planId, itemId, action] = itemAction;
        return json({ ok: true, data: action === "start" ? await startMyItem(supabase, acct.accountId, planId, itemId) : await syncMyItem(supabase, acct.accountId, planId, itemId) });
      }
      const detail = path.match(/^\/api\/development-plans\/my\/([^/]+)$/);
      if (detail && method === "GET") return json(await getPlan(supabase, detail[1], acct.accountId));
    }
  } catch (error) {
    return sendError(error);
  }
  return methodNotAllowed();
}
