import { AutoLabeler, titleSimilarity } from '../../../lib/ar/auto-label'
import type { Box } from '../../../lib/card-tracker'

const box = (x: number, y = 100, w = 100, h = 56): Box => ({ x, y, w, h })
const card = (x: number, y?: number, w?: number, h?: number) => ({ box: box(x, y, w, h) })

function setup(catalogue: Record<string, string>, ocr: Record<number, string[]>) {
  let t = 0
  const reads: number[] = []
  const lookups: string[] = []
  const labeler = new AutoLabeler(
    {
      readTitles: async b => { reads.push(b.x); return ocr[b.x] ?? [] },
      lookup: async title => { lookups.push(title); const hit = catalogue[title.toLowerCase()]; return hit ? { title: hit } : null },
    },
    { now: () => t },
  )
  return { labeler, reads, lookups, advance: (ms: number) => { t += ms } }
}

describe('titleSimilarity', () => {
  it('ignores case, spacing and punctuation', () => {
    expect(titleSimilarity('Stranger Things', 'stranger-things!')).toBe(1)
  })
  it('keeps small OCR slips above the accept bar and different films below it', () => {
    expect(titleSimilarity('Breaking Bsd', 'Breaking Bad')).toBeGreaterThanOrEqual(0.8)
    expect(titleSimilarity('Breaking Bad', 'Breaking Bad: El Camino')).toBeLessThan(0.8)
    expect(titleSimilarity('Dark', 'Narcos')).toBeLessThan(0.5)
  })
  it('is 0 for empty text', () => {
    expect(titleSimilarity('', 'x')).toBe(0)
  })
})

describe('AutoLabeler', () => {
  it('labels a card whose OCR text the catalogue confirms, using the canonical title', async () => {
    const { labeler } = setup({ 'the crown': 'The Crown' }, { 10: ['The Crown'] })
    const c = card(10)
    expect(await labeler.next([c])).toEqual({ item: c, title: 'The Crown' })
  })

  it('rejects a catalogue hit that is a different title than the one read (fuzzy-search guard)', async () => {
    const { labeler } = setup({ 'the end': 'The End of the F***ing World' }, { 10: ['The End'] })
    expect(await labeler.next([card(10)])).toBeNull()
  })

  it('tries the next OCR candidate when the first is not in the catalogue', async () => {
    const { labeler, lookups } = setup({ 'squid game': 'Squid Game' }, { 10: ['NEW', 'Squid Game'] })
    expect((await labeler.next([card(10)]))?.title).toBe('Squid Game')
    expect(lookups).toEqual(['NEW', 'Squid Game'])
  })

  it('does not look up text too short to be a title', async () => {
    const { labeler, lookups } = setup({}, { 10: ['TV', ' '] })
    expect(await labeler.next([card(10)])).toBeNull()
    expect(lookups).toEqual([])
  })

  it('reads the largest card first and rate-limits attempts', async () => {
    const { labeler, reads, advance } = setup({}, {})
    const small = card(10, 100, 60, 34)
    const big = card(300, 100, 120, 68)
    await labeler.next([small, big])
    expect(reads).toEqual([300])
    await labeler.next([small, big]) // inside minGapMs
    expect(reads).toEqual([300])
    advance(1300)
    await labeler.next([small, big]) // big is cooling down, so the small one is next
    expect(reads).toEqual([300, 10])
  })

  it('retries the same position only after the cooldown, even if the box jitters', async () => {
    const { labeler, reads, advance } = setup({}, {})
    await labeler.next([card(10)])
    advance(2000)
    await labeler.next([card(13)]) // same cell
    expect(reads).toEqual([10])
    advance(7000)
    await labeler.next([card(13)])
    expect(reads).toEqual([10, 13])
  })

  it('survives a throwing OCR and does not hammer the same card', async () => {
    let t = 0
    let calls = 0
    const labeler = new AutoLabeler(
      { readTitles: async () => { calls++; throw new Error('worker died') }, lookup: async () => null },
      { now: () => t },
    )
    expect(await labeler.next([card(10)])).toBeNull()
    t += 2000
    expect(await labeler.next([card(10)])).toBeNull()
    expect(calls).toBe(1)
  })

  it('does one attempt at a time', async () => {
    let release!: () => void
    const gate = new Promise<void>(r => (release = r))
    const labeler = new AutoLabeler(
      { readTitles: async () => { await gate; return ['Dark'] }, lookup: async () => ({ title: 'Dark' }) },
      { now: () => 0, minGapMs: 0 },
    )
    const first = labeler.next([card(10)])
    expect(await labeler.next([card(300)])).toBeNull()
    release()
    expect((await first)?.title).toBe('Dark')
  })
})
