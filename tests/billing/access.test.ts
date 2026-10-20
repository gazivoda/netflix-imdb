import { computeAccessStatus, toPublicUser, TRIAL_DAYS } from '../../lib/billing/access'
import type { UserRecord } from '../../lib/billing/types'

const NOW = Date.parse('2026-10-20T12:00:00Z')
const iso = (ms: number) => new Date(ms).toISOString()

function user(over: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'g1', email: 'a@b.co', name: 'A', avatar: null,
    trial_end_date: iso(NOW + 86_400_000), subscription_status: 'trial', subscription_plan: null,
    subscription_end_date: null, paddle_subscription_id: null, paddle_customer_id: null,
    created_at: iso(NOW - 86_400_000), ...over,
  }
}

describe('computeAccessStatus', () => {
  it('is trial_active inside the trial window', () => {
    expect(computeAccessStatus(user(), NOW)).toBe('trial_active')
  })
  it('is paywall when the trial ended, including exactly now', () => {
    expect(computeAccessStatus(user({ trial_end_date: iso(NOW) }), NOW)).toBe('paywall')
    expect(computeAccessStatus(user({ trial_end_date: iso(NOW - 1) }), NOW)).toBe('paywall')
  })
  it('is paywall when trial_end_date is missing or not a date', () => {
    expect(computeAccessStatus(user({ trial_end_date: '' }), NOW)).toBe('paywall')
    expect(computeAccessStatus(user({ trial_end_date: 'nonsense' }), NOW)).toBe('paywall')
  })
  it('active and paused are subscribed whatever the dates say', () => {
    expect(computeAccessStatus(user({ subscription_status: 'active', trial_end_date: iso(NOW - 9e9), subscription_end_date: iso(NOW - 9e9) }), NOW)).toBe('subscribed')
    expect(computeAccessStatus(user({ subscription_status: 'paused' }), NOW)).toBe('subscribed')
  })
  it('cancelled and expired never fall back to the trial', () => {
    expect(computeAccessStatus(user({ subscription_status: 'cancelled' }), NOW)).toBe('paywall')
    expect(computeAccessStatus(user({ subscription_status: 'expired' }), NOW)).toBe('paywall')
  })
})

describe('toPublicUser', () => {
  it('exposes display + billing state but not Paddle ids, and says whether a portal exists', () => {
    const p = toPublicUser(user({ subscription_status: 'active', subscription_plan: 'yearly', paddle_customer_id: 'ctm_1', paddle_subscription_id: 'sub_1' }), NOW)
    expect(p).toMatchObject({ id: 'g1', email: 'a@b.co', access: 'subscribed', subscription_plan: 'yearly', has_billing_portal: true })
    expect(JSON.stringify(p)).not.toMatch(/ctm_1|sub_1/)
  })
  it('has_billing_portal is false without a Paddle customer', () => {
    expect(toPublicUser(user(), NOW).has_billing_portal).toBe(false)
  })
})

it('trial length is 3 days (same as Name Habitat)', () => expect(TRIAL_DAYS).toBe(3))
