// Pure helpers for the Top 100 data pipeline (spec 2.2, rulings R1, R2, slug rules 4.2).
// No I/O and no network: scripts/blog/refresh.mjs does that and calls into this file, so the
// logic that decides which films enter the list is unit-tested (tests/blog/select.test.ts).

import type { Film } from './types';

// ---------------------------------------------------------------- constants

export const WEEKLY_HEADER = [
  'week',
  'category',
  'weekly_rank',
  'show_title',
  'season_title',
  'weekly_hours_viewed',
  'runtime',
  'weekly_views',
  'cumulative_weeks_in_top_10',
] as const;

export const MOST_POPULAR_HEADER = [
  'category',
  'rank',
  'show_title',
  'season_title',
  'hours_viewed_first_91_days',
  'runtime',
  'views_first_91_days',
] as const;

export const FILM_CATEGORIES = ['Films (English)', 'Films (Non-English)'] as const;
export type FilmCategory = (typeof FILM_CATEGORIES)[number];

/** R2: Netflix and OMDb runtimes must be within this many minutes. */
export const RUNTIME_TOLERANCE_MIN = 12;
/**
 * C1: a same-title film released before the year preceding the first chart week (Apex 2021 vs a 2026
 * Netflix Apex, Troll 2 1990) is only accepted, without an identity override, when the runtimes agree
 * within this many minutes. Licensed catalogue films (Shrek 90/90) still pass.
 */
export const OLD_FILM_RUNTIME_TOLERANCE_MIN = 3;
/** R2: minimum IMDb votes. */
export const MIN_VOTES = 5000;
/** Netflix counts a "film" as feature length; used as a sanity floor when Netflix has no runtime. */
export const MIN_FEATURE_RUNTIME_MIN = 40;

// ---------------------------------------------------------------- TSV

export interface Tsv {
  header: string[];
  rows: Record<string, string>[];
}

/** Parses Netflix's plain tab-separated files (no quoting). Throws on a ragged row. */
export function parseTsv(text: string): Tsv {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (!lines.length) throw new Error('TSV is empty');
  const header = lines[0].split('\t');
  const rows = lines.slice(1).map((line, i) => {
    const cells = line.split('\t');
    if (cells.length !== header.length) {
      throw new Error(`TSV row ${i + 2} has ${cells.length} columns, header has ${header.length}`);
    }
    return Object.fromEntries(header.map((h, j) => [h, cells[j]]));
  });
  return { header, rows };
}

export function assertHeader(actual: readonly string[], expected: readonly string[], label: string): void {
  if (actual.length !== expected.length || actual.some((h, i) => h !== expected[i])) {
    throw new Error(`${label}: unexpected header row (${actual.join(',')})`);
  }
}

// ---------------------------------------------------------------- Netflix aggregation (R1)

export interface Candidate {
  title: string;
  category: FilmCategory;
  /** R1: max(weeklyHours, first-91-days hours). */
  popularityHours: number;
  /** Sum of weekly_hours_viewed over the weekly file (0 when absent from it). */
  weeklyHours: number;
  hoursSource: 'weekly-sum' | 'first-91-days';
  weeksInTop10: number;
  /** Best (lowest) weekly rank, null when the title is not in the weekly file. */
  peakRank: number | null;
  firstWeek: string | null;
  lastWeek: string | null;
  mostPopularRank: number | null;
  /** Median of the usable Netflix runtimes, in minutes; null when Netflix published none. */
  runtimeMin: number | null;
  /** Usable runtimes of this title differ by more than the tolerance: several films share the title. */
  runtimeConflict: boolean;
}

const isFilmCategory = (c: string): c is FilmCategory => (FILM_CATEGORIES as readonly string[]).includes(c);

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const hoursToMinutes = (h: number) => Math.round(h * 60);

