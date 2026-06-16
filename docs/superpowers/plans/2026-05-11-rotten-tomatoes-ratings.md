# Rotten Tomatoes Ratings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Rotten Tomatoes scores alongside IMDB ratings in both the Next.js `/api/ratings` endpoint and the Chrome extension overlay.

**Architecture:** Replace `lib/imdb.ts` (uses `imdbapi.dev`) with `lib/omdb.ts` (uses OMDB API, which already returns both IMDB and RT scores in one call). Update the API route to import from the new lib. Update the extension's `background.js` to extract the RT score it was already receiving but discarding, and `content.js` to display `⭐ 8.8  🍅 87%`.

**Tech Stack:** Next.js 14, TypeScript, Jest/ts-jest, Chrome Extension MV3

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/omdb.ts` | OMDB API client, returns `OmdbTitle` with both ratings |
| Delete | `lib/imdb.ts` | Replaced by `lib/omdb.ts` |
| Modify | `app/api/ratings/route.ts` | Swap import, add `rtRating` to response |
| Create | `tests/lib/omdb.test.ts` | Unit tests for `lib/omdb.ts` |
| Delete | `tests/lib/imdb.test.ts` | Replaced by `tests/lib/omdb.test.ts` |
| Modify | `tests/api/ratings.test.ts` | Update mocks to OMDB format, add `rtRating` assertions |
| Modify | `extension/background.js` | Extract `rtRating` from OMDB response, pass it in message |
| Modify | `extension/content.js` | Read `rtRating`, build badge string with both scores |

---

## Task 1: Create `lib/omdb.ts` with failing tests first

**Files:**
- Create: `tests/lib/omdb.test.ts`
- Create: `lib/omdb.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/omdb.test.ts`:

```typescript
import { searchTitle } from '../../lib/omdb'

const mockFetch = jest.fn()
global.fetch = mockFetch as typeof fetch

