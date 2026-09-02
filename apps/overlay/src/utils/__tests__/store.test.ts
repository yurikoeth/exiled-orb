import { describe, it, expect, beforeEach, vi } from "vitest";

const fakeStore = vi.hoisted(() => ({
  set: vi.fn(async () => {}),
  get: vi.fn(async (): Promise<unknown> => undefined),
  save: vi.fn(async () => {}),
}));
const loadMock = vi.hoisted(() => vi.fn(async () => fakeStore));
vi.mock("@tauri-apps/plugin-store", () => ({ Store: { load: loadMock } }));

async function freshModule() {
  vi.resetModules();
  return import("../store");
}

describe("utils/store", () => {
  beforeEach(() => {
    loadMock.mockClear();
    fakeStore.set.mockReset().mockResolvedValue(undefined);
    fakeStore.get.mockReset().mockResolvedValue(undefined);
    fakeStore.save.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("loads the store file once and reuses the instance", async () => {
    const { getStore } = await freshModule();
    const a = await getStore();
    const b = await getStore();
    expect(a).toBe(b);
    expect(loadMock).toHaveBeenCalledTimes(1);
    expect(loadMock).toHaveBeenCalledWith("exiled-orb-store.json");
  });

  it("persistToStore sets then saves, and never throws", async () => {
    const { persistToStore } = await freshModule();
    await persistToStore("k", { a: 1 });
    expect(fakeStore.set).toHaveBeenCalledWith("k", { a: 1 });
    expect(fakeStore.save).toHaveBeenCalledTimes(1);
    fakeStore.save.mockRejectedValueOnce(new Error("disk full"));
    await expect(persistToStore("k", 2)).resolves.toBeUndefined();
  });

  it("getApiKey returns the stored key, null when unset, null on error", async () => {
    const { getApiKey } = await freshModule();
    expect(await getApiKey()).toBeNull();
    fakeStore.get.mockResolvedValueOnce("sk-ant-test");
    expect(await getApiKey()).toBe("sk-ant-test");
    fakeStore.get.mockRejectedValueOnce(new Error("boom"));
    expect(await getApiKey()).toBeNull();
  });
});
