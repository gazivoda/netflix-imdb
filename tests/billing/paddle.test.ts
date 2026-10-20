import { createHmac } from 'node:crypto'
import { applyEvent, createPaddleApi, eventTarget, PaddleHttpError, planFromSubscription, verifyWebhookSignature } from '../../lib/billing/paddle'
import type { UserRecord } from '../../lib/billing/types'

const SECRET = 'pdl_ntfset_test_secret'
const NOW = Date.parse('2026-10-20T12:00:00Z')
const sign = (body: string, ts = Math.floor(NOW / 1000), secret = SECRET) =>
  `ts=${ts};h1=${createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex')}`

const user = (over: Partial<UserRecord> = {}): UserRecord => ({
  id: 'g1', email: 'a@b.co', name: 'A', avatar: null, trial_end_date: '2026-10-21T00:00:00Z',
  subscription_status: 'trial', subscription_plan: null, subscription_end_date: null,
  paddle_subscription_id: null, paddle_customer_id: null, created_at: '2026-10-19T00:00:00Z', ...over,
})
const sub = (over: any = {}) => ({
  id: 'sub_1', customer_id: 'ctm_1', status: 'active',
  items: [{ price: { billing_cycle: { interval: 'month', frequency: 1 } } }],
  current_billing_period: { ends_at: '2026-11-20T00:00:00Z' }, custom_data: { userId: 'g1' }, ...over,
})

describe('verifyWebhookSignature', () => {
  const body = '{"event_type":"subscription.created"}'
  it('accepts a valid signature', () => expect(verifyWebhookSignature(body, sign(body), SECRET, NOW)).toBe(true))
  it('rejects a tampered body', () => expect(verifyWebhookSignature(body + ' ', sign(body), SECRET, NOW)).toBe(false))
  it('rejects a wrong secret, missing secret and missing header', () => {
    expect(verifyWebhookSignature(body, sign(body, undefined, 'other'), SECRET, NOW)).toBe(false)
    expect(verifyWebhookSignature(body, sign(body), undefined, NOW)).toBe(false)
    expect(verifyWebhookSignature(body, null, SECRET, NOW)).toBe(false)
  })
  it('rejects a validly signed but stale timestamp (replay), accepts within 5 minutes', () => {
    const old = Math.floor(NOW / 1000) - 301
    expect(verifyWebhookSignature(body, sign(body, old), SECRET, NOW)).toBe(false)
    expect(verifyWebhookSignature(body, sign(body, Math.floor(NOW / 1000) - 299), SECRET, NOW)).toBe(true)
  })
  it('accepts any of several h1 values (secret rotation)', () => {
    const good = sign(body)
    expect(verifyWebhookSignature(body, `${good};h1=deadbeef`, SECRET, NOW)).toBe(true)
    expect(verifyWebhookSignature(body, `ts=${Math.floor(NOW / 1000)};h1=zz;${good.split(';')[1]}`, SECRET, NOW)).toBe(true)
  })
  it('rejects malformed headers without throwing', () => {
    for (const h of ['', 'garbage', 'ts=abc;h1=00', 'ts=1', 'h1=00']) expect(verifyWebhookSignature(body, h, SECRET, NOW)).toBe(false)
  })
})

describe('eventTarget', () => {
  it('collects every identifier a subscription event can carry', () => {
    expect(eventTarget({ event_type: 'subscription.created', data: sub({ customer: { email: 'X@Y.co' } }) }))
      .toEqual({ userId: 'g1', subscriptionId: 'sub_1', customerId: 'ctm_1', email: 'X@Y.co' })
  })
  it('uses subscription_id for transaction events', () => {
    expect(eventTarget({ event_type: 'transaction.payment_failed', data: { id: 'txn_1', subscription_id: 'sub_1', customer_id: 'ctm_1' } }).subscriptionId).toBe('sub_1')
  })
})

describe('planFromSubscription', () => {
  it('maps year to yearly and everything else to monthly', () => {
    expect(planFromSubscription({ items: [{ price: { billing_cycle: { interval: 'year' } } }] })).toBe('yearly')
    expect(planFromSubscription(sub())).toBe('monthly')
    expect(planFromSubscription({})).toBe('monthly')
  })
})

