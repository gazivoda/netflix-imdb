import { readFileSync } from 'fs';
import { join } from 'path';
import { getPage, pagesInGroup } from '../../lib/pages';

const PATH = '/compare/alternatives';
const src = readFileSync(join(__dirname, '../../app/compare/alternatives/page.tsx'), 'utf8');

describe('/compare/alternatives', () => {
  it('is registered in the compare group at priority 0.8', () => {
    const page = getPage(PATH);
    expect(page.priority).toBe(0.8);
    expect(page.group).toBe('compare');
    expect(page.updated).toBe('2026-10-15');
    expect(pagesInGroup('compare').map((p) => p.path)).toContain(PATH);
  });

  it('carries the verification date and links to /install and the IMDb vs RT page', () => {
    expect(src).toContain('Last verified: 2026-10-15');
    expect(src).toContain('href="/install"');
    expect(src).toContain('/compare/imdb-vs-rotten-tomatoes');
  });

  it('adds an ItemList with one item per alternative and a FAQ', () => {
    expect(src).toContain("'@type': 'ItemList'");
    expect(src).toContain('faqs={FAQS}');
    const rows = src.match(/^ {4}name: '/gm) ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });

  it('keeps the brand name and trademark disclaimer', () => {
    expect(src).not.toMatch(/Netflix IMDB Ratings/i);
    expect(src).toMatch(/not\s+affiliated/);
  });
});
