# Blog: Top 100 Netflix Films, IMDb vs Rotten Tomatoes (design spec)

_2026-10-20. Synthesised from 13 SEO/GEO specialist reports plus the repo's real code. Status: awaiting owner sign-off on Section 1 and the open questions in Section 9._

Fixed constraints (not re-opened here): film list = Netflix's own published popularity data cross-checked in OMDb; articles are JSON data files rendered by one template (no MDX, no new npm deps); every claim traces to the OMDb record, Netflix's data or a cited source; 3-article pilot before the other 97; CI stays green (`tsc`, `jest`, `next build`, `npm run seo:validate`); copy rules (no emoji, em dash, arrows/special glyphs, hard-coded hex); brand "Rating Watch"; never claim affiliation with Netflix, IMDb or Rotten Tomatoes.

## 1. Rulings (decisions and conflicts resolved)

| # | Question (who disagreed) | Ruling | Why |
|---|---|---|---|
| R1 | What is "top 100"? (geo-content: highest-scoring with 25k votes; seo-geo: most-voted Originals; competitor: by gap size; sxo: Originals only) | Rank films by **Netflix-published hours viewed**: `popularityHours = max(sum of weekly_hours_viewed across all weeks in Netflix's global weekly Top 10, hours_viewed_first_91_days from Netflix's Most Popular list)`. Take films in that order until 100 pass eligibility (R2). | Owner fixed "Netflix's own published most-popular". The Most Popular file has only 20 films (10 English, 10 non-English), so 100 needs the weekly file. `weekly_views` is N/A on 2,040 of 5,500 film rows (before mid-2023); hours is the only metric complete for all 275 weeks. |
| R2 | Films with no RT score (strategist: hub row only; ai-visibility: no-RT page state; sxo: drop) | Eligible = OMDb `Type=movie`, runtime matches Netflix within 12 min, IMDb rating present, `imdbVotes >= 5,000`, RT Tomatometer present. Ineligible titles are skipped (the walk continues down the ranking) and listed on the hub under "Popular, but not scored" with the reason. No article, never an estimated score. | The gap is the page's only differentiator; a page without RT is an OMDb mirror. Listing the skips keeps the method honest (Glass Onion, Don't Look Up lacked RT in the Oct 15 snapshot). |
| R3 | Licensed films (Shrek, Despicable Me 2, Super Mario) in a "Netflix" list? (sxo, seo-geo: Originals only) | Include them. Wording is always "ranked in Netflix's global Top 10" / "per Netflix's Top 10 data", never "Netflix Original" (OMDb has no such field; banned outright in copy) and never "available on Netflix" / "streaming now". | They are in Netflix's own data. Historical, dated chart facts do not go stale; availability claims do (and vary by region). |
| R4 | Publish fewer than 100? (5 reports said yes) | 100 article files are written; an article is **published only after it passes every gate** (Section 6). The hub always shows all 100 rows; rows without a published article are plain text. The hub states the published count. | Satisfies the owner's 100 while never shipping a page that fails a gate. |
| R5 | URL space (/films, /netflix/[title], under /research, /blog) | `/blog` hub and `/blog/{slug}`. The `/netflix/[title]` engine in `docs/seo/SITE-STRUCTURE.md` is superseded; update that doc in Task 3. | Owner asked for /blog; one film URL space avoids cannibalising itself. |
| R6 | Sub-hubs (3-4 gap hubs, genre hubs >= 8 films, decade hubs) | **No sub-hub pages in v1.** Gap, genre and release-period groupings are sections (anchors) of the single `/blog` hub. Revisit after batch 3 with the >= 8-film rule. | CI rejects noindex, so every hub must be strong enough to index. Release years cluster in 2021-2026, so decade hubs would be thin. |
| R7 | Article `<title>` (score pattern vs archetype titles like "Overrated?") | Generated from data, never hand-typed: `{Film} ({Year}): IMDb {x} vs RT {y}%`, then `{Film}: IMDb {x} vs RT {y}%`, then `{shortTitle}: IMDb {x} vs RT {y}%`. Max 50 chars (renders <= 65 with the 15-char suffix). No clickbait or opinion words. H1 is writer-authored and different. | Unique per page, carries the answer, rebuilds on refresh. "Overrated?" is an opinion with no source. |
| R8 | Ratings in schema (geo-schema: aggregateRating on Movie; 6 others: never) | **No** `aggregateRating`, `Review`, `additionalProperty` or `FAQPage` on blog pages. Graph = WebPage + BreadcrumbList + BlogPosting + Movie (no ratings, no image). Scores only in visible text and tables. | Third-party scores as markup break Google's review-snippet policy (manual-action risk). `additionalProperty` is not valid on Movie. FAQ rich results are gone. |
| R9 | FAQ per article (strategist: yes; schema: no) | Visible FAQ of 2-3 questions specific to the film; no FAQPage markup (`faqSchema={false}`). | Readers and AI engines use visible Q&A; templated FAQ markup on 100 pages reads as scaled content. |
| R10 | Gap definition | `gap = rtPercent - round(imdbRating * 10)`, same as `/research`. Positive = critics higher. Tiers in Section 3.4. | One definition across the site. |
| R11 | How numbers enter prose | **Only via tokens** (`{{imdb}}`, `{{rt}}` ...) rendered from `films.json`. A score-like literal in prose fails the test. | Prose can never contradict data, and refresh updates every number. |
| R12 | Length (1,500 floor vs 500-800 vs 150+ unique) | Written prose 600-900 words; at least 450 unique words (not in any 5-gram shared with another article). | Enough for real analysis without padding. |
| R13 | Similarity ceiling (20%, 40%, 60%, 70% proposed) | Pairwise word-5-gram Jaccard <= 0.10; share of an article's 5-grams found in any other article <= 0.20; opener and heading reuse caps (Section 6). | Strict and measurable; independently written texts score well under 0.05. |
| R14 | Dates (dateModified = snapshot date?) | `published` = batch publish date; `updated` = max(published, contentUpdated, film.dataChangedAt). Visible "Scores as of {fetchedAt}". Sitemap lastmod = `updated`. | A snapshot date earlier than the publish date would make dateModified < datePublished. Never bump dates without a change. |
| R15 | OMDb RT errors (Pinocchio: OMDb 27% vs RT 96%) | RT hand-check is required for the pilot, for any `abs(gap) >= 30` and for `imdbVotes < 25,000`. RT page differs from OMDb by 3-9 points: publish with a visible data note. 10+ points, or the check cannot be completed: **hold** (not published). | One wrong headline number per page is worse than a skipped page. |
| R16 | Footer / llms.txt wiring (group 'blog' vs 'guide' vs kind) | Hub: `group: 'guide'`, label "Blog" (footer and llms.txt "Guides" pick it up with no code change). Articles: new `kind: 'article'`, no group: not in the footer, not in llms.txt; one compact line each in llms-full.txt. | Smallest change; 100 footer links or a flooded llms.txt are both avoided. |
| R17 | Images | Per-film text-only OG/Twitter card (`opengraph-image.tsx` + `twitter-image.tsx` in `app/blog/[slug]/`), reusing `lib/og.tsx` tokens. No posters (OMDb Poster URLs are third-party artwork), no Netflix logos, no body images. | Rights risk, LCP/CLS, and 100 identical share images look templated. |
| R18 | Relationship to `/research/imdb-vs-rotten-tomatoes-gap` (merge to 100 vs keep) | Keep the 44-film study unchanged as a separate dated study of Originals. Blog pages never restate its aggregates; they link to it as method background. Its table title cells link to the matching published article (by imdbId). | Different population and date; merging would rewrite a published study. |
| R19 | Methodology / editorial-policy pages (geo-content wanted 2 new pages) | Both live as sections on `/blog` ("How the list is built", "How these articles are made") with the AI-assistance disclosure and a corrections contact. No new pages in v1. | Fewer thin pages; same E-E-A-T signal. |
| R20 | Byline target (repo vs /about) | Blog pages link the byline to `/about`; guides keep linking to the repo (separate decision). Done with a `bylineHref` prop. | Fixes the blog's E-E-A-T without touching every guide. |
| R21 | Rollout | Pilot 3, then all 97 written and checked, then published in batches of 20 (batch 1 = pilot + 17), at least 14 days apart, each gated (Section 8). | Matches 7 reports' staged-launch advice and the owner's 10-20 batch rule. |
| R22 | Off-site entity work, Content-Signal, Bing verification, HowTo removal, Offer fix | Out of scope for this spec; tracked as owner items. | Real, but not blog work. |
| R23 | check-links in CI | Not in CI: `check-links.mjs` needs Node 22.18+ (native TS) and CI runs Node 20. It is a required local step per publish batch. | Keeps CI green; bumping CI Node is a separate owner decision. |

