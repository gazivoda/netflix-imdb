# SERP / SXO study: Netflix ratings query space

Date: 2026-11-06. Site: https://rating.watch. Read-only research; nothing else in the repo was changed.

## Method and limits

- Queries were run through a web-search tool (standard mode) and selected pages were opened with a fetch tool. The tool returns an **aggregated result set, not a verified Google top-10**. Positions, search volumes, click-through and traffic are **not measured** here. "Observed" below means "appeared in the result set on 2026-11-06".
- Competitor figures (users, ratings, update dates) are quoted only where the store page was fetched on 2026-11-06. Anything else is marked *(snippet, not fetched)*.
- Product facts were checked against `extension/manifest.json` (MV3; host permissions `www.netflix.com` and `www.omdbapi.com` only; no `permissions`), `README.md` (Chromium: Chrome, Edge, Brave; not tested in Firefox or Safari; RT "mostly for films, not TV series"; shared 1,000/day OMDb allowance) and `lib/pages.ts` (AR mode description).
- Brand check: a search for `"Rating Watch" netflix imdb rotten tomatoes extension` returned only other extensions' store pages. rating.watch and the Rating Watch listing did not appear in that result set (not a Google rank check).
- Requested names that **did not surface**: no "Flixster"-style Netflix extension and no "Rating Plus". The closest was "Rateflix Plus" on addons.mozilla.org *(snippet, not fetched)*.

## 1. Query table

Intent uses four classes: I = informational, C = commercial, T = transactional, N = navigational.

