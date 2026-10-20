# Fact-check brief: Rating Watch film articles

You are a fact-check agent. You are given one slug (for example `red-notice-2021`) whose article `data/blog/articles/{slug}.json` has `status: review`. You decide whether it can become `checked`. This document is everything you need. You verify and delete; you do not write.

Source of truth: `docs/superpowers/specs/2026-10-20-blog-top-100-design.md` (Sections 6.2 and 7.5, ruling R15). The writer-side rules are in `docs/blog/WRITER-BRIEF.md`; read its Sections 4 to 8 and 11 once so you know what the writer was told.

## 1. What you may and may not do

You may:
- Delete sentences from `sections[].paragraphs`, `summary`, or `faq[].a` that are unsupported (Section 5). Delete whole sentences only.
- Delete a `faq` item, a `sources` entry, a `{{cite:id}}` marker, or a `related` pick, when it is unsupported or its source failed.
- Edit the `review` block: `factChecker`, `factCheckedOn`, `cuts`, `rtCheck`.
- Set `status` to `checked` (only when every step passes).
- Set `contentUpdated` to the check date if, and only if, you deleted at least one sentence (a deletion is a real prose edit).
- Run `npm run blog:brief -- {slug}` and `npm run blog:check -- {slug}` and open web pages (read only).

You may not:
- Rewrite, rephrase, reorder or "fix" any prose. Do not add a sentence, a claim, a word, a token, a source or a link. Do not soften a claim into a hedge. If a sentence is wrong, delete it or send the article back.
- Add a `data-note` section (the writer does; see Section 7).
- Edit any other file: not `films.json`, not `lib/**`, `app/**`, `tests/**`, `docs/**`, and not other articles.
- Set `status` to `published` or touch `published` (it stays `null`).
- Use git, run builds, install anything, or print secrets or read `.env*` files.

If an article needs more than deletions to be right, do not patch it: leave `status: review` and return it to the writer (Section 9).

## 2. Command sequence

Run from `/Users/igorgazivoda/netflix-imdb`.

1. `npm run blog:check -- {slug}`. Exit 0 and seven PASS lines are required. Any failure: stop, return the article to the writer with the findings (verdict `RETURN`). Do not fix lint failures yourself. Exception: an `[identity-doubtful]` finding is not the writer's problem; return verdict `HOLD` with reason `identity-doubtful` (Section 7a).
2. `npm run blog:brief -- {slug}`. Use it as the reference for the film record (names, plot, awards, scores), the rendered token values, the tier and archetype, the gap, and the "R15 required" line.
3. Tag every sentence (Section 3) and verify sources (Section 4), names and wording (Section 6).
4. If R15 applies (Section 7), do the Rotten Tomatoes hand check and record `rtCheck`.
5. Apply deletions, fill `review`, re-run `npm run blog:check -- {slug}`.
6. If it passes and nothing else blocks: set `status: checked`, `review.factChecker`, `review.factCheckedOn`. Run `npm run blog:check -- {slug}` once more; exit 0 required.
7. Return the structured verdict (Section 9).

## 3. Tagging sentences

Go through every sentence of `summary`, every paragraph of every section, and every FAQ answer. FAQ questions and headings are checked for claims too. Tag each sentence with exactly one tag. Keep the tags in your working notes; they are not written to the file.

| Tag | Meaning | Action |
|---|---|---|
| `FIELD` | States only things that are tokens or fields of the film record (scores, votes, rank, gap, runtime, genre, director, named leads, rating, Netflix chart facts, the OMDb `Awards` string). Names and wording must match the record exactly | keep |
| `CITED` | States a claim supported by a source in `sources`, with `{{cite:id}}` for that source in the same sentence, and the source passed Section 4 | keep |
| `INTERP` | An interpretation: hedged ("suggests", "may", "one reading") and tied to data (Metascore agreement, vote volume, genre pattern, awards text, the measurement difference) | keep if it passes Section 5 test |
| `STRUCT` | Navigation or framing with no factual content ("Use the pairing as a pointer, not a ruling"), or a link to a site page | keep |
| `PLOT` | The one plot sentence | keep only if it adds nothing beyond `omdb.plot`, is 30 words or fewer, and is not a copy |
| `UNSUPPORTED` | Anything else | delete and record in `review.cuts` |

