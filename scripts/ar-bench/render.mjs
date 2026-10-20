// Renders the realistic AR benchmark scenes from the cached posters into .cache/ar-scenes/ (git-ignored).
//   node scripts/ar-bench/fetch.mjs      # once: posters -> .cache/ar-posters
//   node scripts/ar-bench/render.mjs     # scenes + ground truth -> .cache/ar-scenes
// Options (env): AR_BENCH_PER_LAYOUT=6 (scenes per layout), AR_BENCH_WORKERS=6 (OCR workers), AR_BENCH_SHARP=<path to sharp>.
//
// sharp is deliberately NOT a project dependency: it is only used here, to decode posters, rasterise text and apply the photo
// degradations. The jest benchmark reads the finished PNGs and needs nothing but zlib.
//
// Layouts: landscape (16:9 key-art tiles, hero, nav rail, focused tile, cut tiles), caption (title printed under each tile),
// top10 (big numerals + portrait posters). Each is rendered clean and at mild / medium / severe "phone photographing a TV" levels.
// Ground truth per tile: box (after the photo warp), true canonical title, and whether the title is legible in the tile.

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createWorker } from 'tesseract.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const postersDir = path.join(root, '.cache', 'ar-posters')
const outDir = path.join(root, '.cache', 'ar-scenes')
const req = createRequire(import.meta.url)
const SHARP_FALLBACK = '/private/tmp/claude-501/-Users-igorgazivoda-netflix-imdb/fd67be88-5b0c-48da-befa-f8a6a3ede510/scratchpad/ar-spike/clip/node_modules/sharp'
function loadSharp() {
  for (const p of [process.env.AR_BENCH_SHARP, 'sharp', SHARP_FALLBACK]) {
    if (!p) continue
    try { return req(p) } catch {}
  }
  throw new Error('sharp not found. Install it somewhere outside the project and point AR_BENCH_SHARP at it (it is not a project dependency).')
}
const sharp = loadSharp()

const W = 1280, H = 720
const PER_LAYOUT = Number(process.env.AR_BENCH_PER_LAYOUT ?? 6)
const WORKERS = Number(process.env.AR_BENCH_WORKERS ?? 6)
const LAYOUTS = ['landscape', 'caption', 'top10']
const LEVELS = ['clean', 'mild', 'medium', 'severe']

