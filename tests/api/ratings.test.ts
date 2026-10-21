import { POST } from '../../app/api/ratings/route'
import { NextRequest } from 'next/server'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getRatingsStore, resetRatingsStoreForTests } from '../../lib/ratings-store'
import { IP_BUCKET, MAX_BODY_BYTES, MAX_TITLE_LENGTH, resetRatingsGuardForTests } from '../../lib/ratings-guard'

const mockFetch = jest.fn()
global.fetch = mockFetch as typeof fetch

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/ratings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function omdbResponse(overrides = {}) {
  return {
    ok: true,
    json: async () => ({
      Response: 'True',
      imdbID: 'tt1375666',
      Title: 'Inception',
      Year: '2010',
      Type: 'movie',
      imdbRating: '8.8',
      imdbVotes: '2,500,000',
      Ratings: [{ Source: 'Rotten Tomatoes', Value: '87%' }],
      ...overrides,
    }),
  }
}

describe('POST /api/ratings', () => {
  let dbDir: string

  beforeEach(() => {
    mockFetch.mockReset()
    // Each test gets its own empty ratings store so cached titles never leak between tests.
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ratings-route-'))
    process.env.RATINGS_DB_PATH = path.join(dbDir, 'ratings.json')
    resetRatingsStoreForTests()
    resetRatingsGuardForTests()
    process.env.OMDB_API_KEY = 'test-key'
  })

  afterEach(async () => {
    await getRatingsStore().flush()
    resetRatingsStoreForTests()
    delete process.env.RATINGS_DB_PATH
    delete process.env.OMDB_API_KEY
    fs.rmSync(dbDir, { recursive: true, force: true })
  })

  it('returns 400 when titles is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('titles must be a non-empty array of strings')
  })

  it('returns 400 when titles is not an array', async () => {
    const res = await POST(makeRequest({ titles: 'Inception' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('titles must be a non-empty array of strings')
  })

  it('returns 400 when titles is empty', async () => {
    const res = await POST(makeRequest({ titles: [] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('titles must be a non-empty array of strings')
  })

  it('returns 400 when titles contains non-strings', async () => {
    const res = await POST(makeRequest({ titles: ['Inception', 42] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('titles must be a non-empty array of strings')
  })

  it('returns 400 when titles exceeds 20 items', async () => {
    const titles = Array.from({ length: 21 }, (_, i) => `Movie ${i}`)
    const res = await POST(makeRequest({ titles }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('maximum 20 titles per request')
  })

  it('returns 400 when request body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid JSON body')
  })

  it('returns 200 with both rating and rtRating for valid titles', async () => {
    mockFetch.mockResolvedValue(omdbResponse())

    const res = await POST(makeRequest({ titles: ['Inception'] }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0]).toEqual({
      query: 'Inception',
      found: true,
      imdbId: 'tt1375666',
      title: 'Inception',
      year: 2010,
      type: 'movie',
      rating: 8.8,
      voteCount: 2500000,
      rtRating: 87,
    })
  })

  it('returns rtRating: null when RT score is absent', async () => {
    mockFetch.mockResolvedValue(omdbResponse({ Ratings: [] }))

    const res = await POST(makeRequest({ titles: ['Inception'] }))
    const body = await res.json()
    expect(body[0].rtRating).toBeNull()
  })

  it('marks title as found:false when OMDB returns Response:False', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ Response: 'False', Error: 'Movie not found!' }),
    })

    const res = await POST(makeRequest({ titles: ['xyz not a real title'] }))
    const body = await res.json()
    expect(body[0]).toEqual({ query: 'xyz not a real title', found: false })
  })

  it('marks title as found:false when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))

    const res = await POST(makeRequest({ titles: ['Inception'] }))
    const body = await res.json()
    expect(body[0]).toEqual({ query: 'Inception', found: false })
  })

  it('isolates failures — one bad title does not affect others', async () => {
    // "bad title": ?t= throws. "Breaking Bad": ?t= returns full data with RT — 1 call only.
    mockFetch.mockImplementation((url: string) => {
      if ((url as string).includes('bad%20title')) {
        return Promise.reject(new Error('network error'))
      }
      if ((url as string).includes('?s=')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            Response: 'True',
            Search: [{ Title: 'Breaking Bad', Year: '2008', imdbID: 'tt0903747', Type: 'series' }],
          }),
        })
      }
      return Promise.resolve(omdbResponse({
        imdbID: 'tt0903747',
        Title: 'Breaking Bad',
        Year: '2008',
        Type: 'series',
        imdbRating: '9.5',
        imdbVotes: '2,609,166',
        Ratings: [{ Source: 'Rotten Tomatoes', Value: '96%' }],
      }))
    })

    const res = await POST(makeRequest({ titles: ['bad title', 'Breaking Bad'] }))
    const body = await res.json()

    expect(body[0]).toEqual({ query: 'bad title', found: false })
    expect(body[1].found).toBe(true)
    expect(body[1].title).toBe('Breaking Bad')
    expect(body[1].rtRating).toBe(96)
  })

  it('answers a repeated request from the store without calling OMDb', async () => {
    mockFetch.mockResolvedValue(omdbResponse())

    const first = await (await POST(makeRequest({ titles: ['Inception'] }))).json()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    const second = await (await POST(makeRequest({ titles: ['inception'] }))).json()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(second[0]).toMatchObject({ found: true, imdbId: first[0].imdbId, rating: 8.8, rtRating: 87 })
  })

  describe('title and body limits', () => {
    it('400s a title longer than 120 characters and never calls OMDb', async () => {
      const res = await POST(makeRequest({ titles: ['a'.repeat(MAX_TITLE_LENGTH + 1)] }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toMatch(/1 to 120/)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('accepts a title of exactly 120 characters', async () => {
      mockFetch.mockResolvedValue(omdbResponse())
      const res = await POST(makeRequest({ titles: ['a'.repeat(MAX_TITLE_LENGTH)] }))
      expect(res.status).toBe(200)
    })

    it.each([
      ['empty string', ''],
      ['whitespace only', '   \t '],
      ['control characters', 'Incep\u0000tion'],
      ['newline', 'Inception\n'],
      ['punctuation only', '!!! ???'],
    ])('400s %s', async (_n, title) => {
      const res = await POST(makeRequest({ titles: ['Inception', title] }))
      expect(res.status).toBe(400)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('413s a body above the size cap, by declared length and by actual size', async () => {
      const declared = new NextRequest('http://localhost/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'content-length': String(MAX_BODY_BYTES + 1) },
        body: JSON.stringify({ titles: ['Inception'] }),
      })
      expect((await POST(declared)).status).toBe(413)
      const actual = makeRequest({ titles: ['Inception'], padding: 'z'.repeat(MAX_BODY_BYTES) })
      expect((await POST(actual)).status).toBe(413)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('fits the largest legal request (20 titles of 120 characters) under the body cap', async () => {
      mockFetch.mockResolvedValue(omdbResponse())
      const titles = Array.from({ length: 20 }, (_, i) => String(i).padStart(2, '0') + 'é'.repeat(MAX_TITLE_LENGTH - 2))
      expect((await POST(makeRequest({ titles }))).status).toBe(200)
    })
  })

  describe('rate limiting', () => {
    const fromIp = (ip: string) => ({ 'x-forwarded-for': ip })

    it('429s with Retry-After after the per-IP budget, and other IPs are unaffected', async () => {
      mockFetch.mockResolvedValue(omdbResponse())
      for (let i = 0; i < IP_BUCKET.capacity; i++) {
        expect((await POST(makeRequest({ titles: ['Inception'] }, fromIp('203.0.113.7')))).status).toBe(200)
      }
      const limited = await POST(makeRequest({ titles: ['Inception'] }, fromIp('203.0.113.7')))
      expect(limited.status).toBe(429)
      expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1)
      expect((await limited.json()).error).toBe('too many requests')
      expect((await POST(makeRequest({ titles: ['Inception'] }, fromIp('198.51.100.9')))).status).toBe(200)
    })

    it('keys on the first X-Forwarded-For hop, so appended proxy hops do not matter', async () => {
      mockFetch.mockResolvedValue(omdbResponse())
      for (let i = 0; i < IP_BUCKET.capacity; i++) {
        await POST(makeRequest({ titles: ['Inception'] }, fromIp(`203.0.113.7, 10.0.0.${i}`)))
      }
      expect((await POST(makeRequest({ titles: ['Inception'] }, fromIp('203.0.113.7, 10.9.9.9')))).status).toBe(429)
    })

    it('falls back to one shared bucket when there is no X-Forwarded-For', async () => {
      mockFetch.mockResolvedValue(omdbResponse())
      for (let i = 0; i < IP_BUCKET.capacity; i++) await POST(makeRequest({ titles: ['Inception'] }))
      expect((await POST(makeRequest({ titles: ['Inception'] }))).status).toBe(429)
    })
  })

  describe('missing OMDb key', () => {
    it('503s with { error: "ratings unavailable" } and logs one console.error, not a 200 found:false', async () => {
      delete process.env.OMDB_API_KEY
      const err = jest.spyOn(console, 'error').mockImplementation(() => {})
      try {
        for (let i = 0; i < 3; i++) {
          const res = await POST(makeRequest({ titles: ['Inception'] }))
          expect(res.status).toBe(503)
          expect(await res.json()).toEqual({ error: 'ratings unavailable' })
        }
        expect(err).toHaveBeenCalledTimes(1)
        expect(JSON.stringify(err.mock.calls)).not.toMatch(/test-key/)
        expect(mockFetch).not.toHaveBeenCalled()
      } finally {
        err.mockRestore()
      }
    })

    it('treats a blank key as missing, but validation errors still win (400 before 503)', async () => {
      process.env.OMDB_API_KEY = '   '
      const err = jest.spyOn(console, 'error').mockImplementation(() => {})
      try {
        expect((await POST(makeRequest({ titles: [] }))).status).toBe(400)
        expect((await POST(makeRequest({ titles: ['Inception'] }))).status).toBe(503)
      } finally {
        err.mockRestore()
      }
    })
  })
})
