# Site Structure — Netflix Ratings

_Last updated: 2026-06-17_

## Current structure (4 pages)

```
/
├── /                                       Homepage (features, how-it-works, testimonials, FAQ)
├── /compare/imdb-vs-rotten-tomatoes        Comparison / informational
├── /camera-vision                          Experimental demo (low priority)
└── /privacy                                Privacy policy
```

## Target structure (set-and-forget build)

```
/
├── /                                       Homepage — tool-intent hub
│
├── /how-to/                                CORNERSTONE cluster (hand-built, ~4 pages)
│   ├── /how-to/show-imdb-ratings-on-netflix
│   ├── /how-to/show-rotten-tomatoes-on-netflix
│   ├── /how-to/find-what-to-watch-on-netflix
│   └── /install                            Install guide (GitHub now → CWS later)
│
├── /compare/
│   ├── /compare/imdb-vs-rotten-tomatoes    (exists — keep)
│   └── /compare/alternatives               "Reelgood / JustWatch alternative" angle
│
├── /netflix/                               REACH ENGINE (programmatic, optional — gated)
│   └── /netflix/[title]                    "Is {Title} worth watching? IMDb & RT scores"
│
├── /camera-vision                          (exists — keep, low priority, noindex optional)
└── /privacy                                (exists — keep)
```

> **Scope discipline:** Given minimal capacity, the hand-built target is **~6 new pages** (4 how-to + 1 alternatives + 1 install). The `/netflix/[title]` engine is *additive and optional* — only ship it if it clears the quality gates in `IMPLEMENTATION-ROADMAP.md`.

## Page priorities

| Page | Priority | Type | Build effort | Why |
|---|---|---|---|---|
| Homepage | P0 | Exists | Polish only | Already strong; primary tool-intent target |
| `/how-to/show-imdb-ratings-on-netflix` | P0 | New, hand-built | Low | Highest-intent winnable query |
| `/how-to/show-rotten-tomatoes-on-netflix` | P1 | New, hand-built | Low | Sister query, near-zero marginal effort |
| `/install` | P1 | New, hand-built | Low | Conversion + updates cleanly when CWS goes live |
| `/compare/alternatives` | P1 | New, hand-built | Low–Med | Captures "Reelgood/JustWatch alternative" |
| `/how-to/find-what-to-watch-on-netflix` | P2 | New, hand-built | Med | Broader intent, more competitive |
| `/netflix/[title]` | P2 | Programmatic | Med–High (one-time) | Scales reach; only if gates pass |
| `/compare/imdb-vs-rotten-tomatoes` | P0 | Exists | Maintain | Keep fresh |

## Internal linking rules

- **Homepage → every cornerstone page** via a "Guides" / footer nav block (one-time addition).
- **Every cornerstone page → homepage + `/install`** (the conversion path).
- **Comparison page ↔ how-to pages** (contextual cross-links).
- **Programmatic `/netflix/[title]` pages → `/compare/imdb-vs-rotten-tomatoes` + homepage**, and to 3–5 *related titles* (genre/cast) to build a crawlable mesh and avoid orphan pages.
- No page should be more than **2 clicks from the homepage.**

## Schema per page type

| Page type | Schema | Status |
|---|---|---|
| Homepage | `WebSite`, `Organization`, `SoftwareApplication`, `FAQPage` | ✅ Exists |
| How-to pages | `HowTo` + `BreadcrumbList` | ➕ Add |
| Install page | `HowTo` (install steps) | ➕ Add |
| Comparison pages | `FAQPage` + `BreadcrumbList` | ⚠️ Add breadcrumb |
| Alternatives page | `FAQPage`, `ItemList` (the alternatives) | ➕ Add |
| `/netflix/[title]` | `Movie`/`TVSeries` + `AggregateRating` + `BreadcrumbList` | ➕ Add (programmatic) |
| All pages | `Person` (author) in graph for E-E-A-T | ➕ Add once in layout |

⚠️ **`AggregateRating` rule:** only emit it with *real, sourced* values you have permission to display, and only on pages where the score actually renders. Fabricated or unsourced ratings schema risks a manual action.

## Sitemap & robots

- `app/sitemap.ts` currently lists 4 URLs — **regenerate dynamically** to include cornerstone pages and (if shipped) the programmatic set. Keep `/camera-vision` and `/privacy` at low priority.
- Programmatic pages must be **excluded from the sitemap until they pass the quality gate** (don't advertise thin pages to Google).
- `robots.ts` is good — leave the AI-crawler allowlist as-is.
