// Bootstraps the card index without typing: read the text on an unrecognised card, confirm it against
// the ratings catalogue, and hand back the title so the caller can enrol the card's artwork under it.
// A wrong label shows the wrong rating, so a candidate is only accepted when the catalogue's canonical
// title is nearly identical to what was read (OCR noise plus fuzzy search must not "find" a different film).

import type { Box } from '../card-tracker'
import { isUiText } from './title-candidates'
import type { CardReading, Evaluation, TitleDecision } from './title-confidence'

export interface AutoLabelDeps {
  /**
   * OCR candidates for one card, best first. A reader that also hands back the words of every OCR pass (a CardReading) enables the
   * confidence-aware decision below; a plain string[] keeps the original behaviour (try the candidates in order against the catalogue).
   */
  readTitles(box: Box): Promise<string[] | CardReading>
  /**
   * Decision layer over a CardReading (see title-confidence.ts): accept / suggest chips / reject. Without it every reading is decided
   * by the catalogue alone, as before. With it a vocabulary title is accepted without a lookup, and at most ONE lookup is made for a
   * reading the vocabulary does not know.
   */
  evaluate?(reading: CardReading): Evaluation
  /** A card that was read but not labelled: `suggest` carries one-tap chips, `reject` means "tap to type". */
  onOutcome?(item: { box: Box }, outcome: Exclude<TitleDecision, { kind: 'accept' }>): void
  /** Canonical catalogue title, or null if unknown. `voteCount` (IMDb votes, null when the catalogue has none) enables the minVotes guard. */
  lookup(title: string): Promise<{ title: string; voteCount?: number | null } | null>
  /**
   * Optional typo repair against a vocabulary of known titles ("Money Heis!" -> "Money Heist"). Runs BEFORE any lookup, so the
   * catalogue (a shared, daily-limited quota) is asked for exact titles instead of OCR noise. null = no confident repair.
   */
  repair?(candidate: string): string | null
}

export interface AutoLabelOptions {
  minGapMs: number // between two OCR attempts (OCR is the expensive step)
  retryMs: number // before re-reading the same screen position after a failed attempt; doubles with every further failure
  maxBackoffMs: number // the retry wait never grows beyond this
  /** A card that was labelled is looked at again after this long (the second identical answer is what makes a label permanent). */
  recheckMs: number
  /** An OCR read that has not answered after this long is abandoned (a terminated worker never answers) so the labeler is not wedged. */
  readTimeoutMs: number
  cell: number // distance (analysis px, or 40% of the card width when larger) within which two boxes are "the same card" across jittery frames
  minSimilarity: number // 0..1 between the OCR text and the catalogue title
  maxCandidates: number // OCR guesses tried per attempt (each is one catalogue lookup)
  /**
   * A catalogue hit with fewer IMDb votes is not accepted (only checked when the lookup reports voteCount). The catalogue knows a film
   * for almost every English word ("Dam", "Power", "Fang"), so a fragment of a title read off a tile "finds" an obscure film of that
   * name; what is on a TV tile is nearly always something people have rated. Measured against the real OMDb ?t= endpoint this
   * took wrong titles from 6.8% to 2.0% of tiles at no cost in correct ones.
   */
  minVotes: number
  /** How long a lookup answer (including "not found") is reused for the same string, so a card that stays unreadable does not re-ask every retry. */
  memoMs: number
  now: () => number
}

export const DEFAULT_AUTO_LABEL: AutoLabelOptions = {
  minGapMs: 1200,
  retryMs: 8000,
  maxBackoffMs: 60_000,
  recheckMs: 2500,
  readTimeoutMs: 20_000,
  cell: 48,
  minSimilarity: 0.8,
  maxCandidates: 4,
  minVotes: 20000,
  memoMs: 10 * 60_000,
  now: () => Date.now(),
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

// 1 = identical after dropping case, spaces and punctuation; Levenshtein ratio otherwise.
export function titleSimilarity(a: string, b: string): number {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return 0
  if (x === y) return 1
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j)
  for (let i = 1; i <= x.length; i++) {
    const cur = [i]
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length)
}

