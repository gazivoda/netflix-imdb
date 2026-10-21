import { RgbaImage } from '../../../lib/card-hash'
import { createTileReader, DEFAULT_PASSES, FALLBACK_PASSES, OcrEngine, preparePass, tesseractEngine } from '../../../lib/ar/tile-reader'
import { createVocabulary } from '../../../lib/ar/title-vocab'

// Passes see images of at least 360 px wide, so a 120x68 crop becomes ~360x204 and "title sized" text is >= ~30 px tall.
const frame = (w = 120, h = 68): RgbaImage => {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) { const v = (i * 37) % 256; data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255 }
  return { data, width: w, height: h }
}
const word = (text: string, x0: number, y0 = 20, confidence = 90, h = 40) => ({ text, confidence, bbox: { x0, y0, x1: x0 + 14 * text.length, y1: y0 + h } })
const scripted = (seq: ReturnType<typeof word>[][]): { engine: OcrEngine; calls: () => number } => {
  let i = 0
  return { engine: { recognize: async () => ({ text: '', words: seq[Math.min(i++, seq.length - 1)] }) }, calls: () => i }
}

describe('createTileReader', () => {
  it('stops after the first pass when it is certain, and returns case-normalised candidates', async () => {
    const { engine, calls } = scripted([[word('THE', 0, 20, 97), word('GRAY', 60, 20, 97), word('MAN', 140, 20, 97)]])
    const r = await createTileReader(engine).read(frame())
    expect(calls()).toBe(1)
    expect(r.passes).toBe(1)
    expect(r.candidates[0]).toBe('The Gray Man')
    expect(r.scores[0]).toBeGreaterThanOrEqual(0.9)
  })

  it('keeps running passes until two of them agree, and counts the passes it ran', async () => {
    const { engine } = scripted([[word('NETFL', 0, 20, 45)], [word('FORMULA', 0, 20, 60)], [word('FORMULA', 0, 20, 62)]])
    const r = await createTileReader(engine, { certainScore: 2 }).read(frame())
    expect(r.passes).toBe(3)
    expect(r.candidates[0]).toBe('Formula')
  })

  it('runs every pass of the plan when nothing is convincing, then returns what it has', async () => {
    const { engine, calls } = scripted([[word('XQZ', 0, 20, 35)]])
    const r = await createTileReader(engine, { minScore: 0 }).read(frame())
    expect(calls()).toBe(DEFAULT_PASSES.length)
    expect(r.passes).toBe(DEFAULT_PASSES.length)
  })

  it('does not call the engine on a blank crop', async () => {
    let calls = 0
    const engine: OcrEngine = { recognize: async () => { calls++; return { text: '', words: [] } } }
    const blank: RgbaImage = { data: new Uint8ClampedArray(120 * 68 * 4).fill(30), width: 120, height: 68 }
    const r = await createTileReader(engine).read(blank)
    expect(calls).toBe(0)
    expect(r).toMatchObject({ candidates: [], passes: 0 })
  })

  it('hands every pass its page-segmentation mode and a grey hint', async () => {
    const seen: unknown[] = []
    const engine: OcrEngine = { recognize: async (_img, hints) => { seen.push(hints); return { text: '', words: [] } } }
    await createTileReader(engine, { fallbackPasses: [], passes: [{ region: [0, 0, 1, 1], scale: 3, prep: 'sharp', psm: 6 }, { region: [0, 0, 1, 1], scale: 3, prep: 'col', psm: 11 }] }).read(frame())
    expect(seen).toEqual([{ psm: 6, grey: true }, { psm: 11, grey: false }])
  })

  it('drops candidates below minScore (a wrong rating is worse than none)', async () => {
    const { engine } = scripted([[word('Crowe', 0, 20, 33, 8)]])
    expect((await createTileReader(engine, { passes: [DEFAULT_PASSES[0]] }).read(frame())).candidates).toEqual([])
    expect((await createTileReader(engine, { passes: [DEFAULT_PASSES[0]], minScore: 0 }).read(frame())).candidates).toEqual(['Crowe'])
  })

  it('snaps fragments from different passes onto a vocabulary title', async () => {
    const vocabulary = createVocabulary(['Virgin River', 'The Crown', 'Narcos'])
    // two passes, each sees only half of the logo
    const { engine } = scripted([[word('VIRGIN', 20, 40, 88, 50)], [word('RIVER', 20, 40, 85, 50)]])
    const plain = await createTileReader(engine, { certainScore: 2, passes: DEFAULT_PASSES.slice(0, 2) }).read(frame())
    expect(plain.candidates).not.toContain('Virgin River')
    const { engine: engine2 } = scripted([[word('VIRGIN', 20, 40, 88, 50)], [word('RIVER', 20, 40, 85, 50)]])
    const snapped = await createTileReader(engine2, { vocabulary, certainScore: 2, passes: DEFAULT_PASSES.slice(0, 2) }).read(frame())
    expect(snapped.candidates[0]).toBe('Virgin River')
  })

  it('tries a downscaled pass and a lower-left strip only when the main plan found nothing', async () => {
    const widths: number[] = []
    const engine: OcrEngine = {
      recognize: async img => {
        widths.push(img.width)
        // large logo text is only legible at the small size
        return { text: '', words: img.width <= 240 ? [word('OZARK', 0, 20, 95), word('', 0)] : [] }
      },
    }
    const r = await createTileReader(engine).read(frame(400, 225))
    expect(r.candidates[0]).toBe('Ozark')
    expect(widths.slice(0, DEFAULT_PASSES.length).every(w => w > 240)).toBe(true)
    expect(widths[DEFAULT_PASSES.length]).toBe(200)
    expect(r.passes).toBeGreaterThan(DEFAULT_PASSES.length)
  })

  it('does not run the fallback passes when the plan already found a title', async () => {
    const { engine, calls } = scripted([[word('THE', 0, 20, 97), word('GRAY', 60, 20, 97), word('MAN', 140, 20, 97)]])
    await createTileReader(engine).read(frame())
    expect(calls()).toBe(1)
  })

  it('has a downscaled pass and a lower-left strip in the fallback plan', () => {
    expect(FALLBACK_PASSES.some(p => p.width && p.width <= 240)).toBe(true)
    expect(FALLBACK_PASSES.some(p => p.region[0] === 0 && p.region[1] >= 0.4 && p.region[2] < 1)).toBe(true)
  })

  it('reports how long it took with the injected clock', async () => {
    let t = 0
    const { engine } = scripted([[word('TIGER', 0, 20, 96), word('KING', 80, 20, 96)]])
    const r = await createTileReader(engine, { now: () => (t += 50) }).read(frame())
    expect(r.ms).toBe(50)
  })
})