// ---------- utils ----------
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)]
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
function similarity(a, b) {
  const x = norm(a), y = norm(b)
  if (!x || !y) return 0
  if (x === y) return 1
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j)
  for (let i = 1; i <= x.length; i++) {
    const cur = [i]
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1))
    prev = cur
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length)
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
function shuffle(rng, arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

async function pooled(n, make) {
  const workers = await Promise.all(Array.from({ length: n }, make))
  const run = async (items, fn) => {
    const out = new Array(items.length)
    let next = 0
    await Promise.all(workers.map(async w => {
      for (;;) { const i = next++; if (i >= items.length) return; out[i] = await fn(w, items[i], i) }
    }))
    return out
  }
  return { run, close: () => Promise.all(workers.map(w => w.terminate())) }
}
const wordsOf = data => (data.blocks ?? []).flatMap(b => b.paragraphs.flatMap(p => p.lines.flatMap(l => l.words)))
const linesOf = data => (data.blocks ?? []).flatMap(b => b.paragraphs.flatMap(p => p.lines))

// ---------- RGBA buffer drawing ----------
const newBuf = (w, h, [r, g, b]) => {
  const d = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255 }
  return d
}
function fillRect(dst, x, y, w, h, [r, g, b], a = 1) {
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
    const i = (yy * W + xx) * 4
    dst[i] = dst[i] * (1 - a) + r * a; dst[i + 1] = dst[i + 1] * (1 - a) + g * a; dst[i + 2] = dst[i + 2] * (1 - a) + b * a
  }
}
function blit(dst, src, sw, sh, x, y) {
  for (let yy = 0; yy < sh; yy++) {
    const dy = y + yy
    if (dy < 0 || dy >= H) continue
    for (let xx = 0; xx < sw; xx++) {
      const dx = x + xx
      if (dx < 0 || dx >= W) continue
      const s = (yy * sw + xx) * 4, d = (dy * W + dx) * 4
      const a = src[s + 3] / 255
      if (a >= 0.999) { dst[d] = src[s]; dst[d + 1] = src[s + 1]; dst[d + 2] = src[s + 2] }
      else if (a > 0) { dst[d] = dst[d] * (1 - a) + src[s] * a; dst[d + 1] = dst[d + 1] * (1 - a) + src[s + 1] * a; dst[d + 2] = dst[d + 2] * (1 - a) + src[s + 2] * a }
    }
  }
}
async function rasterSvg(svg, w, h) {
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${svg}</svg>`)).ensureAlpha().raw().toBuffer()
}
async function blitSvg(dst, svg, x, y, w, h) { blit(dst, await rasterSvg(svg, w, h), w, h, x, y) }
function crop(buf, bw, x, y, w, h) {
  const out = Buffer.alloc(w * h * 4)
  for (let yy = 0; yy < h; yy++) buf.copy(out, yy * w * 4, ((y + yy) * bw + x) * 4, ((y + yy) * bw + x + w) * 4)
  return out
}

// ---------- posters ----------
async function loadPosters() {
  const manifest = JSON.parse(fs.readFileSync(path.join(postersDir, 'manifest.json'), 'utf8'))
  const tbFile = path.join(postersDir, 'titlebox.json')
  const tbCache = fs.existsSync(tbFile) ? JSON.parse(fs.readFileSync(tbFile, 'utf8')) : {}
  const posters = []
  for (const p of manifest.posters) {
    try {
      const { data, info } = await sharp(path.join(postersDir, p.file)).resize({ width: 1000, withoutEnlargement: false }).jpeg({ quality: 93 }).toBuffer({ resolveWithObject: true })
      posters.push({ ...p, buf: data, w: info.width, h: info.height, tb: tbCache[p.file] })
    } catch (e) { console.error(`skip unreadable poster ${p.file}: ${e.message}`) }
  }
  // Locate where the title is printed on each poster (OCR once, cached) so crops keep the stylised logo in frame.
  const todo = posters.filter(p => p.tb === undefined)
  if (todo.length) {
    console.log(`locating titles on ${todo.length} posters...`)
    const pool = await pooled(WORKERS, async () => { const w = await createWorker('eng'); await w.setParameters({ tessedit_pageseg_mode: '11' }); return w })
    await pool.run(todo, async (worker, p) => {
      const toks = p.title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
      let best = null
      for (const variant of [0, 1]) {
        const img = await (variant ? sharp(p.buf).greyscale().normalise().negate() : sharp(p.buf).greyscale()).png().toBuffer()
        const { data } = await worker.recognize(img, {}, { blocks: true })
        const hit = wordsOf(data).filter(w => w.confidence > 35 && toks.some(t => norm(w.text) === t || (t.length > 4 && similarity(w.text, t) >= 0.8)))
        const matched = new Set(hit.map(w => norm(w.text)))
        if (hit.length && matched.size >= Math.ceil(toks.length / 2) && (!best || matched.size > best.n)) {
          best = { n: matched.size, x0: Math.min(...hit.map(w => w.bbox.x0)), y0: Math.min(...hit.map(w => w.bbox.y0)), x1: Math.max(...hit.map(w => w.bbox.x1)), y1: Math.max(...hit.map(w => w.bbox.y1)) }
        }
        if (best && best.n >= toks.length) break
      }
      p.tb = best ? { x0: best.x0, y0: best.y0, x1: best.x1, y1: best.y1 } : null
    })
    await pool.close()
    for (const p of posters) tbCache[p.file] = p.tb
    fs.writeFileSync(tbFile, JSON.stringify(tbCache))
  }
  // Hand-labelled title regions (fractions of the poster, eyeballed) override OCR: Tesseract misses most stylised logos, and a
  // tile whose crop lacks the title can never be read. null = the title is not printed on the art (e.g. non-English key art).
  const manualFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'title-regions.json')
  const manual = fs.existsSync(manualFile) ? JSON.parse(fs.readFileSync(manualFile, 'utf8')) : {}
  for (const p of posters) {
    if (!(p.file in manual)) continue
    const m = manual[p.file]
    p.tb = m ? { x0: (m.x - m.w / 2) * p.w, x1: (m.x + m.w / 2) * p.w, y0: (m.y - m.h / 2) * p.h, y1: (m.y + m.h / 2) * p.h } : null
  }
  console.log(`posters: ${posters.length}, title printed and located: ${posters.filter(p => p.tb).length}`)
  return posters
}

const FONTS = ['Arial Black', 'Impact', 'Futura', 'Didot', 'Copperplate', 'Georgia', 'Trattatello', 'Luminari', 'Rockwell', 'Avenir Next Condensed', 'Gill Sans', 'Baskerville', 'Optima', 'Helvetica Neue', 'Trebuchet MS', 'Herculanum']
const COLORS = ['#ffffff', '#ffffff', '#ffffff', '#f5d76e', '#ffd9d9', '#d7f3ff', '#e50914']

// Lines of overlay text that fit a tile of width tw, as an SVG fragment drawn over the art.
function titleOverlaySvg(rng, title, tw, th) {
  const font = pick(rng, FONTS)
  const upper = rng() < 0.55
  const text = upper ? title.toUpperCase() : title
  const centre = rng() < 0.4
  const fill = pick(rng, COLORS)
  let fs = Math.round(th * (0.13 + rng() * 0.09))
  const maxW = tw * 0.9
  const est = (t, f) => t.length * f * (upper ? 0.66 : 0.56)
  let lines = [text]
  if (est(text, fs) > maxW) {
    const words = text.split(' ')
    if (words.length > 1) {
      let bestI = 1, bestD = Infinity
      for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (d < bestD) { bestD = d; bestI = i } }
      lines = [words.slice(0, bestI).join(' '), words.slice(bestI).join(' ')]
    }
  }
  const longest = Math.max(...lines.map(l => est(l, fs)))
  const fit = longest > maxW ? maxW / longest : 1
  fs = Math.max(8, Math.round(fs * Math.max(fit, 0.55)))
  const lh = fs * 1.12
  const anchorX = centre ? tw / 2 : tw * 0.06
  const anchor = centre ? 'middle' : 'start'
  const y0 = centre ? th / 2 - ((lines.length - 1) * lh) / 2 + fs * 0.35 : th - fs * 0.6 - (lines.length - 1) * lh
  let svg = ''
  lines.forEach((l, i) => {
    const forced = est(l, fs) > maxW ? ` textLength="${Math.round(maxW)}" lengthAdjust="spacingAndGlyphs"` : ''
    svg += `<text x="${anchorX}" y="${y0 + i * lh}" text-anchor="${anchor}" font-family="${font}" font-size="${fs}" font-weight="bold" fill="${fill}" stroke="#000" stroke-opacity="0.7" stroke-width="${Math.max(1, fs / 12)}" paint-order="stroke"${forced}>${esc(l)}</text>`
  })
  return { svg, font, lines: lines.length }
}

// A tw x th tile cut out of a poster: the window is centred on where the title is printed, then darkened at the bottom.
async function tileArt(p, tw, th, rng, { overlay = false, portrait = false } = {}) {
  let cw, ch, cx, cy
  if (portrait) { cw = p.w; ch = Math.min(p.h, Math.round(cw * th / tw)); cx = p.w / 2; cy = p.h / 2 }
  else {
    const tb = p.tb
    const zMin = tb ? Math.max(0.72, ((tb.x1 - tb.x0) * 1.25) / p.w) : 0.72
    cw = Math.round(p.w * Math.min(1, zMin + rng() * (1 - zMin)))
    ch = Math.round((cw * th) / tw)
    if (ch > p.h) { ch = p.h; cw = Math.round((ch * tw) / th) }
    cx = tb ? (tb.x0 + tb.x1) / 2 + (rng() - 0.5) * 0.1 * cw : p.w / 2 + (rng() - 0.5) * 0.2 * p.w
    cy = tb ? (tb.y0 + tb.y1) / 2 + (rng() - 0.5) * 0.3 * ch : p.h * (0.62 + rng() * 0.3)
  }
  const left = Math.round(clamp(cx - cw / 2, 0, p.w - cw))
  const top = Math.round(clamp(cy - ch / 2, 0, p.h - ch))
  // is the printed title (inside this crop window) actually in frame?
  const tb = p.tb
  const titleInFrame = !!tb && (portrait || (Math.min(tb.x1, left + cw) - Math.max(tb.x0, left)) * (Math.min(tb.y1, top + ch) - Math.max(tb.y0, top)) >= 0.9 * (tb.x1 - tb.x0) * (tb.y1 - tb.y0))
  let svg = ''
  if (!portrait) svg += `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${(0.3 + rng() * 0.3).toFixed(2)}"/></linearGradient></defs><rect width="${tw}" height="${th}" fill="url(#g)"/>`
  let meta = { font: null }
  if (overlay) { const o = titleOverlaySvg(rng, p.title, tw, th); svg += o.svg; meta = { font: o.font } }
  const buf = await sharp(p.buf).extract({ left, top, width: cw, height: ch }).resize(tw, th, { fit: 'fill' })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}">${svg}</svg>`) }])
    .ensureAlpha().raw().toBuffer()
  return { buf, titleInFrame, ...meta }
}

