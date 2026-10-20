// Deterministic synthetic "phone camera pointed at a Netflix screen" frames with ground truth.
//   makeScene()  dark (or light) background, rows of procedurally "artful" 16:9 cards, optional gaps /
//                focus border / partial edge cards / row-title bars.
//   degrade()    camera-ish damage: small rotation, perspective keystone, blur, noise, glare, brightness.
//   evaluate()   greedy IoU matching -> recall / precision against a detector's boxes.
// Everything is seeded (mulberry32); the same options always render the same pixels.
import { RgbaImage } from '../../lib/card-hash'
import { Box, iou } from '../../lib/card-tracker'
import type { Pt } from '../../lib/ar/rectify'

export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function gaussian(rng: Rng): number {
  const u = Math.max(rng(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}

export type RGB = [number, number, number]
type Quad = [Pt, Pt, Pt, Pt]

export interface SceneCard {
  /** Axis-aligned bounding box of the card, clipped to the frame (what a detector should return). */
  box: Box
  /** Card corners [tl, tr, br, bl] in frame pixels, unclipped (may lie outside the frame). */
  quad: Quad
  /** Fraction of the card's bounding area that lies inside the frame (1 = fully visible). */
  visible: number
}

export interface Scene {
  image: RgbaImage
  cards: SceneCard[]
  background: RGB
}

export interface SceneOptions {
  seed: number
  width?: number // default 640
  height?: number // default 360
  rows?: number // default 1
  /** Approximate number of cards across the frame (fully visible ones if !partialEdges). Default 5. */
  cols?: number
  /** Light-background screen instead of the dark Netflix one. */
  light?: boolean
  /** Horizontal gap range in px, drawn per gap (non-uniform). Default [3, 10]. */
  gapMin?: number
  gapMax?: number
  /** Bright focus border around one fully visible card. */
  focus?: boolean
  /** Netflix enlarges the focused tile; 1 = same size. Default 1. */
  focusScale?: number
  /** Cards cut off by the left/right frame edge. */
  partialEdges?: boolean
  /** Dim, desaturated art (dark film posters in similar teal/brown palettes): the hard case for a colour-led hash. */
  muted?: boolean
  /** Faint row-title text bars above each row (a false-positive trap). Default true. */
  titles?: boolean
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)
const lum = (c: RGB) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

function hsv(h: number, s: number, v: number): RGB {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6]
  return [r * 255, g * 255, b * 255]
}

function randColor(rng: Rng, lumLo: number, lumHi: number, satLo = 0.25, satSpan = 0.65): RGB {
  for (let tries = 0; tries < 40; tries++) {
    const c = hsv(rng(), satLo + rng() * satSpan, 0.3 + rng() * 0.65)
    const l = lum(c)
    if (l >= lumLo && l <= lumHi) return c
  }
  const m = (lumLo + lumHi) / 2
  return [m, m, m]
}

/** Procedural poster-like art: gradient base + soft blobs + diagonal stripes + bottom vignette. Distinct per seed. */
export function renderCardArt(seed: number, w: number, h: number, lumLo = 55, lumHi = 190, satLo = 0.25, satSpan = 0.65): RgbaImage {
  const rng = mulberry32(seed * 7919 + 13)
  const A = randColor(rng, lumLo, lumHi, satLo, satSpan)
  const B = randColor(rng, lumLo, lumHi, satLo, satSpan)
  const ang = rng() * Math.PI * 2
  const ca = Math.cos(ang)
  const sa = Math.sin(ang)
  const blobs = Array.from({ length: 3 + Math.floor(rng() * 4) }, () => ({
    x: rng() * w,
    y: rng() * h,
    r: (0.12 + rng() * 0.25) * w,
    c: randColor(rng, lumLo, lumHi, satLo, satSpan),
    k: 0.55 + rng() * 0.4,
  }))
  const stripes = rng() < 0.6
  const period = 6 + rng() * 10
  const stripeAng = rng() * Math.PI
  const sc = Math.cos(stripeAng)
  const ss = Math.sin(stripeAng)
  const stripeAmt = 10 + rng() * 14
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let t = (x / w - 0.5) * ca + (y / h - 0.5) * sa + 0.5
      t = t < 0 ? 0 : t > 1 ? 1 : t
      let r = A[0] + (B[0] - A[0]) * t
      let g = A[1] + (B[1] - A[1]) * t
      let b = A[2] + (B[2] - A[2]) * t
      for (const bl of blobs) {
        const dx = x - bl.x
        const dy = y - bl.y
        const d2 = (dx * dx + dy * dy) / (bl.r * bl.r)
        if (d2 < 1) {
          const a = bl.k * (1 - d2) * (1 - d2)
          r += (bl.c[0] - r) * a
          g += (bl.c[1] - g) * a
          b += (bl.c[2] - b) * a
        }
      }
      if (stripes) {
        // triangle wave: same look as a sine, no per-pixel Math.* (slow under jest's vm)
        let ph = (x * sc + y * ss) / period
        ph -= Math.floor(ph)
        const s = (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph) * stripeAmt
        r += s
        g += s
        b += s
      }
      const vy = (y / h - 0.65) / 0.35
      const vig = 1 - 0.28 * (vy > 0 ? vy : 0)
      const o = (y * w + x) * 4
      data[o] = clamp255(r * vig)
      data[o + 1] = clamp255(g * vig)
      data[o + 2] = clamp255(b * vig)
      data[o + 3] = 255
    }
  }
  return { data, width: w, height: h }
}

