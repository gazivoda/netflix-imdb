// Keeps overlay identities stable between frames. Re-matching every frame makes labels flicker;
// instead each detected box is associated with the previous frame's track (by IoU) and the
// title is a majority vote over that track's recent matches.

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface Detection {
  box: Box
  match: { id: string; title: string } | null
}

export interface Track {
  trackId: number
  box: Box
  title: string | null
  id: string | null
  age: number // frames seen
  missed: number // consecutive frames without a detection
}

interface InternalTrack extends Track {
  votes: ({ id: string; title: string } | null)[]
}

export function iou(a: Box, b: Box): number {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.w, b.x + b.w)
  const y1 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0)
  const union = a.w * a.h + b.w * b.h - inter
  return union <= 0 ? 0 : inter / union
}

export interface TrackerOptions {
  minIou: number // minimum overlap to continue a track
  voteWindow: number // recent matches considered for the title vote
  maxMissed: number // frames a track survives without a detection
  smoothing: number // 0..1, how much of the new box position to adopt (1 = no smoothing)
}

export const DEFAULT_TRACKER: TrackerOptions = { minIou: 0.3, voteWindow: 7, maxMissed: 5, smoothing: 0.5 }

export class CardTracker {
  private tracks: InternalTrack[] = []
  private nextId = 1
  constructor(private opts: TrackerOptions = DEFAULT_TRACKER) {}

  update(detections: Detection[]): Track[] {
    const unmatched = new Set(this.tracks)

    for (const det of detections) {
      let best: InternalTrack | null = null
      let bestIou = this.opts.minIou
      for (const t of unmatched) {
        const v = iou(t.box, det.box)
        if (v >= bestIou) {
          bestIou = v
          best = t
        }
      }

      if (best) {
        unmatched.delete(best)
        const k = this.opts.smoothing
        best.box = {
          x: best.box.x + (det.box.x - best.box.x) * k,
          y: best.box.y + (det.box.y - best.box.y) * k,
          w: best.box.w + (det.box.w - best.box.w) * k,
          h: best.box.h + (det.box.h - best.box.h) * k,
        }
        best.votes.push(det.match)
        if (best.votes.length > this.opts.voteWindow) best.votes.shift()
        best.age++
        best.missed = 0
      } else {
        this.tracks.push({
          trackId: this.nextId++,
          box: det.box,
          title: null,
          id: null,
          age: 1,
          missed: 0,
          votes: [det.match],
        })
      }
    }

    for (const t of unmatched) t.missed++
    this.tracks = this.tracks.filter(t => t.missed <= this.opts.maxMissed)

    for (const t of this.tracks) {
      const winner = majority(t.votes)
      t.id = winner?.id ?? null
      t.title = winner?.title ?? null
    }

    return this.tracks.map(({ votes: _votes, ...track }) => track)
  }
}

// Most frequent non-null vote, but only if it beats the "no match" votes and any rival.
function majority(votes: ({ id: string; title: string } | null)[]): { id: string; title: string } | null {
  const counts = new Map<string, { n: number; v: { id: string; title: string } }>()
  for (const v of votes) {
    if (!v) continue
    const c = counts.get(v.id)
    if (c) c.n++
    else counts.set(v.id, { n: 1, v })
  }
  let top: { n: number; v: { id: string; title: string } } | null = null
  for (const c of counts.values()) if (!top || c.n > top.n) top = c
  if (!top) return null
  const nulls = votes.filter(v => !v).length
  return top.n > nulls ? top.v : null
}
