import { join } from 'path';
import {
  ARCHETYPE_ORDER,
  PERIODS,
  excludeReason,
  excludedByReason,
  escapeHtml,
  excludedRows,
  gapText,
  genreRows,
  hubSummary,
  masterRowsHtml,
  periodRows,
  topByArchetype,
} from '../../app/blog/_lib/hub-view';
import { getBlogData } from '../../app/blog/_lib/data';
import { clearBlogCache } from '../../lib/blog/load';
import { displayTitle } from '../../lib/blog/title';
import { buildStats, gapOf } from '../../lib/blog/stats';
import { clone, loadFixtureFilmsFile } from './fixtures';

const file = loadFixtureFilmsFile();
const films = file.films;
const stats = buildStats(films);

describe('hubSummary', () => {
  const sum = hubSummary(films, stats, 1);
  it('counts every film in exactly one archetype', () => {
    expect(sum.total).toBe(12);
    expect(ARCHETYPE_ORDER.reduce((n, a) => n + sum.archetypeCounts[a], 0)).toBe(12);
  });
  it('computes the median absolute gap and the as-of range', () => {
    const abs = films.map((f) => Math.abs(gapOf(f))).sort((a, b) => a - b);
    const mid = (abs[5] + abs[6]) / 2;
    expect(sum.medianAbsGap).toBe(Math.round(mid));
    expect(sum.oldestAsOf).toBe('October 15, 2026');
    expect(sum.newestAsOf).toBe('October 15, 2026');
    expect(sum.publishedCount).toBe(1);
  });
  it('reports the oldest and newest fetch separately', () => {
    const f = clone(films);
    f[0].fetchedAt = '2026-09-01T00:00:00.000Z';
    const s = hubSummary(f, buildStats(f), 0);
    expect(s.oldestAsOf).toBe('September 1, 2026');
    expect(s.newestAsOf).toBe('October 15, 2026');
  });
});

describe('topByArchetype', () => {
  it('orders by absolute gap, ties by popularity rank, and caps the list', () => {
    const top = topByArchetype(films, stats, 'audience-higher', 2);
    expect(top.length).toBeLessThanOrEqual(2);
    const abs = top.map((f) => stats[f.slug].absGap);
    expect([...abs].sort((a, b) => b - a)).toEqual(abs);
    for (const f of top) expect(stats[f.slug].archetype).toBe('audience-higher');
  });
});

describe('genreRows / periodRows', () => {
  it('groups genres under 5 films as Other, last, and keeps every film', () => {
    const rows = genreRows(films, stats);
    expect(rows.reduce((n, r) => n + r.count, 0)).toBe(12);
    expect(rows.filter((r) => r.label === 'Other').length).toBeLessThanOrEqual(1);
    if (rows.some((r) => r.label === 'Other')) expect(rows[rows.length - 1].label).toBe('Other');
    for (const r of rows) if (r.largest) expect(stats[r.largest.slug].absGap).toBeGreaterThanOrEqual(0);
  });
  it('puts each film in exactly one release period', () => {
    const rows = periodRows(films, stats);
    expect(rows.map((r) => r.label)).toEqual(PERIODS.map((p) => p.label));
    expect(rows.reduce((n, r) => n + r.count, 0)).toBe(12);
    expect(rows.find((r) => r.label === '2020 to 2022')!.count).toBe(films.filter((f) => f.omdb.year >= 2020 && f.omdb.year <= 2022).length);
    expect(rows.find((r) => r.label === 'Before 2010')!.medianGap).toBeNull();
  });
  it('formats gaps with a sign and a word for empty groups', () => {
    expect(gapText(5)).toBe('+5');
    expect(gapText(-26)).toBe('-26');
    expect(gapText(null)).toBe('none');
  });
});

describe('excludedRows', () => {
  it('cleans titles, maps reasons and orders by pool rank', () => {
    const f = clone(file);
    f.excluded = [
      { netflixTitle: 'B — Two', poolRank: 9, reason: 'no-rt-score' },
      { netflixTitle: 'A', poolRank: 3, reason: 'weird-new-reason' },
    ];
    expect(excludedRows(f, displayTitle)).toEqual([
      { title: 'A', reason: 'weird-new-reason' },
      { title: 'B - Two', reason: excludeReason('no-rt-score') },
    ]);
    expect(excludeReason('no-rt-score')).toMatch(/Rotten Tomatoes/);
  });
});

describe('excludedByReason', () => {
  it('groups titles by reason in first-appearance order', () => {
    expect(
      excludedByReason([
        { title: 'A', reason: 'r1' },
        { title: 'B', reason: 'r2' },
        { title: 'C', reason: 'r1' },
      ]),
    ).toEqual([
      { reason: 'r1', titles: ['A', 'C'] },
      { reason: 'r2', titles: ['B'] },
    ]);
    expect(excludedByReason([])).toEqual([]);
  });
});

describe('masterRowsHtml', () => {
  const html = masterRowsHtml(films, stats, new Set(['harbor-lights-2021']));
  it('has one row of 7 cells per film, with the films.json values', () => {
    expect(html.match(/<tr>/g)).toHaveLength(12);
    expect(html.match(/<td>|<th /g)).toHaveLength(12 * 7);
    expect(html).toContain('<tr><td>1</td><th scope="row"><a href="/blog/harbor-lights-2021">Harbor Lights</a></th><td>2021</td><td>7.8</td><td>91%</td><td>+13</td><td>86</td></tr>');
    expect(html).toContain('<th scope="row">Crimson Static</th><td>2022</td><td>6.4</td><td>38%</td><td>-26</td>');
  });
  it('links only published films', () => {
    expect(html.match(/<a /g)).toHaveLength(1);
  });
  it('escapes titles and prints none for a missing Metascore', () => {
    const f = clone(films);
    f[0].omdb.title = 'A <b>"Bold"</b> & \'Co\'';
    f[1].omdb.metascore = null;
    const out = masterRowsHtml(f, buildStats(f), new Set());
    expect(out).not.toContain('<b>');
    expect(out).toContain('A &lt;b&gt;&quot;Bold&quot;&lt;/b&gt; &amp; &#39;Co&#39;');
    expect(out).toContain('<td>none</td>');
    expect(escapeHtml('<&>')).toBe('&lt;&amp;&gt;');
  });
});

describe('getBlogData', () => {
  const saved = process.env.BLOG_DATA_DIR;
  afterEach(() => {
    if (saved === undefined) delete process.env.BLOG_DATA_DIR;
    else process.env.BLOG_DATA_DIR = saved;
    clearBlogCache();
  });

  it('returns null (no throw) when films.json does not exist', () => {
    process.env.BLOG_DATA_DIR = 'tests/blog/does-not-exist';
    clearBlogCache();
    expect(getBlogData()).toBeNull();
  });

  it('reads published articles from BLOG_DATA_DIR', () => {
    process.env.BLOG_DATA_DIR = join('tests', 'blog', 'fixtures');
    clearBlogCache();
    const data = getBlogData()!;
    expect(data.films).toHaveLength(12);
    expect(data.publishedSlugs).toEqual(['harbor-lights-2021']);
    expect([...data.published.keys()]).toEqual(['harbor-lights-2021']);
    expect(data.stats['harbor-lights-2021'].setSize).toBe(12);
  });
});