function fillRect(img: RgbaImage, x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const xa = Math.max(0, Math.round(x0))
  const xb = Math.min(img.width, Math.round(x1))
  const ya = Math.max(0, Math.round(y0))
  const yb = Math.min(img.height, Math.round(y1))
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      const o = (y * img.width + x) * 4
      img.data[o] = c[0]
      img.data[o + 1] = c[1]
      img.data[o + 2] = c[2]
      img.data[o + 3] = 255
    }
  }
}

function blit(dst: RgbaImage, src: RgbaImage, dx: number, dy: number): void {
  for (let y = 0; y < src.height; y++) {
    const ty = dy + y
    if (ty < 0 || ty >= dst.height) continue
    for (let x = 0; x < src.width; x++) {
      const tx = dx + x
      if (tx < 0 || tx >= dst.width) continue
      const so = (y * src.width + x) * 4
      const o = (ty * dst.width + tx) * 4
      dst.data[o] = src.data[so]
      dst.data[o + 1] = src.data[so + 1]
      dst.data[o + 2] = src.data[so + 2]
      dst.data[o + 3] = 255
    }
  }
}

function clipBox(b: Box, w: number, h: number): { box: Box; visible: number } {
  const x0 = Math.max(0, b.x)
  const y0 = Math.max(0, b.y)
  const x1 = Math.min(w, b.x + b.w)
  const y1 = Math.min(h, b.y + b.h)
  const cw = Math.max(0, x1 - x0)
  const ch = Math.max(0, y1 - y0)
  return { box: { x: x0, y: y0, w: cw, h: ch }, visible: (cw * ch) / (b.w * b.h) }
}

function rectQuad(b: Box): Quad {
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ]
}

function sceneCard(b: Box, w: number, h: number): SceneCard {
  const { box, visible } = clipBox(b, w, h)
  return { box, quad: rectQuad(b), visible }
}

