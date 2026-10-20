# Chrome Web Store listing: ready to paste

Prepared 2026-10-15 from the extension source (`extension/manifest.json`, `content.js`, `background.js`). Everything below matches what the code does. Verify field names and category list in the live Developer Dashboard before submitting, since Google changes them.

Package to upload: `extension.zip` (repo root; rebuild with `bash scripts/package-extension.sh`). Version in manifest: 1.2.1. The same file is served to site visitors at `https://rating.watch/downloads/rating-watch-extension.zip` (the packaging script refreshes both).

## 1. Name (trademark-safe suggestion)

The store listing name is read from `manifest.json` `name` (max 75 characters). The current name, "Rating Watch", puts a third-party trademark first. Chrome Web Store review (Impersonation / Intellectual Property policy) tends to accept descriptive "for Netflix" wording and tends to reject names that read like an official Netflix product.

| Option | Why |
| --- | --- |
| **Rating Watch: IMDb & Rotten Tomatoes for Netflix** (recommended) | Trademarks appear only to describe compatibility ("for Netflix"), the primary keyword stays in the name, 44 characters |
| Ratings Badges for Netflix | Shorter, lowest rejection risk, loses the IMDb / Rotten Tomatoes keywords in the title |
| Rating Watch (current) | Matches the website and repo brand, highest trademark-rejection risk because "Netflix" leads the name |

**Applied 2026-10-16:** manifest `name` is now "Rating Watch: IMDb & Rotten Tomatoes for Netflix". (Earlier note, now superseded: changing the manifest `name` was not done.) If the store name differs from the site brand "Rating Watch", keep the on-page and repo wording "Rating Watch" and add the not-affiliated line (below) to the listing.

## 2. Short description (manifest `description`, 101 / 132 characters)

```
Shows IMDb and Rotten Tomatoes ratings on Netflix title cards as you browse. Free, no account needed.
```

This text is already set in `extension/manifest.json`. The store uses it as the summary.

## 3. Detailed description

```
Rating Watch shows IMDb and Rotten Tomatoes ratings directly on Netflix title cards, so you can decide what to watch without opening another tab.

WHAT YOU GET
- A small badge in the top-right corner of every title card on netflix.com
- The IMDb rating (out of 10) and the Rotten Tomatoes critic score (a percentage) side by side
- Ratings for new rows, search results and "More Like This" suggestions as they load
- Whichever score exists if a title has only one of the two; no badge if it has neither
- No account, no sign-in, and no API key required (an optional personal OMDb key removes the shared daily limit)

HOW IT WORKS
The extension reads the title from each card's accessible label on netflix.com (and from the hover pop-up artwork). A background service worker looks each title up on the OMDb API, then the badge is drawn. Results are remembered on your device for a week, so each title is looked up about once a week. The shared lookup limit is 1,000 a day; if it runs out, click the toolbar icon to add your own free OMDb key.

PRIVACY
- Only two site permissions: www.netflix.com (to show badges) and www.omdbapi.com (to fetch ratings)
- The only data that leaves your browser is the title name of each card, sent to OMDb to get its rating
- No analytics, no telemetry, no tracking, no backend server
- Does not read your Netflix account, watch history, cookies or session
- Privacy policy: https://rating.watch/privacy

FREE, NO ACCOUNT
The extension is free and needs no account or API key.
Website and install help: https://rating.watch

TIPS
- Reload any open Netflix tab after installing
- Works on Netflix in Chromium browsers (Chrome, Edge, Brave)
- Ratings come from the OMDb database. Very new titles, or titles without critic reviews, may show only one score or none.

NOT AFFILIATED
This extension is an independent project. It is not affiliated with, endorsed by or sponsored by Netflix, Inc., IMDb or Rotten Tomatoes. Netflix, IMDb and Rotten Tomatoes are trademarks of their respective owners. Ratings data is provided by the OMDb API (omdbapi.com).
```

Replace the first line's name if you keep "Rating Watch" as the store name.

## 4. Category and language

- Category: **Entertainment** if offered in the dashboard; otherwise **Fun** (current dashboard category for media and viewing helpers) or **Tools**. Pick the closest available.
- Language: English.
- Official URL / website: https://rating.watch
- Support URL: https://rating.watch/about (support email: hello@rating.watch)
- Privacy policy URL: https://rating.watch/privacy

## 5. Screenshot shot-list (you capture these)

Dashboard accepts up to 5 screenshots, **1280x800** (preferred) or 640x400, PNG or JPEG, full-bleed, no device frame. Capture from your own real Netflix browsing with the extension loaded; do not mock up badges. Use a window of exactly 1280x800 (browser zoom 100%). Avoid showing profile name or avatar (crop or use a profile with a neutral name).

