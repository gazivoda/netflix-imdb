// Turns the words of several OCR passes over ONE card into a three-way decision: accept a title, suggest up to three one-tap
// candidates, or reject ("tap to type"). Binary matching ("is there a catalogue title for this string?") silently labels a card
// "Enola Holmes" when the logo says "Enola Holmes 2" and then remembers the mistake; here a title is only accepted when it is the
// clear winner among the known titles, and everything doubtful becomes a question for the user.
//
// Evidence per known title E: the edit distance d between E and the closest reading of the card (every OCR pass contributes
// readings: its title candidates plus all title-sized words joined in reading order, digits included), how many passes agree
// (support), the OCR confidence, how far the runner-up trails (margin), and four guards that exist because the failures are
// systematic: a sequel number that is printed but not part of E, title-sized text E does not explain, a longer sibling title
// whose extra words may simply have been lost ("Money Heist" / "Money Heist: Korea"), and a one-word title that is also a word of
// other titles ("Dahmer"). Thresholds are one exported object per profile and were chosen on a seeded simulation
// (tests/lib/ar/title-confidence.test.ts), never on real captures: treat them as a safety margin, not a measured rate.
// Pure and DOM-free.

import { titleSimilarity } from './auto-label'
import { candidatesFromWords, cleanWord, isUiText, type OcrWordLike } from './title-candidates'
import { tokensFromWords, type VocabToken, type Vocabulary } from './title-vocab'

// ---------------------------------------------------------------- types

/** The words one OCR pass returned and the height in px of the image they are positioned in. */
export interface PassWords {
  words: OcrWordLike[]
  imageHeight: number
}

/** What reading one card produced: ranked title candidates, and (for the decision layer) the words of every pass. */
export interface CardReading {
  candidates: string[]
  passes?: PassWords[]
}

export interface TitleChip {
  title: string
  /** 'vocab': a known title the reading is close to. 'lookup': an exact catalogue hit that was not safe to accept on its own. */
  source: 'vocab' | 'lookup'
}

export type TitleDecision =
  | { kind: 'accept'; title: string; source: 'vocab' | 'lookup' }
  | { kind: 'suggest'; chips: TitleChip[] }
  | { kind: 'reject'; reason: 'no-text' | 'weak' }

/** A reading worth ONE exact catalogue lookup (the vocabulary does not know it, several passes saw it, it is not too short). */
export interface LookupReading {
  text: string
  key: string
  conf: number
  support: number
  words: number
  len: number
}

export interface EvalDiagnostics {
  top: string | null
  distance: number | null
  margin: number | null
  support: number | null
  confidence: number | null
  /** Why the top title was not accepted ('' when it was). */
  blockedBy: string
}

export interface Evaluation {
  decision: TitleDecision
  lookups: LookupReading[]
  /** The decision after the catalogue answered an exact lookup of `lookup`: accept it, or put it first among the chips. */
  judge(lookup: LookupReading, catalogueTitle: string): TitleDecision
  diagnostics: EvalDiagnostics
}

export interface ConfidenceProfile {
  /** Edit distance allowed for an accept, as a share of the title's letters (floor). */
  acceptTau: number
  acceptMargin: number
  acceptSupport: number
  acceptConf: number
  /** An exact read (d = 0) with at least this confidence needs only one pass. */
  exactConf: number
  /** Titles of this many letters or fewer must be exact, seen by 2+ passes and confident. */
  shortLen: number
  /** Edit distance between all title-sized text and the title may not exceed this. */
  bigDistanceMax: number
  /** 'block': never accept a title that has a longer sibling in the vocabulary. 'extraUnseen': allow it when none of the sibling's extra words was seen. */
  familyPolicy: 'block' | 'extraUnseen'
  wordSiblingBlock: boolean
  suggestTau: number
  suggestConf: number
  maxChips: number
  lookupConf: number
  lookupBigDistance: number
}

