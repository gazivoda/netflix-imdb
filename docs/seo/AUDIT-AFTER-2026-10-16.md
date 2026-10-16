# SEO + GEO Re-Audit: netflix-ratings.app (after waves 1 and 2)

**Date:** 2026-10-16
**Scope:** current HEAD `6d429a3 docs: record wave 2 result and open items` (branch `worktree-agent-a74c285fe47810536`). That is wave 1 (20 SEO/GEO agents) plus wave 2 (paper & ink redesign by 20 agents). The "before" is `docs/seo/AUDIT-BASELINE-2026-10-15.md` (commit `614e3fe`, composite 63/100).
**Method (same as baseline):** `rm -rf .next && next build` (clean, 24 static routes), `next start -p 3600`, then `curl` of all 11 registered pages, robots.txt, sitemap.xml, llms.txt, llms-full.txt, manifest, OG/Twitter image, 404 and redirect probes; JSON-LD parsed with a script (every block valid JSON; visible-FAQ-to-FAQPage parity checked string by string); source read for file:line evidence. Added this round, because the redesign made them relevant: headless Chrome via DevTools Protocol at 375 px and 1280 px (layout overflow, CLS, LCP; fast and throttled to 1.6 Mbps / 150 ms), a WCAG contrast calculation on the CSS tokens, and a screenshot of the OG image. No source files were modified.
**Same categories, same weights, same rubrics as the baseline**, so deltas are comparable. Where a sub-row is judgment (as in the baseline), the evidence is beside it.
**Limits (unchanged):** production-only signals (HTTPS/HSTS on the live host, CDN, real Core Web Vitals, indexation, rankings, backlinks, brand mentions) cannot be verified from a local build and are marked provisional or excluded. All performance numbers below are **lab, localhost**; none is field data.

---

## 1. Scorecard

| Category | Baseline | Now | Delta | Weight |
|---|---|---|---|---|
| Technical | 78 | **86** | +8 | 20% |
| On-page | 72 | **83** | +11 | 15% |
| Schema / structured data | 55 | **60** | +5 | 15% |
| Content quality / E-E-A-T | 44 | **58** | +14 | 15% |
| Citability (passage level) | 54 | **70** | +16 | 15% |
| AI-crawler access | 85 | **92** | +7 | 10% |
| Platform readiness (avg of 5) | 53 | **63** | +10 | 10% |
| Brand / entity, off-site | unverifiable (code-visible ~15) | unverifiable (code-visible ~20) | +5 | not in composite |

**Composite (code-verifiable) = 0.20x86 + 0.15x83 + 0.15x60 + 0.15x58 + 0.15x70 + 0.10x92 + 0.10x63 = 17.2 + 12.45 + 9.0 + 8.7 + 10.5 + 9.2 + 6.3 = 73.35, reported as 73/100 (baseline 63.2, so +10).**

**geo-audit cross-check** (Citability 25 / Brand 20 / E-E-A-T 20 / Technical GEO 15 / Schema 10 / Platform 10; Technical GEO = mean of Technical 86 and crawler 92 = 89; Brand excluded and rescaled by 0.8): 0.25x70 + 0.20x58 + 0.15x89 + 0.10x60 + 0.10x63 = 17.5 + 11.6 + 13.35 + 6.0 + 6.3 = 54.75; /0.80 = **68/100** (baseline 56, +12). With the code-visible Brand portion (~20) counted at 20% it would be 0.20x20 + 54.75 = 58.75, i.e. 59 (baseline 48).

**Honest read.** The build is materially better on every measured axis, and nothing regressed in score. But the single most damaging trust problem in the baseline, **fabricated testimonials on the homepage, is still live** (four named personas with invented quotes and scores, now restyled as "review slips"). They are not in the schema (verified, section 4), which is why the damage is capped, but they cap Content/E-E-A-T and make the "truth only" rule fail on the front page. The privacy page content is also unchanged from the baseline (stale date, IMDb-only). The redesign introduced one measurable technical risk: a font-swap layout shift in the throttled lab (section 2). Off-site entity work (Chrome Web Store, sameAs profiles, mentions) has not happened, so the entity/brand half of GEO is where it was.

---

## 2. Technical: 86/100 (baseline 78, +8)

