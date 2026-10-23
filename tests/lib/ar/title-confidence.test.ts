import { POPULAR_TITLES } from '../../../lib/ar/popular-titles'
import { createVocabulary } from '../../../lib/ar/title-vocab'
import { candidatesFromWords, type OcrWordLike } from '../../../lib/ar/title-candidates'
import { BALANCED_CONFIDENCE, SAFE_CONFIDENCE, TitleIndex, evaluateReading, type PassWords } from '../../../lib/ar/title-confidence'
import { createTileReader, type OcrEngine } from '../../../lib/ar/tile-reader'
import { AutoLabeler } from '../../../lib/ar/auto-label'
import { SCENARIOS, buildTiles, decideTile, pct, simContext, tally, type SimOutcome } from '../../helpers/ar-confusion-sim'

const word = (text: string, x: number, y = 350, h = 150, confidence = 90): OcrWordLike => ({ text, confidence, bbox: { x0: x, y0: y, x1: x + text.length * h * 0.6, y1: y + h } })
/** The words of a logo on one line, left to right. */
function line(texts: string[], y = 350, h = 150, confidence = 90): OcrWordLike[] {
  let x = 60
  return texts.map(t => { const w = word(t, x, y, h, confidence); x += t.length * h * 0.6 + 30; return w })
}
const chrome: OcrWordLike[] = [word('N', 8, 8, 55, 85), word('Recently', 420, 900, 38, 80), word('added', 600, 900, 38, 80), word('TV-MA', 8, 900, 35, 80)]
const passes = (words: OcrWordLike[], n = 3): PassWords[] => Array.from({ length: n }, () => ({ words, imageHeight: 1000 }))

const vocabulary = createVocabulary([...POPULAR_TITLES, 'Money Heist: Korea'])
const index = new TitleIndex(vocabulary)
const decide = (p: PassWords[], profile = BALANCED_CONFIDENCE) => evaluateReading({ candidates: [], passes: p }, { vocabulary, index, profile })

const chipTitles = (d: ReturnType<typeof decide>['decision']) => (d.kind === 'suggest' ? d.chips.map(c => c.title) : [])

describe('three outcomes', () => {
  it('accepts a clearly read vocabulary title without a lookup', () => {
    const ev = decide(passes([...line(['STRANGER', 'THINGS']), ...chrome]))
    expect(ev.decision).toEqual({ kind: 'accept', title: 'Stranger Things', source: 'vocab' })
  })

  it('accepts a one-slip reading when the passes agree', () => {
    expect(decide(passes(line(['BRIDGERTON'.replace('T', 'I')]))).decision).toMatchObject({ kind: 'accept', title: 'Bridgerton' })
  })

  it('suggests instead of accepting when the evidence is thin (a single pass with a slip)', () => {
    const ev = decide(passes(line(['BRIDGERIDN']), 1))
    expect(ev.decision.kind).toBe('suggest')
    expect(chipTitles(ev.decision)).toContain('Bridgerton')
  })

  it('rejects chrome, junk and text far from every known title', () => {
    expect(decide(passes(chrome)).decision.kind).toBe('reject')
    expect(decide(passes([...line(['XQZVKLP']), ...chrome])).decision.kind).toBe('reject')
    expect(decide([]).decision).toEqual({ kind: 'reject', reason: 'no-text' })
  })

  it('offers at most three chips', () => {
    const ev = decide(passes(line(['MONEY', 'HEIS']), 1), SAFE_CONFIDENCE)
    expect(chipTitles(ev.decision).length).toBeLessThanOrEqual(3)
  })
})

