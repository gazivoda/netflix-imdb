# SEO + GEO Baseline Audit: netflix-ratings.app

**Date:** 2026-10-15
**Scope:** THIS COMMIT ONLY: `614e3fe feat(seo): shared GuideLayout/header/footer, /install page with HowTo schema, FAQ schema scoped to home` (branch `worktree-agent-a2a8bc44673689881`). Other agents are concurrently adding pages, robots, llms and more in their own branches; none of that is reflected here. Use this file as the "before" for scoring later work.
**Method:** `next build` (clean, 13 static routes), `next start -p 3220`, then `curl` of every registered page, robots.txt, sitemap.xml, llms.txt, OG image, 404 and redirect probes; JSON-LD parsed with a script; source read for file:line evidence. `npx jest`: 57/57 pass. Frameworks: geo-technical, geo-schema, geo-citability rubrics (geo-audit / seo-audit structure). No source files were modified.
**Limits:** Production-only signals (HTTPS/HSTS, CDN, real Core Web Vitals, indexation, rankings, backlinks, brand mentions) cannot be verified from a local build. They are marked *unverifiable* and scored provisionally or excluded, as stated per section.

---

## 1. Scorecard

| Category | Score /100 | In composite? | Weight |
|---|---|---|---|
| Technical (crawlability, indexability, security, URLs, mobile, CWV, SSR, speed) | **78** | yes | 20% |
| On-page (titles, descriptions, headings, internal links, social tags) | **72** | yes | 15% |
| Schema / structured data | **55** | yes | 15% |
| Content quality / E-E-A-T | **44** | yes | 15% |
| Citability (passage level) | **54** | yes | 15% |
| AI-crawler access (robots, per bot) | **85** | yes | 10% |
| Platform readiness (avg of 5 platforms) | **53** | yes | 10% |
| Brand / entity, off-site | **unverifiable** (code-visible part ~15) | no | n/a |

**Composite (code-verifiable) = 0.20x78 + 0.15x72 + 0.15x55 + 0.15x44 + 0.15x54 + 0.10x85 + 0.10x53 = 15.6 + 10.8 + 8.25 + 6.6 + 8.1 + 8.5 + 5.3 = 63.2, reported as 63/100.**

Weighting rationale: technical foundations get the biggest single share because they gate everything; the other five content/GEO categories are near-equal. Brand/entity is normally the heaviest GEO factor (about 20-25% in the geo-audit model) but is excluded here because it cannot be measured from code. When it is measured later, re-baseline with it at 20% and the others scaled by 0.8 so scores stay comparable. The only code-visible entity facts are one `sameAs` link (the GitHub repo) and no logo, which is why the in-code portion is about 15/100.

**Cross-check with the `geo-audit` skill's own formula** (Citability 25 / Brand 20 / E-E-A-T 20 / Technical GEO 15 / Schema 10 / Platform 10; "Technical GEO" taken as the mean of my Technical 78 and AI-crawler 85, about 80; On-page has no slot in that model and is dropped): with Brand excluded and the remaining 80% of weight rescaled, 0.25x54 + 0.20x44 + 0.15x80 + 0.10x55 + 0.10x53 = 45.1, divided by 0.80 = **56/100**. If the code-visible Brand portion (about 15) were counted at 20% it would be 48/100. I use the 63 composite above as the headline because it keeps On-page and splits crawler access out; track whichever you pick consistently (the 56 figure is the more GEO-pessimistic one, because it weights citability and E-E-A-T more heavily).

Overall read: the technical and crawl foundation is genuinely good (fully server-rendered static HTML, canonicals, clean sitemap, all AI bots allowed). The score is dragged down by trust problems on the homepage (fabricated testimonials and unsourced stats), thin entity/schema signals, almost no sourced or statistical content, and two orphan/stale pages.

---

## 2. Technical: 78/100 (geo-technical rubric)

