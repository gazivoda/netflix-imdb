import {
  TOKEN_NAMES,
  TokenError,
  citedIds,
  findTokens,
  renderTokens,
  stripTokens,
  tokenProblems,
  tokenValues,
  type TokenContext,
} from '../../lib/blog/tokens';
import { generatedTitle, titlesNeedingShortTitle } from '../../lib/blog/title';
import { buildStats } from '../../lib/blog/stats';
import { clone, filmBySlug, loadFixtureArticles, loadFixtureFilms } from './fixtures';
import { loadCorpus } from './fixtures/corpus';

const films = loadFixtureFilms();
const stats = buildStats(films);
const ctxFor = (slug: string, extra: Partial<TokenContext> = {}): TokenContext => ({
  film: filmBySlug(slug),
  stats: stats[slug],
  ...extra,
});

describe('token rendering (spec 3.1)', () => {
  const ctx = ctxFor('crimson-static-2022'); // IMDb 6.4, RT 38, gap -26, 402,310 votes

  it.each([
    ['{{title}}', 'Crimson Static'],
    ['{{year}}', '2022'],
    ['{{imdb}}', '6.4'],
    ['{{imdbX10}}', '64'],
    ['{{rt}}', '38%'],
    ['{{metascore}}', '41'],
    ['{{votes}}', '402,310'],
    ['{{votesShort}}', '402K'],
    ['{{gap}}', '-26'],
    ['{{gapAbs}}', '26'],
    ['{{gapRank}}', '2nd'],
    ['{{setSize}}', '12'],
    ['{{genre}}', 'action'],
    ['{{genreCount}}', '3'],
    ['{{genreMedianGap}}', '-8'],
    ['{{popularityRank}}', '2nd'],
    ['{{weeksInTop10}}', '8'],
    ['{{peakRank}}', '1'],
    ['{{hours}}', '262 million'],
    ['{{runtime}}', '118 minutes'],
    ['{{director}}', 'Dario Kessel'],
    ['{{asOf}}', 'October 15, 2026'],
  ])('%s renders %s', (token, expected) => {
    expect(renderTokens(token, ctx)).toBe(expected);
  });

  it('renders positive gaps with a plus sign', () => {
    expect(renderTokens('{{gap}}', ctxFor('harbor-lights-2021'))).toBe('+13');
  });

  it('every documented token name is covered by tokenValues', () => {
    const values = tokenValues(ctx);
    for (const name of TOKEN_NAMES) expect(Object.keys(values)).toContain(name);
    expect(TOKEN_NAMES).toHaveLength(22);
  });

  it('renders several tokens and keeps surrounding text and links untouched', () => {
    const out = renderTokens('IMDb {{imdb}} vs RT {{rt}}. See [the method](/compare/imdb-vs-rotten-tomatoes).', ctx);
    expect(out).toBe('IMDb 6.4 vs RT 38%. See [the method](/compare/imdb-vs-rotten-tomatoes).');
  });

  it('tolerates inner whitespace', () => {
    expect(renderTokens('{{ imdb }}', ctx)).toBe('6.4');
  });
});

describe('token errors', () => {
  const ctx = ctxFor('harbor-lights-2021');

  it('rejects unknown tokens with a clear message', () => {
    expect(() => renderTokens('{{imbd}}', ctx)).toThrow(TokenError);
    expect(() => renderTokens('{{imbd}}', ctx)).toThrow(/unknown token "imbd"/);
  });

  it('rejects null-valued tokens (metascore, peakRank, director)', () => {
    const noMeta = clone(ctxFor('midnight-ferry-2025')); // fixture has metascore null
    expect(() => renderTokens('{{metascore}}', noMeta)).toThrow(/metascore.*no value/);
    const f = clone(filmBySlug('harbor-lights-2021'));
    f.netflix.peakRank = null;
    f.omdb.directors = [];
    expect(() => renderTokens('{{peakRank}}', { film: f, stats: stats[f.slug] })).toThrow(/peakRank/);
    expect(() => renderTokens('{{director}}', { film: f, stats: stats[f.slug] })).toThrow(/director/);
  });

  it('rejects malformed and unbalanced braces', () => {
    expect(() => renderTokens('{{imdb', ctx)).toThrow(/unbalanced/);
    expect(() => renderTokens('imdb}}', ctx)).toThrow(/unbalanced/);
    expect(() => renderTokens('{{im db}}', ctx)).toThrow(/malformed/);
    expect(() => renderTokens('{{}}', ctx)).toThrow(/malformed/);
  });

  it('is case sensitive', () => {
    expect(() => renderTokens('{{IMDB}}', ctx)).toThrow(/unknown token/);
  });

  it('tokenProblems lists every problem without throwing', () => {
    const probs = tokenProblems('a {{nope}} b {{imdb}} c {{metascore}} {{cite:zzz}}', ctxFor('midnight-ferry-2025'));
    expect(probs).toHaveLength(3);
    expect(probs.join('|')).toMatch(/nope/);
    expect(probs.join('|')).toMatch(/metascore/);
    expect(probs.join('|')).toMatch(/zzz/);
  });
});

