const IMDB_API_BASE = 'https://api.imdbapi.dev'

export interface ImdbTitle {
  imdbId: string
  title: string
  year: number
  type: string
  rating: number | null
  voteCount: number | null
}

export async function searchTitle(query: string): Promise<ImdbTitle | null> {
  const url = `${IMDB_API_BASE}/titles?primaryTitle=${encodeURIComponent(query)}`
  const res = await fetch(url)
  if (!res.ok) return null

  let data: { titles?: { id: string; primaryTitle: string; startYear: number; type: string; rating?: { aggregateRating: number; voteCount: number } }[] }
  try {
    data = await res.json()
  } catch {
    return null
  }

  const first = data.titles?.[0]
  if (!first) return null

  return {
    imdbId: first.id,
    title: first.primaryTitle,
    year: first.startYear,
    type: first.type,
    rating: first.rating?.aggregateRating ?? null,
    voteCount: first.rating?.voteCount ?? null,
  }
}
