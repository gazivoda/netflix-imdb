# Camera Vision OCR Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve movie title detection in `app/camera-vision/page.tsx` by adding a Canvas preprocessing pipeline, switching Tesseract to sparse-text mode, replacing regex title extraction with confidence-scored word grouping, and fixing three bugs (memory leak, flickering overlays, missing RT ratings).

**Architecture:** `extractMovieTitles` is extracted to `lib/extract-titles.ts` as a pure function for testability. `preprocessFrame` lives in the page file as a module-level function (no DOM at module level needed — it creates canvases at call time). The Tesseract worker moves from `useState` to `useRef` to fix cleanup. All changes are in two files.

**Tech Stack:** Tesseract.js v7 (already installed), Canvas 2D API, React hooks (useRef, useState, useCallback, useEffect), Jest + ts-jest

---

### Task 1: Extract title filtering to `lib/extract-titles.ts` with tests

**Files:**
- Create: `lib/extract-titles.ts`
- Create: `tests/lib/extract-titles.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/lib/extract-titles.test.ts
import { extractMovieTitles } from '../../lib/extract-titles'

type MockWord = {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

function word(text: string, confidence: number, y0 = 100, x0 = 0): MockWord {
  return { text, confidence, bbox: { x0, y0, x1: x0 + 80, y1: y0 + 20 } }
}

describe('extractMovieTitles', () => {
  it('returns empty array when given no words', () => {
    expect(extractMovieTitles([])).toEqual([])
  })

  it('filters out words with confidence <= 60', () => {
    expect(extractMovieTitles([word('Inception', 60)] as any)).toHaveLength(0)
  })

  it('includes words with confidence > 60', () => {
    const result = extractMovieTitles([word('Inception', 61)] as any)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Inception')
  })

  it('groups words within 20px y into the same line', () => {
    const words = [
      word('Breaking', 80, 100, 0),
      word('Bad', 80, 115, 90),
    ]
    const result = extractMovieTitles(words as any)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Breaking Bad')
  })

  it('splits words more than 20px apart into separate lines', () => {
    const words = [
      word('Inception', 80, 100),
      word('Avatar', 80, 200),
    ]
    expect(extractMovieTitles(words as any)).toHaveLength(2)
  })

  it('filters out UI exclusion words', () => {
    expect(extractMovieTitles([word('Home', 90)] as any)).toHaveLength(0)
    expect(extractMovieTitles([word('Play', 90)] as any)).toHaveLength(0)
    expect(extractMovieTitles([word('Trending', 90)] as any)).toHaveLength(0)
  })

  it('filters out entirely numeric lines', () => {
    expect(extractMovieTitles([word('2024', 90)] as any)).toHaveLength(0)
  })

  it('filters out lines longer than 40 characters', () => {
    expect(extractMovieTitles([word('A'.repeat(41), 90)] as any)).toHaveLength(0)
  })

  it('filters out lines with more than 6 words', () => {
    const words = Array.from({ length: 7 }, (_, i) =>
      word(`Word${i}`, 90, 100, i * 80)
    )
    expect(extractMovieTitles(words as any)).toHaveLength(0)
  })

  it('returns at most 5 results', () => {
    const words = Array.from({ length: 7 }, (_, i) =>
      word(`Movie${i}`, 90, i * 50)
    )
    expect(extractMovieTitles(words as any).length).toBeLessThanOrEqual(5)
  })

  it('sorts results by confidence descending', () => {
    const words = [
      word('Low', 70, 100),
      word('High', 95, 200),
      word('Mid', 80, 300),
    ]
    const result = extractMovieTitles(words as any)
    expect(result[0].title).toBe('High')
    expect(result[1].title).toBe('Mid')
    expect(result[2].title).toBe('Low')
  })

  it('divides position coordinates by scale', () => {
    const result = extractMovieTitles([word('Inception', 90, 300, 600)] as any, 3)
    expect(result[0].x).toBe(200)
    expect(result[0].y).toBe(100)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/igorgazivoda/netflix-imdb && npx jest tests/lib/extract-titles.test.ts --no-coverage
```

Expected: FAIL with "Cannot find module '../../lib/extract-titles'"

- [ ] **Step 3: Create `lib/extract-titles.ts`**