// ---------- scenes ----------
const CAPTIONS = ['Trending Now', 'Popular on Netflix', 'Continue Watching', 'New Releases', 'Top Picks for You', 'Watch It Again', 'Award-Winning TV Dramas', 'Binge-Worthy Series', 'Critically Acclaimed Movies']

class SceneBuilder {
  constructor(posters, rng) {
    this.posters = posters
    this.rng = rng
    this.pool = shuffle(rng, posters)
    this.buf = newBuf(W, H, [20, 20, 20])
    this.tiles = []
    this.ignore = []
  }
  nextPoster() { const p = this.pool.pop(); if (!p) throw new Error('out of posters'); return p }
  // Registers a tile; boxes are clipped to the frame and tiles that are mostly off-screen become "ignore" regions.
  record(p, x, y, w, h, extra) {
    const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(W, x + w), y1 = Math.min(H, y + h)
    const visible = x1 > x0 && y1 > y0 ? ((x1 - x0) * (y1 - y0)) / (w * h) : 0
    if (visible <= 0.02) return
    const rec = {
      title: p.title, imdbID: p.imdbID, year: p.year, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, visible: +visible.toFixed(3),
      quad: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], partial: visible < 0.7, focused: false, overlay: false, titleInFrame: false, ocrReadable: null, legibleBy: 'none', ...extra,
    }
    this.tiles.push(rec)
  }
  async chrome({ rail, topBar }) {
    if (rail) {
      fillRect(this.buf, 0, 0, 64, H, [10, 10, 10])
      for (let i = 0; i < 6; i++) fillRect(this.buf, 22, 110 + i * 64, 20, 20, [70, 70, 70])
    }
    if (topBar) {
      let svg = `<text x="${rail ? 84 : 40}" y="36" font-family="Arial Black" font-size="26" fill="#e50914">NETFLIX</text>`
      ;['Home', 'TV Shows', 'Movies', 'New &amp; Popular', 'My List'].forEach((t, i) => { svg += `<text x="${(rail ? 220 : 180) + i * 105}" y="34" font-family="Helvetica Neue" font-size="15" fill="#e5e5e5">${t}</text>` })
      await blitSvg(this.buf, svg, 0, 0, W, 56)
    }
  }
  async label(text, x, y, fs = 17) {
    await blitSvg(this.buf, `<text x="2" y="${fs}" font-family="Helvetica Neue" font-size="${fs}" font-weight="bold" fill="#e5e5e5">${esc(text)}</text>`, x, y, 520, fs + 8)
  }
}

