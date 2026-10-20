import {
  archetypeOf,
  buildStats,
  gapOf,
  genreGroups,
  median,
  nearestByGap,
  ordinal,
  primaryGenre,
  tierOf,
} from '../../lib/blog/stats';
import { loadFixtureFilms, filmBySlug } from './fixtures';

const films = loadFixtureFilms();
const stats = buildStats(films);

describe('gap, tiers and archetypes (spec R10, 3.4)', () => {
  it('gap = rt - round(imdb * 10); positive means critics higher', () => {
    expect(gapOf(filmBySlug('harbor-lights-2021'))).toBe(13);
    expect(gapOf(filmBySlug('crimson-static-2022'))).toBe(-26);
  });

  it('rounds imdb * 10 without float drift (6.3 * 10 is 63.00000000000001-safe)', () => {
    const f = filmBySlug('echo-valley-2021');
    expect(gapOf(f)).toBe(79 - 63);
  });

  it.each([
    [0, 'agree'],
    [4, 'agree'],
    [5, 'slight'],
    [9, 'slight'],
    [10, 'clear'],
    [19, 'clear'],
    [20, 'wide'],
    [29, 'wide'],
    [30, 'very-wide'],
    [60, 'very-wide'],
  ])('tier for abs gap %i is %s', (g, tier) => {
    expect(tierOf(g)).toBe(tier);
  });

  it('archetypes follow spec 3.4', () => {
    expect(stats['harbor-lights-2021'].archetype).toBe('critics-higher'); // +13
    expect(stats['crimson-static-2022'].archetype).toBe('audience-higher'); // -26
    expect(stats['the-quiet-orchard-2023'].archetype).toBe('agreed-high'); // 74 vs 75
    expect(stats['paper-lanterns-2020'].archetype).toBe('agreed-low'); // 59 vs 58
    expect(stats['salt-and-iron-2019'].archetype).toBe('agreed-mixed'); // 70 vs 64
    expect(stats['midnight-ferry-2025'].archetype).toBe('agreed-mixed'); // 69 vs 71
  });

  it('archetypeOf uses the exact thresholds', () => {
    expect(archetypeOf(10, 70, 80)).toBe('critics-higher');
    expect(archetypeOf(-10, 80, 70)).toBe('audience-higher');
    expect(archetypeOf(9, 70, 79)).toBe('agreed-high');
    expect(archetypeOf(2, 59, 61)).toBe('agreed-mixed');
    expect(archetypeOf(0, 59, 59)).toBe('agreed-low');
  });
});

describe('ranks, medians and neighbours', () => {
  it('gapRank is 1 for the largest abs gap and breaks ties by popularity rank', () => {
    expect(stats['velvet-orbit-2023'].gapRank).toBe(1); // -33
    expect(stats['crimson-static-2022'].gapRank).toBe(2); // -26
    expect(stats['glass-harvest-2022'].gapRank).toBe(3); // -22
    const ranks = films.map((f) => stats[f.slug].gapRank).sort((a, b) => a - b);
    expect(ranks).toEqual(films.map((_, i) => i + 1));
  });

  it('median handles odd, even and empty inputs, rounding half away from zero', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3); // 2.5 rounds away from zero
    expect(median([-1, -2, -3, -4])).toBe(-3); // -2.5 rounds away from zero
    expect(median([])).toBeNull();
  });

  it('genre median gap is the signed median over the film primary genre', () => {
    // Drama primary: harbor +13, quiet orchard +1, glass harvest -22, tin soldier 0
    const s = stats['harbor-lights-2021'];
    expect(s.genre).toBe('Drama');
    expect(s.genreCount).toBe(4);
    expect(s.genreMedianGap).toBe(1); // sorted -22,0,1,13 -> (0+1)/2 = 0.5 -> 1
  });

  it('genre position ranks the film by abs gap inside its genre', () => {
    expect(stats['glass-harvest-2022'].genrePosition).toBe(1);
    expect(stats['harbor-lights-2021'].genrePosition).toBe(2);
  });

  it('gap percentile is the share of the other films with a smaller abs gap', () => {
    expect(stats['velvet-orbit-2023'].gapPercentile).toBe(100);
    expect(stats['tin-soldier-blues-2018'].gapPercentile).toBe(0);
  });

  it('nearestByGap sorts by signed gap distance, then popularity rank, and excludes self', () => {
    const near = nearestByGap(filmBySlug('harbor-lights-2021'), films, stats, 3).map((f) => f.slug);
    expect(near).not.toContain('harbor-lights-2021');
    expect(near).toHaveLength(3);
    // +13: neighbours neighbours at +16, +16, +1/ -1 ... distance 3,3, 12
    expect(near.slice(0, 2).sort()).toEqual(['echo-valley-2021', 'neon-meridian-2024']);
  });

  it('primaryGenre falls back to Other when OMDb has none', () => {
    const f = { ...filmBySlug('echo-valley-2021'), omdb: { ...filmBySlug('echo-valley-2021').omdb, genres: [] } };
    expect(primaryGenre(f)).toBe('Other');
  });

  it('genreGroups groups genres with fewer than minSize films into Other', () => {
    const groups = genreGroups(films, 4);
    expect(groups.get('Drama')?.length).toBe(4);
    expect(groups.has('Thriller')).toBe(false);
    expect(groups.get('Other')?.length).toBeGreaterThan(0);
  });
});

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [100, '100th'],
    [101, '101st'],
  ])('%i -> %s', (n, s) => expect(ordinal(n)).toBe(s));
});