| Sub-category | Max | Baseline | Now | Evidence |
|---|---|---|---|---|
| Crawlability | 15 | 13 | **14** | `/robots.txt` 200, 4 groups, every group `Allow: /` + `Disallow: /api/`, `Sitemap:` present. `/camera-vision` is no longer an orphan: `npm run seo:links` shows every page at click depth <=2 with 10 inbound links each (registry-driven footer). Still emitted: non-standard `Host:` line (`app/robots.ts:46`) (-1). |
| Indexability | 12 | 10 | **12** | All 11 pages: one self-referencing canonical, equal to `og:url` and to the sitemap `<loc>`; homepage canonical is `https://netflix-ratings.app` (no slash) everywhere (canonical, og:url, WebSite.url, Breadcrumb Home item, sitemap). `/install/` is a single 308 to `/install`; `/install?x=1` returns the clean canonical; `/INSTALL` 404. **404 fixed:** `curl /nope` is 404 with exactly one `<title>` ("Page not found · Netflix Ratings"), `noindex` (the meta is emitted twice, "noindex" and "noindex, follow", harmless), no canonical, and a useful link set. |
| Security | 10 | 2 | **7** (provisional) | Local `curl -I` now returns `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN` (it works: my iframe probe was refused), `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `Permissions-Policy: camera=(self), ...`. `X-Powered-By` is gone. Missing: CSP (deliberate, documented in `next.config.js`, because `/camera-vision` loads tesseract/tfjs from CDNs) (-2), HSTS `preload` (-0.5), `/.well-known/security.txt` 404 (-0.5). Live-host HTTPS unverifiable. |
| URL structure | 8 | 7 | **8** | Flat, lowercase, hyphenated; trailing slash consistently 308; `/api/` now disallowed in every robots group; `/api/ratings` GET 405. |
| Mobile | 10 | 7 (prov.) | **8** | Viewport meta on all pages; **verified in headless Chrome at 375 px on 6 pages: document `scrollWidth` = 375 (no horizontal page overflow)**. Tables sit in a labelled, focusable scroll region (`role="region" tabIndex=0`). 36 `@media` rules in the app (baseline: guide CSS had none; it has 1). Header text links are hidden below 640 px (`site-chrome.module.css:93`), leaving only the Install button (-1). Four rules at 11 px (-1). Still no real-device test. |
| Core Web Vitals | 15 | 12 | **11** | Lab only. Unthrottled 375/1280: **CLS 0 on all 6 pages**, LCP 36-56 ms (localhost). **Throttled (1.6 Mbps, 150 ms), 375 px: CLS 0.115 `/`, 0.046 `/install`, 0.073 `/compare/alternatives`, 0.106 `/research/...`, 0.171 `/about`, 0.063 `/camera-vision`**, each a single shift at ~1.57 s when the web font swaps in. Cause is in the built CSS: Archivo is a variable face with `font-stretch: 62% 125%`, 40+ rules use `font-stretch: 62%`, but the generated fallback is `@font-face{font-family:__Archivo_Fallback; src:local("Arial"); size-adjust:98.70%}`. Arial has no width axis, so condensed headlines render ~60% wider in the fallback and re-wrap on swap. The preload of the latin subset helps on fast links but not in this throttle. Also: Hero H1/subtitle/CTA/mockup start at `opacity:0` with a 0.7 s rise animation (`components/home/shared.module.css:6`), which delays first visible text by ~0.8 s for no benefit. First Load JS: `/` 89.8 kB, guides 87.9-88.4 kB, `/camera-vision` 107 kB (unchanged, isolated). (-4: the throttled CLS is a regression the baseline did not have.) |
| Server-side rendering | 15 | 14 | **14** | Raw HTML (no JS) contains H1/H2s, body copy, every FAQ answer (`<details>`, collapsed answers are in the DOM), nav, footer, meta and JSON-LD on all 11 pages. Only `/camera-vision` is a client component, with its text shell server-rendered (-1). |
| Speed / server | 15 | 13 | **12** | Compression on (home 127,837 B raw / 21,542 B gzip, up from 84,790 / 15,047 at baseline, +43% gzip: bigger DOM from the marquee duplicate, redesigned sections and RSC payload). HTML `Cache-Control: s-maxage=31536000, stale-while-revalidate` (CDN-only, no browser `max-age`, and a one-year CDN TTL depends on purge-on-deploy). `robots.txt` is `max-age=0, must-revalidate`; `llms.txt` `max-age=3600, s-maxage=86400` (good). OG image `immutable, max-age=31536000`. CDN unverifiable. |
| **Total** | 100 | **78** | **86** | 14+12+7+8+8+11+14+12 = 86 |

Status codes verified 200: all 11 pages, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt` (new), `/manifest.webmanifest` (new), `/opengraph-image?v=3`, `/twitter-image?v=3`, `/apple-icon` (new, PNG 180), `/icon` (new, PNG 512), `/favicon.svg`, `/icon.svg`, `/data/imdb-rt-gap.json`, IndexNow key file. Still 404 (none required): `/.well-known/security.txt`.

