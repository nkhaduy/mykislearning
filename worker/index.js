import { handleApiRequest } from "./router.js";
import { getSupabase } from "./services/supabase.js";
import { runReminderScheduler } from "./services/notificationEngine.js";
import { writeAuditLog } from "./services/audit-service.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // All /api/* paths go through the Worker API router
    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request, env, ctx);
    }

    // Everything else served from static assets (dist/)
    // not_found_handling: single-page-application handles SPA fallback
    return env.ASSETS.fetch(request);
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
    })());
  },
};
