# On-page, internal-link and E-E-A-T audit

Date: 2026-11-06. Site: https://rating.watch. Repo HEAD `a093691` (clean). Read-only audit: this file is the only change.

**Evidence base.** I fetched all 17 sitemap URLs, plus `/blog/red-notice-2021`, `/data/imdb-rt-gap.json` and `/llms.txt`, from production with curl at no more than 1 request per second (all 200, except the unpublished article, which returned 404). A stdlib HTML parser split links into zones: `header` (nav `aria-label="Primary"`), `crumb` (breadcrumb), `main` and `footer`. The local `.next` build is dated 2026-10-23, so I used the live HTML as the source of truth. Word counts are main-zone parser counts, which include tables and the byline. They are not trafilatura `extracted_text`. Readability is an approximate Flesch score over `<p>`/`<li>` text only. `npm run blog:check -- --all` was run read-only: 3 of 3 pass, and `git status` was still clean afterwards. I invented no statistics. Every number below comes from the live pages, `data/*.json` or `data/blog/*`.

## Scores (heuristic, this audit's model, not Google's)

| Item | Score | Basis |
|---|---|---|
| Content quality | 80/100 | Every guide opens with a direct answer, and the research and hub pages have real dated data. Points lost for weak cross-linking, the "0 analyses" hub copy and a few unsourced generalisations |
| E-E-A-T (weighted 20/25/25/30) | 59/100 | Experience 55, Expertise 70, Authoritativeness 30, Trust 75 |
| AI citation readiness | 76/100 | Strong: answer-first ledes, a dated n=44 dataset, the JSON download and the Dataset schema. Missing: a copyable cite block, a URL in the citation, H2 anchors on /research, CSV and a licence grant |
| Templated metadata (`metadata_template.py`, 17 pairs) | site_risk **low** | templated_ratio 0.0, no shared CTA phrases, no flags |

Readability (approx. FRE / FK grade): the guides score 64-68 / grade 8-9. `/how-to/netflix-ratings-explained` scores 48 / 10.1, the hardest page to read, mostly because of its label table. `/compare/imdb-vs-rotten-tomatoes` scores 58 / 8.9.

## 1. Internal-link graph (live, contextual = links inside `<main>`, excluding the breadcrumb)

Sitewide chrome on every page:
- **Header:** logo, `/compare/imdb-vs-rotten-tomatoes`, and "Add to Chrome" linking to the Chrome Web Store (CWS).
- **Footer:** generated from `lib/pages.ts` groups. It lists all 15 grouped pages, including `/blog` with the label "Blog".
- **Not in the footer:** `/camera-vision/ar`, because it has no `group`.

Note on byline links: every GuideLayout page has a byline link to `/about` (anchor "Igor Gazivoda"). The table counts it in "out" and in About's inbound total, but it is a byline, not a contextual link.

| Page | Main words | Contextual out (unique) | Contextual in | Inbound anchors |
|---|---|---|---|---|
| `/` | 1737 | 6 | 1 | "Back to Home" (camera-vision) |
| `/install` | 728 | 3 | 7 | install guide / install page / installation guide / "Rating Watch extension" |
| `/how-to/show-imdb-ratings-on-netflix` | 1020 | 6 | 4 | descriptive (good) |
| `/how-to/show-rotten-tomatoes-on-netflix` | 1144 | 5 | 3 | descriptive (good) |
| `/how-to/find-what-to-watch-on-netflix` | 1392 | 7 | 2 | "how to find what to watch on Netflix", "short routine for choosing what to watch" |
| `/how-to/netflix-ratings-explained` | 781 | 8 | 3 | "Netflix ratings guide", "what Netflix ratings mean", "Netflix ratings explained" |
| `/research/imdb-vs-rotten-tomatoes-gap` | 1640 | 4 | **2** | "data study of 44 Netflix films" (home), "44-film study of Netflix Originals" (blog) |
| `/blog` | 1799 | 3 | 4 | "IMDb and Rotten Tomatoes scores for the 100 most-watched Netflix films" (x2), "100-film dataset", "the 100 most-watched Netflix films rated by critics and audiences" |
| `/compare/imdb-vs-rotten-tomatoes` | 1255 | **2** (about, blog) | **10** | descriptive |
| `/compare/alternatives` | 1265 | 4 | **0** | none (footer and llms.txt only) |
| `/about` | 704 | 4 | 10 | mostly the byline "Igor Gazivoda" |
| `/camera-vision` | 402 | 2 | 2 | "camera demo" |
| `/camera-vision/ar` | 615 | 1 | 1 | "Try AR mode", "AR Ratings" |
| `/pricing` | 73 | 2 | 2 | "Pro AR mode", "pricing page" |
| `/privacy`, `/terms`, `/refund-policy` | 1844 / 427 / 148 | 0 / 1 / 0 | 4 / 1 / 2 | fine for legal pages |

