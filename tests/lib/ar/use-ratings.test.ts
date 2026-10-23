import { RatingsCache, RatingItem, RatingsServiceError, ratingKey, guideRect, stageToVideoRect, sampleToGuide, serviceKindForStatus, serviceMessage, classifyServiceError } from '@/lib/ar/use-ratings'

function setup(respond?: (titles: string[]) => RatingItem[] | Promise<RatingItem[]>) {
  const calls: string[][] = []
  const clock = { t: 1000 }
  const jobs: (() => void)[] = []
  const fetchBatch = jest.fn(async (titles: string[]) => {
    calls.push(titles)
    return respond ? respond(titles) : titles.map(q => ({ query: q, found: true, rating: 7.5, voteCount: 100, rtRating: 80, imdbId: 'tt1' }))
  })
  const cache = new RatingsCache({ fetchBatch, now: () => clock.t, schedule: fn => void jobs.push(fn) })
  const run = async () => { jobs.splice(0).forEach(j => j()); await Promise.resolve(); await new Promise(r => setImmediate(r)) }
  return { cache, calls, clock, jobs, run, fetchBatch }
}

describe('RatingsCache', () => {
  it('reports idle for titles never requested', () => {
    expect(setup().cache.get('Dune').status).toBe('idle')
  })

  it('marks requested titles loading, then ready with mapped fields', async () => {
    const { cache, run } = setup()
    cache.request(['Dune'])
    expect(cache.get('Dune').status).toBe('loading')
    await run()
    expect(cache.get('Dune')).toEqual({ status: 'ready', imdb: 7.5, votes: 100, rt: 80, imdbId: 'tt1', title: undefined })
  })

  it('de-duplicates case/whitespace variants and batches calls made in one window', async () => {
    const { cache, calls, run, jobs } = setup()
    cache.request(['Dune', ' dune ', 'DUNE'])
    cache.request(['Dune', 'Arrival'])
    expect(jobs).toHaveLength(1) // one scheduled flush for both calls
    await run()
    expect(calls).toEqual([['Dune', 'Arrival']])
    expect(cache.get('  dUNE').status).toBe('ready')
  })

  it('does not refetch ready or in-flight titles', async () => {
    const { cache, calls, run } = setup()
    cache.request(['Dune'])
    const flushing = cache.flush()
    cache.request(['Dune']) // in flight
    await flushing
    cache.request(['Dune']) // ready
    await run()
    expect(calls).toHaveLength(1)
  })

  it('splits more than 20 titles into API-sized chunks', async () => {
    const { cache, calls, run } = setup()
    cache.request(Array.from({ length: 45 }, (_, i) => `Title ${i}`))
    await run()
    expect(calls.map(c => c.length).sort((a, b) => b - a)).toEqual([20, 20, 5])
  })

  it('maps found:false to missing and keeps it cached until its long retry window', async () => {
    const { cache, calls, run, clock } = setup(ts => ts.map(q => ({ query: q, found: false })))
    cache.request(['Nope'])
    await run()
    expect(cache.get('Nope').status).toBe('missing')
    cache.request(['Nope'])
    await run()
    expect(calls).toHaveLength(1)
    clock.t += 61_000
    cache.request(['Nope'])
    expect(cache.get('Nope').status).toBe('missing') // old state shown while retrying
    await run()
    expect(calls).toHaveLength(2)
  })

  it('turns a failed request into error and retries only after the cooldown', async () => {
    let fail = true
    const { cache, calls, run, clock } = setup(ts => {
      if (fail) throw new Error('boom')
      return ts.map(q => ({ query: q, found: true, rating: 8 }))
    })
    cache.request(['Dune'])
    await run()
    expect(cache.get('Dune').status).toBe('error')
    cache.request(['Dune'])
    await run()
    expect(calls).toHaveLength(1) // still cooling down
    fail = false
    clock.t += 16_000
    cache.request(['Dune'])
    await run()
    expect(cache.get('Dune').status).toBe('ready')
    expect(calls).toHaveLength(2)
  })

  it('treats titles missing from the response as errors, not as ready', async () => {
    const { cache, run } = setup(() => [])
    cache.request(['Dune'])
    await run()
    expect(cache.get('Dune').status).toBe('error')
  })

  it('notifies subscribers and bumps the version on every change', async () => {
    const { cache, run } = setup()
    const seen: number[] = []
    const off = cache.subscribe(() => seen.push(cache.getVersion()))
    cache.request(['Dune'])
    await run()
    off()
    expect(seen.length).toBeGreaterThanOrEqual(2) // loading + ready
    cache.request(['Arrival'])
    expect(seen.length).toBeGreaterThanOrEqual(2)
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('ignores blank titles', () => {
    const { cache, jobs } = setup()
    cache.request(['', '   '])
    expect(jobs).toHaveLength(0)
    expect(ratingKey('  A   b ')).toBe('a b')
  })
})

describe('guide geometry', () => {
  it('guideRect is centred, 16:9 and fits the limiting dimension', () => {
    const wide = guideRect({ w: 1000, h: 400 }, 1)
    expect(wide.h).toBeCloseTo(400)
    expect(wide.w).toBeCloseTo(400 * (16 / 9))
    expect(wide.x).toBeCloseTo((1000 - wide.w) / 2)
    const tall = guideRect({ w: 300, h: 800 }, 0.9)
    expect(tall.w).toBeCloseTo(270)
    expect(tall.w / tall.h).toBeCloseTo(16 / 9)
    expect(tall.y).toBeCloseTo((800 - tall.h) / 2)
  })

  it('stageToVideoRect is the identity scale when stage and video share an aspect ratio', () => {
    const r = stageToVideoRect({ x: 100, y: 50, w: 400, h: 225 }, { w: 800, h: 450 }, { w: 1600, h: 900 })
    expect(r).toEqual({ x: 200, y: 100, w: 800, h: 450 })
  })

  it('accounts for horizontal cropping when a 16:9 video fills a taller stage (cover)', () => {
    // stage 400x400, video 1280x720 -> scale 400/720, displayed width 711, 155.5px cropped each side
    const scale = 400 / 720
    const offX = (400 - 1280 * scale) / 2
    const r = stageToVideoRect({ x: 0, y: 100, w: 400, h: 225 }, { w: 400, h: 400 }, { w: 1280, h: 720 })
    expect(r.x).toBeCloseTo(-offX / scale)
    expect(r.w).toBeCloseTo(400 / scale)
    expect(r.y).toBeCloseTo(100 / scale)
    expect(r.h).toBeCloseTo(225 / scale)
  })

  it('accounts for vertical cropping when the stage is wider than the video (cover)', () => {
    // stage 800x200, video 400x400 -> scale 2, displayed height 800, 300px cropped top and bottom
    const r = stageToVideoRect({ x: 0, y: 0, w: 800, h: 200 }, { w: 800, h: 200 }, { w: 400, h: 400 })
    expect(r).toEqual({ x: 0, y: 150, w: 400, h: 100 })
  })

  it('clamps to the video bounds', () => {
    const r = stageToVideoRect({ x: -50, y: -50, w: 900, h: 900 }, { w: 800, h: 450 }, { w: 800, h: 450 })
    expect(r).toEqual({ x: 0, y: 0, w: 800, h: 450 })
  })

  it('sampleToGuide scales analysis pixels to guide CSS pixels', () => {
    expect(sampleToGuide({ x: 64, y: 36, w: 128, h: 72 }, { w: 640, h: 360 }, { w: 320, h: 180 })).toEqual({ x: 32, y: 18, w: 64, h: 36 })
  })
})


describe('service limit and trouble', () => {
  it('treats unavailable:true as its own "limit" state, retried after a short wait and never taken for "not found"', async () => {
    const { cache, calls, run, clock } = setup(ts => ts.map(q => ({ query: q, found: false, unavailable: true })))
    cache.request(['Dune'])
    await run()
    expect(cache.get('Dune').status).toBe('limit')
    expect(cache.service()?.kind).toBe('limit')
    cache.request(['Dune'])
    await run()
    expect(calls).toHaveLength(1) // still cooling down
    clock.t += 31_000 // far shorter than the 60 s a real "not found" waits
    cache.request(['Dune'])
    await run()
    expect(calls).toHaveLength(2)
  })

  it('records the kind of failure for one page-level message, and clears it after a good answer', async () => {
    let fail: RatingsServiceError | null = new RatingsServiceError('busy', 429)
    const { cache, run, clock } = setup()
    const failing = new RatingsCache({
      fetchBatch: async titles => { if (fail) throw fail; return titles.map(q => ({ query: q, found: true, rating: 7 })) },
      now: () => clock.t,
      schedule: () => undefined,
    })
    failing.request(['Dune'])
    await failing.flush()
    expect(failing.get('Dune').status).toBe('error')
    expect(failing.service()?.kind).toBe('busy')
    fail = null
    clock.t += 16_000
    failing.request(['Dune'])
    await failing.flush()
    expect(failing.get('Dune').status).toBe('ready')
    expect(failing.service()).toBeNull()
    void cache
    void run
  })

  it('a whole-batch 503 (daily limit) marks the titles as limited', async () => {
    const clock = { t: 0 }
    const c = new RatingsCache({ fetchBatch: async () => { throw new RatingsServiceError('limit', 503) }, now: () => clock.t, schedule: () => undefined })
    c.request(['A'])
    await c.flush()
    expect(c.get('A').status).toBe('limit')
  })

  it('maps HTTP statuses and offline to distinct messages', () => {
    expect(serviceKindForStatus(503)).toBe('limit')
    expect(serviceKindForStatus(429)).toBe('busy')
    expect(serviceKindForStatus(500)).toBe('error')
    expect(classifyServiceError(new TypeError('x'), false)).toBe('offline')
    expect(classifyServiceError(new TypeError('x'), true)).toBe('error')
    const texts = (['limit', 'busy', 'offline', 'error'] as const).map(serviceMessage)
    expect(new Set(texts).size).toBe(4)
    expect(texts.join(' ')).not.toMatch(/—|–/)
  })
})
