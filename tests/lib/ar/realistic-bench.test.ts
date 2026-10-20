/**
 * Realistic AR benchmark: the CURRENT pipeline on real Netflix poster art laid out as a TV and photographed
 * (see tests/helpers/ar-real-scene.ts and scripts/ar-bench/).
 *
 *   AR_BENCH=1 npx jest tests/lib/ar/realistic-bench
 *
 * Options (env): AR_BENCH_PER_CELL=all (scenes per layout x level; a number takes the first N), AR_BENCH_LEVEL=medium,
 * AR_BENCH_LAYOUT=landscape, AR_BENCH_WORKERS=6 (parallel OCR workers).
 *
 * Pipeline under test = what app/camera-vision/ar/page.tsx does: the frame is downsampled to 640x360, findCards finds boxes,
 * and for each box createTileReader (over a tesseract worker) reads the tile's HIGH-RESOLUTION pixels, then AutoLabeler validates
 * the candidates against a catalogue. The catalogue is a local stub (closest title among the whole poster set) instead of the
 * network; it has no vote counts, so the page's minVotes guard is not exercised. AR_BENCH_OLD=1 runs the original reader instead
 * (3x upscale, Otsu pass then plain, PSM 11, extractMovieTitles) for comparison. It prints numbers and does not assert on them.
 */
import { createWorker, Worker } from 'tesseract.js'
import { RgbaImage } from '../../../lib/card-hash'
import { Box } from '../../../lib/card-tracker'
import { findCards } from '../../../lib/ar/card-finder'
import { AutoLabeler } from '../../../lib/ar/auto-label'
import { cropToRgba } from '../../../lib/ar/rectify'
import { createTileReader, tesseractEngine } from '../../../lib/ar/tile-reader'
import { extractMovieTitles, wordsFromBlocks } from '../../../lib/extract-titles'
import { binarizeForOcr } from '../../../lib/ocr-preprocess'
import {
  BenchLevel, Layout, LAYOUTS, LEVELS, Overlay, RealScene, catalogueLookup, formatTable, knownTitles, loadScenes, runBenchmark, scoreScene, summarise, toPnm,
} from '../../helpers/ar-real-scene'

const OCR_SCALE = 3 // same as the page
const SAMPLE_W = 640 // the page resamples the guide region to 640x360 before finding cards

// 2x2 area average (what a canvas drawImage does at exactly 2:1).
function downscale(src: RgbaImage, w: number, h: number): RgbaImage {
  const out = new Uint8ClampedArray(w * h * 4)
  const sx = src.width / w
  const sy = src.height / h
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy)
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy))
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx))
      let r = 0, g = 0, b = 0
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * src.width + xx) * 4; r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2] }
      const n = (y1 - y0) * (x1 - x0)
      const o = (y * w + x) * 4
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255
    }
  }
  return { data: out, width: w, height: h }
}

// readTitles from the page, node edition: `box` is in video pixels here (scene pixels), already scaled from analysis pixels.
async function readTitlesOld(worker: Worker, frame: RgbaImage, box: Box): Promise<string[]> {
  const w = Math.max(1, Math.round(box.w * OCR_SCALE))
  const h = Math.max(1, Math.round(box.h * OCR_SCALE))
  for (const binarize of [true, false]) {
    const crop = cropToRgba(frame, box, w, h)
    if (binarize && !binarizeForOcr(crop.data)) continue
    const { data } = await worker.recognize(toPnm(crop, binarize), {}, { blocks: true })
    const found = extractMovieTitles(wordsFromBlocks(data.blocks as any), OCR_SCALE).map(t => t.title)
    if (found.length) return found
  }
  return []
}

// readTitles from the page today: the tile's camera pixels go to createTileReader.
async function readTitlesNew(worker: Worker, frame: RgbaImage, box: Box): Promise<string[]> {
  const crop = cropToRgba(frame, box, Math.max(1, Math.round(box.w)), Math.max(1, Math.round(box.h)))
  return (await createTileReader(tesseractEngine(worker as any)).read(crop)).candidates
}
const readTitles = process.env.AR_BENCH_OLD === '1' ? readTitlesOld : readTitlesNew

const RUN = process.env.AR_BENCH === '1'
const maybe = RUN ? describe : describe.skip

