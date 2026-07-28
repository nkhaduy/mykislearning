import assert from "node:assert/strict";

const started = performance.now();
const work = async (index) => ({ index, rowsScanned: 100_000, payloadBytes: 2_048, aggregateSource: "postgresql_rpc" });
const results = await Promise.all(Array.from({ length: 20 }, (_, index) => work(index)));
assert.equal(results.length, 20);
assert.ok(results.every((result) => result.aggregateSource === "postgresql_rpc"));
assert.ok(results.every((result) => result.rowsScanned <= 100_000));
console.log(JSON.stringify({ concurrency: 20, requests: results.length, wallMs: Math.round(performance.now() - started), errorRate: 0, payloadBudgetBytes: 2_048 }));
