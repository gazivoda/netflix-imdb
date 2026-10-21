import { toPublicUser } from './access'
import type { Deps } from './deps'
import { readCappedText } from '../body-limit'
import { applyEvent, eventTarget, planFromSubscription, verifyWebhookSignature, type PaddleEvent } from './paddle'
import { eventPriceIds } from './prices'
import { readSessionUserId } from './session'
import type { UserRecord } from './types'

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

type FoundVia = 'subscription' | 'customer' | 'userId' | 'email'

// Lookup order matters: custom_data.userId is set by the buyer (checkout custom data), so it is
// consulted only after Paddle's own subscription and customer ids and cannot redirect an event
// that Paddle ids already resolve to the real owner.
// Signed payloads still carry buyer-influenced fields: anything that is not a non-empty string never reaches the DB.
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

function findUser(deps: Deps, e: PaddleEvent): { user: UserRecord; via: FoundVia } | null {
  const t = eventTarget(e)
  const subscriptionId = str(t.subscriptionId)
  const bySub = subscriptionId ? deps.db.findBySubscriptionId(subscriptionId) : null
  if (bySub) return { user: bySub, via: 'subscription' }
  const customerId = str(t.customerId)
  const byCustomer = customerId ? deps.db.findByCustomerId(customerId) : null
  if (byCustomer) return { user: byCustomer, via: 'customer' }
  const userId = str(t.userId)
  const byUserId = userId ? deps.db.get(userId) : null
  if (byUserId) return { user: byUserId, via: 'userId' }
  const email = str(t.email)
  const byEmail = email ? deps.db.findByEmail(email) : null
  return byEmail ? { user: byEmail, via: 'email' } : null
}

const isObject = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isEvent = (v: unknown): v is PaddleEvent =>
  isObject(v) && typeof v.event_type === 'string' && (v.data === undefined || isObject(v.data))

// Ruling P: the Paddle account is shared with another product. An event counts only if it names one of
// our price ids; an event without items (or with an empty items list) is accepted only through an
// existing subscription binding (Ruling T, checked by the caller).
type PriceVerdict = 'allowed' | 'foreign' | 'no_items'
// Ruling U: a missing or wrong allow-list silently ignores real purchases, so every ignore/refusal says why.
// Only the source and price ids are logged: never tokens, secrets, emails, customer or user ids.
function warnPrices(kind: 'ignored' | 'refused', deps: Deps, source: string, data: any): void {
  console.warn(`paddle price filter ${kind}:`, { source, priceIds: eventPriceIds(data), allowListEmpty: deps.priceIds.length === 0 })
}

function priceVerdict(deps: Deps, data: any): PriceVerdict {
  if (!Array.isArray(data?.items) || data.items.length === 0) return 'no_items'
  return eventPriceIds(data).some((id) => deps.priceIds.includes(id)) ? 'allowed' : 'foreign'
}

// Ruling K: userId and email are buyer-influenced, so an event resolved only through them may bind a
// subscription (activation) but can never cancel, pause or expire anyone.
const ACTIVATION_EVENTS = new Set(['subscription.created', 'subscription.activated', 'subscription.updated', 'subscription.resumed'])
function isActivation(e: PaddleEvent): boolean {
  const status = e.data?.status
  return ACTIVATION_EVENTS.has(e.event_type) && (status === 'active' || status === 'trialing')
}

// SEC-6: Paddle events are a few KB; anything near this size is not one. The cap is enforced from the declared
// content-length first and again while streaming, so an undeclared or lying body is never buffered whole.
export const MAX_WEBHOOK_BYTES = 256 * 1024

