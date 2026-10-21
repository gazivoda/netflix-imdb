# Writer brief: Rating Watch film articles

You are a writer agent. You are given one or more film slugs (for example `red-notice-2021`). For each slug you write one JSON file, `data/blog/articles/{slug}.json`, and nothing else. This document is everything you need. Read it fully before you start.

Source of truth: `docs/superpowers/specs/2026-10-20-blog-top-100-design.md` (Sections 3 and 7). If this brief and the lint disagree, the lint (`npm run blog:check`) decides what passes.

## 1. Hard boundaries

- You own only `data/blog/articles/{slug}.json` for the slugs you were assigned. Never create, edit or delete any other file. That includes `data/blog/films.json`, `lib/**`, `app/**`, `tests/**`, `docs/**`, `package.json` and other writers' article files.
- You may read other article files in `data/blog/articles/` to avoid repeating their openers, headings and phrasing. Reading is allowed; copying is not.
- Never set `status` to `published`, and never set `published` to anything but `null`. Only the integrator publishes.
- Never set `status: checked` and never fill `factChecker` or `factCheckedOn`. Only the fact-checker does.
- Do not use git. Do not run builds, `next build`, installs or network scripts. Do not touch `.env*` files and never print secrets.
- Do not look up the film on the web unless you want to cite a source (Section 8). All numbers and names come from the film record.
- If a command exits 2 (usage or I/O error, unknown slug, missing `films.json`), stop and report it. Do not work around it.

## 2. Command sequence

Run from the repo root, `/Users/igorgazivoda/netflix-imdb`.

1. `npm run blog:brief -- {slug}` (the `--` passes the slug through npm)
   Prints: the film record, Netflix data, derived values (gap, tier, archetype, gap rank, genre median and position, the section order for this archetype), every token with its rendered value (a value shown as NULL means that token cannot be used for this film), the tier wording to use and avoid, the direction you must state, a line `this film needs a shortTitle: yes/no`, whether an R15 Rotten Tomatoes hand check will be required and whether this film is a pilot film (`pilot film: yes/no`), what the hours figure covers, word budgets, genre peers, a related-links preview and the banned phrase list. Exit 2 means unknown slug or missing `films.json`.
2. Write `data/blog/articles/{slug}.json` with `"status": "draft"` while you work.
3. `npm run blog:check -- {slug}`
   Prints seven sections (schema, tokens, copy, plot-overlap, lengths, links, similarity), each PASS or FAIL with findings in the form `[rule-id] where: message`, then `RESULT: PASS` or `RESULT: FAIL (n findings)`. Exit codes: 0 = pass, 1 = findings, 2 = usage or I/O error.
4. Fix every finding and run `npm run blog:check -- {slug}` again. Repeat until the exit code is 0 and every line is PASS. Do not ignore a finding or argue with it; change the text.
5. Only after exit 0: set `"status": "review"`, set `review.writer` (for example `"Claude (writer agent)"`), `review.writtenOn` and `contentUpdated` to today's date (`YYYY-MM-DD`), leave `published: null`, `review.factChecker: null`, `review.factCheckedOn: null`, `review.cuts: []`, `review.rtCheck: null`. Run `npm run blog:check -- {slug}` one last time and confirm exit 0.
6. Report to the controller, per slug: slug, final status, prose word count if you know it, sources used (ids), and anything unusual (for example a token that was NULL, `shortTitle` set, R15 required).

The similarity section compares your article with every other article at `review`, `checked` or `published`, and with the worked example of Section 9 (`tests/blog/fixtures/worked-example.json`), so copying its sentence frames fails. Drafts are not compared by default, so your first pass is not blocked by half-written neighbours. After each wave the integrator runs `npm run blog:check -- --all`, which checks every article against every other article including drafts. A pass today can turn into a failure later; if the controller sends you a similarity finding, rewrite the flagged sentences and frames in your own words.

Your slug is permanent: once an article file exists (any status), a later data refresh keeps that slug for the same film.

## 3. Article file schema

File: `data/blog/articles/{slug}.json`. Unknown keys fail. Prose fields allow plain text, tokens (Section 4) and internal links `[anchor](/path)` where `/path` is a registered site page (max 3 per article; the brief or the controller tells you which paths exist, usually `/compare/imdb-vs-rotten-tomatoes`, `/research/imdb-vs-rotten-tomatoes-gap`, `/blog`). No HTML, no other markdown, no bullet lists, no bold, no backticks.

| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | `1` | |
| `slug` | string | equals the filename (without `.json`) and the film slug |
| `imdbId` | string | equals the film's `omdb.imdbId` (copy it from the brief) |
| `status` | `'draft' \| 'review' \| 'checked' \| 'published'` | you set `draft`, then `review`; never the other two |
| `published` | `YYYY-MM-DD \| null` | always `null` for you |
| `contentUpdated` | `YYYY-MM-DD` | today's date when you finish |
| `shortTitle` | string, optional | at most 29 chars; add it only when the brief says the generated title does not fit in 50 chars; must be a recognizable form of the OMDb title (for example "Glass Onion") |
| `h1` | string | 30-90 chars once rendered; contains the film title (or `shortTitle`); must differ from the generated page title |
| `description` | string | rendered length 120-158 chars; contains the film title, the words "Rotten Tomatoes" and at least one of `{{imdb}}`, `{{imdbX10}}`, `{{rt}}`, `{{metascore}}`; unique across articles |
| `summary` | string | 45-75 words; answer first; first sentence names the film and contains `{{imdb}}` and `{{rt}}`; also contains `{{asOf}}` and a direction word matching the archetype |
| `sections` | `{ id, heading, paragraphs: string[] }[]` | see Section 6 |
| `faq` | `{ q, a }[]` | 2 or 3 items; `q` 25-100 chars and contains the film title; `a` 35-90 words |
| `sources` | `{ id, url, title, publisher, accessed, supports }[]` | 0 to 6 items; `id` lowercase letters, digits, hyphens; `url` https; `accessed` `YYYY-MM-DD`; `supports` = the exact claim, at most 200 chars. Every source must be cited at least once with `{{cite:id}}`; every cite must resolve |
| `related` | `{ slug, reason }[]`, optional | 0 to 2 picks of other films in `films.json` (shared director or actor, or a cited link). Computed links fill the rest. When the brief's related list shows no film that shares a director or actor with yours, omit the `related` key entirely (do not write `[]` and do not invent a pick) |
| `review` | object | `{ writer, writtenOn, factChecker, factCheckedOn, cuts: string[], rtCheck: null \| {...} }`. You fill `writer` and `writtenOn`; the rest stays `null` or `[]` |

Not written by you (the page template generates them from data): the score table, the "Where it sits" facts, the sources list, related links, method and disclaimer lines, the page `<title>`.

## 4. Tokens

Numbers and facts about the film enter prose only through tokens. Writing a score by hand fails the lint (Section 12). An unknown token, or a token whose value is NULL for this film, is an error.

Example values below are for the fixture film Crimson Static (2022) in `tests/blog/fixtures/films.json`. The real values for your film are in your brief.

| Token | Meaning | Example (Crimson Static) |
|---|---|---|
| `{{title}}` | display title | Crimson Static |
| `{{year}}` | release year | 2022 |
| `{{imdb}}` | IMDb rating | 6.4 |
| `{{imdbX10}}` | IMDb rating on the 100 scale | 64 |
| `{{rt}}` | Rotten Tomatoes percent | 38% |
| `{{metascore}}` | Metascore (can be NULL) | 41 |
| `{{votes}}` | IMDb votes | 402,310 |
| `{{votesShort}}` | IMDb votes, short | 402K |
| `{{gap}}` | signed gap, `rt - imdbX10` (positive means critics higher) | -26 |
| `{{gapAbs}}` | size of the gap | 26 |
| `{{gapRank}}` | rank by size of gap among all films | 2nd |
| `{{setSize}}` | films in the set | 12 here; 100 in production |
| `{{genre}}` | primary genre, lowercase | action |
| `{{genreCount}}` | films in that genre in the set | 3 |
| `{{genreMedianGap}}` | signed median gap of that genre (can be NULL) | -8 |
| `{{popularityRank}}` | rank by Netflix hours viewed | 2nd |
| `{{weeksInTop10}}` | weeks in Netflix's global Top 10 | 8 |
| `{{peakRank}}` | best weekly rank (can be NULL) | 1 |
| `{{hours}}` | Netflix hours viewed (see "The hours figure" below) | 262 million |
| `{{runtime}}` | runtime | 118 minutes |
| `{{director}}` | director (can be NULL) | Dario Kessel |
| `{{asOf}}` | date the scores were fetched | October 15, 2026 |
| `{{cite:id}}` | citation marker for source `id` | [1] (position in `sources`) |

Token grammar: exactly `{{name}}` (optional spaces inside are tolerated), `{{cite:id}}` for citations. Do not put arguments on other tokens. Tokens already include their units where shown: `{{rt}}` renders with the percent sign, `{{runtime}}` with "minutes", `{{hours}}` with "million". Do not add them again ("{{rt}}%" is wrong). Write "{{gapAbs}} points" (the word "points" next to a token is fine; only a literal digit next to it fails).

The hours figure. `{{hours}}` is the larger of two Netflix numbers, and the brief says which one this film has: either the sum of the weekly hours viewed across the weeks the film was in Netflix's global Top 10 (`weekly-sum`), or the hours viewed in the film's first 91 days on the Netflix chart (`first-91-days`, from the Most Popular list). The digits of that window ("91") can never be written in prose, because every digit outside a token fails [number-literal]. The digit-free wording that passes the lint is "in its opening weeks on the chart", for example: "It logged {{hours}} hours viewed in its opening weeks on the chart." Write the figure only as `{{hours}} hours`; for the number of weeks use `{{weeksInTop10}}`, never a typed count.

