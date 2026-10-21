import {
  articleBodyText,
  checkBlogPage,
  checkHubSize,
  checkRenderedSimilarity,
  HUB_MAX_BYTES,
  RENDERED_JACCARD_MAX,
  unregisteredPages,
} from '../../lib/blog-html';
import { filmBySlug, loadFixtureArticles, clone } from '../blog/fixtures';
import type { Article, Film } from '../../lib/blog/types';

const SITE = 'https://rating.watch';
const film: Film = filmBySlug('harbor-lights-2021'); // fetchedAt 2026-10-15, IMDb 7.8, RT 91
const article: Article = { ...loadFixtureArticles().find((a) => a.slug === film.slug)!, status: 'published' };
const PATH = `/blog/${film.slug}`;

const graph = (): any[] => [
  { '@type': 'WebPage', '@id': `${SITE}${PATH}#webpage`, url: `${SITE}${PATH}`, dateModified: '2026-10-20T00:00:00+00:00' },
  {
    '@type': 'BlogPosting',
    '@id': `${SITE}${PATH}#article`,
    headline: 'Why critics rate it higher',
    datePublished: '2026-10-20T00:00:00+00:00',
    dateModified: '2026-10-21T00:00:00+00:00',
    isPartOf: { '@type': 'CollectionPage', '@id': `${SITE}/blog#webpage`, name: 'Blog', url: `${SITE}/blog` },
  },
  {
    '@type': 'Movie',
    '@id': `${SITE}${PATH}#film`,
    name: 'Harbor Lights',
    datePublished: '2021-06-04T00:00:00+00:00',
    duration: 'PT112M',
    sameAs: 'https://www.imdb.com/title/tt0000001/',
  },
];

const ld = (nodes: unknown) =>
  `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes })}</script>`;

/** Distinct prose per call, so two pages from different `seed`s share no 5-gram. */
const prose = (seed: string, n = 60) =>
  Array.from({ length: n }, (_, i) => `${seed}${i}`).join(' ');

interface Opts {
  h1?: string;
  asOf?: string[];
  imdb?: string;
  rt?: string;
  nodes?: any[];
  extraBody?: string;
  seed?: string;
  rowsWithout?: string[];
}

