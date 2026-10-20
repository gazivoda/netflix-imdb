// Pure view-model builders for the /blog hub (spec 4.3). No React, no I/O.

import { formatAsOf, formatImdb, formatSigned } from '../../../lib/blog/format';
import { gapOf, genreGroups, median, type Archetype, type StatsBySlug } from '../../../lib/blog/stats';
import { displayTitle } from '../../../lib/blog/title';
import type { Film, FilmsFile } from '../../../lib/blog/types';

export const ARCHETYPE_ORDER: Archetype[] = ['critics-higher', 'audience-higher', 'agreed-high', 'agreed-low', 'agreed-mixed'];

export const ARCHETYPE_HEADING: Record<Archetype, string> = {
  'critics-higher': 'Critics scored higher',
  'audience-higher': 'Audiences scored higher',
  'agreed-high': 'Both scored high',
  'agreed-low': 'Both scored low',
  'agreed-mixed': 'Roughly agree, mid-range',
};

export interface HubSummary {
  total: number;
  publishedCount: number;
  /** Median of the absolute gaps, in points. */
  medianAbsGap: number;
  archetypeCounts: Record<Archetype, number>;
  /** Oldest and newest OMDb fetch, formatted ("October 15, 2026"). */
  oldestAsOf: string;
  newestAsOf: string;
}

export function hubSummary(films: Film[], stats: StatsBySlug, publishedCount: number): HubSummary {
  const archetypeCounts = Object.fromEntries(ARCHETYPE_ORDER.map((a) => [a, 0])) as Record<Archetype, number>;
  for (const f of films) archetypeCounts[stats[f.slug].archetype]++;
  const fetched = films.map((f) => f.fetchedAt).sort();
  return {
    total: films.length,
    publishedCount,
    medianAbsGap: median(films.map((f) => stats[f.slug].absGap)) ?? 0,
    archetypeCounts,
    oldestAsOf: fetched.length ? formatAsOf(fetched[0]) : '',
    newestAsOf: fetched.length ? formatAsOf(fetched[fetched.length - 1]) : '',
  };
}

const byAbsGap = (stats: StatsBySlug) => (a: Film, b: Film) =>
  stats[b.slug].absGap - stats[a.slug].absGap || a.popularityRank - b.popularityRank;

/** Top `count` films of an archetype by absolute gap (ties: popularity rank). */
export function topByArchetype(films: Film[], stats: StatsBySlug, archetype: Archetype, count = 8): Film[] {
  return films.filter((f) => stats[f.slug].archetype === archetype).sort(byAbsGap(stats)).slice(0, count);
}

export interface GroupRow {
  label: string;
  count: number;
  /** Signed median gap, null for an empty group. */
  medianGap: number | null;
  /** Film with the largest absolute gap in the group. */
  largest: Film | null;
}

const groupRow = (label: string, list: Film[], stats: StatsBySlug): GroupRow => ({
  label,
  count: list.length,
  medianGap: median(list.map(gapOf)),
  largest: [...list].sort(byAbsGap(stats))[0] ?? null,
});

/** Spec 4.3 section 5: primary genre, genres with fewer than 5 films grouped as "Other". */
export function genreRows(films: Film[], stats: StatsBySlug): GroupRow[] {
  return [...genreGroups(films, 5)].map(([genre, list]) => groupRow(genre, list, stats));
}

export const PERIODS: { label: string; from: number; to: number }[] = [
  { label: 'Before 2010', from: -Infinity, to: 2009 },
  { label: '2010 to 2019', from: 2010, to: 2019 },
  { label: '2020 to 2022', from: 2020, to: 2022 },
  { label: '2023 to 2024', from: 2023, to: 2024 },
  { label: '2025 to 2026', from: 2025, to: Infinity },
];

/** Spec 4.3 section 6: release-period table (no links). */
export function periodRows(films: Film[], stats: StatsBySlug): GroupRow[] {
  return PERIODS.map((p) => groupRow(p.label, films.filter((f) => f.omdb.year >= p.from && f.omdb.year <= p.to), stats));
}

export const gapText = (n: number | null): string => (n === null ? 'none' : formatSigned(n));

const EXCLUDE_REASONS: Record<string, string> = {
  unmatched: 'No matching film found in OMDb',
  'runtime-mismatch': 'Runtime did not match Netflix data',
  'not-a-movie': 'OMDb does not list it as a film',
  'no-imdb-rating': 'No IMDb rating',
  'low-votes': 'Fewer than 5,000 IMDb votes',
  'no-rt-score': 'No Rotten Tomatoes score in OMDb',
  'duplicate-imdb-id': 'Duplicate of a film already in the list',
};

export const excludeReason = (code: string): string => EXCLUDE_REASONS[code] ?? code;

export type ExcludedRow = { title: string; reason: string };

/** "Popular, but not scored": skipped candidates, in pool order, titles cleaned for display. */
export function excludedRows(file: FilmsFile, clean: (raw: string) => string): ExcludedRow[] {
  return [...file.excluded].sort((a, b) => a.poolRank - b.poolRank).map((e) => ({ title: clean(e.netflixTitle), reason: excludeReason(e.reason) }));
}

export interface ExcludedGroup {
  reason: string;
  titles: string[];
}

/** The same rows grouped by reason (first appearance order), one compact list per reason. */
export function excludedByReason(rows: ExcludedRow[]): ExcludedGroup[] {
  const groups = new Map<string, string[]>();
  for (const r of rows) groups.set(r.reason, [...(groups.get(r.reason) ?? []), r.title]);
  return [...groups].map(([reason, titles]) => ({ reason, titles }));
}

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * The 100 master-table rows as one HTML string. A server component serialises every element of a
 * JSX table a second time into the page's flight payload (about 4x the markup for 100 x 7 cells);
 * one string is serialised once, which keeps the hub under its 120 KB budget (spec 4.3). Every
 * value is escaped; film links exist only for published films.
 */
export function masterRowsHtml(films: Film[], stats: StatsBySlug, published: ReadonlySet<string>): string {
  return films
    .map((f) => {
      const name = escapeHtml(displayTitle(f.omdb.title));
      const film = published.has(f.slug) ? `<a href="/blog/${escapeHtml(f.slug)}">${name}</a>` : name;
      const cells = [
        `<td>${f.popularityRank}</td>`,
        `<th scope="row">${film}</th>`,
        `<td>${f.omdb.year}</td>`,
        `<td>${formatImdb(f.omdb.imdbRating)}</td>`,
        `<td>${f.omdb.rtPercent}%</td>`,
        `<td>${formatSigned(stats[f.slug].gap)}</td>`,
        `<td>${f.omdb.metascore ?? 'none'}</td>`,
      ];
      return `<tr>${cells.join('')}</tr>`;
    })
    .join('');
}
