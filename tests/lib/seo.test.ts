import { PAGES, getPage, STATIC_PAGES, BLOG_HUB_PAGE, blogPages, buildPages, type SitePage } from '../../lib/pages';
import { BLOG_HUB, type BlogArticlePage, type BlogHubState } from '../../lib/blog/registry.generated';
import {
  pageMetadata,
  renderedTitle,
  breadcrumbList,
  faqPage,
  howTo,
  article,
  graph,
  jsonLdString,
  absoluteUrl,
  webPage,
  nodeId,
  blogPosting,
  movie,
  BLOG_DATASET_DESCRIPTION,
} from '../../lib/seo';
import { filmBySlug } from '../blog/fixtures';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import sitemap from '../../app/sitemap';
import { SITE_URL, CHROME_WEB_STORE_URL } from '../../lib/content';

describe('page registry', () => {
  it('has unique, well-formed paths', () => {
    const paths = PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) {
      expect(p).toMatch(/^\/($|[a-z0-9][a-z0-9\-/]*[a-z0-9]$)/);
    }
  });

  it.each(PAGES.map((p) => [p.path, p] as const))('%s has SERP-safe title and description', (_path, page) => {
    expect(renderedTitle(page).length).toBeLessThanOrEqual(65);
    expect(page.title.length).toBeGreaterThanOrEqual(10);
    expect(page.description.length).toBeGreaterThanOrEqual(70);
    expect(page.description.length).toBeLessThanOrEqual(160);
    expect(page.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(page.priority).toBeGreaterThanOrEqual(0);
    expect(page.priority).toBeLessThanOrEqual(1);
  });

  it('uses the brand name consistently (never "Netflix IMDB Ratings")', () => {
    for (const p of PAGES) {
      expect(`${p.title} ${p.description}`).not.toMatch(/Netflix IMDB Ratings/i);
    }
  });

  it('has unique titles and descriptions across all pages', () => {
    const titles = PAGES.map((p) => renderedTitle(p));
    const descriptions = PAGES.map((p) => p.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  // Articles share one dynamic route; /blog is its own static page. Only REGISTERED paths are
  // checked here (the hub is registered only when ready); the hub file itself is checked below.
  it('the /blog hub has a page file on disk even while it is not registered', () => {
    expect(existsSync(join(__dirname, '../..', 'app/blog/page.tsx'))).toBe(true);
  });

  const pageFileFor = (path: string): string =>
    path === '/' ? 'app/page.tsx' : path.startsWith('/blog/') ? 'app/blog/[slug]/page.tsx' : `app${path}/page.tsx`;

  it.each(PAGES.map((p) => [p.path] as const))('%s has a page file on disk', (path) => {
    expect(existsSync(join(__dirname, '../..', pageFileFor(path)))).toBe(true);
  });

  it('getPage throws for unregistered paths', () => {
    expect(() => getPage('/nope')).toThrow();
  });
});

describe('pageMetadata', () => {
  it.each(PAGES.map((p) => [p.path] as const))('%s sets its own canonical, OG and Twitter', (path) => {
    const isArticle = getPage(path).kind === 'article';
    const m = pageMetadata(path, isArticle ? { fileImages: true } : undefined);
    expect(m.alternates?.canonical).toBe(path);
    expect(m.openGraph).toMatchObject({ url: absoluteUrl(path), siteName: 'Rating Watch' });
    expect(m.twitter).toMatchObject({ card: 'summary_large_image' });
    if (isArticle) {
      // Articles use the file-based opengraph-image / twitter-image convention: no config images.
      expect(m.openGraph).not.toHaveProperty('images');
      expect(m.twitter).not.toHaveProperty('images');
      return;
    }
    expect((m.openGraph as any).images[0]).toMatchObject({ url: expect.stringMatching(/^\/opengraph-image\?v=\w+$/), width: 1200, height: 630 });
    expect((m.twitter as any).images[0].url).toMatch(/^\/twitter-image\?v=\w+$/);
  });
});

describe('sitemap', () => {
  it('lists every registered page with its real lastModified (not build time)', () => {
    const entries = sitemap();
    expect(entries).toHaveLength(PAGES.length);
    for (const page of PAGES) {
      const entry = entries.find((e) => e.url === absoluteUrl(page.path));
      expect(entry).toBeDefined();
      expect(new Date(entry!.lastModified as Date | string).toISOString().slice(0, 10)).toBe(page.updated);
    }
  });
});

describe('JSON-LD builders', () => {
  it('breadcrumbList numbers positions from 1 and uses absolute URLs', () => {
    const b = breadcrumbList([
      { name: 'Home', path: '/' },
      { name: 'Compare', path: '/compare/imdb-vs-rotten-tomatoes' },
    ]) as any;
    expect(b['@type']).toBe('BreadcrumbList');
    expect(b.itemListElement.map((i: any) => i.position)).toEqual([1, 2]);
    expect(b.itemListElement[1].item).toBe(`${SITE_URL}/compare/imdb-vs-rotten-tomatoes`);
  });

  it('faqPage maps questions and answers', () => {
    const f = faqPage([{ q: 'Q?', a: 'A.' }]) as any;
    expect(f.mainEntity[0]).toMatchObject({ '@type': 'Question', name: 'Q?' });
    expect(f.mainEntity[0].acceptedAnswer.text).toBe('A.');
  });

  it('howTo emits ordered HowToStep nodes', () => {
    const h = howTo({
      name: 'Do it',
      description: 'desc',
      totalTime: 'PT2M',
      steps: [
        { name: 'One', text: 'first' },
        { name: 'Two', text: 'second' },
      ],
    }) as any;
    expect(h.totalTime).toBe('PT2M');
    expect(h.step.map((s: any) => s.position)).toEqual([1, 2]);
    expect(h.step[0]['@type']).toBe('HowToStep');
  });

  it('article references the shared author/org entities and real dates', () => {
    const a = article('/compare/imdb-vs-rotten-tomatoes') as any;
    expect(a.author).toEqual({ '@id': `${SITE_URL}/#author` });
    expect(a.publisher).toEqual({ '@id': `${SITE_URL}/#org` });
    // Full date-times with a zone, like every date in the JSON-LD (see isoDateTime).
    expect(a.datePublished).toBe('2026-06-16T00:00:00+00:00');
    expect(a.dateModified).toBe(`${getPage('/compare/imdb-vs-rotten-tomatoes').updated}T00:00:00+00:00`);
  });

  it('graph wraps nodes in a schema.org @graph', () => {
    const g = graph({ '@type': 'Thing' }) as any;
    expect(g['@context']).toBe('https://schema.org');
    expect(g['@graph']).toHaveLength(1);
  });

  it('jsonLdString cannot be broken out of a <script> tag', () => {
    const s = jsonLdString({ x: '</script><script>alert(1)</script>' });
    expect(s).not.toContain('</script>');
    expect(JSON.parse(s).x).toBe('</script><script>alert(1)</script>');
  });
});

describe('/about page', () => {
  const about = PAGES.find((p) => p.path === '/about');

  it('is registered in the about group at priority 0.6', () => {
    expect(about).toBeDefined();
    expect(about!.group).toBe('about');
    expect(about!.priority).toBe(0.6);
  });

  it('is linked from the footer via the about group', () => {
    const src = readFileSync(join(__dirname, '../../components/SiteFooter.tsx'), 'utf8');
    expect(src).toContain("pagesInGroup('about')");
  });

  it('declares AboutPage + ProfilePage schema whose mainEntity is the full author Person (inlined, not a bare @id)', () => {
    const src = readFileSync(join(__dirname, '../../app/about/page.tsx'), 'utf8');
    expect(src).toContain("'AboutPage'");
    expect(src).toContain("'ProfilePage'");
    expect(src).toContain('mainEntity: authorNode()');
    expect(src).not.toContain('mainEntity: authorRef');
  });
});

describe('layout JSON-LD', () => {
  it('does not put FAQPage in the root layout (it would leak onto every page)', () => {
    const src = readFileSync(join(__dirname, '../../app/layout.tsx'), 'utf8');
    expect(src).not.toContain('FAQPage');
  });

  it('credits the author with the site /about URL, never a repository', () => {
    const src = readFileSync(join(__dirname, '../../app/layout.tsx'), 'utf8');
    expect(src).toContain('url: `${SITE_URL}/about`');
    expect(src).not.toMatch(/REPO_URL|github/i);
  });
});

describe('author byline', () => {
  it('GuideLayout links the byline to /about by default', () => {
    const src = readFileSync(join(__dirname, '../../components/GuideLayout.tsx'), 'utf8');
    expect(src).toContain("bylineHref = '/about'");
    expect(src).not.toMatch(/REPO_URL|github/i);
  });
});

describe('extension installation', () => {
  it('uses the live official listing without session-specific query parameters', () => {
    expect(CHROME_WEB_STORE_URL).toBe('https://chromewebstore.google.com/detail/rating-watch-imdb-rotten/kljplalofcjpjdhceicjhnibllghdlpa');
    expect(new URL(CHROME_WEB_STORE_URL).search).toBe('');
  });

  it('the install page and both how-to pages use the shared listing rather than a ZIP download', () => {
    const install = readFileSync(join(__dirname, '../../app/install/page.tsx'), 'utf8');
    const pages = [install, ...['show-imdb-ratings-on-netflix', 'show-rotten-tomatoes-on-netflix'].map((p) =>
      readFileSync(join(__dirname, '../../app/how-to', p, 'page.tsx'), 'utf8'))];
    for (const page of pages) {
      expect(page).toContain('href={CHROME_WEB_STORE_URL}');
      expect(page).not.toMatch(/EXTENSION_ZIP_PATH|Load unpacked|Developer mode|Download Rating Watch \(zip\)/i);
    }
  });
});

describe('pageMetadata options', () => {
  it('fileImages: true omits openGraph and twitter images, everything else is identical', () => {
    const base = pageMetadata('/install') as any;
    const file = pageMetadata('/install', { fileImages: true }) as any;
    expect(file.openGraph).not.toHaveProperty('images');
    expect(file.twitter).not.toHaveProperty('images');
    const { images: _og, ...ogRest } = base.openGraph;
    const { images: _tw, ...twRest } = base.twitter;
    expect(file.openGraph).toEqual(ogRest);
    expect(file.twitter).toEqual(twRest);
    expect(file.alternates).toEqual(base.alternates);
  });

  it('default and explicit false are byte-identical to the legacy output', () => {
    const base = JSON.stringify(pageMetadata('/install'));
    expect(JSON.stringify(pageMetadata('/install', {}))).toBe(base);
    expect(JSON.stringify(pageMetadata('/install', { fileImages: false }))).toBe(base);
  });
});

describe('webPage options', () => {
  it('defaults are unchanged: type WebPage, about the app', () => {
    const wp = webPage('/install') as any;
    expect(wp['@type']).toBe('WebPage');
    expect(wp.about).toEqual({ '@id': `${SITE_URL}/#app` });
    expect(JSON.stringify(webPage('/install', {}))).toBe(JSON.stringify(wp));
  });

  it('accepts a type and an about reference', () => {
    const wp = webPage('/install', { type: 'CollectionPage', about: { '@id': nodeId('/install', 'film') } }) as any;
    expect(wp['@type']).toBe('CollectionPage');
    expect(wp.about).toEqual({ '@id': `${SITE_URL}/install#film` });
    expect(wp['@id']).toBe(`${SITE_URL}/install#webpage`);
  });
});

describe('blog JSON-LD builders (spec 4.5)', () => {
  const film = filmBySlug('crimson-static-2022');
  const path = `/blog/${film.slug}`;
  const post = blogPosting(path, {
    headline: 'Why Crimson Static splits critics and viewers',
    description: 'A short description.',
    published: '2026-10-20',
    updated: '2026-10-22',
    wordCount: 712,
  }) as any;
  const mov = movie(film) as any;
  const all = JSON.stringify([post, mov]);

  it('BlogPosting links article, page, film, collection and dataset by @id', () => {
    expect(post['@type']).toBe('BlogPosting');
    expect(post['@id']).toBe(`${SITE_URL}${path}#article`);
    expect(post.mainEntityOfPage).toEqual({ '@id': `${SITE_URL}${path}#webpage` });
    expect(post.about).toEqual({ '@id': `${SITE_URL}${path}#film` });
    expect(post.author).toEqual({ '@id': `${SITE_URL}/#author` });
    expect(post.publisher).toEqual({ '@id': `${SITE_URL}/#org` });
    expect(post.datePublished).toBe('2026-10-20T00:00:00+00:00');
    expect(post.dateModified).toBe('2026-10-22T00:00:00+00:00');
    expect(post.wordCount).toBe(712);
    expect(post.inLanguage).toBe('en');
    expect(post.isPartOf).toMatchObject({ '@type': 'CollectionPage', '@id': `${SITE_URL}/blog#webpage`, url: `${SITE_URL}/blog` });
    expect(post.isPartOf.name).toEqual(expect.any(String));
    expect(post.isBasedOn).toMatchObject({ '@type': 'Dataset', '@id': `${SITE_URL}/blog#dataset` });
    expect(post.isBasedOn.name).toEqual(expect.any(String));
    expect(post.isBasedOn.url).toMatch(/^https:\/\//);
  });

  it('BlogPosting.isBasedOn carries the Dataset description (Google requires it), the same string as the hub', () => {
    expect(BLOG_DATASET_DESCRIPTION.length).toBeGreaterThanOrEqual(50);
    expect(post.isBasedOn.description).toBe(BLOG_DATASET_DESCRIPTION);
    const hubSrc = readFileSync(join(__dirname, '../../app/blog/page.tsx'), 'utf8');
    expect(hubSrc).toMatch(/description: BLOG_DATASET_DESCRIPTION/);
  });

  it('blogPosting does not need /blog to be registered (articles exist only with a ready hub)', () => {
    expect(post.isPartOf.name).toBe(renderedTitle(BLOG_HUB_PAGE));
  });

  it('Movie carries only OMDb facts and the IMDb sameAs, no ratings and no image', () => {
    expect(mov['@type']).toBe('Movie');
    expect(mov['@id']).toBe(`${SITE_URL}${path}#film`);
    expect(mov.name).toBe(film.omdb.title);
    expect(mov.duration).toBe(`PT${film.omdb.runtimeMin}M`);
    expect(mov.sameAs).toBe(`https://www.imdb.com/title/${film.omdb.imdbId}/`);
    expect(mov.director.length).toBeLessThanOrEqual(2);
    expect(mov.actor.length).toBeLessThanOrEqual(4);
    expect(mov.director[0]).toEqual({ '@type': 'Person', name: film.omdb.directors[0] });
  });

  it('never emits rating, review, FAQ, how-to, additionalProperty or image keys', () => {
    for (const bad of ['aggregateRating', 'Review', 'FAQPage', 'HowTo', 'additionalProperty', '"image"', 'N/A', 'undefined']) {
      expect(all).not.toContain(bad);
    }
  });

  it('omits N/A and missing facts instead of printing them', () => {
    const sparse = JSON.parse(JSON.stringify(film));
    sparse.omdb.released = null;
    sparse.omdb.directors = [];
    sparse.omdb.actors = ['N/A'];
    sparse.omdb.genres = [];
    const m = movie(sparse) as any;
    expect(m).not.toHaveProperty('datePublished');
    expect(m).not.toHaveProperty('director');
    expect(m).not.toHaveProperty('actor');
    expect(m).not.toHaveProperty('genre');
    expect(JSON.stringify(m)).not.toContain('N/A');
  });

  it('renders the film title with display-safe dashes', () => {
    const dashed = JSON.parse(JSON.stringify(film));
    dashed.omdb.title = 'Part One \u2014 The Start';
    expect((movie(dashed) as any).name).toBe('Part One - The Start');
  });
});

describe('blog pages in the registry', () => {
  const fake: BlogArticlePage = {
    path: '/blog/fake-film-2020',
    title: 'Fake Film (2020): IMDb 6.3 vs RT 36%',
    description: 'Fake Film (2020) has IMDb 6.3 and Rotten Tomatoes 36%, a wide gap. A synthetic registry entry used only by the tests.',
    published: '2026-10-20',
    updated: '2026-10-25',
    label: 'Fake Film (2020)',
    scores: { imdb: 6.3, rt: 36, gap: -27, asOf: '2026-10-15' },
    imdbId: 'tt0000001',
  };

  const READY: BlogHubState = { ready: true, dataUpdated: '2026-10-15' };
  const NOT_READY: BlogHubState = { ready: false, dataUpdated: null };

  it('defines the /blog hub page for the guide group (registered only when ready)', () => {
    expect(BLOG_HUB_PAGE).toMatchObject({ path: '/blog', group: 'guide', label: 'Blog', priority: 0.7, changeFrequency: 'monthly', ogType: 'article' });
    expect(BLOG_HUB_PAGE.title).toBe('Top 100 Netflix Films Rated by Critics and Fans');
    expect(BLOG_HUB_PAGE.kind).toBeUndefined();
    expect(STATIC_PAGES.some((p) => p.path === '/blog')).toBe(false);
  });

  it('I9: /blog is not registered while the hub is not ready (no sitemap, footer or llms line)', () => {
    const pages = buildPages([], NOT_READY);
    expect(pages.some((p) => p.path === '/blog')).toBe(false);
    expect(pages.filter((p) => p.group === 'guide').map((p) => p.label)).not.toContain('Blog');
    if (!BLOG_HUB.ready) {
      expect(PAGES.some((p) => p.path === '/blog')).toBe(false);
      expect(() => getPage('/blog')).toThrow();
    }
  });

  it('I9: a ready hub is registered in the guide group right after the research study', () => {
    const pages = buildPages([], READY);
    const hub = pages.find((p) => p.path === '/blog')!;
    expect(hub).toMatchObject({ group: 'guide', label: 'Blog' });
    const paths = pages.map((p) => p.path);
    expect(paths.indexOf('/blog')).toBe(paths.indexOf('/research/imdb-vs-rotten-tomatoes-gap') + 1);
  });

  it('I9: article entries with a hub that is not ready is a stale registry and throws', () => {
    expect(() => buildPages([fake], NOT_READY)).toThrow(/hub/);
  });

  it('adds no article pages while the generated registry is empty', () => {
    expect(PAGES.filter((p) => p.kind === 'article')).toEqual([]);
    expect(PAGES.every((p) => !p.path.startsWith('/blog/'))).toBe(true);
  });

  it('blogPages maps registry entries to article pages (kind, priority, no group)', () => {
    const [p] = blogPages([fake]);
    expect(p).toMatchObject({
      path: fake.path,
      title: fake.title,
      description: fake.description,
      published: '2026-10-20',
      updated: '2026-10-25',
      label: 'Fake Film (2020)',
      kind: 'article',
      priority: 0.5,
      changeFrequency: 'monthly',
      ogType: 'article',
    });
    expect(p.group).toBeUndefined();
  });

  it('a synthetic article entry satisfies every registry rule, metadata and JSON-LD builder', () => {
    const pages: SitePage[] = buildPages([fake], READY);
    const page = pages.find((x) => x.path === fake.path)!;
    expect(renderedTitle(page).length).toBeLessThanOrEqual(65);
    expect(page.description.length).toBeGreaterThanOrEqual(70);
    expect(page.description.length).toBeLessThanOrEqual(160);
    expect(new Set(pages.map((x) => x.path)).size).toBe(pages.length);
    expect(pages.filter((x) => x.group === 'guide' || x.group === 'compare').every((x) => x.kind !== 'article')).toBe(true);
  });

  it('the hub lastmod follows the newest published article (never a stale hub)', () => {
    const base = BLOG_HUB_PAGE;
    const hubOf = (pages: SitePage[]) => pages.find((x) => x.path === '/blog')!;
    expect(hubOf(buildPages([], { ready: true, dataUpdated: null })).updated).toBe(base.updated);
    expect(hubOf(buildPages([fake], READY)).updated).toBe('2026-10-25');
    expect(hubOf(buildPages([{ ...fake, updated: '2020-01-01', published: '2020-01-01' }], READY)).updated).toBe(base.updated);
  });

  it('I10: the hub lastmod also follows max(films dataChangedAt), so unpublished rows count', () => {
    const hubOf = (pages: SitePage[]) => pages.find((x) => x.path === '/blog')!;
    expect(hubOf(buildPages([], { ready: true, dataUpdated: '2026-11-05' })).updated).toBe('2026-11-05');
    expect(hubOf(buildPages([fake], { ready: true, dataUpdated: '2026-11-05' })).updated).toBe('2026-11-05');
    expect(hubOf(buildPages([fake], { ready: true, dataUpdated: '2026-10-01' })).updated).toBe('2026-10-25');
  });

  it('article pages use file-based og/twitter images; other pages keep the config images', () => {
    const m = pageMetadata('/install', { fileImages: true }) as any;
    expect(m.openGraph).not.toHaveProperty('images');
    expect(m.twitter).not.toHaveProperty('images');
    expect((pageMetadata('/install') as any).openGraph.images).toHaveLength(1);
  });
});
