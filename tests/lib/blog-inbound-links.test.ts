// I8 + I9: three existing pages link the /blog hub, but only when the hub is ready, so the site
// never links a 404. The research table links a title to its analysis by IMDb id only when that
// article is published. Rendered with react-dom/server against a real and a mocked registry.
import { createElement } from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BLOG_HUB, type BlogArticlePage, type BlogHubState } from '../../lib/blog/registry.generated';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: unknown) => string };

const PAGES = {
  howTo: '../../app/how-to/find-what-to-watch-on-netflix/page',
  compare: '../../app/compare/imdb-vs-rotten-tomatoes/page',
  research: '../../app/research/imdb-vs-rotten-tomatoes-gap/page',
} as const;

const research = JSON.parse(readFileSync(join(__dirname, '../../data/imdb-rt-gap.json'), 'utf8')) as {
  titles: { title: string; imdbId: string }[];
};
const studied = research.titles[0];

const entry: BlogArticlePage = {
  path: '/blog/studied-film-2020',
  title: 'Studied Film (2020): IMDb 6.3 vs RT 36%',
  description: 'A synthetic registry entry for the inbound link test, long enough to look like a real description line.',
  published: '2026-10-20',
  updated: '2026-10-20',
  label: 'Studied Film (2020)',
  scores: { imdb: 6.3, rt: 36, gap: -27, asOf: '2026-10-15' },
  imdbId: studied.imdbId,
};

/** Render one page module with the given registry contents. */
function render(page: keyof typeof PAGES, hub: BlogHubState | null, entries: BlogArticlePage[] = []): string {
  let html = '';
  jest.isolateModules(() => {
    if (hub) {
      jest.doMock('../../lib/blog/registry.generated', () => ({ BLOG_HUB: hub, BLOG_ARTICLE_PAGES: entries }));
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(PAGES[page]) as { default: () => unknown };
    html = renderToStaticMarkup(createElement(mod.default as never));
  });
  jest.dontMock('../../lib/blog/registry.generated');
  return html;
}

const READY: BlogHubState = { ready: true, dataUpdated: '2026-10-15' };
const NOT_READY: BlogHubState = { ready: false, dataUpdated: null };
const BLOG_LINK = /href="\/blog"/;
// en dash, em dash and arrow range built from code points, so no such glyph sits in this file
const BANNED_GLYPHS = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}${String.fromCharCode(0x2190)}-${String.fromCharCode(0x21ff)}]|->|=>|\\p{Extended_Pictographic}`, 'u');

describe.each(Object.keys(PAGES) as (keyof typeof PAGES)[])('%s page', (page) => {
  it('has no /blog link while the hub is not ready', () => {
    expect(render(page, NOT_READY)).not.toMatch(BLOG_LINK);
  });

  it('links /blog once the hub is ready, in a sentence without banned glyphs', () => {
    const html = render(page, READY);
    expect(html).toMatch(BLOG_LINK);
    const sentence = /<p[^>]*>(?:(?!<\/p>)[\s\S])*href="\/blog"(?:(?!<\/p>)[\s\S])*<\/p>/.exec(html)?.[0] ?? '';
    expect(sentence.length).toBeGreaterThan(0);
    expect(sentence).not.toMatch(BANNED_GLYPHS);
  });
});

describe('the committed registry', () => {
  it('renders hub links only when the committed hub is ready', () => {
    for (const page of Object.keys(PAGES) as (keyof typeof PAGES)[]) {
      expect(BLOG_LINK.test(render(page, null))).toBe(BLOG_HUB.ready);
    }
  });
});

describe('research table title cells', () => {
  const link = `href="${entry.path}"`;

  it('link a studied film to its published analysis by IMDb id when the hub is ready', () => {
    expect(render('research', READY, [entry])).toContain(link);
  });

  it('leave titles plain with zero published articles, or while the hub is not ready', () => {
    expect(render('research', READY, [])).not.toMatch(/href="\/blog\//);
    expect(render('research', NOT_READY, [])).not.toMatch(/href="\/blog\//);
  });

  it('never link by title alone: an entry with another IMDb id adds no link', () => {
    expect(render('research', READY, [{ ...entry, imdbId: 'tt0000000' }])).not.toContain(link);
  });
});