/** Family roots are blocked, so "Money Heist" is always a question. Wrong accepts 0.0% on the held-out simulation, fewer titles resolved without a tap. */
export const SAFE_CONFIDENCE: ConfidenceProfile = {
  acceptTau: 0.12, acceptMargin: 3, acceptSupport: 2, acceptConf: 50, exactConf: 75, shortLen: 5, bigDistanceMax: 3,
  familyPolicy: 'block', wordSiblingBlock: true, suggestTau: 0.35, suggestConf: 30, maxChips: 3, lookupConf: 70, lookupBigDistance: 2,
}

/**
 * Owner-delegated default: a family root ("Money Heist", "Narcos", "Fear Street") is accepted when all passes agree on it, the
 * confidence is high, it is at most one slip off and NONE of the longer sibling's extra words appears anywhere on the card.
 * A sibling whose subtitle was simply not read ("Money Heist: Korea" read as "Money Heist") is still wrong now and then: that is
 * the price, about 0.4% of tiles on the simulation, which is why a title is only made permanent on its second identical accept.
 */
export const BALANCED_CONFIDENCE: ConfidenceProfile = { ...SAFE_CONFIDENCE, familyPolicy: 'extraUnseen' }

export const DEFAULT_CONFIDENCE: ConfidenceProfile = BALANCED_CONFIDENCE

// ---------------------------------------------------------------- keys and distances

const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
const ARTICLE = /^(the|a|an)\s+/i
/** A title as compared here: no leading article, only letters and digits. */
export const bareKey = (s: string) => key(s.trim().replace(ARTICLE, ''))
const numsOf = (s: string) => (s.toLowerCase().match(/\d+/g) ?? []).join(',')
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'to', 'on', 'for', 'at', 'is', 'it', 'by', 'with', 'my', 'i'])
const wordsOf = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}']+/u).map(w => key(w)).filter(Boolean)

/** Levenshtein distance, giving up (returns maxd + 1) once it must exceed maxd. */
export function lev(a: string, b: string, maxd: number): number {
  const n = a.length
  const m = b.length
  if (Math.abs(n - m) > maxd) return maxd + 1
  let prev = new Array<number>(m + 1)
  for (let j = 0; j <= m; j++) prev[j] = j
  for (let i = 1; i <= n; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= m; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > maxd) return maxd + 1
    prev = cur
  }
  return prev[m]
}

// ---------------------------------------------------------------- known titles

export interface RankEntry {
  title: string
  key: string
  L: number
  nums: string
  words: string[]
  content: string[]
}

export function prepEntries(titles: string[]): RankEntry[] {
  return titles.map(title => {
    const k = bareKey(title)
    const words = wordsOf(title.trim().replace(ARTICLE, '')) // aligned with the key: no leading article
    const content = words.filter(w => !STOP.has(w))
    return { title, key: k, L: k.length, nums: numsOf(title), words, content: content.length ? content : words }
  })
}

/** The ranker's view of a vocabulary, rebuilt only when titles were added to it (a confirmed title grows it at runtime). */
export class TitleIndex {
  private built = -1
  private list: RankEntry[] = []
  private keys = new Set<string>()
  constructor(private vocab: Pick<Vocabulary, 'size' | 'titles'>) {}
  private sync() {
    if (this.built === this.vocab.size) return
    this.list = prepEntries(this.vocab.titles())
    this.keys = new Set(this.list.map(e => e.key))
    this.built = this.vocab.size
  }
  entries(): RankEntry[] { this.sync(); return this.list }
  has(title: string): boolean { this.sync(); return this.keys.has(bareKey(title)) }
}

// ---------------------------------------------------------------- readings and ranking

interface Reading { key: string; text: string; nums: string; conf: number; score: number; passes: Set<number> }

interface Ranked {
  title: string
  key: string
  L: number
  words: string[]
  d: number
  conf: number
  support: number
  numMismatch: boolean
  bigDe: number
}

interface Evidence {
  ranked: Ranked[]
  readings: Reading[]
  tokens: VocabToken[]
  bigNums: Map<string, number>
  bigKeys: string[]
  nPasses: number
}

const MIN_READING_KEY = 4
const MAX_READING_KEY = 40

