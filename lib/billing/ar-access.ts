import { computeAccessStatus, toPublicUser } from './access'
import { gateDecision } from './client'
import { billingConfigured } from './config'
import type { Deps } from './deps'
import { verifySession } from './session'
import type { PublicUser } from './types'

// What /camera-vision/ar renders, decided on the server from the session cookie so the AR page is never sent to a
// visitor who is not entitled to it. 'open' covers both "billing is off" and "entitled".
export type ArGate =
  | { kind: 'open' }
  | { kind: 'signin' }
  | { kind: 'paywall' | 'update-payment'; user: PublicUser }
  | { kind: 'locked' } // the account could not be checked: fail closed

/**
 * Billing off: AR stays open (the paywall must not exist before checkout does).
 * Billing on: a valid session whose user is in a trial or subscribed; anything else is a gate.
 * Any failure while looking the account up (database locked, missing file, thrown error) is 'locked', never 'open'.
 */
export function resolveArGate(
  sessionToken: string | undefined,
  deps: Deps,
  billingOn: (d: Deps) => boolean = billingConfigured,
): ArGate {
  try {
    if (!billingOn(deps)) return { kind: 'open' }
    const userId = sessionToken ? verifySession(sessionToken) : null
    const user = userId ? deps.db.get(userId) : null
    if (!user) return { kind: 'signin' }
    const pub = toPublicUser(user, deps.now())
    const decision = gateDecision({ loading: false, billingEnabled: true, user: pub, access: computeAccessStatus(user, deps.now()) })
    if (decision === 'camera' || decision === 'open') return { kind: 'open' }
    if (decision === 'update-payment' || decision === 'paywall') return { kind: decision, user: pub }
    return { kind: 'signin' }
  } catch (err) {
    console.error('ar gate lookup failed:', err instanceof Error ? err.message : String(err))
    return { kind: 'locked' }
  }
}
