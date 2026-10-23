# Performance and visual evidence — 2026-10-23

Captured with a dedicated `agent-browser --session seo-audit-visual` Chromium session. No camera permission was granted and no analytics consent was accepted. Product source was not changed for this review.

## Targets and viewports

- `live-desktop.png`: https://rating.watch/ at 1440 × 1000, full page.
- `live-mobile.png`: live homepage at 390 × 844, full page.
- `live-install-mobile.png`, `live-compare-mobile.png`, `live-research-mobile.png`: live `/install`, `/compare/imdb-vs-rotten-tomatoes`, `/research/imdb-vs-rotten-tomatoes-gap` at 390 × 844, full page.
- `live-home-320.png`: live homepage at 320 × 740, viewport capture.
- `live-pricing-320.png`: live `/pricing` at 320 × 740, full page. Live `/compare/alternatives` was also inspected at this width.
- `local-desktop-before.png`, `local-mobile-before.png`: production build served at http://127.0.0.1:3214/ at 1440 × 1000 and 390 × 844, full page. These precede the audit fixes.
- `local-camera-mobile-before.png`, `local-ar-mobile-before.png`: local production `/camera-vision` and `/camera-vision/ar` at 390 × 844, full page, camera inactive. They include the existing uncommitted camera work and are evidence of this working tree, not of the final committed snapshot.
- `local-desktop-after.png`, `local-mobile-after.png`: clean release snapshot after the audit fixes, built with Node 22 and served at http://127.0.0.1:3216/ at 1440 × 1000 and 390 × 844, full page. This snapshot exports the intended commit source and excludes all pre-existing uncommitted code. It includes the final corrected promo caption, which limits scores to titles where they are available and matched.

The live deployment and local working tree differ; captures of one do not verify the other. Cookie banners are visible because the session has not accepted or declined analytics.

## Lab samples and limits

Single unthrottled Chromium navigations with a warm browser cache; no CPU throttling, mobile network emulation, or Lighthouse run. Values were read using buffered `PerformanceObserver` entries and the Navigation Timing API after navigation. They are diagnostics, not representative user experience or a field Core Web Vitals assessment.

| Target | Viewport | TTFB | FCP | LCP | LCP element | Layout shifts |
| --- | --- | --- | --- | --- | --- | --- |
| Live homepage | 390 × 844 | 34.6 ms | 84 ms | 84 ms | H1 | No buffered entries in sample |
| Local homepage before fixes | 390 × 844 | 7.4 ms | 60 ms | 60 ms | H1 | No buffered entries in sample |

An earlier live desktop sample gave FCP/LCP 172 ms; its later viewport resize generated a layout-shift entry with `hadRecentInput: true`, so that entry is not presented as a page-load CLS failure. No interaction latency sample sufficient to assess INP was collected. Field LCP/INP/CLS and their 75th percentiles remain unverified. No numeric Lighthouse performance score is available.

Google PageSpeed Insights mobile API was requested for the live homepage. The API answered HTTP 429 `RESOURCE_EXHAUSTED` (daily query quota), returning neither Lighthouse results nor CrUX loading experience. This is a measurement limitation, not a website defect. `agent-browser vitals` returned only `Done`, so no results from that command are claimed.

## Confirmed checks

- Live homepage, install, comparison and research pages at 390 px: document scroll width equals viewport width. Comparison/research tables scroll within labeled regions rather than widening the document.
- Live homepage, pricing and alternatives pages at 320 px: document scroll width remains 320 px. The animated homepage marquee intentionally clips overflowing children within its container.
- Local homepage, camera and AR at 390 px: document scroll width remains 390 px; each has one H1. Camera streams remain inactive until the visitor starts the camera.
- Final clean-release homepage smoke check: document scroll width equals 1440 px on desktop and 390 px on mobile, with one H1 in both captures. The corrected availability wording is present in the promo caption at both widths. The earlier integrated-build smoke check also confirmed MP4 and analytics request counts remain zero before play/consent. No additional timing claim is made for the final smoke check.
- Both homepage logo images intentionally have empty decorative alt text and explicit 30 × 30 dimensions. Guide logo has explicit dimensions. The hero illustration is CSS/HTML with an accessible image description rather than an oversized bitmap.
- The promo poster is WebP, 37,364 bytes. The 4,614,970-byte MP4 uses `preload="none"`; browser resource entries confirm zero MP4 requests before play. The video frame reserves a 16:9 aspect ratio.
- Browser resource entries show zero Google Analytics/Tag Manager requests before consent. The homepage DOM contains 574 elements in the inspected live document.
- No critical visual or image issue was confirmed. No source changes were introduced merely to increase an audit score.

## Reproduce

Use `agent-browser --session seo-audit-visual set viewport 390 844`, open the target, and capture with `screenshot --full <path>`. Inspect `document.documentElement.scrollWidth`, `document.images`, resource timing entries, and buffered `largest-contentful-paint`, `paint`, and `layout-shift` observers. Repeat on the deployed commit and use authenticated PageSpeed Insights/Search Console or CrUX when quota and field data are available.
