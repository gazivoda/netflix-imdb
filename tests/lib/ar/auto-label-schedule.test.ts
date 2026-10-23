import { AutoLabeler } from '../../../lib/ar/auto-label'
import type { Box } from '../../../lib/card-tracker'

const card = (i: number, w = 100) => ({ box: { x: 20 + (i % 6) * 100, y: 20 + Math.floor(i / 6) * 70, w, h: Math.round(w * 0.5625) } as Box, id: i })

describe('AutoLabeler scheduling', () => {
  it('attempts every card within a bounded number of ticks even when the largest ones always fail', async () => {
    let t = 0
    const attempted = new Map<number, number>()
    const labeler = new AutoLabeler(
      {
        readTitles: async b => {
          const id = Math.round((b.x - 20) / 100) + 6 * Math.round((b.y - 20) / 70)
          attempted.set(id, (attempted.get(id) ?? 0) + 1)
          return []
        },
        lookup: async () => null,
      },
      { now: () => t },
    )
    // 24 cards; the 8 largest are unreadable and stay unreadable (they are also the ones a largest-first scan visits first)
    const cards = Array.from({ length: 24 }, (_, i) => card(i, i < 8 ? 130 : 100))
    let ticks = 0
    while (attempted.size < 24 && ticks < 80) {
      await labeler.next(cards)
      t += 1300
      ticks++
    }
    expect(attempted.size).toBe(24)
    expect(ticks).toBeLessThanOrEqual(24 + 2) // one pass over the cards, no starvation
  })

  it('backs off a failing card exponentially and never reads a card with more attempts before one with fewer', async () => {
    let t = 0
    const order: number[] = []
    const labeler = new AutoLabeler(
      { readTitles: async b => { order.push(b.x); return [] }, lookup: async () => null },
      { now: () => t, minGapMs: 0, retryMs: 1000 },
    )
    const a = card(0)
    const b = card(1)
    await labeler.next([a, b]) // a (equal attempts, first)
    await labeler.next([a, b]) // b: fewest attempts first
    expect(order).toEqual([a.box.x, b.box.x])
    // a's next try is due after retryMs (1 s), then 2 s, then 4 s
    t = 999
    await labeler.next([a, b])
    expect(order.length).toBe(2)
    t = 1000
    await labeler.next([a, b])
    expect(order.length).toBe(3)
    t = 2999 // second wait is 2 s from t = 1000
    await labeler.next([a])
    expect(order.length).toBe(3)
    t = 3000
    await labeler.next([a])
    expect(order.length).toBe(4)
    t = 6999 // third wait is 4 s
    await labeler.next([a])
    expect(order.length).toBe(4)
    t = 7000
    await labeler.next([a])
    expect(order.length).toBe(5)
  })

  it('caps the backoff so a card is still retried now and then', async () => {
    let t = 0
    let reads = 0
    const labeler = new AutoLabeler({ readTitles: async () => { reads++; return [] }, lookup: async () => null }, { now: () => t, minGapMs: 0, retryMs: 1000, maxBackoffMs: 5000 })
    const c = card(0)
    for (let i = 0; i < 12; i++) {
      await labeler.next([c])
      t += 5000
    }
    expect(reads).toBe(12)
  })
})

describe('AutoLabeler stuck reads', () => {
  it('gives up on a read that never settles and goes on with the next card', async () => {
    let t = 0
    const seen: number[] = []
    const labeler = new AutoLabeler(
      {
        readTitles: b => {
          seen.push(b.x)
          return b.x === 20 ? new Promise<string[]>(() => {}) : Promise.resolve([])
        },
        lookup: async () => null,
      },
      { now: () => t, minGapMs: 0, readTimeoutMs: 50 },
    )
    const stuck = labeler.next([card(0), card(1)])
    // the dead read blocks the labeler only until its timeout fires
    expect(await labeler.next([card(0), card(1)])).toBeNull()
    expect(seen).toEqual([20])
    await stuck
    t += 10
    await labeler.next([card(0), card(1)])
    expect(seen).toEqual([20, 120])
  })

  it('reset() frees a labeler whose worker was terminated mid-read and ignores the late answer', async () => {
    let t = 0
    let release: (v: string[]) => void = () => {}
    let reads = 0
    const labeler = new AutoLabeler(
      {
        readTitles: () => {
          reads++
          return reads === 1 ? new Promise<string[]>(r => { release = r }) : Promise.resolve([])
        },
        lookup: async title => ({ title }),
      },
      { now: () => t, minGapMs: 0, readTimeoutMs: 60_000 },
    )
    const c = card(0)
    const first = labeler.next([c])
    labeler.reset() // the worker is replaced: the read in flight will never be heard from again
    await labeler.next([c]) // not busy any more
    expect(reads).toBe(2)
    release(['Dark']) // a late answer from the dead read is dropped
    expect(await first).toBeNull()
  })
})