/** Runtime cell in hours -> number, or null when empty, "N/A" or 0 (all mean "not published"). */
function parseRuntimeHours(cell: string, where: string): number | null {
  const t = cell.trim();
  if (t === '' || t === 'N/A') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${where}: unreadable runtime "${cell}"`);
  return n === 0 ? null : n;
}

function parseCount(cell: string, field: string): number {
  const n = Number(cell.trim());
  if (cell.trim() === '' || !Number.isFinite(n) || n < 0) throw new Error(`unreadable ${field}: "${cell}"`);
  return n;
}

export interface WeeklyAggregate {
  candidates: Candidate[];
  tvTitlesSkipped: number;
  firstWeek: string;
  lastWeek: string;
  weeklyRows: number;
}

/**
 * Aggregates the weekly Top 10 file per (category, title). Keying by category as well as title keeps
 * two different films that share a title (for example an English and a non-English "Alpha") apart.
 * TV rows are skipped and counted.
 */
export function aggregateWeekly(rows: Record<string, string>[]): WeeklyAggregate {
  interface Acc {
    title: string;
    category: FilmCategory;
    hours: number;
    weeks: number;
    peak: number;
    first: string;
    last: string;
    runtimes: number[];
  }
  const films = new Map<string, Acc>();
  const tv = new Set<string>();
  let firstWeek = '';
  let lastWeek = '';
  for (const r of rows) {
    const week = r.week;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error(`unreadable week: "${week}"`);
    if (!firstWeek || week < firstWeek) firstWeek = week;
    if (!lastWeek || week > lastWeek) lastWeek = week;
    if (!isFilmCategory(r.category)) {
      if (r.category.startsWith('TV')) tv.add(r.show_title);
      else throw new Error(`unknown category "${r.category}"`);
      continue;
    }
    const key = `${r.category}|${r.show_title}`;
    const hours = parseCount(r.weekly_hours_viewed, 'weekly_hours_viewed');
    const rank = parseCount(r.weekly_rank, 'weekly_rank');
    const runtime = parseRuntimeHours(r.runtime, `${r.show_title} ${week}`);
    const acc = films.get(key);
    if (!acc) {
      films.set(key, {
        title: r.show_title,
        category: r.category,
        hours,
        weeks: 1,
        peak: rank,
        first: week,
        last: week,
        runtimes: runtime === null ? [] : [runtime],
      });
    } else {
      acc.hours += hours;
      acc.weeks += 1;
      acc.peak = Math.min(acc.peak, rank);
      if (week < acc.first) acc.first = week;
      if (week > acc.last) acc.last = week;
      if (runtime !== null) acc.runtimes.push(runtime);
    }
  }
  const candidates: Candidate[] = [...films.values()].map((a) => {
    const spread = a.runtimes.length ? Math.max(...a.runtimes) - Math.min(...a.runtimes) : 0;
    return {
      title: a.title,
      category: a.category,
      popularityHours: a.hours,
      weeklyHours: a.hours,
      hoursSource: 'weekly-sum',
      weeksInTop10: a.weeks,
      peakRank: a.peak,
      firstWeek: a.first,
      lastWeek: a.last,
      mostPopularRank: null,
      runtimeMin: a.runtimes.length ? hoursToMinutes(median(a.runtimes)) : null,
      runtimeConflict: hoursToMinutes(spread) > RUNTIME_TOLERANCE_MIN,
    };
  });
  return { candidates, tvTitlesSkipped: tv.size, firstWeek, lastWeek, weeklyRows: rows.length };
}

/**
 * Merges the Most Popular list (hours in the first 91 days). popularityHours = max(weekly sum, first 91 days).
 * A film only in Most Popular (Bird Box) is added with no weekly facts. Returns new objects.
 */
export function mergeMostPopular(candidates: Candidate[], rows: Record<string, string>[]): Candidate[] {
  const out = new Map<string, Candidate>(candidates.map((c) => [`${c.category}|${c.title}`, { ...c }]));
  for (const r of rows) {
    if (!isFilmCategory(r.category)) continue;
    const key = `${r.category}|${r.show_title}`;
    const hours = parseCount(r.hours_viewed_first_91_days, 'hours_viewed_first_91_days');
    const rank = parseCount(r.rank, 'rank');
    const runtime = parseRuntimeHours(r.runtime, `${r.show_title} most-popular`);
    const existing = out.get(key);
    if (existing) {
      const useMp = hours > existing.weeklyHours;
      existing.popularityHours = useMp ? hours : existing.weeklyHours;
      existing.hoursSource = useMp ? 'first-91-days' : 'weekly-sum';
      existing.mostPopularRank = rank;
      if (existing.runtimeMin === null && runtime !== null) existing.runtimeMin = hoursToMinutes(runtime);
    } else {
      out.set(key, {
        title: r.show_title,
        category: r.category,
        popularityHours: hours,
        weeklyHours: 0,
        hoursSource: 'first-91-days',
        weeksInTop10: 0,
        peakRank: null,
        firstWeek: null,
        lastWeek: null,
        mostPopularRank: rank,
        runtimeMin: runtime === null ? null : hoursToMinutes(runtime),
        runtimeConflict: false,
      });
    }
  }
  return [...out.values()];
}

/** R1 order: popularityHours desc, then weeks in the Top 10 desc, then title. */
export function rankCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort(
    (a, b) =>
      b.popularityHours - a.popularityHours ||
      b.weeksInTop10 - a.weeksInTop10 ||
      (a.title < b.title ? -1 : a.title > b.title ? 1 : 0) ||
      (a.category < b.category ? -1 : a.category > b.category ? 1 : 0),
  );
}

export interface PoolResult {
  pool: Candidate[];
  filmTitles: number;
  tvTitlesSkipped: number;
  firstWeek: string;
  lastWeek: string;
}

export function buildPool(
  weeklyRows: Record<string, string>[],
  mostPopularRows: Record<string, string>[],
  size: number,
): PoolResult {
  const agg = aggregateWeekly(weeklyRows);
  const ranked = rankCandidates(mergeMostPopular(agg.candidates, mostPopularRows));
  return {
    pool: ranked.slice(0, size),
    filmTitles: ranked.length,
    tvTitlesSkipped: agg.tvTitlesSkipped,
    firstWeek: agg.firstWeek,
    lastWeek: agg.lastWeek,
  };
}

// ---------------------------------------------------------------- title matching

/** Lowercase, NFKD, no diacritics, no apostrophes, `&` = `and`, every other non-alphanumeric run = one space. */
export function normTitle(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['‘’ʼ`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const LANGUAGES =
  'english|hindi|tamil|telugu|malayalam|kannada|bengali|marathi|punjabi|urdu|spanish|french|german|italian|portuguese|korean|japanese|chinese|mandarin|cantonese|thai|turkish|arabic|polish|russian|indonesian|dutch|swedish|norwegian|danish|filipino|tagalog|vietnamese';
const LANGUAGE_TAG = new RegExp(`\\s*\\((?:${LANGUAGES})\\)\\s*$`, 'i');

/** Netflix labels dubbed or regional titles "Kantara (Hindi)"; OMDb has the plain title. */
export function stripLanguageTag(title: string): string {
  const stripped = title.replace(LANGUAGE_TAG, '');
  return stripped || title;
}

export function titlesMatch(netflixTitle: string, omdbTitle: string): boolean {
  const o = normTitle(omdbTitle);
  return normTitle(netflixTitle) === o || normTitle(stripLanguageTag(netflixTitle)) === o;
}

export function runtimeMatches(netflixMin: number, omdbMin: number | null, tolerance = RUNTIME_TOLERANCE_MIN): boolean {
  return omdbMin !== null && Math.abs(netflixMin - omdbMin) <= tolerance;
}

// ---------------------------------------------------------------- OMDb lookups

export type LookupStep =
  | { kind: 't'; title: string; year: number | null }
  | { kind: 's'; title: string };

export const yearOfWeek = (week: string | null): number | null => (week ? Number(week.slice(0, 4)) : null);

/**
 * OMDb query text: curly apostrophes and quotes become ASCII, a spaced em or en dash (and any em dash)
 * becomes " - ", the way OMDb spells "Rebel Moon - Part One: A Child of Fire".
 */
export function sanitiseQuery(title: string): string {
  return title
    .replace(/[\u2018\u2019\u201A\u201B\u02BC\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/\s*\u2014\s*/g, ' - ')
    .replace(/\s+\u2013\s+/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Order of OMDb queries for one candidate (spec 2.2 step 2). */
export function lookupPlan(c: { title: string; firstWeek: string | null }): LookupStep[] {
  const title = sanitiseQuery(stripLanguageTag(c.title));
  const y = yearOfWeek(c.firstWeek);
  const steps: LookupStep[] = [];
  if (y !== null) {
    steps.push({ kind: 't', title, year: y });
    steps.push({ kind: 't', title, year: y - 1 });
  }
  steps.push({ kind: 't', title, year: null });
  steps.push({ kind: 's', title });
  return steps;
}

// ---------------------------------------------------------------- OMDb record parsing

export type OmdbParsed = Omit<Film['omdb'], 'imdbRating' | 'imdbVotes' | 'rtPercent' | 'runtimeMin'> & {
  type: string;
  runtimeMin: number | null;
  imdbRating: number | null;
  imdbVotes: number | null;
  rtPercent: number | null;
};

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

const schemaError = (msg: string) => new Error(`OMDb schema mismatch: ${msg}`);

/** Maps a raw OMDb `Response: "True"` record. Throws on anything unexpected; never guesses a value. */
export function parseOmdb(raw: unknown): OmdbParsed {
  if (!raw || typeof raw !== 'object') throw schemaError('record is not an object');
  const r = raw as Record<string, unknown>;
  if (r.Response !== 'True') throw schemaError('Response is not "True"');
  const str = (k: string): string => {
    const v = r[k];
    if (typeof v !== 'string') throw schemaError(`missing field ${k}`);
    return v;
  };
  const orNull = (k: string): string | null => {
    const v = str(k).trim();
    return v === '' || v === 'N/A' ? null : v;
  };
  const list = (k: string): string[] => {
    const v = orNull(k);
    return v === null ? [] : v.split(',').map((s) => s.trim()).filter(Boolean);
  };

  const imdbId = str('imdbID');
  if (!/^tt\d+$/.test(imdbId)) throw schemaError('imdbID');
  const year = Number.parseInt(str('Year'), 10);
  if (!Number.isInteger(year)) throw schemaError('Year');

  let released: string | null = null;
  const rel = orNull('Released');
  if (rel !== null) {
    const m = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/.exec(rel);
    if (!m || !MONTHS[m[2]]) throw schemaError('Released');
    released = `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, '0')}`;
  }

  let runtimeMin: number | null = null;
  const rt = orNull('Runtime');
  if (rt !== null) {
    const m = /^(?:(\d+) h)?\s*(?:(\d+) min)?$/.exec(rt);
    if (!m || (m[1] === undefined && m[2] === undefined)) throw schemaError('Runtime');
    runtimeMin = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
  }

  const ratingStr = orNull('imdbRating');
  const imdbRating = ratingStr === null ? null : Number(ratingStr);
  if (imdbRating !== null && !Number.isFinite(imdbRating)) throw schemaError('imdbRating');
  const votesStr = orNull('imdbVotes');
  const imdbVotes = votesStr === null ? null : Number(votesStr.replace(/,/g, ''));
  if (imdbVotes !== null && !Number.isInteger(imdbVotes)) throw schemaError('imdbVotes');
  const metaStr = orNull('Metascore');
  const metascore = metaStr === null ? null : Number(metaStr);
  if (metascore !== null && !Number.isInteger(metascore)) throw schemaError('Metascore');

  if (!Array.isArray(r.Ratings)) throw schemaError('Ratings');
  let rtPercent: number | null = null;
  for (const entry of r.Ratings as unknown[]) {
    if (!entry || typeof entry !== 'object') throw schemaError('Ratings entry');
    const e = entry as Record<string, unknown>;
    if (e.Source === 'Rotten Tomatoes') {
      const m = typeof e.Value === 'string' ? /^(\d{1,3})%$/.exec(e.Value) : null;
      if (!m) throw schemaError('Rotten Tomatoes value');
      rtPercent = Number(m[1]);
    }
  }

  const writers = [...new Set(list('Writer').map((w) => w.replace(/\s*\([^)]*\)/g, '').trim()).filter(Boolean))];

  return {
    imdbId,
    title: str('Title'),
    year,
    type: str('Type'),
    rated: orNull('Rated'),
    released,
    runtimeMin,
    genres: list('Genre'),
    directors: list('Director'),
    writers,
    actors: list('Actors'),
    plot: orNull('Plot'),
    languages: list('Language'),
    countries: list('Country'),
    awards: orNull('Awards'),
    metascore,
    imdbRating,
    imdbVotes,
    rtPercent,
  };
}

/**
 * Parses an OMDb record returned for a Netflix title without an identity override. Title and Type are
 * compared FIRST: a record that does not match (a promo clip, an episode, a junk entry) and does not parse
 * is a non-match, never an abort. Only a record whose title and type match but whose shape is malformed
 * throws (schema mismatch), because that would mean OMDb changed.
 */
export function parseCandidateRecord(
  netflixTitle: string,
  raw: unknown,
): { ok: true; parsed: OmdbParsed } | { ok: false; junk: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const matches = typeof r.Title === 'string' && titlesMatch(netflixTitle, r.Title) && r.Type === 'movie';
  try {
    return { ok: true, parsed: parseOmdb(raw) };
  } catch (e) {
    if (matches) throw e;
    return { ok: false, junk: (e as Error).message };
  }
}

// ---------------------------------------------------------------- matching and eligibility (R2)

export type MatchReason = 'unmatched' | 'not-a-movie' | 'runtime-mismatch';
export type MatchResult = { ok: true } | { ok: false; reason: MatchReason };

/**
 * Does this OMDb record describe this Netflix title? An identity override (identity only, written
 * before scores are looked at) waives the title-equality test and the Netflix-runtime-less year window,
 * nothing else.
 *
 * When Netflix published no runtime for a title (most titles charted before June 2023) the runtime
 * check is skipped, not failed. To compensate: the OMDb year must be the first chart year or the year
 * before, and OMDb must report a feature-length runtime.
 */
export function evaluateMatch(
  c: Pick<Candidate, 'title' | 'firstWeek' | 'runtimeMin'>,
  omdb: OmdbParsed,
  opts: { override?: boolean } = {},
): MatchResult {
  const override = opts.override === true;
  if (!override && !titlesMatch(c.title, omdb.title)) return { ok: false, reason: 'unmatched' };
  const y = yearOfWeek(c.firstWeek);
  if (y !== null && omdb.year > y) return { ok: false, reason: 'unmatched' };
  // C1: older than the B6 window (first chart year or the year before) and no override: most likely a
  // different film with the same title. Needs a Netflix runtime within 3 minutes of the OMDb runtime.
  const older = y !== null && !override && omdb.year < y - 1;
  if (older && c.runtimeMin === null) return { ok: false, reason: 'unmatched' };
  if (older && !runtimeMatches(c.runtimeMin as number, omdb.runtimeMin, OLD_FILM_RUNTIME_TOLERANCE_MIN)) {
    return { ok: false, reason: 'unmatched' };
  }
  if (omdb.type !== 'movie') return { ok: false, reason: 'not-a-movie' };
  if (c.runtimeMin !== null) {
    if (!runtimeMatches(c.runtimeMin, omdb.runtimeMin)) return { ok: false, reason: 'runtime-mismatch' };
  } else if (omdb.runtimeMin === null || omdb.runtimeMin < MIN_FEATURE_RUNTIME_MIN) {
    return { ok: false, reason: 'runtime-mismatch' };
  }
  return { ok: true };
}

export interface DoubtfulEntry {
  netflixTitle: string;
  netflixFirstWeek: string;
  netflixYear: number;
  omdbTitle: string;
  omdbYear: number;
  imdbId: string;
  netflixRuntimeMin: number | null;
  omdbRuntimeMin: number | null;
  /** OMDb minus Netflix, minutes; null when either runtime is missing. */
  runtimeDeltaMin: number | null;
}

/**
 * An accepted match whose OMDb year is below the first chart year needs a human look (C1): the runtime
 * rule cannot tell Apex 2021 (94 min) from a 2026 Netflix Apex (95 min). Null when not doubtful or when
 * the title has no first chart week.
 */
export function doubtfulEntry(c: Pick<Candidate, 'title' | 'firstWeek' | 'runtimeMin'>, omdb: OmdbParsed): DoubtfulEntry | null {
  const y = yearOfWeek(c.firstWeek);
  if (y === null || c.firstWeek === null || omdb.year >= y) return null;
  return {
    netflixTitle: c.title,
    netflixFirstWeek: c.firstWeek,
    netflixYear: y,
    omdbTitle: omdb.title,
    omdbYear: omdb.year,
    imdbId: omdb.imdbId,
    netflixRuntimeMin: c.runtimeMin,
    omdbRuntimeMin: omdb.runtimeMin,
    runtimeDeltaMin: c.runtimeMin === null || omdb.runtimeMin === null ? null : omdb.runtimeMin - c.runtimeMin,
  };
}

export interface ExcludedEntry {
  netflixTitle: string;
  poolRank: number;
  reason: string;
  imdbId?: string;
}

/** Reasons where the record is not (known to be) the film: no imdbId may be attached (I7c). */
const NO_ID_REASONS = new Set(['unmatched', 'ambiguous-title']);

export function excludedEntry(e: ExcludedEntry): ExcludedEntry {
  const { imdbId, ...rest } = e;
  return imdbId && !NO_ID_REASONS.has(e.reason) ? { ...rest, imdbId } : rest;
}

export type EligibilityReason = 'no-imdb-rating' | 'low-votes' | 'no-rt-score';

/** R2 score requirements on a matched record. Null = eligible. */
export function checkEligibility(o: OmdbParsed): EligibilityReason | null {
  if (o.imdbRating === null) return 'no-imdb-rating';
  if (o.imdbVotes === null || o.imdbVotes < MIN_VOTES) return 'low-votes';
  if (o.rtPercent === null) return 'no-rt-score';
  return null;
}

// ---------------------------------------------------------------- slugs (spec 4.2)

const SLUG_MAX = 50;

/** `slugify(omdb.title)` + `-{year}`; the title part is cut at a word boundary to at most 50 characters. */
export function slugify(title: string, year: number): string {
  let base = title
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['‘’ʼ`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base.length > SLUG_MAX) {
    const cut = base.slice(0, SLUG_MAX);
    // Word boundary: keep the cut if the next character is a hyphen, otherwise drop the partial word.
    const boundary = base[SLUG_MAX] === '-' ? cut : cut.slice(0, Math.max(cut.lastIndexOf('-'), 0));
    base = (boundary || cut).replace(/-+$/, '');
  }
  if (!base) base = 'film';
  return `${base}-${year}`;
}

/**
 * imdbId -> slug from the previous films.json and every article file (any status; an article wins).
 * Article files keep a slug reserved even after the film drops out of the 100 (I7d).
 */
export function existingSlugMap(
  priorFilms: { slug: string; omdb: { imdbId: string } }[],
  articles: { slug: string; imdbId: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of priorFilms) out[f.omdb.imdbId] = f.slug;
  for (const a of articles) if (a.imdbId && a.slug) out[a.imdbId] = a.slug;
  return out;
}

/**
 * Slugs for films in popularity order. A colliding film gets `-{imdbId}` appended (the more popular
 * one keeps the plain slug). Slugs never change once published, so `existing` (imdbId -> slug from the
 * previous films.json and the article files) wins, and every slug in `existing` stays reserved, even for
 * a film that is no longer in the list.
 */
export function assignSlugs(
  items: { imdbId: string; title: string; year: number }[],
  existing: Record<string, string> = {},
): string[] {
  const used = new Set<string>(Object.values(existing));
  const out: (string | undefined)[] = items.map((it) => existing[it.imdbId]);
  items.forEach((it, i) => {
    if (out[i]) return;
    let slug = slugify(it.title, it.year);
    if (used.has(slug)) slug = `${slug}-${it.imdbId}`;
    used.add(slug);
    out[i] = slug;
  });
  return out as string[];
}

// ---------------------------------------------------------------- building the Film record

/** Like Film, but `netflix.runtimeMin` may be null when Netflix published no runtime for the title. */
export type FilmRecord = Omit<Film, 'netflix'> & {
  netflix: Omit<Film['netflix'], 'runtimeMin'> & { runtimeMin: number | null };
};

export function buildFilmRecord(args: {
  candidate: Candidate;
  poolRank: number;
  popularityRank: number;
  omdb: OmdbParsed;
  slug: string;
  fetchedAt: string;
  dataChangedAt: string;
}): FilmRecord {
  const { candidate: c, omdb } = args;
  if (omdb.imdbRating === null || omdb.imdbVotes === null || omdb.rtPercent === null) {
    throw new Error(`${omdb.imdbId}: cannot build a film record without IMDb rating, votes and RT score`);
  }
  const { type: _type, ...rest } = omdb;
  void _type;
  if (rest.runtimeMin === null) throw new Error(`${omdb.imdbId}: cannot build a film record without an OMDb runtime`);
  return {
    slug: args.slug,
    popularityRank: args.popularityRank,
    poolRank: args.poolRank,
    netflix: {
      title: c.title,
      category: c.category,
      popularityHours: c.popularityHours,
      hoursSource: c.hoursSource,
      weeksInTop10: c.weeksInTop10,
      peakRank: c.peakRank,
      firstWeek: c.firstWeek,
      lastWeek: c.lastWeek,
      mostPopularRank: c.mostPopularRank,
      runtimeMin: c.runtimeMin,
    },
    omdb: {
      ...rest,
      runtimeMin: rest.runtimeMin,
      imdbRating: omdb.imdbRating,
      imdbVotes: omdb.imdbVotes,
      rtPercent: omdb.rtPercent,
    },
    fetchedAt: args.fetchedAt,
    dataChangedAt: args.dataChangedAt,
  };
}

interface ComparableFilm {
  omdb: unknown;
  netflix: { popularityHours: number; weeksInTop10: number; peakRank: number | null; mostPopularRank: number | null };
}

/** True when any displayed value differs (fetchedAt and dataChangedAt do not count). */
export function filmValuesChanged(a: ComparableFilm, b: ComparableFilm): boolean {
  const pick = (f: ComparableFilm) => [
    f.omdb,
    f.netflix.popularityHours,
    f.netflix.weeksInTop10,
    f.netflix.peakRank,
    f.netflix.mostPopularRank,
  ];
  return JSON.stringify(pick(a)) !== JSON.stringify(pick(b));
}
