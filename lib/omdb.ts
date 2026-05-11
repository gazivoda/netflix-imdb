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

type OmdbResponse = {
  Response: string
  imdbID?: string
  Title?: string
  Year?: string
  Type?: string
  imdbRating?: string
  imdbVotes?: string
  Ratings?: { Source: string; Value: string }[]
}

export async function searchTitle(
  query: string,
  apiKey = process.env.OMDB_API_KEY ?? ''
): Promise<OmdbTitle | null> {
  const url = `${OMDB_API_BASE}/?t=${encodeURIComponent(query)}&apikey=${apiKey}`

  let res: Response
  try {
    res = await fetch(url)
  } catch {
    return null
  }

  if (!res.ok) return null

  let data: OmdbResponse
  try {
    data = await res.json()
  } catch {
    return null
  }

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
