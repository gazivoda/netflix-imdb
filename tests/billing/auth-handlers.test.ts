import { handleGoogleCallback, handleGoogleStart, handleMe, handleSignout, safeNextPath } from '../../lib/billing/auth-handlers'
import { openUsersDb } from '../../lib/billing/db'
import { parseCookies, SESSION_COOKIE, signSession, verifySession } from '../../lib/billing/session'
import type { Deps } from '../../lib/billing/deps'
import type { GoogleAuth } from '../../lib/billing/google'
import type { PaddleApi } from '../../lib/billing/paddle'

const NOW = Date.parse('2026-10-20T12:00:00Z')
const BILLING_ENV = ['NEXT_PUBLIC_PADDLE_CLIENT_TOKEN', 'NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY', 'NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY', 'BILLING_DATA_PERSISTENT']
beforeEach(() => {
  process.env.JWT_SECRET = 'k'.repeat(40)
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = 'live_clienttoken'
  process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_MONTHLY = 'pri_m'
  process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY = 'pri_y'
  process.env.BILLING_DATA_PERSISTENT = 'true'
})
afterAll(() => { delete process.env.JWT_SECRET; BILLING_ENV.forEach((k) => delete process.env[k]) })

function deps(over: Partial<Deps> = {}): Deps {
  const google: GoogleAuth = {
    authUrl: (state) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
    exchange: async (code) => {
      if (code === 'bad') throw new Error('invalid_grant')
      return { sub: 'g1', email: 'Igor@Example.com', name: 'Igor', picture: 'https://p/x.png' }
    },
  }
  return { db: openUsersDb(':memory:', () => NOW), paddle: null, google, appUrl: 'https://rating.watch', priceIds: [], now: () => NOW, ...over }
}
// Everything Ruling V requires for the paywall to be on (JWT_SECRET is set by beforeEach).
const paddleStub: PaddleApi = { getTransaction: async () => ({}), getSubscription: async () => ({}), getCustomer: async () => ({}), createPortalSession: async () => 'https://p/x' }
const configured = (over: Partial<Deps> = {}): Deps => deps({ paddle: paddleStub, webhookSecret: 'pdl_ntfset_x', priceIds: ['pri_m', 'pri_y'], ...over })
const setCookies = (r: Response) => r.headers.getSetCookie()
const cookieValue = (r: Response, name: string) => {
  const line = setCookies(r).find((c) => c.startsWith(`${name}=`))
  return line ? line.split(';')[0].slice(name.length + 1) : undefined
}

describe('safeNextPath (open redirect guard)', () => {
  it('allows single-slash relative paths only', () => {
    expect(safeNextPath('/camera-vision/ar')).toBe('/camera-vision/ar')
    expect(safeNextPath('/pricing?x=1')).toBe('/pricing?x=1')
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '', null, 'camera-vision']) {
      expect(safeNextPath(bad as any)).toBe('/')
    }
  })
  it('rejects control characters (a raw CR, LF or tab would make the Location header throw)', () => {
    for (const bad of ['/a\nb', '/a\tb', '/a\rb', '/a\u0000b', '/a\u001fb', '/a\u007fb', '/\r\nSet-Cookie: x=1']) {
      expect(safeNextPath(bad)).toBe('/')
    }
    expect(safeNextPath('/%0d%0a')).toBe('/%0d%0a') // percent-encoded stays an inert path segment
  })
  it('a next cookie that decodes to a newline falls back to / without failing the sign-in', async () => {
    const d = deps()
    const r = await handleGoogleCallback(new Request('https://rating.watch/api/auth/callback?code=ok&state=s1', { headers: { cookie: 'rw_oauth_state=s1; rw_next=%2Fa%0D%0Ab' } }), d)
    expect(r.headers.get('location')).toBe('https://rating.watch/')
    expect(cookieValue(r, SESSION_COOKIE)).toBeDefined()
  })
})

describe('handleGoogleStart', () => {
  it('redirects to Google with a state cookie that matches, and remembers a safe next', () => {
    const r = handleGoogleStart(new Request('https://rating.watch/api/auth/google?next=/camera-vision/ar'), deps())
    expect(r.status).toBe(302)
    const state = cookieValue(r, 'rw_oauth_state')!
    expect(r.headers.get('location')).toContain(`state=${state}`)
    expect(cookieValue(r, 'rw_next')).toBe(encodeURIComponent('/camera-vision/ar'))
  })
  it('stores / instead of an unsafe next', () => {
    const r = handleGoogleStart(new Request('https://rating.watch/api/auth/google?next=//evil.example'), deps())
    expect(decodeURIComponent(cookieValue(r, 'rw_next')!)).toBe('/')
  })
  it('sends the visitor to /pricing with an error when Google is not configured', () => {
    const r = handleGoogleStart(new Request('https://rating.watch/api/auth/google'), deps({ google: null }))
    expect(r.headers.get('location')).toBe('https://rating.watch/pricing?auth_error=not_configured')
  })
})

