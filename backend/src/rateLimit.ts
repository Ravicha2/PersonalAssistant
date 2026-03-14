/**
 * In-memory sliding-window rate limiter per key (e.g. API key).
 * For production, use Redis or similar.
 */
const windowMs = 60_000; // 1 minute
const store = new Map<string, number[]>();

function prune(key: string, now: number): void {
  const timestamps = store.get(key) ?? [];
  const cutoff = now - windowMs;
  const kept = timestamps.filter((t) => t > cutoff);
  if (kept.length === 0) store.delete(key);
  else store.set(key, kept);
}

export function checkRateLimit(key: string, limit: number): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  prune(key, now);
  const timestamps = store.get(key) ?? [];
  if (timestamps.length >= limit) {
    const oldest = Math.min(...timestamps);
    return { allowed: false, retryAfter: Math.ceil((oldest + windowMs - now) / 1000) };
  }
  timestamps.push(now);
  store.set(key, timestamps);
  return { allowed: true };
}

export function getActiveCount(key: string): number {
  const timestamps = store.get(key) ?? [];
  return timestamps.length;
}
