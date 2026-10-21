import type { AccessStatus, PublicUser, UserRecord } from './types'

export const TRIAL_DAYS = 3
// A paused subscription keeps access only until the end of the period it already paid for, plus this short grace
// (webhook delay). Without an end date in the future there is nothing paid for, so a pause can never be open-ended.
export const PAUSED_GRACE_MS = 24 * 60 * 60 * 1000

// subscription_status is authoritative (written only by the signature-verified webhook and the verify endpoint).
// subscription_end_date is deliberately NOT a gate: it is the end of the *current* period and falls into the past on every
// renewal until a webhook refreshes it, so gating on it would paywall a customer who is still being charged.
// 'paused' is the exception: nothing is being charged, so it is subscribed only while the paid period (plus grace) lasts.
export function computeAccessStatus(user: UserRecord, now: number = Date.now()): Exclude<AccessStatus, 'no_auth'> {
  if (user.subscription_status === 'active') return 'subscribed'
  if (user.subscription_status === 'paused') {
    const end = Date.parse(user.subscription_end_date ?? '')
    return Number.isFinite(end) && end + PAUSED_GRACE_MS > now ? 'subscribed' : 'paywall'
  }
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
