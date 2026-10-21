import {
  buildDebugReport,
  debugFileStem,
  emptyTileInfo,
  ratingBadge,
  tileKey,
  tileLabel,
  DebugReportInput,
  TileStatus,
} from '../../../lib/ar/debug-capture'

const ctx = { auto: true, ocrReady: true }

describe('tileKey', () => {
  it('is stable under sub-cell jitter and differs between neighbouring cards', () => {
    const a = { x: 100, y: 100, w: 96, h: 54 }
    expect(tileKey({ ...a, x: 103, y: 98 })).toBe(tileKey(a))
    expect(tileKey({ ...a, x: 100 + 110 })).not.toBe(tileKey(a))
  })
})

describe('tileLabel', () => {
  it('names every status distinctly, with a short form for narrow tiles', () => {
    const statuses: TileStatus[] = ['waiting', 'reading', 'no-text', 'not-in-catalogue', 'lookup-failed', 'learned']
    const full = statuses.map(s => tileLabel(s, ctx).full)
    expect(new Set(full).size).toBe(statuses.length)
    for (const s of statuses) expect(tileLabel(s, ctx).short.length).toBeLessThanOrEqual(8)
    expect(tileLabel('no-text', ctx).full).toBe('no readable title')
    expect(tileLabel('not-in-catalogue', ctx).full).toBe('not in catalogue')
  })

  it('explains why a waiting tile is not being read', () => {
    expect(tileLabel('waiting', { auto: false, ocrReady: true }).full).toBe('auto-read off')
    expect(tileLabel('waiting', { auto: true, ocrReady: false }).full).toBe('loading reader…')
    expect(tileLabel('waiting', ctx).full).toBe('waiting')
    // a finished verdict is never overridden by reader state
    expect(tileLabel('no-text', { auto: false, ocrReady: false }).full).toBe('no readable title')
  })
})

describe('ratingBadge', () => {
  it('shows chips when scores exist, and no pill', () => {
    expect(ratingBadge({ status: 'ready', imdb: 8.76, rt: 91 })).toEqual({ imdb: '8.8', rt: '91%', pill: null })
    expect(ratingBadge({ status: 'ready', imdb: 7, rt: null })).toEqual({ imdb: '7.0', rt: null, pill: null })
  })

  it('keeps a 0% Rotten Tomatoes score (0 is a score, not "missing")', () => {
    expect(ratingBadge({ status: 'ready', imdb: undefined, rt: 0 }).rt).toBe('0%')
  })

  it('gives loading, offline, not-found and no-score four different pills', () => {
    const pills = [
      ratingBadge({ status: 'loading' }).pill,
      ratingBadge({ status: 'idle' }).pill,
      ratingBadge({ status: 'error' }).pill,
      ratingBadge({ status: 'missing' }).pill,
      ratingBadge({ status: 'ready', imdb: undefined, rt: null }).pill,
    ]
    expect(pills.every(p => p && p.text && p.title)).toBe(true)
    expect(pills.map(p => p!.text)).toEqual(['…', '…', 'offline', 'n/a', 'no score'])
    expect(pills[2]!.tone).toBe('error')
    expect(pills[0]!.tone).toBe('loading')
  })
})

