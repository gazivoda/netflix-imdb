// Extra inputs for `blog:check` that live outside data/blog/articles (spec 7.1, review I6, C1).
// Server-side only (sync fs). Used by scripts/blog/check.mjs and the corpus tests.

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { buildStats } from './stats';
import type { SimEntry } from './similarity';
import type { Article, FilmsFile } from './types';

/** The worked example printed in docs/blog/WRITER-BRIEF.md section 9 (status review). */
export const WORKED_EXAMPLE_PATH = 'tests/blog/fixtures/worked-example.json';
/** The fixture films file that holds the worked example's (fictional) film. */
export const WORKED_EXAMPLE_FILMS_PATH = 'tests/blog/fixtures/films.json';

/**
 * The worked example as a similarity entry, with its fixture film and stats computed inside the
 * fixture set, so `blog:check` compares every real article with it: no article may imitate its
 * sentence frames. Null when the file is missing (for example in a trimmed checkout).
 */
export function loadWorkedExampleEntry(root: string = process.cwd()): SimEntry | null {
  const articlePath = join(root, WORKED_EXAMPLE_PATH);
  const filmsPath = join(root, WORKED_EXAMPLE_FILMS_PATH);
  if (!existsSync(articlePath) || !existsSync(filmsPath)) return null;
  const article = JSON.parse(readFileSync(articlePath, 'utf8')) as Article;
  const films = (JSON.parse(readFileSync(filmsPath, 'utf8')) as FilmsFile).films;
  const film = films.find((f) => f.slug === article.slug);
  if (!film) throw new Error(`${WORKED_EXAMPLE_PATH}: no fixture film with slug "${article.slug}"`);
  return { article, film, stats: buildStats(films)[film.slug] };
}

interface DoubtfulFile {
  entries?: { imdbId?: string; override?: boolean; outcome?: string }[];
}

/**
 * IMDb ids from data/blog/source/doubtful.json (next to films.json) that were accepted without an
 * identity override: their identity still needs a human decision (C1). [] when there is no file.
 */
export function loadDoubtfulIds(filmsPath: string): string[] {
  const file = join(dirname(filmsPath), 'source', 'doubtful.json');
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, 'utf8')) as DoubtfulFile;
  return (data.entries ?? [])
    .filter((e) => e.imdbId && !e.override && (e.outcome === undefined || e.outcome === 'eligible'))
    .map((e) => e.imdbId as string);
}
