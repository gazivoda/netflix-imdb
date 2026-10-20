// Permanent version of the combined infra review's adversarial harness
// (.superpowers/sdd/blog-top-100, review "COMBINED INFRA REVIEW"): every case the review
// marked MISSED must be caught, every legitimate sentence it marked as a false failure must
// pass, and the two documented false failures stay failing on purpose.
import { checkArticle, type CheckInputs } from '../../lib/blog/check';
import { loadWorkedExampleEntry } from '../../lib/blog/check-inputs';
import { validateArticleSchema } from '../../lib/blog/schema';
import { lintCopy } from '../../lib/blog/lint';
import { buildStats } from '../../lib/blog/stats';
import type { Article, Film } from '../../lib/blog/types';
import { PAGES } from '../../lib/pages';
import { clone, loadFixtureArticles, loadFixtureFilms } from './fixtures';

const films = loadFixtureFilms();
const stats = buildStats(films);
const base = Object.fromEntries(loadFixtureArticles().map((a) => [a.slug, a])) as Record<string, Article>;
const registeredPaths = PAGES.map((p) => p.path);
const film = (slug: string): Film => films.find((f) => f.slug === slug)!;
const sec = (a: Article, id: string) => a.sections.find((s) => s.id === id)!;

function findings(article: Article, opts: Partial<CheckInputs> & { only?: Article[] } = {}): string[] {
  const list = opts.only ?? [...Object.values(base).filter((o) => o.slug !== article.slug), ...(opts.articles ?? []), article];
  const r = checkArticle(article, { films, stats, registeredPaths, ...opts, articles: list });
  return r.sections.flatMap((s) => s.issues.map((i) => `${s.name}:${i.rule}`));
}

/** Append a sentence to the optional "more" section (0-150 words). */
function withMore(slug: string, sentence: string): Article {
  const a = clone(base[slug]);
  let m = a.sections.find((s) => s.id === 'more');
  if (!m) {
    m = { id: 'more', heading: `What else should readers know about ${film(slug).omdb.title}?`, paragraphs: [''] };
    a.sections.push(m);
  }
  m.paragraphs = [`${m.paragraphs[0]} ${sentence}`.trim()];
  return a;
}

const LENGTH_RULES = /prose-length|section-length|unique-words|shared-ratio|jaccard/;
const relevant = (f: string[]) => f.filter((x) => !LENGTH_RULES.test(x));

