// Threshold sweep, not a regression test: `CALIBRATE=1 npx jest tests/lib/ar/calibrate` prints card-level
// accuracy for STRUCTURE_WEIGHT x MatchRule on the synthetic scenes. Skipped in normal runs (slow, prints a lot).
// CAL_CACHE=/some/dir keeps the rendered+hashed frames between runs (rendering is ~95% of the time).
import fs from 'fs'
import path from 'path'
import { DEFAULT_RULE, IndexEntry, deserializeIndex, serializeIndex } from '../../../lib/card-index'
import { STRUCTURE_WEIGHT, hashFromHex, hashToHex } from '../../../lib/card-hash'
import { Level, Outcome, RecordedFrame, addOutcome, buildLibrary, emptyOutcome, foreignLayout, prepare, rates, record, replay } from '../../helpers/ar-e2e'

const d = process.env.CALIBRATE ? describe : describe.skip

interface SetData { index: IndexEntry[]; recs: Record<Level, RecordedFrame[][]> }

const LIB = [11, 12, 13, 14, 15, 16, 17, 18]
const FOREIGN = [31, 32, 33, 34, 35, 36, 37, 38]
const PAD = 100
const FRAMES = 15

function build(muted: boolean): SetData {
  const { index, layouts } = buildLibrary(LIB, PAD, muted)
  const all = [...layouts, ...FOREIGN.map((s) => foreignLayout(s, muted))]
  return { index, recs: { mild: all.map((l) => record(l, 'mild', FRAMES)), medium: all.map((l) => record(l, 'medium', FRAMES)) } }
}

function cached(name: string, muted: boolean): SetData {
  const dir = process.env.CAL_CACHE
  const file = dir ? path.join(dir, `cal-${name}.json`) : ''
  if (file && fs.existsSync(file)) {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'))
    const revive = (seqs: any[][]): RecordedFrame[][] =>
      seqs.map((s) => s.map((f) => ({ truth: f.truth, dets: f.dets.map((x: any) => ({ box: x.box, hash: hashFromHex(x.bits, x.color) })) })))
    return { index: deserializeIndex(j.index), recs: { mild: revive(j.mild), medium: revive(j.medium) } }
  }
  const data = build(muted)
  if (file) {
    const strip = (seqs: RecordedFrame[][]) =>
      seqs.map((s) => s.map((f) => ({ truth: f.truth, dets: f.dets.map((x) => ({ box: x.box, ...hashToHex(x.hash) })) })))
    fs.writeFileSync(file, JSON.stringify({ index: serializeIndex(data.index), mild: strip(data.recs.mild), medium: strip(data.recs.medium) }))
  }
  return data
}

const pct = (v: number, n = 1) => (v * 100).toFixed(n)
const fmt = (o: Outcome) => {
  const r = rates(o)
  return `corr ${pct(r.correct)} none ${pct(r.none)} wrong ${pct(r.wrong)} nodet ${pct(r.nodet)} | FALSE ${pct(r.falseLabel, 2)}%`
}

