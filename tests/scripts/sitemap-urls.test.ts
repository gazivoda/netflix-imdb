import { parseSitemap, sitemapUrls } from '../../scripts/lib/sitemap-urls.mjs'

// Shape produced by Next's app/sitemap.ts (single line after the XML declaration).
const NEXT_XML =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
  '<url><loc>https://rating.watch/</loc><lastmod>2026-10-15T00:00:00.000Z</lastmod><changefreq>weekly</changefreq><priority>1</priority></url>' +
  '<url><loc>https://rating.watch/install</loc><lastmod>2026-10-15T00:00:00.000Z</lastmod></url>' +
  '<url><loc>https://rating.watch/privacy</loc></url>' +
  '</urlset>'

describe('parseSitemap', () => {
  it('extracts url + lastmod in document order', () => {
    expect(parseSitemap(NEXT_XML)).toEqual([
      { url: 'https://rating.watch/', lastmod: '2026-10-15T00:00:00.000Z' },
      { url: 'https://rating.watch/install', lastmod: '2026-10-15T00:00:00.000Z' },
      { url: 'https://rating.watch/privacy', lastmod: null },
    ])
  })

  it('handles pretty-printed XML, entities, CDATA and duplicates', () => {
    const xml = `<urlset>
      <url>
        <loc> https://x.test/a?b=1&amp;c=2 </loc>
      </url>
      <url><loc><![CDATA[https://x.test/c]]></loc></url>
      <url><loc>https://x.test/c</loc></url>
    </urlset>`
    expect(parseSitemap(xml).map((e) => e.url)).toEqual(['https://x.test/a?b=1&c=2', 'https://x.test/c'])
  })

  it('rejects empty input, empty urlsets, error pages and sitemap indexes', () => {
    expect(() => parseSitemap('')).toThrow(/empty/)
    expect(() => parseSitemap('<urlset></urlset>')).toThrow(/no <url>/)
    expect(() => parseSitemap('<html>502 Bad Gateway</html>')).toThrow(/no <url>/)
    expect(() =>
      parseSitemap('<sitemapindex><sitemap><loc>https://x.test/s.xml</loc></sitemap></sitemapindex>'),
    ).toThrow(/index/)
  })
})

describe('sitemapUrls', () => {
  it('returns all URLs without a host filter', () => {
    expect(sitemapUrls(NEXT_XML).urls).toHaveLength(3)
  })

  it('splits off URLs on other hosts', () => {
    const xml = NEXT_XML.replace(
      '</urlset>',
      '<url><loc>https://www.rating.watch/x</loc></url></urlset>',
    )
    const { urls, skipped } = sitemapUrls(xml, { host: 'rating.watch' })
    expect(urls).toHaveLength(3)
    expect(skipped).toEqual(['https://www.rating.watch/x'])
  })
})