Names of actors, writers and other directors are not tokens. Use them exactly as they appear in `omdb` in the brief (spelling, order). The director is always `{{director}}`; a sentence with "directed" and no `{{director}}` token fails unless it is cited.

## 5. Gap tiers and wording

`g = abs(gap)`. The brief tells you your film's tier and archetype. The lint rejects the words in the right-hand column.

| Tier | g | Use | Never use |
|---|---|---|---|
| agree | 0-4 | "closely agree", "within a few points" | gap, split, divide, disagree, "a clear gap", noticeably, intensity words ("slightly higher", "far higher", "far more", "much higher", "well above", considerably, significantly, markedly, substantially), and everything listed for the tiers above (wide, large, big, sharp, huge, very wide ...) |
| slight | 5-9 | "slightly higher", "a small gap", "mostly agree" | "a clear gap", noticeably, disagree, wide, large, big, sharp, split, and everything listed for the tiers above |
| clear | 10-19 | "a clear gap", "noticeably higher", "disagree" | wide, large, big, sharp, split, huge, massive, enormous, chasm, very wide, widest |
| wide | 20-29 | "a wide gap", "a large gap", "sharply" | huge, massive, enormous, chasm, very wide, widest |
| very wide | 30+ | "a very wide gap"; "one of the widest in this set" only if gap rank is 10 or better; huge, massive, enormous, chasm | (requires an R15 Rotten Tomatoes hand check later) |

The bans are cumulative: a tier never uses the words of any tier above it, and huge, massive, enormous and chasm belong to the very wide tier only.

A few fixed phrases are not about the score difference and are allowed in any tier: "wide release", "big screen" (or "big-screen"), "generation gap", "age gap", and a computed rank such as "the {{gapRank}} largest difference".

Matching is inflection-aware: "larger", "sharply", "splits", "disagreement" are caught.

Archetypes decide which direction you must state:

| Archetype | When | What you must say |
|---|---|---|
| critics-higher | gap >= +10 | a sentence saying critics or Rotten Tomatoes rate it higher than audiences or IMDb |
| audience-higher | gap <= -10 | a sentence saying audiences or IMDb rate it higher than critics or Rotten Tomatoes |
| agreed-high | g < 10, both scaled scores >= 70 | an agreement word: agree, align, line up, within a few points, similar, consistent, closely |
| agreed-low | g < 10, both < 60 | same |
| agreed-mixed | g < 10, otherwise | same |

The direction is detected per sentence from the nearest subject (critics, reviewers, Rotten Tomatoes, RT, Tomatometer, Metascore versus audiences, viewers, fans, users, voters, IMDb) and a comparative (higher, lower, ahead, above, below, behind, stronger, weaker, warmer, cooler, kinder, harsher, "more than", "less than", outscore, beat, trail ...). The film's own title is ignored ("Leave the World Behind" does not count as "behind"). Write one plain sentence such as "Audiences rate it sharply higher than critics" or "Viewers liked it far more than critics did" in both the summary and `why-split`.

Two more direction rules: an explicit comparison that names both sides ("critics rate it higher than audiences", "viewers outscore critics") must never point the wrong way, even next to a correct sentence; and an agree-tier film (gap under 5) must not claim that either side is higher at all.

Always forbidden words (any tier): polarizing/polarising, overrated, underrated, masterpiece, must-watch, flop, "critics hated", "audiences hated", best, worst. Write "highest" or "lowest" for computed facts. One exception: an award category name that starts with "Best" followed by a capitalised word ("Best Original Screenplay") is allowed, but only in a sentence that carries `{{cite:id}}`.

## 6. Sections, ids and word budgets

Prose total (summary + all section paragraphs + FAQ answers; headings, h1 and FAQ questions excluded; a token counts as one word): 600-900 words. Aim for 750 or more (750-850 is the target). The lint fails below 600 and above 900 words, and prints a `WARN [prose-aim]` line (the article still passes, exit code 0) when the total is under 700. Treat the warning as work to do: add a useful paragraph, not filler. At least 450 words must be unique (not inside a 5-word run shared with another article).

| Section id | Required | Words | Purpose |
|---|---|---|---|
| `why-split` | yes | 150-260 | which side scored higher and by how much (tier wording, `{{gapAbs}}`), plus at least 2 film-specific evidence points (see below) |
| `the-film` | yes | 80-160 | one own-words plot sentence, director, three billed leads from OMDb, runtime, Netflix chart facts as tokens |
| `who-it-suits` | yes | 80-160 | one conditional position derived from data (genre, runtime, rating, archetype); must contain a conditional word (if, when, whether, anyone who, those who, for viewers ...) |
| `more` | no | 0-150 | one extra angle, only if it adds something |
| `data-note` | only if the fact-checker's R15 outcome is `note` | 1-120 | a plain statement that the Rotten Tomatoes site currently shows a figure slightly different from the OMDb figure. No digits (see Section 12). The controller tells you when to add it |

