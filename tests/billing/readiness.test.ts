import fs from 'fs'
import path from 'path'
import { billingReadiness } from '../../lib/billing/readiness'
import { proOnSale } from '../../lib/billing/flag'
import { GOVERNING_LAW, LEGAL_ADDRESS, LEGAL_ENTITY } from '../../lib/content'

const ON = {
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: 'live_x', NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY: 'pri_m', NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY: 'pri_y',
  GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's', JWT_SECRET: 'k'.repeat(32), PADDLE_API_KEY: 'k', PADDLE_WEBHOOK_SECRET: 'w',
  PADDLE_PRICE_IDS: 'pri_m,pri_y', BILLING_DATA_PERSISTENT: 'true', OMDB_API_KEY: 'o',
}
const FILLED = { entity: 'Igor Gazivoda', address: '1 Main St', governingLaw: 'the laws of Serbia' }

describe('billingReadiness', () => {
  it('has no blockers when billing is on and everything, including the legal identity, is filled in', () => {
    expect(billingReadiness(ON, FILLED)).toEqual({ billingOn: true, blockers: [], warnings: [] })
  })

  it('the shipped legal constants block launch: the entity is set, address and governing law are pre-launch TODOs', () => {
    expect(LEGAL_ENTITY).toBe('Igor Gazivoda')
    const r = billingReadiness(ON, { entity: LEGAL_ENTITY, address: LEGAL_ADDRESS, governingLaw: GOVERNING_LAW })
    expect(r.billingOn).toBe(true)
    expect(r.blockers).toHaveLength(2)
    expect(r.blockers.join('\n')).toMatch(/LEGAL_ADDRESS is empty/)
    expect(r.blockers.join('\n')).toMatch(/GOVERNING_LAW is empty/)
    expect(r.blockers.join('\n')).not.toMatch(/LEGAL_ENTITY/)
  })

  it('an empty entity is a blocker too', () => {
    expect(billingReadiness(ON, { ...FILLED, entity: ' ' }).blockers.join('\n')).toMatch(/LEGAL_ENTITY is empty/)
  })

  it('legal gaps do not block while billing is off (they only keep the blocks off /privacy and /terms)', () => {
    const r = billingReadiness({}, { entity: '', address: '', governingLaw: '' })
    expect(r.billingOn).toBe(false)
    expect(r.blockers).toEqual([])
    expect(r.warnings.join('\n')).toMatch(/Build Variables/)
  })

  it('billing counts as on only when the three NEXT_PUBLIC checkout values exist (they are build-time)', () => {
    for (const k of ['NEXT_PUBLIC_PADDLE_CLIENT_TOKEN', 'NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY', 'NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY']) {
      expect(billingReadiness({ ...ON, [k]: '' }, FILLED).billingOn).toBe(false)
    }
  })

  it.each([
    ['GOOGLE_CLIENT_SECRET', /GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/],
    ['JWT_SECRET', /JWT_SECRET/],
    ['PADDLE_API_KEY', /PADDLE_API_KEY/],
    ['PADDLE_WEBHOOK_SECRET', /PADDLE_WEBHOOK_SECRET/],
    ['BILLING_DATA_PERSISTENT', /BILLING_DATA_PERSISTENT/],
    ['OMDB_API_KEY', /OMDB_API_KEY/],
  ])('blocks when %s is missing', (key, re) => {
    expect(billingReadiness({ ...ON, [key]: undefined }, FILLED).blockers.join('\n')).toMatch(re)
  })

  it('rejects a short JWT secret and a persistent flag that is not "true"', () => {
    expect(billingReadiness({ ...ON, JWT_SECRET: 'short' }, FILLED).blockers.join('\n')).toMatch(/JWT_SECRET/)
    expect(billingReadiness({ ...ON, BILLING_DATA_PERSISTENT: 'yes' }, FILLED).blockers.join('\n')).toMatch(/BILLING_DATA_PERSISTENT/)
  })

  it('warns about a bad or too-large daily OMDb budget, and stays quiet for a sensible one', () => {
    expect(billingReadiness({ ...ON, OMDB_DAILY_BUDGET: 'lots' }, FILLED).warnings.join('\n')).toMatch(/not a positive integer/)
    expect(billingReadiness({ ...ON, OMDB_DAILY_BUDGET: '1500' }, FILLED).warnings.join('\n')).toMatch(/1000 or more/)
    expect(billingReadiness({ ...ON, OMDB_DAILY_BUDGET: '800' }, FILLED).warnings).toEqual([])
  })
})

describe('billing-on rule matches the build-time flag the static pages use', () => {
  it('readiness.billingOn === proOnSale() for every combination of the three checkout values', () => {
    for (const mask of Array.from({ length: 8 }, (_, i) => i)) {
      const v = (bit: number, x: string) => (mask & bit ? x : '')
      const env = { NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: v(1, 't'), NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY: v(2, 'm'), NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY: v(4, 'y') }
      expect(billingReadiness(env, FILLED).billingOn).toBe(proOnSale({ token: env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN, monthly: env.NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY, yearly: env.NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY }))
    }
  })
  it('proOnSale needs all three and ignores blank values', () => {
    expect(proOnSale({ token: 't', monthly: 'm', yearly: 'y' })).toBe(true)
    expect(proOnSale({ token: 't', monthly: ' ', yearly: 'y' })).toBe(false)
    expect(proOnSale({})).toBe(false)
  })
  it('the flag file documents that the NEXT_PUBLIC values are build variables', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'lib/billing/flag.ts'), 'utf8')
    expect(src).toMatch(/Build Variables/)
    expect(src).toMatch(/REBUILD/)
  })
})

describe('the pre-launch TODOs stay visible in the source and the check is wired up', () => {
  const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8')
  it('lib/content.ts marks the empty constants as TODO(pre-launch) and points at the check', () => {
    const src = read('lib/content.ts')
    expect(src).toMatch(/LEGAL_ADDRESS: string = ''; \/\/ TODO\(pre-launch\)/)
    expect(src).toMatch(/GOVERNING_LAW: string = ''; \/\/ TODO\(pre-launch\)/)
    expect(src).toMatch(/npm run billing:readiness/)
  })
  it('package.json exposes billing:readiness and the script runs the shared rules', () => {
    expect(JSON.parse(read('package.json')).scripts['billing:readiness']).toBe('node scripts/billing-readiness.mjs')
    expect(read('scripts/billing-readiness.mjs')).toMatch(/billingReadiness\(process\.env/)
  })
})