function gatherEvidence(passes: PassWords[], entries: RankEntry[]): Evidence {
  const readings = new Map<string, Reading>()
  const tokens: VocabToken[] = []
  const numPasses = new Map<string, Set<number>>()
  const numConf = new Map<string, number>()
  const bigKeys: string[] = []
  const bump = (k: string, text: string, conf: number, score: number, p: number) => {
    const r = readings.get(k) ?? { key: k, text, nums: numsOf(text), conf: 0, score: 0, passes: new Set<number>() }
    r.conf = Math.max(r.conf, conf)
    r.score = Math.max(r.score, score)
    r.passes.add(p)
    readings.set(k, r)
  }
  passes.forEach(({ words, imageHeight }, p) => {
    for (const c of candidatesFromWords(words, { imageHeight })) {
      if (c.score < 0.12) continue
      const k = bareKey(c.text)
      if (k.length < MIN_READING_KEY || k.length > MAX_READING_KEY) continue
      bump(k, c.text, c.confidence, c.score, p)
    }
    tokens.push(...tokensFromWords(words, imageHeight, p))
    // Title-sized text read as plain lines, digits included: candidatesFromWords drops a lone digit beside a very short word, and
    // a sequel number is exactly what tells "Enola Holmes" from "Enola Holmes 2".
    const ws = words
      .map(w => ({ ...w, t: cleanWord(w.text), h: w.bbox.y1 - w.bbox.y0 }))
      .filter(w => w.t && w.confidence >= 30)
    const sizeRef = Math.max(0, ...ws.filter(w => (w.t.replace(/[^\p{L}]/gu, '').length >= 3 || /^\d{1,4}$/.test(w.t)) && w.confidence >= 40).map(w => w.h))
    const big = ws.filter(w => sizeRef > 0 && w.h >= 0.55 * sizeRef && !/^(TV-MA|N)$/i.test(w.t) && !isUiText(w.t))
    const lines: { cy: number; ws: typeof big }[] = []
    for (const w of [...big].sort((a, b) => a.bbox.y0 + a.bbox.y1 - (b.bbox.y0 + b.bbox.y1))) {
      const cy = (w.bbox.y0 + w.bbox.y1) / 2
      const line = lines.find(l => Math.abs(l.cy - cy) < 0.5 * w.h)
      if (line) line.ws.push(w)
      else lines.push({ cy, ws: [w] })
    }
    const sorted = lines.map(l => l.ws.sort((a, b) => a.bbox.x0 - b.bbox.x0))
    bigKeys.push(bareKey(sorted.flat().map(w => w.t).join(' ')))
    for (const w of big) {
      if (!/^\d{1,4}$/.test(w.t) || w.confidence < 60) continue
      numConf.set(w.t, Math.max(numConf.get(w.t) ?? 0, w.confidence))
      numPasses.set(w.t, (numPasses.get(w.t) ?? new Set()).add(p))
    }
    const addReading = (list: typeof big) => {
      const text = list.map(w => w.t).join(' ')
      const k = bareKey(text)
      if (k.length < MIN_READING_KEY || k.length > MAX_READING_KEY || isUiText(text)) return
      const conf = list.reduce((a, w) => a + w.confidence, 0) / list.length
      bump(k, text, conf, (conf / 100) * 0.8, p)
    }
    for (const l of sorted) addReading(l)
    if (sorted.length > 1) addReading(sorted.flat())
  })
  // A printed number counts against a title that lacks it only when it is a year-sized one or more than one pass saw it (a speck
  // of dust beside the logo is not a sequel number).
  const bigNums = new Map<string, number>()
  for (const [n, conf] of numConf) if (n.length >= 4 || (numPasses.get(n)?.size ?? 0) >= 2 || passes.length < 2) bigNums.set(n, conf)

  const rs = [...readings.values()]
  const ranked: Ranked[] = []
  for (const e of entries) {
    const maxd = Math.ceil(0.5 * e.L)
    let best: { d: number; conf: number; numMismatch: boolean } | null = null
    const dpass = new Array<number>(passes.length).fill(Infinity)
    for (const r of rs) {
      const lr = r.key.length
      if (Math.abs(lr - e.L) > maxd + 2 && !(lr < e.L && lr >= 6)) continue
      let d = lev(r.key, e.key, maxd)
      if (lr < e.L && lr >= 6) {
        // a cut-off caption: compare with the same-length start of the title, and pay for every missing letter
        const dp = lev(r.key, e.key.slice(0, lr), maxd) + 0.5 * (e.L - lr)
        if (dp < d) d = dp
      }
      if (d > maxd) continue
      const numMismatch = r.nums !== e.nums
      if (numMismatch) d += 3
      if (d > maxd + 3) continue
      for (const p of r.passes) if (d < dpass[p]) dpass[p] = d
      if (!best || d < best.d || (d === best.d && r.conf > best.conf)) best = { d, conf: r.conf, numMismatch }
    }
    if (!best) continue
    // a number printed title-sized that this title does not have ("ENOLA HOLMES" + "2" is not "Enola Holmes")
    const eNums = e.nums ? e.nums.split(',') : []
    if ([...bigNums.keys()].some(n => !eNums.includes(n))) best.d += 3
    // how much of the title-sized text the title leaves unexplained ("MONEY HEIST KOREA" is more "Money Heist: Korea")
    const bigDe = Math.min(9, ...bigKeys.filter(k => k.length >= 3).map(k => lev(k, e.key, 9)))
    const support = dpass.filter(x => x <= best!.d + 1).length
    ranked.push({ title: e.title, key: e.key, L: e.L, words: e.words, d: best.d, conf: best.conf, support, numMismatch: best.numMismatch, bigDe })
  }
  ranked.sort((a, b) => a.d + 0.25 * a.bigDe - (b.d + 0.25 * b.bigDe) || b.conf - a.conf || b.support - a.support)
  return { ranked: ranked.slice(0, 8), readings: rs, tokens, bigNums, bigKeys, nPasses: passes.length }
}

