/**
 * End-to-end check of the camera OCR pipeline on a known image, without a browser or camera:
 * fixture screenshot -> binarizeForOcr -> Tesseract -> wordsFromBlocks -> extractMovieTitles.
 *
 * The fixture (tests/fixtures/netflix-screen.png) is a 1280x720 dark, Netflix-style screen with
 * five light titles, i.e. the case the camera page used to silently fail on.
 * Tesseract downloads its English model on first run, so this needs network access once.
 */
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { createWorker } from 'tesseract.js'
import { binarizeForOcr } from '../../lib/ocr-preprocess'
import { extractMovieTitles, wordsFromBlocks } from '../../lib/extract-titles'

const FIXTURE = path.join(__dirname, '..', 'fixtures', 'netflix-screen.png')
const EXPECTED_TITLES = ['Stranger Things', 'Breaking Bad', 'The Crown', 'Squid Game', 'Wednesday']

// Minimal decoder for the fixture: 8-bit, non-interlaced RGB/RGBA PNG.
function decodePng(file: Buffer): { width: number; height: number; rgba: Uint8ClampedArray } {
  let offset = 8 // skip signature
  let width = 0
  let height = 0
  let channels = 0
  const idat: Buffer[] = []
  while (offset < file.length) {
    const length = file.readUInt32BE(offset)
    const type = file.toString('ascii', offset + 4, offset + 8)
    const body = file.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      channels = body[9] === 6 ? 4 : 3
      if (body[8] !== 8 || (body[9] !== 2 && body[9] !== 6) || body[12] !== 0) {
        throw new Error('fixture must be an 8-bit, non-interlaced RGB/RGBA PNG')
      }
    } else if (type === 'IDAT') {
      idat.push(body)
    }
    offset += 12 + length
  }

  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const px = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? px[y * stride + i - channels] : 0
      const b = y > 0 ? px[(y - 1) * stride + i] : 0
      const c = i >= channels && y > 0 ? px[(y - 1) * stride + i - channels] : 0
      let add = 0
      if (filter === 1) add = a
      else if (filter === 2) add = b
      else if (filter === 3) add = (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      px[y * stride + i] = (line[i] + add) & 0xff
    }
  }

  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = px[i * channels]
    rgba[i * 4 + 1] = px[i * channels + 1]
    rgba[i * 4 + 2] = px[i * channels + 2]
    rgba[i * 4 + 3] = channels === 4 ? px[i * channels + 3] : 255
  }
  return { width, height, rgba }
}

// Leptonica reads PGM, which avoids needing a PNG encoder here.
function toPgm(width: number, height: number, rgba: Uint8ClampedArray): Buffer {
  const header = Buffer.from(`P5\n${width} ${height}\n255\n`)
  const gray = Buffer.alloc(width * height)
  for (let i = 0; i < gray.length; i++) gray[i] = rgba[i * 4]
  return Buffer.concat([header, gray])
}

describe('camera OCR pipeline on the Netflix-style fixture', () => {
  it('has the fixture and its top-left pixel is black (the old "empty frame" trap)', () => {
    const { rgba } = decodePng(fs.readFileSync(FIXTURE))
    expect([rgba[0], rgba[1], rgba[2]]).toEqual([20, 20, 20])
  })

  it('reads all five titles from the dark screenshot', async () => {
    const { width, height, rgba } = decodePng(fs.readFileSync(FIXTURE))

    expect(binarizeForOcr(rgba)).toBe(true)

    const worker = await createWorker('eng')
    try {
      await worker.setParameters({ tessedit_pageseg_mode: 11 as any })
      const { data } = await worker.recognize(toPgm(width, height, rgba), {}, { blocks: true })

      const titles = extractMovieTitles(wordsFromBlocks(data.blocks as any), 1).map(t => t.title)

      for (const expected of EXPECTED_TITLES) {
        expect(titles).toContain(expected)
      }
    } finally {
      await worker.terminate()
    }
  }, 120_000)
})
