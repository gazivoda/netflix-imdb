import { analyzePages, formatTable, resolveInternal } from '../../lib/link-audit';

const SITE = 'https://example.test';

const page = (
  path: string,
  body: string,
  head?: { title?: string; desc?: string; canonical?: string | null },
) => {
  const h = { title: `Title ${path}`, desc: `Description ${path}`, canonical: `${SITE}${path === '/' ? '' : path}`, ...head };
  return {
    path,
    html: `<!DOCTYPE html><html><head>
      ${h.title === undefined ? '' : `<title>${h.title}</title>`}
      ${h.desc === undefined ? '' : `<meta name="description" content="${h.desc}"/>`}
      ${h.canonical ? `<link rel="canonical" href="${h.canonical}"/>` : ''}
      <script type="application/ld+json">{"x":"<a href='/ghost'>x</a><h1>no</h1>"}</script>
    </head><body>${body}</body></html>`,
  };
};

const audit = (pages: ReturnType<typeof page>[], extra: Partial<Parameters<typeof analyzePages>[1]> = {}) =>
  analyzePages(pages, { siteUrl: SITE, registry: pages.map((p) => p.path), ...extra });

const codes = (r: ReturnType<typeof audit>) => r.findings.map((f) => `${f.code}@${f.path}`).sort();

const home = (links = '<a href="/a">A</a>') => page('/', `<h1>Home</h1>${links}`);
const a = (links = '<a href="/">Home</a>') => page('/a', `<h1>A</h1>${links}`);

