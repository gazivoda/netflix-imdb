import { lookupTitle, OMDB_TIMEOUT_MS, searchTitle } from '../../lib/omdb'
import { resetOmdbBudgetForTests } from '../../lib/omdb-budget'

const mockFetch = jest.fn()
global.fetch = mockFetch as typeof fetch

describe('searchTitle', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns both imdb and rt ratings from a full OMDB response', async () => {
    mockFetch.mockResolvedValue({
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
      }),
    })

    const result = await searchTitle('Inception')
    expect(result).toEqual({
      imdbId: 'tt1375666',
      title: 'Inception',
      year: 2010,
      type: 'movie',
      rating: 8.8,
      voteCount: 2500000,
      rtRating: 87,
    })
  })

  it('returns rtRating: null when Ratings array has no RT entry', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        Response: 'True',
        imdbID: 'tt1375666',
        Title: 'Inception',
        Year: '2010',
        Type: 'movie',
        imdbRating: '8.8',
        imdbVotes: '2,500,000',
        Ratings: [],
      }),
    })

    const result = await searchTitle('Inception')
    expect(result?.rtRating).toBeNull()
  })

  it('returns rating: null and voteCount: null when values are N/A', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        Response: 'True',
        imdbID: 'tt9999999',
        Title: 'Some Show',
        Year: '2020',
        Type: 'series',
        imdbRating: 'N/A',
        imdbVotes: 'N/A',
        Ratings: [],
      }),
    })

    const result = await searchTitle('Some Show')
    expect(result?.rating).toBeNull()
    expect(result?.voteCount).toBeNull()
  })

  it('returns null when OMDB Response is False', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ Response: 'False', Error: 'Movie not found!' }),
    })

    const result = await searchTitle('nonexistent title')
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    const result = await searchTitle('Inception')
    expect(result).toBeNull()
  })

  it('returns null when fetch response is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const result = await searchTitle('Inception')
    expect(result).toBeNull()
  })

  it('picks the most recent exact match when multiple titles share the same name', async () => {
    // Call 1: ?t= returns the 1991 film (no RT data) — triggers disambiguation path
    // Call 2: ?s= returns both candidates
    // Call 3: ?i= fetches the newer 2025 candidate
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Response: 'True',
          imdbID: 'tt0099312',
          Title: 'Cover-Up',
          Year: '1991',
          Type: 'movie',
          imdbRating: '5.0',
          imdbVotes: '2,000',
          Ratings: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Response: 'True',
          Search: [
            { Title: 'Cover-Up', Year: '1991', imdbID: 'tt0099312', Type: 'movie' },
            { Title: 'Cover-Up', Year: '2025', imdbID: 'tt37660887', Type: 'movie' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Response: 'True',
          imdbID: 'tt37660887',
          Title: 'Cover-Up',
          Year: '2025',
          Type: 'movie',
          imdbRating: '7.5',
          imdbVotes: '1,034',
          Ratings: [{ Source: 'Rotten Tomatoes', Value: '98%' }],
        }),
      })

    const result = await searchTitle('Cover-Up')
    // third fetch must request the 2025 imdbID
    expect((mockFetch.mock.calls[2][0] as string)).toContain('tt37660887')
    expect(result?.year).toBe(2025)
    expect(result?.rtRating).toBe(98)
  })

  it('returns year: 0 when Year is N/A', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        Response: 'True',
        imdbID: 'tt9999999',
        Title: 'Some Show',
        Year: 'N/A',
        Type: 'series',
        imdbRating: '8.0',
        imdbVotes: '1,000',
        Ratings: [],
      }),
    })

    const result = await searchTitle('Some Show')
    expect(result?.year).toBe(0)
    expect(Number.isNaN(result?.year)).toBe(false)
  })
})

describe('lookupTitle', () => {
  beforeEach(() => mockFetch.mockReset())

  const inception = {
    Response: 'True',
    imdbID: 'tt1375666',
    Title: 'Inception',
    Year: '2010',
    Type: 'movie',
    imdbRating: '8.8',
    imdbVotes: '2,500,000',
    Ratings: [{ Source: 'Rotten Tomatoes', Value: '87%' }],
  }

  it('returns found with the parsed title', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => inception })
    const result = await lookupTitle('Inception')
    expect(result).toEqual({
      status: 'found',
      title: {
        imdbId: 'tt1375666',
        title: 'Inception',
        year: 2010,
        type: 'movie',
        rating: 8.8,
        voteCount: 2500000,
        rtRating: 87,
      },
    })
  })

  it('returns not_found for "Movie not found!"', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ Response: 'False', Error: 'Movie not found!' }),
    })
    expect(await lookupTitle('nonexistent title')).toEqual({ status: 'not_found' })
  })

  it('returns error when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    expect(await lookupTitle('Inception')).toEqual({ status: 'error' })
  })

  it('returns error when the response is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    expect(await lookupTitle('Inception')).toEqual({ status: 'error' })
  })

  it('returns error when the body is not valid JSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('bad json')
      },
    })
    expect(await lookupTitle('Inception')).toEqual({ status: 'error' })
  })

  it('returns error on "Request limit reached!"', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ Response: 'False', Error: 'Request limit reached!' }),
    })
    expect(await lookupTitle('Inception')).toEqual({ status: 'error' })
  })

  it('returns error on "Invalid API key!"', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ Response: 'False', Error: 'Invalid API key!' }),
    })
    expect(await lookupTitle('Inception')).toEqual({ status: 'error' })
  })

  it('still returns found when the follow-up search fails', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...inception, Ratings: [] }),
      })
      .mockRejectedValueOnce(new Error('network error'))

    const result = await lookupTitle('Inception')
    expect(result.status).toBe('found')
    expect(result.status === 'found' && result.title.imdbId).toBe('tt1375666')
  })

  it('still returns found when the follow-up detail call hits the rate limit', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...inception, Ratings: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Response: 'True',
          Search: [{ Title: 'Inception', Year: '2025', imdbID: 'tt0000001' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Response: 'False', Error: 'Request limit reached!' }),
      })

    const result = await lookupTitle('Inception')
    expect(result.status === 'found' && result.title.imdbId).toBe('tt1375666')
  })
})

describe('OMDb request timeout and budget', () => {
  beforeEach(() => { mockFetch.mockReset(); resetOmdbBudgetForTests() })
  afterEach(() => resetOmdbBudgetForTests())

  it('passes an AbortSignal with a timeout on every request', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ Response: 'False', Error: 'Movie not found!' }) })
    await lookupTitle('Inception')
    const init = mockFetch.mock.calls[0][1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(OMDB_TIMEOUT_MS).toBeLessThanOrEqual(10_000)
  })

  it('treats a request that times out as an error (not "not found"), so it is never cached', async () => {
    mockFetch.mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }))
    expect(await lookupTitle('Inception')).toEqual({ status: 'error' })
  })

  it('does not call OMDb once the daily budget is spent', async () => {
    process.env.OMDB_DAILY_BUDGET = '1'
    try {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ Response: 'False', Error: 'Movie not found!' }) })
      expect(await lookupTitle('One')).toEqual({ status: 'not_found' })
      expect(await lookupTitle('Two')).toEqual({ status: 'error' })
      expect(mockFetch).toHaveBeenCalledTimes(1)
    } finally {
      delete process.env.OMDB_DAILY_BUDGET
    }
  })
})