/** A rendered article page shaped like the real build output (CSS-module class names included). */
function page(o: Opts = {}): string {
  const asOf = o.asOf ?? ['October 15, 2026'];
  const seed = o.seed ?? 'alpha';
  const rows: [string, string][] = [
    ['IMDb rating', o.imdb ?? '7.8'],
    ['Rotten Tomatoes', o.rt ?? '91%'],
    ['Gap', '+13'],
  ];
  const tr = rows
    .filter(([l]) => !(o.rowsWithout ?? []).includes(l))
    .map(([l, v]) => `<tr><th scope="row"><span class="guide_thImdb__x">${l}</span></th><td class="blog_value__y">${v}</td><td>note</td></tr>`)
    .join('');
  return `<!DOCTYPE html><html lang="en"><head><title>t</title>${ld(o.nodes ?? graph())}</head><body>
<main id="main"><article>
<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/blog">Blog</a></nav>
<header><h1>${o.h1 ?? 'Why critics rate it higher'}</h1>
<p class="site-chrome_byline__a">By Igor &middot; Published <time>October 20, 2026</time></p>
${asOf.map((d) => `<p class="site-chrome_byline__a">Scores as of ${d}, via OMDb. Popularity from Netflix&#x27;s Top 10 data (July 4, 2021 to October 4, 2026).</p>`).join('')}
<p class="site-chrome_lede__q"><strong>${prose(seed + 'lede', 12)}.</strong> <!-- -->${prose(seed + 'lede2', 10)}</p></header>
<div class="guide_article__z"><div class="blog_wrap__p"><table><caption>Scores</caption><tbody>${tr}</tbody></table></div>
<div class="blog_cta__c"><p>See both scores on every Netflix card while you browse.</p><a href="/install">Install</a></div>
<dl><div><dt>Gap compared with the set</dt><dd><span>Wider than 55% of the other 11 films</span></dd></div></dl>
<section aria-labelledby="sec-a"><h2 id="sec-a">${prose(seed + 'head', 5)}</h2><p>${prose(seed + 'p1')}</p><p>${prose(seed + 'p2')}</p></section>
<div class="blog_dataNote__d"><h2>${prose(seed + 'note', 4)}</h2><p>${prose(seed + 'np')}</p></div>
<h2 id="faq">Frequently asked questions</h2>
<details open=""><summary>${prose(seed + 'q', 6)}?</summary><p class="guide_faqA__m">${prose(seed + 'a', 30)}</p></details>
<h2 id="sources">Sources</h2><ol><li><a href="https://example.test/a">Source</a>, accessed 2026-10-15</li></ol>
<ul><li><a href="/blog/other">Other (2020)</a>: Similar gap in the same genre</li></ul>
<p class="blog_methodLine__m">Scores as of ${asOf[0]}. Rating Watch is independent.</p>
${o.extraBody ?? ''}
</div></article></main></body></html>`;
}

const run = (html: string, over: Partial<{ path: string; film: Film; article: Article }> = {}) =>
  checkBlogPage({ path: PATH, html, film, article, ...over });
const rules = (html: string, over?: Parameters<typeof run>[1]) => run(html, over).map((f) => f.rule);

describe('checkBlogPage', () => {
  it('passes a fully valid rendered article', () => {
    expect(run(page())).toEqual([]);
  });

  describe('placeholders', () => {
    it('fails on {{ in the visible text', () => {
      expect(rules(page({ extraBody: '<p>Hello {{imdb}} there</p>' }))).toContain('blog-placeholder');
    });
    it('fails on {{ anywhere, including attributes and scripts', () => {
      expect(rules(page({ extraBody: '<a title="{{title}}" href="/x">x</a>' }))).toContain('blog-placeholder');
      expect(rules(page({ extraBody: '<script>var a="{{x}}"</script>' }))).toContain('blog-placeholder');
    });
  });

  describe('Scores as of', () => {
    it('fails when the visible date differs from fetchedAt', () => {
      const f = run(page({ asOf: ['October 14, 2026'] }));
      expect(f.map((x) => x.rule)).toContain('blog-asof');
      expect(f.find((x) => x.rule === 'blog-asof')!.message).toContain('October 15, 2026');
    });
    it('fails when any one of several lines is wrong', () => {
      expect(rules(page({ asOf: ['October 15, 2026', 'October 1, 2026'] }))).toContain('blog-asof');
    });
    it('fails when the line is missing', () => {
      expect(rules(page({ asOf: [] }).replace(/Scores as of[^<]*/g, 'Scores updated'))).toContain('blog-asof');
    });
    it('accepts the film fetchedAt in a different year/month format only when it matches', () => {
      const other = clone(film);
      other.fetchedAt = '2027-01-02T00:00:00.000Z';
      expect(rules(page({ asOf: ['January 2, 2027'] }), { film: other })).not.toContain('blog-asof');
      expect(rules(page({ asOf: ['October 15, 2026'] }), { film: other })).toContain('blog-asof');
    });
  });

  describe('visible scores', () => {
    it('fails on a wrong IMDb value', () => {
      expect(rules(page({ imdb: '7.9' }))).toContain('blog-score');
    });
    it('fails on a wrong Rotten Tomatoes value', () => {
      expect(rules(page({ rt: '90%' }))).toContain('blog-score');
    });
    it('fails when a row is missing', () => {
      expect(rules(page({ rowsWithout: ['IMDb rating'] }))).toContain('blog-score');
      expect(rules(page({ rowsWithout: ['Rotten Tomatoes'] }))).toContain('blog-score');
    });
    it('compares against the film data, not constants', () => {
      const other = clone(film);
      other.omdb.imdbRating = 6.1;
      other.omdb.rtPercent = 33;
      expect(rules(page(), { film: other })).toContain('blog-score');
      expect(rules(page({ imdb: '6.1', rt: '33%' }), { film: other })).not.toContain('blog-score');
    });
  });

  describe('JSON-LD on the rendered page', () => {
    const withNodes = (mutate: (g: any[]) => void) => {
      const g = graph();
      mutate(g);
      return page({ nodes: g });
    };
    const jsonRules = (mutate: (g: any[]) => void) => rules(withNodes(mutate)).filter((r) => r === 'blog-jsonld');

    it('needs exactly one Movie', () => {
      expect(jsonRules((g) => g.push({ ...g[2], '@id': `${SITE}${PATH}#film2` }))).toHaveLength(1);
      expect(jsonRules((g) => g.splice(2, 1))).toHaveLength(1);
    });
    it('needs exactly one BlogPosting', () => {
      expect(jsonRules((g) => g.push({ ...g[1], '@id': `${SITE}${PATH}#article2` }))).toHaveLength(1);
      expect(jsonRules((g) => g.splice(1, 1))).toHaveLength(1);
    });
    it('rejects aggregateRating anywhere, including nested', () => {
      expect(jsonRules((g) => (g[2].aggregateRating = { ratingValue: 7 }))).not.toHaveLength(0);
      expect(jsonRules((g) => (g[1].isPartOf.aggregateRating = {}))).not.toHaveLength(0);
    });
    it('rejects review / Review', () => {
      expect(jsonRules((g) => (g[2].review = []))).not.toHaveLength(0);
      expect(jsonRules((g) => g.push({ '@type': 'Review', '@id': `${SITE}/x#r` }))).not.toHaveLength(0);
    });
    it('rejects FAQPage and HowTo', () => {
      expect(jsonRules((g) => g.push({ '@type': 'FAQPage', '@id': `${SITE}/x#f` }))).not.toHaveLength(0);
      expect(jsonRules((g) => g.push({ '@type': ['HowTo'], '@id': `${SITE}/x#h` }))).not.toHaveLength(0);
    });
    it('rejects additionalProperty', () => {
      expect(jsonRules((g) => (g[2].additionalProperty = []))).not.toHaveLength(0);
    });
    it('rejects N/A values', () => {
      expect(jsonRules((g) => (g[2].duration = 'N/A'))).not.toHaveLength(0);
      expect(jsonRules((g) => (g[2].genre = ['Drama', 'N/A']))).not.toHaveLength(0);
    });
    it('requires absolute https URLs', () => {
      expect(jsonRules((g) => (g[2].sameAs = 'http://www.imdb.com/title/tt1/'))).not.toHaveLength(0);
      expect(jsonRules((g) => (g[0].url = '/blog/x'))).not.toHaveLength(0);
      expect(jsonRules((g) => (g[1].isPartOf.url = 'rating.watch/blog'))).not.toHaveLength(0);
      expect(jsonRules((g) => (g[2]['@id'] = '#film'))).not.toHaveLength(0);
    });
    it('requires ISO dates', () => {
      expect(jsonRules((g) => (g[1].datePublished = 'October 20, 2026'))).not.toHaveLength(0);
      expect(jsonRules((g) => (g[1].dateModified = '2026-13-45'))).not.toHaveLength(0);
      expect(jsonRules((g) => (g[2].datePublished = '2021'))).not.toHaveLength(0);
    });
    it('accepts ISO date-times', () => {
      expect(jsonRules((g) => (g[1].dateModified = '2026-10-21T08:00:00.000Z'))).toEqual([]);
      expect(jsonRules((g) => (g[1].dateModified = '2026-10-21T08:00:00+02:00'))).toEqual([]);
    });
    it('rejects bare dates and date-times without a time zone (Search Console wants a zone)', () => {
      expect(jsonRules((g) => (g[1].dateModified = '2026-10-21'))).not.toHaveLength(0);
      expect(jsonRules((g) => (g[1].dateModified = '2026-10-21T08:00:00'))).not.toHaveLength(0);
      expect(jsonRules((g) => (g[2].datePublished = '2021-06-04'))).not.toHaveLength(0);
    });
    it('requires dateModified >= datePublished', () => {
      expect(jsonRules((g) => (g[1].dateModified = '2026-10-19T00:00:00+00:00'))).toHaveLength(1);
      expect(jsonRules((g) => (g[1].dateModified = '2026-10-20T00:00:00+00:00'))).toEqual([]);
    });
    it('also fails when the graph is a bare array or nested blocks', () => {
      const html = page().replace(
        /<script type="application\/ld\+json">.*?<\/script>/,
        `<script type="application/ld+json">${JSON.stringify([{ '@context': 'https://schema.org', '@graph': graph() }])}</script>`,
      );
      expect(rules(html)).toEqual([]);
    });
    it('fails when there is no JSON-LD at all', () => {
      expect(rules(page().replace(/<script type="application\/ld\+json">.*?<\/script>/, ''))).toContain('blog-jsonld');
    });
  });

  describe('h1', () => {
    it('fails with none or two', () => {
      expect(rules(page().replace(/<h1>.*?<\/h1>/, ''))).toContain('h1');
      expect(rules(page({ extraBody: '<h1>Another</h1>' }))).toContain('h1');
    });
    it('uses the same message as checkPage so the validator can de-duplicate', () => {
      expect(run(page({ extraBody: '<h1>Another</h1>' })).find((f) => f.rule === 'h1')!.message).toBe(
        'expected exactly one <h1>, found 2',
      );
    });
  });

  describe('status and data', () => {
    it('fails when the article for this page is not published', () => {
      expect(rules(page(), { article: { ...article, status: 'checked' } })).toContain('blog-status');
      expect(rules(page(), { article: { ...article, status: 'review' } })).toContain('blog-status');
    });
    it('fails when the page has no article body markers', () => {
      expect(rules(page().replace(/<section[\s\S]*?<\/section>/, '').replace(/<details[\s\S]*?<\/details>/, '').replace(/<p class="site-chrome_lede[\s\S]*?<\/p>/, '').replace(/<div class="blog_dataNote[\s\S]*?<\/div>/, ''))).toContain('blog-body');
    });
  });

  it('reports the page path on every finding', () => {
    for (const f of run(page({ imdb: '1.0', asOf: ['May 1, 2020'] }))) expect(f.path).toBe(PATH);
  });
});