| Sub-category | Score | Evidence |
|---|---|---|
| Crawlability | 13/15 | `curl /robots.txt` 200 text/plain, valid groups, `Sitemap:` present. All AI bots allowed (see section 6). `Host:` line is non-standard (Yandex-only legacy), `app/robots.ts:29`. `/camera-vision` has no inbound link from any page (homepage links: `#faq #how / /compare/... /install /privacy` + GitHub + OMDb), so crawl depth is unbounded and it is discoverable only via sitemap/llms.txt (-1). No erroneous noindex on indexable pages. |
| Indexability | 10/12 | Every page has a self-referencing `<link rel="canonical">` (verified on all 5). `/install/` returns 308 to `/install` (single hop, permanent). `/install?x=1` returns 200 with the clean canonical (parameter duplicates neutralised). `/INSTALL` is 404. **404 template defect:** `curl /nope` returns 404 but the HTML has `<meta name="robots" content="noindex"/>` AND `<meta name="robots" content="index, follow"/>`, plus two `<title>` tags (`404: This page could not be found.` and the homepage title). Google resolves to noindex, so low risk, but it is sloppy and a custom `not-found.tsx` fixes it (-2). |
| Security | 2/10 (provisional) | Local response headers contain only `X-Powered-By: Next.js` (`curl -D -`). No HSTS, `X-Content-Type-Options`, `X-Frame-Options`/CSP `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, CSP. `next.config.js` is empty (`const nextConfig = {}`). HTTPS and HSTS on the real host are unverifiable (a CDN host such as Vercel may add some); score assumes origin behaviour. |
| URL structure | 7/8 | Lowercase, hyphenated, flat (`/install`, `/compare/imdb-vs-rotten-tomatoes`). Trailing slash is consistently 308-redirected. -1: `/api/ratings` is crawlable (GET returns 405) and not disallowed. |
| Mobile | 7/10 (provisional, not browser-tested) | Viewport meta present on all pages (`width=device-width, initial-scale=1`). `components/guide.module.css` has **0** `@media` rules (the homepage CSS has 4), so guide-page responsiveness rests on fluid layout only and must be checked in a real browser. Table is wrapped in `tableWrap`. |
| Core Web Vitals | 12/15 (lab estimate, no CrUX) | Static prerender, TTFB about 4 ms locally. No raster images. First Load JS: `/` 89 kB, `/install` 88 kB, `/privacy` 87.5 kB, `/camera-vision` 107 kB (build output). Fonts self-hosted via `next/font` with `display: swap`. Risk: homepage reveal/marquee animations could affect CLS. Needs real field data. |
| Server-side rendering | 14/15 | Raw HTML (no JS) contains H1/H2s, all body copy, FAQ answers (`<details>`), nav and footer links, meta tags and JSON-LD on every page. `/camera-vision` is a client component (OCR demo) but its text shell is in the HTML (-1 for the interactive core being JS-only). |
| Speed / server | 13/15 | Home HTML 84,790 B raw / 15,047 B gzip (compression on). Scripts are `async`. Static HTML sends `Cache-Control: s-maxage=31536000, stale-while-revalidate` (good for a CDN, no browser `max-age`). `robots.txt` is served `max-age=0, must-revalidate`. CDN presence unverifiable (0/1). |
| **Total** | **78** | 13+10+2+7+7+12+14+13 = 78 |

Status codes verified: `/`, `/install`, `/compare/...`, `/camera-vision`, `/privacy`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/opengraph-image`, `/twitter-image`, `/favicon.svg`, `/icon.svg`, IndexNow key file all 200. `/apple-icon.png`, `/manifest.webmanifest`, `/.well-known/security.txt`, `/llms-full.txt`, `/about` are 404 (none are required; `/about` is relevant to E-E-A-T).

**Sitemap** (`curl /sitemap.xml`): valid XML, 5 URLs, `lastmod` taken from the registry (home 2026-06-17, `/install` 2026-10-15, others 2026-06-17), `priority` and `changefreq` set (Google ignores both). Matches `lib/pages.ts` exactly; no bloat.

**Agent-readiness (non-scoring):** `Accept: text/markdown` returns `text/html` (no content negotiation; forward-looking only). No `Link:` headers on pages (not an API-first site; omit). IndexNow key file is served; `scripts/ping-indexnow.mjs:15` hard-codes `PATHS` that omit `/install`.