describe('adversarial cases the review marked MISSED are caught', () => {
  const cases: [string, Article, RegExp][] = [
    ['score literal "26-point gap"', withMore('crimson-static-2022', 'That is a 26-point gap.'), /number-literal/],
    ['score literal "38 percent"', withMore('crimson-static-2022', 'Only 38 percent of critics were positive.'), /number-literal/],
    ['integers "64 ... 38"', withMore('crimson-static-2022', 'On the same scale viewers give it 64 while critics give it 38.'), /number-literal/],
    ['typed viewing figure "262 million hours ... 8 weeks"', withMore('crimson-static-2022', 'It drew 262 million hours of viewing and spent 8 weeks in the chart.'), /number-literal/],
    ['"It is important to note"', withMore('crimson-static-2022', 'It is important to note that critics agree with each other.'), /banned-phrase/],
    ['"whether you are"', withMore('crimson-static-2022', 'Whether you are an action fan or not, the scores tell a story.'), /banned-phrase/],
    ['clear tier uses wide/large/sharply', withMore('harbor-lights-2021', 'This is a wide and large difference, and critics rate it sharply higher.'), /tier-word/],
    ['slight tier uses "a clear gap ... disagree ... noticeably"', withMore('salt-and-iron-2019', 'There is a clear gap here and the two sides disagree noticeably.'), /tier-word/],
    ['wide tier uses huge/massive', withMore('crimson-static-2022', 'It is a huge, massive difference.'), /tier-word/],
    ['figure dash U+2012 and minus U+2212', withMore('crimson-static-2022', 'Critics were cooler ‒ noticeably so, a − sign.'), /forbidden-char/],
    ['plot copy with one word changed', withMore('crimson-static-2022', 'It follows a lighthouse keeper that finds a map.'), /plot-overlap/],
    ['uncited festival and award claim', withMore('crimson-static-2022', 'It premiered at the Venice Film Festival, where it won the Golden Lion, and it is based on a novel.'), /must-cite/],
    ['availability "stream it on Netflix in most regions"', withMore('crimson-static-2022', 'You can stream it on Netflix in most regions today.'), /forbidden-claim/],
    ['availability "is streaming on Netflix"', withMore('crimson-static-2022', 'The film is streaming on Netflix.'), /forbidden-claim/],
    ['availability "watch it on Netflix now"', withMore('crimson-static-2022', 'You can watch it on Netflix tonight.'), /forbidden-claim/],
    ['personal taste "We think ... I found it"', withMore('crimson-static-2022', 'We think it is a fun ride, and I found it charming.'), /forbidden-claim/],
    ['personal taste "my"', withMore('crimson-static-2022', 'It is a favorite of my household.'), /forbidden-claim/],
    ['critic quote (curly)', withMore('crimson-static-2022', '“A propulsive, silly ride,” one critic wrote.'), /forbidden-claim/],
    ['critic quote (straight)', withMore('crimson-static-2022', 'One critic called it "a silly ride".'), /forbidden-claim/],
    ['wrong director name (no {{director}} token, no cite)', withMore('crimson-static-2022', 'Steven Spielberg directed it.'), /must-cite/],
    ['box office invented', withMore('crimson-static-2022', 'It cost a fortune to make and grossed more than any rival.'), /forbidden-claim/],
    ['"Netflix-original" hyphenated', withMore('crimson-static-2022', 'It is a Netflix-original thriller.'), /forbidden-claim/],
  ];
  it.each(cases)('%s', (_name, article, rule) => {
    expect(relevant(findings(article)).join(' ')).toMatch(rule);
  });

  it('why-split evidence from an invented award ("won two festival awards") does not count', () => {
    const a = clone(base['crimson-static-2022']);
    sec(a, 'why-split').paragraphs[1] =
      'Critics appear to agree with each other, and the film won two festival awards in its first year, which reviewers often reward. Meanwhile a very broad audience vote makes the audience figure hard to dismiss as a small-sample effect.';
    expect(relevant(findings(a)).join(' ')).toMatch(/must-cite/);
  });

  it('wrong direction in the summary only', () => {
    const a = clone(base['crimson-static-2022']);
    a.summary = a.summary.replace('Audiences therefore rate it sharply higher than critics', 'Critics therefore rate it sharply higher than audiences');
    expect(findings(a)).toContain('schema:summary');
  });

  it('contradictory direction: a right and a wrong sentence', () => {
    const a = clone(base['crimson-static-2022']);
    a.summary = a.summary.replace('Audiences therefore rate it sharply higher than critics', 'Audiences rate it sharply higher than critics, and critics rate it higher than audiences');
    sec(a, 'why-split').paragraphs[0] += ' Critics rate it higher than viewers.';
    const f = findings(a);
    expect(f).toContain('schema:summary');
    expect(f).toContain('copy:why-split');
  });

  it('agree-tier article claims critics far higher', () => {
    const a = clone(base['the-quiet-orchard-2023']);
    sec(a, 'why-split').paragraphs[0] += ' Critics rate it far higher than audiences.';
    const f = findings(a);
    expect(f).toContain('copy:why-split');
    expect(f).toContain('copy:tier-word');
  });

  it('near-duplicate spun with a filler word every 4 words', () => {
    const a = clone(base['crimson-static-2022']);
    a.slug = 'velvet-orbit-2023';
    a.imdbId = film('velvet-orbit-2023').omdb.imdbId;
    a.status = 'review';
    const swap = (t: string) => t.replace(/Crimson Static/g, 'Velvet Orbit');
    const fillers = ['indeed', 'here', 'also', 'then'];
    const spin = (t: string) =>
      t
        .split(' ')
        .map((w, i) => (i % 4 === 3 ? `${w} ${fillers[Math.floor(i / 4) % 4]}` : w))
        .join(' ');
    a.h1 = 'Velvet Orbit: audiences far warmer than the critics are';
    a.description = swap(a.description);
    a.summary = spin(swap(a.summary));
    a.sections.forEach((s, i) => {
      s.paragraphs = s.paragraphs.map((p) => spin(swap(p)));
      s.heading = [
        'Why do the two Velvet Orbit scores differ so much?',
        'Who made Velvet Orbit and how did it chart in the end?',
        'Which viewers might get the most out of Velvet Orbit?',
        'What else affects how to read the Velvet Orbit numbers?',
      ][i];
    });
    a.faq.forEach((f) => {
      f.q = swap(f.q);
      f.a = spin(f.a);
    });
    expect(findings(a)).toContain('similarity:content-jaccard');
  });

  it('a near-identical draft is caught with includeDrafts (blog:check --all), not by default', () => {
    const draft = clone(base['crimson-static-2022']);
    draft.slug = 'velvet-orbit-2023';
    draft.imdbId = film('velvet-orbit-2023').omdb.imdbId;
    draft.status = 'draft';
    const target = clone(base['crimson-static-2022']);
    expect(findings(target, { only: [target, draft] }).filter((x) => x.startsWith('similarity'))).toEqual([]);
    expect(findings(target, { only: [target, draft], includeDrafts: true })).toContain('similarity:jaccard');
  });
});

