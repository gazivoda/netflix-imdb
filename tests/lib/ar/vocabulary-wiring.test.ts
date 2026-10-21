import { POPULAR_TITLES } from '../../../lib/ar/popular-titles'
import { buildVocabulary, addConfirmed, clearConfirmed, loadConfirmed, CONFIRMED_KEY, CONFIRMED_MAX } from '../../../lib/ar/confirmed-titles'
import { createVocabulary, tokensFromWords } from '../../../lib/ar/title-vocab'
import { candidatesFromWords, isUiText } from '../../../lib/ar/title-candidates'
import { AutoLabeler, acceptsTitle } from '../../../lib/ar/auto-label'
import { createTileReader } from '../../../lib/ar/tile-reader'
import type { KeyValueStore } from '../../../lib/ar/enrol-store'

const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: k => void data.delete(k) }
}

const word = (text: string, x: number, y = 100, h = 60, confidence = 90) => ({ text, confidence, bbox: { x0: x, y0: y, x1: x + text.length * 36, y1: y + h } })

describe('POPULAR_TITLES', () => {
  it('is a large list without duplicates', () => {
    expect(POPULAR_TITLES.length).toBeGreaterThanOrEqual(800)
    const keys = POPULAR_TITLES.map(keyOf)
    expect(new Set(keys).size).toBe(keys.length)
    expect(POPULAR_TITLES.every(t => t === t.trim() && t.length >= 3 && t.length <= 80)).toBe(true)
  })

  it('keeps sequels and numeric titles with their numbers', () => {
    for (const t of ['Extraction 2', 'Enola Holmes 2', '3 Body Problem', '1899', 'Murder Mystery 2', 'The Kissing Booth 3']) expect(POPULAR_TITLES).toContain(t)
  })
})

describe('vocabulary typo repair', () => {
  const vocab = buildVocabulary(memoryStore())

  it('snaps a one or two character OCR slip onto the real title', () => {
    expect(vocab.repair('Money Heis!')).toBe('Money Heist')
    expect(vocab.repair('Stranger Thngs')).toBe('Stranger Things')
    expect(vocab.repair('Breakmg Bad')).toBe('Breaking Bad')
    expect(vocab.repair('THE UMBRELLA ACADEMV')).toBe('The Umbrella Academy')
    expect(vocab.repair('Bridgerlon')).toBe('Bridgerton')
  })

  it('leaves a correct title alone and ignores a missing article', () => {
    expect(vocab.repair('Squid Game')).toBe('Squid Game')
    expect(vocab.repair('Crown')).toBe('The Crown')
  })

  it('never repairs across a different number: a sequel is another film', () => {
    expect(vocab.repair('Extraction 2')).toBe('Extraction 2')
    expect(vocab.repair('Extraction 3')).toBeNull()
    expect(vocab.repair('Extraction')).toBe('Extraction')
    expect(vocab.repair('Enola Holmes 2')).toBe('Enola Holmes 2')
  })

  it('does not repair short words (every short word is a word)', () => {
    expect(vocab.repair('Dork')).toBeNull()
    expect(vocab.repair('Yoo')).toBeNull()
  })

  it('does not turn a fragment into a longer title unless it is a long cut-off caption', () => {
    expect(vocab.repair('Money')).toBeNull()
    expect(vocab.repair('All Quiet on the West')).toBe('All Quiet on the Western Front')
  })

  it('returns nothing when two different titles are equally close', () => {
    const v = createVocabulary(['Alpha Beta Gamma', 'Alpha Beta Gammo'])
    expect(v.repair('Alpha Beta Gammx')).toBeNull()
  })

  it('repairs about nine in ten titles after one random slip, and stays quiet for every UI string', () => {
    let seed = 7
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
    let n = 0
    let fixed = 0
    let wrong = 0
    for (const title of POPULAR_TITLES.filter(t => keyOf(t).length >= 8)) {
      const chars = [...title]
      const i = 1 + Math.floor(rnd() * (chars.length - 2))
      if (!/[a-z]/i.test(chars[i])) continue
      chars[i] = rnd() < 0.5 ? 'x' : ''
      const got = vocab.repair(chars.join(''))
      n++
      if (got && keyOf(got) === keyOf(title)) fixed++
      else if (got) wrong++
    }
    expect(fixed / n).toBeGreaterThan(0.9)
    expect(wrong / n).toBeLessThan(0.02)
  })
})

