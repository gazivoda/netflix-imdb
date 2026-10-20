import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { seedUser } from '../../lib/billing/dev-seed'
import { verifySession } from '../../lib/billing/session'

const SECRET = 'z'.repeat(40)
const NOW = Date.parse('2026-10-20T12:00:00Z')

afterEach(() => { delete process.env.JWT_SECRET })

it('refuses to run in production', () => {
  expect(() => seedUser({ nodeEnv: 'production', status: 'active', dbFile: ':memory:' })).toThrow(/production/)
})

it.each(['Production', 'PRODUCTION', ' production ', 'production\n'])('refuses production spelled %j and writes nothing', (nodeEnv) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rw-seed-'))
  const dbFile = path.join(dir, 'sub', 'users.db')
  try {
    expect(() => seedUser({ nodeEnv, status: 'active', dbFile, jwtSecret: SECRET })).toThrow(/production/)
    expect(fs.existsSync(path.join(dir, 'sub'))).toBe(false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

it('creates a user in the requested state and returns a session cookie value', () => {
  const r = seedUser({ nodeEnv: 'development', status: 'trial', dbFile: ':memory:', jwtSecret: SECRET, now: NOW })
  expect(r.user.subscription_status).toBe('trial')
  expect(r.user.subscription_plan).toBeNull()
  expect(r.user.trial_end_date).toBe(new Date(NOW + 3 * 86_400_000).toISOString())
  expect(r.cookie).toMatch(/^rw_session=ey/)
})

it('can seed an expired user whose trial ended in the past', () => {
  const r = seedUser({ nodeEnv: 'test', status: 'expired', dbFile: ':memory:', jwtSecret: SECRET, now: NOW })
  expect(r.user.subscription_status).toBe('expired')
  expect(r.user.trial_end_date).toBe(new Date(NOW - 86_400_000).toISOString())
})

it('gives active users the monthly plan and cancelled users none', () => {
  expect(seedUser({ nodeEnv: 'development', status: 'active', dbFile: ':memory:', jwtSecret: SECRET, now: NOW }).user.subscription_plan).toBe('monthly')
  expect(seedUser({ nodeEnv: 'development', status: 'cancelled', dbFile: ':memory:', jwtSecret: SECRET, now: NOW }).user.subscription_plan).toBeNull()
})

it('signs a cookie that verifies back to the dev user', () => {
  const r = seedUser({ nodeEnv: 'development', status: 'active', dbFile: ':memory:', jwtSecret: SECRET })
  process.env.JWT_SECRET = SECRET
  expect(verifySession(r.cookie.replace('rw_session=', ''))).toBe('dev-user')
})

it('does not leak the secret into the returned value and restores the environment', () => {
  process.env.JWT_SECRET = 'a'.repeat(40)
  const r = seedUser({ nodeEnv: 'development', status: 'trial', dbFile: ':memory:', jwtSecret: SECRET })
  expect(JSON.stringify(r)).not.toContain(SECRET)
  expect(process.env.JWT_SECRET).toBe('a'.repeat(40))
})

it('rejects a missing or short secret', () => {
  expect(() => seedUser({ nodeEnv: 'development', status: 'trial', dbFile: ':memory:' })).toThrow(/JWT_SECRET/)
})
