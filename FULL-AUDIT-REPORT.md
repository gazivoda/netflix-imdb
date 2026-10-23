# Rating Watch: SEO audit and remediation

Date: October 23, 2026. Target: https://rating.watch. Business: browser-extension product with installation guides, comparison content and original research; experimental camera/AR tools.

## Executive summary

**Provisional SEO health: 86/100 before fixes; 91/100 after local remediation.** These are editorial audit scores over the assessed 90% of the skill's category weights, not Google scores, ranking predictions or a deployed re-audit. Field Core Web Vitals could not be measured, so the 10% performance category is unscored. Hosting defects remain open and are included in both technical scores.

All **15 discovered public HTML pages returned HTTP 200**. Each has one H1, a self-referencing canonical, a title and description within the repository's editorial limits, and no failures from the rendered-HTML SEO checker. No critical indexing blocker was confirmed on the canonical HTTPS host. The source fixes address account noindex discoverability, misleading content, schema/copy timing alignment and a broken SEO link checker. Existing uncommitted camera, ratings, billing and blog work is outside this change.

The largest outstanding problem is the **www host**: its TLS endpoint presents a self-signed Traefik default certificate. That requires hosting configuration, which is absent from this repository.

## Scope, evidence and method

- Three specialist agents covered technical/sitemap, content/schema, and performance/images/visuals. The coordinating agent crawled the live site, fixed validation tooling and integrated the changes.
- Robots-aware crawl: maximum 500 URLs, at most five concurrent requests, one-second pauses between batches, 30-second request timeout, at most three redirects. Fifteen public pages were discovered from the sitemap and internal links. The limit is not a claim that 500 pages exist or were fetched.
- The skill's `fetch_page.py` could not run because its Python `requests` dependency is absent. The equivalent fetch/crawl used curl and Python's standard library instead.
- Public deployment responses are recorded in [AUDIT-EVIDENCE-2026-10-23.json](docs/seo/AUDIT-EVIDENCE-2026-10-23.json). Separate diagnostic requests checked redirects, account metadata, 404 behavior and the www certificate.
- [Screenshot evidence and measurement conditions](screenshots/seo-audit-2026-10-23/README.md) distinguish live pages from local production builds. Local camera captures include pre-existing work and do not prove the committed camera implementation changed.
- No authenticated Google Search Console, Bing Webmaster Tools, backlink database or paid SERP data was available. No indexing, penalty, traffic, authority or rich-result appearance is inferred from that absence.

## Scoring

Scores are expert checklist assessments: confirmed failures reduce the relevant category; unavailable evidence is disclosed. Small numeric differences should not be treated as measured ranking gains.

| Category | Skill weight | Before | After local fixes | Basis |
| --- | ---: | ---: | ---: | --- |
| Technical SEO | 25% | 76 | 84 | Crawlability and routing sound on canonical host; account conflict/tooling fixed; www and HTTP redirect remain |
| Content quality | 25% | 84 | 92 | Useful original guides/research; corrected outdated and overstated claims |
| On-page SEO | 20% | 94 | 96 | All 15 pages have headings/canonicals/metadata; current source descriptions and maintained dates |
| Schema/structured data | 10% | 90 | 94 | Parse/reference/date checks pass; install timing aligned; eligibility limits retained honestly |
| Performance/CWV | 10% | Unscored | Unscored | Warm-cache diagnostics available; no field data or Lighthouse result |
| Images | 5% | 95 | 95 | Alt semantics, explicit dimensions, small WebP poster, deferred video verified |
| AI search readiness | 5% | 88 | 90 | Answer-first copy, attribution, source links, limitations, permitted search crawlers |

Before: `(76×.25 + 84×.25 + 94×.20 + 90×.10 + 95×.05 + 88×.05) / .90 = 85.5`, rounded to 86. After: the same formula with the after column gives 90.94, rounded to 91. A complete weighted score requires the missing performance evidence.

## Top findings and quick wins

No critical issue was confirmed; this list uses the actual severities rather than manufacturing five critical findings.

1. **High, hosting open:** www TLS/default router fails (T1).
2. **Medium, fixed locally:** robots blocks the account page's noindex directive (T2).
3. **Medium, fixed locally:** link-audit command fails to import the registry and cannot check the dynamic AR page (T3).
4. **Medium, fixed locally:** stale Netflix UI, incomplete Certified Fresh criteria and misleading no-badge diagnosis (C1–C3).
5. **Medium, fixed locally:** privacy claims omit the OMDb API key and observable IP address (C4).