## 2. Data pipeline

### 2.1 Sources (verified 2026-10-20)
- `https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv`: 11,000 rows, weeks 2021-07-04 to 2026-10-04 (275 weeks), 4 categories x 2,750 rows. Columns: `week, category, weekly_rank, show_title, season_title, weekly_hours_viewed, runtime (hours), weekly_views, cumulative_weeks_in_top_10`. 2,230 distinct film titles, 1,282 distinct TV titles.
- `https://www.netflix.com/tudum/top10/data/most-popular.tsv`: 40 rows; 20 films with `hours_viewed_first_91_days`, `views_first_91_days`, `runtime`. Bird Box is the only one absent from the weekly file.
- Both return **403 without a browser User-Agent**; the script sends a fixed desktop Chrome UA string.
- Dry run of R1 on today's file: 88 English / 12 non-English films in the top 100 by hours; 448 film titles are longer than 22 chars (title shortening is mandatory, R7).
- Series: excluded by rule (category starts with `TV`). The data file records the skipped TV count.

### 2.2 Scripts (local only, never in CI or at build)
`scripts/blog/refresh.mjs` (ts-node register pattern from `validate-seo.mjs`, so Node 20 works). Run: `node --env-file=.env.local scripts/blog/refresh.mjs [--list] [--scores] [--refresh]`.
1. **List phase** (`--list`): download both TSVs; abort on non-200, wrong header row or < 10,000 weekly rows. Aggregate per `show_title` over `Films (English)` and `Films (Non-English)`: hours sum, weeks, peak rank, first week, last week, median `runtime`. Merge Most Popular rows. Sort by `popularityHours` desc, tie by weeks desc, then title. Keep the first 250 as the candidate pool. Write `data/blog/source/netflix-candidates.json` (pool only, not the 900 KB TSV) with `downloadedAt`, `sha256` of each raw file, `firstWeek`, `lastWeek`.
2. **Match phase**: for each candidate in pool order, resolve to an IMDb ID: `?t={title}&type=movie&y={Y}` for Y = first-week year, then Y-1, then no year, then `?s=` search. Accept only if all hold: OMDb `Type=movie`; OMDb Year <= first-week year; `abs(netflixRuntimeMin - omdbRuntimeMin) <= 12`; normalised titles equal (lowercase, NFKD, strip punctuation, `&`=`and`) **or** an entry exists in `data/blog/source/overrides.json` (`{ netflixTitle, imdbId, reason }`, identity only, written before scores are inspected). Then fetch the full record by `?i={imdbId}&plot=short`. Raw responses go to `data/blog/omdb-raw.json` (`{ [imdbId]: { fetchedAt, data } }`), same pattern as `data/omdb-cache.json`.
3. **Eligibility** (R2) in pool order until 100 eligible. Everything skipped above the cut-off goes to `excluded[]` with reason: `unmatched`, `runtime-mismatch`, `not-a-movie`, `no-imdb-rating`, `low-votes`, `no-rt-score`, `duplicate-imdb-id`.
4. Write `data/blog/films.json` and the public copy `public/data/netflix-top-100.json`.

