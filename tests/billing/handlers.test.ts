import { createHmac } from 'node:crypto'
import { handlePortalSession, handleVerifySubscription, handleWebhook } from '../../lib/billing/handlers'
import { openUsersDb } from '../../lib/billing/db'
import { SESSION_COOKIE, signSession } from '../../lib/billing/session'
import type { Deps } from '../../lib/billing/deps'
import type { UserRecord } from '../../lib/billing/types'
import type { PaddleApi } from '../../lib/billing/paddle'

const NOW = Date.parse('2026-10-20T12:00:00Z')
const SECRET = 'whsec_test'
const PRICE_IDS = ['pri_rw_monthly', 'pri_rw_yearly']
const RW_YEARLY_ITEMS = [{ price: { id: 'pri_rw_yearly', billing_cycle: { interval: 'year' } } }]
const RW_MONTHLY_ITEMS = [{ price: { id: 'pri_rw_monthly', billing_cycle: { interval: 'month' } } }]
const FOREIGN_ITEMS = [{ price: { id: 'pri_other_product', billing_cycle: { interval: 'month' } } }]
beforeEach(() => { process.env.JWT_SECRET = 'k'.repeat(40) })
afterAll(() => { delete process.env.JWT_SECRET })
// Ruling U: ignored and refused billing paths warn on purpose; keep jest output clean and assert on the spy.
let warnSpy: jest.SpyInstance
beforeEach(() => { warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => { warnSpy.mockRestore() })
const warned = () => JSON.stringify(warnSpy.mock.calls)

const baseUser = (over: Partial<UserRecord> = {}): UserRecord => ({
  id: 'g1', email: 'igor@example.com', name: 'I', avatar: null, trial_end_date: new Date(NOW + 1e6).toISOString(),
  subscription_status: 'trial', subscription_plan: null, subscription_end_date: null,
  paddle_subscription_id: null, paddle_customer_id: null, created_at: new Date(NOW - 1e6).toISOString(), ...over,
})
function deps(over: Partial<Deps> = {}, users: UserRecord[] = [baseUser()]): Deps {
  const db = openUsersDb(':memory:', () => NOW)
  users.forEach((u) => db.save(u))
  return { db, paddle: null, webhookSecret: SECRET, google: null, appUrl: 'https://rating.watch', priceIds: PRICE_IDS, now: () => NOW, ...over }
}
const signedReq = (event: object, opts: { ts?: number; secret?: string; tamper?: boolean } = {}) => {
  const body = JSON.stringify(event)
  const ts = opts.ts ?? Math.floor(NOW / 1000)
  const h1 = createHmac('sha256', opts.secret ?? SECRET).update(`${ts}:${body}`).digest('hex')
  return new Request('https://rating.watch/api/paddle/webhook', { method: 'POST', headers: { 'paddle-signature': `ts=${ts};h1=${h1}` }, body: opts.tamper ? body + ' ' : body })
}
const subEvent = (type: string, data: any = {}) => ({ event_type: type, data: { id: 'sub_1', customer_id: 'ctm_1', status: 'active', items: RW_YEARLY_ITEMS, current_billing_period: { ends_at: '2027-10-20T00:00:00Z' }, custom_data: { userId: 'g1' }, ...data } })

describe('handleWebhook', () => {
  it('activates the user named in custom_data and stores plan, period and Paddle ids', async () => {
    const d = deps()
    const r = await handleWebhook(signedReq(subEvent('subscription.created')), d)
    expect(r.status).toBe(200)
    expect(d.db.get('g1')).toMatchObject({ subscription_status: 'active', subscription_plan: 'yearly', paddle_subscription_id: 'sub_1', paddle_customer_id: 'ctm_1', subscription_end_date: '2027-10-20T00:00:00Z' })
  })
  it('401s a bad signature, a tampered body and a stale timestamp, writing nothing', async () => {
    const d = deps()
    for (const req of [signedReq(subEvent('subscription.created'), { secret: 'wrong' }), signedReq(subEvent('subscription.created'), { tamper: true }), signedReq(subEvent('subscription.created'), { ts: Math.floor(NOW / 1000) - 600 })]) {
      expect((await handleWebhook(req, d)).status).toBe(401)
    }
    expect(d.db.get('g1')!.subscription_status).toBe('trial')
  })
  it('401s every request when no webhook secret is configured', async () => {
    expect((await handleWebhook(signedReq(subEvent('subscription.created')), deps({ webhookSecret: undefined }))).status).toBe(401)
  })
  it('400s a signed non-JSON body', async () => {
    const body = 'not json'
    const ts = Math.floor(NOW / 1000)
    const h1 = createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex')
    const r = await handleWebhook(new Request('https://x/api/paddle/webhook', { method: 'POST', headers: { 'paddle-signature': `ts=${ts};h1=${h1}` }, body }), deps())
    expect(r.status).toBe(400)
  })
  it('finds the user by subscription id, then customer id, then email in any case', async () => {
    const bySub = deps({}, [baseUser({ paddle_subscription_id: 'sub_1' })])
    await handleWebhook(signedReq(subEvent('subscription.canceled', { custom_data: undefined })), bySub)
    expect(bySub.db.get('g1')!.subscription_status).toBe('cancelled')
    const byCustomer = deps({}, [baseUser({ paddle_customer_id: 'ctm_1' })])
    await handleWebhook(signedReq(subEvent('subscription.paused', { custom_data: undefined })), byCustomer)
    expect(byCustomer.db.get('g1')!.subscription_status).toBe('paused')
    const byEmail = deps()
    await handleWebhook(signedReq(subEvent('subscription.created', { custom_data: undefined, customer: { email: 'IGOR@Example.COM' } })), byEmail)
    expect(byEmail.db.get('g1')!.subscription_status).toBe('active')
  })
  it('returns 200 and writes nothing for an unknown user or an unknown event type', async () => {
    const d = deps()
    expect((await handleWebhook(signedReq(subEvent('subscription.created', { custom_data: { userId: 'ghost' } })), d)).status).toBe(200)
    expect((await handleWebhook(signedReq({ event_type: 'customer.updated', data: {} }), d)).status).toBe(200)
    expect(d.db.get('g1')!.subscription_status).toBe('trial')
  })
  it('is idempotent: the same event twice leaves the same state', async () => {
    const d = deps()
    await handleWebhook(signedReq(subEvent('subscription.created')), d)
    const first = d.db.get('g1')
    await handleWebhook(signedReq(subEvent('subscription.created')), d)
    expect(d.db.get('g1')).toEqual(first)
  })
  it('payment_failed expires the active subscriber found by subscription id', async () => {
    const d = deps({}, [baseUser({ subscription_status: 'active', paddle_subscription_id: 'sub_1' })])
    await handleWebhook(signedReq({ event_type: 'transaction.payment_failed', data: { subscription_id: 'sub_1' } }), d)
    expect(d.db.get('g1')!.subscription_status).toBe('expired')
  })

  describe('buyer-controlled custom_data.userId is not trusted over Paddle ids', () => {
    const owner = () => baseUser({ id: 'owner', email: 'owner@example.com', subscription_status: 'active', paddle_subscription_id: 'sub_1', paddle_customer_id: 'ctm_1' })
    const victim = () => baseUser({ id: 'victim', email: 'victim@example.com', subscription_status: 'active', paddle_subscription_id: 'sub_v', paddle_customer_id: 'ctm_v' })

    it('a canceled event for sub_1 naming a victim userId cancels the real owner and leaves the victim untouched', async () => {
      const d = deps({}, [owner(), victim()])
      const r = await handleWebhook(signedReq(subEvent('subscription.canceled', { status: 'canceled', custom_data: { userId: 'victim' } })), d)
      expect(r.status).toBe(200)
      expect(d.db.get('owner')!.subscription_status).toBe('cancelled')
      expect(d.db.get('victim')).toEqual(victim())
    })
    it('a payment_failed naming the victim userId with a subscription id bound to nobody changes nobody and still returns 200', async () => {
      const unbound = baseUser({ id: 'free', email: 'free@example.com', subscription_status: 'active' })
      const d = deps({}, [owner(), victim(), unbound])
      for (const victimId of ['victim', 'free']) {
        const r = await handleWebhook(signedReq({ event_type: 'transaction.payment_failed', data: { subscription_id: 'sub_nobody', custom_data: { userId: victimId } } }), d)
        expect(r.status).toBe(200)
      }
      expect(d.db.get('owner')).toEqual(owner())
      expect(d.db.get('victim')).toEqual(victim())
      expect(d.db.get('free')).toEqual(unbound)
    })
  })
  describe('Ruling K: events resolved only via userId or email can bind but never cancel, pause or expire', () => {
    const trialUser = () => baseUser({ email: 'igor@example.com' })
    const unknownIds = { id: 'sub_nobody', customer_id: 'ctm_nobody' }
    it('canceled / paused / payment_failed that match nobody by Paddle ids leave an unbound trial user unchanged (200)', async () => {
      for (const ev of [
        subEvent('subscription.canceled', { ...unknownIds, status: 'canceled' }),
        subEvent('subscription.paused', { ...unknownIds, status: 'paused' }),
        { event_type: 'transaction.payment_failed', data: { subscription_id: 'sub_nobody', customer_id: 'ctm_nobody', custom_data: { userId: 'g1' } } },
        subEvent('subscription.canceled', { ...unknownIds, status: 'canceled', custom_data: undefined, customer: { email: 'igor@example.com' } }),
      ]) {
        const d = deps({}, [trialUser()])
        expect((await handleWebhook(signedReq(ev), d)).status).toBe(200)
        expect(d.db.get('g1')).toEqual(trialUser())
      }
    })
    it('userId-only matches ignore an updated event whose status is not active or trialing', async () => {
      const d = deps({}, [trialUser()])
      for (const status of ['canceled', 'paused', 'past_due']) {
        await handleWebhook(signedReq(subEvent('subscription.updated', { ...unknownIds, status })), d)
      }
      expect(d.db.get('g1')).toEqual(trialUser())
    })
    it('a subscription.created (active) naming the userId still activates and binds, and so does an email-only match', async () => {
      const byUserId = deps({}, [trialUser()])
      await handleWebhook(signedReq(subEvent('subscription.created', unknownIds)), byUserId)
      expect(byUserId.db.get('g1')).toMatchObject({ subscription_status: 'active', paddle_subscription_id: 'sub_nobody', paddle_customer_id: 'ctm_nobody' })
      const byEmail = deps({}, [trialUser()])
      await handleWebhook(signedReq(subEvent('subscription.created', { ...unknownIds, custom_data: undefined, customer: { email: 'IGOR@example.com' } })), byEmail)
      expect(byEmail.db.get('g1')).toMatchObject({ subscription_status: 'active', paddle_subscription_id: 'sub_nobody' })
    })
  })
  it('an old subscription canceled event does not touch a user now active on a new subscription', async () => {
    const current = baseUser({ subscription_status: 'active', paddle_subscription_id: 'sub_new', paddle_customer_id: 'ctm_1' })
    const d = deps({}, [current])
    const r = await handleWebhook(signedReq(subEvent('subscription.canceled', { id: 'sub_old', status: 'canceled' })), d)
    expect(r.status).toBe(200)
    expect(d.db.get('g1')).toEqual(current)
  })
})

const authed = (path: string, init: RequestInit = {}) => new Request(`https://rating.watch${path}`, { ...init, headers: { cookie: `${SESSION_COOKIE}=${signSession('g1')}`, 'content-type': 'application/json', ...(init.headers ?? {}) } })
const api = (over: Partial<PaddleApi> = {}): PaddleApi => ({
  getTransaction: async () => ({ subscription_id: 'sub_1' }),
  getSubscription: async () => ({ id: 'sub_1', customer_id: 'ctm_1', status: 'active', items: RW_MONTHLY_ITEMS, current_billing_period: { ends_at: '2026-11-20T00:00:00Z' } }),
  createPortalSession: async () => 'https://portal/x', ...over,
})

describe('handleVerifySubscription', () => {
  let errSpy: jest.SpyInstance
  beforeEach(() => { errSpy = jest.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => { errSpy.mockRestore() })
  const post = (body: object) => authed('/api/paddle/verify-subscription', { method: 'POST', body: JSON.stringify(body) })
  it('activates the signed-in user from a transaction id', async () => {
    const d = deps({ paddle: api() })
    const r = await handleVerifySubscription(post({ transactionId: 'txn_1' }), d)
    expect(r.status).toBe(200)
    expect(d.db.get('g1')).toMatchObject({ subscription_status: 'active', subscription_plan: 'monthly', paddle_customer_id: 'ctm_1' })
  })
  it('is idempotent after the webhook already activated the user', async () => {
    const d = deps({ paddle: api() })
    await handleWebhook(signedReq(subEvent('subscription.created')), d)
    expect((await handleVerifySubscription(post({ transactionId: 'txn_1' }), d)).status).toBe(200)
    expect(d.db.get('g1')!.subscription_status).toBe('active')
  })
  it('401 without a session, 400 without transactionId, 503 without Paddle configured', async () => {
    expect((await handleVerifySubscription(new Request('https://x', { method: 'POST', body: '{}' }), deps({ paddle: api() }))).status).toBe(401)
    expect((await handleVerifySubscription(post({}), deps({ paddle: api() }))).status).toBe(400)
    expect((await handleVerifySubscription(post({ transactionId: 'txn_t' }), deps({ paddle: null }))).status).toBe(503)
  })
  it('202 when the subscription does not exist yet, 402 when it is not active, 502 when Paddle fails', async () => {
    expect((await handleVerifySubscription(post({ transactionId: 'txn_t' }), deps({ paddle: api({ getTransaction: async () => ({}) }) }))).status).toBe(202)
    expect((await handleVerifySubscription(post({ transactionId: 'txn_t' }), deps({ paddle: api({ getSubscription: async () => ({ id: 'sub_1', status: 'canceled', items: RW_MONTHLY_ITEMS }) }) }))).status).toBe(402)
    expect((await handleVerifySubscription(post({ transactionId: 'txn_t' }), deps({ paddle: api({ getTransaction: async () => { throw new Error('boom') } }) }))).status).toBe(502)
  })
  it('409s and writes nothing when the subscription is already bound to another account', async () => {
    const other = baseUser({ id: 'g2', email: 'other@example.com', subscription_status: 'active', paddle_subscription_id: 'sub_1', paddle_customer_id: 'ctm_1' })
    const d = deps({ paddle: api() }, [baseUser(), other])
    const r = await handleVerifySubscription(post({ transactionId: 'txn_1' }), d)
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ error: 'Subscription belongs to another account' })
    expect(d.db.get('g1')).toEqual(baseUser())
    expect(d.db.get('g2')).toEqual(other)
  })
  it('409s and writes nothing when the subscription custom_data.userId names a different user; a missing one is allowed', async () => {
    const sub = (custom_data?: any) => async () => ({ id: 'sub_1', customer_id: 'ctm_1', status: 'active', custom_data, items: RW_MONTHLY_ITEMS, current_billing_period: { ends_at: '2026-11-20T00:00:00Z' } })
    const mismatch = deps({ paddle: api({ getSubscription: sub({ userId: 'someone-else' }) }) })
    const r = await handleVerifySubscription(post({ transactionId: 'txn_1' }), mismatch)
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ error: 'Subscription belongs to another account' })
    expect(mismatch.db.get('g1')).toEqual(baseUser())
    for (const cd of [undefined, {}, { userId: '' }, { userId: 'g1' }]) {
      const ok = deps({ paddle: api({ getSubscription: sub(cd) }) })
      expect((await handleVerifySubscription(post({ transactionId: 'txn_1' }), ok)).status).toBe(200)
      expect(ok.db.get('g1')!.subscription_status).toBe('active')
    }
  })
  it('does not leak Paddle ids in the response', async () => {
    const r = await handleVerifySubscription(post({ transactionId: 'txn_t' }), deps({ paddle: api() }))
    expect(JSON.stringify(await r.json())).not.toMatch(/ctm_1|sub_1/)
  })
})

