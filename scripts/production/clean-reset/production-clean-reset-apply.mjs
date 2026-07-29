import { loadPlan, renderApplySql, runLinkedQuery, safePlanOutput } from "./production-clean-reset-common.mjs";

const apply = process.argv.includes("--apply");
if (!apply) {
  const plan = loadPlan();
  console.log(JSON.stringify(safePlanOutput(plan), null, 2));
  process.exit(0);
}

const plan = loadPlan({ requireApply: true });
runLinkedQuery(renderApplySql(plan));
console.log(JSON.stringify({
  status: "clean-reset-applied",
  projectRef: safePlanOutput(plan).projectRef,
  workerDeploy: "NONE",
  migrationHistoryRepair: "NONE",
}, null, 2));