Quota: about 250 candidates x 2-3 calls = 500-750 requests against OMDb's 1,000/day free tier, so `omdb-raw.json` is written **incrementally after every successful response** and a re-run resumes from it (as `data/omdb-cache.json` does); only `films.json` and the public copy are all-or-nothing. Safety rules (same as `scripts/research/imdb-rt-gap.mjs`): abort writing `films.json` on any network error, OMDb `Request limit reached`/`Invalid API key`, or a schema mismatch. Never fill a missing value. `MAX_REQUESTS = 700`, 400 ms delay. Never print request URLs, the key or `process.env`. `lib/cached-omdb.ts` is **not** used: it stores only 7 fields in the runtime SQLite store for the extension API. The blog needs the full record, so it uses its own raw cache and the same `OMDB_API_KEY`.

Fallback if Netflix files cannot be fetched: re-use the committed `netflix-candidates.json` and set `listSource: "committed-snapshot"`. If none exists yet, the owner downloads both files in a browser from netflix.com/tudum/top10 into `data/blog/source/raw/` (git-ignored); the script reads them from there. The list is never typed in by hand.

### 2.3 `data/blog/films.json`
```ts
interface FilmsFile {
  schemaVersion: 1;
  name: string; description: string; license: string; // license: "Scores belong to IMDb and Rotten Tomatoes via OMDb; popularity data from Netflix"
  selectionRule: string;            // the R1+R2 rule in one paragraph, rendered on /blog
  listSource: 'netflix-download' | 'committed-snapshot';
  netflix: { weeklyUrl: string; mostPopularUrl: string; downloadedAt: string; firstWeek: string; lastWeek: string; weeklySha256: string; mostPopularSha256: string };
  generatedAt: string;              // ISO datetime
  counts: { filmTitles: number; tvTitlesSkipped: number; poolEvaluated: number; eligible: 100; excluded: number };
  films: Film[];                    // exactly 100, ordered by popularityRank
  excluded: { netflixTitle: string; poolRank: number; reason: string; imdbId?: string }[];
}
interface Film {
  slug: string;                     // see 4.2
  popularityRank: number;           // 1..100 among eligible
  poolRank: number;
  netflix: { title: string; category: 'Films (English)' | 'Films (Non-English)'; popularityHours: number; hoursSource: 'weekly-sum' | 'first-91-days'; weeksInTop10: number; peakRank: number | null; firstWeek: string | null; lastWeek: string | null; mostPopularRank: number | null; runtimeMin: number };
  omdb: { imdbId: string; title: string; year: number; rated: string | null; released: string | null /* ISO date */; runtimeMin: number; genres: string[]; directors: string[]; writers: string[]; actors: string[]; plot: string | null; languages: string[]; countries: string[]; awards: string | null; metascore: number | null; imdbRating: number; imdbVotes: number; rtPercent: number };
  fetchedAt: string;                // ISO datetime of THIS film's OMDb response
  dataChangedAt: string;            // ISO date; changes only when a displayed value changes on refresh
}
```
`netflix.title` is raw Netflix text (contains em dashes and ALL CAPS, for example "Rebel Moon" followed by U+2014 and "Part One", or "STRAW") and is **never rendered**. Only `omdb.title` (via `displayTitle()`, which replaces any U+2013/U+2014 with " - ") renders. Derived values (gap, ranks, archetype, medians) are computed at build in `lib/blog/stats.ts` and never stored.

### 2.4 Build-time safety
- No network at build. Route code reads committed JSON only; never `lib/omdb.ts`, `lib/cached-omdb.ts` or `lib/ratings-store.ts` (jest test greps `app/blog` and `lib/blog`).
- **No filesystem reads at import time in `lib/pages.ts`.** It imports `lib/blog/registry.generated.ts`, a static TS module written by `node scripts/blog/build-registry.mjs`. A jest test regenerates it in memory and fails if the committed file differs.
- `app/blog/[slug]/page.tsx` and the hub read article files via `lib/blog/load.ts` (sync `fs`, memoised), only from server components that are fully prerendered (`dynamicParams = false`, no `revalidate`). Same pattern as `lib/og.tsx`'s font reads.
- `app/sitemap.ts` stays static (no dynamic APIs); add `export const dynamic = 'force-static'` to make it explicit.
- Refresh cadence: quarterly, plus after a new batch is chosen. A refresh changes titles, tables and OG cards automatically; `dataChangedAt` moves only for films whose values changed.

## 3. Article file format

