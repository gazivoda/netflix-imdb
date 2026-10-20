# Rating Watch: rename, accounts and Paddle subscriptions (design)

Status: **draft for review** (nothing implemented). Date: 2026-10-20.

## Goal

1. Rename the whole product from "Netflix Ratings" to **Rating Watch**, served from **https://rating.watch**.
2. Add a paid tier, **$2.99 / month or $29 / year**, billed through the Paddle account already used for Name Habitat (`nail-habit-app`), with subscription management that works the same way as Name Habitat.
3. The paid feature is **AR camera mode** (`/camera-vision/ar`, including auto-read titles). The Chrome extension, the ratings API and the rest of the site stay free.

## Decisions (confirmed by the owner)

| Topic | Decision |
|---|---|
| Paid feature | AR camera mode only |
| Sign-in | Google OAuth, same model as Name Habitat |
| Trial | 3 days, no card, starts at first sign-in (same as Name Habitat) |
| Rename scope | Website, extension files, repo files (package name, README). The GitHub repo rename and the Chrome Web Store listing are done by the owner |
| Paddle | Sandbox first. The owner creates the product and prices and supplies price IDs; no live billing is touched by the build |

## Non-goals

- No change to the extension's behaviour or its free status. No gating of `/api/ratings`.
- No Electron/desktop flow (Name Habitat's `ELECTRON_PROTOCOL` path is not ported).
- No email sending in v1 (Name Habitat's welcome/admin emails are not ported).
- No team plans, coupons, or localisation of prices (Paddle handles tax and currency display).

## Reference: how Name Habitat does it (read-only study of `nail-habit-app`)

- `server.js`: Google OAuth with a CSRF `state` cookie, JWT (HS256, 14 days) in an HttpOnly cookie, SQLite `users` table
  (`trial_end_date`, `subscription_status` in trial|active|paused|cancelled|expired, `subscription_plan` monthly|yearly,
  `subscription_end_date`, `paddle_subscription_id`, `paddle_customer_id`).
- Paddle webhook `POST /api/paddle/webhook` with raw-body HMAC-SHA256 check of `Paddle-Signature` (`ts=...;h1=...`); handles
  `subscription.created|activated|updated|paused|resumed|canceled` and `transaction.payment_failed`; user matched by
  `custom_data.userId`, then by customer email.
- `POST /api/paddle/verify-subscription`: after `checkout.completed` the client sends the transaction id; the server looks up the
  transaction and subscription with the Paddle API and activates the user (covers a late webhook).
- `GET /api/paddle/portal-session`: creates a customer-portal session for `paddle_customer_id`; UI falls back to
  `https://customer.paddle.com/`.
- Client: `@paddle/paddle-js` `initializePaddle({token, environment})`, `Checkout.open({items, customData:{userId}, customer:{email}})`;
  `computeAccessStatus` = subscribed (active|paused) / trial_active / paywall. `subscription_end_date` is deliberately not used as a gate.

## Architecture

Rating Watch is a Next.js 14 app with no accounts today. The Name Habitat logic is ported as Next route handlers (Node runtime),
keeping the same behaviour but typed and tested. New code lives under `lib/billing/` and `app/api/`.

```
lib/billing/
  db.ts            SQLite (better-sqlite3), users table, getUser/saveUser/findByEmail, trial-expiry on read
  access.ts        computeAccessStatus (pure; same rules as Name Habitat) + types
  session.ts       signToken / verifySession (jsonwebtoken, HS256, 14d), cookie options (cookie name: rw_session)
  paddle.ts        PADDLE_API base (sandbox|production), verifyWebhookSignature, applyEvent (pure state transition),
                   getTransaction, getSubscription, createPortalSession
app/api/auth/google/route.ts          start OAuth (state cookie)
app/api/auth/callback/route.ts        exchange code, find/create user (3-day trial), set cookie, redirect
app/api/auth/signout/route.ts         clear cookie
app/api/user/me/route.ts              current user + computed access status
app/api/paddle/webhook/route.ts       raw body, signature check, applyEvent
app/api/paddle/verify-subscription/route.ts
app/api/paddle/portal-session/route.ts
app/pricing/page.tsx                  plans, Paddle.js overlay checkout, sign-in prompt
app/account/page.tsx                  status badge, renewal/access-until text, "Manage subscription"
app/terms/page.tsx, app/refund-policy/page.tsx   required by Paddle as merchant of record (privacy page exists)
app/camera-vision/ar/layout.tsx       server-side access check wrapper, shows paywall instead of the camera when not entitled
```

`applyEvent(user, event)` is a pure function (event in, user patch out) so the webhook's behaviour is unit-tested without HTTP.

### Data model

`users(id TEXT PK (Google sub), email, name, avatar, trial_end_date, subscription_status, subscription_plan,
subscription_end_date, paddle_subscription_id, paddle_customer_id, created_at)`; identical columns to Name Habitat so the logic maps 1:1.
Stored at `${DATA_DIR:-.data}/users.db`, on a persistent Coolify volume (like the existing `.data/` ratings store, which must also be
on a volume in production).

### Access rules (unchanged from Name Habitat)

- `active` or `paused` -> subscribed.
- Otherwise trial valid (`trial_end_date` in the future, status not expired/cancelled) -> trial_active.
- Otherwise -> paywall. Not signed in -> sign-in prompt.
- Gate is enforced **server-side** for the AR route (the layout reads the session cookie), and the client UI mirrors it. Camera frames never
  leave the device either way; only the title strings already sent to `/api/ratings`.

### Checkout flow

1. Signed-in user on `/pricing` (or the paywall inside `/camera-vision/ar`) picks monthly or yearly.
2. `paddle.Checkout.open({ items:[{priceId, quantity:1}], customData:{ userId }, customer:{ email } })`.
3. `checkout.completed` -> client calls `/api/paddle/verify-subscription` with the transaction id; server fetches transaction ->
   subscription from Paddle and sets the user active (202 if the subscription does not exist yet; the webhook finishes it).
4. Webhook keeps state correct afterwards (renewals, pause, cancel, payment failure).

### Manage subscription

`/account` shows plan, renewal date or "Access until <date>", and **Manage subscription**, which calls `/api/paddle/portal-session`
and opens the returned Paddle portal URL (cancel, update card, invoices); falls back to `https://customer.paddle.com/`. Cancelling keeps
access until the end of the paid period (`subscription_end_date`).

## Rename: "Netflix Ratings" -> "Rating Watch"

- Brand strings: about 168 occurrences in about 40 files (components/home, lib, app/*, docs/seo, public, README, tests). Variants
  to handle: "Netflix Ratings", "Netflix IMDb/IMDB", "netflix-imdb" (package/repo slug), the extension name
  "Ratings for Netflix: IMDb & Rotten Tomatoes".
- New names: product **Rating Watch**; extension **"Rating Watch: IMDb & Rotten Tomatoes for Netflix"** (descriptive use of "Netflix" is kept;
  the extension manifest version is bumped).
- `SITE_URL` default -> `https://rating.watch` (`NEXT_PUBLIC_SITE_URL` stays the override), canonical URLs, sitemap, robots, JSON-LD
  (`WebSite`, `Organization`, `SoftwareApplication`), `llms.txt`/`llms-full.txt`, OG images, `manifest.ts`, `app-icon`.
- Wordmark/logo text in `components/SiteHeader`/footer and generated icons use the new name.
- Not changed by the build (owner does these): GitHub repo rename, Chrome Web Store listing, DNS, Coolify domain, 301 from the old
  host (documented in the rollout notes). `REPO_URL` is updated only when the repo is renamed.
- Guard: a test asserts no user-facing "Netflix Ratings" string remains, except historical docs in `docs/` that are explicitly allowlisted.

## Config

Server: `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_ENV` (sandbox|production), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`JWT_SECRET`, `APP_URL` (https://rating.watch; used for the OAuth redirect, never request headers), `DATA_DIR`.
Client (build-time): `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY`, `NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY`,
`NEXT_PUBLIC_PADDLE_ENV`. Secrets live only in `.env.local` / Coolify; the build never reads or copies keys from `nail-habit-app`.
If any Paddle variable is missing the pricing page shows a neutral "subscriptions unavailable" message (no config details to customers).

## Security notes

- Webhook: raw body, constant-time compare of the HMAC, reject timestamps older than 5 minutes (an improvement over the reference).
- Subscription fields are only written by the webhook and verify endpoint, never by the client.
- OAuth `state` cookie (CSRF), redirect URI from `APP_URL`, cookie `HttpOnly; Secure; SameSite=Lax`.
- `next.config.js`: `Permissions-Policy` currently has `payment=()`, which blocks wallet payments inside the Paddle checkout iframe; it must
  allow `payment=(self "https://*.paddle.com")`. No CSP exists today, so nothing else blocks Paddle.js; if one is added later it must allow
  `*.paddle.com` as Name Habitat's does.
- Paddle Sandbox and production use different tokens, price IDs, webhook secrets: all environment-driven.

## Testing

- Unit: `computeAccessStatus` (table), `verifyWebhookSignature` (valid / tampered / stale), `applyEvent` for every event type incl. unknown user
  and email fallback, session sign/verify, trial-expiry on read.
- Route tests with a fake DB and a stubbed Paddle API: webhook 401/200, verify 202/402/200, portal-session 400/503/200, auth callback
  state mismatch.
- Rename guard test + existing SEO tests (`seo:validate`, title/description lengths) updated for the new name; full `tsc`, `jest`, `next build`.
- Browser check against Paddle **Sandbox** with the owner's test prices (Paddle test card) once the owner supplies the IDs.

## Rollout

1. Build on a branch of the working tree against Sandbox; owner supplies Sandbox price IDs/token/webhook secret.
2. Owner: add `rating.watch` as an approved domain in Paddle, create the webhook destination
   `https://rating.watch/api/paddle/webhook` (subscription.* and transaction.payment_failed), register the Google OAuth redirect
   `https://rating.watch/api/auth/callback`, attach a persistent volume at `/app/data`, point DNS/Coolify at the app.
3. Sandbox end-to-end test, then owner flips the env vars to production values.

## Open risks

- Paddle live checkout needs the domain approved and the legal pages live; neither can be completed by code alone.
- `better-sqlite3` is a native module: CI (Node 20) and the Coolify build must install it (prebuilt binaries normally exist).
- A new Google OAuth client or a new redirect on the existing one is the owner's call; the build only reads env vars.
- Sign-in friction on a camera feature used on a phone: Google OAuth redirects work in mobile browsers, but in-app browsers may block them.
