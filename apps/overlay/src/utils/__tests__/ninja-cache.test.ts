import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { fetchNinjaCached, clearNinjaCache } from "../ninja-cache.js";

const URL_A = "https://poe.ninja/api/data/itemoverview?league=Allflame&type=UniqueArmour";

describe("fetchNinjaCached", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invokeMock.mockReset();
    clearNinjaCache();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hits the proxy once and serves repeats from cache", async () => {
    invokeMock.mockResolvedValue('{"lines":[]}');
    expect(await fetchNinjaCached(URL_A)).toBe('{"lines":[]}');
    expect(await fetchNinjaCached(URL_A)).toBe('{"lines":[]}');
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("fetch_ninja", { url: URL_A });
  });

  it("re-fetches after the 5-minute TTL expires", async () => {
    invokeMock.mockResolvedValue('{"lines":[]}');
    await fetchNinjaCached(URL_A);
    vi.advanceTimersByTime(5 * 60_000 + 1);
    await fetchNinjaCached(URL_A);
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("caches per URL", async () => {
    invokeMock.mockResolvedValue("{}");
    await fetchNinjaCached(URL_A);
    await fetchNinjaCached(URL_A + "&other");
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache HTML error pages, so retries stay live", async () => {
    invokeMock.mockResolvedValueOnce("<!DOCTYPE html><html>error</html>");
    invokeMock.mockResolvedValueOnce('{"lines":[1]}');
    expect(await fetchNinjaCached(URL_A)).toContain("<!DOCTYPE");
    expect(await fetchNinjaCached(URL_A)).toBe('{"lines":[1]}');
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures", async () => {
    invokeMock.mockRejectedValueOnce(new Error("API error: 503"));
    invokeMock.mockResolvedValueOnce("{}");
    await expect(fetchNinjaCached(URL_A)).rejects.toThrow("503");
    expect(await fetchNinjaCached(URL_A)).toBe("{}");
  });

  it("clearNinjaCache forces a refetch", async () => {
    invokeMock.mockResolvedValue("{}");
    await fetchNinjaCached(URL_A);
    clearNinjaCache();
    await fetchNinjaCached(URL_A);
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });
});
