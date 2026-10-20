# Rating Watch: rename + accounts + Paddle subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the product to Rating Watch (rating.watch) and add Google sign-in plus Paddle subscriptions ($2.99/month, $29/year, 3-day no-card trial) that gate only the AR camera page.

**Architecture:** Pure, unit-tested modules under `lib/billing/` (access rules, SQLite user store, JWT session, Paddle signature/event logic, Paddle API client, Google OAuth adapter) are wrapped by thin Next.js route handlers in `app/api/`. All handler logic lives in `lib/billing/*-handlers.ts` and takes injected dependencies, so tests never touch a network, a real Paddle account or a real database file. The UI is a static `/pricing` page, a dynamic noindex `/account` page and a client-side `ArGate` around `/camera-vision/ar`. The rename is a mechanical, reviewed replacement protected by a guard test.

**Tech Stack:** Next.js 14.2 App Router, TypeScript, Jest (node env, `*.test.ts` only), `better-sqlite3`, `jsonwebtoken`, `google-auth-library`, `@paddle/paddle-js`.

**Spec:** `docs/superpowers/specs/2026-10-20-rating-watch-billing-design.md` (approved by the owner 2026-10-20).

## Global Constraints

- Node 20 in CI (`.github/workflows/ci.yml`: `npm ci`, `npx tsc --noEmit`, `npx jest`, `npx next build`, `npm run seo:validate`); all five must pass at the end.
- Jest only matches `tests/**/*.test.ts` in the **node** environment: no React component tests, no `.test.tsx`. Keep logic in `.ts` modules and keep `.tsx` files thin.
- New npm dependencies are limited to: `better-sqlite3`, `jsonwebtoken`, `google-auth-library`, `@paddle/paddle-js` (+ `@types/better-sqlite3`, `@types/jsonwebtoken` as devDependencies). Nothing else.
- Prices (already created in the owner's live Paddle account, read from env): monthly `pri_01m5ctdp1xcbfsbq73yg2dgax8` = $2.99, yearly `pri_01m5ctfqx7bdteged1kzaynn6h` = $29.00. Env var names: `NEXT_PUBLIC_PADDLE_ENV`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY`, `NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_ENV`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET` (32+ chars), `APP_URL`, `DATA_DIR`, `USERS_DB_PATH`.
- Next.js inlines only literal `process.env.NEXT_PUBLIC_X` reads. Never write `process.env[name]` for `NEXT_PUBLIC_*` variables.
- Secrets are read lazily inside functions, never at module top level: `next build` runs without them and must not throw.
- **Never call the real Paddle or Google APIs in tests.** The Paddle account is the owner's LIVE account shared with another product. All network access goes through an injected `fetch`/adapter. Never print, log or write any key, secret or token into a file.
- Do not edit `.env.local` or `.env*` files; the owner manages env values.
- Copy rules enforced by `tests/design-guards.test.ts` and `tests/no-emoji-content.test.ts`: no emoji, no em dash, no arrows or special glyphs in page copy; no hard-coded hex colours in CSS (use `var(--paper)`, `var(--ink)`, `var(--gold)` etc. tokens); `#fff` is rejected.
- Brand: product **Rating Watch**, domain **rating.watch**, extension **Rating Watch: IMDb & Rotten Tomatoes for Netflix**. The phrase "ratings on Netflix" in plain description stays; only the proper name "Netflix Ratings" changes.
- Support email constant `SUPPORT_EMAIL = 'hello@rating.watch'` (the owner must create this mailbox; flagged in the final report).
- **No `git commit` / `git push` without the owner's explicit approval** (owner rule, overrides every "Commit" instruction in this plan). Each task ends at a **Checkpoint** (tests green, changes left uncommitted). The single commit happens only in Task 10 after the owner says yes.

## Deviations from the spec (call out to the owner at review)

1. **AR gate is client-side, not a server-side layout check.** `seo:validate` requires every page in `lib/pages.ts` to be prerendered HTML, and a layout reading cookies would make `/camera-vision/ar` dynamic. The camera analysis runs entirely in the browser, so a server check would protect nothing real. The gate is a client component that asks `/api/user/me`.
2. **Webhook hardening beyond Name Habitat:** reject timestamps older than 5 minutes (already in spec); accept several `h1` values (secret rotation); user lookup order is subscription id, then Paddle customer id, then `custom_data.userId`, then email (`custom_data.userId` is buyer-controlled, so Paddle's own ids win); an event found only via `custom_data.userId` or email can only activate, never cancel, pause or expire; events are bound to the user's current subscription (an event for another subscription id does not change that user); only Rating Watch price ids are accepted (`PADDLE_PRICE_IDS`, because the Paddle account is shared with another product; an empty list accepts nothing); `subscription.updated` honours `data.status` (canceled/paused/past_due) instead of always setting active; `/api/paddle/verify-subscription` returns 409 for a subscription that belongs to another account or to another product.
3. `/account` is **not** in `lib/pages.ts`: it is `force-dynamic` with `noindex`, so it is never prerendered and never appears in the sitemap. `/pricing`, `/terms`, `/refund-policy` are registered normally.

## Review Focus

The spec implies these inputs but no task's happy path exercises them. Each has a pinned test in the owning task.

1. **Open redirect on sign-in:** `/api/auth/google?next=https://evil.example` or `//evil.example` must fall back to `/` (Task 5).
2. **Webhook replay / stale / tampered:** an old-but-validly-signed body (timestamp > 5 min) and a body modified after signing must both get 401 with no DB write (Task 4, Task 6).
3. **Missing env at build/run time:** no `PADDLE_*`, `GOOGLE_*` or `JWT_SECRET` must produce 503 from the affected route and a neutral "subscriptions unavailable" card on the page, never a crash or a config detail shown to customers (Tasks 3, 5, 6, 7).
4. **Email case and unknown customers:** Google emails and Paddle emails differ in case; a webhook for an unknown user returns 200 `{received:true}` (so Paddle stops retrying) and writes nothing (Task 6).
5. **Trial/access edges:** trial ending exactly now, a missing `trial_end_date`, a cancelled user inside the paid period, a `paused` subscription, double checkout click and `checkout.completed` arriving after the webhook already activated the user (idempotent) (Tasks 1, 4, 6, 7).

## Parallel execution map (for the controller)

- **Wave 1 (parallel, disjoint files):** Task 1, Task 2, Task 3, Task 4, Task 8 (rename).
- **Wave 2 (parallel, after Wave 1):** Task 5, Task 6.
- **Wave 3 (after Wave 2 and Task 8):** Task 7 (UI, registry, legal pages, privacy).
- **Wave 4:** Task 9 (docs, dev seed script, extension package), then Task 10 (full verification and the owner-approved commit).
- Tasks 1-4 and 8 touch no common file. Task 7 and Task 8 both edit `lib/pages.ts`, so Task 7 starts only after Task 8 finishes.

## File Structure

```
lib/billing/types.ts            UserRecord, status/plan/access types, PublicUser
lib/billing/access.ts           computeAccessStatus, toPublicUser, TRIAL_DAYS (pure)
lib/billing/db.ts               openUsersDb(file), getUsersDb() singleton (better-sqlite3)
lib/billing/session.ts          JWT sign/verify, cookie parse/format, readSessionUserId(req)
lib/billing/paddle.ts           verifyWebhookSignature, eventTarget, applyEvent, createPaddleApi (injected fetch)
lib/billing/google.ts           GoogleAuth adapter over google-auth-library
lib/billing/handlers.ts         handleWebhook, handleVerifySubscription, handlePortalSession, handleMe, handleSignout
lib/billing/auth-handlers.ts    handleGoogleStart, handleGoogleCallback, safeNextPath
lib/billing/deps.ts             defaultDeps(): lazy env -> Deps wiring used by route files
lib/billing/client.ts           describeSubscription, paddleConfig, plan helpers (pure, used by UI)
app/api/auth/google/route.ts            GET  start OAuth
app/api/auth/callback/route.ts          GET  OAuth callback
app/api/auth/signout/route.ts           POST clear cookie
app/api/user/me/route.ts                GET  { user, access }
app/api/paddle/webhook/route.ts         POST raw-body webhook
app/api/paddle/verify-subscription/route.ts  POST
app/api/paddle/portal-session/route.ts  GET
components/billing/useAccount.ts        client hook over /api/user/me
components/billing/CheckoutButtons.tsx  Paddle.js overlay checkout (client)
components/billing/ArGate.tsx           client gate for the AR page
components/billing/billing.module.css   styles (design tokens only)
app/pricing/page.tsx                    static, metadata from registry
app/account/page.tsx (+AccountClient.tsx)  dynamic, noindex
app/terms/page.tsx, app/refund-policy/page.tsx
app/camera-vision/ar/layout.tsx         wraps children in <ArGate>
scripts/dev-seed-user.mjs               dev-only user/session minting (refuses in production)
tests/rename-guard.test.ts, tests/billing/*.test.ts
```

---

### Task 1: Billing types and access rules

**Files:**
- Create: `lib/billing/types.ts`, `lib/billing/access.ts`
- Test: `tests/billing/access.test.ts`

**Interfaces:**
- Produces: `UserRecord`, `SubscriptionStatus`, `SubscriptionPlan`, `AccessStatus`, `PublicUser`, `TRIAL_DAYS`, `computeAccessStatus(user, now?)`, `toPublicUser(user, now?)`.

- [ ] **Step 1: Write the failing test** `tests/billing/access.test.ts`

```ts
import { computeAccessStatus, toPublicUser, TRIAL_DAYS } from '../../lib/billing/access'
import type { UserRecord } from '../../lib/billing/types'

const NOW = Date.parse('2026-10-20T12:00:00Z')
const iso = (ms: number) => new Date(ms).toISOString()

function user(over: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'g1', email: 'a@b.co', name: 'A', avatar: null,
    trial_end_date: iso(NOW + 86_400_000), subscription_status: 'trial', subscription_plan: null,
    subscription_end_date: null, paddle_subscription_id: null, paddle_customer_id: null,
    created_at: iso(NOW - 86_400_000), ...over,
  }
}

describe('computeAccessStatus', () => {
  it('is trial_active inside the trial window', () => {
    expect(computeAccessStatus(user(), NOW)).toBe('trial_active')
  })
  it('is paywall when the trial ended, including exactly now', () => {
    expect(computeAccessStatus(user({ trial_end_date: iso(NOW) }), NOW)).toBe('paywall')
    expect(computeAccessStatus(user({ trial_end_date: iso(NOW - 1) }), NOW)).toBe('paywall')
  })
  it('is paywall when trial_end_date is missing or not a date', () => {
    expect(computeAccessStatus(user({ trial_end_date: '' }), NOW)).toBe('paywall')
    expect(computeAccessStatus(user({ trial_end_date: 'nonsense' }), NOW)).toBe('paywall')
  })
  it('active and paused are subscribed whatever the dates say', () => {
    expect(computeAccessStatus(user({ subscription_status: 'active', trial_end_date: iso(NOW - 9e9), subscription_end_date: iso(NOW - 9e9) }), NOW)).toBe('subscribed')
    expect(computeAccessStatus(user({ subscription_status: 'paused' }), NOW)).toBe('subscribed')
  })
  it('cancelled and expired never fall back to the trial', () => {
    expect(computeAccessStatus(user({ subscription_status: 'cancelled' }), NOW)).toBe('paywall')
    expect(computeAccessStatus(user({ subscription_status: 'expired' }), NOW)).toBe('paywall')
  })
})

describe('toPublicUser', () => {
  it('exposes display + billing state but not Paddle ids, and says whether a portal exists', () => {
    const p = toPublicUser(user({ subscription_status: 'active', subscription_plan: 'yearly', paddle_customer_id: 'ctm_1', paddle_subscription_id: 'sub_1' }), NOW)
    expect(p).toMatchObject({ id: 'g1', email: 'a@b.co', access: 'subscribed', subscription_plan: 'yearly', has_billing_portal: true })
    expect(JSON.stringify(p)).not.toMatch(/ctm_1|sub_1/)
  })
  it('has_billing_portal is false without a Paddle customer', () => {
    expect(toPublicUser(user(), NOW).has_billing_portal).toBe(false)
  })
})

it('trial length is 3 days (same as Name Habitat)', () => expect(TRIAL_DAYS).toBe(3))
```

- [ ] **Step 2: Run to verify it fails:** `npx jest tests/billing/access.test.ts` → FAIL "Cannot find module '../../lib/billing/access'".

- [ ] **Step 3: Implement** `lib/billing/types.ts`

```ts
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
```

`lib/billing/access.ts`

```ts
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
```

- [ ] **Step 4: Run to verify it passes:** `npx jest tests/billing/access.test.ts` → PASS (mutation check: change `>` to `>=` on the trial comparison and confirm the "exactly now" test fails, then revert).
- [ ] **Step 5: Checkpoint:** `npx tsc --noEmit` clean; leave uncommitted.

---

### Task 2: SQLite user store

**Files:**
- Create: `lib/billing/db.ts`
- Modify: `package.json` (deps), `next.config.js` (external package)
- Test: `tests/billing/db.test.ts`

**Interfaces:**
- Consumes: `UserRecord` (Task 1).
- Produces:
  ```ts
  export interface UsersDb {
    get(id: string): UserRecord | null              // lazily flips an expired trial to 'expired'
    findByEmail(email: string): UserRecord | null   // case-insensitive
    findBySubscriptionId(id: string): UserRecord | null
    findByCustomerId(id: string): UserRecord | null
    save(user: UserRecord): UserRecord
    close(): void
  }
  export function openUsersDb(file: string, now?: () => number): UsersDb  // ':memory:' supported
  export function getUsersDb(): UsersDb                                   // singleton at USERS_DB_PATH or ${DATA_DIR||'.data'}/users.db
  export function resetUsersDbForTests(): void
  ```

- [ ] **Step 1:** `npm install better-sqlite3 && npm install -D @types/better-sqlite3`. In `next.config.js` add to `nextConfig`: `experimental: { serverComponentsExternalPackages: ['better-sqlite3'] },`.
- [ ] **Step 2: Write the failing test** `tests/billing/db.test.ts`

```ts
import { openUsersDb } from '../../lib/billing/db'
import type { UserRecord } from '../../lib/billing/types'

const NOW = Date.parse('2026-10-20T12:00:00Z')
const base = (over: Partial<UserRecord> = {}): UserRecord => ({
  id: 'g1', email: 'Igor@Example.com', name: 'I', avatar: null,
  trial_end_date: new Date(NOW + 1000).toISOString(), subscription_status: 'trial', subscription_plan: null,
  subscription_end_date: null, paddle_subscription_id: null, paddle_customer_id: null,
  created_at: new Date(NOW).toISOString(), ...over,
})

describe('users db', () => {
  it('round-trips a user and updates in place', () => {
    const db = openUsersDb(':memory:', () => NOW)
    db.save(base())
    db.save(base({ name: 'New' }))
    expect(db.get('g1')?.name).toBe('New')
  })
  it('finds by email case-insensitively, by subscription id and by customer id', () => {
    const db = openUsersDb(':memory:', () => NOW)
    db.save(base({ paddle_subscription_id: 'sub_1', paddle_customer_id: 'ctm_1' }))
    expect(db.findByEmail('igor@example.COM')?.id).toBe('g1')
    expect(db.findBySubscriptionId('sub_1')?.id).toBe('g1')
    expect(db.findByCustomerId('ctm_1')?.id).toBe('g1')
    expect(db.findByEmail('nobody@x.co')).toBeNull()
  })
  it('flips a lapsed trial to expired on read, and persists it', () => {
    let t = NOW
    const db = openUsersDb(':memory:', () => t)
    db.save(base())
    t = NOW + 5000
    expect(db.get('g1')?.subscription_status).toBe('expired')
    expect(db.get('g1')?.subscription_status).toBe('expired')
  })
  it('does not touch an active subscriber whose trial date is in the past', () => {
    const db = openUsersDb(':memory:', () => NOW + 9e9)
    db.save(base({ subscription_status: 'active' }))
    expect(db.get('g1')?.subscription_status).toBe('active')
  })
  it('returns null for an unknown id', () => {
    expect(openUsersDb(':memory:').get('nope')).toBeNull()
  })
})
```

- [ ] **Step 3:** Run `npx jest tests/billing/db.test.ts` → FAIL (module missing).
- [ ] **Step 4: Implement** `lib/billing/db.ts`

```ts
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import type { UserRecord } from './types'

export interface UsersDb {
  get(id: string): UserRecord | null
  findByEmail(email: string): UserRecord | null
  findBySubscriptionId(id: string): UserRecord | null
  findByCustomerId(id: string): UserRecord | null
  save(user: UserRecord): UserRecord
  close(): void
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    avatar TEXT,
    trial_end_date TEXT NOT NULL,
    subscription_status TEXT NOT NULL DEFAULT 'trial',
    subscription_plan TEXT,
    subscription_end_date TEXT,
    paddle_subscription_id TEXT,
    paddle_customer_id TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS users_email ON users (lower(email));
  CREATE INDEX IF NOT EXISTS users_sub ON users (paddle_subscription_id);
  CREATE INDEX IF NOT EXISTS users_customer ON users (paddle_customer_id);
`

export function openUsersDb(file: string, now: () => number = Date.now): UsersDb {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new Database(file)
  if (file !== ':memory:') db.pragma('journal_mode = WAL')
  db.exec(SCHEMA)

  const byId = db.prepare('SELECT * FROM users WHERE id = ?')
  const byEmail = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1')
  const bySub = db.prepare('SELECT * FROM users WHERE paddle_subscription_id = ? LIMIT 1')
  const byCustomer = db.prepare('SELECT * FROM users WHERE paddle_customer_id = ? LIMIT 1')
  const upsert = db.prepare(`
    INSERT INTO users (id, email, name, avatar, trial_end_date, subscription_status, subscription_plan,
      subscription_end_date, paddle_subscription_id, paddle_customer_id, created_at)
    VALUES (@id, @email, @name, @avatar, @trial_end_date, @subscription_status, @subscription_plan,
      @subscription_end_date, @paddle_subscription_id, @paddle_customer_id, @created_at)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email, name = excluded.name, avatar = excluded.avatar,
      trial_end_date = excluded.trial_end_date, subscription_status = excluded.subscription_status,
      subscription_plan = excluded.subscription_plan, subscription_end_date = excluded.subscription_end_date,
      paddle_subscription_id = excluded.paddle_subscription_id, paddle_customer_id = excluded.paddle_customer_id
  `)

  const save = (u: UserRecord): UserRecord => {
    upsert.run(u)
    return byId.get(u.id) as UserRecord
  }
  const get = (id: string): UserRecord | null => {
    const u = (byId.get(id) as UserRecord | undefined) ?? null
    if (u && u.subscription_status === 'trial' && Date.parse(u.trial_end_date) <= now()) {
      return save({ ...u, subscription_status: 'expired' })
    }
    return u
  }
  return {
    get,
    findByEmail: (e) => (byEmail.get(e) as UserRecord | undefined) ?? null,
    findBySubscriptionId: (s) => (bySub.get(s) as UserRecord | undefined) ?? null,
    findByCustomerId: (c) => (byCustomer.get(c) as UserRecord | undefined) ?? null,
    save,
    close: () => db.close(),
  }
}

let shared: UsersDb | null = null
export function getUsersDb(): UsersDb {
  if (!shared) {
    shared = openUsersDb(process.env.USERS_DB_PATH ?? path.join(process.env.DATA_DIR ?? '.data', 'users.db'))
  }
  return shared
}
export function resetUsersDbForTests(): void {
  shared?.close()
  shared = null
}
```

- [ ] **Step 5:** `npx jest tests/billing/db.test.ts` → PASS. Mutation check: remove the expiry branch in `get` and confirm the lapsed-trial test fails.
- [ ] **Step 6: Checkpoint:** `npx tsc --noEmit`; `npx next build` still succeeds (native module resolves); changes uncommitted.

---

### Task 3: Session (JWT + cookies)

**Files:**
- Create: `lib/billing/session.ts`
- Modify: `package.json` (deps)
- Test: `tests/billing/session.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const SESSION_COOKIE = 'rw_session'
  export const SESSION_MAX_AGE_S: number            // 14 days
  export function signSession(userId: string): string
  export function verifySession(token: string): string | null     // userId or null
  export function parseCookies(header: string | null): Record<string, string>
  export function readSessionUserId(req: Request): string | null
  export function setCookie(name: string, value: string, opts: { secure: boolean; maxAgeS: number }): string
  export function clearCookie(name: string, secure: boolean): string
  ```

- [ ] **Step 1:** `npm install jsonwebtoken && npm install -D @types/jsonwebtoken`.
- [ ] **Step 2: Write the failing test** `tests/billing/session.test.ts`

```ts
import jwt from 'jsonwebtoken'
import { clearCookie, parseCookies, readSessionUserId, SESSION_COOKIE, setCookie, signSession, verifySession } from '../../lib/billing/session'

const SECRET = 'x'.repeat(40)
beforeEach(() => { process.env.JWT_SECRET = SECRET })
afterAll(() => { delete process.env.JWT_SECRET })

describe('session tokens', () => {
  it('round-trips a user id', () => expect(verifySession(signSession('g1'))).toBe('g1'))
  it('rejects a token signed with another secret, a tampered token and garbage', () => {
    const forged = jwt.sign({ sub: 'g1' }, 'y'.repeat(40), { algorithm: 'HS256' })
    expect(verifySession(forged)).toBeNull()
    expect(verifySession(signSession('g1') + 'x')).toBeNull()
    expect(verifySession('not-a-jwt')).toBeNull()
  })
  it('rejects alg=none tokens', () => {
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"g1"}').toString('base64url')}.`
    expect(verifySession(none)).toBeNull()
  })
  it('rejects an expired token', () => {
    const old = jwt.sign({ sub: 'g1' }, SECRET, { algorithm: 'HS256', expiresIn: -10 })
    expect(verifySession(old)).toBeNull()
  })
  it('throws a clear error when JWT_SECRET is missing or short (only when used)', () => {
    process.env.JWT_SECRET = 'short'
    expect(() => signSession('g1')).toThrow(/JWT_SECRET/)
    delete process.env.JWT_SECRET
    expect(verifySession('anything')).toBeNull() // reading must not crash a request when unconfigured
  })
})

describe('cookies', () => {
  it('parses a Cookie header including values with =', () => {
    expect(parseCookies('a=1; rw_session=abc.def==; b=x y')).toEqual({ a: '1', rw_session: 'abc.def==', b: 'x y' })
    expect(parseCookies(null)).toEqual({})
  })
  it('reads the user id from a request cookie, null without one', () => {
    const token = signSession('g9')
    expect(readSessionUserId(new Request('http://x', { headers: { cookie: `${SESSION_COOKIE}=${token}` } }))).toBe('g9')
    expect(readSessionUserId(new Request('http://x'))).toBeNull()
  })
  it('formats secure, HttpOnly, SameSite=Lax cookies and a clearing cookie', () => {
    expect(setCookie('n', 'v', { secure: true, maxAgeS: 60 })).toBe('n=v; Path=/; Max-Age=60; HttpOnly; SameSite=Lax; Secure')
    expect(setCookie('n', 'v', { secure: false, maxAgeS: 60 })).not.toMatch(/Secure/)
    expect(clearCookie('n', true)).toMatch(/^n=; Path=\/; Max-Age=0; HttpOnly; SameSite=Lax; Secure$/)
  })
})
```

- [ ] **Step 3:** Run → FAIL (module missing).
- [ ] **Step 4: Implement** `lib/billing/session.ts`

```ts
import jwt from 'jsonwebtoken'

export const SESSION_COOKIE = 'rw_session'
export const SESSION_MAX_AGE_S = 14 * 24 * 60 * 60

function secret(): string {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 32) throw new Error('JWT_SECRET must be set to a random string of 32+ characters')
  return s
}

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId }, secret(), { algorithm: 'HS256', expiresIn: SESSION_MAX_AGE_S })
}

