import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SubscriptionPlan, UserRecord } from './types'

export interface PaddleEvent { event_type: string; data: any }
export interface EventTarget { userId?: string; subscriptionId?: string; customerId?: string; email?: string }

export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string | undefined,
  nowMs: number = Date.now(),
  toleranceS = 300,
): boolean {
  if (!secret || !header) return false
  let ts = ''
  const h1s: string[] = []
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    if (k === 'ts') ts = v
    else if (k === 'h1') h1s.push(v)
  }
  if (!/^\d+$/.test(ts) || h1s.length === 0) return false
  if (Math.abs(nowMs / 1000 - Number(ts)) > toleranceS) return false
  const expected = Buffer.from(createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex'))
  return h1s.some((h) => {
    const got = Buffer.from(h)
    return got.length === expected.length && timingSafeEqual(got, expected)
  })
}

export function eventTarget(e: PaddleEvent): EventTarget {
  const d = e.data ?? {}
  const isSubscription = typeof e.event_type === 'string' && e.event_type.startsWith('subscription.')
  return {
    userId: d.custom_data?.userId,
    subscriptionId: isSubscription ? d.id : d.subscription_id,
    customerId: d.customer_id,
    email: d.customer?.email,
  }
}

export function planFromSubscription(data: any): SubscriptionPlan {
  return data?.items?.[0]?.price?.billing_cycle?.interval === 'year' ? 'yearly' : 'monthly'
}

const periodEnd = (d: any): string | null => d?.current_billing_period?.ends_at ?? d?.next_billed_at ?? null

export function applyEvent(user: UserRecord, e: PaddleEvent): Partial<UserRecord> | null {
  const d = e.data ?? {}
  const bound = user.paddle_subscription_id
  // An event for a subscription other than the one the user is bound to must not change that user.
  const foreign = !!bound && bound !== d.id
  switch (e.event_type) {
    case 'subscription.created':
    case 'subscription.activated':
    case 'subscription.updated':
    case 'subscription.resumed': {
      if (d.status === 'canceled') return foreign ? null : { subscription_status: 'cancelled' }
      if (d.status === 'paused') return foreign ? null : { subscription_status: 'paused' }
      if (d.status !== 'active' && d.status !== 'trialing') return null // past_due (dunning), unknown or missing status
      if (foreign && user.subscription_status === 'active') return null // cannot steal an active binding
      if (bound === d.id && user.subscription_status === 'cancelled') return null // cancelled is terminal for the same subscription (stale replay)
      return {
        subscription_status: 'active',
        subscription_plan: planFromSubscription(d),
        subscription_end_date: periodEnd(d) ?? user.subscription_end_date,
        paddle_subscription_id: d.id ?? user.paddle_subscription_id,
        paddle_customer_id: d.customer_id ?? user.paddle_customer_id,
      }
    }
    case 'subscription.paused':
      return foreign ? null : { subscription_status: 'paused' } // keep subscription_end_date: access holds until period end
    case 'subscription.canceled':
      return foreign ? null : { subscription_status: 'cancelled' }
    case 'transaction.payment_failed':
      // Only the bound, currently active subscription can be expired by a failed payment.
      return bound && d.subscription_id === bound && user.subscription_status === 'active'
        ? { subscription_status: 'expired' }
        : null
    default:
      return null
  }
}

export class PaddleHttpError extends Error {
  constructor(public status: number, what: string) {
    super(`Paddle ${what} failed: ${status}`)
  }
}

export interface PaddleApi {
  getTransaction(id: string): Promise<any>
  getSubscription(id: string): Promise<any>
  createPortalSession(customerId: string, subscriptionIds?: string[]): Promise<string>
}

// Ids end up in API paths: only Paddle's own id shape is allowed, so `..`, `/`, `?` or `%` can never
// redirect a call to another endpoint of the live API (encodeURIComponent alone does not stop `..`).
function paddleId(id: unknown): string {
  if (typeof id !== 'string' || !/^(txn|sub|ctm)_[a-z0-9]+$/i.test(id)) throw new Error('Invalid Paddle id')
  return id
}

export function createPaddleApi(opts: { apiKey?: string; env?: string; fetch?: typeof fetch }): PaddleApi | null {
  if (!opts.apiKey) return null
  const base = opts.env === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com'
  const doFetch = opts.fetch ?? fetch
  const headers = { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' }

  async function call(path: string, what: string, init?: RequestInit): Promise<any> {
    const res = await doFetch(`${base}${path}`, { headers, ...init })
    if (!res.ok) throw new PaddleHttpError(res.status, what)
    return (await res.json()).data
  }
  return {
    getTransaction: async (id) => call(`/transactions/${paddleId(id)}`, 'transaction lookup'),
    getSubscription: async (id) => call(`/subscriptions/${paddleId(id)}`, 'subscription lookup'),
    async createPortalSession(customerId, subscriptionIds) {
      subscriptionIds?.forEach(paddleId)
      const data = await call(`/customers/${paddleId(customerId)}/portal-sessions`, 'portal session', {
        method: 'POST',
        body: JSON.stringify(subscriptionIds?.length ? { subscription_ids: subscriptionIds } : {}),
      })
      const url = data?.urls?.general?.overview
      if (!url) throw new Error('No portal URL in Paddle response')
      return url
    },
  }
}
