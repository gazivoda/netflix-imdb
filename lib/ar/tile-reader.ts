// Reads the title off ONE card crop. The engine is abstract (tests run Tesseract in node, the page runs a tesseract.js worker),
// so everything here is pixels in, ranked strings out. See tests/lib/ar/tile-reader-bench.test.ts for the measured effect of
// each technique; the defaults below are the passes that earned their place on the realistic benchmark.
//
// Reading flow: a short plan of OCR passes, cheapest/best first. Each pass crops a region of the tile, upscales it, applies a
// pixel variant (sharpen / adaptive threshold / best colour channel ...) and runs the engine in a page-segmentation mode.
// Words become candidates (lines, multi-line joins, word runs, fused spaced letters), candidates from all passes are merged
// (agreeing passes raise the score) and the plan stops as soon as the leader is convincing.

import type { RgbaImage } from '../card-hash'
import { adaptiveBinarize, stretchContrast, unsharp, invertImage } from '../ocr-preprocess'
import { cropToRgba } from './rectify'
import { candidatesFromWords, mergeCandidates, normaliseCase, TitleCandidate, OcrWordLike, CandidateOptions } from './title-candidates'
import { tokensFromWords, VocabToken, Vocabulary } from './title-vocab'
import { wordsFromBlocks } from '../extract-titles'

export interface OcrImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface OcrHints {
  /** Tesseract page segmentation mode (11 sparse text, 6 block, 7 one line ...). Engines that cannot choose may ignore it. */
  psm?: number
  /** The image is greyscale (R = G = B): an engine may send one channel. */
  grey?: boolean
}

export interface OcrEngine {
  recognize(img: OcrImage, hints?: OcrHints): Promise<{ text: string; words: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }>
}

export interface TileReading {
  /** Best first, canonical-looking case ("THE GRAY MAN" -> "The Gray Man"). */
  candidates: string[]
  /** Scores (0..1) of `candidates`, same order. */
  scores: number[]
  /** All text the engine returned, for debugging. */
  raw: string
  /** OCR passes actually run (early exit keeps this small). */
  passes: number
  ms: number
}

export type Prep = 'col' | 'luma' | 'sharp' | 'sharp2' | 'sharpadapt' | 'adapt' | 'maxc' | 'inv'

export interface PassSpec {
  /** x, y, w, h as fractions of the crop. */
  region: [number, number, number, number]
  /** Upscale relative to the crop's own pixels (the output width is clamped to MIN_W..MAX_W). */
  scale: number
  /** Output width in px, overriding scale and the MIN_W..MAX_W clamp (the downscaled fallback pass). */
  width?: number
  prep: Prep
  psm: number
}

const FULL: PassSpec['region'] = [0, 0, 1, 1]

/** Order and content come from the greedy cover on the benchmark's tuning split (see the bench test and the report). */
export const DEFAULT_PASSES: PassSpec[] = [
  { region: FULL, scale: 4, prep: 'sharp2', psm: 11 },
  { region: FULL, scale: 4, prep: 'sharpadapt', psm: 11 },
  { region: [0, 0.2, 1, 0.6], scale: 3, prep: 'maxc', psm: 6 },
  { region: FULL, scale: 3, prep: 'sharp2', psm: 11 },
  { region: FULL, scale: 3, prep: 'maxc', psm: 11 },
  { region: [0, 0.65, 1, 0.35], scale: 3, prep: 'sharp', psm: 6 },
]

/**
 * Tried only when the main plan found no title at all. Large logo text can come back garbled from an upscaled pass and read fine
 * at ~200 px wide (measured on 240-400 px cards), and Netflix title logos usually sit in the lower left of the art.
 */
export const FALLBACK_PASSES: PassSpec[] = [
  { region: FULL, scale: 1, width: 200, prep: 'sharp', psm: 11 },
  { region: [0, 0.5, 0.7, 0.5], scale: 4, prep: 'sharp2', psm: 6 },
]

