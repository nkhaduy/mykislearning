import { loadPlan, safePlanOutput } from "./production-clean-reset-common.mjs";

const plan = loadPlan();
console.log(JSON.stringify({
  ...safePlanOutput(plan),
  rollbackMode: "verified-backup-restore-only",
  backupId: plan.contract.KIS_PRODUCTION_BACKUP_ID,
  automaticRollbackMutation: "NONE",
  ownerActionRequired: true,
}, null, 2));
