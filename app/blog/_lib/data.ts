// Server-side data access for the blog routes (hub, article page, OG cards).
// Reads the committed JSON through lib/blog/load (sync fs, memoised); no network,
// no dynamic APIs, so every route that calls this stays fully prerenderable.

import { existsSync } from 'fs';
import { loadArticles, loadFilmsFile, defaultFilmsPath } from '../../../lib/blog/load';
import { buildStats, type StatsBySlug } from '../../../lib/blog/stats';
import type { Article, Film, FilmsFile } from '../../../lib/blog/types';

export interface BlogData {
  filmsFile: FilmsFile;
  films: Film[];
  stats: StatsBySlug;
  /** Published articles by slug. */
  published: Map<string, Article>;
  /** Published slugs in popularity order. */
  publishedSlugs: string[];
}

/**
 * The blog data, or null when films.json does not exist yet (the hub then shows its
 * "being prepared" state and no article page is generated). A malformed file still throws.
 * The loaders memoise the parsed files; deriving the stats again is cheap.
 */
export function getBlogData(): BlogData | null {
  const path = defaultFilmsPath();
  if (!existsSync(path)) return null;

  const filmsFile = loadFilmsFile(path);
  const films = filmsFile.films;
  const bySlug = new Map(films.map((f) => [f.slug, f]));
  const published = new Map<string, Article>();
  for (const a of loadArticles().filter((x) => x.status === 'published')) {
    const film = bySlug.get(a.slug);
    if (!film) throw new Error(`published article "${a.slug}" has no film in films.json`);
    if (film.omdb.imdbId !== a.imdbId) throw new Error(`published article "${a.slug}": imdbId ${a.imdbId} does not match the film`);
    if (!a.published) throw new Error(`published article "${a.slug}" has no "published" date`);
    published.set(a.slug, a);
  }
  const publishedSlugs = films.filter((f) => published.has(f.slug)).map((f) => f.slug);
  return { filmsFile, films, stats: buildStats(films), published, publishedSlugs };
}
