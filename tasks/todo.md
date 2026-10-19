# SEO + GEO improvement loop (20 iterations)

Started 2026-10-15 via `/loop`. State: **iteration counter lives in this file** (see Progress). No git commits are made by the loop
(user rule: never commit without explicit approval) — all work stays in the working tree for review.
Each iteration = ONE focused change, verified with `npx tsc --noEmit` + `npx jest` (+ `next build` where routes change).

Source of truth for scope: docs/seo/IMPLEMENTATION-ROADMAP.md, SITE-STRUCTURE.md, GEO-PLATFORM-OPTIMIZATION.md.

## Queue
- [x] 1  Foundation: `lib/pages.ts` registry, `lib/seo.ts` metadata+JSON-LD builders, `components/JsonLd`, registry-driven sitemap w/ real lastmod, per-page canonical (fixed: privacy/camera-vision inherited canonical '/'), title/desc length tests (also covers old item 15 harness). NOTE: shared nav/footer chrome deferred to iteration 3 when the first guide page exists.
- [x] 2  OG/Twitter image (lib/og.tsx + app/opengraph-image.tsx + twitter-image.tsx; explicit images in pageMetadata because a page-level openGraph object drops the file-convention image). Gotcha: next/og can't fetch fonts offline — avoid non-ASCII glyphs like ★.
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
iteration: 20 / 20 for wave 1 (all 20 agents merged 2026-10-15; verified tsc, jest 234, build, seo:validate 11 pages OK, seo:links OK). Earlier: 3 / 20 (foundation: GuideLayout/SiteHeader/SiteFooter/guide.module.css, /install page, compare migrated, FAQPage schema moved off root layout to home only)
MODE CHANGE (user: 'launch 20 agents to work on all this'): iterations 4-20 are replaced by 20 parallel worktree agents (see AGENT-BRIEF.md); main thread merges branches, resolves conflicts, runs full verification, commits + pushes.
USER UPDATE (iteration 2): user now AUTHORIZES commit + push to main after every iteration (explicit). Also asked to use /seo /geo skills. Google guidance (seo-geo skill): llms.txt is not a Google lever; add Claude-SearchBot to robots.

## Learnings
- Baseline `next build` ≈ 5s. Shared JS 87 kB; /camera-vision isolated (107 kB) — tfjs/tesseract do NOT leak into shared bundle (item 11 mostly moot).
- Live https://netflix-ratings.app unreachable from here (curl 000) — can't confirm live == repo; nothing shipped moves ratings until deployed.
- macOS sed -i needs '' — use python for edits. Never `cat > file` without heredoc.
- Extension truth: real RT + IMDb via OMDb (extension/background.js); manifest v1.0.0, name "Netflix Ratings"; OMDb API key is hardcoded in the public extension (flag).

## Flags for user (add to final report)
- Privacy page: "Last updated May 4, 2025" predates the project (published 2026-05-01) and policy only mentions IMDb, not Rotten Tomatoes.
- OMDb API key committed in extension/background.js.
- Home "18 minutes" stat is unsourced; STATS/MARQUEE illustrative.

## Wave 2 (queued, user request 2026-10-15): paper & ink redesign by 20 agents
Spec: docs/DESIGN.md (owner-supplied; repo did NOT already contain it — homepage was still dark theme).
Sequenced AFTER wave 1 merges (both waves edit page.module.css / guide.module.css / layout.tsx; running together = conflicts).
Plan: (0) main thread merges wave 1, then lands design foundation (tokens in globals/guide css, next/font Archivo wdth axis + Instrument Serif + JetBrains Mono) and splits the homepage into per-section components with their own CSS modules so 20 agents can own disjoint files; (1) launch 20 slice agents; (2) merge, verify (tsc/jest/build/seo:validate), screenshot QA, commit+push.
Conflicts to resolve with the user: spec says 'no emoji' (🍅 used in badges/marquee), TESTIMONIALS are fabricated (still flagged).

## Wave 1 result (merged)
11 pages (install, 3 how-tos, research data study, compare x2, about, camera-vision, privacy, home), robots/llms generated, security headers, JSON-LD graph w/ resolving @ids, 404/manifest/icons, CI + seo:validate + seo:links, README, CWS listing, launch kit, perf (tailwind scoped to camera-vision), baseline audit 63/100 (docs/seo/AUDIT-BASELINE-2026-10-15.md).
Merge-time fixes: registry rebuilt after union-merge mangled it; llms 'about' group; OG image ?v= cache-bust; root URL has no trailing slash everywhere; home install CTAs -> /install; '<1s' stat replaced with verifiable '2 sites'; jest ignores .claude/; stale .next cache caused a spurious WasmHash build error (rm -rf .next).
OPEN for user: testimonials fabricated (critical per audit); add MIT LICENSE?; OMDb key hardcoded + 1000/day shared limit (launch blocker); privacy page date/RT; CWS store name; icon.png 307B placeholder; OMDb RT data can be wrong (Pinocchio 27% vs 96%); /camera-vision Tailwind v3/v4 mix broken pre-existing.
Wave 2 (design) still queued.

