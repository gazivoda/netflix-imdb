# Technical SEO live check (rating.watch)

Run on 2026-11-09 from a local machine. The dedicated technical agent died on a rate limit, so the implementer re-ran the checks. Requests were spaced at 1 per second or slower, with a normal Chrome user agent. The live site is still the 2026-10-23 build: every sitemap `lastmod` is 2026-10-23, and the live `/blog` is 115,268 bytes, the same size as the local `.next/server/app/blog.html`.

## Summary

No Critical or High findings. The one customer-visible defect is that `www.rating.watch` fails TLS. Everything on the crawl path is healthy.

## Evidence table

| URL | Result |
|---|---|
| `https://rating.watch/` | 200, `text/html`, HSTS, `nosniff`, Referrer-Policy and Permissions-Policy present, CSP `frame-ancestors` (stepto.net, localhost), `s-maxage=31536000`, `x-nextjs-cache: HIT`, h2 plus `alt-svc: h3`. 135,155 bytes raw, 23,239 bytes transferred (compressed). TTFB 0.11 s from here |
| `http://rating.watch/` and `/blog` | **307 Temporary Redirect** to the https URL (no HSTS on the http hop) |
| `https://www.rating.watch/` | **TLS fails**: the certificate (Let's Encrypt, CN `rating.watch`, valid to 2027-01-18) has only `DNS:rating.watch`, so www is not in its SAN list. `curl` gives "unable to get local issuer certificate" |
| `http://www.rating.watch/` | 404 `text/plain` "404 page not found" (the reverse proxy's default, not the app) |
| `/robots.txt` | 200 `text/plain`. `*` allows all except `/api/`. Googlebot, Bingbot, Applebot and the AI search and user agents are allowed. Training crawlers (GPTBot, ClaudeBot, CCBot, Google-Extended and others) are allowed. The non-standard `Host:` line is harmless. `Sitemap:` is present |
| `/sitemap.xml` | 200 `application/xml`, 17 URLs, all `https://rating.watch/...` |
| `/opengraph-image`, `/twitter-image` | 200 `image/png`, 1200x630, immutable cache |
| `/icon`, `/apple-icon` | 200 `image/png`, 512x512 and 180x180 |
| `/icon.svg`, `/favicon.svg`, `/favicon.ico` | 200 |
| `/manifest.webmanifest` | 200 `application/manifest+json`. Its `name` is "Rating Watch", and the extension store name is longer (see Low 3) |
| IndexNow key file | `scripts/ping-indexnow.mjs` uses key `682b64e6a0f625f3b476439b6c6f1d81` and `keyLocation` `https://rating.watch/<key>.txt`. The live file returns 200 and its body equals the key, matching `public/682b64e6a0f625f3b476439b6c6f1d81.txt` |
| `/llms.txt` | 200, `text/plain` |
| `/nonexistent-xyz`, `/blog/red-notice-2021` (unpublished), `/index.html` | 404 with `no-store`, as intended |

JSON-LD on all 17 sitemap URLs, fetched live: **every `<script type="application/ld+json">` block parses (0 parse failures)**. Each URL has 1 to 2 blocks. Every page has a self-referencing canonical, `robots: index, follow` and exactly one `<h1>`. The per-page schema types are those expected from `lib/seo.ts`. `scripts/validate-seo.mjs` has `SEO_BASE_URL` only for the pages rendered per request. It audits prerendered output from the build, so it cannot validate a remote site. A custom fetch-and-parse over the sitemap was used instead.

PageSpeed Insights (mobile, home): **not measured**. All 3 attempts returned HTTP 429, "Quota exceeded for metric 'Queries' and limit 'Queries per day'" for the shared unauthenticated project. A key or a later retry is needed. Only these transfer-level numbers exist: TTFB 0.11 s, 135 KB HTML.

## Findings

### Critical
None.

### High
None.

### Medium

**M1. `www.rating.watch` does not work (hosting).** DNS resolves to the same IP (91.99.19.151), but the certificate has no www name, and plain http returns the proxy's 404. Anyone who types or links `www.` sees a certificate warning, and search engines cannot consolidate it to the apex. Fix on the host or reverse proxy: add `www.rating.watch` to the certificate and serve a permanent 301 or 308 redirect to `https://rating.watch$request_uri`. This is a Coolify/Traefik change, not code.

**M2. `<title>` of `/camera-vision/ar` has no " · Rating Watch" suffix (code, fixed, needs a deploy to confirm).** The live `<title>` is "AR Ratings: Netflix Scores Over the TV Screen", while `og:title` has the suffix. Cause: Next resets the root layout's `title.template` after any segment whose title string has no template of its own. The parent `camera-vision/layout.tsx` sets a plain string title, so the nested `ar/layout.tsx` title rendered without the suffix. Another agent made the same fix locally in `app/camera-vision/ar/layout.tsx` (an absolute title); the `lib/seo.ts` change below covers every route in general. Fix: `pageMetadata()` in `lib/seo.ts` now always emits `title: { absolute: renderedTitle(page) }`, the same string the template produced for every other page, so it no longer depends on layout nesting. A test asserts this for every registered page. I did not run a production build, so the live result is not confirmed.

### Low

**L1. http to https redirect is 307, not 301/308 (hosting).** Search engines treat it as temporary, though Google generally follows it. Change the proxy's redirect to permanent. The http response also has no HSTS, which is normal.

**L2. Sitemap `lastmod` is the same date on all 17 URLs (code, deploy).** The live sitemap says 2026-10-23, because production is still the old build. After the next deploy the dates come from `lib/pages.ts`, which another agent is bumping.

**L3. Manifest `name` is "Rating Watch" (code, optional).** The extension manifest's name is "Rating Watch: IMDb & Rotten Tomatoes for Netflix". The web manifest in `app/manifest.ts` is outside this task's file list and was left alone. It is a brand string, so the short form is acceptable.

**L4. No `/license.xml` or other optional files (policy).** Reported in the GEO audit L3. No action needed.

**L5. No X-Frame-Options (informational).** CSP `frame-ancestors` is set, which supersedes it in current browsers.

**L6. PageSpeed Insights not measured (quota).** Re-run with an API key, or from the PSI web UI.

## Fixed in code

- `lib/seo.ts`: `title` is always absolute (M2).
- `tests/lib/seo.test.ts`: asserts the absolute title for every registered page.

## Reported only

M1, L1 (hosting); L2 (waits for deploy); L3 to L6 (optional or measurement).
