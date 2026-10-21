// Turns the raw words of one OCR pass over a tile into ranked title guesses. Pure (no DOM, no Tesseract types), so it is
// unit-tested on hand-written OCR output and the same code runs in the browser and in node benchmarks.
//
// Stylised logos make OCR return fragments ("GRAY" "MAN" on two lines, "STRANGER" without "THINGS", junk glyphs around the
// real words), so besides each text line this also offers multi-line joins and contiguous word runs (prefix / suffix / middle).
// Whether a guess is a real film is for the catalogue to say; this stage only has to put the right string in the top few.

export interface OcrWordLike {
  text: string
  confidence: number // 0..100
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

export interface TitleCandidate {
  text: string
  /** 0..1, higher = more likely the title. Comparable across passes after mergeCandidates. */
  score: number
  /** Mean OCR confidence (0..100) of the words in it. */
  confidence: number
  words: number
  /** How many OCR passes produced this exact string (set by mergeCandidates; 1 for a single pass). */
  support: number
}

export interface CandidateOptions {
  minWordConfidence: number // drop words below this (Tesseract is 0..100)
  minChars: number // letters+digits in a candidate
  maxChars: number
  maxWords: number
  /** Parts (sub-runs of a line) are scored down by this factor per dropped word, so full lines win ties. */
  partPenalty: number
  /** Height in px of the image the words come from. With it, big text (a logo) outranks small print (credits, dates). */
  imageHeight: number
  /** Text this tall (fraction of the image height) counts as fully "title sized". */
  titleHeightFrac: number
  /** Weight of the size feature, 0 = off. */
  sizeWeight: number
  /** Extra score per additional OCR pass that produced the same string. */
  supportBonus: number
  /** Single-word candidates only when no other word of comparable size is on the tile (see build()). */
  isolateSingles: boolean
}

export const DEFAULT_CANDIDATE_OPTIONS: CandidateOptions = {
  minWordConfidence: 30,
  minChars: 3,
  maxChars: 60,
  maxWords: 10,
  partPenalty: 0.85,
  imageHeight: 0,
  titleHeightFrac: 0.15,
  sizeWeight: 0.7,
  supportBonus: 0.15,
  isolateSingles: true,
}

// Words that are Netflix chrome or marketing copy, never the title of a card on their own.
const UI_PHRASES = new Set([
  'home', 'tv shows', 'movies', 'search', 'menu', 'play', 'watch', 'resume', 'more info', 'like', 'match', 'new', 'top',
  'trending', 'episodes', 'trailers', 'audio', 'subtitles', 'netflix', 'my list', 'new popular', 'new and popular',
  'only on netflix', 'a netflix original series', 'a netflix original', 'a netflix film', 'a netflix series', 'netflix original',
  'netflix series', 'netflix film', 'now playing', 'coming soon', 'watch now', 'streaming now', 'only on', 'season', 'episode',
  'limited series', 'a netflix limited series', 'original series', 'original', 'series', 'film', 'trailer', 'info', 'tv',
  'top 10', 'top ten', 'true story', 'a true story', 'true events', 'based on a true story', 'new series', 'new season', 'new episodes', 'the', 'a', 'an', 'of', 'and', 'in', 'on', 'by', 'from',
  'recently added', 'new release', 'new releases', 'just added', 'leaving soon', 'new on netflix', 'popular on netflix', 'trending now',
  'continue watching', 'watch again', 'watch it again', 'watch trailer', 'play trailer', 'play next', 'next episode', 'skip intro',
  'remind me', 'add to list', 'my list', 'top picks', 'top picks for you', 'because you watched', 'tv series', 'tv movie', 'netflix originals',
  'documentary', 'documentaries', 'audio and subtitles', 'available now', 'streaming', 'exclusive', 'season finale', 'series finale',
  'final season', 'new and popular', 'kids', 'browse', 'genres', 'sign in', 'sign out', 'help center', 'account',
])

// Patterns, not words: maturity ratings ("TV-MA", "TV-14 16", "PG-13"), "98 Match" (the % is stripped from the OCR token),
// "Season 2", "Episode 3", "Top 10 in the US today", ages ("16" from "16+"), durations ("2h 14m"), "Because you watched ...".
const UI_PATTERNS: RegExp[] = [
  /^(tv ?(ma|14|g|pg|y7?|y)|pg ?13|nc ?17|pg|r|g|nr|u|12a?|15|18|r18)( \d{1,2})?$/,
  /^\d{1,3} ?match$/,
  /^(season|episode|ep|series|part|chapter|vol|volume) ?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)$/,
  /^s\d{1,2} ?e\d{1,3}$/,
  /^top ?(10|ten)\b.*(today|week|now)$/,
  /^\d{1,2}h( ?\d{1,2}m)?$|^\d{1,3} ?(min|mins|minutes)$/,
  /^on (a |the )?(true|novel|book)\b/,
  /^(because you watched|continue watching|more like|watch (it )?again|new episodes?|recently added|remind me|only on)\b/,
  /^(a )?netflix (original|series|film|limited series|documentary|comedy special)\b/,
]

