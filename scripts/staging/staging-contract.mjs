import { createHash, randomUUID } from "node:crypto";
import { domainToASCII } from "node:url";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(new URL("../..", import.meta.url).pathname);
const DEFAULT_DENYLIST_PATH = resolve(ROOT, "config/production-denylist.json");

export const CANONICAL = Object.freeze({
  mutation: "KIS_ALLOW_STAGING_MUTATION",
  environment: "APP_ENV",
  cloudflareAccountId: "KIS_STAGING_CLOUDFLARE_ACCOUNT_ID",
  workerName: "KIS_STAGING_WORKER_NAME",
  hostname: "KIS_STAGING_HOSTNAME",
  queueName: "KIS_STAGING_QUEUE_NAME",
  dlqName: "KIS_STAGING_DLQ_NAME",
  r2BucketName: "KIS_STAGING_R2_BUCKET_NAME",
  supabaseProjectRef: "KIS_STAGING_SUPABASE_PROJECT_REF",
  supabaseUrl: "KIS_STAGING_SUPABASE_URL",
  databaseUrl: "KIS_STAGING_DATABASE_URL",
  approvalId: "KIS_STAGING_APPROVAL_ID",
  approvedBy: "KIS_STAGING_APPROVED_BY",
  changeOwner: "KIS_STAGING_CHANGE_OWNER",
  rollbackOwner: "KIS_STAGING_ROLLBACK_OWNER",
  backupOrCloneId: "KIS_STAGING_BACKUP_OR_CLONE_ID",
  productionHostnameDenylist: "KIS_PRODUCTION_HOSTNAME_DENYLIST",
  productionProjectRefDenylist: "KIS_PRODUCTION_PROJECT_REF_DENYLIST",
  productionResourceDenylist: "KIS_PRODUCTION_RESOURCE_DENYLIST",
});

const ALIASES = Object.freeze({
  [CANONICAL.cloudflareAccountId]: ["KIS_CLOUDFLARE_ACCOUNT_ID"],
  [CANONICAL.r2BucketName]: ["KIS_STAGING_R2_BUCKET"],
  [CANONICAL.supabaseProjectRef]: ["KIS_STAGING_PROJECT_REF"],
  [CANONICAL.productionProjectRefDenylist]: ["KIS_PRODUCTION_PROJECT_REFS"],
  [CANONICAL.productionHostnameDenylist]: ["KIS_PRODUCTION_HOSTNAMES"],
});

const PRODUCTION_LABEL = /(^|[-_.])(prod|production)([-_.]|$)/i;
const STAGING_LABEL = /(^|[-_.])(staging|stage|dev)([-_.]|$)/i;

function fail(message) {
  throw new Error(`STAGING_TARGET_REFUSED: ${message}`);
}

function stringValue(input, name) {
  const value = input?.[name];
  return value === undefined || value === null ? "" : String(value).trim();
}

function resolveAliased(input, canonicalName) {
  const names = [canonicalName, ...(ALIASES[canonicalName] || [])];
  const present = names.map((name) => ({ name, value: stringValue(input, name) })).filter(({ value }) => value);
  if (!present.length) return "";
  const first = present[0].value;
  for (const candidate of present.slice(1)) {
    if (candidate.value !== first) fail(`${canonicalName} conflicts with ${candidate.name}`);
  }
  return first;
}

