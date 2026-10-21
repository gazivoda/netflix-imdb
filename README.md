# Rating Watch

**Rating Watch is a free Chrome extension that shows IMDb and Rotten Tomatoes ratings on Netflix title cards.**

It adds a small badge to the top-right corner of title cards on netflix.com, so you can see the IMDb score (out of 10) and, where OMDb has one, the Rotten Tomatoes critic score (a percentage, mostly for films, not TV series) without opening another tab. The extension needs no account and has no analytics; this website measures visits only if you accept analytics in its cookie banner. It works out of the box on a shared OMDb lookup allowance that can run out on a busy day; an optional free personal OMDb key in the extension options lifts it.

Website: [rating.watch](https://rating.watch) · [Install guide](https://rating.watch/install) · [Privacy policy](https://rating.watch/privacy) · [IMDb vs Rotten Tomatoes](https://rating.watch/compare/imdb-vs-rotten-tomatoes)

## What it does

- Shows the IMDb rating (shown as `⭐ <score>`) and the Rotten Tomatoes score (shown as `🍅 <percent>%`) in a badge on each Netflix title card.
- Rates new rows, search results and "More Like This" suggestions automatically as Netflix loads them.
- Shows whichever score is available if a title has only one of the two, and no badge if it has neither.
- The extension needs no account or sign-in. It uses a shared OMDb lookup allowance (1,000 requests a day across all users), so ratings can pause on a busy day and the toolbar icon shows a red exclamation mark; an optional free personal OMDb key in the extension options lifts the limit.
- Works on Chromium browsers (Chrome, Edge, Brave). It is a Manifest V3 extension and has not been tested in Firefox or Safari.

## Install

Rating Watch is not on the Chrome Web Store yet, so it installs as an unpacked extension. This takes about a minute and is the same procedure as the [install guide](https://rating.watch/install).

1. **Download the extension.** Download the zip from [rating.watch/downloads/rating-watch-extension.zip](https://rating.watch/downloads/rating-watch-extension.zip).
2. **Unzip it to a folder you will keep.** Chrome loads the extension from that folder, so moving or deleting it later disables the extension.
3. **Open the extensions page and turn on Developer mode.** Go to `chrome://extensions` (`edge://extensions` in Edge, `brave://extensions` in Brave) and switch on Developer mode in the top-right corner.
4. **Click Load unpacked and choose the unzipped folder.** Select the folder that contains `manifest.json`.
5. **Open Netflix.** Visit netflix.com and browse. Reload the Netflix tab if you already had it open.

To update, replace the folder contents with the latest download and click the reload icon on the extension card at `chrome://extensions`. To uninstall, click Remove on the same card.

## How it works

The extension has two parts, both in [`extension/`](extension):

1. **Content script** ([`content.js`](extension/content.js), [`content.css`](extension/content.css)) runs on `https://www.netflix.com/*`. It finds title-card links that carry an `aria-label` and an image, cleans the label into a title (stripping suffixes such as "Season 2", ": More Info" and country codes like "(U.S.)"), and watches the page with a `MutationObserver` so new cards are picked up as you scroll. The badge is drawn with CSS from a data attribute on the card link.
2. **Background service worker** ([`background.js`](extension/background.js)) receives title requests from the content script over a port, looks the title up on the [OMDb API](https://www.omdbapi.com), and returns the IMDb rating and Rotten Tomatoes score. If the first lookup returns no Rotten Tomatoes score, it runs one title search and re-checks the newest exact-title match, which helps when several titles share a name. Results are cached in the extension's own IndexedDB (7 days; 1 day when OMDb has no score yet), so each title is looked up about once a week. The shared default key is limited to 1,000 lookups a day; when it runs out the toolbar icon shows a red "!" and the [options page](extension/options.html) lets you add your own free key. The Netflix hover pop-up and detail modal get a badge too.

## Privacy

- Requests only two host permissions: `https://www.netflix.com/*` (to read title cards and show badges) and `https://www.omdbapi.com/*` (to look up ratings). The manifest declares no other permissions, so it does not request tabs, history or storage access.
- The only data the extension sends out of your browser is the title name of each card, plus the OMDb key (shared or your own), sent to OMDb to fetch its rating. OMDb also sees your IP address.
- The extension has no account, no analytics, no telemetry and runs no backend server. The website offers an optional Pro AR mode with sign-in; see /pricing. Looked-up ratings are cached locally in the extension's own IndexedDB for up to 7 days (1 day when OMDb has no score yet); nothing is synced or sent anywhere. An optional OMDb key you add on the settings page is stored the same way.

Full details: [rating.watch/privacy](https://rating.watch/privacy).

## Repo layout

| Path | What it is |
| --- | --- |
| [`extension/`](extension) | The Chrome extension itself (Manifest V3): manifest, content script, background worker, icons |
| [`app/`](app) | The [rating.watch](https://rating.watch) website (Next.js App Router): home, `/install`, `/compare`, `/privacy`, plus an experimental camera demo and a ratings API route |
| [`lib/`](lib) | Shared site code: page registry, SEO/JSON-LD helpers, OMDb client, content constants |
| [`components/`](components) | Shared React components for the site |
| [`tests/`](tests) | Jest tests for the OMDb client, title extraction, ratings API and SEO helpers |
| [`scripts/`](scripts) | `package-extension.sh` (builds `extension.zip` and refreshes the site download) and the IndexNow ping script |
| `extension.zip` | Prebuilt package of `extension/`; `scripts/package-extension.sh` also copies it to `public/downloads/rating-watch-extension.zip`, the file the install guide links to |

## Development

Requires Node.js and npm.

```bash
npm install
npm run dev     # run the website locally with Next.js
npm test        # run the Jest test suite
npm run build   # production build of the website
```

The website's server-side OMDb lookups read an `OMDB_API_KEY` environment variable. To load the extension from source, follow the [Install](#install) steps and select the `extension` folder. To rebuild `extension.zip` (and the site download) after changing the extension, run:

```bash
bash scripts/package-extension.sh
npm run zip:check   # verifies extension.zip and the site download match extension/
```

## Not affiliated

Rating Watch is an independent project. It is not affiliated with, endorsed by or sponsored by Netflix, Inc., IMDb or Rotten Tomatoes. Netflix, IMDb and Rotten Tomatoes are trademarks of their respective owners and are used here only to describe what the extension does.

## Licence

Copyright (c) 2026 Rating Watch. All rights reserved. This repository is published so you can read it; it is not licensed for reuse, and no permissive or community licence applies. The browser extension is distributed free of charge for personal use through [rating.watch](https://rating.watch) and the Chrome Web Store. Copying, redistributing, modifying or reselling it, or any other part of this repository, requires written permission. See [`LICENSE`](LICENSE).

OMDb data, Netflix Top 10 data, and the Netflix, IMDb and Rotten Tomatoes names and marks are not covered by this licence and remain subject to their owners' terms.

## Credits

- Ratings data comes from the [OMDb API](https://www.omdbapi.com).
- Created by [Igor Gazivoda](https://rating.watch/about).

## Ratings cache (website API)

`POST /api/ratings` (used by the camera demo) keeps looked-up ratings in a small JSON file so the same title is not fetched from OMDb twice. A rating is reused for 7 days; a title OMDb does not know is retried after 1 day; failed lookups (network error, daily limit reached) are never stored, and a stale rating is served if OMDb is down.

- **Location:** `RATINGS_DB_PATH` (default `.data/ratings.json`, git-ignored). On a server, point it at a persistent volume, otherwise the cache is lost on every redeploy.
- **Single process only:** the file is read once and written atomically by one Node process. Do not run several workers against the same file.
- The Chrome extension does not use this cache; it queries OMDb directly and caches in its own IndexedDB.
