import { AutoLabeler } from '../../../lib/ar/auto-label'
import { createVocabulary } from '../../../lib/ar/title-vocab'

const box = { x: 0, y: 0, w: 100, h: 56 }

function run(vocabTitles: string[], catalogue: string[], raws: string[]) {
  const vocab = createVocabulary(vocabTitles)
  const asked: string[] = []
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const labeler = new AutoLabeler(
    {
      readTitles: async () => raws,
      lookup: async t => { asked.push(t); const hit = catalogue.find(c => key(c) === key(t) || key(c) === key(t.replace(/^the /i, ''))); return hit ? { title: hit, voteCount: 1_000_000 } : null },
      repair: c => vocab.repair(c),
    },
    { now: () => 0, minGapMs: 0 },
  )
  return { labeler, asked }
}

describe('fragment snapping in AutoLabeler.prepare', () => {
  it('"Stranger" is not snapped onto "The Stranger" when "Stranger Things" was read beside it', async () => {
    const { labeler, asked } = run(['The Stranger'], ['The Stranger', 'Stranger Things'], ['Stranger', 'Stranger Things'])
    expect((await labeler.next([{ box }]))?.title).toBe('Stranger Things')
    expect(asked[0]).toBe('Stranger Things')
    expect(asked).not.toContain('The Stranger')
  })

  it('"Heist" (the end of the logo) does not outrank "Money Heist"', async () => {
    const { labeler, asked } = run(['Heist'], ['Heist', 'Money Heist'], ['Heist', 'Money Heist'])
    expect((await labeler.next([{ box }]))?.title).toBe('Money Heist')
    expect(asked[0]).toBe('Money Heist')
  })

  it('a vocabulary word is still kept against junk beside it ("OZARK FLL")', async () => {
    const { labeler, asked } = run(['Ozark'], ['Ozark'], ['Ozark', 'OZARK FLL'])
    expect((await labeler.next([{ box }]))?.title).toBe('Ozark')
    expect(asked).toContain('Ozark') // not dropped as a fragment of the junk reading
  })

  it('a lone word on its own is still looked up (nothing longer to prefer)', async () => {
    const { labeler } = run(['The Stranger'], ['The Stranger'], ['Stranger'])
    expect((await labeler.next([{ box }]))?.title).toBe('The Stranger')
  })
})
