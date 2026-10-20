import { findCards } from '../../../lib/ar/card-finder'
import { Box, iou } from '../../../lib/card-tracker'
import { RgbaImage } from '../../../lib/card-hash'
import {
  Scene,
  SceneOptions,
  degrade,
  evaluate,
  groundTruth,
  makeScene,
  mulberry32,
  randomDegrade,
} from '../../helpers/ar-scene'

// Varied layouts: 1-3 rows, 3-6 columns, uneven gaps, focus border (sometimes enlarged), partial cards at the edges.
function layout(i: number, extra: Partial<SceneOptions> = {}): SceneOptions {
  const rng = mulberry32(i * 97 + 5)
  const rows = [1, 1, 2, 3, 1, 2][i % 6]
  return {
    seed: 1000 + i,
    rows,
    cols: rows === 3 ? 4 + Math.floor(rng() * 2) : 4 + Math.floor(rng() * 3),
    gapMin: 3 + Math.floor(rng() * 3),
    gapMax: 8 + Math.floor(rng() * 8),
    focus: i % 3 === 0,
    focusScale: i % 6 === 0 ? 1.1 : 1,
    partialEdges: i % 4 === 1,
    ...extra,
  }
}

interface Totals {
  tp: number
  fp: number
  fn: number
  iouSum: number
  failures: string[]
}

function run(scenes: Scene[], label: string): Totals {
  const t: Totals = { tp: 0, fp: 0, fn: 0, iouSum: 0, failures: [] }
  scenes.forEach((s, i) => {
    const found = findCards(s.image)
    const truth = groundTruth(s)
    const sc = evaluate(found, truth)
    for (const b of truth.boxes) t.iouSum += Math.max(0, ...found.map((d) => iou(d, b)))
    t.tp += sc.tp
    t.fp += sc.fp
    t.fn += sc.fn
    if (sc.fp || sc.fn) t.failures.push(`${label}#${i}: fn=${sc.fn} fp=${sc.fp} missed=${JSON.stringify(sc.missed)} spurious=${JSON.stringify(sc.spurious)}`)
  })
  return t
}

const recall = (t: Totals) => t.tp / Math.max(1, t.tp + t.fn)
const meanIou = (t: Totals) => t.iouSum / Math.max(1, t.tp + t.fn)
const precision = (t: Totals) => t.tp / Math.max(1, t.tp + t.fp)

function report(label: string, t: Totals) {
  // eslint-disable-next-line no-console
  console.log(`${label}: recall=${recall(t).toFixed(3)} precision=${precision(t).toFixed(3)} meanIoU=${meanIou(t).toFixed(3)} (tp=${t.tp} fn=${t.fn} fp=${t.fp})\n${t.failures.slice(0, 8).join('\n')}`)
}

const N = 36