```typescript
// lib/extract-titles.ts

type TesseractWord = {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

export interface DetectedTitle {
  title: string
  confidence: number
  x: number
  y: number
}

const UI_EXCLUSIONS = new Set([
  'home', 'tv shows', 'movies', 'search', 'menu', 'play', 'watch',
  'resume', 'more info', 'like', 'match', 'new', 'top', 'trending',
  'episodes', 'trailers', 'audio', 'subtitles',
])

export function extractMovieTitles(words: TesseractWord[], scale = 1): DetectedTitle[] {
  const confident = words.filter(w => w.confidence > 60)
  if (!confident.length) return []

  const lines: TesseractWord[][] = []
  for (const word of confident) {
    const existing = lines.find(line =>
      Math.abs(line[0].bbox.y0 - word.bbox.y0) <= 20
    )
    if (existing) {
      existing.push(word)
    } else {
      lines.push([word])
    }
  }

  const results: DetectedTitle[] = []

  for (const line of lines) {
    const text = line.map(w => w.text).join(' ').trim()
    const wordCount = line.length
    const avgConfidence = line.reduce((sum, w) => sum + w.confidence, 0) / line.length

    if (
      text.length < 2 ||
      text.length > 40 ||
      wordCount > 6 ||
      /^\d+$/.test(text) ||
      UI_EXCLUSIONS.has(text.toLowerCase())
    ) continue

    results.push({
      title: text,
      confidence: avgConfidence,
      x: line[0].bbox.x0 / scale,
      y: line[0].bbox.y0 / scale,
    })
  }

  return results
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/lib/extract-titles.test.ts --no-coverage
```

Expected: PASS — 11 tests

- [ ] **Step 5: Run the full suite to check for regressions**

```bash
npx jest --no-coverage
```

Expected: all tests pass (was 19, now 30)

- [ ] **Step 6: Commit**

```bash
git add lib/extract-titles.ts tests/lib/extract-titles.test.ts
git commit -m "feat: extract extractMovieTitles as pure tested function with confidence grouping"
```

---

### Task 2: Fix memory leak — move OCR worker from useState to useRef, update Tesseract config

**Files:**
- Modify: `app/camera-vision/page.tsx`

Context: The current code initialises the OCR worker with `useState<any>(null)` and tries to call `ocrWorker.terminate()` in the useEffect cleanup. But the cleanup captures the initial state value (`null`) at mount time — so `terminate()` is never called. Moving to `useRef` fixes this because refs are read at call time, not captured at effect creation time.

The Tesseract config also changes here: PSM 6 → 11 (sparse text), remove character whitelist.

- [ ] **Step 1: Replace the worker state declaration and useEffect**

Find this block in `app/camera-vision/page.tsx` (currently lines 28–50):

```typescript
  const [ocrWorker, setOcrWorker] = useState<any>(null)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [ocrFailureCount, setOcrFailureCount] = useState(0)

  // Initialize OCR worker
  useEffect(() => {
    const initOCR = async () => {
      const worker = await createWorker('eng')
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 :.!?-',
        tessedit_pageseg_mode: 6 as any, // Uniform block of text
      })
      setOcrWorker(worker)
    }

    initOCR()

    return () => {
      if (ocrWorker) {
        ocrWorker.terminate()
      }
    }
  }, [])
```

Replace with:

```typescript
  const ocrWorkerRef = useRef<any>(null)
  const [ocrReady, setOcrReady] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [ocrFailureCount, setOcrFailureCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    createWorker('eng').then(async worker => {
      await worker.setParameters({
        tessedit_pageseg_mode: 11 as any,
      })
      if (!cancelled) {
        ocrWorkerRef.current = worker
        setOcrReady(true)
      } else {
        worker.terminate()
      }
    })
    return () => {
      cancelled = true
      ocrWorkerRef.current?.terminate()
      ocrWorkerRef.current = null
    }
  }, [])
```

- [ ] **Step 2: Update all references to `ocrWorker` in the file**

Replace every occurrence of `ocrWorker` (the state variable) with the equivalent ref/flag:

| Old | New |
|-----|-----|
| `!ocrWorker` (guard in processVideoFrame) | `!ocrWorkerRef.current` |
| `await ocrWorker.recognize(canvas)` | `await ocrWorkerRef.current.recognize(canvas)` (canvas arg changes in Task 4) |
| `[isStreaming, ocrWorker, videoLoaded,` (useEffect deps) | `[isStreaming, ocrReady, videoLoaded,` |
| `{ocrWorker ? '✅ Ready' : '⏳ Loading...'}` (debug panel) | `{ocrReady ? '✅ Ready' : '⏳ Loading...'}` |

- [ ] **Step 3: Verify the page compiles**

