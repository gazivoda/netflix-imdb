# SWARM-PERF 2026-11-09: lab performance and social previews for rating.watch

Read-only research. No source file was changed; every patch below is a proposal and was NOT built or tested here.

## 0. Method and caveats

- PageSpeed Insights API was 429, so lab data came from local Lighthouse **12.8.2** (`npx lighthouse@12`, Node 24.15.0) driving `/Applications/Google Chrome.app` headless, against the LIVE URLs, 2026-11-09.
- All numbers are **LAB data from one machine, not field data (no CrUX)**. Mobile = Lighthouse default emulation (Moto-class, 4x CPU, simulated slow 4G, Lantern simulation). Desktop = `--preset=desktop`. Lighthouse 12 shows the new insight audits next to the legacy ones.
- LCP/FCP in the tables are the **simulated** (Lantern) values that drive the score. The unthrottled observed LCP is far lower (section 1.3). Trust the simulated value for score parity with PSI, the observed value for "what the server and render path really cost".
- Raw JSON (not committed): `/private/tmp/claude-501/-Users-igorgazivoda-netflix-imdb/02dcd7a2-bca6-484b-8fe5-34ead23d2b15/scratchpad/lh-*.json`, social audit `.../scratchpad/og.jsonl`.
- `npx unlighthouse` not needed (Lighthouse ran). No global installs, no `npm install` in the repo.
- The working tree had uncommitted edits by other agents when this ran; line references are to files as read.

## 1. Lab results

### 1.1 Summary (mobile, one run each except home)

| Page | Perf | A11y | BP | SEO | FCP | LCP (sim) | CLS | TBT | Total bytes | Requests |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` run 1 | 98 | 100 | 100 | 100 | 987 ms | 2364 ms | 0 | 2 ms | 311,620 | 19 |
| `/` run 2 | 98 | 100 | 100 | 100 | 981 ms | 2284 ms | 0 | 0 ms | 311,611 | 19 |
| `/` run 3 | 98 | 100 | 100 | 100 | 1007 ms | 2307 ms | 0 | 0 ms | 311,638 | 19 |
| `/how-to/show-imdb-ratings-on-netflix` | 99 | **96** | 100 | 100 | 959 ms | 2159 ms | 0 | 0 ms | 262,678 | 18 |
| `/research/imdb-vs-rotten-tomatoes-gap` | 99 | 100 | 100 | 100 | 1008 ms | 2167 ms | 0 | 0 ms | 274,297 | 19 |
| `/blog` | 99 | 100 | 100 | 100 | 983 ms | 2144 ms | 0 | 0 ms | 273,607 | 19 |
| `/how-to/netflix-ratings-on-tv-and-phone` | 99 | 100 | 100 | 100 | 960 ms | 2160 ms | 0 | 0 ms | 261,642 | 18 |

Home mobile variance over 3 runs: LCP 2284 to 2364 ms (80 ms spread), perf 98 every time. Home is the closest page to the 2.5 s "good" line (about 140 to 215 ms of margin in the lab).

### 1.2 Desktop

| Page | Perf | A11y | FCP | LCP (sim) | CLS | TBT | Bytes |
|---|---|---|---|---|---|---|---|
| `/` run 1 / 2 / 3 | 100 / 100 / 100 | 100 / 100 / 100 | 300 / 310 / 289 ms | 487 / 538 / 487 ms | 0 | 0 | 311,620 to 311,652 |
| `/how-to/show-imdb-ratings-on-netflix` | 100 | **96** | 300 ms | 500 ms | 0 | 0 | 262,660 |
| `/research/...gap` | 100 | 100 | 307 ms | 499 ms | 0 | 0 | 274,301 |
| `/blog` | 100 | 100 | 307 ms | 498 ms | 0 | 0 | 273,598 |
| `/how-to/netflix-ratings-on-tv-and-phone` | 100 | 100 | 293 ms | 493 ms | 0 | 0 | 261,642 |

Desktop home a11y was 100 in all 3 runs even though the `label-content-name-mismatch` audit fired (see 2.2); best-practices and SEO were 100 on every run.

### 1.3 TTFB and where the LCP time goes

- Lighthouse `server-response-time` for the document: 31 to 44 ms on every page and form factor (this run's vantage point is close to the edge, so do not read it as a global TTFB).
- Observed (unthrottled trace) LCP breakdown, mobile: TTFB 109 to 126 ms, element render delay 118 to 162 ms, so about 230 to 275 ms real LCP. Load delay and load time are 0 because the LCP element is text on every page: the home `h1#hero-title`, the guide `h1`/`p.lede`.
- Simulated mobile LCP subparts: TTFB about 635 to 667 ms, render delay 1500 to 1650 ms. That 1.5 s is the simulated wait for the render-blocking CSS plus the 3 preloaded fonts under slow-4G throttling, not a measured stall.
- No third-party requests on any page (`third-party` transfer = 0). Document transfer 11 to 24 KB.
- CLS is exactly 0 everywhere; TBT 0 to 2 ms; main-thread work 219 to 462 ms; DOM 154 (guides), 524 (home), 608 (research), 1,120 (blog) elements. Blog's 1,120 is flagged by the `dom-size` audit but is under the 1,500 line.