export function makeScene(opts: SceneOptions): Scene {
  const rng = mulberry32(opts.seed)
  const W = opts.width ?? 640
  const H = opts.height ?? 360
  const rows = opts.rows ?? 1
  const light = !!opts.light
  const gapMin = opts.gapMin ?? 3
  const gapMax = opts.gapMax ?? 10
  const avgGap = (gapMin + gapMax) / 2
  const bg: RGB = light
    ? [226 + rng() * 18, 226 + rng() * 18, 226 + rng() * 18]
    : [6 + rng() * 12, 6 + rng() * 12, 8 + rng() * 14]
  const lumLo = light ? 25 : opts.muted ? 30 : 55
  const lumHi = light ? 165 : opts.muted ? 120 : 190
  const [satLo, satSpan] = opts.muted ? [0.08, 0.35] : [0.25, 0.65]

  const img: RgbaImage = { data: new Uint8ClampedArray(W * H * 4), width: W, height: H }
  fillRect(img, 0, 0, W, H, bg)

  // Size the cards from the requested column count, then shrink them if the rows would not fit vertically.
  let cols = opts.cols ?? 5
  const margin = opts.partialEdges ? 0 : 8 + Math.floor(rng() * 14)
  const rowGap = 20 + Math.floor(rng() * 14)
  let cardW = (W - 2 * margin - (cols - 1) * avgGap) / cols
  while (rows * ((cardW * 9) / 16) + (rows - 1) * rowGap > H - 28 && cardW > 40) cardW -= 4
  cardW = Math.round(cardW)
  const cardH = Math.round((cardW * 9) / 16)
  const totalH = rows * cardH + (rows - 1) * rowGap
  const slack = Math.max(0, H - totalH - 28)
  const top = Math.round(14 + slack * (0.25 + rng() * 0.5))

  const cards: SceneCard[] = []
  let artSeed = opts.seed * 1000 + 1
  const placed: { r: number; box: Box; art: RgbaImage; full: boolean }[] = []
  for (let r = 0; r < rows; r++) {
    const y = top + r * (cardH + rowGap)
    if (opts.titles !== false && y >= 14) {
      const tone: RGB = light ? [150, 150, 150] : [70, 70, 74]
      fillRect(img, margin + 4, y - 11, margin + 4 + 50 + rng() * 60, y - 6, tone)
    }
    let x = opts.partialEdges ? -Math.round((1 - (0.3 + rng() * 0.6)) * cardW) : margin
    let n = 0
    while (x < W && (opts.partialEdges || n < cols)) {
      const box = { x, y, w: cardW, h: cardH }
      const art = renderCardArt(artSeed++, cardW, cardH, lumLo, lumHi, satLo, satSpan)
      placed.push({ r, box, art, full: x >= 0 && x + cardW <= W })
      x += cardW + Math.round(gapMin + rng() * (gapMax - gapMin))
      n++
    }
  }

  const focusIdx = opts.focus ? pickFocus(placed, rng) : -1
  placed.forEach((p, i) => {
    if (i === focusIdx) return
    blit(img, p.art, p.box.x, p.box.y)
    cards.push(sceneCard(p.box, W, H))
  })
  if (focusIdx >= 0) {
    const p = placed[focusIdx]
    const s = opts.focusScale ?? 1
    const fw = Math.round(p.box.w * s)
    const fh = Math.round(p.box.h * s)
    const fbox = { x: p.box.x - Math.round((fw - p.box.w) / 2), y: p.box.y - Math.round((fh - p.box.h) / 2), w: fw, h: fh }
    const art = s === 1 ? p.art : renderCardArt(artSeed++, fw, fh, lumLo, lumHi, satLo, satSpan)
    const ring: RGB = light ? [20, 20, 20] : [245, 245, 245]
    const t = 2
    // Border sits just outside the card, inside the neighbouring gap.
    fillRect(img, fbox.x - 1 - t, fbox.y - 1 - t, fbox.x + fbox.w + 1 + t, fbox.y + fbox.h + 1 + t, ring)
    blit(img, art, fbox.x, fbox.y)
    fillRect(img, fbox.x - 1, fbox.y - 1, fbox.x + fbox.w + 1, fbox.y, bg)
    fillRect(img, fbox.x - 1, fbox.y + fbox.h, fbox.x + fbox.w + 1, fbox.y + fbox.h + 1, bg)
    fillRect(img, fbox.x - 1, fbox.y, fbox.x, fbox.y + fbox.h, bg)
    fillRect(img, fbox.x + fbox.w, fbox.y, fbox.x + fbox.w + 1, fbox.y + fbox.h, bg)
    cards.push(sceneCard(fbox, W, H))
  }
  return { image: img, cards, background: bg }
}

