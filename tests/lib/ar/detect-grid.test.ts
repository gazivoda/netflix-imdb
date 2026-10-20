import { RgbaImage } from '../../../lib/card-hash'
import { Box, iou } from '../../../lib/card-tracker'
import { detectCards } from '../../../lib/ar/detect-grid'
import { findCards, findCardsDetailed } from '../../../lib/ar/card-finder'
import { mulberry32 } from '../../helpers/ar-scene'

// Hand-built frames for the failure modes the real Netflix screen has and the procedural scenes of ar-scene.ts do not: DARK art
// (the tile is hardly brighter than the screen, some tiles are black, the only bright thing is a logo), row labels, a hero
// banner, big-numeral Top-10 rows with portrait posters, an enlarged focus tile, rows scrolled to different offsets.

type Rgb = [number, number, number]
const BG: Rgb = [20, 20, 22]

function blank(w: number, h: number, bg: Rgb = BG): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) data.set([bg[0], bg[1], bg[2], 255], i * 4)
  return { data, width: w, height: h }
}

function paint(img: RgbaImage, b: Box, shade: (u: number, v: number) => Rgb): void {
  for (let y = Math.max(0, b.y); y < Math.min(img.height, b.y + b.h); y++) {
    for (let x = Math.max(0, b.x); x < Math.min(img.width, b.x + b.w); x++) {
      const c = shade((x - b.x) / b.w, (y - b.y) / b.h)
      img.data.set([c[0], c[1], c[2], 255], (y * img.width + x) * 4)
    }
  }
}

// Key-art stand-in: smooth blobs around `base` luminance (+-amp), fine texture, and optionally a bright "logo" block and stripes.
function art(seed: number, base: number, amp: number, opts: { logo?: boolean; stripes?: boolean } = {}): (u: number, v: number) => Rgb {
  const rng = mulberry32(seed)
  const p = Array.from({ length: 6 }, () => rng() * 6.28)
  const f = Array.from({ length: 3 }, () => 2 + rng() * 5)
  const lx = 0.1 + rng() * 0.4
  const ly = 0.3 + rng() * 0.3
  return (u, v) => {
    let n = Math.sin(f[0] * u + p[0]) * Math.sin(f[1] * v + p[1]) + 0.6 * Math.sin(f[2] * (u + v) + p[2])
    n += 0.15 * Math.sin(97 * u + 61 * v + p[3]) // texture
    if (opts.stripes) n += 0.5 * Math.sin(70 * (u + 0.7 * v))
    let l = base + amp * n
    if (opts.logo && u > lx && u < lx + 0.45 && v > ly && v < ly + 0.14) l = 200 // the title logo
    l = Math.max(0, Math.min(255, l))
    return [l * 0.9, l * 0.95, l]
  }
}

function rowOfTiles(img: RgbaImage, seed: number, x0: number, y: number, w: number, h: number, gap: number, bases: number[], opts: { logo?: boolean; stripes?: boolean } = {}): Box[] {
  return bases.map((base, i) => {
    const b = { x: x0 + i * (w + gap), y, w, h }
    paint(img, b, art(seed * 31 + i, base, Math.max(6, base * 0.35), { logo: opts.logo && i % 2 === 0, stripes: opts.stripes }))
    return b
  })
}

// bright pseudo-text (row label / caption): short strokes
function text(img: RgbaImage, x: number, y: number, len: number, lum = 215): void {
  for (let i = 0; i < len; i += 7) paint(img, { x: x + i, y, w: 4, h: 9 }, () => [lum, lum, lum])
}

function score(found: Box[], truth: Box[], minIou = 0.5): { tp: number; fp: number; fn: number; recall: number; precision: number } {
  const used = new Set<number>()
  let tp = 0
  for (const t of truth) {
    let best = -1
    let bv = minIou
    found.forEach((f, i) => {
      const v = iou(f, t)
      if (!used.has(i) && v >= bv) {
        bv = v
        best = i
      }
    })
    if (best >= 0) {
      used.add(best)
      tp++
    }
  }
  const fp = found.length - used.size
  return { tp, fp, fn: truth.length - tp, recall: tp / Math.max(1, truth.length), precision: tp / Math.max(1, tp + fp) }
}

