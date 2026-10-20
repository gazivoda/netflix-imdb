// Perceptual hash of a card image: a difference hash (structure) plus a coarse colour grid.
// Pure functions over RGBA pixels (as from canvas ImageData) so they run in the browser and in tests.

export const HASH_SIZE = 16 // 16x16 = 256 bits
export const COLOR_GRID = 4 // 4x4 cells x RGB = 48 values
// A bit is set only when the left cell is brighter by more than this (0-255). Without the dead
// zone, flat regions flip bits at random under sensor noise / JPEG and the hash becomes unstable.
export const DEAD_ZONE = 4

export interface RgbaImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface CardHash {
  bits: Uint8Array // HASH_SIZE * HASH_SIZE bits, packed 8 per byte
  color: Uint8Array // COLOR_GRID * COLOR_GRID * 3 channel means
}

// Area-average downsample of one channel-extractor over the image into tw x th cells.
function downsample(img: RgbaImage, tw: number, th: number, channel: (i: number) => number): Float32Array {
  const out = new Float32Array(tw * th)
  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.floor((ty * img.height) / th)
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * img.height) / th))
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.floor((tx * img.width) / tw)
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * img.width) / tw))
      let sum = 0
      let n = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += channel((y * img.width + x) * 4)
          n++
        }
      }
      out[ty * tw + tx] = sum / n
    }
  }
  return out
}

export function hashCard(img: RgbaImage): CardHash {
  const d = img.data
  const gray = (i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]

  // dHash: (HASH_SIZE+1) x HASH_SIZE grid, bit = left cell clearly brighter than right neighbour.
  const grid = downsample(img, HASH_SIZE + 1, HASH_SIZE, gray)
  const bits = new Uint8Array((HASH_SIZE * HASH_SIZE) / 8)
  let bit = 0
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      if (grid[y * (HASH_SIZE + 1) + x] - grid[y * (HASH_SIZE + 1) + x + 1] > DEAD_ZONE) {
        bits[bit >> 3] |= 1 << (bit & 7)
      }
      bit++
    }
  }

  const color = new Uint8Array(COLOR_GRID * COLOR_GRID * 3)
  const channels = [0, 1, 2].map(c => downsample(img, COLOR_GRID, COLOR_GRID, i => d[i + c]))
  for (let cell = 0; cell < COLOR_GRID * COLOR_GRID; cell++) {
    for (let c = 0; c < 3; c++) color[cell * 3 + c] = Math.round(channels[c][cell])
  }

  return { bits, color }
}

const POPCOUNT = Uint8Array.from({ length: 256 }, (_, n) => {
  let c = 0
  for (let v = n; v; v >>= 1) c += v & 1
  return c
})

// Normalised to 0..1.
export function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  let diff = 0
  for (let i = 0; i < a.length; i++) diff += POPCOUNT[a[i] ^ b[i]]
  return diff / (a.length * 8)
}

// Mean absolute channel difference, normalised to 0..1.
export function colorDistance(a: Uint8Array, b: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i])
  return sum / (a.length * 255)
}

// Calibrated on synthetic TV frames (tests/lib/ar/calibrate.test.ts): 0.3-0.5 beat the old 0.7 because the dHash bits
// flip under blur/noise/keystone while the 4x4 colour grid stays put. 0.4 was near-best on both vivid and dim/desaturated
// art, where 0.3 over-fits to saturated colour. Synthetic art only: re-measure on real phone-of-TV captures.
export const STRUCTURE_WEIGHT = 0.4

export function cardDistance(a: CardHash, b: CardHash): number {
  return STRUCTURE_WEIGHT * hammingDistance(a.bits, b.bits) + (1 - STRUCTURE_WEIGHT) * colorDistance(a.color, b.color)
}

export function hashToHex(h: CardHash): { bits: string; color: string } {
  const hex = (u: Uint8Array) => Array.from(u, v => v.toString(16).padStart(2, '0')).join('')
  return { bits: hex(h.bits), color: hex(h.color) }
}

export function hashFromHex(bits: string, color: string): CardHash {
  const bytes = (s: string) => Uint8Array.from(s.match(/../g) ?? [], h => parseInt(h, 16))
  return { bits: bytes(bits), color: bytes(color) }
}
