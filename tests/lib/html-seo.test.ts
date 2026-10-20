import { checkPage, htmlFileForPath } from '../../lib/html-seo';

const SITE = 'https://example.test';
const TITLE = 'Install Rating Watch on Chrome · Rating Watch';
const DESC =
  'Install the free Rating Watch extension in about a minute: download from GitHub and click Load unpacked.';

const ld = (data: unknown) =>
  `<script type="application/ld+json">${typeof data === 'string' ? data : JSON.stringify(data)}</script>`;

const BASE_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Person', '@id': `${SITE}/#author`, name: 'A' },
    { '@type': 'Article', headline: 'x', author: { '@id': `${SITE}/#author` } },
  ],
};

interface Opts {
  path?: string;
  head?: string;
  body?: string;
  scripts?: string[];
  without?: string[]; // substrings of head parts to drop
}

/** A fully valid page; tests override pieces to break exactly one rule. */
function page({ path = '/install', head, body, scripts, without = [] }: Opts = {}): string {
  const parts = [
    `<meta charSet="utf-8"/>`,
    `<meta name="viewport" content="width=device-width, initial-scale=1"/>`,
    `<title>${TITLE}</title>`,
    `<meta name="description" content="${DESC}"/>`,
    `<meta name="robots" content="index, follow"/>`,
    `<link rel="canonical" href="${SITE}${path}"/>`,
    `<meta property="og:title" content="${TITLE}"/>`,
    `<meta property="og:description" content="${DESC}"/>`,
    `<meta property="og:image" content="${SITE}/opengraph-image"/>`,
    `<meta name="twitter:image" content="${SITE}/twitter-image"/>`,
  ].filter((p) => !without.some((w) => p.includes(w)));
  const blocks = (scripts ?? [ld(BASE_LD)]).join('');
  return `<!DOCTYPE html><html lang="en"><head>${parts.join('')}${head ?? ''}${blocks}</head><body>${
    body ?? '<main><h1>Install</h1><p>Hello</p></main>'
  }</body></html>`;
}

const run = (html: string, path = '/install') => checkPage({ path, html, siteUrl: SITE });
const rules = (html: string, path?: string) => run(html, path).map((f) => f.rule);

