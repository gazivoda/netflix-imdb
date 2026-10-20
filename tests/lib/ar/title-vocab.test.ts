import { createVocabulary, tokensFromWords } from '../../../lib/ar/title-vocab'
import { POPULAR_TITLES } from '../../../lib/ar/popular-titles'

const tok = (text: string, confidence = 90, height = 0.2, pass = 0) => ({ text, confidence, height, pass })
const titles = ['Virgin River', 'The Umbrella Academy', 'Narcos', 'Narcos: Mexico', 'The Crown', 'Dark', 'You', 'Formula 1: Drive to Survive', '3 Body Problem']
const vocab = createVocabulary(titles)
const best = (tokens: ReturnType<typeof tok>[]) => vocab.match(tokens)[0]?.title

describe('createVocabulary.match', () => {
  it('finds a title from words that were read on different lines or passes', () => {
    expect(best([tok('virgin'), tok('river', 85, 0.2, 1)])).toBe('Virgin River')
  })

  it('forgives one slip per word and a cut-off word', () => {
    expect(best([tok('virgan'), tok('rlver')])).toBe('Virgin River')
    expect(best([tok('3'), tok('body'), tok('probl')])).toBe('3 Body Problem')
  })

  it('ignores a leading article when matching', () => {
    expect(best([tok('umbrella'), tok('academy')])).toBe('The Umbrella Academy')
  })

  it('needs most of the title: one word of a long title is not enough', () => {
    expect(best([tok('academy')])).toBeUndefined()
    expect(best([tok('drive')])).toBeUndefined()
  })

  it('needs 60% of the title letters even when two words match', () => {
    const v = createVocabulary(['Alpha Bravo Charlie Delta'])
    expect(v.match([tok('alpha'), tok('bravo')])).toEqual([])
    expect(v.match([tok('alpha'), tok('bravo'), tok('charlie')])[0].title).toBe('Alpha Bravo Charlie Delta')
  })

  it('requires numbers and initials of the title to be seen ("Murder Mystery" is not "Murder Mystery 2")', () => {
    const v = createVocabulary(['Murder Mystery 2', 'Anne with an E'])
    expect(v.match([tok('murder'), tok('mystery')])).toEqual([])
    expect(v.match([tok('anne')])).toEqual([])
    expect(v.match([tok('murder'), tok('mystery'), tok('2')])[0].title).toBe('Murder Mystery 2')
  })

  it('does not accept a different film that merely resembles the words', () => {
    expect(best([tok('virgin'), tok('mobile')])).toBeUndefined()
  })

  it('ignores text that is small print (credits, dates) when the title is a short common word', () => {
    expect(best([tok('dark', 95, 0.03, 0), tok('dark', 95, 0.03, 1)])).toBeUndefined()
  })

  it('accepts a short one-word title only when it is exact, big, confident and seen by two passes', () => {
    expect(best([tok('dark', 95, 0.2, 0), tok('dark', 95, 0.2, 1)])).toBe('Dark')
    expect(best([tok('dark', 95, 0.2, 0)])).toBeUndefined() // one pass only
    expect(best([tok('darl', 95, 0.2, 0), tok('darl', 95, 0.2, 1)])).toBeUndefined() // typo
    expect(best([tok('dark', 50, 0.2, 0), tok('dark', 50, 0.2, 1)])).toBeUndefined() // low confidence
    expect(best([tok('you', 95, 0.02, 0), tok('you', 95, 0.02, 1)])).toBeUndefined() // small print
  })

  it('prefers the full family title when both a title and its longer sibling are known', () => {
    expect(best([tok('narcos'), tok('mexico', 88)])).toBe('Narcos: Mexico')
    expect(best([tok('narcos', 90, 0.2, 0), tok('narcos', 90, 0.2, 1)])).toBe('Narcos')
    expect(best([tok('narcos')])).toBeUndefined() // a one-word title seen by a single pass
  })

  it('returns nothing when two unrelated titles tie', () => {
    const v = createVocabulary(['Red Notice', 'Red Dawn'])
    expect(v.match([tok('red')])).toEqual([])
  })

  it('can learn titles later and ignores duplicates', () => {
    const v = createVocabulary(['Okja'])
    v.add(['Okja', 'Roma', 'okja!'])
    expect(v.size).toBe(2)
  })
})

describe('tokensFromWords', () => {
  it('lower-cases, strips glyph junk, drops specks and low confidence, and sizes relative to the image', () => {
    const t = tokensFromWords([
      { text: 'RIVER.', confidence: 80, bbox: { x0: 0, y0: 0, x1: 10, y1: 20 } },
      { text: '|', confidence: 90, bbox: { x0: 0, y0: 0, x1: 2, y1: 20 } },
      { text: 'junk', confidence: 10, bbox: { x0: 0, y0: 0, x1: 2, y1: 20 } },
    ], 100, 3)
    expect(t).toEqual([{ text: 'river', confidence: 80, height: 0.2, pass: 3 }])
  })
})

describe('POPULAR_TITLES', () => {
  it('is a clean list: no blanks, no duplicates ignoring case and punctuation', () => {
    const keys = POPULAR_TITLES.map(t => t.toLowerCase().replace(/[^a-z0-9]+/g, ''))
    expect(keys.every(Boolean)).toBe(true)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
