# Feasibility: `/blog/series` (most-watched Netflix series rated by IMDb)

Date: 2026-11-09. Read-only study; no repo file other than this one was changed. Follows the Round 2 SERP study (`SWARM-SERP-2026-11-06.md`, section 2 "page B", marked "possible, low to medium confidence").

## Verdict

**Conditional GO, smallest viable first version only.** One static page, top 50 series, IMDb as the only score, Netflix's own hours as the ranking, no per-series articles, no Rotten Tomatoes or Metascore column. About 14 agent-hours plus about 1 owner hour. It can be built honestly, but it is a thin page by design: the film blog's differentiator (the IMDb vs Rotten Tomatoes gap) does not exist for series. Its value is the Netflix-published viewing data joined to IMDb, a dated method, and a downloadable dataset. Treat it as low priority and do not expand it beyond the v1 below until the existing `/blog` hub shows indexing evidence.

How the numbers below were obtained: Netflix TSVs fetched with curl today; 70 live OMDb requests (10 spot checks plus a 60-title dry run of the top series by hours, one `?t=` lookup each, using the key in `.env.local`; this spent about 70 of that key's daily 1,000). Nothing was written to `data/`.

## 1. Data availability and honest columns

### What OMDb returns for series (live, 2026-11-09)

- 60 of 60 sampled top series returned `Type: series`, `imdbRating`, `imdbVotes`, `Year` as a span ("2016-2025", "2020-" for ongoing), `totalSeasons`, genre, language, country, awards.
- **Rotten Tomatoes: 0 of 60.** The `Ratings` array held only the IMDb entry. **Metascore: `N/A` on 60 of 60.** This matches the repo's own evidence: `data/imdb-rt-gap.json` excluded 37 of 38 series for "Missing Rotten Tomatoes score in OMDb" (the 38th was not found), and its selection rule says "OMDb returned no Rotten Tomatoes score for any TV series". `data/blog/omdb-raw.json` holds only movies (125 of 125), so it holds no series evidence either way.
- OMDb `Runtime` for a series is the episode length, so the film pipeline's runtime cross-check (Netflix minutes vs OMDb minutes) cannot be reused for identity.

### Honest columns (v1)

| Column | Source | Note |
|---|---|---|
| Rank | Netflix hours, see section below | stated rule |
| Series | OMDb title (never the Netflix string) | Netflix titles contain ALL CAPS and odd punctuation (DAHMER, ONE PIECE) |
| Years | OMDb `Year` | |
| Seasons charted / OMDb totalSeasons | Netflix `season_title` rows / OMDb | shows the mismatch below openly |
| Hours viewed (since July 2021) | Netflix, summed over weeks and seasons | |
| Weeks in Top 10 | Netflix | |
| IMDb rating, IMDb votes | OMDb | the only score |
| Genre (first), language group | OMDb / Netflix category | for sections |

Not honest and must not appear: any RT or Metascore value or "n/a" filler column (say once, in prose, why there is none); any "season rating" (IMDb rates the whole series while Netflix hours are per season, so the page must say the IMDb figure is for the series as a whole); "best series" or "highest rated on Netflix" claims (the ranking is by viewing); availability claims (Netflix wording rules R3 and the banned-phrase list carry over).

Derived content that is real and cheap: median IMDb of the set, share at or above 8.0, "most-watched vs highest IMDb" (top 10 by IMDb among the 50, with the vote floor), IMDb by first genre, English vs non-English split, scripted vs unscripted note (Love Is Blind 6.2 and Too Hot to Handle 4.8 sit in this list), and "popular but not scored" (series skipped for low votes or identity doubt, with reason).

### Ranking rule for series (needs an owner decision, recommended below)

Netflix's TSV (`all-weeks-global.tsv`) has 4 categories; the two TV ones hold 1,282 distinct `show_title`s over 275 weeks (2021-07-04 to 2026-10-04 in the repo copy). Each row is one season in one week. Seasons appear as separate rows ("Squid Game: Season 1"), 175 rows have `season_title` = `N/A` (e.g. Stranger Things 22 rows, Queen Charlotte 10), and suffix styles vary ("Limited Series" 1,205 rows, "Part N", "Volume N", dated or arc names like "Hashira Training Arc", "Love Is Blind: S5: Houston").

- **Recommended:** rank shows by the sum of `weekly_hours_viewed` over every row with the same `show_title` (all seasons, all weeks). Hours is the only metric present in every TV row: `weekly_views` and `runtime` are blank on 2,040 of 5,500 TV rows (pre mid-2023), the same gap the film spec found. Dry run: 15 shows exceed 1 billion hours, 89 exceed 300 million, the 100th is Zero Day at 276 million; the top 10 are Stranger Things (5.84B), Squid Game (5.05B), Bridgerton, Wednesday, The Night Agent, Ginny & Georgia, You, Love Is Blind, Outer Banks, Manifest.
- **Caveats that must be printed on the page:** (a) hours favours long seasons and many charted seasons, and Netflix itself ranks by views since 2023-06-20 (hours divided by runtime), so this order differs from Netflix's current weekly ranking; (b) the data starts 2021-07-04, so seasons released earlier (Stranger Things 1 to 3, Money Heist Parts 1 and 2, early Ozark and Lucifer) are under-counted, so every claim says "since July 2021"; (c) Most Popular (`most-popular.tsv`) has only 20 TV season entries (first 91 days, per season) and cannot give 50 shows, so unlike films it is not merged in v1; (d) licensed series are in Netflix's data and in the list (Prison Break, Manifest, Lucifer, Cafe con aroma de mujer), worded as "ranked in Netflix's global Top 10", never "Netflix Original".

### Identity matching is the real risk (measured)

Dry run of the top 60 by hours, one OMDb `?t={title}&type=series` call each, accepting on normalised title equality, start year not after the first chart year, rating present, 5,000 votes:

- 51 of 60 pass a naive gate, but **at least 5 are wrong or doubtful and 2 of the wrong ones would pass a naive year test**: ONE PIECE (Netflix live action 2023, OMDb returns the 1999 anime, IMDb 9.0, passes a start-year-only test), Avatar: The Last Airbender (2024 live action vs the 2005 cartoon, IMDb 9.3), DAHMER (a Monster anthology season on Netflix; OMDb `?t=` returns "Conversations with a Killer: The Jeffrey Dahmer Tapes"), Monsters (Netflix 2024 anthology vs a 1988 show), Raw (a 2008 show with 500 votes). Prison Break (2005 original, licensed) is a true match that a human must confirm.
- Anthologies and spin-offs make the series-level rating ambiguous (Monster, Monsters, Black Mirror, Love Is Blind with 11 seasons and regional spin-offs). Exclude anthologies from v1 or flag them, never silently attach the umbrella rating to one season.
- Low votes drop 6 of 60 (Cafe con aroma de mujer 826, The Queen of Flow 2,107, The Marked Heart 4,869, Monsters 2,359, Raw 500, Single's Inferno 4,734). Non-English titles need overrides (Yo soy Betty, la fea was not found by `?t=` with `type=series`).
- So: expect roughly 10 percent of candidates (5 to 6 of 60 here) to end up wrong or doubtful and need a human identity decision or override. The film pipeline already has the right tools (`overrides.json`, `doubtful.json`, `[identity-doubtful]` guard); the series equivalent needs two doubtful rules: "OMDb start year 10 or more years before the first chart year" and "seasons charted greater than OMDb totalSeasons" (the second catches One Piece: 2 charted vs totalSeasons 1). A shorter year gap does NOT work for series: checked against the TSV, a "start year more than 1 year before the first chart year" rule fires on 22 of 29 older shows I tested (Stranger Things, Ozark, Cobra Kai, The Crown and others), because the data starts 2021-07-04 and each season charts years after the show began. With the 10-year rule, 6 of the 60 fire (Avatar, Prison Break, Monsters, Raw, One Piece, Cafe con aroma de mujer): 4 wrong, 2 legitimate (Prison Break, Cafe con aroma de mujer). Rules cannot catch same-title remakes within 10 years or anthologies, so **a human pass over all 50 final rows is mandatory**, not only over flagged ones.

## 2. Netflix definition source, attribution, terms

### Where "views", the window and seasons are defined (fetched today)

The Tudum pages the pipeline links do **not** define the metric. `https://www.netflix.com/tudum/top10/about` (fetched, 200) holds only the footnotes "Runtime is shown in hours and minutes", "Some titles may not be available in all regions"; `/tudum/top10` and `/tudum/top10/tv` are the same rendered table; the Most Popular TV page has the footnote "Rankings based on total views in the first 91 days of release". This confirms the SERP report's methodology gap. The definitions exist on Netflix's newsroom (about.netflix.com), which is also an allowed source host under `docs/blog/FACT-CHECK.md`:

- `https://about.netflix.com/en/news/top-10-things-about-netflix-top-10`: hours viewed is "the total number of hours members spent watching a season of a series or film"; views is the number of hours viewed "divided by the total run time"; weeks run "starting on Monday and ending on Sunday with the lists being published on Tuesday"; "Each season of a series is measured separately, so you might see Seasons 2 and 3 of Stranger Things on the list"; "All titles ... are eligible for the lists - series and films, kids and family, Netflix and licensed"; weekly reporting is rounded to 10,000.
- `https://about.netflix.com/en/news/new-top-10-on-netflix`: ranking switched to views from 2023-06-20; lists cover original and licensed titles.
- `https://about.netflix.com/en/news/what-we-watched-the-second-half-of-2023`: "views ... total hours viewed divided by runtime".

Quote status: these were read through a summarising fetch tool, not copied raw, so the exact sentences must be re-checked on the live pages before they are quoted on the site. A search summary also claimed a current Tudum methodology page (rounding to 100,000, runtime handling for staggered releases); I could not confirm it on any fetched page, so treat it as unverified and do not use it. The 10,000 rounding is the only rounding statement I verified.

### Attribution and terms

- The Tudum pages show only a "Terms of Use" footer link and no terms text, and the TSV files carry no license header. The owner accepted the Netflix Top 10 non-commercial-terms risk for the film blog (grill Q14); it applies equally to series and is not re-argued. Keep it on the owner-accepted list.
- Same wording discipline as films: name Netflix, IMDb and OMDb only to identify sources, no logos or posters, the non-affiliation line, and the data file `license` string "Scores belong to IMDb via OMDb; popularity data from Netflix" (drop "and Rotten Tomatoes"). OMDb's CC BY-NC position is already an accepted risk (Q1).
- Fetch note: the film spec recorded 403 from both Netflix file URLs without a browser User-Agent (2026-10-20) and the pipeline sends one. Today's curl with a browser User-Agent returned 200 and the live file now ends at week 2026-11-01. I did not test without the User-Agent.

## 3. Exact code changes

The film pipeline is hard-wired to films (`TARGET = 100`, `type=movie`, runtime gate, RT required, `Film` type with `rtPercent`). Recommended: **a parallel series path that reuses helpers, not flags on `refresh.mjs`**, so the film pipeline and its 3,900 lines of tests cannot regress.

### Data and pipeline (about 5.5 h)

| File | Change |
|---|---|
| `lib/blog/series-select.ts` (new) | Pure helpers: `aggregateSeries(rows)` (TV categories, group by `show_title`, sum hours, weeks, peak rank, first and last week, distinct `season_title`s, blank views and `N/A` seasons tolerated), `parseSeriesOmdb` (adds `Year` span start and end/ongoing, `totalSeasons`, `Type === 'series'`), `evaluateSeriesMatch` (title equality or override, start year not after first chart year, doubtful rule for far-older start year, seasons-charted vs totalSeasons), `checkSeriesEligibility` (rating present, votes >= 5,000, no RT rule), slug helper reuse. Imports `parseTsv`, `assertHeader`, `titlesMatch`, `normTitle`, `slugify`, `assignSlugs` from `lib/blog/select.ts` unchanged |
| `lib/blog/types.ts` | New `SeriesFile` and `Series` interfaces (no `rtPercent`, no gap; `netflix: { title, category, hours, weeksInTop10, peakRank, firstWeek, lastWeek, seasonsCharted }`, `omdb: { imdbId, title, startYear, endYear|null, totalSeasons|null, genres, languages, imdbRating, imdbVotes }`). Do not widen `Film` |
| `scripts/blog/refresh-series.mjs` (new) | Copy the structure of `refresh.mjs`: reads the same `data/blog/source/raw/*.tsv` (or downloads with the browser UA), uses its own `data/blog/series-omdb-raw.json` (not the film `omdb-raw.json`: `refresh.mjs --refresh` and the film cache validation assume movies, and I did not audit the film tests for a `Type === 'movie'` assertion) plus `source/series-lookups.json` and `source/series-overrides.json`; `?t=...&type=series`; writes `data/blog/series.json` and `public/data/netflix-top-series.json`; `MAX_REQUESTS` about 250; same abort and never-fill-a-value rules; writes `source/series-doubtful.json`. `package.json`: add `blog:refresh-series` |
| `data/blog/series.json`, `public/data/netflix-top-series.json`, `data/blog/source/series-*.json` | Generated, committed (about 60 to 100 KB) |
| `lib/blog/load.ts` | `loadSeriesFile` and `defaultSeriesPath` with the same validation style as `loadFilmsFile` |
| `lib/blog/stats.ts` or new `series-stats.ts` | Median IMDb, share >= 8.0, by-genre medians, IMDb-rank vs hours-rank, English/non-English split (pure functions) |

OMDb budget: walking about 58 candidates for 50 eligible costs about 60 `?t=` calls plus about 10 `?i=` calls for overrides, roughly 80 to 100 requests, under 10 percent of the free 1,000/day; a 100-series version costs about 150. Use the dedicated `BLOG_OMDB_API_KEY` so the extension's shared quota is untouched.

### Route, SEO and integration (about 5.5 h)

| File | Change |
|---|---|
| `app/blog/series/page.tsx` (new), `app/blog/series/_lib/series-view.ts` (new) | Static server component, `dynamic = 'force-static'`, reads committed JSON only (the registry test greps `app/blog` and `lib/blog` for `omdb`, `cached-omdb`, `ratings-store` and `'use client'`; keep that clean). A static segment wins over `app/blog/[slug]`, and film slugs end in a year so `series` cannot collide. Sections as in the SERP outline: how it is built, table of N series, highest IMDb among the most-watched, genre table, "popular but not scored", download link. Reuse `blog.module.css` tokens (no hex), `GuideLayout`, `licenseNode`, `publisherNode`, `authorNode` |
| `lib/seo.ts` | Parametrise the Dataset node (`BLOG_DATASET_ID/NAME/DESCRIPTION` are film constants) so the series page emits its own `Dataset` + `ItemList` + `CollectionPage` + `BreadcrumbList`. No `aggregateRating`, `Review`, `FAQPage` (R8 unchanged); no per-series `Movie`/`TVSeries` nodes in v1 |
| `lib/blog/registry.ts`, `scripts/blog/build-registry.mjs`, `lib/blog/registry.generated.ts` | Add `BLOG_SERIES_HUB: { ready, dataUpdated }` gated on `series.json` holding the expected count (`BLOG_EXPECT_SERIES`, default 50), mirroring `hubState`; `tests/blog/registry.test.ts` staleness check must cover it |
| `lib/pages.ts` | `BLOG_SERIES_PAGE` (path `/blog/series`, group `guide`, label "Most-watched Netflix series", priority 0.6, monthly, `ogType: 'article'`, `PAGE_UPDATED`-style date) inserted in `buildPages` after the `/blog` hub only when ready. Footer and the llms.txt "Guides" list pick up group `guide` with no further code (R16) |
| `lib/llms.ts` | `dataSection` gains a line for `/data/netflix-top-series.json` gated on the series page being registered; add a `DATASET_SERIES_PATH` constant next to `DATASET_PATH` |
| `app/sitemap.ts` | No change (driven by `PAGES`); lastmod comes from the page date and `dataUpdated` |
| `scripts/validate-seo.mjs`, `lib/blog-html.ts` | `checkBlogPage` runs on every `/blog/*` page with article rules; add an explicit skip or a series ruleset for `/blog/series` (visible IMDb values equal `series.json`, "Scores as of" and Netflix week range present, no `{{`) |
| Inbound links | `/blog` hub (a "Series" link), `app/how-to/find-what-to-watch-on-netflix/page.tsx`, `app/research/imdb-vs-rotten-tomatoes-gap/page.tsx` (one sentence on why series lack RT, which is also the honest answer to SERP query 10), `app/how-to/netflix-ratings-explained/page.tsx`; `lib/blog/inbound.ts` and `tests/lib/blog-inbound-links.test.ts` likely need the new gate |
| `docs/seo/SITE-STRUCTURE.md` | One row for `/blog/series` |

### Tests (about 2 h, included in the totals above)

- `tests/blog/series-select.test.ts`: aggregation on a fixture TSV (extend `tests/blog/fixtures/weekly-sample.tsv` with TV rows: multi-season show, `N/A` season, blank views, two seasons in one week, a title that changes case); identity rules including the measured traps (One Piece 1999 vs 2023, Avatar 2005 vs 2024, DAHMER title mismatch, Prison Break licensed legitimate); eligibility (no RT requirement, 5,000 votes).
- `tests/blog/series-data.test.ts`: exactly N series, unique ids and slugs, ranks 1..N, hours descending, no `rtPercent` key anywhere, public copy equals `series.json`.
- `tests/blog/series-hub.test.ts` (modelled on `pages-hub.test.ts` and `hub-gating.test.ts`): renders, all visible scores equal data, copy lint (no emoji, U+2013/2014, arrows, hex colours, banned phrases "Netflix Original", "available on Netflix", "best", "streaming now").
- Edits to existing tests: `tests/lib/seo.test.ts` (on-disk route check maps `/blog/*` to `[slug]/page.tsx`; exempt `/blog/series`; title and description uniqueness), `tests/lib/schema-graph.test.ts`, `tests/lib/llms.test.ts` ("lists every registry page"), `tests/lib/pages-dates.test.ts`, `tests/blog/registry.test.ts`.
- Gates to run: `tsc`, `jest`, `next build`, `npm run seo:validate`, and locally `npm run seo:links` (needs Node 22.18+).

### Copy and review (about 2 h)

About 400 to 600 words of prose (method, caveats, interpretation of the IMDb spread), written once, fact-checked against the Netflix newsroom pages above and `series.json` values via tokens where practical. No per-row prose.

## 4. Effort, risks, staleness

### Effort

| Block | Agent-hours |
|---|---|
| series-select.ts, types, load, stats and unit tests | 3.5 |
| refresh-series.mjs, live run, doubtful and override review | 3.0 (incl. 1 owner-reviewed hour of identity decisions in parallel) |
| Route, view helpers, CSS, JSON-LD | 3.0 |
| registry, pages, llms, validate-seo, inbound links, test edits | 2.5 |
| Copy, fact-check, CI and link gates | 2.0 |
| **Total** | **about 14 (range 12 to 18)**, about 2 working days with parallel agents |

Page budget: keep the film hub's limits (under 120 KB HTML for the whole page, never pass the series JSON into a client component); 50 rows is well under that.

Raising the list to 100 series adds about 2 hours (more candidates, more overrides) and is not recommended for v1.

### Risks

- **Thin content / OMDb mirror.** R2 of the film spec rejected exactly this ("a page without RT is an OMDb mirror"). The mitigation is the Netflix viewing data, the stated method, the genre and "most-watched vs highest rated" sections, and the dataset, but it remains a lighter page than any film article. One page only, so index-bloat risk is low; no scaled-content exposure.
- **Duplicates the competitor.** SERP query 10: whats-on-netflix "IMDb Top 100 Series on Netflix" (US library, "as of November 2026", IMDb plus RT, no stated method) is strong. Our difference is global Netflix viewing and a stated method. The page will not serve the query "highest rated netflix series" well by itself because its order is viewing, not rating; the IMDb-sorted section partly covers that.
- **Identity errors** (measured above) are the main integrity risk: a wrong series shows a confident wrong IMDb number (One Piece 9.0). Mandatory human pass on every row; the fact-check checklist needs a series variant.
- **Metric mismatch:** series-wide IMDb vs per-season Netflix hours; hours vs Netflix's own views ranking; data starting 2021-07. All three must be printed, not hidden.
- **Staleness.** `blog:refresh` is manual and not in CI. Last list refresh: Netflix files downloaded 2026-10-20, last chart week 2026-10-04, `films.json` generated 2026-10-21 (scores fetched 2026-10-21). Netflix has since published through week 2026-11-01 (verified today), so the current data is 4 chart weeks behind. A cumulative-since-2021 ranking tolerates this far better than a weekly page (SERP query 12), but step 0 of the build is a fresh TSV download and a series-only run (do not re-run the film `--list`; it would change the film pool and its recorded sha256). Plan the same quarterly refresh as the films, with an "as of" line and the dataset dates visible.
- **Unproven channel.** The `/blog` hub is live (200, in the sitemap) but has zero published articles (3 drafts in `review`), and I found no indexing evidence for it. Check Search Console for `/blog` impressions before spending the 14 hours.
- **Accepted, not re-opened:** Netflix Top 10 terms and OMDb CC BY-NC.

## 5. Recommendation and smallest viable v1

1. **Before building (15 minutes, owner):** look in Search Console at `/blog` indexing and impressions for "netflix most watched series" style queries. If the film hub is not indexed, defer series.
2. **Decisions needed:** (a) ranking = summed hours since July 2021 with the caveats above (recommended) vs best single season; (b) 50 series (recommended) vs 100; (c) anthologies (Monster, Monsters, Black Mirror, Love Is Blind) excluded or flagged.
3. **v1 scope:** `/blog/series`, top 50 shows by hours, columns as in section 1, IMDb only, sections: method and caveats, table, highest IMDb among the most-watched, genre table, popular but not scored, dataset download. Title `Most-Watched Netflix Series Rated by IMDb` (41 characters, from the SERP report). No per-series pages, no RT or Metascore, no `TVSeries` schema, no weekly element.
4. **Build order:** fresh TSV download, `series-select.ts` with tests, `refresh-series.mjs` live run, identity review, route and gating, pages/llms/validate-seo wiring, copy and fact-check, CI gates, deploy, `npm run seo:indexnow`.
5. **Not now:** per-series analysis articles, a 100-row version, a weekly "this week" page, RT-based gap for series (impossible with OMDb).