### 3.1 File and schema: `data/blog/articles/{slug}.json`
| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | `1` | |
| `slug` | string | equals filename and a `films.json` slug |
| `imdbId` | string | equals the film's `omdb.imdbId` |
| `status` | `'draft' \| 'review' \| 'checked' \| 'published'` | writer sets `review`; fact-checker sets `checked`; integrator sets `published` |
| `published` | `YYYY-MM-DD \| null` | set only with `published` |
| `contentUpdated` | `YYYY-MM-DD` | last real prose edit |
| `shortTitle` | string? | <= 29 chars; required only when the title chain (R7) cannot fit; must be a recognisable form of the OMDb title (e.g. "Glass Onion") |
| `h1` | string | 30-90 chars; contains the display or short title; differs from the generated title |
| `description` | string | rendered length 120-158; contains the film title, the words "Rotten Tomatoes" and at least one score token; unique |
| `summary` | string | 45-75 words; answer-first; first sentence names the film and contains `{{imdb}}` and `{{rt}}`; also contains `{{asOf}}` and a direction word matching the archetype |
| `sections` | `{ id, heading, paragraphs: string[] }[]` | ids `why-split` (150-260 words), `the-film` (80-160), `who-it-suits` (80-160) required; `more` (0-150) and `data-note` (required when R15 says note) optional. Headings 20-80 chars, phrased as questions |
| `faq` | `{ q, a }[]` | 2-3 items; `q` 25-100 chars and contains the film title; `a` 35-90 words |
| `sources` | `{ id, url, title, publisher, accessed, supports }[]` | 0-6 writer sources; `url` https; `supports` = the exact claim, <= 200 chars. Every source cited at least once via `{{cite:id}}`; every cite resolves |
| `related` | `{ slug, reason }[]`? | 0-2 writer picks (shared director or actor, or a cited link); computed links fill the rest (4.4) |
| `review` | object | `{ writer, writtenOn, factChecker, factCheckedOn, cuts: string[], rtCheck: null \| { checkedOn, url, rtSitePercent, rtSiteReviews, outcome: 'match' \| 'note' \| 'hold' } }` |

Prose fields (summary, paragraphs, faq answers) allow: plain text, tokens, and internal links `[anchor](/path)` where `/path` is a registered page (max 3 per article). No HTML, no markdown other than links.

Tokens (rendered by `lib/blog/tokens.ts`; unknown token or a token whose value is null = build error): `{{title}} {{year}} {{imdb}}` (6.3) `{{imdbX10}}` (63) `{{rt}}` (36%) `{{metascore}}` (37) `{{votes}}` (361,059) `{{votesShort}}` (361K) `{{gap}}` (+12 / -27) `{{gapAbs}}` (27) `{{gapRank}}` (4th, by abs gap among the 100) `{{setSize}}` (100) `{{genre}}` (primary) `{{genreCount}} {{genreMedianGap}} {{popularityRank}}` (ordinal) `{{weeksInTop10}} {{peakRank}} {{hours}}` (454 million) `{{runtime}}` (118 minutes) `{{director}} {{asOf}}` (October 15, 2026) `{{cite:id}}`.

