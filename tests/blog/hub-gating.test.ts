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
