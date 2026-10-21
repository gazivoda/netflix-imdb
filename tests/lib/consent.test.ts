import { CONSENT_KEY, readConsent, shouldPrompt, writeConsent, type ConsentStorage } from '../../lib/consent'

function memory(initial: Record<string, string> = {}): ConsentStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v
    },
  }
}
const NOW = new Date('2026-10-20T12:00:00.000Z')
const stored = (value: unknown, at: unknown) => memory({ [CONSENT_KEY]: JSON.stringify({ value, at }) })

describe('consent storage', () => {
  it('reads null when nothing is stored', () => {
    expect(readConsent(memory(), NOW)).toBeNull()
  })

  it('round-trips both choices under rw_consent as {value, at} with an ISO time', () => {
    for (const v of ['granted', 'denied'] as const) {
      const s = memory()
      expect(writeConsent(s, v, NOW)).toBe(true)
      expect(JSON.parse(s.data.rw_consent)).toEqual({ value: v, at: '2026-10-20T12:00:00.000Z' })
      expect(readConsent(s, NOW)).toBe(v)
    }
  })

  it('a choice is valid just under 12 months and expires at 12 months (then we ask again)', () => {
    const s = memory()
    writeConsent(s, 'granted', NOW)
    expect(readConsent(s, new Date('2027-10-20T11:59:59.999Z'))).toBe('granted')
    expect(readConsent(s, new Date('2027-10-20T12:00:00.000Z'))).toBeNull()
    expect(readConsent(s, new Date('2028-01-01T00:00:00.000Z'))).toBeNull()
    expect(shouldPrompt(readConsent(s, new Date('2027-10-20T12:00:00.000Z')))).toBe(true)
  })

  it('treats corrupt or unrecognised values as no answer', () => {
    expect(readConsent(memory({ [CONSENT_KEY]: 'not json' }), NOW)).toBeNull()
    expect(readConsent(memory({ [CONSENT_KEY]: 'null' }), NOW)).toBeNull()
    expect(readConsent(memory({ [CONSENT_KEY]: '"granted"' }), NOW)).toBeNull()
    expect(readConsent(stored('maybe', NOW.toISOString()), NOW)).toBeNull()
    expect(readConsent(stored('granted', 'yesterday'), NOW)).toBeNull()
    expect(readConsent(stored('granted', 12345), NOW)).toBeNull()
    expect(readConsent(stored('granted', undefined), NOW)).toBeNull()
  })

  it('treats a timestamp far in the future as invalid but tolerates small clock skew', () => {
    expect(readConsent(stored('granted', '2030-01-01T00:00:00.000Z'), NOW)).toBeNull()
    expect(readConsent(stored('denied', '2026-10-20T20:00:00.000Z'), NOW)).toBe('denied')
  })

  it('never throws when storage is missing or throws', () => {
    const boom: ConsentStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(readConsent(null, NOW)).toBeNull()
    expect(readConsent(undefined, NOW)).toBeNull()
    expect(readConsent(boom, NOW)).toBeNull()
    expect(writeConsent(null, 'granted', NOW)).toBe(false)
    expect(writeConsent(boom, 'denied', NOW)).toBe(false)
  })

  it('shouldPrompt asks only when there is no valid answer', () => {
    expect(shouldPrompt(null)).toBe(true)
    expect(shouldPrompt('granted')).toBe(false)
    expect(shouldPrompt('denied')).toBe(false)
  })
})
