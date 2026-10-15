import { summarize } from '../../lib/research-stats';
import { getPage } from '../../lib/pages';
import data from '../../data/imdb-rt-gap.json';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const pairs = data.titles.map((t) => ({ title: t.title, imdb: t.imdbRating, rt: t.rtPercent }));

describe('IMDb vs RT dataset', () => {
  it('has real, in-range scores for every included title', () => {
    expect(data.titles.length).toBeGreaterThanOrEqual(30);
    for (const t of data.titles) {
      expect(t.imdbRating).toBeGreaterThan(0);
      expect(t.imdbRating).toBeLessThanOrEqual(10);
      expect(t.rtPercent).toBeGreaterThanOrEqual(0);
      expect(t.rtPercent).toBeLessThanOrEqual(100);
      expect(t.imdbId).toMatch(/^tt\d+$/);
    }
    expect(new Set(data.titles.map((t) => t.imdbId)).size).toBe(data.titles.length);
  });

  it('accounts for every candidate (included + excluded)', () => {
    expect(data.titles.length + data.excluded.length).toBe(data.candidates);
  });

  it('stored summary matches a fresh computation from the rows', () => {
    const s = summarize(pairs);
    expect(data.summary.n).toBe(s.n);
    expect(data.summary.meanAbsGap).toBe(s.meanAbsGap);
    expect(data.summary.medianAbsGap).toBe(s.medianAbsGap);
    expect(data.summary.shareBigGap).toBeCloseTo(s.shareBigGap, 10);
    expect(data.summary.pearson).toBe(s.pearson);
  });

  it('public/data copy is identical to data/', () => {
    const a = readFileSync(join(__dirname, '../../data/imdb-rt-gap.json'), 'utf8');
    const pub = join(__dirname, '../../public/data/imdb-rt-gap.json');
    expect(existsSync(pub)).toBe(true);
    expect(readFileSync(pub, 'utf8')).toBe(a);
  });

  it('registry description quotes the real headline numbers', () => {
    const desc = getPage('/research/imdb-vs-rotten-tomatoes-gap').description;
    const s = summarize(pairs);
    expect(desc).toContain(String(s.n));
    expect(desc).toContain(String(s.meanAbsGap));
    expect(desc).toContain(`${Math.round(s.shareBigGap * 100)}%`);
  });
});
