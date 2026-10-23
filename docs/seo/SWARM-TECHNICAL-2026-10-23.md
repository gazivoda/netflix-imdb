# Technical SEO and structured-data swarm audit

Audit date: 2026-10-23, approximately 14:39–14:41 UTC. Site: https://rating.watch. Business: browser-extension product with guides, comparison pages, original datasets and experimental camera tools.

## Findings that affect the growth work

The canonical HTTPS site has a sound crawl and rendering foundation. A robots-aware crawl fetched all **16 sitemap URLs** with a 30-second timeout and a one-second pause between requests. All returned HTTP 200, had exactly one H1, a matching self-canonical, indexable metadata and parseable JSON-LD. This includes the ready `/blog` hub; no film analyses were published in the generated registry at audit time. These are accessibility observations, not proof that search engines indexed the pages.

Two hosting issues remain outside this repository:

- **High: `https://www.rating.watch/` fails certificate validation.** `curl` exits 60. The previous audit's default-proxy-certificate diagnosis remains relevant, but this run did not bypass TLS verification or repeat the certificate-subject diagnosis. Configure a valid www certificate and a permanent redirect to the canonical host.
- **Medium: `http://rating.watch/` returns HTTP 307.** This run observed a temporary redirect to HTTPS, superseding the earlier report's 302 observation. Use 301 or 308 for the permanent protocol redirect in the hosting/reverse-proxy configuration. [Google redirect guidance](https://developers.google.com/search/docs/crawling-indexing/301-redirects).

The concrete repository change is an **article attribution quality gate** in `lib/html-seo.ts`. The existing checker accepted `Article` and `BlogPosting` nodes without usable author or publisher attribution. It now requires an author name and absolute HTTPS profile URL, plus a publisher name, either embedded directly or resolved within that JSON-LD block. It accepts multiple authors and same-block `@id` references. The general reference checker still accepts definitions across the page's combined graph.

This is the project's stricter interoperability contract, not a claim that cross-script `@id` references violate Schema.org. Making article identity readable in one block helps consumers that inspect blocks independently. The coordinator owns the corresponding `article()` and `blogPosting()` builder changes. [Google's article guidance](https://developers.google.com/search/docs/appearance/structured-data/article) recommends author identity and a relevant author URL.

## Skills exercised and applicability

- **seo-technical / geo-technical:** crawlability, indexability, HTTPS/headers, redirects, rendering, mobile source, caching, compression and IndexNow readiness inspected.
- **seo-sitemap:** live XML parsed; 16 canonical HTTPS URLs; real registry-driven `lastmod`; no account/API/unpublished article URLs; all sitemap destinations returned 200. `priority` and `changefreq` are informational to Google and were not treated as a ranking lever.
- **seo-schema / geo-schema:** JSON-LD parsed across the crawl; Article/BlogPosting attribution strengthened; current Google documentation checked against older skill guidance. The entity-link opportunity was passed to the GEO/coordinator task.
- **seo-page:** homepage raw HTML, H1, canonical, social/robots metadata, schema and asset semantics checked alongside the site sample.
- **seo-images:** all 17 HTML image instances are decorative logo images with `alt=""` and explicit dimensions. No content image was misidentified as decorative. The video poster is a separate media attribute, 37,364 bytes and WebP; its CSS frame reserves a 16:9 ratio. The 4.4 MB MP4 uses click-to-play and `preload="none"` in source.
- **seo-hreflang:** not applicable. The site has a single English content version and no alternate translated or regional URLs. Adding artificial alternate tags would not create international content. [Google's localized-page guidance](https://developers.google.com/search/docs/specialty/international/localized-versions).

## Confirmed technical passes

- Robots and sitemap both return 200; robots references the canonical sitemap. Every named group excludes `/api/`, while `/account` remains crawlable so its intentional noindex can be read.
- Googlebot, Bingbot, Applebot, OAI-SearchBot, Claude-SearchBot and PerplexityBot are explicitly allowed. Source separates search bots, user fetchers and training bots.
- Main content, internal links, metadata and structured data are present in raw HTML. The audit did not depend on executing page JavaScript.
- HSTS, nosniff, referrer policy, frame policy and camera/payment permission policy are present. `X-Powered-By` is absent. No speculative CSP change was introduced into the camera/payment application.
- A GET with `Accept-Encoding: gzip, br` returns `Content-Encoding: gzip`. A HEAD request alone did not expose that compression header.
- The social image returns 200 with a PNG content type and immutable one-year caching. The video poster returns 200 as WebP with revalidation caching.
- The public IndexNow verification file returns the expected exact key. The existing submission script reads the sitemap. No submission was sent by this technical agent.
- Sitemap-destination fetch timing in this single audit vantage point ranged from 0.153 to 0.222 seconds for HTML response completion, median 0.183 seconds. These warm-response diagnostics are neither TTFB-only measurements nor field Core Web Vitals.

## Structured-data limitations and current guidance

Article images remain an opportunity requiring suitable original representative artwork. The blog specification deliberately forbids article images. A generic logo or unrelated social card should not be inserted merely to silence a recommendation; the new quality gate does not require an image. Google recommends relevant article images, but none was fabricated for this work. [Article documentation](https://developers.google.com/search/docs/appearance/structured-data/article).

Existing `HowTo` and `FAQPage` nodes describe visible content. They are not growth promises: HowTo rich results are discontinued, and **FAQ rich results stopped appearing on May 7, 2026**, superseding skill text that still describes a government/health exception. Google's June 15, 2026 update also clarifies that `llms.txt` does not positively or negatively affect Google Search visibility or rankings. General semantic markup and optional AI-facing files can remain maintained without being scored as guaranteed Google features. [Official Google changelog](https://developers.google.com/search/updates).

No synthetic aggregate reviews, fabricated ratings, invented social profiles, unsupported search action, or additional deprecated Google search feature was added. Valid schema does not guarantee a rich result. [Google structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

## Scores and verification

Editorial checklist assessments, on a 0–100 scale: **technical foundation 88; on-page technical markup 94; structured-data completeness 86 before coordinator changes; image implementation 96.** These are expert prioritization estimates, not measured ranking or traffic scores. No after-score is claimed before integration verification.

**Field Core Web Vitals: unscored.** No CrUX dataset or representative field LCP, INP or CLS measurements were available to this agent. Source inspection and response timing cannot establish those results. Google's thresholds are LCP 2.5 seconds, INP 200 milliseconds and CLS 0.1, assessed at the 75th percentile. [Web Vitals guidance](https://web.dev/articles/vitals).

Regression-first verification: the new tests produced 14 failures against the old validator for the missing attribution checks. After the scoped implementation, `npx jest tests/lib/html-seo.test.ts --runInBand` passed **62 of 62 tests**. The coordinator runs the full test suite, production build, TypeScript and rendered SEO/link verification after all swarm changes are integrated.

Independent integration review inspected the coordinator's new `/how-to/netflix-ratings-explained` guide and schema builder diff. Current Netflix help pages [9898](https://help.netflix.com/en/node/9898), [100639](https://help.netflix.com/en/node/100639), [2064](https://help.netflix.com/en/node/2064), the dated [2017 Match announcement](https://about.netflix.com/en/news/goodbye-stars-hello-thumbs), the [IMDb FAQ](https://help.imdb.com/article/imdb/track-movies-tv/ratings-faq/G67Y87TFYYP6TWAV) and [Rotten Tomatoes explanation](https://www.rottentomatoes.com/about) support the new copy. No blocking or important issue was identified. This is a source/content review, separate from the coordinator's final runtime verification.
