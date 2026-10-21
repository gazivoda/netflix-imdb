import fs from 'fs'
import path from 'path'
import { reserveBottomSpace } from '../components/consent-space'
import { arLinkLabel, billingView, pricingLead, proCardCopy, PRO_NOT_ON_SALE } from '../components/billing/pricing-state'

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
    expect(compact).toMatch(/flex-direction:\s*column/)
    expect(compact).toMatch(/min-height:\s*4[4-9]px/)
    expect(css).toMatch(/\.text a \{[^}]*padding:/)
  })
  it('both banner buttons keep one shared style', () => {
    const tsx = read('components/ConsentBanner.tsx')
    expect(tsx.match(/className=\{c\.btn\}/g)).toHaveLength(2)
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
    expect(off).toEqual({ priceLine: false, comingSoon: PRO_NOT_ON_SALE, terms: false })
    expect(PRO_NOT_ON_SALE).toMatch(/not on sale yet/i)
    expect(PRO_NOT_ON_SALE).toMatch(/free to try/i)
    expect(proCardCopy('on')).toEqual({ priceLine: true, comingSoon: null, terms: true })
    for (const v of ['checking', 'unreachable'] as const) expect(proCardCopy(v).terms).toBe(false)
    expect(pricingLead('off')).toMatch(/free to try/i)
    expect(pricingLead('off')).not.toMatch(/paid feature/i)
    expect(pricingLead('on')).toMatch(/paid feature/i)
  })
  it('camera-vision link label follows billing', () => {
    expect(arLinkLabel('off')).toBe('Try AR mode (free for now)')
    expect(arLinkLabel('on')).toBe('Try AR mode (Pro, 3-day trial)')
    expect(arLinkLabel('checking')).not.toMatch(/trial|Pro/)
    expect(arLinkLabel('unreachable')).not.toMatch(/trial|Pro/)
  })
  it('pricing and camera pages use the helpers instead of hard-coded promises', () => {
    const pricing = read('app/pricing/PricingClient.tsx')
    const trialLines = pricing.split('\n').filter((l) => /3-day|refund within/.test(l))
    expect(trialLines.length).toBeGreaterThan(0)
    for (const l of trialLines) expect(l).toMatch(/copy\.terms/)
    expect(read('app/pricing/page.tsx')).not.toMatch(/3-day|refund within/)
    const camera = read('app/camera-vision/page.tsx')
    expect(camera).toMatch(/arLinkLabel\(billingView\(account\)\)/)
    expect(camera).not.toMatch(/Pro, 3-day trial/)
  })
  it('an unreachable account API fails closed instead of faking a billing-on state', () => {
    expect(read('components/billing/useAccount.ts')).toMatch(/failed: true[^\n]*billingEnabled: false/)
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
