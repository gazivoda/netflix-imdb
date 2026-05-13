import { extractMovieTitles } from '../../lib/extract-titles'

type MockWord = {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

function word(text: string, confidence: number, y0 = 100, x0 = 0): MockWord {
  return { text, confidence, bbox: { x0, y0, x1: x0 + 80, y1: y0 + 20 } }
}

describe('extractMovieTitles', () => {
  it('returns empty array when given no words', () => {
    expect(extractMovieTitles([])).toEqual([])
  })

  it('filters out words with confidence <= 60', () => {
    expect(extractMovieTitles([word('Inception', 60)] as any)).toHaveLength(0)
  })

  it('includes words with confidence > 60', () => {
    const result = extractMovieTitles([word('Inception', 61)] as any)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Inception')
  })

  it('groups words within 20px y into the same line', () => {
    const words = [
      word('Breaking', 80, 100, 0),
      word('Bad', 80, 115, 90),
    ]
    const result = extractMovieTitles(words as any)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Breaking Bad')
  })

  it('splits words more than 20px apart into separate lines', () => {
    const words = [
      word('Inception', 80, 100),
      word('Avatar', 80, 200),
    ]
    expect(extractMovieTitles(words as any)).toHaveLength(2)
  })

  it('filters out UI exclusion words', () => {
    expect(extractMovieTitles([word('Home', 90)] as any)).toHaveLength(0)
    expect(extractMovieTitles([word('Play', 90)] as any)).toHaveLength(0)
    expect(extractMovieTitles([word('Trending', 90)] as any)).toHaveLength(0)
  })

  it('filters out entirely numeric lines', () => {
    expect(extractMovieTitles([word('2024', 90)] as any)).toHaveLength(0)
  })

  it('filters out lines longer than 40 characters', () => {
    expect(extractMovieTitles([word('A'.repeat(41), 90)] as any)).toHaveLength(0)
  })

  it('filters out lines with more than 6 words', () => {
    const words = Array.from({ length: 7 }, (_, i) =>
      word(`Word${i}`, 90, 100, i * 80)
    )
    expect(extractMovieTitles(words as any)).toHaveLength(0)
  })

  it('returns at most 5 results', () => {
    const words = Array.from({ length: 7 }, (_, i) =>
      word(`Movie${i}`, 90, i * 50)
    )
    expect(extractMovieTitles(words as any).length).toBeLessThanOrEqual(5)
  })

  it('sorts results by confidence descending', () => {
    const words = [
      word('Low', 70, 100),
      word('High', 95, 200),
      word('Mid', 80, 300),
    ]
    const result = extractMovieTitles(words as any)
    expect(result[0].title).toBe('High')
    expect(result[1].title).toBe('Mid')
    expect(result[2].title).toBe('Low')
  })

  it('divides position coordinates by scale', () => {
    const result = extractMovieTitles([word('Inception', 90, 300, 600)] as any, 3)
    expect(result[0].x).toBe(200)
    expect(result[0].y).toBe(100)
  })
})