export interface TileReaderOptions {
  passes: PassSpec[]
  /** Run (in order) when `passes` produced no candidate above minScore. */
  fallbackPasses: PassSpec[]
  /** Stop when the best candidate scores at least this AND has this many agreeing passes. */
  confidentScore: number
  confidentSupport: number
  /** Stop as soon as a candidate this strong appears, even from a single pass. */
  certainScore: number
  maxCandidates: number
  /** Candidates scoring below this are not returned (wrong ratings are worse than none). */
  minScore: number
  /** Known titles to snap fragments / OCR slips onto (see title-vocab.ts). Snapped titles are exact, so lookups succeed. */
  vocabulary?: Vocabulary
  /** Score of a vocabulary title is vocabBase + (1 - vocabBase) * match quality. */
  vocabBase: number
  candidate: Partial<CandidateOptions>
  now: () => number
}

export const DEFAULT_TILE_READER: TileReaderOptions = {
  passes: DEFAULT_PASSES,
  fallbackPasses: FALLBACK_PASSES,
  confidentScore: 0.62,
  confidentSupport: 2,
  certainScore: 0.9,
  maxCandidates: 6,
  minScore: 0.4,
  vocabBase: 0.5,
  candidate: {},
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
}

const MIN_W = 360 // output width of a pass: below this OCR loses small text, above ~1000 it only costs time
const MAX_W = 1000
const MIN_SPREAD = 20 // 2..98 percentile luminance spread of the crop below which there is nothing to read

function lumaSpread(img: RgbaImage): number {
  const hist = new Array<number>(256).fill(0)
  const step = Math.max(1, Math.floor((img.width * img.height) / 4000)) // sampled: this is only a blank-frame check
  let n = 0
  for (let p = 0; p < img.width * img.height; p += step) {
    const i = p * 4
    hist[Math.round(0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2])]++
    n++
  }
  let acc = 0
  let lo = 0
  let hi = 255
  let gotLo = false
  for (let t = 0; t < 256; t++) {
    acc += hist[t]
    if (!gotLo && acc >= 0.02 * n) { lo = t; gotLo = true }
    if (acc >= 0.98 * n) { hi = t; break }
  }
  return hi - lo
}

/** Pixels the engine sees for one pass. Exposed so benchmarks can run exactly what the reader runs. */
export function preparePass(crop: RgbaImage, pass: PassSpec): { img: RgbaImage; grey: boolean } {
  const [fx, fy, fw, fh] = pass.region
  const box = { x: crop.width * fx, y: crop.height * fy, w: crop.width * fw, h: crop.height * fh }
  const outW = pass.width ?? Math.round(Math.min(MAX_W, Math.max(MIN_W, box.w * pass.scale)))
  const k = outW / Math.max(1, box.w)
  const big = cropToRgba(crop, box, outW, Math.max(8, Math.round(box.h * k)))
  switch (pass.prep) {
    case 'col': return { img: big, grey: false }
    case 'luma': return { img: stretchContrast(big), grey: true }
    case 'sharp': return { img: stretchContrast(unsharp(big, 1.5, 2)), grey: true }
    case 'sharp2': return { img: stretchContrast(unsharp(big, 3, 3)), grey: true }
    case 'sharpadapt': return { img: adaptiveBinarize(unsharp(big, 2, 3), Math.round(big.height / 6) | 1, 10), grey: true }
    case 'adapt': return { img: adaptiveBinarize(big, Math.round(big.height / 6) | 1, 10), grey: true }
    case 'maxc': return { img: stretchContrast(big, 'max-contrast'), grey: true }
    case 'inv': return { img: invertImage(stretchContrast(big)), grey: true }
  }
}

const isConfident = (top: TitleCandidate | undefined, o: TileReaderOptions) =>
  !!top && (top.score >= o.certainScore || (top.score >= o.confidentScore && top.support >= o.confidentSupport))

