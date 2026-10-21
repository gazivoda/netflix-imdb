'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createWorker, type Worker as OcrWorker } from 'tesseract.js'
import ArExplainer from '@/components/ar/ArExplainer'
import { ImdbChip, RtChip } from '@/components/ScoreChip'
import { RgbaImage } from '@/lib/card-hash'
import { Box, Track } from '@/lib/card-tracker'
import { findCards, findCardsWithQuads } from '@/lib/ar/card-finder'
import { AutoLabeler, titleSimilarity } from '@/lib/ar/auto-label'
import {
  TileInfo,
  buildDebugReport,
  debugFileStem,
  emptyTileInfo,
  ratingBadge,
  tileKey,
  tileLabel,
} from '@/lib/ar/debug-capture'
import { createTileReader, tesseractEngine } from '@/lib/ar/tile-reader'
import { ArFrameResult, ArPipeline } from '@/lib/ar/pipeline'
import { KeyValueStore, clearIndex, enrolCard, loadIndex } from '@/lib/ar/enrol-store'
import { addConfirmed, buildVocabulary, clearConfirmed } from '@/lib/ar/confirmed-titles'
import type { Vocabulary } from '@/lib/ar/title-vocab'
import { CropHistory, MIN_READABLE_TILE_PX, boxesSettled, medianWidth } from '@/lib/ar/sharpness'
import { Quad, quadInCrop, quadIsSkewed, quadSize } from '@/lib/ar/tile-capture'
import { warpQuad } from '@/lib/ar/rectify'
import { ZoomRange, openCamera, setZoom, tuneTrack } from '@/lib/ar/camera-setup'
import { GUIDE_ASPECT, guideRect, sampleToGuide, stageToVideoRect, useRatings, Size } from '@/lib/ar/use-ratings'
import s from './ar.module.css'

// The guide region is resampled to this fixed size, so every box the pipeline returns is in these pixels.
const SAMPLE: Size = { w: 640, h: 360 }
const FRAME_MS = 1000 / 9 // ~9 analysis fps; the render loop itself keeps running at display rate
const GUIDE_FILL = 0.92
const OCR_LOAD_TIMEOUT_MS = 45_000 // the reader downloads its language data on first use; past this it is shown as failed, with a Retry
const HISTORY_EVERY = 2 // keep a crop of each unread tile every this many analysis ticks (sharpest of the last few is read)
const HISTORY_TILES = 8 // at most this many tiles (largest first) are tracked for crops, to bound the per-tick copy cost

// Source-video rectangle of a card box given in analysis (SAMPLE) pixels, so OCR reads camera pixels, not the 640px sample.
function cardVideoRect(box: Box, guideSrc: Box): Box {
  const sx = guideSrc.w / SAMPLE.w
  const sy = guideSrc.h / SAMPLE.h
  return { x: guideSrc.x + box.x * sx, y: guideSrc.y + box.y * sy, w: box.w * sx, h: box.h * sy }
}

// Resolves to null for "not in the catalogue" and THROWS when the service itself failed, so the two can be told apart on screen.
async function lookupTitle(title: string): Promise<{ title: string; voteCount: number | null; year?: string; type?: string } | null> {
  const res = await fetch('/api/ratings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titles: [title] }),
  })
  if (!res.ok) throw new Error(`ratings ${res.status}`)
  const [item] = await res.json()
  // voteCount feeds the AutoLabeler's minVotes guard: the catalogue "finds" an obscure film for almost any word read off a tile.
  return item?.found && typeof item.title === 'string'
    ? {
        title: item.title,
        voteCount: typeof item.voteCount === 'number' ? item.voteCount : null,
        year: typeof item.year === 'string' ? item.year : undefined,
        type: typeof item.type === 'string' ? item.type : undefined,
      }
    : null
}

const INFO_TTL_MS = 4000 // keep a tile's read status this long after it was last seen

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type))
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

interface Frame {
  tracks: Track[]
  unknown: { box: Box; crop: RgbaImage }[]
  findMs: number
  hashMs: number
  fps: number
  /** Median width of the tiles on screen in native camera pixels (0 = no tiles). */
  nativeTileW: number
}
const EMPTY_FRAME: Frame = { tracks: [], unknown: [], findMs: 0, hashMs: 0, fps: 0, nativeTileW: 0 }

type Support = 'checking' | 'ok' | 'insecure' | 'unsupported'