async function sceneLandscape(posters, rng) {
  const b = new SceneBuilder(posters, rng)
  await b.chrome({ rail: true, topBar: true })
  // hero banner
  const hero = b.nextPoster()
  const heroArt = await tileArt(hero, 1216, 200, rng, {})
  blit(b.buf, heroArt.buf, 1216, 200, 64, 56)
  let hsvg = `<defs><linearGradient id="h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#141414" stop-opacity="0.95"/><stop offset="0.55" stop-color="#141414" stop-opacity="0"/></linearGradient></defs><rect width="1216" height="200" fill="url(#h)"/>`
  hsvg += `<text x="30" y="96" font-family="${pick(rng, FONTS)}" font-size="46" font-weight="bold" fill="#fff">${esc(hero.title.toUpperCase())}</text><rect x="30" y="130" width="86" height="30" rx="4" fill="#fff"/><rect x="128" y="130" width="110" height="30" rx="4" fill="#6d6d6eb3"/>`
  await blitSvg(b.buf, hsvg, 64, 56, 1216, 200)
  b.ignore.push({ x: 64, y: 56, w: 1216, h: 200 })

  const tw = 196 + Math.floor(rng() * 40), th = Math.round((tw * 9) / 16), gap = 8 + Math.floor(rng() * 6)
  const pitch = 26 + th + 16
  const focusRow = Math.floor(rng() * 2), focusIdx = 1 + Math.floor(rng() * 3)
  let rowTop = 270
  for (let r = 0; rowTop + 26 + th * 0.5 < H; r++, rowTop += pitch) {
    const withTitle = rng() < 0.3 ? pick(rng, b.posters).title : null
    await b.label(withTitle ? `Because you watched ${withTitle}` : pick(rng, CAPTIONS), 84, rowTop)
    const ty = rowTop + 26
    let x = 84
    for (let i = 0; x < W - 4; i++) {
      const p = b.nextPoster()
      const overlay = rng() < 0.5
      const trng = mulberry32(Math.floor(rng() * 1e9))
      const focused = r === focusRow && i === focusIdx && x + tw * 1.3 < W
      const fw = focused ? Math.round(tw * 1.2) : tw, fh = focused ? Math.round(th * 1.2) : th
      const fx = x, fy = focused ? ty - Math.round((fh - th) / 2) : ty
      const art = await tileArt(p, fw, fh, trng, { overlay })
      blit(b.buf, art.buf, fw, fh, fx, fy)
      if (focused) for (const [rx, ry, rw, rh] of [[fx, fy, fw, 3], [fx, fy + fh - 3, fw, 3], [fx, fy, 3, fh], [fx + fw - 3, fy, 3, fh]]) fillRect(b.buf, rx, ry, rw, rh, [255, 255, 255])
      b.record(p, fx, fy, fw, fh, { focused, overlay, titleInFrame: art.titleInFrame, legibleBy: overlay ? 'overlay' : art.titleInFrame ? 'poster' : 'none', font: art.font })
      x += (focused ? fw : tw) + gap
    }
  }
  return b
}

