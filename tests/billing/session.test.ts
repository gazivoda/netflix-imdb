import jwt from 'jsonwebtoken'
import { clearCookie, isSessionConfigured, parseCookies, readSessionUserId, SESSION_COOKIE, setCookie, signSession, verifySession } from '../../lib/billing/session'

const SECRET = 'x'.repeat(40)
beforeEach(() => { process.env.JWT_SECRET = SECRET })
afterAll(() => { delete process.env.JWT_SECRET })

describe('session tokens', () => {
  it('round-trips a user id', () => expect(verifySession(signSession('g1'))).toBe('g1'))
  it('rejects a token signed with another secret, a tampered token and garbage', () => {
    const forged = jwt.sign({ sub: 'g1' }, 'y'.repeat(40), { algorithm: 'HS256' })
    expect(verifySession(forged)).toBeNull()
    expect(verifySession(signSession('g1') + 'x')).toBeNull()
    expect(verifySession('not-a-jwt')).toBeNull()
  })
  it('rejects alg=none tokens', () => {
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"sub":"g1"}').toString('base64url')}.`
    expect(verifySession(none)).toBeNull()
  })
  it('rejects a token signed HS384 with the correct secret (algorithm pinned to HS256)', () => {
    const hs384 = jwt.sign({ sub: 'g1' }, SECRET, { algorithm: 'HS384' })
    expect(jwt.verify(hs384, SECRET)).toMatchObject({ sub: 'g1' }) // valid in itself, so only the pin rejects it
    expect(verifySession(hs384)).toBeNull()
  })
  it('rejects a payload swap: the signature of payload A with payload B in its place', () => {
    const [header, , sig] = signSession('g1').split('.')
    const [, payloadB] = jwt.sign({ sub: 'admin' }, 'z'.repeat(40), { algorithm: 'HS256' }).split('.')
    expect(verifySession(`${header}.${payloadB}.${sig}`)).toBeNull()
  })
  it('rejects an expired token', () => {
    const old = jwt.sign({ sub: 'g1' }, SECRET, { algorithm: 'HS256', expiresIn: -10 })
    expect(verifySession(old)).toBeNull()
  })
  it('throws a clear error when JWT_SECRET is missing or short (only when used)', () => {
    process.env.JWT_SECRET = 'short'
    expect(() => signSession('g1')).toThrow(/JWT_SECRET/)
    delete process.env.JWT_SECRET
    expect(verifySession('anything')).toBeNull() // reading must not crash a request when unconfigured
  })
})

describe('isSessionConfigured', () => {
  it('is true only for a JWT_SECRET of 32+ characters', () => {
    expect(isSessionConfigured()).toBe(true)
    process.env.JWT_SECRET = 'k'.repeat(31)
    expect(isSessionConfigured()).toBe(false)
    process.env.JWT_SECRET = ''
    expect(isSessionConfigured()).toBe(false)
    delete process.env.JWT_SECRET
    expect(isSessionConfigured()).toBe(false)
  })
})

describe('cookies', () => {
  it('parses a Cookie header including values with =', () => {
    expect(parseCookies('a=1; rw_session=abc.def==; b=x y')).toEqual({ a: '1', rw_session: 'abc.def==', b: 'x y' })
    expect(parseCookies(null)).toEqual({})
  })
  it('reads the user id from a request cookie, null without one', () => {
    const token = signSession('g9')
    expect(readSessionUserId(new Request('http://x', { headers: { cookie: `${SESSION_COOKIE}=${token}` } }))).toBe('g9')
    expect(readSessionUserId(new Request('http://x'))).toBeNull()
  })
  it('formats secure, HttpOnly, SameSite=Lax cookies and a clearing cookie', () => {
    expect(setCookie('n', 'v', { secure: true, maxAgeS: 60 })).toBe('n=v; Path=/; Max-Age=60; HttpOnly; SameSite=Lax; Secure')
    expect(setCookie('n', 'v', { secure: false, maxAgeS: 60 })).not.toMatch(/Secure/)
    expect(clearCookie('n', true)).toMatch(/^n=; Path=\/; Max-Age=0; HttpOnly; SameSite=Lax; Secure$/)
  })
})