## Wave 2 result (design, merged 2026-10-16)
20 agents + 2 foundation agents; merged d5e318c: paper & ink redesign sitewide, OG/icons with embedded OFL fonts (lib/fonts), design guard tests (73 -> 0 violations), emoji-free content. Verified: tsc, jest 395, build, seo:validate (11 pages), seo:links, desktop visual pass (home, install, compare, research, alternatives).
NOT verified: real 390px viewport (Chrome window cannot resize here; agents used 360-390px iframes: no horizontal overflow), live camera on /camera-vision, FAQ at mobile width.
OPEN for owner: testimonials invented (lib/content.ts), LICENSE, OMDb key hardcoded (1000/day shared), privacy text/date, CWS store name + icon.png placeholder, extension badge still uses emoji (extension/content.js), 'N' app icon vs Netflix N lookalike check, tailwind.config.js/postcss plugin removable.

---

# Ratings cache: JSON document store with 7-day freshness (started 2026-10-19)

Goal: never call OMDb for a title we already hold a fresh (<7 days) rating for. Primitive document store is fine (user: "doesn't need to be very fast for the beginning").

## Findings that shape the design
- The only server-side OMDb caller is `searchTitle()` in `lib/omdb.ts`, reached through `POST /api/ratings` (used by `/camera-vision`). It has NO cache today.
- The Chrome extension (`extension/background.js`) calls OMDb directly from each user's browser with its own per-browser IndexedDB cache (7d found / 1d missing). A server DB does NOT reduce its calls unless the extension is routed through the server (decision pending, see "Phase 2").
- `fetchDetail()` returns `null` for both "not found" and "network/rate-limit error". A cache must tell these apart or it will cache outages as "not found".
- Deploy target (Qualify env on the Hetzner server) is not described anywhere in the repo. A file store only survives deploys if its path is on a persistent volume, so the path is configurable via `RATINGS_DB_PATH`.

## Phase 1: server-side store (in scope)
- [x] T1 `lib/ratings-store.ts`: JSON-file document store. Doc = `{ key, query, result: OmdbTitle | null, updatedAt }`. Key = lowercased, trimmed, whitespace-collapsed title. In-memory Map loaded lazily, atomic write (tmp file + rename), debounced flush, path from `RATINGS_DB_PATH` (default `.data/ratings.json`, gitignored). Corrupt/missing file starts empty, never throws.
- [x] T2 Freshness policy in one place: found = 7 days, not-found = 1 day (matches extension). `getFresh(key, now)` returns doc or undefined.
- [x] T3 `lib/omdb.ts`: distinguish `not_found` from `error` (network, non-OK, `Response:"False"` with an `Error` such as "Request limit reached!"). Only `found`/`not_found` are cacheable. Keep the current `searchTitle` signature working for existing callers/tests.
- [x] T4 `lib/cached-omdb.ts` (or inside route): `getRating(title)` = store hit if fresh, else OMDb then store write. De-dupe concurrent identical lookups (in-flight Map). On OMDb error serve a stale doc if present rather than failing.
- [x] T5 Wire `POST /api/ratings` to `getRating`; response shape unchanged. Optional `cached`/`updatedAt` fields only if no test or consumer breaks.
- [x] T6 Tests (jest, temp dir per test): hit skips fetch; entry older than 7d refetches; not-found 1d; error is not cached; stale served on error; concurrent identical titles = 1 fetch; corrupt file recovery; key normalization; persistence across store re-instantiation.
- [x] T7 Ops docs: `.gitignore` the data dir, document `RATINGS_DB_PATH` + persistent-volume requirement for Qualify/Hetzner in README (no secrets), single-process caveat (file store is not safe for multiple Node workers).
- [x] T8 Verify: `npx tsc --noEmit`, `npx jest`, `npx next build`; manual: call `/api/ratings` twice, second call makes zero OMDb requests (log/counter).

## Phase 2: extension through the server (needs user decision, NOT started)
- [ ] T9 Add a public `GET/POST` ratings endpoint with CORS for the extension, rate limit, and have `background.js` try it before OMDb. Implications: new host permission, privacy page + README ("no backend server") + CWS privacy disclosure must change, server holds the one OMDb key.

## Review (2026-10-19)
Phase 1 done and verified: `tsc` clean, `jest` 24 suites / 428 passed, `next build` OK. Not yet exercised against the real OMDb API or on Qualify (needs the OMDb key and a persistent `RATINGS_DB_PATH`). Scoreless titles use the 1-day TTL like the extension. Uncommitted, awaiting user approval. T9 (extension through server) deferred by user decision.