interface Features {
  top: Ranked
  margin: number
  shorterClose: boolean
  longerSibling: boolean
  siblings: { title: string; extraSeen: number; extraWords: number }[]
  wordSibling: boolean
  unexplained: number
  bigDistance: number
}

const family = (a: { key: string }, b: { key: string }) => a.key !== b.key && (a.key.startsWith(b.key) || b.key.startsWith(a.key))

function features(ev: Evidence, entries: RankEntry[]): Features | null {
  const r = ev.ranked
  if (!r.length) return null
  const top = r[0]
  const others = r.slice(1).filter(o => !family(top, o) && o.key !== top.key)
  // the lead is measured on the ranking key (distance plus a quarter of the title-sized text left unexplained), so a title whose
  // sub-run reads as another title exactly ("Glass Onion: A Knives Out Mystery" / "Knives Out") still has a lead
  const rankKey = (x: Ranked) => x.d + 0.25 * x.bigDe
  const margin = others.length ? rankKey(others[0]) - rankKey(top) : 99
  const sibs = r.slice(1).filter(o => family(top, o))
  // a SHORTER sibling that reads about as well ("Money Heist" for a card that says "... Korea") is only a competitor when the card has
  // no title-sized text of its own that the shorter title fails to explain
  const shorterClose = sibs.some(o => o.key.length < top.key.length && o.d - top.d < 2 && o.bigDe - top.bigDe < 3)
  // readable words of title size that the top title does not account for
  const tall = Math.max(0, ...ev.tokens.filter(t => t.text.length >= 3 && t.confidence >= 50).map(t => t.height))
  const topWords = new Set(top.words)
  const unexplained = new Set(
    ev.tokens
      .filter(t => tall > 0 && t.height >= 0.6 * tall && t.confidence >= 50 && t.text.length >= 3 && !STOP.has(t.text) && !top.key.includes(t.text) &&
        ![...topWords].some(w => w.includes(t.text) || t.text.includes(w) || titleSimilarity(w, t.text) >= 0.5))
      .map(t => t.text),
  ).size
  const topEntry = entries.find(e => e.title === top.title)
  const siblings: Features['siblings'] = []
  let wordSibling = false
  for (const e of entries) {
    if (e.key === top.key || !topEntry) continue
    if (e.key.startsWith(top.key)) {
      // the sibling's extra words, not counting "the"/"of": was any of them printed on this card? (short words must match exactly,
      // otherwise "on" is "found" inside "season")
      const rest = e.words.slice(topEntry.words.length).filter(w => !STOP.has(w))
      const isSeen = (w: string) => ev.tokens.some(t => t.text === w || (w.length >= 3 && t.text.length >= 3 && (t.text.includes(w) || w.includes(t.text) || titleSimilarity(w, t.text) >= 0.6)))
      const seen = rest.filter(isSeen).length
      siblings.push({ title: e.title, extraSeen: rest.length ? seen / rest.length : 0, extraWords: rest.length })
    } else if (topEntry.content.length === 1 && top.L >= 4 && e.content.length >= 2 && e.content.includes(topEntry.content[0])) {
      wordSibling = true
    }
  }
  const bigDistance = Math.min(99, ...ev.bigKeys.filter(k => k.length >= 3).map(k => lev(k, top.key, 99)))
  return { top, margin, shorterClose, longerSibling: siblings.length > 0, siblings: siblings.slice(0, 6), wordSibling, unexplained, bigDistance }
}

