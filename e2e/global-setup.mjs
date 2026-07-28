import { assertSafeE2ETarget } from "../scripts/assert-safe-e2e-target.mjs";

export default async function globalSetup(config) {
  assertSafeE2ETarget({
    baseURL: config.projects[0]?.use?.baseURL || config.use?.baseURL,
    suite: process.env.PLAYWRIGHT_SUITE || "public-readonly",
    mutationAllowed: process.env.PLAYWRIGHT_ALLOW_MUTATION === "true",
    productionHosts: process.env.PLAYWRIGHT_PRODUCTION_HOSTS,
  });
}
