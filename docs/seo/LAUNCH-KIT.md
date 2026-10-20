# Launch Kit: Rating Watch

_Prepared 2026-10-15. Ready-to-use, honest launch copy for the off-site levers called out in `GEO-PLATFORM-OPTIMIZATION.md` (Product Hunt, AlternativeTo, Reddit, Hacker News, YouTube). Entity work (Wikidata, awesome-lists, CWS, LinkedIn) is in `OFFSITE-ENTITY.md`._

**Who does what.** Everything in this file has to be posted, recorded or clicked by **you (Igor)**. Nothing here can be automated or delegated to an agent, and several platforms forbid it. Each item is tagged `[YOU]` (needs your account/hands), `[ASSET]` (something you must create first) or `[CHECK]` (verify live before acting).

**Source discipline.** Platform rules below were fetched on 2026-10-15 from the official page named in each section. Where an official page could not be read, the doc says so and tells you what to read yourself. Nothing is quoted from memory as if it were a rule.

---

## 0. Read this first: four launch blockers

These are problems in the product as it stands today. Each one changes how the drafts below read, and a Show HN or Product Hunt audience will find them in minutes.

| # | Blocker | Why it matters | Decision needed from you |
|---|---|---|---|
| 1 | **Positioning decision (2026-10-20): Rating Watch is a free extension with a paid Pro AR mode, and makes no claims about its code or licensing.** There is no `LICENSE` file and none is planned. | Every draft below says "free" and nothing else about licensing, on purpose. The site, the store listing and every post must stay consistent with that: no repository link, no statement about the code. | None. If a platform form has a License field (AlternativeTo), choose "Free" (freeware). |
| 2 | **A single shared OMDb API key is hard-coded in `extension/background.js`, and the extension package is downloadable by anyone.** OMDb's free key is limited to **1,000 requests per day** (source: `omdbapi.com/apikey.aspx`, fetched 2026-10-15). | The background worker makes 1 request per unseen title and up to 3 when the first lookup has no Rotten Tomatoes score. One Netflix home page has dozens of cards. A Show HN or Product Hunt spike will exhaust the shared quota within hours, badges will silently disappear, and the launch will look broken. The key is also visible to anyone who unzips the extension. | Choose before launch: (a) let each user paste their own free OMDb key (what several competing extensions do), (b) buy a higher OMDb tier, or (c) put a small caching proxy in front of OMDb. Also rotate the key if you pick (a) or (c), since the current one is public. |
| 3 | **Homepage testimonials in `lib/content.ts` (`TESTIMONIALS`: "Maya R.", "Devin O.", "Priya S.", "Tomás L."...) look like placeholders**, and the stats are illustrative per the GEO report. | A launch audience will read your homepage. Invented or unverified testimonials are the fastest way to lose trust, and they conflict with our own rules (see section 8). Product Hunt and HN comments also get screenshotted. | Confirm each testimonial is a real, consented quote. If they are placeholders, remove them before any launch. Never reuse them in any listing, post or comment. |
| 4 | **The extension is not on the Chrome Web Store.** Install is "Load unpacked" from the zip on rating.watch. | Show HN requires that people can try the project easily; Product Hunt and AlternativeTo listings look weak without a store link; most "awesome" lists want a store link. Dev-mode install loses most casual users. | Submit to the Chrome Web Store first (see `OFFSITE-ENTITY.md`, section 4). If review is still pending on launch day, the drafts below own the friction honestly instead of hiding it. |

Also **tell the truth about competition.** `COMPETITOR-ANALYSIS.md` implies the direct-competitor field is weak. A search on 2026-10-15 found several existing extensions that do this job, including FlixMonkey (GPLv3 licensed, also supports Rotten Tomatoes via OMDb, fades low-rated titles), Sift: IMDB ratings, NFRatings, and "IMDb Ratings on Netflix" (about 5K users per a third-party store mirror). So **no draft claims "first", "only" or "best".** Rating Watch is a small, simple, focused option: both scores at a glance in one badge, no account.

