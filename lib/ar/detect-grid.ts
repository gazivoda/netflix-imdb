// Gradient-lattice tile detector: finds Netflix-style tiles (16:9 landscape art or 2:3 Top-10 posters, laid out in rows) in a
// photo of a TV.
//
// Why not "colour distance from the background": real key art is dark (the median tile has only ~60% of its pixels clearly off
// the background colour, some tiles are black), so a foreground mask latches onto bright logos inside tiles instead of finding
// the tile. What is always there are the tile EDGES (tops and bottoms line up across a whole row, the gaps line up as vertical
// edges) and the periodic structure of a row:
//
//   1. edges      luminance on a ~320 px grid; thin edge points (non-maximum suppressed, strictly axis-aligned: art is full of
//                 diagonal strokes) that belong to long connected chains (tile sides and row lines are long, texture is not)
//   2. rows       Hough transform over nearly horizontal lines; pairs of lines (a tile's top and bottom edge share their slope)
//                 are row hypotheses. Lines too faint to see (dark art on a dark screen, blur) are added from the page's tile
//                 pitch: the autocorrelation of the vertical-edge comb implies the tile height.
//   3. segment    inside a row hypothesis the vertical-edge evidence is a comb; dynamic programming lays tiles of the width
//                 the aspect prior implies on it, so dark tiles with no visible sides are bridged, an enlarged focus tile
//                 (wider, no gap) still fits and tiles cut by the frame edge are kept when most of them shows
//   4. verify     a row is bounded by bare background above and below, its tiles are busier than the gaps between them
//   5. focus      the selected tile that the TV enlarges in place (1.3x to 0.6 of the frame width) is looked for apart from the
//                 rows, and flagged `focus`; it is told from a hero banner by standing among ordinary tiles (see pickFocus)
//   6. boxes      snapped to the real edges per tile at full resolution (tilt and keystone follow the line slopes)
import { RgbaImage } from '../card-hash'
import { Box } from '../card-tracker'
import type { Pt } from './rectify'

export interface CardCandidate {
  box: Box
  /** 0..1: how well the box's sides and its row's periodic structure are confirmed by edges (0 = inferred, not seen). */
  confidence: number
  /** The layout the row was explained by. */
  kind: 'landscape' | 'portrait'
  /** Index of the row of tiles this box belongs to (boxes of one row share it). */
  row: number
  /** The tile's corners [tl, tr, br, bl] in image pixels (tilt and keystone included), for a rectified crop. `box` is its bounding box. */
  quad: [Pt, Pt, Pt, Pt]
  /** Set on the enlarged focus tile (the one the TV expanded in place), admitted by the focus rule instead of the ordinary tile size limit. */
  focus?: true
}

// ---------------------------------------------------------------------------------------------------------------------------
// Constants. Lengths are in grid cells (a cell is frame width / ~320 pixels).

const WORK_W = 320 // grid width in cells
const MIN_ROW_H = 10 // shortest row of tiles
const MIN_HCHAIN = 12 // shorter horizontal edges never vote for a row line
const S_MAX = 0.13 // steepest row line (slope); a frame rotated by up to ~7 degrees
const S_STEP = 0.005
const N_LINES = 28 // strongest row lines kept
const LINE_THR = 0.2 // a row line needs votes worth this share of the frame width
const MAX_SLOPE_DIFF = 0.035 // top and bottom edge of a row: keystone makes them a little unequal
const N_CANDIDATES = 60 // row hypotheses analysed, best first

const THETA_FLOOR = 5 // edge threshold: at least this (0..255 luminance), or 4x the frame's median gradient
const THETA_MUL = 4
const ORI_V = 4 // a vertical edge must be this many times stronger than the horizontal gradient beside it
const ORI_H = 2 // same for horizontal edges
const BG_TOL = 48 // "page background": within this + 40% of its luminance (a dark screen is not exactly flat)

const NEUTRAL = 0.4 // edge evidence assumed where the frame hides a tile side
const BASE = 0.7 // evidence a tile side must beat to be worth a tile
const LAM = 1.5 // penalty per unit of relative width deviation (tiles of a row share one width)
const BUSY_W = 0.8 // reward for a busy tile interior ...
const BUSY_REF_LANDSCAPE = 0.4 // ... above this share of non-background cells (landscape art is busier than poster + numeral)
const BUSY_REF_PORTRAIT = 0.3
const GAP_W = 1.5 // penalty for a busy gap between tiles ...
const GAP_REF = 0.5 // ... above this share of non-background cells
const SPIKE = 0.45 // a row shows at least two sides at least this clear
const Q_MIN = 0.25 // weakest row quality accepted

const LAG_MIN = 0.1 // a tile is at least a tenth of the frame width (pitch search)
const PITCH_PEAK = 0.7 // the page pitch is the smallest autocorrelation peak this strong
const PITCH_BONUS = 0.5 // rank of a row hypothesis built from the pitch, in line-strength units of the frame width
const PITCH_TILE = [0.9, 0.96, 1.02] // tile width as a share of the pitch (the rest is gap)
const MAX_TILE_W = 0.38 // share of the frame width: a landscape tile wider than this is a hero banner, not a tile

// Focus tile: the TV expands the selected tile in place, so one tile of a screen is much bigger than the rest. It is told from a hero
// banner by its place (beside normal tiles of its own row, or inside the grid with rows above and below it), not by its size alone.
const FOCUS_REL = 1.3 // at least this many times the median tile width of the frame's ordinary rows
const FOCUS_MAX_W = 0.6 // share of the frame width: wider is a banner whatever its neighbours
const FOCUS_Q = 0.6 // weakest quality of a lone-tile row accepted (its sides must also be seen, not inferred)
const FOCUS_NEAR = 0.75 // a neighbour tile is at most this many median tile widths away from the focus tile
const FOCUS_COVER = 0.5 // ordinary boxes with this share of their area under a focus tile are pieces of it
const FOCUS_ASPECT = 0.16 // |ln(aspect / 16:9)| of the enlarged tile: about 15%
const FOCUS_FLAT = 0.4 // share of the strips above and below the tile that is bare background
const FOCUS_TILE = 0.8 // an ordinary tile has a top or bottom edge along at least this share of its width (art strokes stay below)
const FOCUS_COV = 0.45 // share of the focus tile's width that each of its top and bottom edge must show as a long horizontal edge

// Fragments: bright logo text on a card whose own edges are faint produces rows of "tiles" that are really letter groups. A tile of a
// real screen is a tenth of the screen's width or more, has the 16:9 or 2:3 shape of its layout, and is not far smaller than the others.
const FRAG_MIN_W = 0.075 // share of the frame width below which a box is no tile
const FRAG_MIN_W_CUT = 0.03 // the same for a box cut by the frame edge
const FRAG_ASPECT: Record<CardCandidate['kind'], [number, number]> = { landscape: [1.1, 2.7], portrait: [0.5, 0.9] }
const FRAG_EDGE = 0.015 // a box this close to the frame edge (share of the short side) is a tile cut by it: kept to size rules only
const FRAG_REL_AREA = 0.4 // smaller than this share of the typical (85th percentile) box area of the frame
const FRAG_PORTRAIT_H: [number, number] = [1.25, 2.1] // a Top-10 poster is 1.5-2x as tall as the landscape tiles of its screen; below that it is a letter group, above it two rows merged
const FRAG_PORTRAIT_ROWS = 2 // a screen shows at most this many Top-10 style rows; more portrait rows are letter groups explained as posters
const SUPPRESS_R = 2 // cells: strokes up to 2 * SUPPRESS_R cells wide are removed by the text-suppressing retry