describe('preparePass', () => {
  it('upscales a small crop to a width the OCR can use and returns greyscale for grey preps', () => {
    const { img, grey } = preparePass(frame(100, 56), { region: [0, 0, 1, 1], scale: 3, prep: 'sharp', psm: 11 })
    expect(img.width).toBe(360)
    expect(grey).toBe(true)
    expect(img.data[0]).toBe(img.data[1])
  })

  it('crops the region before scaling', () => {
    const { img } = preparePass(frame(400, 200), { region: [0, 0.5, 1, 0.5], scale: 2, prep: 'col', psm: 6 })
    expect(img.width).toBe(800)
    expect(img.height).toBe(200)
  })

  it('honours an explicit output width (the downscaled pass)', () => {
    expect(preparePass(frame(400, 225), { region: [0, 0, 1, 1], scale: 1, width: 200, prep: 'sharp', psm: 11 }).img.width).toBe(200)
  })

  it('caps the output width for big crops', () => {
    expect(preparePass(frame(900, 500), { region: [0, 0, 1, 1], scale: 4, prep: 'luma', psm: 11 }).img.width).toBe(1000)
  })
})

describe('tesseractEngine', () => {
  it('switches the page segmentation mode only when it changes, and maps blocks to flat words', async () => {
    const params: unknown[] = []
    const worker = {
      setParameters: async (p: Record<string, unknown>) => { params.push(p) },
      recognize: async () => ({ data: { text: 'DARK', blocks: [{ paragraphs: [{ lines: [{ words: [{ text: 'DARK', confidence: 90, bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } }] }] }] }] } }),
    }
    const engine = tesseractEngine(worker, img => img)
    const img = frame(10, 10)
    const out = await engine.recognize(img, { psm: 6 })
    await engine.recognize(img, { psm: 6 })
    await engine.recognize(img, { psm: 11 })
    expect(params).toEqual([{ tessedit_pageseg_mode: '6', user_defined_dpi: '300', preserve_interword_spaces: '1' }, { tessedit_pageseg_mode: '11' }])
    expect(out.words).toEqual([{ text: 'DARK', confidence: 90, bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } }])
    expect(out.text).toBe('DARK')
  })

  it('tolerates a result without blocks', async () => {
    const engine = tesseractEngine({ setParameters: async () => undefined, recognize: async () => ({ data: { text: '' } }) }, img => img)
    expect((await engine.recognize(frame(10, 10))).words).toEqual([])
  })
})
