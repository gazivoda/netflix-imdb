import { POST } from '../../app/api/ratings/route'
import { NextRequest } from 'next/server'

const mockFetch = jest.fn()
global.fetch = mockFetch as typeof fetch

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ratings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  beforeEach(() => mockFetch.mockReset())

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
})
