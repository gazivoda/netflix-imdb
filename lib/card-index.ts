// Reference index of known cards and the accept/reject rule for a nearest-neighbour match.
// The matcher is deliberately behind `matchCard()` so the hash can be swapped for an embedding later.

import { CardHash, cardDistance, hashFromHex, hashToHex } from './card-hash'

export interface IndexEntry {
  id: string
  title: string
  year?: string
  hash: CardHash
}

export interface CardMatch {
  entry: IndexEntry
  distance: number // 0 = identical
  margin: number // second-best distance minus best; large = unambiguous
}

export interface MatchRule {
  maxDistance: number // reject matches farther than this
  minMargin: number // reject when the runner-up is too close (ambiguous)
}

// Swept with STRUCTURE_WEIGHT on synthetic frames (mild + medium camera damage, 140-entry index, 15-frame tracks):
// the best config with false labels <= 1% on unenrolled cards in every set was picked, preferring fewer false labels
// over more matches (a wrong rating is worse than none). Cost: ~60% of enrolled cards labelled under medium damage
// (vivid ~85%, dim art ~35%); false labels 0.0% (vivid) / 0.8% (dim art), all from a few flat look-alike cards.
// Synthetic only: replace with thresholds measured on real card art / phone captures.
export const DEFAULT_RULE: MatchRule = { maxDistance: 0.12, minMargin: 0.04 }

export function matchCard(query: CardHash, index: IndexEntry[], rule: MatchRule = DEFAULT_RULE): CardMatch | null {
  let best: IndexEntry | null = null
  let bestD = Infinity
  let secondD = Infinity
  for (const entry of index) {
    const d = cardDistance(query, entry.hash)
    if (d < bestD) {
      secondD = bestD
      bestD = d
      best = entry
    } else if (d < secondD) {
      secondD = d
    }
  }
  if (!best || bestD > rule.maxDistance) return null
  const margin = secondD === Infinity ? Infinity : secondD - bestD
  if (margin < rule.minMargin) return null
  return { entry: best, distance: bestD, margin }
}

// JSON-friendly form, for localStorage and for the shipped index file.
export interface SerializedEntry {
  id: string
  title: string
  year?: string
  bits: string
  color: string
}

export function serializeIndex(index: IndexEntry[]): SerializedEntry[] {
  return index.map(e => ({ id: e.id, title: e.title, year: e.year, ...hashToHex(e.hash) }))
}

export function deserializeIndex(raw: unknown): IndexEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((r: any) => {
    if (typeof r?.id !== 'string' || typeof r?.title !== 'string') return []
    if (typeof r.bits !== 'string' || typeof r.color !== 'string') return []
    return [{ id: r.id, title: r.title, year: r.year, hash: hashFromHex(r.bits, r.color) }]
  })
}