Rules for every section: `id` is one of these five; no duplicate ids; at least one non-empty paragraph; short paragraphs (2-4 sentences); the `heading` is phrased as a question, ends with "?", is 20-80 characters, and is your own wording about this film.

`why-split` needs at least two of these evidence points: Metascore vs RT (`{{metascore}}`), vote volume (`{{votes}}` or `{{votesShort}}`), genre median gap (`{{genreMedianGap}}`), gap rank (`{{gapRank}}`), the OMDb `Awards` text quoted exactly as the brief prints it, including any full stop inside it such as "Won 2 Oscars. 112 wins & 52 nominations total" (an award described in your own words does not count; the string is never split, so quoting it whole also satisfies the must-cite rule for that sentence), or a cited reception fact (`{{cite:id}}`). It must also contain `{{gapAbs}}` or `{{gap}}` and the direction sentence for the archetype.

Safe wordings for two awkward cases (both pass the lint at every tier and are covered by tests):

- Metascore close to the audience score while Rotten Tomatoes is far from it: "At {{metascore}}, the Metascore lands nearer the audience figure than the Rotten Tomatoes percentage does." Use "nearer" or "closer"; do not use "higher" or "lower" here, because the Metascore is a critic-side term and a comparative next to it can read as a claim about the wrong side.
- The genre median points the other way from this film: "The median difference for the {{genreCount}} {{genre}} films in this set is {{genreMedianGap}}, so the typical title in the genre leans the opposite way from this one." Say "difference" instead of "gap" if your tier bans "gap".

Order: the template reorders sections by archetype for display. You can write them in any order; the file order has no effect.

Voice: plain, specific, neutral US English (US spelling). Lead with the answer. One idea per paragraph. Write about the scores and what they suggest, not about your viewing. Use "we" only for method ("we compare"), never for taste or viewing.

## 7. Content rules

- **Plot**: at most one own-words sentence (30 words or fewer), based only on `omdb.plot`. No 6-word run copied from it, and [plot-overlap] also flags a loose paraphrase that reuses the plot's distinctive nouns and verbs in the same order (four or more content words of the plot, in plot order, inside one sentence). Avoid those nouns altogether: describe the premise with different nouns or in broader terms (genre, setting, the relationship between the leads). Nothing beyond it: no twists, endings, scenes, character arcs.
- **Allowed facts**: any film record field (use tokens or exact names), and claims from a cited source on the allowed list (Section 8), with `{{cite:id}}` at the end of the sentence the source supports.
- **Must cite**: release events, festival premieres, award wins or nominations beyond the OMDb `Awards` string, source material (book or comic adaptation), production facts. The lint enforces this per sentence: a sentence containing premiere, festival, based on, adapted, novel, won, nominated, Oscar, BAFTA, Golden Globe, Emmy, filmed or shot in must carry `{{cite:id}}` unless it restates the OMDb `Awards` text exactly. A sentence with "directed" must use `{{director}}` (or a cite).
- **Numbers**: every number is a token. After tokens are removed, body prose (summary, paragraphs, FAQ answers, data-note) may contain digits only inside the film's own title, in a 4-digit year, in "Top 10", in a rating code (PG-13, TV-MA) and in the exact OMDb `Awards` text. "26-point gap", "38 percent", "8 weeks" and "262 million hours" all fail; use `{{gapAbs}} points`, `{{rt}}`, `{{weeksInTop10}} weeks`, `{{hours}} hours`.
- **Other films**: you may name other films qualitatively ("Films such as The Gray Man and Back in Action lean the same way among the genre peers"), for example the genre peers and related films in the brief. You may not attach numbers to them: no scores, gaps, ranks or percentages (there are no tokens for other films, and any typed digit fails [number-literal] or [score-literal]).
- **Forbidden**: availability, region, "on Netflix now", "stream it on Netflix", "watch it on Netflix"; affiliation or endorsement; box office, grosses, budgets or production cost; viewing figures other than the Netflix tokens; quotes from critics or users (any double quotation mark in prose fails); audience demographics; trivia; personal taste ("I", "my", "we think", "we found", "we recommend" ...); any statement about why critics or audiences felt something, written as fact.
- **Gap analysis**: state direction and size with the tier wording, then explain with hedged, data-tied reasons ("The Metascore of {{metascore}} lines up with the critics' side, which suggests ..."). Allowed reason types: Metascore agreement, vote volume, the genre pattern in this set (`{{genreMedianGap}}`), awards text, and the measurement difference (one sentence, link `/compare/imdb-vs-rotten-tomatoes`). Label interpretations as interpretations ("suggests", "may", "one reading").
- **Never claim** "Netflix Original", "available on Netflix", "streaming now", "official", "partnered". Chart facts are worded as "ranked in Netflix's global Top 10" or "in Netflix's Top 10 data".
- **Anti-template**: do not start the summary with "{Title} ({Year}) scores"; vary sentence frames; no stock closing line; do not imitate the worked example (Section 9) or the fixture articles; the score table and the "Where it sits" facts already show the votes and the gap rank, so you do not need frames such as "{{imdb}} from {{votesShort}} votes and {{rt}} on Rotten Tomatoes", "ranks {{gapRank}} of {{setSize}} in this set" or "IMDb reads {{imdbX10}} and Rotten Tomatoes reads {{rt}}" (these were the frames shared most between the first articles); headings are your own questions about this film; do not reuse a heading or opener from another article (at most 5 articles in the whole set may share the same first 4 summary words or the same heading with the film name swapped out).
- **FAQ**: 2 or 3 questions specific to this film, each question containing the film title. If you answer an awards question, restate the OMDb `Awards` text exactly or say that none is listed.

