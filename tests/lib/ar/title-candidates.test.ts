import { candidatesFromWords, cleanWord, mergeCandidates, normaliseCase, OcrWordLike } from '../../../lib/ar/title-candidates'

// A word of height 20 at (x, y) whose width follows its length.
const w = (text: string, x: number, y: number, confidence = 90, h = 20): OcrWordLike => ({
  text, confidence, bbox: { x0: x, y0: y, x1: x + 12 * text.length, y1: y + h },
})
const texts = (words: OcrWordLike[]) => candidatesFromWords(words).map(c => c.text)

describe('cleanWord', () => {
  it('strips glyph junk and edge punctuation, keeps inner apostrophes and digits', () => {
    expect(cleanWord('«GRAY»')).toBe('GRAY')
    expect(cleanWord('QUEEN\'S,')).toBe('QUEEN\'S')
    expect(cleanWord('|T')).toBe('IT')
    expect(cleanWord('1899')).toBe('1899')
    expect(cleanWord('---')).toBe('')
  })
})

describe('candidatesFromWords', () => {
  it('returns a text line as one candidate, with whole-line first', () => {
    const c = texts([w('THE', 0, 0), w('GRAY', 40, 0), w('MAN', 100, 0)])
    expect(c[0]).toBe('THE GRAY MAN')
    expect(c).toContain('GRAY MAN')
  })

  it('joins a title stacked on two lines', () => {
    const c = texts([w('GRAY', 0, 0, 90, 30), w('MAN', 10, 34, 90, 30)])
    expect(c).toContain('GRAY MAN')
  })

  it('does not join lines that are far apart vertically', () => {
    const c = texts([w('DARK', 0, 0), w('DECEMBER', 0, 200)])
    expect(c).not.toContain('DARK DECEMBER')
  })

  it('fuses spaced-out single letters into a word and drops stray specks', () => {
    const letters = ['D', 'A', 'R', 'K'].map((t, i) => w(t, i * 40, 0, 80))
    expect(texts([...letters, w('x', 300, 90, 80)])).toContain('DARK')
  })

  it('drops low-confidence words and glyph soup', () => {
    expect(texts([w('Fg', 0, 0, 20), w('sa', 40, 0, 15), w('~~##', 80, 0, 90)])).toEqual([])
  })

  it('drops Netflix chrome and marketing copy as whole candidates', () => {
    const c = texts([w('ONLY', 0, 0), w('ON', 60, 0), w('NETFLIX', 100, 0)])
    expect(c).not.toContain('ONLY ON NETFLIX')
    expect(c).not.toContain('NETFLIX')
    expect(texts([w('Home', 0, 0)])).toEqual([])
  })

  it('offers word runs so a title survives junk beside it', () => {
    const c = texts([w('NEW', 0, 0, 90, 8), w('SERIES', 50, 0, 90, 8), w('FORMULA', 140, 0), w('1', 260, 0, 90, 8)])
    expect(c).toContain('FORMULA')
  })

  it('treats marketing words (months, NETFLIX, EPISODES) as the end of a candidate, so no catalogue title is built from them', () => {
    const c = texts([w('DARK', 0, 0), w('ALL', 100, 0), w('EPISODES', 150, 0), w('DECEMBER', 270, 0), w('1', 400, 0)])
    expect(c).toContain('DARK ALL')
    expect(c.some(x => /episodes|december/i.test(x))).toBe(false)
    const d = texts([w('NETFLIX', 0, 0), w('APRIL', 100, 0)])
    expect(d).toEqual([])
  })

  it('emits a lone word only when nothing else of its size is on the tile (a lookup would answer "Gray" with some film called Gray)', () => {
    const stacked = texts([w('GRAY', 0, 0, 90, 40), w('MAN', 10, 44, 90, 40)])
    expect(stacked).toContain('GRAY MAN')
    expect(stacked).not.toContain('GRAY')
    expect(stacked).not.toContain('MAN')
    const logoWithSmallPrint = texts([w('OZARK', 0, 0, 90, 60), w('SEASON', 0, 100, 90, 8), w('FIVE', 80, 100, 90, 8)])
    expect(logoWithSmallPrint).toContain('OZARK')
  })

  it('ranks big text above small print when the image height is known', () => {
    const words = [w('TIGER', 0, 0, 90, 60), w('KING', 150, 0, 90, 60), w('SOMEONE', 0, 200, 90, 8), w('FAMOUS', 90, 200, 90, 8)]
    const c = candidatesFromWords(words, { imageHeight: 300 })
    expect(c[0].text).toBe('TIGER KING')
    const flat = candidatesFromWords(words, { imageHeight: 300, sizeWeight: 0 })
    expect(flat.find(x => x.text === 'SOMEONE FAMOUS')!.score).toBeGreaterThan(c.find(x => x.text === 'SOMEONE FAMOUS')!.score)
  })

  it('ranks a confident wordlike line above a shaky consonant soup', () => {
    const c = candidatesFromWords([w('TIGER', 0, 0, 92), w('KING', 80, 0, 92), w('XQZPTRK', 0, 100, 55)])
    expect(c[0].text).toBe('TIGER KING')
  })

  it('splits two captions on the same row instead of reading them as one title', () => {
    const words = [w('Roma', 0, 0), w('Okja', 400, 0)]
    const c = candidatesFromWords(words, { isolateSingles: false }).map(x => x.text)
    expect(c).toEqual(expect.arrayContaining(['Roma', 'Okja']))
    expect(c).not.toContain('Roma Okja')
    // by default two equally big lone words are fragments of something, not titles
    expect(texts(words)).toEqual([])
  })
})

describe('mergeCandidates', () => {
  it('counts agreeing passes (case / spacing blind) and raises the score for them', () => {
    const a = candidatesFromWords([w('FORMULA', 0, 0, 60)])
    const b = candidatesFromWords([w('Formula', 0, 0, 62)])
    const merged = mergeCandidates([a, b])
    expect(merged).toHaveLength(1)
    expect(merged[0].support).toBe(2)
    expect(merged[0].score).toBeGreaterThan(a[0].score)
  })

  it('does not double count one pass that lists the same text twice', () => {
    const c = candidatesFromWords([w('TIGER', 0, 0), w('KING', 80, 0)])
    expect(mergeCandidates([[...c, ...c]]).every(x => x.support === 1)).toBe(true)
  })
})

describe('normaliseCase', () => {
  it('title-cases all-caps text and leaves mixed case alone', () => {
    expect(normaliseCase('THE GRAY MAN')).toBe('The Gray Man')
    expect(normaliseCase('Formula 1: Drive to Survive')).toBe('Formula 1: Drive to Survive')
    expect(normaliseCase('1899')).toBe('1899')
  })
})
