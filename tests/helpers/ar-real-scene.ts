// Realistic AR benchmark data + scoring. Real Netflix poster art (OMDb) laid out as a TV screen and "photographed" with
// perspective, blur, moire, glare, vignette, exposure shifts, noise and JPEG. Rendered once by scripts/ar-bench (git-ignored
// .cache/), read here as plain PNGs, so jest needs nothing but zlib.
//
//   node scripts/ar-bench/fetch.mjs    # posters   -> .cache/ar-posters
//   node scripts/ar-bench/render.mjs   # scenes    -> .cache/ar-scenes
//
// Typical use from another test:
//   const scenes = loadScenes({ level: 'medium', perCell: 3 })
//   const rows = await runBenchmark(scenes, async scene => /* your pipeline */ [{ box, title }])
//   console.log(formatTable(rows))
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { RgbaImage } from '../../lib/card-hash'
import { Box, iou } from '../../lib/card-tracker'
import { titleSimilarity } from '../../lib/ar/auto-label'

export const DATASET_DIR = path.join(__dirname, '..', '..', '.cache', 'ar-scenes')

export type Layout = 'landscape' | 'caption' | 'top10'
export type BenchLevel = 'clean' | 'mild' | 'medium' | 'severe'
export const LAYOUTS: Layout[] = ['landscape', 'caption', 'top10']
export const LEVELS: BenchLevel[] = ['clean', 'mild', 'medium', 'severe']

export interface RealTile {
  title: string // canonical OMDb title: what a correct overlay must say
  imdbID: string
  year: string
  box: Box // axis-aligned, in the final (photographed) 1280x720 frame, clipped to it
  quad: [number, number][] // the tile's 4 corners after the photo warp (tl, tr, br, bl), unclipped
  visible: number // share of the tile inside the frame
  partial: boolean // too cut off to count (visible < 0.7): neither required nor penalised
  focused: boolean // the enlarged, white-bordered focus tile
  overlay: boolean // extra bold title text drawn on the art (landscape layout)
  /** Whether the title is printed in the tile art or its caption: overlay text, caption under the tile, or the poster's own logo
   *  (hand-labelled position, kept inside the crop). False for tiles whose art simply shows no title (e.g. non-English key art). */
  legible: boolean
  legibleBy: 'overlay' | 'caption' | 'poster' | 'none'
  titleInFrame: boolean // the poster's own printed title is inside this tile's crop
  /** Stricter "easy subset": Tesseract reads the title off the CLEAN tile (3x, plain or inverted). null = not evaluated (cut tile / no title). */
  ocrReadable: boolean | null
  font: string | null
  caption: string | null // caption layout: the text printed under the tile (box does NOT include it)
}

export interface RealScene {
  id: string
  layout: Layout
  level: BenchLevel
  seed: number
  width: number
  height: number
  tiles: RealTile[]
  /** Hero banner etc.: detections inside these are neither right nor wrong. */
  ignore: Box[]
  /** Required tiles (not partial) and the regions where a detection is tolerated (cut tiles + banner). */
  truth: { boxes: Box[]; ignore: Box[] }
  /** Decodes the PNG (RGBA, 1280x720). Not cached beyond a few entries; call once per scene. */
  image(): RgbaImage
}

export interface SceneFilter {
  layout?: Layout | Layout[]
  level?: BenchLevel | BenchLevel[]
  /** At most this many scenes per (layout, level) cell, taking the lowest seeds first. */
  perCell?: number
  ids?: string[]
}

// ---------- PNG decoding (8-bit, non-interlaced RGB/RGBA) ----------
export function decodePng(file: Buffer): RgbaImage {
  let offset = 8
  let width = 0
  let height = 0
  let channels = 0
  const idat: Buffer[] = []
  while (offset < file.length) {
    const length = file.readUInt32BE(offset)
    const type = file.toString('ascii', offset + 4, offset + 8)
    const body = file.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      channels = body[9] === 6 ? 4 : 3
      if (body[8] !== 8 || (body[9] !== 2 && body[9] !== 6) || body[12] !== 0) throw new Error('scene PNG must be 8-bit, non-interlaced RGB/RGBA')
    } else if (type === 'IDAT') idat.push(body)
    offset += 12 + length
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const px = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? px[y * stride + i - channels] : 0
      const b = y > 0 ? px[(y - 1) * stride + i] : 0
      const c = i >= channels && y > 0 ? px[(y - 1) * stride + i - channels] : 0
      let add = 0
      if (filter === 1) add = a
      else if (filter === 2) add = b
      else if (filter === 3) add = (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      px[y * stride + i] = (line[i] + add) & 0xff
    }
  }
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = px[i * channels]
    data[i * 4 + 1] = px[i * channels + 1]
    data[i * 4 + 2] = px[i * channels + 2]
    data[i * 4 + 3] = channels === 4 ? px[i * channels + 3] : 255
  }
  return { data, width, height }
}

