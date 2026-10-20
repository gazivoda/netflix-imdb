// Test helpers: load the fake films file and fake articles under tests/blog/fixtures.
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { Article, Film, FilmsFile } from '../../../lib/blog/types';

const DIR = __dirname;

export const FIXTURE_FILMS_PATH = join(DIR, 'films.json');
export const FIXTURE_ARTICLES_DIR = join(DIR, 'articles');

export const loadFixtureFilmsFile = (): FilmsFile => JSON.parse(readFileSync(FIXTURE_FILMS_PATH, 'utf8')) as FilmsFile;
export const loadFixtureFilms = (): Film[] => loadFixtureFilmsFile().films;

export const loadFixtureArticles = (): Article[] =>
  readdirSync(FIXTURE_ARTICLES_DIR)
    .filter((n) => n.endsWith('.json'))
    .sort()
    .map((n) => JSON.parse(readFileSync(join(FIXTURE_ARTICLES_DIR, n), 'utf8')) as Article);

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const filmBySlug = (slug: string): Film => {
  const f = loadFixtureFilms().find((x) => x.slug === slug);
  if (!f) throw new Error(`fixture film not found: ${slug}`);
  return f;
};
