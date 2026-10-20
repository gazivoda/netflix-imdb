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
