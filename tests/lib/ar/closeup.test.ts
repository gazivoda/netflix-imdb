import { readCloseup, locateLogo, stage2Passes, STAGE1_PASSES } from '../../../lib/ar/closeup-reader'
import { SURE_SCORE, decideCloseup, didYouMean, tierOf } from '../../../lib/ar/closeup-decide'
import { CLOSE_PX, OK_PX, closeupHint, cropRectWithMargin, pickSharpest, reticleNativeWidth, reticleRect } from '../../../lib/ar/closeup-capture'
import type { OcrEngine, OcrHints, OcrImage } from '../../../lib/ar/tile-reader'
import type { OcrWordLike } from '../../../lib/ar/title-candidates'
import type { PassWords } from '../../../lib/ar/title-confidence'
import { laplacianVariance } from '../../../lib/ar/sharpness'

const w = (text: string, x0: number, y0: number, h: number, conf = 90, width = text.length * h * 0.6): OcrWordLike => ({ text, confidence: conf, bbox: { x0, y0, x1: x0 + width, y1: y0 + h } })
const pass = (words: OcrWordLike[], imageHeight = 1000): PassWords => ({ words, imageHeight })

describe('locateLogo', () => {
  it('finds a one-line logo and leaves small print out of the box', () => {
    const p = pass([w('STRANGER', 100, 400, 150), w('THINGS', 600, 400, 150), w('TOP', 800, 20, 40), w('10', 900, 20, 40), w('TV-MA', 20, 930, 35)])
    const found = locateLogo([p], 1600, 1000)!
    expect(found.textH).toBe(150)
    expect(found.box.x).toBeLessThan(100)
    expect(found.box.x + found.box.w).toBeGreaterThan(600 + 6 * 90)
    expect(found.box.y).toBeLessThan(400)
    expect(found.box.y + found.box.h).toBeGreaterThan(550)
    expect(found.box.y).toBeGreaterThan(200) // the "TOP 10" badge at the top is not part of it
    expect(found.box.y + found.box.h).toBeLessThan(800)
  })

  it('joins the two lines of a stacked logo', () => {
    const p = pass([w('MONEY', 200, 300, 140), w('HEIST', 200, 470, 140)])
    const found = locateLogo([p], 1600, 1000)!
    expect(found.box.y).toBeLessThan(300)
    expect(found.box.y + found.box.h).toBeGreaterThan(610)
  })

  it('maps word boxes of a scaled pass back to crop pixels, and clamps the box to the crop', () => {
    const p = pass([w('DARK', 0, 0, 100), w('KNIGHT', 300, 0, 100)], 500) // pass image half as tall as the crop
    const found = locateLogo([p], 1000, 1000)!
    expect(found.textH).toBe(200)
    expect(found.box.x).toBe(0)
    expect(found.box.y).toBe(0)
    expect(found.box.x + found.box.w).toBeLessThanOrEqual(1000)
  })

  it('has nothing to anchor on without confident words', () => {
    expect(locateLogo([], 1000, 1000)).toBeNull()
    expect(locateLogo([pass([w('XQ', 10, 10, 100, 20)])], 1000, 1000)).toBeNull()
  })

  it('stage 2 enlarges so the letters are ~56 px, within limits', () => {
    const crop = { width: 1600, height: 1000 }
    const small = stage2Passes({ box: { x: 100, y: 300, w: 200, h: 100 }, textH: 14 }, crop)
    expect(small).toHaveLength(4)
    expect(small.every(p => p.psm === 6 && p.scale === 1)).toBe(true)
    expect(small[0].width).toBe(800) // 200 px wide x zoom 4 (56 / 14)
    expect(stage2Passes({ box: { x: 0, y: 0, w: 200, h: 20 }, textH: 5 }, crop)[0].width).toBe(1600) // zoom capped at 8
    expect(stage2Passes({ box: { x: 0, y: 0, w: 1500, h: 300 }, textH: 40 }, crop)[0].width).toBe(1800) // output capped
    expect(stage2Passes({ box: { x: 0, y: 0, w: 100, h: 50 }, textH: 100 }, crop)[0].width).toBe(300) // never below 300
    expect(small[0].region[0]).toBeCloseTo(100 / 1600)
  })
})

// A card crop with enough contrast to be worth reading
function cardCrop(width = 400, height = 225) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const o = (y * width + x) * 4
    data[o] = data[o + 1] = data[o + 2] = ((x * 5 + y * 3) % 200) + 20
    data[o + 3] = 255
  }
  return { data, width, height }
}