describe('legitimate writing the review marked as false failures passes', () => {
  const ok = (a: Article) => expect(findings(a)).toEqual([]);

  it('a cited award category name beginning with "Best"', () => {
    const a = withMore('harbor-lights-2021', 'It was nominated for Best Original Screenplay{{cite:oscars}}.');
    a.sources.push({ id: 'oscars', url: 'https://www.oscars.org/oscars/ceremonies/2022', title: 'Nominees and winners', publisher: 'Academy of Motion Picture Arts and Sciences', accessed: '2026-10-19', supports: 'Nominated for Best Original Screenplay' });
    ok(a);
  });
  it('the same "Best" name without a cite still fails', () => {
    expect(findings(withMore('harbor-lights-2021', 'It was up for Best Original Screenplay.'))).toContain('copy:forbidden-word');
  });
  it('agree tier: "wide release", "big screen", "generation gap"', () => {
    ok(withMore('the-quiet-orchard-2023', 'It had a wide release before reaching streaming, and it was shot for the big screen.'));
    ok(withMore('the-quiet-orchard-2023', 'The story turns on a generation gap within one family.'));
  });
  it('direction phrased "Viewers liked it far more than critics did"', () => {
    const a = clone(base['crimson-static-2022']);
    a.summary = a.summary.replace('Audiences therefore rate it sharply higher than critics', 'Viewers liked it far more than critics did');
    ok(a);
  });
  it.each([
    ['Viewers outscore critics on this one by {{gapAbs}} points.'],
    ['Critics trail the audience here.'],
    ['IMDb users were kinder than critics.'],
  ])('extended direction phrasing passes the why-split check: %s', (sentence) => {
    const a = clone(base['crimson-static-2022']);
    sec(a, 'why-split').paragraphs[0] = sec(a, 'why-split').paragraphs[0].replace('Audiences rate it sharply higher than critics do, and', `${sentence} Also,`);
    expect(findings(a).filter((x) => /why-split/.test(x))).toEqual([]);
  });
  it('every fixture article and the worked example pass unchanged', () => {
    for (const a of Object.values(base)) expect(findings(a)).toEqual([]);
    const worked = loadWorkedExampleEntry()!;
    expect(findings(worked.article, { only: Object.values(base).filter((o) => o.slug !== worked.article.slug).concat(worked.article) })).toEqual([]);
  });
});