// ---------------------------------------------------------------- decision

function vocabularyAccept(f: Features, ev: Evidence, P: ConfidenceProfile): { ok: boolean; blockedBy: string } {
  const t = f.top
  const budget = Math.floor(P.acceptTau * t.L + 1e-9)
  if (t.d > budget) return { ok: false, blockedBy: 'too far from the title' }
  if (t.numMismatch || [...ev.bigNums.keys()].some(n => !(t.title.match(/\d+/g) ?? ([] as string[])).includes(n))) return { ok: false, blockedBy: 'number conflict' }
  if (!(t.L > P.shortLen || t.d === 0)) return { ok: false, blockedBy: 'short title not exact' }
  if (f.margin < (t.d === 0 ? Math.max(2, P.acceptMargin - 1) : P.acceptMargin)) return { ok: false, blockedBy: 'runner-up too close' }
  if (t.conf < P.acceptConf) return { ok: false, blockedBy: 'low confidence' }
  if (!(t.support >= P.acceptSupport || (t.d === 0 && t.conf >= P.exactConf))) return { ok: false, blockedBy: 'seen by one pass only' }
  if (t.L <= P.shortLen && !(t.support >= 2 && t.conf >= P.exactConf)) return { ok: false, blockedBy: 'short title needs two exact passes' }
  if (f.unexplained > 0) return { ok: false, blockedBy: 'unexplained title-sized text' }
  if (f.bigDistance > P.bigDistanceMax) return { ok: false, blockedBy: 'title-sized text differs' }
  if (f.longerSibling) {
    if (P.familyPolicy === 'block') return { ok: false, blockedBy: 'family root' }
    if (!(t.support >= 3 && t.conf >= P.exactConf && f.siblings.every(x => x.extraSeen === 0) && t.d <= 1)) return { ok: false, blockedBy: 'family root' }
  }
  if (P.wordSiblingBlock && f.wordSibling) return { ok: false, blockedBy: 'one-word title that is part of other titles' }
  if (!f.longerSibling && f.shorterClose) return { ok: false, blockedBy: 'shorter sibling too close' }
  return { ok: true, blockedBy: '' }
}

/** Titles the ranker cannot see (readings under four letters are dropped as noise): "You", "Us", "1899". The vocabulary matcher's own strict rules decide. */
const isShortTitle = (title: string): boolean => {
  const k = bareKey(title)
  return k.length < MIN_READING_KEY || /^\d+$/.test(k)
}

export interface EvaluateContext {
  vocabulary: Pick<Vocabulary, 'match' | 'size' | 'titles'>
  index: TitleIndex
  profile?: ConfidenceProfile
}

const NONE: EvalDiagnostics = { top: null, distance: null, margin: null, support: null, confidence: null, blockedBy: 'no text' }