const BUSY_SAMPLES = 8
const SUB_ROWS = 12 // scanlines for the full-resolution side refinement

// Plain comparisons instead of Math.* keep the per-cell loops fast in sandboxed runtimes (jest vm) too.
const min3 = (a: number, b: number, c: number): number => (a < b ? (a < c ? a : c) : b < c ? b : c)

interface Hypothesis {
  kind: 'landscape' | 'portrait'
  aspect: number // tile w / h
  gapLo: number // gap range as a share of the tile width
  gapHi: number
}

const LANDSCAPE: Hypothesis = { kind: 'landscape', aspect: 16 / 9, gapLo: 0, gapHi: 0.14 }
const PORTRAIT: Hypothesis = { kind: 'portrait', aspect: 2 / 3, gapLo: 0.25, gapHi: 1.5 }

// ---------------------------------------------------------------------------------------------------------------------------
// 1. Luminance grid and edge points

interface Grid {
  w: number
  h: number
  k: number // frame pixels per cell
  y: Uint8Array
}

function lumaGrid(img: RgbaImage): Grid {
  const k = Math.max(1, Math.round(img.width / WORK_W))
  const w = Math.floor(img.width / k)
  const h = Math.floor(img.height / k)
  const step = k > 2 ? 2 : 1
  const y = new Uint8Array(w * h)
  const src = img.data
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      let s = 0
      let n = 0
      for (let yy = gy * k; yy < gy * k + k; yy += step) {
        let o = (yy * img.width + gx * k) * 4
        for (let xx = 0; xx < k; xx += step, o += step * 4) {
          s += src[o] * 77 + src[o + 1] * 150 + src[o + 2] * 29
          n++
        }
      }
      y[gy * w + gx] = s / (n * 256)
    }
  }
  return { w, h, k, y }
}

interface Edges {
  w: number
  h: number
  // thin edge points in raster order: vertical edges (tile sides, gaps) and horizontal edges (tile tops and bottoms)
  vx: Int16Array
  vy: Int16Array
  nv: number
  hx: Int16Array
  hy: Int16Array
  nh: number
  vrow: Int32Array // first vertical point of each row, length h + 1
  hrow: Int32Array // first horizontal point of each row, length h + 1
  vl: Uint8Array // length (cells) of the connected vertical edge chain each vertical point belongs to
  hl: Uint8Array // same for horizontal points
  calm: Uint8Array // 1 where the local gradient is below the noise threshold and the luminance is the page background's
}

// Length of the connected edge chain through every cell of an edge map: neighbours are cells one step further along the edge
// direction (down for vertical edges, right for horizontal ones) and at most one cell off to the side.
function chainLengths(map: Uint8Array, w: number, h: number, vertical: boolean): Uint8Array {
  const bef = new Uint8Array(w * h)
  const aft = new Uint8Array(w * h)
  const tot = new Uint8Array(w * h)
  const along = vertical ? h : w
  const across = vertical ? w : h
  const at = (a: number, c: number): number => (vertical ? a * w + c : c * w + a) // a = along, c = across
  for (let a = 0; a < along; a++) {
    for (let c = 0; c < across; c++) {
      if (!map[at(a, c)]) continue
      let m = 0
      if (a > 0) for (let d = -1; d <= 1; d++) if (c + d >= 0 && c + d < across && bef[at(a - 1, c + d)] > m) m = bef[at(a - 1, c + d)]
      bef[at(a, c)] = m < 254 ? m + 1 : 255
    }
  }
  for (let a = along - 1; a >= 0; a--) {
    for (let c = 0; c < across; c++) {
      const i = at(a, c)
      if (!map[i]) continue
      let m = 0
      if (a + 1 < along) for (let d = -1; d <= 1; d++) if (c + d >= 0 && c + d < across && aft[at(a + 1, c + d)] > m) m = aft[at(a + 1, c + d)]
      aft[i] = m < 254 ? m + 1 : 255
      const t = bef[i] + aft[i] - 1
      tot[i] = t > 255 ? 255 : t
    }
  }
  return tot
}

// Median of a histogram of n values.
function histMedian(hist: Uint32Array, n: number): number {
  let acc = 0
  let m = 0
  for (; m < 255; m++) {
    acc += hist[m]
    if (acc >= n / 2) break
  }
  return m
}

function edgePoints(g: Grid): Edges {
  const { w, h, y } = g
  const cap = w * h
  const ax = new Uint8Array(cap) // |gradient| across columns / rows (central differences)
  const ay = new Uint8Array(cap)
  const gx = new Int16Array(cap)
  const histX = new Uint32Array(256)
  for (let r = 1; r < h - 1; r++) {
    for (let c = 1; c < w - 1; c++) {
      const i = r * w + c
      const dx = y[i + 1] - y[i - 1]
      const dy = y[i + w] - y[i - w]
      gx[i] = dx
      const mx = dx < 0 ? -dx : dx
      ax[i] = mx
      ay[i] = dy < 0 ? -dy : dy
      histX[mx]++
    }
  }
  // "Calm" cells: below the noise threshold (median gradient of the frame, 0 on clean art, scaled up) and of the page's
  // background luminance (the commonest luminance among the flat cells: screens are mostly background, cards are rarely flat).
  const theta = Math.max(THETA_FLOOR, THETA_MUL * histMedian(histX, (w - 2) * (h - 2)))
  const bh = new Uint32Array(64)
  for (let i = 0; i < cap; i++) if (ax[i] < theta && ay[i] < theta) bh[y[i] >> 2]++
  let bgBin = 0
  for (let b = 1; b < 64; b++) if (bh[b] > bh[bgBin]) bgBin = b
  const bgY = bgBin * 4 + 2
  const tol = BG_TOL + 0.4 * bgY
  const calm = new Uint8Array(cap)
  for (let i = 0; i < cap; i++) {
    const d = y[i] - bgY
    calm[i] = ax[i] < theta && ay[i] < theta && d <= tol && -d <= tol ? 1 : 0
  }
  // Vertical edges are found on gx summed over 3 rows (signed: along a straight edge it adds up and noise averages out, which
  // lets a faint edge of dark art survive a noisy photo; across a diagonal stroke it cancels).
  const sx = new Uint8Array(cap)
  const histV = new Uint32Array(256)
  for (let r = 1; r < h - 1; r++) {
    for (let c = 1; c < w - 1; c++) {
      const i = r * w + c
      const v = (gx[i - w] + gx[i] + gx[i + w]) / 3
      const m = v < 0 ? -v : v
      sx[i] = m > 255 ? 255 : m
      histV[sx[i]]++
    }
  }
  histV[0] += cap - (w - 2) * (h - 2) // the frame's border cells
  const thetaV = Math.max(THETA_FLOOR, THETA_MUL * histMedian(histV, cap))
  const histH = new Uint32Array(256)
  for (let i = 0; i < cap; i++) histH[ay[i]]++
  const thetaH = Math.max(THETA_FLOOR, THETA_MUL * histMedian(histH, cap))
  // thin points: non-maximum suppression across the edge, and the gradient along it must be much weaker (axis-aligned edges)
  const vmap = new Uint8Array(cap)
  const hmap = new Uint8Array(cap)
  const vx = new Int16Array(cap >> 2)
  const vy = new Int16Array(cap >> 2)
  const hx = new Int16Array(cap >> 2)
  const hy = new Int16Array(cap >> 2)
  let nv = 0
  let nh = 0
  for (let r = 1; r < h - 1; r++) {
    for (let c = 1; c < w - 1; c++) {
      const i = r * w + c
      const a = sx[i]
      if (a >= thetaV && a >= sx[i - 1] && a > sx[i + 1] && a >= ORI_V * min3(ay[i - 1], ay[i], ay[i + 1]) && nv < vx.length) {
        vx[nv] = c
        vy[nv++] = r
        vmap[i] = 1
      }
      const b = ay[i]
      if (b >= thetaH && b >= ay[i - w] && b > ay[i + w] && b >= ORI_H * min3(ax[i - w], ax[i], ax[i + w]) && nh < hx.length) {
        hx[nh] = c
        hy[nh++] = r
        hmap[i] = 1
      }
    }
  }
  const vt = chainLengths(vmap, w, h, true)
  const ht = chainLengths(hmap, w, h, false)
  const vl = new Uint8Array(nv)
  const hl = new Uint8Array(nh)
  for (let p = 0; p < nv; p++) vl[p] = vt[vy[p] * w + vx[p]]
  for (let p = 0; p < nh; p++) hl[p] = ht[hy[p] * w + hx[p]]
  const vrow = new Int32Array(h + 1)
  for (let p = 0; p < nv; p++) vrow[vy[p] + 1]++
  for (let r = 0; r < h; r++) vrow[r + 1] += vrow[r]
  const hrow = new Int32Array(h + 1)
  for (let p = 0; p < nh; p++) hrow[hy[p] + 1]++
  for (let r = 0; r < h; r++) hrow[r + 1] += hrow[r]
  return { w, h, vx, vy, nv, hx, hy, nh, vrow, hrow, vl, hl, calm }
}

