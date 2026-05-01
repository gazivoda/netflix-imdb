# IMDB Ratings API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 14 app with a single `POST /api/ratings` endpoint that searches IMDB titles by name and returns their ratings.

**Architecture:** App Router-only Next.js app. Business logic is split into a thin IMDB client (`lib/imdb.ts`) and a route handler (`app/api/ratings/route.ts`). All title lookups fire in parallel via `Promise.allSettled`.

**Tech Stack:** Next.js 14, TypeScript, Jest (via `next/jest`)

---

## File Map

| File | Purpose |
|------|---------|
| `package.json` | Project config and scripts |
| `tsconfig.json` | TypeScript config |
| `next.config.ts` | Next.js config (empty shell) |
| `jest.config.ts` | Jest config using `next/jest` |
| `app/layout.tsx` | Required root layout (bare minimum) |
| `lib/imdb.ts` | IMDB API client — searches a single title |
| `app/api/ratings/route.ts` | POST handler — validates, fans out, assembles response |
| `tests/lib/imdb.test.ts` | Unit tests for IMDB client |
| `tests/api/ratings.test.ts` | Integration tests for the route handler |

---

## Task 1: Scaffold the project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `jest.config.ts`
- Create: `app/layout.tsx`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "netflix-imdb",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "jest"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@types/jest": "^29",
    "@types/node": "^20",
    "@types/react": "^18",
    "jest": "^29",
    "jest-environment-node": "^29",
    "ts-jest": "^29",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

- [ ] **Step 4: Create `jest.config.ts`**

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
}

export default createJestConfig(config)
```

- [ ] **Step 5: Create `app/layout.tsx`**

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 6: Install dependencies**

```bash
npm install
```

Expected: packages installed, `node_modules/` created, no errors.

- [ ] **Step 7: Verify Jest runs**

```bash
npx jest --listTests
```

Expected: empty list (no tests yet), exit 0.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json next.config.ts jest.config.ts app/layout.tsx package-lock.json
git commit -m "feat: scaffold Next.js project with Jest"
```

---

## Task 2: IMDB client

**Files:**
- Create: `lib/imdb.ts`
- Create: `tests/lib/imdb.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/imdb.test.ts`:

```typescript
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
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/lib/imdb.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../lib/imdb'`

- [ ] **Step 3: Implement `lib/imdb.ts`**

Create `lib/imdb.ts`:

```typescript
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

  const data = await res.json()
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/lib/imdb.test.ts --no-coverage
```

Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/imdb.ts tests/lib/imdb.test.ts
git commit -m "feat: add IMDB client with search by title"
```

---

## Task 3: API route handler

**Files:**
- Create: `app/api/ratings/route.ts`
- Create: `tests/api/ratings.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/api/ratings.test.ts`:

```typescript
import { POST } from '../../app/api/ratings/route'
import { NextRequest } from 'next/server'

const mockFetch = jest.fn()
global.fetch = mockFetch as typeof fetch

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ratings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/ratings', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns 400 when titles is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('titles must be a non-empty array of strings')
  })

  it('returns 400 when titles is not an array', async () => {
    const res = await POST(makeRequest({ titles: 'Inception' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('titles must be a non-empty array of strings')
  })

  it('returns 400 when titles is empty', async () => {
    const res = await POST(makeRequest({ titles: [] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('titles must be a non-empty array of strings')
  })

  it('returns 400 when titles contains non-strings', async () => {
    const res = await POST(makeRequest({ titles: ['Inception', 42] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('titles must be a non-empty array of strings')
  })

  it('returns 400 when titles exceeds 20 items', async () => {
    const titles = Array.from({ length: 21 }, (_, i) => `Movie ${i}`)
    const res = await POST(makeRequest({ titles }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('maximum 20 titles per request')
  })

  it('returns 400 when request body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 with results for valid titles', async () => {
    mockFetch.mockResolvedValue({
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

    const res = await POST(makeRequest({ titles: ['Inception'] }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0]).toEqual({
      query: 'Inception',
      found: true,
      imdbId: 'tt1375666',
      title: 'Inception',
      year: 2010,
      type: 'movie',
      rating: 8.8,
      voteCount: 2500000,
    })
  })

  it('marks title as found:false when IMDB returns no match', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ titles: [] }),
    })

    const res = await POST(makeRequest({ titles: ['xyz not a real title'] }))
    const body = await res.json()
    expect(body[0]).toEqual({ query: 'xyz not a real title', found: false })
  })

  it('marks title as found:false when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))

    const res = await POST(makeRequest({ titles: ['Inception'] }))
    const body = await res.json()
    expect(body[0]).toEqual({ query: 'Inception', found: false })
  })

  it('isolates failures — one bad title does not affect others', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          titles: [
            {
              id: 'tt0903747',
              primaryTitle: 'Breaking Bad',
              startYear: 2008,
              type: 'tvSeries',
              rating: { aggregateRating: 9.5, voteCount: 2609166 },
            },
          ],
        }),
      })

    const res = await POST(makeRequest({ titles: ['bad title', 'Breaking Bad'] }))
    const body = await res.json()

    expect(body[0]).toEqual({ query: 'bad title', found: false })
    expect(body[1].found).toBe(true)
    expect(body[1].title).toBe('Breaking Bad')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/api/ratings.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../app/api/ratings/route'`

- [ ] **Step 3: Implement `app/api/ratings/route.ts`**

Create `app/api/ratings/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { searchTitle } from '@/lib/imdb'

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

  const { titles } = body as Record<string, unknown>

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
    const { imdbId, title, year, type, rating, voteCount } = result.value
    return { query, found: true, imdbId, title, year, type, rating, voteCount }
  })

  return NextResponse.json(response)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/api/ratings.test.ts --no-coverage
```

Expected: PASS — 9 tests passing.

- [ ] **Step 5: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: PASS — all 14 tests passing.

- [ ] **Step 6: Commit**

```bash
git add app/api/ratings/route.ts tests/api/ratings.test.ts
git commit -m "feat: add POST /api/ratings endpoint"
```

---

## Task 4: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: server starts on http://localhost:3000

- [ ] **Step 2: Send a test request**

In a separate terminal:

```bash
curl -s -X POST http://localhost:3000/api/ratings \
  -H "Content-Type: application/json" \
  -d '{"titles": ["Inception", "Breaking Bad", "xyz nonexistent"]}' | jq .
```

Expected response shape:
```json
[
  { "query": "Inception", "found": true, "imdbId": "...", "rating": 8.8, ... },
  { "query": "Breaking Bad", "found": true, "imdbId": "...", "rating": 9.5, ... },
  { "query": "xyz nonexistent", "found": false }
]
```

- [ ] **Step 3: Test validation**

```bash
curl -s -X POST http://localhost:3000/api/ratings \
  -H "Content-Type: application/json" \
  -d '{"titles": []}' | jq .
```

Expected: `{ "error": "titles must be a non-empty array of strings" }` with HTTP 400.

- [ ] **Step 4: Stop dev server and commit**

```bash
git add -A
git commit -m "chore: verify smoke test passes"
```
