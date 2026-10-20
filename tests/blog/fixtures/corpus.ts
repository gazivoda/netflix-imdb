// Loads the REAL corpus (data/blog) for corpus-wide tests. Returns null when there
// are no article files yet (empty or missing directory), so those tests pass
// trivially until articles exist. Once articles exist, films.json must exist too.
// Only review, checked and published articles are loaded (drafts are excluded).
import { loadArticles, loadFilms } from '../../../lib/blog/load';
import { buildStats, type StatsBySlug } from '../../../lib/blog/stats';
import type { Article, Film } from '../../../lib/blog/types';

export interface Corpus {
  articles: Article[];
  films: Film[];
  stats: StatsBySlug;
}

/**
 * Statuses the corpus tests load by default. A committed draft is work in progress and must not
 * fail CI; the integrator checks drafts with `npm run blog:check -- --all`.
 */
export const CORPUS_STATUSES: Article['status'][] = ['review', 'checked', 'published'];

export function loadCorpus(statuses: Article['status'][] = CORPUS_STATUSES): Corpus | null {
  const articles = loadArticles().filter((a) => statuses.includes(a.status));
  if (articles.length === 0) return null;
  const films = loadFilms();
  return { articles, films, stats: buildStats(films) };
}
