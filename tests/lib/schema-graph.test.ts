import { existsSync } from 'fs';
import { join } from 'path';
import { PAGES } from '../../lib/pages';
import { SITE_URL, REPO_URL } from '../../lib/content';
import { siteGraph, webPage, breadcrumbList, nodeId, jsonLdString } from '../../lib/seo';
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

  it('SoftwareApplication reads its version from the extension manifest', () => {
    const app = nodes.find((n) => n['@type'] === 'SoftwareApplication')!;
    expect(app.softwareVersion).toBe(manifest.version);
    expect(app.installUrl).toBe(`${SITE_URL}/install`);
    expect(app.applicationSubCategory).toBeTruthy();
    expect(app.browserRequirements).toBeTruthy();
  });

  it('only claims a license when a LICENSE file exists', () => {
    const app = nodes.find((n) => n['@type'] === 'SoftwareApplication')!;
    const hasLicense = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].some((f) => existsSync(join(__dirname, '../..', f)));
    if (!hasLicense) expect(app).not.toHaveProperty('license');
  });

  it('sameAs lists only the GitHub repo/profile', () => {
    for (const n of nodes) {
      for (const url of n.sameAs ?? []) expect(url).toMatch(/^https:\/\/github\.com\/gazivoda(\/netflix-imdb)?$/);
    }
    expect(nodes.find((n) => n['@type'] === 'Organization')!.sameAs).toEqual([REPO_URL]);
  });

  it('WebSite has no SearchAction (the site has no search)', () => {
    expect(JSON.stringify(g)).not.toContain('SearchAction');
  });

  it('does not put FAQPage in the site graph', () => {
    expect(JSON.stringify(g)).not.toContain('FAQPage');
  });
});

describe('webPage', () => {
  const site = new Set(definedIds(nodesOf(siteGraph())));

  it.each(PAGES.map((p) => [p.path] as const))('%s: complete node, refs resolve against site graph + page breadcrumb', (path) => {
    const page = PAGES.find((p) => p.path === path)!;
    const wp = webPage(path) as Node;
    const breadcrumb = { ...breadcrumbList([{ name: 'Home', path: '/' }]), '@id': nodeId(path, 'breadcrumb') };
    const pageNodes = [wp, breadcrumb];

    expect(wp['@type']).toBe('WebPage');
    expect(wp['@id']).toBe(`${SITE_URL}${path}#webpage`);
    expect(wp.dateModified).toBe(page.updated);
    expect(wp.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(findUndefined(wp)).toEqual([]);

    const ids = definedIds(pageNodes);
    expect(new Set([...ids, ...site]).size).toBe(ids.length + site.size); // no collisions with the site graph
    const known = new Set([...ids, ...site]);
    for (const ref of collectRefs(pageNodes)) expect(known).toContain(ref);
  });
});