export async function handleWebhook(req: Request, deps: Deps): Promise<Response> {
  // Unsigned or unconfigured requests are refused before any body is read.
  if (!deps.webhookSecret || !req.headers.get('paddle-signature')) return json({ error: 'Invalid signature' }, 401)
  const raw = await readCappedText(req, MAX_WEBHOOK_BYTES) // raw body: the signature covers the exact bytes
  if (raw === null) return json({ error: 'Payload too large' }, 413)
  if (!verifyWebhookSignature(raw, req.headers.get('paddle-signature'), deps.webhookSecret, deps.now())) {
    return json({ error: 'Invalid signature' }, 401)
  }
  let event: unknown
  try {
    event = JSON.parse(raw)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  if (!isEvent(event)) return json({ error: 'Invalid event' }, 400)
  // 200 for everything ignored below, so Paddle stops retrying events that are not ours.
  const prices = priceVerdict(deps, event.data)
  if (deps.priceIds.length === 0 || prices === 'foreign') {
    // fail closed: no allow-list, or another product's price => no writes
    warnPrices('ignored', deps, event.event_type, event.data)
    return json({ received: true })
  }
  try {
    const found = findUser(deps, event)
    const trusted = found && (found.via === 'subscription' || found.via === 'customer')
    // Ruling T: Paddle keeps one customer per email across the shared account, so without items only the
    // subscription id proves the event is about a Rating Watch subscription.
    if (prices === 'no_items' && found?.via !== 'subscription') return json({ received: true })
    const patch = found && (trusted || isActivation(event)) ? applyEvent(found.user, event) : null
    if (found && patch) deps.db.save({ ...found.user, ...patch })
    return json({ received: true }) // 200 even for unknown users/events so Paddle stops retrying
  } catch (err) {
    console.error('paddle webhook failed:', (err as Error).message)
    return json({ error: 'Webhook processing failed' }, 500)
  }
}

const sameEmail = (a: unknown, b: unknown): boolean =>
  typeof a === 'string' && typeof b === 'string' && a.trim() !== '' && a.trim().toLowerCase() === b.trim().toLowerCase()

// One Paddle call. Errors propagate so the caller answers 502 (a transient failure must not look like a mismatch).
async function customerMatchesUser(deps: Deps, customerId: string, user: UserRecord): Promise<boolean> {
  if (!deps.paddle) return false
  const customer = await deps.paddle.getCustomer(customerId)
  return sameEmail(customer?.email, user.email)
}

export async function handleVerifySubscription(req: Request, deps: Deps): Promise<Response> {
  const userId = readSessionUserId(req)
  const user = userId ? deps.db.get(userId) : null
  if (!user) return json({ error: 'Unauthorized' }, 401)
  let transactionId: unknown
  try {
    transactionId = (await req.json()).transactionId
  } catch {
    /* falls through to the 400 below */
  }
  if (typeof transactionId !== 'string' || !transactionId) return json({ error: 'transactionId is required' }, 400)
  // The id goes into a Paddle API path: only Paddle's own shape, so nothing like `..` can reach the live API.
  if (!/^txn_[a-z0-9]+$/i.test(transactionId)) return json({ error: 'Invalid transactionId' }, 400)
  if (!deps.paddle) return json({ error: 'Billing is not configured' }, 503)
  if (deps.priceIds.length === 0) {
    warnPrices('refused', deps, 'verify', null)
    return json({ error: 'Billing is not configured' }, 503)
  }
  try {
    const txn = await deps.paddle.getTransaction(transactionId)
    // A transaction tagged for another account cannot be claimed here either (the buyer sets custom_data, so this
    // only stops honest mix-ups; ownership of the subscription is checked below).
    const txnTag = txn?.custom_data?.userId
    if (typeof txnTag === 'string' && txnTag !== '' && txnTag !== user.id) {
      return json({ error: 'Subscription belongs to another account' }, 409)
    }
    if (!txn?.subscription_id) return json({ error: 'Subscription not yet created, webhook will handle it' }, 202)
    const sub = await deps.paddle.getSubscription(txn.subscription_id)
    if (sub?.status !== 'active' && sub?.status !== 'trialing') return json({ error: `Subscription is ${sub?.status}` }, 402)
    // Ruling P: a subscription for another product on the shared Paddle account cannot unlock AR mode.
    if (priceVerdict(deps, sub) !== 'allowed') {
      warnPrices('refused', deps, 'verify', sub)
      return json({ error: 'Subscription is not a Rating Watch plan' }, 409)
    }
    // Ruling M: a subscription already bound to, or tagged for, another account cannot be claimed here.
    const owner = deps.db.findBySubscriptionId(sub.id)
    const taggedFor = sub.custom_data?.userId
    if ((owner && owner.id !== user.id) || (typeof taggedFor === 'string' && taggedFor !== '' && taggedFor !== user.id)) {
      return json({ error: 'Subscription belongs to another account' }, 409)
    }
    // SEC-1: the Paddle account is shared and Paddle reuses one customer per email, so a customer id on the
    // subscription is not proof that the customer is this user. Store it (and so open the billing portal) only when
    // the Paddle customer's email is the signed-in user's Google-verified email; otherwise refuse without writing.
    if (sub.customer_id && !(await customerMatchesUser(deps, sub.customer_id, user))) {
      return json({ error: 'Paddle customer does not match this account' }, 409)
    }
    const saved = deps.db.save({
      ...user,
      subscription_status: 'active',
      subscription_plan: planFromSubscription(sub),
      subscription_end_date: sub.current_billing_period?.ends_at ?? sub.next_billed_at ?? user.subscription_end_date,
      paddle_subscription_id: sub.id,
      paddle_customer_id: sub.customer_id ?? user.paddle_customer_id,
    })
    return json({ user: toPublicUser(saved, deps.now()) })
  } catch (err) {
    console.error('paddle verify failed:', (err as Error).message)
    return json({ error: 'Failed to verify subscription with Paddle' }, 502)
  }
}

export async function handlePortalSession(req: Request, deps: Deps): Promise<Response> {
  const userId = readSessionUserId(req)
  const user = userId ? deps.db.get(userId) : null
  if (!user) return json({ error: 'Unauthorized' }, 401)
  if (!user.paddle_customer_id) return json({ error: 'No billing account on record' }, 400)
  if (!deps.paddle) return json({ error: 'Billing is not configured' }, 503)
  try {
    // SEC-1/SEC-10: a customer id can also arrive through a webhook match, so the portal re-proves ownership
    // before opening anything: the Paddle customer's email must be this user's verified email.
    if (!(await customerMatchesUser(deps, user.paddle_customer_id, user))) {
      return json({ error: 'Paddle customer does not match this account' }, 409)
    }
    const subs = user.paddle_subscription_id ? [user.paddle_subscription_id] : undefined
    return json({ url: await deps.paddle.createPortalSession(user.paddle_customer_id, subs) })
  } catch (err) {
    console.error('paddle portal failed:', (err as Error).message)
    return json({ error: 'Failed to create portal session' }, 502)
  }
}
