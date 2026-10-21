// Picking the frame to read. A hand-held phone gives a different crop of the same card every tick: some are motion-blurred or
// caught mid-refocus. OCR is the expensive step, so it is worth reading the sharpest of the last few crops of a tile, and not
// reading at all while the card is still moving across the frame. Pure and DOM-free.

import type { RgbaImage } from '../card-hash'
import type { Box } from '../card-tracker'

/**
 * Variance of the Laplacian of the luminance, the standard focus measure: edges in a sharp crop are steep, so the second
 * derivative swings widely; blur flattens it. Measured on a copy at most `maxW` px wide (area-averaged), so crops of different
 * native sizes compare fairly and the cost stays small.
 */
export function laplacianVariance(img: RgbaImage, maxW = 160): number {
  const step = Math.max(1, Math.floor(img.width / maxW))
  const w = Math.floor(img.width / step)
  const h = Math.floor(img.height / step)
  if (w < 3 || h < 3) return 0
  const g = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let yy = 0; yy < step; yy++) {
        let o = ((y * step + yy) * img.width + x * step) * 4
        for (let xx = 0; xx < step; xx++, o += 4) s += 0.299 * img.data[o] + 0.587 * img.data[o + 1] + 0.114 * img.data[o + 2]
      }
      g[y * w + x] = s / (step * step)
    }
  }
  let sum = 0
  let sum2 = 0
  let n = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const l = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i]
      sum += l
      sum2 += l * l
      n++
    }
  }
  const mean = sum / n
  return sum2 / n - mean * mean
}

interface Shot<M> {
  crop: RgbaImage
  sharpness: number
  at: number
  meta: M | undefined
}

/** The last few crops of each tile (by tile key) with their sharpness, and whatever `meta` the caller attached to each (e.g. its corners). */
export class CropHistory<M = undefined> {
  private shots = new Map<string, Shot<M>[]>()

  constructor(private keep = 3, private maxAgeMs = 2500) {}

  push(key: string, crop: RgbaImage, now: number, meta?: M): void {
    const list = (this.shots.get(key) ?? []).filter(s => now - s.at <= this.maxAgeMs)
    list.push({ crop, sharpness: laplacianVariance(crop), at: now, meta })
    while (list.length > this.keep) list.shift()
    this.shots.set(key, list)
  }

  /** The sharpest recent crop of the tile, or null when there is none (or all are older than maxAgeMs). */
  best(key: string, now: number): { crop: RgbaImage; sharpness: number; shots: number; meta: M | undefined } | null {
    const list = (this.shots.get(key) ?? []).filter(s => now - s.at <= this.maxAgeMs)
    if (!list.length) return null
    const top = list.reduce((a, b) => (b.sharpness > a.sharpness ? b : a))
    return { crop: top.crop, sharpness: top.sharpness, shots: list.length, meta: top.meta }
  }

  /** Forgets every tile that is not in `alive`. */
  retain(alive: Iterable<string>): void {
    const keep = new Set(alive)
    for (const k of [...this.shots.keys()]) if (!keep.has(k)) this.shots.delete(k)
  }

  clear(): void {
    this.shots.clear()
  }
}

/**
 * Whether the cards have stopped moving between two analysis ticks: at least `share` of the boxes now have a box before it whose
 * centre is within `tol` of the box's width (default 4%). A box that just appeared or flickers does not hold everything up. No boxes
 * before or now counts as settled (nothing to wait for).
 */
export function boxesSettled(prev: Box[], cur: Box[], tol = 0.04, share = 0.7): boolean {
  if (!prev.length || !cur.length) return true
  const still = cur.filter(c => {
    const cx = c.x + c.w / 2
    const cy = c.y + c.h / 2
    const limit = Math.max(2, tol * c.w)
    return prev.some(p => Math.hypot(p.x + p.w / 2 - cx, p.y + p.h / 2 - cy) <= limit)
  }).length
  return still / cur.length >= share
}

/** Median of the widths (px), or 0 when there are none. */
export function medianWidth(boxes: Box[]): number {
  if (!boxes.length) return 0
  const ws = boxes.map(b => b.w).sort((a, b) => a - b)
  return ws[ws.length >> 1]
}

/** Below this many native camera pixels across, a card's title is too small for OCR; the page asks the user to move closer or zoom. */
export const MIN_READABLE_TILE_PX = 220
