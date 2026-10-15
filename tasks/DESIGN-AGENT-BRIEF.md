# Brief for the paper & ink redesign agents (wave 2)

Read in this order: `docs/DESIGN.md` (spec + **Token contract** at the bottom), then `tasks/AGENT-BRIEF.md` (truth rules; ignore page-building parts), then this file.

## Goal
Restyle your slice to the "paper & ink ticket stub" design: warm paper ground, black ink, hard 2–3px ink borders, hard offset shadows (no blur), flat colour blocks, big condensed Archivo display type, Instrument Serif italic accent word, JetBrains Mono labels. Scores (IMDb gold, Rotten Tomatoes signal red) are the heroes: ticket stubs, poster tags, scoreboards.

## Hard rules
- **No** gradients, glows, blur, rounded cards (radius 0–2px), emoji, Inter/Roboto, pure-white backgrounds. White text only on `--signal`, `--teal`, `--ink`.
- Use the tokens and `ds-*` helper classes from `app/globals.css` (see Token contract). Use `components/ScoreChip.tsx` for every IMDb/RT score (never emoji). Do not hardcode hex values that exist as tokens.
- Keep ALL copy, links, ids/anchors, headings order, aria labels, SEO metadata and JSON-LD intact. Style only (and the minimum markup needed for style hooks). If copy is wrong/unverifiable, leave it and report it.
- Accessibility: contrast >= WCAG AA (tokens already pass; do not invent new text colours), visible focus, `prefers-reduced-motion` respected, tap targets >= 44px, works at 360px width with no horizontal page scroll.
- Stay inside your slice's files. No `lib/pages.ts`, `lib/seo.ts`, `lib/content.ts` edits unless your slice says so. No new dependencies.
- Display type: `font-family: var(--display); font-weight: 900; font-stretch: 62%; text-transform: uppercase; line-height: .86`. Accent: wrap one word in `<em>` rendered with `var(--serif)` italic, normal case, `font-stretch: 100%`. Do not stretch the *body* font.
- Git: **stage by explicit path only (`git add <files>`) — NEVER `git add -A`, never commit `node_modules`.** Commit on your worktree branch, no push. Commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Worktree setup: `ln -s /Users/igorgazivoda/netflix-imdb/node_modules node_modules` (do not commit it). If `next build` throws a webpack `WasmHash` TypeError: `rm -rf .next` and rebuild.
- Verify: `npx tsc --noEmit && npx jest && npx next build && npm run -s seo:validate && npm run -s seo:links`, then `next start -p <PORT>`, curl your pages, and (if the Chrome tools are available) screenshot at 1280 and 390 px widths and LOOK at them; fix what looks off. Kill your server.
- Report (<=150 words): branch, files, what you verified (say if you could not screenshot), flags. No code in the report.
