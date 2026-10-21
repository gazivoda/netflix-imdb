/**
 * Tile detection on the realistic benchmark (real Netflix poster art laid out as a TV and "photographed": see
 * tests/helpers/ar-real-scene.ts and scripts/ar-bench/). Detection only, no OCR: every scene is downsampled to 640x360 the way
 * the page does it, findCards finds boxes, and they are scored against the ground-truth tiles (IoU >= 0.5; cut tiles and the
 * hero banner are neither right nor wrong).
 *
 * The dataset is built once (node scripts/ar-bench/fetch.mjs && node scripts/ar-bench/render.mjs, needs an OMDb key and sharp)
 * and is git-ignored: without it this suite is skipped. Baseline before the gradient-lattice detector (foreground-mask finder):
 *   clean 44% recall / 81% precision, mild 29% / 47%, medium 24% / 48%, severe 17% / 54%; Top-10 posters 3%.
 */
import fs from 'fs'
import path from 'path'
import { RgbaImage } from '../../../lib/card-hash'
import { findCards } from '../../../lib/ar/card-finder'
import { BenchLevel, DATASET_DIR, Layout, RealScene, Totals, addTotals, emptyTotals, loadScenes, scoreScene } from '../../helpers/ar-real-scene'

const HAVE_DATA = fs.existsSync(path.join(DATASET_DIR, 'index.json'))
const maybe = HAVE_DATA ? describe : describe.skip

// 2x2 area average: what a canvas drawImage does when the page resamples the 1280x720 guide region to 640x360.
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
      let r = 0
      let g = 0
      let b = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * src.width + xx) * 4
          r += src.data[i]
          g += src.data[i + 1]
          b += src.data[i + 2]
        }
      }
      const n = (y1 - y0) * (x1 - x0)
      const o = (y * w + x) * 4
      out[o] = r / n
      out[o + 1] = g / n
      out[o + 2] = b / n
      out[o + 3] = 255
    }
  }
  return { data: out, width: w, height: h }
}

function detect(scene: RealScene): { totals: Totals; ms: number } {
  const frame = scene.image()
  const analysis = downscale(frame, 640, Math.round((640 * frame.height) / frame.width))
  const k = frame.width / analysis.width
  const t0 = performance.now()
  const boxes = findCards(analysis).map((b) => ({ x: b.x * k, y: b.y * k, w: b.w * k, h: b.h * k }))
  const ms = performance.now() - t0
  return { totals: scoreScene(scene, boxes.map((box) => ({ box, title: null }))), ms }
}

const pct = (n: number, d: number) => (d ? n / d : 0)

maybe('tile detection on the realistic benchmark', () => {
  jest.setTimeout(120_000)
  const byCell = new Map<string, Totals>()
  let frames = 0
  let totalMs = 0

  beforeAll(() => {
    for (const scene of loadScenes()) {
      const { totals, ms } = detect(scene)
      frames++
      totalMs += ms
      const key = `${scene.level}/${scene.layout}`
      byCell.set(key, addTotals(byCell.get(key) ?? emptyTotals(), totals))
    }
    // eslint-disable-next-line no-console
    console.log(
      'tile detection (recall / precision):\n' +
        (['clean', 'mild', 'medium', 'severe'] as BenchLevel[])
          .map((level) => {
            const all = cellsOf(level)
            return `  ${level.padEnd(6)} all ${fmt(all)}   ` + (['landscape', 'caption', 'top10', 'plain'] as Layout[]).map((l) => `${l} ${fmt(byCell.get(`${level}/${l}`) ?? emptyTotals())}`).join('   ')
          })
          .join('\n') +
        `\n  ${(totalMs / frames).toFixed(1)} ms per frame`,
    )
  })

  const cellsOf = (level: BenchLevel, layouts: Layout[] = ['landscape', 'caption', 'top10']): Totals => {
    const t = emptyTotals()
    for (const l of layouts) addTotals(t, byCell.get(`${level}/${l}`) ?? emptyTotals())
    return t
  }
  const recall = (t: Totals) => pct(t.tp, t.gt)
  const precision = (t: Totals) => pct(t.tp, t.tp + t.fp)
  const fmt = (t: Totals) => `${(100 * recall(t)).toFixed(0)}/${(100 * precision(t)).toFixed(0)}`

  it('finds the tiles of clean frames (the old finder: 44% recall, 3% on Top-10 posters)', () => {
    const t = cellsOf('clean')
    expect(recall(t)).toBeGreaterThanOrEqual(0.9)
    expect(precision(t)).toBeGreaterThanOrEqual(0.9)
    expect(recall(cellsOf('clean', ['top10']))).toBeGreaterThanOrEqual(0.85)
    expect(recall(cellsOf('clean', ['landscape']))).toBeGreaterThanOrEqual(0.8)
  })

  it('finds the tiles of mildly and moderately photographed frames (old: 29% / 24% recall)', () => {
    const mild = cellsOf('mild')
    expect(recall(mild)).toBeGreaterThanOrEqual(0.88)
    expect(precision(mild)).toBeGreaterThanOrEqual(0.85)
    const medium = cellsOf('medium')
    expect(recall(medium)).toBeGreaterThanOrEqual(0.82)
    expect(precision(medium)).toBeGreaterThanOrEqual(0.85)
    for (const level of ['mild', 'medium'] as BenchLevel[]) expect(recall(cellsOf(level, ['top10']))).toBeGreaterThanOrEqual(0.8)
  })

  it('still finds a useful share under severe damage (rotation, keystone, blur, glare, JPEG 40) without inventing tiles', () => {
    const t = cellsOf('severe')
    expect(recall(t)).toBeGreaterThanOrEqual(0.55)
    expect(precision(t)).toBeGreaterThanOrEqual(0.8)
  })

  it('stays within the frame budget', () => {
    expect(totalMs / frames).toBeLessThan(25)
  })
})