**Click depth from `/`.**
- With the footer and header counted, every registered page is 1 click from home, and `/camera-vision/ar` is 2. No page is more than 2 clicks deep.
- With contextual links only, the depth is: 1 for compare, find, about, pricing, research and the IMDb guide; 2 for blog, the RT guide, install, ratings-explained and the legal pages; 3 for `/camera-vision`; and **4** for `/camera-vision/ar`, the only paid-feature page. `/compare/alternatives` cannot be reached by body links at all.

**Missing reciprocal links between related pages:**
- compare -> research. The study is the evidence for compare's thesis, and research links to compare.
- compare -> find-what-to-watch, show-imdb, show-rt and ratings-explained. All four link to compare, but compare links to none of them.
- find-what-to-watch <-> research. Neither links the other.
- show-rt -> research. Research is the evidence for "mostly films, not TV series", and the RT guide does not link it.
- alternatives <-> show-imdb / show-rt / compare. Alternatives links compare, but nothing links alternatives.
- blog -> any how-to or install page. None.
- about -> research / blog. The maker's own work examples are not linked.

**Anchor text.** Anchors are generally descriptive. Weak ones: "Rating Watch extension" linking to `/install` (from research), "camera demo", the footer label "Blog" for a page that has no posts, and the byline anchors.

**Blog hub state (`/blog`).**
- HTTP 200, `index, follow`, self-canonical, in the sitemap with lastmod 2026-10-21, `CollectionPage` plus Dataset. No ItemList, which is correct with 0 articles.
- It renders about 1,800 words: the lede and stats, the selection rule with links to Netflix Top 10 and OMDb, a 100-row score table, archetype split cards, genre and period tables, 13 excluded titles grouped by reason, and a methods section.
- **Soft-404 / thin risk: low.** The page has unique computed data and a download link.
- **Real risk: empty-promise copy.**
  - The first screen says "A full analysis is published for 0 of 100 films so far".
  - A stat card reads "0 / Full analyses published".
  - The page ends with "How are these articles made?" about articles that do not exist.
  - The footer, breadcrumb and llms.txt call it "Blog".
- It has **no in-body install CTA** and no link to any how-to guide.
- HTML weight is 115,268 bytes against the spec's 120 KB hub budget (`docs/superpowers/specs/2026-10-20-blog-top-100-design.md` section 4.3), so any additions must be small.

## 2. E-E-A-T

**Author and about.**
- `/about` names Igor Gazivoda as "Independent developer", gives `hello@rating.watch` and the first-release date (May 1, 2026), and explains sourcing, accuracy and corrections.
- Live JSON-LD: `AboutPage`+`ProfilePage` with `mainEntity` Person `{name, url:/about}`.
- **No `sameAs`, `jobTitle` or external profile** (`lib/seo.ts` `authorNode`, lines 84-89). An anonymous request to https://github.com/gazivoda/netflix-imdb returned HTTP 200. Whether to list that or any other profile is the owner's call. I did not verify any other profile URL.

