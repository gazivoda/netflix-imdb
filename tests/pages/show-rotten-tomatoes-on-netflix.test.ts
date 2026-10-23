import { readFileSync } from 'fs';
import { join } from 'path';
import { getPage, pagesInGroup } from '../../lib/pages';
import { pageMetadata, renderedTitle } from '../../lib/seo';

const PATH = '/how-to/show-rotten-tomatoes-on-netflix';
const source = readFileSync(join(__dirname, '../../app', PATH, 'page.tsx'), 'utf8');

describe(PATH, () => {
  it('is registered as a guide with the right metadata', () => {
    const page = getPage(PATH);
    expect(page.group).toBe('guide');
    expect(page.priority).toBe(0.9);
    expect(pagesInGroup('guide').map((p) => p.path)).toContain(PATH);
    expect(renderedTitle(page).length).toBeLessThanOrEqual(65);
    expect(pageMetadata(PATH).alternates?.canonical).toBe(PATH);
  });

  it('uses GuideLayout with HowTo schema and a FAQ', () => {
    expect(source).toContain('<GuideLayout');
    expect(source).toMatch(/howTo\(\{/);
    expect(source).toMatch(/faqs=\{FAQS\}/);
  });

  it('has 3-6 FAQs with self-contained 40-80 word answers', () => {
    const answers = [...source.matchAll(/^\s{4}a: '((?:[^'\\]|\\.)*)',$/gm)].map((m) => m[1]);
    expect(answers.length).toBeGreaterThanOrEqual(3);
    expect(answers.length).toBeLessThanOrEqual(6);
    for (const a of answers) {
      const words = a.trim().split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(40);
      expect(words).toBeLessThanOrEqual(80);
    }
  });

  it('links to install, the comparison and the sister guide, and cites Rotten Tomatoes', () => {
    expect(source).toContain('href="/install"');
    expect(source).toContain('href="/compare/imdb-vs-rotten-tomatoes"');
    expect(source).toContain('href="/how-to/show-imdb-ratings-on-netflix"');
    expect(source).toContain('https://www.rottentomatoes.com/about');
  });

  it('is honest about OMDb and missing scores, and disclaims affiliation', () => {
    expect(source).toMatch(/OMDb/);
    expect(source).toMatch(/does not return/);
    expect(source).toMatch(/Not\s+affiliated/);
  });

  it('does not rule out installation failures when no badge appears', () => {
    expect(source).not.toMatch(/not a bug in your install/);
    expect(source).toMatch(/network|connection/i);
    expect(source).toMatch(/install.*troubleshooting|troubleshooting.*install/i);
  });

  it('never uses the wrong brand name', () => {
    expect(source).not.toMatch(/Netflix IMDB Ratings/i);
  });
});
