// Diagnostics for the AR page: per-tile read status, rating-chip states, and the JSON report that goes with a
// "Save debug frame" download (the raw guide-region PNG is produced by the page; this file is pure and DOM-free).
// Real captures are what tuning needs, so the report records everything needed to replay a frame offline.

import type { Box } from '../card-tracker'
import type { RatingState } from './use-ratings'

// ---------------------------------------------------------------- tile status

export type TileStatus =
  | 'waiting' // detected, not read yet
  | 'reading' // OCR / catalogue lookup in flight
  | 'no-text' // OCR ran and produced no title-like text
  | 'not-in-catalogue' // text was read but the catalogue has no near-identical title
  | 'lookup-failed' // text was read but the ratings service could not be reached
  | 'learned' // title confirmed; the card is recognised by its artwork from now on

export interface TileInfo {
  status: TileStatus
  candidates: string[] // title-like strings OCR produced, best first
  raw: string // everything OCR saw on the tile (all passes), for tuning
  tried: string | null // last candidate sent to the catalogue
  matchedTitle: string | null // what the catalogue answered (accepted or not)
  distance: number | null // 1 - similarity(tried, matchedTitle); 0 = identical
  ms: number | null // time spent reading this tile
}

export function emptyTileInfo(): TileInfo {
  return { status: 'waiting', candidates: [], raw: '', tried: null, matchedTitle: null, distance: null, ms: null }
}

// Same quantisation the AutoLabeler uses to say "this is the same card" across jittery frames.
export function tileKey(box: Box, cell = 48): string {
  return `${Math.round((box.x + box.w / 2) / cell)}:${Math.round((box.y + box.h / 2) / cell)}`
}

export interface TileLabelContext {
  auto: boolean // auto-read switched on
  ocrReady: boolean // the OCR worker has finished loading
}

// `full` for roomy tiles and screen readers, `short` for tiles only a few dozen px wide.
export function tileLabel(status: TileStatus, ctx: TileLabelContext): { full: string; short: string } {
  switch (status) {
    case 'reading':
      return { full: 'reading…', short: 'read…' }
    case 'no-text':
      return { full: 'no readable title', short: 'no title' }
    case 'not-in-catalogue':
      return { full: 'not in catalogue', short: 'no match' }
    case 'lookup-failed':
      return { full: 'lookup failed', short: 'offline' }
    case 'learned':
      return { full: 'learned', short: 'learned' }
    case 'waiting':
    default:
      if (!ctx.auto) return { full: 'auto-read off', short: 'off' }
      if (!ctx.ocrReady) return { full: 'loading reader…', short: 'load…' }
      return { full: 'waiting', short: 'wait' }
  }
}

// ---------------------------------------------------------------- rating chips

export type PillTone = 'loading' | 'na' | 'error'

export interface RatingBadge {
  imdb: string | null // text for the IMDb chip
  rt: string | null // text for the RT chip
  pill: { text: string; title: string; tone: PillTone } | null // shown when there is no chip to show, always says why
}

// Every rating state maps to something visible: loading, offline and "no data" must never look alike.
export function ratingBadge(r: Pick<RatingState, 'status' | 'imdb' | 'rt'>): RatingBadge {
  switch (r.status) {
    case 'ready': {
      const imdb = r.imdb != null ? r.imdb.toFixed(1) : null
      const rt = r.rt != null ? `${r.rt}%` : null
      return imdb || rt
        ? { imdb, rt, pill: null }
        : { imdb: null, rt: null, pill: { text: 'no score', title: 'The catalogue has this title but no IMDb or Rotten Tomatoes score for it', tone: 'na' } }
    }
    case 'missing':
      return { imdb: null, rt: null, pill: { text: 'n/a', title: 'No ratings found for this title (or the ratings key is missing or out of quota)', tone: 'na' } }
    case 'error':
      return { imdb: null, rt: null, pill: { text: 'offline', title: 'The ratings request failed; retrying shortly', tone: 'error' } }
    case 'idle':
    case 'loading':
    default:
      return { imdb: null, rt: null, pill: { text: '…', title: 'Loading ratings', tone: 'loading' } }
  }
}

// ---------------------------------------------------------------- debug report

export interface DebugTileInput {
  box: Box // analysis (sample) pixels
  info: TileInfo
  track?: { trackId: number; title: string | null; missed: number } | null
  ratingStatus?: RatingState['status'] | null
}

