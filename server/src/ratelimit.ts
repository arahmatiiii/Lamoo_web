/**
 * A sliding-window counter, in memory, for the endpoints where guessing pays:
 * login, registration, and redeeming codes. In-memory is the right size for a
 * single-process server on one VPS — if this ever runs behind more than one
 * instance, this has to move into SQLite or Redis.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /** True when the caller is allowed through. */
  take(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Called on success, so a correct password clears the penalty. */
  clear(key: string): void {
    this.hits.delete(key);
  }

  /** Keeps the map from growing without bound on a long-running process. */
  sweep(now = Date.now()): void {
    const cutoff = now - this.windowMs;
    for (const [key, times] of this.hits) {
      const recent = times.filter((t) => t > cutoff);
      if (recent.length === 0) this.hits.delete(key);
      else this.hits.set(key, recent);
    }
  }
}
