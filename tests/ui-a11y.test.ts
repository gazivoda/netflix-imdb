import fs from 'fs'
import path from 'path'
import { escapeDismissesBanner, focusTargetAfterBanner } from '../components/consent-focus'
import { reserveBottomSpace } from '../components/consent-space'
import { AR_LINK_LABEL, billingView, COMING_SOON_BADGE, pricingLead, proCardCopy, PRO_NOT_ON_SALE } from '../components/billing/pricing-state'

const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')

describe('cookie banner reserves page space', () => {
  const fakeRoot = () => {
    const vars = new Map<string, string>()
    const root = { style: { setProperty: (k: string, v: string) => void vars.set(k, v), removeProperty: (k: string) => { const o = vars.get(k) ?? ''; vars.delete(k); return o } } }
    return { root: root as unknown as HTMLElement, vars }
  }
  it('publishes the height, follows resizes, and removes the variable on cleanup', () => {
    const { root, vars } = fakeRoot()
    const el = { offsetHeight: 180 } as unknown as HTMLElement
    let fire: () => void = () => {}
    let disconnected = false
    class FakeObserver { constructor(cb: () => void) { fire = cb } observe() {} disconnect() { disconnected = true } }
    const stop = reserveBottomSpace(root, el, FakeObserver as unknown as typeof ResizeObserver)
    expect(vars.get('--consent-h')).toBe('180px')
    ;(el as { offsetHeight: number }).offsetHeight = 120
    fire()
    expect(vars.get('--consent-h')).toBe('120px')
    stop()
    expect(vars.has('--consent-h')).toBe(false)
    expect(disconnected).toBe(true)
  })
  it('works without ResizeObserver', () => {
    const { root, vars } = fakeRoot()
    const stop = reserveBottomSpace(root, { offsetHeight: 90 } as unknown as HTMLElement)
    expect(vars.get('--consent-h')).toBe('90px')
    stop()
    expect(vars.size).toBe(0)
  })
  it('body pads by the variable and the banner has a compact phone layout with 44px targets', () => {
    expect(read('app/globals.css')).toMatch(/padding-bottom:\s*var\(--consent-h,\s*0px\)/)
    const css = read('components/ConsentBanner.module.css')
    const compact = css.slice(css.indexOf('@media (max-width: 480px)'))
    // One row of equal buttons keeps the phone banner short (about 117px at 390px wide); the old stacked layout was 192px.
    expect(compact).toMatch(/\.actions \{[^}]*flex-direction:\s*row/)
    expect(compact).not.toMatch(/flex-direction:\s*column/)
    expect(compact).toMatch(/\.btn \{[^}]*flex:\s*1 1 0/)
    expect(compact).toMatch(/min-height:\s*4[4-9]px/)
    expect(css).toMatch(/\.text a \{[^}]*padding:/)
  })
  it('both banner buttons keep one shared style', () => {
    const tsx = read('components/ConsentBanner.tsx')
    expect(tsx.match(/className=\{c\.btn\}/g)).toHaveLength(2)
  })
  it('estimated phone height stays near 120px: two 14px text lines, one 44px button row, padding and gaps', () => {
    const css = read('components/ConsentBanner.module.css')
    const compact = css.slice(css.indexOf('@media (max-width: 480px)'))
    const px = (re: RegExp) => Number(re.exec(compact)![1])
    const textLines = 2
    const height = 3 /* top border */ + 2 * px(/\.banner \{ padding: (\d+)px/) + textLines * 14 * 1.45 + px(/\.inner \{ gap: (\d+)px/) + px(/\.btn \{[^}]*min-height: (\d+)px/)
    expect(height).toBeLessThanOrEqual(125)
    // The copy must really fit two lines at 390px: 358px of text width at 14px is about 55 characters per line.
    const text = read('components/ConsentBanner.tsx').match(/<p className=\{c\.text\}>([\s\S]*?)<\/p>/)![1].replace(/\{' '\}|<[^>]+>|\s+/g, ' ').trim()
    expect(text.length).toBeLessThanOrEqual(2 * 55)
  })
  it('scroll-padding-bottom follows the banner height so focused elements are never hidden under it', () => {
    expect(read('app/globals.css')).toMatch(/html \{[^}]*scroll-padding-bottom:\s*var\(--consent-h,\s*0px\)/)
  })
  it('the skip link is first in the body, before the banner, and only rendered once (layout)', () => {
    const layout = read('app/layout.tsx')
    expect(layout.indexOf('className="skip-link"')).toBeGreaterThan(-1)
    expect(layout.indexOf('className="skip-link"')).toBeLessThan(layout.indexOf('<ConsentBanner />'))
    expect(read('components/SiteHeader.tsx')).not.toMatch(/skip-link/)
    expect(read('app/page.tsx')).not.toMatch(/skip-link/)
  })
  it('Escape closes only the reopened banner; the first-visit banner stays until a choice is made', () => {
    expect(escapeDismissesBanner(false, null)).toBe(false) // first visit
    expect(escapeDismissesBanner(true, null)).toBe(false) // reopened, but there is no choice to fall back on
    expect(escapeDismissesBanner(true, 'granted')).toBe(true)
    expect(escapeDismissesBanner(true, 'denied')).toBe(true)
    expect(escapeDismissesBanner(false, 'granted')).toBe(false)
    const tsx = read('components/ConsentBanner.tsx')
    expect(tsx).toMatch(/if \(!open \|\| !reopened\) return/)
  })
  it('focus returns to the opener after a reopened banner closes, else to #main, never body', () => {
    const el = (connected = true) => ({ isConnected: connected, focus: () => {} })
    const main = el()
    const doc = { getElementById: (id: string) => (id === 'main' ? main : null) }
    const opener = el()
    expect(focusTargetAfterBanner(opener, doc)).toBe(opener)
    expect(focusTargetAfterBanner(null, doc)).toBe(main)
    expect(focusTargetAfterBanner(el(false), doc)).toBe(main)
    expect(focusTargetAfterBanner(null, { getElementById: () => null })).toBeNull()
    expect(focusTargetAfterBanner(null, { getElementById: () => el(false) })).toBeNull()
  })
})

describe('promo video keeps focus', () => {
  const src = read('components/home/PromoVideo.tsx')
  it('moves focus to the video on Play and back to Play when it returns', () => {
    expect(src).toMatch(/video\.focus\(/)
    expect(src).toMatch(/tabIndex=\{-1\}/)
    expect(src).toMatch(/playRef\.current\?\.focus\(\)/)
    expect(src).toMatch(/controls=\{started\}/)
    expect(src).toMatch(/aria-label=\{PROMO_VIDEO\.title\}/)
    expect(src).not.toMatch(/autoPlay/i)
  })
})

describe('billing off never promises a trial or a purchase', () => {
  it('billingView', () => {
    expect(billingView({ loading: true, billingEnabled: false })).toBe('checking')
    expect(billingView({ loading: false, billingEnabled: false })).toBe('off')
    expect(billingView({ loading: false, billingEnabled: true })).toBe('on')
    expect(billingView({ loading: false, failed: true, billingEnabled: false })).toBe('unreachable')
  })
  it('pricing: off shows the honest state, on keeps the trial terms', () => {
    const off = proCardCopy('off')
    // The plan prices stay visible while billing is off (with a badge), so a reviewer or visitor can see what Pro will cost.
    expect(off).toEqual({ priceLine: true, comingSoon: PRO_NOT_ON_SALE, badge: COMING_SOON_BADGE, terms: false })
    expect(PRO_NOT_ON_SALE).toMatch(/not on sale yet/i)
    expect(PRO_NOT_ON_SALE).toMatch(/free to try/i)
    expect(proCardCopy('on')).toEqual({ priceLine: true, comingSoon: null, badge: null, terms: true })
    for (const v of ['checking', 'unreachable'] as const) expect(proCardCopy(v).terms).toBe(false)
    expect(pricingLead('off')).toMatch(/free to try/i)
    expect(pricingLead('off')).not.toMatch(/paid feature/i)
    expect(pricingLead('on')).toMatch(/paid feature/i)
  })
  it('camera-vision link label is static, so it cannot shift the layout when the account check finishes', () => {
    expect(AR_LINK_LABEL).toBe('Try AR mode')
    expect(AR_LINK_LABEL).not.toMatch(/trial|Pro|free/i)
  })
  it('pricing and camera pages use the helpers instead of hard-coded promises', () => {
    const pricing = read('app/pricing/PricingClient.tsx')
    const trialLines = pricing.split('\n').filter((l) => /3-day|refund within/.test(l))
    expect(trialLines.length).toBeGreaterThan(0)
    for (const l of trialLines) expect(l).toMatch(/copy\.terms/)
    expect(read('app/pricing/page.tsx')).not.toMatch(/3-day|refund within/)
    const camera = read('app/camera-vision/page.tsx')
    expect(camera).toMatch(/\{AR_LINK_LABEL\}/)
    expect(camera).not.toMatch(/useAccount/)
    expect(camera).not.toMatch(/Pro, 3-day trial/)
  })
  it('an unreachable or failing account API fails closed instead of faking a billing-on state', () => {
    const hook = read('components/billing/useAccount.ts')
    expect(hook).toMatch(/failed: true[^\n]*billingEnabled: false/)
    // A non-2xx answer (e.g. the 503 with no billingEnabled) must be a failure, never read as "billing off".
    expect(hook).toMatch(/if \(!res\.ok\) throw/)
    expect(hook.indexOf('res.ok')).toBeLessThan(hook.indexOf('res.json()'))
  })
})

describe('camera demo', () => {
  const src = read('app/camera-vision/page.tsx')
  it('has no blocking alert() or console.log noise, and a sensible heading order', () => {
    expect(src).not.toMatch(/\balert\(/)
    expect(src).not.toMatch(/console\.log\(/)
    expect(src).toMatch(/role="alert"/)
    expect(src).not.toMatch(/<h4/)
    expect(src.indexOf('<h2')).toBeGreaterThan(src.indexOf('<h1'))
    expect(src.indexOf('<h3')).toBeGreaterThan(src.indexOf('<h2'))
  })
})
