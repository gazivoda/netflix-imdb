// Anti-duplication checks across articles (spec R12, R13, 6.1 similarity.test.ts).
// Word 5-grams over the written prose only (summary, section paragraphs, FAQ
// answers); the generated table, facts list and sources are not article text.
// Tokens count as one distinct word each (`{{imdb}}` becomes "tok_imdb"), so
// templated sentence frames are measured as shared, which is the stricter reading.
// Pure functions, no I/O.

import { displayTitle } from './format';
import { issue, type Issue } from './issue';
import type { FilmStats } from './stats';
import { renderTokens } from './tokens';
import type { Article, Film } from './types';

export const LIMITS = {
  minProseWords: 600,
  maxProseWords: 900,
  minUniqueWords: 450,
  /** Pairwise word-5-gram Jaccard on prose. */
  maxJaccard: 0.1,
  /** Share of an article's 5-grams found in any other article. */
  maxSharedRatio: 0.2,
  maxSummaryJaccard: 0.2,
  /** Articles allowed to share the same first 4 summary words (film title as X), the article itself included. */
  maxOpenerShare: 5,
  /** Articles allowed to share a section heading (film title as X). */
  maxHeadingShare: 5,
  /**
   * Pairwise Jaccard of 5-grams over content words only (function words and filler such as
   * "indeed", "also", "here" dropped), so a copy spun by inserting a filler word every few words
   * still matches its source.
   */
  maxContentJaccard: 0.1,
  ngram: 5,
} as const;

/** Function words and fillers ignored by the content-word comparison. */
export const FILLER_WORDS = new Set(
  ('a an the and or but nor so yet of to in on at by for with from into onto over under about after before as than ' +
    'then that this these those there here it its is are was were be been being has have had do does did can could ' +
    'will would may might must shall should not no very really quite just also too still even indeed rather ' +
    'which who whom whose what when where while if because though although since such some any each every both ' +
    'more most less much many few one they them their he she his her we you your our us').split(' '),
);

/** tokenizeWords minus FILLER_WORDS. */
export const contentWords = (text: string): string[] => tokenizeWords(text).filter((w) => !FILLER_WORDS.has(w));

export interface SimEntry {
  article: Article;
  film: Film;
  stats: FilmStats;
}

export const makeEntries = (articles: Article[], films: Film[], stats: Record<string, FilmStats>): SimEntry[] =>
  articles.map((article) => {
    const film = films.find((f) => f.slug === article.slug);
    if (!film) throw new Error(`article ${article.slug} has no film in films.json`);
    return { article, film, stats: stats[article.slug] };
  });

// ---------------------------------------------------------------- primitives

const stripLinkTargets = (text: string): string => text.replace(/\]\([^)]*\)/g, ']');