// ---------------------------------------------------------------------------------------------------------------------------
// 2. Row hypotheses

interface Line {
  s: number // slope: y grows by s per cell of x
  rho: number // y at x = w / 2
  frame?: boolean // the frame border, standing in for a row line that is cut off
}

interface RowCand {
  top: Line
  bot: Line
  score: number
  implied?: boolean // one edge is implied by the page's tile pitch, not seen: only the landscape reading applies
}

// Share of a strip next to a row line that is calm (no gradient, background luminance): between rows there is bare background,
// inside art there is not. Strips that fall outside the frame count as calm (the row touches the frame edge).
function flatness(e: Edges, ln: Line, x0: number, x1: number, dir: number): number {
  const { w, h, calm } = e
  const cx = w / 2
  let flat = 0
  let n = 0
  const xa = x0 > 0 ? x0 | 0 : 0
  const xb = x1 < w ? Math.ceil(x1) : w
  for (let x = xa; x < xb; x += 2) {
    const y = ln.rho + ln.s * (x - cx) + 0.5
    for (let o = 2; o <= 4; o++) {
      const yy = (y + dir * o) | 0
      n++
      if (yy < 1 || yy >= h - 1 || calm[yy * w + x]) flat++
    }
  }
  return n ? flat / n : 1
}

// Tile pitch of the page (cells) from the autocorrelation of the vertical-edge comb, summed over horizontal strips so that rows
// scrolled to different offsets still agree. Returns the pitch or 0 when no periodicity stands out.
function estimatePitch(e: Edges): number {
  const { w, h } = e
  const W2 = w >> 1 // columns are pooled in pairs: the pitch only needs to be right to a cell or two
  const lagMin = Math.round(LAG_MIN * W2)
  const lagMax = Math.floor(0.45 * W2)
  const acc = new Float32Array(lagMax + 1)
  const strip = 12
  const col = new Float32Array(W2)
  const pre = new Float32Array(W2 + 1)
  const hp = new Float32Array(W2)
  let used = 0
  for (let y0 = 0; y0 + strip <= h; y0 += strip >> 1) {
    col.fill(0)
    let tot = 0
    for (let p = e.vrow[y0]; p < e.vrow[y0 + strip]; p++) {
      if (e.vl[p] < 8) continue
      const x = e.vx[p] >> 1
      if (x < W2) {
        col[x]++
        tot++
      }
    }
    if (tot < 12) continue
    // spikes over the local mean
    for (let x = 0; x < W2; x++) pre[x + 1] = pre[x] + col[x]
    let energy = 0
    for (let x = 0; x < W2; x++) {
      const a = x - 4 > 0 ? x - 4 : 0
      const b = x + 5 < W2 ? x + 5 : W2
      const v = col[x] + (x > 0 ? col[x - 1] : 0) + (x + 1 < W2 ? col[x + 1] : 0) - (3 * (pre[b] - pre[a])) / (b - a)
      hp[x] = v > 0 ? v : 0
      energy += hp[x] * hp[x]
    }
    if (energy <= 0) continue
    used++
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let r = 0
      for (let x = 0; x + lag < W2; x++) r += hp[x] * hp[x + lag]
      acc[lag] += r / energy
    }
  }
  if (!used) return 0
  let mx = 0
  for (let lag = lagMin; lag <= lagMax; lag++) if (acc[lag] > mx) mx = acc[lag]
  if (mx <= 0) return 0
  // the smallest lag among the strong peaks (multiples of the pitch peak too)
  for (let lag = lagMin + 1; lag < lagMax; lag++) {
    if (acc[lag] >= PITCH_PEAK * mx && acc[lag] >= acc[lag - 1] && acc[lag] >= acc[lag + 1]) return 2 * lag
  }
  return 0
}

