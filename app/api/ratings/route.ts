import { NextRequest, NextResponse } from 'next/server'
import { searchTitle } from '@/lib/omdb'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid JSON body' },
      { status: 400 }
    )
  }

  const titles = (body !== null && typeof body === 'object' && !Array.isArray(body))
    ? (body as Record<string, unknown>).titles
    : undefined

  if (
    !Array.isArray(titles) ||
    titles.length === 0 ||
    titles.some((t) => typeof t !== 'string')
  ) {
    return NextResponse.json(
      { error: 'titles must be a non-empty array of strings' },
      { status: 400 }
    )
  }

  if (titles.length > 20) {
    return NextResponse.json(
      { error: 'maximum 20 titles per request' },
      { status: 400 }
    )
  }

  const settled = await Promise.allSettled(
    titles.map((query) => searchTitle(query))
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
