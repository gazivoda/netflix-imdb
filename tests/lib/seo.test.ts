import { PAGES, getPage } from '../../lib/pages';
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
} from '../../lib/seo';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import sitemap from '../../app/sitemap';
import { SITE_URL } from '../../lib/content';

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

  it.each(PAGES.map((p) => [p.path] as const))('%s has a page file on disk', (path) => {
    const file = path === '/' ? 'app/page.tsx' : `app${path}/page.tsx`;
    expect(existsSync(join(__dirname, '../..', file))).toBe(true);
  });

  it('getPage throws for unregistered paths', () => {
    expect(() => getPage('/nope')).toThrow();
  });
});

describe('pageMetadata', () => {
  it.each(PAGES.map((p) => [p.path] as const))('%s sets its own canonical, OG and Twitter', (path) => {
    const m = pageMetadata(path);
    expect(m.alternates?.canonical).toBe(path);
    expect(m.openGraph).toMatchObject({ url: absoluteUrl(path), siteName: 'Netflix Ratings' });
    expect(m.twitter).toMatchObject({ card: 'summary_large_image' });
    expect((m.openGraph as any).images[0]).toMatchObject({ url: '/opengraph-image', width: 1200, height: 630 });
    expect((m.twitter as any).images[0].url).toBe('/twitter-image');
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
    expect(a.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(a.dateModified).toBe(getPage('/compare/imdb-vs-rotten-tomatoes').updated);
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

  it('declares AboutPage schema that references (not redefines) the shared author', () => {
    const src = readFileSync(join(__dirname, '../../app/about/page.tsx'), 'utf8');
    expect(src).toContain("'AboutPage'");
    expect(src).toContain('authorRef');
    expect(src).not.toContain("'Person'");
  });
});

describe('layout JSON-LD', () => {
  it('does not put FAQPage in the root layout (it would leak onto every page)', () => {
    const src = readFileSync(join(__dirname, '../../app/layout.tsx'), 'utf8');
    expect(src).not.toContain('FAQPage');
  });
});
