# Design QA: paper & ink redesign

Spec: `docs/DESIGN.md` (incl. Token contract). Guards: `tests/design-guards.test.ts`. Live audit: `scripts/design-audit.mjs`.

## 1. Commands

```bash
# Static guards (no server). Fails per rule, names file:line.
npx jest tests/design-guards.test.ts
DESIGN_GUARD_SUMMARY=1 npx jest tests/design-guards.test.ts   # adds violation counts per rule and per file

# Token values + WCAG contrast of the tokens themselves
npx jest tests/design-tokens.test.ts

# Everything the release gate needs
npx tsc --noEmit && npx jest && npx next build && npm run -s seo:validate && npm run -s seo:links

# Live audit against a running build (builds nothing). Port 3419 is this slice's port; use yours.
npx next start -p 3419 &
node scripts/design-audit.mjs http://localhost:3419            # exit 0 clean, 1 findings, 2 server unreachable
node scripts/design-audit.mjs http://localhost:3419 --strict   # also flags #ffffff in CSS
node scripts/design-audit.mjs http://localhost:3419 --json
kill %1
```

What the guard test enforces (CSS = `app/globals.css` + every `*.module.css`; excludes tests, node_modules, .next, .claude):

| Rule | Forbidden | Escape hatch |
|---|---|---|
| gradient | `gradient(` | none |
| blur | `blur(` | none |
| backdrop-filter | `backdrop-filter` | none |
| shadow-blur | box-shadow / text-shadow / `--shadow*` / `drop-shadow()` layer whose 3rd length (blur) is not 0 | none |
| border-radius | any corner radius above 2px, or any non-zero % | `/* ds-allow: radius */` on the line or the line above (status dots, `50%`) |
| white-background | `#fff`, `#ffffff`, `white`, `rgb(a)(255,255,255)` in `background*` | `/* ds-allow: white */` |
| banned-font | `Inter` or `Roboto` in a font declaration | none |
| emoji | any `\p{Extended_Pictographic}` char, plus U+FE0F, U+20E3, U+200D, regional indicators, and the same hidden behind `&#x..;`, `\u{..}`, `\1F345` escapes, in `.ts/.tsx/.css` under `app/`, `components/`, `lib/` | typographic allow-list only (below) |

Emoji allow-list (Extended_Pictographic chars we treat as plain typography): U+00A9 (c), U+00AE (r), U+2122 (tm), U+2194 and U+2196-2199 (double and diagonal arrows), U+2714 (heavy check mark). Plain arrows U+2190-2193, dashes, bullets, U+2713 check, stars U+2605/2606 are not pictographic and need no entry. No emoji presentation selector (U+FE0F) is ever allowed, so a glyph above only passes as text. `extension/` and `tests/` are not scanned.

Not covered by the guards: Tailwind utility classes in TSX (`rounded-lg`, `bg-gradient-*`, `shadow-lg`). `app/camera-vision/page.tsx` is the only file that uses them (see section 5).

## 2. Manual checklist

Run on a production build (`next build && next start`), not `next dev`. Check every registry page (`lib/pages.ts`): `/`, `/install`, `/how-to/*` (3), `/research/imdb-vs-rotten-tomatoes-gap`, `/compare/imdb-vs-rotten-tomatoes`, `/compare/alternatives`, `/about`, `/camera-vision`, `/privacy`.

### Widths: 360, 390, 768, 1280 px
DevTools device toolbar, or the Chrome tools' `resize_window`. For each width, each page:
- [ ] No horizontal page scroll (`document.documentElement.scrollWidth <= innerWidth`). Wide tables scroll inside their own wrapper only.
- [ ] Display headings wrap without clipping; condensed Archivo (`font-stretch: 62%`) stays legible, serif accent word sits on the baseline.
- [ ] Hard shadows (6px / 3px offsets) are not clipped by `overflow: hidden` parents or the viewport edge.
- [ ] Score chips, ticket stubs and the scoreboard keep IMDb gold and Rotten Tomatoes signal red, with ink/white text as specified.
- [ ] Tap targets (nav, buttons, FAQ summaries, footer links) are at least 44x44 px at 360 and 390.
- [ ] Nav collapses or wraps cleanly at 360; skip link works.
- [ ] Fonts actually load: heading is Archivo (not Arial Narrow fallback), mono labels are JetBrains Mono. DevTools, Rendered Fonts.
- [ ] No white page flashes, no rounded corners, no blur or glow, no gradient anywhere (also in OG preview and hover/focus states).

### Keyboard path (no mouse)
- [ ] Tab from the address bar: first stop is the skip link; Enter jumps to main content.
- [ ] Tab order follows visual order through header, hero CTA, sections, FAQ, footer; no traps.
- [ ] Every interactive element shows the 3px ink outline with 3px offset (`:focus-visible`), also on dark ink sections and on signal/teal fills (the ink outline must stay visible there; if not, report it rather than inventing a colour).
- [ ] FAQ `<details>`/accordion opens and closes with Enter and Space.
- [ ] Buttons (`ds-btn`) show the pressed translate on keyboard activation, not only on hover.

### Reduced motion
DevTools, Rendering, Emulate `prefers-reduced-motion: reduce`.
- [ ] Marquee/ticker, hover translations and any entrance animation stop or collapse to about 0 ms.
- [ ] Smooth scrolling is off (anchor links jump).
- [ ] Nothing depends on motion to convey state.