const wordsOf = (s: string): string[] => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
const numberWords = (s: string): string[] => wordsOf(s).filter(w => /^\d+$/.test(w))

const LEADING_ARTICLE = /^(the|a|an)\s+/i

// A title without its leading article, as compared by title lookups ("Gray Man" finds "The Gray Man" and means it).
const bare = (s: string) => norm(s.trim().replace(LEADING_ARTICLE, ''))

/**
 * Whether the catalogue's `canonical` title is really what `read` (OCR text) says. Accepts, in order:
 *  - the same title ignoring case, punctuation and a leading "The"/"A"/"An" (stylised logos often drop it, lookups restore it);
 *  - a near match: Levenshtein similarity >= minSimilarity (OCR slips), but NOT when both carry digits and they differ
 *    ("Fear Street 1994" vs "Fear Street 1978") or are a short word and a longer title;
 *  - a truncated title: the text is an exact leading part of the title, 12+ letters long and at least half of it (captions are cut
 *    with "..." on the TV: "All Quiet on the West" is "All Quiet on the Western Front").
 * A lone word that is only the start of a longer title ("Triple" vs "Triple Frontier") is never accepted.
 */
export function acceptsTitle(read: string, canonical: string, minSimilarity = DEFAULT_AUTO_LABEL.minSimilarity): boolean {
  const a = bare(read)
  const b = bare(canonical)
  if (!a || !b) return false
  if (a === b) return true
  const da = a.replace(/\D/g, '')
  const db = b.replace(/\D/g, '')
  if (da && db && da !== db) return false // different year / sequel number: a different film
  // A number that opens or closes the catalogue title ("Extraction 2", "3 Body Problem", "Fear Street ... 1994") must have been read:
  // a read that dropped it names the first film or another one. (A number inside a title, "Formula 1: Drive to Survive", may be lost.)
  const have = new Set(numberWords(read))
  const cw = wordsOf(canonical)
  if ([cw[0], cw[cw.length - 1]].some(w => /^\d+$/.test(w) && !have.has(w))) return false
  if (titleSimilarity(a, b) >= minSimilarity) return true
  return b.startsWith(a) && a.length >= 12 && a.length >= b.length / 2
}

const NUMBER_WORDS = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'part', 'chapter', 'ii', 'iii', 'iv'])

/** Whether `a` is the same words as the start of `b` and shorter ("Money" / "Money Heist"). */
function isWordPrefix(a: string, b: string): boolean {
  const aw = wordsOf(a)
  const bw = wordsOf(b)
  return aw.length > 0 && bw.length > aw.length && aw.every((w, i) => bw[i] === w)
}

/** Whether `a` is the same words as the end of `b` and shorter ("Heist" / "Money Heist"). */
function isWordSuffix(a: string, b: string): boolean {
  const aw = wordsOf(a)
  const bw = wordsOf(b)
  return aw.length > 0 && bw.length > aw.length && aw.every((w, i) => bw[bw.length - aw.length + i] === w)
}

// A word that can plausibly be English: 4+ letters with a vowel and no long consonant run. "THINGS" is one, "FLL" and "XKQZ" are not.
const wordlike = (w: string): boolean => w.length >= 4 && /[aeiouy]/.test(w) && !/[^aeiouy]{5,}/.test(w)

// "Money" is the start of "Money Heist", "Extraction" of "Extraction 2", "Rebel Moon" of "Rebel Moon - Part One": once a longer reading
// of the same card exists, the shorter one is a fragment, and a lookup would answer it with some other film of that name. The longer
// reading is tried first; the prefix is only a fallback, and never when it is a single word or when the words it leaves out include a
// number ("2", "1994", "Part One") - a dropped sequel number names the wrong film.
// A lone word at either end of a longer reading ("Heist" in "Money Heist", "Stranger" in "Stranger Things") is a fragment whenever the
// rest looks like real words; it survives only against junk ("OZARK FLL"), where the vocabulary knowing it is the better evidence.
function droppedByLonger(c: Prepared, others: Prepared[]): boolean {
  return others.some(o => {
    const prefix = isWordPrefix(c.raw, o.raw) || isWordPrefix(c.text, o.text)
    const single = wordsOf(c.raw).length === 1
    const suffix = single && isWordSuffix(c.raw, o.raw)
    if (!prefix && !suffix) return false
    const cw = wordsOf(c.raw)
    const rest = wordsOf(o.raw).filter((w, i, all) => !(prefix ? i < cw.length : i >= all.length - cw.length))
    if (prefix && rest.some(w => /^\d+$/.test(w) || NUMBER_WORDS.has(w))) return true
    if (!single) return false
    return !(c.known && !o.known) || rest.some(wordlike)
  })
}

