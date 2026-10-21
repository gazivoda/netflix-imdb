import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  FRESH_FOUND_MS,
  FRESH_NOT_FOUND_MS,
  MAX_ENTRIES,
  createRatingsStore,
  normalizeKey,
} from '../../lib/ratings-store'
import type { OmdbTitle } from '../../lib/omdb'

const HOUR = 3600 * 1000
const DAY = 24 * HOUR
const T0 = Date.UTC(2026, 9, 19, 12, 0, 0)

const inception: OmdbTitle = {
  imdbId: 'tt1375666',
  title: 'Inception',
  year: 2010,
  type: 'movie',
  rating: 8.8,
  voteCount: 2500000,
  rtRating: 87,
}

let dir: string
let file: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ratings-store-'))
  file = path.join(dir, 'ratings.json')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('normalizeKey', () => {
  it('lowercases, trims and collapses whitespace', () => {
    expect(normalizeKey('  The   Dark\tKnight \n')).toBe('the dark knight')
  })

  it('normalises Unicode to NFC', () => {
    expect(normalizeKey('Café')).toBe(normalizeKey('Café'))
  })
})

describe('createRatingsStore', () => {
  it('round-trips a doc and finds it under a differently written title', () => {
    const store = createRatingsStore({ path: file })
    expect(store.get('Inception')).toBeUndefined()
    store.set('Inception', inception, T0)
    expect(store.size()).toBe(1)
    expect(store.get('  INCEPTION ')).toEqual({
      key: 'inception',
      query: 'Inception',
      result: inception,
      updatedAt: new Date(T0).toISOString(),
    })
  })

  it('persists across a second store on the same path after flush', async () => {
    const a = createRatingsStore({ path: file })
    a.set('Inception', inception, T0)
    a.set('Nope Nope', null, T0)
    await a.flush()

    const b = createRatingsStore({ path: file })
    expect(b.size()).toBe(2)
    expect(b.get('inception')?.result).toEqual(inception)
    expect(b.get('nope nope')?.result).toBeNull()
    expect(fs.existsSync(`${file}.tmp`)).toBe(false)
  })

  it('treats found docs as fresh just under 7 days and stale just over', () => {
    const store = createRatingsStore({ path: file })
    store.set('Inception', inception, T0)
    expect(store.getFresh('Inception', T0 + 6 * DAY + 23 * HOUR)).toBeDefined()
    expect(store.getFresh('Inception', T0 + 7 * DAY + 60 * 1000)).toBeUndefined()
    expect(FRESH_FOUND_MS).toBe(7 * DAY)
  })

  it('treats not-found docs as fresh at 23h and stale at 25h', () => {
    const store = createRatingsStore({ path: file })
    store.set('Missing Title', null, T0)
    expect(store.getFresh('Missing Title', T0 + 23 * HOUR)).toBeDefined()
    expect(store.getFresh('Missing Title', T0 + 25 * HOUR)).toBeUndefined()
    expect(FRESH_NOT_FOUND_MS).toBe(DAY)
  })

  it('treats future-dated and unparsable timestamps as stale', async () => {
    const store = createRatingsStore({ path: file })
    store.set('Inception', inception, T0 + DAY)
    expect(store.getFresh('Inception', T0)).toBeUndefined()

    fs.writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        docs: {
          inception: { key: 'inception', query: 'Inception', result: inception, updatedAt: 'garbage' },
        },
      })
    )
    const other = createRatingsStore({ path: file })
    expect(other.get('Inception')).toBeDefined()
    expect(other.getFresh('Inception', T0)).toBeUndefined()
  })

  it('recovers from a corrupt file, keeping a .corrupt-* copy', () => {
    fs.writeFileSync(file, '{ not json')
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const store = createRatingsStore({ path: file })
    expect(store.size()).toBe(0)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()

    const backups = fs.readdirSync(dir).filter((f) => f.startsWith('ratings.json.corrupt-'))
    expect(backups).toHaveLength(1)
    expect(fs.readFileSync(path.join(dir, backups[0]), 'utf8')).toBe('{ not json')
  })

  it('starts empty on wrong-shape JSON and keeps the original', () => {
    fs.writeFileSync(file, JSON.stringify([1, 2, 3]))
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const store = createRatingsStore({ path: file })
    expect(store.size()).toBe(0)
    warn.mockRestore()
    expect(fs.readdirSync(dir).some((f) => f.includes('.corrupt-'))).toBe(true)
  })

  it('creates a missing parent directory on flush', async () => {
    const nested = path.join(dir, 'a', 'b', 'ratings.json')
    const store = createRatingsStore({ path: nested })
    store.set('Inception', inception, T0)
    await store.flush()
    expect(fs.existsSync(nested)).toBe(true)
  })

  it('does not lose rapid sets across a single flush', async () => {
    const store = createRatingsStore({ path: file })
    for (let i = 0; i < 50; i++) store.set(`Title ${i}`, null, T0)
    await store.flush()
    expect(createRatingsStore({ path: file }).size()).toBe(50)
  })

  it('does not throw when the write fails', async () => {
    const blocker = path.join(dir, 'blocker')
    fs.writeFileSync(blocker, 'a file, not a directory')
    const store = createRatingsStore({ path: path.join(blocker, 'ratings.json') })
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    store.set('Inception', inception, T0)
    await expect(store.flush()).resolves.toBeUndefined()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
    expect(store.get('Inception')).toBeDefined()
  })
})

