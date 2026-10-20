import jwt from 'jsonwebtoken'

export const SESSION_COOKIE = 'rw_session'
export const SESSION_MAX_AGE_S = 14 * 24 * 60 * 60

function secret(): string {
  const s = process.env.JWT_SECRET
  if (!s || !isSessionConfigured()) throw new Error('JWT_SECRET must be set to a random string of 32+ characters')
  return s
}

// True only when sessions can be signed. Never throws and never exposes the value (used by the billing switch).
export function isSessionConfigured(): boolean {
  const s = process.env.JWT_SECRET
  return typeof s === 'string' && s.length >= 32
}

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId }, secret(), { algorithm: 'HS256', expiresIn: SESSION_MAX_AGE_S })
}

// An unconfigured server must answer "signed out", not crash every request.
export function verifySession(token: string): string | null {
  try {
    const payload = jwt.verify(token, secret(), { algorithms: ['HS256'] })
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim()
  }
  return out
}

export function readSessionUserId(req: Request): string | null {
  const token = parseCookies(req.headers.get('cookie'))[SESSION_COOKIE]
  return token ? verifySession(token) : null
}

export function setCookie(name: string, value: string, opts: { secure: boolean; maxAgeS: number }): string {
  return `${name}=${value}; Path=/; Max-Age=${opts.maxAgeS}; HttpOnly; SameSite=Lax${opts.secure ? '; Secure' : ''}`
}

export function clearCookie(name: string, secure: boolean): string {
  return setCookie(name, '', { secure, maxAgeS: 0 })
}
