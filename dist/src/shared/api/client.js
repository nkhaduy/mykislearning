let refreshPromise = null;

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

export async function apiJson(path, options = {}) {
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
