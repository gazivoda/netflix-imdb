// End-to-end harness for the AR pipeline on synthetic scenes: build a reference library from clean renders,
// replay degraded multi-frame sequences, and score card-level outcomes (correct / wrong / no label, plus false
// labels on cards that were never enrolled). Shared by the e2e test and the calibration sweep.
import { CardHash, RgbaImage, colorDistance, hammingDistance, hashCard } from '../../lib/card-hash'
import { IndexEntry, MatchRule } from '../../lib/card-index'
import { Box, CardTracker, Track, iou } from '../../lib/card-tracker'
import { cropToRgba } from '../../lib/ar/rectify'
import { findCards } from '../../lib/ar/card-finder'
import { DegradeOptions, Scene, SceneOptions, degrade, makeScene, mulberry32, randomDegrade, renderCardArt } from './ar-scene'

export type Level = 'mild' | 'medium'

export interface Layout {
  seed: number
  scene: Scene
  /** Per scene card (same order as scene.cards): id when enrolled, null for held-out / foreign cards. */
  ids: (string | null)[]
}

// 2 rows x 5 cols, varied gaps, sometimes a focus ring. Card-level truth only counts cards >= 70% visible.
export function layoutOptions(seed: number, muted = false): SceneOptions {
  const rng = mulberry32(seed * 131 + 3)
  return {
    seed,
    rows: 2,
    cols: 5,
    gapMin: 3 + Math.floor(rng() * 3),
    gapMax: 8 + Math.floor(rng() * 6),
    focus: seed % 3 === 0,
    focusScale: 1,
    muted,
  }
}

export function cropHash(img: RgbaImage, box: Box, w = 96, h = 54): CardHash {
  return hashCard(cropToRgba(img, box, w, h))
}

/**
 * Enrol from a clean render, the way a user would from a steady shot: detect, crop, hash. Every even card is
 * enrolled; odd cards stay out of the index ("held out") to measure false labels on same-screen strangers.
 * `padding` adds never-shown distractor entries so false-match rates reflect a realistically sized index.
 */
export function buildLibrary(seeds: number[], padding = 0, muted = false): { index: IndexEntry[]; layouts: Layout[] } {
  const index: IndexEntry[] = []
  const layouts: Layout[] = []
  for (const seed of seeds) {
    const scene = makeScene(layoutOptions(seed, muted))
    const dets = findCards(scene.image)
    const ids = scene.cards.map((c, i): string | null => {
      if (i % 2 === 1 || c.visible < 0.7) return null
      let best: Box | null = null
      let bestV = 0.5
      for (const d of dets) {
        const v = iou(d, c.box)
        if (v > bestV) { bestV = v; best = d }
      }
      if (!best) return null
      const id = `${seed}-${i}`
      index.push({ id, title: `Title ${id}`, hash: cropHash(scene.image, best) })
      return id
    })
    layouts.push({ seed, scene, ids })
  }
  for (let p = 0; p < padding; p++) {
    index.push({ id: `pad-${p}`, title: `Pad ${p}`, hash: hashCard(muted ? renderCardArt(900000 + p, 96, 54, 30, 120, 0.08, 0.35) : renderCardArt(900000 + p, 96, 54)) })
  }
  return { index, layouts }
}

export function foreignLayout(seed: number, muted = false): Layout {
  const scene = makeScene(layoutOptions(seed, muted))
  return { seed, scene, ids: scene.cards.map(() => null) }
}

export interface TruthCard { box: Box; id: string | null }

// 'medium' is randomDegrade's doubled setting: ~3 deg rotation, 6% keystone, ~1.6 px blur, sigma ~8 noise, strong glare.
export function frames(layout: Layout, level: Level, count: number): { image: RgbaImage; truth: TruthCard[] }[] {
  const base: DegradeOptions = randomDegrade(layout.seed, level === 'mild' ? 'mild' : 'strong')
  const jitter = mulberry32(layout.seed * 17 + 1)
  const out: { image: RgbaImage; truth: TruthCard[] }[] = []
  for (let f = 0; f < count; f++) {
    // Hand shake between frames: small rotation / keystone wobble, fresh sensor noise each frame.
    const opts: DegradeOptions = {
      ...base,
      seed: (base.seed ?? 1) * 1000 + f,
      rotateDeg: (base.rotateDeg ?? 0) + (jitter() - 0.5) * 0.6,
      keystone: Math.max(0, (base.keystone ?? 0) + (jitter() - 0.5) * 0.01),
    }
    const d = degrade(layout.scene, opts)
    out.push({
      image: d.image,
      truth: d.cards.flatMap((c, i) => (c.visible >= 0.7 && c.box.w > 2 ? [{ box: c.box, id: layout.ids[i] }] : [])),
    })
  }
  return out
}

