// Deterministic simulation of the DECISION layer on synthetic OCR text (not of Tesseract's ability to read stylised logos).
// Each simulated tile is three independent OCR passes over a card that shows a title with per-letter noise (confusable swaps,
// dropped / doubled / split / random letters, lost and merged words, two-line logos) plus Netflix chrome. The held-out set is
// deliberately sibling- and sequel-heavy (Money Heist / Money Heist: Korea, Enola Holmes / 2, Fear Street ...), plus titles removed
// from the vocabulary and tiles with no readable title. It is a stress set, not a traffic estimate: use it to compare decision
// rules and to guard against regressions, never to quote an accuracy.

import { POPULAR_TITLES } from '../../lib/ar/popular-titles'
import { acceptsTitle } from '../../lib/ar/auto-label'
import { createVocabulary } from '../../lib/ar/title-vocab'
import { evaluateReading, TitleIndex, bareKey, type ConfidenceProfile, type PassWords, type TitleDecision } from '../../lib/ar/title-confidence'
import type { OcrWordLike } from '../../lib/ar/title-candidates'

const H = 1000

export function mkRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const CONF: Record<string, string[]> = { l: ['I', '1', '|'], I: ['l', '1', '|'], O: ['0', 'Q', 'D'], 0: ['O'], S: ['5', '$'], B: ['8', 'R'], E: ['F', 'B'], A: ['4', 'R'], M: ['N', 'H'], N: ['M', 'H'], R: ['K', 'B'], H: ['N', 'M'], G: ['6', 'C'], U: ['V', 'O'], T: ['I', 'F'], C: ['G', 'O'], D: ['O', 'B'], W: ['V', 'M'], K: ['R', 'X'], Y: ['V'], P: ['F', 'R'], Q: ['O'], F: ['E', 'P'], L: ['I', 'E'], V: ['U', 'Y'], X: ['K'], Z: ['2'], J: ['I'] }
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function corruptWord(w: string, level: number, rnd: () => number): { toks: string[]; bad: boolean } {
  const out: string[] = []
  let cur = ''
  let bad = false
  for (const ch of w) {
    if (rnd() >= level || !/[A-Z0-9]/.test(ch)) { cur += ch; continue }
    bad = true
    const r = rnd()
    if (r < 0.45) { const c = CONF[ch]; cur += c ? c[Math.floor(rnd() * c.length)] : LETTERS[Math.floor(rnd() * 26)] }
    else if (r < 0.7) { /* dropped letter */ }
    else if (r < 0.75) cur += ch + ch
    else if (r < 0.9) { if (cur) out.push(cur); cur = ch } // split the word here
    else cur += LETTERS[Math.floor(rnd() * 26)]
  }
  if (cur) out.push(cur)
  return { toks: out.length ? out : [w], bad }
}

const gauss = (rnd: () => number) => (rnd() + rnd() + rnd() - 1.5) * 2
function confFor(bad: boolean, rnd: () => number): number {
  let c = 86 + 6 * gauss(rnd)
  if (bad && rnd() < 0.7) c -= 15 + 30 * rnd()
  return Math.max(15, Math.min(98, c))
}

const CHROME: [string[], number, number, number][] = [
  [['N'], 8, 8, 55], [['TOP', '10'], 560, 8, 40], [['TV-MA'], 8, 900, 35], [['Recently', 'added'], 420, 900, 38],
  [['Season', '2'], 200, 880, 42], [['98%', 'Match'], 20, 820, 38], [['A', 'NETFLIX', 'SERIES'], 200, 60, 38], [['16+'], 40, 900, 36],
]
function addChrome(out: OcrWordLike[], rnd: () => number, p: number) {
  for (const [toks, x, y, h] of CHROME) {
    if (rnd() > p) continue
    let xx = x
    for (const t of toks) {
      const wd = t.length * h * 0.6
      out.push({ text: t, confidence: 70 + rnd() * 25, bbox: { x0: xx, y0: y, x1: xx + wd, y1: y + h } })
      xx += wd + 12
    }
  }
}

export interface PassOptions { trunc?: number; chrome?: number }

