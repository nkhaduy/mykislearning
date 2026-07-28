import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import worker from "../../worker/index.js";

async function fetchFromWorker(url) {
  return worker.fetch(new Request(url), {}, {});
}

test("Worker root redirects from workers.dev to the canonical site", async () => {
  const response = await fetchFromWorker("https://mykis-learning.nkhaduy.workers.dev/");

  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "https://kislms.site/");
});

test("Worker login path redirects to the same canonical path", async () => {
  const response = await fetchFromWorker("https://mykis-learning.nkhaduy.workers.dev/login");

  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "https://kislms.site/login");
});

test("Worker redirect preserves the query string", async () => {
  const response = await fetchFromWorker("https://mykis-learning.nkhaduy.workers.dev/login?next=dashboard");

  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), "https://kislms.site/login?next=dashboard");
});

test("canonical custom domains continue through the existing asset handling", async () => {
  for (const hostname of ["kislms.site", "www.kislms.site"]) {
    let assetRequests = 0;
    const env = {
      ASSETS: {
        fetch: async () => {
          assetRequests += 1;
          return new Response("asset response");
        },
      },
    };

    const response = await worker.fetch(new Request(`https://${hostname}/`), env, {});

    assert.equal(response.status, 200, hostname);
    assert.equal(response.headers.get("location"), null, hostname);
    assert.equal(assetRequests, 1, hostname);
  }
});

test("Wrangler sends static routes through the configured Worker entry point", async () => {
  const config = JSON.parse(await readFile(new URL("../../wrangler.jsonc", import.meta.url), "utf8"));

  assert.equal(config.main, "./worker/index.js");
  assert.equal(config.assets.run_worker_first, true);
});