// An unconfigured server must answer "signed out", not crash every request.
export function verifySession(token: string): string | null {
  try {
    const payload = jwt.verify(token, secret(), { algorithms: ['HS256'] })
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim()
  }
  return out
}

export function readSessionUserId(req: Request): string | null {
  const token = parseCookies(req.headers.get('cookie'))[SESSION_COOKIE]
  return token ? verifySession(token) : null
}

export function setCookie(name: string, value: string, opts: { secure: boolean; maxAgeS: number }): string {
  return `${name}=${value}; Path=/; Max-Age=${opts.maxAgeS}; HttpOnly; SameSite=Lax${opts.secure ? '; Secure' : ''}`
}

export function clearCookie(name: string, secure: boolean): string {
  return setCookie(name, '', { secure, maxAgeS: 0 })
}
```

- [ ] **Step 5:** `npx jest tests/billing/session.test.ts` → PASS. Mutation check: drop `algorithms: ['HS256']` and confirm the alg=none test fails.
- [ ] **Step 6: Checkpoint:** `npx tsc --noEmit`; uncommitted.

---

### Task 4: Paddle core (signature, events, API client)

**Files:**
- Create: `lib/billing/paddle.ts`
- Test: `tests/billing/paddle.test.ts`

**Interfaces:**
- Consumes: `UserRecord`, `SubscriptionPlan` (Task 1).
- Produces:
  ```ts
  export function verifyWebhookSignature(rawBody: string, header: string | null, secret: string | undefined, nowMs?: number, toleranceS?: number): boolean
  export interface PaddleEvent { event_type: string; data: any }
  export interface EventTarget { userId?: string; subscriptionId?: string; customerId?: string; email?: string }
  export function eventTarget(e: PaddleEvent): EventTarget
  export function applyEvent(user: UserRecord, e: PaddleEvent): Partial<UserRecord> | null
  export interface PaddleApi {
    getTransaction(id: string): Promise<any>
    getSubscription(id: string): Promise<any>
    createPortalSession(customerId: string, subscriptionIds?: string[]): Promise<string>  // URL
  }
  export class PaddleHttpError extends Error { status: number }
  export function createPaddleApi(opts: { apiKey?: string; env?: string; fetch?: typeof fetch }): PaddleApi | null  // null when no apiKey
  export function planFromSubscription(data: any): SubscriptionPlan
  ```

- [ ] **Step 1: Write the failing test** `tests/billing/paddle.test.ts`

```ts
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
    expect(applyEvent(user({ subscription_status: 'active' }), { event_type: 'transaction.payment_failed', data: { subscription_id: 'sub_1' } })).toEqual({ subscription_status: 'expired' })
  })
  it('ignores event types it does not know', () => {
    expect(applyEvent(user(), { event_type: 'customer.updated', data: {} })).toBeNull()
  })
  it('yearly plans map from billing_cycle.interval', () => {
    expect(applyEvent(user(), { event_type: 'subscription.created', data: sub({ items: [{ price: { billing_cycle: { interval: 'year' } } }] }) })?.subscription_plan).toBe('yearly')
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
    await expect(createPaddleApi({ apiKey: 'k', fetch: bad as any })!.getTransaction('t')).rejects.toBeInstanceOf(PaddleHttpError)
    const none = jest.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 201 }))
    await expect(createPaddleApi({ apiKey: 'k', fetch: none as any })!.createPortalSession('c')).rejects.toThrow(/portal/i)
  })
})
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** `lib/billing/paddle.ts`