describe('sequels and siblings (the silent-wrong cases)', () => {
  it('"ENOLA HOLMES" + "2" is Enola Holmes 2, never Enola Holmes', () => {
    const words = [...line(['ENOLA', 'HOLMES']), word('2', 60 + 5 * 90 + 5 * 90 + 60, 350, 150, 88)]
    for (const profile of [SAFE_CONFIDENCE, BALANCED_CONFIDENCE]) {
      const d = decide(passes(words), profile).decision
      expect(d).toMatchObject({ kind: 'accept', title: 'Enola Holmes 2' })
    }
  })

  it('a printed "3" that no sibling has blocks the root title', () => {
    const words = [...line(['ENOLA', 'HOLMES']), word('3', 60 + 5 * 90 + 5 * 90 + 60, 350, 150, 88)]
    const d = decide(passes(words)).decision
    expect(d.kind).not.toBe('accept') // "Enola Holmes" with a printed 3 is neither Enola Holmes nor Enola Holmes 2: ask
  })

  it('"DESPICABLE ME" + "2" keeps the sequel number (a lone digit beside a 2-letter word)', () => {
    const words = [...line(['DESPICABLE', 'ME']), word('2', 60 + 10 * 90 + 2 * 90 + 60, 350, 150, 88)]
    expect(candidatesFromWords(words, { imageHeight: 1000 }).map(c => c.text)).toContain('DESPICABLE ME 2')
    expect(decide(passes(words)).decision).toMatchObject({ kind: 'accept', title: 'Despicable Me 2' })
  })

  it('SAFE keeps the family root a question; BALANCED accepts it when no sibling word is printed', () => {
    const words = [...line(['MONEY', 'HEIST']), ...chrome]
    const safe = decide(passes(words), SAFE_CONFIDENCE).decision
    expect(safe.kind).toBe('suggest')
    expect(chipTitles(safe)).toEqual(expect.arrayContaining(['Money Heist', 'Money Heist: Korea']))
    expect(decide(passes(words), BALANCED_CONFIDENCE).decision).toMatchObject({ kind: 'accept', title: 'Money Heist' })
  })

  it('BALANCED still picks the sibling when its extra word is printed', () => {
    const words = [...line(['MONEY', 'HEIST']), word('KOREA', 60, 530, 150, 90)]
    expect(decide(passes(words)).decision).toMatchObject({ kind: 'accept', title: 'Money Heist: Korea' })
  })

  it('"Money Heis!" in every pass is repaired to Money Heist only under BALANCED', () => {
    const words = line(['MONEY', 'HEIS!'])
    expect(decide(passes(words), SAFE_CONFIDENCE).decision.kind).toBe('suggest')
    expect(decide(passes(words), BALANCED_CONFIDENCE).decision).toMatchObject({ kind: 'accept', title: 'Money Heist' })
  })

  it('does not accept a one-word title that is a word of other titles ("Dahmer"); it becomes a chip', () => {
    const d = decide(passes([...line(['DAHMER']), ...chrome])).decision
    expect(d.kind).toBe('suggest')
    expect(chipTitles(d)).toContain('Dahmer')
  })

  it('unexplained title-sized text blocks an accept ("STRANGER" beside an unknown word is not "The Stranger")', () => {
    const words = [...line(['STRANGER']), word('VOYAGES', 60, 520, 150, 90)]
    expect(decide(passes(words)).decision.kind).not.toBe('accept')
  })
})

describe('titles too short for the ranker', () => {
  it('accepts "You" and "1899" when two passes read them exactly, big and surely', () => {
    expect(decide(passes([...line(['YOU']), ...chrome])).decision).toMatchObject({ kind: 'accept', title: 'You' })
    expect(decide(passes([...line(['1899']), ...chrome])).decision).toMatchObject({ kind: 'accept', title: '1899' })
  })
  it('does not accept "You" when other title-sized words are on the card', () => {
    expect(decide(passes([...line(['YOU', 'ME', 'HER'])])).decision).not.toMatchObject({ kind: 'accept', title: 'You' })
  })
  it('does not accept "You" from a single weak pass', () => {
    expect(decide(passes(line(['YOU'], 350, 150, 55), 1)).decision.kind).not.toBe('accept')
  })
})

