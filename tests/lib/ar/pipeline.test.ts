import { ArPipeline, DEFAULT_PIPELINE } from '../../../lib/ar/pipeline'
import { RgbaImage, cardDistance, hashCard } from '../../../lib/card-hash'
import { IndexEntry } from '../../../lib/card-index'
import { Box } from '../../../lib/card-tracker'

// Smooth, distinctive artwork (radial gradient + stripes) so it survives resampling.
function art(seed: number, w = 96, h = 54): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4)
  const cx = ((seed * 37) % 80) / 100 * w + w * 0.1
  const cy = ((seed * 53) % 80) / 100 * h + h * 0.1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy)
      const i = (y * w + x) * 4
      data[i] = (seed * 71 + d * 5) & 255
      data[i + 1] = (seed * 29 + (x * (seed % 5 + 1)) * 2) & 255
      data[i + 2] = (seed * 113 + y * (seed % 3 + 2) * 4) & 255
      data[i + 3] = 255
    }
  }
  return { data, width: w, height: h }
}

function blank(w: number, h: number): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 3; i < data.length; i += 4) data[i] = 255
  return { data, width: w, height: h }
}

// Paste `src` scaled (nearest) into `box` of `frame`.
function paste(frame: RgbaImage, src: RgbaImage, box: Box): void {
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const s = (Math.floor((y * src.height) / box.h) * src.width + Math.floor((x * src.width) / box.w)) * 4
      const d = ((box.y + y) * frame.width + box.x + x) * 4
      frame.data.set(src.data.subarray(s, s + 4), d)
    }
  }
}

const entry = (id: string, seed: number): IndexEntry => ({ id, title: `Title ${id}`, hash: hashCard(art(seed)) })
const INDEX = [entry('a', 1), entry('b', 2), entry('c', 3)]

