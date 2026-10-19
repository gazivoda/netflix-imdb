// Primitive JSON-file document store for OMDb rating lookups, keyed by normalised
// title. Single-process only: the whole file is held in memory and rewritten on
// change, so running several Node workers against one file loses writes.
import fs from 'fs'
import path from 'path'
import type { OmdbTitle } from '@/lib/omdb'

export const FRESH_FOUND_MS = 7 * 24 * 3600 * 1000
export const FRESH_NOT_FOUND_MS = 24 * 3600 * 1000

const FLUSH_DELAY_MS = 200
const FILE_VERSION = 1

export interface RatingDoc {
  key: string
  query: string
  /** null = OMDb said the title does not exist */
  result: OmdbTitle | null
  /** ISO timestamp of the last successful lookup */
  updatedAt: string
}

export interface RatingsStore {
  get(title: string): RatingDoc | undefined
  getFresh(title: string, now?: number): RatingDoc | undefined
  set(title: string, result: OmdbTitle | null, now?: number): void
  flush(): Promise<void>
  size(): number
}

export function normalizeKey(title: string): string {
  return title.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ')
}

function isDoc(value: unknown): value is RatingDoc {
  if (value === null || typeof value !== 'object') return false
  const d = value as Record<string, unknown>
  return (
    typeof d.key === 'string' &&
    typeof d.query === 'string' &&
    typeof d.updatedAt === 'string' &&
    (d.result === null || (typeof d.result === 'object' && !Array.isArray(d.result)))
  )
}

function loadDocs(file: string): Map<string, RatingDoc> {
  const docs = new Map<string, RatingDoc>()
  let raw: string
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    return docs // missing or unreadable: start empty
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = undefined
  }

  const valid =
    parsed !== null &&
    typeof parsed === 'object' &&
    (parsed as Record<string, unknown>).version === FILE_VERSION &&
    typeof (parsed as Record<string, unknown>).docs === 'object' &&
    (parsed as Record<string, unknown>).docs !== null &&
    !Array.isArray((parsed as Record<string, unknown>).docs)

  if (!valid) {
    const backup = `${file}.corrupt-${Date.now()}`
    try {
      fs.renameSync(file, backup)
      console.warn(`ratings-store: ${file} is not a valid store, moved to ${backup}`)
    } catch (err) {
      console.warn(`ratings-store: ${file} is not a valid store and could not be moved`, err)
    }
    return docs
  }

  const entries = (parsed as { docs: Record<string, unknown> }).docs
  for (const [key, doc] of Object.entries(entries)) {
    if (isDoc(doc)) docs.set(key, doc)
  }
  return docs
}

export function createRatingsStore(opts: { path?: string } = {}): RatingsStore {
  const file = path.resolve(
    process.cwd(),
    opts.path ?? process.env.RATINGS_DB_PATH ?? '.data/ratings.json'
  )
  let docs: Map<string, RatingDoc> | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let dirty = false
  let writing: Promise<void> = Promise.resolve()

  function ensureLoaded(): Map<string, RatingDoc> {
    if (docs === null) docs = loadDocs(file)
    return docs
  }

  async function writeNow(): Promise<void> {
    if (!dirty || docs === null) return
    dirty = false
    const payload = JSON.stringify({ version: FILE_VERSION, docs: Object.fromEntries(docs) })
    const tmp = `${file}.tmp`
    try {
      await fs.promises.mkdir(path.dirname(file), { recursive: true })
      await fs.promises.writeFile(tmp, payload, 'utf8')
      await fs.promises.rename(tmp, file)
    } catch (err) {
      dirty = true // keep the data eligible for the next flush
      console.error('ratings-store: failed to write', file, err)
    }
  }

  // Chain writes so two never interleave on the tmp file.
  function enqueueWrite(): Promise<void> {
    writing = writing.then(writeNow)
    return writing
  }

  function schedule(): void {
    if (timer !== null) return
    timer = setTimeout(() => {
      timer = null
      void enqueueWrite()
    }, FLUSH_DELAY_MS)
    timer.unref?.()
  }

  return {
    get(title) {
      return ensureLoaded().get(normalizeKey(title))
    },

    getFresh(title, now = Date.now()) {
      const doc = ensureLoaded().get(normalizeKey(title))
      if (!doc) return undefined
      const stored = Date.parse(doc.updatedAt)
      if (Number.isNaN(stored)) return undefined
      const age = now - stored
      if (age < 0) return undefined
      // A title with no score yet (or unknown to OMDb) is retried sooner than a scored one.
      const hasScore = doc.result !== null && (doc.result.rating !== null || doc.result.rtRating !== null)
      const ttl = hasScore ? FRESH_FOUND_MS : FRESH_NOT_FOUND_MS
      return age < ttl ? doc : undefined
    },

    set(title, result, now = Date.now()) {
      const key = normalizeKey(title)
      ensureLoaded().set(key, {
        key,
        query: title,
        result,
        updatedAt: new Date(now).toISOString(),
      })
      dirty = true
      schedule()
    },

    async flush() {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      await enqueueWrite()
    },

    size() {
      return ensureLoaded().size
    },
  }
}

let singleton: RatingsStore | null = null

export function getRatingsStore(): RatingsStore {
  if (singleton === null) singleton = createRatingsStore()
  return singleton
}

export function resetRatingsStoreForTests(): void {
  singleton = null
}