### Contrast
- [ ] Token pairs: `npx jest tests/design-tokens.test.ts` is green (ink/paper, muted/faint on paper and card, red-text, paper on teal, ink on gold, white on signal and on red-dark all at least 4.5:1).
- [ ] Spot check with DevTools contrast picker on: muted text on `--bg-2` bands, text over any pattern or poster block, and chips. White text only on signal, teal, ink.
- [ ] `node scripts/design-audit.mjs <url>` reports no off-token hex colours (anything not in the token set is a candidate contrast regression).

### Print (Cmd+P, "Save as PDF", Background graphics OFF and ON)
No `@media print` rules exist today, so this checks the default behaviour.
- [ ] Article pages (`/install`, `/how-to/*`, `/compare/*`, `/research/*`, `/privacy`) are readable: ink text on a light ground, no clipped text, headings not stranded at the page bottom.
- [ ] Background graphics OFF: yellow and red score chips and white-on-red buttons do not become white-on-white (text must still be legible).
- [ ] Links remain distinguishable; the sticky header or nav does not repeat over content.
- [ ] Hard shadows and borders do not break across page boundaries inside tables or cards.

### Final sweep
- [ ] `npx jest tests/design-guards.test.ts` is green.
- [ ] `node scripts/design-audit.mjs http://localhost:<port>` exits 0.
- [ ] Copy, links, JSON-LD and metadata are unchanged (`npm run -s seo:validate && npm run -s seo:links`).

## 3. Before picture (baseline commit `ca1f81d`, before the restyle agents merge)

`npx jest tests/design-guards.test.ts` at this commit: 7 of 14 tests fail. This is expected: 18 other agents are restyling these files in parallel and the guards will only go green once those branches merge. The 4 scanner self-tests, the coverage tests and the banned-font rule pass. The audit script and the guards were written to be accurate at this commit (counts were cross-checked against `grep`).

Total violations: 73.

| Rule | Count | Per file |
|---|---|---|
| gradient | 9 | `app/page.module.css` 2, `components/guide.module.css` 2, `components/home/Marquee.module.css` 2, `components/home/Hero.module.css` 1, `components/home/HowItWorks.module.css` 1, `components/home/Testimonials.module.css` 1 |
| blur | 3 | `components/guide.module.css` 1, `components/home/Hero.module.css` 1, `components/home/HomeNav.module.css` 1 |
| backdrop-filter | 2 | `components/guide.module.css` 1, `components/home/HomeNav.module.css` 1 |
| shadow-blur | 4 | `components/home/shared.module.css` 2, `components/guide.module.css` 1, `components/home/Hero.module.css` 1 |
| border-radius | 26 | `components/guide.module.css` 6, `components/home/Hero.module.css` 5, `components/home/CompareCta.module.css` 3, `components/home/BeforeAfter.module.css` 2, `components/home/HomeNav.module.css` 2, and 1 each in `app/compare/imdb-vs-rotten-tomatoes/compare.module.css`, `components/home/Faq.module.css`, `HomeFooter.module.css`, `HowItWorks.module.css`, `Marquee.module.css`, `shared.module.css`, `Story.module.css`, `Testimonials.module.css` (under `components/home/`) |
| white-background | 4 | `components/guide.module.css` 1, `components/home/BeforeAfter.module.css` 1, `components/home/CompareCta.module.css` 1, `components/home/Hero.module.css` 1 (all `rgba(255,255,255,.0x)` tints) |
| banned-font | 0 | |
| emoji | 25 | `app/camera-vision/page.tsx` 12, `lib/content.ts` 9, `app/compare/imdb-vs-rotten-tomatoes/page.tsx` 3, `app/how-to/show-imdb-ratings-on-netflix/page.tsx` 1 |

Files with zero violations at baseline: `app/globals.css`, `components/ScoreChip.module.css`, `app/research/research.module.css`, `components/home/Features.module.css`, `Stats.module.css`, `FinalCta.module.css`.

Live audit at the same commit (`next start -p 3419`, `node scripts/design-audit.mjs http://localhost:3419`, FAIL):

- Classes with no CSS: `/camera-vision` only, 44 Tailwind utility classes (`bg-gray-900`, `rounded-lg`, `text-6xl`, `md:grid-cols-2`, ...). Tailwind is not wired into `globals.css` (no `@tailwind` directives), so that page renders unstyled. All 10 other registry pages: clean.
- Hex colours outside the token set: 21 occurrences in 2 built stylesheets, all expected to disappear with the restyle: `#000000` x5, `#ff7a72` x3, `#ff7a5c` x3, `#0c0a0b` x2 (fallback inside `ScoreChip` `var(--ink, ...)`), and one each of `#ff5f57`, `#febc2e`, `#28c840` (mockup window dots), `#999999`, `#8d8480`, `#f5c518` and `#fa320a` (ScoreChip `var()` fallbacks), `#e0860a`.
- `--strict` adds 3 `#ffffff` occurrences.

To refresh this table: `DESIGN_GUARD_SUMMARY=1 npx jest tests/design-guards.test.ts`.

## 4. Done criteria

All design-guard tests green, audit exits 0, and the manual checklist above ticked at 360/390/768/1280.

## 5. Flags

- `app/camera-vision/page.tsx` (registry page `/camera-vision`) is styled entirely with Tailwind classes that are not generated, uses 12 emoji, and is not part of the paper & ink design. Someone has to own it, or remove it from the registry. The guard test will stay red on its emoji until then.
- `lib/content.ts` contains 9 emoji in copy. Replacing them changes copy, so the owner of that file needs to decide (use `<ScoreChip>` or plain text).
- The ScoreChip CSS module uses `var(--ink, #0c0a0b)`-style fallbacks with off-token hex. Harmless at runtime (the tokens always exist) but the audit reports them until the fallbacks are dropped.