**Dates.**
- Every GuideLayout page shows "Updated {date}" from `PAGE_UPDATED`.
- Research shows the snapshot date (October 15, 2026) and fetch window. The hub shows "Scores as of October 21, 2026".
- Legal pages show "Last updated".
- Alternatives shows "Last verified: 2026-10-15" plus per-row dates. Good.

**Sources.**
- ratings-explained links 6 primary sources (Netflix help x3, Netflix newsroom, IMDb FAQ, RT About).
- compare links the IMDb Ratings FAQ and RT About, with a "last checked October 23, 2026" line.
- research links OMDb and an RT title page for its one hand-checked outlier.
- Alternatives links a source beside each claim.

**Trust pages.** Privacy, terms and refund policy are live, with the operator named. `LEGAL_ADDRESS` and `GOVERNING_LAW` are empty in `lib/content.ts` lines 24-25, while `/pricing` live shows "$2.99 / month or $29 / year". The owner accepted this for now (grill Q15, `/Users/igorgazivoda/.claude/projects/-Users-igorgazivoda-netflix-imdb/memory/grill-decisions-2026-10-21.md`). Listed for completeness; not re-litigated.

**Claims without a source (or broader than their source):**
- `app/how-to/find-what-to-watch-on-netflix/page.tsx:150` "Audiences and critics rarely agree by accident." No source, though the site's own study can support a narrower claim (edit 4).
- `app/compare/imdb-vs-rotten-tomatoes/page.tsx:41` "Fan brigading and nostalgia can inflate scores." No source. The IMDb FAQ the page already cites supports only "weighting can change if unusual activity is detected" (edit 7).
- compare lede: "Two of the most-quoted ratings in film" (puffery), and "That difference explains nearly every disagreement between the two" (a causal claim with no measurement behind it).
- compare FAQ (`page.tsx:61`): "the Popcornmeter counts star ratings of 3.5 or higher as positive". It may be on the linked RT About page, but I did not open that page in this audit, so re-check it.
- compare table rows "Best at spotting / Blind spot" are opinion presented as fact. Acceptable if framed as rules of thumb, which find-what-to-watch already does ("These are rules of thumb, not laws").

## 3. Intent / SXO (H1, title, first ~100 words)

| Page | Target query | First screen answers? | Issue |
|---|---|---|---|
| `/` | "imdb ratings on netflix extension" | Yes, the first sentence | H1 "Know if it's worth watching before you press play." has no topic words. Acceptable for a homepage; the title carries them |
| `/install` | "install rating watch" | Yes | none |
| show-imdb | "show imdb ratings on netflix" | Yes, a bold direct answer | The install step text mentions the CWS listing without linking it; the CTA is at word 233 |
| show-rt | "rotten tomatoes on netflix" | Yes | "mostly available for films" is unlinked; the research page is the evidence |
| find-what-to-watch | "how to find what to watch on netflix" | Yes | none |
| ratings-explained | "netflix match percentage / thumbs meaning" | Yes, a label table above the fold | Hardest page to read (FRE about 48) |
| research | "imdb vs rotten tomatoes difference netflix data" | Yes, 4 stats in the first screen | none |
| `/blog` | "top netflix movies imdb rotten tomatoes" | Yes, median gap first | "0 of 100" and the "0 Full analyses published" card on the first screen read as an unfinished page |
| compare IMDb vs RT | "imdb vs rotten tomatoes which to trust" | Partly | H1 "IMDb vs Rotten Tomatoes" drops the "which to trust" intent the title promises. The trust answer sits under an illustration box and a table, in the 2nd H2 |
| alternatives | "how to see ratings on netflix / alternatives" | Lede yes, then **no** | A ~90-word verification-method note (including "reelgood.com and imdb.com refused my automated requests") sits between the lede and the comparison |
| `/pricing` | "rating watch pricing" | Yes, but only 73 words | Server-rendered "Checking your account..." is part of the indexed text |
| `/camera-vision` | "camera vision ratings demo" | Weak | Tagline "Real-time OCR text detection and movie title recognition" is jargon. The plain explanation comes below the controls |
| `/camera-vision/ar` | "ar ratings netflix tv" | Yes | Live `<title>` is "AR Ratings: Netflix Scores Over the TV Screen" with **no " · Rating Watch" suffix**, unlike every other page. Observed only; cause not diagnosed (the segment sits under `app/camera-vision/layout.tsx`, which exports its own metadata) |

