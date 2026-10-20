// Bootstraps the card index without typing: read the text on an unrecognised card, confirm it against
// the ratings catalogue, and hand back the title so the caller can enrol the card's artwork under it.
// A wrong label shows the wrong rating, so a candidate is only accepted when the catalogue's canonical
// title is nearly identical to what was read (OCR noise plus fuzzy search must not "find" a different film).

import type { Box } from '../card-tracker'

export interface AutoLabelDeps {
  readTitles(box: Box): Promise<string[]> // OCR candidates for one card, best first
  /** Canonical catalogue title, or null if unknown. `voteCount` (IMDb votes, null when the catalogue has none) enables the minVotes guard. */
  lookup(title: string): Promise<{ title: string; voteCount?: number | null } | null>
}

export interface AutoLabelOptions {
  minGapMs: number // between two OCR attempts (OCR is the expensive step)
  retryMs: number // before re-reading the same screen position after a failed attempt
  cell: number // position quantum (analysis px) that identifies "the same card" across jittery frames
  minSimilarity: number // 0..1 between the OCR text and the catalogue title
  maxCandidates: number // OCR guesses tried per attempt (each is one catalogue lookup)
  /**
   * A catalogue hit with fewer IMDb votes is not accepted (only checked when the lookup reports voteCount). The catalogue knows a film
   * for almost every English word ("Dam", "Power", "Fang"), so a fragment of a title read off a tile "finds" an obscure film of that
   * name; what is on a TV tile is nearly always something people have rated. Measured against the real OMDb ?t= endpoint this
   * took wrong titles from 6.8% to 2.0% of tiles at no cost in correct ones.
   */
  minVotes: number
  now: () => number
}

export const DEFAULT_AUTO_LABEL: AutoLabelOptions = {
  minGapMs: 1200,
  retryMs: 8000,
  cell: 48,
  minSimilarity: 0.8,
  maxCandidates: 4,
  minVotes: 20000,
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
  if (titleSimilarity(a, b) >= minSimilarity) return true
  return b.startsWith(a) && a.length >= 12 && a.length >= b.length / 2
}

export class AutoLabeler {
  private busy = false
  private lastAttempt = -Infinity
  private cooldown = new Map<string, number>() // cell key -> time it may be tried again
  private o: AutoLabelOptions

  constructor(private deps: AutoLabelDeps, opts: Partial<AutoLabelOptions> = {}) {
    this.o = { ...DEFAULT_AUTO_LABEL, ...opts }
  }

  private key(box: Box): string {
    const q = this.o.cell
    return `${Math.round((box.x + box.w / 2) / q)}:${Math.round((box.y + box.h / 2) / q)}`
  }

  // Tries at most one unrecognised card per call (largest first, so the clearest text goes first).
  // Returns the card that was labelled, or null when nothing was attempted or nothing verified.
  async next<T extends { box: Box }>(unknown: T[]): Promise<{ item: T; title: string } | null> {
    const t = this.o.now()
    if (this.busy || t - this.lastAttempt < this.o.minGapMs) return null

    const item = [...unknown]
      .sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)
      .find(u => (this.cooldown.get(this.key(u.box)) ?? 0) <= t)
    if (!item) return null

    this.busy = true
    this.lastAttempt = t
    this.cooldown.set(this.key(item.box), t + this.o.retryMs) // set up front: a throwing OCR must not retry every frame
    try {
      const seen = new Set<string>()
      for (const raw of (await this.deps.readTitles(item.box)).slice(0, this.o.maxCandidates)) {
        const candidate = raw.trim()
        if (norm(candidate).length < 3 || seen.has(norm(candidate))) continue
        seen.add(norm(candidate))
        const hit = await this.deps.lookup(candidate)
        if (!hit || !acceptsTitle(candidate, hit.title, this.o.minSimilarity)) continue
        if (hit.voteCount !== undefined && (hit.voteCount ?? 0) < this.o.minVotes) continue
        return { item, title: hit.title }
      }
      return null
    } catch {
      return null
    } finally {
      this.busy = false
    }
  }

  reset(): void {
    this.cooldown.clear()
    this.lastAttempt = -Infinity
  }
}
