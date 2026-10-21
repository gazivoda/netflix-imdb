/** @jest-environment node */
import { createElement } from 'react'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (el: unknown) => string }
import { checkPage } from '../../lib/html-seo'
import { jsonLdString, siteGraph } from '../../lib/seo'

// Renders each real page, adds the root layout's JSON-LD block, and runs the date and @id-reference rules of the SEO
// validator on the result: a crawler's view of the structured data, without `next build`.
const PAGES: [string, () => { default: () => JSX.Element }][] = [
  ['/', () => require('../../app/page')],
  ['/install', () => require('../../app/install/page')],
  ['/how-to/show-imdb-ratings-on-netflix', () => require('../../app/how-to/show-imdb-ratings-on-netflix/page')],
  ['/how-to/show-rotten-tomatoes-on-netflix', () => require('../../app/how-to/show-rotten-tomatoes-on-netflix/page')],
  ['/how-to/find-what-to-watch-on-netflix', () => require('../../app/how-to/find-what-to-watch-on-netflix/page')],
  ['/research/imdb-vs-rotten-tomatoes-gap', () => require('../../app/research/imdb-vs-rotten-tomatoes-gap/page')],
  ['/compare/imdb-vs-rotten-tomatoes', () => require('../../app/compare/imdb-vs-rotten-tomatoes/page')],
  ['/compare/alternatives', () => require('../../app/compare/alternatives/page')],
  ['/about', () => require('../../app/about/page')],
  ['/privacy', () => require('../../app/privacy/page')],
  ['/terms', () => require('../../app/terms/page')],
  ['/refund-policy', () => require('../../app/refund-policy/page')],
]
const LEGAL = new Set(['/privacy', '/terms', '/refund-policy'])

const siteBlock = `<script type="application/ld+json">${jsonLdString(siteGraph())}</script>`

describe.each(PAGES)('%s JSON-LD as a crawler sees it', (path, load) => {
  const body = renderToStaticMarkup(createElement(load().default))
  const html = `<!doctype html><html lang="en"><head><title>T</title>${siteBlock}</head><body>${body}</body></html>`
  const findings = checkPage({ path, html })

  it('has only full date-times with a time zone (jsonld-date)', () => {
    expect(findings.filter((f) => f.rule === 'jsonld-date')).toEqual([])
  })

  it('resolves every @id reference within the page + root graph (jsonld-ref)', () => {
    expect(findings.filter((f) => f.rule === 'jsonld-ref')).toEqual([])
  })

  it(LEGAL.has(path) ? 'does not emit a SoftwareApplication (legal page)' : 'emits exactly one SoftwareApplication', () => {
    expect((html.match(/"@type":"SoftwareApplication"/g) ?? []).length).toBe(LEGAL.has(path) ? 0 : 1)
  })
})

describe('Dataset nodes carry a licence and a publisher', () => {
  const body = renderToStaticMarkup(createElement(require('../../app/research/imdb-vs-rotten-tomatoes-gap/page').default))
  const blocks = [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
  const dataset = blocks.flatMap((b) => b['@graph'] ?? [b]).find((n: any) => n['@type'] === 'Dataset')

  it('research Dataset has the data file licence statement as a CreativeWork and an inline publisher with a name', () => {
    expect(dataset.license).toEqual({ '@type': 'CreativeWork', name: expect.stringMatching(/IMDb and Rotten Tomatoes/) })
    expect(dataset.publisher).toMatchObject({ '@type': 'Organization', name: 'Rating Watch', url: 'https://rating.watch' })
    expect(dataset.creator).toMatchObject({ '@type': 'Person', name: 'Igor Gazivoda' })
  })

  it('takes the licence text from the data file, not a copy', () => {
    expect(dataset.license.name).toBe(require('../../data/imdb-rt-gap.json').license)
  })

  it('the blog hub Dataset builds its licence from films.json and has a publisher', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../app/blog/page.tsx'), 'utf8') as string
    expect(src).toMatch(/license: licenseNode\(data\.filmsFile\.license\)/)
    expect(src).toMatch(/publisher: publisherNode\(\)/)
  })
})