Also required wording on every listing: _"Rating Watch is an independent project and is not affiliated with, endorsed by or sponsored by Netflix, IMDb or Rotten Tomatoes. Netflix, IMDb and Rotten Tomatoes are trademarks of their respective owners."_

Facts you may state (all verified against the extension): shows IMDb rating (x/10) and Rotten Tomatoes % in a badge on Netflix title cards at `www.netflix.com`; ratings come from OMDb via the background worker; Manifest V3; permissions limited to `netflix.com` and `omdbapi.com`; no account; works on Chromium browsers (Chrome, Edge, Brave), untested in Firefox/Safari; only the title text from the card is sent to OMDb; free to use, with an optional paid Pro AR mode; install guide and download at `https://rating.watch/install`. Do not link a code repository or describe the licensing of the code. Known limitation you should be ready to state: lookups are by title text only (no year), so a few remakes or same-name titles can show the wrong score. The code tries a second search to prefer an exact-title newer match, but it is not perfect.

---

## 1. Product Hunt

**Official source:** `producthunt.com/launch` and `producthunt.com/launch/preparing-for-launch` (fetched 2026-10-15).

**Rules we follow (from those pages):** tagline max 60 characters; description max 500; up to 3 topics; thumbnail required (square, recommended 240x240, under 3 MB); at least 2 gallery images (recommended 1270x760) before the post page shows them; product URL must be a direct link (no UTM or shortened links); video must be a public YouTube link; **you may not ask people directly to upvote**, only to visit, try and comment; company accounts are prohibited, so launch from your personal account; hunting your own product is fine. Launch time suggestion: 12:01 am Pacific (schedule up to a month ahead), though the page says no timing guarantees a result.

### Name
`Rating Watch`

### Tagline candidates (character counts checked with `wc -m`)
| Tagline | Chars |
|---|---|
| **See IMDb and Rotten Tomatoes scores on Netflix cards** (recommended) | 52 |
| IMDb + Rotten Tomatoes badges on Netflix title cards | 52 |
| Ratings on every Netflix card, no tab-switching | 47 |

### Description (max 500 chars; this draft is 366)
```
Rating Watch is a free Chrome extension that puts the IMDb rating (x/10) and Rotten Tomatoes score (%) in a small badge on Netflix title cards, so you can decide without opening another tab. No account. Works on Chrome, Edge and Brave. Ratings come from OMDb; only the title text is sent. Independent project, not affiliated with Netflix, IMDb or Rotten Tomatoes.
```
`[CHECK]` Re-count with `printf '%s' "<text>" | wc -m` after any edit (limit 500).

### Topics (pick up to 3)
`Chrome Extensions`, `Movies`, `Streaming` (or `Productivity` if a closer topic is not offered). `[CHECK]` Use the topic names the picker actually shows.

### Maker first comment (post at submission; PH says to ask for feedback, not upvotes)
Write this in your own words before posting; the draft is a starting point.
```
Hi, I'm Igor, the solo developer behind Rating Watch.

I kept opening IMDb in a second tab while browsing Netflix, so I built a small extension that shows the IMDb rating and the Rotten Tomatoes score in a badge on each title card.

What it does: IMDb (x/10) and Rotten Tomatoes (%) in one badge on every card at netflix.com. No account, no settings. Ratings are fetched from OMDb by the extension's background worker; only the title text on the card is sent. Permissions are limited to netflix.com and omdbapi.com.

What it doesn't do (yet): it matches by title text, so a few same-name titles or remakes can show the wrong score. It works on Chromium browsers (Chrome, Edge, Brave); I haven't tested Firefox or Safari. [Install note: it installs as an unpacked extension from https://rating.watch/install while the Chrome Web Store review is pending / the Chrome Web Store link is here: ____.]

It's an independent project and not affiliated with Netflix, IMDb or Rotten Tomatoes.

I'd really like feedback on two things: which other score sources you'd want (Metacritic? Letterboxd?), and anything that looks wrong on your Netflix layout. Install and details: https://rating.watch/install
```

