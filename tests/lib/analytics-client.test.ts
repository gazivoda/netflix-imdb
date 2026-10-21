import { cookieDomains, expiryCookieStrings, gaCookieNames } from '../../lib/analytics-client'

describe('analytics client helpers', () => {
  it('names the two Google cookies for the measurement id', () => {
    expect(gaCookieNames('G-S5744YW7M7')).toEqual(['_ga', '_ga_S5744YW7M7'])
  })

  it('covers the host and its parent domains (www and apex)', () => {
    expect(cookieDomains('www.rating.watch')).toEqual(['www.rating.watch', 'rating.watch'])
    expect(cookieDomains('rating.watch')).toEqual(['rating.watch'])
    expect(cookieDomains('localhost')).toEqual(['localhost'])
    expect(cookieDomains('127.0.0.1')).toEqual(['127.0.0.1'])
  })

  it('expires each cookie on the host-only scope and on every domain variant', () => {
    const c = expiryCookieStrings('www.rating.watch', 'G-S5744YW7M7')
    expect(c).toHaveLength(2 * (1 + 2 * 2))
    expect(c.every((s) => /max-age=0/.test(s) && /expires=Thu, 01 Jan 1970/.test(s) && /path=\//.test(s))).toBe(true)
    expect(c).toContain('_ga=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/')
    expect(c.some((s) => s.startsWith('_ga_S5744YW7M7=') && s.endsWith('domain=.rating.watch'))).toBe(true)
    expect(c.some((s) => s.startsWith('_ga=') && s.endsWith('domain=www.rating.watch'))).toBe(true)
  })
})

// loadAnalytics / revokeAnalytics against a minimal fake DOM, with the production flag on.
describe('loadAnalytics and revokeAnalytics (production, fake DOM)', () => {
  const g = globalThis as unknown as Record<string, unknown>
  const env = process.env as Record<string, string | undefined>
  const originalEnv = env.NODE_ENV
  let appended: Array<{ id: string; src: string; async: boolean }>
  let cookies: string[]
  let mod: typeof import('../../lib/analytics-client')

  beforeEach(() => {
    appended = []
    cookies = []
    g.window = { location: { hostname: 'www.rating.watch' } }
    g.document = {
      getElementById: (id: string) => appended.find((s) => s.id === id) ?? null,
      createElement: () => ({ id: '', src: '', async: false }),
      head: { appendChild: (el: { id: string; src: string; async: boolean }) => appended.push(el) },
      set cookie(v: string) {
        cookies.push(v)
      },
      get cookie() {
        return ''
      },
    }
    env.NODE_ENV = 'production'
    jest.resetModules()
    mod = require('../../lib/analytics-client')
  })
  afterEach(() => {
    env.NODE_ENV = originalEnv
    delete g.window
    delete g.document
  })

  it('injects gtag.js once, initialises the dataLayer, and is idempotent', () => {
    expect(mod.loadAnalytics()).toBe(true)
    expect(mod.loadAnalytics()).toBe(true)
    expect(appended).toHaveLength(1)
    expect(appended[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-S5744YW7M7')
    const win = g.window as { dataLayer: unknown[][] }
    expect(win.dataLayer).toHaveLength(2) // js + config, not duplicated by the second call
    expect(Array.from(win.dataLayer[0] as ArrayLike<unknown>)[0]).toBe('js')
    expect(Array.from(win.dataLayer[1] as ArrayLike<unknown>)).toEqual(['config', 'G-S5744YW7M7'])
  })

  it('revoke sets the ga-disable flag and expires cookies; load afterwards re-enables it', () => {
    const win = g.window as Record<string, unknown>
    mod.revokeAnalytics()
    mod.revokeAnalytics()
    expect(win['ga-disable-G-S5744YW7M7']).toBe(true)
    expect(cookies.length).toBe(2 * 2 * (1 + 4))
    mod.loadAnalytics()
    expect(win['ga-disable-G-S5744YW7M7']).toBe(false)
  })
})

describe('outside production', () => {
  it('loadAnalytics does nothing: no script, no dataLayer', () => {
    const g = globalThis as unknown as Record<string, unknown>
    const created: unknown[] = []
    g.window = {}
    g.document = { getElementById: () => null, createElement: () => (created.push(1), {}), head: { appendChild: () => created.push(2) } }
    jest.resetModules() // drop the production-flagged copy cached by the previous describe
    try {
      expect(require('../../lib/analytics-client').loadAnalytics()).toBe(false)
      expect(created).toHaveLength(0)
      expect((g.window as Record<string, unknown>).dataLayer).toBeUndefined()
    } finally {
      delete g.window
      delete g.document
    }
  })
})