## 8. Sources

Most articles need no sources (`"sources": []`). Add one only when you make a claim that needs it (Section 7, "Must cite").

Allowed: Netflix newsroom or Tudum pages; oscars.org and other awarding bodies' official sites; official festival sites; the film's Wikipedia article only for release dates, premieres, awards and source material.

Banned (the lint rejects these hosts and paths): Reddit, fan wikis (fandom.com, wikia), Quora, Medium, BuzzFeed, Ranker, ScreenRant, CBR, Looper, social networks, IMDb trivia, reviews, quotes, boards, news and parental-guide pages, any Rotten Tomatoes or Metacritic review page. Also banned: AI-generated or listicle sites, review excerpts, and any page you did not open yourself.

Rules: open the page and confirm it states the claim before you cite it. One source per claim minimum. `supports` is the exact claim the source backs, in 200 characters or fewer. Use `https` URLs. Every source in `sources` must be cited by a `{{cite:id}}` somewhere in prose; every `{{cite:id}}` must have a matching source.

Source object, from `tests/blog/fixtures/articles/harbor-lights-2021.json`:

```json
{
  "id": "tudum",
  "url": "https://www.netflix.com/tudum/top10",
  "title": "Netflix Top 10",
  "publisher": "Netflix Tudum",
  "accessed": "2026-10-16",
  "supports": "Netflix publishes weekly Top 10 lists ranked by hours viewed."
}
```

and its use in prose, which ends the supported sentence: `... among the {{setSize}} films here.{{cite:tudum}}`

## 9. Worked example

Full source: `tests/blog/fixtures/worked-example.json` (a fictional film; every value comes from `tests/blog/fixtures/films.json`), shown below in the form you submit (`status: review`, writer fields filled, fact-check fields empty). It passes every rule and has 753 prose words. The same text is stored as the fixture `tests/blog/fixtures/articles/crimson-static-2022.json` with `status: checked` for test purposes; do not copy that. `blog:check` compares your article with this example: read it for structure, not for sentences, and write every frame in your own words.

Film facts that drive it: IMDb 6.4, RT 38%, so gap = 38 - 64 = -26; absolute gap 26 means tier "wide"; negative means archetype "audience-higher"; gap rank 2nd; Metascore 41; 402,310 votes; action genre, 3 films, median gap -8; no awards listed; runtime 118 minutes.