d('calibration sweep', () => {
  jest.setTimeout(1_800_000)

  it('sweeps', () => {
    const sets: Record<string, SetData> = { vivid: cached('vivid', false), muted: cached('muted', true) }
    const lines: string[] = []
    const run = (s: SetData, levels: Level[], rule: { maxDistance: number; minMargin: number }) => {
      const o = emptyOutcome()
      for (const lv of levels) for (const rec of s.recs[lv]) addOutcome(o, replay(rec, rule))
      return o
    }
    const prep = (w: number) => { for (const s of Object.values(sets)) prepare([...s.recs.mild, ...s.recs.medium], s.index, w) }

    lines.push(`current: w=${STRUCTURE_WEIGHT} rule=${JSON.stringify(DEFAULT_RULE)}`)
    prep(STRUCTURE_WEIGHT)
    for (const [name, s] of Object.entries(sets)) for (const lv of ['mild', 'medium'] as Level[]) lines.push(`  ${name}/${lv}: ${fmt(run(s, [lv], DEFAULT_RULE))}`)

    // Separation diagnostics: best-match distance of enrolled (correctly matched) vs unenrolled detections.
    for (const w of [0.3, 0.5, 0.7]) {
      prep(w)
      for (const [name, s] of Object.entries(sets)) {
        const pos: number[] = []
        const neg: number[] = []
        const negMargin: number[] = []
        for (const lv of ['mild', 'medium'] as Level[]) for (const seq of s.recs[lv]) for (const fr of seq) for (const det of fr.dets) {
          if (!det.cand) continue
          const t = fr.truth.reduce<{ id: string | null; v: number }>((b, c) => {
            const x0 = Math.max(c.box.x, det.box.x), y0 = Math.max(c.box.y, det.box.y)
            const x1 = Math.min(c.box.x + c.box.w, det.box.x + det.box.w), y1 = Math.min(c.box.y + c.box.h, det.box.y + det.box.h)
            const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0)
            const v = inter / (c.box.w * c.box.h + det.box.w * det.box.h - inter)
            return v > b.v ? { id: c.id, v } : b
          }, { id: null, v: 0.5 })
          if (t.v <= 0.5) continue
          if (t.id !== null) { if (det.cand.id === t.id) pos.push(det.cand.bestD) } else { neg.push(det.cand.bestD); negMargin.push(det.cand.secondD - det.cand.bestD) }
        }
        const q = (a: number[], p: number) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))] }
        lines.push(`w=${w} ${name}: enrolled-correct bestD p50=${q(pos, .5).toFixed(3)} p90=${q(pos, .9).toFixed(3)} p99=${q(pos, .99).toFixed(3)} max=${q(pos, 1).toFixed(3)} | unenrolled bestD min=${q(neg, 0).toFixed(3)} p1=${q(neg, .01).toFixed(3)} p5=${q(neg, .05).toFixed(3)} p50=${q(neg, .5).toFixed(3)}; margin p50=${q(negMargin, .5).toFixed(3)} p95=${q(negMargin, .95).toFixed(3)}`)
      }
    }

    const weights = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
    const maxDs = [0.06, 0.08, 0.1, 0.12, 0.14, 0.16, 0.2, 0.3]
    const margins = [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1]
    const grid: { w: number; md: number; mm: number; per: Record<string, Outcome>; pooled: Outcome }[] = []
    for (const w of weights) {
      prep(w)
      for (const md of maxDs) for (const mm of margins) {
        const per: Record<string, Outcome> = {}
        const pooled = emptyOutcome()
        for (const [name, s] of Object.entries(sets)) { per[name] = run(s, ['mild', 'medium'], { maxDistance: md, minMargin: mm }); addOutcome(pooled, per[name]) }
        grid.push({ w, md, mm, per, pooled })
      }
    }
    grid.sort((a, b) => rates(b.pooled).correct - rates(a.pooled).correct)
    const worstFalse = (g: (typeof grid)[number]) => Math.max(...Object.values(g.per).map((o) => rates(o).falseLabel))
    const show = (g: (typeof grid)[number]) =>
      `  w=${g.w} maxD=${g.md} margin=${g.mm}: pooled ${fmt(g.pooled)} || ` + Object.entries(g.per).map(([n, o]) => `${n}: corr ${pct(rates(o).correct)} FALSE ${pct(rates(o).falseLabel, 2)}%`).join(' | ')
    lines.push('best pooled correct with false-label <= 1% in EVERY set:')
    grid.filter((g) => worstFalse(g) <= 0.01).slice(0, 12).forEach((g) => lines.push(show(g)))
    lines.push('best with false-label == 0 in every set:')
    grid.filter((g) => worstFalse(g) === 0).slice(0, 8).forEach((g) => lines.push(show(g)))
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'))
  })
})
