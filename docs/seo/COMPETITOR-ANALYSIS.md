# Competitor Analysis — Netflix Ratings

_Last updated: 2026-06-17. Estimates are directional (no paid keyword data connected); verify with Search Console + a keyword tool before committing budget._

## The two competitor sets

This product competes in **two different arenas** that need different responses.

### Set 1 — Discovery platforms (do NOT fight head-on)
These own the high-volume "what to watch" demand. They have years of content, huge domain authority, and full editorial teams. Trying to outrank them is a losing use of a set-and-forget budget.

| Competitor | What they are | Why we can't beat them | What we borrow |
|---|---|---|---|
| **JustWatch** | Streaming search + availability, huge programmatic title DB | Massive DA, app ecosystem, per-title pages at scale | Their per-title URL pattern is the template for our reach engine |
| **Reelgood** | "What to watch" aggregator + ratings | Strong brand, app, editorial lists | Position as the *in-Netflix* alternative ("no extra site to visit") |
| **IMDb.com** | The rating source itself | Owns the data and the brand query | Don't compete; ride the long tail they ignore (per-title + Netflix context) |
| **Rotten Tomatoes** | Critic-score authority | Brand-defining | Same — long-tail + Netflix context |

**Takeaway:** Don't target "best shows on Netflix" / "what to watch." Target the *contextual* variant — "ratings **while browsing** Netflix," "ratings **on** Netflix cards" — where being an in-page tool is the differentiator.

### Set 2 — Direct competitors (THIS is the winnable SERP)
Other extensions and small tools doing roughly the same job. Most have weak or absent marketing-site SEO — they live almost entirely inside the Chrome Web Store and rank for little organically.

| Competitor | Channel | Their weakness | Our opening |
|---|---|---|---|
| "IMDb Ratings for Netflix" type extensions | Chrome Web Store only | No real website, no GEO, no comparison content, often stale/abandoned | We have a real site + llms.txt + schema. We can own the **organic** SERP they ignore |
| Netflix "enhancer" suites (multi-feature) | CWS + thin landing page | Ratings are a buried sub-feature, not the headline | We are the **focused, single-purpose** answer — clearer match for tool-intent queries |
| Trakt / Letterboxd browser helpers | CWS / niche | Different primary job (tracking, not at-a-glance ratings) | Differentiate on "zero-setup, no account, both scores at once" |

**Takeaway:** The direct-competitor SERP is full of CWS listings and dead blog posts. A single well-optimized site with schema + a CWS listing of our own can dominate it.

## E-E-A-T & authority signals

| Signal | Us (current) | Direct competitors | Gap / action |
|---|---|---|---|
| Real marketing site | ✅ Strong | Mostly ❌ | **Keep the lead** |
| Open-source / auditable | ✅ Public repo | Mostly ❌ closed | Lean into it — "audit the code" is a trust differentiator AI engines reward |
| Structured data (schema) | ✅ Rich `@graph` | ❌ Rare | Keep + extend (HowTo, Breadcrumb, per-title) |
| `llms.txt` | ✅ Present | ❌ None seen | Strong GEO edge — maintain |
| Chrome Web Store listing | ❌ **Pending** | ✅ Yes | **Biggest gap — close in Phase 1** |
| Reviews / install count | ❌ None | ✅ Some | Comes with CWS listing |
| Named author / credibility | ✅ Igor Gazivoda + repo | ❌ Often anonymous | Add a short author/Person schema + about block |
| Backlinks / referring domains | ⚠️ ~1 (GitHub) | Varies | Phase 3 one-time pushes (Product Hunt, AlternativeTo, directories) |

## Keyword gap opportunities (winnable, low-competition)

These are tool-intent and long-tail terms where the current SERP is weak. Prioritize the cornerstone pages around them.

- "how to show imdb ratings on netflix"
- "show rotten tomatoes scores on netflix"
- "netflix ratings extension" / "netflix ratings overlay"
- "see ratings without leaving netflix"
- "imdb on netflix chrome extension"
- "reelgood alternative chrome extension" / "justwatch alternative extension"
- "is {title} worth watching netflix" (long-tail, programmatic)

## Verification checklist (before acting on this doc)
- [ ] Connect Google Search Console — get the real query baseline
- [ ] Pull actual search volumes (Ahrefs/Semrush/GKP) for the gap list above
- [ ] Search each cornerstone query manually; record the real top-5 and their weaknesses
- [ ] Audit the top 3 direct-competitor CWS listings for ASO keywords to mirror
