// Number and text formatting shared by tokens, titles and the CLIs.
// Pure helpers, no I/O.

/** Characters the copy rules ban in rendered text: en dash, em dash, horizontal bar. */
const DASHES = '\u2012\u2013\u2014\u2015';

/**
 * Titles come from OMDb and may contain en or em dashes; the site copy rules ban
 * them, so every rendered title replaces them with " - " (spec 2.3).
 */
export function displayTitle(raw: string): string {
  return raw
    .replace(new RegExp(`\\s*[${DASHES}]\\s*`, 'g'), ' - ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** 6.3, 7.0 (one decimal, always). */
export const formatImdb = (rating: number): string => rating.toFixed(1);

/** 361059 -> "361,059". */
export function formatVotes(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const trimZero = (s: string): string => s.replace(/\.0$/, '');

/** 361059 -> "361K", 7480 -> "7.5K", 1250000 -> "1.3M". */
export function formatVotesShort(n: number): string {
  if (n < 1000) return String(Math.round(n));
  if (n < 10_000) return `${trimZero((n / 1000).toFixed(1))}K`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}K`;
  return `${trimZero((n / 1_000_000).toFixed(1))}M`;
}

/** +12 / -27 / 0 (ASCII hyphen-minus). */
export const formatSigned = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `-${Math.abs(n)}` : '0');

/** 454200000 -> "454 million", 1530000000 -> "1.5 billion", 850000 -> "850,000". */
export function formatHours(hours: number): string {
  if (hours >= 1_000_000_000) return `${trimZero((hours / 1_000_000_000).toFixed(1))} billion`;
  if (hours >= 1_000_000) return `${Math.round(hours / 1_000_000)} million`;
  return formatVotes(hours);
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2026-10-15T09:30:00.000Z" or "2026-10-15" -> "October 15, 2026" (UTC date part, no locale). */
export function formatAsOf(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new Error(`formatAsOf: not an ISO date: ${iso}`);
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) throw new Error(`formatAsOf: bad month in ${iso}`);
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

/** Real calendar date check for YYYY-MM-DD strings. */
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isIsoDateTime(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(s) && !Number.isNaN(Date.parse(s));
}
