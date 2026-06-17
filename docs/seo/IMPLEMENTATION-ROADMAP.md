# Implementation Roadmap — Netflix Ratings

_Last updated: 2026-06-17. Calibrated for **minimal / set-and-forget** capacity: every phase is a discrete batch of work that keeps paying off without ongoing maintenance._

## Sequencing principle

Ship in this order because each phase de-risks or amplifies the next:
**Trust anchor (CWS) → page coverage → automation → authority.**
If time runs out, **Phases 1–2 alone are a complete, defensible plan.** Phases 3–4 are upside.

---

## Phase 1 — Trust anchor & quick wins (the non-negotiables)
_Goal: close the distribution gap and bank the cheap on-page wins._

- [ ] **Chrome Web Store listing** (biggest single lever)
  - [ ] Resolve trademark-safe **store name** (descriptive, non-affiliated) + icon without Netflix red/logo
  - [ ] Write ASO-optimized title + description using the keyword gap list (`COMPETITOR-ANALYSIS.md`)
  - [ ] Add "Not affiliated with Netflix" disclaimer
  - [ ] Link the listing from homepage + `/install` once live
- [ ] **Connect Google Search Console + Bing Webmaster Tools** — establish the real baseline (everything else is guesswork until this exists)
- [ ] **Verify Core Web Vitals** are all "Good" on mobile (real values, not assumed) — fonts already use `display:swap`; check LCP/CLS on the hero
- [ ] **Add `Person` (author) node** to the JSON-LD graph in `app/layout.tsx` for E-E-A-T
- [ ] **Add `BreadcrumbList`** to the existing comparison page
- [ ] Confirm `sitemap.ts` and OG image render correctly in production (validate with Rich Results Test + a social debugger)

**Exit criteria:** CWS listing live (or submitted), GSC reporting data, CWV green, schema validates with zero errors.

---

## Phase 2 — Cornerstone page coverage (the reach foundation)
_Goal: ~6 hand-built pages targeting winnable tool-intent queries. This is the core of the whole plan._

- [ ] `/how-to/show-imdb-ratings-on-netflix` — `HowTo` + `BreadcrumbList` schema, screenshots, install CTA
- [ ] `/how-to/show-rotten-tomatoes-on-netflix` — sister page, reuse the template
- [ ] `/install` — GitHub steps now; structured so flipping to CWS is a one-line change later
- [ ] `/compare/alternatives` — "Reelgood / JustWatch alternative" angle, `ItemList` + `FAQPage` schema, honest comparison table (verify all competitor claims)
- [ ] `/how-to/find-what-to-watch-on-netflix` — broader-intent page (do last; most competitive)
- [ ] **Internal linking pass** — add a "Guides" nav/footer block linking all cornerstone pages; wire cross-links per `SITE-STRUCTURE.md`
- [ ] Regenerate `sitemap.ts` to include the new pages

**Build tip (fits set-and-forget):** factor a single MDX/React template + a small content data file so the 4 how-to/compare pages share one layout. Reuse the existing `lib/content.ts` pattern so copy and schema never drift.

**Exit criteria:** 6 pages live, each with valid schema, unique 300+ word body, screenshots, and an install CTA; all reachable within 2 clicks of home.

---

## Phase 3 — Reach engine (programmatic — OPTIONAL, gated)
_Goal: scale long-tail reach from data already in the pipeline (`lib/omdb.ts`). One-time build, self-refreshing thereafter. **Skip entirely if the quality gates can't be met** — thin pages hurt more than they help._

- [ ] Define template: `/netflix/[title]` → "Is {Title} worth watching? IMDb & RT scores"
- [ ] Source a finite, curated title list (e.g. top N popular Netflix titles) — **do not** generate an unbounded set
- [ ] Static-generate / ISR with nightly revalidation so scores stay fresh untouched
- [ ] `Movie`/`TVSeries` + `AggregateRating` (real values only) + `BreadcrumbList` schema
- [ ] Related-titles internal links (avoid orphans)

### 🚧 Quality gates (ALL must pass before a page is indexed/sitemapped)
1. **Both IMDb and RT scores resolve** — no page ships with missing data
2. **Unique value beyond the scores** — at least a short synopsis, genre, year, runtime, and a "where the audience/critic verdict diverges" line; not just two numbers
3. **Minimum body length** (~250+ words of non-boilerplate)
4. **No near-duplicate templates** — vary copy by data, not a find-replaced sentence
5. Pages failing any gate → `noindex` + excluded from sitemap (or not built at all)

**Exit criteria:** Engine produces only gate-passing pages; sitemap auto-includes passing pages; a spot-check of 10 random pages reads as genuinely useful.

---

## Phase 4 — Authority (one-time pushes, then passive)
_Goal: referring domains + non-Google discovery surfaces, with minimal ongoing effort._

- [ ] **Product Hunt launch** (durable backlink + branded searches)
- [ ] Submit to **AlternativeTo**, Chrome-extension directories, and relevant **"awesome" GitHub lists**
- [ ] One genuine **Reddit / Hacker News** post (r/netflix, r/chrome_extensions, r/selfhosted) — value-first, not spammy
- [ ] Polish the **GitHub repo**: topics, README with screenshots + site link, social-preview image (the repo itself ranks for the brand)
- [ ] Set up a **lightweight AI-citation check** (quarterly: ask ChatGPT/Perplexity "how do I see ratings on Netflix" and note whether we're cited)

**Exit criteria:** 15–20+ referring domains; appears in at least one AI engine's answer for a core tool-intent query.

---

## What "done" looks like (set-and-forget steady state)
- CWS listing live and linked
- ~6 cornerstone pages + (optionally) a self-refreshing programmatic layer
- Schema valid sitewide; GSC monitored monthly (15 min)
- Pages refresh their own data via ISR — no manual content cadence required
- A quarterly 30-minute check: GSC trends + AI-citation spot check
