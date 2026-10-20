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