// Strings that appear on a Netflix screen or a TV and are not the title of the card under the lens.
const NOT_TITLES = [
  'Continue Watching', 'Because you watched', 'Top 10 in the US Today', 'Trending Now', 'Popular on Netflix', 'My List', 'New Releases', 'Coming Soon',
  'Play', 'More Info', 'Remind Me', 'Episode 3', 'Season 2', 'Limited Series', 'Recently Added', 'TV-MA', 'TV-14', 'PG-13', '98 Match',
  'Audio and Subtitles', 'Skip Intro', 'Next Episode', 'Watch Again', 'Kids', 'Account', 'Help Center', 'Sign Out', 'Search', 'Browse by Languages',
  'Top Picks for You', 'Only on Netflix', 'Available now', 'Resume', 'Download', 'Netflix Originals', 'Documentaries', 'Award-Winning Series',
  'Monday evening', 'Subscribe now', 'Press play', 'Volume up', 'Living room', 'Samsung Smart TV', 'Remote control', 'Settings', 'Full screen',
  'Add to My List', 'Rate this', 'Share', 'Previews', 'Because you liked', 'Hit TV Shows', 'Exciting Movies', 'Family Time', 'Made in Brazil',
  'Starring Idris Elba', 'Directed by', 'Watch Now', 'Days left', 'A Netflix Original Series', 'New Episodes Every Week', 'Leaving Soon', 'Just Added',
  'Wild Animals', 'Fresh Fruit', 'Coffee Break', 'Summer Sale', 'Open Source', 'Winter Break', 'Silent Night Shift',
]

describe('wrong snaps stay rare', () => {
  const vocab = buildVocabulary(memoryStore())

  it('repair() does not turn a different title that merely shares most of its words into a vocabulary title', () => {
    expect(vocab.repair('Midnight Run Club')).toBeNull() // "The Midnight Club" with a whole extra word
  })

  it('repair() does not turn any of the non-title UI strings into a title', () => {
    const snapped = NOT_TITLES.map(t => ({ t, got: vocab.repair(t) })).filter(x => x.got && !isUiText(x.t))
    expect(snapped).toEqual([])
  })

  it('match() on tokens read from those strings finds no title', () => {
    const found: string[] = []
    for (const t of NOT_TITLES) {
      const words = t.split(' ').map((w, i) => word(w, 40 + i * 120, 120, 50))
      const m = vocab.match([...tokensFromWords(words, 360, 0), ...tokensFromWords(words, 360, 1)])
      if (m.length) found.push(`${t} -> ${m[0].title}`)
    }
    expect(found).toEqual([])
  })

  it('does not take the one word of a bigger title for a one-word title ("Stranger Things" is not "The Stranger")', () => {
    const v = createVocabulary(['The Stranger', 'Heist', 'Rebelde'])
    const read = (ws: [string, number][]) => {
      const words = ws.map(([w, x]) => word(w, x, 100, 70))
      return v.match([...tokensFromWords(words, 360, 0), ...tokensFromWords(words, 360, 1)])
    }
    expect(read([['STRANGER', 40], ['THINGS', 330]])).toEqual([])
    expect(read([['MONEY', 40], ['HEIST', 250]])).toEqual([])
    expect(read([['REBEL', 40], ['MOON', 250]])).toEqual([])
  })

  it('requires the exact number of a numbered title', () => {
    const v = createVocabulary(['Fear Street: Part Two - 1978'])
    const words = [word('FEAR', 40), word('STREET', 200), word('PART', 420), word('TWO', 600), word('1994', 700)]
    expect(v.match([...tokensFromWords(words, 360, 0), ...tokensFromWords(words, 360, 1)])).toEqual([])
  })
})

describe('the tile reader with the page vocabulary', () => {
  it('turns a slipped reading into the real title', async () => {
    const vocabulary = buildVocabulary(memoryStore())
    const engine = {
      recognize: async () => ({ text: 'MONEY HEIS!', words: [word('MONEY', 40, 120, 70, 88), word('HEIS!', 260, 120, 70, 80)] }),
    }
    const crop = { data: new Uint8ClampedArray(200 * 112 * 4).map((_, i) => (i % 4 === 3 ? 255 : (i >> 2) % 7 < 3 ? 20 : 235)), width: 200, height: 112 }
    const r = await createTileReader(engine, { vocabulary }).read(crop)
    expect(r.candidates).toContain('Money Heist')
  })
})