---

## 3. On-page: 72/100

| Element | Finding | Score |
|---|---|---|
| Titles | All unique, all <=65 chars rendered (64 / 64 / 59 / 32 / 56). Suffix `· Netflix Ratings` consistent; home uses `absolute`. `Privacy Policy · Netflix Ratings` is generic. | 90 |
| Meta descriptions | All 5 unique and in the 70-160 window (checked via tests and curl); answer-first and accurate. | 90 |
| Headings | `/install` and `/compare` use question/answer H2s ("How do I install Netflix Ratings?"). **Home H1 is a slogan** ("Know if it's worth watching before you press play.") with no "Netflix", "IMDb" or product noun; most home H2s are marketing lines ("Stop opening that second tab."). **/camera-vision has H1 then H3 only (no H2)** and 228 words. | 72 |
| Internal links | Footer links are registry-driven (good, no orphans among grouped pages). Gaps: `/camera-vision` is an orphan (only links to `/`); `/privacy` has no header/footer at all, so it is a dead end (links out only to OMDb and a mailto); the homepage hero and final CTAs (`app/page.tsx:70`, `:325`) and the compare callout (`app/compare/imdb-vs-rotten-tomatoes/page.tsx:169`) send "Install free" to the GitHub repo instead of `/install`; there are no in-body contextual links from home or compare to `/install` (only header/nav). | 55 |
| Social tags | OG + Twitter present on every page with 1200x630 image + alt; `og:type` article on `/install` and `/compare`. One identical image for every page; no `article:published_time`. `<meta name="keywords">` (ignored by engines) is on every page. | 80 |
| Thin pages | `/camera-vision` (228 words, debug-style copy: "Check browser console (F12)"); `/privacy` 332 words is appropriate. | 55 |
| **Weighted** | 20% title, 15% desc, 20% headings, 20% links, 10% social, 15% thin-content | **72** |

---

## 4. Schema: 55/100 (geo-schema rubric)

Detected (all JSON-LD, server-rendered, all blocks parse as valid JSON, no `<`/undefined leaks):

| Page | Blocks | Notes |
|---|---|---|
| every page (root layout, `app/layout.tsx:79-135`) | `@graph`: Person `#author`, WebSite `#website`, Organization `#org`, SoftwareApplication `#app` | Emitted on all 5 pages incl. `/privacy`, `/camera-vision` |
| `/` | + separate FAQPage block | 6 Q&As, same source (`FAQS`) as visible FAQ; correctly scoped to home (test enforced) |
| `/install` | + BreadcrumbList, Article, HowTo (5 steps), FAQPage (6) | HowTo steps match visible steps verbatim |
| `/compare/...` | + BreadcrumbList, Article, FAQPage (5) | |
| `/privacy`, `/camera-vision` | none beyond layout | no breadcrumb/WebPage |

Rubric:

| Criterion | Pts | Basis |
|---|---|---|
| Org/Person present & complete | 10/15 | Present but no `logo`, no contact, no `knowsAbout`; description fine |
| sameAs (5+ platforms) | 3/15 | Exactly one `sameAs`, and it is the repo URL (`layout.tsx:87,106`), not a profile |
| Article + author details | 7/10 | Author is an `@id` ref to Person (name, url); no jobTitle/real profile sameAs; Article has no `image` |
| Business-type schema | 7/10 | SoftwareApplication has offers, featureList, version, dates; no `image`/`screenshot`/`installUrl`; no rating (correct, none exists) |
| WebSite + SearchAction | 0/5 | Absent; the site has no search, so this is N/A, but scored per rubric |
| BreadcrumbList on inner pages | 3/5 | Present on 2 of 4 inner pages |
| JSON-LD format | 5/5 | |
| Server-rendered | 10/10 | In raw HTML `<head>`/body, not JS-injected |
| speakable | 0/5 | none |
| Valid JSON + types | 8/10 | Valid. `operatingSystem: 'Chrome, Chromium, Edge, Brave'` (`layout.tsx:113`) lists browsers, not operating systems |
| knowsAbout | 0/5 | none |
| No deprecated schemas | 2/5 | HowTo (rich results removed Aug 2023) and FAQPage (restricted to gov/health) are present; fine for AI parsing but expect no SERP features |
| **Total** | **55** | |

