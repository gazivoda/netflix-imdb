/**
 * Title-reading benchmark: isolates READING from DETECTION by cropping each required tile with its ground-truth box
 * (tests/helpers/ar-real-scene.ts), then comparing the page's old reader with createTileReader, both followed by the
 * real AutoLabeler against the benchmark catalogue stub.
 *
 *   AR_BENCH=1 npx jest tests/lib/ar/tile-reader-bench
 *
 * Env: AR_BENCH_PER_CELL=2 (scenes per layout x level, lowest seeds first; 'all'), AR_BENCH_SEEDS=4,5,6 (pick seeds instead),
 * AR_BENCH_LEVEL, AR_BENCH_LAYOUT, AR_BENCH_WORKERS=6, AR_BENCH_CAPTION=0 (do not extend caption-layout crops to include the
 * caption line under the tile), AR_BENCH_BASELINE=0 (skip the old reader), AR_BENCH_VOCAB=even|odd (give the reader the popular-title
 * vocabulary minus the benchmark titles plus HALF of the benchmark titles, so results are split into titles the vocabulary knows (IN) and
 * does not (OUT): an honest read of what the vocabulary adds and whether it invents wrong titles). The vocabulary is also what the
 * AutoLabeler repairs typos against before it asks the catalogue, exactly as the page does. Without AR_BENCH_VOCAB there is none.
 * The catalogue is the EXACT stub of tests/helpers/ar-real-scene.ts (like OMDb ?t=: no fuzzy repair), and the dataset has a fourth
 * layout, 'plain' (no caption, no overlay text, a share of tiles with no legible title). Rows are "<level> <layout>".
 * Prints numbers and asserts nothing about them (a baseline to beat, not a gate).
 */
import { createWorker, Worker } from 'tesseract.js'
import { RgbaImage } from '../../../lib/card-hash'
import { AutoLabeler } from '../../../lib/ar/auto-label'
import { cropToRgba } from '../../../lib/ar/rectify'
import { createTileReader, tesseractEngine, TileReading } from '../../../lib/ar/tile-reader'
import { createVocabulary } from '../../../lib/ar/title-vocab'
import { POPULAR_TITLES } from '../../../lib/ar/popular-titles'
import { extractMovieTitles, wordsFromBlocks } from '../../../lib/extract-titles'
import { binarizeForOcr } from '../../../lib/ocr-preprocess'
import { BenchLevel, LEVELS, Layout, RealScene, catalogueLookup, knownTitles, loadScenes, sameTitle, toPnm } from '../../helpers/ar-real-scene'

const RUN = process.env.AR_BENCH === '1'
const maybe = RUN ? describe : describe.skip

interface Sample { scene: RealScene; i: number; title: string; legible: boolean; layout: Layout; level: BenchLevel; crop: RgbaImage }

function samples(): Sample[] {
  const perEnv = process.env.AR_BENCH_PER_CELL ?? '2'
  const seeds = process.env.AR_BENCH_SEEDS?.split(',').map(Number)
  const levels = process.env.AR_BENCH_LEVEL?.split(',') as BenchLevel[] | undefined
  const layouts = process.env.AR_BENCH_LAYOUT?.split(',') as Layout[] | undefined
  let scenes = loadScenes({ level: levels, layout: layouts, perCell: seeds || perEnv === 'all' ? undefined : Number(perEnv) })
  if (seeds) scenes = scenes.filter(s => seeds.includes(Number(s.id.split('-')[1])))
  const out: Sample[] = []
  for (const scene of scenes) {
    const frame = scene.image()
    scene.tiles.filter(t => !t.partial).forEach((t, i) => {
      const ext = scene.layout === 'caption' && process.env.AR_BENCH_CAPTION !== '0' ? 0.3 : 0
      const h = Math.min(t.box.h * (1 + ext), frame.height - t.box.y)
      out.push({ scene, i, title: t.title, legible: t.legible, layout: scene.layout, level: scene.level, crop: cropToRgba(frame, { ...t.box, h }, Math.round(t.box.w), Math.round(h)) })
    })
  }
  return out
}

interface Stat { n: number; right: number; wrong: number; legN: number; legRight: number; passes: number; ms: number }
const stat = (): Stat => ({ n: 0, right: 0, wrong: 0, legN: 0, legRight: 0, passes: 0, ms: 0 })
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '-').padStart(6)

function table(title: string, by: Map<string, Stat>): string {
  const lines = [`${title}\n${'cell'.padEnd(18)} tiles   read  readLeg  wrong  passes    ms`]
  for (const [k, s] of by) lines.push(`${k.padEnd(18)} ${String(s.n).padStart(5)} ${pct(s.right, s.n)} ${pct(s.legRight, s.legN)}  ${pct(s.wrong, s.n)} ${(s.passes / s.n).toFixed(1).padStart(6)} ${(s.ms / s.n).toFixed(0).padStart(5)}`)
  return lines.join('\n')
}