1. **Home browse rows.** Netflix home page showing several rows of title cards, each with an IMDb + Rotten Tomatoes badge in the top-right. This is the hero shot. Add a caption bar: "IMDb and Rotten Tomatoes on every Netflix title card".
2. **Close-up of badges.** Zoom the browser to about 150-200% on one row so the badge format (`⭐ score` and `🍅 percent`) is legible, then capture. Caption: "Both scores at a glance".
3. **Search results.** Search a genre or a title name and capture the results grid with badges. Caption: "Works in search results too".
4. **More Like This / title detail.** Open a title's detail modal and capture the "More Like This" cards with badges. Caption: "Rates suggestions as they load".
5. **Install or permissions view.** Either the `chrome://extensions` card for the extension with the two host permissions visible in Details, or the rating.watch/install page. Caption: "Two permissions, no account".

Also needed by the dashboard:
- Store icon 128x128 (`extension/icon.png` is 128x128, but the file is only 307 bytes, so it is likely a plain placeholder; consider a proper icon before submitting).
- Small promo tile 440x280 (required).
- Marquee promo tile 1400x560 (optional).
- Optional: a short screen recording uploaded to YouTube and linked in the listing.

## 6. Single-purpose statement

```
Rating Watch has one purpose: to display IMDb and Rotten Tomatoes ratings as badges on Netflix title cards at www.netflix.com.
```

## 7. Permission justifications (Privacy practices tab)

The manifest has an empty `permissions` array and two host permissions.

- **Host permission `https://www.netflix.com/*`:** "Required to run the content script that reads the accessible label (title name) of each title card on Netflix and to draw the rating badge on that card. The extension does nothing on any other site."
- **Host permission `https://www.omdbapi.com/*`:** "Required for the background service worker to request the IMDb rating and Rotten Tomatoes score for a title from the OMDb API. Only the title name is sent."
- **Remote code:** **No, I am not using remote code.** All JavaScript is bundled in the package. The extension only fetches JSON data from OMDb and never evaluates it as code.
- No other permissions (tabs, storage, history, cookies, activeTab, scripting) are requested, so none need justification. Ratings and the optional OMDb key are stored in the extension's own IndexedDB, which needs no permission.

## 8. Data usage disclosures (Privacy practices tab)

Answer these from the code. Review each against your own judgement before certifying.

| Question | Answer | Basis |
| --- | --- | --- |
| Personally identifiable information | **No** | Not collected |
| Health information | **No** | Not collected |
| Financial and payment information | **No** | Not collected |
| Personal communications | **No** | Not collected |
| Location | **No** | Not collected |
| Web history | **No** | Does not read browsing history or URLs |
| User activity (clicks, keystrokes, mouse) | **No** | Only observes DOM changes to find new cards |
| Authentication information | **Yes (optional)** | Only if the user adds their own OMDb API key on the settings page: stored locally, sent only to omdbapi.com. Tick this to be safe, with that explanation. |
| Website content | **Yes, transmitted, not stored by the developer** | The title name of each Netflix card (text of its aria-label) is sent to OMDb to fetch its rating. This is the only data that leaves the browser. |

Certifications to tick (all true per the source):
- I do not sell or transfer user data to third parties, outside of the approved use cases. (The only transfer is the title name to OMDb, which is the extension's core function.)
- I do not use or transfer user data for purposes unrelated to the item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

Privacy policy URL: https://rating.watch/privacy

Caution: the privacy page was last dated May 4, 2025 and describes IMDb ratings only. Update it to mention Rotten Tomatoes and refresh the date before submitting, so the policy matches the listing.

## 9. Pre-submission checklist

- [x] Shared-key quota: v1.1.0 adds a persistent local cache and an options page for a personal OMDb key (the shared key was already exhausted during testing on 2026-10-16).
- [ ] Final store name chosen and, if changed, `manifest.json` `name` updated and `extension.zip` rebuilt.
- [ ] 5 screenshots captured at 1280x800, small promo tile 440x280 made.
- [ ] Icon reviewed (128x128).
- [ ] Privacy policy updated for Rotten Tomatoes and dated.
- [ ] Chrome Web Store developer account registered (one-time registration fee applies).
- [ ] After approval, add the store link to the README, `/install` page and `public/llms.txt`.

## 10. Status 2026-10-16 (submission-ready package)

- [x] Name changed in manifest; `extension.zip` rebuilt (8 files, ~17 KB).
- [x] Real icons (16/32/48/128, star on gold ticket, deliberately not an "N") via `scripts/make-store-assets.py`; 128x128 store icon copy in `docs/store/icon-128.png` (the dashboard requires exactly 128x128).
- [x] Small promo tile 440x280: `docs/store/promo-tile-440x280.png`.
- [x] Privacy policy now covers Rotten Tomatoes and is dated October 16, 2026.
- [ ] Screenshots (must be real, you capture) and developer account + one-time registration fee (you).
- [ ] OMDb shared key decision (see section 9).
