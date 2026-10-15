# Netflix Ratings — Design System & Claude Handoff Prompt

Source of truth for the homepage redesign ("paper & ink ticket stub").
Code: `app/page.tsx`, `app/page.module.css`, `app/globals.css`, `app/layout.tsx`.
Static reference mock: https://claude.ai/artifact/CWdUHrPPz9GgKbrATxU1Pr (private to the owner).

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

## Components

- **Ticker** (top): black bar, mono caps, infinite 60s slide of `title ★ imdb rt%`, pauses on hover, disabled under reduced motion.
- **Nav:** wordmark `NETFLIX/RATINGS` (slash in `--signal`), mono links, CTA = red block, 2px ink border, 4px offset shadow.
- **Buttons:** flat blocks, uppercase 800; hover = translate(3px,3px) and shadow removed ("press" effect). Primary: ink bg + red shadow. On red section: ink bg + gold shadow.
- **Hero headline:** "Check the **score.** *then* press play." — "score." sits on a gold block rotated −2°.
- **Ticket stub:** gold card, 3px border, 10px hard shadow, rotated 3°, dashed dividers, two circular notches at the perforation, IMDb half (gold) and RT half (red, white text), 104px numbers.
- **Poster tile:** 2:3, 3px border, 6px hard shadow, flat fill (red/teal/gold/paper), huge condensed title bottom-left, ink score tag clipped to top-right corner (gold mono text). Hover lifts −3px with bigger shadow.
- **Versus scoreboard:** `--ink` section, two columns split by a paper rule, 260px numerals (8.7 in gold, 86% in red), serif-italic label above.
- **Numbered rows** (features, steps): 2px top rules, mono index `01`, title, description; stack to 2 columns on tablet.
- **Review cards:** flat fills, 3px border + hard shadow, tiny alternating rotation (±0.5–0.8°), serif quote, mono caption, ink score chip.
- **FAQ:** `<details>` rows between 2px rules, `+` rotates 45° when open.
- **Final CTA:** full-bleed `--signal`, 200px condensed headline, ink button.
- **Footer:** mono caps, author byline + "Updated" date (GEO signal — keep).

## Layout & responsiveness

Max width 1440px, side padding `clamp(20px,4vw,40px)`. Breakpoints: ≤900px → single-column hero/story/faq, 2-up posters, stacked reviews; ≤600px → scoreboard stacks, nav shows only the CTA. Grids use `minmax(0,1fr)` to prevent overflow (a real bug we hit). Keep `focus-visible` outlines (3px `--signal`) and `prefers-reduced-motion` handling.

## Do / Don't

- Do: hard shadows, 2–3px ink borders, flat color, one serif-italic accent per heading, mono for any data/label.
- Don't: blur shadows, glows, gradients, rounded corners > 0, emoji (use ★ glyph), left-border accent cards, Inter/Roboto/Arial, invented stats.

## Remaining work

1. Restyle `app/compare/imdb-vs-rotten-tomatoes/compare.module.css` to these tokens (it hard-codes dark colors and `rgba(229,9,20,…)` glows).
2. Restyle `app/privacy/page.tsx` (inline dark styles) and `app/camera-vision/page.tsx` if it is public.
3. Add an OG image in this style (ticket stub with 8.7 / 86%).
4. Optional: real extension screenshots in place of the flat poster tiles.
