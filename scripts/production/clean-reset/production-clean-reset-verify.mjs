import { loadPlan, runLinkedQuery, safePlanOutput } from "./production-clean-reset-common.mjs";

const plan = loadPlan();
if (!process.argv.includes("--live-readonly")) {
  console.log(JSON.stringify({ ...safePlanOutput(plan), verification: "plan-only" }, null, 2));
  process.exit(0);
}

const result = runLinkedQuery(`select jsonb_build_object(
  'profiles', (select count(*) from public.profiles),
  'bootstrap_hrs', (select count(*) from public.profiles where id='${plan.bootstrapHrId.replaceAll("'", "''")}' and role='hr'),
  'courses', (select count(*) from public.courses),
  'course_versions', (select count(*) from public.course_versions),
  'orphan_course_versions', (select count(*) from public.course_versions cv left join public.courses c on c.id=cv.course_id where c.id is null)
) as verification;`);
console.log(JSON.stringify({ ...safePlanOutput(plan), verificationFields: Object.keys(result.rows?.[0]?.verification || {}).length }, null, 2));
