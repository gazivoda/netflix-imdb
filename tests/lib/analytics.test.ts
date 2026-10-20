import fs from 'fs'
import path from 'path'
import { ANALYTICS_ENABLED, GA_MEASUREMENT_ID, GTAG_INIT } from '../../lib/analytics'

const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8')

describe('Google Analytics tag', () => {
  it('uses the website measurement id and Google\'s standard gtag snippet', () => {
    expect(GA_MEASUREMENT_ID).toBe('G-S5744YW7M7')
    expect(GTAG_INIT).toContain('window.dataLayer = window.dataLayer || [];')
    expect(GTAG_INIT).toContain("gtag('js', new Date());")
    expect(GTAG_INIT).toContain("gtag('config', 'G-S5744YW7M7');")
  })

  it('is off outside production (tests and local development are never measured)', () => {
    expect(process.env.NODE_ENV).not.toBe('production')
    expect(ANALYTICS_ENABLED).toBe(false)
  })

  it('is loaded once, in the root layout, from googletagmanager.com after the page is interactive', () => {
    const layout = read('app/layout.tsx')
    expect(layout).toContain('https://www.googletagmanager.com/gtag/js?id=')
    expect(layout.match(/strategy="afterInteractive"/g)).toHaveLength(2)
    expect(layout).toContain('ANALYTICS_ENABLED &&')
  })

  it('the privacy page discloses it: provider, cookies, lifetime, opt-out, and that the extension has none', () => {
    const privacy = read('app/privacy/page.tsx')
    expect(privacy).toContain('Website analytics')
    expect(privacy).toContain('Google Analytics 4')
    expect(privacy).toContain('_ga_S5744YW7M7')
    expect(privacy).toContain('tools.google.com/dlpage/gaoptout')
    expect(privacy).toMatch(/Chrome extension contains no analytics/)
  })
})