describe('{{cite:id}}', () => {
  const sources = [
    { id: 'tudum', url: 'https://www.netflix.com/tudum', title: 'T', publisher: 'Netflix', accessed: '2026-10-15', supports: 'x' },
    { id: 'oscars', url: 'https://www.oscars.org/', title: 'O', publisher: 'AMPAS', accessed: '2026-10-15', supports: 'y' },
  ];
  const ctx = ctxFor('harbor-lights-2021', { sources });

  it('renders the 1-based source number by default', () => {
    expect(renderTokens('a{{cite:oscars}}. b{{cite:tudum}}.', ctx)).toBe('a[2]. b[1].');
  });

  it('accepts a custom renderer', () => {
    const out = renderTokens('a{{cite:tudum}}', { ...ctx, cite: (s, i) => `<${i}:${s.publisher}>` });
    expect(out).toBe('a<0:Netflix>');
  });

  it('rejects unresolved ids and a cite with no argument', () => {
    expect(() => renderTokens('{{cite:missing}}', ctx)).toThrow(/does not resolve/);
    expect(() => renderTokens('{{cite}}', ctx)).toThrow(/cite/);
    expect(() => renderTokens('{{imdb:foo}}', ctx)).toThrow(/takes no argument/);
  });

  it('findTokens and citedIds expose what a text uses', () => {
    expect(findTokens('x {{imdb}} y {{cite:a-b}}')).toEqual([
      { raw: '{{imdb}}', name: 'imdb', arg: undefined },
      { raw: '{{cite:a-b}}', name: 'cite', arg: 'a-b' },
    ]);
    expect(citedIds('{{cite:b}} {{cite:a}} {{cite:b}}')).toEqual(['b', 'a']);
  });

  it('stripTokens replaces tokens for linting', () => {
    expect(stripTokens('IMDb {{imdb}} and {{cite:x}}', '#')).toBe('IMDb # and #');
  });
});

describe('rendered fixture articles', () => {
  it.each(loadFixtureArticles().map((a) => [a.slug, a] as const))('%s: every field renders without errors', (slug, a) => {
    const ctx = ctxFor(slug, { sources: a.sources });
    const texts = [a.h1, a.description, a.summary, ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs]), ...a.faq.flatMap((f) => [f.q, f.a])];
    for (const t of texts) {
      const out = renderTokens(t, ctx);
      expect(out).not.toMatch(/\{\{|\}\}/);
    }
  });

  it('rendered descriptions are 120 to 158 characters', () => {
    for (const a of loadFixtureArticles()) {
      const out = renderTokens(a.description, ctxFor(a.slug, { sources: a.sources }));
      expect(out.length).toBeGreaterThanOrEqual(120);
      expect(out.length).toBeLessThanOrEqual(158);
    }
  });
});

describe('generated titles for the whole set (runs before writing starts)', () => {
  it('every fixture film has a generated title of at most 50 characters', () => {
    for (const f of films) expect(generatedTitle(f).title.length).toBeLessThanOrEqual(50);
  });

  it('titlesNeedingShortTitle lists films whose full and no-year forms exceed 50 characters', () => {
    const f = clone(filmBySlug('harbor-lights-2021'));
    f.slug = 'long-one-2021';
    f.omdb.title = 'The Incredibly Long Title of a Harbor Lights Documentary';
    expect(titlesNeedingShortTitle([...films, f])).toEqual(['long-one-2021']);
  });
});

describe('real corpus (skipped while data/blog/articles is empty or missing)', () => {
  it('every article description renders to 120-158 chars and every title chain resolves', () => {
    const corpus = loadCorpus();
    if (!corpus) return;
    for (const a of corpus.articles) {
      const film = corpus.films.find((f) => f.slug === a.slug);
      expect(film).toBeDefined();
      const out = renderTokens(a.description, { film: film!, stats: corpus.stats[a.slug], sources: a.sources });
      expect(out.length).toBeGreaterThanOrEqual(120);
      expect(out.length).toBeLessThanOrEqual(158);
      expect(() => generatedTitle(film!, a.shortTitle)).not.toThrow();
    }
  });
});
