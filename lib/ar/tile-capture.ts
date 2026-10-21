// Geometry the AR page needs to hand OCR the right pixels: where a tile's corners sit in its bounding-box crop, whether they are
// off-axis enough to be worth rectifying, and how big the rectified card should be. Pure.

import type { Box } from '../card-tracker'
import type { Pt } from './rectify'

export type Quad = [Pt, Pt, Pt, Pt]

/** The quad (any coordinate system) re-expressed relative to `origin` and multiplied by (sx, sy). */
export function quadInCrop(quad: Quad, origin: { x: number; y: number }, sx: number, sy: number): Quad {
  return quad.map(p => ({ x: (p.x - origin.x) * sx, y: (p.y - origin.y) * sy })) as Quad
}

/**
 * Whether the quad deviates from the axis-aligned rectangle `box` by more than `tol` of the box width at some corner. A tile that
 * is a straight rectangle is cropped as it is; a tilted or keystoned one is rectified first (slanted text reads worse).
 */
export function quadIsSkewed(quad: Quad, box: Box, tol = 0.025): boolean {
  const corners: [number, number][] = [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h]]
  return quad.some((p, i) => Math.hypot(p.x - corners[i][0], p.y - corners[i][1]) > tol * box.w)
}

/** Size of the rectified card: mean of the opposite edges, so no stretch is invented. */
export function quadSize(quad: Quad): { w: number; h: number } {
  const len = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
  return { w: Math.max(1, Math.round((len(quad[0], quad[1]) + len(quad[3], quad[2])) / 2)), h: Math.max(1, Math.round((len(quad[0], quad[3]) + len(quad[1], quad[2])) / 2)) }
}
