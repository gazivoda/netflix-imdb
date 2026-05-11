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

async function fetchDetail(url: string): Promise<OmdbTitle | null> {
  let res: Response
  try {
    res = await fetch(url)
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

export async function searchTitle(
  query: string,
  apiKey = process.env.OMDB_API_KEY ?? ''
): Promise<OmdbTitle | null> {
  // Step 1: direct lookup — 1 API call for the common case.
  const direct = await fetchDetail(`${OMDB_API_BASE}/?t=${encodeURIComponent(query)}&apikey=${apiKey}`)

  // Found with RT data, or not found at all → return immediately (1 call total).
  if (direct === null || direct.rtRating !== null) return direct

  // Found but no RT score: the ?t= endpoint may have picked the wrong entry when
  // multiple titles share the same name (e.g. Cover-Up 1991 vs Cover-Up 2025).
  // Search for a newer exact-title match that has RT data.
  try {
    const searchRes = await fetch(`${OMDB_API_BASE}/?s=${encodeURIComponent(query)}&apikey=${apiKey}`)
    if (!searchRes.ok) return direct
    const searchData: OmdbSearchResponse = await searchRes.json()
    if (searchData.Response !== 'True' || !searchData.Search?.length) return direct

    const normalized = query.toLowerCase().trim()
    const exact = searchData.Search
      .filter(r => r.Title.toLowerCase().trim() === normalized)
      .sort((a, b) => (parseInt(b.Year) || 0) - (parseInt(a.Year) || 0))

    const best = exact[0]
    if (!best || best.imdbID === direct.imdbId) return direct

    // A different (newer) candidate exists — fetch its full details.
    const better = await fetchDetail(`${OMDB_API_BASE}/?i=${best.imdbID}&apikey=${apiKey}`)
    return better ?? direct
  } catch {
    return direct
  }
}