A sentence mixing a supported and an unsupported claim is `UNSUPPORTED` as a whole (you may not edit inside a sentence). Delete the sentence.

## 4. Source URLs: how to open and verify

For every entry in `sources`:

1. Open the exact `url` (use the WebFetch tool; plain read-only). Confirm it loads (not 404, not a login wall, not a redirect to a home page).
2. Confirm the host is allowed: Netflix newsroom or Tudum, oscars.org and other awarding bodies' official sites, official festival sites, the film's Wikipedia article (only for release dates, premieres, awards, source material). Not allowed: Reddit, fan wikis, Quora, Medium, BuzzFeed, Ranker, ScreenRant, CBR, Looper, social networks, IMDb trivia, reviews, quotes, boards or news, Rotten Tomatoes or Metacritic review pages, AI-generated or listicle sites. (`blog:check` already rejects most banned hosts; you also catch lookalikes it cannot know.)
3. Read the page. Confirm it states the exact claim in `supports`, for this film (check title, year and, where relevant, names). Confirm the sentence(s) in the article that carry `{{cite:id}}` say no more than `supports` says.
4. Confirm `title`, `publisher` and `accessed` are plausible (the date format is `YYYY-MM-DD`; `accessed` may not be in the future).
5. If any of steps 1 to 4 fails: delete the sentence(s) that cite it, delete the source entry, and record each deletion in `review.cuts`. If any `{{cite:id}}` for a deleted source remains in prose, delete that sentence too; a source with no cite, or a cite with no source, fails `blog:check`.
6. A page you cannot open counts as failed. Do not rely on memory or search snippets.

## 5. What counts as unsupported

A sentence is `UNSUPPORTED` when any of these is true:

- It states a fact about the film that is not in the film record and has no `{{cite:id}}` from a verified source. Typical cases: release events, festival premieres, award wins or nominations beyond the OMDb `Awards` string, source material (book, comic, remake), production facts, filming locations, cast changes, sequels.
- It states why critics or audiences felt something as fact ("critics disliked the pacing", "viewers loved the chemistry"). Hedged interpretation tied to a score field is allowed; unhedged causation or invented reception is not.
- It quotes or paraphrases a critic or user review, or reports audience demographics.
- It states trivia, box office, budget, or viewing figures other than the Netflix tokens.
- It makes an availability, region, affiliation or endorsement claim, or uses "Netflix Original", "available on Netflix", "streaming now", "official", "partnered".
- It adds plot beyond `omdb.plot` (twists, endings, scenes, character arcs), or the plot sentence is over 30 words or copied.
- It names a person or title that does not match the film record exactly.
- It describes the data wrongly: wrong direction (says critics are higher when the gap says audiences are), wrong size wording for the tier, a wrong ranking claim ("the highest in its genre" when the brief shows otherwise), or a superlative ("the lowest rating in this set") that the brief does not show.
- It expresses a personal viewing opinion, or taste ("a great watch").
- It is an interpretation without a hedge, or a hedged interpretation that is not tied to one of: Metascore agreement, vote volume, genre pattern in this set, awards text, the measurement difference.
- A `faq` answer contradicts the film record, or answers an awards question with anything other than the exact OMDb `Awards` text (or a statement that none is listed).

What the lint already rejects (so a `review` article cannot contain it, but you still read for meaning): typed digits in body prose (only tokens, 4-digit years, "Top 10", rating codes and the exact OMDb `Awards` text may carry digits), any double quotation mark, "I", "my", "we think/feel/found/believe/recommend/love", "stream it on Netflix", "watch it on Netflix", "on Netflix now/today/in", "Netflix Original" (any spacing or hyphen), box office, grosses and production cost, and a must-cite word without `{{cite:id}}` in the same sentence (premiere, festival, based on, adapted, novel, won, nominated, Oscar, BAFTA, Golden Globe, Emmy, filmed, shot in) unless the sentence restates the OMDb `Awards` text exactly. "Directed" needs `{{director}}` or a cite. A sentence that passes these checks because it carries `{{cite:id}}` is only as good as its source: Section 4 still applies. The lint also fails a summary or `why-split` that contains an explicit comparison pointing the wrong way ("critics rate it higher than audiences" on an audience-higher film), or any explicit higher-than claim on an agree-tier film (gap under 5).