describe('articleBodyText', () => {
  const text = articleBodyText(page());
  it('includes the lede, the written sections, the data note and the FAQ', () => {
    expect(text).toContain('alphalede0');
    expect(text).toContain('alphalede20');
    expect(text).toContain('alphap10');
    expect(text).toContain('alphanp0');
    expect(text).toContain('alphaa0');
    expect(text).toContain('alphaq0');
  });
  it('excludes chrome and generated blocks: nav, byline, table, cta, facts, sources, related, method line', () => {
    for (const chrome of ['Home', 'Igor', 'Scores as of', 'Measure', '7.8', 'Gap', 'Install', 'Wider than', 'Source', 'Other (2020)', 'independent', 'Frequently asked']) {
      expect(text).not.toContain(chrome);
    }
  });
  it('decodes entities and drops comments, scripts and styles', () => {
    const t = articleBodyText(
      page({ extraBody: '' }).replace('</section>', '<p>Tom &amp; Jerry&#x27;s<!-- hidden --><script>bad()</script></p></section>'),
    );
    expect(t).toContain("Tom & Jerry's");
    expect(t).not.toContain('hidden');
    expect(t).not.toContain('bad()');
  });
  it('is empty when the page has no <article>', () => {
    expect(articleBodyText('<html><body><main><section>x y z</section></main></body></html>')).toBe('');
  });
});