export interface Outcome {
  enrolled: { correct: number; wrong: number; none: number; nodet: number }
  unenrolled: { clean: number; falseLabel: number; nodet: number }
}

export const emptyOutcome = (): Outcome => ({
  enrolled: { correct: 0, wrong: 0, none: 0, nodet: 0 },
  unenrolled: { clean: 0, falseLabel: 0, nodet: 0 },
})

export function addOutcome(a: Outcome, b: Outcome): void {
  for (const k of Object.keys(a.enrolled) as (keyof Outcome['enrolled'])[]) a.enrolled[k] += b.enrolled[k]
  for (const k of Object.keys(a.unenrolled) as (keyof Outcome['unenrolled'])[]) a.unenrolled[k] += b.unenrolled[k]
}

export function scoreFrame(truth: TruthCard[], tracks: Track[], out: Outcome): void {
  for (const t of truth) {
    let best: Track | null = null
    let bestV = 0.5
    for (const tr of tracks) {
      const v = iou(tr.box, t.box)
      if (v > bestV) { bestV = v; best = tr }
    }
    if (t.id !== null) {
      if (!best) out.enrolled.nodet++
      else if (best.id === t.id) out.enrolled.correct++
      else if (best.id === null) out.enrolled.none++
      else out.enrolled.wrong++
    } else if (!best) out.unenrolled.nodet++
    else if (best.id === null) out.unenrolled.clean++
    else out.unenrolled.falseLabel++
  }
}

export interface Candidate { id: string; title: string; bestD: number; secondD: number }

// Nearest neighbour under a given structure weight. matchCard's accept/reject rule is applied separately
// (see `accept`) so a sweep can compute distances once per weight and test many rules cheaply.
export function nearest(q: CardHash, index: IndexEntry[], weight: number): Candidate | null {
  let best: IndexEntry | null = null
  let bestD = Infinity
  let secondD = Infinity
  for (const e of index) {
    const d = weight * hammingDistance(q.bits, e.hash.bits) + (1 - weight) * colorDistance(q.color, e.hash.color)
    if (d < bestD) { secondD = bestD; bestD = d; best = e } else if (d < secondD) secondD = d
  }
  return best ? { id: best.id, title: best.title, bestD, secondD } : null
}

export const accept = (c: Candidate | null, rule: MatchRule): { id: string; title: string } | null =>
  c && c.bestD <= rule.maxDistance && c.secondD - c.bestD >= rule.minMargin ? { id: c.id, title: c.title } : null

export interface RecordedFrame { truth: TruthCard[]; dets: { box: Box; hash: CardHash; cand?: Candidate | null }[] }

/** Detect + hash once; the sweep then replays matching/tracking over these without re-rendering. */
export function record(layout: Layout, level: Level, count: number): RecordedFrame[] {
  return frames(layout, level, count).map(({ image, truth }) => ({
    truth,
    dets: findCards(image).map((box) => ({ box, hash: cropHash(image, box) })),
  }))
}

/** Fill in nearest-neighbour candidates for one weight (call before `replay` with that weight). */
export function prepare(rec: RecordedFrame[][], index: IndexEntry[], weight: number): void {
  for (const seq of rec) for (const fr of seq) for (const d of fr.dets) d.cand = nearest(d.hash, index, weight)
}

export function replay(rec: RecordedFrame[], rule: MatchRule, warmup = 7): Outcome {
  const tracker = new CardTracker()
  const out = emptyOutcome()
  rec.forEach((fr, f) => {
    const tracks = tracker.update(fr.dets.map((d) => ({ box: d.box, match: accept(d.cand ?? null, rule) })))
    if (f >= warmup) scoreFrame(fr.truth, tracks, out)
  })
  return out
}

export const rates = (o: Outcome) => {
  const e = o.enrolled.correct + o.enrolled.wrong + o.enrolled.none + o.enrolled.nodet
  const u = o.unenrolled.clean + o.unenrolled.falseLabel + o.unenrolled.nodet
  return {
    correct: o.enrolled.correct / Math.max(1, e),
    wrong: o.enrolled.wrong / Math.max(1, e),
    none: o.enrolled.none / Math.max(1, e),
    nodet: o.enrolled.nodet / Math.max(1, e),
    falseLabel: o.unenrolled.falseLabel / Math.max(1, u),
    nEnrolled: e,
    nUnenrolled: u,
  }
}