function list(value) {
  return [...new Set(String(value || "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean))];
}

function normalizedHostname(value, name) {
  const raw = String(value || "").trim();
  if (!raw) fail(`${name} is required`);
  if (/%[0-9a-f]{2}/i.test(raw)) fail(`${name} must not contain percent-encoded host characters`);
  let parsed;
  try { parsed = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`); } catch { fail(`${name} is invalid`); }
  if (parsed.username || parsed.password || parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash) fail(`${name} must contain only a hostname`);
  const ascii = domainToASCII(parsed.hostname).toLowerCase().replace(/\.$/, "");
  if (!ascii || ascii.includes("..") || !/^[a-z0-9.-]+$/.test(ascii)) fail(`${name} is invalid`);
  return ascii;
}

function normalizedDomainList(value) {
  return [...new Set(list(value).map((item) => normalizedHostname(item, "denylist hostname")))];
}

function isDeniedHostname(hostname, denylist) {
  return denylist.some((entry) => hostname === entry || hostname.endsWith(`.${entry}`));
}

function isDeniedExact(value, denylist) {
  return denylist.includes(String(value || "").trim().toLowerCase());
}

function productionDefaults() {
  let parsed = { entries: {} };
  try { parsed = JSON.parse(readFileSync(DEFAULT_DENYLIST_PATH, "utf8")); } catch { fail("production denylist file is unreadable"); }
  return {
    hostnames: parsed.entries.hostnames.map((entry) => normalizedHostname(entry.value, "production hostname")),
    projects: parsed.entries.projects.map((entry) => String(entry.value).trim().toLowerCase()),
    resources: parsed.entries.resources.map((entry) => String(entry.value).trim().toLowerCase()),
  };
}

export function loadProductionDenylist(input = process.env) {
  const defaults = productionDefaults();
  return {
    hostnames: [...new Set([...defaults.hostnames, ...normalizedDomainList(resolveAliased(input, CANONICAL.productionHostnameDenylist))])],
    projects: [...new Set([...defaults.projects, ...list(resolveAliased(input, CANONICAL.productionProjectRefDenylist)).map((item) => item.toLowerCase())])],
    resources: [...new Set([...defaults.resources, ...list(resolveAliased(input, CANONICAL.productionResourceDenylist)).map((item) => item.toLowerCase())])],
  };
}

export function canonicalize(input = process.env) {
  const output = {};
  for (const name of Object.values(CANONICAL)) {
    if (name === CANONICAL.productionHostnameDenylist || name === CANONICAL.productionProjectRefDenylist || name === CANONICAL.productionResourceDenylist) continue;
    output[name] = resolveAliased(input, name);
  }
  const denylist = loadProductionDenylist(input);
  output[CANONICAL.productionHostnameDenylist] = denylist.hostnames.join(",");
  output[CANONICAL.productionProjectRefDenylist] = denylist.projects.join(",");
  output[CANONICAL.productionResourceDenylist] = denylist.resources.join(",");
  return output;
}

function stagingName(value, name, denylist) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) fail(`${name} is required`);
  if (PRODUCTION_LABEL.test(normalized) || isDeniedExact(normalized, denylist.resources)) fail(`${name} is classified as production`);
  if (!STAGING_LABEL.test(normalized)) fail(`${name} must contain an explicit staging/dev label`);
  return normalized;
}

export function verifyStagingTarget(input = process.env) {
  const env = canonicalize(input);
  if (env[CANONICAL.mutation] !== "true") fail(`${CANONICAL.mutation} must equal true`);
  if (env[CANONICAL.environment].toLowerCase() !== "staging") fail(`${CANONICAL.environment} must equal staging`);

  const denylist = loadProductionDenylist(env);
  const accountId = env[CANONICAL.cloudflareAccountId].toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(accountId)) fail(`${CANONICAL.cloudflareAccountId} must be a Cloudflare account ID`);
  const projectRef = env[CANONICAL.supabaseProjectRef].toLowerCase();
  if (!/^[a-z0-9-]{8,64}$/.test(projectRef)) fail(`${CANONICAL.supabaseProjectRef} has an invalid format`);
  if (isDeniedExact(projectRef, denylist.projects) || PRODUCTION_LABEL.test(projectRef)) fail("Supabase project ref is classified as production or unknown-denied");

  const hostname = normalizedHostname(env[CANONICAL.hostname], CANONICAL.hostname);
  if (!STAGING_LABEL.test(hostname) || isDeniedHostname(hostname, denylist.hostnames) || PRODUCTION_LABEL.test(hostname)) fail("staging hostname is not an allowed staging hostname");
  const worker = stagingName(env[CANONICAL.workerName], CANONICAL.workerName, denylist);
  const queue = stagingName(env[CANONICAL.queueName], CANONICAL.queueName, denylist);
  const dlq = stagingName(env[CANONICAL.dlqName], CANONICAL.dlqName, denylist);
  const r2 = stagingName(env[CANONICAL.r2BucketName], CANONICAL.r2BucketName, denylist);
  if (queue === dlq || !/dlq/i.test(dlq)) fail("staging DLQ must be distinct and explicitly named as a DLQ");
  for (const resource of [worker, queue, dlq, r2]) if (isDeniedExact(resource, denylist.resources)) fail("staging resource matches production denylist");

  let supabaseUrl;
  try { supabaseUrl = new URL(env[CANONICAL.supabaseUrl]); } catch { fail(`${CANONICAL.supabaseUrl} is invalid`); }
  if (supabaseUrl.protocol !== "https:" || supabaseUrl.hostname !== `${projectRef}.supabase.co`) fail("Supabase URL does not match staging project ref");
  let databaseUrl;
  try { databaseUrl = new URL(env[CANONICAL.databaseUrl]); } catch { fail(`${CANONICAL.databaseUrl} is invalid`); }
  if (!/^postgres(?:ql)?:$/.test(databaseUrl.protocol)) fail("only PostgreSQL database URLs are accepted");
  const databaseHost = databaseUrl.hostname.toLowerCase();
  const databaseUser = decodeURIComponent(databaseUrl.username || "").toLowerCase();
  const directDatabase = databaseHost === `db.${projectRef}.supabase.co` && databaseUser === "postgres";
  const transactionPooler = databaseHost.endsWith(".pooler.supabase.com") && databaseUser === `postgres.${projectRef}` && ["5432", "6543"].includes(databaseUrl.port || "5432");
  if (!directDatabase && !transactionPooler) fail("database connection identity does not match staging project ref");
  if (isDeniedHostname(databaseUrl.hostname, denylist.hostnames) || PRODUCTION_LABEL.test(databaseUrl.hostname)) fail("database hostname is classified as production");
  for (const name of [CANONICAL.approvalId, CANONICAL.approvedBy, CANONICAL.changeOwner, CANONICAL.rollbackOwner, CANONICAL.backupOrCloneId]) {
    if (!env[name]) fail(`${name} is required`);
    if (PRODUCTION_LABEL.test(env[name])) fail(`${name} is classified as production`);
  }
  return {
    environment: "staging",
    approvalId: env[CANONICAL.approvalId],
    approvedBy: env[CANONICAL.approvedBy],
    changeOwner: env[CANONICAL.changeOwner],
    rollbackOwner: env[CANONICAL.rollbackOwner],
    cloudflareAccountId: `${accountId.slice(0, 4)}...${accountId.slice(-4)}`,
    workerName: worker,
    stagingHostname: hostname,
    queueName: queue,
    dlqName: dlq,
    r2BucketName: r2,
    supabaseProjectRef: `${projectRef.slice(0, 4)}...${projectRef.slice(-4)}`,
    databaseHostname: databaseUrl.hostname,
    backupOrCloneId: env[CANONICAL.backupOrCloneId],
  };
}

export function newExecutionMetadata({ head, owner } = {}) {
  const executionId = randomUUID();
  const shortHead = String(head || "unknown").slice(0, 8);
  return {
    executionId,
    approvalId: `OWNER-STAGING-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}-${shortHead}`,
    approvedBy: owner || "local-system-owner",
    changeOwner: owner || "local-system-owner",
    rollbackOwner: owner || "local-system-owner",
  };
}

export function fingerprint(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex").slice(0, 12)}`;
}