describe('size cap and eviction', () => {
  it('evicts the oldest entries once the cap is exceeded', () => {
    const store = createRatingsStore({ path: file, maxEntries: 3 })
    for (const t of ['one', 'two', 'three', 'four']) store.set(t, inception, T0)
    expect(store.size()).toBe(3)
    expect(store.get('one')).toBeUndefined()
    for (const t of ['two', 'three', 'four']) expect(store.get(t)).toBeDefined()
  })

  it('a refreshed title counts as newest and survives eviction', () => {
    const store = createRatingsStore({ path: file, maxEntries: 3 })
    for (const t of ['one', 'two', 'three']) store.set(t, inception, T0)
    store.set('one', inception, T0 + HOUR) // refresh
    store.set('four', inception, T0 + 2 * HOUR)
    expect(store.get('one')).toBeDefined()
    expect(store.get('two')).toBeUndefined()
    expect(store.size()).toBe(3)
  })

  it('never exceeds the default cap of 5000 entries under a flood of distinct titles', () => {
    const store = createRatingsStore({ path: file })
    for (let i = 0; i < MAX_ENTRIES + 250; i++) store.set(`garbage ${i}`, null, T0 + i)
    expect(store.size()).toBe(MAX_ENTRIES)
    expect(store.get('garbage 0')).toBeUndefined()
    expect(store.get(`garbage ${MAX_ENTRIES + 249}`)).toBeDefined()
  })

  it('trims an oversized file on load, keeping the newest entries', async () => {
    const big = createRatingsStore({ path: file, maxEntries: 10 })
    for (let i = 0; i < 10; i++) big.set(`t${i}`, inception, T0 + i * 1000)
    await big.flush()
    const small = createRatingsStore({ path: file, maxEntries: 4 })
    expect(small.size()).toBe(4)
    expect(small.get('t9')).toBeDefined()
    expect(small.get('t5')).toBeUndefined()
  })
})

describe('atomic write', () => {
  const leftovers = () => fs.readdirSync(dir).filter((n) => n.endsWith('.tmp'))

  it('writes a temp file then renames it over the target, leaving no temp file behind', async () => {
    const rename = jest.spyOn(fs.promises, 'rename')
    try {
      const store = createRatingsStore({ path: file })
      store.set('Inception', inception, T0)
      await store.flush()
      expect(rename).toHaveBeenCalledTimes(1)
      const [from, to] = rename.mock.calls[0] as [string, string]
      expect(to).toBe(file)
      expect(from).not.toBe(file)
      expect(from.startsWith(file)).toBe(true)
      expect(JSON.parse(fs.readFileSync(file, 'utf8')).docs.inception.result.imdbId).toBe('tt1375666')
      expect(leftovers()).toEqual([])
    } finally {
      rename.mockRestore()
    }
  })

  it('a failed rename leaves the previous file intact, removes the temp file and retries on the next flush', async () => {
    const store = createRatingsStore({ path: file })
    store.set('Inception', inception, T0)
    await store.flush()
    const before = fs.readFileSync(file, 'utf8')

    const err = jest.spyOn(console, 'error').mockImplementation(() => {})
    const rename = jest.spyOn(fs.promises, 'rename').mockRejectedValueOnce(new Error('disk full'))
    try {
      store.set('Heat', inception, T0 + 1000)
      await store.flush()
      expect(fs.readFileSync(file, 'utf8')).toBe(before) // old content, never a partial file
      expect(JSON.parse(before).docs.heat).toBeUndefined()
      expect(leftovers()).toEqual([])
      expect(err).toHaveBeenCalled()
      await store.flush() // dirty was kept, so this one succeeds
      expect(JSON.parse(fs.readFileSync(file, 'utf8')).docs.heat).toBeDefined()
    } finally {
      rename.mockRestore()
      err.mockRestore()
    }
  })

  it('a failed write of the temp file never touches the target', async () => {
    const store = createRatingsStore({ path: file })
    store.set('Inception', inception, T0)
    await store.flush()
    const before = fs.readFileSync(file, 'utf8')
    const err = jest.spyOn(console, 'error').mockImplementation(() => {})
    const open = jest.spyOn(fs.promises, 'open').mockRejectedValueOnce(new Error('EIO'))
    try {
      store.set('Heat', inception, T0 + 1000)
      await store.flush()
      expect(fs.readFileSync(file, 'utf8')).toBe(before)
    } finally {
      open.mockRestore()
      err.mockRestore()
    }
  })
})
