import { authErrorMessage, describeSubscription, gateDecision, paddleConfig, PRICES } from '../../lib/billing/client'
import type { AccessStatus, PublicUser } from '../../lib/billing/types'

const user = (over: Partial<PublicUser> = {}): PublicUser => ({
  id: 'g1', email: 'a@b.co', name: 'A', avatar: null, trial_end_date: '2026-10-23T00:00:00Z',
  subscription_status: 'trial', subscription_plan: null, subscription_end_date: null, has_billing_portal: false, access: 'trial_active', ...over,
})

describe('paddleConfig', () => {
  const full = { NEXT_PUBLIC_PADDLE_ENV: 'production', NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: 'live_x', NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY: 'pri_m', NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY: 'pri_y' }
  it('returns the config when everything is present', () => {
    expect(paddleConfig(full)).toEqual({ env: 'production', token: 'live_x', monthly: 'pri_m', yearly: 'pri_y' })
  })
  it('is null if any piece is missing or blank, so the UI shows a neutral message', () => {
    // NEXT_PUBLIC_PADDLE_ENV is excluded: it defaults to sandbox when unset (next test).
    for (const k of Object.keys(full).filter((key) => key !== 'NEXT_PUBLIC_PADDLE_ENV')) {
      expect(paddleConfig({ ...full, [k]: '' })).toBeNull()
    }
    expect(paddleConfig({})).toBeNull()
  })
  it('treats any env other than production as sandbox', () => {
    expect(paddleConfig({ ...full, NEXT_PUBLIC_PADDLE_ENV: 'sandbox' })?.env).toBe('sandbox')
    expect(paddleConfig({ ...full, NEXT_PUBLIC_PADDLE_ENV: undefined })?.env).toBe('sandbox')
  })
  it('rejects a token with an ellipsis (a truncated copy-paste)', () => {
    expect(paddleConfig({ ...full, NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: 'live_83…e436d' })).toBeNull()
  })
})

describe('describeSubscription', () => {
  it('trial: days are not computed, only the end date', () => {
    expect(describeSubscription(user())).toMatchObject({ headline: 'Free trial', canManage: false })
    expect(describeSubscription(user()).detail).toMatch(/Trial ends Oct 23, 2026/)
  })
  it('active: plan name and period end date, can manage', () => {
    const d = describeSubscription(user({ subscription_status: 'active', subscription_plan: 'yearly', subscription_end_date: '2027-10-20T00:00:00Z', has_billing_portal: true }))
    expect(d).toMatchObject({ headline: 'Yearly', canManage: true })
    expect(d.detail).toMatch(/Current period ends Oct 20, 2027/)
    expect(d.detail).not.toMatch(/Renews/)
  })
  it('paused matches the gate: AR mode stays available while paused', () => {
    const d = describeSubscription(user({ subscription_status: 'paused', subscription_end_date: '2026-11-20T00:00:00Z', has_billing_portal: true, access: 'subscribed' }))
    expect(d).toEqual({ headline: 'Paused', detail: 'AR mode stays available while the subscription is paused.', canManage: true, canSubscribe: false })
  })
  it('cancelled means access has already ended: no access-until promise, invoices stay reachable', () => {
    const d = describeSubscription(user({ subscription_status: 'cancelled', subscription_end_date: '2026-11-20T00:00:00Z', has_billing_portal: true, access: 'paywall' }))
    expect(d).toMatchObject({ headline: 'Subscription ended', canManage: true })
    expect(d.detail).not.toMatch(/Access until/)
    expect(d.detail).toMatch(/Subscribe again/)
  })
  it('expired: no manage button without a billing account, headline asks to subscribe', () => {
    expect(describeSubscription(user({ subscription_status: 'expired', access: 'paywall' }))).toMatchObject({ canManage: false, canSubscribe: true })
  })
  it('expired with a billing portal is a failed payment: fix the card, do not buy a second subscription (Ruling Q)', () => {
    expect(describeSubscription(user({ subscription_status: 'expired', has_billing_portal: true, access: 'paywall' }))).toEqual({
      headline: 'Payment failed', detail: 'Update your payment method to turn AR mode back on.', canManage: true, canSubscribe: false,
    })
  })
  it('canSubscribe is true exactly for the states that offer checkout', () => {
    const can = (over: Partial<PublicUser>) => describeSubscription(user(over)).canSubscribe
    expect(can({})).toBe(true) // trial
    expect(can({ access: 'paywall' })).toBe(true) // trial ended
    expect(can({ subscription_status: 'cancelled', has_billing_portal: true, access: 'paywall' })).toBe(true)
    expect(can({ subscription_status: 'expired', access: 'paywall' })).toBe(true)
    expect(can({ subscription_status: 'active', has_billing_portal: true, access: 'subscribed' })).toBe(false)
    expect(can({ subscription_status: 'paused', has_billing_portal: true, access: 'subscribed' })).toBe(false)
    expect(can({ subscription_status: 'expired', has_billing_portal: true, access: 'paywall' })).toBe(false)
  })
  it('does not crash on a missing end date', () => {
    expect(() => describeSubscription(user({ subscription_status: 'active', subscription_plan: 'monthly', subscription_end_date: null, has_billing_portal: true }))).not.toThrow()
    expect(describeSubscription(user({ subscription_status: 'active', subscription_plan: 'monthly', subscription_end_date: null, has_billing_portal: true })).detail).toBe('Active')
  })
})

