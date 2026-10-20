// Pure text helpers for the per-film share card (no JSX, unit-tested).

import { formatAsOf, formatImdb, formatSigned } from '../../../lib/blog/format';
import { displayTitle } from '../../../lib/blog/title';
import type { FilmStats } from '../../../lib/blog/stats';
import type { Film } from '../../../lib/blog/types';

export interface CardText {
  title: string;
  year: string;
  imdb: string;
  rt: string;
  gap: string;
  /** "Audiences scored higher by 26 points" and so on. */
  verdict: string;
  asOf: string;
  alt: string;
  /** Title font size in px so long names fit on at most three lines. */
  titleSize: number;
}

/** Title size steps: short names are big, long names shrink (card is 1200 x 630). */
export function titleSizeFor(title: string): number {
  const n = title.length;
  if (n <= 12) return 132;
  if (n <= 20) return 108;
  if (n <= 32) return 84;
  if (n <= 48) return 64;
  return 50;
}

export function cardText(film: Film, stats: FilmStats): CardText {
  const o = film.omdb;
  const title = displayTitle(o.title);
  const verdict =
    stats.gap === 0
      ? 'The two scores are equal'
      : stats.archetype.startsWith('agreed')
        ? `The two scores are ${stats.absGap} ${stats.absGap === 1 ? 'point' : 'points'} apart`
        : `${stats.gap > 0 ? 'Critics' : 'Audiences'} scored higher by ${stats.absGap} points`;
  const imdb = formatImdb(o.imdbRating);
  return {
    title,
    year: String(o.year),
    imdb,
    rt: `${o.rtPercent}%`,
    gap: formatSigned(stats.gap),
    verdict,
    asOf: `Scores as of ${formatAsOf(film.fetchedAt)}, via OMDb`,
    alt: `${title} (${o.year}): IMDb ${imdb} vs Rotten Tomatoes ${o.rtPercent}%`,
    titleSize: titleSizeFor(title),
  };
}

/**
 * Position of the gap marker on a 0..100 bar centred on 50, saturating at +-50 points
 * (the widest gaps in the set are about 50). Clamped so the marker never leaves the bar.
 */
export function gapMarkerPercent(gap: number): number {
  return Math.round(Math.min(96, Math.max(4, 50 + gap)));
}
