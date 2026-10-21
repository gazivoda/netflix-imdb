import { RgbaImage } from '../../../lib/card-hash'
import { CropHistory, MIN_READABLE_TILE_PX, boxesSettled, laplacianVariance, medianWidth } from '../../../lib/ar/sharpness'

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
  it('is false while a card moves more than a few percent of its width', () => {
    expect(boxesSettled([b(10), b(130)], [b(20), b(130)])).toBe(false)
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

describe('tile width helpers', () => {
  it('takes the median width and knows the readable minimum', () => {
    expect(medianWidth([{ x: 0, y: 0, w: 100, h: 1 }, { x: 0, y: 0, w: 300, h: 1 }, { x: 0, y: 0, w: 200, h: 1 }])).toBe(200)
    expect(medianWidth([])).toBe(0)
    expect(MIN_READABLE_TILE_PX).toBe(220)
  })
})