Specific defects:
- **@id coverage:** Article, HowTo, FAQPage, BreadcrumbList carry no `@id`; there is no WebPage node, so nothing links a page to the WebSite via `isPartOf`/`about`. Article `author`/`publisher` are bare `@id` refs to nodes that live in a *different* `<script>` block (`lib/seo.ts:50-51,106-107`); parsers that do not merge blocks see an author with no name.
- **Date accuracy:** Article `datePublished` for `/compare/...` falls back to `PUBLISHED_DATE = '2026-05-01'` (`lib/content.ts:13`), but the page was first committed 2026-06-16 (`b835497`). Overstating publication dates is a freshness-trust risk.
- **HowTo `totalTime: 'PT2M'`** (`app/install/page.tsx:82`) vs. visible copy "about a minute".
- **Entity inflation:** Organization "Netflix Ratings" has the same name as the WebSite and SoftwareApplication, is a one-person project, and has no address/logo/contact: a self-asserted entity with nothing external to corroborate it.
- **No leaks found:** FAQPage is absent from the root layout and only on pages whose visible content matches; no FAQ copy drifts from the JSON-LD.

---

## 5. Content quality / E-E-A-T: 44/100

| Dimension | /25 | Evidence |
|---|---|---|
| Experience | 12 | Facts about the product are verified against `extension/` (manifest has `permissions: []`, two host permissions; OMDb; MV3). No screenshots or real captured examples (by design), no usage evidence. |
| Expertise | 12 | The IMDb-vs-RT explanation is accurate in outline but entirely uncited; two claims go beyond the evidence shown ("weighted to limit vote brigading", "harder to manipulate for older titles", compare page). |
| Authoritativeness | 6 | No outbound citations to primary sources (IMDb/RT methodology pages), no third-party mentions, no About/author page; the author link goes to the repo (`GuideLayout.tsx` byline). |
| Trust | 14 | + visible `Updated` dates, "not affiliated" disclaimer in every footer, privacy policy, honest "not on Chrome Web Store yet" on `/install`, open source. **-** see the trust defects below. |
| **Total** | **44** | |

Trust defects (all in code at this commit):
1. **Fabricated testimonials.** `lib/content.ts:57-86` defines four named personas with roles and scores ("Maya R., Designer", "Devin O., Film club organizer", "Priya S.", "Tomás L.") rendered at `app/page.tsx:249-270` under "Loved by binge-watchers". The project's own brief says no invented reviews/quotes; `public/llms.txt` also advertises "testimonials".
2. **Unsourced statistic:** "The average person spends close to 18 minutes deciding what to watch" (`app/page.tsx:158`), no source.
3. **Unverified product claims:** "<1s to score a full screen" (`lib/content.ts:53`), "Works on every plan" (`app/page.tsx:79`), "works on every Netflix plan and region" (FAQ, `lib/content.ts:127`), "free, forever" (`app/page.tsx:324`).
4. **Illustrative scores shown as real:** marquee/mockup/before-after use fixed IMDb/RT numbers (e.g. Stranger Things 8.7 / 86%); the only disclosure is a code comment ("Scores are illustrative", `lib/content.ts:88`), while the page caption reads "Stranger Things, as shown on your Netflix cards" (`app/page.tsx:298`). Compare page shows an unlabeled 8.7 / 86% pair.
5. **Privacy page is stale and inconsistent:** "Last updated: May 4, 2025" (`app/privacy/page.tsx:19`) is a year before the repo's first commit (2026-05-01); it describes fetching only the "IMDB rating" although the extension also reads Rotten Tomatoes from the same OMDb call (commit `44e1dfc`, 2026-05-11); it uses "IMDB" while the rest of the site uses "IMDb"; contact is a personal Gmail.

