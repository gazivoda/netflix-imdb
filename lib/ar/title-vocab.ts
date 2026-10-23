// Snaps OCR fragments onto a list of known titles. A logo read as "VIRGIN" on one pass and "RIVER" on another, or "Hurter Kier",
// is useless to an exact-title lookup (OMDb ?t= tolerates a missing "The" and a leading run of words, not typos), but it points
// at exactly one entry of a vocabulary of popular titles. Everything is guarded to keep wrong titles out:
//  - a vocabulary title needs >= 60% of its letters matched by words that are individually close (typo budget per word),
//  - one-word titles need two passes to agree; short ones ("YOU", "DARK", "BEEF") must also be printed BIG, spelled exactly and read
//    confidently: small print and logo fragments are full of them,
//  - the closest title must clearly beat the runner-up.
// Pure; the vocabulary is injected (lib/ar/popular-titles.ts plus whatever the ratings API has confirmed on this device).

import { titleSimilarity } from './auto-label'
import { isUiText, type OcrWordLike } from './title-candidates'

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
const ARTICLE = /^(the|a|an)\s+/i
// A title as compared by lookups: no leading article, only letters and digits ("The Crown" and "Crown!" are the same entry).
const bareKey = (s: string) => key(s.trim().replace(ARTICLE, ''))
const numberTokens = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => /^\d+$/.test(w))
// Typos a string of this many letters may carry and still count as the same title: none for short ones (every short word is a
// word), one for 5-7 letters, two up to 16, three beyond that. One slip is "Money Heis!", two is a smeared letter pair.
const editBudget = (len: number) => (len <= 4 ? 0 : len <= 7 ? 1 : len <= 16 ? 2 : 3)
const REPAIR_PREFIX_MIN = 12 // a cut-off caption ("All Quiet on the West") needs this many letters to point at one title
const words = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}']+/u).map(w => key(w)).filter(Boolean)

const UI_TOKEN_MAX_HEIGHT = 0.07 // fraction of the image height

/** Words of one OCR pass as vocabulary tokens (glyph junk is cleaned by the key; sizes are relative to the image). */
export function tokensFromWords(ws: OcrWordLike[], imageHeight: number, pass = 0): VocabToken[] {
  const out: VocabToken[] = []
  for (const w of ws) {
    const k = key(w.text)
    const height = imageHeight > 0 ? (w.bbox.y1 - w.bbox.y0) / imageHeight : 1
    // A lone digit is the sequel number of "DESPICABLE ME 2": kept when it is sure and not small print ("Season 2" badges are small).
    const sequelDigit = /^\d$/.test(k) && w.confidence >= 60 && height >= 0.05
    if ((k.length < 2 && !sequelDigit) || w.confidence < 25) continue
    if (height < UI_TOKEN_MAX_HEIGHT && isUiText(w.text)) continue // small "TOP" / "NEW" / "MATCH" badges are not title words
    out.push({ text: k, confidence: w.confidence, height, pass })
  }
  return out
}

