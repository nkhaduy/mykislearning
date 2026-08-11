import test from "node:test";
import assert from "node:assert/strict";

import { withRequestContext } from "../../worker/middleware/request-context.js";
import { auditLater } from "../../worker/services/audit-service.js";

test("auditLater registers login audit writes with the Worker execution context", async () => {
  const inserted = [];
  let backgroundWrite = null;
  const executionContext = {
    waitUntil(promise) {
      backgroundWrite = Promise.resolve(promise);
    },
  };
  const supabase = {
    from(table) {
      assert.equal(table, "audit_logs");
      return {
        async insert(row) {
          inserted.push(row);
          return { error: null };
        },
      };
    },
  };
  const request = new Request("https://lms.example.test/api/auth?action=login", {
    method: "POST",
    headers: { "X-Request-ID": "req_audit-login-test" },
  });

  await withRequestContext(request, { JWT_SECRET: "x".repeat(32) }, async () => {
    auditLater(supabase, request, {
      action: "auth.login_failed",
      status: "failed",
      entityType: "profile",
      entityId: "acc-test",
      metadata: { reason: "WRONG_PASSWORD" },
    });
    return new Response("ok");
  }, executionContext);

  assert.ok(backgroundWrite, "audit promise must be registered with waitUntil");
  await backgroundWrite;
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].request_id, "req_audit-login-test");
  assert.equal(inserted[0].metadata.reason, "WRONG_PASSWORD");
});