Freshness: dates are honest in the visible byline and sitemap; the home registry date (2026-06-17) predates today's header/FAQ-schema changes, which is acceptable.

---

## 6. Citability: 54/100 (geo-citability rubric)

| Category | Score | Weight | Weighted |
|---|---|---|---|
| Answer block quality | 62 | 30% | 18.6 |
| Self-containment | 65 | 25% | 16.3 |
| Structural readability | 68 | 20% | 13.6 |
| Statistical density | 20 | 15% | 3.0 |
| Uniqueness / original data | 30 | 10% | 3.0 |
| **Overall** | | | **54** |

Page-level (est.): `/install` 66, `/compare` 62, `/` 44, `/privacy` 40, `/camera-vision` 12. Citability coverage (blocks scoring >70) is roughly 25% of blocks; the strong blocks are almost all FAQ answers and the two ledes.

Key structural fact: **no passage on the site reaches the 134-167 word optimum.** The longest self-contained answer passages are 56-61 words (the 40-60 word band suits Google AIO/Gemini but undersells Perplexity/ChatGPT). Statistics are essentially absent; the only number-based claim ("18 minutes") is unsourced.

### Five strongest passages

| # | Where | Words | Why it works |
|---|---|---|---|
| 1 | `/compare` FAQ "What is the difference between IMDb and Rotten Tomatoes?" | 48 | Definition pattern for both terms, names both entities, scale (1-10 vs percentage) stated, closing contrast sentence. Fully extractable. |
| 2 | `/install` lede ("Netflix Ratings installs in about a minute: download it from GitHub, unzip it, turn on Developer mode...") | 58 | Answer-first, bold answer sentence, subject named, process in one breath. |
| 3 | `/install` FAQ "Is it safe to load an unpacked extension?" | 47 | Concrete verifiable facts (two sites named; no tabs/history/storage permission) that match `extension/manifest.json`. |
| 4 | `/compare` FAQ "Is a high Rotten Tomatoes score the same as a high IMDb score?" | 58 | Direct "No." opener, explains Tomatometer semantics, gives numeric illustration (90%, 95%, 7.0). |
| 5 | `/install` "What you will see after installing" | 61 | States exactly what appears (badge, top-right corner, IMDb out of 10, RT percentage) and edge case (only one score). |

### Five weakest passages (rewrite priority)

| # | Where | Words | Problem |
|---|---|---|---|
| 1 | Home "Why it matters" para 1 (`app/page.tsx:157-163`) | 61 | Narrative opener with an unsourced "18 minutes" claim; conversational ("So you open a second tab..."); no definition of the product. |
| 2 | Home testimonials (4 blockquotes, `app/page.tsx:256-268`) | 19-28 each | Fabricated, zero informational value, harms trust and any "quotes" an AI might extract would be false. Remove. |
| 3 | Home feature cards (`lib/content.ts:20-46`, e.g. "Always current") | 16-21 each | Vague ("Everything stays covered"), "pulled straight from the database" never names OMDb; no numbers. |
| 4 | `/camera-vision` body | 8-21 per fragment (228 total) | No answer block, no definition, step list as separate `<p>`, debug instructions ("Check browser console (F12)"). |
| 5 | Home "Why it matters" para 3 (`app/page.tsx:171-176`) | 43 | Depends on prior context ("both numbers", "It's the context Netflix should have shipped"), pronoun-led, no extractable fact. |

Quick wins that would move this category: add a 40-60 word "What is Netflix Ratings?" definition under the home H1; add sourced facts with dates (e.g. permission count, supported browsers, data source = OMDb); expand 2-3 key answers to about 130-160 words with a table; cite IMDb/RT primary pages.

---

## 7. AI-crawler access: 85/100 (`app/robots.ts`, live `curl /robots.txt`)

Rendered robots.txt = `User-Agent: * Allow: /` plus an explicit `Allow: /` group for 12 bots, `Host:` and `Sitemap:`. No `Disallow` anywhere. Origin returns 200 to GPTBot, ClaudeBot, PerplexityBot and Googlebot user agents (no UA blocking at origin; WAF/CDN behaviour unverifiable).

