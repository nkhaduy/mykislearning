import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../../app.js", import.meta.url), "utf8");
const splitLogin = readFileSync(new URL("../../src/features/auth/login.js", import.meta.url), "utf8");

test("UX-002: login copy cannot fall through to the raw cannotLogin key", () => {
  assert.match(app, /cannotLogin:\s*\{\s*vi:\s*"Bạn không thể đăng nhập\?"/);
  assert.doesNotMatch(app, />cannotLogin</);
});

test("UX-002: login form exposes native and password-manager semantics", () => {
  assert.match(splitLogin, /id="loginForm" method="post" action="\/api\/auth\?action=login" autocomplete="on"/);
  assert.match(splitLogin, /id="loginEmail"[\s\S]*?required/);
  assert.match(splitLogin, /loginIdentifier\.type = "text"/);
  assert.match(splitLogin, /loginIdentifier\.autocomplete = "username"/);
  assert.match(splitLogin, /id="loginPassword"[\s\S]*?autocomplete="current-password"[\s\S]*?required/);
  assert.match(splitLogin, /id="loginPasswordError"[\s\S]*?aria-live="polite"/);
});

test("UX-002: non-JSON login responses are handled as system errors", () => {
  assert.match(app, /res\.headers\.get\("content-type"\)/);
  assert.match(app, /Máy chủ trả về phản hồi không hợp lệ/);
  assert.match(app, /target === "\/login" \? fallback : target/);
});