async function sceneCaption(posters, rng) {
  const b = new SceneBuilder(posters, rng)
  await b.chrome({ rail: false, topBar: false })
  const tw = 186 + Math.floor(rng() * 28), th = Math.round((tw * 9) / 16), gap = 12 + Math.floor(rng() * 8)
  const fs = 14 + Math.floor(rng() * 3)
  const captionFont = pick(rng, ['Helvetica Neue', 'Arial', 'Avenir Next Condensed', 'Gill Sans', 'Trebuchet MS', 'Optima'])
  const pitch = 26 + th + fs + 26
  for (let rowTop = 14; rowTop + 26 + th + fs + 8 < H; rowTop += pitch) {
    await b.label(pick(rng, CAPTIONS), 40, rowTop)
    const ty = rowTop + 28
    for (let x = 40; x < W - 4;) {
      const p = b.nextPoster()
      const art = await tileArt(p, tw, th, mulberry32(Math.floor(rng() * 1e9)), {})
      blit(b.buf, art.buf, tw, th, x, ty)
      const maxChars = Math.floor(tw / (fs * 0.52))
      const text = p.title.length > maxChars ? `${p.title.slice(0, maxChars - 1)}…` : p.title
      await blitSvg(b.buf, `<text x="1" y="${fs + 2}" font-family="${captionFont}" font-size="${fs}" fill="#e8e8e8">${esc(text)}</text>`, x, ty + th + 6, tw + 40, fs + 10)
      b.record(p, x, ty, tw, th, { titleInFrame: art.titleInFrame, legibleBy: text === p.title ? 'caption' : art.titleInFrame ? 'poster' : 'none', caption: text })
      x += tw + gap
    }
  }
  return b
}

