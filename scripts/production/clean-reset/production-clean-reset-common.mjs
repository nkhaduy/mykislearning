import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadSecureRuntime } from "../runtime-contract.mjs";

export const OWNER_APPROVAL = "I APPROVE KIS LMS PRODUCTION CLEAN RESET";
export const EXECUTION_CONFIRM = "EXECUTE_APPROVED_CLEAN_RESET_ONCE";

export const PURGE_TABLES = [
  "private.refresh_tokens", "private.revoked_sessions", "private.auth_sessions", "private.export_jobs",
  "public.approval_events", "public.certificate_alert_events", "public.cchn_registration_items",
  "public.cchn_registrations", "public.training_tracking_records", "public.employee_profile_audit_logs",
  "public.audit_logs", "public.notification_deliveries", "public.notifications", "public.notification_events",
  "public.notification_preferences", "public.reminder_runs", "public.quiz_answers", "public.quiz_attempts",
  "public.quiz_question_versions", "public.quiz_versions", "public.quiz_questions", "public.question_options",
  "public.questions", "public.quizzes", "public.content_progress", "public.lesson_progress",
  "public.course_assignments", "public.enrollments", "public.course_content", "public.course_contents",
  "public.course_versions", "public.learning_path_step_progress", "public.learning_path_assignments",
  "public.learning_path_version_steps", "public.learning_path_versions", "public.learning_path_steps",
  "public.learning_paths", "public.learning_record_attachments", "public.learning_records",
  "public.learning_history", "public.external_course_submissions", "public.external_training_requests",
  "public.compliance_completion_records", "public.compliance_assignments", "public.compliance_cycles",
  "public.compliance_target_rules", "public.compliance_programs", "public.retraining_assignments",
  "public.retraining_reviews", "public.development_plan_items", "public.development_plans",
  "public.employee_competency_evidence", "public.employee_competency_assessments", "public.attendance",
  "public.qr_tokens", "public.session_participants", "public.training_registrations",
  "public.training_participants", "public.session_slots", "public.public_training_roster",
  "public.public_training_participants", "public.public_training_active_flow", "public.public_training_flows",
  "public.training_sessions", "public.professional_certificates", "public.employee_certifications",
  "public.hr_tasks", "public.user_activity", "public.file_uploads", "public.gallery_albums", "public.courses",
  "public.user_roles", "private.account_credentials", "public.profiles",
];

const prohibitedSchemas = new Set(["auth", "storage", "supabase_migrations", "extensions", "pg_catalog", "information_schema"]);

export function redact(value) {
  const text = String(value || "");
  return text.length < 7 ? "redacted" : `${text.slice(0, 3)}...${text.slice(-3)}`;
}

function parseWindow(value) {
  const [startRaw, endRaw] = String(value || "").split("/");
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (!Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf()) || end <= start) return null;
  return { start, end, durationMinutes: (end - start) / 60_000 };
}

export function loadPlan({ requireApply = false, now = new Date() } = {}) {
  const loaded = loadSecureRuntime();
  const { contract } = loaded;
  const blockers = [];
  const projectRef = String(contract.KIS_PRODUCTION_SUPABASE_PROJECT_REF || "").toLowerCase();
  const exactRef = String(contract.KIS_PRODUCTION_CLEAN_RESET_PROJECT_REF || "").toLowerCase();
  const schemaChecksum = String(contract.KIS_PRODUCTION_CLEAN_RESET_SCHEMA_CHECKSUM || "");
  const bootstrapHrId = String(contract.KIS_PRODUCTION_CLEAN_RESET_BOOTSTRAP_HR_ID || "");
  const evidencePath = resolve(String(contract.KIS_PRODUCTION_CLEAN_RESET_PLAN_EVIDENCE || ""));
  const window = parseWindow(contract.KIS_PRODUCTION_MAINTENANCE_WINDOW);
  let evidence = null;

  if (!projectRef || exactRef !== projectRef) blockers.push("exact production project ref confirmation is missing");
  if (!/^[a-f0-9]{64}$/.test(schemaChecksum)) blockers.push("exact production schema checksum is missing");
  if (!bootstrapHrId) blockers.push("bootstrap HR preservation id is missing");
  if (!window || window.durationMinutes < 90) blockers.push("maintenance window must be at least 90 minutes");
  if (contract.KIS_PRODUCTION_BACKUP_VERIFIED !== "true") blockers.push("verified backup is required");
  if (contract.KIS_PRODUCTION_RESTORE_REHEARSAL !== "pass") blockers.push("restore rehearsal must pass");
  if (!contract.KIS_PRODUCTION_BACKUP_ID) blockers.push("backup id is required");

  try {
    evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  } catch {
    blockers.push("clean-reset row-count plan evidence is missing or invalid");
  }
  if (evidence) {
    if (evidence.projectRef !== projectRef) blockers.push("plan evidence targets a different project");
    if (evidence.schemaChecksum !== schemaChecksum) blockers.push("plan evidence schema checksum mismatch");
    if (!evidence.counts || typeof evidence.counts !== "object") blockers.push("plan evidence row counts are missing");
    const evidenceTables = Object.keys(evidence.counts || {}).sort();
    if (JSON.stringify(evidenceTables) !== JSON.stringify([...PURGE_TABLES].sort())) blockers.push("plan evidence table allowlist mismatch");
  }

  for (const table of PURGE_TABLES) {
    const [schema] = table.split(".");
    if (prohibitedSchemas.has(schema)) blockers.push(`prohibited schema in purge allowlist: ${schema}`);
  }

  if (requireApply) {
    if (contract.KIS_PRODUCTION_CLEAN_RESET_OWNER_APPROVAL !== OWNER_APPROVAL) blockers.push("literal owner approval is missing");
    if (contract.KIS_PRODUCTION_CLEAN_RESET_EXECUTION_CONFIRM !== EXECUTION_CONFIRM) blockers.push("one-time clean-reset execution confirmation is missing");
    if (!window || now < window.start || now > window.end) blockers.push("maintenance window is not active");
    if (contract.KIS_PRODUCTION_CLEAN_RESET_EXECUTOR !== "management-api") blockers.push("approved management-api executor is not selected");
  }

  if (blockers.length) throw new Error(`PRODUCTION CLEAN RESET BLOCKED\n- ${blockers.join("\n- ")}`);
  return { loaded, contract, evidence, projectRef, schemaChecksum, bootstrapHrId, window };
}

