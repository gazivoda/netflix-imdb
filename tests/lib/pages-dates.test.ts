import { PAGES, STATIC_PAGES, PAGE_UPDATED } from '../../lib/pages';
import { LAST_UPDATED, LAST_UPDATED_LABEL } from '../../lib/content';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

describe('honest per-page dates', () => {
  it('every static page takes its date from the PAGE_UPDATED map', () => {
    for (const p of STATIC_PAGES) {
      expect(PAGE_UPDATED[p.path]).toMatch(ISO);
      expect(p.updated).toBe(PAGE_UPDATED[p.path]);
    }
  });

  it('PAGE_UPDATED has no entry for a page that is not registered', () => {
    const paths = new Set(STATIC_PAGES.map((p) => p.path));
    for (const path of Object.keys(PAGE_UPDATED)) expect(paths.has(path)).toBe(true);
  });

  it('no page claims a date before it was published or in the future of the site-wide date', () => {
    for (const p of STATIC_PAGES) {
      if (p.published) expect(p.updated >= p.published).toBe(true);
      expect(p.updated <= LAST_UPDATED).toBe(true);
    }
  });

  it('LAST_UPDATED (home footer, SoftwareApplication.dateModified) equals the newest static page date', () => {
    const newest = STATIC_PAGES.map((p) => p.updated).reduce((a, b) => (b > a ? b : a));
    expect(LAST_UPDATED).toBe(newest);
  });

  it('the visible label matches LAST_UPDATED', () => {
    const label = new Date(`${LAST_UPDATED}T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
    expect(LAST_UPDATED_LABEL).toBe(label);
  });

  it('the sitemap dates come straight from the registry', () => {
    expect(PAGES.every((p) => ISO.test(p.updated))).toBe(true);
  });
});
