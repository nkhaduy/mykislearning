import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/migrations/20260817142000_frappe_lms_core.sql",
  import.meta.url,
);

test("Frappe LMS migration is additive and enforces database roles", () => {
  const sql = readFileSync(migrationUrl, "utf8").toLowerCase();

  for (const table of ["chapters", "lessons", "lesson_progress"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }

  assert.match(sql, /create or replace function private\.lms_is_hr/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /with check/);
  assert.match(sql, /course-images/);
  assert.match(sql, /lesson-files/);
  assert.match(sql, /avatars/);
  assert.doesNotMatch(sql, /drop table|truncate table|db reset/);
  assert.doesNotMatch(sql, /raw_user_meta_data|user_metadata/);
});
