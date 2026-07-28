const DEFAULT_PRODUCTION_HOSTS = new Set([
  "mykis-learning.nkhaduy.workers.dev",
]);

export function isProductionTarget(baseURL, additionalHosts = "") {
  let hostname;
  try { hostname = new URL(baseURL).hostname.toLowerCase(); } catch { return true; }
  const hosts = new Set([
    ...DEFAULT_PRODUCTION_HOSTS,
    ...String(additionalHosts).split(",").map((host) => host.trim().toLowerCase()).filter(Boolean),
  ]);
  return hosts.has(hostname) || hostname.endsWith(".kisvn.vn");
}

export function assertSafeE2ETarget({ baseURL, suite, mutationAllowed, productionHosts = "" }) {
  if (!baseURL) throw new Error("PLAYWRIGHT_BASE_URL is required");
  const mutationSuite = !["public-readonly", "authenticated-readonly"].includes(suite);
  if (mutationSuite && !mutationAllowed) {
    throw new Error("Mutation E2E is disabled. Set PLAYWRIGHT_ALLOW_MUTATION=true only for local/ephemeral staging.");
  }
  if (mutationSuite && isProductionTarget(baseURL, productionHosts)) {
    throw new Error(`Refusing mutation E2E against production target: ${new URL(baseURL).hostname}`);
  }
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  assertSafeE2ETarget({
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    suite: process.env.PLAYWRIGHT_SUITE || "mutation",
    mutationAllowed: process.env.PLAYWRIGHT_ALLOW_MUTATION === "true",
    productionHosts: process.env.PLAYWRIGHT_PRODUCTION_HOSTS,
  });
}
