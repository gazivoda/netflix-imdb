// Ratings for the AR overlay: a React hook over a framework-free cache, plus the guide-frame geometry
// the page needs. Only title strings ever leave the device (POST /api/ratings {titles}).

import { useMemo, useState, useSyncExternalStore } from 'react'
import type { Box } from '../card-tracker'

// ---------------------------------------------------------------- ratings cache (pure)

export interface RatingItem {
  query: string
  found: boolean
  imdbId?: string
  title?: string
  year?: string
  rating?: number
  voteCount?: number
  rtRating?: number | null
}

export interface RatingState {
  status: 'idle' | 'loading' | 'ready' | 'missing' | 'error'
  imdb?: number
  votes?: number
  rt?: number | null
  imdbId?: string
  title?: string
}

const IDLE: RatingState = Object.freeze({ status: 'idle' })
const LOADING: RatingState = Object.freeze({ status: 'loading' })
const MISSING: RatingState = Object.freeze({ status: 'missing' })
const ERRORED: RatingState = Object.freeze({ status: 'error' })

export interface RatingsCacheOptions {
  fetchBatch: (titles: string[]) => Promise<RatingItem[]>
  maxBatch?: number // API limit is 20 titles per request
  errorRetryMs?: number // network/server failure: try again after this
  missingRetryMs?: number // "not found" may just be a quota blip server-side; re-ask rarely
  batchDelayMs?: number // collect titles requested within this window into one call
  now?: () => number
  schedule?: (fn: () => void, delayMs: number) => void // injectable so tests need no timers
}

export function ratingKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

interface Entry {
  state: RatingState
  retryAt: number // only meaningful for error / missing
}

export class RatingsCache {
  private entries = new Map<string, Entry>()
  private queue = new Map<string, string>() // key -> title as first requested
  private scheduled = false
  private version = 0
  private listeners = new Set<() => void>()
  private o: Required<RatingsCacheOptions>

  constructor(opts: RatingsCacheOptions) {
    this.o = {
      maxBatch: 20,
      errorRetryMs: 15_000,
      missingRetryMs: 60_000,
      batchDelayMs: 40,
      now: Date.now,
      schedule: (fn, ms) => void setTimeout(fn, ms),
      ...opts,
    }
  }

  // Arrow properties so they can be handed to useSyncExternalStore / children unbound.
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }
  getVersion = (): number => this.version

  get = (title: string): RatingState => this.entries.get(ratingKey(title))?.state ?? IDLE

  // Cheap enough to call every frame: known, in-flight and cooling-down titles are skipped.
  request = (titles: string[]): void => {
    let queued = false
    for (const title of titles) {
      const key = ratingKey(title)
      if (!key || this.queue.has(key)) continue
      const e = this.entries.get(key)
      if (e) {
        const s = e.state.status
        if (s === 'loading' || s === 'ready') continue
        if (this.o.now() < e.retryAt) continue
      }
      // A retry keeps showing the old state (no chip flash); Infinity marks it in flight until runBatch settles it.
      if (e) e.retryAt = Infinity
      else this.entries.set(key, { state: LOADING, retryAt: 0 })
      this.queue.set(key, title.trim())
      queued = true
    }
    if (!queued) return
    this.bump()
    if (!this.scheduled) {
      this.scheduled = true
      this.o.schedule(() => void this.flush(), this.o.batchDelayMs)
    }
  }

  async flush(): Promise<void> {
    this.scheduled = false
    const pending = [...this.queue]
    this.queue.clear()
    const jobs: Promise<void>[] = []
    for (let i = 0; i < pending.length; i += this.o.maxBatch) {
      jobs.push(this.runBatch(pending.slice(i, i + this.o.maxBatch)))
    }
    await Promise.all(jobs)
  }

  private async runBatch(batch: [string, string][]): Promise<void> {
    let items: RatingItem[] | null = null
    try {
      const res = await this.o.fetchBatch(batch.map(([, title]) => title))
      if (Array.isArray(res)) items = res
    } catch {
      /* falls through to the error state below */
    }
    const byKey = new Map<string, RatingItem>()
    for (const it of items ?? []) if (it && typeof it.query === 'string') byKey.set(ratingKey(it.query), it)

    const now = this.o.now()
    for (const [key] of batch) {
      const it = byKey.get(key)
      if (!it) {
        this.entries.set(key, { state: ERRORED, retryAt: now + this.o.errorRetryMs })
      } else if (!it.found) {
        this.entries.set(key, { state: MISSING, retryAt: now + this.o.missingRetryMs })
      } else {
        this.entries.set(key, {
          state: { status: 'ready', imdb: it.rating, votes: it.voteCount, rt: it.rtRating ?? null, imdbId: it.imdbId, title: it.title },
          retryAt: 0,
        })
      }
    }
    this.bump()
  }

  private bump() {
    this.version++
    this.listeners.forEach(fn => fn())
  }
}

async function fetchRatingsBatch(titles: string[]): Promise<RatingItem[]> {
  const res = await fetch('/api/ratings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titles }),
  })
  if (!res.ok) throw new Error(`ratings ${res.status}`)
  return res.json()
}

export function useRatings(): { get: (title: string) => RatingState; request: (titles: string[]) => void } {
  const [cache] = useState(() => new RatingsCache({ fetchBatch: fetchRatingsBatch }))
  // Re-render the host whenever any rating changes; the server snapshot is the same constant.
  useSyncExternalStore(cache.subscribe, cache.getVersion, cache.getVersion)
  return useMemo(() => ({ get: cache.get, request: cache.request }), [cache])
}

// ---------------------------------------------------------------- guide-frame geometry (pure)

export interface Size {
  w: number
  h: number
}

export const GUIDE_ASPECT = 16 / 9

// Largest centred 16:9 rectangle inside the stage, shrunk to `fill` (0..1) so the TV bezel stays visible.
export function guideRect(stage: Size, fill = 0.92, aspect = GUIDE_ASPECT): Box {
  const maxW = stage.w * fill
  const maxH = stage.h * fill
  const w = Math.min(maxW, maxH * aspect)
  const h = w / aspect
  return { x: (stage.w - w) / 2, y: (stage.h - h) / 2, w, h }
}

// A <video> with object-fit: cover is scaled to fill the stage and the overflow is cropped, so a stage
// rectangle maps back to video pixels through that one scale and the centred crop offset.
export function stageToVideoRect(rect: Box, stage: Size, video: Size): Box {
  const scale = Math.max(stage.w / video.w, stage.h / video.h)
  const offX = (stage.w - video.w * scale) / 2
  const offY = (stage.h - video.h * scale) / 2
  const x0 = Math.max(0, (rect.x - offX) / scale)
  const y0 = Math.max(0, (rect.y - offY) / scale)
  const x1 = Math.min(video.w, (rect.x + rect.w - offX) / scale)
  const y1 = Math.min(video.h, (rect.y + rect.h - offY) / scale)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

// A box in analysis-image pixels (the sampled guide, `sample` px) -> the same box in guide-relative CSS px.
export function sampleToGuide(box: Box, sample: Size, guide: Size): Box {
  const sx = guide.w / sample.w
  const sy = guide.h / sample.h
  return { x: box.x * sx, y: box.y * sy, w: box.w * sx, h: box.h * sy }
}