// Hough accumulator over (slope, rho) from the long horizontal edge chains; pairs of its strongest lines with a separation a
// tile row can have are row hypotheses, best first. A row cut off by the frame pairs its one visible line with the frame
// border; a row with one faint edge pairs its visible line with the tile height the page's pitch implies.
function rowCandidates(e: Edges, maxN: number): RowCand[] {
  const { w, h } = e
  const cx = w / 2
  const ns = Math.round((2 * S_MAX) / S_STEP) + 1
  const pad = Math.ceil(S_MAX * cx) + 3
  const R = h + 2 * pad
  const A = new Int32Array(ns * R)
  const slope = new Float32Array(ns)
  for (let si = 0; si < ns; si++) slope[si] = -S_MAX + si * S_STEP
  for (let p = 0; p < e.nh; p++) {
    if (e.hl[p] < MIN_HCHAIN) continue
    const x = e.hx[p] - cx
    const y = e.hy[p] + pad + 0.5
    for (let si = 0; si < ns; si++) A[si * R + ((y - slope[si] * x) | 0)]++
  }
  const B = new Float32Array(ns * R)
  for (let si = 0; si < ns; si++) {
    const o = si * R
    for (let r = 1; r < R - 1; r++) B[o + r] = (A[o + r - 1] + 2 * A[o + r] + A[o + r + 1]) / 2
  }
  const thr = LINE_THR * w
  const maxH = Math.floor(0.6 * h)
  // strongest line peaks, non-maximum suppressed in (slope, rho)
  const lines: (Line & { v: number })[] = []
  for (let n = 0; n < N_LINES; n++) {
    let best = 0
    let bi = -1
    for (let i = 0; i < B.length; i++) {
      if (B[i] > best) {
        best = B[i]
        bi = i
      }
    }
    if (bi < 0 || best < thr) break
    const si = (bi / R) | 0
    const r = bi % R
    lines.push({ s: slope[si], rho: r - pad, v: best })
    for (let s2 = Math.max(0, si - 10); s2 <= Math.min(ns - 1, si + 10); s2++) {
      for (let r2 = Math.max(0, r - 4); r2 <= Math.min(R - 1, r + 4); r2++) B[s2 * R + r2] = 0
    }
  }
  const cands: RowCand[] = []
  const frameTop: Line = { s: 0, rho: 0, frame: true }
  const frameBot: Line = { s: 0, rho: h - 1, frame: true }
  const pitch = estimatePitch(e)
  if (pitch > 0) {
    for (const f of PITCH_TILE) {
      const hh = (pitch * f) / LANDSCAPE.aspect
      for (const a of lines) {
        if (a.rho + hh <= h) cands.push({ top: a, bot: { s: a.s, rho: a.rho + hh }, score: a.v + PITCH_BONUS * thr, implied: true })
        if (a.rho - hh >= 0) cands.push({ top: { s: a.s, rho: a.rho - hh }, bot: a, score: a.v + PITCH_BONUS * thr, implied: true })
      }
    }
  }
  for (const a of lines) {
    for (const b of lines) {
      const sep = b.rho - a.rho
      if (sep < MIN_ROW_H || sep > maxH || Math.abs(a.s - b.s) > MAX_SLOPE_DIFF) continue
      cands.push({ top: a, bot: b, score: Math.min(a.v, b.v) + 0.25 * (a.v + b.v) })
    }
    // cut off at the bottom / top of the frame (only nearly level rows)
    if (Math.abs(a.s) <= 0.04) {
      if (h - 1 - a.rho >= MIN_ROW_H && h - 1 - a.rho <= maxH) cands.push({ top: a, bot: frameBot, score: a.v + thr })
      if (a.rho >= MIN_ROW_H && a.rho <= maxH) cands.push({ top: frameTop, bot: a, score: a.v + thr })
    }
  }
  cands.sort((a, b) => b.score - a.score)
  // rows are bounded by bare background: a cheap strip test per line (line objects are shared between candidates)
  const above = new Map<Line, number>()
  const below = new Map<Line, number>()
  const flatAbove = (ln: Line): number => {
    let v = above.get(ln)
    if (v === undefined) above.set(ln, (v = flatness(e, ln, 0, w, -1)))
    return v
  }
  const flatBelow = (ln: Line): number => {
    let v = below.get(ln)
    if (v === undefined) below.set(ln, (v = flatness(e, ln, 0, w, 1)))
    return v
  }
  const out: RowCand[] = []
  for (const c of cands) {
    if (out.length >= maxN) break
    if (flatAbove(c.top) < 0.4 || flatBelow(c.bot) < 0.4) continue
    out.push(c)
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------------------
// 3. Segmenting a row hypothesis into tiles

interface Profiles {
  ev: Float32Array // vertical-edge evidence per column, 0..1
  busy: Float32Array // prefix sums of the share of non-background cells per column
  X: Float32Array // raw vertical-edge counts per column
}

// Vertical-edge evidence per column (u = x corrected for the lean of the row) and the share of busy cells. A tile side is a
// spike over the texture on both of its flanks: art is full of vertical edges, but not a spike that is a whole row tall.
function bandProfiles(e: Edges, top: Line, bot: Line, lean: number): Profiles {
  const { w, h } = e
  const cx = w / 2
  const hMid = bot.rho - top.rho
  const m = Math.max(1, Math.round(0.08 * hMid))
  const chainMin = Math.max(4, 0.35 * hMid)
  const X = new Float32Array(w)
  // only the points whose rows can lie inside the band (points are in raster order)
  const ta = top.s * cx
  const ba = bot.s * cx
  const yLo = Math.max(0, Math.floor(top.rho - (ta > 0 ? ta : -ta)))
  const yHi = Math.min(h, Math.ceil(bot.rho + (ba > 0 ? ba : -ba)) + 1)
  const p1 = e.vrow[yHi]
  for (let p = e.vrow[yLo]; p < p1; p++) {
    if (e.vl[p] < chainMin) continue
    const x = e.vx[p]
    const y = e.vy[p]
    const t = top.rho + top.s * (x - cx)
    const b = bot.rho + bot.s * (x - cx)
    if (y < t + m || y > b - m) continue
    const u = (x + lean * (y - (t + b) / 2) + 0.5) | 0
    if (u >= 0 && u < w) X[u]++
  }
  // an edge that is a ramp over two cells lands on neighbouring columns from row to row: pool 3 columns
  const pre = new Float32Array(w + 1)
  const Xs = new Float32Array(w)
  for (let u = 0; u < w; u++) {
    Xs[u] = X[u] + (u > 0 ? X[u - 1] : 0) + (u + 1 < w ? X[u + 1] : 0)
    pre[u + 1] = pre[u] + Xs[u]
  }
  const ev = new Float32Array(w)
  const inv = 1 / (0.5 * hMid > 2 ? 0.5 * hMid : 2)
  for (let u = 0; u < w; u++) {
    // flanks: 6 cells that start 4 cells away
    const la = u - 10 < 0 ? 0 : u - 10
    const lb = u - 4 < 0 ? 0 : u - 4
    const ra = u + 5 > w ? w : u + 5
    const rb = u + 11 > w ? w : u + 11
    const l = lb > la ? (pre[lb] - pre[la]) / (lb - la) : 0
    const r = rb > ra ? (pre[rb] - pre[ra]) / (rb - ra) : 0
    const c = Xs[u] - (l > r ? l : r)
    ev[u] = c > 0 ? (c * inv < 1 ? c * inv : 1) : 0
  }
  // Share of non-background cells per column: art is busy, the gap between posters (numerals, bare screen) is not.
  const busy = new Float32Array(w + 1)
  const col = new Float32Array(w)
  for (let x = 0; x < w; x++) {
    const t = top.rho + top.s * (x - cx)
    const b = bot.rho + bot.s * (x - cx)
    const dy = (b - t) / BUSY_SAMPLES
    const mid = (t + b) / 2
    let y = t + dy / 2
    for (let j = 0; j < BUSY_SAMPLES; j++, y += dy) {
      const yy = (y + 0.5) | 0
      if (yy < 0 || yy >= h) continue
      const u = (x + lean * (y - mid) + 0.5) | 0
      if (u >= 0 && u < w && !e.calm[yy * w + x]) col[u]++
    }
  }
  for (let u = 0; u < w; u++) busy[u + 1] = busy[u] + col[u] / BUSY_SAMPLES
  return { ev, busy, X }
}

interface Slot {
  l: number // tile sides (columns; may lie outside the frame for a tile cut off by it)
  r: number
  evL: number // edge evidence at each side
  evR: number
}

interface Segmentation {
  slots: Slot[]
  total: number
}

// Dynamic programming over tile placements: every tile is [l, r] with width near the nominal one, consecutive tiles are
// separated by a gap in the hypothesis' range. Score of a tile = mean edge evidence at both sides minus a base level and a
// width penalty, plus a bonus for a busy interior; a busy gap costs. Positions are searched on a grid of up to 2 cells (the
// sides are re-located on the raw edge columns afterwards).
function segmentRow(ev: Float32Array, busy: Float32Array, w: number, hyp: Hypothesis): Segmentation | null {
  const W = ev.length
  const off = Math.ceil(0.4 * w)
  const N = W + 2 * off
  const S = w >= 24 ? 2 : 1
  const Nc = Math.ceil(N / S)
  const E = new Float32Array(Nc)
  const at = new Int32Array(Nc) // fine position of the strongest evidence in the coarse cell
  for (let q = 0; q < Nc; q++) {
    let bestV = -1
    let bestP = q * S
    for (let p = q * S; p < q * S + S && p < N; p++) {
      const x = p - off
      let v = NEUTRAL
      if (x >= 0 && x < W) {
        v = ev[x]
        if (x > 0 && ev[x - 1] > v) v = ev[x - 1]
        if (x + 1 < W && ev[x + 1] > v) v = ev[x + 1]
      }
      if (v > bestV) {
        bestV = v
        bestP = p
      }
    }
    E[q] = bestV
    at[q] = bestP
  }
  const twLo = Math.max(2, Math.floor((0.84 * w) / S))
  const twHi = Math.ceil((1.22 * w) / S)
  const gLo = Math.floor((hyp.gapLo * w) / S)
  const gHi = Math.max(gLo + 1, Math.ceil((hyp.gapHi * w) / S))
  const wc = w / S
  const busyRef = hyp.kind === 'landscape' ? BUSY_REF_LANDSCAPE : BUSY_REF_PORTRAIT
  const NEG = -1e9
  const best = new Float32Array(Nc).fill(NEG)
  const fromL = new Int32Array(Nc).fill(-1)
  const pb = new Float32Array(Nc).fill(NEG) // best chain score that can precede a tile starting at l (0 = start here)
  const pbFrom = new Int32Array(Nc).fill(-1) // right side of that previous tile, -1 = none
  const havePb = new Uint8Array(Nc)
  for (let r = twLo; r < Nc; r++) {
    const rx = r * S - off // image column of this right side
    for (let tw = twLo; tw <= twHi && tw <= r; tw++) {
      const l = r - tw
      const lx = l * S - off
      if (!havePb[l]) {
        havePb[l] = 1
        let bv = 0
        let bf = -1
        for (let g = gLo; g <= gHi && l - g >= 0; g++) {
          let v = best[l - g]
          if (g * S >= 3) {
            // the gap between two tiles is bare screen: a busy gap means the "tiles" are fragments of art
            const ga = lx - g * S > 0 ? lx - g * S : 0
            const gbnd = lx < W ? lx : W
            if (gbnd - ga >= 3) {
              const gb = (busy[gbnd] - busy[ga]) / (gbnd - ga)
              if (gb > GAP_REF) v -= GAP_W * (gb - GAP_REF)
            }
          }
          if (v > bv) {
            bv = v
            bf = l - g
          }
        }
        pb[l] = bv
        pbFrom[l] = bf
      }
      const ta = lx > 0 ? lx : 0
      const tb = rx < W ? rx : W
      const dev = (tw > wc ? tw - wc : wc - tw) / wc
      // interior busyness over the part of the tile inside the frame
      const inner = tb - ta >= 3 ? (busy[tb] - busy[ta]) / (tb - ta) : 0.5
      const sc = pb[l] + 0.5 * (E[l] + E[r]) - BASE - LAM * dev + BUSY_W * (inner - busyRef)
      if (sc > best[r]) {
        best[r] = sc
        fromL[r] = l
      }
    }
  }
  let r = -1
  let tot = 0
  for (let q = 0; q < Nc; q++) {
    if (best[q] > tot) {
      tot = best[q]
      r = q
    }
  }
  if (r < 0) return null
  const slots: Slot[] = []
  while (r >= 0) {
    const l = fromL[r]
    slots.push({ l: at[l] - off, r: at[r] - off, evL: E[l], evR: E[r] })
    r = pbFrom[l]
  }
  slots.reverse()
  return { slots, total: tot }
}

interface BandResult {
  top: Line
  bot: Line
  lean: number
  hyp: Hypothesis
  seg: Segmentation
  quality: number
  cand: RowCand
  prof: Profiles
}

// Segment a row hypothesis with a given lean of the vertical sides; the best of the layout hypotheses (and, for a row cut off by
// the frame, of a few guesses at its full height) wins.
function segmentBand(e: Edges, c: RowCand, lean: number): BandResult | null {
  const { top, bot } = c
  const hMid = bot.rho - top.rho
  const prof = bandProfiles(e, top, bot, lean)
  // cheap screen: a row of tiles shows at least two clear sides
  let spikes = 0
  for (let u = 1; u + 1 < prof.ev.length; u++) if (prof.ev[u] >= SPIKE && prof.ev[u] >= prof.ev[u - 1] && prof.ev[u] > prof.ev[u + 1]) spikes++
  if (spikes < 2) return null
  const cut = top.frame || bot.frame
  let out: BandResult | null = null
  for (const hyp of c.implied ? [LANDSCAPE] : [LANDSCAPE, PORTRAIT]) {
    for (const vis of cut ? [0.95, 0.8, 0.68] : [1]) {
      const seg = segmentRow(prof.ev, prof.busy, (hyp.aspect * hMid) / vis, hyp)
      if (!seg) continue
      const x0 = seg.slots[0].l
      const x1 = seg.slots[seg.slots.length - 1].r
      const fl = Math.min(flatness(e, top, x0, x1, -1), flatness(e, bot, x0, x1, 1))
      const quality = seg.total * (0.5 + Math.min(1, c.score / (e.w * 0.8))) * fl * fl
      if (!out || quality > out.quality) out = { top, bot, lean, hyp, seg, quality, cand: c, prof }
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------------------
// 4. Boxes: cell-level snapping, then sub-pixel refinement on the full-resolution frame

// The DP puts a tile side on the spike of the comb: in a gap of a few cells both neighbours share it. Look at the raw edge
// counts next to it: the tile's own side is the strongest column on the tile's side of the gap.
function sideColumn(X: Float32Array, p: number, left: boolean): number {
  const w = X.length
  const a = p - 4 < 0 ? 0 : p - 4
  const b = p + 5 > w ? w : p + 5
  let mx = 0
  for (let c = a; c < b; c++) if (X[c] > mx) mx = X[c]
  if (mx < 3) return p
  const thr = 0.5 * mx
  if (left) {
    for (let c = b - 1; c >= a; c--) if (X[c] >= thr) return c
  } else {
    for (let c = a; c < b; c++) if (X[c] >= thr) return c
  }
  return p
}

// The grid is 2-4 px per cell and a card's pixels get cropped from the box: refine the sides on the full-resolution frame, from
// the gradient profile across an edge on a dozen scanlines inside the tile.
interface Full {
  d: Uint8ClampedArray
  w: number
  h: number
  k: number
}

const lum = (f: Full, x: number, y: number): number => {
  const xi = x < 0 ? 0 : x >= f.w ? f.w - 1 : x
  const yi = y < 0 ? 0 : y >= f.h ? f.h - 1 : y
  const o = (yi * f.w + xi) * 4
  return (77 * f.d[o] + 150 * f.d[o + 1] + 29 * f.d[o + 2]) >> 8
}

// Index of the strongest-looking edge in acc, preferring the outermost one that is at least half as strong (`outsideFirst`:
// the lowest index is the outside, as for a top edge with the gap before it), with parabolic sub-pixel offset.
function outerPeak(acc: Float32Array, outsideFirst: boolean): number {
  let mx = 0
  const n = acc.length
  for (let i = 0; i < n; i++) if (acc[i] > mx) mx = acc[i]
  if (mx <= 0) return -1
  const thr = 0.5 * mx
  let hit = -1
  for (let j = 0; j < n && hit < 0; j++) {
    const i = outsideFirst ? j : n - 1 - j
    if (acc[i] >= thr && (i === 0 || acc[i] >= acc[i - 1]) && (i === n - 1 || acc[i] >= acc[i + 1])) hit = i
  }
  if (hit <= 0 || hit >= n - 1) return hit
  const a = acc[hit - 1]
  const c = acc[hit + 1]
  const den = a - 2 * acc[hit] + c
  return den < 0 ? hit + (0.5 * (a - c)) / den : hit
}

// Refined position (cells) of a tile side nominally at cell coordinate u (the side leans with the row, so every scanline is
// sampled at its own x). Between two landscape tiles the gap shows up as a pair of edges a few pixels apart: this tile's side
// is the one on its own side of it. `gapMax` (px, 0 = single edges only, for posters) bounds that pair.
function refineSide(f: Full, top: Line, bot: Line, lean: number, u: number, left: boolean, cx: number, gapMax: number): number {
  const reach = 3 * f.k
  const acc = new Float32Array(2 * reach + 1)
  const mid = (top.rho + bot.rho) / 2
  const yt = top.rho + top.s * (u - cx)
  const yb = bot.rho + bot.s * (u - cx)
  for (let j = 0; j < SUB_ROWS; j++) {
    const y = yt + (0.15 + (0.7 * (j + 0.5)) / SUB_ROWS) * (yb - yt)
    const px = Math.round((u - lean * (y - mid)) * f.k)
    const py = Math.round(y * f.k)
    for (let d = -reach; d <= reach; d++) {
      const g = lum(f, px + d + 1, py) - lum(f, px + d - 1, py)
      acc[d + reach] += g < 0 ? -g : g
    }
  }
  const n = acc.length
  let mx = 0
  for (let i = 0; i < n; i++) if (acc[i] > mx) mx = acc[i]
  if (mx <= 0) return u
  const peaks: number[] = []
  for (let i = 0; i < n; i++) if (acc[i] >= 0.4 * mx && (i === 0 || acc[i] >= acc[i - 1]) && (i === n - 1 || acc[i] > acc[i + 1])) peaks.push(i)
  let pick = peaks[0]
  for (const i of peaks) if (acc[i] > acc[pick]) pick = i
  if (gapMax > 0) {
    // best pair of peaks 2..gapMax px apart around the nominal position
    let bestPair = 0
    for (let a = 0; a < peaks.length; a++) {
      for (let c = a + 1; c < peaks.length; c++) {
        const d = peaks[c] - peaks[a]
        if (d < 2 || d > gapMax) continue
        const v = acc[peaks[a]] + acc[peaks[c]]
        if (v > bestPair && v > 1.15 * acc[pick]) {
          bestPair = v
          pick = left ? peaks[c] : peaks[a]
        }
      }
    }
  }
  const a = acc[pick - 1] ?? 0
  const c = acc[pick + 1] ?? 0
  const den = a - 2 * acc[pick] + c
  const sub = pick > 0 && pick < n - 1 && den < 0 ? (0.5 * (a - c)) / den : 0
  return u + (pick + sub - reach + 0.5) / f.k // 0.5: a central difference sits on the pixel that carries the edge
}

// Same for a tile's top or bottom edge: offset (cells) from `ln` shifted by `off`, along the tile's columns x0..x1.
function refineEdge(f: Full, ln: Line, off: number, x0: number, x1: number, top: boolean, cx: number): number {
  const reach = 4 * f.k
  const acc = new Float32Array(2 * reach + 1)
  for (let j = 0; j < SUB_ROWS; j++) {
    const x = x0 + (0.15 + (0.7 * (j + 0.5)) / SUB_ROWS) * (x1 - x0)
    const y = ln.rho + ln.s * (x - cx) + off
    const px = Math.round(x * f.k)
    const py = Math.round(y * f.k)
    for (let d = -reach; d <= reach; d++) {
      const g = lum(f, px, py + d + 1) - lum(f, px, py + d - 1)
      acc[d + reach] += g < 0 ? -g : g
    }
  }
  const pk = outerPeak(acc, top)
  return pk < 0 ? 0 : (pk - reach + 0.5) / f.k
}

interface Tile {
  x0: number
  x1: number
  y0: number
  y1: number
  confidence: number
  quad: [Pt, Pt, Pt, Pt] // grid cells
}

// Final boxes (grid coordinates): sides from the raw edge columns and then the full-resolution gradient, top and bottom from the
// strongest long horizontal edges near the row lines (a row title above, a focus tile that sticks out, tilt and keystone all
// show up there).
function refineTiles(e: Edges, b: BandResult, full: Full): Tile[] {
  const cx = e.w / 2
  const mid = (b.top.rho + b.bot.rho) / 2
  const support = Math.min(1, b.quality / 2) // a row of two weak tiles is less certain than six strong ones
  const out: Tile[] = []
  for (const s of b.seg.slots) {
    const w = s.r - s.l
    const l = s.l < 1 ? s.l : sideColumn(b.prof.X, s.l, true)
    const r = s.r >= e.w - 1 ? s.r : sideColumn(b.prof.X, s.r, false)
    let uL = l + 0.5
    let uR = r + 0.5
    const gapMax = b.hyp.kind === 'landscape' ? 0.14 * w * full.k : 0
    if (s.l >= 1) uL = refineSide(full, b.top, b.bot, b.lean, uL, true, cx, gapMax)
    if (s.r < e.w - 1) uR = refineSide(full, b.top, b.bot, b.lean, uR, false, cx, gapMax)
    // 0.5: the line sits on the pixel row that carries the edge
    const dTop = b.top.frame ? 0 : 0.5 + refineEdge(full, b.top, 0.5, uL, uR, true, cx)
    const dBot = b.bot.frame ? 0 : 0.5 + refineEdge(full, b.bot, 0.5, uL, uR, false, cx)
    let x0 = 1e9
    let x1 = -1e9
    let y0 = 1e9
    let y1 = -1e9
    const corner = (u: number, top: boolean): Pt => {
      const ln = top ? b.top : b.bot
      const y = ln.rho + ln.s * (u - cx) + (top ? dTop : dBot)
      return { x: u - b.lean * (y - mid), y }
    }
    const quad: [Pt, Pt, Pt, Pt] = [corner(uL, true), corner(uR, true), corner(uR, false), corner(uL, false)]
    for (const p of quad) {
      if (p.x < x0) x0 = p.x
      if (p.x > x1) x1 = p.x
      if (p.y < y0) y0 = p.y
      if (p.y > y1) y1 = p.y
    }
    out.push({ x0, x1, y0, y1, confidence: Math.min((s.evL + s.evR) / 2, support), quad })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------------------

// Opening then closing with a (2r+1) square: removes bright and dark strokes narrower than the window (letters of a logo, caption
// text) and keeps the broad shapes (tiles, their gaps) with their edges.
function suppressText(g: Grid): Grid {
  const { w, h } = g
  const pass = (src: Uint8Array, dst: Uint8Array, horizontal: boolean, useMax: boolean): void => {
    const n = horizontal ? w : h
    const m = horizontal ? h : w
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < n; i++) {
        let v = useMax ? 0 : 255
        for (let d = -SUPPRESS_R; d <= SUPPRESS_R; d++) {
          const t = i + d < 0 ? 0 : i + d >= n ? n - 1 : i + d
          const x = src[horizontal ? j * w + t : t * w + j]
          if (useMax ? x > v : x < v) v = x
        }
        dst[horizontal ? j * w + i : i * w + j] = v
      }
    }
  }
  const a = new Uint8Array(w * h)
  const b = new Uint8Array(w * h)
  let cur = g.y
  for (const useMax of [false, true, true, false]) { // erode, dilate (opening), dilate, erode (closing)
    pass(cur, a, true, useMax)
    pass(a, b, false, useMax)
    cur = Uint8Array.from(b)
  }
  return { ...g, y: cur }
}

const touchesEdge = (b: Box, img: RgbaImage): boolean => {
  const e = Math.max(1, FRAG_EDGE * Math.min(img.width, img.height))
  return b.x <= e || b.y <= e || b.x + b.w >= img.width - e || b.y + b.h >= img.height - e
}

function isFragment(c: CardCandidate, img: RgbaImage, refArea: number): boolean {
  const b = c.box
  const cut = touchesEdge(b, img)
  if (b.w < (cut ? FRAG_MIN_W_CUT : FRAG_MIN_W) * img.width) return true
  if (!cut) {
    const [lo, hi] = FRAG_ASPECT[c.kind]
    const aspect = b.w / Math.max(1, b.h)
    if (aspect < lo || aspect > hi) return true
    if (refArea > 0 && b.w * b.h < FRAG_REL_AREA * refArea) return true
  }
  return false
}

/** Boxes that are whole tiles, and how many were dropped as fragments. Sizes are judged against the frame and against the other boxes. */
function dropFragments(found: CardCandidate[], img: RgbaImage): { kept: CardCandidate[]; dropped: number } {
  const areas = found.filter((c) => !c.focus && !touchesEdge(c.box, img)).map((c) => c.box.w * c.box.h).sort((x, y) => x - y)
  const ref = areas.length >= 3 ? areas[Math.floor(0.85 * (areas.length - 1))] : 0
  // a portrait box is a poster only if it is clearly taller than the landscape tiles beside it
  const landH = found.filter((c) => c.kind === 'landscape').map((c) => c.box.h).sort((x, y) => x - y)
  const medLand = landH.length >= 3 ? landH[landH.length >> 1] : 0
  const portraitRows = new Set(found.filter((c) => c.kind === 'portrait').map((c) => c.row)).size
  const kept = found.filter(
    (c) => !isFragment(c, img, ref) && !(c.kind === 'portrait' && (portraitRows > FRAG_PORTRAIT_ROWS || (medLand > 0 && (c.box.h < FRAG_PORTRAIT_H[0] * medLand || c.box.h > FRAG_PORTRAIT_H[1] * medLand)))),
  )
  return { kept, dropped: found.length - kept.length }
}

/** Tiles found in `img` (any size; analysed on a ~320 px grid), in image pixels, in no particular order. [] for a blank frame. */
export function detectCards(img: RgbaImage): CardCandidate[] {
  if (img.width < 32 || img.height < 32) return []
  const g = lumaGrid(img)
  const first = dropFragments(detectOnGrid(img, g), img)
  if (first.dropped < Math.max(2, first.kept.length / 2)) return first.kept // a stray odd box is not worth a second look
  // Fragments mean logo / caption text drowned the faint tile edges. Look again with the text smoothed away and keep the reading
  // that explains the frame with more whole tiles.
  const again = dropFragments(detectOnGrid(img, suppressText(g)), img)
  return again.kept.length > first.kept.length ? again.kept : first.kept
}

const intersection = (a: Box, b: Box): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

interface FocusCand {
  band: BandResult
  slot: Slot
  score: number // 0..1+: how well the tile is confirmed as a rectangle
}

// Share of the columns x0..x1 (ends trimmed) along which a long horizontal edge runs next to the line `ln` (within 2 cells, the edge
// may sit a little off the line; two rows are counted so that a shallow diagonal stroke, which crosses a line, does not look like it).
function edgeCover(e: Edges, ln: Line, x0: number, x1: number): number {
  const cx = e.w / 2
  const w = x1 - x0
  const reach = Math.abs(ln.s) * cx
  const yA = Math.max(0, Math.floor(ln.rho - reach - 3))
  const yB = Math.min(e.h, Math.ceil(ln.rho + reach + 3) + 1)
  const cnt = new Float32Array(6)
  for (let p = e.hrow[yA]; p < e.hrow[yB]; p++) {
    const x = e.hx[p]
    if (x < x0 + 0.1 * w || x > x1 - 0.1 * w || e.hl[p] < 0.25 * w) continue
    const k = Math.round(e.hy[p] - ln.rho - ln.s * (x - cx)) + 2 // -2..2 around the line
    if (k >= 0 && k < 5) cnt[k]++
  }
  let best = 0
  for (let k = 0; k < 5; k++) if (cnt[k] + cnt[k + 1] > best) best = cnt[k] + cnt[k + 1]
  return best / (0.8 * w)
}

// Top and bottom of an enlarged tile in the comb of the row `r`, its sides being `l` and `rt` (columns). The tile is taller than its
// row, so the row lines say nothing about them: look for the two long horizontal edges, one tile height apart, that each cover most
// of its width. Null when there are none.
function focusBand(e: Edges, r: BandResult, l: number, rt: number): FocusCand | null {
  const cx = e.w / 2
  const slope = (r.top.s + r.bot.s) / 2
  const w = rt - l
  const hNom = w / r.hyp.aspect
  const mid = (r.top.rho + r.bot.rho) / 2
  const base = Math.floor(mid - 1.2 * hNom)
  const n = Math.ceil(2.4 * hNom) + 4
  const cnt = new Float32Array(n)
  const reach = Math.abs(slope) * cx
  const yA = Math.max(0, Math.floor(base - reach))
  const yB = Math.min(e.h, Math.ceil(base + n + reach) + 1)
  const xa = l + 0.1 * w
  const xb = rt - 0.1 * w
  const minChain = 0.25 * w
  for (let p = e.hrow[yA]; p < e.hrow[yB]; p++) {
    const x = e.hx[p]
    if (x < xa || x > xb || e.hl[p] < minChain) continue
    const i = Math.round(e.hy[p] - slope * (x - cx)) - base
    if (i >= 0 && i < n) cnt[i]++
  }
  const cov = (i: number): number => (cnt[i - 1] + cnt[i] + cnt[i + 1]) / (0.8 * w)
  let best = 0
  let y0 = 0
  let y1 = 0
  for (let i = 1; i < n - 1; i++) {
    for (const f of [0.92, 1, 1.08]) {
      const j = Math.round(i + f * hNom)
      if (j >= n - 1) continue
      const v = Math.min(cov(i), cov(j))
      if (v > best) {
        best = v
        y0 = i
        y1 = j
      }
    }
  }
  if (best < FOCUS_COV) return null
  const dev = Math.abs(Math.log(w / (y1 - y0) / r.hyp.aspect)) // a tile is 16:9; among nested rectangles on the same two edges the right one fits that best
  if (dev > FOCUS_ASPECT) return null
  const slot: Slot = { l, r: rt, evL: r.prof.ev[Math.round(l)], evR: r.prof.ev[Math.round(rt)] }
  return { band: { ...r, top: { s: slope, rho: base + y0 }, bot: { s: slope, rho: base + y1 }, seg: { slots: [slot], total: r.seg.total } }, slot, score: best - dev }
}

// Pairs of tile sides of the row `r` that are an enlarged tile apart, as focusBand candidates. A tile side that is the near side of a
// gap (the neighbour's side is a few cells further out) is the side of this tile, not the neighbour's.
function wideCandidates(e: Edges, r: BandResult, med: number): FocusCand[] {
  const ev = r.prof.ev
  const peaks: number[] = []
  for (let u = 1; u + 1 < ev.length; u++) if (ev[u] >= SPIKE && ev[u] >= ev[u - 1] && ev[u] > ev[u + 1]) peaks.push(u)
  const lo: number[] = [] // first side of every cluster of sides (a tile's left side comes last, its right side first)
  const hi: number[] = []
  peaks.forEach((u, i) => {
    if (i === 0 || u - peaks[i - 1] > 0.2 * med) {
      lo.push(u)
      hi.push(u)
    } else hi[hi.length - 1] = u
  })
  const out: FocusCand[] = []
  for (let i = 0; i < lo.length; i++) {
    for (let j = i + 1; j < lo.length; j++) {
      const w = lo[j] - hi[i]
      if (w < FOCUS_REL * med) continue
      if (w > FOCUS_MAX_W * e.w) break
      const c = focusBand(e, r, hi[i], lo[j])
      if (c) out.push(c)
    }
  }
  return out
}

// The enlarged focus tile of the screen. It is wider than its row's tile width, so the row segmentation misses it or cuts it up; it
// is found as a row of one big tile (its own top and bottom edge are strong lines: `lone`) or, beside its neighbours, as a pair of
// tile sides a wide tile apart in the comb of an ordinary row. `regular` are the ordinary rows already chosen: they set the size a
// normal tile has (median width) and show where the focus tile sits. Without them nothing tells a focus tile from a banner.
function pickFocus(e: Edges, lone: BandResult[], regular: BandResult[]): BandResult[] {
  const rows = regular.filter((b) => b.hyp.kind === 'landscape')
  const widths = rows.flatMap((b) => b.seg.slots.map((s) => s.r - s.l)).sort((x, y) => x - y)
  if (widths.length < 2) return []
  const med = widths[widths.length >> 1]
  const cands: FocusCand[] = lone.filter((b) => b.quality >= FOCUS_Q).map((b) => ({ band: b, slot: b.seg.slots[0], score: b.quality }))
  const found: FocusCand[] = []
  for (const r of rows) if (!r.top.frame && !r.bot.frame) found.push(...wideCandidates(e, r, med))
  cands.push(...found.sort((a, b) => b.score - a.score))
  const picked: BandResult[] = []
  for (const { band: b, slot: s } of cands) {
    const w = s.r - s.l
    const y0 = b.top.rho
    const y1 = b.bot.rho
    if (s.evL < SPIKE || s.evR < SPIKE || w < FOCUS_REL * med || w > FOCUS_MAX_W * e.w) continue
    // like a row, the tile is bounded by bare background above and below (not by the art of the rows it would be squeezed between)
    if (Math.min(flatness(e, b.top, s.l, s.r, -1), flatness(e, b.bot, s.l, s.r, 1)) < FOCUS_FLAT) continue
    if (picked.some((p) => Math.min(s.r, p.seg.slots[0].r) > Math.max(s.l, p.seg.slots[0].l) && Math.min(y1, p.bot.rho) > Math.max(y0, p.top.rho))) continue
    // The box must be one tile. It is not if an ordinary tile lies inside it, top and bottom edge in place, or two rows do (where
    // the focus tile covers the tiles of its own row the segmentation bridges them with guesses that have no such edges).
    let spans = false
    let beside = false
    let above = false
    let below = false
    let inside = 0
    for (const r of rows) {
      const rh = r.bot.rho - r.top.rho
      const inY = Math.min(y1, r.bot.rho) - Math.max(y0, r.top.rho)
      if (inY > 0.7 * rh) inside++
      if (r.bot.rho <= y0 + 0.1 * (y1 - y0)) above = true
      if (r.top.rho >= y1 - 0.1 * (y1 - y0)) below = true
      for (const t of r.seg.slots) {
        const tw = t.r - t.l
        const inX = Math.min(s.r, t.r) - Math.max(s.l, t.l)
        if (inX > 0.7 * tw && inY > 0.7 * rh && Math.abs(tw - med) <= 0.15 * med && !spans && Math.max(edgeCover(e, r.top, t.l, t.r), edgeCover(e, r.bot, t.l, t.r)) >= FOCUS_TILE) spans = true
        if (inY >= 0.5 * rh && inX < 0.3 * tw && (t.r <= s.l ? s.l - t.r : t.l - s.r) <= FOCUS_NEAR * med) beside = true
      }
    }
    if (inside >= 2) spans = true
    if (!spans && (beside || (above && below))) picked.push(b)
  }
  return picked
}

function detectOnGrid(img: RgbaImage, g: Grid): CardCandidate[] {
  const e = edgePoints(g)
  const bands: BandResult[] = []
  for (const c of rowCandidates(e, N_CANDIDATES)) {
    const r = segmentBand(e, c, (c.top.s + c.bot.s) / 2)
    if (r) bands.push(r)
  }
  // best rows first; a row that overlaps a better one is the same row seen through other lines
  bands.sort((a, b) => b.quality - a.quality)
  let chosen: BandResult[] = []
  const lone: BandResult[] = [] // rows of one big tile: focus tile candidates
  for (const b of bands) {
    if (b.quality < Q_MIN) continue
    if (b.seg.slots.length === 1 && b.hyp.kind === 'landscape' && !b.cand.implied) lone.push(b)
    if (b.seg.slots.length < 2) continue
    const y0 = b.top.rho
    const y1 = b.bot.rho
    if (chosen.some((c) => Math.min(y1, c.bot.rho) - Math.max(y0, c.top.rho) > 0.25 * Math.min(y1 - y0, c.bot.rho - c.top.rho))) continue
    chosen.push(b)
  }
  // A hero banner looks like one enormous landscape "tile" (or a few): drop rows whose tiles are far bigger than a screen's
  // worth of tiles can be, or much taller than the other landscape rows of the same frame.
  const landscape = chosen.filter((b) => b.hyp.kind === 'landscape')
  const rowH = (b: BandResult): number => b.bot.rho - b.top.rho
  const hero = new Set<BandResult>()
  for (const b of landscape) {
    const others = landscape.filter((o) => o !== b).map(rowH).sort((x, y) => x - y)
    const med = others.length >= 2 ? others[others.length >> 1] : 0
    if (rowH(b) * b.hyp.aspect > MAX_TILE_W * e.w || (med > 0 && rowH(b) > 1.5 * med)) hero.add(b)
  }
  chosen = chosen.filter((b) => !hero.has(b))
  const focus = pickFocus(e, lone, chosen)
  // The vertical sides lean with the rotation; keystone changes that a little: re-segment the chosen rows with a lean a bit
  // either side of the row slope and keep the better.
  for (let i = 0; i < chosen.length; i++) {
    for (const d of [-0.03, 0.03]) {
      const alt = segmentBand(e, chosen[i].cand, (chosen[i].top.s + chosen[i].bot.s) / 2 + d)
      if (alt && alt.quality > chosen[i].quality * 1.1) chosen[i] = alt
    }
  }
  const out: CardCandidate[] = []
  const full: Full = { d: img.data, w: img.width, h: img.height, k: g.k }
  const emit = (b: BandResult, row: number, isFocus: boolean): void => {
    for (const t of refineTiles(e, b, full)) {
      const x0 = Math.max(0, t.x0) * g.k
      const x1 = Math.min(g.w, t.x1) * g.k
      const y0 = Math.max(0, t.y0) * g.k
      const y1 = Math.min(g.h, t.y1) * g.k
      if (x1 - x0 < 2 || y1 - y0 < 2) continue
      const clampX = (v: number) => Math.min(g.w * g.k, Math.max(0, v * g.k))
      const clampY = (v: number) => Math.min(g.h * g.k, Math.max(0, v * g.k))
      const q = t.quad.map((p) => ({ x: clampX(p.x), y: clampY(p.y) })) as CardCandidate['quad']
      const c: CardCandidate = { box: { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) }, confidence: t.confidence, kind: b.hyp.kind, row, quad: q }
      out.push(isFocus ? { ...c, focus: true } : c)
    }
  }
  chosen.forEach((b, row) => emit(b, row, false))
  // a focus tile shares the row index of the ordinary tiles beside it; boxes the row segmentation cut out of it are not tiles
  focus.forEach((b, i) => {
    const mid = (b.top.rho + b.bot.rho) / 2
    const beside = chosen.findIndex((r) => r.top.rho <= mid && mid <= r.bot.rho)
    emit(b, beside >= 0 ? beside : chosen.length + i, true)
  })
  if (focus.length) {
    const covered = (c: CardCandidate): boolean =>
      !c.focus && out.some((f) => f.focus && intersection(c.box, f.box) >= FOCUS_COVER * c.box.w * c.box.h)
    return out.filter((c) => !covered(c))
  }
  return out
}
