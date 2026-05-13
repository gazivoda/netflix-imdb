# Camera Vision OCR Improvement Design

## Goal

Improve title detection accuracy in `app/camera-vision/page.tsx` by adding an image preprocessing pipeline, tuning Tesseract configuration, replacing the regex-based text filter with confidence-scored word grouping, and fixing three existing bugs.

## Architecture

Single file change: `app/camera-vision/page.tsx`. No new dependencies. All preprocessing runs on-device in the browser using the Canvas 2D API. Tesseract.js is already installed.

## Tech Stack

- Tesseract.js v7 (already installed) — OCR
- Canvas 2D API — image preprocessing (grayscale, contrast, threshold)
- React hooks — state and refs

---

## Section 1: Image Preprocessing Pipeline

Before passing a frame to Tesseract, run it through a preprocessing function `preprocessFrame(source: HTMLCanvasElement | HTMLVideoElement): HTMLCanvasElement`:

1. Create an offscreen canvas at **3× the source dimensions**
2. Set `ctx.filter = 'grayscale(1) contrast(2) brightness(1.1)'` before drawing
3. Draw the source into the offscreen canvas via `ctx.drawImage`
4. Do a pixel-level threshold pass over the resulting `ImageData`:
   - For each pixel, compute luminance: `0.299R + 0.587G + 0.114B`
   - If luminance ≥ 128 → set pixel to white (255, 255, 255)
   - If luminance < 128 → set pixel to black (0, 0, 0)
   - Write back via `ctx.putImageData`
5. Return the offscreen canvas

This converts blurry grey camera text into clean black-on-white, which is the input Tesseract is trained on.

## Section 2: Tesseract Configuration

**PSM change:** Switch from `tessedit_pageseg_mode: 6` (uniform block) to `tessedit_pageseg_mode: 11` (sparse text). Mode 11 finds text scattered anywhere in the image without assuming a single text block — correct for a Netflix grid.

**Remove character whitelist:** Delete the `tessedit_char_whitelist` parameter entirely. The current whitelist blocks apostrophes, accents, colons, and hyphens mid-word, causing titles like "Schitt's Creek" or "Pan's Labyrinth" to produce garbage output.

Worker initialization after changes:
```ts
const worker = await createWorker('eng')
await worker.setParameters({
  tessedit_pageseg_mode: 11 as any,
})
```

## Section 3: Title Filtering

Replace the two-regex pattern match with word-level confidence grouping:

**`extractMovieTitles(words: TesseractWord[]): DetectedTitle[]`**

Input: the `words` array from `ocrWorker.recognize(canvas).data.words`

Steps:
1. Filter words to those with `confidence > 60`
2. Group words into lines by proximity: words whose `bbox.y0` values are within 20px of each other belong to the same line
3. For each line, compute `averageConfidence` and join word text with spaces
4. Filter lines:
   - Length between 2 and 40 characters
   - Between 1 and 6 words
   - Not matching the UI exclusion set (case-insensitive): `Home`, `TV Shows`, `Movies`, `Search`, `Menu`, `Play`, `Watch`, `Resume`, `More Info`, `Like`, `Match`, `New`, `Top`, `Trending`, `Episodes`, `Trailers`, `Audio`, `Subtitles`
   - Not entirely numeric
5. Sort by `averageConfidence` descending, return top 5
6. Each result: `{ title: string, confidence: number, x: number, y: number }`

Position `x` and `y` come from the first word's `bbox.x0` / `bbox.y0`, divided by 3 (to convert back from the 3× preprocessed canvas to screen coordinates).

## Section 4: Bug Fixes

### Memory leak — OCR worker
Move the worker from `useState` to `useRef<Worker | null>`. The cleanup function in `useEffect` currently captures the initial `null` value from state, so `terminate()` is never called. With a ref, cleanup reads the current value:

```ts
const ocrWorkerRef = useRef<any>(null)

useEffect(() => {
  createWorker('eng').then(worker => {
    worker.setParameters({ tessedit_pageseg_mode: 11 as any })
    ocrWorkerRef.current = worker
  })
  return () => {
    ocrWorkerRef.current?.terminate()
  }
}, [])
```

### Flickering overlay positions
`detectedContent` items currently have `x` and `y` set to `Math.random()` as a fallback, which produces a new value on every render. Fix: store absolute pixel positions in state at detection time (from the word bounding box, scaled back to video dimensions). Remove all `Math.random()` calls from JSX. If a title has no position data, use a fixed fallback (e.g., `x: 20, y: 20 + index * 90`).

### Missing RT ratings
Add `rtRating: number | null` to the `DetectedContent` interface. In `fetchRatings`, map `r.rtRating` onto each result. In the overlay JSX, show `🍅 {content.rtRating}%` below the IMDB rating when `rtRating !== null`.

---

## Data Flow

```
Video frame
  → preprocessFrame() [3× upscale + grayscale + contrast + threshold]
  → ocrWorker.recognize(preprocessedCanvas)
  → extractMovieTitles(words) [confidence filter + line grouping + UI exclusion]
  → fetchRatings(titles) [POST /api/ratings]
  → setDetectedContent([...]) [title + rating + rtRating + stable x/y]
  → overlay render
```

## What Is Not Changing

- The 3-second scan interval
- The `isProcessing` guard preventing concurrent scans
- The `MutationObserver`-free approach (camera page, not extension)
- The OCR failure counter and 5-failure abort
- Camera start/stop controls
- The debug info panel
