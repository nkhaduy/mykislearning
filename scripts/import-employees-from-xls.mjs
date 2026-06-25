#!/usr/bin/env node
/**
 * Import employees from XLS file into Supabase via Worker API.
 *
 * Usage:
 *   node scripts/import-employees-from-xls.mjs --dry-run
 *   node scripts/import-employees-from-xls.mjs --apply
 *
 * Env:
 *   HR_EMAIL     — HR account email (default: hr@kisvn.vn)
 *   HR_PASSWORD  — HR account password
 *   BASE_URL     — Worker base URL (default: https://mykis-learning.nkhaduy.workers.dev)
 *   XLS_PATH     — Path to XLS file (default: imports/list1.xls)
 */

import XLSX from "xlsx";
import { createReadStream } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env.BASE_URL || "https://mykis-learning.nkhaduy.workers.dev";
const HR_EMAIL = process.env.HR_EMAIL || "hr@kisvn.vn";
const HR_PASSWORD = process.env.HR_PASSWORD;
const XLS_PATH = process.env.XLS_PATH || resolve(__dirname, "../imports/list1.xls");

const IS_DRY_RUN = process.argv.includes("--dry-run");
const IS_APPLY = process.argv.includes("--apply");

if (!IS_DRY_RUN && !IS_APPLY) {
  console.error("Usage: node import-employees-from-xls.mjs [--dry-run | --apply]");
  process.exit(1);
}

if (!HR_PASSWORD) {
  console.error("❌ HR_PASSWORD env var is required.");
  process.exit(1);
}

// ─── Sensitive columns to skip ───────────────────────────────────────────────
// These column names (lowercased) will NOT be imported
const SENSITIVE_COLUMNS = [
  "cmnd", "cccd", "hộ chiếu", "passport", "căn cước",
  "số tài khoản", "ngân hàng", "bank account", "atm",
  "địa chỉ nhà", "home address", "personal address",
  "salary", "lương", "thu nhập", "income",
];

function isSensitiveColumn(name) {
  const lower = String(name || "").toLowerCase();
  return SENSITIVE_COLUMNS.some(s => lower.includes(s));
}