describe('detectCards on hand-built Netflix-like frames', () => {
  it('finds dark tiles whose art is barely brighter than the screen, some of them black, with a bright logo as the only contrast', () => {
    const img = blank(640, 360)
    const truth = [
      ...rowOfTiles(img, 1, 18, 40, 96, 54, 8, [6, 16, 28, 40, 24, 60], { logo: true }),
      ...rowOfTiles(img, 2, 18, 150, 96, 54, 8, [30, 5, 18, 45, 12, 34], { logo: true }),
      ...rowOfTiles(img, 3, 18, 260, 96, 54, 8, [22, 38, 8, 26, 55, 15], { logo: true }),
    ]
    const found = findCards(img)
    const s = score(found, truth)
    expect(s.recall).toBeGreaterThanOrEqual(0.85)
    expect(s.precision).toBeGreaterThanOrEqual(0.9)
    // a box must hold the whole tile, not just the bright logo inside it
    for (const t of truth) {
      const hit = found.find((f) => iou(f, t) >= 0.5)
      if (hit) expect(hit.w).toBeGreaterThan(0.8 * t.w)
    }
  })

  it('is not fooled by diagonal stripes (moire) over the art: only the tile sides make the comb', () => {
    const img = blank(640, 360)
    const truth = [...rowOfTiles(img, 4, 14, 70, 112, 63, 10, [60, 80, 50, 70, 90], { stripes: true }), ...rowOfTiles(img, 5, 14, 200, 112, 63, 10, [70, 55, 85, 65, 75], { stripes: true })]
    const s = score(findCards(img), truth)
    expect(s.recall).toBeGreaterThanOrEqual(0.9)
    expect(s.precision).toBeGreaterThanOrEqual(0.9)
  })

  it('does not stretch a box over the row title above or the caption below a tile', () => {
    const img = blank(640, 360)
    const truth: Box[] = []
    for (const y of [50, 200]) {
      text(img, 20, y - 22, 150) // "Because you watched ..."
      truth.push(...rowOfTiles(img, y, 18, y, 96, 54, 8, [60, 90, 70, 100, 80, 65]))
      for (let i = 0; i < 6; i++) text(img, 20 + i * 104, y + 62, 60) // captions
    }
    const found = findCards(img)
    const s = score(found, truth, 0.7)
    expect(s.recall).toBeGreaterThanOrEqual(0.9)
    expect(s.precision).toBeGreaterThanOrEqual(0.9)
  })

  it.each([
    ['a tall billboard above two rows', 150, 2],
    ['a tall billboard on its own', 150, 0],
    ['a billboard just 2x as tall as the tiles above three rows', 100, 3],
  ])('does not report a hero banner as tiles: %s (big letter stems every ~1.8 heights look like a comb of tiles)', (_name, heroH, rows) => {
    const img = blank(640, 360)
    paint(img, { x: 30, y: 12, w: 590, h: heroH }, art(9, 110, 38, { logo: true }))
    const pitch = Math.round(1.78 * heroH)
    for (let x = 40; x + 14 < 620; x += pitch) paint(img, { x, y: 12, w: 14, h: heroH }, () => [235, 235, 235])
    const truth: Box[] = []
    for (let r = 0; r < rows; r++) truth.push(...rowOfTiles(img, 6 + r, 18, 12 + heroH + 30 + r * 80, 96, 54, 8, [60, 90, 70, 100, 80, 65]))
    const found = findCards(img)
    if (rows) expect(score(found, truth).recall).toBeGreaterThanOrEqual(0.9)
    expect(found.filter((f) => f.y + f.h <= 12 + heroH + 10).length).toBe(0)
  })

  it('finds portrait Top-10 posters between big outline numerals', () => {
    const img = blank(640, 360)
    const truth: Box[] = []
    for (const y of [30, 200]) {
      for (let i = 0; i < 5; i++) {
        const b = { x: 62 + i * 122, y, w: 68, h: 102 }
        // outlined numeral to the left of the poster: thin bright strokes
        paint(img, { x: b.x - 50, y: y + 30, w: 5, h: 70 }, () => [110, 110, 110])
        paint(img, { x: b.x - 50, y: y + 30, w: 30, h: 5 }, () => [110, 110, 110])
        paint(img, { x: b.x - 25, y: y + 30, w: 5, h: 70 }, () => [110, 110, 110])
        paint(img, b, art(100 + i + y, 70 + 25 * i, 28, { logo: i % 2 === 0 }))
        truth.push(b)
      }
    }
    const found = findCards(img)
    const s = score(found, truth)
    expect(s.recall).toBeGreaterThanOrEqual(0.8)
    expect(s.precision).toBeGreaterThanOrEqual(0.85)
    expect(findCardsDetailed(img).filter((c) => c.kind === 'portrait').length).toBeGreaterThanOrEqual(8)
  })

  it('keeps the enlarged, bordered focus tile and its shifted neighbours', () => {
    const img = blank(640, 360)
    const row = [60, 90, 70, 100, 80, 65]
    const truth: Box[] = []
    const x = [18, 122, 226]
    row.slice(0, 2).forEach((base, i) => {
      const b = { x: x[i], y: 150, w: 96, h: 54 }
      paint(img, b, art(20 + i, base, 22))
      truth.push(b)
    })
    // focus tile: 10% bigger, white border, neighbours pushed aside
    const f = { x: 226, y: 145, w: 106, h: 64 }
    paint(img, { x: f.x - 2, y: f.y - 2, w: f.w + 4, h: f.h + 4 }, () => [235, 235, 235])
    paint(img, f, art(22, 85, 26, { logo: true }))
    truth.push({ x: f.x - 2, y: f.y - 2, w: f.w + 4, h: f.h + 4 })
    ;[100, 80, 65].forEach((base, i) => {
      const b = { x: 342 + i * 104, y: 150, w: 96, h: 54 }
      paint(img, b, art(23 + i, base, 24))
      truth.push(b)
    })
    const found = findCards(img)
    const s = score(found, truth, 0.6)
    expect(s.recall).toBeGreaterThanOrEqual(0.8)
    expect(s.fp).toBeLessThanOrEqual(1)
    // the focus tile sticks out of its row by 7 px at the top and bottom: its box follows it, not the row lines
    const focus = found.find((b) => iou(b, truth[2]) >= 0.6)
    expect(focus).toBeDefined()
    expect(Math.abs(focus!.y - truth[2].y)).toBeLessThanOrEqual(3)
    expect(Math.abs(focus!.y + focus!.h - (truth[2].y + truth[2].h))).toBeLessThanOrEqual(3)
    // ... and the regular tiles keep their own, shorter extent
    for (const i of [0, 1, 3, 4, 5]) {
      const b = found.find((f) => iou(f, truth[i]) >= 0.6)
      expect(b).toBeDefined()
      expect(Math.abs(b!.y - truth[i].y)).toBeLessThanOrEqual(3)
      expect(Math.abs(b!.y + b!.h - (truth[i].y + truth[i].h))).toBeLessThanOrEqual(3)
    }
  })

  it('bridges a tile whose art is the colour of the screen (no side to see) from the neighbouring tiles', () => {
    const img = blank(640, 360)
    const truth = [
      ...rowOfTiles(img, 80, 18, 60, 96, 54, 8, [60, 90, 70, 100, 80, 65]),
      ...rowOfTiles(img, 81, 18, 170, 96, 54, 8, [70, 55, 90, 62, 85, 75]),
      ...rowOfTiles(img, 82, 18, 280, 96, 54, 8, [80, 66, 58, 95, 72, 88]),
    ]
    // the 3rd tile of every row is "invisible": paint it back to the page background
    for (const i of [2, 8, 14]) paint(img, truth[i], () => [BG[0], BG[1], BG[2]])
    const found = findCards(img)
    for (const i of [2, 8, 14]) expect(found.some((f) => iou(f, truth[i]) >= 0.5)).toBe(true)
  })

  it('handles rows that are scrolled to different offsets', () => {
    const img = blank(640, 360)
    const truth = [
      ...rowOfTiles(img, 30, 6, 40, 100, 56, 8, [60, 90, 70, 100, 80, 65]),
      ...rowOfTiles(img, 31, 64, 150, 100, 56, 8, [75, 50, 95, 60, 85]),
      ...rowOfTiles(img, 32, 36, 260, 100, 56, 8, [85, 66, 55, 105, 70, 90]),
    ]
    const found = findCards(img)
    // the partly visible last tile of a row is neither required nor an error
    const s = score(found, truth.filter((t) => t.x + t.w <= 640))
    expect(s.recall).toBeGreaterThanOrEqual(0.9)
    expect(s.precision).toBeGreaterThanOrEqual(0.85)
  })

  it('returns tight boxes that stay inside the frame and a confidence in [0, 1] that findCards leaves out', () => {
    const img = blank(640, 360)
    rowOfTiles(img, 40, 20, 100, 96, 54, 8, [60, 90, 70, 100, 80, 65])
    rowOfTiles(img, 41, 20, 200, 96, 54, 8, [75, 50, 95, 60, 85, 70])
    const detailed = findCardsDetailed(img)
    const plain = findCards(img)
    expect(plain.length).toBe(detailed.length)
    expect(plain.length).toBeGreaterThanOrEqual(10)
    for (const c of detailed) {
      expect(c.confidence).toBeGreaterThanOrEqual(0)
      expect(c.confidence).toBeLessThanOrEqual(1)
      expect(c.box.x).toBeGreaterThanOrEqual(0)
      expect(c.box.y).toBeGreaterThanOrEqual(0)
      expect(c.box.x + c.box.w).toBeLessThanOrEqual(img.width)
      expect(c.box.y + c.box.h).toBeLessThanOrEqual(img.height)
      expect(['landscape', 'portrait']).toContain(c.kind)
    }
    // rows are labelled: boxes of one row share a row index, different rows differ
    const rows = new Set(detailed.map((c) => c.row))
    expect(rows.size).toBe(2)
  })

  it('reports a tile cut off by the frame edge only when most of it is in view', () => {
    const img = blank(640, 360)
    // pitch 100: tiles at x = 16, 116, ..., 616 (24 px of 96 = 25% in view)
    const truth = rowOfTiles(img, 50, 16, 150, 96, 54, 4, [60, 90, 70, 100, 80, 65, 75])
    const inView = (t: Box) => (Math.min(t.x + t.w, 640) - Math.max(t.x, 0)) / t.w
    const required = truth.filter((t) => inView(t) >= 0.7).map((t) => ({ ...t, x: Math.max(0, t.x), w: Math.min(640, t.x + t.w) - Math.max(0, t.x) }))
    const found = findCards(img)
    expect(score(found, required).recall).toBeGreaterThanOrEqual(0.8)
    for (const f of found) expect(f.x >= 0 && f.x + f.w <= 640).toBe(true)
    // the detector itself (before the sliver filter of findCards) already leaves the 25% tile out
    const raw = detectCards(img).map((c) => c.box)
    expect(raw.length).toBeGreaterThanOrEqual(6)
    expect(raw.filter((b) => b.w < 0.55 * 96).length).toBe(0)
  })

  it('returns nothing for a noisy blank screen, a glare-only frame and a text-only frame', () => {
    const noisy = blank(640, 360)
    const rng = mulberry32(5)
    for (let i = 0; i < 640 * 360; i++) {
      const n = (rng() - 0.5) * 14
      noisy.data[i * 4] += n
      noisy.data[i * 4 + 1] += n
      noisy.data[i * 4 + 2] += n
    }
    expect(findCards(noisy)).toEqual([])
    const glare = blank(640, 360)
    paint(glare, { x: 0, y: 0, w: 640, h: 360 }, (u, v) => {
      const d = (u - 0.5) ** 2 + (v - 0.4) ** 2
      const l = 20 + 60 * Math.exp(-d * 14)
      return [l, l, l]
    })
    expect(findCards(glare)).toEqual([])
    const words = blank(640, 360)
    for (let y = 40; y < 320; y += 30) text(words, 30, y, 400)
    expect(findCards(words)).toEqual([])
  })

  it('works at other resolutions (the grid is ~320 px wide whatever the frame is)', () => {
    for (const scale of [0.5, 1, 2]) {
      const img = blank(Math.round(640 * scale), Math.round(360 * scale))
      const truth = rowOfTiles(img, 60, 18 * scale, 100 * scale, 96 * scale, 54 * scale, 8 * scale, [60, 90, 70, 100, 80, 65]).map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) }))
      expect(score(findCards(img), truth).recall).toBeGreaterThanOrEqual(0.8)
    }
  })

  it('stays within ~25 ms on a 640x360 frame', () => {
    const img = blank(640, 360)
    for (let r = 0; r < 3; r++) rowOfTiles(img, 70 + r, 18, 40 + r * 110, 96, 54, 8, [60, 90, 70, 100, 80, 65], { logo: true })
    detectCards(img)
    const times: number[] = []
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now()
      detectCards(img)
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    expect(times[3]).toBeLessThan(25)
  })
})
