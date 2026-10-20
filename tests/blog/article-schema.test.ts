import { validateArticleSchema, REQUIRED_SECTIONS } from '../../lib/blog/schema';
import { buildStats } from '../../lib/blog/stats';
import type { Article } from '../../lib/blog/types';
import { clone, filmBySlug, loadFixtureArticles, loadFixtureFilms } from './fixtures';
import { loadCorpus } from './fixtures/corpus';
import { loadDoubtfulIds } from '../../lib/blog/check-inputs';
import { defaultFilmsPath } from '../../lib/blog/load';

const films = loadFixtureFilms();
const stats = buildStats(films);
const articles = loadFixtureArticles();
const base = articles.find((a) => a.slug === 'harbor-lights-2021')!; // published, with a source
const crimson = articles.find((a) => a.slug === 'crimson-static-2022')!; // checked, has `more`

const run = (a: unknown, slug = (a as Article).slug, extra: { fileName?: string } = {}) => {
  const film = films.find((f) => f.slug === slug);
  return validateArticleSchema(a, { film, stats: film ? stats[film.slug] : undefined, ...extra });
};
const rules = (a: unknown, slug?: string) => run(a, slug).map((i) => i.rule);
const mutated = (src: Article, fn: (a: Article) => void): Article => {
  const a = clone(src);
  fn(a);
  return a;
};

describe('fixture articles match the 3.1 schema', () => {
  it.each(articles.map((a) => [a.slug, a] as const))('%s has no schema issues', (slug, a) => {
    expect(run(a, slug, { fileName: `${slug}.json` })).toEqual([]);
  });
});

describe('structure', () => {
  it('rejects non-objects, wrong types and unknown keys', () => {
    expect(rules(null, 'harbor-lights-2021')).toContain('type');
    expect(rules({ ...base, schemaVersion: 2 })).toContain('type');
    expect(rules({ ...base, extra: 1 })).toContain('unknown-key');
    expect(rules({ ...base, h1: 5 })).toContain('type');
    expect(rules({ ...base, sections: 'x' })).toContain('type');
    expect(rules({ ...base, faq: [{ q: 'x' }] })).toContain('type');
  });

  it('requires slug to match the file name and a film, and imdbId to match the film', () => {
    expect(run(base, base.slug, { fileName: 'other.json' }).map((i) => i.rule)).toContain('slug');
    expect(rules(mutated(base, (a) => (a.slug = 'unknown-2000')), 'unknown-2000')).toContain('film-missing');
    expect(rules(mutated(base, (a) => (a.imdbId = 'tt0000001')))).toContain('imdb-id');
  });
});

describe('status, dates and review block', () => {
  it('rejects an invalid status and inconsistent published dates', () => {
    expect(rules(mutated(base, (a) => ((a as unknown as { status: string }).status = 'done')))).toContain('status');
    expect(rules(mutated(base, (a) => (a.published = null)))).toContain('published'); // published without a date
    expect(rules(mutated(crimson, (a) => (a.published = '2026-10-20')))).toContain('published'); // date without published
    expect(rules(mutated(base, (a) => (a.published = '2026-13-40')))).toContain('date');
    expect(rules(mutated(base, (a) => (a.contentUpdated = '2026-1-1')))).toContain('date');
  });

  it('requires a fact-checker once status is checked or published', () => {
    expect(rules(mutated(crimson, (a) => (a.review.factChecker = null)))).toContain('review');
    expect(rules(mutated(base, (a) => (a.review.factCheckedOn = null)))).toContain('review');
    const draft = mutated(crimson, (a) => ((a.status = 'review'), (a.review.factChecker = null), (a.review.factCheckedOn = null)));
    expect(rules(draft)).toEqual([]);
  });

  it('validates rtCheck consistency with the film RT percent', () => {
    const film = filmBySlug('crimson-static-2022'); // RT 38
    const check = (sitePercent: number, outcome: 'match' | 'note' | 'hold') => ({
      checkedOn: '2026-10-18',
      url: 'https://www.rottentomatoes.com/m/crimson_static',
      rtSitePercent: sitePercent,
      rtSiteReviews: 120,
      outcome,
    });
    const withCheck = (c: ReturnType<typeof check>, status: Article['status'] = 'review') =>
      mutated(crimson, (a) => ((a.review.rtCheck = c), (a.status = status), (a.review.factChecker = null), (a.review.factCheckedOn = null)));
    expect(film.omdb.rtPercent).toBe(38);
    expect(rules(withCheck(check(39, 'match')))).toEqual([]);
    expect(rules(withCheck(check(39, 'note')))).toContain('rt-check'); // 1 point is a match, not a note
    expect(rules(withCheck(check(45, 'match')))).toContain('rt-check'); // 7 points needs a note
    expect(rules(withCheck(check(45, 'note')))).toContain('section'); // note requires the data-note section
    expect(rules(withCheck(check(60, 'note')))).toContain('rt-check'); // 22 points is a hold
    expect(rules(withCheck(check(60, 'hold'), 'review'))).toEqual([]);
    expect(rules(withCheck(check(60, 'hold'), 'published'))).toContain('rt-check'); // hold cannot be published
  });

  it('requires an RT check from status checked for gaps of 30+ or fewer than 25,000 votes (R15)', () => {
    // velvet-orbit gap is -33: use its film with a checked article body
    const velvetArticle = mutated(crimson, (a) => ((a.slug = 'velvet-orbit-2023'), (a.imdbId = 'tt9000020')));
    expect(rules(velvetArticle, 'velvet-orbit-2023')).toContain('rt-check');
    const asReview = mutated(velvetArticle, (a) => ((a.status = 'review'), (a.review.factChecker = null), (a.review.factCheckedOn = null)));
    expect(rules(asReview, 'velvet-orbit-2023')).not.toContain('rt-check');
  });
});

