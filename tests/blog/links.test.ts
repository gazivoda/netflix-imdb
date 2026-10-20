import { PAGES } from '../../lib/pages';
import { BANNED_SOURCE_HOSTS, MAX_INTERNAL_LINKS, bannedSourceReason, checkLinks, extractLinks } from '../../lib/blog/links';
import { computeRelated } from '../../lib/blog/related';
import { buildStats } from '../../lib/blog/stats';
import type { Article } from '../../lib/blog/types';
import { clone, loadFixtureArticles, loadFixtureFilms } from './fixtures';
import { loadCorpus } from './fixtures/corpus';

const films = loadFixtureFilms();
const stats = buildStats(films);
const articles = loadFixtureArticles();
const registered = new Set(PAGES.map((p) => p.path));
const filmSlugs = films.map((f) => f.slug);
const get = (slug: string): Article => articles.find((a) => a.slug === slug)!;
const run = (a: Article) => checkLinks(a, { registeredPaths: registered, filmSlugs });
const rules = (a: Article) => run(a).map((i) => i.rule);

describe('internal markdown links', () => {
  it('extractLinks returns anchor and target pairs', () => {
    expect(extractLinks('See [the guide](/install) and [more](/compare/imdb-vs-rotten-tomatoes#x).')).toEqual([
      { anchor: 'the guide', target: '/install' },
      { anchor: 'more', target: '/compare/imdb-vs-rotten-tomatoes#x' },
    ]);
  });

  it.each(articles.map((a) => [a.slug, a] as const))('%s has no link, cite or source findings', (_s, a) => {
    expect(run(a)).toEqual([]);
  });

  it('every link target used by the fixtures is a registered page', () => {
    for (const a of articles) {
      const text = JSON.stringify([a.summary, a.sections, a.faq]);
      for (const l of extractLinks(text.replace(/\\"/g, '"'))) expect(registered.has(l.target.split(/[?#]/)[0])).toBe(true);
    }
  });

  it('flags an unregistered target, an external link and a protocol-relative link', () => {
    const add = (target: string): Article => {
      const a = clone(get('crimson-static-2022'));
      a.sections[2].paragraphs[0] += ` See [here](${target}).`;
      return a;
    };
    expect(rules(add('/not-a-page'))).toContain('link-target');
    expect(rules(add('https://example.com/x'))).toContain('link-external');
    expect(rules(add('//example.com/x'))).toContain('link-external');
    expect(rules(add('/install'))).toEqual([]);
    expect(rules(add('/install#top'))).toEqual([]);
  });

  it(`allows at most ${MAX_INTERNAL_LINKS} internal links per article`, () => {
    const a = clone(get('crimson-static-2022')); // already has one
    a.sections[2].paragraphs[0] += ' [a](/install) [b](/blog) [c](/about)';
    const r = checkLinks(a, { registeredPaths: new Set([...registered, '/blog']), filmSlugs });
    expect(r.map((i) => i.rule)).toContain('link-count');
  });

  it('flags an empty anchor', () => {
    const a = clone(get('crimson-static-2022'));
    a.sections[2].paragraphs[0] += ' [](/install)';
    expect(rules(a)).toContain('link-anchor');
  });
});

describe('citations', () => {
  it('flags a cite that does not resolve and a source that is never cited', () => {
    const a = clone(get('harbor-lights-2021'));
    a.sections[1].paragraphs[0] = a.sections[1].paragraphs[0].replace('{{cite:tudum}}', '{{cite:nope}}');
    const r = rules(a);
    expect(r).toContain('cite');
    expect(r).toContain('source-unused');
  });
  it('flags a cite in an article with no sources', () => {
    const a = clone(get('crimson-static-2022'));
    a.sections[0].paragraphs[0] += '{{cite:tudum}}';
    expect(rules(a)).toContain('cite');
  });
});

describe('source URLs (7.4)', () => {
  const withUrl = (url: string): Article => {
    const a = clone(get('harbor-lights-2021'));
    a.sources[0].url = url;
    return a;
  };
  it.each([
    'https://www.reddit.com/r/netflix/comments/abc',
    'https://old.reddit.com/r/movies',
    'https://redd.it/abc',
    'https://somefilm.fandom.com/wiki/Film',
    'https://film.wikia.com/wiki/Film',
    'https://www.quora.com/question',
    'https://www.imdb.com/title/tt9000010/trivia/',
    'https://www.imdb.com/title/tt9000010/reviews/',
    'https://www.imdb.com/title/tt9000010/quotes/',
    'https://www.buzzfeed.com/list',
    'https://www.ranker.com/list/x',
    'https://www.rottentomatoes.com/m/film/reviews',
  ])('rejects %s', (url) => {
    expect(bannedSourceReason(url)).not.toBeNull();
    expect(rules(withUrl(url))).toContain('source-banned');
  });
  it.each([
    'https://www.netflix.com/tudum/top10',
    'https://about.netflix.com/en/news/x',
    'https://www.oscars.org/oscars/ceremonies/2022',
    'https://en.wikipedia.org/wiki/Film_(2021)',
    'https://www.festival-cannes.com/en/',
    'https://www.imdb.com/title/tt9000010/',
  ])('accepts %s', (url) => {
    expect(bannedSourceReason(url)).toBeNull();
  });
  it('rejects non-https and unparsable URLs', () => {
    expect(rules(withUrl('http://www.netflix.com/tudum'))).toContain('source-banned');
    expect(bannedSourceReason('not a url')).not.toBeNull();
  });
  it('keeps a readable banned-host list', () => {
    expect(BANNED_SOURCE_HOSTS).toContain('reddit.com');
  });
});

describe('related picks', () => {
  it('flags unknown slugs and a self reference', () => {
    const a = clone(get('harbor-lights-2021'));
    a.related = [{ slug: 'ghost-2000', reason: 'same director' }, { slug: 'harbor-lights-2021', reason: 'self' }];
    const r = run(a).filter((i) => i.rule === 'related');
    expect(r).toHaveLength(2);
  });
  it('accepts picks that exist', () => {
    const a = clone(get('harbor-lights-2021'));
    a.related = [{ slug: 'tin-soldier-blues-2018', reason: 'same director' }];
    expect(run(a)).toEqual([]);
  });
});

describe('inbound links between published articles (spec 4.4 guarantee)', () => {
  it('every published fixture article is linked from at least two others', () => {
    const published = articles.map((a) => a.slug);
    const inbound = new Map(published.map((s) => [s, 0]));
    for (const slug of published) {
      const film = films.find((f) => f.slug === slug)!;
      for (const l of computeRelated(film, { films, stats, published })) inbound.set(l.slug, (inbound.get(l.slug) ?? 0) + 1);
    }
    for (const [slug, n] of inbound) expect({ slug, n: Math.min(n, 2) }).toEqual({ slug, n: 2 });
  });
});

describe('real corpus (skipped while data/blog/articles is empty or missing)', () => {
  it('links, cites, sources and picks are valid; published articles have 2+ inbound links', () => {
    const corpus = loadCorpus();
    if (!corpus) return;
    const slugs = corpus.films.map((f) => f.slug);
    for (const a of corpus.articles) {
      expect({ slug: a.slug, issues: checkLinks(a, { registeredPaths: registered, filmSlugs: slugs }) }).toEqual({ slug: a.slug, issues: [] });
    }
    const published = corpus.articles.filter((a) => a.status === 'published').map((a) => a.slug);
    if (published.length < 3) return;
    const inbound = new Map(published.map((s) => [s, 0]));
    for (const slug of published) {
      const film = corpus.films.find((f) => f.slug === slug)!;
      const picks = corpus.articles.find((a) => a.slug === slug)?.related;
      for (const l of computeRelated(film, { films: corpus.films, stats: corpus.stats, published, picks })) {
        inbound.set(l.slug, (inbound.get(l.slug) ?? 0) + 1);
      }
    }
    for (const [slug, n] of inbound) expect({ slug, ok: n >= 2 }).toEqual({ slug, ok: true });
  });
});
