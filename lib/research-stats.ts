// Pure statistics for the IMDb-vs-Rotten-Tomatoes study. No imports, so the
// reproduction script (scripts/research/imdb-rt-gap.mjs) can load it directly
// with Node's built-in type stripping and the page/tests share the same code.

export interface RatingPair {
  title: string;
  /** IMDb rating on its native 0-10 scale. */
  imdb: number;
  /** Rotten Tomatoes Tomatometer, 0-100. */
  rt: number;
}

export interface GapRow extends RatingPair {
  /** IMDb x10, so both scores share a 0-100 scale. */
  imdbScaled: number;
  /** rt - imdbScaled. Positive = critics rated it higher than audiences. */
  gap: number;
}

export interface GapSummary {
  n: number;
  meanAbsGap: number;
  medianAbsGap: number;
  /** Mean signed gap (rt - imdb x10): positive = critics higher on average. */
  meanSignedGap: number;
  /** Share of titles (0-1) whose absolute gap is >= bigGapThreshold. */
  shareBigGap: number;
  bigGapThreshold: number;
  criticsHigherCount: number;
  audienceHigherCount: number;
  tieCount: number;
  pearson: number | null;
  biggestCriticsHigher: GapRow | null;
  biggestAudienceHigher: GapRow | null;
}

export const BIG_GAP_THRESHOLD = 15;

export const round = (x: number, dp = 1): number => {
  const f = 10 ** dp;
  return Math.round((x + Number.EPSILON) * f) / f;
};

export const mean = (xs: number[]): number =>
  xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Pearson correlation; null when undefined (fewer than 2 points or zero variance). */
export function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length) throw new Error('pearson: arrays must be the same length');
  if (xs.length < 2) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export function toGapRow<T extends RatingPair>(p: T): T & GapRow {
  const imdbScaled = round(p.imdb * 10, 1);
  return { ...p, imdbScaled, gap: round(p.rt - imdbScaled, 1) };
}

export function summarize<T extends RatingPair>(
  pairs: T[],
  threshold = BIG_GAP_THRESHOLD,
): GapSummary & { biggestCriticsHigher: (T & GapRow) | null; biggestAudienceHigher: (T & GapRow) | null } {
  const rows = pairs.map(toGapRow);
  const abs = rows.map((r) => Math.abs(r.gap));
  const big = rows.filter((r) => Math.abs(r.gap) >= threshold).length;
  const r = pearson(
    rows.map((x) => x.imdbScaled),
    rows.map((x) => x.rt),
  );
  const byGap = [...rows].sort((a, b) => b.gap - a.gap);
  const top = byGap[0];
  const bottom = byGap[byGap.length - 1];
  return {
    n: rows.length,
    meanAbsGap: round(mean(abs), 1),
    medianAbsGap: round(median(abs), 1),
    meanSignedGap: round(mean(rows.map((x) => x.gap)), 1),
    shareBigGap: rows.length ? big / rows.length : NaN,
    bigGapThreshold: threshold,
    criticsHigherCount: rows.filter((x) => x.gap > 0).length,
    audienceHigherCount: rows.filter((x) => x.gap < 0).length,
    tieCount: rows.filter((x) => x.gap === 0).length,
    pearson: r === null ? null : round(r, 2),
    biggestCriticsHigher: top && top.gap > 0 ? top : null,
    biggestAudienceHigher: bottom && bottom.gap < 0 ? bottom : null,
  };
}
