# GEO Platform Optimization Report — netflix-ratings.app
Date: 2026-06-17

> Scope: scored against the live codebase (`app/`, `public/`, `lib/`) and known off-site footprint. Off-site/entity checks (Wikipedia, Reddit, Bing index, LinkedIn) are assessed as **absent** because this is a recently-launched, solo open-source project with no entity assets yet — verify against live tools before acting where noted.

## Overall Platform Readiness
- **Combined GEO Score: 22/100** (average of all platform scores)

The diagnosis in one line: **the on-page foundation is strong (rich schema, llms.txt, AI-crawler-friendly robots, clean HTML, active GitHub), but the site is nearly invisible to AI engines because it has no entity presence, no off-site authority, no freshness signals, and no images** — the exact signals these platforms rank on. You built a great house on an unlisted street.

## Platform Scores
| Platform | Score | Status |
|---|---|---|
| Google AI Overviews | 43/100 | Moderate |
| ChatGPT Web Search | 13/100 | Weak |
| Perplexity AI | 11/100 | Weak |
| Google Gemini | 16/100 | Weak |
| Bing Copilot | 29/100 | Weak |

_Status thresholds: Strong = 70+, Moderate = 40–69, Weak = 0–39_

---

## Platform Details

### Google AI Overviews — 43/100 (Moderate) — your strongest surface
| Criterion | Score | Notes |
|---|---|---|
| Ranks top 10 for target queries | 0/20 | New site, not yet ranking. AIO pulls 92% of citations from top-10 — this is the gating factor |
| Question-based headings | 4/10 | Homepage headings are marketing slogans ("Everything you need, nothing you don't"), not questions. FAQ `<summary>` elements and compare-page H2s ("When to trust each one") partly qualify |
| Direct answers after headings | 9/15 | FAQ blocks answer directly; narrative/hero are prose, not answer-first |
| Tables for comparison data | 5/10 | Compare page has a real table ✅; homepage has none |
| Lists for processes/features | 10/10 | Ordered "how it works" + unordered features ✅ |
| FAQ section (5+) | 10/10 | 7 FAQs on homepage + FAQ on compare page ✅ |
| Statistics with citations | 0/10 | "18 minutes deciding what to watch" stat has **no source attribution**; STATS are illustrative |
| Publication/updated date | 0/5 | **No visible dates anywhere** |
| Author byline with credentials | 0/5 | No visible byline; author exists only inside Organization schema |
| Clean URL + heading hierarchy | 5/5 | Clean H1 > H2 > H3 ✅ |

**Top gaps:** not ranking yet, uncited stats, no dates, no byline, slogan headings.