// ─── Excel parsing ────────────────────────────────────────────────────────────
function readXls(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Sheet structure (from actual file):
  // Row 0: "No.", "Full Name", "Department", "Position", "", "", "", "", "Course of specialization", ...
  // Row 1: "", "", "", "", "Email", "Type of certificate", "Leadership training course", "Communication training course", specialization columns...
  // Row 2+: data

  // Build effective headers from rows 0+1
  const row0 = rows[0] || [];
  const row1 = rows[1] || [];

  const effectiveHeaders = row0.map((h0, i) => {
    const h1 = row1[i] || "";
    if (String(h0).trim()) return String(h0).trim();
    if (String(h1).trim()) return String(h1).trim();
    return `col_${i}`;
  });

  // Identify sensitive columns
  const skippedCols = [];
  effectiveHeaders.forEach((h, i) => {
    if (isSensitiveColumn(h)) skippedCols.push({ index: i, name: h });
  });

  // Column mapping (indices based on actual file structure)
  const COL = {
    no: 0,
    fullName: 1,
    department: 2,
    position: 3,
    email: 4,
    certificateType: 5,
    leadershipTraining: 6,
    communicationTraining: 7,
    basicOfSecurities: 8,
    lawOfSecurities: 9,
    analysisAndInvestmentSecurities: 10,
    brokerageAndInvestmentAdvisory: 11,
    analysisOfFinancialStatements: 12,
    financialAdvisoryAndUnderwriting: 13,
    assetsAndFundManagement: 14,
    derivativeSecurities: 15,
    note: 16,
  };

  const employees = [];
  let totalRows = 0;
  let skippedEmpty = 0;
  let skippedHeader = 0;
  let invalidEmail = 0;
  const duplicateEmails = new Map();

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const noRaw = row[COL.no];
    const fullName = String(row[COL.fullName] || "").replace(/\s+/g, " ").trim();

    // Skip empty or non-data rows
    if (!noRaw && !fullName) { skippedEmpty++; continue; }
    if (!fullName) { skippedEmpty++; continue; }

    totalRows++;

    const noNum = Number(noRaw);
    const originalNo = Number.isFinite(noNum) && noNum > 0 ? Math.round(noNum) : null;

    const rawEmail = String(row[COL.email] || "").replace(/\s+/g, "").toLowerCase();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
    const email = emailValid ? rawEmail : "";
    if (rawEmail && !emailValid) invalidEmail++;

    const emp = {
      originalNo,
      fullName,
      department: String(row[COL.department] || "").trim(),
      position: String(row[COL.position] || "").trim(),
      email,
      certificateType: String(row[COL.certificateType] || "").trim(),
      leadershipTraining: String(row[COL.leadershipTraining] || "").trim(),
      communicationTraining: String(row[COL.communicationTraining] || "").trim(),
      note: String(row[COL.note] || "").trim(),
    };

    if (email) {
      duplicateEmails.set(email, (duplicateEmails.get(email) || 0) + 1);
    }

    employees.push(emp);
  }

  // Generate stable IDs: emp-001, emp-002, ...
  employees.forEach((emp, idx) => {
    const no = emp.originalNo || (idx + 1);
    emp.stableId = `emp-${String(no).padStart(3, "0")}`;
  });

  // Mark duplicates
  const dupEmailKeys = new Set([...duplicateEmails.entries()].filter(([, c]) => c > 1).map(([e]) => e));

  const valid = employees.filter(e => e.email && !dupEmailKeys.has(e.email));
  const withDupEmail = employees.filter(e => e.email && dupEmailKeys.has(e.email));
  const noKey = employees.filter(e => !e.email);

  return {
    employees,
    valid,
    withDupEmail,
    noKey,
    skippedEmpty,
    invalidEmail,
    skippedCols,
    effectiveHeaders,
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function login() {
  const res = await fetch(`${BASE_URL}/api/auth?action=login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: HR_EMAIL, password: HR_PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${body.error || res.status}`);
  return { token: body.access_token, profile: body.profile };
}

// ─── Fetch existing profiles ─────────────────────────────────────────────────
async function fetchExistingProfiles(token, profileId) {
  const res = await fetch(`${BASE_URL}/api/employees?pageSize=1000&includeDemo=true&includeDeleted=true`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Account-Id": profileId,
      "X-Account-Role": "hr",
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Fetch profiles failed: ${body.error}`);
  return body.items || [];
}

// ─── Upsert profile ───────────────────────────────────────────────────────────
async function upsertProfile(token, profileId, id, payload) {
  const res = await fetch(`${BASE_URL}/api/employees/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Account-Id": profileId,
      "X-Account-Role": "hr",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Import Employees from XLS → Supabase`);
  console.log(`  Mode: ${IS_DRY_RUN ? "DRY RUN" : "APPLY"}`);
  console.log(`${"=".repeat(60)}\n`);

  // 1. Read XLS
  console.log(`📂 Reading: ${XLS_PATH}`);
  const { employees, valid, withDupEmail, noKey, skippedEmpty, invalidEmail, skippedCols, effectiveHeaders } = readXls(XLS_PATH);

  console.log(`\n📊 File stats:`);
  console.log(`  Total rows read:           ${employees.length}`);
  console.log(`  Valid (has email, unique):  ${valid.length}`);
  console.log(`  Duplicate email rows:       ${withDupEmail.length}`);
  console.log(`  Missing email rows:         ${noKey.length}`);
  console.log(`  Skipped empty rows:         ${skippedEmpty}`);
  console.log(`  Invalid email format:       ${invalidEmail}`);

  if (skippedCols.length > 0) {
    console.log(`\n⚠️  Sensitive columns SKIPPED (not imported):`);
    skippedCols.forEach(c => console.log(`     Col ${c.index}: "${c.name}"`));
  } else {
    console.log(`\n✅ No sensitive columns found.`);
  }

  console.log(`\n📋 Column mapping (actual headers):`);
  console.log(`  No.                    → employee_code (KIS-XXX)`);
  console.log(`  Full Name              → full_name`);
  console.log(`  Department             → department`);
  console.log(`  Position               → position`);
  console.log(`  Email                  → email`);
  console.log(`  Type of certificate    → notes.certificate_type`);
  console.log(`  Leadership training    → notes.leadership_training`);
  console.log(`  Communication training → notes.communication_training`);

  if (IS_DRY_RUN) {
    console.log(`\n--- Sample valid rows (first 3) ---`);
    valid.slice(0, 3).forEach((e, i) => {
      console.log(`  [${i+1}] ${e.fullName} | ${e.email} | ${e.department} | ${e.position}`);
    });
    console.log(`\n✅ Dry run complete. Run with --apply to import.`);
    return;
  }

  // 2. Login
  console.log(`\n🔐 Logging in as ${HR_EMAIL}...`);
  const { token, profile } = await login();
  console.log(`  ✓ Logged in: ${profile.fullName} (${profile.role})`);

  // 3. Fetch existing profiles for dedup check
  console.log(`\n📥 Fetching existing Supabase profiles...`);
  const existing = await fetchExistingProfiles(token, profile.id);
  console.log(`  Found ${existing.length} existing profiles`);

  const byId = new Map(existing.map(e => [e.id, e]));
  const byEmail = new Map(existing.filter(e => e.email).map(e => [e.email.toLowerCase(), e]));

  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;

  // 4. Upsert valid employees
  console.log(`\n📤 Importing ${valid.length} employees...`);

  const BATCH = 10;
  for (let i = 0; i < valid.length; i += BATCH) {
    const batch = valid.slice(i, i + BATCH);
    await Promise.all(batch.map(async (emp) => {
      const id = emp.stableId;
      const isUpdate = byId.has(id) || byEmail.has(emp.email);
      const existingProfile = byId.get(id) || byEmail.get(emp.email);

      const notesPayload = {
        is_demo: false,
        certificate_type: emp.certificateType || existingProfile?.certificateType || "",
        leadership_training: emp.leadershipTraining || existingProfile?.leadershipTraining || "",
        communication_training: emp.communicationTraining || existingProfile?.communicationTraining || "",
        imported_at: new Date().toISOString(),
      };

      // Don't overwrite good data with empty Excel cell
      const payload = {
        full_name: emp.fullName || existingProfile?.fullName || "",
        email: emp.email || existingProfile?.email || "",
        employee_code: emp.originalNo ? `KIS-${String(emp.originalNo).padStart(3, "0")}` : (existingProfile?.employeeCode || ""),
        department: emp.department || existingProfile?.department || "",
        position: emp.position || existingProfile?.position || "",
        role: existingProfile?.role || "employee",
        account_status: (isUpdate && existingProfile?.accountStatus && existingProfile.accountStatus !== "pendingActivation") ? existingProfile.accountStatus : "active",
        password_status: isUpdate && existingProfile?.passwordStatus ? existingProfile.passwordStatus : "resetRequired",
        _notes: notesPayload,
      };


      try {
        await upsertProfile(token, profile.id, id, payload);
        if (isUpdate) updated++;
        else inserted++;
      } catch (err) {
        failed++;
        // Don't log personal data, just the ID and error
        console.error(`  ❌ Failed [${id}]: ${err.message}`);
      }
    }));

    process.stdout.write(`\r  Progress: ${Math.min(i + BATCH, valid.length)}/${valid.length}`);
  }
  console.log("");

  // 5. Mark existing demo/seed accounts
  console.log(`\n🏷️  Marking seed accounts as is_demo=true...`);
  const demoIds = existing
    .filter(e => e.id.startsWith("acc-") || e.isDemo || e.email?.includes("demo") || e.email?.includes("hr@"))
    .map(e => e.id);

  for (const demoId of demoIds) {
    try {
      await upsertProfile(token, profile.id, demoId, {
        _notes: { is_demo: true },
      });
    } catch {}
  }
  console.log(`  Marked ${demoIds.length} accounts as demo.`);

  // 6. Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Import complete!`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  Inserted:     ${inserted}`);
  console.log(`  Updated:      ${updated}`);
  console.log(`  Failed:       ${failed}`);
  console.log(`  Skipped:      ${skipped}`);
  console.log(`  Demo marked:  ${demoIds.length}`);
  console.log(`  Dup email:    ${withDupEmail.length} (not imported)`);
  console.log(`  Missing email:${noKey.length} (not imported)\n`);

  if (failed > 0) {
    console.warn(`⚠️  ${failed} records failed. Check errors above.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
