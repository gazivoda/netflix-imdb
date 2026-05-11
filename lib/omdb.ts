const OMDB_API_BASE = 'https://www.omdbapi.com'

export interface OmdbTitle {
  imdbId: string
  title: string
  year: number
  type: string
  rating: number | null
  voteCount: number | null
  rtRating: number | null
}

type OmdbDetailResponse = {
  Response: string
  imdbID?: string
  Title?: string
  Year?: string
  Type?: string
  imdbRating?: string
  imdbVotes?: string
  Ratings?: { Source: string; Value: string }[]
}

type OmdbSearchResponse = {
  Response: string
  Search?: { Title: string; Year: string; imdbID: string }[]
}

function parseDetail(data: OmdbDetailResponse): OmdbTitle | null {
  if (data.Response !== 'True' || !data.imdbID) return null

  const rating =
    data.imdbRating && data.imdbRating !== 'N/A'
      ? parseFloat(data.imdbRating)
      : null

  const voteCount =
    data.imdbVotes && data.imdbVotes !== 'N/A'
      ? parseInt(data.imdbVotes.replace(/,/g, ''), 10)
      : null

  const rtEntry = data.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')
  const rtParsed = rtEntry ? parseInt(rtEntry.Value.replace('%', ''), 10) : null
  const rtRating = rtParsed !== null && !Number.isNaN(rtParsed) ? rtParsed : null

  return {
    imdbId: data.imdbID,
    title: data.Title ?? '',
    year: data.Year && data.Year !== 'N/A' ? parseInt(data.Year, 10) : 0,
    type: data.Type ?? '',
    rating,
    voteCount,
    rtRating,
  }
}

export async function searchTitle(
  query: string,
  apiKey = process.env.OMDB_API_KEY ?? ''
): Promise<OmdbTitle | null> {
  // Step 1: search to resolve ambiguous titles (e.g. two films named "Cover-Up").
  // Pick the exact-title match with the most recent year; fall back to ?t= if search fails.
  let candidateId: string | null = null
  try {
    const searchRes = await fetch(`${OMDB_API_BASE}/?s=${encodeURIComponent(query)}&apikey=${apiKey}`)
    if (searchRes.ok) {
      const searchData: OmdbSearchResponse = await searchRes.json()
      if (searchData.Response === 'True' && searchData.Search?.length) {
        const normalized = query.toLowerCase().trim()
        const exact = searchData.Search
          .filter(r => r.Title.toLowerCase().trim() === normalized)
          .sort((a, b) => (parseInt(b.Year) || 0) - (parseInt(a.Year) || 0))
        candidateId = (exact[0] ?? searchData.Search[0]).imdbID
      }
    }
  } catch {
    // search failed — fall through to ?t= below
  }

  // Step 2: fetch full details (by imdbID when resolved, else by title)
  const detailUrl = candidateId
    ? `${OMDB_API_BASE}/?i=${candidateId}&apikey=${apiKey}`
    : `${OMDB_API_BASE}/?t=${encodeURIComponent(query)}&apikey=${apiKey}`

  let res: Response
  try {
    res = await fetch(detailUrl)
  } catch {
    return null
  }

  if (!res.ok) return null

  let data: OmdbDetailResponse
  try {
    data = await res.json()
  } catch {
    return null
  }

  return parseDetail(data)
}