```ts
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
  switch (e.event_type) {
    case 'subscription.created':
    case 'subscription.activated':
    case 'subscription.updated':
    case 'subscription.resumed': {
      if (d.status === 'canceled') return { subscription_status: 'cancelled' }
      if (d.status === 'paused') return { subscription_status: 'paused' }
      if (d.status === 'past_due') return null // dunning: access unchanged until payment_failed or canceled
      return {
        subscription_status: 'active',
        subscription_plan: planFromSubscription(d),
        subscription_end_date: periodEnd(d) ?? user.subscription_end_date,
        paddle_subscription_id: d.id ?? user.paddle_subscription_id,
        paddle_customer_id: d.customer_id ?? user.paddle_customer_id,
      }
    }
    case 'subscription.paused':
      return { subscription_status: 'paused' } // keep subscription_end_date: access holds until period end
    case 'subscription.canceled':
      return { subscription_status: 'cancelled' }
    case 'transaction.payment_failed':
      return { subscription_status: 'expired' }
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
    getTransaction: (id) => call(`/transactions/${id}`, 'transaction lookup'),
    getSubscription: (id) => call(`/subscriptions/${id}`, 'subscription lookup'),
    async createPortalSession(customerId, subscriptionIds) {
      const data = await call(`/customers/${customerId}/portal-sessions`, 'portal session', {
        method: 'POST',
        body: JSON.stringify(subscriptionIds?.length ? { subscription_ids: subscriptionIds } : {}),
      })
      const url = data?.urls?.general?.overview
      if (!url) throw new Error('No portal URL in Paddle response')
      return url
    },
  }
}
```

- [ ] **Step 4:** `npx jest tests/billing/paddle.test.ts` → PASS. Mutation checks: remove the tolerance check (replay test must fail); change `status === 'canceled'` branch order (updated/canceled test must fail).
- [ ] **Step 5: Checkpoint:** `npx tsc --noEmit`; uncommitted.

---

### Task 5: Google sign-in and session routes

**Files:**
- Create: `lib/billing/google.ts`, `lib/billing/auth-handlers.ts`, `lib/billing/deps.ts`, `app/api/auth/google/route.ts`, `app/api/auth/callback/route.ts`, `app/api/auth/signout/route.ts`, `app/api/user/me/route.ts`
- Modify: `package.json` (dep `google-auth-library`)
- Test: `tests/billing/auth-handlers.test.ts`

**Interfaces:**
- Consumes: `UsersDb` (Task 2), `signSession/readSessionUserId/setCookie/clearCookie/parseCookies/SESSION_COOKIE/SESSION_MAX_AGE_S` (Task 3), `toPublicUser`, `TRIAL_DAYS` (Task 1).
- Produces:
  ```ts
  // lib/billing/google.ts
  export interface GoogleProfile { sub: string; email: string | null; name: string | null; picture: string | null }
  export interface GoogleAuth { authUrl(state: string): string; exchange(code: string): Promise<GoogleProfile> }
  export function createGoogleAuth(cfg: { clientId: string; clientSecret: string; redirectUri: string }): GoogleAuth
  // lib/billing/deps.ts
  export interface Deps { db: UsersDb; paddle: PaddleApi | null; webhookSecret?: string; google: GoogleAuth | null; appUrl: string; now(): number }
  export function defaultDeps(): Deps   // reads env lazily on call
  // lib/billing/auth-handlers.ts
  export function safeNextPath(next: string | null): string      // '/' unless a single-slash relative path
  export function handleGoogleStart(req: Request, deps: Deps): Response
  export function handleGoogleCallback(req: Request, deps: Deps): Promise<Response>
  export function handleSignout(req: Request, deps: Deps): Response
  export function handleMe(req: Request, deps: Deps): Response   // { user: PublicUser | null, access }
  ```
  Cookies: `rw_oauth_state` (5 min), `rw_next` (5 min). Error redirects go to `${appUrl}/pricing?auth_error=<code>`.

- [ ] **Step 1:** `npm install google-auth-library`.
- [ ] **Step 2: Write the failing test** `tests/billing/auth-handlers.test.ts`

```ts
import { handleGoogleCallback, handleGoogleStart, handleMe, handleSignout, safeNextPath } from '../../lib/billing/auth-handlers'
import { openUsersDb } from '../../lib/billing/db'
import { parseCookies, SESSION_COOKIE, signSession, verifySession } from '../../lib/billing/session'
import type { Deps } from '../../lib/billing/deps'
import type { GoogleAuth } from '../../lib/billing/google'

const NOW = Date.parse('2026-10-20T12:00:00Z')
beforeEach(() => { process.env.JWT_SECRET = 'k'.repeat(40) })
afterAll(() => { delete process.env.JWT_SECRET })

function deps(over: Partial<Deps> = {}): Deps {
  const google: GoogleAuth = {
    authUrl: (state) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
    exchange: async (code) => {
      if (code === 'bad') throw new Error('invalid_grant')
      return { sub: 'g1', email: 'Igor@Example.com', name: 'Igor', picture: 'https://p/x.png' }
    },
  }
  return { db: openUsersDb(':memory:', () => NOW), paddle: null, google, appUrl: 'https://rating.watch', now: () => NOW, ...over }
}
const setCookies = (r: Response) => r.headers.getSetCookie()
const cookieValue = (r: Response, name: string) => {
  const line = setCookies(r).find((c) => c.startsWith(`${name}=`))
  return line ? line.split(';')[0].slice(name.length + 1) : undefined
}

describe('safeNextPath (open redirect guard)', () => {
  it('allows single-slash relative paths only', () => {
    expect(safeNextPath('/camera-vision/ar')).toBe('/camera-vision/ar')
    expect(safeNextPath('/pricing?x=1')).toBe('/pricing?x=1')
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '', null, 'camera-vision']) {
      expect(safeNextPath(bad as any)).toBe('/')
    }
  })
})

describe('handleGoogleStart', () => {
  it('redirects to Google with a state cookie that matches, and remembers a safe next', () => {
    const r = handleGoogleStart(new Request('https://rating.watch/api/auth/google?next=/camera-vision/ar'), deps())
    expect(r.status).toBe(302)
    const state = cookieValue(r, 'rw_oauth_state')!
    expect(r.headers.get('location')).toContain(`state=${state}`)
    expect(cookieValue(r, 'rw_next')).toBe(encodeURIComponent('/camera-vision/ar'))
  })
  it('stores / instead of an unsafe next', () => {
    const r = handleGoogleStart(new Request('https://rating.watch/api/auth/google?next=//evil.example'), deps())
    expect(decodeURIComponent(cookieValue(r, 'rw_next')!)).toBe('/')
  })
  it('sends the visitor to /pricing with an error when Google is not configured', () => {
    const r = handleGoogleStart(new Request('https://rating.watch/api/auth/google'), deps({ google: null }))
    expect(r.headers.get('location')).toBe('https://rating.watch/pricing?auth_error=not_configured')
  })
})

describe('handleGoogleCallback', () => {
  const req = (qs: string, cookie = 'rw_oauth_state=s1; rw_next=%2Fcamera-vision%2Far') =>
    new Request(`https://rating.watch/api/auth/callback?${qs}`, { headers: { cookie } })

  it('creates a user with a 3-day trial, sets the session cookie and returns to next', async () => {
    const d = deps()
    const r = await handleGoogleCallback(req('code=ok&state=s1'), d)
    expect(r.headers.get('location')).toBe('https://rating.watch/camera-vision/ar')
    const user = d.db.get('g1')!
    expect(user.subscription_status).toBe('trial')
    expect(Date.parse(user.trial_end_date)).toBe(NOW + 3 * 86_400_000)
    expect(verifySession(cookieValue(r, SESSION_COOKIE)!)).toBe('g1')
    expect(setCookies(r).find((c) => c.startsWith(`${SESSION_COOKIE}=`))).toMatch(/HttpOnly.*SameSite=Lax.*Secure/)
  })
  it('does not reset the trial or subscription of an existing user, but refreshes profile fields', async () => {
    const d = deps()
    d.db.save({ id: 'g1', email: 'old@x.co', name: 'Old', avatar: null, trial_end_date: new Date(NOW - 1000).toISOString(), subscription_status: 'active', subscription_plan: 'yearly', subscription_end_date: null, paddle_subscription_id: 'sub_1', paddle_customer_id: 'ctm_1', created_at: new Date(NOW - 9e9).toISOString() })
    await handleGoogleCallback(req('code=ok&state=s1'), d)
    const u = d.db.get('g1')!
    expect(u).toMatchObject({ subscription_status: 'active', paddle_customer_id: 'ctm_1', name: 'Igor' })
  })
  it('rejects a state mismatch or a missing state cookie without creating a user', async () => {
    const d = deps()
    for (const r of [await handleGoogleCallback(req('code=ok&state=WRONG'), d), await handleGoogleCallback(req('code=ok&state=s1', ''), d)]) {
      expect(r.headers.get('location')).toBe('https://rating.watch/pricing?auth_error=state_mismatch')
      expect(cookieValue(r, SESSION_COOKIE)).toBeUndefined()
    }
    expect(d.db.get('g1')).toBeNull()
  })
  it('turns consent denial, a missing code and a failed exchange into error redirects, never a 500', async () => {
    const d = deps()
    expect((await handleGoogleCallback(req('error=access_denied&state=s1'), d)).headers.get('location')).toBe('https://rating.watch/pricing?auth_error=access_denied')
    expect((await handleGoogleCallback(req('state=s1'), d)).headers.get('location')).toBe('https://rating.watch/pricing?auth_error=no_code')
    expect((await handleGoogleCallback(req('code=bad&state=s1'), d)).headers.get('location')).toBe('https://rating.watch/pricing?auth_error=callback_failed')
  })
  it('ignores an unsafe next cookie', async () => {
    const r = await handleGoogleCallback(req('code=ok&state=s1', 'rw_oauth_state=s1; rw_next=%2F%2Fevil.example'), deps())
    expect(r.headers.get('location')).toBe('https://rating.watch/')
  })
})

