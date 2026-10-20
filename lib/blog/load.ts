// Synchronous, memoised readers for the blog data files (spec 2.4).
// Server-side only; used by build-time code and the CLIs. No network.
// Nothing is read at import time: files are read on first call.

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import type { Article, Film, FilmsFile } from './types';

/**
 * Data directory: `BLOG_DATA_DIR` (relative to the cwd, or absolute) or `data/blog`.
 * Lets a build or a test point the loaders at fixtures. The cwd is the project root
 * for next build, jest and npm scripts.
 */
export const blogDataDir = (): string => resolve(process.cwd(), process.env.BLOG_DATA_DIR?.trim() || 'data/blog');
export const defaultFilmsPath = (): string => join(blogDataDir(), 'films.json');
export const defaultArticlesDir = (): string => join(blogDataDir(), 'articles');

const filmsCache = new Map<string, FilmsFile>();
const articlesCache = new Map<string, ArticleFile[]>();

export interface ArticleFile {
  /** File name without directory, for example "red-notice-2021.json". */
  file: string;
  article: Article;
}

function readJson<T>(path: string): T {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`cannot read ${path}: ${(err as Error).message}`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(`invalid JSON in ${path}: ${(err as Error).message}`);
  }
}

/** Read and memoise films.json. Throws a clear error when the file is missing. */
export function loadFilmsFile(path: string = defaultFilmsPath()): FilmsFile {
  const hit = filmsCache.get(path);
  if (hit) return hit;
  if (!existsSync(path)) {
    throw new Error(`films file not found: ${path} (run \`npm run blog:refresh\` to create data/blog/films.json)`);
  }
  const data = readJson<FilmsFile>(path);
  if (!data || !Array.isArray(data.films)) throw new Error(`${path} has no "films" array`);
  filmsCache.set(path, data);
  return data;
}

export const loadFilms = (path?: string): Film[] => loadFilmsFile(path).films;

/**
 * Read and memoise every `*.json` file in the articles directory, sorted by file
 * name. A missing or empty directory yields []. Does not validate; see schema.ts.
 */
export function loadArticleFiles(dir: string = defaultArticlesDir()): ArticleFile[] {
  const hit = articlesCache.get(dir);
  if (hit) return hit;
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((n) => n.endsWith('.json'))
        .sort()
    : [];
  const out = files.map((file) => ({ file, article: readJson<Article>(join(dir, file)) }));
  articlesCache.set(dir, out);
  return out;
}

export const loadArticles = (dir?: string): Article[] => loadArticleFiles(dir).map((f) => f.article);

/** One article by slug, or undefined. */
export const loadArticle = (slug: string, dir?: string): Article | undefined =>
  loadArticles(dir).find((a) => a.slug === slug);

/** Drop the memoised data (tests, long-running watchers). */
export function clearBlogCache(): void {
  filmsCache.clear();
  articlesCache.clear();
}