| Role | Bot | Status | Note |
|---|---|---|---|
| **Training** | GPTBot (OpenAI) | Allowed (explicit) | |
| | ClaudeBot (Anthropic) | Allowed (explicit) | |
| | anthropic-ai | Allowed (explicit) | Legacy token, superseded by ClaudeBot |
| | Google-Extended | Allowed (explicit) | Control token only; does NOT govern Search or AI Overviews (the comment at `app/robots.ts:4-6` implies it feeds AI Overviews, which is inaccurate; Googlebot controls those) |
| | Applebot-Extended | Allowed (explicit) | Control token for Apple model training |
| | CCBot | Allowed (explicit) | Common Crawl, feeds many models |
| | Bytespider | Allowed (explicit) | ByteDance; widely reported to ignore robots rules; a deliberate policy decision, not an SEO need |
| | Meta-ExternalAgent, Amazonbot, cohere-ai | Allowed via `*` only | Not named |
| **Search / index** | OAI-SearchBot (ChatGPT search) | Allowed (explicit) | |
| | PerplexityBot | Allowed (explicit) | |
| | Claude-SearchBot | Allowed via `*` | Not named; current Anthropic search token |
| | Googlebot (Search + AI Overviews/AI Mode) | Allowed via `*`; meta `googlebot: max-snippet:-1, max-image-preview:large` | Good snippet permissions |
| | Bingbot (Bing, Copilot, ChatGPT grounding) | Allowed via `*` | |
| **User-initiated** | ChatGPT-User | Allowed (explicit) | |
| | Perplexity-User | Allowed (explicit) | |
| | Claude-User | Allowed via `*` | Not named |
| | Claude-Web | Allowed (explicit) | Legacy token |

Deductions (-15): no stated training-vs-search policy (everything allowed, which is a valid choice but undocumented); deprecated tokens kept while current ones (`Claude-SearchBot`, `Claude-User`, `Meta-ExternalAgent`, `Amazonbot`, `DuckAssistBot`) are not named; non-standard `Host:` line; `/api/` not disallowed; the file is regenerated with no `Cache-Control` max-age. `llms.txt` exists and is served (200 text/plain), but is hand-maintained.

**`public/llms.txt` accuracy:** omits `/install`; describes the home page as having "testimonials" (fabricated, see section 5); otherwise matches the product facts. `docs/seo/SEO-STRATEGY.md` calls it "present and accurate"; that is no longer fully true.

---

## 8. Platform readiness (avg 53/100)

| Platform | Score | Basis |
|---|---|---|
| Google AI Overviews / AI Mode | 60 | Indexable, SSR, canonical, rich snippet permissions, 2 answer-first pages with FAQ/HowTo markup. Passages are 40-60 words (good fit). Missing: sourced facts, E-E-A-T proof, any evidence of ranking (unverifiable). |
| ChatGPT search (Bing index + OAI-SearchBot) | 55 | Bots allowed; IndexNow key file live and script exists, but its path list is stale (omits `/install`, `scripts/ping-indexnow.mjs:15`). No evidence of Bing Webmaster verification (no `msvalidate` meta). No third-party mentions for ChatGPT to corroborate. |
| Perplexity | 45 | PerplexityBot allowed, but Perplexity favours fact-dense, cited, recent content and community sources (Reddit/YouTube); the site has about zero statistics and zero outbound citations; off-site presence unverifiable. |
| Gemini | 50 | Depends on Google index + entity strength (YouTube, Knowledge Graph, Chrome Web Store listing). Chrome Web Store listing does not exist yet; sameAs is only GitHub. |
| Bing Copilot | 55 | Same Bing dependencies as ChatGPT plus IndexNow; no Bing Webmaster evidence. |

---

## 9. Brand / entity (off-site): unverifiable from code

