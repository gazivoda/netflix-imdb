# Shared brief for SEO/GEO agents (read fully before starting)

Repo: Next.js 14 App Router site for **Netflix Ratings**, a free open-source Chrome extension that shows IMDb + Rotten Tomatoes scores on Netflix title cards. Site `https://netflix-ratings.app`. Author: Igor Gazivoda. Today = 2026-10-15. Goal: raise SEO + GEO (AI-search) quality. You are one of ~20 agents working in parallel, each in its OWN git worktree, each owning a disjoint slice. Stay inside your slice.

## Foundation you can rely on (already on main)
- `lib/pages.ts` — page registry (path/title/description/updated/priority/group/label). Sitemap, metadata, footer links and tests all read it. **A new page = one registry entry + `app/<path>/page.tsx`.** Group `guide` and `compare` are linked from the footer automatically.
- `lib/seo.ts` — `pageMetadata(path)` (canonical, OG, Twitter, image), JSON-LD builders `breadcrumbList, faqPage, howTo, article, graph`.
- `components/GuideLayout.tsx` — shell for content pages (header, breadcrumb, byline with the registry `updated` date, JSON-LD graph, FAQ block, footer). Styles: `components/guide.module.css` (classes: h2, p, list, steps, note, callout, btnPrimary, tableWrap/table, faq*). See `app/install/page.tsx` for the reference pattern and `app/compare/imdb-vs-rotten-tomatoes/page.tsx` for a richer one.
- `tests/lib/seo.test.ts` enforces: rendered title (incl. " · Netflix Ratings" suffix) ≤ 65 chars; description 70–160 chars; unique well-formed paths; page file exists for every registry entry; FAQPage schema must NOT be in the root layout.

## Hard rules
1. **Truth only.** Never invent facts, statistics, reviews, quotes, screenshots, or competitor claims. Read `extension/` source (content.js, background.js, manifest.json) for anything you say about how the product behaves. Verified facts: shows IMDb rating (x/10) and Rotten Tomatoes % in a badge at the top-right of each Netflix title card on www.netflix.com; ratings fetched from OMDb by the background worker; Manifest V3, name "Netflix Ratings", v1.0.0; permissions only netflix.com + omdbapi.com; not on Chrome Web Store yet (install = Load unpacked from GitHub, repo `https://github.com/gazivoda/netflix-imdb`, `extension.zip` in repo root); works on Chromium browsers (Chrome/Edge/Brave), untested in Firefox/Safari; no account; open source. Any competitor/third-party claim: verify with WebFetch/WebSearch first and cite; if unverifiable, leave it out.
2. Brand name is **"Netflix Ratings"** everywhere (never "Netflix IMDB Ratings"). Trademark-safe: add "not affiliated" wording where relevant.
3. No new dependencies (no `npm install`). No git push. Do not edit `tasks/todo.md` or `tasks/AGENT-BRIEF.md`.
4. Do not touch files outside your slice, except: append your entry to `lib/pages.ts` (new pages only), and add tests under `tests/` for your work. If you truly need a change elsewhere, make the smallest possible edit and mention it in your report.
5. New pages: use `GuideLayout`, `pageMetadata(PATH)`, answer-first first paragraph (a definition/answer in the first ~50 words), question-style H2s, 400–900 words of real useful copy, a FAQ (3–6 Q&As, answers self-contained 40–80 words), internal links to /install and /compare/imdb-vs-rotten-tomatoes and each other where relevant, `published`/`updated` = '2026-10-15'. No fake screenshots/images.
6. Code style: match surrounding code, concise comments only where the *why* is non-obvious. macOS: `sed -i ''` (or use python). Always use heredocs with a closing marker for file writes.

## Worktree setup (do this first)
Your worktree has no node_modules. Run: `ln -s /Users/igorgazivoda/netflix-imdb/node_modules node_modules` (do NOT commit it; it is gitignored).

## Verification before you finish (all must pass)
`npx tsc --noEmit && npx jest && npx next build` — and for pages, `npx next start -p <YOUR_PORT>` + curl to confirm rendered HTML (title, canonical, JSON-LD, links), then kill the server. Use only your assigned port.

## Finish
Commit everything in your worktree on its branch with a clear message ending with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Final report (≤150 words): branch name, files changed, what you verified, any follow-ups/risks/flags for the user. Do not paste code in the report.
