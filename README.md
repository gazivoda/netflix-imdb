# Netflix Ratings

**Netflix Ratings is a free, open-source Chrome extension that shows IMDb and Rotten Tomatoes ratings on Netflix title cards.**

It adds a small badge to the top-right corner of every title card on netflix.com, so you can see the IMDb score (out of 10) and the Rotten Tomatoes critic score (a percentage) without opening another tab. No account, no API key, no tracking.

Website: [netflix-ratings.app](https://netflix-ratings.app) · [Install guide](https://netflix-ratings.app/install) · [Privacy policy](https://netflix-ratings.app/privacy) · [IMDb vs Rotten Tomatoes](https://netflix-ratings.app/compare/imdb-vs-rotten-tomatoes)

## What it does

- Shows the IMDb rating (shown as `⭐ <score>`) and the Rotten Tomatoes score (shown as `🍅 <percent>%`) in a badge on each Netflix title card.
- Rates new rows, search results and "More Like This" suggestions automatically as Netflix loads them.
- Shows whichever score is available if a title has only one of the two, and no badge if it has neither.
- Needs no account, no sign-in and no API key from you (an optional personal OMDb key lifts the shared daily limit).
- Works on Chromium browsers (Chrome, Edge, Brave). It is a Manifest V3 extension and has not been tested in Firefox or Safari.

## Install

Netflix Ratings is not on the Chrome Web Store yet, so it installs as an unpacked extension. This takes about a minute and is the same procedure as the [install guide](https://netflix-ratings.app/install).

1. **Download the extension.** Download [`extension.zip`](https://github.com/gazivoda/netflix-imdb/raw/main/extension.zip) from this repository, or clone the repository and use its `extension` folder.
2. **Unzip it to a folder you will keep.** Chrome loads the extension from that folder, so moving or deleting it later disables the extension.
3. **Open the extensions page and turn on Developer mode.** Go to `chrome://extensions` (`edge://extensions` in Edge, `brave://extensions` in Brave) and switch on Developer mode in the top-right corner.
4. **Click Load unpacked and choose the folder.** Select the folder that contains `manifest.json`.
5. **Open Netflix.** Visit netflix.com and browse. Reload the Netflix tab if you already had it open.

To update, replace the folder contents with the latest download and click the reload icon on the extension card at `chrome://extensions`. To uninstall, click Remove on the same card.

## How it works

The extension has two parts, both in [`extension/`](extension):

1. **Content script** ([`content.js`](extension/content.js), [`content.css`](extension/content.css)) runs on `https://www.netflix.com/*`. It finds title-card links that carry an `aria-label` and an image, cleans the label into a title (stripping suffixes such as "Season 2", ": More Info" and country codes like "(U.S.)"), and watches the page with a `MutationObserver` so new cards are picked up as you scroll. The badge is drawn with CSS from a data attribute on the card link.
2. **Background service worker** ([`background.js`](extension/background.js)) receives title requests from the content script over a port, looks the title up on the [OMDb API](https://www.omdbapi.com), and returns the IMDb rating and Rotten Tomatoes score. If the first lookup returns no Rotten Tomatoes score, it runs one title search and re-checks the newest exact-title match, which helps when several titles share a name. Results are cached in the extension's own IndexedDB (7 days; 1 day when OMDb has no score yet), so each title is looked up about once a week. The shared default key is limited to 1,000 lookups a day; when it runs out the toolbar icon shows a red "!" and the [options page](extension/options.html) lets you add your own free key. The Netflix hover pop-up and detail modal get a badge too.

## Privacy

- Requests only two host permissions: `https://www.netflix.com/*` (to read title cards and show badges) and `https://www.omdbapi.com/*` (to look up ratings). The manifest declares no other permissions, so it does not request tabs, history or storage access.
- The only data that leaves your browser is the title name of each card, sent to OMDb to fetch its rating.
- No account, no analytics, no telemetry, and no backend server. Looked-up ratings are cached locally in the extension's own IndexedDB for up to 7 days (1 day when OMDb has no score yet); nothing is synced or sent anywhere. An optional OMDb key you add on the settings page is stored the same way.

Full details: [netflix-ratings.app/privacy](https://netflix-ratings.app/privacy).

## Repo layout

| Path | What it is |
| --- | --- |
| [`extension/`](extension) | The Chrome extension itself (Manifest V3): manifest, content script, background worker, icons |
| [`app/`](app) | The [netflix-ratings.app](https://netflix-ratings.app) website (Next.js App Router): home, `/install`, `/compare`, `/privacy`, plus an experimental camera demo and a ratings API route |
| [`lib/`](lib) | Shared site code: page registry, SEO/JSON-LD helpers, OMDb client, content constants |
| [`components/`](components) | Shared React components for the site |
| [`tests/`](tests) | Jest tests for the OMDb client, title extraction, ratings API and SEO helpers |
| [`scripts/`](scripts) | `package-extension.sh` (builds `extension.zip`) and the IndexNow ping script |
| `extension.zip` | Prebuilt package of `extension/`, linked from the install guide |

## Development

Requires Node.js and npm.

```bash
npm install
npm run dev     # run the website locally with Next.js
npm test        # run the Jest test suite
npm run build   # production build of the website
```

The website's server-side OMDb lookups read an `OMDB_API_KEY` environment variable. To load the extension from source, follow the [Install](#install) steps and select the `extension` folder. To rebuild `extension.zip` after changing the extension, run:

```bash
bash scripts/package-extension.sh
```

## Not affiliated

Netflix Ratings is an independent project. It is not affiliated with, endorsed by or sponsored by Netflix, Inc., IMDb or Rotten Tomatoes. Netflix, IMDb and Rotten Tomatoes are trademarks of their respective owners and are used here only to describe what the extension does.

## Credits

- Ratings data comes from the [OMDb API](https://www.omdbapi.com).
- Created by [Igor Gazivoda](https://github.com/gazivoda).

## Ratings cache (website API)

`POST /api/ratings` (used by the camera demo) keeps looked-up ratings in a small JSON file so the same title is not fetched from OMDb twice. A rating is reused for 7 days; a title OMDb does not know is retried after 1 day; failed lookups (network error, daily limit reached) are never stored, and a stale rating is served if OMDb is down.

- **Location:** `RATINGS_DB_PATH` (default `.data/ratings.json`, git-ignored). On a server, point it at a persistent volume, otherwise the cache is lost on every redeploy.
- **Single process only:** the file is read once and written atomically by one Node process. Do not run several workers against the same file.
- The Chrome extension does not use this cache; it queries OMDb directly and caches in its own IndexedDB.