interface Prepared { text: string; raw: string; repaired: boolean; known: boolean }

/** One screen position the labeler has worked on: how often it was tried and when it may be tried again. */
interface Cell { cx: number; cy: number; w: number; attempts: number; nextAt: number; seenAt: number }

const MAX_CELLS = 96

export class AutoLabeler {
  private busy = false
  private gen = 0 // bumped by reset(): an attempt that started before it must not touch the labeler any more
  private lastAttempt = -Infinity
  private cells: Cell[] = []
  private memo = new Map<string, { at: number; hit: { title: string; voteCount?: number | null } | null }>()
  private o: AutoLabelOptions

  constructor(private deps: AutoLabelDeps, opts: Partial<AutoLabelOptions> = {}) {
    this.o = { ...DEFAULT_AUTO_LABEL, ...opts }
  }

  // "The same card" across jittery frames: a record whose centre is within `cell` px (or 40% of the card's width) of this box.
  private cellFor(box: Box, create: boolean): Cell | null {
    const cx = box.x + box.w / 2
    const cy = box.y + box.h / 2
    const reach = Math.max(this.o.cell, 0.4 * box.w)
    let best: Cell | null = null
    let bestD = Infinity
    for (const c of this.cells) {
      const d = Math.hypot(c.cx - cx, c.cy - cy)
      if (d <= reach && d < bestD) { best = c; bestD = d }
    }
    if (best) {
      best.cx = cx
      best.cy = cy
      best.w = box.w
      best.seenAt = this.o.now()
      return best
    }
    if (!create) return null
    if (this.cells.length >= MAX_CELLS) this.cells.sort((a, b) => b.seenAt - a.seenAt).length = MAX_CELLS - 1
    const fresh: Cell = { cx, cy, w: box.w, attempts: 0, nextAt: 0, seenAt: this.o.now() }
    this.cells.push(fresh)
    return fresh
  }

  // OCR guesses -> what is worth a lookup, in order: chrome and fragments removed, vocabulary repairs first (they are exact titles).
  private prepare(raws: string[]): Prepared[] {
    const seen = new Set<string>()
    const all: Prepared[] = []
    for (const raw of raws) {
      const original = raw.trim()
      if (norm(original).length < 3 || isUiText(original)) continue
      const fixed = this.deps.repair?.(original) ?? null
      const use = fixed ?? original
      const k = norm(use)
      if (k.length < 3 || seen.has(k)) continue
      seen.add(k)
      all.push({ text: use, raw: original, repaired: fixed !== null && norm(fixed) !== norm(original), known: fixed !== null })
    }
    const kept = all.filter((c, i) => !droppedByLonger(c, all.filter((_, j) => j !== i)))
    const ordered = [...kept.filter(c => c.repaired), ...kept.filter(c => !c.repaired)]
    // a longer reading goes in front of the shorter prefix of it
    const out: Prepared[] = []
    for (const c of ordered) {
      const at = out.findIndex(r => isWordPrefix(r.text, c.text))
      if (at >= 0) out.splice(at, 0, c)
      else out.push(c)
    }
    return out
  }