interface Entry { title: string; tokens: string[]; content: string[]; letters: number; bare: string; spaced: string; spacedBare: string }

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
      const spaced = title.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim()
      entries.push({ title, tokens, content, letters: content.reduce((a, t) => a + t.length, 0), bare: bareKey(title), spaced, spacedBare: spaced.replace(ARTICLE, '') })
    }
  }
  add(titles)

  return {
    get size() { return entries.length },
    add,
    /** Every title in the vocabulary, in the order they were added. */
    titles(): string[] { return entries.map(e => e.title) },
    /**
     * Titles to offer while a title is being typed, best first: (0) the title, or the title without its article, starts with the
     * text; (1) every typed word starts a title word, in order; (2) the text is inside the title (3+ letters); (3) one slip against
     * the same-length start of the title (4+ letters). Ties: titles in `recent` (most recent first), then the shorter title.
     */
    suggest(text: string, max = 5, recent: string[] = []): string[] {
      const q = text.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim()
      if (q.length < 2) return []
      const qb = q.replace(ARTICLE, '')
      const qk = qb.replace(/ /g, '')
      if (qk.length < 1) return []
      const qw = q.split(' ')
      const hits: { e: Entry; tier: number; recency: number }[] = []
      for (const e of entries) {
        let tier = 9
        if (e.spaced.startsWith(q) || e.spacedBare.startsWith(qb) || e.bare.startsWith(qk)) tier = 0
        else {
          let i = 0
          const inOrder = qw.every(w => {
            while (i < e.tokens.length && !e.tokens[i].startsWith(w)) i++
            return i < e.tokens.length && ++i > 0
          })
          if (inOrder) tier = 1
          else if (qk.length >= 3 && e.bare.includes(qk)) tier = 2
          else if (qk.length >= 4 && Math.round((1 - titleSimilarity(qk, e.bare.slice(0, qk.length))) * qk.length) <= 1) tier = 3
        }
        if (tier < 9) {
          const at = recent.findIndex(r => key(r) === key(e.title))
          hits.push({ e, tier, recency: at >= 0 ? at : 1e6 })
        }
      }
      hits.sort((a, b) => a.tier - b.tier || a.recency - b.recency || a.e.title.length - b.e.title.length)
      return hits.slice(0, max).map(h => h.e.title)
    },
    /**
     * Snaps ONE string (a whole OCR candidate such as "Money Heis!") onto the vocabulary title it is a typo of, or returns null.
     * Strict on purpose, because the answer goes straight to the ratings lookup: a title of <= 4 letters must match exactly, longer ones
     * may carry a few slips (see editBudget), the numbers in it must be the same ("Extraction" is not "Extraction 2"), a title that is
     * only the start of a longer one is not repaired unless it is a long cut-off caption, and a tie between two different titles
     * repairs nothing.
     */
    repair(text: string): string | null {
      const k = bareKey(text)
      if (k.length < 3) return null
      const nums = numberTokens(text).join(',')
      const budget = editBudget(k.length)
      let best: { title: string; dist: number } | null = null
      let tie = false
      const sameNumbers = (e: Entry) => numberTokens(e.title).join(',') === nums
      for (const e of entries) {
        if (!sameNumbers(e)) continue
        if (e.bare === k) return e.title
        if (!budget || Math.abs(k.length - e.bare.length) > budget) continue
        const dist = Math.round((1 - titleSimilarity(k, e.bare)) * Math.max(k.length, e.bare.length))
        if (dist > budget) continue
        if (!best || dist < best.dist) { best = { title: e.title, dist }; tie = false }
        else if (dist === best.dist && key(e.title) !== key(best.title)) tie = true
      }
      if (best) return tie ? null : best.title
      if (k.length >= REPAIR_PREFIX_MIN) {
        const longer = entries.filter(e => sameNumbers(e) && e.bare.startsWith(k) && 2 * k.length >= e.bare.length)
        if (longer.length === 1) return longer[0].title
      }
      return null
    },
    /** Vocabulary titles the tokens point at, best first (at most `max`). `only` restricts the search to the titles it accepts. */
    match(tokens: VocabToken[], max = 3, only?: (title: string) => boolean): VocabMatch[] {
      if (!tokens.length) return []
      const results: (VocabMatch & { entry: Entry })[] = []
      for (const e of entries) {
        if (only && !only(e.title)) continue
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
          // a number or initial ("2", "E", "1994") must be seen exactly, or it is another title ("Fear Street ... 1978" is not "... 1994")
          if (!best && (want.length <= 2 || /^\d+$/.test(want))) missedShort = true
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
        // A one-word title is not it when the tile carries another word of the same size that the title does not have: "STRANGER THINGS"
        // is not "The Stranger", "MONEY HEIST" is not "Heist". (Small print, junk and the title's own words do not count.)
        if (single) {
          const own = new Set(e.tokens)
          const other = tokens.some(t => t.text.length >= 3 && !own.has(t.text) && wordSimilarity(e.content[0], t.text) === 0 && t.confidence >= 50 && t.height >= 0.6 * meanSize)
          if (other) continue
        }
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