### 1.4 Top 5 opportunities per page (mobile, from Lighthouse; estimated savings are lab-simulated and coarse, the 150 ms values are Lighthouse's quantisation)

Common to all five pages: the three woff2 fonts are 137,522 bytes (Archivo variable, Instrument Serif italic, JetBrains Mono) = 44 to 53 percent of every page's bytes, and JS is 94 to 96 KB. Neither is flagged by Lighthouse as an opportunity; they are the structural cost.

`/` (all 3 runs agree):
1. Improve image delivery: `/video/rating-watch-promo-poster.webp` is 1280x713 (37,364 B) but shown at 365x205 on a phone; est. 33 KiB, 150 ms LCP.
2. Reduce unused JavaScript: `chunks/fd9d1056-*.js` 53.8 KB transferred, est. 22 KiB unused (Next/React framework chunk, not app code).
3. Legacy JavaScript: `chunks/117-*.js` (31.9 KB), est. 11 KiB.
4. Render-blocking requests: 3 stylesheets, 2,852 + 11,939 + 129 bytes (score 0.5, 0 ms estimated LCP saving).
5. Network dependency tree / forced reflow (run 1 only, 0 ms reflow items). No action.

`/how-to/show-imdb-ratings-on-netflix`:
1. **Colour contrast fail** (a11y 96), see 2.1.
2. Render-blocking requests: est. 110 ms FCP/LCP.
3. Reduce unused CSS: est. 11 KiB.
4. Reduce unused JavaScript: est. 22 KiB (framework chunk).
5. Legacy JavaScript: est. 11 KiB.

`/research/imdb-vs-rotten-tomatoes-gap`:
1. Unused JavaScript est. 22 KiB (150 ms LCP).
2. Unused CSS est. 12 KiB.
3. Legacy JavaScript est. 11 KiB.
4. Render-blocking requests (0 ms).
5. Network dependency tree (0 ms).

`/blog`:
1. Unused JavaScript est. 22 KiB (150 ms LCP).
2. Unused CSS est. 12 KiB.
3. Legacy JavaScript est. 11 KiB.
4. DOM size 1,120 elements (informational, under 1,500).
5. Render-blocking requests (0 ms).

`/how-to/netflix-ratings-on-tv-and-phone`:
1. Render-blocking requests: est. 140 to 150 ms FCP/LCP (the largest render-blocking estimate of the five pages).
2. Unused CSS est. 12 KiB.
3. Unused JavaScript est. 22 KiB.
4. Legacy JavaScript est. 11 KiB.
5. Network dependency tree (0 ms).

Verdict: nothing here is urgent. All pages score 98 to 100, CLS 0, TBT near 0, and no CWV metric is near failing in the lab. Field data (CrUX) was not available and has not been checked.

## 2. Concrete findings with patches (proposals)

### 2.1 Real bug: primary CTA inside a paragraph loses its white text (contrast 4.13:1, WCAG AA needs 4.5:1)

