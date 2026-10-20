import { acceptsTitle, AutoLabeler } from '../../../lib/ar/auto-label'

describe('acceptsTitle', () => {
  it('accepts the same title ignoring case, punctuation and a leading article', () => {
    expect(acceptsTitle('GRAY MAN', 'The Gray Man')).toBe(true)
    expect(acceptsTitle('The Last Kingdom', 'Last Kingdom')).toBe(true)
    expect(acceptsTitle("DON'T LOOK UP", 'Dont Look Up')).toBe(true)
  })

  it('accepts a one-slip OCR read of a longer title, rejects a different film', () => {
    expect(acceptsTitle('Breaking Bsd', 'Breaking Bad')).toBe(true)
    expect(acceptsTitle('Breaking Bad', 'Breaking Bad: El Camino')).toBe(false)
    expect(acceptsTitle('Stranger', 'Stranger Things')).toBe(false)
    expect(acceptsTitle('Triple', 'Triple Frontier')).toBe(false)
  })

  it('accepts a caption truncated by the TV, but only for a long exact leading part', () => {
    expect(acceptsTitle('All Quiet on the West', 'All Quiet on the Western Front')).toBe(true)
    expect(acceptsTitle('The Fall of the House', 'The Fall of the House of Usher')).toBe(true)
    expect(acceptsTitle('Better Call', 'Better Call Saul')).toBe(false) // too short a stub
    expect(acceptsTitle('Narcos', 'Narcos: Mexico')).toBe(false)
    expect(acceptsTitle('All Quiet on the Wolf', 'All Quiet on the Western Front')).toBe(false) // not a leading part
  })

  it('never accepts titles whose numbers differ (sequels, years)', () => {
    expect(acceptsTitle('Fear Street: Part One - 1994', 'Fear Street: Part Two - 1978')).toBe(false)
    expect(acceptsTitle('Formula 1: Drive to Survive', 'Formula 2: Drive to Survive')).toBe(false)
  })

  it('still accepts a read that lost its digit entirely (OCR drops them), when the rest is close', () => {
    expect(acceptsTitle('Formula Drive to Survive', 'Formula 1: Drive to Survive')).toBe(true)
  })

  it('rejects empty text', () => {
    expect(acceptsTitle('', 'Dark')).toBe(false)
    expect(acceptsTitle('The', 'The Crown')).toBe(false)
  })
})

describe('AutoLabeler with the stricter acceptance', () => {
  it('labels a card from a truncated caption using the canonical title', async () => {
    const labeler = new AutoLabeler(
      { readTitles: async () => ['All Quiet on the West'], lookup: async () => ({ title: 'All Quiet on the Western Front' }) },
      { minGapMs: 0 },
    )
    const hit = await labeler.next([{ box: { x: 0, y: 0, w: 100, h: 56 } }])
    expect(hit?.title).toBe('All Quiet on the Western Front')
  })

  it('tries up to four candidates by default', async () => {
    const tried: string[] = []
    const labeler = new AutoLabeler(
      { readTitles: async () => ['AAAA', 'BBBB', 'CCCC', 'Dark', 'EEEE'], lookup: async t => { tried.push(t); return t === 'Dark' ? { title: 'Dark' } : null } },
      { minGapMs: 0 },
    )
    expect((await labeler.next([{ box: { x: 0, y: 0, w: 100, h: 56 } }]))?.title).toBe('Dark')
    expect(tried).toEqual(['AAAA', 'BBBB', 'CCCC', 'Dark'])
  })
})

describe('AutoLabeler minVotes guard', () => {
  const run = async (voteCount: number | null | undefined, opts = {}) => {
    const labeler = new AutoLabeler(
      { readTitles: async () => ['DAM'], lookup: async () => ({ title: 'Dam', ...(voteCount === undefined ? {} : { voteCount }) }) },
      { minGapMs: 0, ...opts },
    )
    return (await labeler.next([{ box: { x: 0, y: 0, w: 100, h: 56 } }]))?.title ?? null
  }

  it('rejects an exact-name hit that almost nobody has rated (a fragment "finding" an obscure film)', async () => {
    expect(await run(299)).toBeNull()
    expect(await run(null)).toBeNull()
  })

  it('accepts a popular title and is off when the lookup does not report votes', async () => {
    expect(await run(150000)).toBe('Dam')
    expect(await run(undefined)).toBe('Dam')
  })

  it('has a configurable bar', async () => {
    expect(await run(299, { minVotes: 100 })).toBe('Dam')
  })

  it('moves on to the next candidate when the first hit is obscure', async () => {
    const labeler = new AutoLabeler(
      {
        readTitles: async () => ['Power', 'Project Power'],
        lookup: async t => (t === 'Power' ? { title: 'Power', voteCount: 10 } : { title: 'Project Power', voteCount: 90000 }),
      },
      { minGapMs: 0 },
    )
    expect((await labeler.next([{ box: { x: 0, y: 0, w: 100, h: 56 } }]))?.title).toBe('Project Power')
  })
})
