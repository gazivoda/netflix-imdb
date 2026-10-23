import { takeOmdbCall } from './omdb-budget'

const OMDB_API_BASE = 'https://www.omdbapi.com'
// A slow upstream must not pin a request (and its in-flight cache slot) indefinitely.
export const OMDB_TIMEOUT_MS = 8_000

// Every OMDb request goes through here: it spends the daily budget and gives up after the timeout.
// A refused or timed-out call is an 'error' for the caller, which never caches it and serves a stale rating instead.
function omdbFetch(url: string): Promise<Response> {
  if (!takeOmdbCall()) return Promise.reject(new Error('OMDb daily budget spent'))
  return fetch(url, { signal: AbortSignal.timeout(OMDB_TIMEOUT_MS) })
}

export interface OmdbTitle {
  imdbId: string
  title: string
  year: number
  type: string
  rating: number | null
  voteCount: number | null
  rtRating: number | null
}

export type LookupResult =
  | { status: 'found'; title: OmdbTitle }
  | { status: 'not_found' }
  | { status: 'error' }

type OmdbDetailResponse = {
  Response: string
  Error?: string
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

function parseDetail(data: OmdbDetailResponse): OmdbTitle {

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
    imdbId: data.imdbID ?? '',
    title: data.Title ?? '',
    year: data.Year && data.Year !== 'N/A' ? parseInt(data.Year, 10) : 0,
    type: data.Type ?? '',
    rating,
    voteCount,
    rtRating,
  }
}

// OMDb answers 200 with Response:"False" both for "no such title" and for
// failures such as "Request limit reached!" or "Invalid API key!". Only the
// former is a stable answer; anything unrecognised is treated as a failure.
function classifyDetail(data: OmdbDetailResponse): LookupResult {
  if (data.Response === 'True') {
    return data.imdbID
      ? { status: 'found', title: parseDetail(data) }
      : { status: 'error' }
  }
  if (!data.Error || /not found/i.test(data.Error)) return { status: 'not_found' }
  return { status: 'error' }
}

async function fetchDetail(url: string): Promise<LookupResult> {
  let res: Response
  try {
    res = await omdbFetch(url)
  } catch {
    return { status: 'error' }
  }
  if (!res.ok) return { status: 'error' }
  let data: OmdbDetailResponse
  try {
    data = await res.json()
  } catch {
    return { status: 'error' }
  }
  return classifyDetail(data)
}

export interface LookupOptions {
  /**
   * One OMDb call per lookup: skip the `?s=` search that looks for a newer same-name title with a Rotten Tomatoes score. For callers
   * that only need to know whether a title exists (the AR page's title check); the full lookup runs when the scores are shown.
   */
  light?: boolean
}

export async function lookupTitle(
  query: string,
  apiKey = process.env.OMDB_API_KEY ?? '',
  opts: LookupOptions = {}
): Promise<LookupResult> {
  // Step 1: direct lookup — 1 API call for the common case.
  const result = await fetchDetail(`${OMDB_API_BASE}/?t=${encodeURIComponent(query)}&apikey=${apiKey}`)

  // Found with RT data, or not found / failed → return immediately (1 call total).
  if (result.status !== 'found' || result.title.rtRating !== null || opts.light) return result
  const direct = result.title

  // Found but no RT score: the ?t= endpoint may have picked the wrong entry when
  // multiple titles share the same name (e.g. Cover-Up 1991 vs Cover-Up 2025).
  // Search for a newer exact-title match that has RT data.
  try {
    const searchRes = await omdbFetch(`${OMDB_API_BASE}/?s=${encodeURIComponent(query)}&apikey=${apiKey}`)
    if (!searchRes.ok) return result
    const searchData: OmdbSearchResponse = await searchRes.json()
    if (searchData.Response !== 'True' || !searchData.Search?.length) return result

    const normalized = query.toLowerCase().trim()
    const exact = searchData.Search
      .filter(r => r.Title.toLowerCase().trim() === normalized)
      .sort((a, b) => (parseInt(b.Year) || 0) - (parseInt(a.Year) || 0))

    const best = exact[0]
    if (!best || best.imdbID === direct.imdbId) return result

    // A different (newer) candidate exists — fetch its full details.
    const better = await fetchDetail(`${OMDB_API_BASE}/?i=${best.imdbID}&apikey=${apiKey}`)
    return better.status === 'found' ? better : result
  } catch {
    return result
  }
}

export async function searchTitle(
  query: string,
  apiKey = process.env.OMDB_API_KEY ?? ''
): Promise<OmdbTitle | null> {
  const result = await lookupTitle(query, apiKey)
  return result.status === 'found' ? result.title : null
}
