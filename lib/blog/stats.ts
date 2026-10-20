// Derived statistics for the Top 100 blog. Everything here is computed from
// films.json at build time and never stored (spec 2.3, R10, 3.4).
// Pure functions: no I/O, no side effects at import.

import type { Film } from './types';

export type Tier = 'agree' | 'slight' | 'clear' | 'wide' | 'very-wide';
export type Archetype = 'critics-higher' | 'audience-higher' | 'agreed-high' | 'agreed-low' | 'agreed-mixed';

export interface FilmStats {
  slug: string;
  /** IMDb rating scaled to 0-100, rounded. */
  imdbScaled: number;
  /** rtPercent - imdbScaled. Positive = critics higher (R10). */
  gap: number;
  absGap: number;
  tier: Tier;
  archetype: Archetype;
  /** 1 = largest abs gap in the set; ties broken by popularity rank. */
  gapRank: number;
  /** Share (0-100) of the other films with a smaller abs gap. */
  gapPercentile: number;
  /** OMDb first genre, "Other" when OMDb has none. */
  genre: string;
  /** Films in the set sharing this primary genre (including this one). */
  genreCount: number;
  /** Signed median gap of the primary genre, rounded half away from zero. */
  genreMedianGap: number | null;
  /** 1 = largest abs gap inside the primary genre. */
  genrePosition: number;
  setSize: number;
}

export type StatsBySlug = Record<string, FilmStats>;

export const imdbScaled = (film: Film): number => Math.round(film.omdb.imdbRating * 10);

export const gapOf = (film: Film): number => film.omdb.rtPercent - imdbScaled(film);

export function tierOf(absGap: number): Tier {
  if (absGap >= 30) return 'very-wide';
  if (absGap >= 20) return 'wide';
  if (absGap >= 10) return 'clear';
  if (absGap >= 5) return 'slight';
  return 'agree';
}

/** @param imdbScaled0to100 IMDb x 10, rounded. @param rt Tomatometer percent. */
export function archetypeOf(gap: number, imdbScaled0to100: number, rt: number): Archetype {
  if (gap >= 10) return 'critics-higher';
  if (gap <= -10) return 'audience-higher';
  if (imdbScaled0to100 >= 70 && rt >= 70) return 'agreed-high';
  if (imdbScaled0to100 < 60 && rt < 60) return 'agreed-low';
  return 'agreed-mixed';
}

export const primaryGenre = (film: Film): string => film.omdb.genres[0] ?? 'Other';

/** Median rounded half away from zero (so -2.5 -> -3). Empty input -> null. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  const m = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return m < 0 ? -Math.round(-m) : Math.round(m);
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Compute the stats of every film in the set. */
export function buildStats(films: Film[]): StatsBySlug {
  const setSize = films.length;
  const byAbs = [...films].sort(
    (a, b) => Math.abs(gapOf(b)) - Math.abs(gapOf(a)) || a.popularityRank - b.popularityRank,
  );
  const gapRank = new Map(byAbs.map((f, i) => [f.slug, i + 1]));

  const genreMembers = new Map<string, Film[]>();
  for (const f of films) {
    const g = primaryGenre(f);
    const list = genreMembers.get(g);
    if (list) list.push(f);
    else genreMembers.set(g, [f]);
  }

  const out: StatsBySlug = {};
  for (const f of films) {
    const gap = gapOf(f);
    const absGap = Math.abs(gap);
    const scaled = imdbScaled(f);
    const genre = primaryGenre(f);
    const members = genreMembers.get(genre) ?? [f];
    const smaller = films.filter((o) => o.slug !== f.slug && Math.abs(gapOf(o)) < absGap).length;
    const genreOrder = [...members].sort(
      (a, b) => Math.abs(gapOf(b)) - Math.abs(gapOf(a)) || a.popularityRank - b.popularityRank,
    );
    out[f.slug] = {
      slug: f.slug,
      imdbScaled: scaled,
      gap,
      absGap,
      tier: tierOf(absGap),
      archetype: archetypeOf(gap, scaled, f.omdb.rtPercent),
      gapRank: gapRank.get(f.slug) ?? setSize,
      gapPercentile: setSize > 1 ? Math.round((100 * smaller) / (setSize - 1)) : 0,
      genre,
      genreCount: members.length,
      genreMedianGap: median(members.map(gapOf)),
      genrePosition: genreOrder.findIndex((o) => o.slug === f.slug) + 1,
      setSize,
    };
  }
  return out;
}

/**
 * Films closest to `film` by signed gap (ties: lower popularity rank first),
 * excluding the film itself. `pool` defaults to every film passed in.
 */
export function nearestByGap(film: Film, pool: Film[], stats: StatsBySlug, count: number): Film[] {
  const g = stats[film.slug]?.gap ?? gapOf(film);
  return pool
    .filter((o) => o.slug !== film.slug)
    .sort(
      (a, b) =>
        Math.abs((stats[a.slug]?.gap ?? gapOf(a)) - g) - Math.abs((stats[b.slug]?.gap ?? gapOf(b)) - g) ||
        a.popularityRank - b.popularityRank,
    )
    .slice(0, count);
}

/**
 * Group films by primary genre for the hub (spec 4.3 section 5): genres with
 * fewer than `minSize` films are merged into "Other", which sorts last.
 */
export function genreGroups(films: Film[], minSize = 5): Map<string, Film[]> {
  const raw = new Map<string, Film[]>();
  for (const f of films) {
    const g = primaryGenre(f);
    raw.set(g, [...(raw.get(g) ?? []), f]);
  }
  const kept: [string, Film[]][] = [];
  const other: Film[] = [];
  for (const [g, list] of raw) {
    if (list.length >= minSize) kept.push([g, list]);
    else other.push(...list);
  }
  kept.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  if (other.length) kept.push(['Other', other.sort((a, b) => a.popularityRank - b.popularityRank)]);
  return new Map(kept);
}
