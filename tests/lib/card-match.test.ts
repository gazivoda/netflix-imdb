import { hashCard, hammingDistance, cardDistance, hashToHex, hashFromHex, RgbaImage } from '../../lib/card-hash'
import { matchCard, serializeIndex, deserializeIndex, IndexEntry } from '../../lib/card-index'

// Deterministic PRNG so degradation noise is repeatable.
function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32)
}

// Synthetic "card art": a few coloured blobs/bars on a base colour, derived from a seed.
function makeCard(seed: number, w = 160, h = 90): RgbaImage {
  const r = rng(seed)
  const data = new Uint8ClampedArray(w * h * 4)
  const base = [r() * 255, r() * 255, r() * 255]
  const shapes = Array.from({ length: 6 }, () => ({
    x: r() * w, y: r() * h, rx: 10 + r() * 40, ry: 10 + r() * 30,
    c: [r() * 255, r() * 255, r() * 255],
  }))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = [...base]
      for (const s of shapes) {
        if (((x - s.x) / s.rx) ** 2 + ((y - s.y) / s.ry) ** 2 < 1) s.c.forEach((v, i) => (px[i] = v))
      }
      const o = (y * w + x) * 4
      data[o] = px[0]; data[o + 1] = px[1]; data[o + 2] = px[2]; data[o + 3] = 255
    }
  }
  return { data, width: w, height: h }
}

// Phone-ish degradation: nearest-neighbour resize, brightness shift, noise.
function degrade(img: RgbaImage, opts: { scale: number; brightness: number; noise: number; seed: number }): RgbaImage {
  const w = Math.max(8, Math.round(img.width * opts.scale))
  const h = Math.max(8, Math.round(img.height * opts.scale))
  const r = rng(opts.seed)
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.floor((x * img.width) / w))
      const sy = Math.min(img.height - 1, Math.floor((y * img.height) / h))
      const so = (sy * img.width + sx) * 4
      const o = (y * w + x) * 4
      for (let c = 0; c < 3; c++) data[o + c] = img.data[so + c] + opts.brightness + (r() - 0.5) * 2 * opts.noise
      data[o + 3] = 255
    }
  }
  return { data, width: w, height: h }
}

const MEDIUM = { scale: 0.5, brightness: 20, noise: 18 }

describe('hashCard / distances', () => {
  it('is identical for the same image', () => {
    const a = hashCard(makeCard(1))
    expect(cardDistance(a, hashCard(makeCard(1)))).toBe(0)
  })

  it('produces 256 structure bits and 48 colour values', () => {
    const h = hashCard(makeCard(1))
    expect(h.bits).toHaveLength(32)
    expect(h.color).toHaveLength(48)
  })

  it('hamming distance is the normalised bit difference', () => {
    expect(hammingDistance(Uint8Array.of(0b1111, 0), Uint8Array.of(0, 0))).toBeCloseTo(4 / 16)
  })

  it('round-trips through hex', () => {
    const h = hashCard(makeCard(7))
    const { bits, color } = hashToHex(h)
    expect(hashFromHex(bits, color)).toEqual(h)
  })

  it('keeps a degraded copy much closer to its original than to other cards', () => {
    const original = hashCard(makeCard(3))
    const degraded = hashCard(degrade(makeCard(3), { ...MEDIUM, seed: 99 }))
    const same = cardDistance(original, degraded)
    for (const other of [4, 5, 6, 7, 8, 9, 10]) {
      expect(cardDistance(original, hashCard(makeCard(other)))).toBeGreaterThan(same * 1.5)
    }
  })
})

describe('matchCard', () => {
  const entries: IndexEntry[] = [10, 11, 12, 13, 14, 15].map(seed => ({
    id: `tt${seed}`, title: `Title ${seed}`, hash: hashCard(makeCard(seed)),
  }))

  it('identifies a degraded card', () => {
    for (const seed of [10, 12, 15]) {
      const q = hashCard(degrade(makeCard(seed), { ...MEDIUM, seed: seed * 7 }))
      expect(matchCard(q, entries)?.entry.id).toBe(`tt${seed}`)
    }
  })

  it('rejects a card that is not in the index', () => {
    expect(matchCard(hashCard(makeCard(999)), entries)).toBeNull()
  })

  it('rejects ambiguous matches (runner-up too close)', () => {
    const twin = { ...entries[0], id: 'twin', title: 'Twin' }
    const q = hashCard(makeCard(10))
    expect(matchCard(q, [...entries, twin])).toBeNull()
  })

  it('returns null for an empty index', () => {
    expect(matchCard(hashCard(makeCard(1)), [])).toBeNull()
  })

  it('survives serialisation and ignores malformed rows', () => {
    const restored = deserializeIndex([...serializeIndex(entries), { id: 1 }, null, 'x'])
    expect(restored).toHaveLength(entries.length)
    expect(matchCard(hashCard(makeCard(11)), restored)?.entry.title).toBe('Title 11')
    expect(deserializeIndex('not an array')).toEqual([])
  })
})
