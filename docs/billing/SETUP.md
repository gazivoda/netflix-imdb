# Rating Watch billing: setup and rollout

This guide covers everything outside the code that has to be configured for sign-in, the 3 day trial and paid plans to work on https://rating.watch. It contains no secrets. Keep every key, token and secret in Coolify (production) or `.env.local` (development), never in git. `.env.example` lists the variable names.

Order matters: finish Paddle and Google before you deploy, because `NEXT_PUBLIC_*` values are baked in at build time.

## Paywall stays off until configured

Deploying this code before the variables below exist is safe. The paywall is off until billing is fully configured, so AR mode (`/camera-vision/ar`) stays free and nobody is sent to a sign-in that cannot work. `/pricing` and `/account` show "Subscriptions open soon. AR mode is free to use until then." instead of sign-in and checkout buttons.

The server checks this on every request to `GET /api/user/me` (environment is read at request time, not at build time). The paywall switches on automatically, with no code change, once all six are true:

1. Google OAuth is configured: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set.
2. The session secret is valid: `JWT_SECRET` is set and at least 32 characters.
3. The Paddle API is configured: `PADDLE_API_KEY` is set.
4. The webhook secret is set: `PADDLE_WEBHOOK_SECRET`.
5. The price allow-list is not empty: `PADDLE_PRICE_IDS`, or else `NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY` and `NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY`.
6. The checkout client token is set: `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`. This is a `NEXT_PUBLIC_*` value, so in Coolify it must be a **Build Variable**; it is read when the app is built, and adding it later needs a rebuild, not just a restart.

While billing is off, `GET /api/user/me` does not open the users database at all. Once billing is on, a database that cannot be opened makes it answer 503 `{"error":"Service unavailable"}` (the paywall never fails open for a configured deployment).

If any one is missing or invalid, AR mode stays free. A restart is enough for runtime variables; the `NEXT_PUBLIC_*` values (client token, and price ids if you rely on them) are build-time values and need a rebuild.

**How to verify.** Open `https://rating.watch/api/user/me` (or run `curl -s https://rating.watch/api/user/me`). The JSON must contain `"billingEnabled":true` once everything is set. If it says `"billingEnabled":false`, one of the six requirements is missing; the response never says which and never shows a secret, so check the six names above in Coolify. Do this check before announcing paid plans, and again after any change to the variables.

## 1. Paddle

The catalogue already exists in the live Paddle account:

| Item | Id | Price |
| --- | --- | --- |
| Product | `pro_01m5ctaj7ctkszdyhhws382ma3` | |
| Monthly price | `pri_01m5ctdp1xcbfsbq73yg2dgax8` | $2.99 per month |
| Yearly price | `pri_01m5ctfqx7bdteged1kzaynn6h` | $29 per year |

Product and price ids are not secrets. Set them as `NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY` and `NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY`, and list both again, comma-separated, in the runtime variable `PADDLE_PRICE_IDS`.

> **Shared Paddle account.** This Paddle account also sells another product, and a webhook destination cannot be limited to one product: every destination receives every subscription and transaction event, Paddle reuses one customer per email address, and both products put the Google account id in `custom_data.userId`. Rating Watch therefore only accepts events and verified checkouts whose items carry one of the price ids in `PADDLE_PRICE_IDS` (falling back to the two `NEXT_PUBLIC_PADDLE_PRICE_ID_*` values). Everything else is answered 200 and ignored, and an empty list ignores everything, so set it before going live. Any other product on this Paddle account needs the same kind of price filter in its own webhook, otherwise a Rating Watch purchase can change that product's users.

1. **Client-side token.** Developer Tools > Authentication > Client-side tokens: create one and set it as `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`. It is meant for the browser, but it is still environment specific: a `test_` token only works with `sandbox`, a `live_` token only with `production`.
2. **Environment.** Set `NEXT_PUBLIC_PADDLE_ENV` to `production` for the live site (anything else means sandbox). `PADDLE_ENV` controls the server API host; if unset it falls back to `NEXT_PUBLIC_PADDLE_ENV`. Keep the two equal.
3. **API key.** Developer Tools > Authentication > API keys: create a key with read access to subscriptions and transactions and write access to customer portal sessions, and set it as `PADDLE_API_KEY`. It is a secret and server only.
4. **Webhook destination.** Developer Tools > Notifications > New destination:
   - URL: `https://rating.watch/api/paddle/webhook`
   - Events: `subscription.created`, `subscription.activated`, `subscription.updated`, `subscription.paused`, `subscription.resumed`, `subscription.canceled`, `transaction.payment_failed`
   - Copy the destination's secret key into `PADDLE_WEBHOOK_SECRET`.
   Requests older than 5 minutes or with a bad signature are rejected with 401.