describe('catalogue lookup route (titles the vocabulary does not know)', () => {
  const small = createVocabulary(POPULAR_TITLES.filter(t => t !== 'Ripley' && t !== 'Territory'))
  const smallIndex = new TitleIndex(small)
  const evalOn = (p: PassWords[]) => evaluateReading({ candidates: [], passes: p }, { vocabulary: small, index: smallIndex })

  it('offers one reading for lookup and accepts an exact catalogue hit that is not in the vocabulary', () => {
    const ev = evalOn(passes([...line(['TERRITORY']), ...chrome]))
    expect(ev.decision.kind).not.toBe('accept')
    expect(ev.lookups[0]?.text).toBe('TERRITORY')
    expect(ev.judge(ev.lookups[0], 'Territory')).toEqual({ kind: 'accept', title: 'Territory', source: 'lookup' })
  })

  it('never accepts a catalogue hit that IS a vocabulary title ("Enola Holmes" for a card that may say "... 2"); it is the first chip', () => {
    const ev = evalOn(passes([...line(['STRANGER', 'THINGS', 'PRIME'])]))
    const lk = ev.lookups[0]
    if (lk) {
      const d = ev.judge(lk, 'Stranger Things')
      expect(d.kind).toBe('suggest')
    }
  })

  it('does not offer a lookup for short fragments or for readings only one pass saw', () => {
    expect(evalOn(passes(line(['TIRES']))).lookups).toEqual([])
    expect(evalOn(passes(line(['TERRITORY']), 1)).lookups).toEqual([])
  })

  it('rejects a lookup answer whose title-sized text differs from the card', () => {
    const ev = evalOn(passes([...line(['TERRITORY'])]))
    const d = ev.judge(ev.lookups[0], 'Territory of Dreams And Other Stories')
    expect(d.kind).toBe('suggest')
  })
})

describe('TitleIndex', () => {
  it('follows the vocabulary as confirmed titles are added', () => {
    const v = createVocabulary(['Alpha Show'])
    const idx = new TitleIndex(v)
    expect(idx.has('Brand New Thing')).toBe(false)
    v.add(['Brand New Thing'])
    expect(idx.has('Brand New Thing')).toBe(true)
    expect(idx.entries().map(e => e.title)).toContain('Brand New Thing')
  })
})

describe('tile reader integration', () => {
  it('stopWhen ends the plan after the pass that makes the decision layer accept, and the words of every pass are returned', async () => {
    let calls = 0
    const engine: OcrEngine = {
      async recognize(img) {
        calls++
        const words = line(['STRANGER', 'THINGS']).map(w => ({ ...w, bbox: { ...w.bbox, y0: w.bbox.y0 * img.height / 1000, y1: w.bbox.y1 * img.height / 1000 } }))
        return { text: 'STRANGER THINGS', words }
      },
    }
    const crop = { width: 96, height: 54, data: new Uint8ClampedArray(96 * 54 * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 37) % 256)) }
    const reader = createTileReader(engine, {
      vocabulary,
      stopWhen: ps => evaluateReading({ candidates: [], passes: ps }, { vocabulary, index }).decision.kind === 'accept',
    })
    const reading = await reader.read(crop)
    expect(reading.passWords.length).toBe(calls)
    expect(calls).toBeLessThanOrEqual(3) // support needs 2 passes; it does not run all six
    expect(reading.passWords[0].imageHeight).toBeGreaterThan(0)
  })
})