describe('checkRenderedSimilarity', () => {
  const pages = (...seeds: string[]) => seeds.map((s) => ({ path: `/blog/${s}`, html: page({ seed: s }) }));

  it('exposes the 0.35 limit', () => {
    expect(RENDERED_JACCARD_MAX).toBe(0.35);
  });
  it('passes distinct articles that share identical chrome and tables', () => {
    expect(checkRenderedSimilarity(pages('alpha', 'bravo', 'charlie'))).toEqual([]);
  });
  it('fails a pair of near-identical article bodies and names both paths', () => {
    const a = { path: '/blog/a', html: page({ seed: 'same' }) };
    const b = { path: '/blog/b', html: page({ seed: 'same' }) };
    const f = checkRenderedSimilarity([a, b]);
    expect(f).toHaveLength(1);
    expect(f[0].rule).toBe('blog-similarity');
    expect(f[0].message).toContain('/blog/a');
    expect(f[0].message).toContain('/blog/b');
  });
  it('is not fooled by identical chrome: only the article body is compared', () => {
    // Same nav/table/cta/facts/sources in every page, different prose: must pass.
    const a = page({ seed: 'one' });
    const b = page({ seed: 'two' });
    expect(articleBodyText(a)).not.toEqual(articleBodyText(b));
    expect(checkRenderedSimilarity([{ path: '/blog/a', html: a }, { path: '/blog/b', html: b }])).toEqual([]);
  });
  it('reports every offending pair among three pages', () => {
    const f = checkRenderedSimilarity([
      { path: '/blog/a', html: page({ seed: 'same' }) },
      { path: '/blog/b', html: page({ seed: 'same' }) },
      { path: '/blog/c', html: page({ seed: 'same' }) },
    ]);
    expect(f).toHaveLength(3);
  });
  it('honours a custom limit', () => {
    const a = { path: '/blog/a', html: page({ seed: 'same' }) };
    const b = { path: '/blog/b', html: page({ seed: 'same' }) };
    expect(checkRenderedSimilarity([a, b], 1.1)).toEqual([]);
  });
  it('is quiet for zero or one article', () => {
    expect(checkRenderedSimilarity([])).toEqual([]);
    expect(checkRenderedSimilarity(pages('solo'))).toEqual([]);
  });
});

