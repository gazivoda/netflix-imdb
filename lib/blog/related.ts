// Computed related links (spec 4.4). Over PUBLISHED films only, so a page never
// links to a 404. Pure and deterministic: ties break on popularity rank.

import { gapOf, primaryGenre, type StatsBySlug } from './stats';
import type { Film } from './types';

/** Writer picks plus computed links fill to this many before previous/next are added. */
export const RELATED_FILL = 4;
export const MAX_PICKS = 2;

export type RelatedKind =
  | 'pick'
  | 'nearest-gap'
  | 'opposite'
  | 'shared-people'
  | 'next-nearest'
  | 'previous'
  | 'next';

export interface RelatedLink {
  slug: string;
  kind: RelatedKind;
  /** Only for writer picks. */
  reason?: string;
}

export interface RelatedContext {
  films: Film[];
  stats: StatsBySlug;
  /** Slugs of published articles. */
  published: Iterable<string>;
  /** Writer picks from the article file (`related`). */
  picks?: { slug: string; reason: string }[];
}

const byRank = (a: Film, b: Film): number => a.popularityRank - b.popularityRank;

/**
 * Up to RELATED_FILL links (picks, then nearest-gap x2 in genre, one opposite, one
 * shared-people else next-nearest), then previous and next by popularity rank.
 */
export function computeRelated(film: Film, ctx: RelatedContext): RelatedLink[] {
  const publishedSet = new Set(ctx.published);
  const gapOfSlug = (f: Film): number => ctx.stats[f.slug]?.gap ?? gapOf(f);
  const myGap = gapOfSlug(film);
  const pool = ctx.films.filter((f) => f.slug !== film.slug && publishedSet.has(f.slug));
  const taken = new Set<string>();
  const links: RelatedLink[] = [];
  const add = (f: Film | undefined, kind: RelatedKind, reason?: string): void => {
    if (!f || taken.has(f.slug) || links.length >= RELATED_FILL + (kind === 'previous' || kind === 'next' ? 2 : 0)) return;
    taken.add(f.slug);
    links.push(reason ? { slug: f.slug, kind, reason } : { slug: f.slug, kind });
  };
  const free = (): Film[] => pool.filter((f) => !taken.has(f.slug));
  const nearest = (list: Film[]): Film[] =>
    [...list].sort((a, b) => Math.abs(gapOfSlug(a) - myGap) - Math.abs(gapOfSlug(b) - myGap) || byRank(a, b));
  const widest = (list: Film[]): Film[] =>
    [...list].sort((a, b) => Math.abs(gapOfSlug(b)) - Math.abs(gapOfSlug(a)) || byRank(a, b));
  const room = (): boolean => links.length < RELATED_FILL;

  // writer picks (max 2), only published films other than this one
  let picked = 0;
  for (const p of ctx.picks ?? []) {
    if (picked >= MAX_PICKS) break;
    const f = pool.find((x) => x.slug === p.slug);
    if (f && !taken.has(f.slug)) {
      add(f, 'pick', p.reason);
      picked++;
    }
  }

  // (a) two same-primary-genre films with the nearest gap
  const genre = primaryGenre(film);
  const sameGenre = (): Film[] => free().filter((f) => primaryGenre(f) === genre);
  for (const f of nearest(sameGenre()).slice(0, 2)) if (room()) add(f, 'nearest-gap');

  // (b) one film of the opposite sign (agreed films: the largest abs gap in the genre)
  if (room()) {
    const agreed = ctx.stats[film.slug]?.archetype.startsWith('agreed') ?? Math.abs(myGap) < 10;
    const wantsOpposite = (f: Film): boolean => (myGap > 0 ? gapOfSlug(f) < 0 : gapOfSlug(f) > 0);
    let candidates: Film[];
    if (agreed) {
      candidates = sameGenre();
      if (candidates.length === 0) candidates = free();
    } else {
      candidates = sameGenre().filter(wantsOpposite);
      if (candidates.length === 0) candidates = free().filter(wantsOpposite);
    }
    add(widest(candidates)[0], 'opposite');
  }

  // (c) one sharing a director or one of the first three actors, else next-nearest overall
  if (room()) {
    const people = new Set([...film.omdb.directors, ...film.omdb.actors.slice(0, 3)]);
    const shares = (f: Film): boolean => [...f.omdb.directors, ...f.omdb.actors].some((n) => people.has(n));
    const sharing = nearest(free().filter(shares))[0];
    if (sharing) add(sharing, 'shared-people');
    else add(nearest(free())[0], 'next-nearest');
  }

  // top up when a step found nothing
  while (room() && free().length > 0) add(nearest(free())[0], 'next-nearest');

  // previous and next by popularity rank, wrapping; skip films that are already linked
  const ring = [...pool, film].sort(byRank);
  const at = ring.findIndex((f) => f.slug === film.slug);
  const walk = (step: 1 | -1): Film | undefined => {
    for (let i = 1; i < ring.length; i++) {
      const f = ring[(at + step * i + ring.length * i) % ring.length];
      if (f.slug !== film.slug && !taken.has(f.slug)) return f;
    }
    return undefined;
  };
  add(walk(-1), 'previous');
  add(walk(1), 'next');
  return links;
}
