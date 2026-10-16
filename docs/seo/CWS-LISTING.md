# Chrome Web Store listing: ready to paste

Prepared 2026-10-15 from the extension source (`extension/manifest.json`, `content.js`, `background.js`). Everything below matches what the code does. Verify field names and category list in the live Developer Dashboard before submitting, since Google changes them.

Package to upload: `extension.zip` (repo root; rebuild with `bash scripts/package-extension.sh`). Version in manifest: 1.0.2.

## 1. Name (trademark-safe suggestion)

The store listing name is read from `manifest.json` `name` (max 75 characters). The current name, "Netflix Ratings", puts a third-party trademark first. Chrome Web Store review (Impersonation / Intellectual Property policy) tends to accept descriptive "for Netflix" wording and tends to reject names that read like an official Netflix product.

| Option | Why |
| --- | --- |
| **Ratings for Netflix: IMDb & Rotten Tomatoes** (recommended) | Trademarks appear only to describe compatibility ("for Netflix"), the primary keyword stays in the name, 44 characters |
| Ratings Badges for Netflix | Shorter, lowest rejection risk, loses the IMDb / Rotten Tomatoes keywords in the title |
| Netflix Ratings (current) | Matches the website and repo brand, highest trademark-rejection risk because "Netflix" leads the name |

**Applied 2026-10-16:** manifest `name` is now "Ratings for Netflix: IMDb & Rotten Tomatoes". (Earlier note, now superseded: changing the manifest `name` was not done.) If the store name differs from the site brand "Netflix Ratings", keep the on-page and repo wording "Netflix Ratings" and add the not-affiliated line (below) to the listing.

## 2. Short description (manifest `description`, 114 / 132 characters)

```
Shows IMDb and Rotten Tomatoes ratings on Netflix title cards as you browse. Free, open source, no account needed.
```

This text is already set in `extension/manifest.json`. The store uses it as the summary.

## 3. Detailed description

```
Ratings for Netflix shows IMDb and Rotten Tomatoes ratings directly on Netflix title cards, so you can decide what to watch without opening another tab.

WHAT YOU GET
- A small badge in the top-right corner of every title card on netflix.com
- The IMDb rating (out of 10) and the Rotten Tomatoes critic score (a percentage) side by side
- Ratings for new rows, search results and "More Like This" suggestions as they load
- Whichever score exists if a title has only one of the two; no badge if it has neither
- No account, no sign-in, no API key to enter

HOW IT WORKS
The extension reads the title from each card's accessible label on netflix.com. A background service worker looks each title up on the OMDb API, then the badge is drawn on the card. Results are cached in memory for the session, so each title is looked up once.

PRIVACY
- Only two site permissions: www.netflix.com (to show badges) and www.omdbapi.com (to fetch ratings)
- The only data that leaves your browser is the title name of each card, sent to OMDb to get its rating
- No analytics, no telemetry, no tracking, no backend server
- Does not read your Netflix account, watch history, cookies or session
- Privacy policy: https://netflix-ratings.app/privacy

FREE AND OPEN SOURCE
The full source code is on GitHub: https://github.com/gazivoda/netflix-imdb
Website and install help: https://netflix-ratings.app

TIPS
- Reload any open Netflix tab after installing
- Works on Netflix in Chromium browsers (Chrome, Edge, Brave)
- Ratings come from the OMDb database. Very new titles, or titles without critic reviews, may show only one score or none.

NOT AFFILIATED
This extension is an independent project. It is not affiliated with, endorsed by or sponsored by Netflix, Inc., IMDb or Rotten Tomatoes. Netflix, IMDb and Rotten Tomatoes are trademarks of their respective owners. Ratings data is provided by the OMDb API (omdbapi.com).
```

Replace the first line's name if you keep "Netflix Ratings" as the store name.

## 4. Category and language

- Category: **Entertainment** if offered in the dashboard; otherwise **Fun** (current dashboard category for media and viewing helpers) or **Tools**. Pick the closest available.
- Language: English.
- Official URL / website: https://netflix-ratings.app
- Support URL: https://github.com/gazivoda/netflix-imdb/issues
- Privacy policy URL: https://netflix-ratings.app/privacy

