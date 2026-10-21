import { billingConfigured } from '../../lib/billing/config'
import { openUsersDb } from '../../lib/billing/db'
import type { Deps } from '../../lib/billing/deps'
import type { GoogleAuth } from '../../lib/billing/google'
import type { PaddleApi } from '../../lib/billing/paddle'

const google: GoogleAuth = { authUrl: () => 'https://accounts.google.com/x', exchange: async () => ({ sub: 'g', email: null, name: null, picture: null }) }
const paddle: PaddleApi = { getTransaction: async () => ({}), getSubscription: async () => ({}), getCustomer: async () => ({}), createPortalSession: async () => 'https://p/x' }
const TOKEN = 'live_clienttoken'
const CLIENT = { token: TOKEN, monthly: 'pri_m', yearly: 'pri_y' }
const PERSIST = 'true'
const full = (): Deps => ({ db: openUsersDb(':memory:'), google, paddle, webhookSecret: 'pdl_ntfset_x', appUrl: 'https://rating.watch', priceIds: ['pri_m', 'pri_y'], now: () => 0 })

beforeEach(() => { process.env.JWT_SECRET = 'k'.repeat(40) })
afterAll(() => { delete process.env.JWT_SECRET })

describe('billingConfigured (Ruling V: the paywall is off until every piece exists)', () => {
  it('is true only when all seven requirements are present', () => {
    expect(billingConfigured(full(), CLIENT, PERSIST)).toBe(true)
  })
  it.each([
    ['google', { google: null }],
    ['paddle', { paddle: null }],
    ['webhook secret undefined', { webhookSecret: undefined }],
    ['webhook secret empty', { webhookSecret: '' }],
    ['price ids', { priceIds: [] }],
  ] as [string, Partial<Deps>][])('is false when %s is missing', (_n, over) => {
    expect(billingConfigured({ ...full(), ...over }, CLIENT, PERSIST)).toBe(false)
  })
  it('is false when the checkout client token is missing or blank (Ruling X)', () => {
    for (const token of [undefined, '', '   ']) expect(billingConfigured(full(), { ...CLIENT, token }, PERSIST)).toBe(false)
  })
  it('is false when a NEXT_PUBLIC price id was missing at build, even though the runtime allow-list is set (OPS-7)', () => {
    // priceIds (runtime PADDLE_PRICE_IDS) is non-empty in full(), yet checkout needs both ids inlined at build.
    for (const monthly of [undefined, '', '  ']) expect(billingConfigured(full(), { ...CLIENT, monthly }, PERSIST)).toBe(false)
    for (const yearly of [undefined, '', '  ']) expect(billingConfigured(full(), { ...CLIENT, yearly }, PERSIST)).toBe(false)
    expect(billingConfigured(full(), {}, PERSIST)).toBe(false)
  })
  it('is false unless the owner asserted persistent storage with BILLING_DATA_PERSISTENT=true (SEC-4)', () => {
    for (const v of [undefined, '', 'false', '1', 'yes', 'tru']) expect(billingConfigured(full(), CLIENT, v)).toBe(false)
    for (const v of ['true', ' TRUE ', 'True']) expect(billingConfigured(full(), CLIENT, v)).toBe(true)
  })
  it('reads the NEXT_PUBLIC_* build values and BILLING_DATA_PERSISTENT from the environment when none are passed', () => {
    const keys = ['NEXT_PUBLIC_PADDLE_CLIENT_TOKEN', 'NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY', 'NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY', 'BILLING_DATA_PERSISTENT']
    const old = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
    try {
      keys.forEach((k) => delete process.env[k])
      expect(billingConfigured(full())).toBe(false)
      process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = TOKEN
      process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY = 'pri_m'
      process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY = 'pri_y'
      expect(billingConfigured(full())).toBe(false) // still no persistence assertion
      process.env.BILLING_DATA_PERSISTENT = 'true'
      expect(billingConfigured(full())).toBe(true)
      delete process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY
      expect(billingConfigured(full())).toBe(false)
    } finally {
      for (const k of keys) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k] }
    }
  })
  it('is false when JWT_SECRET is missing or shorter than 32 characters', () => {
    delete process.env.JWT_SECRET
    expect(billingConfigured(full(), CLIENT, PERSIST)).toBe(false)
    process.env.JWT_SECRET = 'k'.repeat(31)
    expect(billingConfigured(full(), CLIENT, PERSIST)).toBe(false)
    process.env.JWT_SECRET = 'k'.repeat(32)
    expect(billingConfigured(full(), CLIENT, PERSIST)).toBe(true)
  })
})
