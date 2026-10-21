import { existsSync } from 'fs';
import { join } from 'path';
import { PAGES } from '../../lib/pages';
import { SITE_URL, EXTENSION_ZIP_PATH, SUPPORT_EMAIL, PRO_PRICING } from '../../lib/content';
import { siteGraph, softwareApplication, webPage, breadcrumbList, nodeId, jsonLdString, blogPosting, movie, isoDateTime } from '../../lib/seo';
import { isFullDateTime } from '../../lib/html-seo';
import { filmBySlug } from '../blog/fixtures';
import manifest from '../../extension/manifest.json';

type Node = Record<string, any>;

const nodesOf = (g: any): Node[] => g['@graph'];

/** Every `{ '@id': X }` reference object (an object whose only key is @id). */
function collectRefs(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => collectRefs(v, out));
  else if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === '@id') out.push((value as Node)['@id']);
    else Object.values(value).forEach((v) => collectRefs(v, out));
  }
  return out;
}

function findUndefined(value: unknown, path = '$'): string[] {
  if (value === undefined) return [path];
  if (Array.isArray(value)) return value.flatMap((v, i) => findUndefined(v, `${path}[${i}]`));
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => findUndefined(v, `${path}.${k}`));
  return [];
}

const definedIds = (nodes: Node[]) => nodes.filter((n) => n['@id']).map((n) => n['@id'] as string);

describe('siteGraph (root layout JSON-LD)', () => {
  const g = siteGraph();
  const nodes = nodesOf(g);

  it('has no undefined values and survives a JSON round trip unchanged', () => {
    expect(findUndefined(g)).toEqual([]);
    expect(JSON.parse(jsonLdString(g))).toEqual(g);
  });

  it('has no duplicate @ids', () => {
    const ids = definedIds(nodes);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every @id reference points at a defined node', () => {
    const ids = new Set(definedIds(nodes));
    const refs = collectRefs(nodes);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(ids).toContain(ref);
  });

  it('does not define the SoftwareApplication: only product pages emit it (never the legal pages or /account)', () => {
    expect(nodes.find((n) => n['@type'] === 'SoftwareApplication')).toBeUndefined();
    expect(JSON.stringify(g)).not.toContain('#app');
  });

  it('has no GitHub link and no code-repository or open-source claim anywhere', () => {
    const json = JSON.stringify(g);
    expect(json).not.toMatch(/github/i);
    expect(json).not.toMatch(/open[- ]source/i);
    expect(json).not.toContain('codeRepository');
    expect(json).not.toContain('"license"');
  });

  it('omits sameAs on the site entities while there is nothing to list', () => {
    for (const type of ['Person', 'Organization']) {
      expect(nodes.find((n) => n['@type'] === type)).not.toHaveProperty('sameAs');
    }
  });

  it('points the author URL at /about', () => {
    expect(nodes.find((n) => n['@type'] === 'Person')!.url).toBe(`${SITE_URL}/about`);
  });

  it('gives the Organization a logo and a support contactPoint', () => {
    const org = nodes.find((n) => n['@type'] === 'Organization')!;
    expect(org.logo).toMatchObject({ '@type': 'ImageObject', url: `${SITE_URL}/icon` });
    expect(org.contactPoint).toMatchObject({ '@type': 'ContactPoint', email: SUPPORT_EMAIL });
  });

  it('WebSite has no SearchAction (the site has no search)', () => {
    expect(JSON.stringify(g)).not.toContain('SearchAction');
  });

  it('does not put FAQPage in the site graph', () => {
    expect(JSON.stringify(g)).not.toContain('FAQPage');
  });
});

