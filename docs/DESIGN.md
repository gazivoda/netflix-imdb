# Netflix Ratings — Design System & Claude Handoff Prompt

> **Status note (2026-10-15):** this spec was supplied by the owner. At the time it was added, the repo's homepage
> was still the OLD dark theme (no Archivo/Instrument Serif/JetBrains Mono, no `--paper` tokens), so the
> design had to be implemented from this document, not "already present". The static reference mock is a
> private artifact: https://claude.ai/artifact/CWdUHrPPz9GgKbrATxU1Pr

Source of truth for the homepage redesign ("paper & ink ticket stub").
Code: `app/page.tsx`, `app/page.module.css`, `app/globals.css`, `app/layout.tsx`.

## Paste this into Claude

> You are working on the `netflix-imdb` Next.js 14 (App Router, CSS Modules) landing page for a Chrome extension that overlays IMDb + Rotten Tomatoes scores on Netflix cards. Read `docs/DESIGN.md` first and follow it exactly. The homepage (`app/page.tsx` + `app/page.module.css`) already implements the design; the compare page (`app/compare/...`) and `app/privacy/page.tsx` still use the OLD dark theme and need to be restyled to match. Keep all copy, links, SEO metadata and JSON-LD in `app/layout.tsx` / `lib/content.ts` intact. Do not add gradients, glows, rounded cards, emoji, or Inter/Roboto. Run `npx tsc --noEmit` and `npx next build` before committing.

## Concept

A printed cinema ticket / film-festival programme. Warm paper ground, black ink, hard 2–3px borders, hard offset shadows (no blur), flat color blocks, big condensed type. The two scores (IMDb audience, Rotten Tomatoes critics) are the heroes — rendered as ticket stubs, poster tags and a giant scoreboard.

## Tokens (scoped to `.page` in `page.module.css`)

| Token | Value | Use |
|---|---|---|
| `--paper` | `#ece6d8` | page background |
| `--ink` | `#111111` | text, borders, shadows, dark sections |
| `--signal` | `#e5241b` | Rotten Tomatoes / CTA / accent |
| `--gold` | `#f2c230` | IMDb / highlights |
| `--teal` | `#2b4a5c` | secondary poster/review fill (text `--paper`) |
| card paper | `#f6f1e5` | lighter card fill |

Never use pure white backgrounds or gradients. White text only on `--signal` and `--teal`/`--ink`.

## Type (next/font in `layout.tsx`)

- **Display:** Archivo, `font-stretch: 62%`, weight 900, uppercase, line-height ~0.84–0.9. Hero up to ~184px (`clamp(76px,13vw,184px)`), section H2 `clamp(48px,8vw,96px)`.
- **Accent:** Instrument Serif *italic* (`var(--serif)`), used for one emphasized word/phrase per heading (`<em>`), normal case, `font-stretch: 100%`.
- **Labels/data:** JetBrains Mono 500/700, 12–13px, uppercase, letter-spacing .06–.14em.
- **Body:** Archivo normal width, 17–20px, line-height 1.5–1.6.