export function evaluateReading(reading: CardReading, ctx: EvaluateContext): Evaluation {
  const P = ctx.profile ?? DEFAULT_CONFIDENCE
  const passes = reading.passes ?? []
  const entries = ctx.index.entries()
  const ev = gatherEvidence(passes, entries)
  const f = features(ev, entries)

  let accepted: string | null = null
  let blockedBy = ev.readings.length ? 'no known title is close' : 'no text'
  const chips: TitleChip[] = []
  if (f) {
    const verdict = vocabularyAccept(f, ev, P)
    blockedBy = verdict.blockedBy
    if (verdict.ok) accepted = f.top.title
    for (const c of ev.ranked) {
      const plausible = c.d <= P.suggestTau * c.L && c.conf >= P.suggestConf && (c.L >= 5 || (c.d === 0 && c.conf >= 60))
      if (plausible && chips.length < P.maxChips) chips.push({ title: c.title, source: 'vocab' })
    }
    // a family root whose subtitle may just not have been read: offer the siblings with it
    if (chips.some(c => c.title === f.top.title)) {
      for (const x of [...f.siblings].sort((a, b) => a.extraWords - b.extraWords)) {
        if (chips.length < P.maxChips && !chips.some(c => c.title === x.title)) chips.push({ title: x.title, source: 'vocab' })
      }
    }
  }
  if (!accepted && passes.length) {
    // "You", "Dark", "1899": too short for the ranker. The matcher accepts them only when two passes read them exactly, big and sure.
    const tokens = passes.flatMap((p, i) => tokensFromWords(p.words, p.imageHeight, i))
    const hit = ctx.vocabulary.match(tokens, 1, isShortTitle)[0]
    if (hit) {
      accepted = hit.title
      blockedBy = ''
    }
  }

  // Readings the vocabulary cannot explain are worth one exact catalogue lookup: seen by 2+ passes and long enough not to be a fragment.
  const lookups: LookupReading[] = ev.readings
    .filter(r => r.passes.size >= 2 && (r.key.length >= 8 || r.text.trim().split(/\s+/).length >= 2) && !ctx.index.has(r.text))
    .sort((a, b) => b.score - a.score)
    .map(r => ({ text: r.text, key: r.key, conf: r.conf, support: r.passes.size, words: r.text.trim().split(/\s+/).length, len: r.key.length }))

  const decision: TitleDecision = accepted
    ? { kind: 'accept', title: accepted, source: 'vocab' }
    : chips.length
      ? { kind: 'suggest', chips }
      : { kind: 'reject', reason: ev.readings.length ? 'weak' : 'no-text' }

  const judge = (lk: LookupReading, catalogueTitle: string): TitleDecision => {
    if (decision.kind === 'accept') return decision
    const inVocab = ctx.index.has(catalogueTitle)
    const titleNums: string[] = catalogueTitle.match(/\d+/g) ?? []
    const numConflict = [...ev.bigNums.keys()].some(n => !titleNums.includes(n))
    const catKey = bareKey(catalogueTitle)
    const bigD = Math.min(99, ...ev.bigKeys.filter(k => k.length >= 3).map(k => lev(k, catKey, 99)))
    if (!inVocab && !numConflict && bigD <= P.lookupBigDistance && lk.support >= 2 && lk.conf >= P.lookupConf && (lk.len >= 8 || lk.words >= 2)) {
      return { kind: 'accept', title: catalogueTitle, source: 'lookup' }
    }
    const rest = decision.kind === 'suggest' ? decision.chips.filter(c => bareKey(c.title) !== catKey) : []
    return { kind: 'suggest', chips: [{ title: catalogueTitle, source: 'lookup' as const }, ...rest].slice(0, P.maxChips) }
  }

  const diagnostics: EvalDiagnostics = f
    ? { top: f.top.title, distance: f.top.d, margin: f.margin >= 99 ? null : f.margin, support: f.top.support, confidence: Math.round(f.top.conf), blockedBy }
    : { ...NONE, blockedBy }
  return { decision, lookups, judge, diagnostics }
}
