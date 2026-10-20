import { openUsersDb } from './db'
import { signSession } from './session'
import { TRIAL_DAYS } from './access'
import type { SubscriptionStatus, UserRecord } from './types'

export const DEV_USER_ID = 'dev-user'
const DAY_MS = 86_400_000

export interface SeedOptions {
  nodeEnv: string | undefined
  status: SubscriptionStatus
  dbFile: string
  jwtSecret?: string
  now?: number
}

// Local development helper: writes one fixture user and returns a session cookie for it.
// Never runs in production; the secret is only used to sign and is never returned.
export function seedUser(opts: SeedOptions): { user: UserRecord; cookie: string } {
  if (opts.nodeEnv?.trim().toLowerCase() === 'production') throw new Error('dev-seed-user must not run in production')
  const now = opts.now ?? Date.now()

  const db = openUsersDb(opts.dbFile, () => now)
  let user: UserRecord
  try {
    user = db.save({
      id: DEV_USER_ID,
      email: 'dev@example.com',
      name: 'Dev User',
      avatar: null,
      trial_end_date: new Date(opts.status === 'expired' ? now - DAY_MS : now + TRIAL_DAYS * DAY_MS).toISOString(),
      subscription_status: opts.status,
      subscription_plan: opts.status === 'active' ? 'monthly' : null,
      subscription_end_date: null,
      paddle_subscription_id: null,
      paddle_customer_id: null,
      created_at: new Date(now).toISOString(),
    })
  } finally {
    db.close()
  }

  const previous = process.env.JWT_SECRET
  if (opts.jwtSecret !== undefined) process.env.JWT_SECRET = opts.jwtSecret
  try {
    return { user, cookie: `rw_session=${signSession(DEV_USER_ID)}` }
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previous
  }
}
