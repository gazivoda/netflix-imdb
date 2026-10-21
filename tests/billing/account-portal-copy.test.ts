import { readFileSync } from 'fs'
import { join } from 'path'
import { PRO_NOT_ON_SALE } from '../../components/billing/pricing-state'
import { SUPPORT_EMAIL } from '../../lib/content'

const src = readFileSync(join(__dirname, '../../app/account/AccountClient.tsx'), 'utf8')

describe('AccountClient copy', () => {
  it('shows a clear message with the support address when the portal answers 409', () => {
    expect(src).toMatch(/res\.status === 409\)\s*\{\s*setError\(PORTAL_OTHER_ACCOUNT\)/)
    expect(src).toContain('This subscription belongs to a different account. Contact support at ${SUPPORT_EMAIL}.')
    expect(SUPPORT_EMAIL).toMatch(/@/)
  })

  it('does not send a 409 user to the Paddle self-serve page', () => {
    expect(src.indexOf('status === 409')).toBeLessThan(src.indexOf('window.location.assign(res.ok'))
  })

  it('uses the same "not on sale" notice as /pricing while billing is off, not a second phrasing', () => {
    expect(src).toContain('{PRO_NOT_ON_SALE}')
    expect(src).not.toContain('BILLING_SOON')
    expect(PRO_NOT_ON_SALE).toMatch(/not on sale/i)
  })
})
