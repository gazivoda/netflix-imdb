import fs from 'fs'
import path from 'path'
import { ANALYTICS_ENABLED, CONSENT_BANNER_ENABLED, GA_MEASUREMENT_ID, GTAG_INIT } from '../../lib/analytics'

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

  it('the consent banner shows wherever an id exists; loading still needs production', () => {
    expect(CONSENT_BANNER_ENABLED).toBe(true)
    const client = read('lib/analytics-client.ts')
    expect(client).toContain('if (!ANALYTICS_ENABLED')
  })

  it('nothing Google-related is in the layout: no tag, no next/script, only the consent banner', () => {
    const layout = read('app/layout.tsx')
    expect(layout).not.toMatch(/googletagmanager/i)
    expect(layout).not.toMatch(/next\/script/)
    expect(layout).not.toMatch(/<Script/)
    expect(layout).not.toMatch(/GTAG_INIT|ANALYTICS_ENABLED/)
    expect(layout).toContain("import ConsentBanner from '../components/ConsentBanner'")
    // First in the body, ahead of the page content, so assistive technology reaches it early.
    expect(layout).toMatch(/<body>\s*(\{\/\*[^]*?\*\/\}\s*)?<ConsentBanner \/>\s*\{children\}/)
  })

  it('the tag is requested only from loadAnalytics, which only the banner calls after Accept or a stored grant', () => {
    const client = read('lib/analytics-client.ts')
    expect(client).toContain('https://www.googletagmanager.com/gtag/js?id=')
    const banner = read('components/ConsentBanner.tsx')
    expect(banner).toMatch(/stored === 'granted'\) loadAnalytics\(\)/)
    expect(banner).toMatch(/if \(value === 'granted'\) loadAnalytics\(\)/)
    expect(banner.match(/loadAnalytics\(\)/g)).toHaveLength(2)
    // No other module may load it.
    for (const f of ['app/layout.tsx', 'components/CookieSettings.tsx', 'components/SiteFooter.tsx', 'components/home/HomeFooter.tsx']) {
      expect(read(f)).not.toContain('loadAnalytics')
    }
  })

  it('the banner has equal-weight Accept and Decline buttons, Escape only for the reopened banner, and the required copy', () => {
    const banner = read('components/ConsentBanner.tsx')
    expect(banner).toContain('role="region"')
    expect(banner).toContain('aria-label="Cookie consent"')
    expect(banner).toContain('Accept analytics')
    expect(banner).toContain('>Decline<')
    expect(banner).toContain('href="/privacy#website-analytics"')
    // The first-visit banner asks for a decision and cannot be dismissed with Escape. The only key handling is the
    // listener that exists while a previously made choice is being reviewed (see components/consent-focus.ts).
    expect(banner).not.toMatch(/keyup/)
    expect(banner.match(/keydown/g)).toHaveLength(2) // addEventListener + removeEventListener
    expect(banner).toMatch(/if \(!open \|\| !reopened\) return/)
    expect(banner).toMatch(/escapeDismissesBanner\(reopened, readConsent\(browserStorage\(\)\)\)/)
    expect(banner).toContain('Nothing is sent to Google')
    const buttons = banner.match(/<button[^>]*>/g) ?? []
    expect(buttons).toHaveLength(2)
    expect(new Set(buttons.map((b) => b.match(/className=\{[^}]+\}/)?.[0])).size).toBe(1)
  })

  it('both footers include the Cookie settings control', () => {
    for (const f of ['components/SiteFooter.tsx', 'components/home/HomeFooter.tsx']) {
      const src = read(f)
      expect(src).toContain("import CookieSettings from")
      expect(src).toContain('<CookieSettings />')
    }
    expect(read('components/CookieSettings.tsx')).toContain('Cookie settings')
    expect(read('components/CookieSettings.tsx')).toContain('OPEN_CONSENT_EVENT')
  })

  it('the privacy page discloses it: provider, cookies, lifetime, opt-out, and that the extension has none', () => {
    const privacy = read('app/privacy/page.tsx')
    expect(privacy).toContain('Website analytics')
    expect(privacy).toContain('Google Analytics 4')
    expect(privacy).toContain('_ga_S5744YW7M7')
    expect(privacy).toContain('tools.google.com/dlpage/gaoptout')
    expect(privacy).toMatch(/Chrome extension contains no analytics/)
    expect(privacy).toContain('id="website-analytics"')
    expect(privacy).toContain('rw_consent')
    expect(privacy).toMatch(/only after you press Accept/)
    expect(privacy).toMatch(/Cookie settings/)
    expect(privacy).toMatch(/Paddle&apos;s checkout may set its own cookies/)
  })
})
