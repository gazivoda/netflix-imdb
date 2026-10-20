import { RgbaImage } from '../../lib/card-hash'
import { adaptiveBinarize, invertImage, otsuBinarize, stretchContrast, toGrey, unsharp } from '../../lib/ocr-preprocess'

function image(w: number, h: number, px: (x: number, y: number) => [number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = px(x, y)
    data.set([r, g, b, 255], (y * w + x) * 4)
  }
  return { data, width: w, height: h }
}
const at = (img: RgbaImage, x: number, y: number) => img.data[(y * img.width + x) * 4]

describe('toGrey', () => {
  it('returns a new grey image and leaves the source alone', () => {
    const src = image(2, 1, () => [200, 100, 50])
    const g = toGrey(src)
    expect(g).not.toBe(src)
    expect(g.data[0]).toBe(g.data[1])
    expect(g.data[1]).toBe(g.data[2])
    expect(Array.from(src.data.slice(0, 3))).toEqual([200, 100, 50])
  })

  it('max-contrast picks the channel where the text stands out (red text on blue is invisible in the red channel only if equal)', () => {
    // text pixels differ from background ONLY in green; luma barely moves, green separates them fully
    const src = image(8, 8, (x) => (x < 4 ? [100, 0, 100] : [100, 255, 100]))
    const g = toGrey(src, 'max-contrast')
    expect(Math.abs(at(g, 0, 0) - at(g, 7, 0))).toBe(255)
  })
})

describe('stretchContrast', () => {
  it('maps a dim, low-contrast image onto the full range', () => {
    const src = image(10, 10, (x) => (x < 5 ? [90, 90, 90] : [110, 110, 110]))
    const s = stretchContrast(src)
    expect(at(s, 0, 0)).toBe(0)
    expect(at(s, 9, 0)).toBe(255)
  })
})

describe('invertImage', () => {
  it('inverts colour and keeps alpha opaque', () => {
    const inv = invertImage(image(1, 1, () => [10, 20, 30]))
    expect(Array.from(inv.data)).toEqual([245, 235, 225, 255])
  })
})

describe('unsharp', () => {
  it('steepens a blurred edge: the dark side gets darker and the light side lighter', () => {
    const blurred = image(40, 8, (x) => { const v = Math.round(255 / (1 + Math.exp(-(x - 20) / 3))); return [v, v, v] })
    const sharp = unsharp(blurred, 2, 3)
    expect(at(sharp, 16, 4)).toBeLessThan(at(blurred, 16, 4))
    expect(at(sharp, 24, 4)).toBeGreaterThan(at(blurred, 24, 4))
  })
})

describe('adaptiveBinarize', () => {
  // light text on a background whose brightness ramps left to right: a single global threshold cannot separate both ends
  const ramp = image(60, 20, (x, y) => {
    const bg = 20 + x * 3
    const text = y >= 8 && y <= 11 && (x % 12) < 6
    const v = text ? bg + 60 : bg
    return [v, v, v]
  })

  it('finds text at both ends of a brightness gradient, black on white', () => {
    const b = adaptiveBinarize(ramp, 15, 10)
    expect(at(b, 2, 9)).toBe(0) // text in the dark part
    expect(at(b, 50, 9)).toBe(0) // text in the bright part
    expect(at(b, 8, 9)).toBe(255) // gap between letters
    expect(at(b, 30, 2)).toBe(255) // background
  })

  it('keeps dark text on a light background as black on white', () => {
    const dark = image(40, 20, (x, y) => (y >= 8 && y <= 11 && x % 12 < 6 ? [30, 30, 30] : [220, 220, 220]))
    const b = adaptiveBinarize(dark, 15, 10)
    expect(at(b, 2, 9)).toBe(0)
    expect(at(b, 8, 2)).toBe(255)
  })
})

describe('otsuBinarize', () => {
  it('matches the in-place binariser polarity (light text on dark -> black on white) without touching the source', () => {
    const src = image(10, 10, (x, y) => (x === 5 && y < 5 ? [240, 240, 240] : [15, 15, 15]))
    const before = Array.from(src.data)
    const out = otsuBinarize(src)!
    expect(at(out, 5, 0)).toBe(0)
    expect(at(out, 0, 9)).toBe(255)
    expect(Array.from(src.data)).toEqual(before)
  })

  it('returns null for a flat image', () => {
    expect(otsuBinarize(image(5, 5, () => [40, 40, 40]))).toBeNull()
  })
})
