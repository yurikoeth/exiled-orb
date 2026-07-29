import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RateLimiter } from "../rate-limiter.js";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes through immediately while under the limit", async () => {
    const limiter = new RateLimiter(3, 1000);
    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.status.used).toBe(2);
    expect(limiter.status.queued).toBe(0);
  });

  it("queues at the limit and releases when the window slides", async () => {
    const limiter = new RateLimiter(2, 1000);
    await limiter.acquire();
    await limiter.acquire();

    let released = false;
    const third = limiter.acquire().then(() => {
      released = true;
    });

    // Still inside the window — must be queued, not released.
    await vi.advanceTimersByTimeAsync(500);
    expect(released).toBe(false);
    expect(limiter.status.queued).toBe(1);

    // The oldest timestamp falls out of the window → slot frees up.
    await vi.advanceTimersByTimeAsync(600);
    await third;
    expect(released).toBe(true);
    expect(limiter.status.queued).toBe(0);
  });

  it("releases queued acquisitions in FIFO order", async () => {
    const limiter = new RateLimiter(1, 1000);
    await limiter.acquire();

    const order: number[] = [];
    const a = limiter.acquire().then(() => order.push(1));
    const b = limiter.acquire().then(() => order.push(2));

    await vi.advanceTimersByTimeAsync(1100);
    await a;
    await vi.advanceTimersByTimeAsync(1100);
    await b;
    expect(order).toEqual([1, 2]);
  });

  it("adopts a single-policy header", () => {
    const limiter = new RateLimiter(5, 1000);
    limiter.updateFromHeaders(new Headers({ "X-Rate-Limit-Ip": "12:10:60" }));
    expect(limiter.status.max).toBe(12);
    expect(limiter.status.windowMs).toBe(10_000);
  });

  it("adopts the most restrictive tuple of a multi-policy header", () => {
    const limiter = new RateLimiter(5, 1000);
    // 60/60s = 1 rps vs 10/300s ≈ 0.03 rps — the second is stricter.
    limiter.updateFromHeaders(new Headers({ "X-Rate-Limit-Ip": "60:60:60,10:300:300" }));
    expect(limiter.status.max).toBe(10);
    expect(limiter.status.windowMs).toBe(300_000);
  });

  it("ignores malformed tuples and never poisons the limiter with NaN", () => {
    const limiter = new RateLimiter(5, 1000);
    limiter.updateFromHeaders(new Headers({ "X-Rate-Limit-Ip": "garbage,:::,45:60:120" }));
    expect(limiter.status.max).toBe(45);
    expect(limiter.status.windowMs).toBe(60_000);

    // Entirely malformed header → limits unchanged.
    limiter.updateFromHeaders(new Headers({ "X-Rate-Limit-Ip": "nonsense" }));
    expect(limiter.status.max).toBe(45);
    expect(Number.isFinite(limiter.status.windowMs)).toBe(true);
  });

  it("does nothing when the header is absent", () => {
    const limiter = new RateLimiter(5, 1000);
    limiter.updateFromHeaders(new Headers());
    expect(limiter.status.max).toBe(5);
    expect(limiter.status.windowMs).toBe(1000);
  });
});
