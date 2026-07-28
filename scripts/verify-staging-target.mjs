import { readFileSync, existsSync } from "node:fs";
import { verifyStagingTarget } from "./staging/staging-contract.mjs";

export { verifyStagingTarget } from "./staging/staging-contract.mjs";

const runtimePath = process.env.KIS_STAGING_RUNTIME_FILE || "/tmp/kisvn-staging-runtime.json";
if (import.meta.url === `file://${process.argv[1]}`) {
  let runtime = {};
  if (existsSync(runtimePath)) {
    try { runtime = JSON.parse(readFileSync(runtimePath, "utf8")); } catch { /* env-only verification will fail closed below */ }
  }
  try {
    const summary = verifyStagingTarget({ ...runtime.contract, ...process.env });
    console.log("STAGING_TARGET_VERIFIED");
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}
