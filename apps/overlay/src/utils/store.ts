import { Store } from "@tauri-apps/plugin-store";

const STORE_NAME = "exiled-orb-store.json";

let storeInstance: Store | null = null;

/** Get the shared store instance (cached) */
export async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await Store.load(STORE_NAME);
  }
  return storeInstance;
}

/**
 * Persist a value to the shared store (set + save). Errors are logged, not
 * thrown — persistence failures should never break UI state updates.
 */
export async function persistToStore(key: string, value: unknown): Promise<void> {
  try {
    const store = await getStore();
    await store.set(key, value);
    await store.save();
  } catch (err) {
    console.error(`[ExiledOrb] Failed to persist "${key}":`, err);
  }
}

/** Get the Claude API key from the store */
export async function getApiKey(): Promise<string | null> {
  try {
    const store = await getStore();
    return (await store.get<string>("claude_api_key")) ?? null;
  } catch {
    return null;
  }
}

