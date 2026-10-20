import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FilmsFile } from '../../lib/blog/types';

const ROOT = join(__dirname, '..', '..');
const FILMS = join(ROOT, 'data', 'blog', 'films.json');
const PUBLIC = join(ROOT, 'public', 'data', 'netflix-top-100.json');

const present = existsSync(FILMS);
// If the data has not been generated yet (run `node --env-file=.env.local scripts/blog/refresh.mjs --list --scores`)
// the suite is skipped and its name says why; it never silently passes.
const suite = present ? describe : describe.skip;

suite(present ? 'films-data (data/blog/films.json)' : 'films-data SKIPPED: data/blog/films.json has not been generated yet', () => {
  const file = (present ? JSON.parse(readFileSync(FILMS, 'utf8')) : null) as FilmsFile;
  const films = file?.films ?? [];
  const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const REASONS = [
    'unmatched',
    'runtime-mismatch',
    'not-a-movie',
    'no-imdb-rating',
    'low-votes',
    'no-rt-score',
    'duplicate-imdb-id',
    'ambiguous-title',
  ];

  it('has schemaVersion 1 and exactly 100 films', () => {
    expect(file.schemaVersion).toBe(1);
    expect(films).toHaveLength(100);
    expect(file.counts.eligible).toBe(100);
  });

  it('has unique slugs that match the slug pattern, and unique IMDb ids', () => {
    const slugs = films.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(100);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(new Set(films.map((f) => f.omdb.imdbId)).size).toBe(100);
    for (const f of films) expect(f.omdb.imdbId).toMatch(/^tt\d+$/);
  });

  it('numbers popularityRank 1..100 in order and keeps poolRank increasing', () => {
    expect(films.map((f) => f.popularityRank)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    for (let i = 1; i < films.length; i++) expect(films[i].poolRank).toBeGreaterThan(films[i - 1].poolRank);
  });

  it('orders films by Netflix popularity hours (R1)', () => {
    for (let i = 1; i < films.length; i++) {
      expect(films[i].netflix.popularityHours).toBeLessThanOrEqual(films[i - 1].netflix.popularityHours);
    }
  });

  it('has every required field present (nullable ones are explicitly null, never undefined)', () => {
    for (const f of films) {
      const where = f.slug;
      expect([where, typeof f.omdb.title]).toEqual([where, 'string']);
      expect(f.omdb.title.length).toBeGreaterThan(0);
      expect(Number.isInteger(f.omdb.year)).toBe(true);
      expect(Number.isInteger(f.omdb.runtimeMin)).toBe(true);
      expect(f.omdb.runtimeMin).toBeGreaterThan(0);
      expect(typeof f.omdb.imdbRating).toBe('number');
      expect(typeof f.omdb.imdbVotes).toBe('number');
      expect(typeof f.omdb.rtPercent).toBe('number');
      for (const k of ['genres', 'directors', 'writers', 'actors', 'languages', 'countries'] as const) {
        expect(Array.isArray(f.omdb[k])).toBe(true);
      }
      for (const k of ['rated', 'released', 'plot', 'awards', 'metascore'] as const) {
        expect(f.omdb[k] === null || f.omdb[k] !== undefined).toBe(true);
      }
      expect(f.netflix.title.length).toBeGreaterThan(0);
      expect(['Films (English)', 'Films (Non-English)']).toContain(f.netflix.category);
      expect(['weekly-sum', 'first-91-days']).toContain(f.netflix.hoursSource);
      expect(f.netflix.popularityHours).toBeGreaterThan(0);
      expect(Number.isInteger(f.netflix.weeksInTop10)).toBe(true);
      // Netflix publishes no runtime for most titles that charted before June 2023: null, never copied from OMDb.
      const rt = f.netflix.runtimeMin as number | null;
      expect(rt === null || (Number.isInteger(rt) && rt > 0)).toBe(true);
    }
  });

  it('keeps scores in range: rtPercent 0-100, imdbRating 1-10, votes >= 5,000', () => {
    for (const f of films) {
      expect(f.omdb.rtPercent).toBeGreaterThanOrEqual(0);
      expect(f.omdb.rtPercent).toBeLessThanOrEqual(100);
      expect(f.omdb.imdbRating).toBeGreaterThanOrEqual(1);
      expect(f.omdb.imdbRating).toBeLessThanOrEqual(10);
      expect(f.omdb.imdbVotes).toBeGreaterThanOrEqual(5000);
      if (f.omdb.metascore !== null) {
        expect(f.omdb.metascore).toBeGreaterThanOrEqual(0);
        expect(f.omdb.metascore).toBeLessThanOrEqual(100);
      }
    }
  });

  it('respects the runtime rule: within 12 minutes of Netflix where Netflix lists a runtime', () => {
    for (const f of films) {
      const nf = f.netflix.runtimeMin as number | null;
      if (nf !== null) expect(Math.abs(nf - f.omdb.runtimeMin)).toBeLessThanOrEqual(12);
      else expect(f.omdb.runtimeMin).toBeGreaterThanOrEqual(40);
    }
  });

  it('has ISO timestamps', () => {
    expect(file.generatedAt).toMatch(ISO_DATETIME);
    expect(file.netflix.downloadedAt).toMatch(ISO_DATETIME);
    for (const f of films) {
      expect(f.fetchedAt).toMatch(ISO_DATETIME);
      expect(f.dataChangedAt).toMatch(ISO_DATE);
      if (f.omdb.released !== null) expect(f.omdb.released).toMatch(ISO_DATE);
    }
  });

  it('records the Netflix sources with SHA-256 digests', () => {
    expect(file.netflix.weeklySha256).toMatch(/^[0-9a-f]{64}$/);
    expect(file.netflix.mostPopularSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(file.netflix.weeklyUrl).toMatch(/^https:\/\/www\.netflix\.com\//);
    expect(file.netflix.firstWeek <= file.netflix.lastWeek).toBe(true);
    expect(['netflix-download', 'committed-snapshot']).toContain(file.listSource);
  });

  it('lists skipped titles with a known reason and keeps the counts consistent', () => {
    expect(file.counts.excluded).toBe(file.excluded.length);
    expect(file.counts.poolEvaluated).toBe(100 + file.excluded.length);
    for (const x of file.excluded) {
      expect(REASONS).toContain(x.reason);
      expect(x.netflixTitle.length).toBeGreaterThan(0);
      expect(x.poolRank).toBeLessThan(films[films.length - 1].poolRank);
    }
    const ranks = [...films.map((f) => f.poolRank), ...file.excluded.map((x) => x.poolRank)];
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it('has a public copy identical to data/blog/films.json', () => {
    expect(existsSync(PUBLIC)).toBe(true);
    expect(readFileSync(PUBLIC, 'utf8')).toBe(readFileSync(FILMS, 'utf8'));
  });
});
