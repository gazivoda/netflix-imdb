# Rotten Tomatoes Ratings — Design Spec

**Date:** 2026-05-11
**Status:** Approved

## Overview

Add Rotten Tomatoes scores alongside IMDB ratings in both the Next.js API endpoint and the Chrome extension overlay. The extension already uses OMDB API (which returns RT scores); the Next.js API currently uses a separate source (`imdbapi.dev`) that does not. This change unifies both on OMDB.

## Architecture

### Data layer

`lib/imdb.ts` is deleted. A new `lib/omdb.ts` replaces it, calling OMDB's `?t=<title>&apikey=<key>` endpoint — the same URL already used in `extension/background.js`.

Return type:

```ts
export interface OmdbTitle {
  imdbId: string
  title: string
  year: number
  type: string
  rating: number | null      // IMDB aggregate rating
  voteCount: number | null
  rtRating: number | null    // Rotten Tomatoes score, 0–100 integer, or null
}
```

RT score is parsed from the `Ratings` array OMDB returns:
```json
{ "Source": "Rotten Tomatoes", "Value": "87%" }
```
Strip the `%` suffix and parse as integer. If the entry is absent or malformed, return `null`.

OMDB field mapping notes:
- `imdbId` ← `imdbID` (capital D in OMDB response)
- `voteCount` ← `imdbVotes` parsed as integer after stripping commas (`"2,500,000"` → `2500000`); `null` if `"N/A"`
- `type` ← `Type` (OMDB values: `"movie"`, `"series"`, `"episode"`)

### Next.js API (`/api/ratings`)

- Import `searchTitle` from `lib/omdb.ts` instead of `lib/imdb.ts` — no other logic changes.
- API key sourced from `process.env.OMDB_API_KEY`.
- Response shape gains one field:

```ts
{
  query: string
  found: boolean
  // when found: true
  imdbId?: string
  title?: string
  year?: number
  type?: string
  rating?: number | null       // IMDB rating
  voteCount?: number | null
  rtRating?: number | null     // NEW: Rotten Tomatoes score
}
```

### Chrome extension

**`background.js`**

Extract `rtRating` from the OMDB `Ratings` array in the existing response. Message to content script changes from `{ id, rating }` to `{ id, rating, rtRating }`. In-memory cache stores both values.

**`content.js`**

Build badge string from both values:

| rating | rtRating | Display |
|--------|----------|---------|
| present | present | `⭐ 8.8  🍅 87%` |
| present | null | `⭐ 8.8` |
| null | present | `🍅 87%` |
| null | null | remove attribute (existing behavior) |

The `data-imdb-rating` attribute name is unchanged to avoid touching CSS selectors.

## Error handling

- If OMDB returns `Response: "False"` or the title is not found, return `null` (existing behavior, unchanged).
- If the `Ratings` array exists but has no RT entry, `rtRating` is `null` — not an error.
- Network failures continue to resolve as `found: false` in the API and `null` in the extension.

## Testing

### `tests/lib/omdb.test.ts` (replaces `tests/lib/imdb.test.ts`)

- Parses `rating` and `rtRating` from a full OMDB response
- Returns `rtRating: null` when RT entry is absent from `Ratings`
- Returns `null` when OMDB returns `Response: "False"`
- Returns `null` on network error

### `tests/api/ratings.test.ts`

- Mock responses updated to OMDB format
- Assertions add `rtRating` to expected output
- All existing error/edge-case tests retained, updated to new response shape

## Out of scope

- Metacritic or other rating sources
- Caching layer changes
- Extension UI beyond the badge string