**Sitemap:** valid XML, 11 URLs = `lib/pages.ts` exactly, no bloat; `lastmod` real per page (9 pages 2026-10-15, `/camera-vision` and `/privacy` 2026-06-17); `changefreq`/`priority` present (ignored by Google).
**Manifest:** name, short_name, description, start_url, scope, display standalone, theme/background `#ece6d8`, 3 icons (SVG any, 180 PNG, 512 PNG). No `id`, no maskable icon (cosmetic).
**OG image:** `https://netflix-ratings.app/opengraph-image?v=3`, 1200x630 PNG, 64,851 B, with `og:image:width/height/alt` and matching `twitter:*`. Inspected visually: the paper-and-ink ticket with the headline and IMDb/RT chips; all message text is in the image, but `og:image:alt` carries it, and this is a share card, not page content. No `<img>` and no inline SVG exists on any page, so there is no alt-text surface and no text locked in images elsewhere.
**Agent-readiness (non-scoring):** `Accept: text/markdown` still returns HTML; IndexNow script now derives its URLs from the sitemap (baseline defect fixed, `scripts/ping-indexnow.mjs`).

---

## 3. On-page: 83/100 (baseline 72, +11)

| Element | Baseline | Now | Finding |
|---|---|---|---|
| Titles (20%) | 90 | **92** | 11 unique, rendered length 56 / 64 / 60 / 56 / 54 / 65 / 64 / 64 / 53 / 59 / 32, all <=65 (enforced by test). Suffix consistent, home uses `absolute`. `Privacy Policy · Netflix Ratings` (32) remains generic. |
| Meta descriptions (15%) | 90 | **92** | 11 unique, all in the 70-160 window, answer-first, accurate. |
| Headings (20%) | 72 | **80** | Every guide uses question H2s ("How do I show IMDb ratings on Netflix?"). **Home now has a 40-60 word definition directly under the slogan H1**, and H2s "Why put IMDb and Rotten Tomatoes scores on Netflix title cards?", "What changes on a Netflix card with the extension?", "How does Netflix Ratings work?" are questions. The H1 itself is still a slogan ("Know if it's worth watching before you press play."). Heading order is clean on 10 of 11 pages (H1, H2, H3 with no skips). **`/camera-vision` still skips: H1, H3 (one), then six H4s, no H2** (-). Guide FAQ questions are `<summary>` elements, not headings. |
| Internal links (20%) | 55 | **85** | Registry-driven footer gives every page 10 inbound links, max click depth 2 (`seo:links` OK). `/privacy` and `/camera-vision` now have header and footer. Primary CTAs point to `/install`. Contextual body links exist across guides (about, compare, how-tos). Gap: the homepage body links only to `/compare/imdb-vs-rotten-tomatoes` and `/install`; the other guides are footer-only from home. Mobile header hides text links <640 px. |
| Social tags (10%) | 80 | **82** | OG + Twitter on every page, 1200x630 with alt, `og:type` article on guides, `?v=3` cache-bust. Still one identical image for every page; no `article:published_time`; `<meta name="keywords">` (ignored) on every page. |
| Thin pages (15%) | 55 | **62** | Content pages now 777-1,573 words (install 777, about 872, how-tos 1,061-1,411, compare 1,289, alternatives 1,154, research 1,573). `/privacy` 417 (appropriate). **`/camera-vision` is still 303 words of debug-style copy** ("Check browser console (F12)", live "Debug Information" status rows) with no answer block, and it is still in the sitemap (priority 0.5) and llms.txt. |
| **Weighted** | 72 | **83** | 0.20x92 + 0.15x92 + 0.20x80 + 0.20x85 + 0.10x82 + 0.15x62 = 18.4 + 13.8 + 16.0 + 17.0 + 8.2 + 9.3 = 82.7 |

---

## 4. Schema: 60/100 (baseline 55, +5; same 12-row rubric)

Detected (all JSON-LD, server-rendered, every block parses): root-layout `@graph` on all 11 pages (Person `#author`, WebSite `#website`, Organization `#org`, SoftwareApplication `#app`); per content page a second `@graph` with **WebPage `@id …#webpage` (isPartOf WebSite, about SoftwareApplication, breadcrumb ref)**, BreadcrumbList (`@id …#breadcrumb`), Article, FAQPage; HowTo on `/install` and 3 how-tos (HowTo steps match visible steps); **Dataset** on `/research/...` (DataDownload to `/data/imdb-rt-gap.json`); **ItemList** (7 items) on `/compare/alternatives`; **AboutPage + ProfilePage** on `/about`. Home: layout graph + a separate FAQPage block. `/privacy` and `/camera-vision`: layout graph only.