const normUi = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim()

/** Netflix chrome and badges ("Recently added", "TV-MA", "98 Match", "Season 2") that must never reach the catalogue. */
export function isUiText(text: string): boolean {
  const t = normUi(text)
  return UI_PHRASES.has(t) || UI_PATTERNS.some(re => re.test(t))
}

// A word is "wordlike" if it can plausibly be an English / Latin-script word: mostly letters, some vowel (or short), no long
// consonant run. Used to rank, not to reject.
function wordlike(w: string): boolean {
  const letters = w.replace(/[^\p{L}]/gu, '')
  if (letters.length < 2) return false
  if (letters.length <= 3) return true // "TV", "Dr", "Rye"
  if (!/[aeiouyàáâãäåèéêëìíîïòóôõöùúûüAEIOUY]/i.test(letters)) return false
  return !/[^aeiouy\s]{6,}/i.test(letters)
}

// Words that are marketing copy ("ONLY ON NETFLIX", "ALL EPISODES JULY 4", "COMING SOON"): they end a candidate instead of being
// part of it, so a title printed next to them survives on its own. Only words that are never part of a real title are
// unconditional; ordinary title words (may, march, august, season, original, watch ...) end a candidate only where the context
// says it is a badge or a date (see isMarketing), so "THE WATCH", "MARCH OF THE PENGUINS" and "MAY DECEMBER" stay whole.
const MARKETING_WORDS = new Set([
  'netflix', 'episodes', 'premiere', 'premieres', 'streaming', 'soon', 'theaters', 'theatres', 'starring', 'presents', 'directed', 'exclusive',
])
const MONTHS = new Set([
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
])
const NUMBER_WORDS = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'i', 'ii', 'iii', 'iv', 'v'])
const isDayOrYear = (w: string | undefined) => !!w && /^(\d{1,2}(st|nd|rd|th)?|(19|20)\d{2})$/.test(keyOf(w))

