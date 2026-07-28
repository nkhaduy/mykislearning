const LOCAL_RUNTIMES = new Set(["local", "development", "dev", "test"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function runtimeName(env = {}) {
  return String(env.APP_ENV || env.RUNTIME_ENV || env.NODE_ENV || "").trim().toLowerCase();
}

function isLocalRequest(request) {
  try {
    return LOCAL_HOSTS.has(new URL(request.url).hostname);
  } catch {
    return false;
  }
}

export function trustedClientIp(request, env = {}) {
  const cloudflareIp = String(request.headers.get("cf-connecting-ip") || "").trim().slice(0, 64);
  if (cloudflareIp) return cloudflareIp;

  if (LOCAL_RUNTIMES.has(runtimeName(env)) && isLocalRequest(request)) {
    return String(
      request.headers.get("x-real-ip")
      || request.headers.get("x-forwarded-for")?.split(",")[0]
      || "local",
    ).trim().slice(0, 64);
  }
  return "unknown";
}

export function isProductionLike(env = {}) {
  return ["production", "prod", "staging", "stage"].includes(runtimeName(env));
}