describe('AutoLabeler with a vocabulary', () => {
  const vocab = buildVocabulary(memoryStore())
  const catalogue = new Map([['moneyheist', 'Money Heist'], ['money', 'Money'], ['extraction', 'Extraction'], ['extraction2', 'Extraction 2'], ['rebelmoon', 'Rebel Moon']])
  function setup(read: string[]) {
    const lookups: string[] = []
    const labeler = new AutoLabeler(
      {
        readTitles: async () => read,
        lookup: async t => { lookups.push(t); const hit = catalogue.get(keyOf(t)); return hit ? { title: hit, voteCount: 500000 } : null },
        repair: c => vocab.repair(c),
      },
      { minGapMs: 0 },
    )
    return { labeler, lookups }
  }
  const card = { box: { x: 0, y: 0, w: 100, h: 56 } }

  it('asks the catalogue for the repaired title, not the OCR noise, and never for the fragment', async () => {
    const { labeler, lookups } = setup(['Money Heis!', 'Money'])
    expect((await labeler.next([card]))?.title).toBe('Money Heist')
    expect(lookups).toEqual(['Money Heist'])
  })

  it('spends no lookups on Netflix chrome', async () => {
    const { labeler, lookups } = setup(['TV-MA', 'Recently added', '98 Match', 'Season 2', 'New episodes'])
    expect(await labeler.next([card])).toBeNull()
    expect(lookups).toEqual([])
  })

  it('does not fall back to a prefix that drops the sequel number', async () => {
    const { labeler, lookups } = setup(['Extraction 2', 'Extraction'])
    // the longer reading is tried first; the catalogue knows it
    expect((await labeler.next([card]))?.title).toBe('Extraction 2')
    expect(lookups[0]).toBe('Extraction 2')
    const none = setup(['Extractian 2', 'Extractian'])
    // not in the vocabulary after repair? "Extractian 2" repairs to "Extraction 2"
    expect((await none.labeler.next([card]))?.title).toBe('Extraction 2')
  })

  it('does not label "Rebel Moon" for a longer reading it could not find', async () => {
    const { labeler, lookups } = setup(['Rebel Moon Part One A Child Of Fire', 'Rebel Moon'])
    expect(await labeler.next([card])).toBeNull()
    expect(lookups).toEqual(['Rebel Moon - Part One: A Child of Fire']) // the vocabulary spelling; the fragment "Rebel Moon" is never asked
  })

  it('still labels a one-word title the vocabulary knows when a longer reading is only junk beside it', async () => {
    const cat = new Map([['ozark', 'Ozark']])
    const labeler = new AutoLabeler(
      { readTitles: async () => ['OZARK FLL', 'Ozark'], lookup: async t => { const h = cat.get(keyOf(t)); return h ? { title: h, voteCount: 900000 } : null }, repair: c => vocab.repair(c) },
      { minGapMs: 0 },
    )
    expect((await labeler.next([card]))?.title).toBe('Ozark')
  })

  it('remembers a "not found" so a card that stays unreadable does not re-ask the catalogue every retry', async () => {
    let t = 0
    const lookups: string[] = []
    const labeler = new AutoLabeler(
      { readTitles: async () => ['Zzyzx Road Show'], lookup: async x => { lookups.push(x); return null } },
      { minGapMs: 0, retryMs: 1000, now: () => t },
    )
    await labeler.next([card])
    t += 5000
    await labeler.next([card])
    expect(lookups).toEqual(['Zzyzx Road Show'])
  })
})

describe('acceptsTitle digit guard', () => {
  it('refuses a read that lost the sequel number the catalogue title ends or starts with', () => {
    expect(acceptsTitle('Extraction', 'Extraction 2')).toBe(false)
    expect(acceptsTitle('Enola Holmes', 'Enola Holmes 2')).toBe(false)
    expect(acceptsTitle('Body Problem', '3 Body Problem')).toBe(false)
    expect(acceptsTitle('Extraction 2', 'Extraction 2')).toBe(true)
  })
})