async function sceneTop10(posters, rng) {
  const b = new SceneBuilder(posters, rng)
  await b.chrome({ rail: false, topBar: true })
  const ph = 196 + Math.floor(rng() * 24), pw = Math.round((ph * 2) / 3), numW = 84 + Math.floor(rng() * 20)
  const labels = ['Top 10 Movies Today', 'Top 10 TV Shows Today']
  let rowTop = 70
  for (let r = 0; r < 2; r++, rowTop += ph + 66) {
    await b.label(labels[r], 40, rowTop, 20)
    const ty = rowTop + 32
    let x = 40
    for (let i = 0; x < W - 4; i++) {
      const p = b.nextPoster()
      const nfs = Math.round(ph * 0.92)
      await blitSvg(b.buf, `<text x="6" y="${Math.round(ph * 0.84)}" font-family="Arial Black" font-size="${nfs}" font-weight="900" fill="#141414" stroke="#6b6b6b" stroke-width="5">${i + 1}</text>`, x, ty, numW + 70, ph)
      const art = await tileArt(p, pw, ph, mulberry32(Math.floor(rng() * 1e9)), { portrait: true })
      const px = x + numW
      blit(b.buf, art.buf, pw, ph, px, ty)
      b.record(p, px, ty, pw, ph, { titleInFrame: art.titleInFrame, legibleBy: art.titleInFrame ? 'poster' : 'none', rank: i + 1 })
      x = px + pw + 22
    }
  }
  return b
}

// ---------- photo degradation ----------
const LEVEL_PARAMS = {
  mild: { inset: 0.03, jitter: 0.012, rot: 0.6, blur: 0.7, moire: 0.03, glare: 0.1, vignette: 0.12, gain: 0.06, noise: 2, jpeg: 85, down: 1 },
  medium: { inset: 0.04, jitter: 0.025, rot: 1.5, blur: 1.2, moire: 0.06, glare: 0.22, vignette: 0.22, gain: 0.12, noise: 4, jpeg: 65, down: 0.8 },
  severe: { inset: 0.05, jitter: 0.045, rot: 3, blur: 1.8, moire: 0.11, glare: 0.4, vignette: 0.35, gain: 0.22, noise: 8, jpeg: 40, down: 0.6 },
}

function solveHomography(src, dst) {
  const A = [], bv = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); bv.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); bv.push(v)
  }
  for (let c = 0; c < 8; c++) {
    let piv = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r
    ;[A[c], A[piv]] = [A[piv], A[c]]; [bv[c], bv[piv]] = [bv[piv], bv[c]]
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const f = A[r][c] / A[c][c]
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]
      bv[r] -= f * bv[c]
    }
  }
  return [...bv.map((v, i) => v / A[i][i]), 1]
}
const applyH = (h, x, y) => { const d = h[6] * x + h[7] * y + h[8]; return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d] }

function gauss(rng) { return Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng()) }

