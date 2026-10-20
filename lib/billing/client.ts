import type { AccessStatus, PublicUser } from './types'

export interface PaddleConfig { env: 'production' | 'sandbox'; token: string; monthly: string; yearly: string }

// Pure so it is unit-testable; components pass literal process.env.NEXT_PUBLIC_* reads (Next inlines only literals).
export function paddleConfig(env: Record<string, string | undefined>): PaddleConfig | null {
  const token = env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim()
  const monthly = env.NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY?.trim()
  const yearly = env.NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY?.trim()
  if (!token || !monthly || !yearly || /[^\x21-\x7e]/.test(token)) return null
  return { env: env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox', token, monthly, yearly }
}

// Shown on /pricing and /account while billing is not configured (Ruling V). No sign-in or checkout controls then.
export const BILLING_SOON = 'Subscriptions open soon. AR mode is free to use until then.'

export const PRICES = {
  monthly: { label: '$2.99 / month', amount: '2.99' },
  yearly: { label: '$29 / year', amount: '29' },
} as const

const fmt = (iso: string | null): string =>
  iso && Number.isFinite(Date.parse(iso))
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : ''

export interface SubscriptionSummary {
  headline: string
  detail: string
  canManage: boolean // show "Manage subscription" (Paddle customer portal)
  canSubscribe: boolean // show the checkout buttons
}

export function describeSubscription(u: PublicUser): SubscriptionSummary {
  const end = fmt(u.subscription_end_date)
  const canManage = u.has_billing_portal && ['active', 'paused', 'cancelled', 'expired'].includes(u.subscription_status)
  switch (u.subscription_status) {
    case 'trial':
      return { headline: 'Free trial', detail: `Trial ends ${fmt(u.trial_end_date)}`, canManage: false, canSubscribe: true }
    case 'active':
      // Not "Renews": Paddle can hold a scheduled cancellation while the status is still active, and we do not store that flag.
      return { headline: u.subscription_plan === 'yearly' ? 'Yearly' : 'Monthly', detail: end ? `Current period ends ${end}` : 'Active', canManage, canSubscribe: false }
    case 'paused':
      // Ruling R: the gate keeps AR mode open while paused, so the copy must say so.
      return { headline: 'Paused', detail: 'AR mode stays available while the subscription is paused.', canManage, canSubscribe: false }
    case 'cancelled':
      // Set only by the final subscription.canceled event, so access has already ended.
      return { headline: 'Subscription ended', detail: 'Subscribe again to use AR mode.', canManage, canSubscribe: true }
    case 'expired':
      // Ruling Q: with a billing account, expired means a renewal payment failed and Paddle is still retrying.
      // A second checkout would double-bill, so send the user to the portal to fix the payment method.
      if (u.has_billing_portal) return { headline: 'Payment failed', detail: 'Update your payment method to turn AR mode back on.', canManage, canSubscribe: false }
      return { headline: 'Not subscribed', detail: 'Subscribe to use AR mode', canManage, canSubscribe: true }
    default:
      return { headline: 'Not subscribed', detail: 'Subscribe to use AR mode', canManage, canSubscribe: true }
  }
}

export function authErrorMessage(code: string | null): string | null {
  if (!code) return null
  if (code === 'access_denied') return 'Sign-in was cancelled. You can try again any time.'
  if (code === 'not_configured') return 'Sign-in is unavailable right now. Please try again later.'
  return 'Sign-in did not complete. Please try again.'
}

export type GateDecision = 'loading' | 'open' | 'signin' | 'paywall' | 'update-payment' | 'camera'

// Pure so every branch is testable. 'open' (billing off) and 'camera' (entitled) both render the page;
// they are separate values so tests and debugging can tell why.
export function gateDecision(input: { loading: boolean; billingEnabled: boolean; user: PublicUser | null; access: AccessStatus }): GateDecision {
  const { loading, billingEnabled, user, access } = input
  if (loading) return 'loading'
  if (!billingEnabled) return 'open'
  if (!user) return 'signin'
  if (access === 'trial_active' || access === 'subscribed') return 'camera'
  if (user.subscription_status === 'expired' && user.has_billing_portal) return 'update-payment'
  return 'paywall'
}
