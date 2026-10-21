// Sentence splitting with the film's name masked (spec 3.1 summary rule, 6.1 copy lint).
// Shared by the schema checks and the copy lint so every per-sentence rule agrees on
// what a sentence is: a dotted title such as "Mr. Harrigan's Phone", "K.O." or
// "The Super Mario Bros. Movie" must not end a sentence, and a title such as
// "Leave the World Behind" or "I Care a Lot" must not trip the direction, digit,
// pronoun or quote rules. Pure functions, no I/O.

import { displayTitle } from './format';

/** Stands in for the film's name. No digits, dots, quotes, subjects or comparatives. */
export const TITLE_MASK = 'Filmtitle';

/** Curly single quotes and the modifier apostrophe become "'" (names and prose compare equal). */
export const normalizeApostrophes = (s: string): string => s.replace(/[‘’ʼ]/g, "'");

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The names an article may use for its film: display title and shortTitle, longest first. */
export function filmNames(omdbTitle: string, shortTitle?: string): string[] {
  const names = [displayTitle(omdbTitle), shortTitle ? displayTitle(shortTitle) : '']
    .map((n) => normalizeApostrophes(n).trim())
    .filter(Boolean);
  return [...new Set(names)].sort((a, b) => b.length - a.length);
}

/**
 * Replace every occurrence of the film's names (case-insensitive, apostrophes normalised)
 * and the `{{title}}` token with TITLE_MASK. Other tokens are left in place.
 */
export function maskTitles(text: string, names: readonly string[]): string {
  let out = normalizeApostrophes(text).replace(/\{\{\s*title\s*\}\}/g, TITLE_MASK);
  for (const n of [...names].sort((a, b) => b.length - a.length)) {
    if (!n) continue;
    out = out.replace(new RegExp(escapeRe(normalizeApostrophes(n)), 'gi'), TITLE_MASK);
  }
  return out;
}

/** True when `text` names the film (apostrophes normalised, case-insensitive). */
export const namesFilm = (text: string, names: readonly string[]): boolean => {
  const t = normalizeApostrophes(text).toLowerCase();
  return names.some((n) => n && t.includes(normalizeApostrophes(n).toLowerCase()));
};

/**
 * Case-insensitive, global regex for `quoted` as it may appear in prose: apostrophes normalised
 * and any run of whitespace in `quoted` matching any run of whitespace in the text. Used for text
 * that must be recognised verbatim (the OMDb Awards string).
 */
export const verbatimRegex = (quoted: string): RegExp =>
  new RegExp(escapeRe(normalizeApostrophes(quoted).trim()).replace(/\s+/g, '\\s+'), 'gi');

/**
 * Split prose into sentences. A sentence ends at ".", "!" or "?" (optionally followed by
 * `{{cite:id}}` markers, which belong to the sentence they end) and then whitespace.
 * Call on masked text so a dotted title does not split.
 *
 * `verbatim` lists strings that must never be cut, even though they contain ". " themselves
 * (the OMDb Awards text, for example "Won 2 Oscars. 112 wins & 52 nominations total"). Each
 * occurrence stays inside one sentence and is returned exactly as written.
 */
export function splitSentences(text: string, verbatim: readonly string[] = []): string[] {
  const spans = verbatim.map((v) => v.trim()).filter(Boolean);
  const kept: string[] = [];
  let t = spans.length ? normalizeApostrophes(text) : text;
  if (spans.length) {
    for (const span of spans) {
      t = t.replace(verbatimRegex(span), (m) => {
        kept.push(m);
        // a span that ends a sentence keeps its terminator outside the placeholder
        return /[.!?]$/.test(m) ? `PSPAN${kept.length - 1}E.` : `PSPAN${kept.length - 1}N`;
      });
    }
  }
  const parts = t
    .split(/(?<=[.!?](?:\{\{[^{}]*\}\})*)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return spans.length ? parts.map((s) => s.replace(/PSPAN(\d+)(?:E\.|N)/g, (_m, i: string) => kept[Number(i)])) : parts;
}

/** Mask the names, then split. */
export const maskedSentences = (text: string, names: readonly string[]): string[] => splitSentences(maskTitles(text, names));