describe('applyEvent', () => {
  it('activates on created/activated/updated/resumed with plan, period end and ids', () => {
    for (const t of ['subscription.created', 'subscription.activated', 'subscription.updated', 'subscription.resumed']) {
      expect(applyEvent(user(), { event_type: t, data: sub() })).toEqual({
        subscription_status: 'active', subscription_plan: 'monthly', subscription_end_date: '2026-11-20T00:00:00Z',
        paddle_subscription_id: 'sub_1', paddle_customer_id: 'ctm_1',
      })
    }
  })
  it('falls back to next_billed_at, then keeps the old end date', () => {
    expect(applyEvent(user(), { event_type: 'subscription.updated', data: sub({ current_billing_period: undefined, next_billed_at: '2026-12-01T00:00:00Z' }) })?.subscription_end_date).toBe('2026-12-01T00:00:00Z')
    expect(applyEvent(user({ subscription_end_date: 'keep' }), { event_type: 'subscription.updated', data: sub({ current_billing_period: undefined }) })?.subscription_end_date).toBe('keep')
  })
  it('honours data.status on subscription.updated', () => {
    expect(applyEvent(user(), { event_type: 'subscription.updated', data: sub({ status: 'canceled' }) })?.subscription_status).toBe('cancelled')
    expect(applyEvent(user(), { event_type: 'subscription.updated', data: sub({ status: 'paused' }) })?.subscription_status).toBe('paused')
    expect(applyEvent(user(), { event_type: 'subscription.updated', data: sub({ status: 'past_due' }) })).toBeNull()
    expect(applyEvent(user(), { event_type: 'subscription.updated', data: sub({ status: 'trialing' }) })?.subscription_status).toBe('active')
  })
  it('paused, canceled and payment_failed map like Name Habitat', () => {
    expect(applyEvent(user({ subscription_status: 'active' }), { event_type: 'subscription.paused', data: sub() })).toEqual({ subscription_status: 'paused' })
    expect(applyEvent(user({ subscription_status: 'active' }), { event_type: 'subscription.canceled', data: sub() })).toEqual({ subscription_status: 'cancelled' })
    expect(applyEvent(user({ subscription_status: 'active', paddle_subscription_id: 'sub_1' }), { event_type: 'transaction.payment_failed', data: { subscription_id: 'sub_1' } })).toEqual({ subscription_status: 'expired' })
  })
  it('ignores event types it does not know', () => {
    expect(applyEvent(user(), { event_type: 'customer.updated', data: {} })).toBeNull()
  })
  it('yearly plans map from billing_cycle.interval', () => {
    expect(applyEvent(user(), { event_type: 'subscription.created', data: sub({ items: [{ price: { billing_cycle: { interval: 'year' } } }] }) })?.subscription_plan).toBe('yearly')
  })
})

describe('applyEvent subscription binding and ordering (ruling H)', () => {
  const active2 = () => user({ subscription_status: 'active', paddle_subscription_id: 'sub_2', paddle_customer_id: 'ctm_1' })
  const ev = (event_type: string, over: any = {}) => ({ event_type, data: sub(over) })

  it('cancel-old/buy-new: late cancel of the old subscription does not touch the active new one', () => {
    expect(applyEvent(active2(), ev('subscription.canceled', { id: 'sub_1' }))).toBeNull()
    expect(applyEvent(active2(), ev('subscription.updated', { id: 'sub_1', status: 'canceled' }))).toBeNull()
  })
  it('an activation for another subscription cannot overwrite an active binding', () => {
    expect(applyEvent(active2(), ev('subscription.created', { id: 'sub_3' }))).toBeNull()
    expect(applyEvent(active2(), ev('subscription.updated', { id: 'sub_3', status: 'trialing' }))).toBeNull()
  })
  it('cancelled is terminal for the same subscription id (stale replay)', () => {
    const cancelled = user({ subscription_status: 'cancelled', paddle_subscription_id: 'sub_2' })
    expect(applyEvent(cancelled, ev('subscription.updated', { id: 'sub_2' }))).toBeNull()
  })
  it('a cancelled user can buy a new subscription, which rebinds', () => {
    const cancelled = user({ subscription_status: 'cancelled', paddle_subscription_id: 'sub_2' })
    expect(applyEvent(cancelled, ev('subscription.created', { id: 'sub_3' }))).toEqual({
      subscription_status: 'active', subscription_plan: 'monthly', subscription_end_date: '2026-11-20T00:00:00Z',
      paddle_subscription_id: 'sub_3', paddle_customer_id: 'ctm_1',
    })
  })
  it('paused/cancelled by status or event type with a mismatching bound id is ignored', () => {
    expect(applyEvent(active2(), ev('subscription.updated', { id: 'sub_1', status: 'paused' }))).toBeNull()
    expect(applyEvent(active2(), ev('subscription.created', { id: 'sub_1', status: 'canceled' }))).toBeNull()
    expect(applyEvent(active2(), ev('subscription.paused', { id: 'sub_1' }))).toBeNull()
    expect(applyEvent(active2(), ev('subscription.canceled', { id: 'sub_1' }))).toBeNull()
  })
  it('matching bound id still applies paused and canceled', () => {
    expect(applyEvent(active2(), ev('subscription.canceled', { id: 'sub_2' }))).toEqual({ subscription_status: 'cancelled' })
    expect(applyEvent(active2(), ev('subscription.paused', { id: 'sub_2' }))).toEqual({ subscription_status: 'paused' })
    expect(applyEvent(active2(), ev('subscription.updated', { id: 'sub_2', status: 'canceled' }))).toEqual({ subscription_status: 'cancelled' })
  })
  it('past_due, unknown and missing status do nothing', () => {
    for (const status of ['past_due', 'weird', undefined]) {
      expect(applyEvent(user(), ev('subscription.updated', { status }))).toBeNull()
      expect(applyEvent(active2(), ev('subscription.created', { id: 'sub_2', status }))).toBeNull()
    }
  })
  it('an unbound user still gets activation and canceled applied', () => {
    expect(applyEvent(user(), ev('subscription.created'))?.subscription_status).toBe('active')
    expect(applyEvent(user(), ev('subscription.canceled'))).toEqual({ subscription_status: 'cancelled' })
    expect(applyEvent(user(), ev('subscription.paused'))).toEqual({ subscription_status: 'paused' })
  })
  it('payment_failed expires only the active, bound subscription', () => {
    const pf = (id?: string) => ({ event_type: 'transaction.payment_failed', data: { subscription_id: id } })
    expect(applyEvent(active2(), pf('sub_2'))).toEqual({ subscription_status: 'expired' })
    expect(applyEvent(user(), pf(undefined))).toBeNull() // trial user, first checkout attempt failed
    expect(applyEvent(user(), pf('sub_1'))).toBeNull() // trial user, no binding
    expect(applyEvent(active2(), pf('sub_1'))).toBeNull() // different subscription
    expect(applyEvent(active2(), pf(undefined))).toBeNull() // one-off transaction
    expect(applyEvent(user({ subscription_status: 'trial', paddle_subscription_id: 'sub_2' }), pf('sub_2'))).toBeNull()
    expect(applyEvent(user({ subscription_status: 'cancelled', paddle_subscription_id: 'sub_2' }), pf('sub_2'))).toBeNull()
    expect(applyEvent(user({ subscription_status: 'paused', paddle_subscription_id: 'sub_2' }), pf('sub_2'))).toBeNull()
  })
})