function fakeEngine(script: (img: OcrImage, hints: OcrHints, n: number) => OcrWordLike[]): OcrEngine & { calls: { w: number; h: number; psm: number | undefined }[] } {
  const calls: { w: number; h: number; psm: number | undefined }[] = []
  return {
    calls,
    async recognize(img, hints = {}) {
      calls.push({ w: img.width, h: img.height, psm: hints.psm })
      const words = script(img, hints, calls.length - 1)
      return { text: words.map(x => x.text).join(' '), words }
    },
  }
}

describe('readCloseup', () => {
  it('stops after stage 1 when the whole-card passes already agree on a sure reading', async () => {
    const eng = fakeEngine(img => [w('THE', img.width * 0.1, img.height * 0.4, img.height * 0.3, 98), w('CROWN', img.width * 0.3, img.height * 0.4, img.height * 0.3, 98)])
    const stages: number[] = []
    const r = await readCloseup(eng, cardCrop(), {}, s => stages.push(s))
    expect(r.stage).toBe(1)
    expect(r.passes).toBe(3)
    expect(r.located).toBeNull()
    expect(stages).toEqual([1])
    expect(r.candidates[0]).toBe('The Crown')
    expect(eng.calls.every(c => c.psm === 11)).toBe(true)
  })

  it('locates the logo and re-reads it zoomed in when stage 1 only half-reads it', async () => {
    const eng = fakeEngine((img, hints) => {
      if (hints.psm === 11) return [w('STRANG', img.width * 0.1, img.height * 0.45, img.height * 0.12, 55), w('TV-MA', 5, img.height * 0.9, img.height * 0.05, 70)]
      // the zoomed passes see the logo big
      return [w('STRANGER', img.width * 0.05, img.height * 0.2, img.height * 0.5, 96), w('THINGS', img.width * 0.55, img.height * 0.2, img.height * 0.5, 96)]
    })
    const stages: number[] = []
    const r = await readCloseup(eng, cardCrop(), {}, s => stages.push(s))
    expect(stages).toEqual([1, 2])
    expect(r.stage).toBe(2)
    expect(r.passes).toBe(STAGE1_PASSES.length + 4)
    expect(r.located).not.toBeNull()
    const zoomed = eng.calls.slice(4)
    expect(zoomed.every(c => c.psm === 6)).toBe(true)
    expect(new Set(zoomed.map(c => c.w)).size).toBe(1) // one output width for all four
    expect(zoomed[0].w).toBeGreaterThanOrEqual(300)
    expect(r.candidates[0]).toBe('Stranger Things')
    expect(r.literal).toBe('STRANGER THINGS')
  })

  it('does not zoom when nothing can be anchored, and does not invent a title', async () => {
    const eng = fakeEngine(() => [])
    const r = await readCloseup(eng, cardCrop())
    expect(r.passes).toBe(4)
    expect(r.located).toBeNull()
    expect(r.candidates).toEqual([])
    expect(r.literal).toBe('')
  })

  it('reads nothing from a blank frame', async () => {
    const eng = fakeEngine(() => [w('X', 0, 0, 10)])
    const blank = { data: new Uint8ClampedArray(400 * 225 * 4).fill(128), width: 400, height: 225 }
    const r = await readCloseup(eng, blank)
    expect(r.passes).toBe(0)
    expect(eng.calls).toHaveLength(0)
  })
})