Test for an interpretation to keep: remove the hedge and the data reference mentally; if the sentence only makes sense because a field in the brief supports it, keep it. If it would need an outside fact to be true, it is unsupported.

## 6. Names, plot, wording

- Director, writers and leads in the prose match `omdb` in the brief: same spelling, same people. A lead that is not among the first three billed actors is unsupported unless cited.
- The plot sentence adds nothing beyond `omdb.plot` and shares no 6-word run with it.
- The tier wording matches the gap (the lint checks banned words; you check meaning): "a wide gap" only for 20-29, "closely agree" only for 0-4, and so on (see `docs/blog/WRITER-BRIEF.md` Section 5). Direction matches the sign: negative gap = audiences (IMDb) higher; positive = critics (Rotten Tomatoes) higher.
- No forbidden claims (Section 5).
- The summary answers "why do the scores differ" within 75 words and contains the direction.

## 7a. Identity doubts (DOUBTFUL matches)

Every `blog:refresh --scores` run prints `DOUBTFUL` lines and writes `data/blog/source/doubtful.json`: every accepted match whose OMDb release year is earlier than the film's first Netflix chart year (title, Netflix year, OMDb year, IMDb id, runtime difference). A matching runtime does not settle identity on its own: a 2026 Netflix "Apex" (95 minutes) and the 2021 "Apex" (94 minutes) pass the runtime rule.

`blog:check` fails an article whose `imdbId` is in that file without an identity override (`[identity-doubtful]`). The fact-checker does not resolve it: return `HOLD`, reason `identity-doubtful`. The controller (a human) opens the IMDb page and compares cast, director and runtime with Netflix, then either adds an identity override to `data/blog/source/overrides.json` (`netflixTitle`, the confirmed `imdbId`, `reason`) or adds an override with the correct `imdbId`, and re-runs `blog:refresh --scores`. No article is checked for a film that is still DOUBTFUL.

## 7. Rotten Tomatoes hand check (R15)

### When it is required
- `blog:brief` prints "R15 required" (abs gap is 30 or more, or IMDb votes under 25,000), or
- the controller says the article is a pilot article.
Otherwise leave `review.rtCheck` as `null`. `blog:check` fails a `checked` article that needs `rtCheck` and has none.

### How to do it
1. Find the film's Rotten Tomatoes page. Usual form: `https://www.rottentomatoes.com/m/{rt-slug}`; find the slug by searching the site if needed. The URL must be on `rottentomatoes.com` with https.
2. Open it (WebFetch). Confirm it is the right film: title, release year and director match the film record. A sequel, a remake or a same-named older film is the wrong page; find the right one.
3. Read the Tomatometer (critics) percent and the number of critic reviews it is based on. Not the Popcornmeter (audience score). Record `rtSitePercent` (integer percent) and `rtSiteReviews` (integer number of reviews).
4. Compare with the OMDb figure in the brief (`rtPercent`): `d = abs(rtSitePercent - omdb rtPercent)`.

### Outcome (must be consistent; `blog:check` enforces it)
| d | outcome | what happens |
|---|---|---|
| 0 to 2 | `match` | no change to prose; may proceed to `checked` |
| 3 to 9 | `note` | publishable with a visible data note. Record `rtCheck` with outcome `note`, leave `status: review`, and return the article to the writer to add a `data-note` section (verdict `RETURN`, reason `rt-note`). After the writer adds it, you do a short second pass: confirm the `data-note` exists and `blog:check` passes, then set `checked`. A `checked` article with outcome `note` and no `data-note` section fails |
| 10 or more | `hold` | not publishable. Record `rtCheck` with outcome `hold`, leave `status: review` (a `hold` article may not be `checked`), verdict `HOLD` |

If the page cannot be found or opened, or it shows no Tomatometer, the check cannot be completed: do not invent numbers and do not write `rtCheck`; leave `status: review` and return verdict `HOLD` with reason `rt-unverifiable`. (The controller records it.)

### Field shape
```json
"rtCheck": {
  "checkedOn": "2026-10-20",
  "url": "https://www.rottentomatoes.com/m/example_film",
  "rtSitePercent": 41,
  "rtSiteReviews": 118,
  "outcome": "note"
}
```
`checkedOn` is today (`YYYY-MM-DD`). `rtSitePercent` and `rtSiteReviews` are JSON numbers (not strings). `outcome` is exactly `match`, `note` or `hold`. If no R15 check was needed, the value is `null`.

