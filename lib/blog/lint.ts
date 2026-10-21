// Copy lint for article files (spec 6.1 article-copy, 3.4 tier words, 7.3 banned
// phrases, R11 no score-like literals, plot-overlap). Pure functions, no I/O.

import { displayTitle } from './format';
import { issue, type Issue } from './issue';
import { stripTokens } from './tokens';
import type { FilmStats } from './stats';
import {
  ALWAYS_FORBIDDEN,
  BANNED_PHRASES,
  FORBIDDEN_CLAIMS,
  directionProblems,
  matchRules,
  tierNeverRules,
  withoutTierExemptions,
  wordingText,
} from './wording';
import { filmNames, maskTitles, namesFilm, splitSentences, TITLE_MASK, verbatimRegex } from './sentences';
import type { Article, Film } from './types';

export interface LintContext {
  film: Film;
  stats: FilmStats;
}

export interface FoundString {
  where: string;
  text: string;
}

/** Every string in the article JSON, with a JSON path such as `sections[0].paragraphs[1]`. */
export function allStrings(value: unknown, where = ''): FoundString[] {
  if (typeof value === 'string') return [{ where, text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => allStrings(v, `${where}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => allStrings(v, where ? `${where}.${k}` : k));
  }
  return [];
}

/** Reader-facing authored text: the fields the wording rules apply to. */
const PROSE_PATH = /^(?:summary|description|h1|shortTitle|sections\[\d+\]\.(?:heading|paragraphs\[\d+\])|faq\[\d+\]\.(?:q|a))$/;
export const isProsePath = (where: string): boolean => PROSE_PATH.test(where);
const isUrlPath = (where: string): boolean => /(?:^|\.)url$/.test(where);

// ---------------------------------------------------------------- forbidden characters (6.1)

// Built from code points (soft hyphen, zero-width and direction marks, word joiner,
// variation selector 16, BOM) so no escape sequence of an emoji-adjacent glyph sits in source.
const INVISIBLE = new RegExp(
  `[${[0xad, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2060, 0xfe0f, 0xfeff].map((c) => String.fromCharCode(c)).join('')}]`,
);

const FORBIDDEN_CHARS: { label: string; re: RegExp; skipUrl?: boolean }[] = [
  { label: 'emoji or pictograph', re: /\p{Extended_Pictographic}/u },
  { label: 'figure dash, en dash, em dash or horizontal bar (U+2012 to U+2015)', re: /[\u2012\u2013\u2014\u2015]/ },
  { label: 'minus sign (U+2212)', re: /\u2212/ },
  { label: 'arrow glyph', re: /[\u2190-\u21FF\u27F0-\u27FF\u2900-\u297F\u2B00-\u2BFF]/ },
  { label: 'bullet (U+2022)', re: /\u2022/ },
  { label: 'middle dot (U+00B7)', re: /\u00B7/ },
  { label: 'ASCII arrow (->, =>, <-)', re: /->|=>|<-/ },
  { label: 'hex colour', re: /#[0-9a-fA-F]{3,8}\b/, skipUrl: true },
  { label: 'invisible character', re: INVISIBLE },
];

/** Findings for banned glyphs in one string. */
export function forbiddenChars(text: string, where: string): Issue[] {
  const out: Issue[] = [];
  for (const c of FORBIDDEN_CHARS) {
    if (c.skipUrl && isUrlPath(where)) continue;
    if (c.re.test(text)) out.push(issue('forbidden-char', `contains ${c.label}`, where));
  }
  return out;
}

// ---------------------------------------------------------------- other prose rules

const SCORE_LITERALS: { label: string; re: RegExp }[] = [
  { label: 'a decimal score such as 6.3', re: /\b\d\.\d\b/ },
  { label: 'a percentage such as 36%', re: /\d+\s?%/ },
  { label: 'a points count such as 12 points', re: /\d+\s?points?\b/i },
];

/** Body prose: summary, section paragraphs (data-note included) and FAQ answers. */
const BODY_PATH = /^(?:summary|sections\[\d+\]\.paragraphs\[\d+\]|faq\[\d+\]\.a)$/;
export const isBodyPath = (where: string): boolean => BODY_PATH.test(where);

const RATING_CODES = /\b(?:PG-13|NC-17|TV-(?:Y7(?:-FV)?|Y|G|PG|14|MA))\b/g;
/** True when `text` contains `quoted` exactly (case, apostrophe and whitespace-run tolerant). */
const quotesVerbatim = (text: string, quoted: string): boolean => verbatimRegex(quoted).test(text);

/**
 * R11 "numbers only as tokens": the digits left in body prose once tokens are removed and the
 * allowed digit uses are blanked (the film's name, 4-digit years, "Top 10", rating codes such
 * as PG-13, and the OMDb Awards text quoted verbatim).
 */
export function strayNumbers(text: string, ctx: { names: readonly string[]; awards: string | null }): string[] {
  let t = maskTitles(wordingText(text), ctx.names);
  if (ctx.awards) t = t.replace(verbatimRegex(ctx.awards), ' ');
  t = t
    .replace(RATING_CODES, ' ')
    .replace(/\bTop 10\b/gi, ' ')
    .replace(/(?<![\d.,])\b(?:1[89]|20)\d{2}s?\b(?![\d.,]\d)/g, ' ');
  return t.match(/\S*\d\S*/g) ?? [];
}

/**
 * Words that mark a claim beyond the film record (release events, festivals, source material,
 * awards, production). The sentence must carry {{cite:id}} unless it restates the OMDb Awards text.
 */
const MUST_CITE: { label: string; re: RegExp }[] = [
  { label: 'premiere', re: /\bpremi[eè]r(?:e|es|ed|ing)\b/i },
  { label: 'festival', re: /\bfestivals?\b/i },
  { label: 'based on', re: /\bbased on\b/i },
  { label: 'adapted', re: /\badapt(?:ed|ation|ations|s|ing)\b/i },
  { label: 'novel', re: /\bnovels?\b/i },
  { label: 'won', re: /\bwon\b/i },
  { label: 'nominated', re: /\bnominated\b/i },
  { label: 'Oscar', re: /\boscars?\b|\bacademy awards?\b/i },
  { label: 'BAFTA', re: /\bbaftas?\b/i },
  { label: 'Golden Globe', re: /\bgolden globes?\b/i },
  { label: 'Emmy', re: /\bemmys?\b/i },
  { label: 'filmed', re: /\bfilmed\b/i },
  { label: 'shot in', re: /\bshot (?:in|on location)\b/i },
  { label: 'directed (use {{director}})', re: /\bdirect(?:ed|s|ing)\b/i },
];

const hasCite = (sentence: string): boolean => /\{\{\s*cite:[^{}]*\}\}/.test(sentence);
const hasDirectorToken = (sentence: string): boolean => /\{\{\s*director\s*\}\}/.test(sentence);

/** Must-cite findings per sentence of one body string (raw text, names masked). */
export function uncitedClaims(text: string, ctx: { names: readonly string[]; awards: string | null }): string[] {
  const out: string[] = [];
  // The Awards text ("Won 2 Oscars. 112 wins & 52 nominations total") holds ". " itself: it is
  // kept whole inside one sentence, so quoting it exactly always satisfies the exemption below.
  for (const sentence of splitSentences(maskTitles(text, ctx.names), ctx.awards ? [ctx.awards] : [])) {
    if (hasCite(sentence)) continue;
    const plain = stripTokens(sentence, ' T ');
    const restatesAwards = ctx.awards !== null && quotesVerbatim(plain, ctx.awards);
    for (const m of MUST_CITE) {
      if (!m.re.test(plain)) continue;
      if (m.label.startsWith('directed') && hasDirectorToken(sentence)) continue;
      if (restatesAwards && m.label !== 'directed (use {{director}})') continue;
      out.push(`${m.label}: "${sentence.replace(new RegExp(TITLE_MASK, 'g'), 'the film').slice(0, 80)}"`);
    }
  }
  return out;
}

/**
 * The wording rules see a capitalised award category ("Best Original Screenplay") as a
 * proper name only inside a sentence that carries {{cite:id}}; everywhere else "best" is banned.
 */
function allowCitedAwardNames(text: string): string {
  return splitSentences(text)
    .map((sentence) => (hasCite(sentence) ? sentence.replace(/\bBest(?= [A-Z][a-z])/g, 'Award') : sentence))
    .join(' ');
}

const MARKUP: { label: string; re: RegExp }[] = [
  { label: 'HTML tag', re: /<\/?[a-zA-Z][^>]*>/ },
  { label: 'bold or code markers', re: /\*\*|__|`/ },
  { label: 'markdown heading', re: /^\s{0,3}#{1,6}\s/m },
  { label: 'markdown list item', re: /^\s*[-*+]\s/m },
  { label: 'markdown image', re: /!\[/ },
];

const words = (s: string): string[] => (s.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').replace(/'/g, '').match(/[a-z0-9]+/g) ?? []);

/** Six-word runs of `text` that also occur in `plot`. */
export function plotOverlap(text: string, plot: string | null, n = 6): string[] {
  if (!plot) return [];
  const plotWords = words(plot);
  const grams = new Set<string>();
  for (let i = 0; i + n <= plotWords.length; i++) grams.add(plotWords.slice(i, i + n).join(' '));
  const t = words(wordingText(text).replace(/\bT\b/g, ' '));
  const hits: string[] = [];
  for (let i = 0; i + n <= t.length; i++) {
    const g = t.slice(i, i + n).join(' ');
    if (grams.has(g)) hits.push(g);
  }
  return hits;
}

/** Words that carry no content for the plot-echo rule (function words and generic film words). */
const ECHO_STOP = new Set(
  ('a an the and or but nor so yet of to in on at by for with from into onto over under about after before ' +
    'as than then that this these those who whom whose which what when where while it its it\'s he she they ' +
    'them his her their him we you your our is are was were be been being has have had do does did ' +
    'can could will would may might must shall should not no one two film movie story plot follows ' +
    'premise setup involves up out off again also just only very').split(' '),
);

const contentWords = (text: string, exclude: Set<string>): string[] =>
  words(text).filter((w) => w.length > 1 && !ECHO_STOP.has(w) && !exclude.has(w) && w !== 't');

function lcs(a: string[], b: string[]): string[] {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const out: string[] = [];
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) {
      out.push(a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return out;
}

/** Minimum content words a sentence may share with the plot, in plot order, before it counts as copied. */
export const PLOT_ECHO_MIN = 4;

/**
 * Catches a plot sentence copied with a word or two swapped ("a lighthouse keeper that finds a map"),
 * which breaks every six-word run: four or more plot content words, in plot order, inside one sentence.
 * Returns the echoed words, or null.
 */
export function plotEcho(text: string, plot: string | null, names: readonly string[] = []): string | null {
  if (!plot) return null;
  const titleWords = new Set(names.flatMap((n) => words(n)));
  const plotWords = contentWords(plot, titleWords);
  for (const sentence of splitSentences(maskTitles(stripTokens(text, ' '), names))) {
    const common = lcs(contentWords(sentence, titleWords), plotWords);
    if (common.length >= PLOT_ECHO_MIN) return common.join(' ');
  }
  return null;
}

const EVIDENCE: { label: string; test: (raw: string, awards: string | null) => boolean }[] = [
  { label: 'Metascore vs RT ({{metascore}})', test: (t) => /\{\{\s*metascore\s*\}\}/.test(t) },
  { label: 'vote volume ({{votes}} or {{votesShort}})', test: (t) => /\{\{\s*votes(?:Short)?\s*\}\}/.test(t) },
  { label: 'genre median gap ({{genreMedianGap}})', test: (t) => /\{\{\s*genreMedianGap\s*\}\}/.test(t) },
  { label: 'gap rank ({{gapRank}})', test: (t) => /\{\{\s*gapRank\s*\}\}/.test(t) },
  // awards count only as the OMDb Awards text quoted verbatim (an invented award must not satisfy the rule)
  { label: 'the OMDb awards text, quoted exactly', test: (t, awards) => awards !== null && quotesVerbatim(t, awards) },
  { label: 'a cited reception fact ({{cite:id}})', test: (t) => /\{\{\s*cite:/.test(t) },
];

const CONDITIONAL = /\b(?:if|when|whether|anyone who|those who|for (?:anyone|viewers|people|readers|those))\b/i;

/**
 * Lint every authored string of an article. Findings use these rule ids:
 * forbidden-char, banned-phrase, forbidden-word, forbidden-claim, tier-word,
 * score-literal, number-literal, must-cite, markup, plot-overlap, cannibalise,
 * why-split, who-it-suits.
 */
export function lintCopy(article: Article, ctx: LintContext): Issue[] {
  const out: Issue[] = [];
  const strings = allStrings(article);
  const names = filmNames(ctx.film.omdb.title, article.shortTitle);
  const awards = ctx.film.omdb.awards;

  for (const s of strings) out.push(...forbiddenChars(s.text, s.where));

  const tierRules = tierNeverRules(ctx.stats.tier, ctx.stats.gapRank);
  for (const s of strings.filter((x) => isProsePath(x.where))) {
    // The film's own name never trips a wording rule ("I Care a Lot", "Leave the World Behind").
    const masked = maskTitles(s.text, names);
    const worded = allowCitedAwardNames(masked);
    for (const label of matchRules(worded, BANNED_PHRASES)) out.push(issue('banned-phrase', `banned phrase "${label}"`, s.where));
    for (const label of matchRules(worded, ALWAYS_FORBIDDEN)) out.push(issue('forbidden-word', `forbidden word "${label}"`, s.where));
    for (const label of matchRules(worded, FORBIDDEN_CLAIMS)) out.push(issue('forbidden-claim', `forbidden claim "${label}"`, s.where));
    for (const label of matchRules(withoutTierExemptions(worded), tierRules)) {
      out.push(issue('tier-word', `"${label}" is not allowed for a ${ctx.stats.tier} gap (abs gap ${ctx.stats.absGap})`, s.where));
    }
    const plain = wordingText(masked);
    for (const l of SCORE_LITERALS) {
      if (l.re.test(plain)) out.push(issue('score-literal', `${l.label}: numbers must come from tokens`, s.where));
    }
    if (isBodyPath(s.where)) {
      const stray = strayNumbers(s.text, { names, awards });
      if (stray.length) {
        out.push(issue('number-literal', `digits in prose ("${stray[0]}"): every number must be a token (years, "Top 10" and rating codes excepted)`, s.where));
      }
      for (const claim of uncitedClaims(s.text, { names, awards })) {
        out.push(issue('must-cite', `needs {{cite:id}} on the same sentence (or restate the OMDb Awards text exactly): ${claim}`, s.where));
      }
      const echo = plotEcho(s.text, ctx.film.omdb.plot, names);
      if (echo) out.push(issue('plot-overlap', `follows the OMDb plot word for word with small changes: "${echo}"`, s.where));
    }
    for (const m of MARKUP) if (m.re.test(s.text)) out.push(issue('markup', `${m.label} is not allowed (plain text, tokens and [anchor](/path) links only)`, s.where));
    const overlap = plotOverlap(s.text, ctx.film.omdb.plot);
    if (overlap.length) out.push(issue('plot-overlap', `copies a six-word run from the OMDb plot: "${overlap[0]}"`, s.where));
  }

  // cannibalisation: no bare comparison phrase without the film name in h1 or description
  for (const field of ['h1', 'description'] as const) {
    const text = article[field];
    if (/imdb vs\.? rotten tomatoes/i.test(text) && !namesFilm(text, names) && !/\{\{\s*title\s*\}\}/.test(text)) {
      out.push(issue('cannibalise', `${field} uses "IMDb vs Rotten Tomatoes" without the film name`, field));
    }
  }

  // section content rules (3.3)
  const why = article.sections.find((s) => s.id === 'why-split');
  if (why) {
    const raw = why.paragraphs.join('\n');
    const hits = EVIDENCE.filter((e) => e.test(raw, awards));
    if (hits.length < 2) {
      out.push(
        issue(
          'why-split',
          `needs at least two film-specific evidence fields (has ${hits.length}); choose from: ${EVIDENCE.map((e) => e.label).join('; ')}`,
          'sections[why-split]',
        ),
      );
    }
    if (!/\{\{\s*gap(?:Abs)?\s*\}\}/.test(raw)) {
      out.push(issue('why-split', 'must state the gap size with {{gapAbs}} or {{gap}}', 'sections[why-split]'));
    }
    for (const problem of directionProblems(why.paragraphs.join(' '), { ...ctx.stats, names })) {
      out.push(issue('why-split', problem, 'sections[why-split]'));
    }
  }
  const who = article.sections.find((s) => s.id === 'who-it-suits');
  if (who && !CONDITIONAL.test(who.paragraphs.join(' '))) {
    out.push(issue('who-it-suits', 'must take a conditional position ("if you ...", "when ...")', 'sections[who-it-suits]'));
  }
  return out;
}

/** The rendered display title must be free of banned glyphs (6.1: "rendered displayTitles"). */
export function lintDisplayTitle(film: Film): Issue[] {
  const t = displayTitle(film.omdb.title);
  return forbiddenChars(t, `${film.slug}.omdb.title`);
}