/** Lowercase words; tokens become one word each ("tok_imdb", "tok_cite_tudum"); link targets dropped. */
export function tokenizeWords(text: string): string[] {
  const prepared = stripLinkTargets(text)
    .replace(/\{\{\s*([A-Za-z0-9:-]+)\s*\}\}/g, (_m, name: string) => ` tok_${name.replace(/[:-]/g, '_')} `)
    .toLowerCase()
    .replace(/\u2019/g, "'");
  return (prepared.match(/[a-z0-9_']+/g) ?? []).map((w) => w.replace(/^'+|'+$/g, '')).filter(Boolean);
}

export function ngrams(words: string[], n: number = LIMITS.ngram): string[] {
  const out: string[] = [];
  for (let i = 0; i + n <= words.length; i++) out.push(words.slice(i, i + n).join(' '));
  return out;
}

/** Union of the n-grams of each chunk; n-grams never span two chunks. */
export function ngramSet(chunks: string[][], n: number = LIMITS.ngram): Set<string> {
  const set = new Set<string>();
  for (const words of chunks) for (const g of ngrams(words, n)) set.add(g);
  return set;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const g of small) if (large.has(g)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Whitespace word count; link targets dropped, a token counts as one word. */
export const countWords = (text: string): number =>
  stripLinkTargets(text)
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;

/** The written prose: summary, section paragraphs, FAQ answers. */
export const proseChunks = (a: Article): string[] => [
  a.summary,
  ...a.sections.flatMap((s) => s.paragraphs),
  ...a.faq.map((f) => f.a),
];

export const proseWordCount = (a: Article): number => proseChunks(a).reduce((n, t) => n + countWords(t), 0);

/** Prose must be 600 to 900 words (R12). */
export function proseLengthIssues(a: Article): Issue[] {
  const words = proseWordCount(a);
  return words < LIMITS.minProseWords || words > LIMITS.maxProseWords
    ? [issue('prose-length', `${a.slug}: prose is ${words} words; allowed ${LIMITS.minProseWords} to ${LIMITS.maxProseWords}`)]
    : [];
}

/** Words of the chunks that are not inside any 5-gram present in `otherGrams`. */
export function uniqueWordCount(chunks: string[][], otherGrams: Set<string>, n: number = LIMITS.ngram): number {
  let unique = 0;
  for (const words of chunks) {
    const covered = new Array<boolean>(words.length).fill(false);
    for (let i = 0; i + n <= words.length; i++) {
      if (otherGrams.has(words.slice(i, i + n).join(' '))) for (let k = i; k < i + n; k++) covered[k] = true;
    }
    unique += covered.filter((c) => !c).length;
  }
  return unique;
}

// ---------------------------------------------------------------- opener and heading keys

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replace the film's title (display, short or `{{title}}`) with "X" so frames compare across films. */
function titleAsX(text: string, e: SimEntry): string {
  const names = [displayTitle(e.film.omdb.title), e.article.shortTitle ? displayTitle(e.article.shortTitle) : '']
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  let out = text.replace(/\{\{\s*title\s*\}\}/g, 'X');
  for (const n of names) out = out.replace(new RegExp(escapeRe(n), 'gi'), 'X');
  return out;
}

/** First four words of the summary with the film title replaced by X. */
export const openerKey = (e: SimEntry): string => tokenizeWords(titleAsX(e.article.summary, e)).slice(0, 4).join(' ');

/** Section headings with the film title replaced by X, normalised. */
export const headingKeys = (e: SimEntry): string[] =>
  e.article.sections.map((s) => tokenizeWords(titleAsX(s.heading, e)).join(' '));

function renderSafe(text: string, e: SimEntry): string {
  try {
    return renderTokens(text, { film: e.film, stats: e.stats, sources: e.article.sources });
  } catch {
    return text;
  }
}

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

// ---------------------------------------------------------------- checks

interface Prepared {
  entry: SimEntry;
  chunks: string[][];
  grams: Set<string>;
  contentGrams: Set<string>;
  summaryGrams: Set<string>;
}

const prepare = (entry: SimEntry): Prepared => {
  const prose = proseChunks(entry.article);
  const chunks = prose.map(tokenizeWords);
  return {
    entry,
    chunks,
    grams: ngramSet(chunks),
    contentGrams: ngramSet(prose.map(contentWords)),
    summaryGrams: ngramSet([tokenizeWords(entry.article.summary)]),
  };
};

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

function check(target: Prepared, others: Prepared[], cache: Map<SimEntry, Prepared>): Issue[] {
  void cache;
  const a = target.entry.article;
  const issues: Issue[] = [...proseLengthIssues(a)];

  const union = new Set<string>();
  for (const o of others) for (const g of o.grams) union.add(g);

  if (others.length > 0) {
    const shared = [...target.grams].filter((g) => union.has(g)).length;
    const ratio = target.grams.size ? shared / target.grams.size : 0;
    if (ratio > LIMITS.maxSharedRatio) {
      issues.push(
        issue('shared-ratio', `${a.slug}: ${pct(ratio)} of its 5-grams appear in other articles (max ${pct(LIMITS.maxSharedRatio)})`),
      );
    }
    const unique = uniqueWordCount(target.chunks, union);
    if (unique < LIMITS.minUniqueWords) {
      issues.push(
        issue('unique-words', `${a.slug}: only ${unique} unique words outside shared 5-grams (min ${LIMITS.minUniqueWords})`),
      );
    }
  }

  const h1 = norm(renderSafe(a.h1, target.entry));
  const description = norm(renderSafe(a.description, target.entry));
  for (const o of others) {
    const pair = [a.slug, o.entry.article.slug].sort().join(' vs ');
    const j = jaccard(target.grams, o.grams);
    if (j > LIMITS.maxJaccard) {
      issues.push(issue('jaccard', `${pair}: 5-gram Jaccard ${j.toFixed(3)} (max ${LIMITS.maxJaccard})`));
    }
    const cj = jaccard(target.contentGrams, o.contentGrams);
    if (cj > LIMITS.maxContentJaccard) {
      issues.push(issue('content-jaccard', `${pair}: content-word 5-gram Jaccard ${cj.toFixed(3)} (max ${LIMITS.maxContentJaccard}; filler words ignored)`));
    }
    const sj = jaccard(target.summaryGrams, o.summaryGrams);
    if (sj > LIMITS.maxSummaryJaccard) {
      issues.push(issue('summary-jaccard', `${pair}: summary 5-gram Jaccard ${sj.toFixed(3)} (max ${LIMITS.maxSummaryJaccard})`));
    }
    if (h1 === norm(renderSafe(o.entry.article.h1, o.entry))) {
      issues.push(issue('h1-unique', `${pair}: identical h1 "${h1}"`));
    }
    if (description === norm(renderSafe(o.entry.article.description, o.entry))) {
      issues.push(issue('description-unique', `${pair}: identical description`));
    }
  }

  const all = [target, ...others];
  const opener = openerKey(target.entry);
  const sameOpener = all.filter((p) => openerKey(p.entry) === opener).map((p) => p.entry.article.slug);
  if (sameOpener.length > LIMITS.maxOpenerShare) {
    issues.push(
      issue(
        'opener-reuse',
        `summary opener "${opener}" is shared by ${sameOpener.length} articles (max ${LIMITS.maxOpenerShare}): ${sameOpener.sort().join(', ')}`,
      ),
    );
  }
  for (const key of new Set(headingKeys(target.entry))) {
    const same = all.filter((p) => headingKeys(p.entry).includes(key)).map((p) => p.entry.article.slug);
    if (same.length > LIMITS.maxHeadingShare) {
      issues.push(
        issue(
          'heading-reuse',
          `heading "${key}" is shared by ${same.length} articles (max ${LIMITS.maxHeadingShare}): ${same.sort().join(', ')}`,
        ),
      );
    }
  }
  return issues;
}

/** All similarity findings for `target` compared with `others` (an entry with the same slug is ignored). */
export function checkSimilarity(target: SimEntry, others: SimEntry[]): Issue[] {
  const cache = new Map<SimEntry, Prepared>();
  const prep = (e: SimEntry): Prepared => cache.get(e) ?? (cache.set(e, prepare(e)), cache.get(e) as Prepared);
  return check(prep(target), others.filter((o) => o.article.slug !== target.article.slug).map(prep), cache);
}

/** Every finding across a set of articles; pair and group findings are reported once. */
export function checkCorpusSimilarity(entries: SimEntry[]): Issue[] {
  const cache = new Map<SimEntry, Prepared>();
  const prep = (e: SimEntry): Prepared => cache.get(e) ?? (cache.set(e, prepare(e)), cache.get(e) as Prepared);
  const prepared = entries.map(prep);
  const seen = new Set<string>();
  const out: Issue[] = [];
  for (const p of prepared) {
    for (const i of check(p, prepared.filter((o) => o !== p), cache)) {
      const key = `${i.rule}|${i.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(i);
      }
    }
  }
  return out;
}
