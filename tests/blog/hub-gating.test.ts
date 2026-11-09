// I9 hub gating at the route level, I11 dataset description, and the OG card minors (item 12).
// Source-level checks: the hub route must not be prerendered while the registry says the hub is
// not ready (Next 14 prerenders a static route that calls notFound() as blog.html with status 404).
import { readFileSync } from 'fs';
import { join } from 'path';
import { articlePathForImdbId, isBlogHubReady } from '../../lib/blog/inbound';
import { BLOG_HUB } from '../../lib/blog/registry.generated';

const ROOT = join(__dirname, '../..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

describe('/blog hub route (I9)', () => {
  const src = read('app/blog/page.tsx');

  it('is dynamic (never prerendered) and a 404 while the hub is not ready', () => {
    expect(src).toMatch(/export const dynamic = BLOG_HUB\.ready \? 'force-static' : 'force-dynamic';/);
    expect(src).toMatch(/if \(!BLOG_HUB\.ready\) notFound\(\);/);
  });

  it('builds metadata only for a ready hub (getPage would throw for an unregistered path)', () => {
    expect(src).not.toMatch(/export const metadata = pageMetadata/);
    expect(src).toMatch(/BLOG_HUB\.ready \? pageMetadata\(PATH\) : \{\}/);
  });

  it('has no "being prepared" placeholder any more (no thin indexable page)', () => {
    expect(src).not.toMatch(/being prepared/);
  });

  it('uses the shared Dataset description (I11)', () => {
    expect(src).toMatch(/description: BLOG_DATASET_DESCRIPTION/);
  });
});

describe('/blog hub copy with no published analysis (R4 kept, no empty promise)', () => {
  const src = read('app/blog/page.tsx');

  it('states the published count in the lede for every state', () => {
    expect(src).toMatch(/no film-by-film analysis is published yet/);
    expect(src).toMatch(/A full analysis is published for \$\{sum\.publishedCount\} of \$\{sum\.total\} films so far/);
  });

  it('shows the agreed-films card instead of "0 Full analyses published" when nothing is published', () => {
    expect(src).toMatch(/sum\.publishedCount === 0 \? agreed : sum\.publishedCount/);
    expect(src).toMatch(/Films where the scores agree within 9 points/);
  });

  it('keeps the published count on the page and does not describe nonexistent articles', () => {
    expect(src).toMatch(/No film-by-film analysis is published yet \(0 of \{total\} films\)/);
    expect(src).toMatch(/sum\.publishedCount === 0 \? <HowScoresAreChecked total=\{sum\.total\} \/> : <HowArticlesAreMade \/>/);
    // The zero-state section reuses no article-only claims.
    const zero = src.slice(src.indexOf('function HowScoresAreChecked'), src.indexOf('function HowArticlesAreMade'));
    expect(zero).not.toMatch(/\bAI\b|\barticles?\b|fact-check/i);
  });

  it('has an in-body install CTA and a link to the find-what-to-watch guide, plus the research link', () => {
    expect(src).toMatch(/href=\{CHROME_WEB_STORE_URL\}/);
    expect(src).toMatch(/href="\/how-to\/find-what-to-watch-on-netflix"/);
    expect(src).toMatch(/href="\/research\/imdb-vs-rotten-tomatoes-gap"/);
  });
});

describe('inbound link helpers (I8)', () => {
  const entries = [
    {
      path: '/blog/a-2020',
      title: 't',
      description: 'd',
      published: '2026-10-20',
      updated: '2026-10-20',
      label: 'A (2020)',
      scores: { imdb: 7, rt: 70, gap: 0, asOf: '2026-10-15' },
      imdbId: 'tt0000042',
    },
  ];
  const ready = { ready: true, dataUpdated: '2026-10-15' };
  const notReady = { ready: false, dataUpdated: null };

  it('follows the committed registry by default', () => {
    expect(isBlogHubReady()).toBe(BLOG_HUB.ready);
  });

  it('resolves an article path by IMDb id only for a ready hub', () => {
    expect(isBlogHubReady(ready)).toBe(true);
    expect(isBlogHubReady(notReady)).toBe(false);
    expect(articlePathForImdbId('tt0000042', ready, entries)).toBe('/blog/a-2020');
    expect(articlePathForImdbId('tt0000042', notReady, entries)).toBeNull();
    expect(articlePathForImdbId('tt9999999', ready, entries)).toBeNull();
  });
});

describe('OG and Twitter image routes (item 12)', () => {
  it.each(['app/blog/[slug]/opengraph-image.tsx', 'app/blog/[slug]/twitter-image.tsx'])('%s sets dynamicParams = false', (p) => {
    expect(read(p)).toMatch(/^export const dynamicParams = false;$/m);
  });

  it('og-card.tsx uses design tokens, no hex literals', () => {
    expect(read('app/blog/_components/og-card.tsx')).not.toMatch(/['"]#[0-9a-fA-F]{3,8}['"]/);
  });
});