describe('ArPipeline', () => {
  it('matches a known card and reports it as a track with its title', () => {
    const box = { x: 20, y: 30, w: 192, h: 108 }
    const frame = blank(320, 180)
    paste(frame, art(1), box)
    const p = new ArPipeline({ findCards: () => [box] })
    p.setIndex(INDEX)
    const r = p.processFrame(frame)
    expect(r.tracks).toHaveLength(1)
    expect(r.tracks[0].title).toBe('Title a')
    expect(r.tracks[0].box).toEqual(box)
    expect(r.unknownCards).toHaveLength(0)
    expect(r.timings.totalMs).toBeGreaterThanOrEqual(r.timings.findMs)
    expect(r.timings.findMs).toBeGreaterThanOrEqual(0)
  })

  it('surfaces an unmatched card as unknownCards with a rectified crop', () => {
    const known = { x: 10, y: 10, w: 144, h: 81 }
    const stranger = { x: 170, y: 10, w: 144, h: 81 }
    const frame = blank(320, 120)
    paste(frame, art(2), known)
    paste(frame, art(9), stranger)
    const p = new ArPipeline({ findCards: () => [known, stranger] })
    p.setIndex(INDEX)
    const r = p.processFrame(frame)
    expect(r.unknownCards).toHaveLength(1)
    expect(r.unknownCards[0].box).toEqual(stranger)
    expect(r.unknownCards[0].crop).toMatchObject({ width: DEFAULT_PIPELINE.cardOutW, height: DEFAULT_PIPELINE.cardOutH })
    // the crop is what would be enrolled: it must look like the stranger art, not the blank background
    expect(cardDistance(hashCard(r.unknownCards[0].crop), hashCard(art(9)))).toBeLessThan(0.1)
    expect(cardDistance(hashCard(r.unknownCards[0].crop), hashCard(blank(96, 54)))).toBeGreaterThan(0.1)
  })

  it('keeps a stable title across frames despite one bad frame', () => {
    const box = { x: 20, y: 20, w: 192, h: 108 }
    const good = blank(320, 160)
    paste(good, art(3), box)
    const bad = blank(320, 160)
    paste(bad, art(9), box)
    const p = new ArPipeline({ findCards: () => [box] })
    p.setIndex(INDEX)
    for (let i = 0; i < 4; i++) p.processFrame(good)
    const glitch = p.processFrame(bad)
    expect(glitch.unknownCards).toHaveLength(1) // this frame alone found no match...
    expect(glitch.tracks[0].title).toBe('Title c') // ...but the track keeps its identity
    expect(p.processFrame(good).tracks[0].title).toBe('Title c')
  })

  it('maps boxes back to input coordinates when the input is wider than analysisWidth', () => {
    const inputBox = { x: 200, y: 100, w: 400, h: 225 }
    const frame = blank(1280, 720)
    paste(frame, art(2), inputBox)
    const seen: { w: number; h: number }[] = []
    const p = new ArPipeline(
      {
        findCards: img => {
          seen.push({ w: img.width, h: img.height })
          // finder works in the 640x360 analysis frame: half of the input coords
          return [{ x: 100, y: 50, w: 200, h: 112.5 }]
        },
      },
      { analysisWidth: 640 },
    )
    p.setIndex(INDEX)
    const r = p.processFrame(frame)
    expect(seen).toEqual([{ w: 640, h: 360 }])
    expect(r.tracks[0].box).toEqual(inputBox)
    expect(r.tracks[0].title).toBe('Title b') // crop came from the right place in the full-res frame
  })

  it('does not rescale boxes when the input is already narrow enough', () => {
    const box = { x: 5, y: 5, w: 100, h: 56 }
    const frame = blank(200, 100)
    let passed: RgbaImage | null = null
    const p = new ArPipeline({ findCards: img => ((passed = img), [box]) })
    p.processFrame(frame)
    expect(passed).toBe(frame)
    expect(p.processFrame(frame).tracks[0].box).toEqual(box)
  })

  it('reset() forgets tracks', () => {
    const box = { x: 20, y: 20, w: 192, h: 108 }
    const frame = blank(320, 160)
    paste(frame, art(1), box)
    const p = new ArPipeline({ findCards: () => [box] })
    p.setIndex(INDEX)
    const first = p.processFrame(frame).tracks[0]
    expect(p.processFrame(frame).tracks[0].trackId).toBe(first.trackId)
    p.reset()
    const after = p.processFrame(frame).tracks[0]
    expect(after.age).toBe(1)
  })

  it('with an empty index every detection is unknown and untitled', () => {
    const box = { x: 20, y: 20, w: 192, h: 108 }
    const frame = blank(320, 160)
    paste(frame, art(1), box)
    const p = new ArPipeline({ findCards: () => [box] })
    const r = p.processFrame(frame)
    expect(r.unknownCards).toHaveLength(1)
    expect(r.tracks[0].title).toBeNull()
  })

  it('hands the corners of an unrecognised card back in input-image pixels (scaled with the box)', () => {
    const quad: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [{ x: 10, y: 12 }, { x: 110, y: 10 }, { x: 112, y: 66 }, { x: 11, y: 68 }]
    const box = { x: 10, y: 10, w: 102, h: 58 }
    const frame = blank(1280, 720) // analysed at 640 wide: everything doubles
    const p = new ArPipeline({ findCards: () => [box], findCardsDetailed: () => [{ box, quad }] })
    const r = p.processFrame(frame)
    expect(r.unknownCards[0].box).toEqual({ x: 20, y: 20, w: 204, h: 116 })
    expect(r.unknownCards[0].quad).toEqual([{ x: 20, y: 24 }, { x: 220, y: 20 }, { x: 224, y: 132 }, { x: 22, y: 136 }])
  })

  it('works without corners (a finder that only returns boxes)', () => {
    const p = new ArPipeline({ findCards: () => [{ x: 5, y: 5, w: 100, h: 56 }] })
    expect(p.processFrame(blank(200, 100)).unknownCards[0].quad).toBeUndefined()
  })

  it('returns nothing for a frame with no cards', () => {
    const p = new ArPipeline({ findCards: () => [] })
    p.setIndex(INDEX)
    const r = p.processFrame(blank(320, 180))
    expect(r.tracks).toEqual([])
    expect(r.unknownCards).toEqual([])
  })
})
