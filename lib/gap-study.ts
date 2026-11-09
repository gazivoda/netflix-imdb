// Headline figures from the IMDb vs Rotten Tomatoes study (data/imdb-rt-gap.json), for pages that quote it.
// Everything is read from the committed JSON, so copy on other pages cannot drift from the study.
// (tests/lib/imdb-rt-data.test.ts keeps `summary` equal to a fresh computation from the rows.)
import raw from '../data/imdb-rt-gap.json';

const s = raw.summary;
const seriesExcluded = raw.excluded.filter((e) => e.type === 'series');
const seriesIncluded = (raw.titles as { type: string }[]).filter((t) => t.type === 'series').length;

export const GAP_STUDY_PATH = '/research/imdb-vs-rotten-tomatoes-gap';

export const GAP_STUDY = {
  path: GAP_STUDY_PATH,
  /** Films in the usable sample. */
  n: s.n,
  /** Mean absolute gap, IMDb x 10 vs Tomatometer, in points. */
  meanAbsGap: s.meanAbsGap,
  /** Gap size (points) used for the "far apart" share. */
  threshold: s.bigGapThreshold,
  /** Films at least `threshold` points apart. */
  bigCount: Math.round(s.shareBigGap * s.n),
  /** Same share as a whole-number percent string, e.g. "61%". */
  bigPct: `${Math.round(s.shareBigGap * 100)}%`,
  /** Pearson correlation between IMDb x 10 and the Tomatometer. */
  pearson: s.pearson,
  /** Candidate series that OMDb returned no Rotten Tomatoes score for, out of all candidate series. */
  seriesNoRt: seriesExcluded.filter((e) => /Rotten Tomatoes/.test(e.reason)).length,
  seriesTotal: seriesExcluded.length + seriesIncluded,
  /** Snapshot date, e.g. "October 15, 2026". */
  date: new Date(raw.fetchedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }),
} as const;
