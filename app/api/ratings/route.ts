import { NextRequest, NextResponse } from 'next/server'
import { readCappedText } from '@/lib/body-limit'
import { getCachedRating, getRating } from '@/lib/cached-omdb'
import { omdbBudgetExhausted, secondsUntilBudgetReset } from '@/lib/omdb-budget'
import { checkRateLimit, MAX_BODY_BYTES, omdbKeyPresent, validateTitles } from '@/lib/ratings-guard'

export async function POST(req: NextRequest) {
  const limit = checkRateLimit(req.headers)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'too many requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterS) } }
    )
  }

  const raw = await readCappedText(req, MAX_BODY_BYTES)
  if (raw === null) {
    return NextResponse.json({ error: 'request body too large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json(
      { error: 'invalid JSON body' },
      { status: 400 }
    )
  }

  const candidate = (body !== null && typeof body === 'object' && !Array.isArray(body))
    ? (body as Record<string, unknown>).titles
    : undefined

  const checked = validateTitles(candidate)
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 })
  }
  const { titles } = checked

  // A missing key would make every lookup fail quietly as "not found"; say so instead.
  if (!omdbKeyPresent()) {
    return NextResponse.json({ error: 'ratings unavailable' }, { status: 503 })
  }

  // Daily OMDb budget spent: answer from the cache only. Titles we have never looked up cannot be answered, and say so
  // (unavailable: true) instead of looking like "not found"; if nothing at all can be answered the whole call is a 503.
  // Neither is cacheable: the budget resets at UTC midnight.
  if (omdbBudgetExhausted()) {
    const retryAfter = String(secondsUntilBudgetReset())
    const cached = titles.map((query) => ({ query, cached: getCachedRating(query) }))
    if (cached.every((c) => !c.cached.hit)) {
      return NextResponse.json(
        { error: 'ratings temporarily unavailable: daily lookup limit reached' },
        { status: 503, headers: { 'Retry-After': retryAfter, 'Cache-Control': 'no-store' } }
      )
    }
    const partial = cached.map(({ query, cached: c }) => {
      if (!c.hit) return { query, found: false, unavailable: true }
      if (c.result === null) return { query, found: false }
      const { imdbId, title, year, type, rating, voteCount, rtRating } = c.result
      return { query, found: true, imdbId, title, year, type, rating, voteCount, rtRating }
    })
    return NextResponse.json(partial, { headers: { 'Cache-Control': 'no-store' } })
  }

  const settled = await Promise.allSettled(
    titles.map((query) => getRating(query))
  )

  const response = settled.map((result, i) => {
    const query = titles[i]
    if (result.status === 'rejected' || result.value === null) {
      return { query, found: false }
    }
    const { imdbId, title, year, type, rating, voteCount, rtRating } = result.value
    return { query, found: true, imdbId, title, year, type, rating, voteCount, rtRating }
  })

  return NextResponse.json(response)
}