Evidence: Lighthouse `color-contrast` on `/how-to/show-imdb-ratings-on-netflix`, element `article > div.guide_article > p.guide_p > a.guide_btnPrimary`: "foreground color: #111111, background color: #e5241b, ... contrast of 4.13". The CSS intends white text (`components/guide.module.css` `.btnPrimary { color: #fff }`, around line 159), but the content-link rule `.p a, .list a, ... { color: var(--ink) }` (line 45, specificity 0,1,1) beats `.btnPrimary` (0,1,0) whenever the button sits inside `<p className={g.p}>`.

Same markup pattern (button inside `<p className={g.p}>`) exists at `app/how-to/show-imdb-ratings-on-netflix/page.tsx:83-84` and `app/how-to/show-rotten-tomatoes-on-netflix/page.tsx:107-108`; the second page was not measured, so treat it as likely affected, not confirmed. The `.p a:hover` rule (line 53) also paints a gold background on the button on hover.

Patch, `components/guide.module.css`, append after `.p a:hover`/`.callout p a:hover` (keeps the button rules, only restores the white text and the signal underline-free look):

```css
/* A button inside prose/callouts must keep its own colours: the content-link rules above are more specific. */
.p a.btnPrimary,
.callout p a.btnPrimary {
  color: #fff;
  font-weight: 700;
  text-decoration: none;
}
.p a.btnPrimary:hover,
.p a.btnPrimary:active {
  background: var(--red-dark);
}
```

White on #e5241b is the combination `globals.css` documents as intended ("--signal takes white text only"). Verify by re-running Lighthouse on both how-to pages after the change; expected a11y 100.

### 2.2 Label in Name mismatch on the home video play button

Evidence: Lighthouse `label-content-name-mismatch` (desktop home, 3 of 3 runs): `button.PromoVideo_play` has `aria-label="Play video: Rating Watch in 30 seconds"` while its visible text is "Watch the 30 second overview" (`PROMO_VIDEO.playLabel`). WCAG 2.5.3: the accessible name should contain the visible text (voice-control users say the visible words). Source: `components/home/PromoVideo.tsx:69`.

Patch:

```tsx
// components/home/PromoVideo.tsx
aria-label={`${PROMO_VIDEO.playLabel}: ${PROMO_VIDEO.title}`}
```

(or drop `aria-label` and let the visible span be the name; the `aria-hidden` icon does not interfere). Check `tests/` for any assertion on the old string before changing.

### 2.3 Optional, low value: smaller promo poster on phones

Lab evidence: 34 KB of the 37 KB poster is wasted at 365 px display width. It is not the LCP element (text is), so the real-user benefit is bandwidth only. A `<video poster>` cannot use `srcset`; the options are a lighter 800x445 poster used for all viewports (desktop shows it at about 998 px so it would soften), or rendering the poster as a `<picture>`/`<img>` overlay until play. Recommend skipping unless mobile bytes matter. Not measured: any field impact.

### 2.4 Optional, not recommended now

- Unused/legacy JS (22 + 11 KiB) is the Next 14.2 framework chunk and its polyfill-adjacent code (`fd9d1056-*`, `117-*`); no app-code lever without a Next upgrade. `package.json` has no `browserslist` key.
- Render-blocking CSS (3 files, about 15 KB) costs an estimated 110 to 150 ms in the simulator and 0 ms observed. Inlining critical CSS in Next 14 needs `experimental.optimizeCss` (critters), which adds a build dependency; not worth it at these scores.
- Fonts (137 KB, 3 files, all preloaded): the largest byte item. Any trim (drop the `wdth` axis range, drop JetBrains Mono 500) is unmeasured; do only with before/after Lighthouse and a visual check of the condensed hero type.

## 3. Social preview audit

Source: fetched all 18 sitemap URLs (`https://rating.watch/sitemap.xml`), parsed the raw HTML meta tags, then fetched each image URL.

### 3.1 Result

