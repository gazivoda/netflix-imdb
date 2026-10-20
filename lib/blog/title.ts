// Titles, slugs and labels for the Top 100 blog (spec R7, 2.3, 4.2).
// Pure helpers, no I/O.

import { displayTitle, formatImdb } from './format';
import type { Film } from './types';

export { displayTitle };

/** R7: generated <title> is at most 50 chars (renders <= 65 with the 15-char site suffix). */
export const MAX_TITLE_LENGTH = 50;
export const MAX_SHORT_TITLE_LENGTH = 29;

export class TitleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TitleError';
  }
}

export type TitleVariant = 'full' | 'no-year' | 'short';

export interface GeneratedTitle {
  title: string;
  variant: TitleVariant;
}

const scores = (film: Film): string => `IMDb ${formatImdb(film.omdb.imdbRating)} vs RT ${film.omdb.rtPercent}%`;

/**
 * R7 chain: `{Film} ({Year}): IMDb x vs RT y%`, then `{Film}: ...`, then
 * `{shortTitle}: ...`. Throws TitleError when none fits in MAX_TITLE_LENGTH.
 */
export function generatedTitle(film: Film, shortTitle?: string): GeneratedTitle {
  const name = displayTitle(film.omdb.title);
  const candidates: GeneratedTitle[] = [
    { title: `${name} (${film.omdb.year}): ${scores(film)}`, variant: 'full' },
    { title: `${name}: ${scores(film)}`, variant: 'no-year' },
  ];
  if (shortTitle) candidates.push({ title: `${displayTitle(shortTitle)}: ${scores(film)}`, variant: 'short' });
  const fit = candidates.find((c) => c.title.length <= MAX_TITLE_LENGTH);
  if (!fit) {
    const last = candidates[candidates.length - 1];
    throw new TitleError(
      `no title form fits in ${MAX_TITLE_LENGTH} characters for ${film.slug} (shortest is ${last.title.length}: "${last.title}")` +
        (shortTitle ? '' : '; add a shortTitle (<= 29 chars) to the article'),
    );
  }
  return fit;
}

/** `{Title} ({Year})`, the anchor text for related links and the registry label. */
export const articleLabel = (film: Film): string => `${displayTitle(film.omdb.title)} (${film.omdb.year})`;

const wordsOf = (s: string): string[] =>
  s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['\u2018\u2019]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Words that cannot carry a short title on their own. */
const TITLE_STOPWORDS = new Set(
  'a an the and or of to in on at by for with from into my your his her its our their is are be it this that these those part'.split(' '),
);

/** Characters a single-word shortTitle must have to be recognisable on its own. */
export const MIN_SINGLE_WORD_SHORT_TITLE = 5;

/**
 * shortTitle must be an ordered subset of the words of the OMDb title (spec 3.1) AND recognisable:
 * at least two non-stopword words of the title, or one non-stopword word of at least
 * MIN_SINGLE_WORD_SHORT_TITLE letters that is the title's first non-stopword word
 * ("Avengers" for "Avengers: Endgame"). "The", "Man" or "Part Two" alone are rejected.
 */
export function isRecognisableShortTitle(shortTitle: string, omdbTitle: string): boolean {
  const short = wordsOf(displayTitle(shortTitle));
  const full = wordsOf(displayTitle(omdbTitle));
  if (short.length === 0) return false;
  let i = 0;
  for (const w of full) if (w === short[i]) i++;
  if (i !== short.length) return false;
  const content = short.filter((w) => !TITLE_STOPWORDS.has(w) && !/^\d+$/.test(w));
  if (content.length >= 2) return true;
  if (content.length === 0) return false;
  const firstContent = full.find((w) => !TITLE_STOPWORDS.has(w) && !/^\d+$/.test(w));
  return content[0].length >= MIN_SINGLE_WORD_SHORT_TITLE && content[0] === firstContent;
}

/** Spec 4.2 slug rule, owned by T1 (select.ts) and re-exported here so callers have one import. */
export { slugify } from './select';

/** Slugs of films for which neither title form fits, so the article needs a `shortTitle`. */
export function titlesNeedingShortTitle(films: Film[]): string[] {
  return films
    .filter((f) => {
      try {
        generatedTitle(f);
        return false;
      } catch {
        return true;
      }
    })
    .map((f) => f.slug);
}