describe('authErrorMessage', () => {
  it('maps known codes to friendly text and hides unknown ones', () => {
    expect(authErrorMessage('access_denied')).toMatch(/cancel/i)
    expect(authErrorMessage('state_mismatch')).toMatch(/try again/i)
    expect(authErrorMessage('not_configured')).toMatch(/unavailable/i)
    expect(authErrorMessage('<script>')).toMatch(/try again/i)
    expect(authErrorMessage(null)).toBeNull()
  })
})

it('prices match the Paddle catalogue', () => {
  expect(PRICES.monthly.amount).toBe('2.99')
  expect(PRICES.yearly.amount).toBe('29')
})

describe('gateDecision (Ruling V: billing off means the AR page is open)', () => {
  const base = { loading: false, billingEnabled: true, user: user(), access: 'trial_active' as AccessStatus }
  it('loading always wins, even with billing off', () => {
    expect(gateDecision({ ...base, loading: true })).toBe('loading')
    expect(gateDecision({ ...base, loading: true, billingEnabled: false, user: null, access: 'no_auth' })).toBe('loading')
  })
  it('billing off opens the page for everyone, signed in or not, whatever the access', () => {
    expect(gateDecision({ ...base, billingEnabled: false, user: null, access: 'no_auth' })).toBe('open')
    expect(gateDecision({ ...base, billingEnabled: false, access: 'paywall', user: user({ subscription_status: 'expired', has_billing_portal: true, access: 'paywall' }) })).toBe('open')
    expect(gateDecision({ ...base, billingEnabled: false })).toBe('open')
  })
  it('billing on and signed out is the sign-in card', () => {
    expect(gateDecision({ ...base, user: null, access: 'no_auth' })).toBe('signin')
  })
  it('trial_active and subscribed render the camera page', () => {
    expect(gateDecision({ ...base, access: 'trial_active' })).toBe('camera')
    expect(gateDecision({ ...base, access: 'subscribed', user: user({ subscription_status: 'active', access: 'subscribed' }) })).toBe('camera')
  })
  it('expired with a billing portal is the update-payment card (Ruling Q)', () => {
    expect(gateDecision({ ...base, access: 'paywall', user: user({ subscription_status: 'expired', has_billing_portal: true, access: 'paywall' }) })).toBe('update-payment')
  })
  it('every other paywalled user gets the paywall', () => {
    expect(gateDecision({ ...base, access: 'paywall', user: user({ subscription_status: 'expired', has_billing_portal: false, access: 'paywall' }) })).toBe('paywall')
    expect(gateDecision({ ...base, access: 'paywall', user: user({ subscription_status: 'cancelled', has_billing_portal: true, access: 'paywall' }) })).toBe('paywall')
    expect(gateDecision({ ...base, access: 'paywall', user: user({ subscription_status: 'trial', access: 'paywall' }) })).toBe('paywall')
  })
  it('access decides, not the status, for subscribed users with an odd status', () => {
    expect(gateDecision({ ...base, access: 'subscribed', user: user({ subscription_status: 'expired', has_billing_portal: true, access: 'subscribed' }) })).toBe('camera')
  })
})
