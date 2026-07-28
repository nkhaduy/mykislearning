import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const executable = join(root, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");

for (const environment of [null, "staging"]) {
  const outdir = mkdtempSync(join(tmpdir(), `kis-wrangler-${environment || "base"}-dry-`));
  try {
    const args = ["deploy", "--env", environment || "", "--dry-run", "--outdir", outdir];
    const result = spawnSync(executable, args, {
      cwd: root,
      encoding: "utf8",
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exitCode = result.status || 1;
  } finally {
    rmSync(outdir, { recursive: true, force: true });
  }
}
