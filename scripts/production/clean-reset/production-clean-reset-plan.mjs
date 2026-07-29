import { loadPlan, safePlanOutput } from "./production-clean-reset-common.mjs";

const plan = loadPlan();
console.log(JSON.stringify({
  ...safePlanOutput(plan),
  nextAction: "OWNER DECISION REQUIRED before apply",
  rollback: "restore verified backup; no in-place reconstruction",
}, null, 2));