const keyOf = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/** Cleans one OCR token: strips glyph junk and edge punctuation, fixes the classic `|` for `I`. Returns '' when nothing is left. */
export function cleanWord(raw: string): string {
  let w = raw.replace(/\|/g, 'I').replace(/[^\p{L}\p{N}'’&:.,!?\-]/gu, '')
  w = w.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}!?.']+$/u, '')
  return w
}

interface CleanWord extends OcrWordLike { text: string; cy: number; h: number; w: number }

function cleanWords(words: OcrWordLike[], o: CandidateOptions): CleanWord[] {
  const out: CleanWord[] = []
  for (const word of words) {
    if (word.confidence < o.minWordConfidence) continue
    const text = cleanWord(word.text)
    if (!text) continue
    const letters = text.replace(/[^\p{L}\p{N}]/gu, '')
    // A lone letter or digit is almost always a speck: kept for now only so spaced-out logos ("D A R K") can be fused later.
    if (letters.length < 1) continue
    if (letters.length / text.length < 0.6) continue
    const h = Math.max(1, word.bbox.y1 - word.bbox.y0)
    if (letters.length < 2 && word.confidence < 40) continue
    out.push({ ...word, text, h, w: Math.max(1, word.bbox.x1 - word.bbox.x0), cy: (word.bbox.y0 + word.bbox.y1) / 2 })
  }
  return out
}

// Whether word i of a line is marketing copy rather than part of a title (see MARKETING_WORDS).
function isMarketing(line: CleanWord[], i: number): boolean {
  const k = keyOf(line[i].text)
  if (MARKETING_WORDS.has(k)) return true
  const prev = i > 0 ? keyOf(line[i - 1].text) : ''
  const next = i + 1 < line.length ? keyOf(line[i + 1].text) : ''
  // "JULY 4", "4 JULY", "NETFLIX APRIL": a month beside a day, a year or other marketing copy is a release date; "MAY DECEMBER" is a title
  if (MONTHS.has(k)) return isDayOrYear(line[i + 1]?.text) || isDayOrYear(line[i - 1]?.text) || MARKETING_WORDS.has(prev) || MARKETING_WORDS.has(next)
  // "SEASON 2", "NEW SEASON", "FINAL SEASON": a badge; "Season of the Witch" is a title
  if (k === 'season' || k === 'seasons') return /^\d{1,2}$/.test(next) || NUMBER_WORDS.has(next) || ['new', 'final', 'last', 'complete', 'all'].includes(prev)
  if (k === 'original' || k === 'originals') return next === 'series' || next === 'film' || next === 'movie' || prev === 'netflix'
  // "BASED ON A TRUE STORY": the badge, not a title that starts with "Based"
  if (k === 'based') return next === 'on'
  return false
}

// Words of one visual line (same baseline, close in x), then lines top to bottom.
function groupLines(words: CleanWord[]): CleanWord[][] {
  const sorted = [...words].sort((a, b) => a.cy - b.cy)
  const lines: CleanWord[][] = []
  for (const w of sorted) {
    const line = lines.find(l => {
      const cy = l.reduce((s, x) => s + x.cy, 0) / l.length
      const h = Math.max(...l.map(x => x.h), w.h)
      return Math.abs(cy - w.cy) <= 0.45 * h
    })
    if (line) line.push(w)
    else lines.push([w])
  }
  // Split a line where the horizontal gap is far larger than the text height (two separate captions on the same row).
  const split: CleanWord[][] = []
  for (const l of lines) {
    l.sort((a, b) => a.bbox.x0 - b.bbox.x0)
    let cur: CleanWord[] = [l[0]]
    for (let i = 1; i < l.length; i++) {
      const gap = l[i].bbox.x0 - l[i - 1].bbox.x1
      const h = Math.max(l[i].h, l[i - 1].h)
      if (gap > 3.2 * h) { split.push(cur); cur = [] }
      cur.push(l[i])
    }
    split.push(cur)
  }
  // marketing words end a segment
  const segments: CleanWord[][] = []
  for (const seg of split) {
    let cur: CleanWord[] = []
    seg.forEach((word, i) => {
      if (isMarketing(seg, i)) { if (cur.length) segments.push(cur); cur = [] } else cur.push(word)
    })
    if (cur.length) segments.push(cur)
  }
  return segments.map(fuseLetters).filter(l => l.length).sort((a, b) => a[0].cy - b[0].cy)
}

// Spaced-out logos come back as single letters ("D" "A" "R" "K"). Three or more in a row become one word; stray single letters
// are dropped unless they are the real one-letter words A / I / &, or a single digit beside a word of 3+ letters (the sequel
// number of "EXTRACTION 2", "ENOLA HOLMES 2" or the "3" of "3 BODY PROBLEM").
function fuseLetters(line: CleanWord[]): CleanWord[] {
  const letters = (w: CleanWord) => w.text.replace(/[^\p{L}\p{N}]/gu, '')
  const isSingle = (w: CleanWord) => letters(w).length < 2
  const isWord = (w: CleanWord | undefined) => !!w && !isSingle(w) && w.text.replace(/[^\p{L}]/gu, '').length >= 3
  const out: CleanWord[] = []
  for (let i = 0; i < line.length; ) {
    if (!isSingle(line[i])) { out.push(line[i++]); continue }
    let j = i
    while (j < line.length && isSingle(line[j])) j++
    const run = line.slice(i, j)
    if (run.length >= 3) {
      const text = run.map(letters).join('')
      const x0 = Math.min(...run.map(w => w.bbox.x0))
      const x1 = Math.max(...run.map(w => w.bbox.x1))
      const y0 = Math.min(...run.map(w => w.bbox.y0))
      const y1 = Math.max(...run.map(w => w.bbox.y1))
      out.push({ text, confidence: run.reduce((a, w) => a + w.confidence, 0) / run.length, bbox: { x0, y0, x1, y1 }, cy: (y0 + y1) / 2, h: y1 - y0, w: x1 - x0 })
    } else {
      run.forEach((w, r) => {
        if (/^[aAiI&]$/.test(w.text) && w.confidence >= 70) out.push(w)
        else if (/^\d$/.test(w.text) && w.confidence >= 40 && ((r === 0 && isWord(line[i - 1])) || (r === run.length - 1 && isWord(line[j])))) out.push(w)
      })
    }
    i = j
  }
  return out
}

function build(ws: CleanWord[], kind: 'line' | 'join' | 'part', dropped: number, o: CandidateOptions, all: CleanWord[] = []): TitleCandidate | null {
  if (!ws.length || ws.length > o.maxWords) return null
  // A lone word is only a title when nothing else of its size is on the tile: "GRAY" beside "MAN", or "KINGDOM" beside "LAST",
  // is a fragment, and a lookup would happily answer it with some film called "Gray" or "Kingdom".
  if (ws.length === 1 && o.isolateSingles) {
    const w = ws[0]
    if (all.some(x => x !== w && x.confidence >= 40 && x.h >= 0.6 * w.h)) return null
  }
  const text = ws.map(w => w.text).join(' ').replace(/\s+/g, ' ').trim()
  const key = keyOf(text)
  if (key.length < o.minChars || key.length > o.maxChars) return null
  if (isUiText(text)) return null
  // A bare number is a title only when it is a 4-digit one ("1899", "1917") printed large; a recent year is a release badge.
  if (/^\d+$/.test(key)) {
    if (key.length !== 4 || Number(key) >= 2018) return null
    if (o.imageHeight > 0 && ws[0].h < 0.5 * o.titleHeightFrac * o.imageHeight) return null
  }
  const chars = ws.reduce((s, w) => s + keyOf(w.text).length, 0)
  const confidence = ws.reduce((s, w) => s + w.confidence * keyOf(w.text).length, 0) / Math.max(1, chars)
  const real = ws.filter(w => wordlike(w.text) || /^\d+$/.test(w.text))
  const plausible = real.length / ws.length
  const lenBonus = Math.min(1, 0.55 + key.length / 14) // very short strings are weaker evidence
  const kindFactor = kind === 'part' ? Math.pow(o.partPenalty, dropped) : kind === 'join' ? 0.97 : 1
  let size = 1
  if (o.imageHeight > 0 && o.sizeWeight > 0) {
    const hMean = ws.reduce((a, w) => a + w.h, 0) / ws.length
    size = 1 - o.sizeWeight + o.sizeWeight * Math.min(1, hMean / (o.imageHeight * o.titleHeightFrac))
  }
  const score = (confidence / 100) * (0.35 + 0.65 * plausible) * lenBonus * kindFactor * size
  return { text, score, confidence, words: ws.length, support: 1 }
}

/** Candidates from the words of one OCR pass, best first. Duplicates (same letters, any case / spacing) are merged. */
export function candidatesFromWords(words: OcrWordLike[], opts: Partial<CandidateOptions> = {}): TitleCandidate[] {
  const o = { ...DEFAULT_CANDIDATE_OPTIONS, ...opts }
  const lines = groupLines(cleanWords(words, o))
  const everyWord = lines.flat()
  const found: TitleCandidate[] = []
  const add = (c: TitleCandidate | null) => { if (c) found.push(c) }

  lines.forEach((line, li) => {
    add(build(line, 'line', 0, o, everyWord))
    // contiguous runs shorter than the whole line (only worthwhile for 3+ words, or 2 words with a junk neighbour)
    for (let len = Math.min(line.length - 1, o.maxWords); len >= 1; len--) {
      for (let s = 0; s + len <= line.length; s++) {
        if (len === 1 && line.length < 3 && keyOf(line[s].text).length < 5) continue
        add(build(line.slice(s, s + len), 'part', line.length - len, o, everyWord))
      }
    }
    // multi-line logos: this line plus the next one(s) when they are stacked and of similar height
    let joined = line
    for (let nj = li + 1; nj < lines.length && nj <= li + 2; nj++) {
      const next = lines[nj]
      const hA = Math.max(...joined.map(w => w.h))
      const hB = Math.max(...next.map(w => w.h))
      const prevBottom = Math.max(...joined.map(w => w.bbox.y1))
      const nextTop = Math.min(...next.map(w => w.bbox.y0))
      const overlapX = Math.min(Math.max(...joined.map(w => w.bbox.x1)), Math.max(...next.map(w => w.bbox.x1))) -
        Math.max(Math.min(...joined.map(w => w.bbox.x0)), Math.min(...next.map(w => w.bbox.x0)))
      if (nextTop - prevBottom > 1.6 * Math.max(hA, hB) || hB / hA > 2.2 || hA / hB > 2.2 || overlapX < 0) break
      joined = [...joined, ...next]
      add(build(joined, 'join', 0, o))
    }
  })

  return mergeCandidates([found], o.supportBonus)
}

/** Merges candidate lists (e.g. from several passes): same letters = same candidate; keeps the best score and counts the passes
 *  that agree (support), which adds a small bonus because independent passes agreeing is strong evidence. */
export function mergeCandidates(lists: TitleCandidate[][], supportBonus = DEFAULT_CANDIDATE_OPTIONS.supportBonus): TitleCandidate[] {
  const by = new Map<string, TitleCandidate>()
  for (const list of lists) {
    const seenHere = new Set<string>()
    for (const c of list) {
      const k = keyOf(c.text)
      const cur = by.get(k)
      if (!cur) { by.set(k, { ...c }); seenHere.add(k); continue }
      if (c.score > cur.score) { cur.text = c.text; cur.confidence = c.confidence; cur.words = c.words; cur.score = c.score }
      if (!seenHere.has(k)) { cur.support += c.support; seenHere.add(k) }
    }
  }
  const out = [...by.values()]
  for (const c of out) c.score = Math.min(1, c.score * (1 + supportBonus * (c.support - 1)))
  return out.sort((a, b) => b.score - a.score)
}

/** "THE GRAY MAN" -> "The Gray Man" (only when the whole string is upper case; mixed case is left alone). Short words keep as is. */
export function normaliseCase(text: string): string {
  if (text !== text.toUpperCase() || text === text.toLowerCase()) return text
  return text.toLowerCase().replace(/(^|[\s\-:(])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}