// localStorage can throw (blocked site data); fall back to a per-session map so the page still works.
function openStore(): KeyValueStore {
  try {
    const ls = window.localStorage
    ls.getItem('ar-probe')
    return ls
  } catch {
    const m = new Map<string, string>()
    return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k) }
  }
}

function Thumb({ image }: { image: RgbaImage }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0)
  }, [image])
  return <canvas ref={ref} width={image.width} height={image.height} className={s.thumb} aria-hidden />
}

export default function ArRatings() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pipelineRef = useRef<ArPipeline | null>(null)
  const storeRef = useRef<KeyValueStore | null>(null)
  const stageSizeRef = useRef<Size>({ w: 0, h: 0 })
  const mountedRef = useRef(true)
  const ocrRef = useRef<OcrWorker | null>(null)
  const vocabRef = useRef<Vocabulary | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const lookupMetaRef = useRef(new Map<string, { year?: string; type?: string }>())
  // what the text reader saw on cards that have since been labelled, for the debug report (the tile's own info is gone by then)
  const learnedReadRef = useRef(new Map<string, { raw: string; candidates: string[] }>())

  const [support, setSupport] = useState<Support>('checking')
  const [streaming, setStreaming] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<Size>({ w: 0, h: 0 })
  const [frame, setFrame] = useState<Frame>(EMPTY_FRAME)
  // Debug tools are for tuning, not for visitors: they exist only on /camera-vision/ar?debug=1.
  const [debugAllowed, setDebugAllowed] = useState(false)
  const [debug, setDebug] = useState(false)
  const [indexSize, setIndexSize] = useState(0)
  const [enrol, setEnrol] = useState<{ crop: RgbaImage } | null>(null)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [auto, setAuto] = useState(true)
  const [ocrReady, setOcrReady] = useState(false)
  const [ocrFailed, setOcrFailed] = useState<string | null>(null)
  const [ocrAttempt, setOcrAttempt] = useState(0)
  const [zoom, setZoomRange] = useState<ZoomRange | null>(null)

  const autoRef = useRef(true)
  autoRef.current = auto
  const ocrReadyRef = useRef(false)
  ocrReadyRef.current = ocrReady
  const indexSizeRef = useRef(0)
  indexSizeRef.current = indexSize
  // Read status per unknown tile, keyed by tileKey(). A ref, not state: the frame loop re-renders at ~9 fps anyway.
  const infosRef = useRef(new Map<string, { info: TileInfo; seen: number }>())
  const captureReqRef = useRef(false)
  const [capturing, setCapturing] = useState(false)
  const ratings = useRatings()
  const guide = useMemo(() => (stage.w > 0 ? guideRect(stage, GUIDE_FILL, GUIDE_ASPECT) : null), [stage])
  const live = streaming && videoReady

  // One-time setup: support check, pipeline, persisted index.
  useEffect(() => {
    mountedRef.current = true
    setDebugAllowed(new URLSearchParams(window.location.search).get('debug') === '1')
    if (!window.isSecureContext) setSupport('insecure')
    else if (!navigator.mediaDevices?.getUserMedia) setSupport('unsupported')
    else setSupport('ok')

    const store = openStore()
    storeRef.current = store
    vocabRef.current = buildVocabulary(store)
    const pipeline = new ArPipeline({ findCards, findCardsDetailed: findCardsWithQuads })
    const index = loadIndex(store)
    pipeline.setIndex(index)
    pipelineRef.current = pipeline
    setIndexSize(index.length)

    return () => {
      mountedRef.current = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  // Stage size drives both the guide overlay and the sampling rectangle.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const size = { w: el.clientWidth, h: el.clientHeight }
      stageSizeRef.current = size
      setStage(size)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    trackRef.current = null
    setZoomRange(null)
    if (videoRef.current) videoRef.current.srcObject = null
    pipelineRef.current?.reset()
    infosRef.current.clear()
    captureReqRef.current = false
    setCapturing(false)
    setStreaming(false)
    setVideoReady(false)
    setFrame(EMPTY_FRAME)
    setEnrol(null)
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)
    try {
      // Highest practical resolution first (see camera-setup.ts): the pixels per card decide whether a title can be read at all.
      const stream = await openCamera(navigator.mediaDevices)
      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return
      }
      streamRef.current = stream
      const track = stream.getVideoTracks()[0]
      trackRef.current = track ?? null
      if (track) void tuneTrack(track).then(t => { if (mountedRef.current && trackRef.current === track) setZoomRange(t.zoom) })
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        video.play().catch(() => {}) // autoplay is already requested via the attribute; this is a nudge for Safari
      }
      setStreaming(true)
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')
      setError(denied ? 'Camera access was denied. Allow it in your browser settings and try again.' : 'Could not start the camera.')
    }
  }, [])

  // OCR worker for auto-labelling; only loaded while the camera is live and auto-read is on. A failed or very slow load is shown
  // (with a Retry), never swallowed: without the reader nothing is labelled and the user must be told why.
  useEffect(() => {
    if (!live || !auto) return
    let cancelled = false
    let timedOut = false
    setOcrFailed(null)
    const timer = setTimeout(() => {
      timedOut = true
      if (!cancelled) setOcrFailed('The text reader is taking too long to load.')
    }, OCR_LOAD_TIMEOUT_MS)
    createWorker('eng')
      .then(worker => {
        clearTimeout(timer)
        if (cancelled || timedOut) return void worker.terminate()
        ocrRef.current = worker
        setOcrReady(true)
      })
      .catch(() => {
        clearTimeout(timer)
        if (!cancelled && !timedOut) setOcrFailed('The text reader could not be loaded.')
      })
    return () => {
      cancelled = true
      clearTimeout(timer)
      setOcrReady(false)
      ocrRef.current?.terminate()
      ocrRef.current = null
    }
  }, [live, auto, ocrAttempt])

  // Analysis loop: rAF at display rate, heavy work only every FRAME_MS. Cleaned up with the effect.
  useEffect(() => {
    const video = videoRef.current
    const pipeline = pipelineRef.current
    if (!live || !video || !pipeline) return

    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE.w
    canvas.height = SAMPLE.h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      setError('This browser cannot read camera frames (2D canvas unavailable).')
      return
    }

    let raf = 0
    let last = 0
    let fps = 0
    let failures = 0

    const ocrCanvas = document.createElement('canvas')
    const ocrCtx = ocrCanvas.getContext('2d', { willReadFrequently: true })
    let guideSrc: Box = { x: 0, y: 0, w: video.videoWidth, h: video.videoHeight } // refreshed every frame below
    const readerFor = new WeakMap<OcrWorker, ReturnType<typeof createTileReader>>()

    // The last few native-pixel crops of every unread tile (each with the tile's corners): OCR reads the sharpest, not whichever
    // frame happens to be current. Corners come from the detector in analysis pixels; they are kept in crop coordinates.
    const history = new CropHistory<Quad | undefined>(3)
    const quads = new Map<string, Quad>()
    let prevBoxes: Box[] = []
    let tickNo = 0
    const grab = (box: Box, quad: Quad | undefined): { crop: RgbaImage; quad: Quad | undefined } | null => {
      if (!ocrCtx) return null
      const r = cardVideoRect(box, guideSrc)
      const w = Math.max(1, Math.round(r.w))
      const h = Math.max(1, Math.round(r.h))
      ocrCanvas.width = w
      ocrCanvas.height = h
      ocrCtx.drawImage(video, r.x, r.y, r.w, r.h, 0, 0, w, h)
      const crop = ocrCtx.getImageData(0, 0, w, h)
      return { crop, quad: quad ? quadInCrop(quad, box, w / box.w, h / box.h) : undefined }
    }

    // Reads one card: the tile's native camera pixels (not the 640px analysis sample) go to createTileReader, which runs
    // its own plan of sharpen / threshold / segmentation passes and returns ranked title candidates.
    // Everything below only depends on the { candidates, raw, ms } result.
    const read = async (box: Box): Promise<{ candidates: string[]; raw: string; ms: number }> => {
      const t0 = performance.now()
      const worker = ocrRef.current
      if (!worker || !ocrCtx) return { candidates: [], raw: '', ms: 0 }
      let reader = readerFor.get(worker)
      if (!reader) readerFor.set(worker, (reader = createTileReader(tesseractEngine(worker), { vocabulary: vocabRef.current ?? undefined })))
      // the sharpest recent crop of this tile, or a fresh one when the tile has just appeared
      const key = tileKey(box)
      const best = history.best(key, performance.now())
      const shot = best ? { crop: best.crop, quad: best.meta } : grab(box, quads.get(key))
      if (!shot) return { candidates: [], raw: '', ms: 0 }
      let image = shot.crop
      // a tilted or keystoned tile is rectified first: slanted text, and neighbour slivers in the bounding box, read worse
      if (shot.quad && quadIsSkewed(shot.quad, { x: 0, y: 0, w: shot.crop.width, h: shot.crop.height })) {
        const size = quadSize(shot.quad)
        image = warpQuad(shot.crop, shot.quad, size.w, size.h)
      }
      const res = await reader.read(image)
      return { candidates: res.candidates, raw: res.raw.replace(/\s*\n\s*/g, ' | '), ms: performance.now() - t0 }
    }

    // Per-tile status bookkeeping around the labeler. It handles one card at a time, so `current` is the card being worked on.
    const infos = infosRef.current
    let current: TileInfo | null = null
    let attempts = 0
    const touch = (box: Box, patch?: Partial<TileInfo>): TileInfo => {
      const key = tileKey(box)
      const entry = infos.get(key) ?? { info: emptyTileInfo(), seen: performance.now() }
      if (patch) Object.assign(entry.info, patch)
      infos.set(key, entry)
      return entry.info
    }
    const readTitles = async (box: Box): Promise<string[]> => {
      attempts++
      current = touch(box, { status: 'reading', candidates: [], raw: '', tried: null, matchedTitle: null, distance: null, ms: null })
      const r = await read(box)
      Object.assign(current, { candidates: r.candidates, raw: r.raw, ms: r.ms, status: r.candidates.length ? 'reading' : 'no-text' })
      return r.candidates
    }
    const lookup = async (candidate: string): Promise<{ title: string; voteCount: number | null } | null> => {
      const info = current
      if (info) info.tried = candidate
      try {
        const hit = await lookupTitle(candidate)
        if (hit) lookupMetaRef.current.set(hit.title, { year: hit.year, type: hit.type })
        if (info) {
          info.matchedTitle = hit?.title ?? null
          info.distance = hit ? 1 - titleSimilarity(candidate, hit.title) : null
        }
        return hit
      } catch (err) {
        if (info) info.status = 'lookup-failed'
        throw err
      }
    }
    // repair: OCR slips ("Money Heis!") are snapped onto a known title before the catalogue is asked, so it sees exact titles
    const labeler = new AutoLabeler({ readTitles, lookup, repair: c => vocabRef.current?.repair(c) ?? null })

    // "Save debug frame": the exact camera pixels under the guide (before any overlay, at full camera resolution, which
    // is what the reader sees) plus a JSON report of what the pipeline made of that same frame. The pixels are copied
    // in the same tick as the analysis, so the two always match.
    const snap = document.createElement('canvas')
    const saveDebugFrame = async (result: ArFrameResult, src: Box) => {
      const stem = debugFileStem(new Date())
      try {
        const w = Math.max(1, Math.round(src.w))
        const h = Math.max(1, Math.round(src.h))
        snap.width = w
        snap.height = h
        const sctx = snap.getContext('2d')
        if (!sctx) throw new Error('no 2d context')
        sctx.drawImage(video, src.x, src.y, src.w, src.h, 0, 0, w, h)
        const stageSize = stageSizeRef.current
        const unknownTiles = result.unknownCards.map(u => ({ box: u.box, info: infos.get(tileKey(u.box))?.info ?? emptyTileInfo() }))
        const trackTiles = result.tracks.map(t => ({
          box: t.box,
          info: { ...emptyTileInfo(), status: 'learned' as const, matchedTitle: t.title, ...(t.title ? learnedReadRef.current.get(t.title.toLowerCase()) : undefined) },
          track: { trackId: t.trackId, title: t.title, missed: t.missed },
          ratingStatus: t.title ? ratings.get(t.title).status : null,
        }))
        const report = buildDebugReport({
          now: new Date(),
          video: { width: video.videoWidth, height: video.videoHeight },
          stage: stageSize,
          guideStage: guideRect(stageSize, GUIDE_FILL, GUIDE_ASPECT),
          guideSrc: src,
          sample: SAMPLE,
          image: { file: `${stem}.png`, width: w, height: h },
          tiles: [...unknownTiles, ...trackTiles],
          timings: { fps, findMs: result.timings.findMs, hashMs: result.timings.hashMs },
          reader: { auto: autoRef.current, ready: ocrReadyRef.current },
          learnedCards: indexSizeRef.current,
          userAgent: navigator.userAgent,
        })
        const png = await toBlob(snap, 'image/png')
        if (!png) throw new Error('png encode failed')
        download(png, `${stem}.png`)
        download(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), `${stem}.json`)
        if (mountedRef.current) setNote(`Saved ${stem}.png and ${stem}.json. Send both back to tune the reader.`)
      } catch (err) {
        console.error('debug capture failed', err)
        if (mountedRef.current) setNote('Could not save the debug frame.')
      } finally {
        if (mountedRef.current) setCapturing(false)
      }
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (now - last < FRAME_MS) return
      const stageSize = stageSizeRef.current
      if (!video.videoWidth || stageSize.w === 0) return
      const dt = now - last
      last = now

      try {
        // The video is object-fit: cover, so the pixels under the guide are a cropped, scaled sub-rectangle.
        const src = stageToVideoRect(guideRect(stageSize, GUIDE_FILL, GUIDE_ASPECT), stageSize, { w: video.videoWidth, h: video.videoHeight })
        guideSrc = src
        ctx.drawImage(video, src.x, src.y, src.w, src.h, 0, 0, SAMPLE.w, SAMPLE.h)
        const result = pipeline.processFrame(ctx.getImageData(0, 0, SAMPLE.w, SAMPLE.h))

        const instant = 1000 / dt
        fps = fps ? fps * 0.8 + instant * 0.2 : instant
        failures = 0

        const titles = result.tracks.flatMap(t => (t.title ? [t.title] : []))
        if (titles.length) ratings.request(titles) // cache de-dupes; also re-asks after error cooldowns

        for (const u of result.unknownCards) {
          const entry = infos.get(tileKey(u.box))
          if (entry) entry.seen = now
        }
        for (const [key, entry] of infos) if (now - entry.seen > INFO_TTL_MS && entry.info.status !== 'reading') infos.delete(key)

        // Corners and recent crops of the unread tiles; OCR waits until they stop moving (a blurred crop reads worse than none).
        quads.clear()
        for (const u of result.unknownCards) if (u.quad) quads.set(tileKey(u.box), u.quad)
        const boxesNow = result.unknownCards.map(u => u.box)
        const settled = boxesSettled(prevBoxes, boxesNow)
        prevBoxes = boxesNow
        if (autoRef.current && ocrRef.current && ++tickNo % HISTORY_EVERY === 0) {
          const seenKeys = new Set<string>()
          for (const u of [...result.unknownCards].sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h).slice(0, HISTORY_TILES)) {
            const key = tileKey(u.box)
            if (seenKeys.has(key)) continue
            seenKeys.add(key)
            const g = grab(u.box, u.quad)
            if (g) history.push(key, g.crop, now, g.quad)
          }
        }
        history.retain(result.unknownCards.map(u => tileKey(u.box)))

        if (autoRef.current && ocrRef.current && result.unknownCards.length && settled) {
          const before = attempts
          const p = labeler.next(result.unknownCards)
          const started = attempts !== before // next() calls readTitles synchronously when it takes a card
          const attempted = current
          void p.then(hit => {
            if (started && attempted && attempted.status === 'reading') {
              attempted.status = hit ? 'learned' : attempted.candidates.length ? 'not-in-catalogue' : 'no-text'
            }
            const store = storeRef.current
            if (!hit || !store || !mountedRef.current) return
            // the catalogue confirmed this title: remember it on this device so the next session already knows it
            try {
              const meta = lookupMetaRef.current.get(hit.title)
              addConfirmed(store, { title: hit.title, ...meta })
              vocabRef.current?.add([hit.title])
              if (attempted) learnedReadRef.current.set(hit.title.toLowerCase(), { raw: attempted.raw, candidates: attempted.candidates })
            } catch {
              // remembering is a convenience; labelling goes on without it
            }
            try {
              const index = enrolCard(store, hit.title, hit.item.crop)
              pipeline.setIndex(index)
              setIndexSize(index.length)
              ratings.request([hit.title])
              setNote(`Read "${hit.title}" off a card and learned it.`)
            } catch {
              setNote('Read a title but could not save it (storage is full or blocked).')
            }
          })
        }

        if (captureReqRef.current) {
          captureReqRef.current = false
          void saveDebugFrame(result, src)
        }

        const nativeTileW = Math.round(medianWidth([...boxesNow, ...result.tracks.map(t => t.box)]) * (src.w / SAMPLE.w))
        setFrame({ tracks: result.tracks, unknown: result.unknownCards, findMs: result.timings.findMs, hashMs: result.timings.hashMs, fps, nativeTileW })
      } catch (err) {
        console.error('AR frame failed', err)
        if (++failures >= 5) {
          cancelAnimationFrame(raf)
          setError('Frame analysis kept failing, so scanning was stopped. Restart the camera to retry.')
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      history.clear()
    }
  }, [live, ratings])

  const submitEnrol = (e: FormEvent) => {
    e.preventDefault()
    const name = title.trim()
    const store = storeRef.current
    if (!name || !enrol || !store) return
    try {
      const index = enrolCard(store, name, enrol.crop)
      pipelineRef.current?.setIndex(index)
      setIndexSize(index.length)
      ratings.request([name])
      setNote(`Enrolled "${name}".`)
    } catch {
      setNote('Could not save that card (storage is full or blocked).')
    }
    setEnrol(null)
    setTitle('')
  }

  const clearEnrolled = () => {
    const store = storeRef.current
    if (!store || !window.confirm('Forget all learned cards on this device?')) return
    clearIndex(store)
    clearConfirmed(store)
    learnedReadRef.current.clear()
    infosRef.current.clear()
    pipelineRef.current?.setIndex([])
    pipelineRef.current?.reset()
    setIndexSize(0)
    setFrame(f => ({ ...f, tracks: [], unknown: [] }))
    setNote('Forgot all learned cards.')
  }

  const requestCapture = () => {
    if (!live || capturing) return
    captureReqRef.current = true
    setCapturing(true)
    // The frame loop performs the capture on its next analysis tick; if it never does (tab hidden), don't stay stuck.
    setTimeout(() => {
      if (!captureReqRef.current) return
      captureReqRef.current = false
      setCapturing(false)
      setNote('Could not capture a frame. Is the camera running?')
    }, 3000)
  }

  const readerCtx = { auto, ocrReady }
  const tileCount = frame.tracks.length + frame.unknown.length
  // Measured, not guessed: the median card width in camera pixels. Under ~220 px a title logo is too small for OCR to read.
  const tooSmall = live && tileCount >= 2 && frame.nativeTileW > 0 && frame.nativeTileW < MIN_READABLE_TILE_PX

  const changeZoom = (value: number) => {
    setZoomRange(z => (z ? { ...z, value } : z))
    const track = trackRef.current
    if (track) void setZoom(track, value)
  }
  const retryReader = () => {
    setOcrFailed(null)
    setOcrAttempt(n => n + 1)
  }
  const portrait = stage.h > stage.w
  const hint = !live
    ? null
    : frame.tracks.length + frame.unknown.length === 0
      ? `No cards found yet. Fill the frame with the Netflix screen, hold steady and avoid glare.${portrait ? ' Turning the phone sideways gives a bigger frame.' : ''}`
      : auto && !ocrReady && !ocrFailed
        ? 'Loading the text reader…'
        : !auto && frame.unknown.length > 0
          ? 'Auto-read is off. Tap a dashed card to type its title.'
          : null

  // Debug list: every tile on screen, numbered like the badges on the video.
  const unknownSorted = frame.unknown
    .map(u => ({ ...u, info: infosRef.current.get(tileKey(u.box))?.info ?? emptyTileInfo() }))
    .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)

  return (
    <main id="main" tabIndex={-1} className={s.main}>
      <div className={s.head}>
        <div className={s.headText}>
          <Link href="/camera-vision" className={s.back}>← Camera Vision</Link>
          <h1 className={`ds-display ${s.title}`}>AR <em className="ds-serif">Ratings</em></h1>
          <p className={s.sub}>
            Point your phone at the TV, line the Netflix screen up with the frame, and IMDb and Rotten Tomatoes scores appear on the cards whose title it can read.
            {live && <span className={s.processing}><span className={`${s.dot} ${s.dotLive}`} aria-hidden />Scanning</span>}
          </p>
        </div>

        <div className={s.actions}>
          {!streaming ? (
            <button onClick={startCamera} disabled={support !== 'ok'} className={`ds-btn ds-btn-signal ${s.btn}`}>Start Camera</button>
          ) : (
            <button onClick={stopCamera} className={`ds-btn ${s.btn} ${s.btnInk}`}>Stop Camera</button>
          )}
          <button onClick={() => setAuto(a => !a)} aria-pressed={auto} className={`ds-btn ${s.btn} ${auto ? s.btnTeal : ''}`}>
            {auto ? 'Auto-read: on' : 'Auto-read: off'}
          </button>
          {debugAllowed && (
            <button onClick={() => setDebug(d => !d)} aria-pressed={debug} className={`ds-btn ${s.btn} ${debug ? s.btnTeal : ''}`}>
              {debug ? 'Hide Debug' : 'Show Debug'}
            </button>
          )}
        </div>
      </div>

      <div ref={stageRef} className={s.stage}>
        <video ref={videoRef} autoPlay playsInline muted className={s.video} onPlaying={() => setVideoReady(true)} />

        {guide && (
          <div
            className={s.guide}
            data-live={live || undefined}
            style={{ left: guide.x, top: guide.y, width: guide.w, height: guide.h }}
          >
            <span className={s.guideLabel} aria-hidden>Align the TV screen with this frame</span>

            {live && !enrol && (() => {
              const used = new Set<string>()
              return unknownSorted.map((u, i) => {
                let key = tileKey(u.box)
                while (used.has(key)) key += '+'
                used.add(key)
                const b = sampleToGuide(u.box, SAMPLE, guide)
                const label = tileLabel(u.info.status, readerCtx)
                const compact = b.w < 96
                return (
                  <button
                    key={key}
                    type="button"
                    className={s.unknown}
                    data-status={u.info.status}
                    style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
                    aria-label={`Unrecognised card ${i + 1}: ${label.full}. Tap to type its title.`}
                    onClick={() => { setNote(null); setEnrol({ crop: u.crop }) }}
                  >
                    <span className={s.unknownStatus}>{debug ? `#${i + 1} ` : ''}{compact ? label.short : label.full}</span>
                    {!compact && b.h >= 64 && (
                      <span className={s.unknownHint} aria-hidden>
                        {u.info.status === 'no-text' || u.info.status === 'not-in-catalogue' ? 'tap to type it' : 'tap to type'}
                      </span>
                    )}
                  </button>
                )
              })
            })()}

            {live && frame.tracks.map(t => {
              if (!t.title) return null
              const b = sampleToGuide(t.box, SAMPLE, guide)
              const r = ratings.get(t.title)
              const badge = ratingBadge(r)
              const compact = b.w < 110
              return (
                <div
                  key={t.trackId}
                  className={s.chips}
                  data-stale={t.missed > 0 || undefined}
                  data-compact={compact || undefined}
                  style={{
                    width: b.w,
                    maxHeight: b.h,
                    transform: `translate(${b.x}px, ${b.y}px)`,
                    ['--chip-fs' as string]: `${Math.max(8, Math.min(14, b.w * 0.11, b.h * 0.2))}px`,
                  }}
                >
                  {badge.imdb && <ImdbChip value={badge.imdb} />}
                  {badge.rt && <RtChip value={badge.rt} />}
                  {badge.pill && <span className={s.pill} data-tone={badge.pill.tone} title={badge.pill.title}>{badge.pill.text}</span>}
                  {debug && !compact && <span className={s.pill}>{t.title}</span>}
                </div>
              )
            })}
          </div>
        )}

        {debug && (
          <div className={s.hud} aria-live="off">
            <div>{frame.fps.toFixed(1)} fps</div>
            <div>find {frame.findMs.toFixed(1)} ms</div>
            <div>hash {frame.hashMs.toFixed(1)} ms</div>
            <div>tracks {frame.tracks.length} / unknown {frame.unknown.length}</div>
            <div>text reader {auto ? (ocrReady ? 'ready' : 'loading') : 'off'}</div>
          </div>
        )}

        {enrol && (
          <form className={`ds-card ${s.enrol}`} onSubmit={submitEnrol}>
            <Thumb image={enrol.crop} />
            <label className={s.enrolField}>
              <span className={`ds-label ${s.enrolLabel}`}>Title of this card</span>
              <input
                className={s.input}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Stranger Things"
                autoFocus
                autoComplete="off"
                autoCapitalize="words"
                maxLength={120}
              />
            </label>
            <div className={s.enrolActions}>
              <button type="submit" disabled={!title.trim()} className={`ds-btn ds-btn-signal ${s.btn}`}>Save</button>
              <button type="button" className={`ds-btn ${s.btn}`} onClick={() => { setEnrol(null); setTitle('') }}>Cancel</button>
            </div>
          </form>
        )}

        {!streaming && (
          <div className={s.idle}>
            <div className={s.idleInner}>
              <div className={s.idleMark} aria-hidden />
              <div className={`ds-display ${s.idleTitle}`}>
                {support === 'insecure' ? 'HTTPS required' : support === 'unsupported' ? 'No camera API' : 'Camera not active'}
              </div>
              <p className={s.idleHint}>
                {support === 'insecure'
                  ? 'Browsers only allow camera access on secure pages. Open this page over HTTPS (or localhost).'
                  : support === 'unsupported'
                    ? 'This browser does not expose a camera API.'
                    : 'Press "Start Camera" and point the rear camera at the TV.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {hint && <p className={s.hint} role="status">{hint}</p>}
      {tooSmall && (
        <p className={s.hint} role="status">
          Move closer or zoom in. The cards are only about {frame.nativeTileW} px wide on the camera, and titles need roughly {MIN_READABLE_TILE_PX} px or more to be read.
        </p>
      )}
      {ocrFailed && auto && (
        <p className={s.error} role="alert">
          {ocrFailed} It downloads its language data the first time it runs, so it needs a connection. You can still tap a dashed card to type its title.{' '}
          <button type="button" onClick={retryReader} className={`ds-btn ${s.btn}`}>Retry</button>
        </p>
      )}

      <div className={s.tools}>
        {zoom && live && (
          <label className={s.zoom}>
            <span className="ds-label">Zoom</span>
            <input type="range" min={zoom.min} max={zoom.max} step={zoom.step} value={zoom.value} onChange={e => changeZoom(Number(e.target.value))} aria-label="Camera zoom" />
          </label>
        )}
        {debugAllowed && (
          <button onClick={requestCapture} disabled={!live || capturing} className={`ds-btn ${s.btn}`}>
            {capturing ? 'Saving…' : 'Save debug frame'}
          </button>
        )}
        <button onClick={clearEnrolled} disabled={indexSize === 0} className={`ds-btn ${s.btn}`}>
          Reset learned cards ({indexSize})
        </button>
      </div>

      {(error || note) && (
        <p className={error ? s.error : s.note} role={error ? 'alert' : 'status'}>{error ?? note}</p>
      )}

      {debug && live && (
        <ul className={s.debugList} aria-label="Tiles on screen">
          {unknownSorted.length === 0 && frame.tracks.length === 0 && <li>No tiles detected.</li>}
          {unknownSorted.map((u, i) => (
            <li key={i}>
              <strong>#{i + 1}</strong> {tileLabel(u.info.status, readerCtx).full}
              {u.info.ms != null && ` · ${Math.round(u.info.ms)} ms`}
              {u.info.raw && <> · saw <code>{u.info.raw.slice(0, 80)}</code></>}
              {u.info.candidates.length > 0 && <> · candidates <code>{u.info.candidates.slice(0, 3).join(' / ')}</code></>}
              {u.info.tried && <> · tried <code>{u.info.tried}</code>{u.info.matchedTitle ? <> → <code>{u.info.matchedTitle}</code> (distance {u.info.distance?.toFixed(2)})</> : ' → no match'}</>}
            </li>
          ))}
          {frame.tracks.filter(t => t.title).map(t => (
            <li key={`t${t.trackId}`}>
              <strong>known</strong> <code>{t.title}</code> · ratings {ratings.get(t.title as string).status}
            </li>
          ))}
        </ul>
      )}

      <div className={`ds-card ${s.panel}`}>
        <h2 className={`ds-display ${s.panelTitle}`}>Learned cards</h2>
        <p className={s.panelBody}>
          <strong>{indexSize}</strong> {indexSize === 1 ? 'card' : 'cards'} stored on this device. Cards are matched by their artwork, so each one
          is learned once. With auto-read on, the app reads the title off the card in your browser and looks it up in the ratings catalogue; every unrecognised
          card shows why it is not labelled yet. If it can&apos;t be read, tap the dashed card and type the title. Camera frames stay on your device: only
          the title text is sent to look up ratings.
          {debugAllowed && <> &quot;Save debug frame&quot; downloads the camera pixels under the frame plus a report of what was detected, so real captures can be used for tuning.</>}
        </p>
      </div>

      <p className={s.foot}>
        AR mode is experimental: it has not yet been measured on many real TVs. A title can only be read when it is printed legibly on the card and
        the card is big enough in the camera, so some cards stay unlabelled; tap a dashed card to type its title.
      </p>

      <ArExplainer />
    </main>
  )
}