describe('h1, shortTitle, description, summary', () => {
  it('h1 is 30 to 90 chars, names the film and differs from the generated title', () => {
    expect(rules(mutated(base, (a) => (a.h1 = 'Harbor Lights')))).toContain('h1'); // too short
    expect(rules(mutated(base, (a) => (a.h1 = 'x'.repeat(95))))).toContain('h1');
    expect(rules(mutated(base, (a) => (a.h1 = 'Why do critics love this particular drama so much?')))).toContain('h1'); // no film name
    expect(rules(mutated(base, (a) => (a.h1 = 'Harbor Lights (2021): IMDb 7.8 vs RT 91%')))).toContain('h1'); // equals generated title
  });

  it('shortTitle is at most 29 chars and a recognisable form of the OMDb title', () => {
    expect(rules(mutated(base, (a) => (a.shortTitle = 'Harbor Lights')))).toEqual([]);
    expect(rules(mutated(base, (a) => (a.shortTitle = 'Lights of Harbor')))).toContain('short-title');
    expect(rules(mutated(base, (a) => (a.shortTitle = 'Harbor Lights Harbor Lights Harbor Lights')))).toContain('short-title');
  });

  it('requires shortTitle when no title form fits in 50 characters', () => {
    const long = mutated(base, (a) => (a.h1 = 'Why critics rate The Incredibly Long Harbor Lights Epic above audiences'));
    const film = clone(filmBySlug('harbor-lights-2021'));
    film.omdb.title = 'The Incredibly Long Harbor Lights Epic';
    const issues = validateArticleSchema(long, { film, stats: stats['harbor-lights-2021'] });
    expect(issues.map((i) => i.rule)).toContain('short-title');
  });

  it('description is 120 to 158 rendered chars with the film, "Rotten Tomatoes" and a score token', () => {
    expect(rules(mutated(base, (a) => (a.description = '{{title}} on Rotten Tomatoes {{rt}}.')))).toContain('description'); // short
    expect(rules(mutated(base, (a) => (a.description = 'x '.repeat(100))))).toContain('description'); // long
    const noRt = '{{title}} has {{imdb}} on IMDb and a lot of other scores that readers might want to see on one page, compared side by side here for you.';
    expect(rules(mutated(base, (a) => (a.description = noRt)))).toContain('description');
    const noFilm = 'This drama has {{imdb}} on IMDb and {{rt}} on Rotten Tomatoes, a pair of scores that readers might like to compare side by side on one page here.';
    expect(rules(mutated(base, (a) => (a.description = noFilm)))).toContain('description');
    const noScore = '{{title}} is a drama with scores on IMDb and Rotten Tomatoes, a pair of numbers that readers might like to compare side by side on one page here, today.';
    expect(rules(mutated(base, (a) => (a.description = noScore)))).toContain('description');
  });

  it('summary is 45 to 75 words with title, {{imdb}}, {{rt}} in sentence one, {{asOf}} and a direction word', () => {
    expect(rules(mutated(base, (a) => (a.summary = '{{title}} has {{imdb}} and {{rt}}, {{asOf}}.')))).toContain('summary');
    const long = Array(80).fill('word').join(' ');
    expect(rules(mutated(base, (a) => (a.summary = `{{title}} {{imdb}} {{rt}} {{asOf}} critics higher ${long}`)))).toContain('summary');
    const tail = 'The long second sentence adds enough plain words to reach the minimum count that this field needs to pass the length check for the summary here, and then it keeps going with several more plain words so that no length rule can be the reason for a failure in this particular case.';
    const s = (first: string) => mutated(base, (a) => (a.summary = `${first} ${tail} Scores as of {{asOf}}, critics rate it higher.`));
    expect(rules(s('Harbor Lights is a drama with {{imdb}} on IMDb.'))).toContain('summary'); // no {{rt}} in sentence one
    expect(rules(s('The drama has {{imdb}} on IMDb and {{rt}} on RT.'))).toContain('summary'); // does not name the film
    expect(rules(mutated(base, (a) => (a.summary = a.summary.replace('{{asOf}}', 'today'))))).toContain('summary');
    expect(rules(mutated(base, (a) => (a.summary = a.summary.replace('critics rate it noticeably higher than audiences', 'it is a film'))))).toContain('summary');
  });
});

