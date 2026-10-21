/** @jest-environment node */
import { createElement } from 'react'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: unknown) => string }
import AboutPage from '../../app/about/page'
import { checkPage } from '../../lib/html-seo'
import { AUTHOR_NAME, SITE_URL } from '../../lib/content'

// Renders the real /about page and reads the JSON-LD a crawler would see.
const html = renderToStaticMarkup(createElement(AboutPage))
const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1].replace(/\\u003c/g, '<')))
const nodes: Record<string, any>[] = blocks.flatMap((b) => b['@graph'] ?? [b])

describe('/about rendered JSON-LD', () => {
  const profile = nodes.find((n) => [].concat(n['@type']).includes('ProfilePage' as never))!

  it('keeps AboutPage and ProfilePage types', () => {
    expect(profile['@type']).toEqual(['AboutPage', 'ProfilePage'])
  })

  it('inlines the full Person as mainEntity: name and url are present in the same block', () => {
    expect(profile.mainEntity).toMatchObject({ '@type': 'Person', '@id': `${SITE_URL}/#author`, name: AUTHOR_NAME, url: `${SITE_URL}/about` })
  })

  it('uses full date-times with a time zone', () => {
    expect(profile.datePublished).toMatch(/T00:00:00\+00:00$/)
    expect(profile.dateModified).toMatch(/T00:00:00\+00:00$/)
  })

  it('every date on the page passes the jsonld-date validator rule', () => {
    const page = `<!doctype html><html lang="en"><head><title>About Rating Watch</title>${html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g)!.join('')}</head><body></body></html>`
    const dateFindings = checkPage({ path: '/about', html: page }).filter((f) => f.rule === 'jsonld-date')
    expect(dateFindings).toEqual([])
  })

  it('defines the SoftwareApplication the page and ProfilePage point at (not left to the root layout)', () => {
    expect(nodes.some((n) => n['@type'] === 'SoftwareApplication' && n['@id'] === `${SITE_URL}/#app`)).toBe(true)
  })
})
