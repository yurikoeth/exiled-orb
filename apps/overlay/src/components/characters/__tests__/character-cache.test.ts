import { describe, it, expect, vi } from "vitest";
import { CharacterCache } from "../character-cache";

function make(ttl = 1000) {
  let t = 0;
  const fetcher = vi.fn(async () => [`char-${fetcher.mock.calls.length}`]);
  const cache = new CharacterCache(fetcher, ttl, () => t);
  return { cache, fetcher, tick: (ms: number) => (t += ms) };
}

describe("CharacterCache", () => {
  it("fetches once and serves the cached list while fresh", async () => {
    const { cache, fetcher, tick } = make();
    expect(await cache.get()).toEqual(["char-1"]);
    tick(500);
    expect(await cache.get()).toEqual(["char-1"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refetches after the TTL and when forced", async () => {
    const { cache, fetcher, tick } = make();
    await cache.get();
    tick(1000);
    expect(await cache.get()).toEqual(["char-2"]);
    expect(await cache.get(true)).toEqual(["char-3"]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("shares an in-flight fetch between concurrent callers", async () => {
    const { cache, fetcher } = make();
    const [a, b] = await Promise.all([cache.get(), cache.get()]);
    expect(a).toBe(b);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed fetch", async () => {
    let fail = true;
    const fetcher = vi.fn(async () => {
      if (fail) throw new Error("rate limited");
      return ["ok"];
    });
    const cache = new CharacterCache(fetcher, 1000, () => 0);
    await expect(cache.get()).rejects.toThrow("rate limited");
    fail = false;
    expect(await cache.get()).toEqual(["ok"]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("clear() forces the next get to fetch", async () => {
    const { cache, fetcher } = make();
    await cache.get();
    cache.clear();
    await cache.get();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