const canon = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '')
const vocabMode = process.env.AR_BENCH_VOCAB
// titles the vocabulary is allowed to know: all popular titles that are NOT benchmark titles, plus one half of the benchmark titles
const vocabHalf = RUN && vocabMode ? new Set([...knownTitles()].sort().filter((_, i) => i % 2 === (vocabMode === 'even' ? 0 : 1)).map(canon)) : null
const vocabulary = vocabHalf
  ? createVocabulary([...POPULAR_TITLES.filter(t => !new Set(knownTitles().map(canon)).has(canon(t))), ...knownTitles().filter(t => vocabHalf.has(canon(t)))])
  : undefined

maybe('title reading on ground-truth tile crops', () => {
  jest.setTimeout(3 * 3600_000)
  const workers: Worker[] = []
  beforeAll(async () => {
    for (let i = 0; i < Number(process.env.AR_BENCH_WORKERS ?? 6); i++) workers.push(await createWorker('eng'))
  })
  afterAll(async () => { await Promise.all(workers.map(w => w.terminate())) })

  async function run(name: string, read: (worker: Worker, crop: RgbaImage) => Promise<{ titles: string[]; passes: number }>, all: Sample[]) {
    const lookup = catalogueLookup(knownTitles())
    const cells = new Map<string, Stat>()
    const cell = (k: string) => { if (!cells.has(k)) cells.set(k, stat()); return cells.get(k)! }
    let next = 0
    await Promise.all(workers.map(async worker => {
      for (;;) {
        const s = all[next++]
        if (!s) return
        const t = Date.now()
        let passes = 0
        const labeler = new AutoLabeler({ readTitles: async () => { const r = await read(worker, s.crop); passes = r.passes; return r.titles }, lookup, repair: c => vocabulary?.repair(c) ?? null }, { minGapMs: 0 })
        const hit = await labeler.next([{ box: { x: 0, y: 0, w: s.crop.width, h: s.crop.height } }])
        const ms = Date.now() - t
        const vocabTag = vocabHalf ? [`${s.level} ${vocabHalf.has(canon(s.title)) ? 'IN ' : 'OUT'}`] : []
        for (const k of [`${s.level} ${s.layout}`, `${s.level} ALL`, ...vocabTag]) {
          const c = cell(k)
          c.n++; c.passes += passes; c.ms += ms
          if (s.legible) c.legN++
          if (hit && sameTitle(hit.title, s.title)) { c.right++; if (s.legible) c.legRight++ } else if (hit) c.wrong++
        }
      }
    }))
    const order = [...cells.keys()].sort((a, b) => {
      const [la, ya] = a.split(' '); const [lb, yb] = b.split(' ')
      const rank = (y: string) => (y === 'IN' ? 3 : y === 'OUT' ? 4 : y === 'ALL' ? 2 : 0)
      return LEVELS.indexOf(la as BenchLevel) - LEVELS.indexOf(lb as BenchLevel) || rank(ya) - rank(yb) || ya.localeCompare(yb)
    })
    // eslint-disable-next-line no-console
    console.log('\n' + table(name, new Map(order.map(k => [k, cells.get(k)!]))) + '\n')
    return cells
  }

  it('prints read / wrong rates per level and layout, old reader vs createTileReader', async () => {
    const all = samples()
    // eslint-disable-next-line no-console
    console.log(`${all.length} tile crops from ${new Set(all.map(s => s.scene.id)).size} scenes`)

    if (process.env.AR_BENCH_BASELINE !== '0') {
      await run('OLD reader (3x, Otsu pass then plain, PSM 11, extractMovieTitles)', async (worker, crop) => {
        await worker.setParameters({ tessedit_pageseg_mode: '11' as any })
        for (const binarize of [true, false]) {
          const big = cropToRgba(crop, { x: 0, y: 0, w: crop.width, h: crop.height }, crop.width * 3, crop.height * 3)
          if (binarize && !binarizeForOcr(big.data)) continue
          const { data } = await worker.recognize(toPnm(big, binarize), {}, { blocks: true })
          const found = extractMovieTitles(wordsFromBlocks(data.blocks as any), 3).map(x => x.title)
          if (found.length) return { titles: found, passes: binarize ? 1 : 2 }
        }
        return { titles: [], passes: 2 }
      }, all)
    }

    const readings: TileReading[] = []
    await run('NEW createTileReader (defaults)', async (worker, crop) => {
      const r = await createTileReader(tesseractEngine(worker as any), { vocabulary }).read(crop)
      readings.push(r)
      return { titles: r.candidates, passes: r.passes }
    }, all)
    expect(readings.length).toBe(all.length)
  })
})
