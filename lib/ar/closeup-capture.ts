// Geometry and frame selection for the close-up scan. The burst itself (drawing video frames to a canvas) lives in the page; the
// choices that need testing live here. Pure and DOM-free.

import type { RgbaImage } from '../card-hash'
import type { Box } from '../card-tracker'
import { laplacianVariance } from './sharpness'
import { GUIDE_ASPECT, guideRect, stageToVideoRect, type Size } from './use-ratings'

export const RETICLE_FILL = 0.7 // share of the stage width (or height) the 16:9 reticle takes
export const CROP_MARGIN = 0.08 // the scan reads the reticle plus this much on every side, so a loosely framed card is still whole
export const BURST_FRAMES = 6
export const BURST_GAP_MS = 90
export const KEEP_SHARPEST = 2

/** Below this many camera pixels across the reticle the title is too small to read well; from OK_PX on it is past the plateau. */
export const CLOSE_PX = 500
export const OK_PX = 700

export function reticleRect(stage: Size, fill = RETICLE_FILL): Box {
  return guideRect(stage, fill, GUIDE_ASPECT)
}

/** `rect` grown by `margin` of its own size on every side, kept inside the stage. */
export function cropRectWithMargin(rect: Box, margin: number, stage: Size): Box {
  const x0 = Math.max(0, rect.x - rect.w * margin)
  const y0 = Math.max(0, rect.y - rect.h * margin)
  const x1 = Math.min(stage.w, rect.x + rect.w * (1 + margin))
  const y1 = Math.min(stage.h, rect.y + rect.h * (1 + margin))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** The `keep` sharpest crops, sharpest first (the others are dropped so their pixel buffers can be freed). */
export function pickSharpest(crops: RgbaImage[], keep = KEEP_SHARPEST): RgbaImage[] {
  return crops
    .map(crop => ({ crop, s: laplacianVariance(crop) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, keep)
    .map(x => x.crop)
}

/** Width of a stage rectangle in camera (video) pixels, given the cover-fit mapping. */
export function reticleNativeWidth(rect: Box, stage: Size, video: Size): number {
  return Math.round(stageToVideoRect(rect, stage, video).w)
}

export function closeupHint(nativeW: number, zoomAvailable: boolean): string {
  if (nativeW <= 0) return 'Fit one card inside the frame.'
  if (nativeW < CLOSE_PX) return zoomAvailable ? 'Move closer until the card fills the frame, or zoom in.' : 'Move closer until the card fills the frame.'
  if (nativeW < OK_PX) return 'A little closer.'
  return 'Hold steady, then tap Scan card.'
}