```json
{
  "schemaVersion": 1,
  "slug": "crimson-static-2022",
  "imdbId": "tt9000011",
  "status": "review",
  "published": null,
  "contentUpdated": "2026-10-17",
  "h1": "Crimson Static: why audiences rate it far above critics",
  "description": "With IMDb {{imdb}} from {{votesShort}} votes and only {{rt}} on Rotten Tomatoes, {{title}} shows one of the sharpest score splits in this set.",
  "summary": "Viewers and critics part ways on {{title}}: IMDb users give it {{imdb}}, while Rotten Tomatoes shows only {{rt}}. Audiences therefore rate it sharply higher than critics, a wide gap of {{gapAbs}} points, and the score table on this page shows where that difference places the film in this set. Figures reflect OMDb data as of {{asOf}}, so they will move when the source does.",
  "sections": [
    {
      "id": "why-split",
      "heading": "What lies behind the split on Crimson Static?",
      "paragraphs": [
        "The audience side wins this comparison by a wide margin. Put on one hundred-point scale, the audience average works out to {{imdbX10}} against the critics' {{rt}}, a large gap of {{gapAbs}} points in the audience favor. Audiences rate it sharply higher than critics do, and {{title}} is {{gapRank}} when the set is ordered by the size of the difference.",
        "Critics appear to agree with each other. The Metascore is {{metascore}}, which sits near the Rotten Tomatoes figure instead of near the audience score, so this is not one aggregator being unusually harsh. Meanwhile {{votes}} IMDb votes make the audience figure hard to dismiss as a small-sample effect.",
        "Genre offers a hint about taste. The median difference across the {{genreCount}} {{genre}} films in the set is {{genreMedianGap}}, far smaller than here, which suggests a crowd-pleasing action film can reach viewers that reviewers do not reward in the same way. That is an interpretation, not a measurement.",
        "A measurement difference is also in play. Because the critic number is a share of positive reviews, a film with mixed but mild reactions can score low on it while still earning decent star ratings from viewers, as [this comparison](/compare/imdb-vs-rotten-tomatoes) lays out."
      ]
    },
    {
      "id": "the-film",
      "heading": "Who made Crimson Static and how did it chart?",
      "paragraphs": [
        "The premise is a coastal beacon operator who comes upon a hand-drawn chart. {{director}} directed it, with Rhett Alden, Mila Stroud and Jonas Brandt billed in the lead roles, and it runs {{runtime}}. In the Netflix Top 10 data it reached a peak rank of {{peakRank}} and stayed {{weeksInTop10}} weeks, which puts it {{popularityRank}} among the {{setSize}} films by hours viewed.",
        "OMDb files it under {{genre}} and thriller, with a PG-13 rating, and lists no awards for the title, so we make no awards claim. We also keep the plot to one line on purpose, because the OMDb record is our only source and we do not retell scenes."
      ]
    },
    {
      "id": "who-it-suits",
      "heading": "Who might enjoy Crimson Static most?",
      "paragraphs": [
        "If you want a brisk action thriller and trust viewer scores over critic scores, the audience number here is the more relevant guide. If reviews guide your picks, the critic side deserves more weight, and the film may feel thinner than its {{imdb}} suggests.",
        "At {{runtime}} it is a standard feature length, so the question is taste rather than commitment. Use the pairing as a pointer, not a ruling, because scores describe other people.",
        "One practical test is to read the two numbers as two different questions. The audience figure asks whether many viewers enjoyed the film, and the critic figure asks whether reviewers judged it well made. {{title}} answers the first question far more warmly than the second."
      ]
    },
    {
      "id": "more",
      "heading": "What else shapes how to read these two scores?",
      "paragraphs": [
        "Scores move over time, which is why every figure on this page carries a date. Newer releases can collect early votes from enthusiastic fans before the numbers settle, and critic percentages can shift as late reviews arrive. Check the date above before comparing {{title}} with any other number you see.",
        "Vote counts matter in a second way. A film that reaches a very large audience collects ratings from people who chose it casually, not only from those who sought it out, and a broad pool like that tends to settle on a moderate average. Critics, by contrast, review almost every wide release, so their share of positive reviews reflects a fairly stable group of professional viewers. Keep that difference in who is scoring in mind when the two numbers disagree this much, as they do here."
      ]
    }
  ],
  "faq": [
    {
      "q": "Is the gap on Crimson Static unusual for an action film?",
      "a": "Among the {{genreCount}} {{genre}} films in this set the median difference is {{genreMedianGap}}, while {{title}} shows {{gap}}. That makes it the largest difference inside its genre in this set, and {{gapRank}} overall, so yes, it stands out here."
    },
    {
      "q": "How do the Crimson Static scores compare on one scale?",
      "a": "Converting IMDb to the same scale as Rotten Tomatoes gives {{imdbX10}} against {{rt}}, so the audience side is ahead by {{gapAbs}} points. The conversion simply multiplies the IMDb average by ten, which is the method the rest of this site uses, so the figures here match our other pages."
    },
    {
      "q": "How many people voted for Crimson Static on IMDb?",
      "a": "IMDb shows {{votes}} votes for the film, rounded in our headline figures to {{votesShort}}. A pool of that size makes it unlikely that the score swings on a few ballots, though it says nothing about why people voted as they did."
    }
  ],
  "sources": [],
  "review": {
    "writer": "Claude (writer agent)",
    "writtenOn": "2026-10-20",
    "factChecker": null,
    "factCheckedOn": null,
    "cuts": [],
    "rtCheck": null
  }
}
```

Commentary, field by field:

- `h1`: contains the film title, is inside the 30-90 character range, and takes an angle of its own (not the generated page title, which is built from data as "Crimson Static (2022): IMDb 6.4 vs RT 38%").
- `description`: contains the title, "Rotten Tomatoes" and score tokens; renders to 120-158 characters.
- `summary`: first sentence names the film and has `{{imdb}}` and `{{rt}}`; second sentence states the direction ("Audiences therefore rate it sharply higher than critics"), uses the tier word "wide gap" with `{{gapAbs}}` and points to the score table for the rank instead of restating it; third sentence has `{{asOf}}`. It is inside the 45-75 word range. It does not start with "{Title} (Year) scores".
- `why-split`, paragraph 1: direction and size with wide-tier wording ("by a wide margin", "a large gap", "sharply higher"). Paragraph 2: Metascore evidence (`{{metascore}}`) and vote volume (`{{votes}}`). Paragraph 3: genre evidence (`{{genreMedianGap}}`), labeled "an interpretation, not a measurement". Paragraph 4: the measurement difference, with the one allowed link to `/compare/imdb-vs-rotten-tomatoes`. That is four evidence points where two are required.
- `the-film`: one short plot sentence in the writer's own words ("The premise is a coastal beacon operator who comes upon a hand-drawn chart", which shares no 6-word run with the OMDb plot), `{{director}}`, three leads spelled exactly as OMDb, `{{runtime}}`, and Netflix chart facts as tokens. The second paragraph states there are no listed awards instead of inventing any.
- `who-it-suits`: conditional ("If you want ... If reviews guide your picks ..."), tied to data (genre, runtime), no personal viewing claim.
- `more`: optional; adds two points (scores move over time, and who is scoring) and no new facts.
- `faq`: three questions, each containing "Crimson Static"; answers are 35-90 words and reuse tokens only.
- `sources`: empty because every claim is a token or a field of the film record.
- `review`: writer fills `writer` and `writtenOn`; everything else stays null or empty.