describe('buildDebugReport', () => {
  const base = (): DebugReportInput => ({
    now: new Date('2026-03-04T05:06:07.000Z'),
    video: { width: 1920, height: 1080 },
    stage: { w: 390, h: 540 },
    guideStage: { x: 15, y: 175, w: 360, h: 202.5 },
    guideSrc: { x: 300, y: 0, w: 1280, h: 720 },
    sample: { w: 640, h: 360 },
    image: { file: 'ar-debug-x.png', width: 1280, height: 720 },
    tiles: [
      {
        box: { x: 10, y: 20, w: 100, h: 56 },
        info: { ...emptyTileInfo(), status: 'not-in-catalogue', candidates: ['STRANGER THNGS'], raw: 'STRANGER THNGS | N', tried: 'STRANGER THNGS', matchedTitle: 'Stranger Things', distance: 0.07, ms: 412.3456 },
        ratingStatus: null,
      },
      {
        box: { x: 200, y: 20, w: 100, h: 56 },
        info: { ...emptyTileInfo(), status: 'learned', matchedTitle: 'Dark' },
        track: { trackId: 4, title: 'Dark', missed: 0 },
        ratingStatus: 'missing',
      },
    ],
    timings: { fps: 8.7, findMs: 11.2, hashMs: 3.1 },
    reader: { auto: true, ready: true },
    learnedCards: 5,
    userAgent: 'UA/1.0',
  })

  it('carries every field a tuning session needs', () => {
    const r = buildDebugReport(base())
    expect(r.version).toBe(1)
    expect(r.timestamp).toBe('2026-03-04T05:06:07.000Z')
    expect(r.video).toEqual({ width: 1920, height: 1080 })
    expect(r.guide.stage).toEqual({ x: 15, y: 175, w: 360, h: 202.5 })
    expect(r.guide.source).toEqual({ x: 300, y: 0, w: 1280, h: 720 })
    expect(r.timings).toEqual({ fps: 8.7, findMs: 11.2, hashMs: 3.1 })
    expect(r.userAgent).toBe('UA/1.0')
    expect(r.tiles).toHaveLength(2)
    expect(r.tiles[0]).toMatchObject({
      status: 'not-in-catalogue',
      candidates: ['STRANGER THNGS'],
      raw: 'STRANGER THNGS | N',
      matchedTitle: 'Stranger Things',
      distance: 0.07,
      tried: 'STRANGER THNGS',
      readMs: 412.346,
      trackId: null,
    })
    expect(r.tiles[1]).toMatchObject({ status: 'learned', matchedTitle: 'Dark', trackId: 4, trackTitle: 'Dark', ratingStatus: 'missing' })
  })

  it('maps tile boxes from sample pixels into the saved PNG', () => {
    // PNG is 2x the 640x360 sample, so every box doubles
    const r = buildDebugReport(base())
    expect(r.tiles[0].box).toEqual({ x: 10, y: 20, w: 100, h: 56 })
    expect(r.tiles[0].boxImage).toEqual({ x: 20, y: 40, w: 200, h: 112 })
  })

  it('records the native camera pixels of every tile and whether they are enough to read', () => {
    // the saved PNG is the video region itself, so boxImage is in native camera pixels
    const r = buildDebugReport(base())
    expect(r.tiles[0]).toMatchObject({ nativeWidth: 200, nativeHeight: 112 })
    expect(r.tiles.every(t => t.raw !== undefined && t.candidates !== undefined)).toBe(true)
    expect(r.pixels.minReadable).toBe(220)
    expect(r.pixels.medianTileWidth).toBe(r.tiles.map(t => t.nativeWidth).sort((a, b) => a - b)[1])
    expect(r.pixels.tooSmall).toBe(r.pixels.medianTileWidth < 220)
    expect(buildDebugReport({ ...base(), tiles: [] }).pixels).toEqual({ medianTileWidth: 0, minReadable: 220, tooSmall: false })
  })

  it('always serialises: non-finite numbers become null/0 and long text is clipped', () => {
    const input = base()
    input.tiles[0].info.distance = NaN
    input.tiles[0].info.ms = Infinity
    input.tiles[0].info.raw = 'x'.repeat(5000)
    input.tiles[0].info.candidates = Array.from({ length: 30 }, (_, i) => `c${i}`)
    input.timings.fps = NaN
    const r = buildDebugReport(input)
    const round = JSON.parse(JSON.stringify(r))
    expect(round).toEqual(r)
    expect(r.tiles[0].distance).toBeNull()
    expect(r.tiles[0].readMs).toBeNull()
    expect(r.timings.fps).toBe(0)
    expect(r.tiles[0].raw.length).toBeLessThanOrEqual(2001)
    expect(r.tiles[0].candidates).toHaveLength(10)
  })

  it('does not alias the caller\'s tile data', () => {
    const input = base()
    const r = buildDebugReport(input)
    input.tiles[0].info.candidates.push('late')
    expect(r.tiles[0].candidates).not.toContain('late')
  })
})

describe('debugFileStem', () => {
  it('is sortable and filesystem-safe', () => {
    expect(debugFileStem(new Date('2026-03-04T05:06:07.000Z'))).toBe('ar-debug-20260304-050607')
    expect(debugFileStem(new Date('2026-12-31T23:59:59.000Z'))).toMatch(/^ar-debug-\d{8}-\d{6}$/)
  })
})
