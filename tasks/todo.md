# SEO + GEO improvement loop (20 iterations)

Started 2026-10-15 via `/loop`. State: **iteration counter lives in this file** (see Progress). No git commits are made by the loop
(user rule: never commit without explicit approval) — all work stays in the working tree for review.
Each iteration = ONE focused change, verified with `npx tsc --noEmit` + `npx jest` (+ `next build` where routes change).

Source of truth for scope: docs/seo/IMPLEMENTATION-ROADMAP.md, SITE-STRUCTURE.md, GEO-PLATFORM-OPTIMIZATION.md.

## Queue
- [x] 1  Foundation: `lib/pages.ts` registry, `lib/seo.ts` metadata+JSON-LD builders, `components/JsonLd`, registry-driven sitemap w/ real lastmod, per-page canonical (fixed: privacy/camera-vision inherited canonical '/'), title/desc length tests (also covers old item 15 harness). NOTE: shared nav/footer chrome deferred to iteration 3 when the first guide page exists.
- [ ] 2  Root OG/Twitter image (app/opengraph-image.tsx via next/og) — no page has an image today
- [ ] 2b /install page (HowTo schema) + shared nav/footer w/ registry-driven Guides links
- [ ] 3  /how-to/show-imdb-ratings-on-netflix
- [ ] 4  /how-to/show-rotten-tomatoes-on-netflix
- [ ] 5  /compare/alternatives (ItemList + FAQ; only verifiable claims)
- [ ] 6  /how-to/find-what-to-watch-on-netflix
- [ ] 7  Compare page: BreadcrumbList + Article schema + cross-links
- [ ] 8  Per-page OG/Twitter images (opengraph-image) + canonical/metadata audit
- [ ] 9  llms.txt / llms-full.txt generated from registry
- [ ] 10 sitemap real lastModified, robots review, IndexNow script reads registry
- [ ] 11 Performance / Core Web Vitals pass (bundle, fonts, images, camera-vision isolation)
- [ ] 12 Accessibility + semantic HTML pass (landmarks, headings, contrast, skip link)
- [ ] 13 next.config: security headers, compress, poweredByHeader off, cache headers
- [ ] 14 GEO citability pass: answer-first passages, definitions, sourced stats
- [~] 15 (folded into 1; each new page adds a test case)
- [ ] 16 Decide on gated /netflix/[title] programmatic pages (likely skip: needs OMDb at build)
- [ ] 17 404/not-found, web manifest, PNG icons, favicon set
- [ ] 18 Internal-link audit script (no orphans, <=2 clicks)
- [ ] 19 Re-audit with geo/seo skills, score vs baseline
- [ ] 20 Wrap-up report + handoff (off-site items: CWS, PH, AlternativeTo, GSC/Bing)

## Flags for the user (not auto-fixed)
- `lib/content.ts` TESTIMONIALS are fabricated names/quotes; marquee scores "illustrative". Trust/FTC/E-E-A-T risk; schema must never mark them up as Review.

## Progress
iteration: 1 / 20

## Learnings
- Baseline `next build` ≈ 5s. Shared JS 87 kB; /camera-vision isolated (107 kB) — tfjs/tesseract do NOT leak into shared bundle (item 11 mostly moot).
- Live https://netflix-ratings.app unreachable from here (curl 000) — can't confirm live == repo; nothing shipped moves ratings until deployed.
- macOS sed -i needs '' — use python for edits. Never `cat > file` without heredoc.
- Extension truth: real RT + IMDb via OMDb (extension/background.js); manifest v1.0.0, name "Netflix Ratings"; OMDb API key is hardcoded in the public extension (flag).

## Flags for user (add to final report)
- Privacy page: "Last updated May 4, 2025" predates the project (published 2026-05-01) and policy only mentions IMDb, not Rotten Tomatoes.
- OMDb API key committed in extension/background.js.
- Home "18 minutes" stat is unsourced; STATS/MARQUEE illustrative.