describe('candidates keep the numbers of a title', () => {
  const texts = (ws: ReturnType<typeof word>[]) => candidatesFromWords(ws, { imageHeight: 360 }).map(c => c.text)
  it('keeps a sequel digit beside a word, and a leading digit', () => {
    expect(texts([word('EXTRACTION', 40), word('2', 420, 100, 60, 85)])[0]).toBe('EXTRACTION 2')
    expect(texts([word('3', 40, 100, 60, 85), word('BODY', 110), word('PROBLEM', 300)])[0]).toBe('3 BODY PROBLEM')
  })
  it('accepts a big four-digit title and refuses a small year badge', () => {
    expect(texts([word('1899', 40, 100, 80)])).toContain('1899')
    expect(texts([word('2024', 40, 300, 12)])).toEqual([])
    expect(texts([word('2025', 40, 100, 80)])).toEqual([])
  })
  it('keeps long titles whole (10 words, 60 characters)', () => {
    const t = 'REBEL MOON PART ONE A CHILD OF FIRE'.split(' ')
    const ws = t.map((w, i) => word(w, 20 + i * 130, 100, 40))
    expect(texts(ws)[0]).toBe('REBEL MOON PART ONE A CHILD OF FIRE')
  })
  it('does not strip ordinary title words that are also badges', () => {
    expect(texts([word('THE', 40), word('WATCH', 160)])).toContain('THE WATCH')
    expect(texts([word('MARCH', 40), word('OF', 230), word('THE', 300), word('PENGUINS', 400)])[0]).toBe('MARCH OF THE PENGUINS')
    expect(texts([word('MAY', 40), word('DECEMBER', 170)])[0]).toBe('MAY DECEMBER')
    expect(texts([word('AUGUST', 40), word('OSAGE', 270), word('COUNTY', 420)])[0]).toBe('AUGUST OSAGE COUNTY')
  })
  it('still strips badges: dates, seasons, maturity, match, recently added', () => {
    expect(texts([word('SQUID', 40), word('GAME', 230), word('SEASON', 420, 300, 20), word('2', 560, 300, 20)])).toContain('SQUID GAME')
    expect(texts([word('SQUID', 40), word('GAME', 230), word('JULY', 420, 300, 20), word('4', 560, 300, 20)])).toContain('SQUID GAME')
    for (const chrome of [['TV-MA'], ['TV-14', '16'], ['98', 'Match'], ['Recently', 'added'], ['PG-13'], ['New', 'episodes']]) {
      expect(texts(chrome.map((w, i) => word(w, 40 + i * 140, 300, 20)))).toEqual([])
    }
  })
})

describe('confirmed titles on the device', () => {
  it('remembers confirmed titles, most recent first, without duplicates', () => {
    const store = memoryStore()
    addConfirmed(store, { title: 'Zorblax Chronicles', year: '2031' })
    addConfirmed(store, { title: 'Quillfeather' })
    const list = addConfirmed(store, { title: 'ZORBLAX  chronicles' })
    expect(list.map(c => c.title)).toEqual(['ZORBLAX chronicles', 'Quillfeather'])
    expect(loadConfirmed(store).map(c => c.title)).toEqual(['ZORBLAX chronicles', 'Quillfeather'])
  })

  it('is capped, and the newest survive', () => {
    const store = memoryStore()
    for (let i = 0; i < CONFIRMED_MAX + 25; i++) addConfirmed(store, { title: `Title ${i} Alpha` })
    const list = loadConfirmed(store)
    expect(list).toHaveLength(CONFIRMED_MAX)
    expect(list[0].title).toBe(`Title ${CONFIRMED_MAX + 24} Alpha`)
  })

  it('feeds the next start: a title the catalogue confirmed once is repaired afterwards', () => {
    const store = memoryStore()
    expect(buildVocabulary(store).repair('Zorblax Chronicals')).toBeNull()
    addConfirmed(store, { title: 'Zorblax Chronicles' })
    expect(buildVocabulary(store).repair('Zorblax Chronicals')).toBe('Zorblax Chronicles')
  })

  it('survives corrupt JSON, wrong shapes, a throwing store and clearing', () => {
    const store = memoryStore()
    store.setItem(CONFIRMED_KEY, '{not json')
    expect(loadConfirmed(store)).toEqual([])
    store.setItem(CONFIRMED_KEY, JSON.stringify([{ title: 5 }, null, 'x', { title: '' }, { title: 'Ok Title' }]))
    expect(loadConfirmed(store).map(c => c.title)).toEqual(['Ok Title'])
    const broken: KeyValueStore = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') }, removeItem: () => { throw new Error('blocked') } }
    expect(loadConfirmed(broken)).toEqual([])
    expect(() => addConfirmed(broken, { title: 'Fine' })).not.toThrow()
    expect(() => clearConfirmed(broken)).not.toThrow()
    clearConfirmed(store)
    expect(loadConfirmed(store)).toEqual([])
  })
})