async function degrade(scene, level, rng) {
  const P = LEVEL_PARAMS[level]
  // bezel ring so the warp shows a believable TV edge
  const src = Buffer.from(scene)
  fillRect(src, 0, 0, W, 8, [8, 8, 8]); fillRect(src, 0, H - 8, W, 8, [8, 8, 8]); fillRect(src, 0, 0, 8, H, [8, 8, 8]); fillRect(src, W - 8, 0, 8, H, [8, 8, 8])

  // destination quad: shrink about the centre, rotate, then jitter each corner (keystone)
  const th = (P.rot * (rng() * 2 - 1) * Math.PI) / 180, cs = Math.cos(th), sn = Math.sin(th)
  const s = 1 - P.inset * 2
  const corners = [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]]
  const dst = corners.map(([x, y]) => {
    const rx = (x * cs - y * sn) * s, ry = (x * sn + y * cs) * s
    return [W / 2 + rx + (rng() * 2 - 1) * P.jitter * W, H / 2 + ry + (rng() * 2 - 1) * P.jitter * H]
  })
  const srcQ = [[0, 0], [W, 0], [W, H], [0, H]]
  const Hm = solveHomography(srcQ, dst), Hi = solveHomography(dst, srcQ)

  let out = Buffer.alloc(W * H * 4)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [sx, sy] = applyH(Hi, x + 0.5, y + 0.5)
    const o = (y * W + x) * 4
    if (sx < 0 || sy < 0 || sx >= W - 1 || sy >= H - 1) { out[o] = out[o + 1] = out[o + 2] = 4; out[o + 3] = 255; continue }
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0
    const i00 = (y0 * W + x0) * 4, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4
    for (let c = 0; c < 3; c++) out[o + c] = src[i00 + c] * (1 - fx) * (1 - fy) + src[i10 + c] * fx * (1 - fy) + src[i01 + c] * (1 - fx) * fy + src[i11 + c] * fx * fy
    out[o + 3] = 255
  }

  // optical blur (+ resolution loss for the worst case)
  let img = sharp(out, { raw: { width: W, height: H, channels: 4 } }).blur(P.blur)
  if (P.down < 1) img = sharp(await img.resize(Math.round(W * P.down), Math.round(H * P.down)).raw().toBuffer(), { raw: { width: Math.round(W * P.down), height: Math.round(H * P.down), channels: 4 } }).resize(W, H)
  out = await img.raw().toBuffer()

  // moire: coarse beat between the TV pixel grid and the sensor grid, with per-channel phase (colour fringes) + fine line grid
  const ang = rng() * Math.PI, beatP = 14 + rng() * 30, fineP = 2.6 + rng() * 0.8, fAng = ang + (rng() - 0.5) * 0.4
  const ph = [rng() * 6.28, rng() * 6.28, rng() * 6.28]
  // glare blob, vignette, exposure / white balance
  const gx = W * (0.2 + 0.6 * rng()), gy = H * (0.1 + 0.5 * rng()), gr = 90 + rng() * 150, gA = P.glare * (rng() < 0.85 ? 1 : 0.3)
  const gains = [1, 2, 3].map(() => 1 + (rng() * 2 - 1) * P.gain), gamma = 1 + (rng() * 2 - 1) * P.gain * 0.8, lift = P.gain * 40 * rng()
  const rgb = Buffer.alloc(W * H * 3)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4, d = (y * W + x) * 3
    const u = (x * Math.cos(ang) + y * Math.sin(ang)) / beatP, v = (x * Math.cos(fAng) + y * Math.sin(fAng)) / fineP
    const gd = ((x - gx) ** 2 + (y - gy) ** 2) / (gr * gr)
    const glare = gA * Math.exp(-gd) * 255
    const rr = Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2)) / Math.SQRT2
    const vig = 1 - P.vignette * rr * rr
    const nl = gauss(rng) * P.noise
    for (let c = 0; c < 3; c++) {
      let val = out[o + c]
      val *= 1 + P.moire * (0.8 * Math.sin(2 * Math.PI * u + ph[c]) + 0.4 * Math.sin(2 * Math.PI * v + ph[(c + 1) % 3]))
      val += glare * (0.9 + 0.1 * c / 2)
      val *= vig * gains[c]
      val = 255 * Math.pow(clamp(val, 0, 255) / 255, gamma) + lift
      val += nl + gauss(rng) * P.noise * 0.5
      rgb[d + c] = clamp(Math.round(val), 0, 255)
    }
  }
  const jpeg = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: P.jpeg }).toBuffer()
  const final = await sharp(jpeg).raw().toBuffer()
  return { rgb: final, map: (x, y) => applyH(Hm, x, y) }
}