```bash
cd /Users/igorgazivoda/netflix-imdb && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/camera-vision/page.tsx
git commit -m "fix: move OCR worker to useRef to fix cleanup memory leak; switch to PSM 11 sparse text"
```

---

### Task 3: Add `preprocessFrame` function and wire it into OCR

**Files:**
- Modify: `app/camera-vision/page.tsx`

`preprocessFrame` is a module-level function (outside the component) that takes the video element, creates an offscreen canvas at 3× size, applies grayscale+contrast via canvas filter, draws the frame, then does a pixel-level threshold pass to produce clean black-on-white output for Tesseract.

- [ ] **Step 1: Add `preprocessFrame` above the component definition**

Insert this function before `export default function CameraVision()`:

```typescript
function preprocessFrame(source: HTMLVideoElement): HTMLCanvasElement {
  const scale = 3
  const canvas = document.createElement('canvas')
  canvas.width = source.videoWidth * scale
  canvas.height = source.videoHeight * scale

  const ctx = canvas.getContext('2d')!
  ctx.filter = 'grayscale(1) contrast(2) brightness(1.1)'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  ctx.filter = 'none'

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    const value = luminance >= 128 ? 255 : 0
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
  }
  ctx.putImageData(imageData, 0, 0)

  return canvas
}
```

- [ ] **Step 2: Update `processVideoFrame` to use `preprocessFrame`**

Find the OCR call inside `processVideoFrame`. Currently it draws to `canvasRef.current` and passes that canvas to Tesseract. Replace that block:

Old (the block starting with `canvas.width = video.videoWidth`):
```typescript
      // Set canvas size to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Validate canvas has content
      const imageData = ctx.getImageData(0, 0, 1, 1) // Check a single pixel
      if (imageData.data.every(pixel => pixel === 0)) {
        console.warn('Canvas appears empty, skipping OCR')
        return
      }

      // Perform OCR on the canvas directly (more reliable than ImageData)
      const { data: { text, confidence, words } } = await ocrWorker.recognize(canvas)
```

New:
```typescript
      const preprocessed = preprocessFrame(video)

      // Validate the preprocessed frame has content
      const checkCtx = preprocessed.getContext('2d')!
      const checkData = checkCtx.getImageData(0, 0, 1, 1)
      if (checkData.data.every(pixel => pixel === 0)) {
        console.warn('Canvas appears empty, skipping OCR')
        return
      }

      const { data: { words } } = await ocrWorkerRef.current.recognize(preprocessed)
```

- [ ] **Step 3: Verify the page compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/camera-vision/page.tsx
git commit -m "feat: add preprocessFrame with 3x upscale, grayscale, contrast, threshold"
```

---

### Task 4: Fix flickering overlays + add RT ratings

**Files:**
- Modify: `app/camera-vision/page.tsx`

Two independent fixes bundled as one commit since they both touch the `DetectedContent` interface and the overlay render.

- [ ] **Step 1: Add `rtRating` to `DetectedContent` interface**

Find:
```typescript
interface DetectedContent {
  id: string
  title: string
  confidence: number
  x: number
  y: number
  rating?: number
  voteCount?: number
}
```

Replace with:
```typescript
interface DetectedContent {
  id: string
  title: string
  confidence: number
  x: number
  y: number
  rating?: number
  voteCount?: number
  rtRating?: number | null
}
```

- [ ] **Step 2: Map `rtRating` from the API response**

Find:
```typescript
              return rating && rating.found
                ? { ...content, rating: rating.rating, voteCount: rating.voteCount }
                : content
```

Replace with:
```typescript
              return rating && rating.found
                ? { ...content, rating: rating.rating, voteCount: rating.voteCount, rtRating: rating.rtRating }
                : content
```

- [ ] **Step 3: Fix flickering — use stable pixel positions in the overlay JSX**

Find:
```tsx
            style={{
              left: content.x || Math.random() * 60 + '%',
              top: content.y || Math.random() * 60 + '%',
              minWidth: '180px',
            }}
```

Replace with:
```tsx
            style={{
              left: `${content.x}px`,
              top: `${content.y}px`,
              minWidth: '180px',
            }}