describe('handleMe / handleSignout', () => {
  it('reports signed out without a session, and the public user with one', async () => {
    const d = deps()
    d.db.save({ id: 'g1', email: 'a@b.co', name: 'A', avatar: null, trial_end_date: new Date(NOW + 1000).toISOString(), subscription_status: 'trial', subscription_plan: null, subscription_end_date: null, paddle_subscription_id: null, paddle_customer_id: null, created_at: new Date(NOW).toISOString() })
    expect(await handleMe(new Request('https://x/api/user/me'), d).json()).toEqual({ user: null, access: 'no_auth' })
    const signedIn = await handleMe(new Request('https://x/api/user/me', { headers: { cookie: `${SESSION_COOKIE}=${signSession('g1')}` } }), d).json()
    expect(signedIn.access).toBe('trial_active')
    expect(signedIn.user.id).toBe('g1')
  })
  it('treats a valid token for a deleted user as signed out', async () => {
    const r = await handleMe(new Request('https://x/api/user/me', { headers: { cookie: `${SESSION_COOKIE}=${signSession('ghost')}` } }), deps()).json()
    expect(r.access).toBe('no_auth')
  })
  it('signout clears the session cookie', () => {
    const r = handleSignout(new Request('https://x/api/auth/signout', { method: 'POST' }), deps())
    expect(setCookies(r)[0]).toMatch(/^rw_session=; Path=\/; Max-Age=0/)
  })
  it('does not crash when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET
    const r = await handleMe(new Request('https://x/api/user/me', { headers: { cookie: `${SESSION_COOKIE}=abc` } }), deps()).json()
    expect(r.access).toBe('no_auth')
  })
})
```

- [ ] **Step 3:** Run → FAIL (modules missing).
- [ ] **Step 4: Implement** `lib/billing/google.ts`

```ts
import { OAuth2Client } from 'google-auth-library'

export interface GoogleProfile { sub: string; email: string | null; name: string | null; picture: string | null }
export interface GoogleAuth {
  authUrl(state: string): string
  exchange(code: string): Promise<GoogleProfile>
}

export function createGoogleAuth(cfg: { clientId: string; clientSecret: string; redirectUri: string }): GoogleAuth {
  const client = new OAuth2Client(cfg.clientId, cfg.clientSecret, cfg.redirectUri)
  return {
    authUrl: (state) => client.generateAuthUrl({ scope: ['openid', 'profile', 'email'], prompt: 'select_account', state }),
    async exchange(code) {
      const { tokens } = await client.getToken(code)
      if (!tokens.id_token) throw new Error('no id_token')
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: cfg.clientId })
      const p = ticket.getPayload()
      if (!p?.sub) throw new Error('no sub')
      // Billing events are matched by email as a fallback, so only a verified address is trusted.
      return { sub: p.sub, email: p.email_verified ? (p.email ?? null) : null, name: p.name ?? null, picture: p.picture ?? null }
    },
  }
}
```

`lib/billing/deps.ts`

```ts
import { getUsersDb, type UsersDb } from './db'
import { createGoogleAuth, type GoogleAuth } from './google'
import { createPaddleApi, type PaddleApi } from './paddle'

export interface Deps {
  db: UsersDb
  paddle: PaddleApi | null
  webhookSecret?: string
  google: GoogleAuth | null
  appUrl: string
  now(): number
}

// Env is read on every call (never at import) so `next build` works without any secrets.
export function defaultDeps(): Deps {
  const appUrl = (process.env.APP_URL ?? 'https://rating.watch').replace(/\/$/, '')
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  return {
    db: getUsersDb(),
    paddle: createPaddleApi({ apiKey: process.env.PADDLE_API_KEY, env: process.env.PADDLE_ENV ?? process.env.NEXT_PUBLIC_PADDLE_ENV }),
    webhookSecret: process.env.PADDLE_WEBHOOK_SECRET,
    google: clientId && clientSecret ? createGoogleAuth({ clientId, clientSecret, redirectUri: `${appUrl}/api/auth/callback` }) : null,
    appUrl,
    now: () => Date.now(),
  }
}
```

`lib/billing/auth-handlers.ts`

```ts
import { randomBytes } from 'node:crypto'
import { toPublicUser, TRIAL_DAYS } from './access'
import type { Deps } from './deps'
import { clearCookie, parseCookies, readSessionUserId, SESSION_COOKIE, SESSION_MAX_AGE_S, setCookie, signSession } from './session'

const STATE_COOKIE = 'rw_oauth_state'
const NEXT_COOKIE = 'rw_next'
const FIVE_MIN = 300

export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/'
  return next
}

function redirect(location: string, cookies: string[] = []): Response {
  const h = new Headers({ Location: location })
  for (const c of cookies) h.append('Set-Cookie', c)
  return new Response(null, { status: 302, headers: h })
}

const isHttps = (deps: Deps) => deps.appUrl.startsWith('https')
const authError = (deps: Deps, code: string, cookies: string[] = []) =>
  redirect(`${deps.appUrl}/pricing?auth_error=${encodeURIComponent(code)}`, cookies)

export function handleGoogleStart(req: Request, deps: Deps): Response {
  if (!deps.google) return authError(deps, 'not_configured')
  const state = randomBytes(16).toString('hex')
  const next = safeNextPath(new URL(req.url).searchParams.get('next'))
  const secure = isHttps(deps)
  return redirect(deps.google.authUrl(state), [
    setCookie(STATE_COOKIE, state, { secure, maxAgeS: FIVE_MIN }),
    setCookie(NEXT_COOKIE, encodeURIComponent(next), { secure, maxAgeS: FIVE_MIN }),
  ])
}

export async function handleGoogleCallback(req: Request, deps: Deps): Promise<Response> {
  const secure = isHttps(deps)
  const clear = [clearCookie(STATE_COOKIE, secure), clearCookie(NEXT_COOKIE, secure)]
  const q = new URL(req.url).searchParams
  const cookies = parseCookies(req.headers.get('cookie'))

  if (!cookies[STATE_COOKIE] || q.get('state') !== cookies[STATE_COOKIE]) return authError(deps, 'state_mismatch', clear)
  if (q.get('error')) return authError(deps, q.get('error')!, clear)
  const code = q.get('code')
  if (!code || !deps.google) return authError(deps, 'no_code', clear)

  try {
    const profile = await deps.google.exchange(code)
    const existing = deps.db.get(profile.sub)
    const now = deps.now()
    const user = deps.db.save(
      existing
        ? { ...existing, email: profile.email ?? existing.email, name: profile.name ?? existing.name, avatar: profile.picture ?? existing.avatar }
        : {
            id: profile.sub, email: profile.email, name: profile.name, avatar: profile.picture,
            trial_end_date: new Date(now + TRIAL_DAYS * 86_400_000).toISOString(),
            subscription_status: 'trial', subscription_plan: null, subscription_end_date: null,
            paddle_subscription_id: null, paddle_customer_id: null, created_at: new Date(now).toISOString(),
          },
    )
    const next = safeNextPath(cookies[NEXT_COOKIE] ? decodeURIComponent(cookies[NEXT_COOKIE]) : null)
    return redirect(`${deps.appUrl}${next}`, [...clear, setCookie(SESSION_COOKIE, signSession(user.id), { secure, maxAgeS: SESSION_MAX_AGE_S })])
  } catch {
    return authError(deps, 'callback_failed', clear)
  }
}

export function handleSignout(_req: Request, deps: Deps): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearCookie(SESSION_COOKIE, isHttps(deps)) },
  })
}

export function handleMe(req: Request, deps: Deps): Response {
  const id = readSessionUserId(req)
  const user = id ? deps.db.get(id) : null
  const body = user ? { user: toPublicUser(user, deps.now()), access: toPublicUser(user, deps.now()).access } : { user: null, access: 'no_auth' }
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
```

Route files (each exactly this shape; `dynamic` keeps them out of the prerender):

```ts
// app/api/auth/google/route.ts
import { handleGoogleStart } from '@/lib/billing/auth-handlers'
import { defaultDeps } from '@/lib/billing/deps'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const GET = (req: Request) => handleGoogleStart(req, defaultDeps())
```

`app/api/auth/callback/route.ts` → `export const GET = (req: Request) => handleGoogleCallback(req, defaultDeps())`; `app/api/auth/signout/route.ts` → `export const POST = (req: Request) => handleSignout(req, defaultDeps())`; `app/api/user/me/route.ts` → `export const GET = (req: Request) => handleMe(req, defaultDeps())` (all with the same two `export const` lines and imports).

- [ ] **Step 5:** `npx jest tests/billing/auth-handlers.test.ts` → PASS. Mutation checks: remove the `startsWith('//')` clause (open-redirect test must fail); skip the state comparison (mismatch test must fail).
- [ ] **Step 6: Checkpoint:** `npx tsc --noEmit`; `npx next build` (routes compile, no env needed); uncommitted.

---

### Task 6: Paddle routes (webhook, verify, portal)

**Files:**
- Create: `lib/billing/handlers.ts`, `app/api/paddle/webhook/route.ts`, `app/api/paddle/verify-subscription/route.ts`, `app/api/paddle/portal-session/route.ts`
- Test: `tests/billing/handlers.test.ts`

**Interfaces:**
- Consumes: `Deps` (Task 5), `verifyWebhookSignature, eventTarget, applyEvent, planFromSubscription, PaddleApi` (Task 4), `readSessionUserId` (Task 3).
- Produces:
  ```ts
  export function handleWebhook(req: Request, deps: Deps): Promise<Response>
  export function handleVerifySubscription(req: Request, deps: Deps): Promise<Response>
  export function handlePortalSession(req: Request, deps: Deps): Promise<Response>
  ```
  Status contract: webhook 401 bad signature / 400 bad JSON / 200 `{received:true}` (also for unknown user or unknown event) / 500 on a processing exception. Verify: 401 no session, 400 no transactionId, 503 Paddle not configured, 202 no subscription yet, 402 not active, 200 `{user: PublicUser}`, 502 Paddle failure. Portal: 401, 400 no customer, 503 not configured, 200 `{url}`, 502 failure.

- [ ] **Step 1: Write the failing test** `tests/billing/handlers.test.ts`

```ts
import { createHmac } from 'node:crypto'
import { handlePortalSession, handleVerifySubscription, handleWebhook } from '../../lib/billing/handlers'
import { openUsersDb } from '../../lib/billing/db'
import { SESSION_COOKIE, signSession } from '../../lib/billing/session'
import type { Deps } from '../../lib/billing/deps'
import type { UserRecord } from '../../lib/billing/types'
import type { PaddleApi } from '../../lib/billing/paddle'

const NOW = Date.parse('2026-10-20T12:00:00Z')
const SECRET = 'whsec_test'
beforeEach(() => { process.env.JWT_SECRET = 'k'.repeat(40) })
afterAll(() => { delete process.env.JWT_SECRET })

const baseUser = (over: Partial<UserRecord> = {}): UserRecord => ({
  id: 'g1', email: 'igor@example.com', name: 'I', avatar: null, trial_end_date: new Date(NOW + 1e6).toISOString(),
  subscription_status: 'trial', subscription_plan: null, subscription_end_date: null,
  paddle_subscription_id: null, paddle_customer_id: null, created_at: new Date(NOW - 1e6).toISOString(), ...over,
})
function deps(over: Partial<Deps> = {}, users: UserRecord[] = [baseUser()]): Deps {
  const db = openUsersDb(':memory:', () => NOW)
  users.forEach((u) => db.save(u))
  return { db, paddle: null, webhookSecret: SECRET, google: null, appUrl: 'https://rating.watch', now: () => NOW, ...over }
}
const signedReq = (event: object, opts: { ts?: number; secret?: string; tamper?: boolean } = {}) => {
  const body = JSON.stringify(event)
  const ts = opts.ts ?? Math.floor(NOW / 1000)
  const h1 = createHmac('sha256', opts.secret ?? SECRET).update(`${ts}:${body}`).digest('hex')
  return new Request('https://rating.watch/api/paddle/webhook', { method: 'POST', headers: { 'paddle-signature': `ts=${ts};h1=${h1}` }, body: opts.tamper ? body + ' ' : body })
}
const subEvent = (type: string, data: any = {}) => ({ event_type: type, data: { id: 'sub_1', customer_id: 'ctm_1', status: 'active', items: [{ price: { billing_cycle: { interval: 'year' } } }], current_billing_period: { ends_at: '2027-10-20T00:00:00Z' }, custom_data: { userId: 'g1' }, ...data } })

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
  it('payment_failed expires the subscriber found by subscription id', async () => {
    const d = deps({}, [baseUser({ subscription_status: 'active', paddle_subscription_id: 'sub_1' })])
    await handleWebhook(signedReq({ event_type: 'transaction.payment_failed', data: { subscription_id: 'sub_1' } }), d)
    expect(d.db.get('g1')!.subscription_status).toBe('expired')
  })
})

