/**
 * In-memory AI response cache with TTL.
 *
 * Why in-memory rather than distributed?
 * - AI responses are fast to regenerate (sub-second), so a warm cache is a bonus, not a requirement.
 * - Weather alerts are highly personalized (user plants + location), so cross-process sharing is low-value.
 * - Keeping it local avoids cache invalidation complexity and extra I/O latency.
 *
 * Production safeguards:
 * - TTL bounds every entry so stale advice doesn't live forever.
 * - Max size prevents unbounded memory growth in long-running containers.
 * - Cache keys are stable hashes of the request inputs, not raw user data.
 */

import crypto from "node:crypto";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheOptions {
  ttlMs: number;
  maxEntries?: number;
}

export class AiResponseCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private ttlMs: number;
  private maxEntries: number;

  constructor(options: CacheOptions) {
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries ?? 256;
  }

  private evictIfNeeded() {
    if (this.store.size <= this.maxEntries) return;
    // Remove oldest entries first (Map preserves insertion order).
    const toRemove = this.store.size - this.maxEntries;
    let removed = 0;
    for (const key of this.store.keys()) {
      if (removed >= toRemove) break;
      this.store.delete(key);
      removed++;
    }
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  get(key: string): T | undefined {
    this.cleanupExpired();
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T) {
    this.cleanupExpired();
    this.evictIfNeeded();
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

/**
 * Build a deterministic cache key from a set of string parts.
 * Uses SHA-256 to keep keys short and safe for Map keys.
 */
export function buildCacheKey(parts: (string | number)[]): string {
  const payload = parts.map(String).join("\u0000");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

// Shared cache for smart weather alerts: 2 hours TTL, 256 entries max.
export const weatherAlertsCache = new AiResponseCache<{ alerts: unknown[] }>({
  ttlMs: 2 * 60 * 60 * 1000,
  maxEntries: 256,
});
