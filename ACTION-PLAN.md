# SEO action plan — October 23, 2026

Evidence and scoring: [FULL-AUDIT-REPORT.md](FULL-AUDIT-REPORT.md). Machine-readable crawl: [audit evidence](docs/seo/AUDIT-EVIDENCE-2026-10-23.json).

## Critical

No critical canonical-host indexing blocker was confirmed.

## High — hosting configuration remains open

- [ ] **T1: Repair www TLS/router.** Configure a valid certificate for `www.rating.watch` and a permanent redirect router to `https://rating.watch`. Current verified HTTPS requests fail certificate validation; diagnostic inspection finds Traefik's self-signed default certificate and HTTP 503. HTTP www returns 404. This is outside repository code; no hosting configuration/administrative connector is available in this task.
  - Verify `curl -I https://www.rating.watch/` succeeds **without** `-k`, returns 301/308 and points at the canonical HTTPS host. Verify HTTP www reaches that host within two redirects.

## Medium

- [ ] **T4: Make the HTTP-to-HTTPS redirect permanent.** At the reverse proxy, change the current `http://rating.watch/` 302 to 301/308. Verify both root and an internal path, preserving path/query.
- [x] **T2: Make account noindex readable.** Permit `/account` in all robots groups; keep `/api/` exclusions. Account metadata and authentication remain in place; the account URL stays outside the sitemap.
- [x] **T3: Repair SEO link validation.** Use ts-node for the registry and helpers, fetch missing dynamic-page HTML from `SEO_BASE_URL`, and fail on missing or non-200 pages. Add CLI regression coverage and run link checks in CI against the production server.
- [x] **C1: Correct Netflix UI descriptions.** Replace stale percentage-match claims with documented thumbs-based recommendation signals and a source link.
- [x] **C2: Complete Certified Fresh explanation.** Include release-type-dependent minimum review counts and recheck the primary source.
- [x] **C3: Correct missing-badge troubleshooting.** Distinguish missing source scores from quota/connectivity/install failures.
- [x] **C4: Correct privacy copy.** Include the OMDb key and request IP visibility rather than claiming only titles are transmitted.

## Low

- [x] **C5/C6: Qualify unsupported claims.** Replace “no lag” with implementation facts and qualify per-card score availability in the research CTA and shared promo caption/VideoObject.
- [x] **S1: Align installation timing.** Existing HowTo totalTime matches the visible one-minute estimate.
- [x] Update only actually edited page dates, including the shared visible date.
- [x] Correct deployment documentation for generated llms routes, account noindex, host checks, and retired FAQ/HowTo Google appearances.
- [x] Capture desktop/mobile evidence; retain working layouts and correctly deferred media.
- [ ] **Collect representative performance data.** Retry PageSpeed Insights after quota recovery, or use an authenticated quota; inspect field 75th-percentile LCP/INP/CLS when enough traffic exists. Do not replace missing field metrics with warm-cache diagnostics.
- [ ] After deployment, review the supported structured data in Google's Rich Results Test and the full vocabulary in Schema.org's validator. No reviews or aggregate ratings should be fabricated for eligibility.
- [ ] With authorized owner access, inspect indexing in Search Console/Bing and submit the canonical sitemap if needed. No indexing timeline is promised.

## Release verification

1. Run tests and `npx tsc --noEmit`, then `npm run build`.
2. Start that production build. Run `SEO_BASE_URL=http://127.0.0.1:3214 npm run seo:validate` and `SEO_BASE_URL=http://127.0.0.1:3214 npm run seo:links`. Both must include all 15 public pages, including AR.
3. Preserve pre-existing changes. Stage only the audit file list; inspect the staged diff before commit/push. Do not regenerate or stage the untracked blog corpus.
4. After deployment, repeat the hosting checks and confirm `/robots.txt` no longer excludes `/account`, while `/account` still emits noindex and remains absent from the sitemap. Recheck changed page copy and meaningful lastmod values.

Repository fixes are implemented locally. Hosting fixes and live deployment verification remain open; this document does not claim they shipped.
