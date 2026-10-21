import { PAGES, getPage, staticPages } from '../../lib/pages'
import { renderedTitle } from '../../lib/seo'

describe('billing pages in the registry', () => {
  it('registers pricing, terms and refund-policy but NOT /account or /api (dynamic, noindex)', () => {
    for (const p of ['/pricing', '/terms', '/refund-policy']) expect(getPage(p)).toBeDefined()
    expect(PAGES.some((p) => p.path.startsWith('/account') || p.path.startsWith('/api'))).toBe(false)
  })
  it('keeps rendered titles within SERP length and descriptions within 160 chars', () => {
    for (const path of ['/pricing', '/terms', '/refund-policy']) {
      const page = getPage(path)
      expect(renderedTitle(page).length).toBeLessThanOrEqual(65)
      expect(page.description.length).toBeGreaterThanOrEqual(70)
      expect(page.description.length).toBeLessThanOrEqual(160)
    }
  })
  it('describes /camera-vision/ar as the Pro AR mode with a trial once Pro is on sale', () => {
    const page = staticPages(true).find((p) => p.path === '/camera-vision/ar')!
    expect(page.description).not.toMatch(/experimental|demo/i)
    expect(page.description).toMatch(/\bPro\b/)
    expect(page.description).toMatch(/3-day free trial/)
    expect(page.description.length).toBeGreaterThanOrEqual(70)
    expect(page.description.length).toBeLessThanOrEqual(160)
  })
})

describe('Pro wording follows the billing flag (build-time)', () => {
  const off = staticPages(false)
  const on = staticPages(true)
  const desc = (list: typeof off, path: string) => list.find((p) => p.path === path)!.description

  it('while Pro is not on sale no description promises a price, trial or refund', () => {
    for (const p of off) expect(p.description).not.toMatch(/3-day|free trial|14-day|refund window|\$\d|\bPro adds\b|Rating Watch Pro/)
    expect(desc(off, '/pricing')).toMatch(/not on sale/)
    expect(desc(off, '/camera-vision/ar')).toMatch(/free to try/i)
  })
  it('once Pro is on sale the pricing and AR descriptions carry the prices and the trial', () => {
    expect(desc(on, '/pricing')).toMatch(/\$2\.99 a month or \$29 a year.*3-day free trial.*14-day refund/)
    expect(desc(on, '/camera-vision/ar')).toMatch(/3-day free trial/)
  })
  it('both variants stay within SERP limits, and only the Pro-related pages differ', () => {
    for (const list of [off, on]) {
      for (const p of list) {
        expect(p.description.length).toBeGreaterThanOrEqual(70)
        expect(p.description.length).toBeLessThanOrEqual(160)
      }
    }
    const changed = on.filter((p, i) => p.description !== off[i].description).map((p) => p.path)
    expect(changed.sort()).toEqual(['/camera-vision/ar', '/pricing', '/refund-policy', '/terms'])
    expect(new Set(off.map((p) => p.description)).size).toBe(off.length)
  })
})