## 5. Screenshot shot-list (you capture these)

Dashboard accepts up to 5 screenshots, **1280x800** (preferred) or 640x400, PNG or JPEG, full-bleed, no device frame. Capture from your own real Netflix browsing with the extension loaded; do not mock up badges. Use a window of exactly 1280x800 (browser zoom 100%). Avoid showing profile name or avatar (crop or use a profile with a neutral name).

1. **Home browse rows.** Netflix home page showing several rows of title cards, each with an IMDb + Rotten Tomatoes badge in the top-right. This is the hero shot. Add a caption bar: "IMDb and Rotten Tomatoes on every Netflix title card".
2. **Close-up of badges.** Zoom the browser to about 150-200% on one row so the badge format (`⭐ score` and `🍅 percent`) is legible, then capture. Caption: "Both scores at a glance".
3. **Search results.** Search a genre or a title name and capture the results grid with badges. Caption: "Works in search results too".
4. **More Like This / title detail.** Open a title's detail modal and capture the "More Like This" cards with badges. Caption: "Rates suggestions as they load".
5. **Install or permissions view.** Either the `chrome://extensions` card for the extension with the two host permissions visible in Details, or the netflix-ratings.app/install page. Caption: "Open source, two permissions, no account".

Also needed by the dashboard:
- Store icon 128x128 (`extension/icon.png` is 128x128, but the file is only 307 bytes, so it is likely a plain placeholder; consider a proper icon before submitting).
- Small promo tile 440x280 (required).
- Marquee promo tile 1400x560 (optional).
- Optional: a short screen recording uploaded to YouTube and linked in the listing.

## 6. Single-purpose statement

```
Netflix Ratings has one purpose: to display IMDb and Rotten Tomatoes ratings as badges on Netflix title cards at www.netflix.com.
```

## 7. Permission justifications (Privacy practices tab)

The manifest has an empty `permissions` array and two host permissions.

- **Host permission `https://www.netflix.com/*`:** "Required to run the content script that reads the accessible label (title name) of each title card on Netflix and to draw the rating badge on that card. The extension does nothing on any other site."
- **Host permission `https://www.omdbapi.com/*`:** "Required for the background service worker to request the IMDb rating and Rotten Tomatoes score for a title from the OMDb API. Only the title name is sent."
- **Remote code:** **No, I am not using remote code.** All JavaScript is bundled in the package. The extension only fetches JSON data from OMDb and never evaluates it as code.
- No other permissions (tabs, storage, history, cookies, activeTab, scripting) are requested, so none need justification.

## 8. Data usage disclosures (Privacy practices tab)

Answer these from the code. Review each against your own judgement before certifying.

| Question | Answer | Basis |
| --- | --- | --- |
| Personally identifiable information | **No** | Not collected |
| Health information | **No** | Not collected |
| Financial and payment information | **No** | Not collected |
| Authentication information | **No** | Extension never reads cookies, tokens or credentials |
| Personal communications | **No** | Not collected |
| Location | **No** | Not collected |
| Web history | **No** | Does not read browsing history or URLs |
| User activity (clicks, keystrokes, mouse) | **No** | Only observes DOM changes to find new cards |
| Website content | **Yes, transmitted, not stored by the developer** | The title name of each Netflix card (text of its aria-label) is sent to OMDb to fetch its rating. This is the only data that leaves the browser. |

Certifications to tick (all true per the source):
- I do not sell or transfer user data to third parties, outside of the approved use cases. (The only transfer is the title name to OMDb, which is the extension's core function.)
- I do not use or transfer user data for purposes unrelated to the item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

Privacy policy URL: https://netflix-ratings.app/privacy

Caution: the privacy page was last dated May 4, 2025 and describes IMDb ratings only. Update it to mention Rotten Tomatoes and refresh the date before submitting, so the policy matches the listing.

## 9. Pre-submission checklist

- [ ] OMDb API key in `extension/background.js` is hardcoded (see report). Decide before publishing: a shared key in a public store package can be scraped and rate-limited or revoked.
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
