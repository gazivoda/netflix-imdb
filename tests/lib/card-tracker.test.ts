import { CardTracker, iou, Box } from '../../lib/card-tracker'

const box = (x: number, y = 0, w = 100, h = 60): Box => ({ x, y, w, h })
const m = (id: string) => ({ id, title: `T-${id}` })

describe('iou', () => {
  it('is 1 for identical boxes, 0 for disjoint, partial otherwise', () => {
    expect(iou(box(0), box(0))).toBe(1)
    expect(iou(box(0), box(500))).toBe(0)
    expect(iou(box(0), box(50))).toBeCloseTo(50 / 150)
  })
})

describe('CardTracker', () => {
  it('keeps the same trackId for a card that moves slightly', () => {
    const t = new CardTracker()
    const first = t.update([{ box: box(100), match: m('a') }])
    const second = t.update([{ box: box(110), match: m('a') }])
    expect(second[0].trackId).toBe(first[0].trackId)
  })

  it('does not flicker: one wrong or missing match is out-voted', () => {
    const t = new CardTracker()
    for (let i = 0; i < 4; i++) t.update([{ box: box(100), match: m('a') }])
    expect(t.update([{ box: box(100), match: m('wrong') }])[0].id).toBe('a')
    expect(t.update([{ box: box(100), match: null }])[0].id).toBe('a')
  })

  it('shows no title until a match has been seen', () => {
    const t = new CardTracker()
    expect(t.update([{ box: box(100), match: null }])[0].title).toBeNull()
  })

  it('tracks several cards independently', () => {
    const t = new CardTracker()
    const out = t.update([{ box: box(0), match: m('a') }, { box: box(300), match: m('b') }])
    expect(out.map(x => x.id).sort()).toEqual(['a', 'b'])
    const next = t.update([{ box: box(302), match: m('b') }, { box: box(3), match: m('a') }])
    expect(next.find(x => x.id === 'a')!.trackId).toBe(out.find(x => x.id === 'a')!.trackId)
  })

  it('drops a track after it is missing for too long, but not before', () => {
    const t = new CardTracker({ minIou: 0.3, voteWindow: 5, maxMissed: 2, smoothing: 1 })
    t.update([{ box: box(0), match: m('a') }])
    expect(t.update([])).toHaveLength(1)
    expect(t.update([])).toHaveLength(1)
    expect(t.update([])).toHaveLength(0)
  })

  it('smooths box movement', () => {
    const t = new CardTracker({ minIou: 0.3, voteWindow: 5, maxMissed: 2, smoothing: 0.5 })
    t.update([{ box: box(100), match: m('a') }])
    expect(t.update([{ box: box(120), match: m('a') }])[0].box.x).toBe(110)
  })
})
