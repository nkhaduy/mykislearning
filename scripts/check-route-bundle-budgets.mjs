import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const evidencePath = resolve(process.env.BUNDLE_EVIDENCE_PATH || "docs/audit-remediation/evidence/route-bundles.json");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const budgets = {
  "/login": [35 * 1024, 60 * 1024], "/dashboard": [160 * 1024, 80 * 1024], "/admin/employees": [200 * 1024, 80 * 1024],
  "/admin/courses": [220 * 1024, 80 * 1024], "/dashboard/courses/course-a": [220 * 1024, 80 * 1024],
  "/admin/live-training": [220 * 1024, 80 * 1024], "/admin/quizzes": [220 * 1024, 80 * 1024], "/dashboard/quizzes": [220 * 1024, 80 * 1024],
  "/admin/learning-records": [220 * 1024, 80 * 1024], "/dashboard/certificates": [220 * 1024, 80 * 1024], "/attendance/scan": [220 * 1024, 80 * 1024],
  "/admin/reports": [220 * 1024, 80 * 1024],
};
const byRoute = new Map(evidence.results.map((result) => [result.route, result]));
const failures = [];
for (const result of evidence.results) {
  if (result.monolithLoaded || result.scripts.includes("/app.js")) failures.push(`${result.route}: app.js monolith loaded`);
  if (result.initialJsBytes > 220 * 1024) failures.push(`${result.route}: JS ${result.initialJsBytes} > ${220 * 1024}`);
  if (result.initialCssBytes > 80 * 1024) failures.push(`${result.route}: CSS ${result.initialCssBytes} > ${80 * 1024}`);
}
for (const [route, [jsBudget, cssBudget]] of Object.entries(budgets)) {
  const result = byRoute.get(route);
  if (!result) { failures.push(`${route}: missing evidence`); continue; }
  if (result.monolithLoaded) failures.push(`${route}: app.js monolith loaded`);
  if (result.initialJsBytes > jsBudget) failures.push(`${route}: JS ${result.initialJsBytes} > ${jsBudget}`);
  if (result.initialCssBytes > cssBudget) failures.push(`${route}: CSS ${result.initialCssBytes} > ${cssBudget}`);
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`Route bundle budgets passed for ${evidence.results.length} measured routes.`);