| Criterion | Max | Baseline | Now | Basis |
|---|---|---|---|---|
| Org/Person present and complete | 15 | 10 | **11** | Person (name, url, sameAs) and Organization (founder, description) present and cross-linked; the Person is now the `mainEntity` of a real on-site `/about` ProfilePage. Still no `logo`, contact, `jobTitle`, `knowsAbout`; Person `url` is still the repo, not an on-site page. |
| sameAs (5+ platforms) | 15 | 3 | **3** | Unchanged: Person `sameAs` = `github.com/gazivoda`; Organization and SoftwareApplication `sameAs` = the repo. No LinkedIn/X/YouTube/Product Hunt/Wikidata/Chrome Web Store. Needs the owner (docs/seo/OFFSITE-ENTITY.md). |
| Article + author | 10 | 7 | **8** | Article on 9 content pages with author/publisher `@id` refs that now resolve through WebPage and the graph tests. No `image`, no `@id`, `mainEntityOfPage` is a bare string. |
| Business-type schema | 10 | 7 | **8** | SoftwareApplication gained `installUrl`, `downloadUrl`, `browserRequirements`, version from the manifest; `operatingSystem` is now "Any (runs in Chromium-based browsers: ...)" (acceptable, slightly awkward). No `image`/`screenshot`. No rating, correctly. |
| WebSite + SearchAction | 5 | 0 | **0** | WebSite present, no SearchAction (the site has no search; N/A but scored per rubric). |
| BreadcrumbList on inner pages | 5 | 3 | **4** | 9 of 11 pages (all content pages). Not on `/privacy` or `/camera-vision`. |
| JSON-LD format | 5 | 5 | **5** | |
| Server-rendered | 10 | 10 | **10** | In raw HTML on every page. |
| speakable | 5 | 0 | **0** | none |
| Valid JSON + types | 10 | 8 | **8** | Valid everywhere, `<` escaped. Defects remaining below. (+1 for graph integrity offset by the new defects.) |
| knowsAbout | 5 | 0 | **0** | none |
| No deprecated schemas | 5 | 2 | **2** | HowTo (4 pages) and FAQPage (9 pages) are SERP-inert since 2023 but harmless for AI parsing. |
| **Total** | 100 | **55** | **60** | 11+3+8+8+0+4+5+10+0+8+0+2 |

**Checks requested:**
- **Homepage FAQ / JSON-LD parity: pass.** 10 visible FAQ items = 10 FAQPage Questions; every question and answer string appears verbatim in the visible text. Same 100% parity on all other FAQ pages (about 5/5, install 6/6, compare 7/7, alternatives 5/5, research 5/5, how-tos 5/5 each). FAQPage is not in the root layout.
- **Invented testimonials as schema: none.** `grep` for `Review`, `AggregateRating`, `Rating`, `ratingValue` over all 11 rendered pages finds zero hits. (But the testimonials are **still rendered visibly as `<figure><blockquote>` markup** on the homepage; see finding 1.)
- **Canonical / og:url trailing slash: consistent.** Root has no slash in canonical, og:url, sitemap, WebSite.url and breadcrumbs; non-root paths have no trailing slash and `/x/` 308s to `/x`.

