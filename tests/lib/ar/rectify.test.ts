import { cropToRgba, warpQuad, Pt } from '../../../lib/ar/rectify'
import { RgbaImage } from '../../../lib/card-hash'
import { degrade, makeScene, renderCardArt } from '../../helpers/ar-scene'

// Image whose red channel encodes x and green encodes y, so any resample can be checked against coordinates.
function coordImage(w: number, h: number, sx = 1, sy = 1): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      data[o] = x * sx
      data[o + 1] = y * sy
      data[o + 2] = 40
      data[o + 3] = 255
    }
  }
  return { data, width: w, height: h }
}

const px = (img: RgbaImage, x: number, y: number) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4))
const meanAbsDiff = (a: RgbaImage, b: RgbaImage) => {
  let s = 0
  for (let i = 0; i < a.data.length; i += 4) s += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])
  return s / (a.data.length / 4 * 3)
}

describe('cropToRgba', () => {
  const img = coordImage(100, 60, 2, 3)

  it('copies the pixels exactly when the box and output sizes match', () => {
    const out = cropToRgba(img, { x: 10, y: 20, w: 30, h: 15 }, 30, 15)
    expect(out.width).toBe(30)
    expect(out.height).toBe(15)
    for (const [x, y] of [[0, 0], [29, 0], [0, 14], [29, 14], [13, 7]]) {
      expect(px(out, x, y)).toEqual(px(img, 10 + x, 20 + y))
    }
  })

  it('interpolates bilinearly when upscaling and replicates the edge', () => {
    const two: RgbaImage = { data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]), width: 2, height: 1 }
    const out = cropToRgba(two, { x: 0, y: 0, w: 2, h: 1 }, 4, 1)
    expect(Array.from({ length: 4 }, (_, i) => out.data[i * 4])).toEqual([0, 64, 191, 255])
  })

  it('averages instead of aliasing when shrinking a fine checkerboard', () => {
    const w = 64
    const data = new Uint8ClampedArray(w * w * 4)
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) data.set([(x + y) % 2 ? 255 : 0, (x + y) % 2 ? 255 : 0, (x + y) % 2 ? 255 : 0, 255], (y * w + x) * 4)
    const out = cropToRgba({ data, width: w, height: w }, { x: 0, y: 0, w, h: w }, 4, 4)
    for (let i = 0; i < 16; i++) expect(Math.abs(out.data[i * 4] - 127.5)).toBeLessThan(20)
  })

  it('clamps boxes that stick out of the image', () => {
    const inside = cropToRgba(img, { x: 0, y: 0, w: 20, h: 10 }, 20, 10)
    const sticking = cropToRgba(img, { x: -30, y: -20, w: 50, h: 30 }, 20, 10)
    expect(meanAbsDiff(inside, sticking)).toBeLessThan(1)
  })

  it('never throws on degenerate or off-image boxes and always returns the requested size and opaque alpha', () => {
    for (const box of [{ x: 500, y: 500, w: 10, h: 10 }, { x: 5, y: 5, w: 0, h: 0 }, { x: -10, y: -10, w: 3, h: 3 }, { x: 50, y: 10, w: -5, h: 8 }]) {
      const out = cropToRgba(img, box, 8, 4)
      expect(out.data.length).toBe(8 * 4 * 4)
      for (let i = 3; i < out.data.length; i += 4) expect(out.data[i]).toBe(255)
      expect(out.data.every((v) => Number.isFinite(v))).toBe(true)
    }
  })
})

describe('warpQuad', () => {
  const img = coordImage(200, 120, 1, 2)
  const quad = (a: number[][]) => a.map(([x, y]) => ({ x, y })) as [Pt, Pt, Pt, Pt]

  it('matches cropToRgba for an axis-aligned quad', () => {
    const w = 60
    const h = 34
    const warped = warpQuad(img, quad([[40, 30], [100, 30], [100, 64], [40, 64]]), w, h)
    const cropped = cropToRgba(img, { x: 40, y: 30, w: 60, h: 34 }, w, h)
    expect(meanAbsDiff(warped, cropped)).toBeLessThan(0.5)
  })

  it('maps the output corners and centre to the quad corners and diagonal intersection (true perspective)', () => {
    // Keystone: top edge narrower than the bottom edge.
    const q = quad([[60, 20], [140, 24], [180, 100], [20, 96]])
    const out = warpQuad(img, q, 160, 90)
    const near = (got: number[], x: number, y: number) => {
      expect(Math.abs(got[0] - x)).toBeLessThanOrEqual(3)
      expect(Math.abs(got[1] - y * 2)).toBeLessThanOrEqual(6)
    }
    near(px(out, 0, 0), 60, 20)
    near(px(out, 159, 0), 140, 24)
    near(px(out, 159, 89), 180, 100)
    near(px(out, 0, 89), 20, 96)
    // Diagonal intersection of tl-br and tr-bl: the centre of a projective square maps there, not to the quad's mean.
    const [p0, p1, p2, p3] = q
    const d1 = { x: p2.x - p0.x, y: p2.y - p0.y }
    const d2 = { x: p3.x - p1.x, y: p3.y - p1.y }
    const tt = ((p1.x - p0.x) * d2.y - (p1.y - p0.y) * d2.x) / (d1.x * d2.y - d1.y * d2.x)
    const cx = p0.x + tt * d1.x
    const cy = p0.y + tt * d1.y
    near(px(out, 80, 45), cx, cy)
    expect(Math.hypot(cx - (p0.x + p1.x + p2.x + p3.x) / 4, cy - (p0.y + p1.y + p2.y + p3.y) / 4)).toBeGreaterThan(1)
  })

  it('undoes a rotation plus keystone on a synthetic card (recovers the original art)', () => {
    const scene = makeScene({ seed: 3, rows: 1, cols: 4, titles: false })
    const art = renderCardArt(3 * 1000 + 1, Math.round(scene.cards[0].quad[1].x - scene.cards[0].quad[0].x), Math.round(scene.cards[0].quad[3].y - scene.cards[0].quad[0].y))
    const shot = degrade(scene, { rotateDeg: 5, keystone: 0.05 })
    const out = warpQuad(shot.image, shot.cards[0].quad as [Pt, Pt, Pt, Pt], art.width, art.height)
    expect(meanAbsDiff(out, art)).toBeLessThan(10)
    // A quad with its corners in the wrong order must not pass for the same card.
    const q = shot.cards[0].quad
    const wrong = warpQuad(shot.image, [q[1], q[2], q[3], q[0]], art.width, art.height)
    expect(meanAbsDiff(wrong, art)).toBeGreaterThan(30)
  })

  it('returns a blank image of the right size for a degenerate quad and replicates edges for off-image quads', () => {
    const flat = warpQuad(img, quad([[10, 10], [50, 10], [90, 10], [130, 10]]), 12, 8)
    expect(flat.width).toBe(12)
    expect(flat.height).toBe(8)
    expect(flat.data.every((v, i) => (i % 4 === 3 ? v === 255 : v === 0))).toBe(true)
    const off = warpQuad(img, quad([[-50, -50], [-10, -50], [-10, -10], [-50, -10]]), 6, 6)
    expect(off.data.every((v) => Number.isFinite(v))).toBe(true)
    expect(px(off, 3, 3)).toEqual(px(img, 0, 0))
  })
})
