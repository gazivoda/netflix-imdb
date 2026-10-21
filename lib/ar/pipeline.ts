// Per-frame AR pipeline: find card boxes -> rectify each to a fixed size -> hash -> match -> track.
// Synchronous and DOM-free; the finder is injected so tests (and the page) control it.

import { hashCard, RgbaImage } from '../card-hash'
import { DEFAULT_RULE, IndexEntry, matchCard, MatchRule } from '../card-index'
import { Box, CardTracker, Detection, Track } from '../card-tracker'
import { cropToRgba, type Pt } from './rectify'

export type Quad = [Pt, Pt, Pt, Pt]

export interface PipelineOptions {
  analysisWidth: number // frame is downscaled to this width before finding cards
  cardOutW: number
  cardOutH: number // rectified card size fed to hashCard
  rule: MatchRule
}

export interface ArFrameResult {
  tracks: Track[] // boxes in pixel coords of the INPUT image
  /** This frame's unmatched detections (enrolment candidates). `quad` (tl, tr, br, bl; input-image pixels) is set when the finder reports corners. */
  unknownCards: { box: Box; crop: RgbaImage; quad?: Quad }[]
  timings: { findMs: number; hashMs: number; totalMs: number }
}

export const DEFAULT_PIPELINE: PipelineOptions = { analysisWidth: 640, cardOutW: 96, cardOutH: 54, rule: DEFAULT_RULE }

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

// Area-average downscale to w x h, writing into a reusable buffer.
function downscale(src: RgbaImage, w: number, h: number, out: RgbaImage | null): RgbaImage {
  const dst = out && out.width === w && out.height === h ? out : { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }
  const s = src.data
  const d = dst.data
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * src.height) / h)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * src.height) / h))
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * src.width) / w)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * src.width) / w))
      let r = 0, g = 0, b = 0, a = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * src.width + xx) * 4
          r += s[i]; g += s[i + 1]; b += s[i + 2]; a += s[i + 3]
        }
      }
      const n = (y1 - y0) * (x1 - x0)
      const o = (y * w + x) * 4
      d[o] = r / n; d[o + 1] = g / n; d[o + 2] = b / n; d[o + 3] = a / n
    }
  }
  return dst
}

export class ArPipeline {
  private opts: PipelineOptions
  private index: IndexEntry[] = []
  private tracker = new CardTracker()
  private scratch: RgbaImage | null = null

  constructor(private deps: { findCards: (img: RgbaImage) => Box[]; findCardsDetailed?: (img: RgbaImage) => { box: Box; quad?: Quad }[] }, opts: Partial<PipelineOptions> = {}) {
    this.opts = { ...DEFAULT_PIPELINE, ...opts }
  }

  setIndex(index: IndexEntry[]): void {
    this.index = index
  }

  reset(): void {
    this.tracker = new CardTracker()
  }

  processFrame(guideImage: RgbaImage): ArFrameResult {
    const t0 = now()
    const { analysisWidth, cardOutW, cardOutH, rule } = this.opts

    // Find on a downscaled copy, but crop from the full-resolution input for sharper hashes.
    let analysis = guideImage
    let scale = 1
    if (guideImage.width > analysisWidth) {
      scale = guideImage.width / analysisWidth
      const h = Math.max(1, Math.round(guideImage.height / scale))
      analysis = this.scratch = downscale(guideImage, analysisWidth, h, this.scratch)
    }
    const found = this.deps.findCardsDetailed ? this.deps.findCardsDetailed(analysis) : this.deps.findCards(analysis).map((box) => ({ box, quad: undefined as Quad | undefined }))
    const t1 = now()

    const detections: Detection[] = []
    const unknownCards: ArFrameResult['unknownCards'] = []
    for (const { box: b, quad: q } of found) {
      const box: Box = scale === 1 ? b : { x: b.x * scale, y: b.y * scale, w: b.w * scale, h: b.h * scale }
      const quad = q && scale !== 1 ? (q.map((p) => ({ x: p.x * scale, y: p.y * scale })) as Quad) : q
      const crop = cropToRgba(guideImage, box, cardOutW, cardOutH)
      const m = matchCard(hashCard(crop), this.index, rule)
      detections.push({ box, match: m ? { id: m.entry.id, title: m.entry.title } : null })
      if (!m) unknownCards.push(quad ? { box, crop, quad } : { box, crop })
    }
    const t2 = now()

    const tracks = this.tracker.update(detections)
    return { tracks, unknownCards, timings: { findMs: t1 - t0, hashMs: t2 - t1, totalMs: now() - t0 } }
  }
}