| Check | Result |
|---|---|
| og:image values | **1 unique URL for all 18 pages**: `https://rating.watch/opengraph-image?v=3` |
| twitter:image values | 1 unique URL for all 18 pages: `https://rating.watch/twitter-image?v=3` |
| Image HTTP | 200, `content-type: image/png`, 64,584 bytes, PNG header says 1200x630, `cache-control: public, immutable, no-transform, max-age=31536000` |
| og:image:width/height | 1200 / 630 declared on every page, matches the file |
| twitter:card | `summary_large_image` on all 18 |
| og:title | 18 of 18 unique, page-specific |
| og:description | 18 of 18 unique, page-specific |
| twitter:title / twitter:description | identical to og:title / meta description on all 18 |
| Duplicate-title/description risk | none |

The shared card (`lib/og.tsx` `renderOgImage`) reads "Know if it is worth watching before you press play." with generic "IMDb / RT" tags. So a shared link to the research study, the TV/phone guide or the blog hub always previews as the home-page ad. The text around it (title and description) is page-specific, which is why this is a medium rather than a high issue.

Not in scope of the sitemap: `/blog/[slug]` film articles already have per-film cards (`app/blog/[slug]/opengraph-image.tsx` + `twitter-image.tsx`, `renderFilmCard` in `app/blog/_components/og-card.tsx`) via `pageMetadata(path, { fileImages: true })`. There are currently no published articles (no `/blog/...` URL in the sitemap), so that path is untested live.

### 3.2 Pages where a page-specific image would help (ranked)

| Priority | Page | Why | Card idea (ASCII only) |
|---|---|---|---|
| 1 | `/research/imdb-vs-rotten-tomatoes-gap` | the most linkable/shareable page (data study); headline stat is the hook | "IMDb vs Rotten Tomatoes" + stat derived from `data/imdb-rt-gap.json` via `summarize()` (meanAbsGap, n, shareBigGap), not hard-coded |
| 2 | `/blog` | hub: the "Top 100 Netflix films" list | "Top 100 Netflix films" + "IMDb vs RT, scored side by side" |
| 3 | `/how-to/netflix-ratings-on-tv-and-phone` | newest guide, device question gets shared in forums | "IMDb ratings on Netflix: TV, phone, Safari" |
| 4 | `/how-to/show-imdb-ratings-on-netflix` | main how-to | "Show IMDb ratings on Netflix" |
| 5 | `/how-to/show-rotten-tomatoes-on-netflix` | second how-to | "Rotten Tomatoes on Netflix" |
| 6 | `/compare/imdb-vs-rotten-tomatoes` | explainer | "IMDb vs Rotten Tomatoes: which to trust" |
| 7 | `/compare/alternatives` | comparison table | "Netflix rating extensions compared" |
| 8 | `/how-to/find-what-to-watch-on-netflix`, `/how-to/netflix-ratings-explained`, `/camera-vision/ar` | guides | headline only |

Keep the generic card for `/`, `/install`, `/pricing`, `/about`, `/camera-vision`, and legal pages.

### 3.3 Feasibility against `tasks/lessons.md`

- "next/og can't fetch fonts offline, avoid non-ASCII glyphs": `lib/og.tsx` already bundles three fonts under `lib/fonts/` (`Archivo-ExtraCondensed-Black.ttf`, `JetBrainsMono-Bold.ttf`, `InstrumentSerif-Italic.ttf`) and reads them from disk, so rendering is offline-safe. The risk is glyph coverage. Registry titles contain `&` and the `·` suffix, and arrows exist in page copy, so cards must use a **separate ASCII-only headline field**, not `page.title`. Enforce with a unit test (`/^[\x20-\x7E]+$/`).
- "Page-level `openGraph` replaces the file-convention image": `pageMetadata()` in `lib/seo.ts` (line 46) already handles this with an explicit `images` array; per-page cards must therefore be wired through `pageMetadata`, not by dropping `opengraph-image.tsx` files in segments alone. Using segment files would need `fileImages: true` per page plus two files per segment (OG and twitter), about 16 files for 8 pages.
- Lowest-churn option (proposed): ONE route handler plus one config map, no per-page files.

### 3.4 Proposed patch (untested; Next 14.2.x)

1. New `lib/og-cards.ts` (pure data, ASCII-only, testable):