describe('createPaddleApi', () => {
  it('is null without an api key', () => expect(createPaddleApi({})).toBeNull())
  it('uses the sandbox host unless env is production, and sends a bearer token', async () => {
    const f = jest.fn(async () => new Response(JSON.stringify({ data: { id: 'txn_1' } }), { status: 200 }))
    await createPaddleApi({ apiKey: 'k', env: 'sandbox', fetch: f as any })!.getTransaction('txn_1')
    expect(f).toHaveBeenCalledWith('https://sandbox-api.paddle.com/transactions/txn_1', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer k' }) }))
    const g = jest.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 }))
    await createPaddleApi({ apiKey: 'k', env: 'production', fetch: g as any })!.getSubscription('sub_1')
    expect((g.mock.calls[0] as any[])[0]).toBe('https://api.paddle.com/subscriptions/sub_1')
  })
  it('returns the portal overview URL and throws PaddleHttpError on failures', async () => {
    const ok = jest.fn(async () => new Response(JSON.stringify({ data: { urls: { general: { overview: 'https://portal/x' } } } }), { status: 201 }))
    expect(await createPaddleApi({ apiKey: 'k', env: 'production', fetch: ok as any })!.createPortalSession('ctm_1', ['sub_1'])).toBe('https://portal/x')
    const bad = jest.fn(async () => new Response('{}', { status: 500 }))
    await expect(createPaddleApi({ apiKey: 'k', fetch: bad as any })!.getTransaction('txn_t')).rejects.toBeInstanceOf(PaddleHttpError)
    const none = jest.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 201 }))
    await expect(createPaddleApi({ apiKey: 'k', fetch: none as any })!.createPortalSession('ctm_c')).rejects.toThrow(/portal/i)
  })
  it('refuses ids that are not Paddle-shaped before building a URL (no path traversal into the live API)', async () => {
    const f = jest.fn(async () => new Response(JSON.stringify({ data: { urls: { general: { overview: 'https://portal/x' } } } }), { status: 200 }))
    const p = createPaddleApi({ apiKey: 'k', env: 'production', fetch: f as any })!
    for (const bad of ['x/../subscriptions/sub_1', 'txn_1/../../customers/ctm_1', '%2e%2e', '..', '', 'txn_', 'txn_1?x=1', 'txn_1#a']) {
      await expect(p.getTransaction(bad)).rejects.toThrow(/invalid paddle id/i)
      await expect(p.getSubscription(bad)).rejects.toThrow(/invalid paddle id/i)
      await expect(p.createPortalSession(bad)).rejects.toThrow(/invalid paddle id/i)
    }
    await expect(p.createPortalSession('ctm_1', ['sub_1', '../x'])).rejects.toThrow(/invalid paddle id/i)
    expect(f).not.toHaveBeenCalled()
    await p.getTransaction('txn_01ABC')
    await p.getSubscription('sub_01abc')
    await p.createPortalSession('ctm_01abc', ['sub_01abc'])
    expect(f.mock.calls.map((c: any[]) => c[0])).toEqual([
      'https://api.paddle.com/transactions/txn_01ABC',
      'https://api.paddle.com/subscriptions/sub_01abc',
      'https://api.paddle.com/customers/ctm_01abc/portal-sessions',
    ])
  })
})
