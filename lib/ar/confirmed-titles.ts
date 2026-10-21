// Titles the ratings catalogue has confirmed on THIS device, kept so the next session starts with a vocabulary that already
// matches what the user's own screen shows. Same storage contract as enrol-store.ts (an injected KeyValueStore, every access
// guarded): a throwing or full store just means the list is not remembered.
//
// Only canonical catalogue titles are stored (never raw OCR text), the list is capped and keeps the most recent, and nothing here
// ever leaves the device.

import type { KeyValueStore } from './enrol-store'
import { POPULAR_TITLES } from './popular-titles'
import { createVocabulary, Vocabulary } from './title-vocab'

export const CONFIRMED_KEY = 'ar-confirmed-titles-v1'
export const CONFIRMED_MAX = 400 // ~10 KB of JSON; the oldest titles drop first
const TITLE_MAX = 120

export interface ConfirmedTitle {
  title: string
  /** Catalogue year / type as answered when the title was confirmed. Stored for a future year-aware lookup; not used to guess. */
  year?: string
  type?: string
}

const keyOf = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

function parse(raw: string | null): ConfirmedTitle[] {
  if (!raw) return []
  const data: unknown = JSON.parse(raw)
  if (!Array.isArray(data)) return []
  const out: ConfirmedTitle[] = []
  const seen = new Set<string>()
  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    const { title, year, type } = item as Record<string, unknown>
    if (typeof title !== 'string') continue
    const clean = title.trim().replace(/\s+/g, ' ')
    const k = keyOf(clean)
    if (!clean || clean.length > TITLE_MAX || !k || seen.has(k)) continue
    seen.add(k)
    out.push({ title: clean, ...(typeof year === 'string' && year.length <= 12 ? { year } : {}), ...(typeof type === 'string' && type.length <= 16 ? { type } : {}) })
    if (out.length >= CONFIRMED_MAX) break
  }
  return out
}

/** Most recent first. A corrupt value or a throwing store behaves as an empty list. */
export function loadConfirmed(store: KeyValueStore): ConfirmedTitle[] {
  try {
    return parse(store.getItem(CONFIRMED_KEY))
  } catch {
    return []
  }
}

/** Remembers a catalogue-confirmed title (moves it to the front if known, drops the oldest beyond the cap). Returns the new list. */
export function addConfirmed(store: KeyValueStore, entry: ConfirmedTitle): ConfirmedTitle[] {
  const title = entry.title.trim().replace(/\s+/g, ' ')
  const k = keyOf(title)
  if (!title || title.length > TITLE_MAX || !k) return loadConfirmed(store)
  const next = [{ ...entry, title }, ...loadConfirmed(store).filter(c => keyOf(c.title) !== k)].slice(0, CONFIRMED_MAX)
  try {
    store.setItem(CONFIRMED_KEY, JSON.stringify(next))
  } catch {
    // quota exceeded / storage blocked: the in-memory vocabulary still learns it for this session
  }
  return next
}

export function clearConfirmed(store: KeyValueStore): void {
  try {
    store.removeItem(CONFIRMED_KEY)
  } catch {
    // nothing to clear if storage is unavailable
  }
}

/** The vocabulary the AR page reads with: the built-in popular titles plus everything this device has confirmed. */
export function buildVocabulary(store: KeyValueStore): Vocabulary {
  return createVocabulary([...loadConfirmed(store).map(c => c.title), ...POPULAR_TITLES])
}
