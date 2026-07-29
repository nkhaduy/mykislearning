import { handleApiRequest } from "./router.js";
import { getSupabase } from "./services/supabase.js";
import { runReminderScheduler } from "./services/notificationEngine.js";
import { writeAuditLog } from "./services/audit-service.js";
import { addSecurityHeaders } from "./services/responses.js";
import { isKnownAppRoute } from "./services/route-policy.js";
import { processExportMessage } from "./services/export-jobs.js";
export { RateLimiterDurableObject } from "./rate-limiter-do.js";

const LEGACY_WORKER_HOSTNAME = "mykis-learning.nkhaduy.workers.dev";
const CANONICAL_ORIGIN = "https://kislms.site";

function textResponse(body, contentType, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=300" } });
}

function seoFileResponse(request, pathname) {
  const origin = new URL(request.url).origin;
  if (pathname === "/robots.txt") {
    return textResponse([
      "User-agent: *",
      "Allow: /$",
      "Allow: /about-kis$",
      "Disallow: /dashboard/",
      "Disallow: /hr/",
      "Disallow: /admin/",
      "Disallow: /login",
      "Disallow: /change-password",
      "Disallow: /attendance/",
      "Disallow: /join/",
      "Sitemap: " + origin + "/sitemap.xml",
      "",
    ].join("\n"), "text/plain; charset=utf-8");
  }
  if (pathname === "/sitemap.xml") {
    return textResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url><url><loc>${origin}/about-kis</loc></url></urlset>\n`, "application/xml; charset=utf-8");
  }
  if (pathname === "/sitemap_index.xml" || pathname === "/llms.txt") return textResponse("Not found\n", "text/plain; charset=utf-8", 404);
  return null;
}

function canonicalHostRedirect(url) {
  if (url.hostname !== LEGACY_WORKER_HOSTNAME) return null;
  const target = new URL(CANONICAL_ORIGIN);
  target.pathname = url.pathname;
  target.search = url.search;
  return Response.redirect(target, 301);
}

function healthResponse(request, env) {
  return addSecurityHeaders(new Response(JSON.stringify({
    ok: true,
    status: "healthy",
    service: "mykis-learning",
  }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  }), request, env);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const redirectResponse = canonicalHostRedirect(url);
    if (redirectResponse) return redirectResponse;

    if ((url.pathname === "/health" || url.pathname === "/api/health") && request.method === "GET") {
      return healthResponse(request, env);
    }

    const seoResponse = seoFileResponse(request, url.pathname);
    if (seoResponse) return addSecurityHeaders(seoResponse, request, env);

    // All /api/* paths go through the Worker API router
    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request, env, ctx);
    }

    if (url.pathname.startsWith("/rest/v1/")) {
      return new Response(JSON.stringify({ error: "REST_API_DISABLED" }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    // Everything else served from static assets (dist/)
    // not_found_handling: single-page-application handles SPA fallback
    const assetResponse = await env.ASSETS.fetch(request);
    if (request.method === "GET" && !url.pathname.includes(".") && !isKnownAppRoute(url.pathname)) {
      const headers = new Headers(assetResponse.headers);
      headers.set("Content-Type", "text/html; charset=utf-8");
      headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      return addSecurityHeaders(new Response(assetResponse.body, { status: 404, headers }), request, env);
    }
    return addSecurityHeaders(assetResponse, request, env);
  },

  async scheduled(event, env, ctx) {
    const supabase = getSupabase(env);
    ctx.waitUntil((async () => {
      const correlationId = `cron_${crypto.randomUUID()}`;
      const result = await runReminderScheduler(supabase, new Date(event.scheduledTime || Date.now()));
      if (!result.ok) {
        await writeAuditLog(supabase, null, {
          actorType: "scheduler",
          action: "system.scheduler_run_failed",
          status: "failed",
          source: "cron",
          correlationId,
          entityType: "reminder_runs",
          metadata: result,
          errorCode: "REMINDER_SCHEDULER_FAILED",
        }).catch(() => {});
      }
      if (env.REPORT_EXPORT_BUCKET) {
        const { data } = await supabase.rpc("service_expire_export_jobs", { p_limit: 100 }).catch(() => ({ data: [] }));
        for (const objectKey of Array.isArray(data) ? data : []) {
          await env.REPORT_EXPORT_BUCKET.delete(objectKey).catch(() => {});
        }
        await supabase.rpc("service_cleanup_export_job_metadata", { p_limit: 500 }).catch(() => {});
      }
    })());
  },

  async queue(batch, env) {
    // Bound per-isolate work so a large batch cannot strand every claimed job.
    for (const message of batch.messages) {
      try {
        const result = await processExportMessage(message, env);
        if (result.retry) message.retry({ delaySeconds: Math.min(300, 2 ** Math.max(0, Number(message.attempts || 1))) });
        else message.ack();
      } catch {
        message.retry({ delaySeconds: Math.min(300, 2 ** Math.max(0, Number(message.attempts || 1))) });
      }
    }
  },
};
