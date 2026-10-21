import { toPublicUser } from './access'
import type { Deps } from './deps'
import { readCappedText } from '../body-limit'
import { applyEvent, eventTarget, planFromSubscription, verifyWebhookSignature, type PaddleEvent } from './paddle'
import { eventPriceIds } from './prices'
import { createLimiter, type BucketConfig, type Limiter } from '../ratings-guard'
import { readSessionUserId } from './session'
import type { UserRecord } from './types'

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

type FoundVia = 'subscription' | 'customer' | 'userId'

// Lookup order matters: custom_data.userId is set by the buyer (checkout custom data), so it is
// consulted only after Paddle's own subscription and customer ids and cannot redirect an event
// that Paddle ids already resolve to the real owner. There is no email fallback: Paddle does not verify
// the checkout email, so matching on it would let a stranger attach a subscription to someone else's account.
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
  return byUserId ? { user: byUserId, via: 'userId' } : null
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

// Adjustments (refunds, chargebacks) carry item ids, not price ids, so the price filter cannot apply to them:
// like events without items they count only through a subscription already bound to a user.
const isAdjustment = (e: PaddleEvent): boolean => e.event_type.startsWith('adjustment.')

// Ordering: Paddle does not guarantee delivery order. An event older than the newest one already applied to
// this user is dropped (an unparsable occurred_at carries no ordering information and is applied as before).
const eventTime = (e: PaddleEvent): number => Date.parse(e.occurred_at ?? '')
function isStale(user: UserRecord, e: PaddleEvent): boolean {
  const last = Date.parse(user.last_event_at ?? '')
  const at = eventTime(e)
  return Number.isFinite(last) && Number.isFinite(at) && at < last
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
  const prices = isAdjustment(event) ? 'no_items' : priceVerdict(deps, event.data)
  if (deps.priceIds.length === 0 || prices === 'foreign') {
    // fail closed: no allow-list, or another product's price => no writes
    warnPrices('ignored', deps, event.event_type, event.data)
    return json({ received: true })
  }
  try {
    const found = findUser(deps, event)
    if (!found) return json({ received: true }) // unknown user: ignored safely
    // Ruling T: Paddle keeps one customer per email across the shared account, so without items (and for
    // adjustments) only the subscription id proves the event is about a Rating Watch subscription.
    if (prices === 'no_items' && found.via !== 'subscription') return json({ received: true })
    // A userId comes from the buyer, so it binds a subscription only when the Paddle customer behind the event
    // has the account's Google-verified email. Without a Paddle API, or on a mismatch, the event is ignored.
    // A Paddle outage here throws, answers 500 and lets Paddle retry.
    if (found.via === 'userId') {
      const customerId = str(eventTarget(event).customerId)
      if (!customerId || !(await customerMatchesUser(deps, customerId, found.user))) return json({ received: true })
    }
    if (isStale(found.user, event)) return json({ received: true })
    const patch = applyEvent(found.user, event)
    if (patch) {
      const at = eventTime(event)
      deps.db.save({ ...found.user, ...patch, last_event_at: Number.isFinite(at) ? event.occurred_at! : found.user.last_event_at ?? null })
    }
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

// Each verify call costs up to three requests on the shared Paddle API. Sign-up is free, so any account could
// otherwise exhaust the API quota that checkout and the portal depend on: one bucket per user, one for everybody.
// A real checkout needs one call (a few at most when Paddle is slow to create the subscription).
export const VERIFY_USER_BUCKET: BucketConfig = { capacity: 5, refillPerSec: 1 / 30 } // 5 burst, then 2 per minute
export const VERIFY_GLOBAL_BUCKET: BucketConfig = { capacity: 30, refillPerSec: 0.25 } // 30 burst, then 15 per minute
let verifyUserLimiter: Limiter = createLimiter(VERIFY_USER_BUCKET)
let verifyGlobalLimiter: Limiter = createLimiter(VERIFY_GLOBAL_BUCKET, 1)
export function resetVerifyLimitersForTests(): void {
  verifyUserLimiter = createLimiter(VERIFY_USER_BUCKET)
  verifyGlobalLimiter = createLimiter(VERIFY_GLOBAL_BUCKET, 1)
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
  // Taken only once the request is well formed and about to call Paddle; the user bucket first, so a refused user never spends a global token.
  const limited = verifyUserLimiter.take(user.id, deps.now())
  const limit = limited.allowed ? verifyGlobalLimiter.take('*', deps.now()) : limited
  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': String(limit.retryAfterS) },
    })
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