/** One OCR pass over a tile that shows `title` with noise `level` (per-letter event probability). */
export function passWords(title: string, level: number, rnd: () => number, opt: PassOptions = {}): OcrWordLike[] {
  let toks = title.toUpperCase().split(/\s+/).filter(Boolean)
  if (opt.trunc && toks.length > 1) toks = toks.slice(0, Math.max(1, Math.ceil(toks.length * opt.trunc)))
  if (toks.length > 1) { const keep = toks.filter(() => rnd() >= level * 0.7); toks = keep.length ? keep : [toks[Math.floor(rnd() * toks.length)]] }
  const merged: string[] = []
  for (let i = 0; i < toks.length; i++) {
    if (i + 1 < toks.length && rnd() < level * 1.2) { merged.push(toks[i] + toks[i + 1]); i++ } else merged.push(toks[i])
  }
  const pieces: { t: string; bad: boolean }[] = []
  for (const w of merged) { const { toks: ts, bad } = corruptWord(w, level, rnd); for (const t of ts) pieces.push({ t, bad }) }
  const multi = pieces.length >= 3 && rnd() < 0.25
  const cut = multi ? Math.ceil(pieces.length / 2) : pieces.length
  const out: OcrWordLike[] = []
  let y = 350
  const hh = 150 + rnd() * 40
  for (const row of multi ? [pieces.slice(0, cut), pieces.slice(cut)] : [pieces]) {
    let x = 60
    for (const p of row) {
      const wd = p.t.length * hh * 0.62
      out.push({ text: p.t, confidence: confFor(p.bad, rnd), bbox: { x0: x, y0: y, x1: x + wd, y1: y + hh } })
      x += wd + 30
    }
    y += hh + 20
  }
  addChrome(out, rnd, opt.chrome ?? 0.5)
  return out
}

const TAG = ['WATCH', 'BURN', 'TONIGHT', 'FIGHT', 'BLOOD', 'LEGACY', 'SURVIVE', 'TRUTH', 'NEVER', 'AGAIN', 'FOREVER', 'WORLD', 'LAST', 'RISE', 'FALL', 'CITY', 'NIGHT', 'FIRST', 'BROTHER', 'SECRET']
export type JunkKind = 'none' | 'garbage' | 'tagline' | 'fragment'
/** A tile with no readable title: chrome only, random letters, a tagline, or ONE word of a real title (the rest of the logo is stylised). */
export function junkPass(kind: JunkKind, rnd: () => number, fragment: string): OcrWordLike[] {
  const out: OcrWordLike[] = []
  let x = 60
  const mk = (text: string, h: number, conf: number) => { const wd = text.length * h * 0.62; out.push({ text, confidence: conf, bbox: { x0: x, y0: 380, x1: x + wd, y1: 380 + h } }); x += wd + 30 }
  if (kind === 'garbage') {
    const n = 1 + Math.floor(rnd() * 3)
    for (let i = 0; i < n; i++) { let s = ''; const L = 3 + Math.floor(rnd() * 7); for (let j = 0; j < L; j++) s += LETTERS[Math.floor(rnd() * 26)]; mk(s, 120 + rnd() * 60, 30 + rnd() * 45) }
  } else if (kind === 'tagline') {
    const n = 2 + Math.floor(rnd() * 3)
    for (let i = 0; i < n; i++) mk(TAG[Math.floor(rnd() * TAG.length)], 130 + rnd() * 50, 70 + rnd() * 25)
  } else if (kind === 'fragment') {
    mk(fragment.toUpperCase(), 150 + rnd() * 40, confFor(rnd() < 0.3, rnd))
  }
  addChrome(out, rnd, 0.6)
  return out
}

// ---------------------------------------------------------------- the held-out set

const KOREA = 'Money Heist: Korea'
export const IN_TITLES = ['Stranger Things', 'Squid Game', 'The Witcher', 'Wednesday', 'Bridgerton', 'Ozark', 'Money Heist', 'The Crown', 'Black Mirror', "Don't Look Up", 'Glass Onion: A Knives Out Mystery', 'All Quiet on the Western Front', 'Love, Death & Robots', "The Queen's Gambit", 'Red Notice', 'The Gray Man', 'Bird Box', 'Enola Holmes 2', 'Emily in Paris', 'Ginny & Georgia', '13 Reasons Why', '3 Body Problem', 'Baby Reindeer', 'Adolescence', 'Narcos: Mexico', 'The Umbrella Academy', 'Fear Street: Part One - 1994', 'Marriage Story', 'Heartstopper', 'Sex Education', 'Lupin', 'Beef', 'Dark', 'You', 'Rebel Moon - Part One: A Child of Fire', 'Outer Banks', 'The Night Agent', 'Leave the World Behind', '1899',
  KOREA, 'Murder Mystery 2', 'Narcos', 'Fear Street', 'Enola Holmes', 'Rebel Moon', 'Extraction', 'Maid', 'Dahmer']
/** Titles removed from the vocabulary: 4 of them have a vocabulary title as their first words (the family problem). */
export const OOV_TITLES = ['Territory', 'Bodkin', 'Tires', 'Sweet Tooth', 'Ripley', 'Painkiller', 'Fear Street: Prom Queen', 'Monster: The Ed Gein Story', 'The Witcher: Blood Origin', 'Squid Game: The Challenge', 'Extraction 2', 'Nimona']

export const SCENARIOS: [string, number, PassOptions][] = [['clean', 0, {}], ['l1', 0.04, {}], ['l2', 0.08, {}], ['l3', 0.14, {}], ['l4', 0.22, {}], ['trunc', 0.05, { trunc: 0.6 }]]