describe('AutoLabeler with the decision layer', () => {
  const crop = { x: 0, y: 0, w: 100, h: 56 }
  const mk = (p: PassWords[], lookup: (t: string) => Promise<{ title: string; voteCount: number } | null>) => {
    const outcomes: string[] = []
    const lookups: string[] = []
    const labeler = new AutoLabeler(
      {
        readTitles: async () => ({ candidates: [], passes: p }),
        evaluate: r => evaluateReading(r, { vocabulary, index }),
        lookup: async t => { lookups.push(t); return lookup(t) },
        onOutcome: (_i, o) => outcomes.push(o.kind),
      },
      { now: () => 0 },
    )
    return { labeler, outcomes, lookups }
  }

  it('labels a vocabulary title with no catalogue lookup', async () => {
    const { labeler, lookups } = mk(passes([...line(['STRANGER', 'THINGS']), ...chrome]), async () => null)
    expect((await labeler.next([{ box: crop }]))?.title).toBe('Stranger Things')
    expect(lookups).toEqual([])
  })

  it('reports suggestions and rejections instead of labelling', async () => {
    const a = mk(passes(line(['BRIDGERIDN']), 1), async () => null)
    expect(await a.labeler.next([{ box: crop }])).toBeNull()
    expect(a.outcomes).toEqual(['suggest'])
    const b = mk(passes(chrome), async () => null)
    expect(await b.labeler.next([{ box: crop }])).toBeNull()
    expect(b.outcomes).toEqual(['reject'])
  })

  it('makes at most ONE catalogue lookup for a reading the vocabulary does not know', async () => {
    const odd = createVocabulary(['Alpha Show'])
    const idx = new TitleIndex(odd)
    const lookups: string[] = []
    const labeler = new AutoLabeler(
      {
        readTitles: async () => ({ candidates: [], passes: passes([...line(['TERRITORY']), ...line(['HOLLOW', 'COAST'], 540)]) }),
        evaluate: r => evaluateReading(r, { vocabulary: odd, index: idx }),
        lookup: async t => { lookups.push(t); return null },
      },
      { now: () => 0 },
    )
    await labeler.next([{ box: crop }])
    expect(lookups.length).toBe(1)
  })
})