describe('handleGoogleCallback', () => {
  const req = (qs: string, cookie = 'rw_oauth_state=s1; rw_next=%2Fcamera-vision%2Far') =>
    new Request(`https://rating.watch/api/auth/callback?${qs}`, { headers: { cookie } })

  it('creates a user with a 3-day trial, sets the session cookie and returns to next', async () => {
    const d = deps()
    const r = await handleGoogleCallback(req('code=ok&state=s1'), d)
    expect(r.headers.get('location')).toBe('https://rating.watch/camera-vision/ar')
    const user = d.db.get('g1')!
    expect(user.subscription_status).toBe('trial')
    expect(Date.parse(user.trial_end_date)).toBe(NOW + 3 * 86_400_000)
    expect(verifySession(cookieValue(r, SESSION_COOKIE)!)).toBe('g1')
    expect(setCookies(r).find((c) => c.startsWith(`${SESSION_COOKIE}=`))).toMatch(/HttpOnly.*SameSite=Lax.*Secure/)
  })
  it('does not reset the trial or subscription of an existing user, but refreshes profile fields', async () => {
    const d = configured()
    d.db.save({ id: 'g1', email: 'old@x.co', name: 'Old', avatar: null, trial_end_date: new Date(NOW - 1000).toISOString(), subscription_status: 'active', subscription_plan: 'yearly', subscription_end_date: null, paddle_subscription_id: 'sub_1', paddle_customer_id: 'ctm_1', created_at: new Date(NOW - 9e9).toISOString() })
    await handleGoogleCallback(req('code=ok&state=s1'), d)
    const u = d.db.get('g1')!
    expect(u).toMatchObject({ subscription_status: 'active', paddle_customer_id: 'ctm_1', name: 'Igor' })
  })
  it('rejects a state mismatch or a missing state cookie without creating a user', async () => {
    const d = deps()
    for (const r of [await handleGoogleCallback(req('code=ok&state=WRONG'), d), await handleGoogleCallback(req('code=ok&state=s1', ''), d)]) {
      expect(r.headers.get('location')).toBe('https://rating.watch/pricing?auth_error=state_mismatch')
      expect(cookieValue(r, SESSION_COOKIE)).toBeUndefined()
    }
    expect(d.db.get('g1')).toBeNull()
  })
  it('turns consent denial, a missing code and a failed exchange into error redirects, never a 500', async () => {
    jest.spyOn(console, 'error').mockImplementationOnce(() => {})
    const d = deps()
    expect((await handleGoogleCallback(req('error=access_denied&state=s1'), d)).headers.get('location')).toBe('https://rating.watch/pricing?auth_error=access_denied')
    expect((await handleGoogleCallback(req('state=s1'), d)).headers.get('location')).toBe('https://rating.watch/pricing?auth_error=no_code')
    expect((await handleGoogleCallback(req('code=bad&state=s1'), d)).headers.get('location')).toBe('https://rating.watch/pricing?auth_error=callback_failed')
  })
  it('logs why the callback failed (message only, never the code or tokens) and still redirects', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const r = await handleGoogleCallback(req('code=bad&state=s1'), deps())
      expect(r.headers.get('location')).toBe('https://rating.watch/pricing?auth_error=callback_failed')
      expect(spy).toHaveBeenCalledWith('google callback failed:', 'invalid_grant')
      expect(JSON.stringify(spy.mock.calls)).not.toMatch(/code=|"bad"/)
      spy.mockClear()
      const thrower = deps({ google: { authUrl: () => '', exchange: async () => { throw 'plain string' } } })
      await handleGoogleCallback(req('code=ok&state=s1'), thrower)
      expect(spy).toHaveBeenCalledWith('google callback failed:', 'plain string')
    } finally {
      spy.mockRestore()
    }
  })
  it('ignores an unsafe next cookie', async () => {
    const r = await handleGoogleCallback(req('code=ok&state=s1', 'rw_oauth_state=s1; rw_next=%2F%2Fevil.example'), deps())
    expect(r.headers.get('location')).toBe('https://rating.watch/')
  })
})