## 4. Conversion path to the Chrome Web Store

- The header "Add to Chrome" is on every page and stays visible at 640px or narrower (`components/site-chrome.module.css` hides only `.navLink`). So the CWS is **1 click, above the fold, from every page**.
- On phones a desktop extension cannot be installed, which is expected.

Where the first in-body CTA sits (position within main text):

| Page | First CTA at | Anchor text |
|---|---|---|
| Home | 3% | "Add to Chrome" |
| show-imdb | 22% | "Add to Chrome" |
| install | 24% | "Add to Chrome" |
| show-rt | 26% | "Add to Chrome" |
| about | 30% | "Chrome Web Store" |
| alternatives | 17% | "Chrome Web Store" |
| compare | 62% | "Add to Chrome" |
| ratings-explained | 69% | "Add to Chrome" |
| find-what-to-watch | 74% | "Add to Chrome" |
| research | 78% | "Add Rating Watch to Chrome" |
| **blog** | **none** | none |
| camera-vision, AR, legal | none | none |

- Labels are clear and consistent ("Add to Chrome"). The variants are "Chrome Web Store" on about and alternatives, and "Add Rating Watch to Chrome" on research.
- Guides that send readers to `/install` instead of the CWS add one extra click (guide -> install -> CWS = 2 clicks). That is acceptable because the header CTA is always present.

## 5. Draft state and publication gates (nothing changed)

`data/blog/articles/`: `carry-on-2024.json`, `kpop-demon-hunters-2025.json`, `red-notice-2021.json`. All three have `status: "review"`, `published: null`, `contentUpdated: 2026-10-23`, `sources: []`, `review.factChecker: null`, `factCheckedOn: null`, `cuts: []`. Each has an `rtCheck` dated 2026-10-23 with outcome `match`: 87%/107 reviews, 92%/107, 36%/174. `lib/blog/registry.generated.ts` has `BLOG_ARTICLE_PAGES = []`. None of the three IMDb ids (tt21382296, tt14205554, tt7991608) is in `data/blog/source/doubtful.json`, so there is **no identity gate** for them.

Gates still open before ANY article can go live, from the spec sections 6.2 and 8 and `docs/blog/FACT-CHECK.md`:

| # | Gate | Status | Who |
|---|---|---|---|
| G1 | `blog:check` PASS (7 checks) | **Passed** 2026-11-06 for all 3 | done |
| G2 | Independent fact-check per FACT-CHECK.md (tag every sentence, verify, set `checked`, fill `factChecker` and `factCheckedOn`) | Not done. The 10-23 revisions were by the writer pass and are explicitly not independent (`docs/seo/SWARM-CONTENT-2026-10-23.md`) | agent |
| G3 | R15 RT hand check (required for all pilot films) | Recorded as `match` for all 3, but by the revising agent, 14 days ago. The fact-checker should confirm it | agent |
| G4 | Pilot composition (spec 6.2: highest-popularity film in critics-higher with gap of +20 or more, in audience-higher with gap of -20 or less, and in an agreed archetype) | **Not met.** Red Notice (rank 2, gap -27) fits. Carry-On (rank 3, +22) fits. **KPop (rank 1, +18) is ineligible**, since +18 is below +20. **The agreed slot is unwritten**: the highest-popularity agreed film is `leave-the-world-behind-2023` (rank 4, IMDb 6.4, RT 73%, gap +9, `agreed-mixed` per `lib/blog/stats.ts` `archetypeOf`), and no article file exists for it | writer agent drafts it, **or the owner waives** the KPop substitution |
| G5 | Independent second fact-check, 0 factual errors | Not done | agent |
| G6 | Average fact-checker cuts of 1 or fewer per article | Unmeasured (no fact-checker yet) | agent |
| G7 | **Owner scores each pilot article 1-5** on information gain, accuracy, readability, non-templated voice and usefulness: mean of 4.0 or more, none below 3 | Not done | **owner** |
| G8 | **T0: spec sign-off.** The spec header still reads "awaiting owner sign-off on Section 1 and the open questions in Section 9". The grill memory answers the Netflix Top 10 terms (Q14, "publish the blog anyway... needs fact-check and a batch decision first") and OMDb/IMDb/RT commercial terms for AR (Q1). It records no answer to Section 9 Q2 (human-review claim: "Reviewed by Igor Gazivoda" vs "AI-assisted, fact-checked") or Q3 (licensed films; already live on the hub) | Open | **owner** |
| G9 | **Batch decision.** R21 says batch 1 = pilot + 17. SWARM-CONTENT proposed publishing the pilot alone. Either way it is a deviation or a decision | Open | **owner** |
| G10 | T7/T10 integration: verify the og:image URL, set `published`, `blog:registry`, `tsc`, `jest`, `next build`, `seo:validate`, `seo:links` (local Node 22.18+), deploy, IndexNow | Not started | integrator agent, after owner go |
| G11 | Commit/push/deploy | Needs a fresh explicit go (grill memory: "Never commit/push without a fresh explicit go") | **owner** |

**Verdict:** none of the three can be published today. At least four gates need the owner: G7, G8 (Q2), G9 and G11. G4 also needs the owner if KPop stays in the pilot.

## 6. Research dataset as a linkable asset

**What is quotable:**
- n = 44 Netflix Original films (from 88 candidates, 44 excluded with reasons).
- Mean absolute gap 18.7, median 17.5.
- 61% (27/44) are 15 or more points apart.
- Critics higher 29 vs audiences higher 15.
- Pearson r = 0.71, or 0.79 when the flagged Pinocchio outlier is removed (n = 43, mean 18.0).
- Biggest splits: Ma Rainey's Black Bottom +28 and Guillermo del Toro's Pinocchio -49.
- No TV series had an OMDb RT score.
- Snapshot 2026-10-15.

All of this is in `data/imdb-rt-gap.json`, which is byte-identical to `public/data/imdb-rt-gap.json`. The page also has a pre-registered selection rule, which is a strong credibility point.

**What exists:**
- The JSON download.
- Dataset schema (`variableMeasured`, `temporalCoverage`, `measurementTechnique`, `distribution`).
- An inline cite sentence: "Cite it as Igor Gazivoda, "{name}", Rating Watch, {date}."
- A limitations section.
- The llms.txt Data section.

**What is missing to make it easy to cite:**
- The citation has no URL and is not a copyable block (no `<pre>`/`<code>`, no APA or BibTeX).
- The research H2s have **no `id`s** (only `#faq`), so the findings cannot be deep-linked.
- **No CSV**: `/data/imdb-rt-gap.csv` returns 404.
- The licence is prose ("Scores belong to IMDb and Rotten Tomatoes; this file is a small factual snapshot for research and reproduction."). It grants no reuse terms for the compilation, and the Dataset `license` is a `CreativeWork` name, not a URL.
- No `version`/`identifier` and no changelog.
- No `Access-Control-Allow-Origin` header on the JSON (live headers show none).
- No embeddable chart image.
- The generator script (`scripts/research/imdb-rt-gap.mjs`) is named but not linked.

Choosing a licence for the compilation and linking the script are **owner decisions**. I propose no licence text.

## 7. Top 10 proposed edits (old -> new)

