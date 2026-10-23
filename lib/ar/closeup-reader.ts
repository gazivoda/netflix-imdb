// Close-up reading: ONE card filling the frame, read slowly and in two stages. Stage 1 reads the whole card with four differently
// prepared copies (sharpened, plain greyscale, inverted, adaptive threshold). If they do not already agree, stage 2 finds where the
// title logo is from the words stage 1 saw, cuts that region out of the card's NATIVE pixels, enlarges it so the letters are
// about 56 px tall (the size Tesseract reads best) and reads it again with four more passes. Stage 2 removes the busy artwork
// around the logo, which is what defeats whole-card passes. Candidates of both stages are merged, so agreement across stages raises
// the score. Pure over an injected OcrEngine.

import type { RgbaImage } from '../card-hash'
import type { Box } from '../card-tracker'
import { createTileSession, type OcrEngine, type PassSpec, type TileReaderOptions } from './tile-reader'
import type { PassWords } from './title-confidence'

const FULL: PassSpec['region'] = [0, 0, 1, 1]

/** Stage 1: the whole card. */
export const STAGE1_PASSES: PassSpec[] = [
  { region: FULL, scale: 4, prep: 'sharp2', psm: 11 },
  { region: FULL, scale: 3, prep: 'luma', psm: 11 },
  { region: FULL, scale: 3, prep: 'inv', psm: 11 },
  { region: FULL, scale: 3, prep: 'adapt', psm: 11 },
]

const STAGE2_PREPS: PassSpec['prep'][] = ['sharp2', 'luma', 'inv', 'adapt']
const TARGET_TEXT_H = 56 // px height of the logo's letters in a stage 2 image
const MAX_ZOOM = 8
const OUT_W: [number, number] = [300, 1800]

/** Stage 1 stops here when its leader is this strong and this many passes agree. */
export const EARLY_SCORE = 0.9
export const EARLY_SUPPORT = 3

export interface LocatedLogo {
  /** The logo with a margin, in pixels of the card crop. */
  box: Box
  /** Height of the letters (crop px). */
  textH: number
}

/**
 * Where the title is on the card, from the words of whole-card passes (word boxes are in the pass image, which has the card's aspect):
 * confident words of title height are chained into lines, the heaviest line cluster wins, a neighbouring cluster joins it (two-line
 * logos), and the box is the union with a margin. Small print (maturity labels, "TOP 10", "98% Match") is shorter than 0.55 of the
 * title height and is left out. null when there is nothing to anchor on.
 */
export function locateLogo(passes: PassWords[], cropW: number, cropH: number): LocatedLogo | null {
  const ws: { x0: number; x1: number; y0: number; y1: number; c: number; l: number }[] = []
  for (const p of passes) {
    if (!(p.imageHeight > 0)) continue
    const k = cropH / p.imageHeight
    for (const w of p.words) {
      const letters = (w.text || '').replace(/[^\p{L}\p{N}]/gu, '').length
      if (letters < 2 || w.confidence < 45) continue
      ws.push({ x0: w.bbox.x0 * k, x1: w.bbox.x1 * k, y0: w.bbox.y0 * k, y1: w.bbox.y1 * k, c: w.confidence, l: letters })
    }
  }
  if (!ws.length) return null
  // title height: the second tallest of the confident words (one tall speck cannot set it)
  const tall = ws.filter(w => w.c >= 60).map(w => w.y1 - w.y0).sort((a, b) => b - a)
  const H = tall.length ? tall[Math.min(1, tall.length - 1)] : Math.max(...ws.map(w => w.y1 - w.y0))
  const keep = ws.filter(w => w.y1 - w.y0 >= 0.55 * H && w.y1 - w.y0 <= 1.6 * H).sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1))
  if (!keep.length) return null
  const clusters: { w: typeof keep; cy: number; s: number }[] = []
  for (const w of keep) {
    const last = clusters[clusters.length - 1]
    const cy = (w.y0 + w.y1) / 2
    if (last && cy - last.cy <= 1.6 * H) {
      last.w.push(w)
      last.cy = (last.cy * (last.w.length - 1) + cy) / last.w.length
    } else clusters.push({ w: [w], cy, s: 0 })
  }
  for (const c of clusters) c.s = c.w.reduce((a, w) => a + w.c * w.l * (w.y1 - w.y0), 0)
  clusters.sort((a, b) => b.s - a.s)
  const sel = [...clusters[0].w]
  for (const c of clusters.slice(1)) if (Math.abs(c.cy - clusters[0].cy) <= 2.4 * H && c.s > 0.3 * clusters[0].s) sel.push(...c.w)
  const x0 = Math.min(...sel.map(w => w.x0))
  const x1 = Math.max(...sel.map(w => w.x1))
  const y0 = Math.min(...sel.map(w => w.y0))
  const y1 = Math.max(...sel.map(w => w.y1))
  const mx = 0.5 * H + 0.04 * (x1 - x0)
  const my = 0.6 * H
  const bx0 = Math.max(0, x0 - mx)
  const by0 = Math.max(0, y0 - my)
  const bx1 = Math.min(cropW, x1 + mx)
  const by1 = Math.min(cropH, y1 + my)
  if (bx1 - bx0 < 4 || by1 - by0 < 4) return null
  return { box: { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 }, textH: H }
}

/** The stage 2 passes for a located logo: the same four preparations on the zoomed-in region, in block mode. */
export function stage2Passes(found: LocatedLogo, crop: { width: number; height: number }): PassSpec[] {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, TARGET_TEXT_H / Math.max(1, found.textH)))
  const width = Math.round(Math.min(OUT_W[1], Math.max(OUT_W[0], found.box.w * zoom)))
  const region: PassSpec['region'] = [found.box.x / crop.width, found.box.y / crop.height, found.box.w / crop.width, found.box.h / crop.height]
  return STAGE2_PREPS.map(prep => ({ region, scale: 1, width, prep, psm: 6 }))
}

export interface CloseupReading {
  /** Best first, canonical case; the vocabulary's snapped titles are among them. */
  candidates: string[]
  scores: number[]
  /** What the card literally says (best candidate before any snapping to the vocabulary), for "Read as: ...". Empty when nothing was read. */
  literal: string
  raw: string
  /** Where stage 2 looked, in crop pixels; null when it did not run or found nothing to anchor on. */
  located: Box | null
  passes: number
  /** The stage that produced the final reading. */
  stage: 1 | 2
  /** The words of every pass, for the decision layer. */
  passWords: PassWords[]
  ms: number
}

export async function readCloseup(
  engine: OcrEngine,
  crop: RgbaImage,
  opts: Partial<TileReaderOptions> = {},
  onStage?: (stage: 1 | 2) => void,
): Promise<CloseupReading> {
  const session = createTileSession(engine, crop, opts)
  onStage?.(1)
  const early = await session.run(STAGE1_PASSES, { until: merged => !!merged[0] && merged[0].score >= EARLY_SCORE && merged[0].support >= EARLY_SUPPORT })
  let located: Box | null = null
  let stage: 1 | 2 = 1
  if (!early) {
    const found = locateLogo(session.passWords(), crop.width, crop.height)
    if (found) {
      onStage?.(2)
      located = found.box
      stage = 2
      await session.run(stage2Passes(found, crop), { until: () => false })
    }
  }
  const res = session.result()
  const literal = session.literal()[0]
  return {
    candidates: res.candidates,
    scores: res.scores,
    literal: literal ? literal.text : '',
    raw: res.raw,
    located,
    passes: res.passes,
    stage,
    passWords: res.passWords,
    ms: res.ms,
  }
}
