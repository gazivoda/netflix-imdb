# Performance / Core Web Vitals pass (2026-10-15)

Method: `next build` + `next start` (production), per-route resource sizes read from the rendered HTML
(`curl`-style, `Accept-Encoding: gzip`), Lighthouse 12 (mobile preset, simulated 4G/4x CPU, run from the
local npx cache, no install), plus before/after screenshot and computed-style diffs in headless Chrome
(`prefers-reduced-motion: reduce`, 1280 and 390 px) to prove visual output is unchanged.

## Result in one line

The site was already fast (Lighthouse mobile 0.99, CLS 0, TBT 0 ms, no images, no `will-change`).
The one measured, safe win: Tailwind CSS was shipped in the global stylesheet of every page although only
`/camera-vision` uses it. It is now scoped to that route.

## Change shipped

| Item | Before | After |
|---|---|---|
| `app/globals.css` | began with `@tailwind base/components/utilities` (1.3 KB gz of utilities + `@property --tw-*` rules in the render-blocking CSS of every page) | directives removed; globals is 825 B |
| `app/camera-vision/tailwind.css` (new), imported from `app/camera-vision/layout.tsx` | n/a | holds the three directives; only loaded on `/camera-vision` |

### CSS per route (all stylesheets in the HTML, raw / gzip bytes)

| Route | Before | After | Saved |
|---|---|---|---|
| `/` | 30,557 / 6,700 | 27,851 / 6,218 | 2,706 / 482 |
| `/install` | 21,128 / 4,521 | 18,422 / 4,039 | 2,706 / 482 |
| `/compare/imdb-vs-rotten-tomatoes` | 21,128 / 4,521 | 18,422 / 4,039 | 2,706 / 482 |
| `/privacy` | 12,629 / 2,146 | 9,923 / 1,664 | 2,706 / 482 |
| `/camera-vision` | 12,629 / 2,146 | 12,657 / 2,576 | +28 / +430 (Tailwind now a separate request there) |

Note: small files (< ~1 KB) are served uncompressed by `next start`, so the globals chunk counts 825 B on the
wire; gzip figures above are what the server actually sent. Net on the content pages is about 2.7 KB raw and
about 0.5 KB over the wire. It is small, but it is free, removes a pile of global class names (`.block`,
`.flex`, `.container`, `.table`, `.static`, `.visible`, `.border`, ...) and `--tw-*` `@property` rules from
pages that never use them, and it is a prerequisite for dropping Tailwind from the repo later.

### Visual / behavioural verification

- Computed styles of every element on all 5 routes (388 / 106 / 50 / 150 / 68 elements, every CSS property
  plus bounding box) are identical before vs after. The only differences are custom-property strings on
  `<body>` (`--border`, `--border-strong`, `--badge-bg` serialisation, and the dropped unused `--tw-*`).
- Pixel diff of full-page screenshots: `/privacy` and `/camera-vision` identical at both widths.
  `/install` and `/compare/...` differ by at most 1/255 in a single channel on about 1.2-1.7k border pixels:
  the Tailwind pipeline had been quantising `rgba(245,240,235,.09)` to 8-bit alpha (`#f5f0eb17`, alpha 0.0902);
  without it the exact authored `.09` is used. Imperceptible. The home page is noisy between identical runs
  (animated bars/marquee), so it was verified through computed styles instead.
- `/camera-vision`: `.container`, `.flex`, `.min-h-screen` etc. still emitted and the page is pixel-identical.
  Pre-existing issue, not touched: the file mixes Tailwind v3 directives with Tailwind v4 (`@tailwindcss/postcss`),
  and with v4 and no theme import, colour/spacing utilities such as `bg-gray-900`, `text-3xl`, `px-4` are not
  generated at all, so that demo page is largely unstyled and `tailwind.config.js` is ignored. Fixing it
  (`@import "tailwindcss"`) would change that page visually, so it was left alone.

## Measurements with no change needed

### JS (production build, all routes share the same framework chunks)

| Route | First Load JS (Next report) | JS on the wire, modern browser (gz) |
|---|---|---|
| `/`, `/install`, `/compare/...`, `/privacy` | 87.5-89 kB | 87.8 kB (framework 31.8 + 53.7 + runtime/webpack 2.2) |
| `/camera-vision` | 107 kB | 107 kB (adds a 19 kB route chunk and a 43 KB shared chunk) |

