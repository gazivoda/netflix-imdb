# Off-site Entity Kit: Netflix Ratings

_Prepared 2026-10-15. Companion to `LAUNCH-KIT.md` and `GEO-PLATFORM-OPTIMIZATION.md`. Covers the entity signals AI engines and knowledge graphs read: Wikidata, curated "awesome" lists, the Chrome Web Store listing and LinkedIn. Every step needs **you (Igor)**; none can be done by an agent. Tags: `[YOU]` your account or decision, `[ASSET]` something to create first, `[CHECK]` verify live._

**Prerequisites shared with the launch kit** (see `LAUNCH-KIT.md`, section 0): add a `LICENSE` file; fix or rotate the hard-coded OMDb key; verify or remove homepage testimonials. Nothing below should name a license until the file exists.

---

## 1. Honest framing: what entity work can and cannot do

- The GEO report scores Wikidata/Wikipedia at 0 and calls Wikidata a "low notability bar". **That is only partly true.** Wikidata's official notability page (`wikidata.org/wiki/Wikidata:Notability`, fetched 2026-10-15) says an item is acceptable if it meets **at least one** of: (1) it has a valid sitelink to a Wikimedia project page; (2) it is "a clearly identifiable conceptual or material entity" that can be described using "serious and publicly available references"; (3) it fulfils a structural need (other items' statements use it). The page itself says the guidelines are "intentionally left a bit vague" and disagreements go to a deletion request.
- A solo, months-old extension has **no Wikipedia sitelink** and no structural need, so it must pass criterion 2. The honest test is: do **independent** sources (not your own site or repo) describe it? Today the answer is likely no. An item resting only on your own website and GitHub will probably be nominated for deletion.
- **Wikipedia: do not attempt an article.** There is no realistic notability, and editing about your own project is a conflict of interest.
- **Sequencing rule:** create the Wikidata item **only after at least two independent, publicly verifiable references exist** (for example a live Chrome Web Store listing, an AlternativeTo entry, an article or video by someone else, or a list inclusion). Until then, entity work happens on properties you own (site schema, GitHub, LinkedIn, store listing) which AI engines also read.
- **Conflict of interest:** if you edit Wikidata about your own project, say so on your user page, state references neutrally, and don't create an item for yourself as a person. Wikidata's own policy pages on autobiography and paid editing exist (`Wikidata:Notability` links them; their text was not retrieved here, so `[CHECK]` them before editing).

---

## 2. Wikidata item draft (create later, per sequencing rule)

**Search first.** On 2026-10-15 a Wikidata search for "Netflix Ratings" returned no existing item, so nothing to merge. `[CHECK]` search again right before creating (also try "Netflix IMDb Ratings").

**Create at:** `wikidata.org` > Create a new Item. `[YOU]` requires a Wikidata account.

| Field | Value |
|---|---|
| Label (en) | `Netflix Ratings` |
| Description (en) | `browser extension that displays IMDb and Rotten Tomatoes ratings on Netflix` |
| Aliases (en) | `Netflix Ratings extension` |

**Statements** (property IDs verified against the Wikidata API on 2026-10-15; only those marked are included):

| Property | Value | Verified | Notes |
|---|---|---|---|
| instance of (P31) | **browser extension (Q874411)** | yes, Q874411 = "browser extension" | |
| official website (P856) | `https://netflix-ratings.app/` | P856 yes | Add a reference URL = the site itself only as a last resort; prefer independent references |
| source code repository URL (P1324) | `https://github.com/gazivoda/netflix-imdb` | P1324 yes | |
| software version identifier (P348) | `1.0.0` | P348 yes | From `extension/manifest.json`. Add qualifier "publication date (P577)" only with the date you actually released v1.0.0 |
| inception (P571) | `2026` (year precision only) | P571 yes | The repo's first commit is 2026-05-01 and was an empty README, so this is not a release date. Use only a year unless you are sure of the date |
| platform (P400) | **Google Chrome (Q777)** | P400 yes, Q777 = "Google Chrome" | Add other Chromium browsers only after you have checked their items exist and you have tested them |
| copyright license (P275) | `[YOU]` your license | P275 yes | **Do not add until a `LICENSE` file exists.** If you choose MIT, the item is Q334661 ("MIT License"); confirm before use |
| official name (P1448) | `Netflix Ratings` (en) | P1448 yes | Matches the manifest name |