describe('softwareApplication (product pages only)', () => {
  const off = softwareApplication(false) as Node;
  const on = softwareApplication(true) as Node;

  it('has the fixed @id the webPage nodes reference, and no undefined values', () => {
    expect(off['@id']).toBe(`${SITE_URL}/#app`);
    expect(findUndefined(off)).toEqual([]);
    expect(findUndefined(on)).toEqual([]);
    expect(JSON.parse(jsonLdString({ '@graph': [on] } as any))['@graph'][0]).toEqual(on);
  });

  it('reads its version from the extension manifest and points at the install page and hosted zip', () => {
    expect(off.softwareVersion).toBe(manifest.version);
    expect(off.installUrl).toBe(`${SITE_URL}/install`);
    expect(off.downloadUrl).toBe(`${SITE_URL}${EXTENSION_ZIP_PATH}`);
    expect(off.applicationSubCategory).toBeTruthy();
    expect(off.browserRequirements).toBeTruthy();
  });

  it('operatingSystem is a short platform value, not a sentence', () => {
    expect(off.operatingSystem).toBe('Chrome, Web browser');
    expect((off.operatingSystem as string).length).toBeLessThan(40);
    expect(off.operatingSystem).not.toMatch(/\(|runs in/i);
  });

  it('dates are full ISO 8601 date-times with a time zone', () => {
    for (const key of ['datePublished', 'dateModified']) expect(isFullDateTime(off[key])).toBe(true);
  });

  it('Pro not on sale: free only. One free Offer, isAccessibleForFree, no price or trial anywhere', () => {
    expect(off.isAccessibleForFree).toBe(true);
    const offers = off.offers as Array<Record<string, any>>;
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ price: '0', priceCurrency: 'USD' });
    const json = JSON.stringify(off);
    expect(json).not.toMatch(new RegExp(`${PRO_PRICING.monthly}|"${PRO_PRICING.yearly}"|trial|UnitPriceSpecification`));
    expect((off.featureList as string[]).join(' ')).toMatch(/Experimental AR mode/);
  });

  it('Pro on sale: paid Offers that match the pricing page, and no isAccessibleForFree next to them', () => {
    expect(on).not.toHaveProperty('isAccessibleForFree');
    const offers = on.offers as Array<Record<string, any>>;
    expect(offers[0]).toMatchObject({ price: '0', priceCurrency: 'USD' });
    const pro = offers.slice(1);
    expect(pro.map((o) => [o.price, o.priceCurrency, o.priceSpecification.billingDuration])).toEqual([
      [PRO_PRICING.monthly, 'USD', 'P1M'],
      [PRO_PRICING.yearly, 'USD', 'P1Y'],
    ]);
    expect(pro.every((o) => o.priceSpecification['@type'] === 'UnitPriceSpecification')).toBe(true);
    expect((on.featureList as string[]).join(' ')).toMatch(/Pro AR mode.*3-day free trial/);
  });

  it('only claims a license when a LICENSE file exists, and makes no tracking claim', () => {
    const hasLicense = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].some((f) => existsSync(join(__dirname, '../..', f)));
    if (!hasLicense) expect(off).not.toHaveProperty('license');
    expect(JSON.stringify(off)).not.toMatch(/tracking/i);
  });

  it('is emitted by home, pricing and GuideLayout pages but not by the legal pages or /account', () => {
    const read = (f: string) => require('fs').readFileSync(join(__dirname, '../..', f), 'utf8') as string;
    expect(read('app/page.tsx')).toMatch(/softwareApplication\(\)/);
    expect(read('app/pricing/page.tsx')).toMatch(/softwareApplication\(\)/);
    expect(read('components/GuideLayout.tsx')).toMatch(/softwareApplication\(\)/);
    for (const f of ['app/privacy/page.tsx', 'app/terms/page.tsx', 'app/refund-policy/page.tsx', 'app/account/page.tsx', 'app/layout.tsx']) {
      expect(read(f)).not.toMatch(/softwareApplication/);
    }
  });
});

