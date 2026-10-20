// Pure helpers for article prose. Tokens are rendered first (lib/blog/tokens);
// what is left is plain text plus internal markdown links `[anchor](/path)` and
// citation markers `[n]` produced by `{{cite:id}}`.

export type ProseNode =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'cite'; n: number };

const LINK_OR_CITE = /\[([^\]]+)\]\((\/[^)\s]*)\)|\[(\d{1,2})\]/g;

/** Split rendered prose into text, internal links and citation markers. */
export function parseProse(rendered: string): ProseNode[] {
  const out: ProseNode[] = [];
  let last = 0;
  for (const m of rendered.matchAll(LINK_OR_CITE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: 'text', text: rendered.slice(last, at) });
    if (m[3] !== undefined) out.push({ kind: 'cite', n: Number(m[3]) });
    else out.push({ kind: 'link', text: m[1], href: m[2] });
    last = at + m[0].length;
  }
  if (last < rendered.length) out.push({ kind: 'text', text: rendered.slice(last) });
  return out;
}

/** Text with links reduced to their anchor text (FAQ plain-text answers, word counts). */
export const plainText = (rendered: string): string =>
  parseProse(rendered)
    .map((n) => (n.kind === 'text' ? n.text : n.kind === 'link' ? n.text : `[${n.n}]`))
    .join('');

const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'jr', 'sr', 'vs', 'no']);

/**
 * Split off the first sentence (the answer) so the page can emphasise it.
 * Boundaries inside `[...]` and after common abbreviations are skipped.
 */
export function splitFirstSentence(text: string): [string, string] {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[') depth++;
    else if (ch === ']') depth = Math.max(0, depth - 1);
    else if (depth === 0 && (ch === '.' || ch === '!' || ch === '?') && /\s/.test(text[i + 1] ?? '')) {
      const word = /([A-Za-z]+)$/.exec(text.slice(0, i))?.[1]?.toLowerCase();
      if (ch === '.' && word && ABBREVIATIONS.has(word)) continue;
      return [text.slice(0, i + 1), text.slice(i + 1).trimStart()];
    }
  }
  return [text, ''];
}

/** Whitespace-separated words of the visible text (links reduced to anchor text). */
export const countRenderedWords = (...rendered: string[]): number =>
  rendered.reduce((n, t) => n + (plainText(t).match(/\S+/g)?.length ?? 0), 0);