export interface DebugReportInput {
  now: Date
  video: { width: number; height: number }
  stage: { w: number; h: number }
  guideStage: Box // guide rectangle in stage CSS px
  guideSrc: Box // the same rectangle in source-video px (what the saved PNG contains)
  sample: { w: number; h: number } // analysis size the tile boxes are expressed in
  image: { file: string; width: number; height: number }
  tiles: DebugTileInput[]
  timings: { fps: number; findMs: number; hashMs: number }
  reader: { auto: boolean; ready: boolean }
  learnedCards: number
  userAgent: string
}

export interface DebugReportTile {
  box: Box // sample px
  boxImage: Box // px in the saved PNG (= native camera pixels: the PNG is the video region itself)
  /** Native camera pixels across / down the tile: what OCR actually has to work with (a title wants ~220+ across). */
  nativeWidth: number
  nativeHeight: number
  status: TileStatus
  candidates: string[]
  raw: string
  matchedTitle: string | null
  distance: number | null
  tried: string | null
  readMs: number | null
  trackId: number | null
  trackTitle: string | null
  missed: number | null
  ratingStatus: RatingState['status'] | null
}

export interface DebugReport {
  version: 1
  /** Median native width of the tiles in this frame and whether it is below the readable minimum. */
  pixels: { medianTileWidth: number; minReadable: number; tooSmall: boolean }
  timestamp: string
  video: { width: number; height: number }
  stage: { w: number; h: number }
  guide: { stage: Box; source: Box }
  sample: { w: number; h: number }
  image: { file: string; width: number; height: number }
  tiles: DebugReportTile[]
  timings: { fps: number; findMs: number; hashMs: number }
  reader: { auto: boolean; ready: boolean }
  learnedCards: number
  userAgent: string
}

const RAW_MAX = 2000
const MIN_READABLE_PX = 220 // same as sharpness.MIN_READABLE_TILE_PX; kept here so this file stays dependency-free
const CANDIDATES_MAX = 10

// JSON has no NaN/Infinity; a report must always be serialisable and parseable.
const num = (n: number): number => (Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0)
const numOrNull = (n: number | null | undefined): number | null => (n == null || !Number.isFinite(n) ? null : Math.round(n * 1000) / 1000)
const box = (b: Box): Box => ({ x: num(b.x), y: num(b.y), w: num(b.w), h: num(b.h) })
const clip = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max)}…` : s)

export function buildDebugReport(input: DebugReportInput): DebugReport {
  const sx = input.sample.w > 0 ? input.image.width / input.sample.w : 1
  const sy = input.sample.h > 0 ? input.image.height / input.sample.h : 1
  const tiles: DebugReportTile[] = input.tiles.map(t => {
    const bi = box({ x: t.box.x * sx, y: t.box.y * sy, w: t.box.w * sx, h: t.box.h * sy })
    return {
      box: box(t.box),
      boxImage: bi,
      nativeWidth: Math.round(bi.w),
      nativeHeight: Math.round(bi.h),
      status: t.info.status,
      candidates: t.info.candidates.slice(0, CANDIDATES_MAX).map(c => clip(c, 200)),
      raw: clip(t.info.raw, RAW_MAX),
      matchedTitle: t.info.matchedTitle,
      distance: numOrNull(t.info.distance),
      tried: t.info.tried,
      readMs: numOrNull(t.info.ms),
      trackId: t.track?.trackId ?? null,
      trackTitle: t.track?.title ?? null,
      missed: t.track?.missed ?? null,
      ratingStatus: t.ratingStatus ?? null,
    }
  })
  const widths = tiles.map(t => t.nativeWidth).sort((p, q) => p - q)
  const medianTileWidth = widths.length ? widths[widths.length >> 1] : 0
  return {
    version: 1,
    pixels: { medianTileWidth, minReadable: MIN_READABLE_PX, tooSmall: widths.length > 0 && medianTileWidth < MIN_READABLE_PX },
    timestamp: input.now.toISOString(),
    video: { width: input.video.width, height: input.video.height },
    stage: { w: num(input.stage.w), h: num(input.stage.h) },
    guide: { stage: box(input.guideStage), source: box(input.guideSrc) },
    sample: { ...input.sample },
    image: { ...input.image },
    tiles,
    timings: { fps: num(input.timings.fps), findMs: num(input.timings.findMs), hashMs: num(input.timings.hashMs) },
    reader: { ...input.reader },
    learnedCards: input.learnedCards,
    userAgent: input.userAgent,
  }
}

// ar-debug-20260102-030405 (UTC), shared by the .json and .png so the pair sorts together.
export function debugFileStem(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `ar-debug-${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
}
