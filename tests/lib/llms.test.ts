import { buildLlmsTxt, buildLlmsFullTxt, sectionsFor, LLMS_HEADERS } from '../../lib/llms';
import { PAGES, buildPages, type SitePage } from '../../lib/pages';
import type { BlogArticlePage } from '../../lib/blog/registry.generated';
import { FAQS, SITE_URL, CHROME_WEB_STORE_URL } from '../../lib/content';
import { absoluteUrl } from '../../lib/seo';
import manifest from '../../extension/manifest.json';

describe('llms.txt', () => {
  const txt = buildLlmsTxt();

  it('starts with an H1 and a blockquote summary', () => {
    const [h1, blank, quote] = txt.split('\n');
    expect(h1).toBe('# Rating Watch');
    expect(blank).toBe('');
    expect(quote.startsWith('> ')).toBe(true);
  });

  it('lists every registry page by absolute URL with its description', () => {
    for (const p of PAGES.filter((x) => x.kind !== 'article')) {
      expect(txt).toContain(`](${absoluteUrl(p.path)}): ${p.description}`);
    }
  });

  it('uses only absolute links', () => {
    const links = [...txt.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l).toMatch(/^https:\/\//);
  });

  it('includes key facts, and points at no GitHub or open-source claim', () => {
    expect(txt).toContain('## Key facts');
    expect(txt).toContain('Manifest V3');
    expect(txt).toContain(`version ${manifest.version}`);
    for (const out of [txt, buildLlmsFullTxt()]) {
      expect(out).not.toMatch(/github/i);
      expect(out).not.toMatch(/open[- ]source/i);
      expect(out).not.toContain('## Source');
    }
  });

  it('never uses the wrong brand name', () => {
    expect(txt + buildLlmsFullTxt()).not.toMatch(/Netflix IMDB Ratings/i);
  });

  it('describes the live store installation without the old manual ZIP flow', () => {
    for (const text of [txt, buildLlmsFullTxt()]) {
      expect(text).toContain(CHROME_WEB_STORE_URL);
      expect(text).toContain('Add to Chrome');
      expect(text).not.toMatch(/not (?:on|in) the Chrome Web Store|Load unpacked|Developer mode|download.{0,20}zip/i);
    }
  });

  it('puts new pages in the right section automatically', () => {
    const extra = [
      ...PAGES,
      { ...PAGES[1], path: '/guides/new-one', group: 'guide' as const, label: 'New one' },
      { ...PAGES[1], path: '/standalone', group: undefined, label: 'Standalone' },
    ];
    const sections = Object.fromEntries(
      sectionsFor(extra).map((s) => [s.heading, s.pages.map((p) => p.path)]),
    );
    expect(sections.Guides).toContain('/guides/new-one');
    expect(sections.Project).toContain('/standalone');
    expect(sections.Optional).toContain('/privacy');
    expect(buildLlmsTxt(extra)).toContain(`${SITE_URL}/guides/new-one`);
  });

  it('omits empty sections', () => {
    const headings = sectionsFor([PAGES[0]]).map((s) => s.heading);
    expect(headings).toEqual(['Docs']);
  });
});

describe('llms-full.txt', () => {
  const full = buildLlmsFullTxt();

  it('contains every registry URL and title', () => {
    for (const p of PAGES.filter((x) => x.kind !== 'article')) {
      expect(full).toContain(`URL: ${absoluteUrl(p.path)}`);
      expect(full).toContain(`### ${p.title}`);
    }
  });

  it('contains every homepage FAQ question and answer verbatim', () => {
    for (const f of FAQS) {
      expect(full).toContain(`### ${f.q}`);
      expect(full).toContain(f.a);
    }
  });

  it('is richer than llms.txt', () => {
    expect(full.length).toBeGreaterThan(buildLlmsTxt().length);
  });
});

describe('blog film analyses', () => {
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
  // Article pages exist only with a ready hub (I9).
  const READY = { ready: true, dataUpdated: '2026-10-15' };
  const withArticle: SitePage[] = buildPages([fake], READY);
  const fakeUrl = absoluteUrl(fake.path);

  it('sectionsFor keeps articles out of every llms.txt section, Project included', () => {
    const all = sectionsFor(withArticle).flatMap((s) => s.pages.map((p) => p.path));
    expect(all).not.toContain(fake.path);
    expect(all).toContain('/blog'); // the hub is a normal guide
    expect(sectionsFor(withArticle).find((s) => s.heading === 'Guides')!.pages.map((p) => p.label)).toContain('Blog');
  });

  it('llms.txt links the hub but no article URL, and adds the dataset link once articles exist', () => {
    const txt = buildLlmsTxt(withArticle);
    expect(txt).toContain(`](${absoluteUrl('/blog')})`);
    expect(txt).not.toContain(fakeUrl);
    expect(txt).toContain(`](${absoluteUrl('/data/netflix-top-100.json')})`);
  });

  it('llms.txt has no /blog line while the hub is not ready (I9)', () => {
    expect(buildLlmsTxt(buildPages([], { ready: false, dataUpdated: null }))).not.toContain(`](${absoluteUrl('/blog')})`);
  });

  it('llms.txt has no dataset link while nothing is published', () => {
    expect(buildLlmsTxt()).not.toContain('netflix-top-100.json');
    expect(buildLlmsFullTxt()).not.toContain('## Film analyses');
  });

  it('llms-full.txt lists every published article in a Film analyses section', () => {
    const full = buildLlmsFullTxt(withArticle);
    expect(full).toContain('## Film analyses');
    expect(full).toContain(`- [Fake Film (2020)](${fakeUrl}): IMDb 6.3, RT 36%, gap -27, scores as of October 15, 2026`);
    expect(full).not.toContain(`### ${fake.title}`);
    expect(full.indexOf('## Film analyses')).toBeLessThan(full.indexOf('## Frequently asked questions'));
  });

  it('formats a positive gap with a plus sign and keeps one line per article', () => {
    const two = buildPages([fake, { ...fake, path: '/blog/other-2019', label: 'Other (2019)', scores: { imdb: 7, rt: 91, gap: 21, asOf: '2026-10-15' } }], READY);
    const lines = buildLlmsFullTxt(two).split('\n').filter((l) => l.startsWith('- [') && l.includes('/blog/'));
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('IMDb 7.0, RT 91%, gap +21');
  });
});

describe('response headers', () => {
  it('are plain text utf-8 with a cache policy', () => {
    expect(LLMS_HEADERS['Content-Type']).toBe('text/plain; charset=utf-8');
    expect(LLMS_HEADERS['Cache-Control']).toMatch(/max-age/);
  });
});

describe('llms.txt Pro wording follows the billing flag (build-time)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { staticPages } = require('../../lib/pages') as typeof import('../../lib/pages')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildFaqs } = require('../../lib/content') as typeof import('../../lib/content')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildLlmsTxt, buildLlmsFullTxt } = require('../../lib/llms') as typeof import('../../lib/llms')

  it('while Pro is not on sale neither file advertises a price, trial, refund window or Pro plan', () => {
    const off = [buildLlmsTxt(staticPages(false), false), buildLlmsFullTxt(staticPages(false), buildFaqs(false), false)]
    for (const text of off) {
      expect(text).toMatch(/free to try/i)
      expect(text).not.toMatch(/\$\d|free trial|3-day|14-day|refund window|\bPro\b/)
    }
  })

  it('once Pro is on sale llms.txt states the prices and the trial', () => {
    const on = buildLlmsTxt(staticPages(true), true)
    expect(on).toMatch(/AR mode is Pro \(\$2\.99\/month or \$29\/year, 3-day free trial\); see \/pricing/)
  })
})
