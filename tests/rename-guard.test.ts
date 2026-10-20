import fs from 'fs'
import path from 'path'

const ROOT = path.join(__dirname, '..')
const SCAN = ['app', 'components', 'lib', 'public', 'extension', 'scripts', 'README.md', 'package.json']
const EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.html', '.css', '.svg', '.txt'])
const SKIP_DIRS = new Set(['node_modules', '.next', '.cache', '.data'])

function walk(p: string): string[] {
  const full = path.join(ROOT, p)
  if (!fs.existsSync(full)) return []
  if (fs.statSync(full).isFile()) return [p]
  return fs.readdirSync(full).flatMap((n) => (SKIP_DIRS.has(n) ? [] : walk(path.join(p, n))))
}

describe('rename to Rating Watch', () => {
  const files = SCAN.flatMap(walk).filter((f) => EXT.has(path.extname(f)))
  const hits = (re: RegExp) => files.filter((f) => re.test(fs.readFileSync(path.join(ROOT, f), 'utf8')))

  it('leaves no "Netflix Ratings" brand name in app code, extension or README', () => {
    expect(hits(/Netflix Ratings/)).toEqual([])
  })
  it('leaves no old netflix-ratings.app host', () => {
    expect(hits(/netflix-ratings\.app/)).toEqual([])
  })
  it('leaves no "Ratings for Netflix" extension name', () => {
    expect(hits(/Ratings for Netflix/)).toEqual([])
  })
  it('names the extension, site and package correctly', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension/manifest.json'), 'utf8'))
    expect(manifest.name).toBe('Rating Watch: IMDb & Rotten Tomatoes for Netflix')
    expect(manifest.action.default_title).toBe('Rating Watch')
    expect(fs.readFileSync(path.join(ROOT, 'lib/content.ts'), 'utf8')).toContain("'https://rating.watch'")
    expect(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).name).toBe('rating-watch')
  })
  it('bumped the extension version past 1.1.1', () => {
    const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension/manifest.json'), 'utf8')).version.split('.').map(Number)
    expect(v[0] * 10_000 + v[1] * 100 + v[2]).toBeGreaterThan(10_101)
  })
})
