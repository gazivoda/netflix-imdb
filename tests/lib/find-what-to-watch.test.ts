import { readFileSync } from 'fs';
import { join } from 'path';
import { getPage } from '../../lib/pages';
import { renderedTitle } from '../../lib/seo';

const PATH = '/how-to/find-what-to-watch-on-netflix';
const src = readFileSync(join(__dirname, '../../app/how-to/find-what-to-watch-on-netflix/page.tsx'), 'utf8');

describe('find-what-to-watch page', () => {
  it('is registered as a guide with the agreed priority and dates', () => {
    const p = getPage(PATH);
    expect(p).toMatchObject({ group: 'guide', priority: 0.8, published: '2026-10-15', updated: '2026-10-21' });
    expect(renderedTitle(p).length).toBeLessThanOrEqual(65);
  });

  it('emits HowTo schema, uses the shared layout and links to the required pages', () => {
    expect(src).toContain('howTo(');
    expect(src).toContain('GuideLayout');
    for (const href of [
      '/install',
      '/compare/imdb-vs-rotten-tomatoes',
      '/how-to/show-imdb-ratings-on-netflix',
      '/how-to/show-rotten-tomatoes-on-netflix',
    ]) {
      expect(src).toContain(`href="${href}"`);
    }
  });

  it('has a decision table and an ordered routine', () => {
    expect(src).toContain('g.tableWrap');
    expect(src).toContain('<ol className={g.steps}>');
  });

  it('uses the brand name and makes no invented statistics', () => {
    expect(src).not.toMatch(/Netflix IMDB Ratings/i);
    expect(src).not.toMatch(/\d+(\.\d+)?\s*(%|percent) of (users|viewers|people)/i);
  });
});
