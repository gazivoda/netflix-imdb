type TesseractWord = {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

export interface DetectedTitle {
  title: string
  confidence: number
  x: number
  y: number
}

const UI_EXCLUSIONS = new Set([
  'home', 'tv shows', 'movies', 'search', 'menu', 'play', 'watch',
  'resume', 'more info', 'like', 'match', 'new', 'top', 'trending',
  'episodes', 'trailers', 'audio', 'subtitles',
])

export function extractMovieTitles(words: TesseractWord[], scale = 1): DetectedTitle[] {
  const confident = words.filter(w => w.confidence > 60)
  if (!confident.length) return []

  const lines: TesseractWord[][] = []
  for (const word of confident) {
    const existing = lines.find(line =>
      Math.abs(line[0].bbox.y0 - word.bbox.y0) <= 20
    )
    if (existing) {
      existing.push(word)
    } else {
      lines.push([word])
    }
  }

  const results: DetectedTitle[] = []

  for (const line of lines) {
    const text = line.map(w => w.text).join(' ').trim()
    const wordCount = line.length
    const avgConfidence = line.reduce((sum, w) => sum + w.confidence, 0) / line.length

    if (
      text.length < 2 ||
      text.length > 40 ||
      wordCount > 6 ||
      /^\d+$/.test(text) ||
      UI_EXCLUSIONS.has(text.toLowerCase())
    ) continue

    results.push({
      title: text,
      confidence: avgConfidence,
      x: line[0].bbox.x0 / scale,
      y: line[0].bbox.y0 / scale,
    })
  }

  return results
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
}
