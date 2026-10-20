// Pixel-level preprocessing for the camera OCR. Pure (no DOM) so it can be unit-tested.
import type { RgbaImage } from './card-hash'

// A frame whose luminance spread is below this carries no readable text (blank / covered lens).
const MIN_CONTRAST = 24

function luminance(data: Uint8ClampedArray, i: number): number {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
}

// Otsu's method: the threshold that best separates the histogram into two classes.
function otsuThreshold(histogram: number[], total: number): number {
  let sumAll = 0
  for (let t = 0; t < 256; t++) sumAll += t * histogram[t]

  let sumBg = 0
  let weightBg = 0
  let best = 0
  let bestVariance = -1
  for (let t = 0; t < 256; t++) {
    weightBg += histogram[t]
    if (weightBg === 0) continue
    const weightFg = total - weightBg
    if (weightFg === 0) break
    sumBg += t * histogram[t]
    const meanBg = sumBg / weightBg
    const meanFg = (sumAll - sumBg) / weightFg
    const variance = weightBg * weightFg * (meanBg - meanFg) ** 2
    if (variance > bestVariance) {
      bestVariance = variance
      best = t
    }
  }
  return best
}

/**
 * Binarises RGBA pixels in place to black text on a white background, which is what
 * Tesseract reads best. The threshold is chosen per frame (Otsu) and the result is
 * inverted when the background is dark, so light-on-dark screens (Netflix) work too.
 *
 * Returns false when the frame has no contrast (nothing to read); the data is left untouched.
 */
export function binarizeForOcr(data: Uint8ClampedArray): boolean {
  const histogram = new Array<number>(256).fill(0)
  let min = 255
  let max = 0
  const pixels = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    const l = Math.round(luminance(data, i))
    histogram[l]++
    if (l < min) min = l
    if (l > max) max = l
  }
  if (max - min < MIN_CONTRAST) return false

  const threshold = otsuThreshold(histogram, pixels)
  let light = 0
  for (let t = threshold + 1; t < 256; t++) light += histogram[t]
  // Background is the majority class; make it white.
  const lightIsBackground = light >= pixels / 2

  for (let i = 0; i < data.length; i += 4) {
    const isLight = luminance(data, i) > threshold
    const value = isLight === lightIsBackground ? 255 : 0
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }
  return true
}

// ---------------------------------------------------------------------------------------------------------
// Non-destructive variants for the tile reader. Each takes an RgbaImage and returns a NEW one (grey ones have
// R = G = B, alpha 255), so several variants of one crop can be OCR-ed and compared.
// ---------------------------------------------------------------------------------------------------------
export type GreyMode = 'luma' | 'max-contrast' | 'r' | 'g' | 'b'

function newImage(width: number, height: number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 3; i < data.length; i += 4) data[i] = 255
  return { data, width, height }
}

function fromGrey(grey: ArrayLike<number>, width: number, height: number): RgbaImage {
  const out = newImage(width, height)
  for (let p = 0; p < grey.length; p++) {
    const v = grey[p]
    out.data[p * 4] = v
    out.data[p * 4 + 1] = v
    out.data[p * 4 + 2] = v
  }
  return out
}

function channelGrey(img: RgbaImage, c: 0 | 1 | 2): Float32Array {
  const g = new Float32Array(img.width * img.height)
  for (let p = 0; p < g.length; p++) g[p] = img.data[p * 4 + c]
  return g
}

function lumaGrey(img: RgbaImage): Float32Array {
  const g = new Float32Array(img.width * img.height)
  for (let p = 0; p < g.length; p++) g[p] = luminance(img.data, p * 4)
  return g
}

// Spread between the 2nd and 98th percentile of a grey plane: robust "how much structure is in this channel".
function spread(g: Float32Array): number {
  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i < g.length; i++) hist[Math.min(255, Math.max(0, Math.round(g[i])))]++
  const [lo, hi] = percentiles(hist, g.length, 0.02, 0.98)
  return hi - lo
}

function percentiles(hist: number[], total: number, a: number, b: number): [number, number] {
  let acc = 0
  let lo = 0
  let hi = 255
  let gotLo = false
  for (let t = 0; t < 256; t++) {
    acc += hist[t]
    if (!gotLo && acc >= a * total) { lo = t; gotLo = true }
    if (acc >= b * total) { hi = t; break }
  }
  return [lo, hi]
}

