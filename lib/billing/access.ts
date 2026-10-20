import type { AccessStatus, PublicUser, UserRecord } from './types'

export const TRIAL_DAYS = 3

// subscription_status is authoritative (written only by the signature-verified webhook and the verify endpoint).
// subscription_end_date is deliberately NOT a gate: it is the end of the *current* period and falls into the past on every
// renewal until a webhook refreshes it, so gating on it would paywall a customer who is still being charged.
export function computeAccessStatus(user: UserRecord, now: number = Date.now()): Exclude<AccessStatus, 'no_auth'> {
  if (user.subscription_status === 'active' || user.subscription_status === 'paused') return 'subscribed'
  const trialEnd = Date.parse(user.trial_end_date)
  if (Number.isFinite(trialEnd) && trialEnd > now && user.subscription_status === 'trial') return 'trial_active'
  return 'paywall'
}

export function toPublicUser(user: UserRecord, now: number = Date.now()): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    trial_end_date: user.trial_end_date,
    subscription_status: user.subscription_status,
    subscription_plan: user.subscription_plan,
    subscription_end_date: user.subscription_end_date,
    has_billing_portal: !!user.paddle_customer_id,
    access: computeAccessStatus(user, now),
  }
}
