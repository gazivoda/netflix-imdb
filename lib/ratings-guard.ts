// Abuse guards for POST /api/ratings: per-IP token bucket, request/title limits and the one-time missing-key log.
// In-memory and single-process on purpose (the ratings store is single-process too).

export const MAX_BODY_BYTES = 16 * 1024 // 20 titles x 120 chars, even if every character is JSON-escaped, fits
export const MAX_TITLES = 20
export const MAX_TITLE_LENGTH = 120

export interface BucketConfig { capacity: number; refillPerSec: number }
export const IP_BUCKET: BucketConfig = { capacity: 60, refillPerSec: 1 } // 60 requests/minute per IP
// Backstop for a spoofed X-Forwarded-For (every request claiming a fresh IP): one ceiling for all callers together.
export const GLOBAL_BUCKET: BucketConfig = { capacity: 600, refillPerSec: 10 }
const MAX_TRACKED_IPS = 10_000

interface Bucket { tokens: number; last: number }

export interface Limiter {
  /** Takes one token. allowed=false carries the whole seconds to wait. */
  take(key: string, now?: number): { allowed: true } | { allowed: false; retryAfterS: number }
  size(): number
}

export function createLimiter(cfg: BucketConfig, maxKeys = MAX_TRACKED_IPS): Limiter {
  const buckets = new Map<string, Bucket>()
  return {
    take(key, now = Date.now()) {
      let b = buckets.get(key)
      if (b) {
        b.tokens = Math.min(cfg.capacity, b.tokens + ((now - b.last) / 1000) * cfg.refillPerSec)
        b.last = now
        buckets.delete(key) // keep the Map ordered by last use, so eviction drops the longest idle key
      } else {
        b = { tokens: cfg.capacity, last: now }
        while (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value as string)
      }
      buckets.set(key, b)
      if (b.tokens >= 1) {
        b.tokens -= 1
        return { allowed: true }
      }
      return { allowed: false, retryAfterS: Math.max(1, Math.ceil((1 - b.tokens) / cfg.refillPerSec)) }
    },
    size: () => buckets.size,
  }
}

/** First hop of X-Forwarded-For (the client as the proxy saw it), else a shared constant. */
export function clientIp(headers: Headers): string {
  const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return first ? first.slice(0, 64) : 'unknown'
}

let ipLimiter = createLimiter(IP_BUCKET)
let globalLimiter = createLimiter(GLOBAL_BUCKET, 1)

/** Per-IP bucket first, then the global one. A request refused by the IP bucket never spends a global token. */
export function checkRateLimit(headers: Headers, now = Date.now()): { allowed: true } | { allowed: false; retryAfterS: number } {
  const ip = ipLimiter.take(clientIp(headers), now)
  if (!ip.allowed) return ip
  return globalLimiter.take('*', now)
}

export type TitlesCheck = { ok: true; titles: string[] } | { ok: false; error: string }

/** Every title must be a real string of 1..120 printable characters with at least one letter or digit. */
export function validateTitles(titles: unknown): TitlesCheck {
  if (!Array.isArray(titles) || titles.length === 0 || titles.some((t) => typeof t !== 'string')) {
    return { ok: false, error: 'titles must be a non-empty array of strings' }
  }
  if (titles.length > MAX_TITLES) return { ok: false, error: `maximum ${MAX_TITLES} titles per request` }
  for (const t of titles as string[]) {
    const trimmed = t.trim()
    if (trimmed.length === 0 || t.length > MAX_TITLE_LENGTH || /[\u0000-\u001f\u007f]/.test(t) || !/[\p{L}\p{N}]/u.test(trimmed)) {
      return { ok: false, error: `each title must be 1 to ${MAX_TITLE_LENGTH} printable characters` }
    }
  }
  return { ok: true, titles: titles as string[] }
}

let warnedMissingKey = false

/** True when OMDB_API_KEY is usable. Logs once per process when it is not, so a misconfigured deploy is visible. */
export function omdbKeyPresent(key: string | undefined = process.env.OMDB_API_KEY): boolean {
  if (key?.trim()) return true
  if (!warnedMissingKey) {
    warnedMissingKey = true
    console.error('OMDB_API_KEY is not set: /api/ratings answers 503 until it is configured')
  }
  return false
}

export function resetRatingsGuardForTests(): void {
  ipLimiter = createLimiter(IP_BUCKET)
  globalLimiter = createLimiter(GLOBAL_BUCKET, 1)
  warnedMissingKey = false
}
