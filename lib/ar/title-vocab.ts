// Snaps OCR fragments onto a list of known titles. A logo read as "VIRGIN" on one pass and "RIVER" on another, or "Hurter Kier",
// is useless to an exact-title lookup (OMDb ?t= tolerates a missing "The" and a leading run of words, not typos), but it points
// at exactly one entry of a vocabulary of popular titles. Everything is guarded to keep wrong titles out:
//  - a vocabulary title needs >= 60% of its letters matched by words that are individually close (typo budget per word),
//  - one-word titles need two passes to agree; short ones ("YOU", "DARK", "BEEF") must also be printed BIG, spelled exactly and read
//    confidently: small print and logo fragments are full of them,
//  - the closest title must clearly beat the runner-up.
// Pure; the vocabulary is injected (lib/ar/popular-titles.ts plus whatever the ratings API has confirmed on this device).

import { titleSimilarity } from './auto-label'
import type { OcrWordLike } from './title-candidates'

export interface VocabToken {
  text: string
  confidence: number // 0..100
  height: number // word height as a fraction of the image it came from
  pass?: number // index of the OCR pass it came from (short titles need two passes to agree)
}

export interface VocabMatch {
  title: string
  /** 0..1 */
  score: number
  coverage: number
}

export interface VocabOptions {
  minCoverage: number // share of the title's (non-article) letters that must be matched
  minTokenSize: number // matched words must average this tall (fraction of the image height)
  minShortTokenSize: number // single-word titles of <= 5 letters: at least this tall
  margin: number // best score must exceed the runner-up by this factor (>1) unless they are the same title family
}

export const DEFAULT_VOCAB_OPTIONS: VocabOptions = { minCoverage: 0.6, minTokenSize: 0.05, minShortTokenSize: 0.1, margin: 1.08 }

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'to', 'on', 'for', 'at', 'is', 'it', 'by', 'with', 'my', 'i'])
const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}']+/u).map(w => key(w)).filter(Boolean)

/** Words of one OCR pass as vocabulary tokens (glyph junk is cleaned by the key; sizes are relative to the image). */
export function tokensFromWords(ws: OcrWordLike[], imageHeight: number, pass = 0): VocabToken[] {
  const out: VocabToken[] = []
  for (const w of ws) {
    const k = key(w.text)
    if (k.length < 2 || w.confidence < 25) continue
    out.push({ text: k, confidence: w.confidence, height: imageHeight > 0 ? (w.bbox.y1 - w.bbox.y0) / imageHeight : 1, pass })
  }
  return out
}

interface Entry { title: string; tokens: string[]; content: string[]; letters: number }

// How close an OCR word must be to a title word: exact for tiny words, one slip for short ones, ~25% for long ones. A word that
// is the start of the title word ("PROBL" for "problem") also counts when it is long enough to be unambiguous.
function wordSimilarity(want: string, got: string): number {
  if (want === got) return 1
  if (want.length <= 3 || got.length <= 2) return 0
  if (got.length >= 4 && want.length > got.length && want.startsWith(got) && got.length >= 0.6 * want.length) return 0.85
  const s = titleSimilarity(want, got)
  const need = want.length <= 5 ? 0.75 : want.length <= 7 ? 0.7 : 0.68
  return s >= need ? s : 0
}

export function createVocabulary(titles: string[], opts: Partial<VocabOptions> = {}) {
  const o = { ...DEFAULT_VOCAB_OPTIONS, ...opts }
  const entries: Entry[] = []
  const seen = new Set<string>()
  const add = (list: string[]) => {
    for (const title of list) {
      const k = key(title)
      if (!k || seen.has(k)) continue
      seen.add(k)
      const tokens = words(title)
      let content = tokens.filter(t => !STOP.has(t))
      if (!content.length) content = tokens
      entries.push({ title, tokens, content, letters: content.reduce((a, t) => a + t.length, 0) })
    }
  }
  add(titles)

  return {
    get size() { return entries.length },
    add,
    /** Vocabulary titles the tokens point at, best first (at most `max`). */
    match(tokens: VocabToken[], max = 3): VocabMatch[] {
      if (!tokens.length) return []
      const results: (VocabMatch & { entry: Entry })[] = []
      for (const e of entries) {
        let matched = 0
        let sim = 0
        let conf = 0
        let size = 0
        let hits = 0
        let missedShort = false
        for (const want of e.content) {
          let best: { s: number; t: VocabToken } | null = null
          for (const t of tokens) {
            const s = wordSimilarity(want, t.text)
            if (s > 0 && (!best || s * t.confidence > best.s * best.t.confidence)) best = { s, t }
          }
          if (!best && want.length <= 2) missedShort = true // a number or initial ("2", "E") must be seen, or it is another title
          if (best) { matched += want.length; sim += best.s * want.length; conf += best.t.confidence * want.length; size += best.t.height * want.length; hits++ }
        }
        if (!matched || missedShort) continue
        const coverage = matched / e.letters
        if (coverage < o.minCoverage) continue
        const meanSize = size / matched
        const single = e.content.length === 1
        const short = single && e.letters <= 5
        if (single) {
          // one-word titles are the easiest to hit by accident: two passes must agree, and short ones must be exact and sure
          const seenBy = tokens.filter(t => (short ? t.text === e.content[0] && t.confidence >= 75 : wordSimilarity(e.content[0], t.text) > 0))
          if (new Set(seenBy.map(t => t.pass ?? 0)).size < 2) continue
        }
        if (meanSize < (short ? o.minShortTokenSize : o.minTokenSize)) continue
        // one matched word is thin evidence for a multi-word title unless it carries almost all of it
        if (hits < 2 && e.content.length > 1 && coverage < 0.8) continue
        const quality = (sim / matched) * (conf / matched / 100)
        results.push({ title: e.title, score: Math.min(1, coverage * quality * (0.6 + 0.4 * Math.min(1, e.letters / 8))), coverage, entry: e })
      }
      results.sort((a, b) => b.score - a.score)
      if (results.length > 1 && results[0].score < o.margin * results[1].score) {
        // ambiguous: "Narcos" vs "Narcos: Mexico" is fine (one contains the other), two unrelated films are not
        const a = key(results[0].title)
        const b = key(results[1].title)
        if (!a.startsWith(b) && !b.startsWith(a)) return []
      }
      return results.slice(0, max).map(({ title, score, coverage }) => ({ title, score, coverage }))
    },
  }
}

export type Vocabulary = ReturnType<typeof createVocabulary>
