import { randomBytes, randomUUID } from "node:crypto";
import { verifyStagingTarget } from "./staging-contract.mjs";
import { DEFAULT_RUNTIME_FILE, buildRuntime, deriveCloudflareNames, deriveOwner, discoverCloudflare, discoverSupabase, gitHead, readJson, redactRuntime, run, secretSet, writePrivateJson } from "./staging-ops.mjs";

const apply = process.argv.includes("--apply");
const plan = process.argv.includes("--plan") || !apply;
const runtimePath = process.env.KIS_STAGING_RUNTIME_FILE || DEFAULT_RUNTIME_FILE;

function printPlan(runtime, cloudflare, supabase) {
  console.log(JSON.stringify({
    mode: plan ? "plan" : "apply",
    safety: "staging-only; production denylist is immutable and included",
    target: redactRuntime(runtime),
    discovery: {
      cloudflareAccount: cloudflare.accountIdMasked,
      productionWorkerFound: cloudflare.productionDeployments,
      stagingWorkerExists: cloudflare.stagingWorkerExists,
      queueCount: cloudflare.queues.length,
      bucketCount: cloudflare.buckets.length,
      supabaseOrganizations: supabase.organizations.length,
      supabaseProjects: supabase.projects.length,
      linkedRefsDeniedByDefault: supabase.linkedRefs,
      stagingProjectFound: Boolean(supabase.stagingProject),
    },
    actions: [
      "create/reuse a Supabase project named kis-lms-staging only",
      "create/reuse staging Queue and DLQ",
      "create private staging R2 bucket and disable dev URL",
      "deploy only wrangler env staging",
      "set staging secrets through Wrangler protected deployment input",
    ],
  }, null, 2));
}

async function main() {
let cloudflare;
let supabase;
try {
  cloudflare = discoverCloudflare();
  supabase = discoverSupabase();
  const existingRuntime = readJson(runtimePath);
  if (existingRuntime?.contract) {
    const contractSummary = verifyStagingTarget(existingRuntime.contract);
    printPlan(existingRuntime, cloudflare, supabase);
    if (plan) return;
    writePrivateJson(runtimePath, existingRuntime);
    console.log(JSON.stringify({ mode: "apply", idempotentReuse: true, target: contractSummary, runtimeFile: runtimePath, secretNames: Object.keys(existingRuntime.secrets || {}).sort(), next: ["npm run staging:provision", "npm run staging:deploy"] }, null, 2));
    return;
  }
  const owner = deriveOwner();
  const ownerMeta = { executionId: randomUUID(), approvalId: `OWNER-STAGING-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}-${gitHead().slice(0, 8)}`, approvedBy: owner, changeOwner: owner, rollbackOwner: owner };
  const names = deriveCloudflareNames(cloudflare);
  const existingStaging = supabase.stagingProject;
  const project = existingStaging ? { ref: existingStaging.ref, url: `https://${existingStaging.ref}.supabase.co` } : null;
  const runtime = buildRuntime({ cloudflare, supabase, names, metadata: ownerMeta, project, backupOrCloneId: existingStaging ? `SUPABASE-EXISTING-${existingStaging.ref}` : undefined, secrets: plan ? {} : secretSet() });
  if (plan) {
    printPlan(runtime, cloudflare, supabase);
    return;
  }

  let working = runtime;
  if (!existingStaging) {
    const organization = supabase.organizations[0];
    if (!organization) throw new Error("No Supabase organization is available for staging project creation");
    const dbPassword = randomBytes(32).toString("base64url");
    const created = run("supabase", ["projects", "create", "kis-lms-staging", "--org-id", organization.id, "--db-password", dbPassword, "--region", "ap-northeast-2", "--size", "nano", "--output", "json", "--yes"]);
    let projectResult;
    try { projectResult = JSON.parse(created.stdout); } catch { projectResult = null; }
    const createdRef = projectResult?.id || projectResult?.ref || projectResult?.project?.id;
    if (!createdRef) {
      const refreshed = discoverSupabase();
      const found = refreshed.projects.find((item) => item.name === "kis-lms-staging");
      if (!found) throw new Error("Supabase project creation returned no project ref");
      projectResult = found;
    }
    const ref = createdRef || projectResult.ref;
    working = buildRuntime({ cloudflare, supabase: discoverSupabase(), names, metadata: ownerMeta, project: { ref, url: `https://${ref}.supabase.co` }, databasePassword: dbPassword, backupOrCloneId: `SUPABASE-FRESH-${ref}`, secrets: secretSet() });
    working.supabase.apiKeys = {};
    const keys = run("supabase", ["projects", "api-keys", "--project-ref", ref, "--output", "json"]);
    try {
      for (const item of JSON.parse(keys.stdout)) {
        if (item.name === "service_role") working.secrets.SUPABASE_SERVICE_ROLE_KEY = item.api_key;
        if (item.name === "anon") working.publicAnonKey = item.api_key;
      }
    } catch { throw new Error("Supabase API key discovery returned invalid JSON"); }
    if (!working.secrets.SUPABASE_SERVICE_ROLE_KEY || !working.publicAnonKey) throw new Error("Supabase staging API keys are incomplete");
  }
  const contractSummary = verifyStagingTarget(working.contract);
  writePrivateJson(runtimePath, working);
  console.log(JSON.stringify({ mode: "apply", target: contractSummary, runtimeFile: runtimePath, secretNames: Object.keys(working.secrets).sort(), next: ["npm run staging:provision", "npm run staging:deploy"] }, null, 2));
} catch (error) {
  console.error(`STAGING_BOOTSTRAP_FAILED: ${error.message}`);
  process.exitCode = 2;
}

}

await main();
