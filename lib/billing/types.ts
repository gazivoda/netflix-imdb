export type SubscriptionStatus = 'trial' | 'active' | 'paused' | 'cancelled' | 'expired'
export type SubscriptionPlan = 'monthly' | 'yearly'
// no_auth is decided by the caller (no session); computeAccessStatus only sees signed-in users.
export type AccessStatus = 'no_auth' | 'trial_active' | 'subscribed' | 'paywall'

export interface UserRecord {
  id: string // Google account id (sub)
  email: string | null
  name: string | null
  avatar: string | null
  trial_end_date: string
  subscription_status: SubscriptionStatus
  subscription_plan: SubscriptionPlan | null
  subscription_end_date: string | null
  paddle_subscription_id: string | null
  paddle_customer_id: string | null
  created_at: string
}

export interface PublicUser {
  id: string
  email: string | null
  name: string | null
  avatar: string | null
  trial_end_date: string
  subscription_status: SubscriptionStatus
  subscription_plan: SubscriptionPlan | null
  subscription_end_date: string | null
  has_billing_portal: boolean
  access: Exclude<AccessStatus, 'no_auth'>
}

// Body of GET /api/user/me. billingEnabled is false until Google, sessions, Paddle, the webhook secret and the price allow-list are all configured.
export interface MeResponse {
  user: PublicUser | null
  access: AccessStatus
  billingEnabled: boolean
}
