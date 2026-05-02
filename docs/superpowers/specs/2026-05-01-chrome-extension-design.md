# Netflix IMDB Rating Chrome Extension — Design Spec

**Date:** 2026-05-01  
**Status:** Approved

---

## Overview

A Chrome extension (Manifest V3) that runs on netflix.com, extracts title names from visible tiles, fetches IMDB ratings directly from `api.imdbapi.dev`, and overlays a small rating badge on each tile. A `MutationObserver` keeps badges in sync as Netflix renders new tiles during scrolling.

---

## Architecture

Lives in `extension/` inside the existing repo. No build step — plain JavaScript loaded directly by Chrome.

```
extension/
  manifest.json    — MV3 manifest: content script declaration, host permissions
  content.js       — All logic: scan, fetch, badge inject, MutationObserver
  content.css      — Badge styles (positioned absolute, dark pill)
  icon.png         — 128×128 PNG icon (required by Chrome)
```

The Next.js app and extension are siblings in the same repo and fully independent.

---

## DOM Strategy

**Title extraction:** Query all `a[aria-label]` elements inside `.title-card` containers. The `aria-label` value is the movie/series title (e.g. `"Bridgerton"`).

**Duplicate prevention:** Each processed tile is marked with `data-imdb-rated="true"` immediately on first scan. All subsequent scans and observer callbacks skip elements that already have this attribute.

**Badge HTML:**
```html
<div class="imdb-badge">⭐ 8.8</div>
```
Injected as a direct child of `.boxart-container`. While fetching, shows `⭐ …` as a loading placeholder. On failure or no rating found, the placeholder is removed and the tile is left clean.

**Badge CSS:** Absolute positioning, top-right corner, dark semi-transparent pill, white text, small font, `z-index` high enough to sit above Netflix's artwork.

---

## MutationObserver

- Observes `document.body` with `{ childList: true, subtree: true }`
- Callback is debounced 300ms to avoid thrashing during Netflix's rapid DOM updates
- On fire: re-runs the same scan function (already-rated tiles are skipped cheaply via `data-imdb-rated`)
- Observer is started once on script load

---

## API

**Endpoint:** `GET https://api.imdbapi.dev/search/titles?query=<encodeURIComponent(title)>`

**Result mapping:** Take `titles[0]` from the response:
- If present and has `rating.aggregateRating`: display `⭐ <rating>`
- If empty or no rating: remove placeholder, leave tile clean

**Parallelism:** All titles collected in a scan pass fire simultaneously via `Promise.allSettled`. Individual failures are silent — no console noise, no broken UI.

**No retry logic.** Failed tiles stay unrated. The observer re-triggers if Netflix re-renders them.

---

## Manifest

```json
{
  "manifest_version": 3,
  "name": "Netflix IMDB Ratings",
  "version": "1.0",
  "description": "Shows IMDB ratings on Netflix title cards",
  "permissions": [],
  "host_permissions": [
    "https://www.netflix.com/*",
    "https://api.imdbapi.dev/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://www.netflix.com/*"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "128": "icon.png"
  }
}
```

---

## Badge Styles

```css
.imdb-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  z-index: 100;
  pointer-events: none;
  font-family: Arial, sans-serif;
  white-space: nowrap;
}
```

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Fetch fails (network error) | Remove placeholder, tile stays clean |
| API returns non-ok status | Remove placeholder, tile stays clean |
| `titles` array is empty | Remove placeholder, tile stays clean |
| Title has no `rating` field | Remove placeholder, tile stays clean |
| Title already rated | Skip (via `data-imdb-rated`) |

---

## Out of Scope

- Options/settings UI
- Caching ratings across page loads
- Background service worker
- Support for non-English Netflix regions