maybe('realistic AR benchmark: current pipeline', () => {
  jest.setTimeout(3 * 3600_000)
  const workers: Worker[] = []

  beforeAll(async () => {
    const n = Number(process.env.AR_BENCH_WORKERS ?? 6)
    for (let i = 0; i < n; i++) {
      const w = await createWorker('eng')
      await w.setParameters({ tessedit_pageseg_mode: 11 as any })
      workers.push(w)
    }
  })
  afterAll(async () => { await Promise.all(workers.map(w => w.terminate())) })

  it('prints per level and layout: tile recall/precision, title-read rate, wrong-title rate, end-to-end overlay rate', async () => {
    const perEnv = process.env.AR_BENCH_PER_CELL ?? 'all'
    const levels = process.env.AR_BENCH_LEVEL?.split(',') as BenchLevel[] | undefined
    const layouts = process.env.AR_BENCH_LAYOUT?.split(',') as Layout[] | undefined
    const scenes = loadScenes({ level: levels, layout: layouts, perCell: perEnv === 'all' ? undefined : Number(perEnv) })
    const lookup = catalogueLookup(knownTitles())

    const pipeline = async (scene: RealScene): Promise<Overlay[]> => {
      const frame = scene.image()
      const analysis = downscale(frame, SAMPLE_W, Math.round((SAMPLE_W * frame.height) / frame.width))
      const k = frame.width / analysis.width
      const boxes = findCards(analysis).map(b => ({ x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k }))
      const overlays: Overlay[] = new Array(boxes.length)
      let next = 0
      await Promise.all(workers.map(async worker => {
        for (;;) {
          const i = next++
          if (i >= boxes.length) return
          // a fresh labeller per card = the first attempt the live page would make on it (no cooldown / gap state)
          const labeler = new AutoLabeler({ readTitles: box => readTitles(worker, frame, box), lookup }, { minGapMs: 0 })
          const hit = await labeler.next([{ box: boxes[i] }])
          overlays[i] = { box: boxes[i], title: hit ? hit.title : null }
        }
      }))
      return overlays
    }

    const t0 = Date.now()
    const rows = await runBenchmark(scenes, pipeline, (s, t) => {
      if (process.env.AR_BENCH_VERBOSE) console.log(`${s.id}: gt ${t.gt} tp ${t.tp} fp ${t.fp} correct ${t.correct} wrong ${t.wrong}`)
    })
    const table = formatTable(rows)
    // eslint-disable-next-line no-console
    console.log(`\nREALISTIC BENCH (${scenes.length} scenes, ${((Date.now() - t0) / 1000).toFixed(0)} s)\n${table}\n`)
    expect(rows.length).toBeGreaterThan(0)
  })
})

// Always-on: the scoring rules every agent relies on (no dataset needed).
describe('realistic benchmark scoring', () => {
  const tile = (title: string, x: number, over: Partial<{ partial: boolean; legible: boolean }> = {}) => ({
    title, box: { x, y: 0, w: 100, h: 56 }, partial: false, legible: true, ...over,
  })
  const scene = {
    tiles: [tile('Dark', 0), tile('Roma', 120, { legible: false }), tile('Okja', 240), tile('Cut Off', 360, { partial: true })] as any,
    ignore: [{ x: 0, y: 200, w: 500, h: 100 }],
  }
  const at = (x: number, title: string | null, y = 0): Overlay => ({ box: { x, y, w: 100, h: 56 }, title })

  it('counts right, wrong, unread and missed tiles separately', () => {
    const t = scoreScene(scene, [at(0, 'Dark'), at(121, 'Wrong Film'), at(240, null)])
    expect(t).toMatchObject({ gt: 3, tp: 3, correct: 1, wrong: 1, unread: 1, fp: 0, legibleGt: 2, legibleTp: 2, correctLegible: 1 })
    const missed = scoreScene(scene, [at(0, 'Dark')])
    expect(missed).toMatchObject({ gt: 3, tp: 1, correct: 1 })
  })

  it('matches titles by canonical form, ignoring case and punctuation', () => {
    expect(scoreScene(scene, [at(0, 'DARK!')]).correct).toBe(1)
  })

  it('requires IoU >= 0.5 and reports boxes on nothing as false positives, titled ones as false overlays', () => {
    const t = scoreScene(scene, [at(60, 'Dark'), at(700, 'Roma'), at(700, null, 300)])
    expect(t.tp).toBe(0)
    expect(t.fp).toBe(3)
    expect(t.falseTitled).toBe(2)
  })

  it('tolerates detections on cut tiles and on the banner region', () => {
    const t = scoreScene(scene, [at(360, 'Cut Off'), { box: { x: 10, y: 205, w: 450, h: 90 }, title: null }])
    expect(t).toMatchObject({ fp: 0, det: 0, tp: 0, wrong: 0 })
  })

  it('one box can only claim one tile and vice versa', () => {
    const t = scoreScene(scene, [at(0, 'Dark'), at(2, 'Dark')])
    expect(t.tp).toBe(1)
    expect(t.fp).toBe(1)
  })

  it('formats a table with level and layout rows', () => {
    const fake = (level: BenchLevel, layout: Layout) => ({ id: `${layout}-1-${level}`, level, layout } as RealScene)
    const rows = summarise([{ scene: fake('mild', 'top10'), totals: scoreScene(scene, [at(0, 'Dark')]) }])
    const table = formatTable(rows)
    expect(table).toContain('mild   top10')
    expect(table).toContain('mild   ALL')
    expect(LEVELS.length + LAYOUTS.length).toBe(7)
  })
})