describe('handlePortalSession', () => {
  let errSpy: jest.SpyInstance
  beforeEach(() => { errSpy = jest.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => { errSpy.mockRestore() })
  it('returns the portal url for a customer with a Paddle id', async () => {
    const d = deps({ paddle: api() }, [baseUser({ paddle_customer_id: 'ctm_1', paddle_subscription_id: 'sub_1' })])
    const r = await handlePortalSession(authed('/api/paddle/portal-session'), d)
    expect(await r.json()).toEqual({ url: 'https://portal/x' })
  })
  it('401 / 400 / 503 / 502', async () => {
    expect((await handlePortalSession(new Request('https://x'), deps({ paddle: api() }))).status).toBe(401)
    expect((await handlePortalSession(authed('/p'), deps({ paddle: api() }))).status).toBe(400)
    expect((await handlePortalSession(authed('/p'), deps({ paddle: null }, [baseUser({ paddle_customer_id: 'c' })]))).status).toBe(503)
    expect((await handlePortalSession(authed('/p'), deps({ paddle: api({ createPortalSession: async () => { throw new Error('x') } }) }, [baseUser({ paddle_customer_id: 'c' })]))).status).toBe(502)
  })
})

const signedRaw = (body: string) => {
  const ts = Math.floor(NOW / 1000)
  const h1 = createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex')
  return new Request('https://rating.watch/api/paddle/webhook', { method: 'POST', headers: { 'paddle-signature': `ts=${ts};h1=${h1}` }, body })
}

describe('Ruling P: only Rating Watch prices count (the Paddle account is shared)', () => {
  // A subscriber bound to sub_1/ctm_1 who is ALSO named by custom_data.userId: every lookup path matches them.
  const bound = () => baseUser({ subscription_status: 'active', subscription_plan: 'yearly', paddle_subscription_id: 'sub_1', paddle_customer_id: 'ctm_1' })
  const foreignEvents = () => [
    subEvent('subscription.created', { items: FOREIGN_ITEMS }),
    subEvent('subscription.updated', { items: FOREIGN_ITEMS }),
    subEvent('subscription.updated', { items: FOREIGN_ITEMS, status: 'canceled' }),
    subEvent('subscription.canceled', { items: FOREIGN_ITEMS, status: 'canceled' }),
    subEvent('subscription.paused', { items: FOREIGN_ITEMS, status: 'paused' }),
    { event_type: 'transaction.payment_failed', data: { id: 'txn_9', subscription_id: 'sub_1', customer_id: 'ctm_1', custom_data: { userId: 'g1' }, items: [{ price_id: 'pri_other_product', price: { id: 'pri_other_product' } }] } },
  ]

  it('ignores foreign-price created/updated/canceled/paused/payment_failed with 200 and no write, for a trial user named by userId and customer id', async () => {
    for (const ev of foreignEvents()) {
      const trial = baseUser({ paddle_customer_id: 'ctm_1' })
      const d = deps({}, [trial])
      const r = await handleWebhook(signedReq(ev), d)
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({ received: true })
      expect(d.db.get('g1')).toEqual(trial)
    }
  })
  it('ignores the same foreign-price events for a user bound to that subscription and customer', async () => {
    for (const ev of foreignEvents()) {
      const d = deps({}, [bound()])
      expect((await handleWebhook(signedReq(ev), d)).status).toBe(200)
      expect(d.db.get('g1')).toEqual(bound())
    }
  })
  it('accepts an event when at least one item carries an allowed price (price.id or price_id)', async () => {
    const mixed = deps()
    await handleWebhook(signedReq(subEvent('subscription.created', { items: [...FOREIGN_ITEMS, ...RW_YEARLY_ITEMS] })), mixed)
    expect(mixed.db.get('g1')).toMatchObject({ subscription_status: 'active', paddle_subscription_id: 'sub_1' })
    const canceled = deps({}, [bound()])
    await handleWebhook(signedReq(subEvent('subscription.canceled', { status: 'canceled' })), canceled)
    expect(canceled.db.get('g1')!.subscription_status).toBe('cancelled')
    const failed = deps({}, [bound()])
    await handleWebhook(signedReq({ event_type: 'transaction.payment_failed', data: { subscription_id: 'sub_1', items: [{ price_id: 'pri_rw_monthly' }] } }), failed)
    expect(failed.db.get('g1')!.subscription_status).toBe('expired')
  })
  it('an empty allow-list ignores everything (fail closed), even events that would otherwise apply', async () => {
    const evs = [subEvent('subscription.created'), subEvent('subscription.canceled', { status: 'canceled' }), { event_type: 'transaction.payment_failed', data: { subscription_id: 'sub_1' } }]
    for (const ev of evs) {
      for (const u of [baseUser(), bound()]) {
        const d = deps({ priceIds: [] }, [u])
        const r = await handleWebhook(signedReq(ev), d)
        expect(r.status).toBe(200)
        expect(d.db.get('g1')).toEqual(u)
      }
    }
  })
  it('events without items apply only through a subscription binding (Ruling T), never via customer id, userId or email', async () => {
    const noItems = { items: undefined }
    const byUserId = deps()
    await handleWebhook(signedReq(subEvent('subscription.created', noItems)), byUserId)
    expect(byUserId.db.get('g1')).toEqual(baseUser())
    const byEmail = deps()
    await handleWebhook(signedReq(subEvent('subscription.created', { ...noItems, custom_data: undefined, customer: { email: 'igor@example.com' } })), byEmail)
    expect(byEmail.db.get('g1')).toEqual(baseUser())
    const emptyItems = deps()
    await handleWebhook(signedReq(subEvent('subscription.created', { items: [] })), emptyItems)
    expect(emptyItems.db.get('g1')).toEqual(baseUser())
    const bySub = deps({}, [bound()])
    await handleWebhook(signedReq(subEvent('subscription.canceled', { ...noItems, status: 'canceled' })), bySub)
    expect(bySub.db.get('g1')!.subscription_status).toBe('cancelled')
    // Paddle keeps one customer per email across the shared account, so a customer match does not prove the event is ours.
    const customerOnly = baseUser({ paddle_customer_id: 'ctm_1' })
    const byCustomer = deps({}, [customerOnly])
    expect((await handleWebhook(signedReq(subEvent('subscription.updated', { ...noItems, custom_data: undefined })), byCustomer)).status).toBe(200)
    expect(byCustomer.db.get('g1')).toEqual(customerOnly)
    const boundByCustomer = baseUser({ subscription_status: 'active', paddle_subscription_id: 'sub_rw', paddle_customer_id: 'ctm_1' })
    const otherSubSameCustomer = deps({}, [boundByCustomer])
    await handleWebhook(signedReq(subEvent('subscription.canceled', { ...noItems, status: 'canceled', custom_data: undefined })), otherSubSameCustomer)
    await handleWebhook(signedReq({ event_type: 'transaction.payment_failed', data: { subscription_id: 'sub_other', customer_id: 'ctm_1' } }), otherSubSameCustomer)
    expect(otherSubSameCustomer.db.get('g1')).toEqual(boundByCustomer)
    const failedBySub = deps({}, [bound()])
    await handleWebhook(signedReq({ event_type: 'transaction.payment_failed', data: { subscription_id: 'sub_1', customer_id: 'ctm_1' } }), failedBySub)
    expect(failedBySub.db.get('g1')!.subscription_status).toBe('expired')
  })
})

describe('handleWebhook rejects malformed signed payloads without a 500', () => {
  let errSpy: jest.SpyInstance
  beforeEach(() => { errSpy = jest.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => { errSpy.mockRestore() })
  it('400s a body that is not an event object', async () => {
    for (const body of ['null', '123', '"x"', '[]', '{}', '{"event_type":5}', '{"event_type":"subscription.created","data":5}', '{"event_type":"subscription.created","data":null}']) {
      const d = deps()
      const r = await handleWebhook(signedRaw(body), d)
      expect([body, r.status]).toEqual([body, 400])
      expect(d.db.get('g1')).toEqual(baseUser())
    }
  })
  it('accepts an event without data (200, nothing written)', async () => {
    const d = deps()
    expect((await handleWebhook(signedRaw('{"event_type":"customer.updated"}'), d)).status).toBe(200)
    expect(d.db.get('g1')).toEqual(baseUser())
  })
  it('ignores non-string userId, email, subscription id and customer id instead of passing them to the DB', async () => {
    const evs = [
      subEvent('subscription.created', { id: 'sub_x', customer_id: 'ctm_x', custom_data: { userId: { $ne: null } } }),
      subEvent('subscription.created', { id: 'sub_x', customer_id: 'ctm_x', custom_data: { userId: 42 } }),
      subEvent('subscription.created', { id: 'sub_x', customer_id: 'ctm_x', custom_data: undefined, customer: { email: ['igor@example.com'] } }),
      subEvent('subscription.created', { id: { x: 1 }, customer_id: ['ctm_1'], custom_data: undefined }),
    ]
    for (const ev of evs) {
      const d = deps()
      const r = await handleWebhook(signedReq(ev), d)
      expect(r.status).toBe(200)
      expect(d.db.get('g1')).toEqual(baseUser())
    }
    expect(errSpy).not.toHaveBeenCalled()
  })
})

describe('handleVerifySubscription: price allow-list and transaction id validation', () => {
  let errSpy: jest.SpyInstance
  beforeEach(() => { errSpy = jest.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => { errSpy.mockRestore() })
  const post = (body: object) => authed('/api/paddle/verify-subscription', { method: 'POST', body: JSON.stringify(body) })

  it('409s and writes nothing for a subscription of another product', async () => {
    const d = deps({ paddle: api({ getSubscription: async () => ({ id: 'sub_1', customer_id: 'ctm_1', status: 'active', items: FOREIGN_ITEMS, custom_data: { userId: 'g1' } }) }) })
    const r = await handleVerifySubscription(post({ transactionId: 'txn_1' }), d)
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ error: 'Subscription is not a Rating Watch plan' })
    expect(d.db.get('g1')).toEqual(baseUser())
    const none = deps({ paddle: api({ getSubscription: async () => ({ id: 'sub_1', customer_id: 'ctm_1', status: 'active' }) }) })
    expect((await handleVerifySubscription(post({ transactionId: 'txn_1' }), none)).status).toBe(409)
    expect(none.db.get('g1')).toEqual(baseUser())
  })
  it('503s with an empty allow-list before calling Paddle', async () => {
    const getTransaction = jest.fn(async () => ({ subscription_id: 'sub_1' }))
    const d = deps({ paddle: api({ getTransaction }), priceIds: [] })
    const r = await handleVerifySubscription(post({ transactionId: 'txn_1' }), d)
    expect(r.status).toBe(503)
    expect(await r.json()).toEqual({ error: 'Billing is not configured' })
    expect(getTransaction).not.toHaveBeenCalled()
    expect(d.db.get('g1')).toEqual(baseUser())
  })
  it('400s a transaction id that is not txn_<alphanumeric> without calling Paddle', async () => {
    const getTransaction = jest.fn(async () => ({ subscription_id: 'sub_1' }))
    const d = deps({ paddle: api({ getTransaction }) })
    for (const transactionId of ['x/../subscriptions/sub_1', 'txn_1/../../customers/ctm_1', '%2e%2e', '..', '', 'txn_', 'txn_1?x=1', 'txn_1#', 'sub_1', ' txn_1', 'txn_1\n', 42]) {
      const r = await handleVerifySubscription(post({ transactionId }), d)
      expect([transactionId, r.status]).toEqual([transactionId, 400])
    }
    expect(getTransaction).not.toHaveBeenCalled()
    expect((await handleVerifySubscription(post({ transactionId: 'TXN_01abcDEF' }), d)).status).toBe(200)
  })
})

describe('Ruling U: price-filter misconfiguration is visible in the logs', () => {
  const leaks = /g1|ctm_1|igor@example\.com|whsec|sub_1/
  it('warns once on a foreign-price webhook event with the event type and price ids, no identities', async () => {
    const d = deps({}, [baseUser({ paddle_customer_id: 'ctm_1' })])
    await handleWebhook(signedReq(subEvent('subscription.created', { items: FOREIGN_ITEMS, customer: { email: 'igor@example.com' } })), d)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith('paddle price filter ignored:', { source: 'subscription.created', priceIds: ['pri_other_product'], allowListEmpty: false })
    expect(warned()).not.toMatch(leaks)
  })
  it('warns with allowListEmpty true when the allow-list is empty', async () => {
    await handleWebhook(signedReq(subEvent('subscription.created')), deps({ priceIds: [] }))
    expect(warnSpy).toHaveBeenCalledWith('paddle price filter ignored:', { source: 'subscription.created', priceIds: ['pri_rw_yearly'], allowListEmpty: true })
    expect(warned()).not.toMatch(leaks)
  })
  it('does not warn for an allowed event', async () => {
    await handleWebhook(signedReq(subEvent('subscription.created')), deps())
    expect(warnSpy).not.toHaveBeenCalled()
  })
  it('verify warns on the 409 foreign-price and the 503 empty-list paths', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const post = () => authed('/api/paddle/verify-subscription', { method: 'POST', body: JSON.stringify({ transactionId: 'txn_1' }) })
      await handleVerifySubscription(post(), deps({ paddle: api({ getSubscription: async () => ({ id: 'sub_1', customer_id: 'ctm_1', status: 'active', items: FOREIGN_ITEMS, custom_data: { userId: 'g1' } }) }) }))
      expect(warnSpy).toHaveBeenLastCalledWith('paddle price filter refused:', { source: 'verify', priceIds: ['pri_other_product'], allowListEmpty: false })
      await handleVerifySubscription(post(), deps({ paddle: api(), priceIds: [] }))
      expect(warnSpy).toHaveBeenLastCalledWith('paddle price filter refused:', { source: 'verify', priceIds: [], allowListEmpty: true })
      expect(warnSpy).toHaveBeenCalledTimes(2)
      expect(warned()).not.toMatch(leaks)
      await handleVerifySubscription(post(), deps({ paddle: api() }))
      expect(warnSpy).toHaveBeenCalledTimes(2) // an allowed plan does not warn
    } finally {
      errSpy.mockRestore()
    }
  })
})
