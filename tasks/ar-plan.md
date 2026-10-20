# AR rating overlay (webapp concept test)

Goal: phone camera pointed at a TV showing the Netflix app -> IMDb / Rotten Tomatoes chips drawn over each card, near real time,
all card recognition on-device. Webapp first (`/camera-vision/ar`), standalone mobile app later, so the core stays pure TS in `lib/ar/`
(no DOM, no React) and only the page touches the browser.

Decisions (from the feasibility spike, see conversation): perceptual hash + colour grid beats CLIP; geometry is the risk, not matching.
v1 uses a **16:9 guide frame** (user aligns the TV) instead of automatic screen detection. Reference art is **enrolled in-page**
(point at a card, type the title, hash stored in localStorage). Thresholds are provisional until calibrated.
No git commits without explicit approval.

## Module contracts (every agent codes against these exactly)

Existing, do not change signatures: `lib/card-hash.ts` (`RgbaImage`, `hashCard`, `cardDistance`), `lib/card-index.ts`
(`IndexEntry`, `matchCard`, `serializeIndex`, `deserializeIndex`, `DEFAULT_RULE`), `lib/card-tracker.ts` (`Box`, `Detection`, `Track`, `CardTracker`).

### `lib/ar/rectify.ts`  (agent: vision)
```ts
import { RgbaImage } from '../card-hash'
import { Box } from '../card-tracker'
// Bilinear-resample an axis-aligned region of `img` to outW x outH. Box is clamped to the image.
export function cropToRgba(img: RgbaImage, box: Box, outW: number, outH: number): RgbaImage
// Perspective warp: quad = 4 corners [tl, tr, br, bl] in img pixel coords -> outW x outH rectangle (homography, bilinear).
export function warpQuad(img: RgbaImage, quad: [Pt, Pt, Pt, Pt], outW: number, outH: number): RgbaImage
export interface Pt { x: number; y: number }
```

### `lib/ar/card-finder.ts`  (agent: vision)
```ts
// Finds Netflix-style card rectangles (16:9 tiles on a dark background, arranged in rows) inside the guide-frame image.
// Returns boxes in `img` pixel coordinates, any order. Must be fast (<= ~15 ms for 640x360 in plain JS): work on a
// downscaled luminance/gradient projection (row/column profile "comb"), not per-pixel contours. Tolerate 1-2 partially
// visible cards at the edges (drop boxes < 60% of the median card area), and return [] for a blank or card-less frame.
export function findCards(img: RgbaImage): Box[]
```

### `lib/ar/pipeline.ts`  (agent: pipeline)
```ts
import { RgbaImage } from '../card-hash'
import { IndexEntry, MatchRule } from '../card-index'
import { Box, Track } from '../card-tracker'
export interface PipelineOptions {
  analysisWidth: number   // frame is downscaled to this width before finding cards (default 640)
  cardOutW: number; cardOutH: number // rectified card size fed to hashCard (default 96x54)
  rule: MatchRule
}
export interface ArFrameResult {
  tracks: Track[]          // current stable tracks, boxes in guide-frame pixel coords of the INPUT image
  unknownCards: { box: Box; crop: RgbaImage }[]   // detections this frame with no match (candidates for enrolment)
  timings: { findMs: number; hashMs: number; totalMs: number }
}
export class ArPipeline {
  constructor(deps: { findCards: (img: RgbaImage) => Box[] }, opts?: Partial<PipelineOptions>)
  setIndex(index: IndexEntry[]): void
  processFrame(guideImage: RgbaImage): ArFrameResult   // synchronous, pure, injectable finder for tests
  reset(): void
}
export const DEFAULT_PIPELINE: PipelineOptions
```
### `lib/ar/enrol-store.ts`  (agent: pipeline)
```ts
import { IndexEntry } from '../card-index'
import { RgbaImage } from '../card-hash'
// Storage is injected (window.localStorage in the page, a Map-backed fake in tests / future native app).
export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
export const STORAGE_KEY = 'ar-card-index-v1'
export function loadIndex(store: KeyValueStore): IndexEntry[]       // tolerant: corrupt JSON -> []
export function enrolCard(store: KeyValueStore, title: string, crop: RgbaImage, year?: string): IndexEntry[]  // returns updated index; same title replaces
export function removeCard(store: KeyValueStore, id: string): IndexEntry[]
export function clearIndex(store: KeyValueStore): void
```

### `lib/ar/use-ratings.ts` + `app/camera-vision/ar/*`  (agent: ui)
Client hook `useRatings()` -> `{ get(title): RatingState, request(titles: string[]) }`, de-duplicated and cached in memory, batches
POST `/api/ratings` `{titles}` (max 20 per request; response items `{query, found, imdbId?, title?, year?, rating?, voteCount?, rtRating?}`).
Page `app/camera-vision/ar/page.tsx` (+ `ar.module.css`): rear camera (`facingMode: environment`, ideal 1280x720), 16:9 guide frame
overlay, a rAF loop sampling the video region inside the guide into an offscreen canvas (~8-10 analysis fps, never block render),
`ArPipeline` + `findCards`, chips (`ImdbChip`, `RtChip` from `@/components/ScoreChip`) positioned over each track mapped from guide
coordinates to screen coordinates, enrol panel (tap an unknown card -> type title -> `enrolCard`), index size + clear button,
`HTTPS required` message when `!window.isSecureContext`, debug toggle showing fps / find ms / hash ms. Mirror the styling of
`app/camera-vision/page.tsx` and `camera.module.css`. Only title strings go to the network.

## Verification
- Unit tests per module under `tests/lib/ar/`; whole `npx jest` and `npx tsc --noEmit` green.
- Integration/calibration (phase 2): synthetic TV-frame generator with perspective, glare, blur, noise; end-to-end through
  findCards -> rectify -> hash -> match -> tracker; recalibrate `DEFAULT_RULE` / `STRUCTURE_WEIGHT`; headless browser smoke test of the page with the fake-camera technique.