```ts
// Page-specific share cards. Keys are registry paths. ASCII only: the bundled OG fonts have no glyph fallback.
export interface OgCard { kicker: string; headline: string; sub?: string }
export const OG_CARDS: Record<string, OgCard> = {
  '/blog': { kicker: 'Rating Watch / Netflix films', headline: 'Top 100 Netflix films', sub: 'IMDb vs Rotten Tomatoes, side by side' },
  '/how-to/netflix-ratings-on-tv-and-phone': { kicker: 'Rating Watch / Guide', headline: 'IMDb ratings on Netflix: TV, phone, Safari' },
  '/how-to/show-imdb-ratings-on-netflix': { kicker: 'Rating Watch / Guide', headline: 'Show IMDb ratings on Netflix' },
  '/how-to/show-rotten-tomatoes-on-netflix': { kicker: 'Rating Watch / Guide', headline: 'Rotten Tomatoes on Netflix' },
  '/compare/imdb-vs-rotten-tomatoes': { kicker: 'Rating Watch / Compare', headline: 'IMDb vs Rotten Tomatoes: which to trust' },
  '/compare/alternatives': { kicker: 'Rating Watch / Compare', headline: 'Netflix rating extensions compared' },
  // '/research/imdb-vs-rotten-tomatoes-gap' is built in the route from data/imdb-rt-gap.json (summarize()), never hard-coded.
};
export const ogCardKey = (path: string): string => path.slice(1).replace(/\//g, '--');
```

2. `lib/og.tsx`: add `renderPageCard(card)` next to `renderOgImage` reusing PAPER/CARD/INK/SIGNAL, `loadFonts()` and the ticket frame; headline in Archivo 900 uppercase with a `fontSize` step-down for long strings (the film card does this with `cardText().titleSize`; reuse that idea, and make `OG_VERSION` apply to the new URLs too).

3. New `app/og/[key]/route.tsx`:

```tsx
import { renderPageCard } from '../../../lib/og';
import { OG_CARDS, ogCardKey } from '../../../lib/og-cards';
export const dynamic = 'force-static';
export const dynamicParams = false;
export const generateStaticParams = () =>
  [...Object.keys(OG_CARDS), '/research/imdb-vs-rotten-tomatoes-gap'].map((p) => ({ key: ogCardKey(p) }));
export async function GET(_: Request, { params }: { params: { key: string } }) {
  // research card: compute the stat from data/imdb-rt-gap.json with summarize(); others come from OG_CARDS
  ...
  return renderPageCard(card); // ImageResponse sets an immutable 1-year cache
}
```

4. `lib/seo.ts` `pageMetadata`: when `OG_CARDS[path]` (or the research path) exists, use `/og/${ogCardKey(path)}?v=${OG_VERSION}` for BOTH `openGraph.images` and `twitter.images`, else the current generic URLs. Existing blog-article `fileImages` behaviour stays.

5. Tests (`tests/lib/seo.test.ts` or a new `tests/lib/og-cards.test.ts`): every `OG_CARDS` key is a registered page path (`getPage` does not throw); every string is printable ASCII; `generateStaticParams` keys match `pageMetadata` image URLs; unlisted pages still use `/opengraph-image?v=...`.

Operational notes: the new image URLs are new, so no `OG_VERSION` bump is needed for them, but Facebook/LinkedIn/X cache per page URL, so re-scrape the 7 pages in the Sharing Debugger / Post Inspector after deploy. Build cost is 7 extra static PNGs. I could not confirm that an `ImageResponse` route handler prerenders under `output` settings in this repo without building, which this read-only task avoided; if it does not, fall back to segment `opengraph-image.tsx` files with `fileImages: true` (the blog-article pattern, proven in this repo).

## 4. Priority list

1. Fix CTA contrast (2.1): a real a11y defect on a conversion button, 2 lines of CSS, a11y 96 to 100 on the main how-to.
2. Page-specific OG cards for research, blog hub and the two newest guides (3.4): social CTR, no performance cost.
3. Play-button accessible name (2.2).
4. Everything in 2.3 and 2.4: only with field data showing a problem; lab is already 98 to 100.