// ---------- OCR-readable flag ----------
// `legible` (title printed in the tile) is by construction / hand labelling. `ocrReadable` is the stricter, "easy subset" flag:
// Tesseract can read the title off the CLEAN tile with generous preprocessing (3x upscale, plain and inverted). It is a property
// of the art, not of the pipeline under test, and says how much of the gap is stylised-logo OCR rather than detection.
async function legibleOnClean(worker, scene, tile) {
  const { x, y, w, h } = tile.box
  const raw = crop(scene, W, Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  for (const inv of [false, true]) {
    let s = sharp(raw, { raw: { width: Math.round(w), height: Math.round(h), channels: 4 } }).removeAlpha().greyscale().resize(Math.round(w * 3), Math.round(h * 3), { kernel: 'lanczos3' })
    if (inv) s = s.normalise().negate()
    const { data } = await worker.recognize(await s.png().toBuffer(), {}, { blocks: true })
    const lines = linesOf(data).map(l => l.words.filter(wd => wd.confidence > 40).map(wd => wd.text).join(' ')).filter(Boolean)
    const cands = [...lines, ...lines.slice(1).map((l, i) => `${lines[i]} ${l}`), lines.join(' ')]
    if (cands.some(c => similarity(c, tile.title) >= 0.8)) return true
  }
  return false
}

// ---------- main ----------
async function main() {
  if (!fs.existsSync(path.join(postersDir, 'manifest.json'))) throw new Error('No posters cached. Run: node scripts/ar-bench/fetch.mjs')
  fs.mkdirSync(outDir, { recursive: true })
  const posters = await loadPosters()
  if (posters.length < 40) throw new Error(`Only ${posters.length} posters cached; need at least 40 (run node scripts/ar-bench/fetch.mjs).`)
  const builders = { landscape: sceneLandscape, caption: sceneCaption, top10: sceneTop10 }
  const pool = await pooled(WORKERS, async () => { const w = await createWorker('eng'); await w.setParameters({ tessedit_pageseg_mode: '11' }); return w })
  const scenes = []
  for (const [li, layout] of LAYOUTS.entries()) {
    for (let n = 1; n <= PER_LAYOUT; n++) {
      const seed = li * 1000 + n
      const clean = await builders[layout](posters, mulberry32(seed))
      const full = clean.tiles.filter(t => (t.overlay || t.titleInFrame) && !t.partial)
      const res = await pool.run(full, (worker, t) => legibleOnClean(worker, clean.buf, t))
      full.forEach((t, i) => { t.ocrReadable = res[i] })
      for (const level of LEVELS) {
        const id = `${layout}-${n}-${level}`
        let rgb, map
        if (level === 'clean') {
          rgb = Buffer.alloc(W * H * 3)
          for (let i = 0; i < W * H; i++) { rgb[i * 3] = clean.buf[i * 4]; rgb[i * 3 + 1] = clean.buf[i * 4 + 1]; rgb[i * 3 + 2] = clean.buf[i * 4 + 2] }
          map = (x, y) => [x, y]
        } else ({ rgb, map } = await degrade(clean.buf, level, mulberry32(seed * 7 + LEVELS.indexOf(level))))
        const aabb = quad => {
          const pts = quad.map(([x, y]) => map(x, y))
          const x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1]))
          const cx0 = clamp(x0, 0, W), cx1 = clamp(x1, 0, W), cy0 = clamp(y0, 0, H), cy1 = clamp(y1, 0, H)
          return { pts, box: { x: Math.round(cx0), y: Math.round(cy0), w: Math.round(cx1 - cx0), h: Math.round(cy1 - cy0) }, visible: (cx1 - cx0) * (cy1 - cy0) / Math.max(1, (x1 - x0) * (y1 - y0)) }
        }
        const tiles = clean.tiles.map(t => {
          const a = aabb(t.quad)
          // the clean-scene visibility (cut by the frame edge) and the photo warp's own clipping both count
          const visible = +Math.min(t.visible, a.visible).toFixed(3)
          return { title: t.title, imdbID: t.imdbID, year: t.year, box: a.box, quad: a.pts.map(p => p.map(v => +v.toFixed(1))), visible, partial: visible < 0.7, focused: t.focused, overlay: t.overlay, legible: t.legibleBy !== 'none', legibleBy: t.legibleBy, titleInFrame: t.titleInFrame, ocrReadable: t.ocrReadable, font: t.font ?? null, caption: t.caption ?? null }
        }).filter(t => t.box.w > 2 && t.box.h > 2)
        const ignore = clean.ignore.map(r => aabb([[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]).box)
        const file = `${id}.png`
        await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 6 }).toFile(path.join(outDir, file))
        scenes.push({ id, layout, level, seed, file, width: W, height: H, tiles, ignore })
      }
      console.log(`rendered ${layout} #${n} (${clean.tiles.length} tiles, ${full.filter(t => t.ocrReadable).length}/${full.length} title-bearing tiles OCR-readable on the clean art)`)
    }
  }
  await pool.close()
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({ version: 1, width: W, height: H, knownTitles: posters.map(p => p.title), scenes }))
  console.log(`done: ${scenes.length} scenes in .cache/ar-scenes (${LAYOUTS.length} layouts x ${PER_LAYOUT} x ${LEVELS.length} levels)`)
}

main().catch(e => { console.error(e); process.exit(1) })
