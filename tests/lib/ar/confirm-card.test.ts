import { ProvisionalTitles, confirmCard } from '../../../lib/ar/confirm-card'
import { TileNotes } from '../../../lib/ar/tile-notes'
import { loadConfirmed } from '../../../lib/ar/confirmed-titles'
import { loadIndex, type KeyValueStore } from '../../../lib/ar/enrol-store'
import { createVocabulary } from '../../../lib/ar/title-vocab'
import type { Box } from '../../../lib/card-tracker'

function memoryStore(): KeyValueStore {
  const m = new Map<string, string>()
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k) }
}
const crop = (seed: number) => {
  const data = new Uint8ClampedArray(32 * 18 * 4)
  for (let i = 0; i < data.length; i += 4) { data[i] = data[i + 1] = data[i + 2] = (i * seed) % 251; data[i + 3] = 255 }
  return { data, width: 32, height: 18 }
}
const box = (x = 100, y = 100, w = 100, h = 56): Box => ({ x, y, w, h })

describe('confirmCard', () => {
  it('enrols the artwork, remembers the title on the device and teaches the vocabulary', () => {
    const store = memoryStore()
    const vocab = createVocabulary(['Alpha Show'])
    const r = confirmCard({ store, vocabulary: vocab }, { title: '  Brand   New Thing ', crop: crop(7), year: '2024', type: 'series' })
    expect(r.remembered).toBe(true)
    expect(r.index?.map(e => e.title)).toEqual(['Brand New Thing'])
    expect(loadIndex(store)).toHaveLength(1)
    expect(loadConfirmed(store)[0]).toEqual({ title: 'Brand New Thing', year: '2024', type: 'series' })
    expect(vocab.titles()).toContain('Brand New Thing')
  })

  it('still works when storage throws', () => {
    const store: KeyValueStore = { getItem: () => null, setItem: () => { throw new Error('full') }, removeItem: () => undefined }
    expect(() => confirmCard({ store }, { title: 'X Show', crop: crop(3) })).not.toThrow()
  })
})

describe('ProvisionalTitles (an auto-read title is only made permanent on its second identical accept)', () => {
  it('asks for enrolment on the second identical accept for the same card, not the first', () => {
    const p = new ProvisionalTitles()
    expect(p.accept(box(), 'Dark', 0)).toEqual({ count: 1, enrol: false })
    expect(p.title(box())).toBe('Dark')
    expect(p.accept(box(), 'dark', 3000)).toEqual({ count: 2, enrol: true })
  })

  it('a different title for the same card starts over', () => {
    const p = new ProvisionalTitles()
    p.accept(box(), 'Dark', 0)
    expect(p.accept(box(), 'Dahmer', 3000)).toEqual({ count: 1, enrol: false })
    expect(p.title(box())).toBe('Dahmer')
  })

  it('follows a card that drifts a little between frames, and keeps neighbouring cards apart', () => {
    const p = new ProvisionalTitles()
    p.accept(box(100), 'Dark', 0)
    p.follow([box(112, 104)], 100)
    p.follow([box(126, 108)], 200)
    expect(p.accept(box(130, 108), 'Dark', 5000).enrol).toBe(true)
    expect(p.title(box(260))).toBeNull() // the next card over
  })

  it('forgets a card that has not been seen for the ttl, and forget() drops one', () => {
    const p = new ProvisionalTitles(1000)
    p.accept(box(), 'Dark', 0)
    p.follow([], 5000)
    expect(p.title(box())).toBeNull()
    p.accept(box(), 'Dark', 6000)
    p.forget(box())
    expect(p.title(box())).toBeNull()
  })
})

describe('TileNotes', () => {
  it('stores a value per card position and replaces it for the same card', () => {
    const n = new TileNotes<string>()
    n.set(box(0), 'a', 0)
    n.set(box(300), 'b', 0)
    n.set(box(5), 'a2', 10)
    expect(n.get(box(2))).toBe('a2')
    expect(n.get(box(300))).toBe('b')
    expect(n.size).toBe(2)
  })
})
