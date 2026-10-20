import fs from 'fs'
import path from 'path'

const ROOT = path.join(__dirname, '..', '..')
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8')
const SCAN = ['app', 'components', 'lib', 'README.md']
const EXT = new Set(['.ts', '.tsx', '.md'])
const walk = (p: string): string[] => {
  const full = path.join(ROOT, p)
  if (fs.statSync(full).isFile()) return [p]
  return fs.readdirSync(full).flatMap((n) => walk(path.join(p, n)))
}
const files = SCAN.flatMap(walk).filter((f) => EXT.has(path.extname(f)))
const hits = (re: RegExp) => files.filter((f) => re.test(read(f)))

describe('copy stays accurate with a paid tier', () => {
  it('no longer claims there is no paid tier or subscription', () => {
    expect(hits(/no paid tier/i)).toEqual([])
    expect(hits(/no subscription/i)).toEqual([])
  })
  it('the "Is Rating Watch free?" answer separates the free extension from Pro AR mode', () => {
    const src = read('lib/content.ts')
    const i = src.indexOf('Is Rating Watch free?')
    expect(i).toBeGreaterThan(-1)
    const answer = src.slice(i, i + 700)
    expect(answer).toMatch(/extension is free/i)
    expect(answer).toMatch(/Pro/)
    expect(answer).toMatch(/\$2\.99/)
    expect(answer).toMatch(/\$29/)
  })
  it('llms.txt copy mentions Pro and the pricing page', () => {
    const src = read('lib/llms.ts')
    expect(src).toMatch(/Pro/)
    expect(src).toMatch(/pricing/i)
  })
  it('keeps the "no account" claim only where it is about the extension', () => {
    for (const f of ['lib/llms.ts', 'lib/pages.ts', 'components/home/Hero.tsx']) {
      const lines = read(f).split('\n').filter((l) => /no account/i.test(l))
      for (const l of lines) expect(l).toMatch(/extension/i)
    }
  })
  it('README says the extension (not the whole product) has no backend', () => {
    const src = read('README.md')
    expect(src).not.toMatch(/and no backend server/i)
    expect(src).toMatch(/extension/i)
  })
  it('privacy page scopes the "does not collect" claims to the extension', () => {
    const src = read('app/privacy/page.tsx')
    expect(src).not.toMatch(/Data we do NOT collect/)
    expect(src).toMatch(/Data the extension does NOT collect/)
    expect(src).not.toMatch(/We do not read, store, or transmit/)
  })
  it('privacy page states what AR accounts store, the sign-in cookies, the providers and retention', () => {
    const src = read('app/privacy/page.tsx')
    const i = src.indexOf('Accounts and payments (AR mode)')
    expect(i).toBeGreaterThan(-1)
    const accounts = src.slice(i, src.indexOf('</section>', i))
    expect(accounts).toMatch(/Paddle customer and subscription ids/)
    expect(accounts).toMatch(/billing period/)
    expect(accounts).toMatch(/rw_session/)
    expect(accounts).toMatch(/rw_oauth_state/)
    expect(accounts).toMatch(/rw_next/)
    expect(accounts).toMatch(/5 minutes/)
    expect(accounts).toMatch(/Google/)
    expect(accounts).toMatch(/Paddle/)
    expect(accounts).toMatch(/merchant of record/)
    expect(accounts).toMatch(/We keep account data until you ask us to delete your account\./)
  })
  it('privacy page uses the support address everywhere and no personal gmail address', () => {
    const src = read('app/privacy/page.tsx')
    expect(src).not.toMatch(/gmail/i)
    expect(src).not.toMatch(/mailto:(?!\$\{SUPPORT_EMAIL\})/)
    const contact = src.slice(src.indexOf('>Contact<'))
    expect(contact).toMatch(/SUPPORT_EMAIL/)
    expect(src).toMatch(/Last updated: October 20, 2026/)
  })
})
