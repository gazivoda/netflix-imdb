// Things the page remembers about an UNRECOGNISED card for a few seconds: a provisional title, the chips offered for it. An
// unrecognised card has no identity across frames (the tracker only follows cards it can recognise by artwork), so a note
// follows the card by position: the nearest earlier note whose centre is within 40% of the card's width (or `reach` px).
// Pure and DOM-free.

import type { Box } from '../card-tracker'

interface Note<T> { cx: number; cy: number; w: number; value: T; seenAt: number }

export class TileNotes<T> {
  private notes: Note<T>[] = []

  constructor(private ttlMs = 30_000, private reach = 24) {}

  private nearest(box: Box): Note<T> | null {
    const cx = box.x + box.w / 2
    const cy = box.y + box.h / 2
    const limit = Math.max(this.reach, 0.4 * box.w)
    let best: Note<T> | null = null
    let bestD = Infinity
    for (const n of this.notes) {
      const d = Math.hypot(n.cx - cx, n.cy - cy)
      if (d <= limit && d < bestD) { best = n; bestD = d }
    }
    return best
  }

  /** The value remembered for the card at `box`, or undefined. */
  get(box: Box): T | undefined {
    return this.nearest(box)?.value
  }

  /** Remembers `value` for the card at `box` (replacing what the same card had). */
  set(box: Box, value: T, now: number): void {
    const n = this.nearest(box)
    if (n) {
      n.value = value
      n.cx = box.x + box.w / 2
      n.cy = box.y + box.h / 2
      n.w = box.w
      n.seenAt = now
      return
    }
    this.notes.push({ cx: box.x + box.w / 2, cy: box.y + box.h / 2, w: box.w, value, seenAt: now })
  }

  delete(box: Box): void {
    const n = this.nearest(box)
    if (n) this.notes = this.notes.filter(x => x !== n)
  }

  /** Call once per frame with the cards on screen: notes follow their card, and notes whose card has not been seen for the ttl are dropped. */
  follow(boxes: Box[], now: number): void {
    for (const b of boxes) {
      const n = this.nearest(b)
      if (n) { n.cx = b.x + b.w / 2; n.cy = b.y + b.h / 2; n.w = b.w; n.seenAt = now }
    }
    this.notes = this.notes.filter(n => now - n.seenAt <= this.ttlMs)
  }

  clear(): void {
    this.notes = []
  }

  get size(): number {
    return this.notes.length
  }
}