describe('findCards on synthetic TV frames', () => {
  it('clean frames: recall and precision >= 0.9', () => {
    const t = run(Array.from({ length: N }, (_, i) => makeScene(layout(i))), 'clean')
    report('clean', t)
    expect(recall(t)).toBeGreaterThanOrEqual(0.9)
    expect(precision(t)).toBeGreaterThanOrEqual(0.9)
    // Boxes feed the hash, so they must be tight, not merely overlapping.
    expect(meanIou(t)).toBeGreaterThanOrEqual(0.9)
  })

  it('mildly degraded frames (tilt, keystone, blur, noise, glare, brightness): recall and precision >= 0.9', () => {
    const t = run(Array.from({ length: N }, (_, i) => degrade(makeScene(layout(i)), randomDegrade(i, 'mild'))), 'mild')
    report('mild', t)
    expect(recall(t)).toBeGreaterThanOrEqual(0.9)
    expect(precision(t)).toBeGreaterThanOrEqual(0.9)
  })

  it('survives tiny, blurred-away gaps (1-3 px) by using the 16:9 prior and the dips that remain', () => {
    const t = run(Array.from({ length: N }, (_, i) => degrade(makeScene(layout(i, { gapMin: 1, gapMax: 3 })), randomDegrade(i, 'mild'))), 'tiny-gaps')
    report('tiny gaps + mild degrade', t)
    expect(recall(t)).toBeGreaterThanOrEqual(0.9)
    expect(precision(t)).toBeGreaterThanOrEqual(0.9)
  })

  it('handles stronger camera damage (up to ~3 degrees of tilt, 6% keystone) and other resolutions', () => {
    const tilt = run(Array.from({ length: 12 }, (_, i) => degrade(makeScene(layout(i)), { rotateDeg: i % 2 ? 3 : -3, keystone: 0.06 })), 'tilt')
    const big = run(Array.from({ length: 6 }, (_, i) => makeScene(layout(i, { width: 1280, height: 720 }))), '720p')
    const small = run(Array.from({ length: 12 }, (_, i) => makeScene(layout(i, { width: 480, height: 270 }))), '270p')
    report('tilt 3deg + keystone', tilt)
    report('1280x720', big)
    report('480x270', small)
    for (const t of [tilt, big, small]) {
      expect(recall(t)).toBeGreaterThanOrEqual(0.9)
      expect(precision(t)).toBeGreaterThanOrEqual(0.9)
    }
  })

  it('light-background screens work too (auto polarity)', () => {
    const scenes = Array.from({ length: 12 }, (_, i) => makeScene(layout(i, { light: true })))
    const t = run(scenes, 'light')
    report('light', t)
    expect(recall(t)).toBeGreaterThanOrEqual(0.9)
    expect(precision(t)).toBeGreaterThanOrEqual(0.9)
  })

  it('returns [] for blank, noisy-blank and glare-only frames', () => {
    const blank = (r: number, g: number, b: number, w = 640, h = 360): RgbaImage => {
      const data = new Uint8ClampedArray(w * h * 4)
      for (let i = 0; i < w * h; i++) data.set([r, g, b, 255], i * 4)
      return { data, width: w, height: h }
    }
    expect(findCards(blank(10, 10, 12))).toEqual([])
    expect(findCards(blank(235, 235, 235))).toEqual([])
    const empty = makeScene({ seed: 1, rows: 1, cols: 5 })
    const clear = { ...empty, image: blank(10, 10, 12), cards: [] }
    expect(findCards(degrade(clear, { seed: 3, noise: 6 }).image)).toEqual([])
    expect(findCards(degrade(clear, { seed: 4, noise: 3, glare: { x: 0.5, y: 0.5, radius: 80, amp: 22 } }).image)).toEqual([])
  })

  it('ignores row-title text bars and tiny frames', () => {
    const s = makeScene({ seed: 5, rows: 1, cols: 5, titles: true })
    const boxes = findCards(s.image)
    expect(boxes.length).toBe(s.cards.length)
    expect(findCards({ data: new Uint8ClampedArray(16 * 16 * 4), width: 16, height: 16 })).toEqual([])
  })

  it('finds one box per card and the boxes do not overlap each other', () => {
    const s = makeScene({ seed: 42, rows: 2, cols: 5, gapMin: 4, gapMax: 9 })
    const boxes = findCards(s.image)
    expect(boxes.length).toBe(10)
    const { tp } = evaluate(boxes, groundTruth(s), 0.8)
    expect(tp).toBe(10)
  })

  it('keeps a lit focus tile with its bright border separate from its neighbours', () => {
    const s = makeScene({ seed: 77, rows: 1, cols: 5, focus: true, gapMin: 4, gapMax: 6 })
    const sc = evaluate(findCards(s.image), groundTruth(s))
    expect(sc.fn).toBe(0)
    expect(sc.fp).toBe(0)
  })

  it('handles an enlarged focus tile', () => {
    const s = makeScene({ seed: 78, rows: 1, cols: 5, focus: true, focusScale: 1.12 })
    const sc = evaluate(findCards(s.image), groundTruth(s))
    expect(sc.fn).toBe(0)
    expect(sc.fp).toBe(0)
  })

  it('reports partially visible edge cards only when at least ~60% is in view', () => {
    const s = makeScene({ seed: 90, rows: 1, cols: 5, partialEdges: true })
    const truth = groundTruth(s)
    const boxes = findCards(s.image)
    const sc = evaluate(boxes, truth)
    expect(sc.fn).toBe(0)
    expect(sc.fp).toBe(0)
    for (const b of boxes) expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= s.image.width && b.y + b.h <= s.image.height).toBe(true)
  })

  it('is fast on 640x360 (budget 60 ms, target ~15 ms)', () => {
    const scenes = [makeScene(layout(2)), degrade(makeScene(layout(3)), randomDegrade(3, 'mild')), makeScene(layout(0))]
    for (const s of scenes) findCards(s.image) // warm up the JIT
    const times: number[] = []
    for (let rep = 0; rep < 8; rep++) {
      for (const s of scenes) {
        const t0 = performance.now()
        findCards(s.image)
        times.push(performance.now() - t0)
      }
    }
    times.sort((a, b) => a - b)
    const median = times[times.length >> 1]
    // eslint-disable-next-line no-console
    console.log(`findCards 640x360: median ${median.toFixed(1)} ms, p90 ${times[Math.floor(times.length * 0.9)].toFixed(1)} ms, max ${times[times.length - 1].toFixed(1)} ms`)
    expect(median).toBeLessThan(60)
  })
})