describe('webPage', () => {
  // webPage() points `about` at the app, which the page itself defines (GuideLayout adds softwareApplication()).
  const site = new Set([...definedIds(nodesOf(siteGraph())), (softwareApplication(false) as Node)['@id'] as string]);

  it.each(PAGES.map((p) => [p.path] as const))('%s: complete node, refs resolve against site graph + page breadcrumb', (path) => {
    const page = PAGES.find((p) => p.path === path)!;
    const wp = webPage(path) as Node;
    const breadcrumb = { ...breadcrumbList([{ name: 'Home', path: '/' }]), '@id': nodeId(path, 'breadcrumb') };
    const pageNodes = [wp, breadcrumb];

    expect(wp['@type']).toBe('WebPage');
    expect(wp['@id']).toBe(`${SITE_URL}${path}#webpage`);
    expect(wp.dateModified).toBe(isoDateTime(page.updated));
    expect(isFullDateTime(wp.dateModified)).toBe(true);
    expect(isFullDateTime(wp.datePublished)).toBe(true);
    expect(findUndefined(wp)).toEqual([]);

    const ids = definedIds(pageNodes);
    expect(new Set([...ids, ...site]).size).toBe(ids.length + site.size); // no collisions with the site graph
    const known = new Set([...ids, ...site]);
    for (const ref of collectRefs(pageNodes)) expect(known).toContain(ref);
  });
});

describe('blog page graph (WebPage + BreadcrumbList + BlogPosting + Movie)', () => {
  const site = new Set(definedIds(nodesOf(siteGraph())));
  const film = filmBySlug('crimson-static-2022');
  const path = `/blog/${film.slug}`;

  // Article paths come from the generated registry (empty until a batch is published), so the
  // WebPage node is stood in by its @id; the real hub proves the webPage options end to end.
  const pageNodes: Node[] = [
    { '@type': 'WebPage', '@id': nodeId(path, 'webpage'), about: { '@id': nodeId(path, 'film') }, breadcrumb: { '@id': nodeId(path, 'breadcrumb') } },
    { ...breadcrumbList([{ name: 'Home', path: '/' }]), '@id': nodeId(path, 'breadcrumb') },
    blogPosting(path, { headline: 'Headline', description: 'Description.', published: '2026-10-20', updated: '2026-10-20', wordCount: 700 }),
    movie(film),
  ];

  it('has exactly one Movie and one BlogPosting, no undefined values', () => {
    expect(pageNodes.filter((n) => n['@type'] === 'Movie')).toHaveLength(1);
    expect(pageNodes.filter((n) => n['@type'] === 'BlogPosting')).toHaveLength(1);
    expect(findUndefined(pageNodes)).toEqual([]);
    expect(JSON.parse(jsonLdString({ '@graph': pageNodes } as any))['@graph']).toEqual(pageNodes);
  });

  it('every bare @id reference resolves in the page graph or the site graph', () => {
    const ids = definedIds(pageNodes);
    expect(new Set([...ids, ...site]).size).toBe(ids.length + site.size);
    const known = new Set([...ids, ...site]);
    for (const ref of collectRefs(pageNodes)) expect(known).toContain(ref);
  });

  it('the hub WebPage can be typed CollectionPage and keeps its defaults otherwise', () => {
    // /blog is registered only when the hub is ready (I9): build the hub node against a ready registry.
    let hub = {} as Node;
    jest.isolateModules(() => {
      jest.doMock('../../lib/blog/registry.generated', () => ({
        BLOG_HUB: { ready: true, dataUpdated: '2026-10-15' },
        BLOG_ARTICLE_PAGES: [],
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const seo = require('../../lib/seo') as typeof import('../../lib/seo');
      hub = seo.webPage('/blog', { type: 'CollectionPage' }) as Node;
    });
    jest.dontMock('../../lib/blog/registry.generated');
    expect(hub['@type']).toBe('CollectionPage');
    expect(hub['@id']).toBe(`${SITE_URL}/blog#webpage`);
    expect(hub.about).toEqual({ '@id': `${SITE_URL}/#app` });
    // the inline CollectionPage inside BlogPosting.isPartOf is the same @id as the hub's WebPage
    expect((pageNodes[2] as Node).isPartOf['@id']).toBe(hub['@id']);
  });
});
