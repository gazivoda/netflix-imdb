import { binarizeForOcr } from '../../lib/ocr-preprocess'

const BLACK = [0, 0, 0]
const WHITE = [255, 255, 255]

// Build RGBA pixels from a grid of RGB values, one entry per pixel.
function rgba(pixels: number[][]): Uint8ClampedArray {
  return Uint8ClampedArray.from(pixels.flatMap(([r, g, b]) => [r, g, b, 255]))
}

function rgbAt(data: Uint8ClampedArray, pixel: number): number[] {
  return [data[pixel * 4], data[pixel * 4 + 1], data[pixel * 4 + 2]]
}

describe('binarizeForOcr', () => {
  it('reports a uniform frame as having nothing to read and leaves it untouched', () => {
    const data = rgba(Array.from({ length: 16 }, () => [30, 30, 30]))
    const before = Array.from(data)
    expect(binarizeForOcr(data)).toBe(false)
    expect(Array.from(data)).toEqual(before)
  })

  // Regression: the old "is the frame empty?" check looked only at pixel (0,0), so any
  // dark-UI screen (Netflix) with a black corner was skipped and OCR never ran.
  it('does not treat a frame with a black top-left pixel as empty when it has text', () => {
    const data = rgba([
      [10, 10, 10], [10, 10, 10], [10, 10, 10], [240, 240, 240],
      [10, 10, 10], [240, 240, 240], [10, 10, 10], [10, 10, 10],
    ])
    expect(binarizeForOcr(data)).toBe(true)
  })

  it('turns light text on a dark background into black text on white', () => {
    // 1 light "text" pixel among 7 dark background pixels
    const data = rgba([
      [10, 10, 10], [10, 10, 10], [10, 10, 10], [240, 240, 240],
      [10, 10, 10], [10, 10, 10], [10, 10, 10], [10, 10, 10],
    ])
    binarizeForOcr(data)
    expect(rgbAt(data, 0)).toEqual(WHITE) // background
    expect(rgbAt(data, 3)).toEqual(BLACK) // text
  })

  it('keeps dark text on a light background as black on white', () => {
    const data = rgba([
      [240, 240, 240], [240, 240, 240], [240, 240, 240], [10, 10, 10],
      [240, 240, 240], [240, 240, 240], [240, 240, 240], [240, 240, 240],
    ])
    binarizeForOcr(data)
    expect(rgbAt(data, 0)).toEqual(WHITE)
    expect(rgbAt(data, 3)).toEqual(BLACK)
  })

  it('outputs only pure black or white, fully opaque', () => {
    const data = rgba([[0, 0, 0], [60, 60, 60], [120, 120, 120], [200, 200, 200], [255, 255, 255], [90, 90, 90]])
    binarizeForOcr(data)
    for (let i = 0; i < data.length; i += 4) {
      expect([0, 255]).toContain(data[i])
      expect(data[i + 1]).toBe(data[i])
      expect(data[i + 2]).toBe(data[i])
      expect(data[i + 3]).toBe(255)
    }
  })
})
