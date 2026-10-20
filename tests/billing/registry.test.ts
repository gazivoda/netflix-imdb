import { PAGES, getPage } from '../../lib/pages'
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
  it('describes /camera-vision/ar as the Pro AR mode with a trial, not an experimental demo', () => {
    const page = getPage('/camera-vision/ar')
    expect(page.description).not.toMatch(/experimental|demo/i)
    expect(page.description).toMatch(/\bPro\b/)
    expect(page.description).toMatch(/3-day free trial/)
    expect(page.description.length).toBeGreaterThanOrEqual(70)
    expect(page.description.length).toBeLessThanOrEqual(160)
  })
})