describe('documented false failures (kept on purpose, see WRITER-BRIEF section 12)', () => {
  it('"best known for" fails: write "known mainly for"', () => {
    expect(findings(withMore('crimson-static-2022', 'Its director is best known for television work.'))).toContain('copy:forbidden-word');
  });
  it('"official trailer" fails: "official" is banned in any sense', () => {
    expect(findings(withMore('crimson-static-2022', 'The official trailer arrived a month before release.'))).toContain('copy:forbidden-claim');
  });
});

describe("the film's own title never trips a rule (masked first)", () => {
  /** Rename the crimson fixture film and rewrite its article with the new title. */
  function retitled(title: string, opts: { shortTitle?: string } = {}) {
    const f = clone(film('crimson-static-2022'));
    f.omdb.title = title;
    const fs2 = films.map((x) => (x.slug === f.slug ? f : x));
    const st = buildStats(fs2);
    const a = clone(base['crimson-static-2022']);
    const swap = (t: string) => t.replace(/Crimson Static/g, opts.shortTitle ?? title);
    if (opts.shortTitle) a.shortTitle = opts.shortTitle;
    a.h1 = swap(a.h1);
    a.sections.forEach((s) => (s.heading = swap(s.heading)));
    a.faq.forEach((q) => (q.q = swap(q.q)));
    return { a, f, st: st[f.slug] };
  }

  it.each([["Mr. Harrigan's Phone"], ['The Super Mario Bros. Movie'], ['K.O.'], ["Dr. Seuss' The Grinch"]])(
    'dotted title %s: the summary first sentence still names the film and holds {{imdb}} and {{rt}}',
    (title) => {
      const { a, f, st } = retitled(title);
      a.summary = `${title} earns {{imdb}} on IMDb from {{votesShort}} votes, but Rotten Tomatoes shows only {{rt}}. Audiences therefore rate it sharply higher than critics, a wide gap of {{gapAbs}} points. Figures reflect OMDb data as of {{asOf}}, so they will move when the source does and the table shows the rest.`;
      expect(validateArticleSchema(a, { film: f, stats: st }).filter((i) => i.rule === 'summary')).toEqual([]);
    },
  );

  it('a curly apostrophe in the h1 or FAQ matches a straight one in the OMDb title', () => {
    const { a, f, st } = retitled("Mr. Harrigan's Phone");
    a.h1 = 'Mr. Harrigan’s Phone: why audiences rate it far above critics';
    a.faq[0].q = 'Is the gap on Mr. Harrigan’s Phone unusual for an action film?';
    const rules = validateArticleSchema(a, { film: f, stats: st }).map((i) => i.rule);
    expect(rules).not.toContain('h1');
    expect(rules).not.toContain('faq');
  });

  it('a title containing "I", a digit and a comparative ("I Am Mother 2: Leave the World Behind")', () => {
    const { a, f, st } = retitled('I Am Mother 2: Leave the World Behind', { shortTitle: 'I Am Mother 2' });
    sec(a, 'more').paragraphs[0] += ' I Am Mother 2 sits in the same genre as several films here.';
    const lint = lintCopy(a, { film: f, stats: st }).map((i) => `${i.rule}:${i.message}`);
    expect(lint.filter((x) => /forbidden-claim|number-literal|why-split/.test(x))).toEqual([]);
  });

  it('a title with a quote character does not count as a critic quote', () => {
    const { a, f, st } = retitled('The "Burial"');
    sec(a, 'more').paragraphs[0] += ' The "Burial" is listed under drama as well.';
    expect(lintCopy(a, { film: f, stats: st }).filter((i) => i.rule === 'forbidden-claim')).toEqual([]);
  });

  it('years, "Top 10", rating codes and the OMDb awards text are allowed digits', () => {
    const a = withMore('harbor-lights-2021', 'It first charted in 2022, stayed in the Top 10 for a while, carries a PG-13 or TV-MA style rating, and OMDb lists 2 nominations total.');
    expect(findings(a).filter((x) => /number-literal|must-cite/.test(x))).toEqual([]);
  });
});