describe('handleMe / handleSignout', () => {
  it('reports signed out without a session, and the public user with one', async () => {
    const d = configured()
    d.db.save({ id: 'g1', email: 'a@b.co', name: 'A', avatar: null, trial_end_date: new Date(NOW + 1000).toISOString(), subscription_status: 'trial', subscription_plan: null, subscription_end_date: null, paddle_subscription_id: null, paddle_customer_id: null, created_at: new Date(NOW).toISOString() })
    expect(await handleMe(new Request('https://x/api/user/me'), d).json()).toEqual({ user: null, access: 'no_auth', billingEnabled: true })
    const signedIn = await handleMe(new Request('https://x/api/user/me', { headers: { cookie: `${SESSION_COOKIE}=${signSession('g1')}` } }), d).json()
    expect(signedIn.access).toBe('trial_active')
    expect(signedIn.user.id).toBe('g1')
    expect(signedIn.billingEnabled).toBe(true)
  })
  describe('billingEnabled (Ruling V: paywall stays off until configured)', () => {
    const me = async (d: Deps, signedIn = false) => {
      d.db.save({ id: 'g1', email: 'a@b.co', name: 'A', avatar: null, trial_end_date: new Date(NOW + 1000).toISOString(), subscription_status: 'trial', subscription_plan: null, subscription_end_date: null, paddle_subscription_id: null, paddle_customer_id: null, created_at: new Date(NOW).toISOString() })
      const headers = signedIn ? { cookie: `${SESSION_COOKIE}=${signSession('g1')}` } : undefined
      const res = handleMe(new Request('https://x/api/user/me', { headers }), d)
      return { status: res.status, body: await res.json() }
    }
    it('is true when everything is configured', async () => {
      expect((await me(configured())).body.billingEnabled).toBe(true)
    })
    it.each([
      ['google', () => configured({ google: null })],
      ['paddle', () => configured({ paddle: null })],
      ['webhook secret', () => configured({ webhookSecret: undefined })],
      ['price ids', () => configured({ priceIds: [] })],
    ] as [string, () => Deps][])('is false when %s is missing, signed in or not', async (_n, make) => {
      for (const signedIn of [false, true]) {
        const { status, body } = await me(make(), signedIn)
        expect(status).toBe(200)
        expect(body.billingEnabled).toBe(false)
      }
    })
    it('is false when JWT_SECRET is missing or short', async () => {
      delete process.env.JWT_SECRET
      expect((await me(configured())).body.billingEnabled).toBe(false)
      process.env.JWT_SECRET = 'short'
      expect((await me(configured())).body.billingEnabled).toBe(false)
    })
    it('is false when the checkout client token is missing (Ruling X)', async () => {
      delete process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
      expect((await me(configured())).body.billingEnabled).toBe(false)
    })
    it('is false when the build lacked a NEXT_PUBLIC price id (OPS-7) or persistence is not asserted (SEC-4)', async () => {
      delete process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY
      expect((await me(configured())).body.billingEnabled).toBe(false)
      process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_YEARLY = 'pri_y'
      expect((await me(configured())).body.billingEnabled).toBe(true)
      delete process.env.BILLING_DATA_PERSISTENT
      expect((await me(configured())).body.billingEnabled).toBe(false)
    })
    it('never touches the database when billing is not configured (Ruling W)', async () => {
      const getter = jest.fn(() => { throw new Error('db must not be opened') })
      const d = { ...deps({ priceIds: [] }) } as Deps
      Object.defineProperty(d, 'db', { get: getter })
      const withSession = await handleMe(new Request('https://x/api/user/me', { headers: { cookie: `${SESSION_COOKIE}=${signSession('g1')}` } }), d)
      expect(withSession.status).toBe(200)
      expect(await withSession.json()).toEqual({ user: null, access: 'no_auth', billingEnabled: false })
      const anon = handleMe(new Request('https://x/api/user/me'), d)
      expect(await anon.json()).toEqual({ user: null, access: 'no_auth', billingEnabled: false })
      expect(getter).not.toHaveBeenCalled()
    })
    it('answers 503 when billing is configured but the database cannot be opened (no fail-open)', async () => {
      const d = { ...configured() } as Deps
      Object.defineProperty(d, 'db', { get: () => { throw new Error('unable to open database file') } })
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const res = handleMe(new Request('https://x/api/user/me', { headers: { cookie: `${SESSION_COOKIE}=${signSession('g1')}` } }), d)
        expect(res.status).toBe(503)
        expect(await res.json()).toEqual({ error: 'Service unavailable' })
      } finally { spy.mockRestore() }
    })
    it('reports it even for an unconfigured server with no session', async () => {
      expect((await me(deps())).body).toEqual({ user: null, access: 'no_auth', billingEnabled: false })
    })
  })
  it('treats a valid token for a deleted user as signed out', async () => {
    const r = await handleMe(new Request('https://x/api/user/me', { headers: { cookie: `${SESSION_COOKIE}=${signSession('ghost')}` } }), deps()).json()
    expect(r.access).toBe('no_auth')
  })
  it('signout clears the session cookie', () => {
    const r = handleSignout(new Request('https://x/api/auth/signout', { method: 'POST' }), deps())
    expect(setCookies(r)[0]).toMatch(/^rw_session=; Path=\/; Max-Age=0/)
  })
  it('does not crash when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET
    const r = await handleMe(new Request('https://x/api/user/me', { headers: { cookie: `${SESSION_COOKIE}=abc` } }), deps()).json()
    expect(r.access).toBe('no_auth')
    expect(r.billingEnabled).toBe(false)
  })
})
