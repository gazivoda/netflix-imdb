import { findCardsDetailed } from '../../../lib/ar/card-finder'
import { iou } from '../../../lib/card-tracker'
import { degrade, makeScene } from '../../helpers/ar-scene'

// The detector knows each tile's four corners (row lines, lean of the sides), not only their bounding box. A phone held at a slight
// angle makes the box include neighbour slivers and slant the text; OCR on a rectified crop needs the corners.

const scene = (i: number) => makeScene({ seed: 4000 + i, rows: 2, cols: 4, gapMin: 6, gapMax: 12 })

describe('detected tile corners', () => {
  it('lie on the real corners of tilted, keystoned tiles, within a few pixels', () => {
    let n = 0
    let sum = 0
    let worst = 0
    let boxSum = 0
    for (let i = 0; i < 8; i++) {
      const s = degrade(scene(i), { rotateDeg: i % 2 ? 3 : -3, keystone: 0.04 })
      const found = findCardsDetailed(s.image)
      for (const card of s.cards) {
        if (card.visible < 0.99) continue
        const hit = found.find(f => iou(f.box, card.box) >= 0.6)
        if (!hit) continue
        const err = card.quad.map((p, k) => Math.hypot(p.x - hit.quad[k].x, p.y - hit.quad[k].y))
        const b = hit.box
        const boxCorners = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]]
        boxSum += boxCorners.reduce((a, c, k) => a + Math.hypot(card.quad[k].x - c[0], card.quad[k].y - c[1]), 0) / 4
        n++
        sum += err.reduce((a, b) => a + b, 0) / 4
        worst = Math.max(worst, ...err)
      }
    }
    expect(n).toBeGreaterThan(20)
    expect(sum / n).toBeLessThan(3)
    expect(worst).toBeLessThan(15)
    expect(sum / n).toBeLessThan(0.7 * (boxSum / n)) // closer to the truth than the corners of the bounding box
  })

  it('are inside the frame and ordered tl, tr, br, bl, with the box as their bounding box', () => {
    const s = scene(1)
    for (const c of findCardsDetailed(s.image)) {
      const [tl, tr, br, bl] = c.quad
      expect(tl.x).toBeLessThanOrEqual(tr.x)
      expect(bl.x).toBeLessThanOrEqual(br.x)
      expect(tl.y).toBeLessThanOrEqual(bl.y + 1)
      expect(tr.y).toBeLessThanOrEqual(br.y + 1)
      for (const p of c.quad) {
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.x).toBeLessThanOrEqual(s.image.width)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeLessThanOrEqual(s.image.height)
      }
      const xs = c.quad.map(p => p.x)
      const ys = c.quad.map(p => p.y)
      expect(Math.abs(Math.min(...xs) - c.box.x)).toBeLessThanOrEqual(1.5)
      expect(Math.abs(Math.max(...ys) - (c.box.y + c.box.h))).toBeLessThanOrEqual(1.5)
    }
  })
})
