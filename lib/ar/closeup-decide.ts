// What a close-up scan tells the user. A wrong rating is worse than none, so the answer is gated on how sure the reading is:
// sure (>= 0.85) shows the rating, a weaker but accepted reading asks "Is this X?", and anything else offers the nearest known
// titles. Below 0.85 the right-answer rate measured on synthetic cards fell to about half, which is why the gate is not lowered
// to read more cards.

import { acceptsTitle, titleSimilarity } from './auto-label'
import type { CloseupReading } from './closeup-reader'
import type { TitleDecision } from './title-confidence'

export const SURE_SCORE = 0.85
export const ASK_SCORE = 0.4

export type CloseupTier = 'sure' | 'ask' | 'none'

export function tierOf(score: number, accepted: boolean): CloseupTier {
  if (!accepted) return 'none'
  if (score >= SURE_SCORE) return 'sure'
  return score >= ASK_SCORE ? 'ask' : 'none'
}

/**
 * Known titles that look like one of the top candidates, best first: similarity of at least `minSim` to any of the first four
 * candidates (and not the title the caller already offers).
 */
export function didYouMean(candidates: string[], titles: string[], max = 3, minSim = 0.55): string[] {
  const best = new Map<string, number>()
  for (const t of titles) {
    let sim = 0
    for (const c of candidates.slice(0, 4)) sim = Math.max(sim, titleSimilarity(c, t))
    if (sim >= minSim) best.set(t, sim)
  }
  return [...best].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length).slice(0, max).map(([t]) => t)
}

export interface CloseupOutcome {
  tier: CloseupTier
  /** The title to show (tier 'sure') or to ask about (tier 'ask'). */
  title: string | null
  /** One-tap alternatives (up to 3): shown for "Is this X?", "Not this one" and when nothing was read. */
  chips: string[]
  /** What the card literally says; always shown, so a wrong snap is visible. */
  readAs: string
  score: number
}

/**
 * Combines the reading with the decision layer's verdict (see title-confidence.ts / AutoLabeler.decide). The score of an accepted
 * title is the best score of a reading candidate that says it; an accept the candidates do not echo (the ranker accepted a title the
 * snapper never proposed) counts as sure only when `agreement` (passes that agree on it) is 2 or more.
 */
export function decideCloseup(reading: CloseupReading, decision: TitleDecision, titles: string[], agreement = 2): CloseupOutcome {
  const readAs = reading.literal || reading.candidates[0] || ''
  if (decision.kind === 'accept') {
    let score = 0
    reading.candidates.forEach((c, i) => { if (acceptsTitle(c, decision.title)) score = Math.max(score, reading.scores[i] ?? 0) })
    if (score === 0) score = agreement >= 2 ? SURE_SCORE : ASK_SCORE
    // alternatives are kept even for a sure answer: "Not this one" shows them
    const chips = didYouMean(reading.candidates, titles).filter(t => t !== decision.title)
    return { tier: tierOf(score, true), title: decision.title, chips: chips.slice(0, 3), readAs, score }
  }
  const fromDecision = decision.kind === 'suggest' ? decision.chips.map(c => c.title) : []
  const chips = [...fromDecision, ...didYouMean(reading.candidates, titles)].filter((t, i, all) => all.indexOf(t) === i).slice(0, 3)
  return { tier: 'none', title: null, chips, readAs, score: 0 }
}