5. **Website approval.** Paddle will not approve the domain for live checkout until these pages are publicly reachable: `/pricing`, `/terms`, `/refund-policy`. Deploy them first, then submit the domain under Checkout > Website approval. Until it is approved, use the sandbox for all purchase testing and do not complete a live purchase.

## 2. Google OAuth

Google Cloud Console > APIs & Services > Credentials > Create credentials > OAuth client ID > Web application.

- Authorised JavaScript origin: `https://rating.watch`
- Authorised redirect URI: `https://rating.watch/api/auth/callback`
- For local development also add `http://localhost:3000` as an origin and `http://localhost:3000/api/auth/callback` as a redirect URI.

Set the client id and secret as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. On the OAuth consent screen use the app name Rating Watch, support email `hello@rating.watch`, and publish the app (testing mode limits sign-in to listed test users).

## 3. Coolify

1. **Domain.** Point `rating.watch` at the application and enable HTTPS.
2. **Persistent volume.** Add a persistent storage mount at `/app/.data` and leave `DATA_DIR` and `USERS_DB_PATH` unset. That one volume holds the SQLite users database (`.data/users.db`) and the ratings cache (`.data/ratings.json`); without it every deploy deletes all accounts.
3. **Runtime variables.** `APP_URL=https://rating.watch`, `PADDLE_PRICE_IDS` (the monthly and yearly price ids, comma-separated; required, see "Shared Paddle account" above), `JWT_SECRET` (generate with `openssl rand -hex 32`, 32 or more characters; changing it signs everyone out), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_ENV`.
4. **Build variables.** Mark every `NEXT_PUBLIC_*` variable as a **Build Variable** (`NEXT_PUBLIC_PADDLE_ENV`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY`, `NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY`). Next.js inlines them when `next build` runs, so a runtime-only variable has no effect and the pricing page shows the "subscriptions unavailable" notice. Changing one requires a rebuild, not just a restart.
5. **Missing configuration.** If Paddle, Google or `JWT_SECRET` values are missing the affected API routes answer 503 and pages show a neutral notice; the build itself needs no secrets. Until all six requirements in "Paywall stays off until configured" are met, AR mode is free.
6. **Local development.** `APP_URL` defaults to `https://rating.watch`, so locally you must set `APP_URL=http://localhost:3000`, otherwise Google redirects back to production. Put the values in `.env.local` (git ignored).

## 4. Support mailbox

Create the `hello@rating.watch` mailbox (or an alias that forwards to the owner). It is the support address shown on the pricing, account, terms and refund pages and is Paddle's contact for customer questions, so mail must be deliverable before launch.

## 5. Local testing without Google

`scripts/dev-seed-user.mjs` writes a fixture user and prints a session cookie, so you can see every access state without signing in. It refuses to run when `NODE_ENV=production`.

```sh
JWT_SECRET=$(openssl rand -hex 32) USERS_DB_PATH=/tmp/rw-dev.db node scripts/dev-seed-user.mjs --status trial
```

Statuses: `trial`, `active`, `expired`, `cancelled`. Run the dev server with the same `JWT_SECRET` and `USERS_DB_PATH`, then paste the printed `rw_session=...` value into the browser (`document.cookie = '...; path=/'`). The script prints only the cookie and the resulting user state, never the secret.

## 6. Manual test checklist

Run against the sandbox first (`test_` token, sandbox API key, sandbox webhook destination), then repeat the signed-in checks on production without completing a payment until Paddle approves the domain.

1. **Sign in.** On `/camera-vision/ar` signed out you see the sign-in card. Choose Google sign-in, finish the consent screen, and land back on the page signed in.
2. **Trial.** A new account is `trial` for 3 days and the AR camera page opens. `/account` shows the trial end date. Seeding an `expired` user shows the paywall card with Monthly and Yearly buttons.
3. **Checkout.** On `/pricing` click Monthly. The Paddle overlay opens; pay with a sandbox test card (for example `4242 4242 4242 4242`, any future expiry, any CVC). After success the account shows `active`.
4. **Webhook delivery.** In Paddle > Developer Tools > Notifications > Event log, `subscription.created` and `subscription.activated` show status delivered (200). If one failed, use Replay after fixing the cause (a wrong `PADDLE_WEBHOOK_SECRET` gives 401).
5. **Manage subscription.** On `/account` click Manage subscription. The Paddle customer portal opens, showing the plan and payment method.
6. **Cancel.** A cancel from the customer portal is scheduled for the end of the billing period: Paddle sends `subscription.updated` with the subscription still active, so `/account` keeps showing "Current period ends ..." and AR mode stays available until that date, when `subscription.canceled` arrives. To see the cancelled state right away in the sandbox, cancel the subscription immediately from the Paddle dashboard (Customers or Subscriptions > the subscription > Cancel > Immediately); `/account` then shows "Subscription ended".
7. **Sign out.** Sign out clears the `rw_session` cookie and the AR page shows the sign-in card again.
