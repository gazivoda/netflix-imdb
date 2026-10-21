import { NextRequest, NextResponse } from 'next/server'
import { readCappedText } from '@/lib/body-limit'
import { getRating } from '@/lib/cached-omdb'
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
