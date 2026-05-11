import { searchTitle } from '../../lib/omdb'

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
    mockFetch
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
    // detail fetch must use the 2025 imdbID, not the 1991 one
    expect((mockFetch.mock.calls[1][0] as string)).toContain('tt37660887')
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