describe('searchTitle', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns both imdb and rt ratings from a full OMDB response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        Response: 'True',
        imdbID: 'tt1375666',
        Title: 'Inception',
        Year: '2010',
        Type: 'movie',
        imdbRating: '8.8',
        imdbVotes: '2,500,000',
        Ratings: [{ Source: 'Rotten Tomatoes', Value: '87%' }],
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
      rtRating: 87,
    })
  })

  it('returns rtRating: null when Ratings array has no RT entry', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        Response: 'True',
        imdbID: 'tt1375666',
        Title: 'Inception',
        Year: '2010',
        Type: 'movie',
        imdbRating: '8.8',
        imdbVotes: '2,500,000',
        Ratings: [],
      }),
    })

    const result = await searchTitle('Inception')
    expect(result?.rtRating).toBeNull()
  })

  it('returns rating: null and voteCount: null when values are N/A', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        Response: 'True',
        imdbID: 'tt9999999',
        Title: 'Some Show',
        Year: '2020',
        Type: 'series',
        imdbRating: 'N/A',
        imdbVotes: 'N/A',
        Ratings: [],
      }),
    })

    const result = await searchTitle('Some Show')
    expect(result?.rating).toBeNull()
    expect(result?.voteCount).toBeNull()
  })

  it('returns null when OMDB Response is False', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ Response: 'False', Error: 'Movie not found!' }),
    })

    const result = await searchTitle('nonexistent title')
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    const result = await searchTitle('Inception')
    expect(result).toBeNull()
  })

  it('returns null when fetch response is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const result = await searchTitle('Inception')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/lib/omdb.test.ts --no-coverage
```

Expected: All tests FAIL with `Cannot find module '../../lib/omdb'`

- [ ] **Step 3: Implement `lib/omdb.ts`**

Create `lib/omdb.ts`:

```typescript
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
    year: parseInt(data.Year ?? '0', 10),
    type: data.Type ?? '',
    rating,
    voteCount,
    rtRating,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/lib/omdb.test.ts --no-coverage
```

Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/omdb.ts tests/lib/omdb.test.ts
git commit -m "feat: add lib/omdb.ts with IMDB + Rotten Tomatoes rating support"
```

---

## Task 2: Update `/api/ratings` route and its tests

**Files:**
- Modify: `app/api/ratings/route.ts`
- Modify: `tests/api/ratings.test.ts`
- Delete: `lib/imdb.ts`
- Delete: `tests/lib/imdb.test.ts`

- [ ] **Step 1: Update `tests/api/ratings.test.ts`**

Replace the entire file with the updated version that mocks OMDB format and expects `rtRating`:

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

function omdbResponse(overrides = {}) {
  return {
    ok: true,
    json: async () => ({
      Response: 'True',
      imdbID: 'tt1375666',
      Title: 'Inception',
      Year: '2010',
      Type: 'movie',
      imdbRating: '8.8',
      imdbVotes: '2,500,000',
      Ratings: [{ Source: 'Rotten Tomatoes', Value: '87%' }],
      ...overrides,
    }),
  }
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
    const body = await res.json()
    expect(body.error).toBe('invalid JSON body')
  })

  it('returns 200 with both rating and rtRating for valid titles', async () => {
    mockFetch.mockResolvedValue(omdbResponse())

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
      rtRating: 87,
    })
  })

  it('returns rtRating: null when RT score is absent', async () => {
    mockFetch.mockResolvedValue(omdbResponse({ Ratings: [] }))

    const res = await POST(makeRequest({ titles: ['Inception'] }))
    const body = await res.json()
    expect(body[0].rtRating).toBeNull()
  })

  it('marks title as found:false when OMDB returns Response:False', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ Response: 'False', Error: 'Movie not found!' }),
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
      .mockResolvedValueOnce(
        omdbResponse({
          imdbID: 'tt0903747',
          Title: 'Breaking Bad',
          Year: '2008',
          Type: 'series',
          imdbRating: '9.5',
          imdbVotes: '2,609,166',
          Ratings: [{ Source: 'Rotten Tomatoes', Value: '96%' }],
        })
      )

    const res = await POST(makeRequest({ titles: ['bad title', 'Breaking Bad'] }))
    const body = await res.json()

    expect(body[0]).toEqual({ query: 'bad title', found: false })
    expect(body[1].found).toBe(true)
    expect(body[1].title).toBe('Breaking Bad')
    expect(body[1].rtRating).toBe(96)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail (import still points to imdb)**

```bash
npx jest tests/api/ratings.test.ts --no-coverage
```

Expected: FAIL — mock format mismatch (old code parses `imdbapi.dev` format, not OMDB)

- [ ] **Step 3: Update `app/api/ratings/route.ts`**

Replace the entire file:

```typescript
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
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
npx jest --no-coverage
```

Expected: All tests PASS

- [ ] **Step 5: Delete old files**

```bash
rm lib/imdb.ts tests/lib/imdb.test.ts
```

- [ ] **Step 6: Run tests again to confirm nothing broke**

```bash
npx jest --no-coverage
```

Expected: All tests still PASS

- [ ] **Step 7: Commit**

```bash
git add app/api/ratings/route.ts tests/api/ratings.test.ts tests/lib/omdb.test.ts
git rm lib/imdb.ts tests/lib/imdb.test.ts
git commit -m "feat: switch /api/ratings to OMDB, add rtRating to response"
```

---

## Task 3: Update Chrome extension — `background.js`

**Files:**
- Modify: `extension/background.js`

- [ ] **Step 1: Update `extension/background.js`**

Replace the entire file:

```javascript
'use strict';

const OMDB_API_KEY = '901841e0';
const cache = new Map();

async function getRatings(title) {
  if (cache.has(title)) return cache.get(title);
  try {
    const res = await fetch(
      `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_API_KEY}`
    );
    const data = res.ok ? await res.json() : null;

    const rating =
      data?.imdbRating && data.imdbRating !== 'N/A'
        ? parseFloat(data.imdbRating)
        : null;

    const rtEntry = data?.Ratings?.find((r) => r.Source === 'Rotten Tomatoes');
    const rtParsed = rtEntry ? parseInt(rtEntry.Value.replace('%', ''), 10) : null;
    const rtRating = rtParsed !== null && !Number.isNaN(rtParsed) ? rtParsed : null;

    const result = { rating, rtRating };
    cache.set(title, result);
    return result;
  } catch {
    return { rating: null, rtRating: null };
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ratings') return;

  port.onMessage.addListener(({ type, title, id }) => {
    if (type !== 'FETCH_RATING') return;
    getRatings(title).then(({ rating, rtRating }) => {
      try {
        port.postMessage({ id, rating, rtRating });
      } catch {
        // port disconnected before response — discard
      }
    });
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add extension/background.js
git commit -m "feat: extract RT rating from OMDB response in background.js"
```

---

## Task 4: Update Chrome extension — `content.js`

**Files:**
- Modify: `extension/content.js`

- [ ] **Step 1: Update `extension/content.js`**

Replace the entire file:

```javascript
(function () {
  'use strict';

  const RATED_ATTR = 'data-imdb-rated';
  let debounceTimer = null;
  let isScanning = false;

  let port = null;
  const pending = new Map();
  let nextId = 0;

  function getPort() {
    if (port) return port;
    port = chrome.runtime.connect({ name: 'ratings' });
    port.onMessage.addListener(({ id, rating, rtRating }) => {
      const resolve = pending.get(id);
      if (resolve) {
        pending.delete(id);
        resolve({ rating, rtRating });
      }
    });
    port.onDisconnect.addListener(() => {
      port = null;
      pending.forEach((resolve) => resolve({ rating: null, rtRating: null }));
      pending.clear();
    });
    return port;
  }

  function fetchRating(title) {
    return new Promise((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      try {
        getPort().postMessage({ type: 'FETCH_RATING', title, id });
      } catch {
        pending.delete(id);
        resolve({ rating: null, rtRating: null });
      }
    });
  }

  function extractTitle(ariaLabel) {
    return ariaLabel
      .replace(/,\s*(Season|Part|Volume|Episode)\s+\d+.*/i, '')
      .replace(/:\s*(More Info|Play|Resume|Watch)$/i, '')
      .trim();
  }

  function getUnratedAnchors() {
    return Array.from(
      document.querySelectorAll(`a[aria-label]:not([${RATED_ATTR}])`)
    ).filter((a) => {
      if (!a.querySelector('img')) return false;
      const href = a.getAttribute('href') || '';
      return href.includes('/watch/') || href.includes('/title/');
    });
  }

  function prepareAnchor(anchor) {
    anchor.setAttribute(RATED_ATTR, 'true');
    anchor.setAttribute('data-imdb-rating', '⭐ …');
    return anchor;
  }

  async function scanAndRate() {
    if (isScanning) return;
    isScanning = true;
    try {
      const anchors = getUnratedAnchors();
      if (!anchors.length) return;

      const entries = anchors.map((anchor) => ({
        title: extractTitle(anchor.getAttribute('aria-label')),
        el: prepareAnchor(anchor),
      }));

      await Promise.allSettled(
        entries.map(async ({ title, el }) => {
          const { rating, rtRating } = await fetchRating(title);
          const parts = [];
          if (rating !== null) parts.push(`⭐ ${rating}`);
          if (rtRating !== null) parts.push(`🍅 ${rtRating}%`);
          if (parts.length) {
            el.setAttribute('data-imdb-rating', parts.join('  '));
          } else {
            el.removeAttribute('data-imdb-rating');
          }
        })
      );
    } finally {
      isScanning = false;
    }
  }

  function debouncedScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanAndRate, 300);
  }

  scanAndRate();

  new MutationObserver(debouncedScan).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
```

- [ ] **Step 2: Commit**

```bash
git add extension/content.js
git commit -m "feat: display RT score alongside IMDB rating in Netflix overlay"
```

---

## Done

All tests pass, both the Next.js API and Chrome extension now return and display Rotten Tomatoes scores. Set `OMDB_API_KEY` in your deployment environment (e.g. Vercel env vars) to match the key in `extension/background.js`.