Defects still open:
- Compare page `datePublished` is `2026-05-01` (the `PUBLISHED_DATE` fallback; `lib/seo.ts:106`, registry entry has no `published`) but the page first shipped 2026-06-16 (`b835497`). Same false date appears in its WebPage node.
- HowTo `totalTime: 'PT2M'` (`app/install/page.tsx:83`) vs visible "about a minute".
- `/about` has two nodes sharing `@id …/about#webpage` (GuideLayout's WebPage and the AboutPage/ProfilePage node) and also gets an `Article` node; low risk but a graph-integrity defect.
- `/compare/alternatives` ItemList names "Reelgood" but links the App Store listing.
- Article/HowTo/FAQ nodes still have no `@id`; no `image`; no `speakable`.

---

## 5. Content quality / E-E-A-T: 58/100 (baseline 44, +14)

| Dimension | Max | Baseline | Now | Evidence |
|---|---|---|---|---|
| Experience | 25 | 12 | **17** | A first-party reproducible study: 88 candidate titles fixed in a script before fetching, 88 OMDb requests, results cached in the repo, 44 usable films, with a hand-checked outlier (Guillermo del Toro's Pinocchio: OMDb 27% vs 96% on RT) disclosed. I recomputed the headline numbers from `public/data/imdb-rt-gap.json`: mean absolute gap 18.66 (reported 18.7), 27 of 44 at 15+ points (61%). Alternatives page records what the author actually could and could not load ("reelgood.com and imdb.com refused my automated requests"). Product claims still verified against `extension/`. No screenshots or usage evidence (by design). |
| Expertise | 25 | 12 | **16** | Compare page now cites IMDb's ratings help and RT's "about" page; alternatives page cites 8 external sources; methodology and limitations sections on the study. The three how-to pages carry 0-1 external citations each; the homepage 0. |
| Authoritativeness | 25 | 6 | **10** | A real `/about` (AboutPage/ProfilePage, maker credit, GitHub profile, contact route via GitHub issues) now exists and is linked from the footer. Still one person, no third-party mentions, no `LICENSE` file in the repo (README/launch kit flag it). |
| Trust | 25 | 14 | **15** | **+** visible Updated dates, per-page "not affiliated" footer, honest "not on Chrome Web Store yet", "Last verified" and limitations notes, illustrative-score captions now present ("Illustrative scores. The extension fetches real ratings as you browse."), "18 minutes" and "<1s" claims removed, `/privacy` gained header/footer. **-** (all still true at HEAD) fabricated testimonials on the homepage; "free, forever" (`components/home/FinalCta.tsx:7`) and "no login, ever" (`lib/content.ts` STATS) are promises about the future; privacy page unchanged: "Last updated: May 4, 2025" (a year before the repo's first commit), says "IMDB rating" only though RT is also read, "IMDB" casing, personal Gmail; compare page `datePublished` is false; the extension's OMDb key is hard-coded in the public repo (`extension/background.js:3`). |
| **Total** | 100 | **44** | **58** | 17+16+10+15 |

Copy nit: the study says scores "were fetched between October 15, 2026 and October 15, 2026".

---

## 6. Citability: 70/100 (baseline 54, +16)

| Category | Baseline | Now | Weight | Weighted |
|---|---|---|---|---|
| Answer block quality | 62 | **72** | 30% | 21.6 |
| Self-containment | 65 | **72** | 25% | 18.0 |
| Structural readability | 68 | **76** | 20% | 15.2 |
| Statistical density | 20 | **52** | 15% | 7.8 |
| Uniqueness / original data | 30 | **70** | 10% | 7.0 |
| **Overall** | **54** | **70** | | **69.6** |

Passage measurement (all pages, paragraphs/list items of 15+ words, main content only): paragraphs of 40-80 words per page: home 13, about 10, alternatives 9, compare 14, find-what 14, show-imdb 11, show-rt 12, install 5, research 10. **Passages in the 134-167 word optimum: 0 across the whole site** (longest paragraph 88 words, research). That is unchanged from the baseline and is the main reason this is 70 and not 80.

Page-level (est.): research 82, `/compare/alternatives` 70, `/compare/imdb-vs-rotten-tomatoes` 70, `/how-to/show-imdb...` 68, `/install` 68, `/how-to/find-what-to-watch` 66, `/how-to/show-rotten-tomatoes` 66, `/about` 62, `/` 52, `/privacy` 38, `/camera-vision` 14. Numeric tokens in main text: research 83, compare 21, install 13, show-rt 12, alternatives 11, show-imdb 11, find-what 10, home 9. External citation links: alternatives 8, compare 2, show-rt 1, research 1, all others 0.

Strong now: the study's lede ("Across 44 Netflix Original films, IMDb and Rotten Tomatoes scores differ by 18.7 points on average, and 61% of films differ by 15 points or more...") is a quotable statistic with source and date; the 44-row sortable-by-gap table; the alternatives table with "not stated" where unknown; every FAQ answer 40-80 words and self-contained.
Weak now: homepage Testimonials (fabricated, extractable quotes); the Marquee list (see section 10, finding 9); `/camera-vision` body; no passage of 134-167 words; how-tos still carry almost no outbound primary sources.

---

## 7. AI-crawler access: 92/100 (baseline 85, +7)

Live robots.txt: `*` and three role groups, every group `Allow: /` + `Disallow: /api/`, `Host:` and `Sitemap:`.

| Role | Bots named | Status |
|---|---|---|
| Search | Googlebot, Bingbot, Applebot, OAI-SearchBot, Claude-SearchBot, PerplexityBot | Allowed, explicit (Claude-SearchBot now named) |
| User-initiated | ChatGPT-User, Claude-User, Perplexity-User | Allowed, explicit (Claude-User now named) |
| Training | GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended, Bytespider, cohere-ai | Allowed, explicit |
| Not named (allowed via `*`) | Meta-ExternalAgent, Amazonbot, DuckAssistBot | -2 |

Fixed since baseline: deprecated `anthropic-ai`/`Claude-Web` tokens removed; accurate comment on Google-Extended; `/api/` disallowed in each group (a crawler with its own group ignores `*`); grouping and a documented "maximum visibility" policy in `app/robots.ts` with tests (`tests/lib/robots.test.ts`). **`llms.txt` and `llms-full.txt` are now generated from the registry** (all 11 pages, 5 groups, "testimonials" mention gone, `/install` present) with a drift test. Deductions: `Host:` still emitted (-1); `llms-full.txt` is only 7.7 kB (page descriptions + the homepage FAQ, not page bodies), so "full" undersells it (-2); no documented per-bot policy for the unverified-behaviour crawlers (Bytespider) (-1); origin returns 200 to bot user agents, CDN/WAF behaviour unverifiable (-2).

---

## 8. Platform readiness (avg 63/100, baseline 53, +10)

| Platform | Baseline | Now | Basis |
|---|---|---|---|
| Google AI Overviews / AI Mode | 60 | **72** | Indexable, SSR, per-page canonicals, rich-snippet permissions, answer-first ledes, FAQ/HowTo/Dataset markup, an original data study with method and limits. No field evidence of ranking (unverifiable). |
| ChatGPT search (Bing index + OAI-SearchBot) | 55 | **63** | Bots allowed; IndexNow script now derives paths from the sitemap and the key file is live. Still no Bing Webmaster verification meta, no third-party mentions. |
| Perplexity | 45 | **62** | Fact-dense, dated, partly cited content now exists (study, alternatives); still no community/video/Reddit presence (off-site, unverifiable). |
| Gemini | 50 | **55** | Same Google dependencies; no Chrome Web Store listing, no YouTube, one `sameAs`. |
| Bing Copilot | 55 | **62** | As ChatGPT. |
| **Average** | **53** | **63** | |

---

## 9. Brand / entity (off-site): unverifiable from code (code-visible ~20, baseline ~15)

Code-visible only: `/about` + `ProfilePage` give the Person a home on the site; `sameAs` is still a single GitHub profile (plus the repo for the product/organisation); no logo in schema; no Wikipedia/Wikidata/LinkedIn/X/YouTube/Product Hunt/Reddit/Chrome Web Store. Everything else (backlinks, mentions, stars, Search Console, Bing Webmaster, branded SERP) must be measured against the live domain. Not scored in the composite, as in the baseline.

---

## 10. Top 10 remaining findings (ranked)

| # | Severity | Finding (evidence) | Concrete fix |
|---|---|---|---|
| 1 | **Critical** | **Invented testimonials are still live on the homepage**: four named personas (Maya R., Devin O., Priya S., Tomás L.) with roles, quotes and "IMDb 9.2 / RT 94%" scores, in `<figure><blockquote>` markup (`components/home/Testimonials.tsx`, `lib/content.ts:57-86`). Not in schema (verified), but it is extractable fake first-person endorsement text that breaks the truth rule and caps E-E-A-T. Baseline finding #1, unchanged. | Delete `TESTIMONIALS`, the `<Testimonials />` call in `app/page.tsx:37` and the module; update `tests/home-structure.test.ts` and `tests/no-emoji-content.test.ts`. Replace with verifiable proof only (GitHub issues/stars with a dated source) or nothing. |
| 2 | **High** | **Privacy page content is unchanged since the baseline**: "Last updated: May 4, 2025" (predates the project), says only "IMDB rating" though Rotten Tomatoes comes from the same OMDb response, "IMDB" casing, personal Gmail, sitemap `lastmod` 2026-06-17 (`app/privacy/page.tsx`, `lib/pages.ts`). A policy that misdescribes the data flow is a trust and compliance defect. | Rewrite the copy (IMDb rating **and** Rotten Tomatoes score, both from OMDb; permissions per `extension/manifest.json`), set a true date, move it onto `GuideLayout`, bump registry `updated`, retitle "Privacy Policy for the Netflix Ratings Extension". |
| 3 | **High** | **Font-swap CLS and a font-stretch fallback gap** (new, introduced by the redesign). Throttled lab CLS 0.171 `/about`, 0.115 `/`, 0.106 `/research`; single shift at ~1.57 s. Built CSS: fallback `__Archivo_Fallback` is `local("Arial")`, `size-adjust:98.70%`, no width adjustment, while 40+ rules request `font-stretch: 62%` for display type (`app/layout.tsx:12-18`, `.next/static/css`). Also the Hero is `opacity:0` for ~0.8 s (`components/home/shared.module.css:6`). Lab only, no field data. | For the display face use `display: 'optional'` (no swap shift) or define a hand-tuned condensed fallback (`local("Arial Narrow")` with its own `size-adjust`/ascent overrides) bound to `--font-archivo` for `font-stretch:62%` rules; drop the opacity-0 hero reveal (animate `transform` only) so the H1 paints at once. Re-measure with the same CDP script. |
| 4 | **High** | **Entity/schema graph still thin**: one external profile in all `sameAs` arrays, Person `url` is the repo, no `logo`, `knowsAbout`, `speakable` or Article `image`; compare page `datePublished` falsely `2026-05-01` (first commit 2026-06-16, `lib/seo.ts:106`); `totalTime` PT2M vs "about a minute"; `/about` has two nodes with the same `@id …/about#webpage`. | Add `published: '2026-06-16'` to the compare registry entry; align `totalTime` to PT1M; give the AboutPage/ProfilePage its own `@id` (or merge it into the WebPage node); point Person `url` at `/about`; add `logo` (PNG), `knowsAbout`, Article `image`. Owner to supply LinkedIn/X/Product Hunt URLs and the Chrome Web Store link for `sameAs`. |
| 5 | **High** | **`/camera-vision` is still a thin, debug-style indexable page** (303 words, H1 then H3/H4 with no H2, "Check browser console (F12)", "Debug Information" panel, no WebPage/Breadcrumb node, 107 kB JS), in the sitemap at 0.5 and in llms.txt. Baseline finding #4, only half fixed (no longer an orphan, redesigned). | Either `robots: { index: false }` and drop it from the registry's sitemap/llms output until it is a product, or give it an answer-first definition, H2s, an honest "experimental" label, breadcrumb and a data-flow note (what the camera frames do and do not send). |
| 6 | **Medium** | **Unverified or future-tense promises remain**: "free, forever" (`components/home/FinalCta.tsx:7`), "no login, ever" (`lib/content.ts` STATS); extension OMDb key public in the repo (`extension/background.js:3`) with a shared daily quota the pages implicitly promise; no `LICENSE` file though the site says "open source". | Reword to present tense ("free and open source today"); add the MIT `LICENSE` the launch kit calls for; move the key to a proxy or user setting (product-level). |
| 7 | **Medium** | **Citability ceiling**: zero passages in the 134-167-word band across 11 pages; how-tos and home have no outbound primary citations; `llms-full.txt` is descriptions only. | Expand 2-3 key answers per cornerstone page to ~140-160 words with a table (what IMDb counts, what Tomatometer counts) and cite the IMDb ratings-FAQ and RT "about" pages (verify with fetch first); make `llms-full.txt` include each page's lede and FAQ answers, generated from the same sources the pages render. |
| 8 | **Medium** | **Content-in-components crawlability and extractability quirks** (redesign): FAQ questions are `<summary>` text with a literal "+" (`font-size:0`, `aria-hidden`) so plain-text extractors read "What is Netflix Ratings? +"; question text is not a heading, so heading-based chunkers miss it; the homepage renders its 12 illustrative marquee entries twice in the HTML (aria-hidden, `Marquee.tsx:8`, `.marqueeDup` only hidden under reduced motion) plus 8 mockup cards and the before/after pair, i.e. roughly 70 illustrative score tokens that a RAG chunker may read as facts. Not cloaking, but noisy. | Render the chevron as a CSS pseudo-element, not a text node; consider `<h3>` inside `<summary>`; drop the duplicated marquee copy from the server HTML (duplicate on the client or via CSS) and mark the whole illustrative block `data-nosnippet`. |
| 9 | **Medium** | **Mobile header and small-type gaps**: text links hidden below 640 px (`components/site-chrome.module.css:93`) leave only "Install"; four rules at 11 px (`HomeNav.module.css:101-102`, `Hero.module.css:142,174`); no real-device test (headless emulation only). | Keep a one-line scrollable nav or a disclosure menu at <640 px; raise 11 px text to >=12 px; run a real-phone pass. |
| 10 | **Low** | **Meta hygiene**: `<meta name="keywords">` on every page (ignored; `app/layout.tsx`), one shared OG image for all pages, no `article:published_time`, duplicate `robots` metas on the 404, `Host:` in robots.txt, no `security.txt`, no CSP, no HSTS `preload`, research copy "between October 15, 2026 and October 15, 2026", `s-maxage` of a year on HTML (needs purge on deploy). | Drop `keywords` and `host`; per-page OG text from the registry via `next/og`; add `openGraph.publishedTime`; add `security.txt`; add a report-only CSP; fix the date-range string; confirm CDN purge-on-deploy or shorten `s-maxage`. |

Redesign checks that **passed** (so nobody re-investigates): contrast (ink on paper 15.2:1, muted 7.5:1, faint 5.8:1, white on signal 4.57:1, red-text on paper 4.78:1, paper on teal 7.55:1; `--signal` used as text only at display sizes, e.g. Stats value on ink = 4.14:1, which clears the 3:1 large-text bar); heading order (only `/camera-vision` skips); text-only-in-images (none; the OG card has alt); hidden text (only an `.sr-only` skip link, the aria-hidden marquee duplicate and the zero-size FAQ glyph; no cloaking); crawlability of component-rendered content (everything is a server component; raw HTML carries all copy, FAQ answers, links and JSON-LD).

---

## 11. What moved and why

| Category | Delta | Why it moved (commit/wave) | Why it did not move further |
|---|---|---|---|
| Technical | +8 (78 to 86) | Security headers, `poweredByHeader:false`, compress (`af933f6`); custom 404 with single title/noindex, manifest, PNG icons (`6e82be2`); `/api/` disallow + current bot list (`d32f235`); no orphan pages, link audit script (`35f9bf9`); IndexNow from sitemap (`55c2c0d`); responsive CSS and skip link/landmarks (`3975e3d`, wave 2). | No CSP; font-swap CLS from the redesign (-1 in CWV); heavier home HTML (+43% gzip). |
| On-page | +11 (72 to 83) | Home definition paragraph and question H2s (`3975e3d`); CTAs to `/install`, registry footer gives 10 inbound links per page (wave 1 merge `6eefb44`); 8 new content pages 777-1,573 words. | `/camera-vision` still thin with H1 to H3 skip; slogan H1; shared OG image. |
| Schema | +5 (55 to 60) | `siteGraph()`, WebPage nodes with `@id`, @id integrity tests (`4ac6d5f`); Dataset (`a2d61ae`), ItemList (`ddf15e2`), AboutPage/ProfilePage (`cc37f0a`); `installUrl`/`browserRequirements`. | The entity half is unchanged: one `sameAs`, no logo/knowsAbout/speakable, false compare `datePublished`, PT2M. Rubric rewards entity completeness heavily (sameAs alone is 15 points). |
| Content / E-E-A-T | +14 (44 to 58) | `/about` (`cc37f0a`); original reproducible study with disclosed outlier (`a2d61ae`); sourced alternatives page (`ddf15e2`); illustrative-score captions; removal of "18 minutes" and "<1s"; compare methodology with sources (`039732a`). | **Testimonials still live; privacy page unchanged;** "free, forever"; public API key; no LICENSE. Without the testimonials the Trust row alone would be worth ~5 more points. |
| Citability | +16 (54 to 70) | Answer-first ledes, question H2s, FAQ answers 40-80 words on 9 pages; the Dataset and its 44-row table; alternatives comparison table; 10 homepage FAQs (`039732a`). | No 134-167-word passages; few outbound citations on how-tos; homepage still marketing-led. |
| AI-crawler access | +7 (85 to 92) | Role-grouped robots with current tokens, `/api/` disallow, accurate comments, tests (`d32f235`); generated llms.txt/llms-full.txt from the registry (`03d4c87`). | `Host:`; some bots unnamed; llms-full is descriptions only. |
| Platform readiness | +10 (53 to 63) | The above feed all five platforms; IndexNow derived from sitemap. | Off-site (Chrome Web Store, mentions, YouTube/Reddit, Bing Webmaster) not done; unverifiable here. |
| Wave 2 (redesign) overall | ~0 net on score | Positive: AA contrast, reduced-motion, emoji-free content, a11y landmarks, OG/icon refresh. Negative: font-swap CLS, +43% home HTML, hero `opacity:0` reveal. | Redesign did not touch SEO substance; it moved Technical/CWV by -1 and exposed no content defects other than those listed. |

---

## 12. Verification output

`npm run -s seo:validate`
```
seo:validate: 11 pages OK
```

`npm run -s seo:links`
```
Checked 11 pages (.next/server/app), max click depth 2

PAGE                                    DEPTH  INBOUND
/                                       0      10
/install                                1      10
/how-to/show-imdb-ratings-on-netflix    1      10
/how-to/show-rotten-tomatoes-on-netflix 1      10
/how-to/find-what-to-watch-on-netflix   1      10
/research/imdb-vs-rotten-tomatoes-gap   1      10
/compare/imdb-vs-rotten-tomatoes        1      10
/compare/alternatives                   1      10
/about                                  1      10
/camera-vision                          1      10
/privacy                                1      10

OK: no findings.
```

`npx jest`
```
Test Suites: 22 passed, 22 total
Tests:       1 skipped, 395 passed, 396 total
Snapshots:   0 total
```
(Baseline: 57/57.) `next build` clean: 24 static routes, First Load JS shared 87.4 kB.

## 13. How to re-score next

- Re-run the same probes: `rm -rf .next && next build`, `next start`, curl all `PAGES` plus robots/sitemap/llms/404, parse JSON-LD, recount passages. For CWV, re-run a DevTools-Protocol script at 375 px with the same throttle (1.6 Mbps / 150 ms) and compare the per-page CLS above.
- Biggest available gains: delete testimonials and fix privacy (Content 58 to 70+), fix font fallback/hero reveal (Technical CWV +4), entity fields and the false dates (Schema 60 to 70+), a few 140-word cited answers (Citability 70 to 78).
- Add Brand/entity at 20% weight once Search Console, Bing Webmaster and a brand-mention scan exist; record that as a re-baseline, not a regression.

*Local probe artifacts (not committed): scratchpad `h/*.html`, `h/*.hdr`, `cdp.mjs`, `an.mjs`, `ld.mjs`, `cit.mjs`, `contrast.mjs`.*
