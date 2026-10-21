import fs from 'fs'
import path from 'path'

// The paywall refreshes through the app router, which does not exist in a plain render.
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }))

const ROOT = path.join(__dirname, '..')
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8')
const exists = (f: string) => fs.existsSync(path.join(ROOT, f))

describe('/favicon.ico', () => {
  it('ships app/favicon.ico (Next serves it at /favicon.ico) as a real multi-size ICO', () => {
    expect(exists('app/favicon.ico')).toBe(true)
    const buf = fs.readFileSync(path.join(ROOT, 'app/favicon.ico'))
    // ICONDIR: reserved 0, type 1 (icon), image count
    expect([buf.readUInt16LE(0), buf.readUInt16LE(2)]).toEqual([0, 1])
    expect(buf.readUInt16LE(4)).toBeGreaterThanOrEqual(2)
    expect(buf.length).toBeGreaterThan(1000)
  })
})

describe('data tables are reachable and named', () => {
  it('the compare table wrapper is a focusable, labelled region, like the other scroll wrappers', () => {
    const src = read('app/compare/imdb-vs-rotten-tomatoes/page.tsx')
    expect(src).toMatch(/<div className=\{g\.tableWrap\} role="region" aria-label="[^"]+" tabIndex=\{0\}>/)
  })
  it.each([
    'app/compare/imdb-vs-rotten-tomatoes/page.tsx',
    'app/compare/alternatives/page.tsx',
    'app/research/imdb-vs-rotten-tomatoes-gap/page.tsx',
    'app/how-to/find-what-to-watch-on-netflix/page.tsx',
  ])('%s: every table has a caption', (file) => {
    const src = read(file)
    const tables = src.match(/<table\b/g) ?? []
    const captions = src.match(/<caption\b/g) ?? []
    expect(tables.length).toBeGreaterThan(0)
    expect(captions).toHaveLength(tables.length)
  })
  it('scrollable wrappers on the three data tables all have tabIndex, role and a label', () => {
    for (const file of ['app/compare/alternatives/page.tsx', 'app/research/imdb-vs-rotten-tomatoes-gap/page.tsx']) {
      const src = read(file)
      expect(src).toMatch(/role="region"/)
      expect(src).toMatch(/tabIndex=\{0\}/)
    }
  })
})

describe('tap targets (WCAG 2.5.8, 24px)', () => {
  it('links in running text get vertical padding that does not change the line height', () => {
    const css = read('app/globals.css')
    expect(css).toMatch(/p a,\s*li a,\s*dd a \{\s*padding-block:\s*5px;\s*\}/)
  })
  it('the breadcrumb Home link keeps its own padding (already above 24px)', () => {
    expect(read('components/site-chrome.module.css')).toMatch(/\.crumbs a \{[^}]*padding:\s*10px 0/)
  })
})

describe('AR page narrow layout', () => {
  const css = read('app/camera-vision/ar/ar.module.css')
  it('stacks the "Align the TV screen" label above the guide on phones and clears the idle icon', () => {
    const narrow = css.slice(css.indexOf('@media (max-width: 520px)'))
    expect(narrow).toMatch(/\.guideLabel \{[^}]*bottom:\s*100%/)
    expect(narrow).toMatch(/\.guideLabel \{[^}]*top:\s*auto/)
    expect(narrow).toMatch(/\.idleInner \{[^}]*margin-top:\s*\d+px/)
  })
})

