import { lookupTitle, type OmdbTitle } from '@/lib/omdb'
import { getRatingsStore, normalizeKey } from '@/lib/ratings-store'

// Concurrent requests for the same title share one OMDb lookup.
const inFlight = new Map<string, Promise<OmdbTitle | null>>()

async function refresh(title: string): Promise<OmdbTitle | null> {
  const store = getRatingsStore()
  const outcome = await lookupTitle(title)

  if (outcome.status === 'found') {
    store.set(title, outcome.title)
    return outcome.title
  }
  if (outcome.status === 'not_found') {
    store.set(title, null)
    return null
  }

  // Lookup failed (network, rate limit, bad key): never cache it. Serve the
  // stale rating if we have one, since an old score beats no score.
  return store.get(title)?.result ?? null
}

/**
 * Cache-only lookup (used when the daily OMDb budget is spent): any stored answer counts, fresh or stale, because an
 * old score beats no score. `hit: false` means the title was never looked up, i.e. we cannot answer at all.
 */
export function getCachedRating(title: string): { hit: true; result: OmdbTitle | null } | { hit: false } {
  const doc = getRatingsStore().get(title)
  return doc ? { hit: true, result: doc.result } : { hit: false }
}

/**
 * Rating for a title: from the store when it is fresh (7 days, 1 day for
 * "not found"), otherwise from OMDb and written back to the store.
 */
export function getRating(title: string): Promise<OmdbTitle | null> {
  const fresh = getRatingsStore().getFresh(title)
  if (fresh) return Promise.resolve(fresh.result)

  const key = normalizeKey(title)
  const pending = inFlight.get(key)
  if (pending) return pending

  const lookup = refresh(title).finally(() => inFlight.delete(key))
  inFlight.set(key, lookup)
  return lookup
}
