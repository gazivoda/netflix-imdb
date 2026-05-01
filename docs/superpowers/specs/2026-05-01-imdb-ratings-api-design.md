# IMDB Ratings API — Design Spec

**Date:** 2026-05-01  
**Status:** Approved

---

## Overview

A Next.js 14 app with a single API endpoint that accepts a list of movie/series title names, looks each one up on imdbapi.dev, and returns a list of IMDB ratings — one per title.

---

## Architecture

Next.js 14 App Router. No database, no auth, no UI in this phase.

```
app/
  api/
    ratings/
      route.ts   ← POST handler
```

One external dependency: `https://api.imdbapi.dev/titles?primaryTitle=<name>`

---

## API Contract

### Request

```http
POST /api/ratings
Content-Type: application/json

{
  "titles": ["Inception", "Breaking Bad", "Interstellar"]
}
```

### Success Response — 200

```json
[
  {
    "query": "Inception",
    "found": true,
    "imdbId": "tt1375666",
    "title": "Inception",
    "year": 2010,
    "type": "movie",
    "rating": 8.8,
    "voteCount": 2500000
  },
  {
    "query": "xyz not found",
    "found": false
  }
]
```

### Error Response — 400

```json
{ "error": "<reason>" }
```

Triggered when: `titles` is missing, not an array, empty, or contains non-string values.

---

## Data Flow

1. Validate request body — return 400 on any violation
2. Fire all upstream lookups concurrently via `Promise.allSettled`
3. For each settled result:
   - On fulfillment: take `titles[0]` from the imdbapi.dev response; if the array is empty, mark `found: false`
   - On rejection (network error, timeout): mark `found: false`
4. Return assembled array with 200

Individual title failures are isolated — one failure does not affect other results.

---

## External API

- **Base URL:** `https://api.imdbapi.dev`
- **Endpoint:** `GET /titles?primaryTitle=<encoded title>`
- **Response fields used:** `titles[0].id`, `titles[0].primaryTitle`, `titles[0].startYear`, `titles[0].type`, `titles[0].rating.aggregateRating`, `titles[0].rating.voteCount`

---

## Validation Rules

- `titles` must be present
- `titles` must be a non-empty array
- Every element of `titles` must be a string
- Maximum 20 titles per request (to cap upstream fan-out)

---

## Out of Scope (this phase)

- Frontend UI
- Caching
- Authentication
- Rate limiting
