// Resampling helpers that turn a detected card region into a fixed-size RGBA crop for hashing.
// Pure functions over RGBA pixels; no DOM, so they run in the browser, tests and a future native app.
import { RgbaImage } from '../card-hash'
import { Box } from '../card-tracker'

export interface Pt {
  x: number
  y: number
}

// Bilinear sample with edge replication, writing RGB into out[o..o+2] (alpha is set by the caller).
function sampleInto(img: RgbaImage, sx: number, sy: number, out: Float32Array): void {
  const { width: w, height: h, data } = img
  const fx = Math.min(Math.max(sx - 0.5, 0), w - 1)
  const fy = Math.min(Math.max(sy - 0.5, 0), h - 1)
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const x1 = Math.min(x0 + 1, w - 1)
  const y1 = Math.min(y0 + 1, h - 1)
  const tx = fx - x0
  const ty = fy - y0
  const i00 = (y0 * w + x0) * 4
  const i10 = (y0 * w + x1) * 4
  const i01 = (y1 * w + x0) * 4
  const i11 = (y1 * w + x1) * 4
  const w00 = (1 - tx) * (1 - ty)
  const w10 = tx * (1 - ty)
  const w01 = (1 - tx) * ty
  const w11 = tx * ty
  out[0] = data[i00] * w00 + data[i10] * w10 + data[i01] * w01 + data[i11] * w11
  out[1] = data[i00 + 1] * w00 + data[i10 + 1] * w10 + data[i01 + 1] * w01 + data[i11 + 1] * w11
  out[2] = data[i00 + 2] * w00 + data[i10 + 2] * w10 + data[i01 + 2] * w01 + data[i11 + 2] * w11
}

function emptyImage(w: number, h: number): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 3; i < data.length; i += 4) data[i] = 255
  return { data, width: w, height: h }
}

// A single bilinear tap aliases when shrinking by more than ~2x, so shrinks average a small
// grid of taps per output pixel (cap 4x4: enough for hashing, bounded cost).
function taps(scale: number): number {
  return Math.min(4, Math.max(1, Math.ceil(scale - 0.25)))
}

export function cropToRgba(img: RgbaImage, box: Box, outW: number, outH: number): RgbaImage {
  const out = emptyImage(outW, outH)
  if (img.width <= 0 || img.height <= 0 || outW <= 0 || outH <= 0) return out
  // Clamp the box to the image; a box fully outside collapses to the nearest edge pixel row/column.
  let x0 = Math.max(0, Math.min(img.width - 1, box.x))
  let y0 = Math.max(0, Math.min(img.height - 1, box.y))
  let x1 = Math.max(0, Math.min(img.width, box.x + box.w))
  let y1 = Math.max(0, Math.min(img.height, box.y + box.h))
  if (x1 - x0 < 1) x1 = Math.min(img.width, x0 + 1)
  if (y1 - y0 < 1) y1 = Math.min(img.height, y0 + 1)
  x0 = Math.min(x0, x1 - 1e-6)
  y0 = Math.min(y0, y1 - 1e-6)
  const bw = x1 - x0
  const bh = y1 - y0
  const nx = taps(bw / outW)
  const ny = taps(bh / outH)
  const px = new Float32Array(3)
  const acc = new Float32Array(3)
  const inv = 1 / (nx * ny)
  for (let j = 0; j < outH; j++) {
    for (let i = 0; i < outW; i++) {
      acc[0] = acc[1] = acc[2] = 0
      for (let b = 0; b < ny; b++) {
        const sy = y0 + ((j + (b + 0.5) / ny) * bh) / outH
        for (let a = 0; a < nx; a++) {
          const sx = x0 + ((i + (a + 0.5) / nx) * bw) / outW
          sampleInto(img, sx, sy, px)
          acc[0] += px[0]
          acc[1] += px[1]
          acc[2] += px[2]
        }
      }
      const o = (j * outW + i) * 4
      out.data[o] = acc[0] * inv
      out.data[o + 1] = acc[1] * inv
      out.data[o + 2] = acc[2] * inv
    }
  }
  return out
}

// Unit square (0,0)(1,0)(1,1)(0,1) -> quad p0..p3 (Heckbert). Returns [a,b,c,d,e,f,g,h] with
// x = (a u + b v + c) / (g u + h v + 1), y = (d u + e v + f) / (g u + h v + 1); null if degenerate.
function squareToQuad(q: [Pt, Pt, Pt, Pt]): number[] | null {
  const [p0, p1, p2, p3] = q
  const sx = p0.x - p1.x + p2.x - p3.x
  const sy = p0.y - p1.y + p2.y - p3.y
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    return [p1.x - p0.x, p3.x - p0.x, p0.x, p1.y - p0.y, p3.y - p0.y, p0.y, 0, 0]
  }
  const dx1 = p1.x - p2.x
  const dx2 = p3.x - p2.x
  const dy1 = p1.y - p2.y
  const dy2 = p3.y - p2.y
  const det = dx1 * dy2 - dx2 * dy1
  if (Math.abs(det) < 1e-12) return null
  const g = (sx * dy2 - dx2 * sy) / det
  const h = (dx1 * sy - sx * dy1) / det
  return [
    p1.x - p0.x + g * p1.x,
    p3.x - p0.x + h * p3.x,
    p0.x,
    p1.y - p0.y + g * p1.y,
    p3.y - p0.y + h * p3.y,
    p0.y,
    g,
    h,
  ]
}

// quad = [tl, tr, br, bl] in img pixel coords. Degenerate (collinear / zero-area) quads yield a black image.
export function warpQuad(img: RgbaImage, quad: [Pt, Pt, Pt, Pt], outW: number, outH: number): RgbaImage {
  const out = emptyImage(outW, outH)
  if (img.width <= 0 || img.height <= 0 || outW <= 0 || outH <= 0) return out
  const m = squareToQuad(quad)
  if (!m) return out
  const [a, b, c, d, e, f, g, h] = m
  const len = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y)
  const nx = taps((len(quad[0], quad[1]) + len(quad[3], quad[2])) / 2 / outW)
  const ny = taps((len(quad[0], quad[3]) + len(quad[1], quad[2])) / 2 / outH)
  const px = new Float32Array(3)
  const acc = new Float32Array(3)
  for (let j = 0; j < outH; j++) {
    for (let i = 0; i < outW; i++) {
      acc[0] = acc[1] = acc[2] = 0
      let n = 0
      for (let bb = 0; bb < ny; bb++) {
        const v = (j + (bb + 0.5) / ny) / outH
        for (let aa = 0; aa < nx; aa++) {
          const u = (i + (aa + 0.5) / nx) / outW
          const den = g * u + h * v + 1
          if (Math.abs(den) < 1e-9) continue
          sampleInto(img, (a * u + b * v + c) / den, (d * u + e * v + f) / den, px)
          acc[0] += px[0]
          acc[1] += px[1]
          acc[2] += px[2]
          n++
        }
      }
      if (n === 0) continue
      const o = (j * outW + i) * 4
      const k = 1 / n
      out.data[o] = acc[0] * k
      out.data[o + 1] = acc[1] * k
      out.data[o + 2] = acc[2] * k
    }
  }
  return out
}