function pickFocus(placed: { full: boolean }[], rng: Rng): number {
  const full = placed.map((p, i) => (p.full ? i : -1)).filter((i) => i >= 0)
  return full.length ? full[Math.floor(rng() * full.length)] : -1
}

/**
 * Cards a detector must find (>= minVisible shown) and cards it may or may not report (ignored in scoring).
 * The finder drops edge cards below 60% of a full card, so the must-find bar sits a little higher to keep the
 * boundary case (a card exactly 60% visible) from flapping.
 */
export function groundTruth(scene: Scene, minVisible = 0.7): { boxes: Box[]; ignore: Box[] } {
  const boxes: Box[] = []
  const ignore: Box[] = []
  for (const c of scene.cards) {
    if (c.box.w < 2 || c.box.h < 2) continue
    ;(c.visible >= minVisible ? boxes : ignore).push(c.box)
  }
  return { boxes, ignore }
}

export interface DegradeOptions {
  seed?: number
  rotateDeg?: number
  /** 0..~0.1: the top edge of the frame is this fraction narrower than the bottom (camera below the TV). */
  keystone?: number
  /** Gaussian blur sigma in px. */
  blur?: number
  /** Gaussian sensor-noise sigma in 0-255 units. */
  noise?: number
  /** Soft additive highlight; x/y in 0..1 frame fractions, radius (sigma) in px, amp in 0-255 units. */
  glare?: { x: number; y: number; radius: number; amp: number }
  /** Added to every channel after `gain`. */
  brightness?: number
  gain?: number
}

type Mat3 = number[] // row-major 3x3

function mul(a: Mat3, b: Mat3): Mat3 {
  const o = new Array(9).fill(0)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) o[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]
  return o
}

function inv3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  return [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((v) => v / det)
}

function apply(m: Mat3, x: number, y: number): Pt {
  const w = m[6] * x + m[7] * y + m[8]
  return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w }
}

// Unit square -> quad (Heckbert), as a 3x3 matrix acting on [u v 1].
function squareToQuadMat(q: Quad): Mat3 {
  const [p0, p1, p2, p3] = q
  const sx = p0.x - p1.x + p2.x - p3.x
  const sy = p0.y - p1.y + p2.y - p3.y
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    return [p1.x - p0.x, p3.x - p0.x, p0.x, p1.y - p0.y, p3.y - p0.y, p0.y, 0, 0, 1]
  }
  const dx1 = p1.x - p2.x
  const dx2 = p3.x - p2.x
  const dy1 = p1.y - p2.y
  const dy2 = p3.y - p2.y
  const det = dx1 * dy2 - dx2 * dy1
  const g = (sx * dy2 - dx2 * sy) / det
  const h = (dx1 * sy - sx * dy1) / det
  return [p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x, p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y, g, h, 1]
}

