# Content Calendar — Netflix Ratings

_Last updated: 2026-06-17_

## Philosophy: a calendar that ends

Capacity is **minimal / set-and-forget**, and the goal is **reach**, not thought leadership. So this is **not** a perpetual publishing schedule — running a blog cadence would be the wrong tool. Instead: a **finite backlog of evergreen, self-refreshing pages**, built in batches, then left to compound. There is no "weekly post." When the backlog is built, content work is essentially done.

> Rule of thumb: prefer **1 page that updates itself** over **4 posts that go stale.**

## The backlog (build once, in priority order)

| # | Page | Primary query | Type | Refresh model | Phase |
|---|---|---|---|---|---|
| 1 | `/how-to/show-imdb-ratings-on-netflix` | "show imdb ratings on netflix" | Evergreen how-to | Manual, rare (only if UI changes) | 2 |
| 2 | `/how-to/show-rotten-tomatoes-on-netflix` | "rotten tomatoes on netflix" | Evergreen how-to | Manual, rare | 2 |
| 3 | `/install` | "netflix ratings extension install" | Evergreen | Update once when CWS goes live | 2 |
| 4 | `/compare/alternatives` | "reelgood / justwatch alternative" | Comparison | Quarterly fact-check of competitor claims | 2 |
| 5 | `/how-to/find-what-to-watch-on-netflix` | "how to find what to watch on netflix" | Evergreen guide | Manual, rare | 2 |
| 6 | `/netflix/[title]` (set) | "is {title} worth watching" | Programmatic | **Auto** (nightly ISR) | 3 (optional) |

That's the whole content plan. Six items. Items 1–5 are static evergreen; item 6 maintains itself.

## Batch schedule (compressed, not drawn out)

Because the goal is set-and-forget, batch the build rather than spreading it across a year:

| Window | Work |
|---|---|
| **Batch 1** | Phase 1 (CWS listing, GSC, schema/CWV quick wins) |
| **Batch 2** | Cornerstone pages #1–#4 (share one template) |
| **Batch 3** | Page #5 + internal-linking pass + sitemap regen |
| **Batch 4 (optional)** | Programmatic engine #6 *only if quality gates pass* |
| **Then: passive** | Quarterly 30-min review (see below) |

## Evergreen quality bar (applies to every page)

- Answer the query in the **first 100 words** (AI-citation + featured-snippet friendly)
- Real screenshots of the extension in action
- Valid schema (`HowTo` / `FAQPage` / `BreadcrumbList` as appropriate)
- One clear install CTA
- Honest, verifiable claims about competitors (legal + trust)
- 300+ words of genuine, non-boilerplate content

## Ongoing cadence (intentionally tiny)

| Frequency | Task | Time |
|---|---|---|
| **Monthly** | Glance at Search Console: new queries, impressions, any errors | ~15 min |
| **Quarterly** | Fact-check `/compare/alternatives`; AI-citation spot check ("how do I see ratings on Netflix" in ChatGPT/Perplexity); confirm programmatic pages still render real scores | ~30 min |
| **As-needed** | If Netflix changes its UI, update how-to screenshots | rare |

## Explicitly NOT doing (and why)
- ❌ A blog / weekly posts — wrong tool for a set-and-forget tool product; creates a maintenance burden with low reach-per-hour
- ❌ "Best shows on Netflix" listicles — unwinnable vs JustWatch/Reelgood, and they go stale instantly
- ❌ Unbounded programmatic generation — index bloat and thin-content risk outweigh the reach