export function safePlanOutput(plan) {
  return {
    mode: "plan-only",
    projectRef: redact(plan.projectRef),
    schemaChecksum: plan.schemaChecksum,
    backupId: plan.contract.KIS_PRODUCTION_BACKUP_ID,
    maintenanceWindowMinutes: plan.window.durationMinutes,
    purgeTableCount: PURGE_TABLES.length,
    bootstrapHrPreserved: true,
    forbiddenSchemas: ["auth", "storage", "supabase_migrations", "system schemas"],
    workerDeploy: "NONE",
    migrationHistoryRepair: "NONE",
  };
}

export function runLinkedQuery(sql) {
  const result = spawnSync("supabase", ["db", "query", "--linked", "--output", "json", sql], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error("linked Supabase query failed without exposing provider output");
  return JSON.parse(result.stdout || "{}");
}

export function renderApplySql(plan) {
  const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
  const expectedCounts = JSON.stringify(plan.evidence.counts);
  const deletes = PURGE_TABLES.map((table) => {
    // The approved allowlist may include tables introduced by the pending migrations.
    // Guard each explicit table independently so reset-before-migration remains safe.
    if (table === "public.user_roles") return `do $$ begin if to_regclass('${table}') is not null then delete from public.user_roles where account_id <> ${quote(plan.bootstrapHrId)}; end if; end $$;`;
    if (table === "private.account_credentials") return `do $$ begin if to_regclass('${table}') is not null then delete from private.account_credentials where profile_id <> ${quote(plan.bootstrapHrId)}; end if; end $$;`;
    if (table === "public.profiles") return `do $$ begin if to_regclass('${table}') is not null then delete from public.profiles where id <> ${quote(plan.bootstrapHrId)}; end if; end $$;`;
    return `do $$ begin if to_regclass('${table}') is not null then delete from ${table}; end if; end $$;`;
  }).join("\n");

  return `begin;
select pg_advisory_xact_lock(hashtextextended('kisvn-production-clean-reset-v1',0));
do $$
declare
  planned jsonb := ${quote(expectedCounts)}::jsonb;
  item record;
  actual bigint;
begin
  if ${quote(plan.projectRef)} <> ${quote(plan.contract.KIS_PRODUCTION_SUPABASE_PROJECT_REF)} then raise exception 'project ref mismatch'; end if;
  for item in select key as table_name, value::text::bigint as expected_count from jsonb_each_text(planned)
  loop
    if to_regclass(item.table_name) is null then
      actual := 0;
    else
      execute format('select count(*) from %s', item.table_name) into actual;
    end if;
    if actual <> item.expected_count then raise exception 'row count drift for %', item.table_name; end if;
  end loop;
  if not exists (select 1 from public.profiles where id=${quote(plan.bootstrapHrId)} and role='hr') then
    raise exception 'bootstrap HR missing';
  end if;
end $$;
${deletes}
commit;`;
}
