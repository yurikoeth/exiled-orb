/** A simple sliding-window rate limiter for API calls */
export class RateLimiter {
  private timestamps: number[] = [];
  private queue: Array<() => void> = [];
  private processing = false;

  constructor(
    /** Max requests allowed in the window */
    private maxRequests: number,
    /** Window size in milliseconds */
    private windowMs: number
  ) {}

  /** Clean up timestamps outside the current window */
  private cleanup(): void {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
  }

  /** Process queued requests */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      this.cleanup();

      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(Date.now());
        const next = this.queue.shift();
        next?.();
      } else {
        // Wait until the oldest request falls out of the window
        const oldestTs = this.timestamps[0];
        const waitMs = this.windowMs - (Date.now() - oldestTs) + 10;
        await new Promise<void>((r) => setTimeout(r, waitMs));
      }
    }

    this.processing = false;
  }

  /** Acquire a slot — resolves when it's safe to make the request */
  async acquire(): Promise<void> {
    this.cleanup();

    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(Date.now());
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  /**
   * Update limits from API response headers (GGG Trade API).
   *
   * The header carries one or more comma-separated "max:window_s:penalty_s"
   * tuples, e.g. "45:60:120,240:240:900". Since this limiter models a single
   * window, adopt the most restrictive tuple (lowest sustained rate).
   * Malformed tuples are ignored so a bad header can never poison the limiter
   * with NaN.
   */
  updateFromHeaders(headers: Headers): void {
    const limitHeader = headers.get("X-Rate-Limit-Ip");
    if (!limitHeader) return;

    let best: { max: number; windowMs: number } | null = null;
    for (const tuple of limitHeader.split(",")) {
      const parts = tuple.trim().split(":");
      const max = Number(parts[0]);
      const windowS = Number(parts[1]);
      if (!Number.isInteger(max) || !Number.isInteger(windowS) || max <= 0 || windowS <= 0) {
        continue;
      }
      if (best === null || max / windowS < best.max / (best.windowMs / 1000)) {
        best = { max, windowMs: windowS * 1000 };
      }
    }
    if (best) {
      this.maxRequests = best.max;
      this.windowMs = best.windowMs;
    }
  }

  /** Current usage info */
  get status() {
    this.cleanup();
    return {
      used: this.timestamps.length,
      max: this.maxRequests,
      windowMs: this.windowMs,
      queued: this.queue.length,
    };
  }
}
