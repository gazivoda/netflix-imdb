import { searchTitle } from '../../lib/imdb'

const mockFetch = jest.fn()
global.fetch = mockFetch as typeof fetch

describe('searchTitle', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns title data when search succeeds', async () => {
    mockFetch.mockResolvedValueOnce({
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

    const result = await searchTitle('Inception')

    expect(result).toEqual({
      imdbId: 'tt1375666',
      title: 'Inception',
      year: 2010,
      type: 'movie',
      rating: 8.8,
      voteCount: 2500000,
    })
  })

  it('returns null when titles array is empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ titles: [], totalCount: 0 }),
    })

    const result = await searchTitle('xyz nonexistent')

    expect(result).toBeNull()
  })

  it('returns null when API response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    const result = await searchTitle('Inception')

    expect(result).toBeNull()
  })

  it('encodes the title in the request URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ titles: [] }),
    })

    await searchTitle('The Dark Knight')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.imdbapi.dev/titles?primaryTitle=The%20Dark%20Knight'
    )
  })

  it('handles missing rating gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        titles: [
          {
            id: 'tt9999999',
            primaryTitle: 'Obscure Film',
            startYear: 2023,
            type: 'movie',
          },
        ],
      }),
    })

    const result = await searchTitle('Obscure Film')

    expect(result).toEqual({
      imdbId: 'tt9999999',
      title: 'Obscure Film',
      year: 2023,
      type: 'movie',
      rating: null,
      voteCount: null,
    })
  })

  it('returns null when response JSON is invalid', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token') },
    })

    const result = await searchTitle('Inception')

    expect(result).toBeNull()
  })
})
