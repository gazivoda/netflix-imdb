# Netflix IMDB Rating Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension that overlays IMDB ratings on Netflix title cards by calling api.imdbapi.dev directly from a content script.

**Architecture:** Plain JavaScript content script — no build step. `content.js` handles DOM scanning, API calls, badge injection, and MutationObserver. `manifest.json` grants host permissions for both netflix.com and api.imdbapi.dev.

**Tech Stack:** Vanilla JavaScript, Chrome Extension Manifest V3, CSS

---

## File Map

| File | Purpose |
|------|---------|
| `extension/manifest.json` | MV3 manifest — declares content script, host permissions, icon |
| `extension/content.js` | All logic: scan tiles, fetch ratings, inject badges, observe DOM |
| `extension/content.css` | Badge styles — dark pill, top-right, absolute position |
| `extension/icon.png` | 128×128 PNG icon (required by Chrome) |

---

## Task 1: Scaffold — manifest and icon

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/icon.png`

- [ ] **Step 1: Create `extension/manifest.json`**

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

- [ ] **Step 2: Generate `extension/icon.png`**

Run this Python one-liner to create a solid 128×128 orange PNG (no external deps):

```bash
python3 -c "
import struct, zlib

def make_png(w, h, r, g, b):
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    raw = b''.join(b'\x00' + bytes([r, g, b] * w) for _ in range(h))
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw))
            + chunk(b'IEND', b''))

with open('extension/icon.png', 'wb') as f:
    f.write(make_png(128, 128, 229, 160, 13))
"
```

Expected: `extension/icon.png` created (~400 bytes).

- [ ] **Step 3: Verify files exist**

```bash
ls -lh extension/
```

Expected: `manifest.json` and `icon.png` both present.

- [ ] **Step 4: Commit**

```bash
git add extension/manifest.json extension/icon.png
git commit -m "feat: add Chrome extension manifest and icon"
```

---

## Task 2: Badge styles

**Files:**
- Create: `extension/content.css`

- [ ] **Step 1: Create `extension/content.css`**

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
  z-index: 9999;
  pointer-events: none;
  font-family: Arial, sans-serif;
  white-space: nowrap;
  line-height: 1.4;
}
```

- [ ] **Step 2: Commit**

```bash
git add extension/content.css
git commit -m "feat: add IMDB badge styles"
```

---

## Task 3: Content script

**Files:**
- Create: `extension/content.js`

- [ ] **Step 1: Create `extension/content.js`**

```javascript
(function () {
  'use strict';

  const IMDB_API = 'https://api.imdbapi.dev';
  const RATED_ATTR = 'data-imdb-rated';
  let debounceTimer = null;

  function getUnratedAnchors() {
    return Array.from(
      document.querySelectorAll(`.title-card a[aria-label]:not([${RATED_ATTR}])`)
    );
  }

  function injectPlaceholder(anchor) {
    anchor.setAttribute(RATED_ATTR, 'true');
    const boxart = anchor.querySelector('.boxart-container');
    if (!boxart) return null;
    const badge = document.createElement('div');
    badge.className = 'imdb-badge';
    badge.textContent = '⭐ …';
    boxart.style.position = 'relative';
    boxart.appendChild(badge);
    return badge;
  }

  async function fetchRating(title) {
    try {
      const res = await fetch(
        `${IMDB_API}/search/titles?query=${encodeURIComponent(title)}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.titles?.[0]?.rating?.aggregateRating ?? null;
    } catch {
      return null;
    }
  }

  async function scanAndRate() {
    const anchors = getUnratedAnchors();
    if (!anchors.length) return;

    const entries = anchors
      .map((anchor) => ({
        title: anchor.getAttribute('aria-label'),
        badge: injectPlaceholder(anchor),
      }))
      .filter((e) => e.badge !== null);

    await Promise.allSettled(
      entries.map(async ({ title, badge }) => {
        const rating = await fetchRating(title);
        if (rating !== null) {
          badge.textContent = `⭐ ${rating}`;
        } else {
          badge.remove();
        }
      })
    );
  }

  function debouncedScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanAndRate, 300);
  }

  scanAndRate();

  new MutationObserver(debouncedScan).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
```

- [ ] **Step 2: Commit**

```bash
git add extension/content.js
git commit -m "feat: add content script with rating injection and MutationObserver"
```

---

## Task 4: Load in Chrome and verify

No automated tests — manual verification in Chrome.

- [ ] **Step 1: Open Chrome extension manager**

Navigate to `chrome://extensions` in Chrome.

- [ ] **Step 2: Enable Developer mode**

Toggle "Developer mode" on (top-right of the page).

- [ ] **Step 3: Load the extension**

Click "Load unpacked" → select the `extension/` folder at `/Users/igorgazivoda/netflix-imdb/extension`.

Expected: Extension appears in the list as "Netflix IMDB Ratings" with no errors.

- [ ] **Step 4: Open Netflix and verify badges appear**

Navigate to `https://www.netflix.com`. Scroll through the home screen.

Expected:
- Each title card shows `⭐ <number>` in the top-right corner of the artwork
- Cards with no IMDB match show no badge (clean tile)
- As you scroll and new cards render, badges appear on those too within ~1 second

- [ ] **Step 5: Verify MutationObserver works**

Scroll down several rows, then scroll back up. Cards that were already rated should still show their badges (they have `data-imdb-rated` set).

Scroll to a new row that hasn't loaded yet — badges should appear within ~1 second after the cards render.

- [ ] **Step 6: Check for errors**

Open DevTools (F12) on Netflix → Console tab. There should be no errors from the extension.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: verify extension works end-to-end on Netflix"
```
