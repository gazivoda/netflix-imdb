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

## Token contract

Implemented globally in `app/globals.css` (tokens + helpers) and `app/layout.tsx` (fonts). Use these; do not redeclare them in CSS Modules. Enforced by `tests/design-tokens.test.ts` (exact brand values, hard shadows only, WCAG AA contrast).

### Fonts (`next/font/google` in `layout.tsx`, vars on `<html>`)

- **Archivo**: variable font with width axis (`font-stretch: 62%` to `125%`, weight 100 to 900); injected as `--font-archivo`. Set `font-stretch` explicitly for condensed text.
- **Instrument Serif**: italic 400 only; injected as `--font-serif-src`.
- **JetBrains Mono**: 500 and 700; injected as `--font-mono-src`.
- Never reference the injected `--font-*` names in components; use `--display` / `--body` / `--serif` / `--mono` below.

### Brand tokens (`:root`)

- `--paper` `#ece6d8`: page background.
- `--ink` `#111111`: text, borders, shadows, dark sections.
- `--signal` `#e5241b`: Rotten Tomatoes / CTA / accent. Text on it must be white.
- `--gold` `#f2c230`: IMDb / highlights. Text on it must be ink.
- `--teal` `#2b4a5c`: secondary fill. Text on it must be paper.
- `--card` `#f6f1e5`: lighter card paper.
- `--shadow-hard`: `6px 6px 0 ink`; `--shadow-hard-sm`: `3px 3px 0 ink`. Hard shadows only, never blurred.

### Font stacks

- `--display`: Archivo with fallbacks (pair with `font-stretch: 62%`, weight 900, uppercase).
- `--body`: Archivo, normal width.
- `--serif`: Instrument Serif (use `font-style: italic`).
- `--mono`: JetBrains Mono.

### Legacy variables (remapped so old CSS Modules re-theme; prefer the brand tokens in new code)

- `--bg` = paper; `--bg-2` `#e4dccb` deeper paper band; `--surface` = card; `--surface-2` `#e6dfcd`.
- `--border` and `--border-strong` = ink (use with 2 to 3px widths, not hairlines).
- `--text` = ink; `--muted` `#4a4640` (7.5:1 on paper, 8.3:1 on card); `--faint` `#5c574f` (5.8:1 paper, 6.4:1 card).
- `--red` = signal; `--red-dark` `#b81810` (hover fill, white text OK); `--red-text` `#c41d15` (red text on paper/card, AA).
- `--imdb` = gold; `--rt` = signal; `--badge-bg` = ink; `--radius` = 0.

### Global rules and utilities

- `body`: paper background, ink text. `a { color: inherit }`.
- `:focus-visible`: 3px solid ink outline, 3px offset. `::selection`: signal background, white text.
- `.sr-only`: visually hidden, still announced. `.skip-link`: ink skip link, shown on focus.
- `@media (prefers-reduced-motion: reduce)`: animations and transitions collapse to ~0ms, smooth scroll off.

### Helper classes (plain global class names, not CSS Modules; use as `className="ds-card"` or `<h2 className="ds-display">`)

- `.ds-display`: Archivo 900, `font-stretch: 62%`, uppercase, line-height 0.86. Set `font-size` yourself.
- `.ds-serif`: Instrument Serif italic, `font-stretch: 100%`, normal case; for an `<em>` inside a display heading.
- `.ds-label`: JetBrains Mono 500, 12.5px, uppercase, letter-spacing .1em.
- `.ds-card`: card paper, 3px ink border, `6px 6px 0` ink shadow, no radius.
- `.ds-btn`: card-paper button, 3px ink border, `5px 5px 0` shadow; translates into the shadow on hover/active. Works on `<a>` and `<button>`.
- `.ds-btn-signal`: add next to `.ds-btn` for the primary CTA (signal fill, white text).
- `.ds-chip-imdb`: gold chip, ink text, 2px ink border, mono 700.
- `.ds-chip-rt`: signal chip, white text, 2px ink border, mono 700.