  private async cachedLookup(title: string): Promise<{ title: string; voteCount?: number | null } | null> {
    const k = norm(title)
    const t = this.o.now()
    const memo = this.memo.get(k)
    if (memo && t - memo.at < this.o.memoMs) return memo.hit
    const hit = await this.deps.lookup(title) // a throwing lookup is not remembered: the service may be back on the next try
    if (this.memo.size >= 200) this.memo.delete(this.memo.keys().next().value as string)
    this.memo.set(k, { at: t, hit })
    return hit
  }

  private verified(candidate: string, hit: { title: string; voteCount?: number | null } | null): hit is { title: string; voteCount?: number | null } {
    if (!hit || !acceptsTitle(candidate, hit.title, this.o.minSimilarity)) return false
    return !(hit.voteCount !== undefined && (hit.voteCount ?? 0) < this.o.minVotes)
  }

  /**
   * A reading -> a decision, without any of the scheduling of next(): the vocabulary first (no lookup), then ONE catalogue lookup for
   * a reading the vocabulary does not know. A reader without word boxes (a plain string[]) is decided by the catalogue alone: the
   * candidates in order, the first verified one wins.
   */
  async decide(reading: string[] | CardReading): Promise<TitleDecision> {
    const cardReading: CardReading = Array.isArray(reading) ? { candidates: reading } : reading
    if (this.deps.evaluate && cardReading.passes?.length) {
      const ev = this.deps.evaluate(cardReading)
      const lk = ev.decision.kind !== 'accept' ? ev.lookups[0] : undefined
      if (lk) {
        const hit = await this.cachedLookup(lk.text)
        if (this.verified(lk.text, hit)) return ev.judge(lk, hit.title)
      }
      return ev.decision
    }
    for (const { text: candidate } of this.prepare(cardReading.candidates).slice(0, this.o.maxCandidates)) {
      const hit = await this.cachedLookup(candidate)
      if (this.verified(candidate, hit)) return { kind: 'accept', title: hit.title, source: 'lookup' }
    }
    return { kind: 'reject', reason: cardReading.candidates.length ? 'weak' : 'no-text' }
  }

  // Tries at most one unrecognised card per call: the one that has been tried the fewest times (so cards that cannot be read
  // never hold up the rest), the largest of those first (the clearest text). A card that fails waits retryMs, then twice that, and so on.
  // Returns the card that was labelled, or null when nothing was attempted or nothing verified.
  async next<T extends { box: Box }>(unknown: T[]): Promise<{ item: T; title: string } | null> {
    const t = this.o.now()
    if (this.busy || t - this.lastAttempt < this.o.minGapMs) return null

    let item: T | null = null
    let cell: Cell | null = null
    for (const u of unknown) {
      const c = this.cellFor(u.box, true)!
      if (c.nextAt > t) continue
      const better = !cell || c.attempts < cell.attempts || (c.attempts === cell.attempts && u.box.w * u.box.h > item!.box.w * item!.box.h)
      if (better) { item = u; cell = c }
    }
    if (!item || !cell) return null

    const gen = this.gen
    this.busy = true
    this.lastAttempt = t
    cell.attempts++
    // set up front: a throwing OCR must not retry every frame
    cell.nextAt = t + Math.min(this.o.maxBackoffMs, this.o.retryMs * 2 ** Math.min(cell.attempts - 1, 10))
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const timedOut = new Promise<'timeout'>(resolve => { timer = setTimeout(() => resolve('timeout'), this.o.readTimeoutMs) })
      const read = await Promise.race([this.deps.readTitles(item.box), timedOut])
      if (read === 'timeout' || gen !== this.gen) return null
      const decision = await this.decide(read)
      if (gen !== this.gen) return null
      if (decision.kind === 'accept') {
        cell.nextAt = this.o.now() + this.o.recheckMs
        return { item, title: decision.title }
      }
      if (this.deps.evaluate) this.deps.onOutcome?.(item, decision)
      return null
    } catch {
      return null
    } finally {
      clearTimeout(timer)
      if (gen === this.gen) this.busy = false
    }
  }

  /** Forgets everything about screen positions and frees the labeler (call it when the text reader is replaced or stopped). */
  reset(): void {
    this.cells = []
    this.lastAttempt = -Infinity
    this.busy = false
    this.gen++
  }
}