Five quick wins implemented: permit account crawling, repair the link checker and run it in CI, correct Netflix UI explanations, correct source/availability claims, and align installation timing plus genuine edit dates.

## Technical SEO and sitemap

### T1 — High: www TLS/router, hosting action required

Verified curl to `https://www.rating.watch/` fails certificate validation (exit 60). Diagnostic inspection identified subject and issuer `CN=TRAEFIK DEFAULT CERT`; an explicitly unverified diagnostic request received HTTP 503. Plain HTTP www returned 404. The unverified response is diagnostic evidence only, not trusted page content.

Configure a valid certificate covering www and a permanent host redirect to `https://rating.watch`. A Next.js redirect cannot repair a certificate failure that happens before the application is reached. There is no Traefik/router configuration in this repository to update.

### T2 — Medium: account noindex conflict, fixed

The account page already sends `noindex, nofollow` and is absent from the sitemap, but every robots group disallowed `/account`. That prevents compliant crawlers from reading noindex and can leave an externally discovered URL indexed without content. Removed that exclusion in `app/robots.ts`, retaining `/api/` exclusions in every group. Authentication continues to protect account data. Regression tests cover wildcard and named groups. [Google's noindex requirements](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

### T3 — Medium: broken link validation, fixed

`npm run seo:links` failed with `ERR_MODULE_NOT_FOUND` resolving extensionless imports from the page registry. Native TypeScript loading also conflicted with the declared Node 20/22 support. The command now uses the existing ts-node dependency, matching `seo:validate`.

Build mode now fetches missing registry pages from `SEO_BASE_URL`, so the cookie-aware `/camera-vision/ar` route receives a real HTML check. Missing endpoints or non-200 responses fail explicitly. CI runs link validation alongside SEO validation against the same production server. New CLI tests exercise successful dynamic coverage, HTTP 503 and an omitted server URL.

### T4 — Medium: temporary HTTP redirect, hosting action required

`http://rating.watch/` currently redirects with 302 to HTTPS. Use 301 or 308 for the permanent canonical-host/protocol redirect in the reverse proxy. This is canonicalization cleanup, not a claim that the HTTPS pages cannot be indexed. [Google's redirect guidance](https://developers.google.com/search/docs/crawling-indexing/301-redirects).

### Confirmed passes

- Live robots and sitemap both return 200; sitemap has exactly 15 public URLs and real per-page lastmod values.
- Public search and AI search crawlers are allowed. Private JSON APIs are excluded in each matching group.
- The 15 canonical HTTPS HTML pages return 200, have self-referencing canonicals and permit indexing.
- `/install/` normalizes with one 308; nonexistent routes return a real 404 with noindex and no canonical.
- Account has noindex and no canonical. It remains out of the sitemap.
- HSTS, nosniff, referrer policy, frame policy and permissions policy are present; x-powered-by is absent.
- No blanket CSP was added: camera workers/WASM and permitted payment resources need a verified policy, not an unrelated SEO change.

## Content quality, on-page SEO and AI readability

### C1–C4 — Medium: factual and privacy corrections, fixed

- Both rating guides described Netflix percentage-match UI as current. They now describe its documented thumbs-based recommendation signals and link [Netflix Help](https://help.netflix.com/en/node/9898).
- The comparison omitted the minimum total-review requirement for Certified Fresh. It now explains that requirements vary by release type and gives the streaming-film minimum alongside score and Top Critics requirements. Source: [Rotten Tomatoes About](https://www.rottentomatoes.com/about).
- The Rotten Tomatoes guide treated every absent badge as unavailable source data. It now distinguishes an IMDb-only badge from no badge and links installation troubleshooting for quota, connectivity and setup failures.
- IMDb/alternatives privacy descriptions said only the title was sent. They now disclose the OMDb key and that OMDb sees the request IP, consistent with the privacy policy. IMDb ratings are also accurately described as a weighted average. Source: [IMDb ratings FAQ](https://help.imdb.com/article/imdb/track-movies-tv/ratings-faq/G67Y87TFYYP6TWAV).

### C5–C6 — Low: unsupported promises, fixed

Replaced the homepage's unbenchmarked “no lag” assertion with factual background/parallel lookup behavior. Qualified the research CTA and shared promo caption/VideoObject promises of both scores on every card: source availability and successful matching determine what appears.

### Quality and duplication checks

Nine editorial/home page components were rendered and only their main content analyzed. They contain approximately 709–1,631 words, average 13.0–15.9 words per sentence, and have estimated English Flesch scores of 61.4–73.3. Syllable counting is heuristic; these are readability diagnostics, not ranking criteria. Maximum pairwise five-word-shingle Jaccard similarity was 6.85% between the two rating guides. No substantial duplicated body or need for arbitrary word padding was found.

Visible authorship/contact, methodology, downloadable research data, source attribution, privacy details and product limitations are present. Historical task notes about fabricated testimonials are stale; none was found in the current product copy. External reputation and backlinks remain unmeasured.

All 15 live pages passed title/description/H1/canonical checks; title lengths were 28–62 characters and description lengths 140–160. Edited pages receive genuine October 23 dates from the central registry; unchanged pages retain their dates. Public pages are within two links of home, including AR via its camera demo. The unpublished blog registry remains unchanged; untracked film/article data is not published by this task.

Answer-first ledes, definitions, explicit caveats, cited sources and the original research help readers and machine extraction. Existing generated llms routes are maintained as a convention for compatible tools; they are not a Google ranking requirement or a guaranteed citation mechanism. [Google's June 2026 clarification](https://developers.google.com/search/updates#june-2026).

## Schema and structured data

- All live public pages pass the repository's JSON parse, reference resolution, date and visible FAQ consistency rules. This is an automated consistency check, not a substitute for every Google's Rich Results Test or Schema.org validation rule.
- **S1, low, fixed:** installation HowTo `totalTime` was PT2M while visible copy said about a minute; aligned to PT1M.
- Root Person/Organization entities and per-page references resolve across the combined document. Separate JSON-LD blocks linked by `@id` are not an error. [Google structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).
- Existing HowTo and FAQPage markup is preserved where it matches visible content. Neither is a current Google rich-result opportunity: HowTo support was retired, and FAQ rich results were discontinued in May 2026. The deployment checklist now reflects current guidance rather than the skill's outdated government/health restriction. [Google's May/June 2026 changelog](https://developers.google.com/search/updates#may-2026).
- SoftwareApplication has no genuine review or aggregateRating. It remains truthful semantic markup without claiming software rich-result eligibility; no rating is fabricated to satisfy [Google's software requirements](https://developers.google.com/search/docs/appearance/structured-data/software-app).
- Generic article images, new FAQ/HowTo markup, unsupported availability statements and review schema for third-party movie ratings were not added.

## Performance, images and mobile review

No confirmed source defect requiring a performance or image change was found. The production build reports 87.4 kB shared first-load JavaScript; camera dependencies remain route-specific. This is build output, not measured network transfer or field performance.

Live homepage/install/comparison/research and local homepage/camera/AR fit a real 390px viewport with one H1 and no document overflow. Homepage, pricing and alternatives also fit 320px. Wide comparison/research tables scroll within labeled regions.

Decorative logo images have empty alt text and explicit dimensions. The promo poster is a 37,364-byte WebP. The 4,614,970-byte MP4 uses `preload="none"`, is absent from requests before play, and has a reserved 16:9 frame. Analytics requests are absent before consent. No missing alt attributes were found in the 15-page crawl.

Single unthrottled warm-cache mobile observations: live LCP/FCP 84ms, TTFB 34.6ms; local pre-fix LCP/FCP 60ms, TTFB 7.4ms. No buffered layout-shift entries occurred in those samples. **These are diagnostic observations, not field LCP/CLS passes. INP was not measured.** PageSpeed Insights returned HTTP 429 quota exhaustion, so there is no Lighthouse score or CrUX result. Field CWV and representative cold/mobile-network performance remain unverified. See [measurement notes](screenshots/seo-audit-2026-10-23/README.md).

## Verification and remaining work

Source and tool regressions were reproduced before their fixes. The clean staged-release snapshot passes **1,948 tests with zero failures** (19 intentionally skipped), its production build and TypeScript check, and both SEO/link checks across **all 15 public pages with zero findings**. Build/typecheck/rendered checks and targeted CLI tests pass on Node 22.20.0. Full tests use Node 24.15.0 to match the existing native SQLite binary. Initial font/model download failures were resolved with approved network access. Details are recorded in `tasks/todo.md`.

The separate clean snapshot verifies the audit change without the pre-existing untracked blog corpus. In the shared working tree, two existing generated-registry tests disagree with that untracked corpus; it is intentionally preserved rather than publishing someone else's unfinished work. Independent scoped review found no blocking or important findings.

Apply the two hosting fixes in [ACTION-PLAN.md](ACTION-PLAN.md), deploy the committed code, then recheck live robots, redirects, the www certificate and the changed content. Pushing a commit alone does not prove deployment or indexing. Field CWV, Search Console indexing and third-party rich-result validation require their respective follow-up checks.
