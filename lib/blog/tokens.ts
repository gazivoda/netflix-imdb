// Prose tokens (spec 3.1, R11): numbers and film facts enter article text only
// through `{{token}}` placeholders rendered from films.json. An unknown token, a
// token whose value is null, or a malformed brace is a build error.
// Pure functions, no I/O.

import {
  displayTitle,
  formatAsOf,
  formatHours,
  formatImdb,
  formatSigned,
  formatVotes,
  formatVotesShort,
} from './format';
import { ordinal, type FilmStats } from './stats';
import type { Film, SourceRef } from './types';

export const TOKEN_NAMES = [
  'title',
  'year',
  'imdb',
  'imdbX10',
  'rt',
  'metascore',
  'votes',
  'votesShort',
  'gap',
  'gapAbs',
  'gapRank',
  'setSize',
  'genre',
  'genreCount',
  'genreMedianGap',
  'popularityRank',
  'weeksInTop10',
  'peakRank',
  'hours',
  'runtime',
  'director',
  'asOf',
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenError';
  }
}

export interface TokenContext {
  film: Film;
  stats: FilmStats;
  /** Needed for `{{cite:id}}`. */
  sources?: SourceRef[];
  /** How a citation renders; default is the 1-based source number in brackets. */
  cite?: (source: SourceRef, index: number) => string;
}

/** Value of every simple token, or null where the film has no value. */
export function tokenValues(ctx: TokenContext): Record<TokenName, string | null> {
  const { film, stats } = ctx;
  const o = film.omdb;
  return {
    title: displayTitle(o.title),
    year: String(o.year),
    imdb: formatImdb(o.imdbRating),
    imdbX10: String(stats.imdbScaled),
    rt: `${o.rtPercent}%`,
    metascore: o.metascore === null ? null : String(o.metascore),
    votes: formatVotes(o.imdbVotes),
    votesShort: formatVotesShort(o.imdbVotes),
    gap: formatSigned(stats.gap),
    gapAbs: String(stats.absGap),
    gapRank: ordinal(stats.gapRank),
    setSize: String(stats.setSize),
    genre: o.genres[0] ? o.genres[0].toLowerCase() : null,
    genreCount: String(stats.genreCount),
    genreMedianGap: stats.genreMedianGap === null ? null : formatSigned(stats.genreMedianGap),
    popularityRank: ordinal(film.popularityRank),
    weeksInTop10: String(film.netflix.weeksInTop10),
    peakRank: film.netflix.peakRank === null ? null : String(film.netflix.peakRank),
    hours: film.netflix.popularityHours > 0 ? formatHours(film.netflix.popularityHours) : null,
    runtime: o.runtimeMin > 0 ? `${o.runtimeMin} minutes` : null,
    director: o.directors[0] ?? null,
    asOf: film.fetchedAt ? formatAsOf(film.fetchedAt) : null,
  };
}

export interface FoundToken {
  raw: string;
  name: string;
  arg: string | undefined;
}

const TOKEN_RE = /\{\{([^{}]*)\}\}/g;
const INNER_RE = /^([A-Za-z][A-Za-z0-9]*)(?::([a-z0-9][a-z0-9-]*))?$/;

/** Every well-formed `{{name}}` / `{{name:arg}}` in the text, in order. Malformed ones are skipped. */
export function findTokens(text: string): FoundToken[] {
  const out: FoundToken[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const inner = INNER_RE.exec(m[1].trim());
    if (inner) out.push({ raw: m[0], name: inner[1], arg: inner[2] });
  }
  return out;
}

/** Distinct source ids cited with `{{cite:id}}`, in first-use order. */
export function citedIds(text: string): string[] {
  const ids: string[] = [];
  for (const t of findTokens(text)) if (t.name === 'cite' && t.arg && !ids.includes(t.arg)) ids.push(t.arg);
  return ids;
}

/** Replace every token with `replacement` (for lints that must ignore token content). */
export const stripTokens = (text: string, replacement = ''): string => text.replace(TOKEN_RE, replacement);

function resolve(inner: string, ctx: TokenContext, values: Record<TokenName, string | null>): string {
  const m = INNER_RE.exec(inner.trim());
  if (!m) throw new TokenError(`malformed token "{{${inner}}}"`);
  const [, name, arg] = m;
  if (name === 'cite') {
    if (!arg) throw new TokenError('token "cite" needs a source id: {{cite:id}}');
    const sources = ctx.sources ?? [];
    const index = sources.findIndex((s) => s.id === arg);
    if (index < 0) throw new TokenError(`{{cite:${arg}}} does not resolve to a source id`);
    return ctx.cite ? ctx.cite(sources[index], index) : `[${index + 1}]`;
  }
  if (!(TOKEN_NAMES as readonly string[]).includes(name)) throw new TokenError(`unknown token "${name}"`);
  if (arg !== undefined) throw new TokenError(`token "${name}" takes no argument`);
  const value = values[name as TokenName];
  if (value === null || value === undefined) {
    throw new TokenError(`token "${name}" has no value for ${ctx.film.slug} (null in films.json)`);
  }
  return value;
}

/** Render all tokens in `text`. Throws TokenError on the first problem. */
export function renderTokens(text: string, ctx: TokenContext): string {
  const values = tokenValues(ctx);
  const out = text.replace(TOKEN_RE, (_m, inner: string) => resolve(inner, ctx, values));
  if (out.includes('{{') || out.includes('}}')) throw new TokenError(`unbalanced braces in "${text.slice(0, 60)}"`);
  return out;
}

/** Non-throwing variant: one message per problem (token errors, then unbalanced braces). */
export function tokenProblems(text: string, ctx: TokenContext): string[] {
  const values = tokenValues(ctx);
  const problems: string[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    try {
      resolve(m[1], ctx, values);
    } catch (err) {
      problems.push((err as Error).message);
    }
  }
  if (stripTokens(text).match(/\{\{|\}\}/)) problems.push('unbalanced braces');
  return problems;
}