| # | Query | Intent | Page types/domains observed in result set | Winnable for Rating Watch? |
|---|---|---|---|---|
| 1 | does Netflix show IMDb ratings | I | CWS listings (RateFlix, Ratings for Netflix, IMDb Ratings for Netflix™), AMO reviews, greasyfork, spammy "why Netflix refuses" pages, a Blind post. No official Netflix answer. | **Yes**. Already answered as a FAQ on `/how-to/show-imdb-ratings-on-netflix`; the title is how-to framed, the query is question framed (see §3) |
| 2 | imdb ratings on netflix extension | T | Almost all store listings (CWS, AMO) plus listing-mirror sites (chromeboard, extscope, extensionauditor); a Tom's Guide forum FAQ | **The ranking asset is the CWS listing** (see `CWS-LISTING.md`). Home and install can compete as the one real site in the set |
| 3 | rotten tomatoes netflix chrome extension | T | CWS (SVODEX, NFRatings, RateFlix, Streaming Wizard), 2011/2013 TNW articles, GitHub repo, chromeboard | Yes, same as #2. The RT how-to title omits "extension" (see §3) |
| 4 | netflix ratings extension firefox | T | AMO listings only (netflix-ratings, IMDb ratings on Netflix, FlixMonkey, Rateflix, Rateflix Plus, Bonetflix) | **No**. Product is untested in Firefox; a page would be a mismatch |
| 5 | netflix ratings safari extension mac | T | iMore article, Mac App Store (Popcorn for Safari, Streaming+), mirrors | **No** for the extension. Can be answered honestly inside the device page (new page A) |
| 6 | netflix ratings extension edge | T | CWS listings, Beebom how-to, GitHub, AMO | Partly. Edge is supported via CWS; covered by `/install`. No new page |
| 7 | how to see imdb ratings on netflix iphone app | I | 2020 Android guides (technipages, droidviews, gadgethacks), App Store lookup apps, CWS listings. None answers the iPhone question directly | **Yes**, via an honest "what works on each device" page (new page A) |
| 8 | imdb ratings on netflix smart tv | I | No on-topic result: CWS listings, a 2020 TNW article, syndicated "best shows" lists | **Yes**. AR mode (`/camera-vision/ar`) is the only first-party answer to TV intent and its title does not say so (new page A + §3) |
| 9 | best netflix movies imdb rating | C | Editorial listicles (TV Insider, cordcutting, 24/7 Wall St paginated, Tom's Guide), scraped pages | **Partly**. `/blog` already serves this with a dated, data-built list. No new page |
| 10 | highest rated netflix original series imdb / netflix most watched series imdb ratings | C | whats-on-netflix "IMDb Top 100 Series on Netflix" (fetched: Netflix US, "as of November 2026", IMDb plus RT where available, no stated method), syndicated Stacker/Fox lists, Powerdrill analysis, 2016–2022 lists | **Possible, low–medium confidence** as a data-built series counterpart to `/blog` (new page B). whats-on-netflix is strong |
| 11 | netflix hidden gems high rated | C | Rotten Tomatoes editorial guides (60 films, 100 series), Digital Trends, TechRadar, Looper, NME, AARP, BGR, Yahoo/IndieWire, spam | **No**. The dataset is most-watched Top 10 films, so it cannot pick out "hidden" titles, and editors dominate the results |
| 12 | netflix top 10 with imdb ratings this week | I | Tom's Guide weekly picks, whats-on-netflix reports, best-of-netflix, regional news. None showed IMDb scores in the result set | **No for now**. `blog:refresh` is manual (no scheduled workflow in `.github/workflows/ci.yml`); data last downloaded 2026-10-20, last week 2026-10-04. A weekly page would go stale within days |
| 13 | how to sort / filter netflix by imdb rating | T | BestWatch (Product Hunt), Notan Netflix IMDb Overlay (CWS), Flixer, gettrim, FlickSurfer | **No**. Rating Watch shows badges and does not sort or filter. Do not build a page for a missing feature |
| 14 | imdb ratings netflix extension not working | I | CWS/AMO review and support tabs, 2020 TNW | **Yes, as an update** to the `/install` section "If the badges do not appear", not a new page |
| 15 | imdb vs rotten tomatoes difference / what is a good imdb rating / tomatometer vs popcornmeter | I | Medium, Cinemaholic, thisvsthat, Fortress of Solitude, blogspot; ScreenCrush, AV Club, RT FAQ; spam on .edu subdomains | Already covered by `/compare/imdb-vs-rotten-tomatoes` (FAQs mention 7.0, Popcornmeter, Certified Fresh). No new page |
| 16 | why doesn't netflix show rotten tomatoes or imdb | I | Blind post, CWS/AMO reviews, Moviefone (2018), Plex forum. No Reddit thread surfaced | Yes, as a sourced paragraph inside existing pages; motives are speculation and must not be presented as fact |

**SXO read.** Tool and extension queries (#2–#6, #13) return stores and listings, so the store listing is the main lever and the site is secondary. Question queries (#1, #7, #8, #16) return weak or off-topic results. That gap suits pages that give a direct, honest answer. List queries (#9–#12) are dominated by editorial publishers. Only the data-built list, which the site already has for films, is a credible page type.

### Direct competitors fetched 2026-11-06

| Extension | Store | Users | Rating | Last updated | Notes |
|---|---|---|---|---|---|
| IMDb Ratings for Netflix™ | [CWS](https://chromewebstore.google.com/detail/imdb-ratings-for-netflix/dnbpnlalaijjbogmjbpdkdcohoibjcmp) | 10,000 | 1.5/5 (482) | 2024-10-17, v4.1.3 | IMDb; tooltip adds Metascore. **Not in `/compare/alternatives`** |
| RateFlix | [CWS](https://chromewebstore.google.com/detail/rateflix/dddmgiigenogheihnldadkdooelhepcg) | 8,000 | 3.0/5 (123) | 2022-10-11, v3.2 | IMDb, RT/Metacritic for some titles, in the expanded card |
| SVODEX | [CWS](https://chromewebstore.google.com/detail/svodex/malgjkedapomgdnolihjjfbdagghmljb) | 2,000 | 3.5/5 (59) | 2025-02-06, v3.3.5 | Netflix, Disney+, HBO Max; IMDb + RT |
| Notan Netflix IMDb Overlay | [CWS](https://chromewebstore.google.com/detail/elfpcolennlnihmannmjpjmcpbefbhko) | 10 | 5.0 (2) | 2026-02-22 | IMDb only; sort and minimum-rating filter |
| IMDb ratings on Netflix (Pawannitj) | [AMO](https://addons.mozilla.org/en-US/firefox/addon/imdb-ratings-on-netflix/) | 401 | 2.8 (24) | 2020-09-25, v0.149 | Firefox; IMDb, RT, Metacritic |
| Popcorn for Safari | [Mac App Store](https://apps.apple.com/us/app/id1535719670) | n/a | not enough ratings | v3.0, 2022-10-14 | Mac only (macOS 11+, Safari 14+); IMDb, Metascore, RT; free with tips |

Not fetched (snippet only): NFRatings, What's the Rating?, Netflix IMDb RT Ratings (needs own OMDb key), FlixMonkey, zRate, Trim, Rateflix Plus.

## 2. New pages worth building (ranked, 2 of a possible 5)

Only two candidates pass the "honest page type + not a near-duplicate" filter. The other candidates were rejected in §1 (#4, #11, #12, #13) or belong in §3.

### A. `/how-to/netflix-ratings-on-tv-and-phone`

- **Target query:** "imdb ratings on netflix smart tv", "how to see imdb ratings on netflix iphone", "netflix ratings on [device]". Intent is informational. The result set has no direct answer (§1 #7, #8).
- **Page type:** how-to/FAQ answer page with a device matrix: device, does Netflix show IMDb/RT, what works, what Rating Watch does.
- **Title (55):** `IMDb Ratings on Netflix on TV, Phone or Mac: What Works`
- **Meta (142):** `Can you see IMDb ratings on Netflix on a TV, iPhone, Android or Mac? What works on each device, what does not, and why. Checked November 2026.`
- **H2 outline:**
  1. Does Netflix show IMDb or Rotten Tomatoes ratings on any device? (No; Netflix uses thumbs and "Most Liked")
  2. On a computer: Chrome, Edge and Brave (Rating Watch, link to /install)
  3. On a Mac with Safari or on Firefox (Rating Watch untested; third-party options named with fetched dates)
  4. On a smart TV, Fire TV or console (no browser extensions; AR mode through a phone camera)
  5. On iPhone and Android (no in-app overlay from Rating Watch; looking scores up separately; 2020-era Android accessibility apps, with current availability unverified)
  6. Device matrix table
  7. FAQ
- **Facts needing a primary source (fetched):** Netflix thumbs, "Most Liked" and stars on older devices: [help.netflix.com/en/node/9898](https://help.netflix.com/en/node/9898). Popcorn for Safari Mac-only, v3.0 2022: [apps.apple.com/us/app/id1535719670](https://apps.apple.com/us/app/id1535719670). Firefox add-on last updated 2020: [AMO](https://addons.mozilla.org/en-US/firefox/addon/imdb-ratings-on-netflix/). Android accessibility-app method, dated 2020-11-10: [technipages](https://www.technipages.com/imdb-ratings-netflix-android) (re-verify the Play listing before publishing). Rating Watch support comes from `README.md` and the manifest. AR mode copy must follow `lib/pages.ts` `/camera-vision/ar` (the `proOnSale` variants) and the gate state at publish time.
- **Internal links:** out to `/install`, `/camera-vision/ar`, `/how-to/show-imdb-ratings-on-netflix`, `/how-to/netflix-ratings-explained`, `/compare/alternatives`. In from the "mobile app or TV" FAQ on the IMDb how-to, the "phone or TV" FAQ on the RT how-to, the "Netflix TV app" FAQ on ratings-explained, the `lib/content.ts` home FAQ (line ~167), and `/camera-vision/ar`. Needs a `lib/pages.ts` entry (`group: 'guide'`) and a `PAGE_UPDATED` date.
- **Why it is not a near-duplicate:** existing pages answer device questions with a one-line "No" FAQ in four places. This page becomes the single canonical answer those FAQs link to. It also covers device-specific options (TV via AR, Safari/Firefox third parties, phones) that no current page explains.

### B. `/blog/series` (data-built series counterpart to `/blog`)

- **Target query:** "highest rated netflix series imdb", "netflix most watched series imdb ratings". Intent is commercial investigation.
- **Page type:** a generated, dated data list like the `/blog` film hub. It is **not** an editorial listicle, which keeps the CONTENT-CALENDAR "no listicles" rule intact: the page refreshes from data and has a stated selection rule.
- **Title (41):** `Most-Watched Netflix Series Rated by IMDb`
- **Meta (140):** `The most-watched series in Netflix's global Top 10, with IMDb ratings side by side, a stated selection rule, dated sources and the raw data.`
- **H2 outline:** How is the list built? / All N series, most-watched first / Highest IMDb among the most-watched / Why most series have no Rotten Tomatoes score / How scores split by genre / Which popular series are not scored? / Download the data
- **Facts needing a primary source:** the Netflix Top 10 TSVs already used by the pipeline (`all-weeks-global.tsv`, `most-popular.tsv`, see `data/blog/source/netflix-candidates.json`; 1,282 TV titles are currently skipped). **Methodology gap:** the fetched [tudum/top10](https://www.netflix.com/tudum/top10) and [/about](https://www.netflix.com/tudum/top10/about) pages did not define "views", the week window or publish day. Get that definition from a Netflix source before describing the metric. Per-season OMDb identity for series is unverified. Competitor reference: [whats-on-netflix IMDb Top 100 Series](https://www.whats-on-netflix.com/library/imdb-top-100-series-on-netflix/).
- **Routing:** `app/blog/[slug]` exists, so this needs a static `app/blog/series/page.tsx`. Static routes take precedence, and film slugs carry a year, so they cannot collide.
- **Internal links:** out to `/blog`, `/compare/imdb-vs-rotten-tomatoes`, `/how-to/find-what-to-watch-on-netflix`, `/install`. In from `/blog` (a "Series" link), `/research/imdb-vs-rotten-tomatoes-gap`, and the find-what-to-watch guide. Needs a registry/hub-gate entry like `BLOG_HUB_PAGE`.
- **Why it is not a near-duplicate:** `/blog` is films only. Series have different data: season-level titles and mostly no RT. The differentiator over whats-on-netflix is "most-watched globally" rather than "highest rated in the US library". **Condition:** build it only if the pipeline can be extended and refreshed on the same quality gates as films. Otherwise skip it.

## 3. Title/meta rewrites for existing pages

Lengths were counted. Apply them only with Search Console evidence where noted.

| Page | Current title | Proposed title | Proposed meta | Evidence |
|---|---|---|---|---|
| `/` | Rating Watch: IMDb & Rotten Tomatoes on Netflix Cards (53) | `Rating Watch: Free Netflix Ratings Extension (IMDb + RT)` (56) | `Free Chrome extension that adds IMDb ratings and Rotten Tomatoes scores to Netflix title cards. No account. Works in Chrome, Edge and Brave.` (140) | #2, #3: "extension" results are store listings; the brand query did not surface the site |
| `/how-to/show-rotten-tomatoes-on-netflix` | Show Rotten Tomatoes Scores on Netflix (38) | `Rotten Tomatoes on Netflix: Free Chrome Extension` (49) | `Netflix has no Rotten Tomatoes scores. This free Chrome extension adds the Tomatometer to Netflix cards where OMDb has one. Edge and Brave too.` (143) | #3 is transactional and extension-led |
| `/how-to/show-imdb-ratings-on-netflix` | How to Show IMDb Ratings on Netflix (Free) (42) | Conditional: `Does Netflix Show IMDb Ratings? How to Add Them Free` (52) | keep current | #1 question framing. Change only if GSC shows that query outweighs "how to show…" |
| `/compare/alternatives` | Ratings on Netflix: Reelgood, JustWatch & More (46) | `Netflix Ratings Extensions Compared: RateFlix, SVODEX & More` (60) | `Netflix ratings extensions compared: Rating Watch, RateFlix, SVODEX, IMDb Ratings for Netflix and Safari or Firefox options. Sourced, dated table.` (146) | #2–#5 results are extension names. **Content update:** add IMDb Ratings for Netflix™ (10,000 users, 1.5/5, updated 2024-10-17), Popcorn for Safari and the Firefox add-on, using the fetched figures above with dates |
| `/camera-vision/ar` | AR Ratings: Netflix Scores Over the TV Screen (45) | `IMDb Ratings on Your TV's Netflix: Phone AR Mode` (48) | keep the `proOnSale` variants and lead with "See IMDb ratings on Netflix on your TV" | #8. Caveat: the route is `force-dynamic` behind `resolveArGate`. If crawlers get the paywall or sign-in state, the page will not rank, so let page A carry TV intent |
| `/install` | (title fine) | — | — | #14: rename the H2 "If the badges do not appear" to "Rating Watch not working? Fixes". Cover the red "!" quota state, reload, and wrong-title matches (all in README) |

Not proposed: Firefox, Safari or "filter by rating" pages (product mismatch), hidden gems (the dataset cannot support it), a weekly Top 10 page (no automation), or a separate "good IMDb score" or Popcornmeter page (already in the compare page FAQs).
