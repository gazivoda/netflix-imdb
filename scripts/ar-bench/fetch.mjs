// Downloads real poster art for the realistic AR benchmark into .cache/ar-posters/ (git-ignored).
//   node scripts/ar-bench/fetch.mjs
// Needs OMDB_API_KEY (env or .env.local). Cached aggressively: existing files and manifest entries are never re-fetched,
// so a re-run only spends OMDb quota on titles that failed before. Prints only counts, never the key or URLs containing it.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TITLES, slugify } from './titles.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const dir = path.join(root, '.cache', 'ar-posters')
const manifestFile = path.join(dir, 'manifest.json')

function readKey() {
  if (process.env.OMDB_API_KEY) return process.env.OMDB_API_KEY
  try {
    const m = fs.readFileSync(path.join(root, '.env.local'), 'utf8').match(/^OMDB_API_KEY=(.*)$/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  } catch {}
  return ''
}

fs.mkdirSync(dir, { recursive: true })
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { posters: [], failed: {} }
const have = new Map(manifest.posters.map(p => [p.query, p]))
const key = readKey()

const save = () => fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2))
// OMDb hands out ~380px thumbnails (..._V1_QL75_UX380_CR0,0,380,562_.jpg); the same CDN serves a 1000px-wide version.
const bigger = url => url.replace(/_V1_.*\.jpg$/, '_V1_QL90_UX1000_.jpg')

async function download(url) {
  for (const u of [bigger(url), url]) {
    try {
      const r = await fetch(u)
      if (!r.ok) continue
      const buf = Buffer.from(await r.arrayBuffer())
      if (buf.length > 4000) return buf
    } catch {}
  }
  return null
}

let fetched = 0, cached = 0, failed = 0, quotaHit = false
for (const [query, year, type, imdb] of TITLES) {
  const prev = have.get(query)
  if (prev && fs.existsSync(path.join(dir, prev.file))) { cached++; continue }
  if (quotaHit) { failed++; continue }
  if (!key) { console.error('No OMDB_API_KEY (env or .env.local); cannot fetch.'); process.exit(1) }
  try {
    const qs = new URLSearchParams(imdb ? { apikey: key, i: imdb } : { apikey: key, t: query, y: String(year), type: type === 'series' ? 'series' : 'movie' })
    const res = await fetch(`https://www.omdbapi.com/?${qs}`)
    const j = await res.json()
    if (j.Response === 'False') {
      if (/limit/i.test(j.Error ?? '')) { quotaHit = true; console.error('OMDb daily limit reached; stopping API calls.') }
      manifest.failed[query] = j.Error ?? 'not found'; failed++; continue
    }
    if (!j.Poster || j.Poster === 'N/A') { manifest.failed[query] = 'no poster'; failed++; continue }
    const buf = await download(j.Poster)
    if (!buf) { manifest.failed[query] = 'download failed'; failed++; continue }
    const file = `${slugify(j.Title)}-${j.Year?.slice(0, 4) ?? year}.jpg`
    fs.writeFileSync(path.join(dir, file), buf)
    manifest.posters = manifest.posters.filter(p => p.query !== query)
    manifest.posters.push({ query, title: j.Title, year: j.Year, type: j.Type, imdbID: j.imdbID, poster: j.Poster, file })
    delete manifest.failed[query]
    fetched++
  } catch (e) {
    manifest.failed[query] = String(e.message ?? e); failed++
  }
  if ((fetched + failed) % 10 === 0) save()
}
// de-duplicate canonical titles (two queries can resolve to the same title)
const seen = new Set()
manifest.posters = manifest.posters.filter(p => (seen.has(p.title) ? false : (seen.add(p.title), true)))
save()
console.log(`posters: ${manifest.posters.length} usable (${fetched} downloaded, ${cached} cached, ${failed} failed/skipped)`)
for (const [q, why] of Object.entries(manifest.failed)) console.log(`  missing: ${q} (${why})`)