**1. High: compare is a dead end; link the evidence and the routine.** File: `app/compare/imdb-vs-rotten-tomatoes/page.tsx`, insert before line 179 (`{isBlogHubReady() && (`).
Old: (nothing; the list ends at `<li><strong>Both low</strong>: usually safe to skip.</li></ul>`)
New:
```tsx
<p className={g.p}>
  How often do they split? In our{' '}
  <a href="/research/imdb-vs-rotten-tomatoes-gap">study of 44 Netflix Original films</a>, 27 were 15 or more
  points apart. To turn that into a quick decision, see{' '}
  <a href="/how-to/find-what-to-watch-on-netflix">how to find what to watch on Netflix</a>.
</p>
```
(27/44 is `summary` in `data/imdb-rt-gap.json`. Better: import that file and render `Math.round(shareBigGap*n)` so the copy cannot drift.)

**2. High: `/compare/alternatives` has 0 contextual inbound links.** File: `app/compare/imdb-vs-rotten-tomatoes/page.tsx` lines 220-221.
Old: `compare audience and critics at a glance. Install it free from the Chrome Web Store\n          in about a minute.`
New: `compare audience and critics at a glance. Install it free from the Chrome Web Store in about a minute. Setup is covered in <a href="/how-to/show-imdb-ratings-on-netflix">how to show IMDb ratings on Netflix</a> and <a href="/how-to/show-rotten-tomatoes-on-netflix">how to show Rotten Tomatoes scores</a>; other tools are compared in <a href="/compare/alternatives">ways to see ratings on Netflix</a>.`
Also in `app/how-to/show-imdb-ratings-on-netflix/page.tsx` lines 78-79.
Old: `The <a href="/install">install guide</a> covers Chrome Web Store installation,`
New: keep that sentence and append after its end: `Prefer another tool? See <a href="/compare/alternatives">other ways to see ratings on Netflix</a>.`

**3. High: hub first screen advertises "0" analyses.** File: `app/blog/page.tsx` line 171.
Old: ``: `A full analysis is published for ${sum.publishedCount} of ${sum.total} films so far; the rest are listed below with their scores.`}``
New: ``: sum.publishedCount === 0 ? `All ${sum.total} films are listed below with their scores; no film-by-film analysis is published yet.` : `A full analysis is published for ${sum.publishedCount} of ${sum.total} films so far; the rest are listed below with their scores.`}``
This still states the published count, as spec R4 requires. Lines 191-194: when `sum.publishedCount === 0`, render the agreed count instead (`{agreed}` / "Films where the scores agree within 9 points", 28 live). Otherwise keep "Full analyses published".

**4. Medium: unsourced generalisation in find-what-to-watch.** File: `app/how-to/find-what-to-watch-on-netflix/page.tsx` lines 150-151.
Old: `<strong>Both high:</strong> the safest pick. Audiences and critics rarely agree by\n          accident.`
New: `<strong>Both high:</strong> the safest pick. In our <a href="/research/imdb-vs-rotten-tomatoes-gap">44-film Netflix study</a>, most films were 15 or more points apart, so agreement is a meaningful signal.`
(61% = most. This also adds the missing find -> research link.)

**5. Medium: "Blog" label on a page with no posts.** File: `lib/pages.ts` line 81.
Old: `label: 'Blog',`
New: `label: 'Top 100 Netflix films',`
This flows to the footer, the breadcrumb, llms.txt and the inbound anchor. Re-run `seo:validate` and the llms tests.

