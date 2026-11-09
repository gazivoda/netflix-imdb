import { createElement } from 'react'
import { FAQS } from '../lib/content'
import { PAGES } from '../lib/pages'
const { renderToStaticMarkup } = require('react-dom/server') as { renderToStaticMarkup: (element: unknown) => string }

const TV = '/how-to/netflix-ratings-on-tv-and-phone'
const EXPLAINED = '/how-to/netflix-ratings-explained'

describe('inbound links to the TV and phone guide, and to the ratings guide, from the home page', () => {
  it('every home FAQ link phrase appears verbatim in the answer (so page text and FAQPage JSON-LD stay identical)', () => {
    const linked = FAQS.filter((f) => f.link)
    expect(linked.map((f) => f.link!.href).sort()).toEqual([EXPLAINED, TV].sort())
    for (const f of linked) expect(f.a).toContain(f.link!.text)
  })

  it('the home FAQ renders those links, and the visible text equals the answer text', () => {
    const html = renderToStaticMarkup(createElement(require('../components/home/Faq').default))
    expect(html).toContain(`href="${TV}"`)
    expect(html).toContain(`href="${EXPLAINED}"`)
    const text = html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    for (const f of FAQS) expect(text).toContain(f.a)
  })

  it('the TV/phone guide is registered, and the ratings guide and AR explainer link to it', () => {
    expect(PAGES.some((p) => p.path === TV)).toBe(true)
    expect(renderToStaticMarkup(createElement(require('../app/how-to/netflix-ratings-explained/page').default))).toContain(`href="${TV}"`)
    expect(renderToStaticMarkup(createElement(require('../components/ar/ArExplainer').default))).toContain(`href="${TV}"`)
  })
})