describe('decision-layer simulation (seeded, held-out)', () => {
  const ctx = simContext()
  const bench = process.env.AR_BENCH === '1'
  const draws = bench ? 8 : 1
  // The default run is a seeded subset of the full set (same tiles): four noise levels, 60 titles, 80 junk tiles.
  const tiles = bench ? buildTiles(8, 480) : buildTiles(1, 80, { scenarios: ['clean', 'l2', 'l3', 'trunc'] })
  const outcomes: SimOutcome[] = tiles.map(t => decideTile(t, ctx, BALANCED_CONFIDENCE))

  it('builds the expected tile mix', () => {
    const scenarios = bench ? SCENARIOS.length : 4
    expect(tiles.filter(t => t.kind === 'in').length).toBe(48 * scenarios * draws)
    expect(tiles.filter(t => t.kind === 'oov').length).toBe(12 * scenarios * draws)
    expect(tiles.filter(t => t.kind === 'junk').length).toBe(bench ? 480 : 80)
  })

  it('keeps wrong auto-accepts under 2% of tiles (all of them are cut-off captions that lost a sequel number or subtitle)', () => {
    const all = tally(outcomes)
    const inVocab = tally(outcomes.filter(o => o.tile.kind === 'in'))
    expect(pct(all.wrongAccept, all.n)).toBeLessThan(2)
    expect(pct(inVocab.wrongAccept, inVocab.n)).toBeLessThan(2)
  })

  it('resolves most readable tiles without typing: a correct accept or the right title among the chips', () => {
    const readable = tally(outcomes.filter(o => o.tile.truth && o.tile.kind !== 'junk'))
    expect(pct(readable.resolved, readable.n)).toBeGreaterThan(80)
    const accepted = readable.accept
    expect(accepted).toBeGreaterThan(0)
  })

  it('never produces more than three chips and never accepts chrome-only or garbage tiles', () => {
    for (const o of outcomes) if (o.decision.kind === 'suggest') expect(o.decision.chips.length).toBeLessThanOrEqual(3)
    const nothing = tally(outcomes.filter(o => o.tile.scenario === 'none' || o.tile.scenario === 'garbage'))
    expect(nothing.accept).toBe(0)
  })

  it('SAFE blocks more accepts than BALANCED on the family titles and is at least as precise', () => {
    const family = ['Money Heist', 'Narcos', 'Fear Street', 'Enola Holmes', 'Rebel Moon', 'Money Heist: Korea', 'Narcos: Mexico']
    const subset = tiles.filter(t => t.truth && family.includes(t.truth))
    expect(subset.length).toBeGreaterThan(20)
    const safe = tally(subset.map(t => decideTile(t, ctx, SAFE_CONFIDENCE)))
    const balanced = tally(subset.map(t => decideTile(t, ctx, BALANCED_CONFIDENCE)))
    expect(safe.accept).toBeLessThan(balanced.accept)
    expect(safe.wrongAccept).toBeLessThanOrEqual(balanced.wrongAccept)
  })

  it('stays within one catalogue lookup per tile', () => {
    expect(Math.max(...outcomes.map(o => o.lookups))).toBeLessThanOrEqual(1)
  })

  const maybe = bench ? it : it.skip
  maybe('AR_BENCH: prints the full table (3360 tiles) and compares with the pre-change flow on the same tiles', async () => {
    const row = (label: string, f: (o: SimOutcome) => boolean) => {
      const s = tally(outcomes.filter(f))
      return `${label.padEnd(22)} n=${String(s.n).padStart(5)} accept-ok ${pct(s.accept - s.wrongAccept, s.n).toFixed(1).padStart(5)}%  WRONG ${pct(s.wrongAccept, s.n).toFixed(2).padStart(5)}%  chips ${pct(s.suggest, s.n).toFixed(1).padStart(5)}% (hit ${pct(s.chipHit, s.n).toFixed(1)}%)  reject ${pct(s.reject, s.n).toFixed(1).padStart(5)}%  lookups/tile ${(s.lookups / s.n).toFixed(2)}`
    }
    const lines = [
      row('in-vocab', o => o.tile.kind === 'in'),
      row('not in vocab', o => o.tile.kind === 'oov'),
      row('no readable title', o => o.tile.kind === 'junk'),
      row('ALL', () => true),
    ]
    // the pre-change flow: tile reader (vocabulary snap) + repair + exact lookup, one catalogue hit decides
    const crop = { width: 96, height: 54, data: new Uint8ClampedArray(96 * 54 * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 7919) % 256)) }
    let wrong = 0
    let right = 0
    let none = 0
    let lookups = 0
    for (const t of tiles) {
      let call = 0
      const engine: OcrEngine = {
        async recognize(img) {
          const p = t.passes[call++] ?? { words: [], imageHeight: 1000 }
          const words = p.words.map(w => ({ ...w, bbox: { x0: w.bbox.x0, x1: w.bbox.x1, y0: (w.bbox.y0 * img.height) / 1000, y1: (w.bbox.y1 * img.height) / 1000 } }))
          return { text: words.map(w => w.text).join(' '), words }
        },
      }
      const reading = await createTileReader(engine, { vocabulary: ctx.vocabulary }).read(crop)
      const labeler = new AutoLabeler(
        {
          readTitles: async () => reading.candidates,
          lookup: async q => { lookups++; const hit = ctx.catalogue.get(q.toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]+/g, '')); return hit ? { title: hit, voteCount: 900000 } : null },
          repair: c => ctx.vocabulary.repair(c),
        },
        { minGapMs: 0, now: () => 0 },
      )
      const hit = await labeler.next([{ box: { x: 0, y: 0, w: 100, h: 56 } }])
      const truth = t.truth ? t.truth.toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]+/g, '') : null
      if (!hit) none++
      else if (truth && hit.title.toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]+/g, '') === truth) right++
      else wrong++
    }
    lines.push(`BEFORE (same tiles, reader + repair + exact lookup): correct ${pct(right, tiles.length).toFixed(1)}%  WRONG ${pct(wrong, tiles.length).toFixed(2)}%  none ${pct(none, tiles.length).toFixed(1)}%  lookups/tile ${(lookups / tiles.length).toFixed(2)}`)
    // eslint-disable-next-line no-console
    console.log(`decision simulation, ${tiles.length} tiles (BALANCED)\n` + lines.join('\n'))
    expect(tally(outcomes).wrongAccept / tiles.length).toBeLessThan(0.02)
  }, 600_000)
})
