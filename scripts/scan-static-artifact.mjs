import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(process.argv[2] || "dist");
const forbiddenExtensions = new Set([".xls", ".xlsx", ".csv"]);
const forbiddenPathPatterns = [
  /(^|\/)data\//i,
  /(^|\/)imports\//i,
  /(^|\/)tests?\/fixtures?\//i,
  /employees?[^/]*\.json$/i,
];
const textExtensions = new Set([".html", ".js", ".mjs", ".css", ".json", ".txt", ".xml", ".svg", ".webmanifest"]);
const forbiddenContentPatterns = [
  { label: "legacy credential marker", pattern: /__pwd__:/ },
  { label: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY/ },
  { label: "GitHub token", pattern: /(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9]{82})/ },
  { label: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/ },
  { label: "live Stripe secret", pattern: /(?:sk|rk)_live_[A-Za-z0-9]{24,}/ },
  { label: "service role assignment", pattern: /SUPABASE_SERVICE_ROLE_KEY\s*[=:]\s*["'][^"']{16,}["']/ },
  { label: "personal company email", pattern: /\b[a-z0-9_%+-]+\.[a-z0-9._%+-]+@kisvn\.vn\b/i },
];
const approvedPublicEmails = ["thanh.ntc@kisvn.vn"];

function filesUnder(directory) {
  const files = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files.push(...filesUnder(path));
    else files.push(path);
  }
  return files;
}

const violations = [];
const files = filesUnder(root);
for (const file of files) {
  const artifactPath = relative(root, file).replaceAll("\\", "/");
  const extension = extname(file).toLowerCase();
  if (forbiddenExtensions.has(extension)) violations.push(`${artifactPath}: forbidden office/data extension`);
  if (forbiddenPathPatterns.some((pattern) => pattern.test(artifactPath))) violations.push(`${artifactPath}: forbidden private-data path`);
  if (!textExtensions.has(extension)) continue;
  const content = readFileSync(file, "utf8");
  for (const { label, pattern } of forbiddenContentPatterns) {
    const scanContent = label === "personal company email"
      ? approvedPublicEmails.reduce((value, email) => value.replaceAll(email, "approved-public-contact"), content)
      : content;
    if (pattern.test(scanContent)) violations.push(`${artifactPath}: ${label}`);
  }
}

if (violations.length) {
  console.error(`Static artifact privacy scan failed with ${violations.length} violation(s).`);
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Static artifact privacy scan passed (${files.length} files).`);
