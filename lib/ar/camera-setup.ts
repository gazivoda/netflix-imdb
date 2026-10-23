// Opening the rear camera at the best resolution it offers and tuning it for reading small text off a TV. Title logos are a few
// dozen pixels tall on a card that fills a tenth of a 1080p frame, so every pixel counts: ask for 4K first (devices that cannot
// deliver it fall back by themselves, and a browser that refuses the request gets 1080p), then switch on continuous focus and
// expose the zoom range when the track reports them. Everything is feature-detected and guarded: none of it may stop the camera.

export const CAMERA_TRIES: MediaTrackConstraints[] = [
  { facingMode: 'environment', width: { ideal: 3840 }, height: { ideal: 2160 } },
  { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
]

const isPermissionError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && ['NotAllowedError', 'SecurityError'].includes((err as { name?: string }).name ?? '')

/** getUserMedia with the highest practical resolution first. A refused permission is final; anything else tries the next size. */
export async function openCamera(md: { getUserMedia(c: MediaStreamConstraints): Promise<MediaStream> }): Promise<MediaStream> {
  let last: unknown
  for (const video of CAMERA_TRIES) {
    try {
      return await md.getUserMedia({ video, audio: false })
    } catch (err) {
      if (isPermissionError(err)) throw err
      last = err
    }
  }
  throw last
}

const errName = (err: unknown): string => (typeof err === 'object' && err !== null ? ((err as { name?: string }).name ?? '') : '')

/** What to tell the user when the camera could not be started, by the browser's error name. */
export function cameraErrorMessage(err: unknown): string {
  switch (errName(err)) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'Camera access was denied. Allow it in your browser settings and try again.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device.'
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'The camera is in use by another app or browser tab. Close it there and try again.'
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'This camera could not deliver the video this page asks for. Try another browser.'
    default:
      return 'Could not start the camera.'
  }
}

/** Shown when the camera was opened but no picture arrived (iOS Low Power Mode refuses autoplay, a stalled device). */
export const NO_FRAMES_MESSAGE = 'The camera started but no picture is coming through. Tap Stop Camera, then Start Camera again. If it stays black, check that Low Power Mode is off.'
export const PLAY_REFUSED_MESSAGE = 'Your browser did not start the video. Tap Start Camera again.'
export const CAMERA_STOPPED_MESSAGE = 'The camera stopped. Tap Start Camera to continue.'
export const NO_FRAMES_TIMEOUT_MS = 4000

export interface ZoomRange {
  min: number
  max: number
  step: number
  value: number
}

interface TrackLike {
  getCapabilities?(): object
  getSettings?(): object
  applyConstraints(c: MediaTrackConstraints): Promise<void>
}

// zoom and focusMode are not in every TypeScript DOM lib yet
const advanced = (c: Record<string, unknown>): MediaTrackConstraints => ({ advanced: [c as MediaTrackConstraintSet] })

const isRange = (v: unknown): v is { min: number; max: number; step?: number } =>
  typeof v === 'object' && v !== null && typeof (v as { min?: unknown }).min === 'number' && typeof (v as { max?: unknown }).max === 'number'

/** Continuous autofocus when the track supports it; the zoom range when it has one. Never throws. */
export async function tuneTrack(track: TrackLike): Promise<{ focus: boolean; zoom: ZoomRange | null }> {
  let caps: Record<string, unknown> = {}
  try {
    caps = (track.getCapabilities?.() ?? {}) as Record<string, unknown>
  } catch {
    return { focus: false, zoom: null }
  }
  let focus = false
  const modes = caps.focusMode
  if (Array.isArray(modes) && modes.includes('continuous')) {
    try {
      await track.applyConstraints(advanced({ focusMode: 'continuous' }))
      focus = true
    } catch {
      // some browsers list the mode but refuse it; the default focus behaviour still works
    }
  }
  let zoom: ZoomRange | null = null
  if (isRange(caps.zoom) && caps.zoom.max > caps.zoom.min) {
    const current = (track.getSettings?.() as Record<string, unknown> | undefined)?.zoom
    zoom = { min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step && caps.zoom.step > 0 ? caps.zoom.step : (caps.zoom.max - caps.zoom.min) / 20, value: typeof current === 'number' ? current : caps.zoom.min }
  }
  return { focus, zoom }
}

/** Applies a zoom level; false when the browser refuses it. */
export async function setZoom(track: TrackLike, value: number): Promise<boolean> {
  try {
    await track.applyConstraints(advanced({ zoom: value }))
    return true
  } catch {
    return false
  }
}
