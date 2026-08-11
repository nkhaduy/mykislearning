let refreshPromise = null;
const responseCache = new Map();
const inFlightGets = new Map();
let cacheEpoch = 0;
const DEFAULT_STALE_TIME = 60_000;
const DEFAULT_GC_TIME = 5 * 60_000;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth?action=refresh", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }).then((response) => response.ok).catch(() => false).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function authenticatedFetch(path, options = {}, retried = false) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  if (response.status === 401 && !retried && !String(path).startsWith("/api/auth")) {
    if (await refreshSession()) return authenticatedFetch(path, options, true);
  }
  return response;
}

async function requestJson(path, options) {
  const response = await authenticatedFetch(path, options);
  const contentType = response.headers.get("content-type") || "";
  if (!/\bjson\b/i.test(contentType)) {
    throw Object.assign(new Error("NON_JSON_RESPONSE"), { status: response.status });
  }
  const body = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(body.message || body.error || `HTTP_${response.status}`), {
      status: response.status,
      code: body.code || body.error || "REQUEST_FAILED",
    });
  }
  return body;
}

function cacheKey(path, options) {
  const headers = new Headers(options.headers || {});
  return `${String(path)}|${headers.get("Accept-Language") || ""}`;
}

function fetchAndCache(path, options, key, gcTime) {
  if (inFlightGets.has(key)) return inFlightGets.get(key);
  const epoch = cacheEpoch;
  const promise = requestJson(path, options).then((body) => {
    if (epoch === cacheEpoch) responseCache.set(key, { body, updatedAt: Date.now(), gcTime });
    return body;
  }).finally(() => {
    if (inFlightGets.get(key) === promise) inFlightGets.delete(key);
  });
  inFlightGets.set(key, promise);
  return promise;
}

export function invalidateApiCache(match) {
  cacheEpoch += 1;
  inFlightGets.clear();
  if (!match) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    const path = key.split("|")[0];
    const matches = typeof match === "function" ? match(path) : match instanceof RegExp ? match.test(path) : path.startsWith(String(match));
    if (matches) responseCache.delete(key);
  }
}

export function clearApiCache() {
  invalidateApiCache();
}

export async function apiJson(path, options = {}) {
  const {
    staleTime = DEFAULT_STALE_TIME,
    gcTime = DEFAULT_GC_TIME,
    forceRefresh = false,
    ...fetchOptions
  } = options;
  const method = String(fetchOptions.method || "GET").toUpperCase();
  const cacheable = method === "GET" && fetchOptions.cache !== "no-store";
  if (!cacheable) {
    const body = await requestJson(path, fetchOptions);
    if (method !== "GET") invalidateApiCache();
    return body;
  }

  const key = cacheKey(path, fetchOptions);
  const cached = responseCache.get(key);
  const age = cached ? Date.now() - cached.updatedAt : Infinity;
  if (!forceRefresh && cached && age <= staleTime) return cached.body;
  if (!forceRefresh && cached && age <= Math.max(gcTime, cached.gcTime || 0)) {
    void fetchAndCache(path, fetchOptions, key, gcTime).catch(() => {});
    return cached.body;
  }
  if (cached) responseCache.delete(key);
  return fetchAndCache(path, fetchOptions, key, gcTime);
}

export async function downloadFile(path, filename) {
  const response = await authenticatedFetch(path, { headers: { Accept: "*/*" } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || body.error || `HTTP_${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
