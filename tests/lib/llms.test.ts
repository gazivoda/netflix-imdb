import { buildLlmsTxt, buildLlmsFullTxt, sectionsFor, LLMS_HEADERS } from '../../lib/llms';
import { PAGES } from '../../lib/pages';
import { FAQS, SITE_URL, REPO_URL } from '../../lib/content';
import { absoluteUrl } from '../../lib/seo';

describe('llms.txt', () => {
  const txt = buildLlmsTxt();

  it('starts with an H1 and a blockquote summary', () => {
    const [h1, blank, quote] = txt.split('\n');
    expect(h1).toBe('# Rating Watch');
    expect(blank).toBe('');
    expect(quote.startsWith('> ')).toBe(true);
  });

  it('lists every registry page by absolute URL with its description', () => {
    for (const p of PAGES) {
      expect(txt).toContain(`](${absoluteUrl(p.path)}): ${p.description}`);
    }
  });

  it('uses only absolute links', () => {
    const links = [...txt.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l).toMatch(/^https:\/\//);
  });

  it('includes key facts and the repo link', () => {
    expect(txt).toContain('## Key facts');
    expect(txt).toContain(REPO_URL);
    expect(txt).toContain('Manifest V3');
  });

  it('never uses the wrong brand name', () => {
    expect(txt + buildLlmsFullTxt()).not.toMatch(/Netflix IMDB Ratings/i);
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
    for (const p of PAGES) {
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

describe('response headers', () => {
  it('are plain text utf-8 with a cache policy', () => {
    expect(LLMS_HEADERS['Content-Type']).toBe('text/plain; charset=utf-8');
    expect(LLMS_HEADERS['Cache-Control']).toMatch(/max-age/);
  });
});
