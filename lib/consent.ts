// Cookie consent state for the website's analytics. Pure and storage-injected so it is unit-testable
// and never throws: private mode, blocked storage and corrupt values all read as "no answer yet".

export type Consent = 'granted' | 'denied' | null

/** The slice of the Storage API we use. */
export interface ConsentStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const CONSENT_KEY = 'rw_consent'
/** Window event the footer's "Cookie settings" button dispatches to reopen the banner. */
export const OPEN_CONSENT_EVENT = 'rw:open-consent'
export const CONSENT_MONTHS = 12

// Tolerance for a device clock that moved backwards between write and read.
const CLOCK_SKEW_MS = 24 * 60 * 60 * 1000

function expiryOf(at: Date): Date {
  const d = new Date(at.getTime())
  d.setUTCMonth(d.getUTCMonth() + CONSENT_MONTHS)
  return d
}

/** The visitor's stored choice, or null when there is none, it is unreadable, or it is older than 12 months. */
export function readConsent(storage: ConsentStorage | null | undefined, now: Date = new Date()): Consent {
  try {
    if (!storage) return null
    const raw = storage.getItem(CONSENT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { value, at } = parsed as { value?: unknown; at?: unknown }
    if (value !== 'granted' && value !== 'denied') return null
    if (typeof at !== 'string') return null
    const written = new Date(at)
    if (Number.isNaN(written.getTime())) return null
    if (written.getTime() > now.getTime() + CLOCK_SKEW_MS) return null
    if (now.getTime() >= expiryOf(written).getTime()) return null
    return value
  } catch {
    return null
  }
}

/** Remember the choice. Returns false when storage refused (the choice then lasts only for this page view). */
export function writeConsent(
  storage: ConsentStorage | null | undefined,
  value: 'granted' | 'denied',
  now: Date = new Date(),
): boolean {
  try {
    if (!storage) return false
    storage.setItem(CONSENT_KEY, JSON.stringify({ value, at: now.toISOString() }))
    return true
  } catch {
    return false
  }
}

/** Ask only when there is no valid answer. */
export function shouldPrompt(consent: Consent): boolean {
  return consent === null
}

/** localStorage, or null where the accessor itself throws (blocked site data, sandboxed frames). */
export function browserStorage(): ConsentStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
