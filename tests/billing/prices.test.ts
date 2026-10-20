import { allowedPriceIds, eventPriceIds } from '../../lib/billing/prices'

describe('allowedPriceIds (fail-closed allow-list of Rating Watch prices)', () => {
  it('reads PADDLE_PRICE_IDS separated by commas and/or whitespace', () => {
    expect(allowedPriceIds({ PADDLE_PRICE_IDS: 'pri_a,pri_b' })).toEqual(['pri_a', 'pri_b'])
    expect(allowedPriceIds({ PADDLE_PRICE_IDS: ' pri_a , pri_b\npri_c\tpri_d  ' })).toEqual(['pri_a', 'pri_b', 'pri_c', 'pri_d'])
  })
  it('PADDLE_PRICE_IDS wins over the public monthly/yearly ids', () => {
    expect(allowedPriceIds({ PADDLE_PRICE_IDS: 'pri_a', NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY: 'pri_m', NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY: 'pri_y' })).toEqual(['pri_a'])
  })
  it('falls back to the public monthly and yearly ids when PADDLE_PRICE_IDS yields nothing', () => {
    const pub = { NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY: ' pri_m ', NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY: 'pri_y' }
    expect(allowedPriceIds(pub)).toEqual(['pri_m', 'pri_y'])
    expect(allowedPriceIds({ ...pub, PADDLE_PRICE_IDS: '' })).toEqual(['pri_m', 'pri_y'])
    expect(allowedPriceIds({ ...pub, PADDLE_PRICE_IDS: ' , ,\n ' })).toEqual(['pri_m', 'pri_y'])
    expect(allowedPriceIds({ NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY: 'pri_m' })).toEqual(['pri_m'])
  })
  it('dedupes and drops blanks', () => {
    expect(allowedPriceIds({ PADDLE_PRICE_IDS: 'pri_a,,pri_a, pri_b ,pri_a' })).toEqual(['pri_a', 'pri_b'])
    expect(allowedPriceIds({ NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY: 'pri_m', NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY: 'pri_m' })).toEqual(['pri_m'])
    expect(allowedPriceIds({ NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY: '  ', NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY: '' })).toEqual([])
  })
  it('returns an empty list when nothing is set', () => {
    expect(allowedPriceIds({})).toEqual([])
  })
  it('reads process.env at call time when no env is passed', () => {
    const saved = { ...process.env }
    try {
      delete process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY
      delete process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY
      process.env.PADDLE_PRICE_IDS = 'pri_env1 pri_env2'
      expect(allowedPriceIds()).toEqual(['pri_env1', 'pri_env2'])
      delete process.env.PADDLE_PRICE_IDS
      expect(allowedPriceIds()).toEqual([])
    } finally {
      process.env = saved
    }
  })
})

describe('eventPriceIds', () => {
  it('collects items[].price.id and items[].price_id', () => {
    expect(eventPriceIds({ items: [{ price: { id: 'pri_a' } }, { price_id: 'pri_b' }, { price: { id: 'pri_c' }, price_id: 'pri_c' }] })).toEqual(['pri_a', 'pri_b', 'pri_c', 'pri_c'])
  })
  it('ignores non-string ids and tolerates missing or malformed items', () => {
    expect(eventPriceIds({ items: [{ price: { id: 5 } }, { price_id: null }, null, 'x', { price: null }] })).toEqual([])
    for (const d of [undefined, null, {}, { items: 'x' }, { items: {} }, 5]) expect(eventPriceIds(d)).toEqual([])
  })
})
