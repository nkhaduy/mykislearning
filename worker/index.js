import { handleApiRequest } from "./router.js";

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
};
