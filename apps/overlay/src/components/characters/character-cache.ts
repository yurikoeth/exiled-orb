/**
 * Cache for the GGG character list.
 *
 * GGG allows only 5 character-list requests per 5 minutes per account, and
 * one load costs two (one per realm). Without a cache every visit to the
 * Characters tab re-fetched the list, so the third visit inside five minutes
 * hit the limiter. The list is cached for the same 5-minute window, in-flight
 * loads are shared (React StrictMode mounts twice in dev), and the Refresh
 * button / a fresh Connect can force a reload.
 */

export const CHARACTER_CACHE_TTL_MS = 5 * 60 * 1000;

interface Entry<T> {
  value: T;
  at: number;
}

export class CharacterCache<T> {
  private entry: Entry<T> | null = null;
  private inflight: Promise<T> | null = null;

  constructor(
    private readonly fetcher: () => Promise<T>,
    private readonly ttlMs = CHARACTER_CACHE_TTL_MS,
    private readonly now: () => number = Date.now
  ) {}

  /** Return the cached list if fresh, else fetch (sharing any in-flight fetch). */
  async get(force = false): Promise<T> {
    if (!force && this.entry && this.now() - this.entry.at < this.ttlMs) {
      return this.entry.value;
    }
    if (!this.inflight) {
      this.inflight = this.fetcher()
        .then((value) => {
          this.entry = { value, at: this.now() };
          return value;
        })
        .finally(() => {
          this.inflight = null;
        });
    }
    return this.inflight;
  }

  /** Forget everything (e.g. after Disconnect). */
  clear(): void {
    this.entry = null;
  }
}
