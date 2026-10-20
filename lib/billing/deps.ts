import { getUsersDb, type UsersDb } from './db'
import { createGoogleAuth, type GoogleAuth } from './google'
import { createPaddleApi, type PaddleApi } from './paddle'
import { allowedPriceIds } from './prices'

export interface Deps {
  db: UsersDb
  paddle: PaddleApi | null
  webhookSecret?: string
  google: GoogleAuth | null
  appUrl: string
  // Rating Watch price ids (Ruling P). Empty means billing events and verification are refused.
  priceIds: string[]
  now(): number
}

// Env is read on every call (never at import) so `next build` works without any secrets.
export function defaultDeps(): Deps {
  const appUrl = (process.env.APP_URL ?? 'https://rating.watch').replace(/\/$/, '')
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  return {
    // Lazy (Ruling W): an unconfigured deploy must never open the database, so open it on first use only.
    get db() { return getUsersDb() },
    paddle: createPaddleApi({ apiKey: process.env.PADDLE_API_KEY, env: process.env.PADDLE_ENV ?? process.env.NEXT_PUBLIC_PADDLE_ENV }),
    webhookSecret: process.env.PADDLE_WEBHOOK_SECRET,
    google: clientId && clientSecret ? createGoogleAuth({ clientId, clientSecret, redirectUri: `${appUrl}/api/auth/callback` }) : null,
    appUrl,
    priceIds: allowedPriceIds(),
    now: () => Date.now(),
  }
}