## 10. Fields the brief fills in for you

Do not guess these; read them from `npm run blog:brief -- {slug}`: the exact title and tier, the archetype, which tokens are NULL, whether `shortTitle` is needed (the line `this film needs a shortTitle: yes/no`; the set-wide count in the NOTES section is for the controller), whether R15 will apply, the genre peers (useful for the "genre pattern" evidence), the section order, and the list of banned phrases.

R15 (a Rotten Tomatoes hand check) applies when abs(gap) >= 30, when IMDb votes are under 25,000, or for pilot films. The brief states `pilot film: yes/no` (the pilot films are kpop-demon-hunters-2025, red-notice-2021 and carry-on-2024). You do not perform it; the fact-checker does. If a check results in `note`, the controller will send the article back to you to add a `data-note` section.

## 11. Banned phrases

Never use any of these (case-insensitive; the straight and curly apostrophe are equal):

delve, it's (or it is) important to note, in today's, whether you're (or whether you are), a testament to, tapestry, rollercoaster (or roller coaster), buckle up, at the end of the day, in conclusion, edge-of-your-seat, cinematic journey, stands as, boasts, gripping, captivating, must-see, elevate, showcase, navigate, landscape, look no further, without further ado, a feast for.

Also rejected as claims: "Netflix Original(s)" (also "Netflix-original"), "available on/to stream on Netflix", "streaming now", "now streaming", "on Netflix now/today/in", "stream(s/ing) (it) on Netflix", "watch (it) on Netflix", "official" / "officially", "partner", "partnered", "partnership", "box office", "budget", "grossed", "cost ... to make", personal viewing claims ("I watched", "we loved", "we saw", "we enjoyed" ...), personal taste ("I", "my", "we think", "we feel", "we found", "we believe", "we recommend", "we love"), and any double quotation mark (no quotes from critics or users). Your film's own title is masked before these checks, so a title such as "I Care a Lot" is fine.

## 12. Common mistakes (what actually fails)

Each item is a real lint rule. The rule id appears in brackets in the `blog:check` output.

