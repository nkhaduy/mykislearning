import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  EXECUTION_CONFIRM,
  OWNER_APPROVAL,
  PURGE_TABLES,
  loadPlan,
  renderApplySql,
} from "../../scripts/production/clean-reset/production-clean-reset-common.mjs";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "kis-clean-reset-test-"));
  const runtimePath = join(directory, "runtime.json");
  const evidencePath = join(directory, "plan.json");
  const projectRef = "synthetic-production-ref";
  const schemaChecksum = "a".repeat(64);
  const counts = Object.fromEntries(PURGE_TABLES.map((table) => [table, 0]));
  const contract = {
    KIS_PRODUCTION_SUPABASE_PROJECT_REF: projectRef,
    KIS_PRODUCTION_CLEAN_RESET_PROJECT_REF: projectRef,
    KIS_PRODUCTION_CLEAN_RESET_SCHEMA_CHECKSUM: schemaChecksum,
    KIS_PRODUCTION_CLEAN_RESET_BOOTSTRAP_HR_ID: "synthetic-bootstrap-hr",
    KIS_PRODUCTION_CLEAN_RESET_PLAN_EVIDENCE: evidencePath,
    KIS_PRODUCTION_MAINTENANCE_WINDOW: "2026-07-28T22:00:00+07:00/2026-07-29T00:00:00+07:00",
    KIS_PRODUCTION_BACKUP_VERIFIED: "true",
    KIS_PRODUCTION_RESTORE_REHEARSAL: "pass",
    KIS_PRODUCTION_BACKUP_ID: "SYNTHETIC-BACKUP",
  };
  writeFileSync(evidencePath, `${JSON.stringify({ projectRef, schemaChecksum, counts })}\n`, { mode: 0o600 });
  writeFileSync(runtimePath, `${JSON.stringify({ schemaVersion: 1, contract, secrets: {} })}\n`, { mode: 0o600 });
  chmodSync(runtimePath, 0o600);
  return { directory, runtimePath, contract };
}

test("production clean reset remains plan-only without literal owner approval", () => {
  const state = fixture();
  const previous = process.env.KIS_PRODUCTION_RUNTIME_FILE;
  process.env.KIS_PRODUCTION_RUNTIME_FILE = state.runtimePath;
  try {
    assert.equal(loadPlan().projectRef, state.contract.KIS_PRODUCTION_SUPABASE_PROJECT_REF);
    assert.throws(() => loadPlan({ requireApply: true, now: new Date("2026-07-28T16:00:00Z") }), /literal owner approval/);
  } finally {
    if (previous === undefined) delete process.env.KIS_PRODUCTION_RUNTIME_FILE;
    else process.env.KIS_PRODUCTION_RUNTIME_FILE = previous;
    rmSync(state.directory, { recursive: true, force: true });
  }
});

test("approved SQL preserves bootstrap HR and excludes managed schemas", () => {
  const state = fixture();
  const previous = process.env.KIS_PRODUCTION_RUNTIME_FILE;
  process.env.KIS_PRODUCTION_RUNTIME_FILE = state.runtimePath;
  try {
    state.contract.KIS_PRODUCTION_CLEAN_RESET_OWNER_APPROVAL = OWNER_APPROVAL;
    state.contract.KIS_PRODUCTION_CLEAN_RESET_EXECUTION_CONFIRM = EXECUTION_CONFIRM;
    state.contract.KIS_PRODUCTION_CLEAN_RESET_EXECUTOR = "management-api";
    writeFileSync(state.runtimePath, `${JSON.stringify({ schemaVersion: 1, contract: state.contract, secrets: {} })}\n`, { mode: 0o600 });
    const plan = loadPlan({ requireApply: true, now: new Date("2026-07-28T16:00:00Z") });
    const sql = renderApplySql(plan);
    assert.match(sql, /profiles where id <> 'synthetic-bootstrap-hr'/);
    assert.match(sql, /to_regclass\('private\.export_jobs'\) is not null then delete from private\.export_jobs/);
    assert.match(sql, /to_regclass\('public\.course_assignments'\) is not null then delete from public\.course_assignments/);
    assert.doesNotMatch(sql, /(?:delete|truncate|update)\s+(?:from\s+)?(?:auth|storage|supabase_migrations)\./i);
    assert.doesNotMatch(sql, /wrangler|deploy/i);
  } finally {
    if (previous === undefined) delete process.env.KIS_PRODUCTION_RUNTIME_FILE;
    else process.env.KIS_PRODUCTION_RUNTIME_FILE = previous;
    rmSync(state.directory, { recursive: true, force: true });
  }
});

test("clean-reset inventory reports the exact classified table counts", () => {
  const inventory = readFileSync(new URL("../../scripts/production/clean-reset/inventory.sql", import.meta.url), "utf8");
  assert.match(inventory, /\('preserve', 14\)/);
  assert.match(inventory, /\('purge', 74\)/);
  assert.match(inventory, /\('review-required', 0\)/);
  assert.doesNotMatch(inventory, /\('preserve', 17\)|\('review-required', 2\)/);
});
