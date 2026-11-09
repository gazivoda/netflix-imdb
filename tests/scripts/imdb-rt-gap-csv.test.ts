import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'
import data from '../../data/imdb-rt-gap.json'

const ROOT = join(__dirname, '../..')
const SCRIPT = join(ROOT, 'scripts/research/imdb-rt-gap-csv.mjs')

// Minimal RFC 4180 parser (quoted fields, doubled quotes), enough to read our own output.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += c
  }
  return rows
}

describe('public/data/imdb-rt-gap.csv', () => {
  const committed = readFileSync(join(ROOT, 'public/data/imdb-rt-gap.csv'), 'utf8')
  const generated = execFileSync('node', [SCRIPT, '--stdout'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

  it('is exactly what the generator produces from data/imdb-rt-gap.json (not hand-edited, not stale)', () => {
    expect(committed).toBe(generated)
  })

  it('has one row per JSON title, in the same order, with matching values', () => {
    const [header, ...rows] = parseCsv(committed)
    expect(header).toEqual(['title', 'year', 'type', 'imdb_id', 'imdb_rating', 'imdb_votes', 'imdb_x10', 'rt_percent', 'gap', 'omdb_rt_flagged'])
    expect(rows).toHaveLength(data.titles.length)
    rows.forEach((r, i) => {
      const t = data.titles[i]
      expect(r).toHaveLength(header.length)
      expect(r[0]).toBe(t.title)
      expect(Number(r[1])).toBe(t.year)
      expect(r[3]).toBe(t.imdbId)
      expect(Number(r[4])).toBe(t.imdbRating)
      expect(Number(r[5])).toBe(t.imdbVotes)
      expect(Number(r[7])).toBe(t.rtPercent)
      expect(Number(r[8])).toBeCloseTo(t.rtPercent - t.imdbRating * 10, 6)
      expect(r[9]).toBe(data.flagged.some((f) => f.title === t.title) ? 'true' : 'false')
    })
  })

  it('quotes titles that contain commas', () => {
    expect(committed).toContain('"tick, tick... BOOM!"')
  })

  it('--check passes on the committed file', () => {
    expect(() => execFileSync('node', [SCRIPT, '--check'], { cwd: ROOT, stdio: 'ignore' })).not.toThrow()
  })
})
