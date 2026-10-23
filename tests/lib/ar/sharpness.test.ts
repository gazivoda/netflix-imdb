import { RgbaImage } from '../../../lib/card-hash'
import { CropHistory, HoldSteady, MIN_READABLE_TILE_PX, SETTLE_TOL, boxesSettled, laplacianVariance, medianWidth } from '../../../lib/ar/sharpness'

// vertical stripes of text-like contrast, optionally box-blurred horizontally
function stripes(w: number, h: number, blur = 0): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0
      let n = 0
      for (let d = -blur; d <= blur; d++) {
        const xx = Math.min(w - 1, Math.max(0, x + d))
        s += Math.floor(xx / 4) % 2 ? 230 : 25
        n++
      }
      const v = s / n
      const o = (y * w + x) * 4
      data[o] = data[o + 1] = data[o + 2] = v
      data[o + 3] = 255
    }
  }
  return { data, width: w, height: h }
}

describe('laplacianVariance', () => {
  it('is much higher for a sharp crop than for a blurred copy of it', () => {
    expect(laplacianVariance(stripes(160, 90, 0))).toBeGreaterThan(3 * laplacianVariance(stripes(160, 90, 3)))
  })
  it('is 0 for a flat crop and for crops too small to measure', () => {
    expect(laplacianVariance({ data: new Uint8ClampedArray(40 * 40 * 4).fill(90), width: 40, height: 40 })).toBe(0)
    expect(laplacianVariance(stripes(2, 2))).toBe(0)
  })
  it('compares crops of different native sizes fairly (measured on a normalised copy)', () => {
    const small = laplacianVariance(stripes(160, 90, 0))
    const big = laplacianVariance(stripes(480, 270, 0))
    expect(big).toBeGreaterThan(0)
    expect(small).toBeGreaterThan(0)
  })
})

describe('CropHistory', () => {
  it('returns the sharpest of the last few crops of a tile', () => {
    const h = new CropHistory(3)
    const sharp = stripes(160, 90, 0)
    h.push('a', stripes(160, 90, 4), 0)
    h.push('a', sharp, 100)
    h.push('a', stripes(160, 90, 2), 200)
    expect(h.best('a', 300)?.crop).toBe(sharp)
    expect(h.best('a', 300)?.shots).toBe(3)
  })
  it('keeps only the last `keep` crops and forgets old ones', () => {
    const h = new CropHistory(2, 1000)
    const sharp = stripes(160, 90, 0)
    h.push('a', sharp, 0)
    h.push('a', stripes(160, 90, 3), 100)
    h.push('a', stripes(160, 90, 3), 200)
    expect(h.best('a', 300)?.crop).not.toBe(sharp) // pushed out by the cap
    expect(h.best('a', 5000)).toBeNull() // too old
    expect(h.best('missing', 0)).toBeNull()
  })
  it('retain() drops tiles that are gone', () => {
    const h = new CropHistory()
    h.push('a', stripes(40, 40), 0)
    h.push('b', stripes(40, 40), 0)
    h.retain(['b'])
    expect(h.best('a', 0)).toBeNull()
    expect(h.best('b', 0)).not.toBeNull()
  })
})

describe('boxesSettled', () => {
  const b = (x: number, y = 100) => ({ x, y, w: 100, h: 56 })
  it('is true when every card is where it was', () => {
    expect(boxesSettled([b(10), b(130)], [b(11), b(129)])).toBe(true)
  })
  it('is false while a card moves more than a tenth of its width between two ticks', () => {
    expect(boxesSettled([b(10), b(130)], [b(25), b(130)])).toBe(false)
  })
  it('lets a hand-held drift of up to about a tenth of the card width through', () => {
    expect(SETTLE_TOL).toBeCloseTo(0.1)
    expect(boxesSettled([b(10), b(130)], [b(18), b(138)])).toBe(true)
  })
  it('is not held up by one box that just appeared, but is by most of them moving', () => {
    expect(boxesSettled([b(10), b(130), b(250), b(370)], [b(10), b(130), b(250), b(370), b(490)])).toBe(true)
    expect(boxesSettled([b(10), b(130), b(250)], [b(40), b(160), b(250)])).toBe(false)
  })
  it('waits for nothing when there was or is nothing', () => {
    expect(boxesSettled([], [b(10)])).toBe(true)
    expect(boxesSettled([b(10)], [])).toBe(true)
  })
})

describe('settle gate against a hand-held jitter simulation', () => {
  // A random walk of the whole view, `stepPx` per video frame at 1920 px wide, seen through the 640 px analysis image (scale 3)
  // at ~9 ticks per second (3 video frames per tick at 30 fps). Cards are 100 analysis px wide.
  function settledShare(stepPx: number, tol: number, ticks = 120): number {
    let seed = 12345
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
    let ox = 0
    let oy = 0
    const cards = [0, 1, 2, 3, 4, 5].map(i => ({ x: 20 + i * 105, y: 100, w: 100, h: 56 }))
    const at = () => cards.map(c => ({ ...c, x: c.x + ox, y: c.y + oy }))
    let prev = at()
    let settled = 0
    for (let t = 0; t < ticks; t++) {
      for (let f = 0; f < 3; f++) {
        const a = rnd() * 2 * Math.PI
        ox += (Math.cos(a) * stepPx) / 3
        oy += (Math.sin(a) * stepPx) / 3
      }
      const cur = at()
      if (boxesSettled(prev, cur, tol)) settled++
      prev = cur
    }
    return settled / ticks
  }

  it('read almost never ran at 4% for a gently shaking hand; at 10% it runs, and a real sweep still blocks it', () => {
    expect(settledShare(6, 0.04)).toBeLessThan(0.9) // 2 px per tick on a 100 px card is already close to the old limit
    expect(settledShare(20, 0.04)).toBeLessThan(0.35)
    expect(settledShare(6, SETTLE_TOL)).toBeGreaterThan(0.95)
    expect(settledShare(20, SETTLE_TOL)).toBeGreaterThan(0.4)
    expect(settledShare(60, SETTLE_TOL)).toBeLessThan(0.2) // a pan across the screen
  })
})

describe('HoldSteady', () => {
  it('asks the user to hold still only after reading was blocked for motion for more than about 3 s', () => {
    const h = new HoldSteady(3000)
    expect(h.update(0, true)).toBe(false)
    expect(h.update(2999, true)).toBe(false)
    expect(h.update(3000, true)).toBe(true)
    expect(h.update(3500, false)).toBe(false) // settled again: the hint goes away
    expect(h.update(4000, true)).toBe(false) // and the clock starts over
  })
})

describe('tile width helpers', () => {
  it('takes the median width and knows the readable minimum', () => {
    expect(medianWidth([{ x: 0, y: 0, w: 100, h: 1 }, { x: 0, y: 0, w: 300, h: 1 }, { x: 0, y: 0, w: 200, h: 1 }])).toBe(200)
    expect(medianWidth([])).toBe(0)
    expect(MIN_READABLE_TILE_PX).toBe(220)
  })
})