`polyfills-*.js` (112 KB raw / 39.6 KB gz) is `noModule`, so it is not fetched by any browser that matters; it
only appears in a naive "sum all scripts" figure. Page-specific JS on content routes is 0.1-1.6 kB because they
are server components. Nothing to cut without ejecting from Next's runtime. Lighthouse "legacy JavaScript"
(11 KiB) is inside Next's own chunk, not app code.

### Fonts

- Two `next/font/google` families, both variable: Bricolage Grotesque (display) and Hanken Grotesk (body).
  Only the two `latin` woff2 files are preloaded and downloaded (34.7 + 41.2 KB = 75.9 KB); the other
  subsets are `unicode-range`-gated and never fetched for English pages.
- The explicit `weight` arrays (3 + 4) generate 21 `@font-face` rules (9.1 KB raw / 0.84 KB gz) but they all
  point at the same variable files, so there are no extra downloads. Dropping the arrays would shrink that CSS
  to 3.1 KB raw (measured) with identical font files, but it changes rendering: computed styles show Hanken at
  weight 800 on 70 elements and 900 on 1, and Bricolage at 400 on the FAQ chevron. Today the browser snaps
  those to 700 / 600; a full variable range would render true 800/900/400. Not visually identical, so not done.
- `display: 'swap'` and `preload` (default) are already right. `adjustFontFallback` is on by default and
  emitted (`size-adjust` Arial fallbacks for both families), which is why CLS is 0. No change to the
  `next/font` block.

### Lighthouse (home, mobile, simulated throttling)

| Metric | Before | After |
|---|---|---|
| Performance score | 0.99 | 0.99 |
| FCP | 1.1 s | 1.1 s |
| LCP | 2.3 s | 2.3 s |
| TBT | 0 ms | 0 ms |
| CLS | 0 | 0 |
| Total byte weight | 186 KiB | 185 KiB |

Lighthouse's simulation does not resolve a 0.5 KB gz difference; the change is a bandwidth/cleanliness win,
not a metric movement. Unthrottled on localhost FCP = LCP = 0.1 s.

- LCP element: text (the nav logo link `a.navLogo`), not an image. The hero `<h1>` is
  `opacity:0` for 0.06 s + 0.7 s (`.reveal`), so it is not the candidate. There are no raster images on the page.
- Render-blocking: 3 stylesheets (about 1.2 KB + 1.7 KB + 4.9 KB over the wire). Lighthouse estimates 250 ms
  of simulated savings from inlining/merging; Next 14 has no safe built-in switch for that
  (`experimental.optimizeCss` needs `critters`, not installed), so it is left as a possible follow-up.
- CLS: 0 on home. Hero mockup is plain divs with CSS-defined sizes, no images or embeds, no late-injected
  content. No risk found.
- `will-change`: none in the codebase. Animations: `.reveal` (opacity/transform, once), marquee
  (`transform: translateX`, compositor-only, disabled under reduced motion). One non-compositor animation:
  `grow` on the 2 comparison bars (`width`, once, 1.1 s, 10 px tall). Not worth changing.
- Static paint cost to be aware of (unchanged, visual): `filter: blur(30px)` on `.glow` behind the hero mockup,
  and `backdrop-filter: blur(14px)` on the sticky nav and a `blur(4px)` in the mockup. Removing them would
  alter the look, so they are flagged only.

### HTML

Home HTML is 84.8 KB raw / 15.0 KB gz; 51.6 KB of that is the inlined RSC flight payload (Next 14 behaviour for
static pages), which compresses well. Other routes: install 44 / 8.0 KB, compare 48 / 8.9 KB,
privacy 25 / 5.4 KB, camera-vision 19 / 5.0 KB gz.

## Follow-ups (not done, need a decision)

1. Inline critical CSS or reduce the three CSS chunks to one (about 250 ms simulated FCP/LCP on slow 4G).
2. Optionally trim the font `weight` arrays once the design accepts the 400/800/900 rendering shift described
   above (about 0.5 KB gz, 6 KB raw), and move the `grow` bar animation to `transform: scaleX`.
3. Fix or remove the Tailwind setup for `/camera-vision` (v3 directives under v4).
