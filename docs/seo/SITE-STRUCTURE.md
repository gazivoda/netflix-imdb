# Site Structure — Netflix Ratings

_Last updated: 2026-06-17_

## Current structure (4 pages)

```
/
├── /                                       Homepage (features, how-it-works, FAQ)
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
├── /blog/                                  REACH ENGINE (data-driven film analyses, staged batches)
│   ├── /blog                               Hub: "Top 100 Netflix Films Rated by Critics and Fans"
│   └── /blog/[slug]                        "{Film} ({Year}): IMDb x vs RT y%" (one per published film)
│
├── /camera-vision                          (exists — keep, low priority, noindex optional)
└── /privacy                                (exists — keep)
```

> **Scope discipline:** Given minimal capacity, the hand-built target is **~6 new pages** (4 how-to + 1 alternatives + 1 install). The `/blog` engine is *additive and gated* — an article is published only after it clears the quality gates in `docs/superpowers/specs/2026-10-20-blog-top-100-design.md` (Section 6).

## Page priorities

| Page | Priority | Type | Build effort | Why |
|---|---|---|---|---|
| Homepage | P0 | Exists | Polish only | Already strong; primary tool-intent target |
| `/how-to/show-imdb-ratings-on-netflix` | P0 | New, hand-built | Low | Highest-intent winnable query |
| `/how-to/show-rotten-tomatoes-on-netflix` | P1 | New, hand-built | Low | Sister query, near-zero marginal effort |
| `/install` | P1 | New, hand-built | Low | Conversion + updates cleanly when CWS goes live |
| `/compare/alternatives` | P1 | New, hand-built | Low–Med | Captures "Reelgood/JustWatch alternative" |
| `/how-to/find-what-to-watch-on-netflix` | P2 | New, hand-built | Med | Broader intent, more competitive |
| `/blog` + `/blog/[slug]` | P2 | Data-driven, staged | Med–High (one-time) | Scales reach; each article published only after it passes the gates |
| `/compare/imdb-vs-rotten-tomatoes` | P0 | Exists | Maintain | Keep fresh |

## Internal linking rules

- **Homepage → every cornerstone page** via a "Guides" / footer nav block (one-time addition).
- **Every cornerstone page → homepage + `/install`** (the conversion path).
- **Comparison page ↔ how-to pages** (contextual cross-links).
- **`/blog/[slug]` pages → `/blog`, `/compare/imdb-vs-rotten-tomatoes`, `/research/imdb-vs-rotten-tomatoes-gap` and `/install`**, and to 6 *related films* (same genre, opposite gap, shared cast, previous/next by popularity) to build a crawlable mesh and avoid orphan pages.
- No page should be more than **2 clicks from the homepage.**

## Schema per page type

| Page type | Schema | Status |
|---|---|---|
| Homepage | `WebSite`, `Organization`, `SoftwareApplication`, `FAQPage` | ✅ Exists |
| How-to pages | `HowTo` + `BreadcrumbList` | ➕ Add |
| Install page | `HowTo` (install steps) | ➕ Add |
| Comparison pages | `FAQPage` + `BreadcrumbList` | ⚠️ Add breadcrumb |
| Alternatives page | `FAQPage`, `ItemList` (the alternatives) | ➕ Add |
| `/blog` | `CollectionPage` (WebPage) + `BreadcrumbList` + `ItemList` + `Dataset` | ➕ Add |
| `/blog/[slug]` | `WebPage` + `BreadcrumbList` + `BlogPosting` + `Movie` (no ratings, no image) | ➕ Add (data-driven) |
| All pages | `Person` (author) in graph for E-E-A-T | ➕ Add once in layout |

⚠️ **No `AggregateRating` / `Review` rule:** third-party IMDb and Rotten Tomatoes scores are never emitted as structured data (Google's review-snippet policy; manual-action risk). Blog pages show scores only in visible text and tables, and carry no `FAQPage`, `HowTo` or `additionalProperty` either.

## Sitemap & robots

- `app/sitemap.ts` currently lists 4 URLs — **regenerate dynamically** to include cornerstone pages and the published `/blog/[slug]` articles. Keep `/camera-vision` and `/privacy` at low priority.
- Blog articles are **absent from the sitemap until published** (status `published` in `data/blog/articles`, registered through `lib/blog/registry.generated.ts`), so thin or unchecked pages are never advertised to Google.
- The `/blog` hub itself is **registered only when the data is complete**: `npm run blog:registry` writes `BLOG_HUB.ready = true` into `lib/blog/registry.generated.ts` only when `data/blog/films.json` holds exactly `BLOG_EXPECT_FILMS` films (default 100). Until then `/blog` is not in `lib/pages.ts` (no sitemap URL, footer link or llms.txt line), the route is dynamic and returns 404 (nothing is prerendered), and no page links to it. Publishing an article requires a ready hub (`blog:registry` refuses otherwise). The hub lastmod is the latest of its own date, the newest published article and `max(films[].dataChangedAt)`.
- Inbound links to the hub (find-what-to-watch, compare/imdb-vs-rotten-tomatoes, and the research gap study, whose table title cells link a published analysis by IMDb id) are rendered only when the hub is ready, so the site never links to a 404.
- Fixture build for checks: `BLOG_DATA_DIR=tests/blog/fixtures BLOG_EXPECT_FILMS=12 npm run blog:registry`, then build with the same env, in a scratch copy only. Never commit a registry generated that way.
- `robots.ts` is good — leave the AI-crawler allowlist as-is.
