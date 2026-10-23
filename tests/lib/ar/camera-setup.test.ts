import { CAMERA_TRIES, NO_FRAMES_MESSAGE, cameraErrorMessage, openCamera, setZoom, tuneTrack } from '../../../lib/ar/camera-setup'
import { quadInCrop, quadIsSkewed, quadSize } from '../../../lib/ar/tile-capture'

const stream = {} as MediaStream
const err = (name: string) => Object.assign(new Error(name), { name })

describe('openCamera', () => {
  it('asks for 4K first and falls back to 1080p when the device or browser refuses', async () => {
    const asked: unknown[] = []
    const md = {
      getUserMedia: async (c: MediaStreamConstraints) => {
        asked.push(c.video)
        if ((c.video as MediaTrackConstraints).width && ((c.video as MediaTrackConstraints).width as { ideal: number }).ideal > 2000) throw err('OverconstrainedError')
        return stream
      },
    }
    expect(await openCamera(md)).toBe(stream)
    expect(asked).toEqual(CAMERA_TRIES)
    expect(((CAMERA_TRIES[0].width as { ideal: number }).ideal)).toBe(3840)
    expect(((CAMERA_TRIES[1].width as { ideal: number }).ideal)).toBe(1920)
    expect(CAMERA_TRIES.every(t => t.facingMode === 'environment')).toBe(true)
  })

  it('stops at once when the user denies the camera (no second prompt)', async () => {
    let calls = 0
    const md = { getUserMedia: async () => { calls++; throw err('NotAllowedError') } }
    await expect(openCamera(md)).rejects.toMatchObject({ name: 'NotAllowedError' })
    expect(calls).toBe(1)
  })

  it('throws the last error when every size fails', async () => {
    const md = { getUserMedia: async () => { throw err('NotReadableError') } }
    await expect(openCamera(md)).rejects.toMatchObject({ name: 'NotReadableError' })
  })
})

describe('tuneTrack', () => {
  it('turns on continuous focus and reports the zoom range when the track has them', async () => {
    const applied: unknown[] = []
    const track = {
      getCapabilities: () => ({ focusMode: ['manual', 'continuous'], zoom: { min: 1, max: 5, step: 0.1 } }),
      getSettings: () => ({ zoom: 1 }),
      applyConstraints: async (c: unknown) => { applied.push(c) },
    }
    expect(await tuneTrack(track)).toEqual({ focus: true, zoom: { min: 1, max: 5, step: 0.1, value: 1 } })
    expect(applied).toEqual([{ advanced: [{ focusMode: 'continuous' }] }])
  })

  it('does nothing on a track without capabilities (Safari desktop, Firefox)', async () => {
    const applied: unknown[] = []
    expect(await tuneTrack({ applyConstraints: async c => void applied.push(c) })).toEqual({ focus: false, zoom: null })
    expect(applied).toEqual([])
  })

  it('survives a browser that lists a mode and then refuses it, and one whose getCapabilities throws', async () => {
    const refusing = { getCapabilities: () => ({ focusMode: ['continuous'] }), applyConstraints: async () => { throw err('OverconstrainedError') } }
    expect(await tuneTrack(refusing)).toEqual({ focus: false, zoom: null })
    const throwing = { getCapabilities: () => { throw new Error('nope') }, applyConstraints: async () => undefined }
    expect(await tuneTrack(throwing)).toEqual({ focus: false, zoom: null })
  })

  it('ignores a zoom range that is not a range', async () => {
    expect((await tuneTrack({ getCapabilities: () => ({ zoom: { min: 1, max: 1 } }), applyConstraints: async () => undefined })).zoom).toBeNull()
  })

  it('setZoom reports whether the browser accepted the value', async () => {
    expect(await setZoom({ applyConstraints: async () => undefined }, 2)).toBe(true)
    expect(await setZoom({ applyConstraints: async () => { throw err('OverconstrainedError') } }, 9)).toBe(false)
  })
})

describe('tile capture geometry', () => {
  const box = { x: 100, y: 50, w: 200, h: 112 }
  const straight: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [{ x: 100, y: 50 }, { x: 300, y: 50 }, { x: 300, y: 162 }, { x: 100, y: 162 }]
  it('rectifies only tiles whose corners are off the box', () => {
    expect(quadIsSkewed(straight, box)).toBe(false)
    expect(quadIsSkewed([{ x: 100, y: 58 }, { x: 300, y: 50 }, { x: 300, y: 162 }, { x: 100, y: 154 }], box)).toBe(true)
  })
  it('re-expresses corners inside the crop and measures the rectified size', () => {
    const q = quadInCrop(straight, { x: 100, y: 50 }, 3, 3)
    expect(q[2]).toEqual({ x: 600, y: 336 })
    expect(quadSize(q)).toEqual({ w: 600, h: 336 })
  })
})

describe('cameraErrorMessage', () => {
  it('tells permission, missing camera and busy camera apart', () => {
    const denied = cameraErrorMessage(err('NotAllowedError'))
    const missing = cameraErrorMessage(err('NotFoundError'))
    const busy = cameraErrorMessage(err('NotReadableError'))
    expect(denied).toMatch(/denied/i)
    expect(missing).toMatch(/no camera/i)
    expect(busy).toMatch(/in use by another app/i)
    expect(new Set([denied, missing, busy, cameraErrorMessage(err('OverconstrainedError')), cameraErrorMessage(new Error('x'))]).size).toBe(5)
  })
  it('is generic for anything else and never throws on odd input', () => {
    expect(cameraErrorMessage(undefined)).toBe('Could not start the camera.')
    expect(cameraErrorMessage('boom')).toBe('Could not start the camera.')
    for (const m of [cameraErrorMessage(err('NotReadableError')), NO_FRAMES_MESSAGE]) expect(m).not.toMatch(/—|–/)
  })
  it('an OverconstrainedError on the 4K try is still silent: the 1080p try succeeds', async () => {
    const stream = {} as MediaStream
    let n = 0
    const md = { getUserMedia: async () => { if (n++ === 0) throw err('OverconstrainedError'); return stream } }
    expect(await openCamera(md)).toBe(stream)
  })
})