## 8. Recording the review block

Shape (all inside `review`):

```json
"review": {
  "writer": "Claude (writer agent)",
  "writtenOn": "2026-10-19",
  "factChecker": "Claude (fact-check agent)",
  "factCheckedOn": "2026-10-20",
  "cuts": [
    "summary: removed the sentence stating the film premiered at a festival; no source",
    "sections[the-film].paragraphs[1]: removed the sentence naming a fourth lead not billed in OMDb"
  ],
  "rtCheck": null
}
```

- Do not change `writer` or `writtenOn`.
- `factChecker`: a short name for you (for example `Claude (fact-check agent)`). `factCheckedOn`: today, `YYYY-MM-DD`. Fill both only when you set `status: checked`.
- `cuts`: an array of strings, one per deletion, in the form `"{where}: removed {what, in a few words}; {reason}"`. `where` is the JSON path (`summary`, `sections[why-split].paragraphs[2]`, `faq[1].a`, `sources[0]`). Quote at most a few words of the deleted text; do not paste the whole sentence. If you made no deletions, `cuts` stays `[]`.
- Count the cuts. The pilot gate requires an average of at most 1 cut per article; many cuts means the writer brief needs fixing, so report the count.

## 9. After deleting: re-check and decide

1. Run `npm run blog:check -- {slug}`. Deleting a sentence can break a rule: a summary that loses `{{asOf}}` or its direction, a `why-split` that falls below 150 words or below two evidence points, a section that falls under its minimum, prose that falls under 600 words, a paragraph left empty, or a `faq` that drops under 2 items or 35 words.
2. If it fails because of what you deleted, you may not repair it with new words. Restore nothing; leave `status: review`, record the cuts you made, and return the article to the writer (verdict `RETURN`, reason `below-minimum-after-cuts` plus the finding). The writer rewrites the gap and resubmits.
3. If it passes, and R15 (if required) is `match` or an accepted `note` with `data-note` present, set `status: checked`, `review.factChecker`, `review.factCheckedOn`. Run `npm run blog:check -- {slug}` once more.

Any unsupported claim that cannot be removed by deletion alone (for example a wrong direction in the only sentence that states it) means the article goes back to the writer.

## 10. Output to the controller

Return exactly this block (plain text, no extra prose), one per slug:

```
FACT-CHECK VERDICT
slug: {slug}
verdict: CHECKED | RETURN | HOLD
status_now: checked | review
check_before: PASS | FAIL
check_after: PASS | FAIL
sentences_tagged: {n}  (FIELD {n}, CITED {n}, INTERP {n}, STRUCT {n}, PLOT {n}, UNSUPPORTED {n})
cuts: {n}
cuts_detail:
  - {where}: {what}; {reason}
sources:
  - {id}: ok | removed ({reason})
r15_required: yes | no
rt_check: not-required | match | note | hold | unverifiable
rt_check_detail: {rtSitePercent} on the site vs {omdb rtPercent} in OMDb, {rtSiteReviews} reviews, {url}   (only when checked)
reasons: {for RETURN or HOLD, one line each: finding id and short description; for CHECKED write "none"}
notes: {anything the controller should know, or "none"}
```

Verdict rules:
- `CHECKED`: `status` is now `checked`, `factChecker` and `factCheckedOn` are filled, `blog:check` exits 0.
- `RETURN`: `status` is still `review`; the writer must act (lint failure, damage after cuts, a needed `data-note`, or a claim that deletion cannot fix).
- `HOLD`: the article is not publishable now (RT difference of 10 or more, or the RT check cannot be completed). `status` stays `review`.

If you made deletions but the verdict is `RETURN` or `HOLD`, leave the cuts and `cuts` entries in the file so the work is not repeated; do not change `factChecker` or `factCheckedOn`.

## 11. Final checklist

- `blog:check` exit 0 before you started; exit 0 after you finish (for a `CHECKED` verdict).
- Every sentence has a tag; every `UNSUPPORTED` one is deleted and listed in `cuts`.
- Every source was opened and states its `supports` claim, or is removed with its cites.
- Names and plot match the film record; tier and direction wording match the gap.
- R15 done where required, with a consistent outcome.
- You wrote no new prose, added no source, and edited no other file.
- `status` is `checked` or `review`; `published` is `null`.
