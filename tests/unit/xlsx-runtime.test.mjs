import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

test("NEW-SEC-001: supported SheetJS runtime replaces the vulnerable 0.18.5 build", () => {
  assert.equal(XLSX.version, "0.20.3");
  const vendor = readFileSync(new URL("../../vendor/xlsx.full.min.js", import.meta.url), "utf8");
  assert.match(vendor, /version="0\.20\.3"/);
  assert.doesNotMatch(vendor, /version="0\.18\.5"/);
});

test("NEW-SEC-001: XLSX export/import round-trip preserves formula-protected text", () => {
  const rows = [["Employee", "Value"], ["Synthetic User", "'=HYPERLINK(\"https://example.invalid\")"]];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Detail");
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true });
  const parsed = XLSX.read(bytes, { type: "array" });
  const actual = XLSX.utils.sheet_to_json(parsed.Sheets.Detail, { header: 1, defval: "" });
  assert.deepEqual(actual, rows);
});
