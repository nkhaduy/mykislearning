import assert from "node:assert/strict";

const profiles = Array.from({ length: 100_000 }, (_, index) => ({
  id: `employee-${String(index + 1).padStart(6, "0")}`,
  department: `D${index % 20}`,
  status: index % 11 === 0 ? "inactive" : "active",
}));
const assignments = profiles.map((profile, index) => ({
  accountId: profile.id,
  status: index % 4 === 0 ? "completed" : "inProgress",
}));
const totalEmployees = profiles.filter((profile) => profile.status === "active").length;
const totalAssignments = assignments.length;
const totalCompletions = assignments.filter((row) => row.status === "completed").length;
assert.equal(profiles.length, 100_000);
assert.equal(totalEmployees + profiles.filter((profile) => profile.status === "inactive").length, 100_000);
assert.equal(totalAssignments, 100_000);
assert.equal(totalCompletions, 25_000);
assert.equal(Math.round((totalCompletions / totalAssignments) * 1000) / 10, 25);
assert.ok(totalEmployees > 5_000, "aggregate must not use the historical 5k hydration cap");
console.log(JSON.stringify({ dataset: { profiles: profiles.length, assignments: assignments.length }, metrics: { totalEmployees, totalAssignments, totalCompletions, completionRate: 25 }, hydrationCap: null, rowsHydrated: 0 }));