**6. Medium: hub has no install CTA and no guide link (watch the 120 KB budget; currently 115.3 KB).** File: `app/blog/page.tsx` after line 245 (the table's small-print `</p>`).
New:
```tsx
<p className={g.p}>
  To see these scores on Netflix cards as you browse, <a href={CHROME_WEB_STORE_URL}>add Rating Watch to Chrome</a>,
  or read <a href="/how-to/find-what-to-watch-on-netflix">how to find what to watch on Netflix</a>.
</p>
```
(Import `CHROME_WEB_STORE_URL` from `lib/content`. The spec's per-article CTA rule in 4.4 already sets this pattern.)

**7. Medium: unsourced "Fan brigading" claim.** File: `app/compare/imdb-vs-rotten-tomatoes/page.tsx` line 41.
Old: `imdb: 'Fan brigading and nostalgia can inflate scores.',`
New: `imdb: 'Coordinated voting can skew scores; IMDb says it changes its weighting when it detects unusual activity.',`
(The page's own IMDb FAQ summary already supports this.)

**8. Medium: research citation is not copyable or deep-linkable.** File: `app/research/imdb-vs-rotten-tomatoes-gap/page.tsx` lines 310-316.
Old: `<h2 className={g.h2}>Where can I get the data?</h2>` ... `Cite it as {AUTHOR_NAME}, &ldquo;{raw.name}&rdquo;, Rating Watch,{' '}\n        {fetchedDate}.`
New: `<h2 className={g.h2} id="data">Where can I get the data?</h2>` ... `Cite it as:` followed by `<pre className={s.cite}>{`${AUTHOR_NAME} (${raw.fetchedAt.slice(0,4)}). ${raw.name}. Rating Watch. Snapshot ${isoDate}. ${SITE_URL}${PATH}`}</pre>`.
Also add `id`s to the other H2s: `findings`, `method`, `limitations`, `table`. Later, with the owner: a CSV next to the JSON, a licence URL, and `version` in `datasetNode`.

**9. Medium: RT guide states the films-only limit without its evidence.** File: `app/how-to/show-rotten-tomatoes-on-netflix/page.tsx` lines 70-71.
Old: `Scores\n          are mostly available for films, not TV series.`
New: `Scores are mostly available for films, not TV series (in <a href="/research/imdb-vs-rotten-tomatoes-gap">our data study</a>, OMDb had none for any Netflix series).`
(Supported by research FAQ 4 and `data/imdb-rt-gap.json` `excluded`.)

**10. Medium: compare H1 drops the trust intent; alternatives buries its answer.** File: `app/compare/imdb-vs-rotten-tomatoes/page.tsx` line 81.
Old: `h1="IMDb vs Rotten Tomatoes"`
New: `h1="IMDb vs Rotten Tomatoes: which rating should you trust?"`
(Check the CSS for wrap.) Also in `app/compare/alternatives/page.tsx` lines 165-172: move the whole `<p className={s.note}>` verification block, unchanged, to directly after the comparison table, so the first screen goes from the lede straight to "How do the options compare?".

## 8. Lower-priority findings

- **Low.** `/camera-vision/ar` is 4 contextual clicks deep, is not in the footer, and has a title with no site suffix. Link it from the Pro card on `/pricing`: `app/pricing/PricingClient.tsx` line 37, change `<li>AR mode: point your phone at the TV</li>` to `<li><a href="/camera-vision/ar">AR mode</a>: point your phone at the TV</li>`. Investigate the title separately.
- **Low.** The server-rendered `/pricing` text includes "Checking your account..." (`PricingClient.tsx:43`). Consider a neutral server-rendered state, or 1-2 sentences of static explanation; the page has 73 words.
- **Low.** The `/camera-vision` tagline (`app/camera-vision/page.tsx:249`) is jargon. Consider "Point your camera at a title to see its IMDb and Rotten Tomatoes scores".
- **Low.** CTA label variants: "Chrome Web Store" on about and alternatives, "Add Rating Watch to Chrome" on research. Optional to unify.
- **Medium (owner).** Author entity: add `sameAs` to `authorNode` (`lib/seo.ts` lines 84-89) and a visible profile link on `/about`, using only profile URLs the owner confirms. Linking the research study and the hub from `/about` as examples of the maker's work is a no-risk edit.
- **Info.** The compare lede phrases "Two of the most-quoted ratings in film" and "explains nearly every disagreement" could be softened. Popcornmeter 3.5+: verify against the linked RT About page.