// Leptonica reads PNM: P5 (grey, from the red channel, as after binarizeForOcr) or P6 (colour).
export function toPnm(img: RgbaImage, grey: boolean): Buffer {
  const n = img.width * img.height
  const header = Buffer.from(`${grey ? 'P5' : 'P6'}\n${img.width} ${img.height}\n255\n`)
  const body = Buffer.alloc(n * (grey ? 1 : 3))
  for (let i = 0; i < n; i++) {
    if (grey) body[i] = img.data[i * 4]
    else {
      body[i * 3] = img.data[i * 4]
      body[i * 3 + 1] = img.data[i * 4 + 1]
      body[i * 3 + 2] = img.data[i * 4 + 2]
    }
  }
  return Buffer.concat([header, body])
}

// ---------- dataset loading ----------
interface IndexFile {
  knownTitles: string[]
  scenes: (Omit<RealScene, 'truth' | 'image'> & { file: string })[]
}

let cachedIndex: IndexFile | null = null
function readIndex(): IndexFile {
  if (cachedIndex) return cachedIndex
  const file = path.join(DATASET_DIR, 'index.json')
  if (!fs.existsSync(file)) {
    throw new Error(
      `Realistic AR benchmark dataset is missing (${path.relative(process.cwd(), DATASET_DIR)}). Build it once:\n` +
        '  node scripts/ar-bench/fetch.mjs    # needs OMDB_API_KEY in .env.local\n' +
        '  node scripts/ar-bench/render.mjs   # needs sharp, see the header of that script',
    )
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as IndexFile
  if (!parsed.scenes?.length) throw new Error('ar-scenes/index.json holds no scenes; re-run node scripts/ar-bench/render.mjs')
  cachedIndex = parsed
  return parsed
}

/** Every title the catalogue stub knows about (the whole poster set, so wrong guesses can land on a real other title). */
export function knownTitles(): string[] {
  return readIndex().knownTitles
}

const imageCache = new Map<string, RgbaImage>()

export function loadScenes(filter: SceneFilter = {}): RealScene[] {
  const index = readIndex()
  const asList = <T,>(v: T | T[] | undefined): T[] | null => (v === undefined ? null : Array.isArray(v) ? v : [v])
  const layouts = asList(filter.layout)
  const levels = asList(filter.level)
  const perCell = new Map<string, number>()
  const out: RealScene[] = []
  for (const s of index.scenes) {
    if (layouts && !layouts.includes(s.layout)) continue
    if (levels && !levels.includes(s.level)) continue
    if (filter.ids && !filter.ids.includes(s.id)) continue
    const cell = `${s.layout}/${s.level}`
    if (filter.perCell !== undefined && (perCell.get(cell) ?? 0) >= filter.perCell) continue
    perCell.set(cell, (perCell.get(cell) ?? 0) + 1)
    const boxes = s.tiles.filter(t => !t.partial).map(t => t.box)
    const ignore = [...s.tiles.filter(t => t.partial).map(t => t.box), ...s.ignore]
    out.push({
      ...s,
      truth: { boxes, ignore },
      image() {
        const hit = imageCache.get(s.id)
        if (hit) return hit
        const img = decodePng(fs.readFileSync(path.join(DATASET_DIR, s.file)))
        if (imageCache.size >= 4) imageCache.delete(imageCache.keys().next().value as string)
        imageCache.set(s.id, img)
        return img
      },
    })
  }
  if (!out.length) throw new Error(`No scenes match ${JSON.stringify(filter)} (dataset has ${index.scenes.length}).`)
  return out
}

// ---------- catalogue stub ----------
/**
 * Stand-in for /api/ratings: OMDb's fuzzy search resolves a query to the closest known title. Anything at least `floor` similar
 * to some known title "is found"; the AutoLabeler's own similarity rule (0.8) then decides whether to trust it.
 */
export function catalogueLookup(known: string[] = knownTitles(), floor = 0.5): (title: string) => Promise<{ title: string } | null> {
  return async query => {
    let best: { title: string; s: number } | null = null
    for (const t of known) {
      const s = titleSimilarity(query, t)
      if (!best || s > best.s) best = { title: t, s }
    }
    return best && best.s >= floor ? { title: best.title } : null
  }
}

// ---------- scoring ----------
/** What the user would see: a box on the frame, with the rating overlay for `title` (null = dashed unknown square). */
export interface Overlay {
  box: Box
  title: string | null
}

export interface Totals {
  scenes: number
  gt: number // required tiles
  legibleGt: number // required tiles whose title is legible in the clean art
  det: number // boxes reported
  tp: number // boxes matched to a required tile (IoU >= 0.5)
  legibleTp: number // of those, tiles whose title is legible
  fp: number // boxes on nothing (not a tile, not a cut tile, not the banner)
  correct: number // matched tiles carrying the right canonical title
  correctLegible: number
  wrong: number // matched tiles carrying a different title
  unread: number // matched tiles with no title (dashed unknown)
  falseTitled: number // titled boxes on nothing: a rating drawn where there is no tile
}

export const emptyTotals = (): Totals => ({ scenes: 0, gt: 0, legibleGt: 0, det: 0, tp: 0, legibleTp: 0, fp: 0, correct: 0, correctLegible: 0, wrong: 0, unread: 0, falseTitled: 0 })

export function addTotals(a: Totals, b: Totals): Totals {
  for (const k of Object.keys(a) as (keyof Totals)[]) a[k] += b[k]
  return a
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
export const sameTitle = (a: string, b: string): boolean => norm(a) === norm(b)

export function scoreScene(scene: Pick<RealScene, 'tiles' | 'ignore'>, overlays: Overlay[], minIou = 0.5): Totals {
  const req = scene.tiles.filter(t => !t.partial)
  const tolerated = [...scene.tiles.filter(t => t.partial).map(t => t.box), ...scene.ignore]
  const pairs: { d: number; t: number; v: number }[] = []
  overlays.forEach((o, d) => req.forEach((t, ti) => {
    const v = iou(o.box, t.box)
    if (v >= minIou) pairs.push({ d, t: ti, v })
  }))
  pairs.sort((a, b) => b.v - a.v)
  const matched = new Map<number, number>() // overlay index -> tile index
  const usedT = new Set<number>()
  for (const p of pairs) {
    if (matched.has(p.d) || usedT.has(p.t)) continue
    matched.set(p.d, p.t)
    usedT.add(p.t)
  }
  const tot = emptyTotals()
  tot.scenes = 1
  tot.gt = req.length
  tot.legibleGt = req.filter(t => t.legible).length
  tot.det = overlays.length
  overlays.forEach((o, d) => {
    const ti = matched.get(d)
    if (ti === undefined) {
      if (tolerated.some(g => iou(o.box, g) >= 0.3)) { tot.det--; return } // a cut tile or the banner: not counted either way
      tot.fp++
      if (o.title) tot.falseTitled++
      return
    }
    tot.tp++
    const tile = req[ti]
    if (tile.legible) tot.legibleTp++
    if (!o.title) tot.unread++
    else if (sameTitle(o.title, tile.title)) { tot.correct++; if (tile.legible) tot.correctLegible++ }
    else tot.wrong++
  })
  return tot
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-')

export interface BenchRow { label: string; totals: Totals }

/** Rows are (level, layout) cells followed by an "all layouts" row per level. */
export function summarise(per: { scene: RealScene; totals: Totals }[]): BenchRow[] {
  const rows: BenchRow[] = []
  for (const level of LEVELS) {
    const ofLevel = per.filter(p => p.scene.level === level)
    if (!ofLevel.length) continue
    const all = emptyTotals()
    for (const layout of LAYOUTS) {
      const cell = ofLevel.filter(p => p.scene.layout === layout)
      if (!cell.length) continue
      const t = emptyTotals()
      for (const c of cell) addTotals(t, c.totals)
      addTotals(all, t)
      rows.push({ label: `${level.padEnd(6)} ${layout}`, totals: t })
    }
    rows.push({ label: `${level.padEnd(6)} ALL`, totals: all })
  }
  return rows
}

/**
 * recall/prec   tile boxes at IoU >= 0.5 (precision ignores cut tiles and the banner)
 * read          of the tiles found, share carrying the right canonical title;  readLeg: same, only tiles whose title is legible
 * wrong         of the tiles found, share carrying a DIFFERENT title (a wrong rating on screen: worse than none)
 * e2e           correct overlays / all required tiles (found AND right);  e2eLeg: only legible tiles
 * falseOv       titled boxes drawn on nothing
 */
export function formatTable(rows: BenchRow[]): string {
  const head = ['cell', 'scn', 'tiles', 'recall', 'prec', 'read', 'readLeg', 'wrong', 'e2e', 'e2eLeg', 'falseOv']
  const lines = [head]
  for (const { label, totals: t } of rows) {
    lines.push([
      label, String(t.scenes), String(t.gt), pct(t.tp, t.gt), pct(t.tp, t.tp + t.fp), pct(t.correct, t.tp),
      pct(t.correctLegible, t.legibleTp), pct(t.wrong, t.tp), pct(t.correct, t.gt), pct(t.correctLegible, t.legibleGt), String(t.falseTitled),
    ])
  }
  const widths = head.map((_, i) => Math.max(...lines.map(l => l[i].length)))
  return lines.map(l => l.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ')).join('\n')
}

/** Runs `pipeline` on every scene and returns table rows. The pipeline returns the overlays it would draw for that frame. */
export async function runBenchmark(
  scenes: RealScene[],
  pipeline: (scene: RealScene) => Promise<Overlay[]>,
  onScene?: (scene: RealScene, totals: Totals) => void,
): Promise<BenchRow[]> {
  const per: { scene: RealScene; totals: Totals }[] = []
  for (const scene of scenes) {
    const totals = scoreScene(scene, await pipeline(scene))
    onScene?.(scene, totals)
    per.push({ scene, totals })
  }
  return summarise(per)
}