// Separable Gaussian blur. Written with plain comparisons (no Math.* in the pixel loops): this helper runs
// hundreds of times per test run and global lookups are slow inside jest's vm sandbox.
function gaussianBlur(img: RgbaImage, sigma: number): RgbaImage {
  const r = Math.max(1, Math.ceil(sigma * 3))
  const k = new Float32Array(2 * r + 1)
  let sum = 0
  for (let i = -r; i <= r; i++) sum += k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma))
  for (let i = 0; i < k.length; i++) k[i] /= sum
  const { width: w, height: h } = img
  const src = img.data
  const tmp = new Float32Array(w * h * 3)
  const out = new Uint8ClampedArray(src.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s0 = 0
      let s1 = 0
      let s2 = 0
      for (let i = -r; i <= r; i++) {
        let xx = x + i
        xx = xx < 0 ? 0 : xx >= w ? w - 1 : xx
        const o = (y * w + xx) * 4
        const kv = k[i + r]
        s0 += kv * src[o]
        s1 += kv * src[o + 1]
        s2 += kv * src[o + 2]
      }
      const t = (y * w + x) * 3
      tmp[t] = s0
      tmp[t + 1] = s1
      tmp[t + 2] = s2
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s0 = 0
      let s1 = 0
      let s2 = 0
      for (let i = -r; i <= r; i++) {
        let yy = y + i
        yy = yy < 0 ? 0 : yy >= h ? h - 1 : yy
        const t = (yy * w + x) * 3
        const kv = k[i + r]
        s0 += kv * tmp[t]
        s1 += kv * tmp[t + 1]
        s2 += kv * tmp[t + 2]
      }
      const o = (y * w + x) * 4
      out[o] = s0
      out[o + 1] = s1
      out[o + 2] = s2
      out[o + 3] = 255
    }
  }
  return { data: out, width: w, height: h }
}

/** Camera-style damage with ground truth carried through the geometry (AABB of each transformed card). */
export function degrade(scene: Scene, opts: DegradeOptions): Scene {
  const rng = mulberry32((opts.seed ?? 1) * 2654435761)
  const { width: W, height: H } = scene.image
  const theta = ((opts.rotateDeg ?? 0) * Math.PI) / 180
  const kst = opts.keystone ?? 0
  const cx = W / 2
  const cy = H / 2
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const corner = (x: number, y: number): Pt => {
    const s = 1 - kst * (1 - y / H) // top row narrower
    const px = cx + (x - cx) * s
    return { x: cx + (px - cx) * cos - (y - cy) * sin, y: cy + (px - cx) * sin + (y - cy) * cos }
  }
  const dstQuad: Quad = [corner(0, 0), corner(W, 0), corner(W, H), corner(0, H)]
  // source px -> unit square -> destination quad
  const fwd = mul(squareToQuadMat(dstQuad), [1 / W, 0, 0, 0, 1 / H, 0, 0, 0, 1])
  const back = inv3(fwd)

  const geometric = !!(opts.rotateDeg || opts.keystone)
  let img: RgbaImage
  if (geometric) {
    const out = new Uint8ClampedArray(W * H * 4)
    const src = scene.image.data
    const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = back
    const [bgR, bgG, bgB] = scene.background
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const den = m6 * (x + 0.5) + m7 * (y + 0.5) + m8
        const sx = (m0 * (x + 0.5) + m1 * (y + 0.5) + m2) / den - 0.5
        const sy = (m3 * (x + 0.5) + m4 * (y + 0.5) + m5) / den - 0.5
        const o = (y * W + x) * 4
        out[o + 3] = 255
        if (sx < -0.5 || sy < -0.5 || sx > W - 0.5 || sy > H - 0.5) {
          out[o] = bgR
          out[o + 1] = bgG
          out[o + 2] = bgB
          continue
        }
        const fx = sx < 0 ? 0 : sx
        const fy = sy < 0 ? 0 : sy
        const x0 = fx | 0
        const y0 = fy | 0
        const tx = fx - x0
        const ty = fy - y0
        const x1 = x0 + 1 < W ? x0 + 1 : W - 1
        const y1 = y0 + 1 < H ? y0 + 1 : H - 1
        const o00 = (y0 * W + x0) * 4
        const o10 = (y0 * W + x1) * 4
        const o01 = (y1 * W + x0) * 4
        const o11 = (y1 * W + x1) * 4
        const w00 = (1 - tx) * (1 - ty)
        const w10 = tx * (1 - ty)
        const w01 = (1 - tx) * ty
        const w11 = tx * ty
        out[o] = src[o00] * w00 + src[o10] * w10 + src[o01] * w01 + src[o11] * w11
        out[o + 1] = src[o00 + 1] * w00 + src[o10 + 1] * w10 + src[o01 + 1] * w01 + src[o11 + 1] * w11
        out[o + 2] = src[o00 + 2] * w00 + src[o10 + 2] * w10 + src[o01 + 2] * w01 + src[o11 + 2] * w11
      }
    }
    img = { data: out, width: W, height: H }
  } else {
    img = { data: new Uint8ClampedArray(scene.image.data), width: W, height: H }
  }
  if (opts.blur && opts.blur > 0) img = gaussianBlur(img, opts.blur)

  const gl = opts.glare
  const gain = opts.gain ?? 1
  const bias = opts.brightness ?? 0
  const noise = opts.noise ?? 0
  if (gl || gain !== 1 || bias || noise) {
    // Pre-drawn Gaussian table indexed by a cheap LCG: ~700k Box-Muller draws per frame are too slow under jest.
    const table = new Float32Array(4096)
    for (let i = 0; i < table.length; i++) table[i] = gaussian(rng)
    let lcg = (rng() * 4294967296) >>> 0
    const d = img.data
    const gx = gl ? gl.x * W : 0
    const gy = gl ? gl.y * H : 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const add = gl ? gl.amp * Math.exp(-((x - gx) * (x - gx) + (y - gy) * (y - gy)) / (2 * gl.radius * gl.radius)) : 0
        const o = (y * W + x) * 4
        for (let c = 0; c < 3; c++) {
          lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0
          d[o + c] = d[o + c] * gain + bias + add + (noise ? table[lcg >>> 20] * noise : 0)
        }
      }
    }
  }

  const cards = scene.cards.map((c): SceneCard => {
    const q = c.quad.map((p) => apply(fwd, p.x, p.y)) as Quad
    const xs = q.map((p) => p.x)
    const ys = q.map((p) => p.y)
    const full = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
    const { box, visible } = clipBox(full, W, H)
    return { box, quad: q, visible }
  })
  return { image: img, cards, background: scene.background }
}

