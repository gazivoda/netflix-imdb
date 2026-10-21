// Daily OMDb call budget. The server key is the free tier (1,000 requests a day, the same figure the extension
// documents for its own key), and a single /api/ratings request can cost 20 titles x up to 3 calls, so unchecked
// traffic could burn the day's quota in seconds. Once the budget is spent the API serves the cache only until the
// next UTC midnight, when OMDb's own day rolls over. In-memory and single-process, like the ratings store
// (a restart resets the count, which the margin below absorbs).

/** 1,000/day free tier minus a safety margin for restarts, retries and manual use of the same key. */
export const DEFAULT_OMDB_DAILY_BUDGET = 900

/** OMDB_DAILY_BUDGET (positive integer) overrides the default; anything else falls back to it. */
export function omdbDailyBudget(raw: string | undefined = process.env.OMDB_DAILY_BUDGET): number {
  const n = Number(raw?.trim())
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_OMDB_DAILY_BUDGET
}

const utcDay = (ms: number): number => Math.floor(ms / 86_400_000)

let day = utcDay(Date.now())
let used = 0

function roll(now: number): void {
  if (utcDay(now) !== day) {
    day = utcDay(now)
    used = 0
  }
}

/** Spends one OMDb call. False means the budget is gone: do not call OMDb. */
export function takeOmdbCall(now: number = Date.now(), budget: number = omdbDailyBudget()): boolean {
  roll(now)
  if (used >= budget) return false
  used += 1
  return true
}

export function omdbBudgetExhausted(now: number = Date.now(), budget: number = omdbDailyBudget()): boolean {
  roll(now)
  return used >= budget
}

/** Whole seconds until the next UTC midnight (when the budget resets). */
export function secondsUntilBudgetReset(now: number = Date.now()): number {
  return Math.max(1, Math.ceil(((day + 1) * 86_400_000 - now) / 1000))
}

export function resetOmdbBudgetForTests(): void {
  day = utcDay(Date.now())
  used = 0
}