1. **Score-like literals and typed numbers** [score-literal], [number-literal]. A decimal like `6.3`, a percentage like `36%`, or a number followed by "point(s)" (`12 points`) anywhere in prose; and any other digit in body prose (summary, paragraphs, FAQ answers, data-note) outside a token, a 4-digit year, "Top 10", a rating code or the exact OMDb `Awards` text: "26-point gap", "38 percent", "64 versus 38", "8 weeks". Use tokens: `{{imdb}}`, `{{rt}}`, `{{gapAbs}} points`, `{{weeksInTop10}} weeks`. This also bites `data-note`: do not write the Rotten Tomatoes site figure; say "a few points" in words.
2. **Banned phrases** [banned-phrase]. Anything in Section 11. "landscape", "navigate", "elevate", "showcase" and "boasts" are the usual accidents.
3. **Forbidden words** [forbidden-word]: best, worst, polarizing, overrated, underrated, masterpiece, must-watch, flop. "best" also fires inside "best known" and "best suited" (a documented false failure, kept on purpose); reword ("known mainly for"). A cited award category ("Best Original Screenplay{{cite:oscars}}") is the only allowed "Best".
4. **Forbidden claims** [forbidden-claim]: "official" (also "official trailer": a documented false failure, kept on purpose), "partnered", "box office", "budget", "grossed", "Netflix Original", "available on Netflix", "streaming now", "stream it on Netflix", "we watched", "I", "my", "we think", a double quotation mark.
5. **Wrong tier word** [tier-word]. For example "huge" below the very wide tier, "gap", "split" or "far higher" on an agree-tier film, "a clear gap" or "noticeably" on a slight gap, "wide", "large" or "sharply" below the wide tier, "very wide" at the wide tier, "widest" outside gap rank 10 or better. Use the table in Section 5.
6. **Dashes, arrows and glyphs** [forbidden-char]. No em dash, en dash, figure dash, horizontal bar or minus sign (U+2212) (use a comma, colon or hyphen with spaces), no arrows (ASCII ones made of a hyphen or equals sign plus an angle bracket, or arrow glyphs), no bullet or middle dot, no emoji, no hex colors like `#fff` or `#1a2b3c`, no invisible characters (soft hyphen, zero-width space). This applies to every string in the file, including `sources` titles and `review` text. Copy-pasting text from web pages is the usual cause.
7. **Plot copying** [plot-overlap]. Any 6-word run (ignoring case and punctuation) that also appears in `omdb.plot`, or a sentence that follows the plot with small swaps (four or more of its content words, in the plot's order, even if the sentence reads as your own). Drop the plot's distinctive nouns instead of swapping synonyms around them, and keep to one sentence of 30 words or fewer.
8. **Markup** [markup]. HTML tags, `**bold**`, `__x__`, backticks, markdown headings (`#`), list items starting with `-`, `*` or `+`, images. Only plain text, tokens and `[anchor](/path)` links.
9. **Missing cite for a source, or a stray cite** [source-unused], [cite]. A source never cited with `{{cite:id}}`, or a `{{cite:id}}` whose id is not in `sources`.
10. **Unsupported claims** [must-cite]. Any claim beyond the film record that is not from a cited allowed source: release events, awards beyond the OMDb string, source material, production facts, anything about reception stated as fact. The lint catches the marker words listed in Section 7 ("Must cite") and a "directed" sentence without `{{director}}`; the fact-checker deletes the rest. Do not write them.
11. **Banned source** [source-banned]. Reddit, fan wikis, IMDb trivia or reviews, RT or Metacritic review pages, social sites, and non-https URLs.
12. **Too many internal links, or unregistered target** [link-count], [link-target], [link-external]. At most 3 internal links; each is `[anchor](/path)` with a registered path; no external URLs in prose; anchor text must not be empty.
13. **Cannibalizing phrase** [cannibalise]. `h1` or `description` that contains "IMDb vs Rotten Tomatoes" without the film name.
14. **Missing or contradictory direction** [summary / why-split]. The summary and `why-split` must state the archetype's direction (or agreement). A sentence like "Critics are lower than audiences" counts; a vague "the scores differ" does not. An explicit comparison pointing the wrong way fails even next to a correct one, and an agree-tier film may not say either side is higher.
15. **`why-split` too thin** [why-split]. It needs at least two evidence points, a `{{gapAbs}}` or `{{gap}}`, and the direction sentence.
16. **`who-it-suits` not conditional** [who-it-suits]. Include an if, when, whether, "anyone who" or "for viewers" construction.
17. **Headings that are not questions or are the wrong length** [heading]. Must end with "?" and be 20-80 characters after tokens render.
18. **Length misses** [section-length], [prose-length], [unique-words]. Check each section budget (Section 6), the 45-75 word summary, 35-90 word FAQ answers, and the 600-900 word prose total. Under 700 words is only a `WARN [prose-aim]` (it passes); under 600 or over 900 fails.
19. **Templated sameness** [shared-ratio], [jaccard], [content-jaccard], [summary-jaccard], [h1-unique], [description-unique]. [content-jaccard] compares 5-word runs with filler and function words removed, so inserting "also" or "indeed" into copied text does not hide it. Different openers, different sentence frames and different heading wording per film. Tokens count as words, so a frame like "{{title}} earns {{imdb}} on IMDb but only {{rt}}" repeated across articles is treated as shared text.
20. **Null token** [token]. Using `{{metascore}}`, `{{peakRank}}`, `{{genreMedianGap}}` or `{{director}}` when the brief shows NULL. Write that sentence without the token or choose another evidence point.
21. **`shortTitle` problems** [short-title]. Missing when the generated title would exceed 50 characters, more than 29 characters, or not recognizably the OMDb title: it must be an ordered subset of the title's words with at least two content words ("Glass Onion", "Rebel Moon Part Two"), or one distinctive first word of 5 letters or more ("Avengers"). "The", "Man" or "Part Two" alone fail.
22. **`h1` equals the generated title, or lacks the film name** [h1].
23. **Wrong review/status fields** [status], [published], [review], [rt-check]. `published` must stay `null`; `factChecker` and `factCheckedOn` must stay `null` for you; do not invent an `rtCheck`.
24. **Wrong identifiers** [slug], [imdb-id], [film-missing], [identity-doubtful]. Copy `slug` and `imdbId` from the brief; the filename must be `{slug}.json`. [identity-doubtful] means the film's IMDb match still waits for a human decision (data/blog/source/doubtful.json); report it to the controller, it is not yours to fix.
25. **Unknown keys.** Do not add fields (no `notes`, no `tags`).

## 13. Final checklist before you set `status: review`

- `npm run blog:check -- {slug}` exits 0 with seven PASS lines.
- `published` is `null`, `factChecker` and `factCheckedOn` are `null`, `cuts` is `[]`, `rtCheck` is `null`.
- Every name (director, actors) matches `omdb` in the brief exactly.
- Every sentence is a token or field, a cited claim, or a hedged interpretation tied to data. If you cannot say which, delete it.
- No other file was created or edited.