### 3.2 Generated, not written
Rendered by the template from data, excluded from word counts and similarity: the score table (IMDb, votes, RT, Metascore, gap, gap rank, archetype), the "Where it sits" facts list (gap percentile, genre median gap and this film's position, nearest-gap neighbours, Netflix weeks in Top 10, peak rank, popularity rank, hours), the sources list (OMDb, IMDb title URL `https://www.imdb.com/title/{imdbId}/`, Netflix Top 10 page, RT URL only when checked, plus writer sources), related links, method and disclaimer lines. Facts render as a `<table>` or `<dl>`, not sentences, so no boilerplate prose repeats across pages.

### 3.3 What makes each article distinct (all mandatory)
1. Answer-first summary built on this film's numbers.
2. `why-split` cites at least 2 film-specific fields or sources among: Metascore vs RT, vote volume, genre median gap, awards text, gap rank, a cited reception fact. It must say which side scored higher and by how much using the tier wording.
3. `who-it-suits` takes one conditional position derived from data (genre, runtime, rating, languages, archetype), never a personal viewing claim.
4. The template varies section order by archetype: critics-higher and audience-higher open with `why-split`; agreed archetypes open with `who-it-suits`.

### 3.4 Gap tiers and archetypes
`g = abs(gap)`. Allowed and forbidden wording (lint-enforced on prose):
| Tier | g | Use | Never use |
|---|---|---|---|
| agree | 0-4 | "closely agree", "within a few points" | gap, split, divide, disagree |
| slight | 5-9 | "slightly higher", "a small gap", "mostly agree" | wide, large, big, sharp, split |
| clear | 10-19 | "a clear gap", "noticeably higher", "disagree" | huge, massive, enormous, chasm |
| wide | 20-29 | "a wide gap", "a large gap", "sharply" | (any tier word above it) |
| very wide | 30+ | "a very wide gap"; "one of the widest in this set" only if gapRank <= 10 | (requires R15 RT check) |

Always forbidden: polarising/polarizing (one score per site cannot show polarisation), overrated, underrated, masterpiece, must-watch, flop, "critics hated", "audiences hated", best/worst (except a computed fact such as "the lowest IMDb rating in this set").
Archetypes: `critics-higher` gap >= +10; `audience-higher` gap <= -10; `agreed-high` g < 10 and both scaled scores >= 70; `agreed-low` g < 10 and both < 60; `agreed-mixed` otherwise.

### 3.5 Worked example outline: Red Notice (2021)
Values from the committed OMDb cache of 2026-10-15 and today's Netflix files (illustration only; real articles take every number from `films.json` tokens). IMDb 6.3 (361,059 votes), RT 36%, Metascore 37, gap 36 - 63 = **-27** (audience-higher, tier "wide"); runtime 118 min (Netflix runtime 1.9667 h = 118 min: match); genres Action, Comedy, Thriller; director Rawson Marshall Thurber; Awards "2 nominations total"; Netflix Most Popular English rank 2 (454.2M hours, first 91 days), 14 weeks in the global Top 10, peak rank 1, first week 2021-11-14.
- Title (generated): `Red Notice (2021): IMDb 6.3 vs RT 36%` (37 chars).
- Summary: names the film, `{{imdb}}` with `{{votesShort}}` votes vs `{{rt}}`, a wide audience-higher gap of `{{gapAbs}}` points, `{{gapRank}}` of `{{setSize}}`, as of `{{asOf}}`.
- `why-split` (opens the page): Metascore `{{metascore}}` sits with RT, so critics are consistent with each other; the audience side rests on a large vote base; compare with the action median `{{genreMedianGap}}`. Hedged interpretation only.
- `the-film`: one-sentence own-words premise from the OMDb plot (art thief, Interpol agent; no extra plot); director and the three billed leads from OMDb; Netflix chart facts as tokens.
- `who-it-suits`: conditional read on an action-comedy of `{{runtime}}` rated PG-13, where the audience score is the stronger signal.
- FAQ: "Why do critics and audiences disagree on Red Notice?", "Did Red Notice win any awards?" (answer restates "2 nominations total" exactly).
- No R15 check needed (g = 27, votes > 25k) unless chosen for the pilot.

## 4. Pages and routes

### 4.1 Routes
- `app/blog/page.tsx` (hub, registered path `/blog`).
- `app/blog/[slug]/page.tsx` with `generateStaticParams()` returning only `published` slugs from `registry.generated.ts`, `export const dynamicParams = false`, `generateMetadata` calling `pageMetadata(path, { fileImages: true })`.
- `app/blog/[slug]/opengraph-image.tsx` and `twitter-image.tsx`: 1200x630 text card (film, year, IMDb, RT, gap bar, "Scores as of"). File-based metadata overrides config metadata in the same segment; Task 4 must **verify the emitted og:image URL in the pilot build** (Next may add a suffix in dynamic segments) before deciding whether `BlogPosting.image` can be set. Do not hard-code it.

### 4.2 Slug rules
`slugify(omdb.title)`: NFKD, strip diacritics, lowercase, `&` to `and`, drop apostrophes, other non `[a-z0-9]` runs to `-`, trim, cut at a word boundary to <= 50 chars, then `-{year}`. Must match `^[a-z0-9]+(-[a-z0-9]+)*$`. On collision append `-{imdbId}`. Slugs never contain rank, list year or "top-100", and never change after publish; a film dropped by a later refresh keeps its page (data frozen, note added) or 301s to `/blog` (owner choice at refresh time).

### 4.3 Hub layout (`/blog`), all server-rendered, no pagination, no client sorting in v1
Title "Top 100 Netflix Films Rated by Critics and Fans" (47). H1 "The 100 most-watched Netflix films, rated by critics and audiences". Sections, in order:
1. Answer-first lede: computed median abs gap, counts per archetype, `asOf` (oldest and newest fetchedAt), published count.
2. "How the list is built": `selectionRule`, sources with links, Netflix data dates, download link `/data/netflix-top-100.json`.
3. Master table, 100 rows in popularity order: rank, film (link if published), year, IMDb, RT, gap, Metascore.
4. "Where critics and audiences split most": per archetype, the top 8 by abs gap (links only to published).
5. "By genre": table of primary genre (OMDb first genre; genres with < 5 films grouped as "Other"): count, median gap, largest split (linked).
6. "By release period": table (before 2010, 2010-2019, 2020-2022, 2023-2024, 2025-2026): count, median gap. No links.
7. "Popular, but not scored": `excluded[]` above the cut-off, plain text with reason.
8. "How these articles are made": AI-assisted drafting, per-article fact-check, data rules, corrections contact, non-affiliation line.
Budget: under 120 KB HTML; never pass `films.json` into a client component.

### 4.4 Related links (computed in `lib/blog/related.ts`, over **published** films only)
Writer picks (max 2) first, then fill to 4: (a) 2 same-primary-genre films with the nearest gap (tie: popularity rank); (b) 1 film of the opposite sign (same genre if any, else overall; for agreed films, the largest abs gap in the genre); (c) 1 sharing a director or one of the first 3 actors, else next-nearest gap overall. Plus previous/next by popularity rank (wraps). Total 6 film links; anchor = `{Title} ({Year})`. This guarantees every article >= 2 inbound article links plus the hub. Fixed links per article: `/blog` ("all 100 films and their scores"), `/compare/imdb-vs-rotten-tomatoes` ("how the two scores are built"), `/research/imdb-vs-rotten-tomatoes-gap` ("our 44-film study of Netflix Originals"), one CTA to `/install` after the score table ("see both scores on every Netflix card").

### 4.5 JSON-LD per article (one `@graph`, via `GuideLayout`)
- `WebPage` `@id #webpage`, `about: {"@id": "#film"}`, breadcrumb ref.
- `BreadcrumbList` `@id #breadcrumb`: Home > Blog > `{Title} ({Year})`.
- `BlogPosting` `@id #article`: headline = h1 (<= 110), description, `mainEntityOfPage {"@id": "#webpage"}`, datePublished, dateModified (= `updated`), author `authorRef`, publisher `orgRef`, `about {"@id": "#film"}`, `isPartOf: { "@type": "CollectionPage", "@id": ".../blog#webpage", "name", "url" }` (inline: `lib/html-seo.ts` fails bare refs not defined on the page), `isBasedOn: { "@type": "Dataset", "@id": ".../blog#dataset", "name", "url" }`, inLanguage `en`, wordCount.
- `Movie` `@id #film`: name, `datePublished` (OMDb released, else omitted), `duration` (`PT{n}M`), genre[], director Person[] (<= 2), actor Person[] (<= 4), `sameAs` IMDb URL only. Omit any N/A field.
- Never: aggregateRating, Review, FAQPage, HowTo, additionalProperty, provider, WatchAction, Netflix as publisher, image of a poster.
Hub: WebPage typed `CollectionPage` + BreadcrumbList + `ItemList` (published articles only: position, url) + `Dataset` (the public JSON, `DataDownload`, `temporalCoverage`, `measurementTechnique`) + Article from the layout.

### 4.6 Byline and dates (visible)
"By Igor Gazivoda (link `/about`) · Published {date} · Updated {date}" plus a line "Scores as of {fetchedAt}, via OMDb. Popularity from Netflix's Top 10 data ({firstWeek} to {lastWeek})." Footer non-affiliation line stays; each article also states it in the method line.

## 5. Integration

| File | Change |
|---|---|
| `lib/pages.ts` | `SitePage.kind?: 'article'`; hub entry (`/blog`, group `guide`, label `Blog`, priority 0.7, monthly, ogType article); `export const PAGES = [...STATIC_PAGES, ...blogPages()]` where `blogPages()` maps `BLOG_ARTICLE_PAGES` from `lib/blog/registry.generated.ts` (priority 0.5, monthly, ogType article, label `{Title} ({Year})`) |
| `lib/blog/*` (new) | `types.ts, load.ts, stats.ts, tokens.ts, title.ts (slug, displayTitle, title chain), related.ts, lint.ts, similarity.ts, registry.generated.ts` |
| `lib/seo.ts` | `pageMetadata(path, { fileImages?: boolean })` omits images when true; `webPage(path, { type?, about? })`; new `blogPosting(path, film)` and `movie(film)` builders |
| `components/GuideLayout.tsx` | optional props `articleNode`, `webPageOptions`, `faqSchema = true`, `bylineHref = REPO_URL`, `meta` (extra byline line). Defaults keep every existing page byte-identical |
| `lib/llms.ts` | `sectionsFor` excludes `kind === 'article'` from Project; llms-full adds `## Film analyses` with one line per published article: `- [{Title} ({Year})](url): IMDb x, RT y%, gap z, scores as of d`; llms.txt `Source` section adds the dataset link |
| `tests/lib/seo.test.ts` | on-disk check maps `/blog/*` to `app/blog/[slug]/page.tsx`; OG assertion: articles expect no config images (file convention), others unchanged; new: titles and descriptions unique across PAGES |
| other registry iterators | `tests/lib/schema-graph.test.ts` (`webPage` per PAGES entry: passes with default options; keep `webPage(path)` defaults unchanged) and `tests/billing/registry.test.ts` (no change). T3 greps `tests/**` for `PAGES` again before merging |
| `tests/lib/llms.test.ts` | "lists every registry page" filters `kind !== 'article'`; new: llms.txt has no article URL, llms-full has every published article |
| `scripts/validate-seo.mjs` | after `checkPage`, run `checkBlogPage()` from new `lib/blog-html.ts` on every `/blog/*` page (rules in 6.1) and corpus-level rendered similarity |
| `app/research/.../page.tsx` | title cells link to a published article with the same imdbId; one sentence linking `/blog` |
| `app/how-to/find-what-to-watch-on-netflix/page.tsx` | one contextual link to `/blog` |
| `app/compare/imdb-vs-rotten-tomatoes/page.tsx` | one link to `/blog` and 2 example articles (largest abs gap each direction, published) |
| `docs/seo/SITE-STRUCTURE.md` | replace `/netflix/[title]` with `/blog`; fix the AggregateRating row |
| `package.json` | scripts `blog:refresh`, `blog:registry`, `blog:brief`, `blog:check` (no deps) |

- Sitemap: automatic via PAGES; lastmod = `updated` (R14). Unpublished slugs are absent everywhere.
- Robots: no change (`/blog` and `/data/` allowed; nothing under `/api/`).
- `validate-seo` fails on any prerendered HTML not in PAGES; `generateStaticParams` and the generated registry read the same published list, so they cannot disagree.
- check-links: run `npm run seo:links` locally (Node 22.18+) before each batch; must report 0 errors, every article depth 2.
- Cannibalisation: article titles/H1s never contain the bare phrase "IMDb vs Rotten Tomatoes" without the film name; no blog page targets "show ratings on Netflix", "what to watch on Netflix", "best Netflix movies"; articles explain score definitions in at most one sentence and link `/compare`; they never restate `/research` statistics.

## 6. Quality gates and tests

### 6.1 Automated (jest unless noted; all run on every article with status >= `review`)
| Test file | Asserts |
|---|---|
| `tests/blog/films-data.test.ts` | 100 films; unique slugs and imdbIds; ranks 1..100; required fields non-null; rtPercent 0-100; imdbRating 1-10; votes >= 5,000; fetchedAt ISO; public copy equals `data/blog/films.json` |
| `tests/blog/article-schema.test.ts` | every file matches 3.1 (types, lengths, required sections, faq count, status/published consistency, slug and imdbId match a film) |
| `tests/blog/article-copy.test.ts` | over all article JSON strings **and** rendered `displayTitle`s: no `\p{Extended_Pictographic}`, U+2013, U+2014, U+2015, arrows U+2190-21FF / U+27F0-27FF / U+2900-297F / U+2B00-2BFF, U+2022, U+00B7, `->`, `=>`, `<-`, hex colours `#[0-9a-fA-F]{3,8}\b`; banned phrases (7.3); tier words (3.4); no score-like literal in prose (`\b\d\.\d\b`, `\d+\s?%`, `\d+\s?points?`); no 6-word run copied from `omdb.plot`; no "Netflix Original", "available on Netflix", "streaming now", "official", "partnered" |
| `tests/blog/tokens.test.ts` | every token resolves; null-valued tokens rejected; rendered description 120-158; generated title <= 50 for all 100 films (runs before writing starts) |
| `tests/blog/similarity.test.ts` | prose 600-900 words; unique words >= 450; pairwise 5-gram Jaccard <= 0.10; shared-5-gram ratio <= 0.20; summary pairwise 5-gram Jaccard <= 0.20; first 4 words of summary (film title as X) shared by <= 5 articles; section heading (film as X) reused by <= 5 articles; h1 and description unique |
| `tests/blog/links.test.ts` | `related` slugs exist; internal markdown links target registered paths; every published article has >= 2 inbound article links; each `{{cite:id}}` resolves and each source is cited; source URLs https and not on the banned list (7.4) |
| `tests/blog/registry.test.ts` | `registry.generated.ts` equals in-memory regeneration; only `published` entries; `lib/pages.ts` does not import `lib/blog/load`; `app/blog` and `lib/blog` import no `omdb`, `cached-omdb`, `ratings-store`; no `'use client'` under `app/blog` |
| `tests/blog/schema-graph.test.ts` | blog graph has exactly 1 Movie, 1 BlogPosting, no AggregateRating/Review/FAQPage/HowTo/additionalProperty keys anywhere, no `N/A`, absolute https URLs, ISO dates, dateModified >= datePublished |
| `validate-seo` (`lib/blog-html.ts`, unit-tested) | per rendered `/blog/*`: no `{{`; visible "Scores as of" date equals film fetchedAt; visible IMDb and RT values equal `films.json`; the JSON-LD rules of `schema-graph.test.ts` hold on the rendered page; `<article>` text 5-gram Jaccard between any two rendered articles <= 0.35 (chrome excluded) |

### 6.2 Human-style gates
- **Fact-check agent, one per article** (checklist 7.5). Output: `status: checked` or a list of failures. Any unsupported claim not removable by deletion = back to writer.
- **Pilot (3 films)**: highest popularity film in each of: `critics-higher` with gap >= +20, `audience-higher` with gap <= -20, an agreed archetype. All three get R15 RT checks. Pass requires all of: every automated gate green; 0 factual errors found by an independent second fact-check; owner scores each article 1-5 on information gain, accuracy, readability, non-templated voice, usefulness: mean >= 4.0 and no score below 3; summary answers "why do the scores differ" within 75 words; average cuts by the fact-checker <= 1 claim per article. Fail: revise the brief (Section 7) and redo the pilot, max 2 rounds, then stop and escalate.
- **Batch gate** (before each batch goes live): all automated gates, check-links 0 errors, owner spot-reads 3 random articles. **After-launch gate** (14+ days later, owner in Search Console): >= 70% of the previous batch indexed and < 30% "Crawled - currently not indexed", no manual action. Fail: pause, improve those pages, re-evaluate R4 before continuing.

## 7. Writer-agent brief (copied verbatim into `docs/blog/WRITER-BRIEF.md` in Task 6)

### 7.1 Inputs and commands
You own only `data/blog/articles/{slug}.json` for your assigned slugs. Never edit any other file. Start with `npm run blog:brief {slug}`: it prints the film record, every token with its rendered value, the archetype and tier with allowed and banned words, genre peers, computed related links, word budgets, and the banned phrase list. Finish with `npm run blog:check {slug}` (schema, copy lint, tokens, lengths, plot overlap, similarity against all other `review`+ articles; exit 0 = pass). Set `status: review` only when it passes.

### 7.2 Voice and structure
Plain, specific, neutral US English (US spelling, matching the site). Short paragraphs (2-4 sentences). Lead with the answer. One idea per paragraph. Numbers only as tokens. Write about the scores and what they suggest, not about your viewing. Use "we" only for the method ("we compare"), never for taste.

### 7.3 Content rules
- **Plot**: at most one own-words sentence (<= 30 words) based only on `omdb.plot`; no 6-word run copied from it; nothing beyond it (no twists, endings, scenes).
- **Allowed facts**: any `films.json` field (via tokens or names), and claims from a cited source on the allowed list (7.4) with `{{cite:id}}` in the same sentence.
- **Must cite**: release events, festival premieres, award wins or nominations beyond the OMDb `Awards` string, source material, production facts.
- **Forbidden**: availability, region or "on Netflix now"; affiliation or endorsement; box office, budgets, viewing figures other than the Netflix tokens; critic or user quotes; audience demographics; trivia; any claim about why critics or audiences felt something stated as fact.
- **Gap analysis**: state direction and size with the tier wording (3.4); explain with hedged, data-tied reasons only ("Metascore {{metascore}} lines up with the critics' side, which suggests..."); allowed reason types: Metascore agreement, vote volume, genre pattern in this set (`{{genreMedianGap}}`), awards text, the measurement difference (one sentence, link `/compare/imdb-vs-rotten-tomatoes`).
- **Banned phrases**: delve, it's important to note, in today's, whether you're, a testament to, tapestry, rollercoaster, buckle up, at the end of the day, in conclusion, edge-of-your-seat, cinematic journey, stands as, boasts, gripping, captivating, must-see, elevate, showcase, navigate, landscape, look no further, without further ado, a feast for.
- **Anti-template**: do not start the summary with "{Title} ({Year}) scores"; vary sentence frames; no stock closing line; headings are your own questions about this film; do not reuse a heading or opener from your other articles.
- **Length**: prose 600-900 words; `why-split` 150-260.

### 7.4 Sources
Allowed: Netflix newsroom or Tudum pages, oscars.org and other awarding bodies' official sites, official festival sites, the film's Wikipedia article only for release dates, premieres, awards and source material. Banned: Reddit, fan wikis, IMDb trivia or user reviews, review excerpts, AI-generated or listicle sites, any page you did not open. One source per claim minimum; `supports` holds the exact claim.

### 7.5 Fact-check agent checklist (edits allowed: delete sentences, edit `review`, set `status`)
1. Run `npm run blog:check {slug}`; any failure = return to writer.
2. Tag every sentence: token/field, cited, interpretation (hedged and data-tied), or unsupported. Delete unsupported sentences; record each in `review.cuts`.
3. Open every source URL; confirm it loads and states the `supports` claim; otherwise delete the claim and the source.
4. Confirm names (director, actors) match `omdb` exactly and the plot sentence adds nothing to `omdb.plot`.
5. Confirm tier and direction wording match the computed gap; no forbidden claims (7.3).
6. If R15 applies, open the Rotten Tomatoes film page, record `rtCheck`, and set outcome `match`, `note` (writer adds `data-note`) or `hold`.
7. Re-run `blog:check`; if prose fell below a minimum, return to writer. Else set `status: checked`, fill `factChecker`, `factCheckedOn`.

## 8. Work breakdown

| # | Task | Files owned | Depends | Parallel with |
|---|---|---|---|---|
| T0 | Owner signs off Section 1 and answers Section 9 questions | this spec | - | - |
| T1 | Data pipeline: `scripts/blog/refresh.mjs`, pure helpers `lib/blog/select.ts` + tests on fixture TSV; produce `films.json`, raw cache, public copy | `scripts/blog/refresh.mjs`, `lib/blog/select.ts`, `data/blog/films.json`, `data/blog/source/*`, `data/blog/omdb-raw.json`, `public/data/netflix-top-100.json`, `tests/blog/films-data.test.ts` | T0 | T2 |
| T2 | Core lib: types, load, stats, tokens, title, related, lint, similarity, `blog:brief`, `blog:check` + tests (fixtures until T1 lands) | `lib/blog/*` except `select.ts`, `scripts/blog/brief.mjs`, `scripts/blog/check.mjs`, `tests/blog/*` except films-data | T0 | T1 |
| T3 | Registry and SEO: `build-registry.mjs`, `pages.ts`, `seo.ts`, `llms.ts`, test edits, SITE-STRUCTURE doc | listed in Section 5 | T2 | T4 |
| T4 | Routes and UI: hub, `[slug]` page, OG/Twitter cards, `GuideLayout` props, `blog.module.css` (tokens only, no hex) | `app/blog/**`, `components/GuideLayout.tsx`, `components/blog.module.css` | T2 | T3 |
| T5 | `lib/blog-html.ts` + `validate-seo` hook; title-length check over all 100 films | `lib/blog-html.ts`, `scripts/validate-seo.mjs` | T3, T4 | T6 |
| T6 | Writer kit docs (`docs/blog/WRITER-BRIEF.md`, `FACT-CHECK.md` from Section 7) | `docs/blog/*` | T2 | T5 |
| T7 | Pilot: 3 writer agents (1 article each), 3 fact-checkers, independent second fact-check, owner review; verify og:image URL; full CI green with the 3 published locally | 3 article files | T1-T6 | - |
| T8 | Production writing: **20 writer agents x 5 articles** (97 films; agent k takes popularity ranks k, k+20, k+40... minus pilot films, so each agent gets mixed archetypes). Writers run concurrently; each owns only its files | `data/blog/articles/{own slugs}.json` | T7 pass | all writers |
| T9 | Fact-check: 1 agent per article, run in waves of 20 as articles reach `review`; then integrator runs the full jest corpus similarity and returns offenders | `review` blocks | T8 per article | T8 |
| T10 | Publish batch 1 (pilot 3 + next 17 by popularity rank with `checked`): integrator sets `published`, runs `blog:registry`, `tsc`, `jest`, `next build`, `seo:validate`, `seo:links`, deploys, `npm run seo:indexnow` | article status fields, `registry.generated.ts` | T9 | - |
| T11 | Batches 2-5 (20 each, >= 14 days apart, after-launch gate) | same | gate | - |
| T12 | Quarterly refresh: `blog:refresh --scores`, review diffs, re-run R15 checks for films whose gap tier changed, rebuild | `data/blog/*` | - | - |

Only the integrator touches `status: published`, `registry.generated.ts` and anything outside `data/blog/articles`.

## 9. Risks and what the owner must know

- **Scaled-content policy**: 100 pages from one template on a young domain can demote the whole site, including guides that already rank. Mitigation is everything above: computed findings, unique prose thresholds, fact-check, staged batches, and stopping when the after-launch gate fails.
- **Data accuracy**: OMDb relays RT scores that can be stale or wrong (Pinocchio). R15 limits exposure but most values remain unverified; pages say "via OMDb, as of {date}".
- **Freshness**: scores drift and the Top 10 grows weekly. Titles and numbers regenerate from data; the list itself changes only on a deliberate refresh. Plan a quarterly owner slot.
- **Trademark and affiliation**: Netflix, IMDb and Rotten Tomatoes are named only to identify sources; no logos, posters or red Netflix styling; the non-affiliation line appears on every page.
- **Strategy reversal**: `docs/seo/CONTENT-CALENDAR.md` and `COMPETITOR-ANALYSIS.md` rejected a blog and "best of" lists; record this change there. Head terms ("best Netflix movies") stay out of reach; success = long-tail "{film} IMDb vs Rotten Tomatoes" and "is {film} worth watching" queries plus AI citations of the hub table.
- **Entity gap**: GEO reports agree the ceiling is off-site (Chrome Web Store listing, Wikidata, Reddit/YouTube presence, "Rating Watch" name collision with credit ratings). 100 articles do not fix it.

Open questions for the owner:
1. **OMDb licence**: omdbapi.com states its data is licensed CC BY-NC 4.0 (verify the current wording). The same domain sells Pro. Is publishing 100 score pages acceptable, or do you need OMDb's written permission or a commercial arrangement first? This blocks T10, not T1-T9.
2. **Human review claim**: will you personally read each batch (3 spot-reads minimum)? If yes, articles may say "Reviewed by Igor Gazivoda"; if no, they say only "AI-assisted, fact-checked against the cited data".
3. **Licensed films (R3)**: confirm you accept Shrek, Despicable Me 2, Super Mario and similar in the list.