const authed = (path: string, init: RequestInit = {}) => new Request(`https://rating.watch${path}`, { ...init, headers: { cookie: `${SESSION_COOKIE}=${signSession('g1')}`, 'content-type': 'application/json', ...(init.headers ?? {}) } })
const api = (over: Partial<PaddleApi> = {}): PaddleApi => ({
  getTransaction: async () => ({ subscription_id: 'sub_1' }),
  getSubscription: async () => ({ id: 'sub_1', customer_id: 'ctm_1', status: 'active', items: [{ price: { billing_cycle: { interval: 'month' } } }], current_billing_period: { ends_at: '2026-11-20T00:00:00Z' } }),
  createPortalSession: async () => 'https://portal/x', ...over,
})

describe('handleVerifySubscription', () => {
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
    expect((await handleVerifySubscription(post({ transactionId: 't' }), deps({ paddle: null }))).status).toBe(503)
  })
  it('202 when the subscription does not exist yet, 402 when it is not active, 502 when Paddle fails', async () => {
    expect((await handleVerifySubscription(post({ transactionId: 't' }), deps({ paddle: api({ getTransaction: async () => ({}) }) }))).status).toBe(202)
    expect((await handleVerifySubscription(post({ transactionId: 't' }), deps({ paddle: api({ getSubscription: async () => ({ id: 'sub_1', status: 'canceled' }) }) }))).status).toBe(402)
    expect((await handleVerifySubscription(post({ transactionId: 't' }), deps({ paddle: api({ getTransaction: async () => { throw new Error('boom') } }) }))).status).toBe(502)
  })
  it('does not leak Paddle ids in the response', async () => {
    const r = await handleVerifySubscription(post({ transactionId: 't' }), deps({ paddle: api() }))
    expect(JSON.stringify(await r.json())).not.toMatch(/ctm_1|sub_1/)
  })
})

