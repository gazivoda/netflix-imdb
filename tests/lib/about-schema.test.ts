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
