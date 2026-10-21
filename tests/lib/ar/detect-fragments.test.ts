import { RgbaImage } from '../../../lib/card-hash'
import { Box, iou } from '../../../lib/card-tracker'
import { detectCards } from '../../../lib/ar/detect-grid'
import { findCards } from '../../../lib/ar/card-finder'

// The runtime case from the AR diagnosis: big, high-contrast title text on dark cards whose own edges are faint (a clean synthetic
// screen, cards 400 px wide on a 1080p frame). The text edges outvoted the card edges and the finder reported dozens of letter-group
// boxes, which OCR then "read" ("saw L", "NO TEXT"). The page analyses a 640x360 resample of the guide, so the frame is built at that size.

type Rgb = [number, number, number]

const GLYPHS: Record<string, string[]> = {
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
}
const WORDS = ['OZARK', 'NARCOS', 'DARK', 'LUPIN', 'ZONE']

function rect(img: RgbaImage, x: number, y: number, w: number, h: number, c: Rgb): void {
  for (let yy = Math.max(0, y); yy < Math.min(img.height, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(img.width, x + w); xx++) img.data.set([c[0], c[1], c[2], 255], (yy * img.width + xx) * 4)
  }
}

/** 3 rows x 4 cards on a near-black screen; each card is a flat dark fill carrying its title in big bright pixel-font letters. */
function textHeavyScreen(cardLum: number, textFrac: number): { img: RgbaImage; cards: Box[] } {
  const W = 640
  const H = 360
  const cw = 133
  const ch = 75
  const img: RgbaImage = { data: new Uint8ClampedArray(W * H * 4), width: W, height: H }
  rect(img, 0, 0, W, H, [20, 20, 22])
  const cards: Box[] = []
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const x = 36 + c * (cw + 20)
      const y = 24 + r * (ch + 14)
      const l = cardLum + ((r + c) % 3) * 3
      rect(img, x, y, cw, ch, [l, l, l])
      const lum = r === 1 ? 120 : 245 // the middle row has the lower-contrast text, as in the diagnosis
      const th = Math.round(ch * textFrac)
      const sc = th / 7
      let tx = x + Math.round(cw * 0.06)
      for (const g of WORDS[(r * 4 + c) % WORDS.length]) {
        const bm = GLYPHS[g]
        for (let gy = 0; gy < 7; gy++) {
          for (let gx = 0; gx < 5; gx++) {
            if (bm[gy][gx] === '#') rect(img, tx + Math.round(gx * sc), y + Math.round(ch * (r === 0 ? 0.55 : 0.3)) + Math.round(gy * sc), Math.max(1, Math.round(sc)), Math.max(1, Math.round(sc)), [lum, lum, lum])
          }
        }
        tx += Math.round(6.2 * sc)
      }
      cards.push({ x, y, w: cw, h: ch })
    }
  }
  return { img, cards }
}

const matched = (found: Box[], truth: Box[]) => truth.filter(t => found.some(f => iou(f, t) >= 0.5)).length
const fragments = (found: Box[], cw: number, ch: number) => found.filter(f => f.w < 0.6 * cw || f.h < 0.6 * ch)

describe('card detection on a text-heavy screen (fragment boxes)', () => {
  for (const [lum, frac] of [[32, 0.45], [40, 0.45], [40, 0.55], [50, 0.55]] as const) {
    it(`reports whole cards, not letter groups (card luminance ${lum}, text ${Math.round(frac * 100)}% of the card height)`, () => {
      const { img, cards } = textHeavyScreen(lum, frac)
      const found = detectCards(img).map(c => c.box)
      expect(fragments(found, 133, 75)).toEqual([])
      expect(matched(found, cards)).toBeGreaterThanOrEqual(11)
    })
  }

  it('findCards (what the page calls) never hands OCR a fragment either', () => {
    const { img } = textHeavyScreen(40, 0.45)
    expect(fragments(findCards(img), 133, 75)).toEqual([])
  })

  it('still reports every box of a normal screen (no real tile is mistaken for a fragment)', () => {
    const { img, cards } = textHeavyScreen(60, 0.12)
    const found = detectCards(img).map(c => c.box)
    expect(matched(found, cards)).toBeGreaterThanOrEqual(11)
  })
})