describe('analyzePages', () => {
  it('passes a clean two-page site and ignores markup inside <script>', () => {
    const r = audit([home(), a()]);
    expect(r.findings).toEqual([]);
    expect(r.depth).toEqual({ '/': 0, '/a': 1 });
    expect(r.inbound).toEqual({ '/': 1, '/a': 1 });
  });

  it('flags links to paths outside the registry, but not allow-listed targets', () => {
    const pages = [home('<a href="/a">A</a><a href="/nope">Nope</a><a href="/logo.svg">Logo</a>'), a()];
    expect(codes(audit(pages))).toEqual(['broken-link@/', 'broken-link@/']);
    expect(codes(audit(pages, { allowTargets: ['/logo.svg'] }))).toEqual(['broken-link@/']);
    expect(codes(audit(pages, { allowTargets: [/^\/(nope|logo\.svg)$/] }))).toEqual([]);
  });

  it('treats absolute same-site URLs as internal, ignores hashes, query, mailto and trailing slashes', () => {
    const r = audit([
      home(`<a href="${SITE}/a/?x=1#top">A</a><a href="#main">Skip</a><a href="mailto:a@b.c">Mail</a>`),
      a(),
    ]);
    expect(r.findings).toEqual([]);
    expect(r.inbound['/a']).toBe(1);
  });

  it('flags orphans and pages deeper than max click depth', () => {
    const pages = [
      home('<a href="/a">A</a>'),
      page('/a', '<h1>A</h1><a href="/b">B</a>'),
      page('/b', '<h1>B</h1><a href="/c">C</a>'),
      page('/c', '<h1>C</h1><a href="/">Home</a>'),
      page('/lonely', '<h1>L</h1><a href="/">Home</a>'),
    ];
    const r = audit(pages);
    expect(r.depth['/c']).toBe(3);
    expect(codes(r)).toEqual(['deep-page@/c', 'orphan@/lonely']);
    expect(codes(audit(pages, { maxDepth: 3 }))).toEqual(['orphan@/lonely']);
  });

  it('does not count a self-link as inbound', () => {
    const r = audit([home(), a('<a href="/a">me</a>')]);
    expect(r.inbound['/a']).toBe(1);
    const only = audit([home('<a href="/">me</a>'), a()]);
    expect(codes(only)).toEqual(['orphan@/a']);
  });

  it('reports a registry page with no rendered HTML', () => {
    const r = analyzePages([home()], { siteUrl: SITE, registry: ['/', '/a'] });
    expect(codes(r)).toEqual(['page-missing@/a']);
  });

  it('checks H1: missing, empty, duplicate', () => {
    const r = audit([
      page('/', '<a href="/a">A</a><a href="/b">B</a>'),
      page('/a', '<h1>A</h1><h1>Again</h1><a href="/">Home</a>'),
      page('/b', '<h1> <span></span> </h1><a href="/">Home</a>'),
    ]);
    expect(codes(r)).toEqual(['duplicate-h1@/a', 'missing-h1@/', 'missing-h1@/b']);
  });

  it('checks title, description and canonical', () => {
    const r = audit([
      page('/', '<h1>H</h1><a href="/a">A</a><a href="/b">B</a><a href="/c">C</a>', { title: '', desc: '' }),
      page('/a', '<h1>A</h1><a href="/">H</a>', { canonical: null }),
      page('/b', '<h1>B</h1><a href="/">H</a>', { canonical: `${SITE}/` }),
      page('/c', '<h1>C</h1><a href="/">H</a>'),
    ]);
    expect(codes(r)).toEqual([
      'canonical-mismatch@/b',
      'missing-canonical@/a',
      'missing-description@/',
      'missing-title@/',
    ]);
  });

  it('accepts either form of the homepage canonical', () => {
    for (const canonical of [SITE, `${SITE}/`]) {
      expect(audit([page('/', '<h1>H</h1>', { canonical })]).findings).toEqual([]);
    }
  });

  it('flags duplicate titles and descriptions across pages', () => {
    const r = audit([
      page('/', '<h1>H</h1><a href="/a">A</a>', { title: 'Same', desc: 'Same desc' }),
      page('/a', '<h1>A</h1><a href="/">H</a>', { title: 'Same', desc: 'Same desc' }),
    ]);
    expect(codes(r)).toEqual([
      'duplicate-description@/',
      'duplicate-description@/a',
      'duplicate-title@/',
      'duplicate-title@/a',
    ]);
  });

  it('skips head checks for noindex pages', () => {
    const noindex = page('/a', '<h1>A</h1><a href="/">H</a>', { title: '', desc: '', canonical: null });
    noindex.html = noindex.html.replace('<head>', '<head><meta name="robots" content="noindex, nofollow"/>');
    expect(audit([home(), noindex]).findings).toEqual([]);
  });

  it('flags images without alt but allows empty (decorative) alt', () => {
    const r = audit([
      home('<a href="/a">A</a><img src="/x.png"><img src="/y.png" alt=""><img src="/z.png" alt="Z">'),
      a(),
    ], { allowTargets: [/^\/[xyz]\.png$/] });
    expect(codes(r)).toEqual(['img-no-alt@/']);
  });

  it('flags links with no accessible text, accepts aria-label, img alt, svg title and title attribute', () => {
    const r = audit([
      home(
        [
          '<a href="/a"></a>',
          '<a href="/a"><svg><path d="M0"/></svg></a>',
          '<a href="/a" aria-label="Go to A"><svg></svg></a>',
          '<a href="/a"><img src="/i.png" alt="Logo"></a>',
          '<a href="/a"><img src="/i.png" alt=""></a>',
          '<a href="/a"><svg><title>Alpha</title></svg></a>',
          '<a href="/a" title="Alpha"><span></span></a>',
          '<a href="/a">  <b>Text</b> </a>',
        ].join(''),
      ),
      a(),
    ], { allowTargets: ['/i.png'] });
    expect(r.findings.filter((f) => f.code === 'link-no-text')).toHaveLength(3);
  });

  it('flags external target=_blank links lacking rel noopener/noreferrer', () => {
    const r = audit([
      home(
        [
          '<a href="/a">A</a>',
          '<a href="https://ext.test/1" target="_blank">bad</a>',
          '<a href="https://ext.test/2" target="_blank" rel="nofollow">bad2</a>',
          '<a href="https://ext.test/3" target="_blank" rel="noopener noreferrer">ok</a>',
          '<a href="https://ext.test/4" target="_blank" rel="noreferrer">ok</a>',
          '<a href="https://ext.test/5">same tab ok</a>',
          `<a href="${SITE}/a" target="_blank">internal ok</a>`,
        ].join(''),
      ),
      a(),
    ]);
    expect(r.findings.filter((f) => f.code === 'external-no-noopener').map((f) => f.target)).toEqual([
      'https://ext.test/1',
      'https://ext.test/2',
    ]);
  });

  it('decodes entities in attributes when resolving links', () => {
    const r = audit([home('<a href="/a?x=1&amp;y=2">A</a>'), a()]);
    expect(r.findings).toEqual([]);
  });
});

describe('resolveInternal', () => {
  it('resolves relative hrefs against the source page', () => {
    expect(resolveInternal('b', '/guide/a', SITE)).toBe('/guide/b');
    expect(resolveInternal('../x', '/guide/a', SITE)).toBe('/x');
    expect(resolveInternal('https://other.test/x', '/', SITE)).toBeNull();
    expect(resolveInternal('tel:123', '/', SITE)).toBeNull();
  });
});

describe('formatTable', () => {
  it('is empty without findings and aligned with them', () => {
    expect(formatTable([])).toBe('');
    const out = formatTable([{ severity: 'error', code: 'orphan', path: '/x', message: 'No links' }]);
    expect(out.split('\n')).toHaveLength(3);
    expect(out).toContain('orphan');
  });
});
