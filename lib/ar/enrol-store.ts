// In-page enrolment: the user points at a card, types its title, and the hash is persisted.
// Storage is injected so the same code runs on window.localStorage, in tests and in a future native app.

import { hashCard, RgbaImage } from '../card-hash'
import { deserializeIndex, IndexEntry, serializeIndex } from '../card-index'

export interface KeyValueStore {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

export const STORAGE_KEY = 'ar-card-index-v1'

export function loadIndex(store: KeyValueStore): IndexEntry[] {
  try {
    const raw = store.getItem(STORAGE_KEY)
    return raw ? deserializeIndex(JSON.parse(raw)) : []
  } catch {
    return [] // corrupt JSON or a throwing store (private mode): behave as an empty index
  }
}

function save(store: KeyValueStore, index: IndexEntry[]): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(serializeIndex(index)))
  } catch {
    // quota exceeded / storage blocked: the in-memory index we return still works for this session
  }
}

// Case- and whitespace-insensitive, so re-enrolling "  the OFFICE" replaces "The Office".
const idFor = (title: string) => title.trim().replace(/\s+/g, ' ').toLowerCase()

export function enrolCard(store: KeyValueStore, title: string, crop: RgbaImage, year?: string): IndexEntry[] {
  const clean = title.trim().replace(/\s+/g, ' ')
  if (!clean) return loadIndex(store)
  const id = idFor(clean)
  const entry: IndexEntry = { id, title: clean, year, hash: hashCard(crop) }
  const next = [...loadIndex(store).filter(e => e.id !== id), entry]
  save(store, next)
  return next
}

export function removeCard(store: KeyValueStore, id: string): IndexEntry[] {
  const next = loadIndex(store).filter(e => e.id !== id)
  save(store, next)
  return next
}

export function clearIndex(store: KeyValueStore): void {
  try {
    store.removeItem(STORAGE_KEY)
  } catch {
    // nothing to clear if storage is unavailable
  }
}
