export class RateLimiterDurableObject {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    let input;
    try {
      input = await request.json();
    } catch {
      return new Response("Invalid request", { status: 400 });
    }
    const key = String(input.key || "");
    const limit = Math.min(10_000, Math.max(1, Number(input.limit || 1)));
    const windowSeconds = Math.min(86_400, Math.max(1, Number(input.windowSeconds || 60)));
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(key)) return new Response("Invalid key", { status: 400 });

    const now = Date.now();
    const storageKey = `bucket:${key}`;
    const bucket = await this.state.storage.transaction(async (transaction) => {
      const current = await transaction.get(storageKey);
      const next = !current || current.resetAt <= now
        ? { count: 0, resetAt: now + windowSeconds * 1000 }
        : current;
      next.count += 1;
      await transaction.put(storageKey, next);
      return next;
    });
    const currentAlarm = await this.state.storage.getAlarm();
    if (!currentAlarm || currentAlarm > bucket.resetAt + 60_000) await this.state.storage.setAlarm(bucket.resetAt + 60_000);

    return Response.json({
      success: bucket.count <= limit,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    });
  }

  async alarm() {
    const now = Date.now();
    const buckets = await this.state.storage.list({ prefix: "bucket:" });
    let nextAlarm = null;
    for (const [key, bucket] of buckets) {
      if (!bucket || bucket.resetAt <= now) await this.state.storage.delete(key);
      else nextAlarm = nextAlarm === null ? bucket.resetAt : Math.min(nextAlarm, bucket.resetAt);
    }
    if (nextAlarm !== null) await this.state.storage.setAlarm(nextAlarm + 60_000);
  }
}