Left out on purpose:
- **developer (P178):** its value must be an item; creating a Wikidata item for yourself is itself a notability and conflict-of-interest problem. Skip unless an item for you already exists for independent reasons.
- **operating system (P306):** not meaningful for a browser extension.
- **Chrome Web Store ID:** a store-ID property may exist, but its identifier was not verified here. `[CHECK]` search the property list for "Chrome Web Store" once the listing is live.
- Subreddit (P3984), social-media-followers (P8687) and similar: only if independent assets exist.

**References.** Each statement should cite an independent source where possible: the store listing (stated as "reference URL" with "retrieved" date), an independent article or directory entry. Self-published sources are weak; a mix is acceptable, a purely self-sourced item is risky.

**After creation:** add the Q-number to the site's schema `sameAs` arrays (Organization/SoftwareApplication JSON-LD in `app/layout.tsx`, which today lists only the GitHub repo) so the knowledge-graph link is bidirectional. `[YOU]` or a follow-up code task.

---

## 3. "Awesome" GitHub lists (checked 2026-10-15 with the GitHub API)

| List | Stars | Last push | Status | Fit |
|---|---|---|---|---|
| **[xyNNN/awesome-chrome](https://github.com/xyNNN/awesome-chrome)** | 123 | 2026-10-15 | **Active.** The 8 most recent PRs include 7 merged within days (latest merged the same day) | **Primary target.** Categories include Fun, Social & Communication, Productivity, Sports, but **no streaming/entertainment category**; proposing one is explicitly welcome in CONTRIBUTING |
| [themeselection/best-chrome-extensions](https://github.com/themeselection/best-chrome-extensions) | 588 | 2026-03-23 | Repository is vendor-run; 6 most recent PRs all **open and unmerged** | Low odds; skip unless it starts merging |
| [linsa-io/chrome-extensions](https://github.com/linsa-io/chrome-extensions) | 481 | 2026-03-03 | The 4 most recent PRs are open and unmerged | Low odds; skip |
| [ridsuteri/Awesome-Chrome-Extensions](https://github.com/ridsuteri/Awesome-Chrome-Extensions) | 221 | 2024-05-11 | Stale | Skip |
| [fregante/Awesome-WebExtensions](https://github.com/fregante/Awesome-WebExtensions) | 1,517 | 2026-09-16 | Active, but it is a developer-resources list ("Sample Extensions" are code examples) | **Not a fit** for a consumer extension |

Honest expectation: these are small lists, and inclusion mainly adds a GitHub-hosted mention and a referral link, not a large traffic or authority jump. Do it because it is cheap and honest.

### PR to `xyNNN/awesome-chrome` `[YOU]`
Rules from its `CONTRIBUTING.md` (fetched 2026-10-15): search previous suggestions for duplicates; meaningful PR description; **one commit per suggestion**; bold non-linked name, description on the same line, each link as its own nested bullet; **a GitHub repository may stand in as the Website when it is the extension's home**; only add URLs you have opened and that respond successfully; Chrome Web Store link must be a live listing; short description ending with a full stop; no trailing whitespace; new categories welcome.

**Entry (add under a new `## Entertainment & Streaming` section, and add it to the Table of Contents; or under `## Fun` if you prefer not to add a category):**
```
## Entertainment & Streaming
*Make the most of your streaming services*

* **Netflix Ratings** - Shows IMDb and Rotten Tomatoes ratings on Netflix title cards.
  * Website: [github.com/gazivoda/netflix-imdb](https://github.com/gazivoda/netflix-imdb)
  * Chrome Web Store: [Chrome Web Store](https://chromewebstore.google.com/detail/EXTENSION_ID)
```
Remove the Chrome Web Store line until the listing is live (replace `EXTENSION_ID` with the real one after approval).

**PR title:** `Add Netflix Ratings (new Entertainment & Streaming category)`
**PR description:**
```
Adds Netflix Ratings, a Chrome extension (Manifest V3) that shows IMDb and Rotten Tomatoes ratings on Netflix title cards. Disclosure: I'm the author.

The list has no streaming/entertainment section, so this proposes a new one. I have opened the repository link above; Chrome Web Store link added only once the listing is live. Happy to move it to Fun if you prefer.
```
`[CHECK]` Open each URL before submitting. Do not open duplicate PRs. If it sits unmerged for two weeks, leave it; do not nag.

Other listing-style places, lower priority (not verified in this pass, so `[CHECK]` each one's rules): a "Show"/"Made with" post on dev.to or Hashnode (write a real technical article about the OMDb/aria-label lessons rather than an ad); Reddit showcase threads (rules unverified, see `LAUNCH-KIT.md`, section 3).

---

## 4. Chrome Web Store listing (the biggest entity gap)

The GEO report and `COMPETITOR-ANALYSIS.md` both rank this as the biggest missing signal (Google-ecosystem entity, reviews, high-authority backlink). `[YOU]` owns it end to end.

**Official policy hub:** `developer.chrome.com/docs/webstore/program-policies`. The index page confirms sections on Privacy Policy, Impersonation & Intellectual Property, and a "be useful" requirement that extensions provide basic functionality; the detail pages were not retrievable in this pass, so `[CHECK]` them (and the current one-time developer registration fee shown in the developer dashboard) before you pay or submit.

Risks to plan for:
- **Trademark/impersonation review.** The name contains "Netflix". Policies cover impersonation and unfair use of others' work, so a reviewer could object. Mitigation: the not-affiliated sentence in the description, no Netflix/IMDb/RT logos or screenshots of their branding as your icon, and the descriptive form "Netflix Ratings" rather than anything suggesting official status. Outcome cannot be predicted; if rejected, the fallback is a rename plus keeping the site/brand consistent, which is a bigger cost, so read the policy pages first.
- **Hard-coded API key and quota** (blocker 2). Fix before submitting; reviewers and users will hit the limit.
- **Privacy disclosures.** The extension sends only the title text to `omdbapi.com`. Fill the store's data-use form accurately and link `https://netflix-ratings.app/privacy`.
- **Permissions justification.** `host_permissions` for `netflix.com` and `omdbapi.com` only; no `permissions` entries. State that plainly.

**Listing copy** (reuse the PH/AlternativeTo wording; keep the not-affiliated sentence):
- Name: `Netflix Ratings`
- Summary (store limit applies, `[CHECK]` the form): `Shows IMDb and Rotten Tomatoes ratings on Netflix title cards.`
- Detailed description: reuse the AlternativeTo full description from `LAUNCH-KIT.md`, section 2.
- Screenshots: real captures only. Icon: `extension/icon.png`.
- After approval: put the store URL into the site (`/install`, hero button), GitHub README, `llms.txt`, schema `downloadUrl`/`sameAs`, and every listing in `LAUNCH-KIT.md`.

---

## 5. LinkedIn and author entity

`COMPETITOR-ANALYSIS.md` and the GEO report both name LinkedIn as a Bing Copilot and ChatGPT signal. This is a one-person open-source project, so the honest options are:

1. **Your personal profile (do this):** add "Netflix Ratings" as a project/experience entry with the site link and a one-sentence description (same wording as above, plus not-affiliated line). `[YOU]` 15 min.
2. **A LinkedIn company page for the project** (optional): only if you will keep it current; a sparse, dead page scores low (per the brand-mentions rubric 30 to 49). Skip if you won't post.
3. **One post at launch** (when the Product Hunt/Show HN is live): a plain account of what you built and what you learned, link to the repo, no request for likes. `[YOU]` 20 min. Do not ask people to like or share.
4. **Author consistency:** the site byline says "Igor Gazivoda" with the GitHub link. Use the same name and the same photo/URL on LinkedIn, GitHub, YouTube and the site. After the profile exists, add its URL to the author `Person` `sameAs` on the site (today only GitHub). `[YOU]` or follow-up code task. **Do not invent profile handles for other networks; only list accounts that exist.**

---

## 6. Order of operations (entity)

| Step | Depends on | Est. (your time) |
|---|---|---|
| 1. LICENSE + key fix + testimonials resolved | none | 2 to 4 h |
| 2. Chrome Web Store submission | step 1 | 1 h + review time |
| 3. awesome-chrome PR | store link or GitHub as Website | 30 min |
| 4. LinkedIn profile project entry | none | 15 min |
| 5. AlternativeTo listing (`LAUNCH-KIT.md`) | license field | 45 min |
| 6. Wait for at least two independent references | steps 2 to 5 | calendar time |
| 7. Wikidata item | step 6 | 45 min |
| 8. Add Q-number, store URL, LinkedIn to site schema `sameAs` | steps 2, 4, 7 | follow-up code change |

Re-run the GEO platform score about 4 to 6 weeks after steps 2 to 5 to see whether anything moved (`GEO-PLATFORM-OPTIMIZATION.md`, item 18). Entity signals compound slowly and none of this guarantees citation by any AI engine.

---

## 7. Rules we follow
Same as `LAUNCH-KIT.md`, section 8. In short: no fake reviews, testimonials or installs; no vote manipulation; no sockpuppets or secondary accounts; disclose authorship and conflict of interest everywhere (including Wikidata and awesome-list PRs); truth only; trademark-respectful wording; read each community's live rules and obey them.