### ChatGPT Web Search — 13/100 (Weak)
| Criterion | Score | Notes |
|---|---|---|
| Wikipedia article | 0/20 | None (likely below notability — that's fine, but it's the #1 ChatGPT signal) |
| Wikidata entity | 0/10 | None |
| Bing index coverage | 0/10 | Not in Bing Webmaster Tools; new site likely not indexed in Bing |
| Reddit mentions | 0/10 | None |
| YouTube channel | 0/10 | None |
| Authoritative backlinks | 3/15 | GitHub repo is the only notable link source; no .edu/.gov/press |
| Entity consistency | 5/10 | ⚠️ Name drift: site = "Netflix Ratings", extension manifest = "Netflix IMDB Ratings". Pick one |
| Content comprehensiveness (2000+ words) | 5/10 | Pages are punchy marketing, not the long authoritative articles ChatGPT favours |
| Bing Webmaster Tools | 0/5 | Not configured |

**Top gaps:** zero entity grounding (Wikidata/Wikipedia), not in Bing index, no Reddit.

### Perplexity AI — 11/100 (Weak)
| Criterion | Score | Notes |
|---|---|---|
| Reddit presence | 0/20 | None — and Reddit is **46.7%** of Perplexity citations |
| Forum/community (HN, SO, Quora) | 0/10 | None |
| Content freshness (<6mo) | 5/10 | Content is recent but **carries no date signal** for Perplexity to read |
| Original research/data | 0/15 | No original/sourced data (the "18 min" claim is unsourced) |
| YouTube w/ transcripts | 0/10 | None |
| Quotable standalone paragraphs | 6/10 | Narrative section + llms.txt are genuinely quotable ✅ |
| Multi-source claim validation | 0/10 | Claims not externally sourced |
| Discussion-generating content | 0/10 | No community footprint yet |
| Wikipedia/Wikidata | 0/5 | None |

**Top gaps:** no community presence anywhere — Perplexity is community-validation-driven and you have none.

### Google Gemini — 16/100 (Weak)
| Criterion | Score | Notes |
|---|---|---|
| Google Knowledge Panel | 0/15 | None |
| Google Business Profile | 0/10 | N/A (not a local business) |
| YouTube w/ chapters | 0/20 | None — Gemini cites YouTube more than any other platform |
| Schema.org structured data | 13/15 | Comprehensive: WebSite + Organization + SoftwareApplication + FAQPage ✅. Missing Person, BreadcrumbList, HowTo |
| Google ecosystem (Scholar/News/Maps) | 0/10 | None |
| Image optimization | 0/10 | **No real images at all** — mockups are styled `<div>`s; no `<img>`, no alt text |
| E-E-A-T (author/about/editorial) | 3/10 | Organization schema only; no author page, no about page |
| Google Merchant Center | N/A | Free product, not applicable |
| Multi-modal content | 0/5 | Text + CSS only; no images or video |

**Top gaps:** no images (kills multi-modal Gemini), no YouTube, no Knowledge Graph entity. Schema is the bright spot. A **Chrome Web Store** listing would add a strong Google-ecosystem entity signal here.

### Bing Copilot — 29/100 (Weak)
| Criterion | Score | Notes |
|---|---|---|
| Bing WMT verified + sitemap | 0/15 | Not verified |
| IndexNow protocol | 0/15 | Not implemented (no key at `/.well-known/`) |
| Bing index coverage | 0/10 | Likely not indexed yet |
| LinkedIn company page | 0/10 | None |
| GitHub presence | 5/5 | Active, public repo ✅ |
| Meta descriptions | 8/10 | Strong root description; verify per-page descriptions exist on compare/privacy |
| Social engagement signals | 0/10 | None |
| Exact-match keywords in titles/headings | 8/10 | Title tag + keywords array are well-matched ✅ |
| Page load < 2s | 8/10 | Lightweight static Next.js, font `display:swap`, no heavy images — almost certainly fast (verify with real CWV) |
| Bing Places | N/A | Not a local business |

**Top gaps:** Bing WMT + IndexNow are free, fast, high-impact and not done. GitHub + fast load are existing wins.

---

## Prioritized Action Plan

### Quick Wins (this week — cheap, multi-platform)
1. **Add visible publication + "last updated" dates** to every page (helps AIO + Perplexity freshness). Drive from a single constant so it stays honest. _(AIO, Perplexity)_
2. **Add IndexNow** — drop a key at `/public/.well-known/<key>.txt` and ping the API on deploy. ~30 min, near-instant Bing/Copilot indexing. _(Copilot)_
3. **Register Bing Webmaster Tools + submit `sitemap.xml`.** Free, unlocks the entire ChatGPT/Copilot index path. _(ChatGPT, Copilot)_
4. **Add a `Person` node + visible author byline** ("Built by Igor Gazivoda") with `sameAs` → GitHub. _(AIO, Gemini, ChatGPT)_
5. **Source the "18 minutes" stat** (or replace with a cited figure). Format: "According to [source], …". One uncited stat is a citability liability. _(AIO, Perplexity)_
6. **Fix the name inconsistency** — align the extension manifest ("Netflix IMDB Ratings") with the site brand ("Netflix Ratings"). Entity consistency matters for ChatGPT. _(ChatGPT)_
7. **Add real images with descriptive alt text + filenames** — at minimum a true product screenshot (the badge on a real Netflix card) and an OG image. This is the single biggest Gemini gap and helps social/OG everywhere. _(Gemini, all)_

### Medium-Term (this month — content + technical)
8. **Convert key headings to question form** and put an answer-first sentence under each ("How do I show IMDb ratings on Netflix? — Install the free Netflix Ratings extension and…"). Aligns with the cornerstone how-to pages already planned in `SITE-STRUCTURE.md`. _(AIO)_
9. **Add `BreadcrumbList` + `HowTo` schema** to the cornerstone/how-to pages. _(Gemini, AIO)_
10. **Create a Wikidata item** — instance of: browser extension; official website; GitHub; license; author. Low notability bar vs Wikipedia, big ChatGPT/Perplexity payoff. _(ChatGPT, Perplexity, Gemini)_
11. **Ship the Chrome Web Store listing** (already Phase 1 in the roadmap) — adds a Google-ecosystem entity, reviews, and a high-authority backlink. _(Gemini, ChatGPT, all)_
12. **Verify per-page meta descriptions** exist and are exact-match-keyworded on compare/privacy/how-to. _(Copilot, AIO)_
13. **One short product video on YouTube** (15-sec screen capture of badges appearing) with chaptered description + transcript. Single highest-leverage Gemini + Perplexity asset. _(Gemini, Perplexity)_

### Strategic (this quarter — entity + community)
14. **Authentic Reddit presence** — answer "how do I see ratings on Netflix?" in r/netflix, r/chrome_extensions, r/cordcutters. This is the #1 Perplexity lever and meaningful for ChatGPT. Value-first, not promo. _(Perplexity, ChatGPT)_
15. **Submit to directories** (Product Hunt, AlternativeTo, "awesome" GitHub lists) — backlinks + branded searches + community signal. _(all)_
16. **LinkedIn presence** for the project/author with the site linked. _(Copilot, ChatGPT)_
17. **Publish one piece of original data** — e.g. "we analysed N popular Netflix titles: IMDb and RT disagree by X% on average." Original research is the strongest Perplexity signal and a durable citation magnet. _(Perplexity, AIO)_
18. **Re-score quarterly** — re-run this checklist and track per-platform deltas (pair with `geo-compare`).

---

## The 80/20

If only five things get done, do these — they lift **all five platforms** at once:
1. **Get indexed everywhere** — Bing WMT + IndexNow + confirm Google indexing (you can't be cited if you're not in the index).
2. **Build a minimal entity** — Wikidata item + consistent name + author `Person` schema + Chrome Web Store listing.
3. **Add freshness + sourcing** — visible dates and cited stats.
4. **Add real images + one short video** — closes the entire multi-modal gap (Gemini's #1).
5. **One genuine community footprint** — a couple of helpful Reddit answers (Perplexity's #1).

Combined, these would realistically move the overall score from ~22 to the 45–55 range within a quarter, with AIO crossing into Strong territory once the site starts ranking.
