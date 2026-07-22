import { invoke } from "@tauri-apps/api/core";

/**
 * TTL-cached poe.ninja fetches. A single category response is megabytes of
 * JSON — without this, EVERY Ctrl+C price check re-downloaded the full
 * category plus the entire Currency category for the divine rate.
 */
const cache = new Map<string, { ts: number; body: string }>();
const TTL_MS = 5 * 60_000;

/**
 * Fetch a poe.ninja URL through the Rust proxy, cached for 5 minutes.
 * Failures and HTML error pages are NOT cached, so retries stay live.
 */
export async function fetchNinjaCached(url: string): Promise<string> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.body;

  const body: string = await invoke("fetch_ninja", { url });
  // poe.ninja serves an HTML page for unknown leagues — don't cache those.
  if (!body.trimStart().startsWith("<!")) {
    cache.set(url, { ts: Date.now(), body });
  }
  return body;
}

/** Drop all cached responses (e.g. after a league/settings change). */
export function clearNinjaCache(): void {
  cache.clear();
}
