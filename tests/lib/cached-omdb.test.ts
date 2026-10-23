import fs from 'fs'
import os from 'os'
import path from 'path'
import { getRating } from '../../lib/cached-omdb'
import {
  FRESH_FOUND_MS,
  FRESH_NOT_FOUND_MS,
  getRatingsStore,
  resetRatingsStoreForTests,
} from '../../lib/ratings-store'

const mockFetch = jest.fn()
global.fetch = mockFetch as typeof fetch

const DAY = 24 * 3600 * 1000

function found(title = 'Inception', rt = '87%') {
  return {
    ok: true,
    json: async () => ({
      Response: 'True',
      imdbID: 'tt1375666',
      Title: title,
      Year: '2010',
      Type: 'movie',
      imdbRating: '8.8',
      imdbVotes: '2,500,000',
      Ratings: [{ Source: 'Rotten Tomatoes', Value: rt }],
    }),
  }
}

const notFound = () => ({
  ok: true,
  json: async () => ({ Response: 'False', Error: 'Movie not found!' }),
})

const rateLimited = () => ({
  ok: true,
  json: async () => ({ Response: 'False', Error: 'Request limit reached!' }),
})

describe('getRating', () => {
  let dbDir: string
  let dbPath: string

  beforeEach(() => {
    mockFetch.mockReset()
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cached-omdb-'))
    dbPath = path.join(dbDir, 'ratings.json')
    process.env.RATINGS_DB_PATH = dbPath
    resetRatingsStoreForTests()
  })

  afterEach(async () => {
    await getRatingsStore().flush()
    resetRatingsStoreForTests()
    delete process.env.RATINGS_DB_PATH
    fs.rmSync(dbDir, { recursive: true, force: true })
  })

  it('calls OMDb once, then serves the stored rating without another request', async () => {
    mockFetch.mockResolvedValue(found())
    const first = await getRating('Inception')
    const second = await getRating('Inception')

    expect(first?.rating).toBe(8.8)
    expect(second).toEqual(first)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('treats differently cased and spaced titles as the same entry', async () => {
    mockFetch.mockResolvedValue(found())
    await getRating('Inception')
    await getRating('  inception ')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('shares one lookup between concurrent requests for the same title', async () => {
    mockFetch.mockResolvedValue(found())
    const [a, b, c] = await Promise.all([
      getRating('Inception'),
      getRating('inception'),
      getRating('Inception'),
    ])
    expect(a).toEqual(b)
    expect(b).toEqual(c)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('refetches once a found entry is older than 7 days', async () => {
    mockFetch.mockResolvedValue(found())
    await getRating('Inception')
    const store = getRatingsStore()
    const doc = store.get('Inception')!
    store.set('Inception', doc.result, Date.now() - FRESH_FOUND_MS - DAY)

    mockFetch.mockResolvedValue(found('Inception', '90%'))
    const refreshed = await getRating('Inception')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(refreshed?.rtRating).toBe(90)
  })

  it('keeps a 6-day-old entry without refetching', async () => {
    mockFetch.mockResolvedValue(found())
    await getRating('Inception')
    const store = getRatingsStore()
    store.set('Inception', store.get('Inception')!.result, Date.now() - 6 * DAY)

    await getRating('Inception')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('stores "not found" and retries it after one day', async () => {
    mockFetch.mockResolvedValue(notFound())
    expect(await getRating('Nope Nope')).toBeNull()
    expect(await getRating('Nope Nope')).toBeNull()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    getRatingsStore().set('Nope Nope', null, Date.now() - FRESH_NOT_FOUND_MS - 60_000)
    await getRating('Nope Nope')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('does not cache a rate-limited lookup', async () => {
    mockFetch.mockResolvedValue(rateLimited())
    expect(await getRating('Inception')).toBeNull()
    expect(getRatingsStore().get('Inception')).toBeUndefined()

    mockFetch.mockResolvedValue(found())
    expect((await getRating('Inception'))?.rating).toBe(8.8)
  })

  it('does not cache a network failure', async () => {
    mockFetch.mockRejectedValue(new Error('offline'))
    expect(await getRating('Inception')).toBeNull()
    expect(getRatingsStore().get('Inception')).toBeUndefined()
  })

  it('serves the stale rating when OMDb fails', async () => {
    mockFetch.mockResolvedValue(found())
    await getRating('Inception')
    const store = getRatingsStore()
    store.set('Inception', store.get('Inception')!.result, Date.now() - 30 * DAY)

    mockFetch.mockResolvedValue(rateLimited())
    const result = await getRating('Inception')

    expect(result?.rating).toBe(8.8)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('persists ratings to disk so a restart does not call OMDb again', async () => {
    mockFetch.mockResolvedValue(found())
    await getRating('Inception')
    await getRatingsStore().flush()

    resetRatingsStoreForTests()
    const again = await getRating('Inception')

    expect(again?.rating).toBe(8.8)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('retries a title that OMDb knows but has no score for after one day', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ Response: 'True', imdbID: 'tt9', Title: 'New Show', Year: '2026', Type: 'series' }),
    })
    const first = await getRating('New Show')
    expect(first).toMatchObject({ rating: null, rtRating: null })

    // A scoreless title makes two OMDb calls (direct + follow-up search); remember the count.
    const callsAfterFirst = mockFetch.mock.calls.length
    await getRating('New Show')
    expect(mockFetch).toHaveBeenCalledTimes(callsAfterFirst)

    getRatingsStore().set('New Show', first, Date.now() - FRESH_NOT_FOUND_MS - 60_000)
    await getRating('New Show')
    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })

  it('a light lookup without a Rotten Tomatoes score is not stored, so the full lookup can still improve on it', async () => {
    const noRt = { ok: true, json: async () => ({ Response: 'True', imdbID: 'tt1', Title: 'Cover-Up', Year: '1991', Type: 'movie', imdbRating: '5.0', imdbVotes: '2,000', Ratings: [] }) }
    mockFetch.mockResolvedValue(noRt)
    const light = await getRating('Cover-Up', { light: true })
    expect(light?.title).toBe('Cover-Up')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(getRatingsStore().getFresh('Cover-Up')).toBeUndefined()
  })

  it('a light lookup that already has scores is stored like a full one', async () => {
    mockFetch.mockResolvedValue(found())
    await getRating('Inception', { light: true })
    expect(getRatingsStore().getFresh('Inception')).toBeTruthy()
    await getRating('Inception')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
