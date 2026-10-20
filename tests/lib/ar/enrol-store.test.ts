import { enrolCard, loadIndex, removeCard, clearIndex, STORAGE_KEY, KeyValueStore } from '../../../lib/ar/enrol-store'
import { cardDistance, RgbaImage } from '../../../lib/card-hash'

function fakeStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: k => void map.delete(k),
  }
}

// Blocky deterministic image; different seeds give clearly different structure.
function pattern(seed: number, w = 48, h = 27): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = (((Math.floor(x / 6) * 31 + Math.floor(y / 6) * 17) * (seed + 3)) ^ (seed * 97)) & 255
      const i = (y * w + x) * 4
      data[i] = v; data[i + 1] = (v * 3) & 255; data[i + 2] = (v * 7) & 255; data[i + 3] = 255
    }
  }
  return { data, width: w, height: h }
}

describe('enrol-store', () => {
  it('round-trips an enrolled card with an identical hash', () => {
    const store = fakeStore()
    const returned = enrolCard(store, 'Dark', pattern(1), '2017')
    const loaded = loadIndex(store)
    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toMatchObject({ title: 'Dark', year: '2017' })
    expect(cardDistance(loaded[0].hash, returned[0].hash)).toBe(0)
  })

  it('replaces an entry with the same title (case/space-insensitive) instead of duplicating', () => {
    const store = fakeStore()
    enrolCard(store, 'The Office', pattern(1))
    enrolCard(store, 'Dark', pattern(2))
    const idx = enrolCard(store, '  the   OFFICE ', pattern(3))
    expect(idx.map(e => e.title).sort()).toEqual(['Dark', 'the OFFICE'])
    expect(loadIndex(store)).toHaveLength(2)
    const office = loadIndex(store).find(e => e.id === idx.find(x => x.title === 'the OFFICE')!.id)!
    expect(cardDistance(office.hash, loadIndex(store).find(e => e.title === 'Dark')!.hash)).toBeGreaterThan(0)
  })

  it('removes by id and leaves the others', () => {
    const store = fakeStore()
    enrolCard(store, 'A', pattern(1))
    const [a, b] = enrolCard(store, 'B', pattern(2))
    expect(removeCard(store, a.id).map(e => e.id)).toEqual([b.id])
    expect(loadIndex(store).map(e => e.id)).toEqual([b.id])
  })

  it('tolerates corrupt or malformed storage', () => {
    const store = fakeStore()
    store.map.set(STORAGE_KEY, '{not json')
    expect(loadIndex(store)).toEqual([])
    store.map.set(STORAGE_KEY, '{"a":1}')
    expect(loadIndex(store)).toEqual([])
    // and enrolling over corrupt data recovers
    expect(enrolCard(store, 'A', pattern(1))).toHaveLength(1)
    expect(loadIndex(store)).toHaveLength(1)
  })

  it('clearIndex empties storage', () => {
    const store = fakeStore()
    enrolCard(store, 'A', pattern(1))
    clearIndex(store)
    expect(store.map.has(STORAGE_KEY)).toBe(false)
    expect(loadIndex(store)).toEqual([])
  })

  it('ignores a blank title and survives a throwing store', () => {
    const store = fakeStore()
    expect(enrolCard(store, '   ', pattern(1))).toEqual([])
    const throwing: KeyValueStore = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('quota') },
      removeItem: () => { throw new Error('denied') },
    }
    expect(loadIndex(throwing)).toEqual([])
    expect(enrolCard(throwing, 'A', pattern(1))).toHaveLength(1)
    expect(() => clearIndex(throwing)).not.toThrow()
  })
})
