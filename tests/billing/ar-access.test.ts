import { resolveArGate } from '../../lib/billing/ar-access'
import { openUsersDb } from '../../lib/billing/db'
import type { Deps } from '../../lib/billing/deps'
import { signSession } from '../../lib/billing/session'
import type { UserRecord } from '../../lib/billing/types'

const NOW = Date.parse('2026-10-20T12:00:00Z')
const iso = (ms: number) => new Date(ms).toISOString()
const user = (over: Partial<UserRecord> = {}): UserRecord => ({
  id: 'g1', email: 'a@b.co', name: 'A', avatar: null, trial_end_date: iso(NOW + 86_400_000),
  subscription_status: 'trial', subscription_plan: null, subscription_end_date: null,
  paddle_subscription_id: null, paddle_customer_id: null, created_at: iso(NOW - 1000), ...over,
})
const deps = (users: UserRecord[] = [user()], over: Partial<Deps> = {}): Deps => {
  const db = openUsersDb(':memory:', () => NOW)
  users.forEach((u) => db.save(u))
  return { db, paddle: null, google: null, appUrl: 'https://rating.watch', priceIds: [], now: () => NOW, ...over }
}
const on = () => true
const off = () => false

beforeEach(() => { process.env.JWT_SECRET = 'k'.repeat(40) })
afterAll(() => { delete process.env.JWT_SECRET })
let errSpy: jest.SpyInstance
beforeEach(() => { errSpy = jest.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { errSpy.mockRestore() })

describe('resolveArGate (server-side AR paywall)', () => {
  it('billing off: AR is open for everyone and never touches the database', () => {
    const d = { ...deps(), get db(): never { throw new Error('db must not be opened') } } as unknown as Deps
    expect(resolveArGate(undefined, d, off)).toEqual({ kind: 'open' })
    expect(resolveArGate('garbage', d, off)).toEqual({ kind: 'open' })
  })

  it('billing on, no or invalid session: sign in', () => {
    expect(resolveArGate(undefined, deps(), on)).toEqual({ kind: 'signin' })
    expect(resolveArGate('not-a-jwt', deps(), on)).toEqual({ kind: 'signin' })
    expect(resolveArGate(signSession('ghost'), deps(), on)).toEqual({ kind: 'signin' }) // valid token, no such user
  })

  it('a token signed with another secret is rejected', () => {
    const forged = signSession('g1')
    process.env.JWT_SECRET = 'z'.repeat(40)
    expect(resolveArGate(forged, deps(), on)).toEqual({ kind: 'signin' })
  })

  it('entitled users get the page: trial and active (and paused inside the paid period)', () => {
    expect(resolveArGate(signSession('g1'), deps(), on)).toEqual({ kind: 'open' })
    expect(resolveArGate(signSession('g1'), deps([user({ subscription_status: 'active' })]), on)).toEqual({ kind: 'open' })
    expect(resolveArGate(signSession('g1'), deps([user({ subscription_status: 'paused', subscription_end_date: iso(NOW + 86_400_000) })]), on)).toEqual({ kind: 'open' })
  })

  it('not entitled: ended trial, cancelled, paused past its period get the paywall', () => {
    for (const u of [
      user({ trial_end_date: iso(NOW - 1) }),
      user({ subscription_status: 'cancelled', paddle_customer_id: 'ctm_1' }),
      user({ subscription_status: 'paused', subscription_end_date: iso(NOW - 30 * 86_400_000) }),
      user({ subscription_status: 'paused', subscription_end_date: null }),
    ]) {
      const gate = resolveArGate(signSession('g1'), deps([u]), on)
      expect(gate.kind).toBe('paywall')
    }
  })

  it('a failed renewal (expired with a billing account) points to the portal instead of a second checkout', () => {
    const gate = resolveArGate(signSession('g1'), deps([user({ subscription_status: 'expired', paddle_customer_id: 'ctm_1' })]), on)
    expect(gate.kind).toBe('update-payment')
  })

  it('fails closed: a database error is locked, never open', () => {
    const broken = { ...deps(), get db(): never { throw new Error('SQLITE_BUSY') } } as unknown as Deps
    expect(resolveArGate(signSession('g1'), broken, on)).toEqual({ kind: 'locked' })
    const throwingGet = deps([], { db: { ...openUsersDb(':memory:'), get: () => { throw new Error('disk I/O error') } } })
    expect(resolveArGate(signSession('g1'), throwingGet, on)).toEqual({ kind: 'locked' })
  })

  it('fails closed when the billing switch itself cannot be evaluated', () => {
    expect(resolveArGate(signSession('g1'), deps(), () => { throw new Error('config') })).toEqual({ kind: 'locked' })
  })

  it('the paywall carries only the public user (no Paddle ids)', () => {
    const gate = resolveArGate(signSession('g1'), deps([user({ subscription_status: 'cancelled', paddle_customer_id: 'ctm_1', paddle_subscription_id: 'sub_1' })]), on)
    expect(JSON.stringify(gate)).not.toMatch(/ctm_1|sub_1/)
  })
})
