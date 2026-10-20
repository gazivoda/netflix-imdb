// Finds Netflix-style cards (16:9 landscape tiles or 2:3 Top-10 posters, laid out in rows, on a dark or light screen) in a
// camera frame. The detection itself lives in detect-grid.ts (edge comb + periodic tile placement, no foreground mask, so
// dark key art works); this file is the stable entry point the page and the pipeline call: findCards(img): Box[].
//
// findCardsDetailed adds a confidence per box (0..1) for callers that want to be stricter or to rank boxes (e.g. which
// tile to OCR first); findCards keeps the plain Box[] contract and uses the same boxes.
import { RgbaImage } from '../card-hash'
import { Box, iou } from '../card-tracker'
import { CardCandidate, detectCards } from './detect-grid'

export type { CardCandidate } from './detect-grid'

const MIN_FRAC = 0.6 // frame-clipped boxes below this share of the typical full box area are slivers
const DUP_IOU = 0.5 // two boxes this similar are one tile seen twice (a row found by two line pairs)

const area = (b: Box): number => b.w * b.h

export function findCardsDetailed(img: RgbaImage): CardCandidate[] {
  let found = detectCards(img)
  if (found.length < 2) return found.length ? found : []
  // duplicates: keep the more confident box
  found.sort((a, b) => b.confidence - a.confidence)
  found = found.filter((c, i) => !found.slice(0, i).some((o) => iou(o.box, c.box) > DUP_IOU))
  const touches = (b: Box): boolean => b.x <= 0 || b.y <= 0 || b.x + b.w >= img.width || b.y + b.h >= img.height
  // slivers: boxes that touch the frame border and are much smaller than the boxes that do not
  const full = found.filter((c) => !touches(c.box)).map((c) => area(c.box)).sort((a, b) => a - b)
  if (full.length) {
    const median = full[full.length >> 1]
    found = found.filter((c) => !touches(c.box) || area(c.box) >= MIN_FRAC * median)
  }
  return found
}

export function findCards(img: RgbaImage): Box[] {
  return findCardsDetailed(img).map((c) => c.box)
}