function greyPlane(img: RgbaImage, mode: GreyMode): Float32Array {
  if (mode === 'luma') return lumaGrey(img)
  if (mode === 'r') return channelGrey(img, 0)
  if (mode === 'g') return channelGrey(img, 1)
  if (mode === 'b') return channelGrey(img, 2)
  // max-contrast: the colour channel (or luma) in which the picture has the widest spread. Coloured logos on a
  // contrasting-hue background (red on blue, yellow on dark) are often far crisper in one channel than in luma.
  const planes = [lumaGrey(img), channelGrey(img, 0), channelGrey(img, 1), channelGrey(img, 2)]
  let best = planes[0]
  let bestSpread = -1
  for (const p of planes) {
    const s = spread(p)
    if (s > bestSpread) { bestSpread = s; best = p }
  }
  return best
}

/** Greyscale copy. `max-contrast` picks whichever of luma / R / G / B has the widest 2-98 percentile spread. */
export function toGrey(img: RgbaImage, mode: GreyMode = 'luma'): RgbaImage {
  return fromGrey(greyPlane(img, mode), img.width, img.height)
}

/** Stretches the 2nd-98th percentile of the luminance to 0-255 (greyscale result). A flat image is returned as plain grey. */
export function stretchContrast(img: RgbaImage, mode: GreyMode = 'luma'): RgbaImage {
  const g = greyPlane(img, mode)
  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i < g.length; i++) hist[Math.min(255, Math.max(0, Math.round(g[i])))]++
  const [lo, hi] = percentiles(hist, g.length, 0.02, 0.98)
  const range = Math.max(1, hi - lo)
  const out = new Float32Array(g.length)
  for (let i = 0; i < g.length; i++) out[i] = ((g[i] - lo) * 255) / range
  return fromGrey(out, img.width, img.height)
}

/** Inverted copy (keeps the alpha at 255). */
export function invertImage(img: RgbaImage): RgbaImage {
  const out = newImage(img.width, img.height)
  for (let i = 0; i < img.data.length; i += 4) {
    out.data[i] = 255 - img.data[i]
    out.data[i + 1] = 255 - img.data[i + 1]
    out.data[i + 2] = 255 - img.data[i + 2]
  }
  return out
}

// Separable box blur on a grey plane (edge clamped), radius in pixels.
function boxBlur(g: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(g.length)
  const out = new Float32Array(g.length)
  const n = 2 * r + 1
  for (let y = 0; y < h; y++) {
    let acc = 0
    for (let k = -r; k <= r; k++) acc += g[y * w + Math.min(w - 1, Math.max(0, k))]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / n
      acc += g[y * w + Math.min(w - 1, x + r + 1)] - g[y * w + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let k = -r; k <= r; k++) acc += tmp[Math.min(h - 1, Math.max(0, k)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
    }
  }
  return out
}

/** Unsharp mask on luminance (greyscale result): out = g + amount * (g - blur(g)). Helps text smeared by defocus. */
export function unsharp(img: RgbaImage, amount = 1.5, radius = 2): RgbaImage {
  const g = lumaGrey(img)
  const blur = boxBlur(boxBlur(g, img.width, img.height, radius), img.width, img.height, radius) // ~ gaussian
  const out = new Float32Array(g.length)
  for (let i = 0; i < g.length; i++) out[i] = g[i] + amount * (g[i] - blur[i])
  return fromGrey(out, img.width, img.height)
}

/**
 * Local (adaptive) threshold, black text on white. A pixel is "ink" when it is more than `bias` away from the mean of its
 * `window` neighbourhood, on the side opposite to the local background (polarity is decided once per image from the
 * global majority, as in binarizeForOcr). Copes with gradients and glare that defeat a single Otsu threshold.
 */
export function adaptiveBinarize(img: RgbaImage, window = 25, bias = 10): RgbaImage {
  const { width: w, height: h } = img
  const g = lumaGrey(img)
  const mean = boxBlur(g, w, h, Math.max(1, Math.floor(window / 2)))
  let above = 0
  for (let i = 0; i < g.length; i++) if (g[i] > mean[i]) above++
  // Text is the minority: if most pixels are brighter than their surroundings the text is dark-on-light already.
  const out = new Uint8ClampedArray(g.length)
  const lightText = above < g.length / 2
  for (let i = 0; i < g.length; i++) {
    const d = lightText ? g[i] - mean[i] : mean[i] - g[i]
    out[i] = d > bias ? 0 : 255
  }
  return fromGrey(out, w, h)
}

/** Non-destructive Otsu binarisation with the same polarity rule as binarizeForOcr; null when the image has no contrast. */
export function otsuBinarize(img: RgbaImage, mode: GreyMode = 'luma'): RgbaImage | null {
  const g = stretchContrast(img, mode)
  const copy = new Uint8ClampedArray(g.data)
  if (!binarizeForOcr(copy)) return null
  return { data: copy, width: g.width, height: g.height }
}
