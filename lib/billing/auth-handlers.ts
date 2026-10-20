import { randomBytes } from 'node:crypto'
import { toPublicUser, TRIAL_DAYS } from './access'
import { billingConfigured } from './config'
import type { Deps } from './deps'
import { clearCookie, parseCookies, readSessionUserId, SESSION_COOKIE, SESSION_MAX_AGE_S, setCookie, signSession } from './session'

const STATE_COOKIE = 'rw_oauth_state'
const NEXT_COOKIE = 'rw_next'
const FIVE_MIN = 300

export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/'
  // Control characters (tab, CR, LF, ...) would make the Location header throw after the user row is saved.
  if (/[\u0000-\u001f\u007f]/.test(next)) return '/'
  return next
}

function redirect(location: string, cookies: string[] = []): Response {
  const h = new Headers({ Location: location })
  for (const c of cookies) h.append('Set-Cookie', c)
  return new Response(null, { status: 302, headers: h })
}

const isHttps = (deps: Deps) => deps.appUrl.startsWith('https')
const authError = (deps: Deps, code: string, cookies: string[] = []) =>
  redirect(`${deps.appUrl}/pricing?auth_error=${encodeURIComponent(code)}`, cookies)

// A malformed percent-escape in the cookie must fall back to "/", not abort the sign-in.
function nextFromCookie(raw: string | undefined): string {
  if (!raw) return '/'
  try {
    return safeNextPath(decodeURIComponent(raw))
  } catch {
    return '/'
  }
}

export function handleGoogleStart(req: Request, deps: Deps): Response {
  if (!deps.google) return authError(deps, 'not_configured')
  const state = randomBytes(16).toString('hex')
  const next = safeNextPath(new URL(req.url).searchParams.get('next'))
  const secure = isHttps(deps)
  return redirect(deps.google.authUrl(state), [
    setCookie(STATE_COOKIE, state, { secure, maxAgeS: FIVE_MIN }),
    setCookie(NEXT_COOKIE, encodeURIComponent(next), { secure, maxAgeS: FIVE_MIN }),
  ])
}

export async function handleGoogleCallback(req: Request, deps: Deps): Promise<Response> {
  const secure = isHttps(deps)
  const clear = [clearCookie(STATE_COOKIE, secure), clearCookie(NEXT_COOKIE, secure)]
  const q = new URL(req.url).searchParams
  const cookies = parseCookies(req.headers.get('cookie'))

  if (!cookies[STATE_COOKIE] || q.get('state') !== cookies[STATE_COOKIE]) return authError(deps, 'state_mismatch', clear)
  if (q.get('error')) return authError(deps, q.get('error')!, clear)
  const code = q.get('code')
  if (!code || !deps.google) return authError(deps, 'no_code', clear)

  try {
    const profile = await deps.google.exchange(code)
    const existing = deps.db.get(profile.sub)
    const now = deps.now()
    const user = deps.db.save(
      existing
        ? { ...existing, email: profile.email ?? existing.email, name: profile.name ?? existing.name, avatar: profile.picture ?? existing.avatar }
        : {
            id: profile.sub, email: profile.email, name: profile.name, avatar: profile.picture,
            trial_end_date: new Date(now + TRIAL_DAYS * 86_400_000).toISOString(),
            subscription_status: 'trial', subscription_plan: null, subscription_end_date: null,
            paddle_subscription_id: null, paddle_customer_id: null, created_at: new Date(now).toISOString(),
          },
    )
    const next = nextFromCookie(cookies[NEXT_COOKIE])
    return redirect(`${deps.appUrl}${next}`, [...clear, setCookie(SESSION_COOKIE, signSession(user.id), { secure, maxAgeS: SESSION_MAX_AGE_S })])
  } catch (err) {
    // Message only: never the code, tokens or profile.
    console.error('google callback failed:', err instanceof Error ? err.message : String(err))
    return authError(deps, 'callback_failed', clear)
  }
}

export function handleSignout(_req: Request, deps: Deps): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearCookie(SESSION_COOKIE, isHttps(deps)) },
  })
}

export function handleMe(req: Request, deps: Deps): Response {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  // Ruling V/W: decide first, and never touch the database while billing is not configured (the paywall is off and AR mode is free).
  if (!billingConfigured(deps)) return json({ user: null, access: 'no_auth', billingEnabled: false })
  const id = readSessionUserId(req)
  let pub = null
  try {
    const user = id ? deps.db.get(id) : null
    pub = user ? toPublicUser(user, deps.now()) : null
  } catch (err) {
    // A configured deployment must not fail open: report unavailable (the client shows the sign-in card). Message only.
    console.error('user lookup failed:', err instanceof Error ? err.message : String(err))
    return json({ error: 'Service unavailable' }, 503)
  }
  return json({ user: pub, access: pub ? pub.access : 'no_auth', billingEnabled: true })
}