export interface SimTile {
  truth: string | null
  kind: 'in' | 'oov' | 'junk'
  scenario: string
  passes: PassWords[]
}

/** The tiles of the held-out set: `draws` independent renders of each title in each noise scenario, plus junk tiles. Fully seeded. */
export function buildTiles(draws: number, junk = 480, only?: { scenarios?: string[]; titles?: string[] }): SimTile[] {
  const tiles: SimTile[] = []
  let seed = 1000
  for (const [titles, kind] of [[IN_TITLES, 'in'], [OOV_TITLES, 'oov']] as const) {
    for (const t of titles) {
      for (const [scenario, level, opt] of SCENARIOS) {
        // a skipped tile still consumes its seed, so a subset is made of exactly the tiles the full set has
        if ((only?.scenarios && !only.scenarios.includes(scenario)) || (only?.titles && !only.titles.includes(t))) { seed += draws; continue }
        for (let k = 0; k < draws; k++) {
          const rnd = mkRng(++seed * 7919)
          tiles.push({ truth: t, kind, scenario, passes: [0, 1, 2].map(() => ({ words: passWords(t, level, rnd, opt), imageHeight: H })) })
        }
      }
    }
  }
  const rj = mkRng(31)
  const multi = POPULAR_TITLES.filter(t => t.split(/\s+/).filter(w => w.replace(/[^A-Za-z]/g, '').length >= 3).length >= 2)
  for (const jk of ['none', 'garbage', 'tagline', 'fragment'] as const) {
    for (let i = 0; i < Math.ceil(junk / 4); i++) {
      const src = multi[Math.floor(rj() * multi.length)]
      const ws = src.split(/\s+/).map(w => w.replace(/[^A-Za-z0-9]/g, '')).filter(w => w.length >= 4)
      const fragment = ws[Math.floor(rj() * ws.length)] || src.split(/\s+/)[0]
      const rnd = mkRng(Math.floor(rj() * 1e9))
      tiles.push({ truth: jk === 'fragment' ? src : null, kind: 'junk', scenario: jk, passes: [0, 1, 2].map(() => ({ words: junkPass(jk, rnd, fragment), imageHeight: H })) })
    }
  }
  return tiles
}

// ---------------------------------------------------------------- running the decision layer

export function simContext() {
  const oov = new Set(OOV_TITLES.map(bareKey))
  const vocabTitles = [...POPULAR_TITLES.filter(t => !oov.has(bareKey(t))), KOREA]
  const catalogue = new Map([...new Set([...POPULAR_TITLES, ...OOV_TITLES, KOREA])].map(t => [bareKey(t), t]))
  const vocabulary = createVocabulary(vocabTitles)
  return { vocabulary, index: new TitleIndex(vocabulary), catalogue, vocabTitles }
}

export interface SimOutcome {
  tile: SimTile
  decision: TitleDecision
  lookups: number
}

/** The AutoLabeler's flow without a camera: evaluate, then at most one exact catalogue lookup for a reading the vocabulary does not know. */
export function decideTile(tile: SimTile, ctx: ReturnType<typeof simContext>, profile?: ConfidenceProfile): SimOutcome {
  const ev = evaluateReading({ candidates: [], passes: tile.passes }, { vocabulary: ctx.vocabulary, index: ctx.index, profile })
  let decision = ev.decision
  let lookups = 0
  if (decision.kind !== 'accept' && ev.lookups[0]) {
    lookups = 1
    const hit = ctx.catalogue.get(bareKey(ev.lookups[0].text))
    if (hit && acceptsTitle(ev.lookups[0].text, hit)) decision = ev.judge(ev.lookups[0], hit)
  }
  return { tile, decision, lookups }
}

export interface SimStats {
  n: number
  accept: number
  wrongAccept: number
  suggest: number
  chipHit: number
  reject: number
  /** Tiles with a readable title that ended right without typing: a correct accept, or the true title among the chips. */
  resolved: number
  readable: number
  lookups: number
}

export function tally(outcomes: SimOutcome[]): SimStats {
  const s: SimStats = { n: outcomes.length, accept: 0, wrongAccept: 0, suggest: 0, chipHit: 0, reject: 0, resolved: 0, readable: 0, lookups: 0 }
  for (const { tile, decision, lookups } of outcomes) {
    const truth = tile.truth ? bareKey(tile.truth) : null
    s.lookups += lookups
    if (truth) s.readable++
    if (decision.kind === 'accept') {
      s.accept++
      if (truth !== bareKey(decision.title)) s.wrongAccept++
      else s.resolved++
    } else if (decision.kind === 'suggest') {
      s.suggest++
      if (truth && decision.chips.some(c => bareKey(c.title) === truth)) { s.chipHit++; s.resolved++ }
    } else s.reject++
  }
  return s
}

export const pct = (x: number, n: number) => (n ? (100 * x) / n : 0)
