# Rating Watch: SEO and GEO traffic growth release

Date: October 23, 2026. Canonical site: https://rating.watch. Baseline: `c786e2e`, clean working tree. Objective: attract qualified visitors searching for Netflix rating information and make the site's original research easier to discover and verify.

## What this release changes

1. Adds `/how-to/netflix-ratings-explained`: a sourced answer to the difference between Netflix thumbs, historical Match percentages, maturity labels, IMDb user ratings and Rotten Tomatoes critic approval. It links to installation, the existing setup guides, the score comparison and the ready research hub. It uses the established server-rendered guide layout; no new JavaScript dependency or visual system.
2. Adds contextual links from the three existing how-to guides. The central page registry includes the new route in sitemap, metadata, shared navigation/footer and llms summaries, with a real October 23 publication/edit date.
3. Exposes both existing research JSON downloads in `/llms.txt` and `/llms-full.txt`, even before film articles are published. Each download is gated by its public source page; absent hub and unpublished article behavior stay protected by fixture tests. These optional files do not provide a special Google ranking benefit.
4. Embeds author and publisher details directly in Article/BlogPosting JSON-LD, preserving their stable entity identifiers. Adds the verified Chrome Web Store listing as the application's `sameAs`. The store returns HTTP200 and links back to rating.watch. New rendered-HTML checks reject incomplete article attribution, including regressions hidden by separate script blocks.
5. Repairs the three existing film drafts: distinguishes approval share from average rating, corrects KPop Metascore proximity, distinguishes accumulated Top 10 viewing hours from first 91-day popularity figures, removes unsupported causes and records RT source checks. All remain `review` with `published:null`; the registry still publishes zero film analyses.

These changes improve available content, internal discovery and data clarity. They do not prove more traffic, rankings, indexing, AI citations or rich-result appearance.

## Audit evidence and all requested skill coverage

The swarm worked in independent ownership groups, followed by a fresh whole-change reviewer. Live discovery covered 16 public pages before the new route; integrated local validation covers 17. Live crawls respected robots.txt and bounded timeouts/request rates.

- [Technical/sitemap/schema/images/page/hreflang audit](SWARM-TECHNICAL-2026-10-23.md): `seo-technical`, `seo-sitemap`, `seo-schema`, `seo-images`, `seo-page`, `seo-hreflang`, `geo-technical`, `geo-schema`.
- [Content, search intent and acquisition plan](SWARM-CONTENT-2026-10-23.md): `seo-content`, `seo-plan`, `seo-programmatic`, `seo-competitor-pages`, `geo-content`, `geo-citability`.
- [GEO crawler, brand and platform evidence](SWARM-GEO-2026-10-23.md) and [companion PDF](SWARM-GEO-2026-10-23.pdf): `geo-crawlers`, `geo-llmstxt`, `geo-brand-mentions`, `geo-platform-optimizer`, `geo-report`, `geo-report-pdf`, `geo-compare`, plus applicability review of `geo-prospect` and `geo-proposal`.
- Root orchestration applies `seo`, `seo-audit`, `geo`, `geo-audit`, Superpowers planning, parallel specialists, test-first fixes, independent review and verification before completion. The existing frontend design is reused and browser-tested.

Hreflang is inapplicable to a single-language site with no alternate locales. Bulk programmatic routes are deferred until content quality and identities pass the existing gates. CRM/proposal workflows are inapplicable to growing this owned consumer product; no prospect records or sales proposals were created. No community posts, outreach or directory submissions were sent.

Current operator documentation overrides outdated examples in skills: training bots and search bots have different purposes, existing FAQ/HowTo markup does not promise Google rich results, and llms files do not guarantee AI discovery. Reports link their primary sources. No new HowTo or FAQ schema was added to the guide. No invented testimonials, review scores, credentials, schema imagery, search volumes or authority signals were introduced.

No numerical traffic or platform-visibility uplift is asserted. Earlier audit scores used different scopes/weights, and Search Console, Bing indexing reports, backlink data and field CWV were unavailable. The specific measurable changes are 16 → 17 registered public pages and 0 → 2 dataset download links in each llms output, verified against build artifacts.

## Acquisition and measurement plan

**First week:** verify the deployed new URL, canonical, sitemap and summaries; inspect indexing using the owner's existing verified Search Console and Bing properties. Save a 28-day baseline of organic clicks, impressions, actual queries, landing pages and consented visits. Use the existing post-deploy IndexNow command only after the new routes are live; acceptance is a notification, not indexing proof.

**Second week:** group actual queries by the existing page intents: installing IMDb scores, adding RT scores, interpreting Netflix labels, comparing critic/audience scores and using the datasets. Refine titles and contextual anchors where real impressions expose an unanswered question. Avoid creating near-duplicate guides or treating unverified keyword volume as demand.

**Weeks three and four:** compare matching 28-day windows for nonbranded organic landing visits and consented store referrals where available. Check that any store-click conversion event actually exists before reporting it. Record deployment dates, source/medium and sample size. Publish a factual demonstration and selected pilot analyses only after their release gates; owner-controlled publication/outreach remains a distinct action.

**After 28 days:** prioritize the page/question with measurable impressions or useful referrals. Expand original, dated research and explain how it was selected, rather than creating 100 thin film pages. Sample AI-search citations using recorded prompts, dates and cited URLs; do not extrapolate a few answers into universal visibility.

## Remaining constraints

- Live `https://www.rating.watch/` fails TLS validation; the HTTP origin uses a temporary 307 redirect. Configure a valid www certificate/router and permanent canonical redirects at the reverse proxy. Hosting configuration is absent from this repository, so this release cannot repair a TLS handshake.
- The existing film pilot specification requires independent fact-checking and owner scoring (mean at least 4/5, no score below 3/5), with the requested archetype coverage. The repaired drafts are concrete review material, not approved publications. They remain absent from sitemap, generated registry, film-analysis summaries and public article routes.
- Search Console/Bing/account measurements, real bot logs and field CWV remain unavailable. The live rollout was verified after push, as recorded below. Browser screenshots and bundle sizes are diagnostics, not traffic or INP/LCP/CLS measurements.

## Verification and release

Final command results and commit/push evidence are recorded in the latest section of `tasks/todo.md`. [Browser evidence](../../screenshots/seo-geo-swarm-2026-10-23/README.md) covers desktop and 320 px layouts, table scrolling, official store links and consent behavior. The fresh reviewer found no blocking or important issue after corrections.

Implementation commit `8a891aa` was pushed to `origin/main`, its remote SHA was verified, and [GitHub CI passed](https://github.com/gazivoda/netflix-imdb/actions/runs/39973193285). After deployment, all 17 live public pages returned HTTP200 and passed the rendered SEO validator with zero findings. The new guide, its canonical and contextual inbound links, the 17-URL sitemap and both updated llms dataset sections were verified live. IndexNow accepted 17 live URLs with HTTP202; acceptance does not prove indexing. [Machine-readable release evidence](SWARM-LIVE-VERIFICATION-2026-10-23.json) records the checks and timestamp. No traffic uplift or search-index state was measured.