describe('checkPage', () => {
  it('passes a fully valid page', () => {
    expect(run(page())).toEqual([]);
  });

  it('accepts the home canonical with or without a trailing slash', () => {
    expect(run(page({ path: '/' }), '/')).toEqual([]);
    expect(run(page().replace(`${SITE}/install`, SITE), '/')).toEqual([]);
  });

  describe('title', () => {
    it('requires exactly one', () => {
      expect(rules(page({ head: '<title>Another title here</title>' }))).toContain('title');
      expect(rules(page({ without: ['<title>'] }))).toContain('title');
    });
    it('enforces 10-65 chars', () => {
      expect(rules(page().replace(TITLE, 'Short'))).toContain('title');
      expect(rules(page().replace(TITLE, 'x'.repeat(66)))).toContain('title');
      expect(rules(page().replace(TITLE, 'x'.repeat(65)))).not.toContain('title');
    });
    it('counts decoded entities, not raw markup', () => {
      const t = 'Tom &amp; Jerry &#x27;s Guide to Ratings'; // 38 decoded chars
      expect(rules(page().replace(TITLE, t))).not.toContain('title');
    });
  });

  describe('meta description', () => {
    it('requires exactly one', () => {
      expect(rules(page({ without: ['name="description"'] }))).toContain('description');
      expect(rules(page({ head: `<meta name="description" content="${DESC}"/>` }))).toContain('description');
    });
    it('enforces 70-160 chars', () => {
      expect(rules(page().replace(DESC, 'Too short'))).toContain('description');
      expect(rules(page().replace(DESC, 'y'.repeat(161)))).toContain('description');
      expect(rules(page().replace(DESC, 'y'.repeat(160)))).not.toContain('description');
    });
    it('is attribute-order independent', () => {
      const flipped = page({ without: ['name="description"'], head: `<meta content="${DESC}" name="description"/>` });
      expect(rules(flipped)).not.toContain('description');
    });
  });

  describe('canonical', () => {
    it('requires exactly one', () => {
      expect(rules(page({ without: ['canonical'] }))).toContain('canonical');
      expect(rules(page({ head: `<link rel="canonical" href="${SITE}/install"/>` }))).toContain('canonical');
    });
    it('must equal SITE_URL + path', () => {
      expect(rules(page().replace(`${SITE}/install`, `${SITE}/other`))).toContain('canonical');
      expect(rules(page().replace(`${SITE}/install`, `${SITE}/install/`))).toContain('canonical');
      expect(rules(page().replace(`${SITE}/install`, 'http://example.test/install'))).toContain('canonical');
    });
  });

  describe('social tags', () => {
    it.each(['og:title', 'og:description', 'og:image', 'twitter:image'])('requires %s', (key) => {
      expect(rules(page({ without: [`"${key}"`] }))).toContain('social');
    });
    it('requires absolute https image URLs', () => {
      expect(rules(page().replace(`${SITE}/opengraph-image`, '/opengraph-image'))).toContain('social');
      expect(rules(page().replace(`${SITE}/twitter-image`, 'http://example.test/t.png'))).toContain('social');
    });
    it('accepts name= or property= for either network', () => {
      const html = page({ without: ['og:image'], head: `<meta name="og:image" content="${SITE}/o.png"/>` });
      expect(rules(html)).not.toContain('social');
    });
  });

  describe('structure', () => {
    it('requires exactly one h1', () => {
      expect(rules(page({ body: '<p>none</p>' }))).toContain('h1');
      expect(rules(page({ body: '<h1>a</h1><h1>b</h1>' }))).toContain('h1');
    });
    it('does not count h1 text inside scripts', () => {
      expect(rules(page({ body: '<h1>a</h1><script>self.__next_f.push("<h1>x</h1>")</script>' }))).not.toContain('h1');
    });
    it('requires html lang', () => {
      expect(rules(page().replace('<html lang="en">', '<html>'))).toContain('lang');
    });
    it('requires viewport meta', () => {
      expect(rules(page({ without: ['viewport'] }))).toContain('viewport');
    });
  });

  describe('robots', () => {
    it('rejects noindex in robots or googlebot meta', () => {
      expect(rules(page({ head: '<meta name="robots" content="noindex, nofollow"/>' }))).toContain('noindex');
      expect(rules(page({ head: '<meta name="googlebot" content="noindex"/>' }))).toContain('noindex');
    });
  });

  describe('JSON-LD', () => {
    it('requires at least one block', () => {
      expect(rules(page({ scripts: [] }))).toContain('jsonld');
    });
    it('rejects blocks that do not parse', () => {
      expect(rules(page({ scripts: [ld('{"@context": "https://schema.org", ')] }))).toContain('jsonld');
    });
    it('requires @context on every block', () => {
      const noCtx = ld({ '@graph': [{ '@type': 'Thing' }] });
      expect(rules(page({ scripts: [ld(BASE_LD), noCtx] }))).toContain('jsonld');
    });
    it('checks every block, not just the first', () => {
      expect(rules(page({ scripts: [ld(BASE_LD), ld('{oops')] }))).toContain('jsonld');
    });
  });

  describe('bad serialised values', () => {
    it('flags undefined / NaN / [object Object] in JSON-LD', () => {
      const bad = ld({ '@context': 'https://schema.org', '@type': 'Thing', name: 'undefined' });
      expect(rules(page({ scripts: [bad] }))).toContain('bad-value');
      const nan = ld({ '@context': 'https://schema.org', '@type': 'Thing', name: 'NaN' });
      expect(rules(page({ scripts: [nan] }))).toContain('bad-value');
      const obj = ld({ '@context': 'https://schema.org', '@type': 'Thing', name: '[object Object]' });
      expect(rules(page({ scripts: [obj] }))).toContain('bad-value');
    });
    it('flags them in visible text and meta values', () => {
      expect(rules(page({ body: '<h1>Rated undefined/10</h1>' }))).toContain('bad-value');
      expect(rules(page().replace(DESC, `${DESC} NaN`))).toContain('bad-value');
    });
    it('does not match words that merely contain them', () => {
      expect(rules(page({ body: '<h1>Banana and an undefinedness joke</h1>' }))).not.toContain('bad-value');
    });
  });

  describe('@id references', () => {
    it('resolves references within one block', () => {
      expect(run(page())).toEqual([]);
    });
    it('resolves references across blocks on the same page', () => {
      const a = ld({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Person', '@id': `${SITE}/#author`, name: 'A' }] });
      const b = ld({ '@context': 'https://schema.org', '@type': 'Article', author: { '@id': `${SITE}/#author` } });
      expect(rules(page({ scripts: [a, b] }))).not.toContain('jsonld-ref');
    });
    it('flags dangling references', () => {
      const dangling = ld({
        '@context': 'https://schema.org',
        '@graph': [{ '@type': 'Article', publisher: { '@id': `${SITE}/#org` } }],
      });
      const findings = run(page({ scripts: [dangling] }));
      expect(findings.map((f) => f.rule)).toContain('jsonld-ref');
      expect(findings.find((f) => f.rule === 'jsonld-ref')?.message).toContain('/#org');
    });
    it('does not treat a bare reference as its own definition', () => {
      const selfOnly = ld({ '@context': 'https://schema.org', '@type': 'Thing', sameAs: { '@id': `${SITE}/#x` } });
      expect(rules(page({ scripts: [selfOnly] }))).toContain('jsonld-ref');
    });
  });

  describe('FAQPage', () => {
    const faq = (q: string, a: string) =>
      ld({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [{ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }],
      });
    const Q = "Does it work in Brave?";
    const A = 'Yes. Brave is Chromium-based, so the extension loads like it does in Chrome.';

    it('passes when the question and answer are visible on the page', () => {
      const body = `<h1>FAQ</h1><details><summary>${Q}</summary><p>${A}</p></details>`;
      expect(rules(page({ body, scripts: [ld(BASE_LD), faq(Q, A)] }))).not.toContain('faq');
    });
    it('tolerates inline markup and entities in the visible answer', () => {
      const body = `<h1>FAQ</h1><details><summary>Does it work in Brave?</summary><p>Yes. <strong>Brave</strong> is Chromium-based, so the extension loads like it does in Chrome.</p></details>`;
      expect(rules(page({ body, scripts: [ld(BASE_LD), faq(Q, A)] }))).not.toContain('faq');
      const apos = "It's free.";
      const b2 = `<h1>FAQ</h1><details><summary>Is it free?</summary><p>It&#x27;s free.</p></details>`;
      expect(rules(page({ body: b2, scripts: [ld(BASE_LD), faq('Is it free?', apos)] }))).not.toContain('faq');
    });
    it('fails when FAQPage has no matching visible FAQ', () => {
      expect(rules(page({ scripts: [ld(BASE_LD), faq(Q, A)] }))).toContain('faq');
    });
    it('fails when only the question is shown', () => {
      const body = `<h1>FAQ</h1><details><summary>${Q}</summary><p>Something else entirely.</p></details>`;
      expect(rules(page({ body, scripts: [ld(BASE_LD), faq(Q, A)] }))).toContain('faq');
    });
    it('does not let the JSON-LD itself count as visible text', () => {
      const body = '<h1>FAQ</h1>';
      expect(rules(page({ body, scripts: [ld(BASE_LD), faq(Q, A)] }))).toContain('faq');
    });
    it('is not required when there is no FAQPage', () => {
      expect(rules(page())).not.toContain('faq');
    });
  });

  it('reports the page path on every finding', () => {
    const findings = run(page({ body: '<p>no h1</p>' }), '/install');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.path === '/install')).toBe(true);
  });
});

describe('htmlFileForPath', () => {
  it('maps registry paths to prerendered files', () => {
    expect(htmlFileForPath('/')).toBe('index.html');
    expect(htmlFileForPath('/install')).toBe('install.html');
    expect(htmlFileForPath('/compare/imdb-vs-rotten-tomatoes')).toBe('compare/imdb-vs-rotten-tomatoes.html');
  });
});