describe('handlePortalSession', () => {
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
```

- [ ] **Step 2:** Run → FAIL (module missing).
- [ ] **Step 3: Implement** `lib/billing/handlers.ts`

```ts
import { toPublicUser } from './access'
import type { Deps } from './deps'
import { applyEvent, eventTarget, planFromSubscription, verifyWebhookSignature, type PaddleEvent } from './paddle'
import { readSessionUserId } from './session'
import type { UserRecord } from './types'

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

function findUser(deps: Deps, e: PaddleEvent): UserRecord | null {
  const t = eventTarget(e)
  return (
    (t.userId ? deps.db.get(t.userId) : null) ??
    (t.subscriptionId ? deps.db.findBySubscriptionId(t.subscriptionId) : null) ??
    (t.customerId ? deps.db.findByCustomerId(t.customerId) : null) ??
    (t.email ? deps.db.findByEmail(t.email) : null)
  )
}

export async function handleWebhook(req: Request, deps: Deps): Promise<Response> {
  const raw = await req.text() // raw body: the signature covers the exact bytes
  if (!verifyWebhookSignature(raw, req.headers.get('paddle-signature'), deps.webhookSecret, deps.now())) {
    return json({ error: 'Invalid signature' }, 401)
  }
  let event: PaddleEvent
  try {
    event = JSON.parse(raw)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  try {
    const user = findUser(deps, event)
    const patch = user ? applyEvent(user, event) : null
    if (user && patch) deps.db.save({ ...user, ...patch })
    return json({ received: true }) // 200 even for unknown users/events so Paddle stops retrying
  } catch (err) {
    console.error('paddle webhook failed:', (err as Error).message)
    return json({ error: 'Webhook processing failed' }, 500)
  }
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
  if (!deps.paddle) return json({ error: 'Billing is not configured' }, 503)
  try {
    const txn = await deps.paddle.getTransaction(transactionId)
    if (!txn?.subscription_id) return json({ error: 'Subscription not yet created, webhook will handle it' }, 202)
    const sub = await deps.paddle.getSubscription(txn.subscription_id)
    if (sub?.status !== 'active' && sub?.status !== 'trialing') return json({ error: `Subscription is ${sub?.status}` }, 402)
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
    const subs = user.paddle_subscription_id ? [user.paddle_subscription_id] : undefined
    return json({ url: await deps.paddle.createPortalSession(user.paddle_customer_id, subs) })
  } catch (err) {
    console.error('paddle portal failed:', (err as Error).message)
    return json({ error: 'Failed to create portal session' }, 502)
  }
}
```

Routes: `app/api/paddle/webhook/route.ts` → `export const POST = (req: Request) => handleWebhook(req, defaultDeps())`; `verify-subscription/route.ts` → `POST … handleVerifySubscription`; `portal-session/route.ts` → `GET … handlePortalSession`; each with `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'` and the two imports (`@/lib/billing/handlers`, `@/lib/billing/deps`).

- [ ] **Step 4:** `npx jest tests/billing/handlers.test.ts` → PASS. Mutation checks: make `handleWebhook` skip the signature check (tamper/stale tests must fail); drop the `findByCustomerId` fallback (by-customer test must fail).
- [ ] **Step 5: Checkpoint:** `npx tsc --noEmit`; `npx next build`; uncommitted.

---

### Task 7: UI, registry, legal pages, privacy, headers

**Depends on:** Tasks 1-6 and Task 8 (the rename edits the same registry file).

**Files:**
- Create: `lib/billing/client.ts`, `components/billing/useAccount.ts`, `components/billing/CheckoutButtons.tsx`, `components/billing/ArGate.tsx`, `components/billing/billing.module.css`, `app/pricing/page.tsx`, `app/account/page.tsx`, `app/account/AccountClient.tsx`, `app/terms/page.tsx`, `app/refund-policy/page.tsx`, `app/camera-vision/ar/layout.tsx`
- Modify: `package.json` (`@paddle/paddle-js`), `lib/pages.ts` (3 entries), `lib/content.ts` (`SUPPORT_EMAIL`), `app/privacy/page.tsx` (accounts section), `next.config.js` (payment permission), `tests/next-config.test.ts`, `app/robots.ts` + `tests/lib/robots.test.ts`, `app/camera-vision/page.tsx` (AR link text mentions Pro)
- Test: `tests/billing/client.test.ts`, `tests/billing/registry.test.ts`

**Interfaces:**
- Consumes: `PublicUser`, `AccessStatus` (Task 1); route contracts from Tasks 5-6.
- Produces:
  ```ts
  // lib/billing/client.ts (pure)
  export interface PaddleConfig { env: 'production' | 'sandbox'; token: string; monthly: string; yearly: string }
  export function paddleConfig(env: Record<string, string | undefined>): PaddleConfig | null   // null if any piece missing
  export function describeSubscription(user: PublicUser): { headline: string; detail: string; canManage: boolean }
  export const PRICES = { monthly: { label: '$2.99 / month', amount: '2.99' }, yearly: { label: '$29 / year', amount: '29' } } as const
  export function authErrorMessage(code: string | null): string | null
  ```

- [ ] **Step 1:** `npm install @paddle/paddle-js`.
- [ ] **Step 2: Write the failing tests** `tests/billing/client.test.ts`

```ts
import { authErrorMessage, describeSubscription, paddleConfig, PRICES } from '../../lib/billing/client'
import type { PublicUser } from '../../lib/billing/types'

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
    for (const k of Object.keys(full)) expect(paddleConfig({ ...full, [k]: '' })).toBeNull()
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
  it('active: plan name and renewal date, can manage', () => {
    const d = describeSubscription(user({ subscription_status: 'active', subscription_plan: 'yearly', subscription_end_date: '2027-10-20T00:00:00Z', has_billing_portal: true }))
    expect(d).toMatchObject({ headline: 'Yearly', canManage: true })
    expect(d.detail).toMatch(/Renews Oct 20, 2027/)
  })
  it('cancelled and paused say access until the period end', () => {
    for (const s of ['cancelled', 'paused'] as const) {
      expect(describeSubscription(user({ subscription_status: s, subscription_end_date: '2026-11-20T00:00:00Z', has_billing_portal: true })).detail).toMatch(/Access until Nov 20, 2026/)
    }
  })
  it('expired: no manage button without a billing account, headline asks to subscribe', () => {
    expect(describeSubscription(user({ subscription_status: 'expired', access: 'paywall' }))).toMatchObject({ canManage: false })
  })
  it('does not crash on a missing end date', () => {
    expect(() => describeSubscription(user({ subscription_status: 'active', subscription_plan: 'monthly', subscription_end_date: null, has_billing_portal: true }))).not.toThrow()
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
```

`tests/billing/registry.test.ts`

```ts
import { PAGES, getPage } from '../../lib/pages'
import { renderedTitle } from '../../lib/seo'

describe('billing pages in the registry', () => {
  it('registers pricing, terms and refund-policy but NOT /account or /api (dynamic, noindex)', () => {
    for (const p of ['/pricing', '/terms', '/refund-policy']) expect(getPage(p)).toBeDefined()
    expect(PAGES.some((p) => p.path.startsWith('/account') || p.path.startsWith('/api'))).toBe(false)
  })
  it('keeps rendered titles within SERP length and descriptions within 160 chars', () => {
    for (const path of ['/pricing', '/terms', '/refund-policy']) {
      const page = getPage(path)
      expect(renderedTitle(page).length).toBeLessThanOrEqual(65)
      expect(page.description.length).toBeGreaterThanOrEqual(70)
      expect(page.description.length).toBeLessThanOrEqual(160)
    }
  })
})
```

- [ ] **Step 3:** Run both → FAIL.
- [ ] **Step 4: Implement** `lib/billing/client.ts`

```ts
import type { PublicUser } from './types'

export interface PaddleConfig { env: 'production' | 'sandbox'; token: string; monthly: string; yearly: string }

// Pure so it is unit-testable; components pass literal process.env.NEXT_PUBLIC_* reads (Next inlines only literals).
export function paddleConfig(env: Record<string, string | undefined>): PaddleConfig | null {
  const token = env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim()
  const monthly = env.NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY?.trim()
  const yearly = env.NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY?.trim()
  if (!token || !monthly || !yearly || /[^\x21-\x7e]/.test(token)) return null
  return { env: env.NEXT_PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox', token, monthly, yearly }
}

export const PRICES = {
  monthly: { label: '$2.99 / month', amount: '2.99' },
  yearly: { label: '$29 / year', amount: '29' },
} as const

const fmt = (iso: string | null): string =>
  iso && Number.isFinite(Date.parse(iso))
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : ''

export function describeSubscription(u: PublicUser): { headline: string; detail: string; canManage: boolean } {
  const end = fmt(u.subscription_end_date)
  const canManage = u.has_billing_portal && ['active', 'paused', 'cancelled'].includes(u.subscription_status)
  switch (u.subscription_status) {
    case 'trial':
      return { headline: 'Free trial', detail: `Trial ends ${fmt(u.trial_end_date)}`, canManage: false }
    case 'active':
      return { headline: u.subscription_plan === 'yearly' ? 'Yearly' : 'Monthly', detail: end ? `Renews ${end}` : 'Active', canManage }
    case 'paused':
    case 'cancelled':
      return { headline: u.subscription_status === 'paused' ? 'Paused' : 'Cancelled', detail: end ? `Access until ${end}` : 'Access ends soon', canManage }
    default:
      return { headline: 'Not subscribed', detail: 'Subscribe to use AR mode', canManage }
  }
}

export function authErrorMessage(code: string | null): string | null {
  if (!code) return null
  if (code === 'access_denied') return 'Sign-in was cancelled. You can try again any time.'
  if (code === 'not_configured') return 'Sign-in is unavailable right now. Please try again later.'
  return 'Sign-in did not complete. Please try again.'
}
```

- [ ] **Step 5: Implement the client pieces.**

`components/billing/useAccount.ts`

```ts
'use client'
import { useCallback, useEffect, useState } from 'react'
import type { AccessStatus, PublicUser } from '@/lib/billing/types'

export interface AccountState { loading: boolean; user: PublicUser | null; access: AccessStatus; refresh(): Promise<void> }

export function useAccount(): AccountState {
  const [state, setState] = useState<{ loading: boolean; user: PublicUser | null; access: AccessStatus }>({ loading: true, user: null, access: 'no_auth' })
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/user/me', { credentials: 'same-origin', cache: 'no-store' })
      const body = await res.json()
      setState({ loading: false, user: body.user ?? null, access: body.access ?? 'no_auth' })
    } catch {
      setState({ loading: false, user: null, access: 'no_auth' })
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  return { ...state, refresh }
}
```

`components/billing/CheckoutButtons.tsx`

```tsx
'use client'
import { initializePaddle, type Paddle } from '@paddle/paddle-js'
import { useEffect, useRef, useState } from 'react'
import { paddleConfig, PRICES } from '@/lib/billing/client'
import type { PublicUser } from '@/lib/billing/types'
import s from './billing.module.css'

// Literal reads so Next can inline them at build time.
const CONFIG = paddleConfig({
  NEXT_PUBLIC_PADDLE_ENV: process.env.NEXT_PUBLIC_PADDLE_ENV,
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
  NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY,
  NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY,
})

export default function CheckoutButtons({ user, onActivated }: { user: PublicUser; onActivated: () => void }) {
  const [paddle, setPaddle] = useState<Paddle | null>(null)
  const [state, setState] = useState<'idle' | 'activating' | 'blocked' | 'pending'>('idle')
  const opening = useRef(false)

  useEffect(() => {
    if (!CONFIG) return
    let cancelled = false
    initializePaddle({
      environment: CONFIG.env,
      token: CONFIG.token,
      eventCallback: async (event) => {
        if (event.name !== 'checkout.completed') return
        setState('activating')
        try {
          const res = await fetch('/api/paddle/verify-subscription', {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionId: event.data?.transaction_id }),
          })
          // 202 means Paddle has not created the subscription yet; the webhook will finish it, so poll once more shortly.
          if (res.status === 202) setTimeout(onActivated, 4000)
          setState(res.ok ? 'idle' : 'pending')
        } catch {
          setState('pending')
        }
        onActivated()
      },
    })
      .then((p) => { if (!cancelled && p) setPaddle(p) })
      .catch(() => { if (!cancelled) setState('blocked') }) // ad blockers can block paddle.com
    return () => { cancelled = true }
  }, [onActivated])

  if (!CONFIG) return <p className={s.notice}>Subscriptions are unavailable right now. Please check back soon.</p>

  const open = (priceId: string) => {
    if (!paddle || opening.current) return
    opening.current = true
    paddle.Checkout.open({ items: [{ priceId, quantity: 1 }], customData: { userId: user.id }, customer: user.email ? { email: user.email } : undefined })
    setTimeout(() => { opening.current = false }, 1500) // guards a double click opening two checkouts
  }

  return (
    <div className={s.plans}>
      <button type="button" className={`ds-btn ds-btn-signal ${s.plan}`} disabled={!paddle || state === 'activating'} onClick={() => open(CONFIG.monthly)}>
        Monthly <span className={s.price}>{PRICES.monthly.label}</span>
      </button>
      <button type="button" className={`ds-btn ${s.plan}`} disabled={!paddle || state === 'activating'} onClick={() => open(CONFIG.yearly)}>
        Yearly <span className={s.price}>{PRICES.yearly.label}</span>
      </button>
      {state === 'activating' && <p className={s.notice} role="status">Activating your subscription...</p>}
      {state === 'pending' && <p className={s.notice} role="status">Payment received. Your subscription can take a minute to activate; reload this page shortly.</p>}
      {state === 'blocked' && <p className={s.notice} role="alert">Checkout could not load. If you use an ad blocker, allow paddle.com for this site and reload.</p>}
    </div>
  )
}
```

`components/billing/ArGate.tsx`

```tsx
'use client'
import type { ReactNode } from 'react'
import { useAccount } from './useAccount'
import CheckoutButtons from './CheckoutButtons'
import s from './billing.module.css'

export default function ArGate({ children }: { children: ReactNode }) {
  const { loading, user, access, refresh } = useAccount()
  if (loading) return <main id="main" className={s.gate}><p className={s.notice} role="status">Checking your account...</p></main>
  if (access === 'trial_active' || access === 'subscribed') return <>{children}</>
  return (
    <main id="main" tabIndex={-1} className={s.gate}>
      <section className={`ds-card ${s.card}`}>
        <h1 className={`ds-display ${s.title}`}>AR Ratings is a Pro feature</h1>
        {!user ? (
          <>
            <p className={s.body}>Sign in with Google to start a free 3-day trial. No card needed.</p>
            <a className={`ds-btn ds-btn-signal ${s.cta}`} href="/api/auth/google?next=/camera-vision/ar">Sign in with Google</a>
          </>
        ) : (
          <>
            <p className={s.body}>Your trial has ended. Subscribe to keep using AR mode. Cancel any time from your account page.</p>
            <CheckoutButtons user={user} onActivated={refresh} />
          </>
        )}
        <p className={s.fine}>The Chrome extension and ratings lookups stay free. <a href="/pricing">See pricing</a></p>
      </section>
    </main>
  )
}
```

`app/camera-vision/ar/layout.tsx` (static server file: metadata from the registry plus the gate)

```tsx
import ArGate from '../../../components/billing/ArGate';
import { pageMetadata } from '../../../lib/seo';

export const metadata = pageMetadata('/camera-vision/ar');

// The parent camera-vision layout supplies the site header and footer.
export default function ArLayout({ children }: { children: React.ReactNode }) {
  return <ArGate>{children}</ArGate>;
}
```

(This replaces the metadata-only `layout.tsx` added earlier for the AR route.)

`app/pricing/page.tsx` (static server page + a small client island)

```tsx
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import { pageMetadata } from '../../lib/seo';
import { PRICES } from '../../lib/billing/client';
import PricingClient from './PricingClient';
import s from '../../components/billing/billing.module.css';

export const metadata = pageMetadata('/pricing');

export default function PricingPage() {
  return (
    <div className={s.page}>
      <SiteHeader />
      <main id="main" tabIndex={-1} className={s.main}>
        <h1 className={`ds-display ${s.h1}`}>Pricing</h1>
        <p className={s.lead}>The extension is free. AR mode, which draws ratings over your TV through your phone camera, is the paid feature.</p>
        <div className={s.tiers}>
          <section className={`ds-card ${s.tier}`}>
            <h2 className={`ds-display ${s.h2}`}>Free</h2>
            <ul className={s.list}>
              <li>Chrome extension badges on Netflix</li>
              <li>IMDb and Rotten Tomatoes scores</li>
              <li>No account needed</li>
            </ul>
            <a className={`ds-btn ${s.cta}`} href="/install">Install the extension</a>
          </section>
          <section className={`ds-card ${s.tier}`}>
            <h2 className={`ds-display ${s.h2}`}>Pro</h2>
            <p className={s.priceLine}>{PRICES.monthly.label} or {PRICES.yearly.label}</p>
            <ul className={s.list}>
              <li>AR mode: point your phone at the TV</li>
              <li>3-day free trial, no card</li>
              <li>Cancel any time, refund within 14 days of the first payment</li>
            </ul>
            <PricingClient />
          </section>
        </div>
        <p className={s.fine}>Payments are handled by Paddle, our merchant of record. See the <a href="/terms">terms</a> and <a href="/refund-policy">refund policy</a>.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
```

`app/pricing/PricingClient.tsx`

```tsx
'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import CheckoutButtons from '@/components/billing/CheckoutButtons'
import { useAccount } from '@/components/billing/useAccount'
import { authErrorMessage, describeSubscription } from '@/lib/billing/client'
import s from '@/components/billing/billing.module.css'

function Inner() {
  const { loading, user, access, refresh } = useAccount()
  const err = authErrorMessage(useSearchParams().get('auth_error'))
  return (
    <div>
      {err && <p className={s.notice} role="alert">{err}</p>}
      {loading ? <p className={s.notice} role="status">Checking your account...</p>
        : !user ? <a className={`ds-btn ds-btn-signal ${s.cta}`} href="/api/auth/google?next=/pricing">Sign in with Google to start</a>
        : access === 'subscribed' ? <p className={s.notice}>You are subscribed: {describeSubscription(user).headline}. <a href="/account">Manage on your account page</a></p>
        : <CheckoutButtons user={user} onActivated={refresh} />}
    </div>
  )
}
export default function PricingClient() {
  return <Suspense fallback={null}><Inner /></Suspense>
}
```

`app/account/page.tsx` (dynamic, noindex; never prerendered so `seo:validate` ignores it)

```tsx
import type { Metadata } from 'next';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import AccountClient from './AccountClient';
import s from '../../components/billing/billing.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Account', robots: { index: false, follow: false } };

export default function AccountPage() {
  return (
    <div className={s.page}>
      <SiteHeader />
      <main id="main" tabIndex={-1} className={s.main}>
        <h1 className={`ds-display ${s.h1}`}>Account</h1>
        <AccountClient />
      </main>
      <SiteFooter />
    </div>
  );
}
```

`app/account/AccountClient.tsx`

```tsx
'use client'
import { useState } from 'react'
import CheckoutButtons from '@/components/billing/CheckoutButtons'
import { useAccount } from '@/components/billing/useAccount'
import { describeSubscription } from '@/lib/billing/client'
import s from '@/components/billing/billing.module.css'

export default function AccountClient() {
  const { loading, user, access, refresh } = useAccount()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <p className={s.notice} role="status">Loading...</p>
  if (!user) return <a className={`ds-btn ds-btn-signal ${s.cta}`} href="/api/auth/google?next=/account">Sign in with Google</a>

  const d = describeSubscription(user)
  const openPortal = async () => {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/paddle/portal-session', { credentials: 'same-origin' })
      const body = await res.json()
      if (!res.ok || !body.url) throw new Error('portal')
      window.open(body.url, '_blank', 'noopener,noreferrer')
    } catch {
      window.open('https://customer.paddle.com/', '_blank', 'noopener,noreferrer') // Paddle's self-serve fallback, same as Name Habitat
    } finally { setBusy(false) }
  }
  const signOut = async () => { await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' }); window.location.href = '/' }

  return (
    <section className={`ds-card ${s.card}`}>
      <p className={`ds-label ${s.label}`}>{user.email}</p>
      <h2 className={`ds-display ${s.h2}`}>{d.headline}</h2>
      <p className={s.body}>{d.detail}</p>
      {access === 'paywall' || user.subscription_status === 'trial' ? <CheckoutButtons user={user} onActivated={refresh} /> : null}
      {d.canManage && <button type="button" className={`ds-btn ${s.cta}`} disabled={busy} onClick={openPortal}>{busy ? 'Opening...' : 'Manage subscription'}</button>}
      {error && <p className={s.notice} role="alert">{error}</p>}
      <button type="button" className={`ds-btn ${s.cta}`} onClick={signOut}>Sign out</button>
    </section>
  )
}
```

`components/billing/billing.module.css` (tokens only: reuse variables from `app/globals.css`; read `app/privacy/privacy.module.css` and `app/camera-vision/ar/ar.module.css` and mirror their spacing)

```css
.page { min-height: 100vh; background: var(--paper); color: var(--ink); }
.main { max-width: 960px; margin: 0 auto; padding: clamp(32px, 6vw, 72px) clamp(16px, 5vw, 32px) clamp(48px, 8vw, 96px); font-family: var(--body); font-size: 17px; line-height: 1.6; outline: none; }
.gate { max-width: 560px; margin: 0 auto; padding: clamp(32px, 8vw, 80px) 16px; outline: none; }
.h1 { font-size: clamp(48px, 9vw, 96px); margin: 0 0 16px; overflow-wrap: anywhere; }
.h2 { font-size: clamp(28px, 5vw, 44px); margin: 0 0 12px; }
.title { font-size: clamp(32px, 6vw, 52px); margin: 0 0 12px; }
.lead { margin: 0 0 32px; max-width: 60ch; }
.tiers { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
.tier, .card { padding: clamp(20px, 4vw, 32px); }
.list { padding-left: 20px; margin: 0 0 20px; }
.priceLine { font-weight: 700; margin: 0 0 12px; }
.plans { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0; }
.plan, .cta { min-height: 48px; padding: 12px 20px; display: inline-flex; gap: 8px; align-items: center; text-decoration: none; }
.price { font-family: var(--mono); font-size: 14px; }
.body { margin: 0 0 16px; }
.fine { margin: 20px 0 0; font-size: 14px; }
.label { margin: 0 0 8px; }
.notice { margin: 12px 0; padding: 10px 12px; border: 2px solid var(--ink); background: var(--gold); color: var(--ink); }
```

(If a token name above does not exist in `app/globals.css`, use the closest existing token; `tests/design-guards.test.ts` rejects raw hex colours.)

- [ ] **Step 6: Registry, content constant, privacy, legal pages, headers, robots.**

`lib/content.ts`: add `export const SUPPORT_EMAIL = 'hello@rating.watch';`.

`lib/pages.ts`: add these entries next to `/privacy` (note: no em dashes, titles under 65 rendered chars):

```ts
  {
    path: '/pricing',
    title: 'Pricing: Free Extension and Pro AR Mode',
    description:
      'Rating Watch is free as a Chrome extension. Pro adds AR mode for $2.99 a month or $29 a year, with a 3-day free trial and a 14-day refund window.',
    published: '2026-10-20',
    updated: '2026-10-20',
    changeFrequency: 'monthly',
    priority: 0.6,
    group: 'about',
    label: 'Pricing',
    ogType: 'website',
  },
  {
    path: '/terms',
    title: 'Terms of Service',
    description:
      'The terms for using Rating Watch: the free Chrome extension, the Pro AR mode subscription, billing through Paddle, cancellation and acceptable use.',
    published: '2026-10-20',
    updated: '2026-10-20',
    changeFrequency: 'yearly',
    priority: 0.3,
    group: 'legal',
    label: 'Terms',
    ogType: 'website',
  },
  {
    path: '/refund-policy',
    title: 'Refund Policy',
    description:
      'Request a full refund within 14 days of your first Rating Watch Pro payment. How to ask, how long it takes and what happens to your access afterwards.',
    published: '2026-10-20',
    updated: '2026-10-20',
    changeFrequency: 'yearly',
    priority: 0.3,
    group: 'legal',
    label: 'Refund policy',
    ogType: 'website',
  },
```

`app/terms/page.tsx` and `app/refund-policy/page.tsx` follow `app/privacy/page.tsx` exactly (same wrapper, `SiteHeader`, `SiteFooter`, `pageMetadata('/terms')` / `pageMetadata('/refund-policy')`, `privacy.module.css` classes imported from `../privacy/privacy.module.css`). Copy for **Terms** (sections, each one short paragraph): Service (Rating Watch provides a free Chrome extension and a paid AR mode; ratings come from OMDb and are provided as is; not affiliated with Netflix, IMDb or Rotten Tomatoes); Accounts (Google sign-in is required for AR mode; you are responsible for your account); Subscriptions and billing (Pro costs $2.99 per month or $29 per year plus any taxes shown at checkout; Paddle is the merchant of record and processes payment; renews automatically until cancelled; cancel any time from the account page, access continues until the end of the paid period); Free trial (3 days, no card, once per account); Acceptable use (no scraping, no resale, no attempts to bypass the paywall); Disclaimer and liability (service provided as is; liability limited to the amount you paid in the last 12 months); Changes (we may update these terms and post the date at the top); Contact (`SUPPORT_EMAIL`). **Refund policy** copy: Full refund of your first payment if you ask within 14 days; email `SUPPORT_EMAIL` from the address on your account; refunds are issued by Paddle to the original payment method and usually appear within 5 to 10 business days; after a refund Pro access ends; renewals after the first payment are not refundable except where the law requires; EU and UK consumers keep their statutory rights. Both pages carry `Last updated: October 20, 2026`.

`app/privacy/page.tsx`: add a section titled "Accounts and payments (AR mode)" before the existing contact section: Google sign-in gives us your Google account id, name, email address and profile picture URL; we store them with your trial and subscription status so we can show your account; a session cookie `rw_session` keeps you signed in for 14 days; Paddle, our merchant of record, collects payment details and we never see your card number; camera frames used by AR mode are analysed in your browser and are never uploaded, only recognised title text is sent to look up ratings; you can ask us to delete your account by email. Keep the "Last updated" date current (October 20, 2026).

`next.config.js`: change the Permissions-Policy `payment=()` to `payment=(self "https://*.paddle.com")` so wallet payments work inside Paddle's checkout iframe. Update `tests/next-config.test.ts` to: keep `microphone=()` and `geolocation=()` checks and assert `expect(policy).toContain('payment=(self "https://*.paddle.com")')` for payment.

`app/robots.ts` + `tests/lib/robots.test.ts`: add `/account` and `/api/` to the disallow list for all user agents (read the file first; follow its existing structure and update its test with one assertion that both paths are disallowed).

`app/camera-vision/page.tsx`: change the "Try AR mode" link text to "Try AR mode (Pro, 3-day trial)".

- [ ] **Step 7:** Run `npx jest tests/billing tests/next-config.test.ts tests/lib/robots.test.ts tests/design-guards.test.ts tests/no-emoji-content.test.ts` → PASS. Mutation check: in `paddleConfig` remove the token-glyph check and confirm the ellipsis test fails.
- [ ] **Step 8: Checkpoint:** `npx tsc --noEmit`, `npx next build`, `npm run seo:validate` ("N pages OK", no `/account` finding, `/pricing`/`/terms`/`/refund-policy` present); uncommitted.

---

### Task 8: Rename to Rating Watch

**Files (all current "Netflix Ratings" / netflix-ratings.app hits outside `docs/`, `tasks/`, `.claude/`):**
`app/compare/alternatives/page.tsx`, `app/about/page.tsx`, `lib/content.ts`, `tests/scripts/sitemap-urls.test.ts`, `lib/pages.ts`, `app/install/page.tsx`, `app/how-to/*/page.tsx` (3), `app/how-to/show-imdb-ratings-on-netflix/steps.ts`, `README.md`, `app/layout.tsx`, `tests/lib/seo.test.ts`, `lib/seo.ts`, `app/research/imdb-vs-rotten-tomatoes-gap/page.tsx`, `app/compare/imdb-vs-rotten-tomatoes/page.tsx`, `tests/lib/llms.test.ts`, `tests/lib/html-seo.test.ts`, `scripts/ping-indexnow.mjs`, `scripts/check-links.mjs`, `scripts/ar-bench/render.mjs`, `lib/og.tsx`, `lib/llms.ts`, `app/manifest.ts`, `tests/pages/show-rotten-tomatoes-on-netflix.test.ts`, `tests/lib/schema-graph.test.ts`, `tests/lib/find-what-to-watch.test.ts`, `tests/lib/alternatives-page.test.ts`, `tests/design-guards.test.ts`, `tests/app-assets.test.ts`, `public/icon.svg`, `public/favicon.svg`, `package.json` + `package-lock.json`, `components/SiteHeader.tsx`, `components/SiteFooter.tsx`, `components/home/{Story,HowItWorks,HomeNav,HomeFooter,Hero,BeforeAfter}.tsx`, `app/privacy/page.tsx`, `app/not-found.tsx`, `app/compare/alternatives/alternatives.module.css`, `extension/manifest.json`, `extension/options.html`, `extension/background.js`, `extension.zip`
- Create: `tests/rename-guard.test.ts`
- Not touched: `docs/**` (historical SEO audits, allowlisted), `tasks/**`, `.claude/**`, `REPO_URL` (changes only when the owner renames the GitHub repo).

**Mapping (case-sensitive, applied by hand-reviewed replacement):**

| Old | New |
|---|---|
| `Netflix Ratings` (the proper name) | `Rating Watch` |
| `netflix-ratings.app` / `www.netflix-ratings.app` | `rating.watch` / `www.rating.watch` |
| `Ratings for Netflix: IMDb & Rotten Tomatoes` (extension name) | `Rating Watch: IMDb & Rotten Tomatoes for Netflix` |
| `Ratings for Netflix` (action title, options page title, badge title) | `Rating Watch` |
| package name `netflix-imdb` | `rating-watch` |
| lowercase generic "netflix ratings", "ratings on Netflix" | unchanged (plain description) |

- [ ] **Step 1: Write the guard test first** `tests/rename-guard.test.ts`

```ts
import fs from 'fs'
import path from 'path'

const ROOT = path.join(__dirname, '..')
const SCAN = ['app', 'components', 'lib', 'public', 'extension', 'scripts', 'README.md', 'package.json']
const EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.html', '.css', '.svg', '.txt'])
const SKIP_DIRS = new Set(['node_modules', '.next', '.cache', '.data'])

function walk(p: string): string[] {
  const full = path.join(ROOT, p)
  if (!fs.existsSync(full)) return []
  if (fs.statSync(full).isFile()) return [p]
  return fs.readdirSync(full).flatMap((n) => (SKIP_DIRS.has(n) ? [] : walk(path.join(p, n))))
}

describe('rename to Rating Watch', () => {
  const files = SCAN.flatMap(walk).filter((f) => EXT.has(path.extname(f)))
  const hits = (re: RegExp) => files.filter((f) => re.test(fs.readFileSync(path.join(ROOT, f), 'utf8')))

  it('leaves no "Netflix Ratings" brand name in app code, extension or README', () => {
    expect(hits(/Netflix Ratings/)).toEqual([])
  })
  it('leaves no netflix-ratings.app host', () => {
    expect(hits(/netflix-ratings\.app/)).toEqual([])
  })
  it('names the extension and site correctly', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension/manifest.json'), 'utf8'))
    expect(manifest.name).toBe('Rating Watch: IMDb & Rotten Tomatoes for Netflix')
    expect(manifest.action.default_title).toBe('Rating Watch')
    expect(fs.readFileSync(path.join(ROOT, 'lib/content.ts'), 'utf8')).toContain("'https://rating.watch'")
    expect(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).name).toBe('rating-watch')
  })
  it('bumped the extension version past 1.1.1', () => {
    const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension/manifest.json'), 'utf8')).version.split('.').map(Number)
    expect(v[0] * 10_000 + v[1] * 100 + v[2]).toBeGreaterThan(10_101)
  })
})
```

- [ ] **Step 2:** Run `npx jest tests/rename-guard.test.ts` → FAIL (lists every file that still has the old name).
- [ ] **Step 3: Apply the replacement.**

```bash
cd /Users/igorgazivoda/netflix-imdb
FILES=$(git grep -l -E "Netflix Ratings|netflix-ratings\.app|Ratings for Netflix" -- ':!docs' ':!tasks' ':!.claude' ':!node_modules' ':!package-lock.json' ':!extension.zip')
perl -pi -e 's/Ratings for Netflix: IMDb & Rotten Tomatoes/Rating Watch: IMDb & Rotten Tomatoes for Netflix/g; s/Ratings for Netflix/Rating Watch/g; s/Netflix Ratings/Rating Watch/g; s/netflix-ratings\.app/rating.watch/g' $FILES
```

Then **read every changed hunk** (`git diff --stat` then `git diff` per file): fix grammar ("a Netflix Ratings" → "a Rating Watch" is fine, but "the Rating Watch extension" reads better than "Rating Watch extension" where an article was absent), keep lowercase generic phrases, keep `REPO_URL`. In `extension/manifest.json` set `"version": "1.2.0"`. In `package.json` set `"name": "rating-watch"` then run `npm install --package-lock-only` to sync the lock file name. In `lib/og.tsx` bump `OG_VERSION` so cached share images refresh. In `lib/pages.ts` also update `HOME_TITLE` to `Rating Watch: IMDb & Rotten Tomatoes on Netflix Cards`.
- [ ] **Step 4: Rebuild `extension.zip`.** Inspect `unzip -l extension.zip` first to see its layout, then recreate it from `extension/` with the same layout (for example `cd extension && rm -f ../extension.zip && zip -r ../extension.zip . -x '.DS_Store'`), and confirm `unzip -p extension.zip manifest.json | grep '"name"'` shows the new name.
- [ ] **Step 5:** Run `npx jest` (whole suite). Fix remaining old-name assertions in tests (they are in the file list above); title/description length tests must still pass because `Rating Watch` is shorter than `Netflix Ratings`. Mutation check: re-insert one `Netflix Ratings` string in `components/SiteFooter.tsx` and confirm the guard fails, then remove it.
- [ ] **Step 6: Checkpoint:** `npx tsc --noEmit`, `npx jest`, `npx next build`, `npm run seo:validate`; uncommitted.

---

### Task 9: Docs, dev seed script, deployment notes

**Files:**
- Create: `.env.example`, `docs/billing/SETUP.md`, `scripts/dev-seed-user.mjs`
- Test: `tests/billing/dev-seed.test.ts`

- [ ] **Step 1: Write the failing test** `tests/billing/dev-seed.test.ts` (imports the pure helper the script exposes)

```ts
import { seedUser } from '../../scripts/dev-seed-user.mjs'

it('refuses to run in production', () => {
  expect(() => seedUser({ nodeEnv: 'production', status: 'active', dbFile: ':memory:' })).toThrow(/production/)
})
it('creates a user in the requested state and returns a session cookie value', () => {
  const r = seedUser({ nodeEnv: 'development', status: 'trial', dbFile: ':memory:', jwtSecret: 'z'.repeat(40) })
  expect(r.user.subscription_status).toBe('trial')
  expect(r.cookie).toMatch(/^rw_session=ey/)
})
it('can seed an expired user', () => {
  expect(seedUser({ nodeEnv: 'test', status: 'expired', dbFile: ':memory:', jwtSecret: 'z'.repeat(40) }).user.subscription_status).toBe('expired')
})
```

(If importing an `.mjs` file from a `.test.ts` does not work under `ts-jest`/`next/jest`, write the helper as `lib/billing/dev-seed.ts` and make `scripts/dev-seed-user.mjs` a thin CLI that registers `ts-node` like `scripts/validate-seo.mjs` does; change the test import accordingly.)

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** the helper `seedUser({ nodeEnv, status, dbFile, jwtSecret? })`: throws `Error('dev-seed-user must not run in production')` when `nodeEnv === 'production'`; opens `openUsersDb(dbFile)`; saves user `{ id: 'dev-user', email: 'dev@example.com', name: 'Dev User', trial_end_date: now + 3 days (or now - 1 day when status is 'expired'), subscription_status: status, subscription_plan: status === 'active' ? 'monthly' : null, ... }`; returns `{ user, cookie: \`rw_session=${signSession('dev-user')}\` }`. The CLI prints only the cookie line and the user state, and takes `--status trial|active|expired|cancelled` and the DB path from `USERS_DB_PATH` (default `.data/users.db`).
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Write `.env.example`** (names only, no values) listing every variable from Global Constraints, each with a one-line comment saying where it comes from and whether it is build-time (`NEXT_PUBLIC_*`) or runtime. Write `docs/billing/SETUP.md` covering, in order: Paddle (product `pro_01m5ctaj7ctkszdyhhws382ma3`, the two price ids, client-side token, API key, webhook destination `https://rating.watch/api/paddle/webhook` with events `subscription.created`, `subscription.activated`, `subscription.updated`, `subscription.paused`, `subscription.resumed`, `subscription.canceled`, `transaction.payment_failed`, website approval needs `/pricing`, `/terms`, `/refund-policy` live), Google OAuth (redirect `https://rating.watch/api/auth/callback`, origin `https://rating.watch`), Coolify (domain, persistent volume `/app/data`, `DATA_DIR=/app/data`, mark `NEXT_PUBLIC_*` as build variables, `APP_URL`, `JWT_SECRET` via `openssl rand -hex 32`), the `hello@rating.watch` mailbox, then manual test steps (sign in, trial, checkout with Paddle, webhook delivery, manage subscription, cancel).
- [ ] **Step 6: Checkpoint:** `npx tsc --noEmit`, `npx jest tests/billing`; uncommitted.

---

### Task 10: Full verification, browser check and the owner-approved commit

- [ ] **Step 1:** Run the exact CI chain: `npx tsc --noEmit && npx jest && npx next build && npm run seo:validate && npm run seo:links` (links check may need the built site; run it if it works offline, otherwise report why it was skipped). All must pass.
- [ ] **Step 2: Browser verification against the real dev server** (`npm run dev` on port 3000; do not start a second server; use a new Chrome tab and close it afterwards). Create a throwaway `USERS_DB_PATH` and `JWT_SECRET` in the shell for the dev server only (not in `.env.local`), seed users with `node scripts/dev-seed-user.mjs --status trial|expired|active`, set the cookie via `document.cookie` for each state, and confirm on `/camera-vision/ar`: no cookie shows the sign-in card; `trial` shows the camera page; `expired` shows the paywall card with Monthly and Yearly buttons; `active` shows the camera page. Confirm `/pricing` shows both plans and renders the neutral "unavailable" notice when the `NEXT_PUBLIC_PADDLE_*` variables are removed from the shell environment. Take screenshots. **Do not open the real Paddle checkout and do not complete a purchase** (live account; website approval is not yet granted); only confirm the Checkout button initialises without console errors.
- [ ] **Step 3: Report to the owner**, honestly: what was verified (tests, build, browser states), what could not be verified (Google sign-in with a real account, Paddle checkout, webhook delivery from Paddle, Coolify volume, DNS), the owner steps remaining (API key, webhook secret, domain approval, OAuth redirect, GitHub repo rename, Chrome Web Store, support mailbox), and the three spec deviations listed at the top.
- [ ] **Step 3b: Remove any dev state:** delete throwaway DB files and unset the shell variables.
- [ ] **Step 4: Ask the owner for explicit approval to commit.** Only after a clear yes: stage by explicit path (never `git add -A`; leave `eng.traineddata` out), commit with message `feat: rename to Rating Watch and add Google sign-in + Paddle subscriptions for AR mode` and the repository's attribution trailer, and push only if the owner also approves the push. Watch the CI run afterwards (`gh run list --limit 1`) and report its result.

---

### Task 11: Copy accuracy once Pro exists

**Depends on:** Task 7 (it adds `SUPPORT_EMAIL` and `/pricing` to the same files).

**Files:**
- Modify: `lib/content.ts`, `lib/llms.ts`, `lib/seo.ts`, `lib/pages.ts`, `components/home/Hero.tsx`, `README.md`
- Create: `tests/billing/copy-accuracy.test.ts`

**Why:** Several site-wide sentences were true when the product was only a free Chrome extension and are false once the Pro AR mode exists. Claims about **the extension** ("no account", "no tracking", "free and open source") stay true and stay, but must say "the extension" so they are not read as claims about the whole product.

**Interfaces:**
- Consumes: the `/pricing` page and Pro terms from Task 7 (`$2.99 / month or $29 / year`, 3-day free trial, AR mode).

- [ ] **Step 1: Write the failing test** `tests/billing/copy-accuracy.test.ts`

```ts
import fs from 'fs'
import path from 'path'

const ROOT = path.join(__dirname, '..', '..')
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8')
const SCAN = ['app', 'components', 'lib', 'README.md']
const EXT = new Set(['.ts', '.tsx', '.md'])
const walk = (p: string): string[] => {
  const full = path.join(ROOT, p)
  if (fs.statSync(full).isFile()) return [p]
  return fs.readdirSync(full).flatMap((n) => walk(path.join(p, n)))
}
const files = SCAN.flatMap(walk).filter((f) => EXT.has(path.extname(f)))
const hits = (re: RegExp) => files.filter((f) => re.test(read(f)))

describe('copy stays accurate with a paid tier', () => {
  it('no longer claims there is no paid tier or subscription', () => {
    expect(hits(/no paid tier/i)).toEqual([])
    expect(hits(/no subscription/i)).toEqual([])
  })
  it('the "Is Rating Watch free?" answer separates the free extension from Pro AR mode', () => {
    const src = read('lib/content.ts')
    const i = src.indexOf('Is Rating Watch free?')
    expect(i).toBeGreaterThan(-1)
    const answer = src.slice(i, i + 700)
    expect(answer).toMatch(/extension is free/i)
    expect(answer).toMatch(/Pro/)
    expect(answer).toMatch(/\$2\.99/)
    expect(answer).toMatch(/\$29/)
  })
  it('llms.txt copy mentions Pro and the pricing page', () => {
    const src = read('lib/llms.ts')
    expect(src).toMatch(/Pro/)
    expect(src).toMatch(/pricing/i)
  })
  it('keeps the "no account" claim only where it is about the extension', () => {
    for (const f of ['lib/llms.ts', 'lib/pages.ts', 'components/home/Hero.tsx']) {
      const lines = read(f).split('\n').filter((l) => /no account/i.test(l))
      for (const l of lines) expect(l).toMatch(/extension/i)
    }
  })
  it('README says the extension (not the whole product) has no backend', () => {
    const src = read('README.md')
    expect(src).not.toMatch(/and no backend server/i)
    expect(src).toMatch(/extension/i)
  })
})
```

- [ ] **Step 2:** Run `npx jest tests/billing/copy-accuracy.test.ts` -> FAIL.
- [ ] **Step 3: Implement the copy changes (no em dashes, no emoji).**
  - `lib/content.ts` FAQ `'Is Rating Watch free?'`: new answer: `The Chrome extension is free and open source: no account, no subscription, and the full source code is on GitHub. AR mode, which draws ratings over your TV through your phone camera, is Pro: $2.99 a month or $29 a year, with a 3-day free trial that needs no card. You can cancel any time from your account page.`
  - `lib/content.ts` the `'What is Rating Watch?'` answer: append one sentence: `There is also an optional Pro AR mode that shows the same scores over a TV screen through your phone camera.`
  - `lib/content.ts` lines about "No account, no login, no tracking" (feature card) and the FAQ "No. The extension needs no account...": make the subject explicitly `The extension` where it is not already.
  - `lib/llms.ts`: change `'Free and open source. No account or login.'` to `'The Chrome extension is free and open source and needs no account. AR mode is Pro ($2.99/month or $29/year, 3-day free trial); see /pricing.'` and add a pricing line wherever that file lists pages (use `/pricing` from the registry if it lists registry pages automatically; do not hard-code a second list).
  - `lib/pages.ts`: the home description ends `No account, no tab-switching.` -> `The extension needs no account.`; the privacy description ends `No account, no tracking.` -> `The extension needs no account and does no tracking.` (keep each description between 70 and 160 characters; `tests/lib/seo.test.ts` checks lengths).
  - `lib/seo.ts` feature list entries `'No account or login required'` and `'Privacy-friendly, no tracking'` -> `'Extension needs no account or login'` and `'Extension is privacy-friendly with no tracking'`. If the `SoftwareApplication` node declares a price of 0, keep the extension at price 0 and add nothing else (YAGNI).
  - `components/home/Hero.tsx`: `No account needed` list item -> `Extension needs no account`; the sentence `No account, no second tab, no searching` keeps its meaning but must name the extension.
  - `README.md`: line about no account/sign-in/API key -> start with `The extension needs...`; `No account, no analytics, no telemetry, and no backend server.` -> `The extension has no account, no analytics, no telemetry and no backend server. The website offers an optional Pro AR mode with sign-in; see /pricing.`
  - Do not touch `docs/`.
- [ ] **Step 4:** Run `npx jest tests/billing/copy-accuracy.test.ts tests/lib tests/design-guards.test.ts tests/no-emoji-content.test.ts` -> PASS. Fix any existing test that pins the old wording (for example `tests/lib/llms.test.ts`, `tests/lib/seo.test.ts`) by updating the expected text to the new wording.
- [ ] **Step 5: Checkpoint:** `npx tsc --noEmit`, `npx jest`, `npm run seo:validate` after a build; uncommitted.

---

## Self-review (run against the spec)

- **Spec coverage:** rename of site/extension/repo files (Task 8, with GitHub repo and store listing left to the owner as the spec says); accounts, trial, checkout, webhook, verify, portal (Tasks 1-6); pricing, account page, manage subscription, AR gate (Task 7); legal pages and privacy update (Task 7); `payment=()` header fix (Task 7); 5-minute webhook window (Task 4); env and rollout docs (Task 9); verification and rollout order (Task 10). Paddle product/prices already exist and are referenced by ID; domain approval, webhook destination and OAuth registration remain owner steps documented in Task 9.
- **Placeholders:** none; the two places that say "read the file first" (robots, CSS token names) name the exact behaviour to implement and the test that pins it.
- **Type consistency:** `UserRecord`, `PublicUser`, `AccessStatus`, `Deps`, `UsersDb`, `PaddleApi`, `GoogleAuth` are defined once (Tasks 1, 2, 4, 5) and used with the same names and signatures in later tasks; `handleMe` returns `{ user, access }`, which `useAccount` reads; webhook patch keys match `UserRecord` column names.
