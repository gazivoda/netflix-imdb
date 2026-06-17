# SEO Strategy — Netflix Ratings

_Last updated: 2026-06-17_

## 1. Snapshot

| | |
|---|---|
| **Product** | Free, open-source browser extension that overlays IMDb + Rotten Tomatoes scores on Netflix title cards |
| **Site** | `https://netflix-ratings.app` (Next.js 14, App Router) |
| **Repo** | `https://github.com/gazivoda/netflix-imdb` |
| **Primary KPI** | **Organic traffic / reach** (installs treated as secondary) |
| **Distribution** | Chrome Web Store listing **pending** — currently "Load unpacked" from GitHub |
| **Capacity** | **Minimal / set-and-forget** — favour one-time, self-maintaining assets over ongoing content |

### What's already strong (don't rebuild it)
The on-page foundation is unusually good for a project this size and should be **preserved, not re-litigated**:
- JSON-LD `@graph` with `WebSite`, `Organization`, `SoftwareApplication`, `FAQPage` (`app/layout.tsx`)
- `llms.txt` present and accurate (`public/llms.txt`)
- `robots.ts` explicitly welcomes 12 AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.)
- Clean canonical, OG/Twitter meta, keyword targeting, sitemap, dark-mode viewport
- A real comparison page (`/compare/imdb-vs-rotten-tomatoes`) with depth

This means the **technical + GEO base is ~80% done**. The gap is **distribution, page coverage, and off-site authority** — not on-page hygiene.

## 2. Strategic thesis

> **Own tool-intent and long-tail title-rating queries that JustWatch / Reelgood / IMDb under-serve, with a small set of pages that maintain themselves, and be the source AI engines cite for "how to see ratings while browsing Netflix."**

Three reasons this is the right wedge given the constraints:

1. **We cannot out-content the discovery giants.** JustWatch, Reelgood, and listicle farms own "best shows on Netflix." Competing head-on needs an ongoing editorial team we don't have.
2. **Tool-intent queries are winnable and convert to reach.** "How to show IMDb ratings on Netflix," "see Rotten Tomatoes on Netflix," "Netflix ratings extension" — here the extension *is* the answer, and the SERP is full of weak SEO from forum threads and dated blog posts.
3. **A data-driven page engine scales reach without ongoing labour.** We already pull structured ratings (`lib/omdb.ts`). Generating per-title pages from that data is a one-time build that produces hundreds-to-thousands of long-tail landing pages — the definition of set-and-forget reach.

## 3. The three pillars

### Pillar A — Chrome Web Store listing (Phase 1, highest single ROI)
The "Load unpacked from GitHub" install path is the biggest ceiling on both reach and trust. A CWS listing delivers, in one move:
- A **high-authority backlink** (chromewebstore.google.com) and a citable, structured entity
- A **branded-search surface** ("Netflix Ratings extension" → store result) that feeds organic discovery
- **ASO traffic** inside the store's own search (a second search engine)
- Social proof (install count, reviews) that lifts conversion on every other page

⚠️ **Trademark risk:** Chrome Web Store rejects listings that imply affiliation with Netflix. Use a non-infringing store name (e.g. "Ratings Overlay for Netflix" or "IMDb & RT Scores for Streaming"), avoid the Netflix "N" logo/red, and add a "not affiliated with Netflix" disclaimer. Same risk applies to the `netflix-ratings.app` brand — see Risks.

### Pillar B — A self-maintaining page engine (programmatic SEO)
Generate long-tail landing pages from the ratings data already in the pipeline. Candidate templates:
- `/netflix/[title]` — "Is _{Title}_ worth watching? IMDb & Rotten Tomatoes scores" (one page per popular title)
- A few **curated cornerstone pages** (hand-built, ~6 total) for the top tool-intent queries

This is the only way to grow *reach* at scale without an editorial cadence. It must ship with **thin-content safeguards** (see `IMPLEMENTATION-ROADMAP.md`) — programmatic pages that are thin get the whole site demoted. If the engine can't clear the quality bar, **ship the 6 cornerstone pages only and skip the programmatic layer.** Reach from 6 strong pages beats reach from 800 thin ones.

### Pillar C — Off-site authority (one-time pushes, then passive)
Set-and-forget link sources that keep sending traffic after a single submission:
- Product Hunt launch (also a durable backlink + branded searches)
- AlternativeTo, Chrome-extension directories, "awesome" GitHub lists
- One well-placed Reddit/HN post (r/netflix, r/chrome_extensions, r/selfhosted)
- GitHub repo topics + a strong README (the repo already ranks for the brand)

## 4. Target query map

| Intent tier | Example queries | Page that wins it |
|---|---|---|
| **Tool-intent (core wedge)** | "show imdb ratings on netflix", "rotten tomatoes on netflix extension", "netflix ratings overlay", "see ratings while browsing netflix" | Homepage + cornerstone how-to pages |
| **Comparison** | "imdb vs rotten tomatoes", "which rating to trust" | `/compare/imdb-vs-rotten-tomatoes` (exists) |
| **Alternatives / brand** | "reelgood alternative", "justwatch alternative chrome extension", "netflix enhancer ratings" | Cornerstone alternatives page |
| **Long-tail title (reach engine)** | "is {title} worth watching", "{title} imdb rating", "{title} rotten tomatoes score netflix" | Programmatic `/netflix/[title]` |
| **Informational / GEO** | "how do critics and audiences differ", "what's a good imdb score" | Comparison page + FAQ blocks (AI-citation targets) |

## 5. KPI targets

Site is effectively at zero organic baseline (recent launch). Targets are deliberately modest and reach-weighted, not install-weighted.

| Metric | Baseline | 3 Month | 6 Month | 12 Month |
|---|---|---|---|---|
| Organic sessions / mo | ~0 | 300 | 1,500 | 6,000 |
| Indexed pages | 4 | 10 | 50–800* | 100–1,000* |
| Ranking keywords (top 50) | ~0 | 40 | 150 | 500 |
| Tool-intent keywords (top 10) | 0 | 3 | 8 | 15 |
| AI citations (ChatGPT/Perplexity/AIO) tracked | 0 | 1–2 | 5 | 12 |
| Referring domains | 1 (GitHub) | 8 | 20 | 40 |
| Core Web Vitals (all "Good") | TBD-verify | ✅ | ✅ | ✅ |

\* Wide range depends on whether the programmatic engine ships and passes quality gates.

## 6. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Netflix trademark** in brand/domain/store name | CWS rejection, takedown, deindex of brand terms | Use descriptive (non-affiliated) store name + logo; add disclaimer; consider a neutral brand for the store listing even if the marketing site keeps `netflix-ratings.app` |
| **Thin programmatic pages** | Sitewide quality demotion | Hard quality gates (word count, unique data, no-index pages below threshold); ship cornerstone-only if gates can't be met |
| **OMDb rate limits / data licensing** | Pages 404 or show stale/empty scores | Cache + static-generate; only publish pages where both scores resolve; nightly revalidate |
| **Set-and-forget decay** | Comparison/title data goes stale, erodes trust + rankings | Use ISR/scheduled revalidation so pages self-refresh without manual edits |
| **Single dependency on Google** | Algo update wipes reach | GEO + Chrome Web Store + repo give non-Google discovery surfaces |

## 7. Companion documents
- `COMPETITOR-ANALYSIS.md` — who ranks now and where the gaps are
- `SITE-STRUCTURE.md` — URL hierarchy, internal linking, schema per page type
- `IMPLEMENTATION-ROADMAP.md` — phased build with quality gates
- `CONTENT-CALENDAR.md` — the (deliberately tiny) content backlog