### Gallery and video `[ASSET]`
- 2+ **real** screenshots at 1270x760 of the badge on a real Netflix page. Crop or blur anything personal (profile name, avatar, continue-watching rows). No mock-ups presented as the real thing.
- Thumbnail 240x240 from `extension/icon.png`.
- Video: the 30-second demo from section 4, uploaded to YouTube as public.

### Launch-day behavior `[YOU]`
Reply to every comment, thank people for bug reports, fix and say so. Do **not** DM friends asking for upvotes, post "please upvote" anywhere, use upvote groups or buy votes.

---

## 2. AlternativeTo

**Official source:** AlternativeTo FAQ (`alternativeto.net/faq`) as summarized by search on 2026-10-15. The manage-item page itself only showed the sign-in screen, so **read the live submission form before filling it**.

**Process (per FAQ):** sign up, use **Suggest new application** under the user menu, fill Platforms, License, Descriptions and Tags, submit; the site verifies and approves entries. To list yours as an alternative to another app, open that app's page and use **Contribute to this page > Suggest Alternatives**. A third-party review (SaaSCity, not official) reports a free queue that can be slow and an optional paid priority review; **we do not recommend paying for anything unless you decide it is worth it**, and the review does not promise approval.

`[CHECK]` If the form has a **License** field, choose "Free" (freeware). Do not pick a named software license.

### Listing copy
- **Name:** Rating Watch
- **Short description (one line):** Chrome extension that shows IMDb and Rotten Tomatoes ratings on Netflix title cards.
- **Full description:**
```
Rating Watch is a free browser extension for Chromium browsers (Chrome, Edge, Brave) that adds a small badge to title cards on netflix.com showing the IMDb rating (out of 10) and the Rotten Tomatoes score (%). It is meant for people who open IMDb in a second tab to check a show before watching.

- Both audience (IMDb) and critic (Rotten Tomatoes) scores in one badge
- No account or sign-in
- Ratings are looked up through OMDb; only the title text from the card is sent
- Permissions limited to netflix.com and omdbapi.com (Manifest V3)

Limitations: lookups are by title text, so some same-name titles can show the wrong score. Works on Chromium browsers; not tested in Firefox or Safari.

Independent project, not affiliated with Netflix, IMDb or Rotten Tomatoes.
```
- **Platforms:** Chrome, Microsoft Edge, Brave (Chromium browsers only; do not tick Firefox or Safari since they are untested)
- **License:** "Free" (freeware); "Free" pricing
- **Website:** `https://rating.watch/`
- **Tags:** `netflix`, `imdb`, `rotten-tomatoes`, `ratings`, `streaming` (use the tags the form offers)

### Alternatives to list on **your** page (all found in a 2026-10-15 search; open each before submitting and keep only ones that still exist)
| Candidate | What it is | Evidence | Note |
|---|---|---|---|
| **Sift: IMDB ratings** | Free extension (Chrome/Firefox/Edge) adding IMDb scores to streaming sites | AlternativeTo has a listing: `alternativeto.net/software/sift-imdb-ratings-on-netflix-and-others` | Best first alternative: it already has a page where you can add yours via "Suggest Alternatives" |
| **FlixMonkey** | Chrome/Firefox/userscript; IMDb on Netflix and others, optional Metacritic and RT via OMDb; GPLv3 | `addons.mozilla.org/firefox/addon/flixmonkey/`, repo `github.com/fran2889/flix-monkey` | `[CHECK]` whether it has an AlternativeTo page |
| **NFRatings** | Netflix IMDb and Rotten Tomatoes integration with threshold filters, needs an OMDb key | `github.com/tjs-w/nfratings` | License not stated in what we found |
| **IMDb Ratings on Netflix** | Chrome extension; IMDb, RT, Metacritic | `github.com/pawanmaurya/imdb-ratings-on-netflix` | Store listing last updated 2024-09-04 per a mirror |
| Netflix++ , RateFlix | Older extensions | store/AMO listings | Likely stale (2017, 2022 updates); only list if AlternativeTo already has them and they still work |