describe('closeup decision', () => {
  it('tiers: sure from 0.85, ask below it while accepted, none otherwise', () => {
    expect(SURE_SCORE).toBe(0.85)
    expect(tierOf(0.85, true)).toBe('sure')
    expect(tierOf(0.9, true)).toBe('sure')
    expect(tierOf(0.84, true)).toBe('ask')
    expect(tierOf(0.4, true)).toBe('ask')
    expect(tierOf(0.39, true)).toBe('none')
    expect(tierOf(0.99, false)).toBe('none')
  })

  it('didYouMean ranks by similarity to the top candidates and cuts off weak matches', () => {
    const titles = ['Stranger Things', 'The Stranger', 'Strange World', 'Squid Game', 'Money Heist']
    expect(didYouMean(['Stranger Thngs'], titles)[0]).toBe('Stranger Things')
    expect(didYouMean(['Stranger Thngs'], titles)).not.toContain('Money Heist')
    expect(didYouMean(['Zzzzzz'], titles)).toEqual([])
    expect(didYouMean(['Stranger Thngs'], titles, 1)).toHaveLength(1)
  })

  const reading = (candidates: string[], scores: number[], literal = candidates[0] ?? '') => ({ candidates, scores, literal, raw: '', located: null, passes: 4, stage: 1 as const, passWords: [], ms: 1 })

  it('a sure accepted title shows the rating, with what was read', () => {
    const o = decideCloseup(reading(['Stranger Things'], [0.93], 'STRANGER THINGS'), { kind: 'accept', title: 'Stranger Things', source: 'vocab' }, ['Stranger Things', 'Stranger Thing'])
    expect(o).toMatchObject({ tier: 'sure', title: 'Stranger Things', readAs: 'STRANGER THINGS' })
    expect(o.chips).toEqual(['Stranger Thing']) // what "Not this one" offers
  })

  it('a weaker accepted title asks "Is this X?" and offers alternatives', () => {
    const o = decideCloseup(reading(['Stranger Things'], [0.6]), { kind: 'accept', title: 'Stranger Things', source: 'vocab' }, ['Stranger Things', 'Stranger Thing'])
    expect(o.tier).toBe('ask')
    expect(o.title).toBe('Stranger Things')
    expect(o.chips).toEqual(['Stranger Thing'])
  })

  it('an accept the candidates do not echo is sure only when the passes agree', () => {
    const acc = { kind: 'accept' as const, title: 'Dune', source: 'vocab' as const }
    expect(decideCloseup(reading(['Dnne'], [0.9]), acc, [], 3).tier).toBe('sure')
    expect(decideCloseup(reading(['Dnne'], [0.9]), acc, [], 1).tier).toBe('ask')
  })

  it('no accept: did-you-mean chips (decision chips first), never more than three', () => {
    const o = decideCloseup(
      reading(['Money Heis'], [0.5]),
      { kind: 'suggest', chips: [{ title: 'Money Heist', source: 'vocab' }, { title: 'Money Heist: Korea', source: 'vocab' }] },
      ['Money Heist', 'Money Heist: Korea', 'Money Monster', 'Monk'],
    )
    expect(o.tier).toBe('none')
    expect(o.title).toBeNull()
    expect(o.chips.slice(0, 2)).toEqual(['Money Heist', 'Money Heist: Korea'])
    expect(o.chips.length).toBeLessThanOrEqual(3)
    expect(decideCloseup(reading([], []), { kind: 'reject', reason: 'no-text' }, ['Dune']).chips).toEqual([])
  })
})

describe('closeup capture', () => {
  const stage = { w: 400, h: 600 }

  it('the reticle is a centred 16:9 box at 70% of the stage width', () => {
    const r = reticleRect(stage)
    expect(r.w).toBeCloseTo(280)
    expect(r.w / r.h).toBeCloseTo(16 / 9)
    expect(r.x + r.w / 2).toBeCloseTo(200)
    expect(r.y + r.h / 2).toBeCloseTo(300)
  })

  it('the crop adds a margin and stays inside the stage', () => {
    const c = cropRectWithMargin({ x: 60, y: 200, w: 280, h: 157.5 }, 0.08, stage)
    expect(c.w).toBeCloseTo(280 * 1.16)
    expect(c.x).toBeCloseTo(60 - 22.4)
    const edge = cropRectWithMargin({ x: 0, y: 0, w: 400, h: 225 }, 0.08, stage)
    expect(edge.x).toBe(0)
    expect(edge.x + edge.w).toBe(400)
    expect(edge.y).toBe(0)
  })

  it('keeps the sharpest crops, sharpest first', () => {
    const mk = (blur: number) => {
      const wdt = 160
      const data = new Uint8ClampedArray(wdt * 90 * 4)
      for (let y = 0; y < 90; y++) for (let x = 0; x < wdt; x++) {
        let s = 0
        for (let d = -blur; d <= blur; d++) s += Math.floor(Math.min(wdt - 1, Math.max(0, x + d)) / 4) % 2 ? 230 : 25
        const o = (y * wdt + x) * 4
        data[o] = data[o + 1] = data[o + 2] = s / (2 * blur + 1)
        data[o + 3] = 255
      }
      return { data, width: wdt, height: 90 }
    }
    const crops = [mk(3), mk(0), mk(5), mk(1)]
    const picked = pickSharpest(crops, 2)
    expect(picked).toEqual([crops[1], crops[3]])
    expect(laplacianVariance(picked[0])).toBeGreaterThan(laplacianVariance(picked[1]))
    expect(pickSharpest([], 2)).toEqual([])
  })

  it('maps the reticle to camera pixels and picks the hint by that width', () => {
    const rect = reticleRect({ w: 400, h: 600 })
    const native = reticleNativeWidth(rect, { w: 400, h: 600 }, { w: 1080, h: 1920 })
    expect(native).toBeGreaterThan(400)
    expect(native).toBeLessThan(1080)
    expect(closeupHint(CLOSE_PX - 1, false)).toMatch(/move closer/i)
    expect(closeupHint(CLOSE_PX - 1, true)).toMatch(/zoom in/i)
    expect(closeupHint(CLOSE_PX, true)).toMatch(/little closer/i)
    expect(closeupHint(OK_PX, true)).toMatch(/hold steady/i)
    expect(closeupHint(0, false)).toMatch(/fit one card/i)
  })
})