Code-visible only: one `sameAs` (GitHub repo, used for both Person and Organization), no Wikipedia/Wikidata/LinkedIn/X/YouTube/Product Hunt/Reddit links, no Chrome Web Store listing (pending), no logo in schema, author is a pseudonymous-looking GitHub user with no profile page on the site. Everything else (backlinks, Reddit/YouTube/forum mentions, press, GitHub stars, Search Console impressions, indexation count, "netflix ratings" branded SERP) must be measured against the live domain with GSC, Bing Webmaster and a brand-mention scan. Not scored.

---

## 10. Top 15 findings (ranked)

| # | Severity | Finding (evidence) | Concrete fix |
|---|---|---|---|
| 1 | **Critical** | Fabricated testimonials with invented names, roles and scores shown on the homepage; llms.txt advertises them (`lib/content.ts:57-86`, `app/page.tsx:249-270`, `public/llms.txt`). Breaks the truth rule, destroys trust/E-E-A-T, regulatory risk (fake endorsements). | Delete `TESTIMONIALS` and the section; replace with verifiable proof only (real GitHub stars/issues/release data fetched and dated) or nothing. Remove "testimonials" from llms.txt. |
| 2 | **High** | Unsourced / unverified claims: "18 minutes" (`app/page.tsx:158`), "<1s to score a full screen" (`lib/content.ts:53`), "Works on every plan" and "every plan and region" (`app/page.tsx:79`, FAQ), "free, forever" (`:324`); illustrative scores presented as real ("as shown on your Netflix cards", `app/page.tsx:298`; disclosure exists only as a code comment). | Source or delete each claim; add a visible "Example scores for illustration" caption to the marquee, mockup and before/after blocks; reword "every plan/region" to what the code supports. |
| 3 | **High** | Privacy page stale and inconsistent: "Last updated: May 4, 2025" (`app/privacy/page.tsx:19`, predates the repo), says IMDB only though RT is also read, "IMDB" casing, no header/footer (dead end), inline styles, personal Gmail. | Rebuild on `GuideLayout`, correct the date, document both ratings coming from the same OMDb response, normalise "IMDb", link home/install; keep the registry `updated` date in sync. |
| 4 | **High** | `/camera-vision` is an orphan (no inbound link), thin (228 words, debug copy), has H1 then H3 only, loads 107 kB JS, yet is in the sitemap and llms.txt. | Decide: either `noindex` + remove from sitemap/llms.txt until it is a real page, or move it into `GuideLayout` with an answer-first definition, H2s, links from footer/home and an honest "experimental" label. |
| 5 | **High** | Entity/schema graph is thin and mis-pointed: Person `url` and both `sameAs` values are the repo URL, one external profile only, no Organization `logo`, no `knowsAbout`, Organization duplicates the product name (`app/layout.tsx:80-135`). | Point Person `sameAs` at real profiles (github.com/gazivoda plus LinkedIn/X if they exist), give the Person an on-site `/about` URL, add `logo` (PNG), `knowsAbout`, and consider dropping Organization in favour of Person as publisher until a real org exists. User must supply the profile URLs. |
| 6 | **High** | Content has almost no sourced or statistical substance and zero outbound citations (citability stat density 20, uniqueness 30; compare page claims IMDb is "weighted to limit vote brigading" with no source). | Add primary-source links (IMDb ratings help page, Rotten Tomatoes Tomatometer explanation; verify each via fetch before citing); add one original, dated data table (e.g. IMDb vs RT for named titles pulled from OMDb, with retrieval date); lengthen 2-3 key answers to about 130-160 words. |
| 7 | **Medium** | Primary CTAs bypass `/install`: hero, final CTA and compare callout all link to the GitHub repo (`app/page.tsx:70`, `:325`; compare `:169`). `/install` is reached only via nav/footer; no body-text link from home or compare. | Point primary CTAs to `/install` (keep GitHub as the secondary link); add contextual in-body links home -> `/install` and `/compare` -> `/install`. |
| 8 | **Medium** | Homepage H1/H2 are slogans, not answer-first: no definition of the product under the H1 (the only "What is Netflix Ratings?" answer sits in the FAQ), H2s are non-question marketing lines. | Add a 40-60 word definition paragraph directly under the H1; convert 3-4 H2s to question form ("How does Netflix Ratings work?", "Is it free and safe?"). |
| 9 | **Medium** | No security/response headers: only `X-Powered-By` (`curl -D -`; `next.config.js` empty). | In `next.config.js` set `poweredByHeader: false` and `headers()`: HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (allow `camera=(self)` for `/camera-vision`), a conservative CSP. |
| 10 | **Medium** | robots.txt hygiene (`app/robots.ts`): non-standard `Host:`; `/api/` crawlable (405 on GET); deprecated tokens retained, current ones (`Claude-SearchBot`, `Claude-User`, `Meta-ExternalAgent`, `Amazonbot`, `DuckAssistBot`) not named; comment wrongly ties Google-Extended to AI Overviews; no documented training-vs-search policy. | Drop `host`, add `Disallow: /api/`, group bots by training/search/user in the code with an accurate comment, name current tokens, and record the policy decision (especially Bytespider/CCBot) in a comment. |
| 11 | **Medium** | Hand-maintained derived files drift: `public/llms.txt` omits `/install` and mentions testimonials; `scripts/ping-indexnow.mjs:15` hard-codes paths and omits `/install` (comment says "keep in sync"). | Generate llms.txt from `PAGES` (route handler or build step) and import `PAGES` in the IndexNow script; add a test that fails when they diverge from the registry. |
| 12 | **Medium** | Schema defects: Article/HowTo/FAQ/Breadcrumb have no `@id` and there is no WebPage node; author/publisher are cross-block `@id` refs only (`lib/seo.ts:50-51,106-107`); `datePublished` for compare falls back to 2026-05-01 though the page first shipped 2026-06-16; `operatingSystem` lists browsers (`layout.tsx:113`); `totalTime PT2M` vs "about a minute"; Article has no `image`; no `speakable`. | Add `@id`s and a WebPage node with `isPartOf` WebSite; embed author name inline alongside the `@id`; set real `published` dates per page in the registry; replace `operatingSystem` with `browserRequirements` ("Requires a Chromium-based browser such as Chrome, Edge or Brave") plus a truthful OS value; align `totalTime`; add `image` and `speakable`. |
| 13 | **Medium** | No About/author page and no contact route besides a personal Gmail in the privacy page; byline links to the repo. Weak Experience/Authoritativeness. | Add `/about` (registry entry + page) with factual author/project history, link from footer, byline and Person schema, plus a contact method (GitHub issues is fine). |
| 14 | **Low** | One shared OG image for all pages; privacy title is generic; every page ships an ignored `keywords` meta (`app/layout.tsx:33`). | Generate per-page OG text from the registry (`next/og` already in use); retitle privacy to include the product name; drop `keywords`. |
| 15 | **Low** | 404 template emits two `robots` metas (`noindex` and `index, follow`) and two `<title>` tags (`curl /nope`); guide CSS has no `@media` rules (`components/guide.module.css`), so mobile layout is unverified; the extension's OMDb key is hard-coded in a public repo (`extension/background.js:3`), a reliability risk for the product the pages promise. | Add `app/not-found.tsx` with its own `robots: noindex` metadata and a link back; test guide pages in a 375 px viewport and add breakpoints if needed; move the OMDb key to a user setting or proxy (product-level, outside the SEO slice). |

---

## 11. How to re-score

- Re-run the same probes: build, start, curl all `PAGES` plus robots/sitemap/llms/404; parse JSON-LD; recount passages.
- Targets that most move the composite: Content/E-E-A-T 44 -> 65+ (findings 1, 2, 3, 6, 13), Schema 55 -> 75+ (5, 12), Citability 54 -> 70+ (6, 8), Platform 53 -> 65+ (10, 11, off-site work), Technical 78 -> 85 (9, 15).
- Add Brand/entity at 20% weight once Search Console, Bing Webmaster and a brand-mention scan exist; record that as a re-baseline, not a regression.

*Local probe artifacts (not committed): scratchpad `h/*.html`, `h/*.hdr`.*