/** Seeded random camera damage: 'mild' ~ a steady hand, 'strong' ~ a careless one. */
export function randomDegrade(seed: number, level: 'mild' | 'strong' = 'mild'): DegradeOptions {
  const rng = mulberry32(seed * 31 + 7)
  const k = level === 'mild' ? 1 : 2
  const sign = () => (rng() < 0.5 ? -1 : 1)
  return {
    seed,
    rotateDeg: sign() * rng() * 1.5 * k,
    keystone: rng() * 0.03 * k,
    blur: 0.4 + rng() * 0.6 * k,
    noise: 1.5 + rng() * 2.5 * k,
    glare: { x: rng(), y: rng(), radius: 50 + rng() * 40, amp: (8 + rng() * 10) * k },
    brightness: sign() * rng() * 10 * k,
    gain: 1 + sign() * rng() * 0.1 * k,
  }
}

export interface Score {
  tp: number
  fp: number
  fn: number
  /** per-scene misses for debugging */
  missed: Box[]
  spurious: Box[]
}

/** Greedy best-IoU matching. Detections overlapping an `ignore` box (cards too cut off to count) are neither TP nor FP. */
export function evaluate(detected: Box[], truth: { boxes: Box[]; ignore: Box[] }, minIou = 0.5): Score {
  const pairs: { d: number; t: number; v: number }[] = []
  detected.forEach((d, di) => truth.boxes.forEach((t, ti) => {
    const v = iou(d, t)
    if (v >= minIou) pairs.push({ d: di, t: ti, v })
  }))
  pairs.sort((a, b) => b.v - a.v)
  const usedD = new Set<number>()
  const usedT = new Set<number>()
  for (const p of pairs) {
    if (usedD.has(p.d) || usedT.has(p.t)) continue
    usedD.add(p.d)
    usedT.add(p.t)
  }
  const spurious = detected.filter((d, i) => !usedD.has(i) && !truth.ignore.some((g) => iou(d, g) >= 0.3))
  const missed = truth.boxes.filter((_, i) => !usedT.has(i))
  return { tp: usedT.size, fp: spurious.length, fn: missed.length, missed, spurious }
}
