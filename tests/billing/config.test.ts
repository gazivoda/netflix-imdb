import { billingConfigured } from '../../lib/billing/config'
import { openUsersDb } from '../../lib/billing/db'
import type { Deps } from '../../lib/billing/deps'
import type { GoogleAuth } from '../../lib/billing/google'
import type { PaddleApi } from '../../lib/billing/paddle'

const google: GoogleAuth = { authUrl: () => 'https://accounts.google.com/x', exchange: async () => ({ sub: 'g', email: null, name: null, picture: null }) }
const paddle: PaddleApi = { getTransaction: async () => ({}), getSubscription: async () => ({}), createPortalSession: async () => 'https://p/x' }
const TOKEN = 'live_clienttoken'
const full = (): Deps => ({ db: openUsersDb(':memory:'), google, paddle, webhookSecret: 'pdl_ntfset_x', appUrl: 'https://rating.watch', priceIds: ['pri_m', 'pri_y'], now: () => 0 })

beforeEach(() => { process.env.JWT_SECRET = 'k'.repeat(40) })
afterAll(() => { delete process.env.JWT_SECRET })

describe('billingConfigured (Ruling V: the paywall is off until every piece exists)', () => {
  it('is true only when all five requirements are present', () => {
    expect(billingConfigured(full(), TOKEN)).toBe(true)
  })
  it.each([
    ['google', { google: null }],
    ['paddle', { paddle: null }],
    ['webhook secret undefined', { webhookSecret: undefined }],
    ['webhook secret empty', { webhookSecret: '' }],
    ['price ids', { priceIds: [] }],
  ] as [string, Partial<Deps>][])('is false when %s is missing', (_n, over) => {
    expect(billingConfigured({ ...full(), ...over }, TOKEN)).toBe(false)
  })
  it('is false when the checkout client token is missing or blank (Ruling X)', () => {
    expect(billingConfigured(full(), undefined)).toBe(false)
    expect(billingConfigured(full(), '')).toBe(false)
    expect(billingConfigured(full(), '   ')).toBe(false)
  })
  it('reads NEXT_PUBLIC_PADDLE_CLIENT_TOKEN when no token is passed', () => {
    const old = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
    try {
      delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
      expect(billingConfigured(full())).toBe(false)
      process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = TOKEN
      expect(billingConfigured(full())).toBe(true)
    } finally {
      if (old === undefined) delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
      else process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = old
    }
  })
  it('is false when JWT_SECRET is missing or shorter than 32 characters', () => {
    delete process.env.JWT_SECRET
    expect(billingConfigured(full(), TOKEN)).toBe(false)
    process.env.JWT_SECRET = 'k'.repeat(31)
    expect(billingConfigured(full(), TOKEN)).toBe(false)
    process.env.JWT_SECRET = 'k'.repeat(32)
    expect(billingConfigured(full(), TOKEN)).toBe(true)
  })
})