```

- [ ] **Step 4: Add RT rating display in the overlay**

Find the IMDB rating block in the overlay:
```tsx
              {content.rating ? (
                <div className="flex items-center gap-2">
                  <div className="text-yellow-400 text-lg">⭐</div>
                  <div className="text-white font-bold">{content.rating.toFixed(1)}</div>
                  {content.voteCount && (
                    <div className="text-gray-400 text-xs">
                      ({content.voteCount.toLocaleString()} votes)
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-400 text-sm">Loading rating...</div>
              )}
```

Replace with:
```tsx
              {content.rating != null ? (
                <div className="flex items-center gap-2">
                  <div className="text-yellow-400 text-lg">⭐</div>
                  <div className="text-white font-bold">{content.rating.toFixed(1)}</div>
                  {content.voteCount && (
                    <div className="text-gray-400 text-xs">
                      ({content.voteCount.toLocaleString()} votes)
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-400 text-sm">Loading rating...</div>
              )}
              {content.rtRating != null && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-red-500 text-lg">🍅</div>
                  <div className="text-white font-bold">{content.rtRating}%</div>
                </div>
              )}
```

- [ ] **Step 5: Verify the page compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/camera-vision/page.tsx
git commit -m "fix: stable overlay positions (remove Math.random); add RT ratings to camera overlay"
```

---

### Task 5: Wire `extractMovieTitles` into `processVideoFrame` and commit the page to git

**Files:**
- Modify: `app/camera-vision/page.tsx`

This task connects the `extractMovieTitles` function from `lib/extract-titles.ts` into `processVideoFrame`, replacing the old regex-based approach. It also adds the import and stores stable index-based fallback positions.

- [ ] **Step 1: Add the import at the top of the page**

Find the existing import block at the top of `app/camera-vision/page.tsx`. Add this import after the existing imports:

```typescript
import { extractMovieTitles } from '@/lib/extract-titles'
```

- [ ] **Step 2: Replace the old title extraction and content building in `processVideoFrame`**

Find this block (after the OCR recognize call):
```typescript
      // Reset failure count on success
      setOcrFailureCount(0)

      // Process detected text
      const detectedTitles = extractMovieTitles(text, words)
      console.log('Detected text:', text)
      console.log('Extracted titles:', detectedTitles)

      // Update detected content
      const newContent: DetectedContent[] = detectedTitles.map((title, index) => ({
        id: `detected-${Date.now()}-${index}`,
        title: title.title,
        confidence: title.confidence,
        x: title.x || Math.random() * (canvas.width - 200),
        y: title.y || Math.random() * (canvas.height - 100),
        width: 200,
        height: 80,
      }))
```

Replace with:
```typescript
      setOcrFailureCount(0)

      const detectedTitles = extractMovieTitles(words, 3)
      console.log('Extracted titles:', detectedTitles)

      const newContent: DetectedContent[] = detectedTitles.map((title, index) => ({
        id: `detected-${Date.now()}-${index}`,
        title: title.title,
        confidence: title.confidence,
        x: title.x ?? 20,
        y: title.y ?? 20 + index * 90,
        width: 200,
        height: 80,
      }))
```

- [ ] **Step 3: Remove the now-unused `extractMovieTitles` function from the page**

Find and delete the old `extractMovieTitles` function inside the component (currently defined as `const extractMovieTitles = (text: string, words: any[]) => { ... }`). It spans from the function declaration to its closing `}`. Delete the entire function.

- [ ] **Step 4: Verify the page compiles and all tests pass**

```bash
npx tsc --noEmit && npx jest --no-coverage
```

Expected: no TypeScript errors, all 30 tests pass

- [ ] **Step 5: Commit and add the page to git tracking**

The page has never been committed (it's untracked). Add it now:

```bash
git add app/camera-vision/page.tsx lib/extract-titles.ts
git commit -m "feat: wire extractMovieTitles into camera vision processVideoFrame; track page in git"
```

---

## Self-Review

**Spec coverage:**
- Section 1 (preprocessFrame): Task 3 ✅
- Section 2 (Tesseract PSM 11, no whitelist): Task 2 ✅
- Section 3 (extractMovieTitles confidence grouping): Task 1 + Task 5 ✅
- Section 4a (memory leak): Task 2 ✅
- Section 4b (flickering positions): Task 4 ✅
- Section 4c (RT ratings): Task 4 ✅

**Placeholder scan:** All steps have complete code. No TBDs.

**Type consistency:**
- `DetectedTitle` defined in `lib/extract-titles.ts`, used in `processVideoFrame` (Task 5) ✅
- `DetectedContent.rtRating` added in Task 4, mapped from API in Task 4 ✅
- `ocrWorkerRef` introduced in Task 2, used in Task 3 ✅
- `extractMovieTitles(words, 3)` call in Task 5 matches signature `(words: TesseractWord[], scale = 1)` from Task 1 ✅