export function createTileReader(engine: OcrEngine, opts: Partial<TileReaderOptions> = {}): { read(crop: RgbaImage): Promise<TileReading> } {
  const o: TileReaderOptions = { ...DEFAULT_TILE_READER, ...opts }
  return {
    async read(crop: RgbaImage): Promise<TileReading> {
      const t0 = o.now()
      const lists: TitleCandidate[][] = []
      const tokens: VocabToken[] = []
      let raw = ''
      let passes = 0
      let merged: TitleCandidate[] = []
      if (crop.width >= 8 && crop.height >= 8 && lumaSpread(crop) >= MIN_SPREAD) {
        const run = async (plan: PassSpec[]): Promise<void> => {
          for (const pass of plan) {
            const { img, grey } = preparePass(crop, pass)
            const res = await engine.recognize(img, { psm: pass.psm, grey })
            passes++
            raw += (raw ? '\n' : '') + res.text.trim()
            lists.push(candidatesFromWords(res.words as OcrWordLike[], { imageHeight: img.height, ...o.candidate }))
            let snapped: TitleCandidate[] = []
            if (o.vocabulary) {
              tokens.push(...tokensFromWords(res.words as OcrWordLike[], img.height, passes - 1))
              snapped = o.vocabulary.match(tokens, 2).map(m => ({ text: m.title, score: o.vocabBase + (1 - o.vocabBase) * m.score, confidence: 90, words: 1, support: 1 }))
            }
            merged = mergeCandidates([...lists, snapped])
            if (isConfident(merged[0], o)) return
          }
        }
        await run(o.passes)
        if (!merged.some(c => c.score >= o.minScore)) await run(o.fallbackPasses)
      }
      const top = merged.filter(c => c.score >= o.minScore).slice(0, o.maxCandidates)
      return { candidates: top.map(c => normaliseCase(c.text)), scores: top.map(c => c.score), raw, passes, ms: o.now() - t0 }
    },
  }
}

// ---------- tesseract.js adapter ----------
/** The part of a tesseract.js (v5-v7) Worker the adapter uses. */
export interface TesseractWorkerLike {
  setParameters(params: Record<string, unknown>): Promise<unknown>
  recognize(image: any, options?: object, output?: object): Promise<{ data: { text: string; blocks?: any } }>
}

function toPnmBytes(img: OcrImage, grey: boolean): Uint8Array {
  const n = img.width * img.height
  const header = new TextEncoder().encode(`${grey ? 'P5' : 'P6'}\n${img.width} ${img.height}\n255\n`)
  const body = new Uint8Array(n * (grey ? 1 : 3))
  for (let i = 0; i < n; i++) {
    if (grey) body[i] = img.data[i * 4]
    else { body[i * 3] = img.data[i * 4]; body[i * 3 + 1] = img.data[i * 4 + 1]; body[i * 3 + 2] = img.data[i * 4 + 2] }
  }
  const out = new Uint8Array(header.length + body.length)
  out.set(header, 0)
  out.set(body, header.length)
  return out
}

// Browser: a canvas is the one raster type tesseract.js loads without encoding. Node (tests): a PNM buffer, which Leptonica reads.
function defaultToImage(img: OcrImage, grey: boolean): unknown {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0)
    return canvas
  }
  return Buffer.from(toPnmBytes(img, grey))
}

const OCR_PARAMS = { user_defined_dpi: '300', preserve_interword_spaces: '1' }

/**
 * Wraps a tesseract.js worker as an OcrEngine. Use `createWorker('eng')` once and keep it for the page's life; the page
 * segmentation mode is switched per pass only when it changes.
 */
export function tesseractEngine(worker: TesseractWorkerLike, toImage: (img: OcrImage, grey: boolean) => unknown = defaultToImage): OcrEngine {
  let psm: number | null = null
  let configured = false
  return {
    async recognize(img, hints = {}) {
      const want = hints.psm ?? 11
      if (psm !== want || !configured) {
        // The crops are rasters with no resolution tag: say what Tesseract should assume (otherwise it estimates, and warns), and
        // keep the spaces between words so a logo's words are not glued together.
        await worker.setParameters({ tessedit_pageseg_mode: String(want), ...(configured ? {} : OCR_PARAMS) })
        psm = want
        configured = true
      }
      const { data } = await worker.recognize(toImage(img, !!hints.grey), {}, { blocks: true })
      return { text: data.text ?? '', words: wordsFromBlocks(data.blocks) }
    },
  }
}