Do not write comparative claims on AlternativeTo ("better than X"). State what yours does.

---

## 3. Reddit and Hacker News drafts

### 3.0 The rules, and what we could and could not verify

**Could not be fetched on 2026-10-15.** `reddit.com` and `old.reddit.com` block our fetch tool, a direct `curl` returned a bot-check page, and the browser tool is disallowed for reddit.com. So **the current written rules of r/chrome_extensions and r/netflix are NOT verified in this document.** Search results could not confirm them either. `[YOU]` **Before posting anywhere, open each subreddit's sidebar/"Rules" tab and read it.** Then apply this gate:

| If the rules say... | Do this |
|---|---|
| No self-promotion at all | Do not post. You may still answer a question where someone asks for exactly this, if a mod-approved exception exists. When unsure, modmail first. |
| Promotion only in a pinned/weekly thread | Post only there. |
| Allowed with disclosure/flair | Use the flair, disclose authorship in the first line, link the source. |

What is sourced (Reddit's old self-promotion wiki as mirrored by third parties, plus guides; all are secondary and flagged outdated by the mirrors themselves, so treat as norms, not rules): the "10% or less of your activity should be your own content" guideline, and that accounts that only submit one domain's links get banned as spam. A third-party report says r/chrome_extensions is largely self-promotion posts and has dedicated promotional threads; that is anecdotal. Subreddit rules override everything here. `[CHECK]` Reddit's current policy is on `reddithelp.com`.

**Account norms:** use your real account, disclose "I built this" in the first line of every post or comment that links the project, build ordinary participation first (answer other people's questions in those subreddits for a while before you ever mention your project), never post the same text in several subreddits, never ask anyone to upvote.

### 3.1 Draft A: r/chrome_extensions (technical write-up, leads with the lesson)
Only if the sidebar allows posts like this. Pick a flair if one fits ("Showcase"/"Feedback" or similar, if it exists).

**Title:** `Lessons from building an MV3 extension that annotates Netflix cards with IMDb + Rotten Tomatoes scores (I'm the author, feedback welcome)`

**Body:**
```
Disclosure: I'm the developer of this extension. Posting because I hit a few Manifest V3 problems that other people building overlay extensions might run into, and I'd like criticism of my approach.

What it does: shows the IMDb rating and Rotten Tomatoes % in a badge on each title card at netflix.com.

Things I learned:

1. Title matching is the hard part. Card anchors carry an aria-label like "Title, Season 2" or "Title (U.K.)". I strip season/episode suffixes and country codes before lookup. Matching by title text alone (no year) still produces wrong matches for remakes and same-name shows.

2. A direct OMDb lookup (?t=) sometimes returns an entry with no Rotten Tomatoes score because it picked the wrong same-name title. My fallback runs a search, filters to exact-title matches, prefers the newest, and re-fetches by IMDb id. That costs up to 3 requests per card, which matters for a free API key.

3. Content scripts can't make cross-origin requests the way the background worker can, so the content script talks to the service worker over a long-lived port, and the worker caches results in memory per title. A MutationObserver (debounced 300 ms) rates cards as Netflix lazily inserts them.

4. The free OMDb key is 1,000 requests a day, so a shared key is not sustainable for a public extension. I'm deciding between user-supplied keys and a proxy. If you've shipped an extension on a metered API, what did you do?

Permissions are only netflix.com and omdbapi.com. Details: https://rating.watch/install . Not affiliated with Netflix, IMDb or Rotten Tomatoes.

Happy to hear what I got wrong, especially on #3 and #4.
```
`[YOU]` Item 4 must reflect what you actually decided by then; edit before posting. Only claim "on the Chrome Web Store" if it is.

### 3.2 Draft B: r/netflix (comment answering a question; **do not make a standalone promo post**)
A big general-audience subreddit is the most likely to prohibit app promotion, and its rules are unverified here. Use this only as a **reply to someone who is already asking** "is there a way to see IMDb/Rotten Tomatoes ratings on Netflix?", and only if the sidebar permits links to tools. If the rules ban it, give the answer without the link, or skip.

```
Disclosure: I made one of these, so take my answer with a grain of salt.

There are a few browser extensions that add IMDb/Rotten Tomatoes scores to Netflix cards. FlixMonkey and Sift have been around a while; I built a smaller one called Rating Watch that shows both scores in one badge on each card (Chromium browsers only, untested in Firefox/Safari, and it can mismatch some same-name titles).

If you'd rather not install anything, searching "<title> imdb" or opening the title on IMDb/Rotten Tomatoes works, and critic vs audience scores often disagree for a reason, so it's worth looking at both.

Mine is here if you want to try it: https://rating.watch/install (install is "load unpacked" for now).
```
`[CHECK]` Verify FlixMonkey/Sift are still maintained the day you post; edit if not.

### 3.3 Draft C: r/chrome_extensions (answer in an existing "best IMDb extension for Netflix?" thread)
```
Disclosure: I'm the author of one of the options, so here's an honest rundown rather than a pitch.

- FlixMonkey: GPLv3 licensed, Chrome/Firefox/userscript, IMDb by default, optional Metacritic and Rotten Tomatoes via an OMDb key, can fade low-rated titles. Most featured of the ones I found.
- Sift: IMDB ratings: Chrome/Firefox/Edge, IMDb scores across several streaming sites.
- NFRatings: IMDb + RT with threshold filters, needs your own OMDb key.
- Rating Watch (mine): both IMDb and RT in one badge, no key or account, Chromium only (Firefox/Safari untested), much less polished than the others, matching is by title so remakes can be wrong. https://rating.watch/install

I'd check each listing's last update date before installing, since Netflix changes its markup often and these tend to break.
```

### 3.4 Hacker News: Show HN draft
**Official source:** `news.ycombinator.com/showhn.html` and `/newsguidelines.html` (fetched 2026-10-15).

**Rules we follow:** Show HN is for something people can run themselves, that you built and can discuss; title must begin with "Show HN"; users should be able to try it easily, ideally without signup; feature releases and landing pages don't qualify; **don't ask friends to upvote or comment**; don't use HN primarily for promotion; **the guidelines also say not to post generated or AI-edited text in comments**, so write your first comment yourself (the bullets below are only a skeleton of facts to include).

**Honest fit check:** Show HN needs it to be "easy to try". Today that means Load unpacked, which is friction. Best timing is after Chrome Web Store approval and after blocker 2 is fixed. Expect questions about the hard-coded API key.

**Title (no hype, no caps):** `Show HN: Rating Watch, a Chrome extension adding IMDb and RT scores to Netflix cards`
**URL:** `https://rating.watch/` (a landing page with a direct download; HN's Show HN guidance says landing pages alone may not qualify, so make sure the first screen lets people try the extension, or wait for the store listing).

**First-comment skeleton (write in your own words):**
- Who you are, why you built it (the second-tab habit).
- What it does in one sentence and what it needs (netflix.com + omdbapi.com permissions only).
- The technical bits worth discussing: title extraction from aria-labels, OMDb fallback search, port messaging between content script and worker.
- The limits, stated first: title-only matching, free OMDb quota, Chromium only, load-unpacked install (or store link).
- A concrete question for readers (how would you handle the metered API without a server?).

---

## 4. YouTube: 30-second demo

**Requirement: you must record real footage** of the extension running on your own Netflix account. No mock-ups, no stock footage, no AI-generated screen recordings. Blur or crop profile names and avatars.

### Why this format
YouTube chapters require: first timestamp `00:00`, at least three timestamps in ascending order, each chapter at least 10 seconds (YouTube Help, fetched 2026-10-15). So a 30-second video can have **exactly three chapters of about 10 seconds**.

### Script and shot list
| Time | On screen (real footage) | Voice-over (read or caption) |
|---|---|---|
| 00:00 to 00:10 | Netflix browse page before: cards with no ratings. Then the extension loads and badges appear on the cards. | "Netflix doesn't show ratings on its cards. This is Rating Watch, a browser extension that adds the IMDb score and Rotten Tomatoes score to each card." |
| 00:10 to 00:20 | Scroll a row; badges appear as new cards load. Pause on one card so the numbers are readable. | "IMDb shows out of 10, Rotten Tomatoes as a percentage. They appear as you scroll, with no extra tab." |
| 00:20 to 00:30 | `chrome://extensions` (Developer mode, Load unpacked) or the Chrome Web Store page if live, then the rating.watch/install page. | "It's free, has no account, and works on Chromium browsers. Install steps are on rating.watch. It's an independent project, not affiliated with Netflix, IMDb or Rotten Tomatoes." |

Do not narrate a claim you haven't confirmed on camera. Do not show the same title with a wrong score and say it's right.

### Title (under about 70 characters)
`Show IMDb and Rotten Tomatoes ratings on Netflix (Chrome extension)`

### Description template
Fill in the bracketed parts. Put the chapters at the end of the description so they parse as timestamps.
```
Rating Watch is a free Chrome extension that shows the IMDb rating and Rotten Tomatoes score on Netflix title cards, so you don't need to open another tab. Works on Chrome, Edge and Brave. No account.

Website: https://rating.watch/
Install guide: https://rating.watch/install
IMDb vs Rotten Tomatoes explained: https://rating.watch/compare/imdb-vs-rotten-tomatoes

I'm the developer (Igor Gazivoda). Ratings are looked up through OMDb; only the title text is sent. Independent project, not affiliated with Netflix, IMDb or Rotten Tomatoes.

00:00 The problem and the badges
00:10 Ratings as you scroll
00:20 Install
```

### Transcript / captions template `[ASSET]`
Upload the exact voice-over as a caption file (`.srt`) so the transcript is accurate rather than auto-generated:
```
1
00:00:00,000 --> 00:00:10,000
Netflix doesn't show ratings on its cards. This is Rating Watch, a browser extension that adds the IMDb score and Rotten Tomatoes score to each card.

2
00:00:10,000 --> 00:00:20,000
IMDb shows out of 10, Rotten Tomatoes as a percentage. They appear as you scroll, with no extra tab.

3
00:00:20,000 --> 00:00:30,000
It's free, has no account, and works on Chromium browsers. Install steps are on rating.watch. It's an independent project, not affiliated with Netflix, IMDb or Rotten Tomatoes.
```
`[YOU]` Edit the script to match what you actually record, and keep captions and speech identical.

**Channel:** create it under your own name or the project name; add the site link in the channel About section. **Tags/hashtags:** a few relevant ones only (netflix ratings, imdb, rotten tomatoes, chrome extension).

---

## 5. Site download page (replaces the former repository section)

Removed 2026-10-20: the project is no longer promoted through a code repository, so there is no repository description, topics list or social preview to prepare. Everything that used to point there now points at `https://rating.watch/install`.

- [ ] The install page offers the direct download (`/downloads/rating-watch-extension.zip`); run `bash scripts/package-extension.sh` after every extension change so the download is current
- [ ] Remove or replace the hard-coded API key (blocker 2)
- [ ] Real screenshots or a short GIF on the install page and in each listing
- [ ] Keep the not-affiliated sentence on every listing

---

## 6. Prioritized 2-week checklist (2026-10-15 to 2026-10-29)

Time estimates are your active hands-on time, not waiting for reviews. `[YOU]` throughout; no item can be done by an agent.

### Days 1 to 3: fix what a launch would expose (about 4 h)
| Order | Task | Est. | Needs |
|---|---|---|---|
| 1 | Confirm the positioning (free extension, paid Pro AR mode, no statement about the code) is applied in every listing | 15 min | Your decision |
| 2 | Decide the OMDb approach and implement or purchase it (blocker 2); rotate the key | 1 to 3 h | Code change, OMDb account |
| 3 | Confirm or remove homepage testimonials (blocker 3) | 20 min | Site edit |
| 4 | Submit extension to the Chrome Web Store (details in `OFFSITE-ENTITY.md`) | 1 h plus review wait | Dev account, store assets, privacy page already at `/privacy` |
| 5 | Install page polish: real screenshot, confirm the zip download works end to end | 45 min | Real screenshot |

### Days 3 to 6: assets (about 4 h)
| Task | Est. | Needs |
|---|---|---|
| Take 2 real gallery screenshots (1270x760) and a short GIF for the install page | 45 min | Your Netflix account, blur personal info |
| Record and upload the 30-second demo with captions (section 4) | 1.5 h | Screen recorder, YouTube channel |
| Create LinkedIn profile mention and/or page for the project (see `OFFSITE-ENTITY.md`) | 30 min | LinkedIn |
| Read the live rules of r/chrome_extensions and r/netflix; note the result here | 20 min | Reddit account |

### Days 6 to 10 (about 3 h)
| Task | Est. | Needs |
|---|---|---|
| Submit AlternativeTo listing and suggest as an alternative to Sift (section 2) | 45 min | AlternativeTo account |
| PR to `xyNNN/awesome-chrome` (see `OFFSITE-ENTITY.md`) | 30 min | GitHub account (the list is on GitHub); store link as Website |
| Start ordinary participation in r/chrome_extensions and r/netflix: answer other people's questions without links, 3 to 5 days | 15 min/day | Reddit account |

### Days 10 to 14: launches, on different days (about 5 h including replies)
| Day | Task | Est. | Needs |
|---|---|---|---|
| ~11 | Product Hunt launch (schedule 12:01 am Pacific, reply to comments all day) | 2.5 h | Store link live ideally, blocker 2 fixed |
| ~13 | Show HN (post, then answer comments for a few hours) | 2 h | Same prerequisites |
| ~12 to 14 | One Reddit post/answer if (and only if) the rules allow it (drafts 3.1 to 3.3) | 30 min | Rule check done |
| Day 14 | Review: record results (referrals in site analytics, support emails); do **not** repost anything that underperformed | 30 min | Analytics |

**If blockers are not resolved by day 10, move the launches back**; do not launch broken.

---

## 7. Success measures (honest)
- Referrals in site analytics; support emails from real users; Chrome Web Store installs when available.
- Branded searches for "Rating Watch" in Search Console; Bing Webmaster Tools query data.
- Re-run the AI-visibility check (see `GEO-PLATFORM-OPTIMIZATION.md`, item 18) 4 to 6 weeks after launches; entity signals take time and nothing here guarantees a citation.

---

## 8. Rules we follow

1. **No fake reviews, testimonials, ratings or installs.** The existing homepage testimonials must be verified or removed; never copy them into any listing.
2. **No vote manipulation.** We never ask friends, groups or followers to upvote on Product Hunt, Hacker News or Reddit, never buy votes, never use vote rings or upvote exchanges. Ask for feedback and trial, not votes.
3. **No sockpuppets or alternate accounts.** Every post and comment is from the real author account, with authorship disclosed in the first line.
4. **Disclose authorship** ("I built this") wherever the project is mentioned.
5. **Lead with value** (an answer, a lesson, an honest comparison), link second.
6. **Read each community's current rules first**, and obey them even when they are stricter than this document.
7. **Truth only:** no "first", "best" or "only"; state limitations; no claims about competitors we haven't verified; name them correctly with their licenses where sourced.
8. **Trademark respect:** include the not-affiliated statement; no Netflix/IMDb/Rotten Tomatoes logos in our branding.
9. **No generated text where a community forbids it** (Hacker News comments), and no automated posting.
10. **Do not edit your own Wikipedia/Wikidata entry in secret.** Disclose the conflict of interest (see `OFFSITE-ENTITY.md`).