describe('sections and faq', () => {
  it('requires why-split, the-film and who-it-suits and rejects unknown or duplicate ids', () => {
    for (const id of REQUIRED_SECTIONS) {
      expect(rules(mutated(base, (a) => (a.sections = a.sections.filter((s) => s.id !== id))))).toContain('section');
    }
    expect(rules(mutated(base, (a) => (a.sections[0].id = 'intro')))).toContain('section');
    expect(rules(mutated(base, (a) => a.sections.push(clone(a.sections[0]))))).toContain('section');
  });

  it('enforces the word budget of each section', () => {
    expect(rules(mutated(base, (a) => (a.sections[0].paragraphs = ['too short for why-split.'])))).toContain('section-length');
    expect(rules(mutated(base, (a) => (a.sections[1].paragraphs = [Array(200).fill('word').join(' ')])))).toContain('section-length');
    expect(rules(mutated(crimson, (a) => (a.sections[3].paragraphs = [Array(200).fill('word').join(' ')])))).toContain('section-length'); // more > 150
  });

  it('headings are 20 to 80 chars and phrased as questions', () => {
    expect(rules(mutated(base, (a) => (a.sections[2].heading = 'Who it suits?')))).toContain('heading');
    expect(rules(mutated(base, (a) => (a.sections[2].heading = 'Who is Harbor Lights likely to suit best.')))).toContain('heading');
    expect(rules(mutated(base, (a) => (a.sections[2].heading = 'x'.repeat(90) + '?')))).toContain('heading');
  });

  it('faq has 2 or 3 items, q 25 to 100 chars with the film title, a 35 to 90 words', () => {
    expect(rules(mutated(base, (a) => (a.faq = a.faq.slice(0, 1))))).toContain('faq');
    expect(rules(mutated(base, (a) => a.faq.push(clone(a.faq[0]))))).toContain('faq'); // 4 items
    expect(rules(mutated(base, (a) => (a.faq[0].q = 'Why?')))).toContain('faq');
    expect(rules(mutated(base, (a) => (a.faq[0].q = 'Why do critics and audiences rate this film so differently?')))).toContain('faq'); // no film name
    expect(rules(mutated(base, (a) => (a.faq[0].a = 'Too short.')))).toContain('faq');
    expect(rules(mutated(base, (a) => (a.faq[0].a = Array(100).fill('word').join(' '))))).toContain('faq');
  });
});

describe('sources and related', () => {
  it('validates source fields', () => {
    expect(rules(mutated(base, (a) => (a.sources[0].url = 'http://www.netflix.com/tudum')))).toContain('source');
    expect(rules(mutated(base, (a) => (a.sources[0].url = 'not a url')))).toContain('source');
    expect(rules(mutated(base, (a) => (a.sources[0].supports = 'x'.repeat(201))))).toContain('source');
    expect(rules(mutated(base, (a) => (a.sources[0].accessed = 'yesterday')))).toContain('date');
    expect(rules(mutated(base, (a) => a.sources.push(clone(a.sources[0]))))).toContain('source'); // duplicate id
    expect(rules(mutated(base, (a) => (a.sources = Array.from({ length: 7 }, (_, i) => ({ ...clone(a.sources[0]), id: `s${i}` })))))).toContain('source');
  });

  it('allows at most two writer picks, each with a slug and a reason', () => {
    const rel = (n: number) => Array.from({ length: n }, (_, i) => ({ slug: `x-${i}-2000`, reason: 'same director' }));
    expect(rules(mutated(base, (a) => (a.related = rel(2))))).toEqual([]);
    expect(rules(mutated(base, (a) => (a.related = rel(3))))).toContain('related');
    expect(rules(mutated(base, (a) => (a.related = [{ slug: 'x', reason: '' }])))).toContain('related');
  });
});

describe('real corpus (skipped while data/blog/articles is empty or missing)', () => {
  it('every article matches the schema', () => {
    const corpus = loadCorpus();
    if (!corpus) return;
    for (const a of corpus.articles) {
      const film = corpus.films.find((f) => f.slug === a.slug);
      expect({ slug: a.slug, issues: validateArticleSchema(a, { film, stats: film ? corpus.stats[film.slug] : undefined, fileName: `${a.slug}.json` }) }).toEqual({ slug: a.slug, issues: [] });
    }
  });
  it('no review+ article is about a film whose identity is still DOUBTFUL (C1)', () => {
    const corpus = loadCorpus();
    if (!corpus) return;
    const doubtful = new Set(loadDoubtfulIds(defaultFilmsPath()));
    expect(corpus.articles.filter((a) => doubtful.has(a.imdbId)).map((a) => a.slug)).toEqual([]);
  });
});
