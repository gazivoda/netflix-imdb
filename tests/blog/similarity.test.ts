import {
  LIMITS,
  checkCorpusSimilarity,
  checkSimilarity,
  countWords,
  jaccard,
  makeEntries,
  ngramSet,
  ngrams,
  openerKey,
  headingKeys,
  proseChunks,
  proseWordCount,
  tokenizeWords,
  uniqueWordCount,
  type SimEntry,
} from '../../lib/blog/similarity';
import { buildStats } from '../../lib/blog/stats';
import { clone, loadFixtureArticles, loadFixtureFilms } from './fixtures';
import { loadCorpus } from './fixtures/corpus';
import { loadWorkedExampleEntry } from '../../lib/blog/check-inputs';

const films = loadFixtureFilms();
const stats = buildStats(films);
const articles = loadFixtureArticles();
const entries = makeEntries(articles, films, stats);
const entryOf = (slug: string): SimEntry => entries.find((e) => e.article.slug === slug)!;

describe('primitives', () => {
  it('tokenizeWords lowercases, drops punctuation and link targets, and keeps tokens as one word', () => {
    expect(tokenizeWords("IMDb {{imdb}} is [a guide](/install), isn't it?")).toEqual([
      'imdb',
      'tok_imdb',
      'is',
      'a',
      'guide',
      "isn't",
      'it',
    ]);
    expect(tokenizeWords('Cited{{cite:tudum}} here')).toEqual(['cited', 'tok_cite_tudum', 'here']);
  });

  it('ngrams yields len-4 five-grams and nothing for short input', () => {
    expect(ngrams(['a', 'b', 'c', 'd', 'e', 'f'], 5)).toEqual(['a b c d e', 'b c d e f']);
    expect(ngrams(['a', 'b'], 5)).toEqual([]);
  });

  it('ngramSet does not span chunk boundaries', () => {
    const set = ngramSet([['a', 'b', 'c', 'd', 'e'], ['f', 'g', 'h', 'i', 'j']], 5);
    expect([...set].sort()).toEqual(['a b c d e', 'f g h i j']);
  });

  it('jaccard handles identical, disjoint, partial and empty sets', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
    expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
    expect(jaccard(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd']))).toBeCloseTo(0.5);
    expect(jaccard(new Set(), new Set())).toBe(0);
  });

  it('countWords ignores link targets and counts a token as one word', () => {
    expect(countWords('See [the guide](/compare/imdb-vs-rotten-tomatoes) for {{imdb}} details')).toBe(6);
  });

  it('proseChunks covers summary, section paragraphs and faq answers only', () => {
    const a = articles[0];
    const chunks = proseChunks(a);
    expect(chunks).toContain(a.summary);
    expect(chunks).toContain(a.faq[0].a);
    expect(chunks).not.toContain(a.h1);
    expect(chunks).not.toContain(a.faq[0].q);
    expect(chunks).not.toContain(a.sections[0].heading);
  });

  it('uniqueWordCount excludes words inside five-grams shared with others', () => {
    const chunks = [tokenizeWords('one two three four five six seven eight nine ten')];
    const shared = new Set(['one two three four five']);
    expect(uniqueWordCount(chunks, shared)).toBe(5); // words six..ten remain
    expect(uniqueWordCount(chunks, new Set())).toBe(10);
  });
});

describe('fixture articles satisfy the similarity rules', () => {
  it.each(entries.map((e) => [e.article.slug, e] as const))('%s has prose of 600 to 900 words', (_slug, e) => {
    const n = proseWordCount(e.article);
    expect(n).toBeGreaterThanOrEqual(LIMITS.minProseWords);
    expect(n).toBeLessThanOrEqual(LIMITS.maxProseWords);
  });

  it.each(entries.map((e) => [e.article.slug, e] as const))('%s passes every pairwise check', (_slug, e) => {
    expect(checkSimilarity(e, entries.filter((o) => o !== e))).toEqual([]);
  });

  it('the corpus check passes as a whole', () => {
    expect(checkCorpusSimilarity(entries)).toEqual([]);
  });

  it('pairwise Jaccard on prose stays far under the 0.10 ceiling', () => {
    const grams = entries.map((e) => ngramSet(proseChunks(e.article).map(tokenizeWords), 5));
    for (let i = 0; i < grams.length; i++) {
      for (let j = i + 1; j < grams.length; j++) expect(jaccard(grams[i], grams[j])).toBeLessThan(0.1);
    }
  });
});

describe('violations are detected', () => {
  const copyOf = (slug: string, newSlug: string): SimEntry => {
    const a = clone(entryOf(slug).article);
    a.slug = newSlug;
    return { article: a, film: entryOf(slug).film, stats: entryOf(slug).stats };
  };

  it('flags a verbatim copy (Jaccard 1, shared ratio 1, no unique words)', () => {
    const copy = copyOf('harbor-lights-2021', 'harbor-copy-2021');
    const issues = checkSimilarity(copy, [entryOf('harbor-lights-2021')]);
    const rules = issues.map((i) => i.rule);
    expect(rules).toEqual(expect.arrayContaining(['jaccard', 'shared-ratio', 'unique-words', 'summary-jaccard']));
  });

  it('flags partial reuse of paragraphs through the shared-ratio rule', () => {
    const copy = copyOf('crimson-static-2022', 'crimson-copy-2022');
    const donor = entryOf('harbor-lights-2021').article;
    // paste two Harbor paragraphs (about 130 words) into the Crimson copy
    copy.article.sections[0].paragraphs[1] = donor.sections[0].paragraphs[1];
    copy.article.sections[0].paragraphs[2] = donor.sections[0].paragraphs[2];
    copy.article.sections[1].paragraphs[0] = donor.sections[1].paragraphs[0];
    const issues = checkSimilarity(copy, [entryOf('harbor-lights-2021')]);
    expect(issues.map((i) => i.rule)).toContain('shared-ratio');
  });

  it('flags prose that is too short or too long', () => {
    const short = copyOf('harbor-lights-2021', 'harbor-short-2021');
    short.article.sections[0].paragraphs = short.article.sections[0].paragraphs.slice(0, 1);
    expect(checkSimilarity(short, []).map((i) => i.rule)).toContain('prose-length');
    const long = copyOf('harbor-lights-2021', 'harbor-long-2021');
    long.article.sections[0].paragraphs.push(...long.article.sections[0].paragraphs, ...long.article.sections[0].paragraphs);
    expect(checkSimilarity(long, []).map((i) => i.rule)).toContain('prose-length');
  });

  it('flags duplicate rendered h1 and description', () => {
    const copy = copyOf('salt-and-iron-2019', 'salt-copy-2019');
    // make the prose different so only h1/description collide
    copy.article.summary = 'Totally different opening words here that differ from every other fixture article in this suite, plus {{imdb}} and {{rt}} and {{title}} and {{asOf}} so counts stay near.';
    const issues = checkSimilarity(copy, [entryOf('salt-and-iron-2019')]);
    const rules = issues.map((i) => i.rule);
    expect(rules).toContain('h1-unique');
    expect(rules).toContain('description-unique');
  });

  it('caps the opener shared across articles at 5 and passes at exactly 5', () => {
    const base = entryOf('harbor-lights-2021');
    const mk = (n: number): SimEntry[] =>
      Array.from({ length: n }, (_, i) => {
        const e = copyOf('harbor-lights-2021', `opener-${i}-2021`);
        e.article.h1 = `Opener test headline number ${i} for Harbor Lights fans`;
        e.article.description = `Opener test description ${i} for {{title}}: IMDb {{imdb}} and Rotten Tomatoes {{rt}}, filler text to reach a sensible length for this fake entry here.`;
        return e;
      });
    const withFive = [base, ...mk(4)];
    expect(openerKey(withFive[0])).toBe(openerKey(withFive[1]));
    expect(checkCorpusSimilarity(withFive).filter((i) => i.rule === 'opener-reuse')).toEqual([]);
    const withSix = [base, ...mk(5)];
    expect(checkCorpusSimilarity(withSix).filter((i) => i.rule === 'opener-reuse').length).toBeGreaterThan(0);
  });

  it('caps a section heading reused across articles at 5 (film name replaced by X)', () => {
    const mk = (n: number): SimEntry[] =>
      Array.from({ length: n }, (_, i) => {
        const e = copyOf('harbor-lights-2021', `heading-${i}-2021`);
        e.article.sections[2].heading = 'Who is Harbor Lights likely to suit?';
        e.article.summary = `Variant ${i} ${e.article.summary}`;
        return e;
      });
    expect(headingKeys(mk(1)[0])).toContain('who is x likely to suit');
    expect(checkCorpusSimilarity(mk(5)).filter((i) => i.rule === 'heading-reuse')).toEqual([]);
    expect(checkCorpusSimilarity(mk(6)).filter((i) => i.rule === 'heading-reuse').length).toBeGreaterThan(0);
  });
});

describe('real corpus (skipped while data/blog/articles is empty or missing)', () => {
  it('review-or-later articles are pairwise distinct, and distinct from the WRITER-BRIEF worked example', () => {
    const corpus = loadCorpus();
    if (!corpus) return;
    const real = makeEntries(corpus.articles, corpus.films, corpus.stats);
    const worked = loadWorkedExampleEntry();
    // the same comparison set as `npm run blog:check` (review+ articles plus the worked example)
    expect(checkCorpusSimilarity(worked ? [...real, worked] : real)).toEqual([]);
  });
});