describe('checkHubSize', () => {
  it('has the ruled 160 KB budget (RULING B8)', () => {
    expect(HUB_MAX_BYTES).toBe(160 * 1024);
  });
  it('passes at the limit and fails above it', () => {
    expect(checkHubSize({ path: '/blog', html: 'x'.repeat(HUB_MAX_BYTES) })).toEqual([]);
    const f = checkHubSize({ path: '/blog', html: 'x'.repeat(HUB_MAX_BYTES + 1) });
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ path: '/blog', rule: 'blog-hub-size' });
    expect(f[0].message).toContain('160 KB');
  });
  it('measures bytes, not characters', () => {
    // 3-byte characters: 60,000 chars is 180,000 bytes.
    expect(checkHubSize({ path: '/blog', html: '€'.repeat(60_000) })).toHaveLength(1);
  });
});

describe('unregisteredPages', () => {
  it('flags a prerendered article whose slug is not in the registry (an unpublished article)', () => {
    const f = unregisteredPages(
      ['blog.html', 'blog/harbor-lights-2021.html', 'blog/salt-and-iron-2019.html', '_not-found.html'],
      ['/blog', '/blog/harbor-lights-2021'],
    );
    expect(f).toEqual([
      { path: '/blog/salt-and-iron-2019.html', rule: 'registry', message: 'prerendered page is not in lib/pages.ts' },
    ]);
  });
  it('is empty when everything prerendered is registered', () => {
    expect(unregisteredPages(['index.html', 'blog.html'], ['/', '/blog'])).toEqual([]);
  });
  it('accepts a root path for the home page', () => {
    expect(unregisteredPages(['index.html', 'x/y.html'], ['/'])).toHaveLength(1);
  });
});
