import { clientIp, createLimiter, validateTitles } from '../../lib/ratings-guard'

describe('createLimiter (token bucket)', () => {
  const cfg = { capacity: 3, refillPerSec: 1 }

  it('allows the burst, then refuses with a whole-second Retry-After', () => {
    const l = createLimiter(cfg)
    for (let i = 0; i < 3; i++) expect(l.take('a', 0).allowed).toBe(true)
    expect(l.take('a', 0)).toEqual({ allowed: false, retryAfterS: 1 })
  })

  it('refills over time and never above capacity', () => {
    const l = createLimiter(cfg)
    for (let i = 0; i < 3; i++) l.take('a', 0)
    expect(l.take('a', 500).allowed).toBe(false)
    expect(l.take('a', 1000).allowed).toBe(true)
    for (let i = 0; i < 3; i++) expect(l.take('a', 1_000_000).allowed).toBe(true)
    expect(l.take('a', 1_000_000).allowed).toBe(false)
  })

  it('keeps keys independent', () => {
    const l = createLimiter(cfg)
    for (let i = 0; i < 3; i++) l.take('a', 0)
    expect(l.take('a', 0).allowed).toBe(false)
    expect(l.take('b', 0).allowed).toBe(true)
  })

  it('caps tracked keys and evicts the longest idle one', () => {
    const l = createLimiter(cfg, 3)
    for (const k of ['a', 'b', 'c']) l.take(k, 0)
    l.take('a', 1) // a is now the most recently used
    l.take('d', 2) // evicts b
    expect(l.size()).toBe(3)
    for (let i = 0; i < 2; i++) l.take('b', 3)
    // b came back as a fresh full bucket (3 tokens), proving it was evicted rather than remembered as drained
    expect(l.take('b', 3).allowed).toBe(true)
  })
})

describe('clientIp', () => {
  it('uses the first X-Forwarded-For hop, trimmed and length-limited', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': ' 1.2.3.4 , 10.0.0.1' }))).toBe('1.2.3.4')
    expect(clientIp(new Headers({ 'x-forwarded-for': 'x'.repeat(500) })).length).toBe(64)
  })
  it('falls back to a constant', () => {
    expect(clientIp(new Headers())).toBe('unknown')
    expect(clientIp(new Headers({ 'x-forwarded-for': ' ' }))).toBe('unknown')
  })
})

describe('validateTitles', () => {
  it('accepts normal titles, including non-Latin ones', () => {
    expect(validateTitles(['Inception', '日本沈没', '1917', 'Se7en'])).toEqual({ ok: true, titles: ['Inception', '日本沈没', '1917', 'Se7en'] })
  })
  it('rejects non-arrays, empty arrays, non-strings and more than 20', () => {
    for (const bad of [undefined, 'x', [], [1], ['a', null], Array(21).fill('a')]) expect(validateTitles(bad).ok).toBe(false)
  })
  it('rejects empty, oversized, control-character and symbol-only titles', () => {
    for (const t of ['', '  ', 'a'.repeat(121), 'a\u0001b', '###']) expect(validateTitles([t]).ok).toBe(false)
  })
})
