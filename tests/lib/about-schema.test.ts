import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(join(__dirname, '../../app/about/page.tsx'), 'utf8')

describe('/about JSON-LD', () => {
  it('takes its dates from the page registry, not hard-coded values', () => {
    expect(src).not.toMatch(/'20\d\d-\d\d-\d\d'/)
    expect(src).toContain('page.updated')
  })

  it('does not reuse the #webpage id that GuideLayout already emits', () => {
    expect(src).not.toContain('#webpage`')
    expect(src).toContain("nodeId(PATH, 'about')")
  })
})

describe('/about ProfilePage dates', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { isoDateTime } = require('../../lib/seo')

  it('are full ISO 8601 date-times with a time zone (Search Console rejects bare dates on ProfilePage)', () => {
    expect(isoDateTime('2026-10-21')).toBe('2026-10-21T00:00:00+00:00')
    expect(Number.isNaN(Date.parse(isoDateTime('2026-10-21')))).toBe(false)
    expect(src).toContain('isoDateTime(page.updated)')
    expect(src).toContain('isoDateTime(page.published ?? PUBLISHED_DATE)')
  })

  it('leaves values that already carry a time untouched', () => {
    expect(isoDateTime('2026-10-21T08:00:00Z')).toBe('2026-10-21T08:00:00Z')
  })
})
