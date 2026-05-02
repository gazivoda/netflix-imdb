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
  })

  it('returns 200 with results for valid titles', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        titles: [
          {
            id: 'tt1375666',
            primaryTitle: 'Inception',
            startYear: 2010,
            type: 'movie',
            rating: { aggregateRating: 8.8, voteCount: 2500000 },
          },
        ],
      }),
    })

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
    })
  })

  it('marks title as found:false when IMDB returns no match', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ titles: [] }),
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
    mockFetch
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          titles: [
            {
              id: 'tt0903747',
              primaryTitle: 'Breaking Bad',
              startYear: 2008,
              type: 'tvSeries',
              rating: { aggregateRating: 9.5, voteCount: 2609166 },
            },
          ],
        }),
      })

    const res = await POST(makeRequest({ titles: ['bad title', 'Breaking Bad'] }))
    const body = await res.json()

    expect(body[0]).toEqual({ query: 'bad title', found: false })
    expect(body[1].found).toBe(true)
    expect(body[1].title).toBe('Breaking Bad')
  })
})
