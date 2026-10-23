// How a title becomes permanent. A card's artwork is remembered under a title (enrol-store.ts), and from then on it is recognised
// by that artwork alone, so a WRONG title would stay wrong. Hence two kinds of evidence:
//  - the user said it (tapped a "did you mean" chip, picked an autocomplete row, typed it): enrolled at once;
//  - the reader said it: shown at once (so the rating appears) but enrolled only when the same title is read for the same card a
//    SECOND time. On a simulation of 60 cards over 5 sessions, enrolling the first accept left 0.4-0.9% of cards permanently wrong;
//    enrolling the second left none.
// Pure over injected storage.

import type { RgbaImage } from '../card-hash'
import type { Box } from '../card-tracker'
import type { IndexEntry } from '../card-index'
import { addConfirmed, type ConfirmedTitle } from './confirmed-titles'
import { enrolCard, type KeyValueStore } from './enrol-store'
import { TileNotes } from './tile-notes'
import type { Vocabulary } from './title-vocab'

export interface ConfirmResult {
  /** The card index after enrolment, or null when the artwork could not be stored (storage full or blocked). */
  index: IndexEntry[] | null
  /** Whether the title was added to the device's confirmed titles / the live vocabulary. */
  remembered: boolean
}

/** Remembers a title the user or the reader has settled on: the vocabulary learns it, the artwork is enrolled under it. */
export function confirmCard(
  deps: { store: KeyValueStore; vocabulary?: Pick<Vocabulary, 'add'> | null },
  card: { title: string; crop: RgbaImage; year?: string; type?: string },
): ConfirmResult {
  const title = card.title.trim().replace(/\s+/g, ' ')
  let remembered = false
  try {
    const meta: ConfirmedTitle = { title, ...(card.year ? { year: card.year } : {}), ...(card.type ? { type: card.type } : {}) }
    addConfirmed(deps.store, meta)
    deps.vocabulary?.add([title])
    remembered = true
  } catch {
    // remembering is a convenience; the card is still enrolled
  }
  try {
    return { index: enrolCard(deps.store, title, card.crop, card.year), remembered }
  } catch {
    return { index: null, remembered }
  }
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Titles the reader accepted for cards that are not enrolled yet, and how often each was accepted. */
export class ProvisionalTitles {
  private notes: TileNotes<{ title: string; count: number }>

  constructor(ttlMs = 30_000) {
    this.notes = new TileNotes(ttlMs)
  }

  /** Records an accept for the card at `box`. `enrol` is true on the SECOND identical accept; a different title starts over at 1. */
  accept(box: Box, title: string, now: number): { count: number; enrol: boolean } {
    const prev = this.notes.get(box)
    const count = prev && same(prev.title, title) ? prev.count + 1 : 1
    this.notes.set(box, { title, count }, now)
    return { count, enrol: count >= 2 }
  }

  /** The title shown on the card at `box` while it is not enrolled. */
  title(box: Box): string | null {
    return this.notes.get(box)?.title ?? null
  }

  forget(box: Box): void {
    this.notes.delete(box)
  }

  follow(boxes: Box[], now: number): void {
    this.notes.follow(boxes, now)
  }

  clear(): void {
    this.notes.clear()
  }
}
