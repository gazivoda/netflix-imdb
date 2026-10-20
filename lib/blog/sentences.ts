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
 * Split prose into sentences. A sentence ends at ".", "!" or "?" (optionally followed by
 * `{{cite:id}}` markers, which belong to the sentence they end) and then whitespace.
 * Call on masked text so a dotted title does not split.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?](?:\{\{[^{}]*\}\})*)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Mask the names, then split. */
export const maskedSentences = (text: string, names: readonly string[]): string[] => splitSentences(maskTitles(text, names));