describe('debug tools are hidden from visitors', () => {
  const ar = read('app/camera-vision/ar/page.tsx')
  const cv = read('app/camera-vision/page.tsx')
  it('the AR page shows Show debug and Save debug frame only behind ?debug=1', () => {
    expect(ar).toMatch(/get\('debug'\) === '1'/)
    expect(ar).toMatch(/\{debugAllowed && \(\s*<button onClick=\{\(\) => setDebug/)
    expect(ar).toMatch(/\{debugAllowed && \(\s*<button onClick=\{requestCapture\}/)
  })
  it('the camera demo shows its status counters (Debug Information, OCR Failures) only behind ?debug=1', () => {
    expect(cv).toMatch(/get\('debug'\) === '1'/)
    expect(cv).toMatch(/\{debugAllowed && <div className=\{`ds-card \$\{s\.debug\}`\}>/)
  })
})

describe('camera pages carry real, server-rendered explanatory copy', () => {
  const { createElement } = require('react') as typeof import('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: unknown) => string }
  const heads = (html: string) => [...html.matchAll(/<h([1-6])\b[^>]*>(.*?)<\/h\1>/g)].map((m) => [Number(m[1]), m[2].replace(/<[^>]+>/g, '')] as const)

  it('/camera-vision: one h1, h2 sections for what/how/privacy/requirements, no debug UI in the HTML', () => {
    const html = renderToStaticMarkup(createElement(require('../app/camera-vision/page').default))
    const hs = heads(html)
    expect(hs.filter(([l]) => l === 1)).toHaveLength(1)
    const h2 = hs.filter(([l]) => l === 2).map(([, t]) => t)
    expect(h2).toEqual(expect.arrayContaining(['What Camera Vision does', 'How to use it', 'Privacy', 'Requirements']))
    expect(html).not.toMatch(/Debug Information|OCR Failures|Last Process/)
    expect(html).toMatch(/not uploaded or stored on our servers/)
    expect(html).toMatch(/jsDelivr/)
  })

  it('/camera-vision/ar page: one h1, the explainer h2 sections, no debug controls', () => {
    const html = renderToStaticMarkup(createElement(require('../app/camera-vision/ar/page').default))
    const hs = heads(html)
    expect(hs.filter(([l]) => l === 1)).toHaveLength(1)
    expect(hs.filter(([l]) => l === 2).map(([, t]) => t)).toEqual(
      expect.arrayContaining(['What AR Ratings does', 'How to use it', 'Privacy', 'Requirements and limits']),
    )
    expect(html).not.toMatch(/Show Debug|Save debug frame/)
    expect(html).toMatch(/experimental/i)
  })

  it('/camera-vision/ar locked states (sign in, paywall, payment failed, could not check) each render one h1, the explainer, and no AR tool', () => {
    const { default: ArPaywall } = require('../components/billing/ArPaywall') as { default: (p: { gate: unknown }) => import('react').ReactElement }
    const user = { id: 'g1', email: 'a@b.co', name: 'A', avatar: null, trial_end_date: '2026-10-01T00:00:00Z', subscription_status: 'expired', subscription_plan: null, subscription_end_date: null, has_billing_portal: false, access: 'paywall' }
    const gates = [{ kind: 'signin' }, { kind: 'paywall', user }, { kind: 'update-payment', user: { ...user, has_billing_portal: true } }, { kind: 'locked' }]
    for (const gate of gates) {
      const html = renderToStaticMarkup(createElement(ArPaywall, { gate }))
      const hs = heads(html)
      expect([gate.kind, hs.filter(([l]) => l === 1).length]).toEqual([gate.kind, 1])
      expect(hs.filter(([l]) => l === 2).map(([, t]) => t)).toEqual(expect.arrayContaining(['What AR Ratings does', 'Privacy']))
      expect(html).not.toMatch(/<video|<button[^>]*>Start Camera/)
    }
    expect(renderToStaticMarkup(createElement(ArPaywall, { gate: { kind: 'signin' } }))).toMatch(/Sign in with Google/)
    expect(renderToStaticMarkup(createElement(ArPaywall, { gate: { kind: 'locked' } }))).toMatch(/could not check your account/)
  })
})

describe('AR layout enforces the paywall on the server', () => {
  const layout = read('app/camera-vision/ar/layout.tsx')
  it('is a server component that reads the session cookie and renders children only when the gate is open', () => {
    expect(layout).not.toMatch(/'use client'/)
    expect(layout).toMatch(/cookies\(\)\.get\(SESSION_COOKIE\)/)
    expect(layout).toMatch(/resolveArGate\(/)
    expect(layout).toMatch(/gate\.kind === 'open' \? <>\{children\}<\/> : <ArPaywall gate=\{gate\} \/>/)
    expect(layout).toMatch(/dynamic = 'force-dynamic'/)
  })
  it('no client gate that decides from /api/user/me is left (it used to fail open)', () => {
    expect(exists('components/billing/ArGate.tsx')).toBe(false)
  })
})

describe('honest copy', () => {
  const files = (dir: string): string[] =>
    fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
      const rel = path.join(dir, e.name)
      return e.isDirectory() ? files(rel) : /\.(tsx?|md)$/.test(e.name) ? [rel] : []
    })
  const all = [...files('app'), ...files('components'), ...files('lib'), 'README.md'].filter((f) => !f.startsWith('lib/blog') && !f.startsWith('app/blog'))

  it('never says "no tracking" (the website runs Google Analytics after Accept)', () => {
    const hits = all.filter((f) => /no tracking|does no tracking/i.test(read(f)))
    expect(hits).toEqual([])
  })
  it('never says AR recognition happens "on your device" alone: the text reader code comes from a CDN', () => {
    expect(all.filter((f) => /recogni[sz]ed on your device/i.test(read(f)))).toEqual([])
    const explainer = read('components/ar/ArExplainer.tsx')
    expect(explainer).toMatch(/not uploaded or stored on our servers/)
    expect(explainer).toMatch(/downloaded from the jsDelivr CDN/)
  })
  it('the cookie banner and the feature copy say analytics run only after Accept', () => {
    expect(read('components/ConsentBanner.tsx')).toMatch(/counts visits only if you accept/)
    expect(read('lib/content.ts')).toMatch(/only if you accept analytics in the cookie banner/)
  })
})
