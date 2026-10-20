// End to end on synthetic TV frames: findCards -> ArPipeline (rectify, hash, match) -> tracker, ~15 frames per scene.
// Cards are enrolled from clean renders; evaluation frames are degraded (hand shake, keystone, blur, noise, glare).
// Synthetic art only: these numbers guard against regressions, they do not predict accuracy on a real TV.
import { findCards } from '../../../lib/ar/card-finder'
import { ArPipeline } from '../../../lib/ar/pipeline'
import { DEFAULT_RULE } from '../../../lib/card-index'
import { STRUCTURE_WEIGHT } from '../../../lib/card-hash'
import {
  Level, Outcome, RecordedFrame, addOutcome, buildLibrary, cropHash, emptyOutcome, foreignLayout, frames, prepare, rates, replay, scoreFrame,
} from '../../helpers/ar-e2e'

jest.setTimeout(240_000)

const FRAMES = 15
const WARMUP = 7 // tracker vote window; score only once labels have had time to settle
const PAD = 100 // never-shown index entries, so false matches reflect a realistic index size

interface SetResult { pipeline: Record<Level, Outcome>; replayed: Record<Level, Outcome> }

function runSet(muted: boolean, lib: number[], foreign: number[]): SetResult {
  const { index, layouts } = buildLibrary(lib, PAD, muted)
  const all = [...layouts, ...foreign.map((s) => foreignLayout(s, muted))]
  const res: SetResult = {
    pipeline: { mild: emptyOutcome(), medium: emptyOutcome() },
    replayed: { mild: emptyOutcome(), medium: emptyOutcome() },
  }
  for (const level of ['mild', 'medium'] as Level[]) {
    const recs: RecordedFrame[][] = []
    for (const layout of all) {
      const pipeline = new ArPipeline({ findCards })
      pipeline.setIndex(index)
      const rec: RecordedFrame[] = []
      frames(layout, level, FRAMES).forEach(({ image, truth }, f) => {
        const r = pipeline.processFrame(image)
        if (f >= WARMUP) scoreFrame(truth, r.tracks, res.pipeline[level])
        rec.push({ truth, dets: findCards(image).map((box) => ({ box, hash: cropHash(image, box) })) })
      })
      recs.push(rec)
    }
    prepare(recs, index, STRUCTURE_WEIGHT)
    for (const rec of recs) addOutcome(res.replayed[level], replay(rec, DEFAULT_RULE, WARMUP))
  }
  return res
}

describe('AR end to end (synthetic)', () => {
  const sets: Record<string, SetResult> = {}
  beforeAll(() => {
    sets.vivid = runSet(false, [11, 12], [31, 32])
    sets.muted = runSet(true, [11], [31])
    const lines = ['card-level results (enrolled: correct / no label / wrong title / not detected; unenrolled: false label)']
    for (const [name, s] of Object.entries(sets)) {
      for (const lv of ['mild', 'medium'] as Level[]) {
        const r = rates(s.pipeline[lv])
        const p = (v: number) => (v * 100).toFixed(1).padStart(5)
        lines.push(`  ${name}/${lv}: ${p(r.correct)}% / ${p(r.none)}% / ${p(r.wrong)}% / ${p(r.nodet)}%   false label ${(r.falseLabel * 100).toFixed(2)}% of ${r.nUnenrolled}`)
      }
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'))
  })

  it('never labels a card with the wrong title, and rarely labels an unenrolled one', () => {
    const total = emptyOutcome()
    for (const s of Object.values(sets)) for (const lv of ['mild', 'medium'] as Level[]) addOutcome(total, s.pipeline[lv])
    const r = rates(total)
    expect(total.unenrolled.clean + total.unenrolled.falseLabel).toBeGreaterThan(300)
    expect(r.wrong).toBeLessThanOrEqual(0.01)
    // The 16-layout calibration run measured <= 0.83%. This 6-layout guard has only ~45 distinct unenrolled cards, so a
    // single persistent look-alike card is already ~1%: the bound is 2% here (accept-everything rules score 100%).
    expect(r.falseLabel).toBeLessThanOrEqual(0.02)
  })

  it('finds every visible card (detector recall) even under medium damage', () => {
    for (const s of Object.values(sets)) for (const lv of ['mild', 'medium'] as Level[]) expect(rates(s.pipeline[lv]).nodet).toBeLessThanOrEqual(0.02)
  })

  it('labels most enrolled cards under mild damage on vivid art', () => {
    expect(rates(sets.vivid.pipeline.mild).correct).toBeGreaterThanOrEqual(0.8)
  })

  it('still labels a useful share under medium damage on vivid art', () => {
    expect(rates(sets.vivid.pipeline.medium).correct).toBeGreaterThanOrEqual(0.5)
  })

  it('the calibration sweep helper reproduces the real pipeline exactly', () => {
    for (const s of Object.values(sets)) for (const lv of ['mild', 'medium'] as Level[]) expect(s.replayed[lv]).toEqual(s.pipeline[lv])
  })

  it('a card absent from the index stays unlabelled even next to enrolled ones', () => {
    // same screen: odd cards were never enrolled; they must not inherit a neighbour's title
    const s = sets.vivid.pipeline.mild
    expect(s.unenrolled.falseLabel).toBe(0)
    expect(s.unenrolled.clean).toBeGreaterThan(50)
  })
})
